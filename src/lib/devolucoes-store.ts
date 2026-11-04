import { useCallback, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { atualizarFlex, campo, inserirFlex, numero, texto, type Payload } from "@/lib/supabase-flex";
import { buscarDescricoes } from "@/lib/materiais";
import type { Devolucao, DevolucaoStatus, ItemDevolucao, VolumeItem } from "@/lib/mock-data";

/**
 * Camada única de acesso às devoluções — 100% Supabase (projeto existente do cliente).
 * Nenhum dado é persistido em localStorage e nenhuma estrutura do banco é alterada.
 */

const STATUS_VALIDOS: DevolucaoStatus[] = ["em_montagem", "csv_gerado", "rm_vinculada", "finalizada"];

const ALIAS_DEVOLUCAO = {
  criado_por: ["usuario_id", "user_id", "criado_por_id"],
  usuario_id: ["user_id", "criado_por_id"],
  status: [],
  rm: ["numero_rm", "rm_numero"],
  csv_gerado_em: [],
  csv_gerado_por: [],
  finalizado_em: ["finalizada_em"],
  finalizado_por: ["finalizada_por"],
};

/** ID do usuário autenticado (Supabase Auth) — usado nas colunas de autoria. */
async function usuarioAutenticadoId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

const ALIAS_ITEM = {
  material_codigo: ["codigo", "codigo_material"],
  codigo: ["codigo_material"],
  descricao: ["descricao_material"],
  quantidade_total: ["quantidade"],
  lote: [],
  devolucao_id: [],
};

const ALIAS_VOLUME = {
  item_id: ["item_devolucao_id", "itens_devolucao_id"],
  numero: ["numero_volume", "volume"],
  quantidade: ["qtd", "quantidade_volume"],
};

let devolucaoAtivaId: string | null = null;
let focoCodigoPendente = false;
let focoPalavra1Pendente = false;
const focoCodigoListeners = new Set<() => void>();
const focoPalavra1Listeners = new Set<() => void>();

/* ------------------------------------------------------------------ */
/* Mapeamento banco -> domínio                                         */
/* ------------------------------------------------------------------ */

function mapVolume(linha: Payload): VolumeItem {
  return {
    id: String(campo(linha, ["id"]) ?? Math.random()),
    numero: numero(campo(linha, ["numero", "numero_volume", "volume"])),
    quantidade: numero(campo(linha, ["quantidade", "qtd", "quantidade_volume"])),
  };
}

function mapItem(linha: Payload, volumes: VolumeItem[], descricoes: Map<string, string>): ItemDevolucao {
  const codigo = texto(campo(linha, ["material_codigo", "codigo", "codigo_material"])) ?? "";
  return {
    id: String(campo(linha, ["id"]) ?? ""),
    materialCodigo: codigo,
    descricao: texto(campo(linha, ["descricao", "descricao_material"])) ?? descricoes.get(codigo) ?? "",
    lote: texto(campo(linha, ["lote"])) ?? "",
    volumes: volumes.sort((a, b) => a.numero - b.numero),
  };
}

function mapDevolucao(linha: Payload, itens: ItemDevolucao[], nomes: Map<string, string>): Devolucao {
  const statusBruto = texto(campo(linha, ["status"])) ?? "em_montagem";
  const status = (STATUS_VALIDOS as string[]).includes(statusBruto)
    ? (statusBruto as DevolucaoStatus)
    : "em_montagem";
  const autorId = texto(campo(linha, ["criado_por", "usuario_id", "user_id", "criado_por_id"])) ?? "";

  return {
    id: String(campo(linha, ["id"]) ?? ""),
    identificador: texto(campo(linha, ["identificador", "codigo", "numero"])) ?? String(campo(linha, ["id"]) ?? ""),
    rm: texto(campo(linha, ["rm", "numero_rm", "rm_numero"])),
    status,
    itens,
    criadoPor: nomes.get(autorId) ?? (autorId ? "Usuário" : "—"),
    criadoEm: texto(campo(linha, ["criado_em", "created_at", "data_criacao"])) ?? new Date().toISOString(),
    alteradoPor: null,
    alteradoEm: texto(campo(linha, ["alterado_em", "updated_at"])),
    csvGeradoEm: texto(campo(linha, ["csv_gerado_em"])),
    csvDesatualizado: Boolean(campo(linha, ["csv_desatualizado"])),
    rmVinculadaEm: texto(campo(linha, ["rm_vinculada_em"])),
    rmVinculadaPor: null,
    finalizadaEm: texto(campo(linha, ["finalizada_em", "finalizado_em"])),
    finalizadaPor: nomes.get(texto(campo(linha, ["finalizado_por", "finalizada_por"])) ?? "") ?? null,
  };
}

export type DevolucaoResumo = Omit<Devolucao, "itens"> & {
  quantidadeItens: number;
  quantidadeTotal: number;
};

const PAGE_SIZE = 1000;
const ITENS_POR_PAGINA = 10;
const TEMPO_CACHE_MS = 15_000;

export const chavesDevolucoes = {
  todas: ["devolucoes"] as const,
  lista: ["devolucoes", "lista"] as const,
  abertas: ["devolucoes", "abertas"] as const,
  comRm: ["devolucoes", "com-rm"] as const,
  detalhe: (id: string) => ["devolucoes", "detalhe", id] as const,
};

async function buscarNomesUsuarios(ids: string[]) {
  const nomes = new Map<string, string>();
  const unicos = [...new Set(ids.filter(Boolean))];
  if (!unicos.length) return nomes;

  const { data, error } = await supabase.from("usuarios").select("*").in("id", unicos);
  if (error) throw error;
  for (const linha of (data ?? []) as Payload[]) {
    const id = texto(campo(linha, ["id"]));
    const nome = texto(campo(linha, ["nome", "nome_completo", "name", "email"]));
    if (id && nome) nomes.set(id, nome);
  }
  return nomes;
}

async function mapearDetalhes(devolucoes: Payload[]): Promise<Devolucao[]> {
  if (!devolucoes.length) return [];
  const devolucaoIds = devolucoes.map((linha) => String(campo(linha, ["id"])));
  const autorIds = devolucoes.flatMap((linha) => [
    texto(campo(linha, ["criado_por", "usuario_id", "user_id", "criado_por_id"])) ?? "",
    texto(campo(linha, ["finalizado_por", "finalizada_por"])) ?? "",
  ]);
  const [{ data: itensData, error: erroItens }, nomes] = await Promise.all([
    supabase.from("itens_devolucao").select("*").in("devolucao_id", devolucaoIds),
    buscarNomesUsuarios(autorIds),
  ]);
  if (erroItens) throw erroItens;
  const itensRaw = (itensData ?? []) as Payload[];
  const itemIds = itensRaw.map((linha) => String(campo(linha, ["id"])));
  let volumesRaw: Payload[] = [];
  if (itemIds.length) {
    const { data, error } = await supabase.from("volumes_item").select("*").in("item_id", itemIds);
    if (error) throw error;
    volumesRaw = (data ?? []) as Payload[];
  }

  const descricoes = await buscarDescricoes(
    itensRaw.map((linha) => texto(campo(linha, ["material_codigo", "codigo", "codigo_material"])) ?? ""),
  );
  const volumesPorItem = new Map<string, VolumeItem[]>();
  for (const linha of volumesRaw) {
    const itemId = String(campo(linha, ["item_id", "item_devolucao_id", "itens_devolucao_id"]) ?? "");
    const lista = volumesPorItem.get(itemId) ?? [];
    lista.push(mapVolume(linha));
    volumesPorItem.set(itemId, lista);
  }

  const chaveOrdem = (linha: Payload) => {
    const criado = texto(campo(linha, ["criado_em", "created_at", "data_criacao", "inserted_at"])) ?? "";
    return `${criado}|${String(campo(linha, ["id"]) ?? "")}`;
  };
  const itensPorDevolucao = new Map<string, ItemDevolucao[]>();
  for (const linha of [...itensRaw].sort((a, b) => chaveOrdem(a).localeCompare(chaveOrdem(b)))) {
    const devolucaoId = String(campo(linha, ["devolucao_id"]) ?? "");
    const itens = itensPorDevolucao.get(devolucaoId) ?? [];
    itens.push(mapItem(linha, volumesPorItem.get(String(campo(linha, ["id"]))) ?? [], descricoes));
    itensPorDevolucao.set(devolucaoId, itens);
  }

  return devolucoes
    .map((linha) => mapDevolucao(linha, itensPorDevolucao.get(String(campo(linha, ["id"]))) ?? [], nomes))
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
}

export async function buscarDevolucaoPorId(id: string): Promise<Devolucao | null> {
  const { data, error } = await supabase.from("devolucoes").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [devolucao] = await mapearDetalhes([data as Payload]);
  return devolucao ?? null;
}

function resumoDevolucao(devolucao: Devolucao): DevolucaoResumo {
  return {
    ...devolucao,
    quantidadeItens: devolucao.itens.length,
    quantidadeTotal: devolucao.itens.reduce(
      (soma, item) => soma + item.volumes.reduce((total, volume) => total + volume.quantidade, 0),
      0,
    ),
  };
}

async function buscarIdsPorTexto(
  tabela: "devolucoes" | "itens_devolucao",
  colunas: string[],
  padrao: string,
): Promise<string[]> {
  const ids = new Set<string>();
  for (const coluna of colunas) {
    let colunaDisponivel = false;
    for (let inicio = 0; ; inicio += PAGE_SIZE) {
      const { data, error } = tabela === "devolucoes"
        ? await supabase
            .from("devolucoes")
            .select("id")
            .ilike(coluna, padrao)
            .range(inicio, inicio + PAGE_SIZE - 1)
        : await supabase
            .from("itens_devolucao")
            .select("devolucao_id")
            .ilike(coluna, padrao)
            .range(inicio, inicio + PAGE_SIZE - 1);
      if (error) {
        const ausente = error.message.match(/Could not find the '(.+?)' column/i)?.[1];
        if (ausente === coluna) break;
        throw error;
      }
      colunaDisponivel = true;
      const linhas = (data ?? []) as Payload[];
      for (const linha of linhas) {
        const id = texto(campo(linha, [tabela === "devolucoes" ? "id" : "devolucao_id"]));
        if (id) ids.add(id);
      }
      if (linhas.length < PAGE_SIZE) break;
    }
    if (colunaDisponivel) break;
  }
  return [...ids];
}

async function buscarIdsPorMateriais(padrao: string): Promise<string[]> {
  const codigos: string[] = [];
  for (let inicio = 0; ; inicio += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("materiais")
      .select("codigo")
      .ilike("descricao", padrao)
      .range(inicio, inicio + PAGE_SIZE - 1);
    if (error) throw error;
    const linhas = (data ?? []) as Payload[];
    codigos.push(...linhas.map((linha) => texto(campo(linha, ["codigo"])) ?? "").filter(Boolean));
    if (linhas.length < PAGE_SIZE) break;
  }
  if (!codigos.length) return [];

  const ids = new Set<string>();
  for (let inicio = 0; inicio < codigos.length; inicio += 200) {
    for (let inicioPagina = 0; ; inicioPagina += PAGE_SIZE) {
      const { data, error } = await supabase
        .from("itens_devolucao")
        .select("devolucao_id")
        .in("material_codigo", codigos.slice(inicio, inicio + 200))
        .range(inicioPagina, inicioPagina + PAGE_SIZE - 1);
      if (error) throw error;
      const linhas = (data ?? []) as Payload[];
      for (const linha of linhas) {
        const id = texto(campo(linha, ["devolucao_id"]));
        if (id) ids.add(id);
      }
      if (linhas.length < PAGE_SIZE) break;
    }
  }
  return [...ids];
}

async function buscarIdsDevolucoesPorUsuario(usuariosIds: string[]): Promise<string[]> {
  const ids = new Set<string>();
  const colunas = ["criado_por", "usuario_id", "user_id", "criado_por_id"];
  for (const coluna of colunas) {
    let colunaDisponivel = false;
    for (let inicio = 0; ; inicio += PAGE_SIZE) {
      const { data, error } = await supabase
        .from("devolucoes")
        .select("id")
        .in(coluna, usuariosIds)
        .range(inicio, inicio + PAGE_SIZE - 1);
      if (error) {
        const ausente = error.message.match(/Could not find the '(.+?)' column/i)?.[1];
        if (ausente === coluna) {
          break;
        }
        throw error;
      }
      colunaDisponivel = true;
      for (const linha of (data ?? []) as Payload[]) {
        const id = texto(campo(linha, ["id"]));
        if (id) ids.add(id);
      }
      if ((data ?? []).length < PAGE_SIZE) break;
    }
    if (colunaDisponivel) break;
  }
  return [...ids];
}

export interface FiltrosDevolucoes {
  pagina: number;
  busca: string;
  usuarioId: string;
  status: string;
  de: string;
  ate: string;
  usuarios: { id: string; nome: string }[];
}

export interface PaginaDevolucoes {
  devolucoes: DevolucaoResumo[];
  total: number;
}

async function buscarPaginaDevolucoes(filtros: FiltrosDevolucoes): Promise<PaginaDevolucoes> {
  const termo = filtros.busca.trim();
  let idsBusca: string[] | null = null;
  if (termo) {
    const padrao = `%${termo.replace(/[\\%_]/g, "\\$&")}%`;
    const [idsIdentificador, idsRm, idsCodigo, idsDescricao, idsMateriais] = await Promise.all([
      buscarIdsPorTexto("devolucoes", ["identificador", "codigo", "numero"], padrao),
      buscarIdsPorTexto("devolucoes", ["rm", "numero_rm", "rm_numero"], padrao),
      buscarIdsPorTexto("itens_devolucao", ["material_codigo", "codigo", "codigo_material"], padrao),
      buscarIdsPorTexto("itens_devolucao", ["descricao", "descricao_material"], padrao),
      buscarIdsPorMateriais(padrao),
    ]);
    const nomes = filtros.usuarios
      .filter((usuario) => usuario.nome.toLocaleLowerCase().includes(termo.toLocaleLowerCase()))
      .map((usuario) => usuario.id);
    const idsUsuarios = nomes.length ? await buscarIdsDevolucoesPorUsuario(nomes) : [];
    idsBusca = [...new Set([...idsIdentificador, ...idsRm, ...idsCodigo, ...idsDescricao, ...idsMateriais, ...idsUsuarios])];
    if (!idsBusca.length) return { devolucoes: [], total: 0 };
  }

  let consulta = supabase.from("devolucoes").select("*", { count: "exact" });
  if (filtros.status !== "todos") consulta = consulta.eq("status", filtros.status);
  if (filtros.usuarioId !== "todos") consulta = consulta.eq("criado_por", filtros.usuarioId);
  if (filtros.de) consulta = consulta.gte("criado_em", `${filtros.de}T00:00:00.000Z`);
  if (filtros.ate) {
    const limite = new Date(`${filtros.ate}T00:00:00.000Z`);
    limite.setUTCDate(limite.getUTCDate() + 1);
    consulta = consulta.lt("criado_em", limite.toISOString());
  }
  if (idsBusca) consulta = consulta.in("id", idsBusca);

  const inicio = (filtros.pagina - 1) * ITENS_POR_PAGINA;
  const { data, count, error } = await consulta
    .order("criado_em", { ascending: false })
    .range(inicio, inicio + ITENS_POR_PAGINA - 1);
  if (error) throw error;
  const devolucoesRaw = (data ?? []) as Payload[];
  const ids = devolucoesRaw.map((linha) => texto(campo(linha, ["id"])) ?? "").filter(Boolean);
  const estatisticas = new Map<string, { quantidadeItens: number; quantidadeTotal: number }>();
  if (ids.length) {
    const { data: itensData, error: erroItens } = await supabase
      .from("itens_devolucao")
      .select("*")
      .in("devolucao_id", ids);
    if (erroItens) throw erroItens;
    const itensRaw = (itensData ?? []) as Payload[];
    const itemIds = itensRaw.map((linha) => texto(campo(linha, ["id"])) ?? "").filter(Boolean);
    const devolucaoPorItem = new Map<string, string>();
    for (const linha of itensRaw) {
      const devolucaoId = texto(campo(linha, ["devolucao_id"])) ?? "";
      const itemId = texto(campo(linha, ["id"])) ?? "";
      const atual = estatisticas.get(devolucaoId) ?? { quantidadeItens: 0, quantidadeTotal: 0 };
      atual.quantidadeItens += 1;
      estatisticas.set(devolucaoId, atual);
      if (itemId) devolucaoPorItem.set(itemId, devolucaoId);
    }
    if (itemIds.length) {
      const { data: volumesData, error: erroVolumes } = await supabase
        .from("volumes_item")
        .select("*")
        .in("item_id", itemIds);
      if (erroVolumes) throw erroVolumes;
      for (const linha of (volumesData ?? []) as Payload[]) {
        const itemId = texto(campo(linha, ["item_id", "item_devolucao_id", "itens_devolucao_id"])) ?? "";
        const devolucaoId = devolucaoPorItem.get(itemId);
        if (!devolucaoId) continue;
        const atual = estatisticas.get(devolucaoId);
        if (atual) {
          atual.quantidadeTotal += numero(campo(linha, ["quantidade", "qtd", "quantidade_volume"]));
        }
      }
    }
  }
  const nomes = await buscarNomesUsuarios(
    devolucoesRaw.map((linha) => texto(campo(linha, ["criado_por", "usuario_id", "user_id", "criado_por_id"])) ?? ""),
  );
  return {
    devolucoes: devolucoesRaw.map((linha) => {
      const resumo = resumoDevolucao(mapDevolucao(linha, [], nomes));
      const estatistica = estatisticas.get(resumo.id);
      return {
        ...resumo,
        quantidadeItens: estatistica?.quantidadeItens ?? 0,
        quantidadeTotal: estatistica?.quantidadeTotal ?? 0,
      };
    }),
    total: count ?? 0,
  };
}

async function buscarDevolucoesAbertas(): Promise<DevolucaoResumo[]> {
  const linhas: Payload[] = [];
  for (let inicio = 0; ; inicio += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("devolucoes")
      .select("*")
      .neq("status", "finalizada")
      .order("criado_em", { ascending: false })
      .range(inicio, inicio + PAGE_SIZE - 1);
    if (error) throw error;
    const pagina = (data ?? []) as Payload[];
    linhas.push(...pagina);
    if (pagina.length < PAGE_SIZE) break;
  }
  if (!linhas.length) return [];
  const ids = linhas.map((linha) => texto(campo(linha, ["id"])) ?? "").filter(Boolean);
  const { data: itensData, error: erroItens } = await supabase
    .from("itens_devolucao")
    .select("*")
    .in("devolucao_id", ids);
  if (erroItens) throw erroItens;
  const itens = (itensData ?? []) as Payload[];
  const itemIds = itens.map((linha) => texto(campo(linha, ["id"])) ?? "").filter(Boolean);
  let volumes: Payload[] = [];
  if (itemIds.length) {
    const { data, error } = await supabase.from("volumes_item").select("*").in("item_id", itemIds);
    if (error) throw error;
    volumes = (data ?? []) as Payload[];
  }
  const totaisVolume = new Map<string, number>();
  for (const linha of volumes) {
    const itemId = texto(campo(linha, ["item_id", "item_devolucao_id", "itens_devolucao_id"])) ?? "";
    totaisVolume.set(itemId, (totaisVolume.get(itemId) ?? 0) + numero(campo(linha, ["quantidade", "qtd", "quantidade_volume"])));
  }
  const estatisticas = new Map<string, { quantidadeItens: number; quantidadeTotal: number }>();
  for (const linha of itens) {
    const id = texto(campo(linha, ["devolucao_id"])) ?? "";
    const itemId = texto(campo(linha, ["id"])) ?? "";
    const atual = estatisticas.get(id) ?? { quantidadeItens: 0, quantidadeTotal: 0 };
    atual.quantidadeItens += 1;
    atual.quantidadeTotal += totaisVolume.get(itemId) ?? 0;
    estatisticas.set(id, atual);
  }
  return linhas.map((linha) => {
    const resumo = resumoDevolucao(mapDevolucao(linha, [], new Map()));
    const estatistica = estatisticas.get(resumo.id);
    return {
      ...resumo,
      quantidadeItens: estatistica?.quantidadeItens ?? 0,
      quantidadeTotal: estatistica?.quantidadeTotal ?? 0,
    };
  });
}

async function buscarDevolucoesComRm(): Promise<DevolucaoResumo[]> {
  const linhas: Payload[] = [];
  for (let inicio = 0; ; inicio += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("devolucoes")
      .select("*")
      .not("rm", "is", null)
      .order("criado_em", { ascending: false })
      .range(inicio, inicio + PAGE_SIZE - 1);
    if (error) throw error;
    const pagina = (data ?? []) as Payload[];
    linhas.push(...pagina);
    if (pagina.length < PAGE_SIZE) break;
  }
  return linhas.map((linha) => resumoDevolucao(mapDevolucao(linha, [], new Map())));
}

export function useDevolucao(id: string | undefined, authenticated = true) {
  const query = useQuery({
    queryKey: chavesDevolucoes.detalhe(id ?? ""),
    queryFn: () => buscarDevolucaoPorId(id!),
    enabled: typeof window !== "undefined" && authenticated && Boolean(id),
    staleTime: TEMPO_CACHE_MS,
  });
  return { devolucao: query.data ?? null, carregando: query.isLoading, erro: query.error };
}

export function usePaginaDevolucoes(filtros: FiltrosDevolucoes, authenticated = true) {
  return useQuery({
    queryKey: [...chavesDevolucoes.lista, filtros],
    queryFn: () => buscarPaginaDevolucoes(filtros),
    enabled: typeof window !== "undefined" && authenticated,
    staleTime: TEMPO_CACHE_MS,
    placeholderData: (previousData, previousQuery) => {
      const filtrosAnteriores = previousQuery?.queryKey[2];
      if (!previousData || !filtrosAnteriores || typeof filtrosAnteriores !== "object") {
        return undefined;
      }

      const { pagina: _paginaAnterior, ...criteriosAnteriores } =
        filtrosAnteriores as FiltrosDevolucoes;
      const { pagina: _paginaAtual, ...criteriosAtuais } = filtros;
      return JSON.stringify(criteriosAnteriores) === JSON.stringify(criteriosAtuais)
        ? previousData
        : undefined;
    },
  });
}

export function useDevolucoesAbertas(authenticated = true, enabled = true) {
  return useQuery({
    queryKey: chavesDevolucoes.abertas,
    queryFn: buscarDevolucoesAbertas,
    enabled: typeof window !== "undefined" && authenticated && enabled,
    staleTime: TEMPO_CACHE_MS,
  });
}

export function useDevolucoesComRm(authenticated = true) {
  return useQuery({
    queryKey: chavesDevolucoes.comRm,
    queryFn: buscarDevolucoesComRm,
    enabled: typeof window !== "undefined" && authenticated,
    staleTime: TEMPO_CACHE_MS,
  });
}

export const podeEditar = (d: Devolucao) => d.status !== "finalizada";

export function definirDevolucaoAtiva(id: string | null) {
  devolucaoAtivaId = id;
}

export function obterDevolucaoAtivaId() {
  return devolucaoAtivaId;
}

export function solicitarFocoCodigo() {
  focoCodigoPendente = true;
  for (const listener of focoCodigoListeners) listener();
}

export function consumirSolicitacaoFocoCodigo() {
  if (!focoCodigoPendente) return;
  focoCodigoPendente = false;
  for (const listener of focoCodigoListeners) listener();
}

export function useFocoCodigoSolicitado() {
  return useSyncExternalStore(
    (listener) => {
      focoCodigoListeners.add(listener);
      return () => focoCodigoListeners.delete(listener);
    },
    () => focoCodigoPendente,
    () => false,
  );
}

export function solicitarFocoPalavra1() {
  focoPalavra1Pendente = true;
  for (const listener of focoPalavra1Listeners) listener();
}

export function consumirSolicitacaoFocoPalavra1() {
  if (!focoPalavra1Pendente) return;
  focoPalavra1Pendente = false;
  for (const listener of focoPalavra1Listeners) listener();
}

export function useFocoPalavra1Solicitado() {
  return useSyncExternalStore(
    (listener) => {
      focoPalavra1Listeners.add(listener);
      return () => focoPalavra1Listeners.delete(listener);
    },
    () => focoPalavra1Pendente,
    () => false,
  );
}

/* ------------------------------------------------------------------ */
/* Mutações                                                            */
/* ------------------------------------------------------------------ */

async function comErro<T>(acao: () => Promise<T>): Promise<T | null> {
  try {
    return await acao();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    toast.error(msg);
    return null;
  }
}

/**
 * Impede que a MESMA operação seja executada duas vezes em paralelo
 * (cliques repetidos antes da primeira gravação terminar).
 */
const emAndamento = new Set<string>();

async function exclusiva<T>(chave: string, acao: () => Promise<T>): Promise<T | null> {
  if (emAndamento.has(chave)) return null;
  emAndamento.add(chave);
  try {
    return await acao();
  } finally {
    emAndamento.delete(chave);
  }
}

export async function criarDevolucao(): Promise<Devolucao | null> {
  const resultado = await exclusiva("criarDevolucao", () =>
    comErro(async () => {
      const { data: sessao } = await supabase.auth.getSession();
      const userId = sessao.session?.user.id ?? null;

      const [linha] = await inserirFlex(
        "devolucoes",
        [{ status: "em_montagem", criado_por: userId }],
        ALIAS_DEVOLUCAO,
      );
      if (!linha) throw new Error("Devolução não criada.");
      return mapDevolucao(linha, [], new Map());
    }),
  );
  return resultado ?? null;
}

async function gravarVolumes(itemId: string, volumes: { numero: number; quantidade: number }[]) {
  if (volumes.length === 0) return;
  await inserirFlex(
    "volumes_item",
    volumes.map((v) => ({ item_id: itemId, numero: v.numero, quantidade: v.quantidade })),
    ALIAS_VOLUME,
  );
}

export async function adicionarItem(
  devolucaoId: string,
  dados: { materialCodigo: string; descricao?: string; lote: string; volumes: { numero: number; quantidade: number }[] },
): Promise<boolean> {
  const ok = await exclusiva(`adicionarItem:${devolucaoId}`, () =>
    comErro(async () => {
      const total = dados.volumes.reduce((acc, v) => acc + v.quantidade, 0);
      const [linha] = await inserirFlex(
        "itens_devolucao",
        [
          {
            devolucao_id: devolucaoId,
            material_codigo: dados.materialCodigo,
            descricao: dados.descricao ?? null,
            lote: dados.lote,
            quantidade_total: total,
          },
        ],
        ALIAS_ITEM,
      );
      if (!linha) throw new Error("Item não criado.");
      await gravarVolumes(String(campo(linha, ["id"])), dados.volumes);
      return true;
    }),
  );
  return ok === true;
}

export async function atualizarItem(
  _devolucaoId: string,
  itemId: string,
  dados: { materialCodigo: string; descricao?: string; lote: string; volumes: { numero: number; quantidade: number }[] },
): Promise<boolean> {
  const ok = await exclusiva(`atualizarItem:${itemId}`, () =>
    comErro(async () => {
      const total = dados.volumes.reduce((acc, v) => acc + v.quantidade, 0);
      await atualizarFlex(
        "itens_devolucao",
        itemId,
        {
          material_codigo: dados.materialCodigo,
          descricao: dados.descricao ?? null,
          lote: dados.lote,
          quantidade_total: total,
        },
        ALIAS_ITEM,
      );
      const { error } = await supabase.from("volumes_item").delete().eq("item_id", itemId);
      if (error) throw error;
      await gravarVolumes(itemId, dados.volumes);
      return true;
    }),
  );
  return ok === true;
}

/**
 * Edição inline: altera SOMENTE o lote do item existente (e alterado_em,
 * quando a coluna existir). Nenhum outro campo é tocado.
 */
export async function atualizarLoteItem(itemId: string, lote: string): Promise<boolean> {
  const valor = lote.trim();
  if (!valor) {
    toast.error("Informe o lote.");
    return false;
  }
  const ok = await exclusiva(`atualizarLote:${itemId}`, () =>
    comErro(async () => {
      await atualizarFlex("itens_devolucao", itemId, { lote: valor, alterado_em: new Date().toISOString() }, {
        lote: [],
        alterado_em: ["updated_at"],
      });
      return true;
    }),
  );
  return ok === true;
}

export async function removerItem(_devolucaoId: string, itemId: string): Promise<boolean> {
  const ok = await exclusiva(`removerItem:${itemId}`, () =>
    comErro(async () => {
      const { error: erroVolumes } = await supabase.from("volumes_item").delete().eq("item_id", itemId);
      if (erroVolumes) throw erroVolumes;
      const { error } = await supabase.from("itens_devolucao").delete().eq("id", itemId);
      if (error) throw error;
      return true;
    }),
  );
  return ok === true;
}

export async function registrarCsvGerado(devolucaoId: string): Promise<boolean> {
  const ok = await exclusiva(`csv:${devolucaoId}`, () =>
    comErro(async () => {
      await atualizarFlex(
        "devolucoes",
        devolucaoId,
        {
          status: "csv_gerado",
          csv_gerado_em: new Date().toISOString(),
          csv_gerado_por: await usuarioAutenticadoId(),
        },
        ALIAS_DEVOLUCAO,
      );
      return true;
    }),
  );
  return ok === true;
}

export async function vincularRm(devolucaoId: string, rm: string): Promise<boolean> {
  const ok = await exclusiva(`rm:${devolucaoId}`, () =>
    comErro(async () => {
      await atualizarFlex(
        "devolucoes",
        devolucaoId,
        { rm, status: "rm_vinculada", rm_vinculada_em: new Date().toISOString() },
        ALIAS_DEVOLUCAO,
      );
      return true;
    }),
  );
  return ok === true;
}

export async function finalizarDevolucao(devolucaoId: string): Promise<boolean> {
  const ok = await exclusiva(`finalizar:${devolucaoId}`, () => comErro(async () => {
    // 1) Usa a função existente no banco, se ela estiver exposta.
    const rpc = await supabase.rpc("finalizar_devolucao", { p_devolucao_id: devolucaoId });
    const semFuncao =
      rpc.error && (rpc.error.code === "PGRST202" || /Could not find the function/i.test(rpc.error.message ?? ""));
    if (rpc.error && !semFuncao) throw rpc.error;

    // 2) Caso a função não esteja disponível via API, grava nas colunas existentes.
    if (semFuncao) {
      await atualizarFlex(
        "devolucoes",
        devolucaoId,
        {
          status: "finalizada",
          finalizado_em: new Date().toISOString(),
          finalizado_por: await usuarioAutenticadoId(),
        },
        ALIAS_DEVOLUCAO,
      );
    }

    // 3) Confirma a persistência lendo novamente do banco.
    const { data, error } = await supabase.from("devolucoes").select("status").eq("id", devolucaoId).limit(1);
    if (error) throw error;
    const status = texto(campo(((data ?? []) as Payload[])[0] ?? {}, ["status"]));
    if (status !== "finalizada") {
      throw new Error(`A devolução não foi finalizada no banco (status atual: ${status ?? "desconhecido"}).`);
    }
    if (devolucaoAtivaId === devolucaoId) devolucaoAtivaId = null;
    return true;
  }));
  return ok === true;
}

export async function removerDevolucao(
  devolucaoId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const resultado = await exclusiva(`removerDevolucao:${devolucaoId}`, async () => {
    try {
      const alvo = await buscarDevolucaoPorId(devolucaoId);
      if (!alvo) throw new Error("Devolução não encontrada.");
      if (alvo.status === "finalizada") throw new Error("Devoluções finalizadas não podem ser excluídas.");
      for (const item of alvo.itens) {
        const { data: volumesExcluidos, error } = await supabase
          .from("volumes_item")
          .delete()
          .eq("item_id", item.id)
          .select("id");
        if (error) throw new Error(`Falha ao excluir volumes_item do item ${item.id}: ${error.message}`);
        if (volumesExcluidos.length !== item.volumes.length) {
          throw new Error(
            `O DELETE de volumes_item do item ${item.id} afetou ${volumesExcluidos.length} registro(s), mas eram esperados ${item.volumes.length}. Verifique RLS/policy ou as permissões do usuário.`,
          );
        }
      }
      const { data: itensExcluidos, error: erroItens } = await supabase
        .from("itens_devolucao")
        .delete()
        .eq("devolucao_id", devolucaoId)
        .select("id");
      if (erroItens) throw new Error(`Falha ao excluir itens_devolucao da devolução ${devolucaoId}: ${erroItens.message}`);
      if (itensExcluidos.length !== alvo.itens.length) {
        throw new Error(
          `O DELETE de itens_devolucao afetou ${itensExcluidos.length} registro(s), mas eram esperados ${alvo.itens.length}. Verifique RLS/policy ou as permissões do usuário.`,
        );
      }
      const { data: devolucoesExcluidas, error } = await supabase
        .from("devolucoes")
        .delete()
        .eq("id", devolucaoId)
        .select("id");
      if (error) throw new Error(`Falha ao excluir devolucoes ${devolucaoId}: ${error.message}`);
      if (devolucoesExcluidas.length !== 1) {
        throw new Error(
          `O DELETE de devolucoes não afetou o registro ${devolucaoId}. Verifique RLS/policy ou as permissões do usuário.`,
        );
      }

      const { data: restante, error: erroVerificacao } = await supabase
        .from("devolucoes")
        .select("id")
        .eq("id", devolucaoId)
        .limit(1);
      if (erroVerificacao) throw erroVerificacao;
      if (((restante ?? []) as Payload[]).length > 0) {
        throw new Error("A devolução ainda existe no banco após a tentativa de exclusão.");
      }

      if (devolucaoAtivaId === devolucaoId) devolucaoAtivaId = null;
      return { ok: true } as const;
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      toast.error(error);
      return { ok: false, error } as const;
    }
  });
  return resultado ?? { ok: false, error: "A exclusão já está em andamento." };
}

export function useOperacoesDevolucao() {
  const queryClient = useQueryClient();

  const invalidarListas = useCallback(
    async (id?: string, atualizarListaVisivel = false) => {
      const invalidacoes = [
        queryClient.invalidateQueries({
          queryKey: chavesDevolucoes.lista,
          refetchType: atualizarListaVisivel ? "active" : "none",
        }),
        queryClient.invalidateQueries({ queryKey: chavesDevolucoes.abertas, refetchType: "none" }),
        queryClient.invalidateQueries({ queryKey: chavesDevolucoes.comRm, refetchType: "none" }),
      ];
      if (id) {
        invalidacoes.push(
          queryClient.invalidateQueries({ queryKey: chavesDevolucoes.detalhe(id), exact: true }),
        );
      }
      await Promise.all(invalidacoes);
    },
    [queryClient],
  );

  const criar = useCallback(async () => {
    const criada = await criarDevolucao();
    if (!criada) return null;
    await invalidarListas(criada.id);
    return queryClient.fetchQuery({
      queryKey: chavesDevolucoes.detalhe(criada.id),
      queryFn: () => buscarDevolucaoPorId(criada.id),
      staleTime: 0,
    });
  }, [invalidarListas, queryClient]);

  const adicionar = useCallback(async (
    devolucaoId: string,
    dados: Parameters<typeof adicionarItem>[1],
  ) => {
    const sucesso = await adicionarItem(devolucaoId, dados);
    if (sucesso) await invalidarListas(devolucaoId);
    return sucesso;
  }, [invalidarListas]);

  const atualizar = useCallback(async (
    devolucaoId: string,
    itemId: string,
    dados: Parameters<typeof atualizarItem>[2],
  ) => {
    const sucesso = await atualizarItem(devolucaoId, itemId, dados);
    if (sucesso) await invalidarListas(devolucaoId);
    return sucesso;
  }, [invalidarListas]);

  const atualizarLote = useCallback(async (devolucaoId: string, itemId: string, lote: string) => {
    const sucesso = await atualizarLoteItem(itemId, lote);
    if (sucesso) await invalidarListas(devolucaoId);
    return sucesso;
  }, [invalidarListas]);

  const removerItemDaDevolucao = useCallback(async (devolucaoId: string, itemId: string) => {
    const sucesso = await removerItem(devolucaoId, itemId);
    if (sucesso) await invalidarListas(devolucaoId);
    return sucesso;
  }, [invalidarListas]);

  const registrarCsv = useCallback(async (devolucaoId: string) => {
    const sucesso = await registrarCsvGerado(devolucaoId);
    if (sucesso) await invalidarListas(devolucaoId);
    return sucesso;
  }, [invalidarListas]);

  const vincular = useCallback(async (devolucaoId: string, rm: string) => {
    const sucesso = await vincularRm(devolucaoId, rm);
    if (sucesso) await invalidarListas(devolucaoId);
    return sucesso;
  }, [invalidarListas]);

  const finalizar = useCallback(async (devolucaoId: string) => {
    const sucesso = await finalizarDevolucao(devolucaoId);
    if (sucesso) await invalidarListas(devolucaoId);
    return sucesso;
  }, [invalidarListas]);

  const remover = useCallback(async (devolucaoId: string) => {
    const resultado = await removerDevolucao(devolucaoId);
    if (resultado.ok) {
      await invalidarListas(devolucaoId, true);
      queryClient.removeQueries({ queryKey: chavesDevolucoes.detalhe(devolucaoId), exact: true });
    }
    return resultado;
  }, [invalidarListas, queryClient]);

  return {
    criar,
    adicionar,
    atualizar,
    atualizarLote,
    removerItem: removerItemDaDevolucao,
    registrarCsv,
    vincular,
    finalizar,
    remover,
  };
}

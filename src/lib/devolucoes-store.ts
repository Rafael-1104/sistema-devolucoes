import { useCallback, useEffect, useSyncExternalStore } from "react";
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

let state: Devolucao[] = [];
let carregando = false;
let carregado = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function setState(next: Devolucao[]) {
  state = next;
  emit();
}

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

/* ------------------------------------------------------------------ */
/* Carregamento                                                        */
/* ------------------------------------------------------------------ */

export async function recarregar(): Promise<void> {
  if (carregando) return;
  carregando = true;
  try {
    const { data: sessao } = await supabase.auth.getSession();
    if (!sessao.session) {
      setState([]);
      return;
    }

    const { data: devsRaw, error } = await supabase.from("devolucoes").select("*");
    if (error) throw error;
    const devolucoes = (devsRaw ?? []) as Payload[];
    const ids = devolucoes.map((d) => String(campo(d, ["id"])));

    let itensRaw: Payload[] = [];
    if (ids.length > 0) {
      const { data, error: erroItens } = await supabase.from("itens_devolucao").select("*").in("devolucao_id", ids);
      if (erroItens) throw erroItens;
      itensRaw = (data ?? []) as Payload[];
    }

    const itemIds = itensRaw.map((i) => String(campo(i, ["id"])));
    let volumesRaw: Payload[] = [];
    if (itemIds.length > 0) {
      const { data, error: erroVol } = await supabase.from("volumes_item").select("*").in("item_id", itemIds);
      if (erroVol) throw erroVol;
      volumesRaw = (data ?? []) as Payload[];
    }

    const descricoes = await buscarDescricoes(
      itensRaw.map((i) => texto(campo(i, ["material_codigo", "codigo", "codigo_material"])) ?? ""),
    );

    const nomes = new Map<string, string>();
    const { data: usuariosRaw } = await supabase.from("usuarios").select("*");
    for (const u of (usuariosRaw ?? []) as Payload[]) {
      const id = texto(campo(u, ["id"]));
      const nome = texto(campo(u, ["nome", "nome_completo", "name", "email"]));
      if (id && nome) nomes.set(id, nome);
    }

    const volumesPorItem = new Map<string, VolumeItem[]>();
    for (const v of volumesRaw) {
      const itemId = String(campo(v, ["item_id", "item_devolucao_id", "itens_devolucao_id"]) ?? "");
      const lista = volumesPorItem.get(itemId) ?? [];
      lista.push(mapVolume(v));
      volumesPorItem.set(itemId, lista);
    }

    // Ordem estável dos itens: criação (quando existir) e, como desempate, o id.
    // Assim editar um item nunca muda sua posição na lista.
    const chaveOrdem = (linha: Payload) => {
      const criado = texto(campo(linha, ["criado_em", "created_at", "data_criacao", "inserted_at"])) ?? "";
      return `${criado}|${String(campo(linha, ["id"]) ?? "")}`;
    };
    const itensOrdenados = [...itensRaw].sort((a, b) => chaveOrdem(a).localeCompare(chaveOrdem(b)));

    const itensPorDevolucao = new Map<string, ItemDevolucao[]>();
    for (const i of itensOrdenados) {
      const devId = String(campo(i, ["devolucao_id"]) ?? "");
      const lista = itensPorDevolucao.get(devId) ?? [];
      lista.push(mapItem(i, volumesPorItem.get(String(campo(i, ["id"]))) ?? [], descricoes));
      itensPorDevolucao.set(devId, lista);
    }

    const mapeadas = devolucoes
      .map((d) => mapDevolucao(d, itensPorDevolucao.get(String(campo(d, ["id"]))) ?? [], nomes))
      .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));

    setState(mapeadas);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    toast.error(`Falha ao carregar devoluções: ${msg}`);
  } finally {
    carregando = false;
  }
}

export function carregar() {
  if (carregado || typeof window === "undefined") return;
  carregado = true;
  void recarregar();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => state;
const vazio: Devolucao[] = [];
const getServerSnapshot = () => vazio;

export function useDevolucoes() {
  useEffect(() => {
    carregar();
  }, []);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useDevolucao(id: string | undefined) {
  const lista = useDevolucoes();
  return lista.find((d) => d.id === id) ?? null;
}

/** Força uma nova leitura do Supabase (usado após login). */
export function useRecarregarDevolucoes() {
  return useCallback(() => {
    void recarregar();
  }, []);
}

export const podeEditar = (d: Devolucao) => d.status !== "finalizada";

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

export async function listarDevolucoes() {
  await recarregar();
  return state;
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
      await recarregar();
      const id = String(campo(linha, ["id"]));
      return state.find((d) => d.id === id) ?? mapDevolucao(linha, [], new Map());
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
      await recarregar();
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
      await recarregar();
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
      await recarregar();
      return true;
    }),
  );
  return ok === true;
}

export async function removerItem(_devolucaoId: string, itemId: string): Promise<boolean> {
  const ok = await exclusiva(`removerItem:${itemId}`, () =>
    comErro(async () => {
      await supabase.from("volumes_item").delete().eq("item_id", itemId);
      const { error } = await supabase.from("itens_devolucao").delete().eq("id", itemId);
      if (error) throw error;
      await recarregar();
      return true;
    }),
  );
  return ok === true;
}

export async function registrarCsvGerado(devolucaoId: string) {
  await comErro(async () => {
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
    await recarregar();
  });
}

export async function vincularRm(devolucaoId: string, rm: string) {
  await comErro(async () => {
    await atualizarFlex(
      "devolucoes",
      devolucaoId,
      { rm, status: "rm_vinculada", rm_vinculada_em: new Date().toISOString() },
      ALIAS_DEVOLUCAO,
    );
    await recarregar();
  });
}

export async function finalizarDevolucao(devolucaoId: string): Promise<boolean> {
  const ok = await comErro(async () => {
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
    await recarregar();
    return true;
  });
  return ok === true;
}

export async function removerDevolucao(devolucaoId: string) {
  await comErro(async () => {
    const alvo = state.find((d) => d.id === devolucaoId);
    for (const item of alvo?.itens ?? []) {
      await supabase.from("volumes_item").delete().eq("item_id", item.id);
    }
    await supabase.from("itens_devolucao").delete().eq("devolucao_id", devolucaoId);
    const { error } = await supabase.from("devolucoes").delete().eq("id", devolucaoId);
    if (error) throw error;
    await recarregar();
  });
}

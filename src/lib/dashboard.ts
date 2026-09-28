import { supabase } from "@/lib/supabase";
import { campo, texto, type Payload } from "@/lib/supabase-flex";

export type DashboardStatus = "em_montagem" | "csv_gerado" | "rm_vinculada" | "finalizada";

export interface DashboardDevolucao {
  id: string;
  identificador: string;
  rm: string | null;
  status: DashboardStatus;
  criadoEm: string;
  finalizadoEm: string | null;
  itens: number;
}

export interface DashboardMaterial {
  codigo: string;
  descricao: string;
  devolucoes: number;
}

export interface DashboardDados {
  devolucoes: DashboardDevolucao[];
  topMateriais: DashboardMaterial[];
}

const PAGE_SIZE = 1000;
const ITEM_ID_BATCH_SIZE = 200;
const MATERIAL_CODE_BATCH_SIZE = 200;
const STATUS_VALIDOS: DashboardStatus[] = [
  "em_montagem",
  "csv_gerado",
  "rm_vinculada",
  "finalizada",
];

type PaginatedQuery = {
  range: (
    inicio: number,
    fim: number,
  ) => PromiseLike<{
    data: unknown[] | null;
    error: { message: string } | null;
  }>;
};

async function buscarPaginas(
  tabela: "devolucoes" | "itens_devolucao",
  configurar: (consulta: ReturnType<typeof supabase.from>) => PaginatedQuery,
): Promise<Payload[]> {
  const linhas: Payload[] = [];
  for (let inicio = 0; ; inicio += PAGE_SIZE) {
    const consulta = configurar(supabase.from(tabela));
    const { data, error } = await consulta.range(inicio, inicio + PAGE_SIZE - 1);
    if (error) throw error;
    const pagina = (data ?? []) as Payload[];
    linhas.push(...pagina);
    if (pagina.length < PAGE_SIZE) return linhas;
  }
}

async function buscarDescricoesDashboard(codigos: string[]) {
  const descricoes = new Map<string, string>();
  for (let inicio = 0; inicio < codigos.length; inicio += MATERIAL_CODE_BATCH_SIZE) {
    const lote = codigos.slice(inicio, inicio + MATERIAL_CODE_BATCH_SIZE);
    const { data, error } = await supabase
      .from("materiais")
      .select("codigo, descricao")
      .in("codigo", lote);
    if (error) throw error;
    for (const linha of (data ?? []) as Payload[]) {
      const codigo = texto(campo(linha, ["codigo"]));
      const descricao = texto(campo(linha, ["descricao"]));
      if (codigo && descricao) descricoes.set(codigo, descricao);
    }
  }
  return descricoes;
}

export async function buscarDadosDashboard(
  inicio: Date,
  fimExclusivo: Date,
): Promise<DashboardDados> {
  const { data: sessao, error: erroSessao } = await supabase.auth.getSession();
  if (erroSessao) throw erroSessao;
  if (!sessao.session) throw new Error("Usuário não autenticado.");

  const linhasDevolucao = await buscarPaginas("devolucoes", (consulta) =>
    consulta
      .select("*")
      .gte("criado_em", inicio.toISOString())
      .lt("criado_em", fimExclusivo.toISOString())
      .order("criado_em", { ascending: false }),
  );

  const ids = linhasDevolucao.map((linha) => texto(campo(linha, ["id"])) ?? "").filter(Boolean);
  const linhasItens: Payload[] = [];
  for (let inicioIds = 0; inicioIds < ids.length; inicioIds += ITEM_ID_BATCH_SIZE) {
    const loteIds = ids.slice(inicioIds, inicioIds + ITEM_ID_BATCH_SIZE);
    const itens = await buscarPaginas("itens_devolucao", (consulta) =>
      consulta.select("*").in("devolucao_id", loteIds),
    );
    linhasItens.push(...itens);
  }

  const materiaisPorCodigo = new Map<string, Set<string>>();
  const itensPorDevolucao = new Map<string, number>();
  for (const item of linhasItens) {
    const devolucaoId = texto(campo(item, ["devolucao_id"])) ?? "";
    const codigo = texto(campo(item, ["material_codigo", "codigo", "codigo_material"])) ?? "";
    itensPorDevolucao.set(devolucaoId, (itensPorDevolucao.get(devolucaoId) ?? 0) + 1);
    if (!codigo) continue;
    const devolucoesDoMaterial = materiaisPorCodigo.get(codigo) ?? new Set<string>();
    devolucoesDoMaterial.add(devolucaoId);
    materiaisPorCodigo.set(codigo, devolucoesDoMaterial);
  }

  const descricoes = await buscarDescricoesDashboard([...materiaisPorCodigo.keys()]);
  const topMateriais = [...materiaisPorCodigo.entries()]
    .map(([codigo, devolucoes]) => ({
      codigo,
      descricao: descricoes.get(codigo) ?? "",
      devolucoes: devolucoes.size,
    }))
    .sort((a, b) => b.devolucoes - a.devolucoes || a.codigo.localeCompare(b.codigo))
    .slice(0, 5);

  const devolucoes = linhasDevolucao.map((linha) => {
    const id = texto(campo(linha, ["id"])) ?? "";
    const statusBruto = texto(campo(linha, ["status"])) ?? "em_montagem";
    return {
      id,
      identificador: texto(campo(linha, ["identificador", "codigo", "numero"])) ?? id,
      rm: texto(campo(linha, ["rm", "numero_rm", "rm_numero"])),
      status: STATUS_VALIDOS.includes(statusBruto as DashboardStatus)
        ? (statusBruto as DashboardStatus)
        : "em_montagem",
      criadoEm: texto(campo(linha, ["criado_em", "created_at", "data_criacao"])) ?? "",
      finalizadoEm: texto(campo(linha, ["finalizado_em", "finalizada_em"])),
      itens: itensPorDevolucao.get(id) ?? 0,
    } satisfies DashboardDevolucao;
  });

  return { devolucoes, topMateriais };
}

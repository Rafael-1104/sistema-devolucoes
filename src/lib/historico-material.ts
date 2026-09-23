import { supabase } from "@/lib/supabase";
import { campo, numero, texto, type Payload } from "@/lib/supabase-flex";
import type { DevolucaoStatus } from "@/lib/mock-data";

export interface HistoricoMaterialResultado {
  codigo: string;
  descricao: string;
  devolucoesEncontradas: number;
  lotes: number;
  unidades: number;
  itens: HistoricoMaterialItem[];
}

export interface HistoricoMaterialItem {
  id: string;
  devolucaoId: string;
  identificador: string;
  rm: string | null;
  data: string;
  lote: string;
  quantidade: number;
  status: DevolucaoStatus;
}

export async function buscarHistoricoMaterial(codigo: string): Promise<HistoricoMaterialResultado | null> {
  const alvo = codigo.trim();
  if (!alvo) return null;

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;

  const userId = userData.user?.id;
  if (!userId) {
    throw new Error("Usuário não autenticado.");
  }

  const { data: materialData, error: materialError } = await supabase
    .from("materiais")
    .select("codigo, descricao")
    .eq("codigo", alvo)
    .limit(1);

  if (materialError) throw materialError;

  const material = (materialData as Payload[] | null)?.[0];
  if (!material) return null;

  const materialCodigo = texto(campo(material, ["codigo"])) ?? alvo;
  const descricao = texto(campo(material, ["descricao", "nome"])) ?? "";

  const { data: devolucoesData, error: devolucoesError } = await supabase
    .from("devolucoes")
    .select("id, identificador, rm, status, criado_em")
    .eq("criado_por", userId)
    .order("criado_em", { ascending: false });

  if (devolucoesError) throw devolucoesError;

  const devolucoes = (devolucoesData ?? []) as Payload[];
  const ids = devolucoes.map((d) => String(campo(d, ["id"]) ?? "")) .filter(Boolean);

  if (ids.length === 0) {
    return {
      codigo: materialCodigo,
      descricao,
      devolucoesEncontradas: 0,
      lotes: 0,
      unidades: 0,
      itens: [],
    };
  }

  const { data: itensData, error: itensError } = await supabase
    .from("itens_devolucao")
    .select("id, devolucao_id, material_codigo, lote, quantidade_total")
    .eq("material_codigo", materialCodigo)
    .in("devolucao_id", ids);

  if (itensError) throw itensError;

  const mapaDevolucoes = new Map(
    devolucoes.map((devolucao) => [String(campo(devolucao, ["id"]) ?? ""), devolucao]),
  );

  const itens = ((itensData ?? []) as Payload[])
    .map((item) => {
      const devolucaoId = String(campo(item, ["devolucao_id"]) ?? "");
      const devolucao = mapaDevolucoes.get(devolucaoId);
      const statusBruto = texto(campo(devolucao, ["status"])) ?? "em_montagem";
      const status: DevolucaoStatus = ["em_montagem", "csv_gerado", "rm_vinculada", "finalizada"].includes(statusBruto)
        ? (statusBruto as DevolucaoStatus)
        : "em_montagem";

      return {
        id: String(campo(item, ["id"]) ?? ""),
        devolucaoId,
        identificador: texto(campo(devolucao, ["identificador"])) ?? "",
        rm: texto(campo(devolucao, ["rm"])) ?? null,
        data: texto(campo(devolucao, ["criado_em"])) ?? new Date().toISOString(),
        lote: texto(campo(item, ["lote"])) ?? "—",
        quantidade: numero(campo(item, ["quantidade_total", "quantidade", "qtd"])),
        status,
      } satisfies HistoricoMaterialItem;
    })
    .filter((item) => item.devolucaoId && item.identificador)
    .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

  const devolucoesEncontradas = new Set(itens.map((item) => item.devolucaoId)).size;

  return {
    codigo: materialCodigo,
    descricao,
    devolucoesEncontradas,
    lotes: itens.length,
    unidades: itens.reduce((soma, item) => soma + item.quantidade, 0),
    itens,
  };
}

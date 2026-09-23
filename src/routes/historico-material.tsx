import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { AlertCircle, Eraser, History, Loader2, Search } from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { Panel, Field } from "@/components/ui-kit/PageSection";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import {
  buscarHistoricoMaterial,
  type HistoricoMaterialResultado,
} from "@/lib/historico-material";
import { formatarData } from "@/lib/mock-data";
import { reportLovableError } from "@/lib/lovable-error-reporting";

export const Route = createFileRoute("/historico-material")({
  head: () => ({
    meta: [
      { title: "Histórico de Material | Sistema de Devoluções" },
      {
        name: "description",
        content: "Consulte em quais devoluções feitas por você um material foi utilizado.",
      },
      { property: "og:title", content: "Histórico de Material | Sistema de Devoluções" },
      {
        property: "og:description",
        content: "Consulte em quais devoluções feitas por você um material foi utilizado.",
      },
    ],
  }),
  component: HistoricoMaterial,
});

const inputClass =
  "w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/25";
const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50";
const btnGhost =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-primary-soft hover:text-primary-dark disabled:cursor-not-allowed disabled:opacity-50";

function HistoricoMaterial() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [codigo, setCodigo] = useState("");
  const [resultado, setResultado] = useState<HistoricoMaterialResultado | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [consultado, setConsultado] = useState(false);

  const consultar = async (valor?: string) => {
    const alvo = (valor ?? codigo).trim();

    if (!alvo) {
      setResultado(null);
      setErro("Informe o código do material.");
      setConsultado(true);
      return;
    }

    setCarregando(true);
    setErro(null);
    setConsultado(true);

    try {
      const dados = await buscarHistoricoMaterial(alvo);

      if (!dados) {
        setResultado(null);
        setErro("Material não encontrado.");
        return;
      }

      if (dados.itens.length === 0) {
        setResultado(null);
        setErro("Este material ainda não consta em nenhuma devolução sua.");
        return;
      }

      setResultado(dados);
      setErro(null);
    } catch (error) {
      console.error("Erro ao consultar histórico de material:", error);
      reportLovableError(error, {
        source: "historico_material",
        route: "/historico-material",
      });
      setResultado(null);
      setErro("Não foi possível consultar o histórico deste material.");
    } finally {
      setCarregando(false);
    }
  };

  const limpar = () => {
    setCodigo("");
    setResultado(null);
    setErro(null);
    setConsultado(false);
    inputRef.current?.focus();
  };

  return (
    <AppLayout title="Histórico de Material" subtitle="Consulte em quais devoluções você já utilizou um determinado material.">
      <div className="mx-auto max-w-[1200px] space-y-5">
        <Panel title="Histórico de material" description="Consulte o uso de um material nas devoluções criadas por você.">
          <div className="space-y-4">
            <Field label="Código do material">
              <input
                ref={inputRef}
                className={inputClass}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="Digite o código exato"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void consultar();
                  }
                }}
              />
            </Field>

            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className={btnPrimary} onClick={() => void consultar()} disabled={carregando}>
                {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {carregando ? "Consultando..." : "Consultar"}
              </button>
              {(consultado || resultado || codigo) && (
                <button type="button" className={btnGhost} onClick={limpar}>
                  <Eraser className="h-4 w-4" /> Limpar
                </button>
              )}
            </div>
          </div>
        </Panel>

        {!consultado && !carregando && !resultado && (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
            <History className="h-7 w-7 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Digite um código exato para consultar em quais devoluções você já utilizou esse material.
            </p>
          </div>
        )}

        {carregando && (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-6 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Consultando histórico...
          </div>
        )}

        {!carregando && erro && (
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-5 py-4 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{erro}</span>
          </div>
        )}

        {resultado && (
          <>
            <Panel title="Material encontrado" description="Resumo do uso do material nas suas devoluções">
              <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Material encontrado
                  </p>
                  <p className="text-2xl font-bold tracking-tight text-foreground">{resultado.codigo}</p>
                  <p className="max-w-2xl text-sm text-foreground">{resultado.descricao}</p>
                </div>

                <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
                  <div className="rounded-lg border border-border bg-muted/40 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Devoluções</p>
                    <p className="mt-2 text-lg font-semibold text-foreground">{resultado.devolucoesEncontradas}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/40 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Lotes</p>
                    <p className="mt-2 text-lg font-semibold text-foreground">{resultado.lotes}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/40 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Unidades</p>
                    <p className="mt-2 text-lg font-semibold text-foreground">{resultado.unidades}</p>
                  </div>
                </div>
              </div>
            </Panel>

            <Panel title="Histórico de devoluções" description="Cada ocorrência ficou separada por lote e quantidade.">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-3 font-semibold">Devolução</th>
                      <th className="px-4 py-3 font-semibold">Data</th>
                      <th className="px-4 py-3 font-semibold">RM</th>
                      <th className="px-4 py-3 font-semibold">Lote</th>
                      <th className="px-4 py-3 font-semibold">Quantidade</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultado.itens.map((item) => (
                      <tr key={item.id} className="border-b border-border/70 last:border-0 hover:bg-muted/50">
                        <td className="px-4 py-3.5 font-semibold text-foreground">{item.identificador}</td>
                        <td className="px-4 py-3.5 text-muted-foreground">{formatarData(item.data)}</td>
                        <td className="px-4 py-3.5 font-medium text-foreground">{item.rm ?? "—"}</td>
                        <td className="px-4 py-3.5 text-foreground">{item.lote}</td>
                        <td className="px-4 py-3.5 text-foreground">{item.quantidade}</td>
                        <td className="px-4 py-3.5">
                          <StatusBadge status={item.status} />
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              void navigate({
                                to: "/nova-devolucao",
                                search: { id: item.devolucaoId },
                              })
                            }
                            className="inline-flex items-center justify-center rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-primary-soft hover:text-primary-dark"
                          >
                            Ver
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </>
        )}
      </div>
    </AppLayout>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, FileText, Printer } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { Panel, Field } from "@/components/ui-kit/PageSection";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { ItensDevolucaoTable } from "@/components/devolucoes/ItensDevolucaoTable";
import { finalizarDevolucao, useDevolucoes } from "@/lib/devolucoes-store";
import { formatarDataHora, totalDevolucao, totalItem, type Devolucao } from "@/lib/mock-data";

export const Route = createFileRoute("/relatorios")({
  validateSearch: (search: Record<string, unknown>) => ({
    id: typeof search["id"] === "string" ? (search["id"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Relatórios | Sistema de Devoluções" },
      {
        name: "description",
        content: "Relatório final da devolução com identificador interno, número da RM, itens e campos de assinatura.",
      },
      { property: "og:title", content: "Relatórios | Sistema de Devoluções" },
      {
        property: "og:description",
        content: "Relatório final da devolução com identificador interno, número da RM, itens e campos de assinatura.",
      },
    ],
  }),
  component: Relatorios,
});

const inputClass =
  "w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/25";
const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50";
const btnGhost =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-primary-soft hover:text-primary-dark disabled:cursor-not-allowed disabled:opacity-50";

function Relatorios() {
  const { id } = Route.useSearch();
  const navigate = Route.useNavigate();
  const devolucoes = useDevolucoes();

  const disponiveis = devolucoes.filter((d) => d.rm !== null);
  const [selecionada, setSelecionada] = useState<string>(id ?? "");
  const [previa, setPrevia] = useState(false);

  useEffect(() => {
    if (id) {
      setSelecionada(id);
      setPrevia(false);
    }
  }, [id]);

  const devolucao = disponiveis.find((d) => d.id === selecionada) ?? null;

  async function finalizar() {
    if (!devolucao) return;
    const ok = await finalizarDevolucao(devolucao.id);
    if (ok) toast.success(`Devolução ${devolucao.identificador} finalizada`);
  }

  return (
    <AppLayout title="Relatórios" subtitle="Relatório final disponível apenas após a vinculação da RM">
      <div className="mx-auto max-w-[1400px] space-y-6">
        <Panel title="Selecionar devolução" description="Somente devoluções com RM vinculada podem gerar relatório">
          <div className="flex flex-wrap items-end gap-4">
            <Field label="Devolução" className="min-w-[280px] flex-1">
              <select
                className={inputClass}
                value={selecionada}
                onChange={(e) => {
                  setPrevia(false);
                  setSelecionada(e.target.value);
                  void navigate({ to: "/relatorios", search: { id: e.target.value || undefined } });
                }}
              >
                <option value="">Selecione…</option>
                {disponiveis.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.identificador} — RM {d.rm}
                  </option>
                ))}
              </select>
            </Field>
            <button type="button" className={btnPrimary} disabled={!devolucao} onClick={() => setPrevia(true)}>
              <FileText className="h-4 w-4" /> Gerar relatório final
            </button>
            <button type="button" className={btnGhost} disabled={!previa} onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Imprimir
            </button>
          </div>
          {disponiveis.length === 0 && (
            <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4" /> Nenhuma devolução com RM vinculada até o momento.
            </p>
          )}
        </Panel>

        {devolucao && previa && (
          <>
            <Panel title="Prévia do relatório" bodyClassName="p-0">
              <div className="space-y-6 p-8">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
                  <div>
                    <h3 className="text-lg font-bold text-foreground">Relatório de Devolução de Materiais</h3>
                    <p className="text-sm text-muted-foreground">
                      Identificador interno: <strong className="text-foreground">{devolucao.identificador}</strong>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Número da RM (ARECO): <strong className="text-foreground">{devolucao.rm}</strong>
                    </p>
                  </div>
                  <div className="space-y-1 text-right text-xs text-muted-foreground">
                    <StatusBadge status={devolucao.status} />
                    <p>Criada por {devolucao.criadoPor}</p>
                    <p>Data/Hora: {formatarDataHora(devolucao.rmVinculadaEm)}</p>
                    <p>RM vinculada em {formatarDataHora(devolucao.rmVinculadaEm)}</p>
                  </div>
                </div>

                <ItensDevolucaoTable itens={devolucao.itens} readOnly />

                <div className="flex justify-end border-t border-border pt-4 text-sm">
                  <span className="font-semibold text-foreground">
                    Quantidade total devolvida: {totalDevolucao(devolucao)}
                  </span>
                </div>

                <div className="grid gap-10 pt-10 sm:grid-cols-2">
                  {["Responsável pela devolução", "Responsável pelo recebimento"].map((label) => (
                    <div key={label} className="space-y-2">
                      <div className="border-t border-foreground/40" />
                      <p className="text-center text-xs text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>

            <Panel title="Conclusão" description="A devolução só é marcada como finalizada após esta confirmação">
              {devolucao.status === "finalizada" ? (
                <p className="flex items-center gap-2 text-sm text-primary-dark">
                  <CheckCircle2 className="h-4 w-4" /> Finalizada por {devolucao.finalizadaPor} em{" "}
                  {formatarDataHora(devolucao.finalizadaEm)}.
                </p>
              ) : (
                <div className="flex flex-wrap items-center gap-4">
                  <p className="text-sm text-muted-foreground">
                    Confira a prévia acima e finalize para bloquear novas edições.
                  </p>
                  <button type="button" className={btnPrimary} onClick={() => void finalizar()}>
                    <CheckCircle2 className="h-4 w-4" /> Finalizar devolução
                  </button>
                </div>
              )}
            </Panel>

            <FolhaImpressao devolucao={devolucao} />
          </>
        )}
      </div>
    </AppLayout>
  );
}

/**
 * Documento de impressão (A4 retrato) renderizado como filho direto de <body>
 * por portal: no @media print somente ele fica visível.
 */
function FolhaImpressao({ devolucao }: { devolucao: Devolucao }) {
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  if (!montado || typeof document === "undefined") return null;

  return createPortal(
    <div className="folha-impressao">
      <div style={{ textAlign: "center", marginBottom: "10mm" }}>
        <h1 style={{ fontSize: "14pt", fontWeight: 700, margin: 0 }}>Relatório de Devolução de Materiais</h1>
      </div>

      <table style={{ marginBottom: "6mm", border: "none" }}>
        <tbody>
          <tr>
            <td style={{ border: "none", padding: 0 }}>
              <strong>Identificador interno:</strong> {devolucao.identificador}
            </td>
            <td style={{ border: "none", padding: 0 }}>
              <strong>RM (ARECO):</strong> {devolucao.rm ?? "—"}
            </td>
          </tr>
          <tr>
            <td style={{ border: "none", padding: 0 }}>
              <strong>Criada por:</strong> {devolucao.criadoPor}
            </td>
            <td style={{ border: "none", padding: 0 }}>
              <strong>Data/Hora:</strong> {formatarDataHora(devolucao.rmVinculadaEm)}
            </td>
          </tr>
        </tbody>
      </table>

      <table>
        <thead>
          <tr>
            <th style={{ width: "18%" }}>Código</th>
            <th style={{ width: "50%" }}>Descrição</th>
            <th style={{ width: "16%" }}>Quantidade Total</th>
            <th style={{ width: "16%" }}>Lote</th>
          </tr>
        </thead>
        <tbody>
          {devolucao.itens.map((item) => (
            <tr key={item.id}>
              <td>{item.materialCodigo}</td>
              <td>{item.descricao}</td>
              <td>{totalItem(item)}</td>
              <td>{item.lote}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={2} style={{ fontWeight: 700, textAlign: "right" }}>
              Quantidade total devolvida
            </td>
            <td style={{ fontWeight: 700 }}>{totalDevolucao(devolucao)}</td>
            <td />
          </tr>
        </tbody>
      </table>

      <table style={{ marginTop: "20mm", border: "none" }}>
        <tbody>
          <tr>
            {["Responsável pela devolução", "Responsável pelo recebimento"].map((label) => (
              <td key={label} style={{ border: "none", padding: "0 8mm", textAlign: "center" }}>
                <div style={{ borderTop: "1px solid #000", paddingTop: "2mm", fontSize: "9pt" }}>{label}</div>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>,
    document.body,
  );
}

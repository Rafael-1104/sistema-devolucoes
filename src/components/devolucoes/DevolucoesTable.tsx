import { Eye, FileText, Trash2 } from "lucide-react";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { dataDaDevolucao, totalDevolucao, type Devolucao } from "@/lib/mock-data";

export function DevolucoesTable({
  data,
  onView,
  onReport,
  onDelete,
}: {
  data: Devolucao[];
  onView?: (d: Devolucao) => void;
  onReport?: (d: Devolucao) => void;
  onDelete?: (d: Devolucao) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-6 py-3 font-semibold">Identificador</th>
            <th className="px-6 py-3 font-semibold">RM</th>
            <th className="px-6 py-3 font-semibold">Data</th>
            <th className="px-6 py-3 font-semibold">Usuário</th>
            <th className="px-6 py-3 font-semibold">Itens</th>
            <th className="px-6 py-3 font-semibold">Qtd. total</th>
            <th className="px-6 py-3 font-semibold">Status</th>
            <th className="px-6 py-3 text-right font-semibold">Ações</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.id} className="border-b border-border/70 transition-colors last:border-0 hover:bg-muted/50">
              <td className="px-6 py-3.5 font-semibold text-foreground">{d.identificador}</td>
              <td className="px-6 py-3.5">
                {d.rm ? (
                  <span className="font-semibold tabular-nums text-foreground">{d.rm}</span>
                ) : (
                  <span className="rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                    RM pendente
                  </span>
                )}
              </td>
              <td className="px-6 py-3.5 text-muted-foreground">{dataDaDevolucao(d)}</td>
              <td className="px-6 py-3.5 text-foreground">{d.criadoPor}</td>
              <td className="px-6 py-3.5 tabular-nums text-foreground">{d.itens.length}</td>
              <td className="px-6 py-3.5 tabular-nums text-foreground">{totalDevolucao(d)}</td>
              <td className="px-6 py-3.5">
                <StatusBadge status={d.status} />
              </td>
              <td className="px-6 py-3.5">
                <div className="flex justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => onView?.(d)}
                    title={d.status === "finalizada" ? "Visualizar devolução" : "Abrir / retomar devolução"}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary-soft hover:text-primary-dark"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onReport?.(d)}
                    disabled={!d.rm}
                    title={d.rm ? "Relatório final" : "Disponível após vincular a RM"}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary-soft hover:text-primary-dark disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                  >
                    <FileText className="h-4 w-4" />
                  </button>
                  {d.status !== "finalizada" && (
                    <button
                      type="button"
                      onClick={() => onDelete?.(d)}
                      title="Excluir devolução"
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <td colSpan={8} className="px-6 py-12 text-center text-sm text-muted-foreground">
                Nenhuma devolução encontrada.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

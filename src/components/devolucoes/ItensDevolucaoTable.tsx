import { useState } from "react";
import { Check, Copy, Loader2, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { totalItem, type ItemDevolucao } from "@/lib/mock-data";

async function copiarCodigo(codigo: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(codigo);
    } else {
      const area = document.createElement("textarea");
      area.value = codigo;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      document.body.removeChild(area);
    }
    toast.success("Código copiado!");
  } catch {
    toast.error("Não foi possível copiar o código.");
  }
}

export function ItensDevolucaoTable({
  itens,
  readOnly,
  onEdit,
  onRemove,
}: {
  itens: ItemDevolucao[];
  readOnly?: boolean;
  onEdit?: (item: ItemDevolucao) => void;
  onRemove?: (item: ItemDevolucao) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-6 py-3 font-semibold">Código</th>
            <th className="px-6 py-3 font-semibold">Descrição</th>
            <th className="px-6 py-3 font-semibold">Lote</th>
            <th className="px-6 py-3 font-semibold">Volumes</th>
            <th className="px-6 py-3 font-semibold">Total</th>
            {!readOnly && <th className="px-6 py-3 text-right font-semibold">Ações</th>}
          </tr>
        </thead>
        <tbody>
          {itens.map((item) => (
            <tr key={item.id} className="border-b border-border/70 last:border-0 hover:bg-muted/50">
              <td className="px-6 py-3.5 font-semibold text-foreground">
                <span className="inline-flex items-center gap-1.5">
                  {item.materialCodigo}
                  <button
                    type="button"
                    onClick={() => void copiarCodigo(item.materialCodigo)}
                    title="Copiar código"
                    aria-label={`Copiar código ${item.materialCodigo}`}
                    className="flex h-6 w-6 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary-soft hover:text-primary-dark"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </span>
              </td>
              <td className="px-6 py-3.5 text-muted-foreground">{item.descricao}</td>
              <td className="px-6 py-3.5 text-foreground">{item.lote}</td>
              <td className="px-6 py-3.5">
                <div className="flex flex-wrap gap-1.5">
                  {item.volumes.map((v) => (
                    <span
                      key={v.id}
                      className="rounded-md border border-border bg-muted/60 px-2 py-0.5 text-[11px] font-semibold text-foreground"
                    >
                      V{v.numero}: {v.quantidade}
                    </span>
                  ))}
                </div>
              </td>
              <td className="px-6 py-3.5 tabular-nums font-semibold text-foreground">{totalItem(item)}</td>
              {!readOnly && (
                <td className="px-6 py-3.5">
                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => onEdit?.(item)}
                      title="Editar item"
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary-soft hover:text-primary-dark"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemove?.(item)}
                      title="Remover item"
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              )}
            </tr>
          ))}
          {itens.length === 0 && (
            <tr>
              <td colSpan={readOnly ? 5 : 6} className="px-6 py-12 text-center text-sm text-muted-foreground">
                Nenhum item adicionado até o momento.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

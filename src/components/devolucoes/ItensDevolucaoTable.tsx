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

const iconBtn =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary-soft hover:text-primary-dark disabled:cursor-not-allowed disabled:opacity-50";

/** Célula do lote com edição inline exclusiva (não usa o formulário de cadastro). */
function LoteCell({
  item,
  readOnly,
  onSaveLote,
}: {
  item: ItemDevolucao;
  readOnly?: boolean;
  onSaveLote?: (item: ItemDevolucao, lote: string) => Promise<boolean>;
}) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(item.lote);
  const [salvando, setSalvando] = useState(false);

  if (readOnly || !onSaveLote) return <span className="text-foreground">{item.lote}</span>;

  async function salvar() {
    if (salvando) return;
    const novo = valor.trim();
    if (!novo) {
      toast.error("Informe o lote.");
      return;
    }
    if (novo === item.lote) {
      setEditando(false);
      return;
    }
    setSalvando(true);
    const ok = await onSaveLote!(item, novo);
    setSalvando(false);
    if (ok) setEditando(false);
    else setValor(item.lote);
  }

  function cancelar() {
    setValor(item.lote);
    setEditando(false);
  }

  if (!editando) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="text-foreground">{item.lote}</span>
        <button
          type="button"
          onClick={() => {
            setValor(item.lote);
            setEditando(true);
          }}
          title="Editar lote"
          aria-label={`Editar lote do item ${item.materialCodigo}`}
          className="flex h-6 w-6 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary-soft hover:text-primary-dark"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <input
        autoFocus
        type="text"
        inputMode="text"
        value={valor}
        disabled={salvando}
        onChange={(e) => setValor(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void salvar();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            cancelar();
          }
        }}
        aria-label="Lote"
        className="w-28 rounded-lg border border-input bg-card px-2 py-1 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
      />
      <button type="button" onClick={() => void salvar()} disabled={salvando} title="Salvar lote" className={iconBtn}>
        {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
      </button>
      <button type="button" onClick={cancelar} disabled={salvando} title="Cancelar" className={iconBtn}>
        <X className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}

export function ItensDevolucaoTable({
  itens,
  readOnly,
  onEdit,
  onRemove,
  onSaveLote,
}: {
  itens: ItemDevolucao[];
  readOnly?: boolean;
  onEdit?: (item: ItemDevolucao) => void;
  onRemove?: (item: ItemDevolucao) => void;
  onSaveLote?: (item: ItemDevolucao, lote: string) => Promise<boolean>;
}) {
  const [removendoId, setRemovendoId] = useState<string | null>(null);

  async function remover(item: ItemDevolucao) {
    if (removendoId) return;
    setRemovendoId(item.id);
    try {
      await onRemove?.(item);
    } finally {
      setRemovendoId(null);
    }
  }

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
              <td className="px-6 py-3.5">
                <LoteCell
                  key={`${item.id}:${item.lote}`}
                  item={item}
                  readOnly={readOnly}
                  {...(onSaveLote ? { onSaveLote } : {})}
                />
              </td>
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
                      className={iconBtn}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void remover(item)}
                      disabled={removendoId !== null}
                      title="Remover item"
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {removendoId === item.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
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

import { useEffect, useState } from "react";

export interface VolumeRascunho {
  numero: number;
  quantidade: string;
}

const inputClass =
  "w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/25";

export const somaVolumes = (volumes: VolumeRascunho[]) =>
  volumes.reduce((acc, v) => {
    const n = Number(v.quantidade);
    return acc + (Number.isFinite(n) && n > 0 ? n : 0);
  }, 0);

const preenchido = (v: VolumeRascunho) => v.quantidade.trim() !== "";

export function VolumesEditor({
  volumes,
  onChange,
  erro,
}: {
  volumes: VolumeRascunho[];
  onChange: (volumes: VolumeRascunho[]) => void;
  erro?: string | undefined;
}) {
  const [quantidadeCampos, setQuantidadeCampos] = useState(String(volumes.length));

  // Mantém o campo sincronizado quando a lista muda por outra ação (editar item, etc.)
  useEffect(() => {
    setQuantidadeCampos((atual) => (Number(atual) === volumes.length ? atual : String(volumes.length)));
  }, [volumes.length]);

  function renumerar(lista: VolumeRascunho[]) {
    return lista.map((v, i) => ({ ...v, numero: i + 1 }));
  }

  function aplicarQuantidade(valor: string) {
    setQuantidadeCampos(valor);
    if (valor.trim() === "") return;

    const n = Number(valor);
    if (!Number.isInteger(n) || n < 0) return;

    if (n === volumes.length) return;

    if (n > volumes.length) {
      const novos: VolumeRascunho[] = [];
      for (let i = volumes.length; i < n; i++) novos.push({ numero: i + 1, quantidade: "" });
      onChange([...volumes, ...novos]);
      return;
    }

    const removidos = volumes.slice(n);
    const temDados = removidos.some(preenchido);
    if (temDados) {
      const ok = window.confirm(
        `Os volumes que serão removidos possuem quantidades preenchidas (${removidos.filter(preenchido).length}). Deseja continuar?`,
      );
      if (!ok) {
        setQuantidadeCampos(String(volumes.length));
        return;
      }
    }
    onChange(renumerar(volumes.slice(0, n)));
  }

  function alterar(index: number, quantidade: string) {
    onChange(volumes.map((v, i) => (i === index ? { ...v, quantidade } : v)));
  }

  return (
    <div className="space-y-3">
      <div className="min-w-0 space-y-1.5">
        <label htmlFor="quantidade-volumes" className="block text-xs font-semibold text-foreground">
          Quantidade de volumes
        </label>
        <input
          id="quantidade-volumes"
          type="number"
          min={0}
          step={1}
          inputMode="numeric"
          className={`${inputClass} sm:w-40`}
          placeholder="Ex.: 20"
          value={quantidadeCampos}
          onChange={(e) => aplicarQuantidade(e.target.value.replace(/[^0-9]/g, ""))}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {volumes.map((v, i) => (
          <div key={i} className="min-w-0 rounded-lg border border-border bg-card p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="truncate text-xs font-semibold text-muted-foreground">Volume {v.numero}</span>
            </div>
            <input
              type="number"
              min={1}
              className={inputClass}
              placeholder="Quantidade"
              value={v.quantidade}
              onChange={(e) => alterar(i, e.target.value)}
            />
          </div>
        ))}
      </div>

      {erro && <p className="text-xs text-destructive">{erro}</p>}

      <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quantidade total</span>
        <span className="text-base font-bold tabular-nums text-foreground">{somaVolumes(volumes)}</span>
      </div>
    </div>
  );
}

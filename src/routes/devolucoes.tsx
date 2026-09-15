import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CheckCircle2, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AppLayout } from "@/components/layout/AppLayout";
import { Panel, Field } from "@/components/ui-kit/PageSection";
import { DevolucoesTable } from "@/components/devolucoes/DevolucoesTable";
import { removerDevolucao, useDevolucoes } from "@/lib/devolucoes-store";
import { formatarDataHora, statusLabels, totalDevolucao, type Devolucao, type DevolucaoStatus } from "@/lib/mock-data";
import { useUsuarios } from "@/lib/usuarios";

export const Route = createFileRoute("/devolucoes")({
  head: () => ({
    meta: [
      { title: "Devoluções | Sistema de Devoluções" },
      {
        name: "description",
        content: "Histórico completo de devoluções com filtros por período, usuário, status e número da RM.",
      },
      { property: "og:title", content: "Devoluções | Sistema de Devoluções" },
      {
        property: "og:description",
        content: "Histórico completo de devoluções com filtros por período, usuário, status e número da RM.",
      },
    ],
  }),
  component: Devolucoes,
});

const inputClass =
  "w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/25";
const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50";
const btnGhost =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-primary-soft hover:text-primary-dark disabled:cursor-not-allowed disabled:opacity-50";

function Devolucoes() {
  const devolucoes = useDevolucoes();
  const { usuarios } = useUsuarios();
  const navigate = Route.useNavigate();

  const [busca, setBusca] = useState("");
  const [usuario, setUsuario] = useState("todos");
  const [status, setStatus] = useState("todos");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [devolucaoParaExcluir, setDevolucaoParaExcluir] = useState<Devolucao | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [exclusaoConcluida, setExclusaoConcluida] = useState(false);
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return devolucoes.filter((d) => {
      if (usuario !== "todos" && d.criadoPor !== usuario) return false;
      if (status !== "todos" && d.status !== status) return false;
      const dia = d.criadoEm.slice(0, 10);
      if (de && dia < de) return false;
      if (ate && dia > ate) return false;
      if (!termo) return true;
      return (
        d.identificador.toLowerCase().includes(termo) ||
        (d.rm ?? "").toLowerCase().includes(termo) ||
        d.criadoPor.toLowerCase().includes(termo) ||
        d.itens.some(
          (i) => i.materialCodigo.toLowerCase().includes(termo) || i.descricao.toLowerCase().includes(termo),
        )
      );
    });
  }, [devolucoes, busca, usuario, status, de, ate]);

  async function confirmarExclusao() {
    const alvo = devolucaoParaExcluir;
    if (!alvo || alvo.status === "finalizada" || excluindo) return;
    setExcluindo(true);
    setErroExclusao(null);
    try {
      const resultado = await removerDevolucao(alvo.id);
      if (!resultado.ok) {
        setErroExclusao(resultado.error);
        return;
      }
      setExclusaoConcluida(true);
      toast.success("Devolução excluída com sucesso!");
    } finally {
      setExcluindo(false);
    }
  }

  return (
    <AppLayout title="Devoluções" subtitle="Histórico completo dos registros">
      <div className="mx-auto max-w-[1400px] space-y-6">
        <Panel title="Filtros" description="Refine a consulta do histórico">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <Field label="Pesquisar" className="xl:col-span-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  className={`${inputClass} pl-9`}
                  placeholder="Identificador, RM, material ou usuário"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </div>
            </Field>
            <Field label="Usuário">
              <select className={inputClass} value={usuario} onChange={(e) => setUsuario(e.target.value)}>
                <option value="todos">Todos</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.nome}>
                    {u.nome}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="todos">Todos</option>
                {(Object.keys(statusLabels) as DevolucaoStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {statusLabels[s]}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="De">
                <input type="date" className={inputClass} value={de} onChange={(e) => setDe(e.target.value)} />
              </Field>
              <Field label="Até">
                <input type="date" className={inputClass} value={ate} onChange={(e) => setAte(e.target.value)} />
              </Field>
            </div>
          </div>
        </Panel>

        <Panel
          title={`${filtradas.length} devolução(ões)`}
          description="Clique para abrir, retomar ou emitir o relatório"
          bodyClassName="p-0"
        >
          <DevolucoesTable
            data={filtradas}
            onView={(d) => void navigate({ to: "/nova-devolucao", search: { id: d.id, origem: "devolucoes" } })}
            onReport={(d) => void navigate({ to: "/relatorios", search: { id: d.id } })}
            onDelete={(d) => {
              if (d.status !== "finalizada") {
                setErroExclusao(null);
                setExclusaoConcluida(false);
                setDevolucaoParaExcluir(d);
              }
            }}
          />
        </Panel>

        <Dialog
          open={devolucaoParaExcluir !== null}
          onOpenChange={(aberto) => {
            if (!aberto && !excluindo) setDevolucaoParaExcluir(null);
          }}
        >
          <DialogContent>
            {exclusaoConcluida ? (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-primary-dark">
                    <CheckCircle2 className="h-5 w-5" /> Devolução excluída com sucesso
                  </DialogTitle>
                  <DialogDescription>
                    A devolução {devolucaoParaExcluir?.identificador} foi excluída com sucesso.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <button type="button" className={btnPrimary} onClick={() => setDevolucaoParaExcluir(null)}>
                    Fechar
                  </button>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>Excluir devolução?</DialogTitle>
                  <DialogDescription>Você está prestes a excluir:</DialogDescription>
                </DialogHeader>
                {devolucaoParaExcluir && (
                  <div className="space-y-1 rounded-lg border border-border bg-muted/30 p-4 text-sm">
                    <p><strong>Devolução:</strong> {devolucaoParaExcluir.identificador}</p>
                    <p><strong>RM:</strong> {devolucaoParaExcluir.rm ?? "—"}</p>
                    <p><strong>Status:</strong> {statusLabels[devolucaoParaExcluir.status]}</p>
                    <p><strong>Criado em:</strong> {formatarDataHora(devolucaoParaExcluir.criadoEm)}</p>
                    <p><strong>Criado por:</strong> {devolucaoParaExcluir.criadoPor}</p>
                    <p><strong>Itens:</strong> {devolucaoParaExcluir.itens.length}</p>
                    <p><strong>Quantidade total:</strong> {totalDevolucao(devolucaoParaExcluir)}</p>
                  </div>
                )}
                <p className="text-sm text-destructive">Essa ação não poderá ser desfeita.</p>
                {erroExclusao && (
                  <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                    Não foi possível excluir a devolução: {erroExclusao}
                  </p>
                )}
                <DialogFooter>
                  <button type="button" className={btnGhost} onClick={() => setDevolucaoParaExcluir(null)} disabled={excluindo}>
                    Cancelar
                  </button>
                  <button type="button" className={btnPrimary} onClick={() => void confirmarExclusao()} disabled={excluindo}>
                    {excluindo && <Loader2 className="h-4 w-4 animate-spin" />}
                    {excluindo ? "Excluindo..." : "Excluir devolução"}
                  </button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

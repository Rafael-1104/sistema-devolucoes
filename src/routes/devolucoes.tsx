import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
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
import { useOperacoesDevolucao, usePaginaDevolucoes } from "@/lib/devolucoes-store";
import {
  formatarDataHora,
  statusLabels,
  type DevolucaoStatus,
} from "@/lib/mock-data";
import { useUsuarios } from "@/lib/usuarios";
import type { DevolucaoResumo } from "@/lib/devolucoes-store";

export const Route = createFileRoute("/devolucoes")({
  head: () => ({
    meta: [
      { title: "Devoluções | Sistema de Devoluções" },
      {
        name: "description",
        content:
          "Histórico completo de devoluções com filtros por período, usuário, status e número da RM.",
      },
      { property: "og:title", content: "Devoluções | Sistema de Devoluções" },
      {
        property: "og:description",
        content:
          "Histórico completo de devoluções com filtros por período, usuário, status e número da RM.",
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
  const { sessao } = useAuth();
  const { usuarios } = useUsuarios();
  const operacoes = useOperacoesDevolucao();
  const navigate = Route.useNavigate();

  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [usuarioId, setUsuarioId] = useState("todos");
  const [status, setStatus] = useState("todos");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [pagina, setPagina] = useState(1);
  const [devolucaoParaExcluir, setDevolucaoParaExcluir] = useState<DevolucaoResumo | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [exclusaoConcluida, setExclusaoConcluida] = useState(false);
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setBuscaAplicada(busca), 300);
    return () => window.clearTimeout(timer);
  }, [busca]);

  const filtros = useMemo(() => ({
    pagina,
    busca: buscaAplicada,
    usuarioId,
    status,
    de,
    ate,
    usuarios: usuarios.map(({ id, nome }) => ({ id, nome })),
  }), [pagina, buscaAplicada, usuarioId, status, de, ate, usuarios]);
  const { data: resultadoPagina, isLoading, isFetching, error } = usePaginaDevolucoes(filtros, Boolean(sessao));
  const devolucoesDaPagina = resultadoPagina?.devolucoes ?? [];
  const totalRegistros = resultadoPagina?.total ?? 0;

  const itensPorPagina = 10;
  const totalPaginas = Math.ceil(totalRegistros / itensPorPagina);
  const paginaAtual = Math.min(pagina, Math.max(totalPaginas, 1));
  const inicioPagina = (paginaAtual - 1) * itensPorPagina;
  const primeiroRegistro = totalRegistros === 0 ? 0 : inicioPagina + 1;
  const ultimoRegistro = Math.min(inicioPagina + itensPorPagina, totalRegistros);
  useEffect(() => {
    if (pagina !== paginaAtual) setPagina(paginaAtual);
  }, [pagina, paginaAtual]);
  const paginasVisiveis =
    totalPaginas <= 5
      ? Array.from({ length: totalPaginas }, (_, indice) => indice + 1)
      : Array.from(
          { length: Math.min(3, totalPaginas) },
          (_, indice) => Math.max(1, Math.min(paginaAtual - 1, totalPaginas - 2)) + indice,
        );
  const primeiraPaginaVisivel = paginasVisiveis[0] ?? 1;
  const ultimaPaginaVisivel = paginasVisiveis[paginasVisiveis.length - 1] ?? totalPaginas;
  const paginasComLimites =
    totalPaginas <= 5
      ? paginasVisiveis
      : [
          ...(primeiraPaginaVisivel > 1
            ? [1, ...(primeiraPaginaVisivel > 2 ? ["inicio" as const] : [])]
            : []),
          ...paginasVisiveis,
          ...(ultimaPaginaVisivel < totalPaginas
            ? [
                ...(ultimaPaginaVisivel < totalPaginas - 1
                  ? ["fim" as const]
                  : []),
                totalPaginas,
              ]
            : []),
        ];

  async function confirmarExclusao() {
    const alvo = devolucaoParaExcluir;
    if (!alvo || alvo.status === "finalizada" || excluindo) return;
    setExcluindo(true);
    setErroExclusao(null);
    try {
      const resultado = await operacoes.remover(alvo.id);
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
                  onChange={(e) => {
                    setBusca(e.target.value);
                    setPagina(1);
                  }}
                />
              </div>
            </Field>
            <Field label="Usuário">
              <select
                className={inputClass}
                value={usuarioId}
                onChange={(e) => {
                  setUsuarioId(e.target.value);
                  setPagina(1);
                }}
              >
                <option value="todos">Todos</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nome}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select
                className={inputClass}
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPagina(1);
                }}
              >
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
                <input
                  type="date"
                  className={inputClass}
                  value={de}
                  onChange={(e) => {
                    setDe(e.target.value);
                    setPagina(1);
                  }}
                />
              </Field>
              <Field label="Até">
                <input
                  type="date"
                  className={inputClass}
                  value={ate}
                  onChange={(e) => {
                    setAte(e.target.value);
                    setPagina(1);
                  }}
                />
              </Field>
            </div>
          </div>
        </Panel>

        <Panel
          title={`${totalRegistros} devolução(ões)`}
          description="Clique para abrir, retomar ou emitir o relatório"
          bodyClassName="p-0"
        >
          {error ? (
            <p role="alert" className="px-6 py-8 text-sm text-destructive">
              Não foi possível carregar as devoluções: {error instanceof Error ? error.message : "erro desconhecido"}
            </p>
          ) : isLoading ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">Carregando devoluções…</p>
          ) : (
          <DevolucoesTable
            data={devolucoesDaPagina}
            onView={(d) =>
              void navigate({ to: "/nova-devolucao", search: { id: d.id, origem: "devolucoes" } })
            }
            onReport={(d) => void navigate({ to: "/relatorios", search: { id: d.id } })}
            onDelete={(d) => {
              if (d.status !== "finalizada") {
                setErroExclusao(null);
                setExclusaoConcluida(false);
                setDevolucaoParaExcluir(d);
              }
            }}
          />
          )}
          <div className="flex flex-col gap-3 border-t border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {isFetching ? "Atualizando… " : ""}Mostrando {primeiroRegistro}–{ultimoRegistro} de {totalRegistros} devoluções
            </p>
            {totalPaginas > 1 && (
              <nav
                aria-label="Paginação das devoluções"
                className="flex flex-wrap items-center justify-center gap-1 sm:justify-end"
              >
                <button
                  type="button"
                  onClick={() => setPagina(paginaAtual - 1)}
                  disabled={paginaAtual === 1}
                  className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary-soft hover:text-primary-dark disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border disabled:hover:bg-transparent disabled:hover:text-foreground"
                >
                  Anterior
                </button>
                {paginasComLimites.map((item) =>
                  typeof item === "number" ? (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setPagina(item)}
                      aria-current={paginaAtual === item ? "page" : undefined}
                      aria-label={`Página ${item}`}
                      className={`inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-2.5 text-sm font-semibold transition-colors ${
                        paginaAtual === item
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border text-foreground hover:border-primary/40 hover:bg-primary-soft hover:text-primary-dark"
                      }`}
                    >
                      {item}
                    </button>
                  ) : (
                    <span
                      key={item}
                      className="px-1 text-sm text-muted-foreground"
                      aria-hidden="true"
                    >
                      …
                    </span>
                  ),
                )}
                <button
                  type="button"
                  onClick={() => setPagina(paginaAtual + 1)}
                  disabled={paginaAtual === totalPaginas}
                  className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary-soft hover:text-primary-dark disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border disabled:hover:bg-transparent disabled:hover:text-foreground"
                >
                  Próxima
                </button>
              </nav>
            )}
          </div>
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
                  <button
                    type="button"
                    className={btnPrimary}
                    onClick={() => setDevolucaoParaExcluir(null)}
                  >
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
                    <p>
                      <strong>Devolução:</strong> {devolucaoParaExcluir.identificador}
                    </p>
                    <p>
                      <strong>RM:</strong> {devolucaoParaExcluir.rm ?? "—"}
                    </p>
                    <p>
                      <strong>Status:</strong> {statusLabels[devolucaoParaExcluir.status]}
                    </p>
                    <p>
                      <strong>Criado em:</strong> {formatarDataHora(devolucaoParaExcluir.criadoEm)}
                    </p>
                    <p>
                      <strong>Criado por:</strong> {devolucaoParaExcluir.criadoPor}
                    </p>
                    <p><strong>Itens:</strong> {devolucaoParaExcluir.quantidadeItens}</p>
                    <p><strong>Quantidade total:</strong> {devolucaoParaExcluir.quantidadeTotal}</p>
                  </div>
                )}
                <p className="text-sm text-destructive">Essa ação não poderá ser desfeita.</p>
                {erroExclusao && (
                  <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                    Não foi possível excluir a devolução: {erroExclusao}
                  </p>
                )}
                <DialogFooter>
                  <button
                    type="button"
                    className={btnGhost}
                    onClick={() => setDevolucaoParaExcluir(null)}
                    disabled={excluindo}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className={btnPrimary}
                    onClick={() => void confirmarExclusao()}
                    disabled={excluindo}
                  >
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

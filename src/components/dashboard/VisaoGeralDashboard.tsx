import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Eye,
  FileSpreadsheet,
  Hash,
  PackageSearch,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Panel } from "@/components/ui-kit/PageSection";
import { Skeleton } from "@/components/ui/skeleton";
import {
  buscarDadosDashboard,
  type DashboardDevolucao,
  type DashboardStatus,
} from "@/lib/dashboard";

type Periodo = "hoje" | "7dias" | "30dias" | "90dias" | "ano" | "personalizado";
type Icone = typeof ClipboardList;

const statusInfo: {
  status: DashboardStatus;
  label: string;
  cor: string;
  fundo: string;
  Icon: Icone;
}[] = [
  {
    status: "em_montagem",
    label: "Em montagem",
    cor: "bg-amber-500",
    fundo: "bg-amber-500/10",
    Icon: ClipboardList,
  },
  {
    status: "csv_gerado",
    label: "CSV gerado",
    cor: "bg-sky-500",
    fundo: "bg-sky-500/10",
    Icon: FileSpreadsheet,
  },
  {
    status: "rm_vinculada",
    label: "RM vinculada",
    cor: "bg-emerald-500",
    fundo: "bg-emerald-500/10",
    Icon: Hash,
  },
  {
    status: "finalizada",
    label: "Finalizada",
    cor: "bg-[#32BF78]",
    fundo: "bg-[#32BF78]/10",
    Icon: CheckCircle2,
  },
];

const inputClass =
  "rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/25";
const DEVOLUCOES_VAZIAS: DashboardDevolucao[] = [];

function chaveData(data: Date) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}

function dataLocal(valor: string) {
  const [ano = 0, mes = 1, dia = 1] = valor.split("-").map(Number);
  return new Date(ano, mes - 1, dia);
}

function deslocarDias(data: Date, quantidade: number) {
  const resultado = new Date(data);
  resultado.setDate(resultado.getDate() + quantidade);
  return resultado;
}

function limitesPeriodo(periodo: Periodo, dataInicial: string, dataFinal: string) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  let inicio: Date;
  let fim: Date;

  if (periodo === "personalizado") {
    if (!dataInicial || !dataFinal) return null;
    inicio = dataLocal(dataInicial);
    fim = dataLocal(dataFinal);
    if (inicio > fim) return null;
  } else {
    fim = hoje;
    if (periodo === "hoje") inicio = hoje;
    else if (periodo === "7dias") inicio = deslocarDias(hoje, -6);
    else if (periodo === "30dias") inicio = deslocarDias(hoje, -29);
    else if (periodo === "90dias") inicio = deslocarDias(hoje, -89);
    else inicio = new Date(hoje.getFullYear(), 0, 1);
  }

  const fimExclusivo = deslocarDias(fim, 1);
  return {
    inicio,
    fimExclusivo,
    dias: Math.round((fimExclusivo.getTime() - inicio.getTime()) / 86_400_000),
  };
}

function formatarDuracao(milissegundos: number) {
  const minutosTotais = Math.floor(milissegundos / 60_000);
  const dias = Math.floor(minutosTotais / 1440);
  const horas = Math.floor((minutosTotais % 1440) / 60);
  const minutos = minutosTotais % 60;
  if (dias > 0) return `${dias}d ${horas}h`;
  if (horas > 0) return `${horas}h ${minutos}min`;
  return `${minutos}min`;
}

function labelStatus(status: DashboardStatus) {
  return statusInfo.find((item) => item.status === status)?.label ?? status;
}

function criarSerie(
  devolucoes: DashboardDevolucao[],
  inicio: Date,
  fimExclusivo: Date,
  dias: number,
) {
  const mensal = dias > 31;
  const buckets = new Map<string, { label: string; devolucoes: number }>();
  const cursor = mensal ? new Date(inicio.getFullYear(), inicio.getMonth(), 1) : new Date(inicio);
  const fim = mensal
    ? new Date(fimExclusivo.getFullYear(), fimExclusivo.getMonth(), 1)
    : fimExclusivo;
  const formatador = new Intl.DateTimeFormat(
    "pt-BR",
    mensal ? { month: "short", year: "2-digit" } : { day: "2-digit", month: "short" },
  );

  while (cursor < fim) {
    const chave = mensal ? `${cursor.getFullYear()}-${cursor.getMonth()}` : chaveData(cursor);
    buckets.set(chave, { label: formatador.format(cursor).replace(".", ""), devolucoes: 0 });
    if (mensal) cursor.setMonth(cursor.getMonth() + 1);
    else cursor.setDate(cursor.getDate() + 1);
  }

  for (const devolucao of devolucoes) {
    const data = new Date(devolucao.criadoEm);
    if (!Number.isFinite(data.getTime())) continue;
    const chave = mensal ? `${data.getFullYear()}-${data.getMonth()}` : chaveData(data);
    const bucket = buckets.get(chave);
    if (bucket) bucket.devolucoes += 1;
  }
  return [...buckets.values()];
}

function CartaoIndicador({
  label,
  value,
  hint,
  Icon,
  carregando,
}: {
  label: string;
  value: number | string;
  hint: string;
  Icon: Icone;
  carregando: boolean;
}) {
  return (
    <div className="surface-card flex min-h-[132px] items-start justify-between gap-4 p-5">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {carregando ? (
          <Skeleton className="mt-3 h-9 w-20" />
        ) : (
          <p className="mt-2 text-3xl font-bold tabular-nums text-foreground">{value}</p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </div>
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-dark">
        <Icon className="h-5 w-5" />
      </div>
    </div>
  );
}

function EstadoGrafico({
  carregando,
  vazio,
  texto,
}: {
  carregando: boolean;
  vazio: boolean;
  texto: string;
}) {
  if (carregando) return <Skeleton className="h-56 w-full" />;
  if (vazio) {
    return (
      <div className="flex h-56 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
        <PackageSearch className="h-6 w-6" />
        <span>{texto}</span>
      </div>
    );
  }
  return null;
}

export function VisaoGeralDashboard({ onAbrir }: { onAbrir: (id: string) => void }) {
  const [periodo, setPeriodo] = useState<Periodo>("30dias");
  const [dataInicial, setDataInicial] = useState(() => chaveData(deslocarDias(new Date(), -29)));
  const [dataFinal, setDataFinal] = useState(() => chaveData(new Date()));
  const [dados, setDados] = useState<Awaited<ReturnType<typeof buscarDadosDashboard>> | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const limites = useMemo(
    () => limitesPeriodo(periodo, dataInicial, dataFinal),
    [periodo, dataInicial, dataFinal],
  );

  useEffect(() => {
    if (!limites) {
      setDados(null);
      setCarregando(false);
      setErro(false);
      return;
    }
    let ativo = true;
    setCarregando(true);
    setErro(false);
    void buscarDadosDashboard(limites.inicio, limites.fimExclusivo)
      .then((resultado) => {
        if (ativo) setDados(resultado);
      })
      .catch(() => {
        if (!ativo) return;
        setDados(null);
        setErro(true);
        toast.error("Não foi possível carregar os dados do dashboard.");
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [limites]);

  const devolucoes = dados?.devolucoes ?? DEVOLUCOES_VAZIAS;
  const contagens = useMemo(
    () =>
      Object.fromEntries(
        statusInfo.map(({ status }) => [
          status,
          devolucoes.filter((d) => d.status === status).length,
        ]),
      ) as Record<DashboardStatus, number>,
    [devolucoes],
  );
  const serie = useMemo(
    () =>
      limites ? criarSerie(devolucoes, limites.inicio, limites.fimExclusivo, limites.dias) : [],
    [devolucoes, limites],
  );
  const mediaFinalizacao = useMemo(() => {
    const duracoes = devolucoes
      .filter((d) => d.status === "finalizada" && d.finalizadoEm)
      .map((d) => new Date(d.finalizadoEm!).getTime() - new Date(d.criadoEm).getTime())
      .filter((duracao) => Number.isFinite(duracao) && duracao >= 0);
    if (duracoes.length === 0) return "—";
    return formatarDuracao(
      duracoes.reduce((total, duracao) => total + duracao, 0) / duracoes.length,
    );
  }, [devolucoes]);
  const recentes = devolucoes.slice(0, 5);
  const totalStatus = statusInfo.reduce((total, item) => total + contagens[item.status], 0);
  const maxStatus = Math.max(1, ...statusInfo.map((item) => contagens[item.status]));
  const semDevolucoes = !carregando && !erro && Boolean(dados) && devolucoes.length === 0;

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <Panel bodyClassName="p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Acompanhamento
            </p>
            <h2 className="mt-1 text-base font-semibold text-foreground">
              Indicadores operacionais
            </h2>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <label
              htmlFor="periodo-dashboard"
              className="flex items-center gap-2 text-xs font-semibold text-foreground"
            >
              <CalendarDays className="h-4 w-4 text-primary-dark" /> Período
            </label>
            <select
              id="periodo-dashboard"
              className={`${inputClass} w-full sm:w-52`}
              value={periodo}
              onChange={(event) => setPeriodo(event.target.value as Periodo)}
            >
              <option value="hoje">Hoje</option>
              <option value="7dias">Últimos 7 dias</option>
              <option value="30dias">Últimos 30 dias</option>
              <option value="90dias">Últimos 90 dias</option>
              <option value="ano">Este ano</option>
              <option value="personalizado">Personalizado</option>
            </select>
          </div>
        </div>
        {periodo === "personalizado" && (
          <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2 sm:max-w-xl">
            <label className="space-y-1.5 text-xs font-semibold text-foreground">
              Data inicial
              <input
                type="date"
                className={`${inputClass} block w-full`}
                value={dataInicial}
                onChange={(event) => setDataInicial(event.target.value)}
              />
            </label>
            <label className="space-y-1.5 text-xs font-semibold text-foreground">
              Data final
              <input
                type="date"
                className={`${inputClass} block w-full`}
                value={dataFinal}
                onChange={(event) => setDataFinal(event.target.value)}
              />
            </label>
            {dataInicial && dataFinal && dataInicial > dataFinal && (
              <p className="text-xs text-destructive sm:col-span-2">
                A data inicial deve ser anterior ou igual à data final.
              </p>
            )}
          </div>
        )}
      </Panel>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <CartaoIndicador
          label="Total de devoluções"
          value={devolucoes.length}
          hint="No período selecionado"
          Icon={RotateCcw}
          carregando={carregando}
        />
        {statusInfo.map(({ status, label, Icon }) => (
          <CartaoIndicador
            key={status}
            label={label}
            value={contagens[status]}
            hint={status === "csv_gerado" ? "Aguardando RM do ARECO" : "No período selecionado"}
            Icon={Icon}
            carregando={carregando}
          />
        ))}
      </div>

      {erro && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" /> Não foi possível carregar os dados do
          dashboard.
        </div>
      )}
      {semDevolucoes && (
        <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          Nenhuma devolução encontrada no período selecionado.
        </div>
      )}
      {!limites &&
        periodo === "personalizado" &&
        !(dataInicial && dataFinal && dataInicial > dataFinal) && (
          <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
            Selecione a data inicial e a data final para consultar o período.
          </div>
        )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Top 5 materiais mais devolvidos"
          description="Devoluções distintas em que cada material apareceu"
        >
          {carregando || (dados && dados.topMateriais.length === 0) ? (
            <EstadoGrafico
              carregando={carregando}
              vazio={!carregando}
              texto="Nenhum material encontrado neste período."
            />
          ) : (
            <div className="h-60 min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dados?.topMateriais ?? []}
                  layout="vertical"
                  margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={false}
                    stroke="var(--color-border)"
                  />
                  <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="codigo"
                    width={72}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--color-muted)" }}
                    content={({ active, payload }) => {
                      const material = payload?.[0]?.payload;
                      if (!active || !material) return null;
                      return (
                        <div className="max-w-64 rounded-md border border-border bg-card p-3 text-xs shadow-card">
                          <p className="font-bold text-foreground">{material.codigo}</p>
                          <p className="mt-1 text-muted-foreground">
                            {material.descricao || "Descrição indisponível"}
                          </p>
                          <p className="mt-2 font-semibold text-primary-dark">
                            {material.devolucoes} devoluções
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="devolucoes"
                    name="Devoluções"
                    fill="#32BF78"
                    radius={[0, 5, 5, 0]}
                    barSize={24}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <Panel
          title="Devoluções ao longo do tempo"
          description={limites && limites.dias > 31 ? "Agrupadas por mês" : "Agrupadas por dia"}
        >
          {carregando || (dados && dados.devolucoes.length === 0) ? (
            <EstadoGrafico
              carregando={carregando}
              vazio={!carregando}
              texto="Sem devoluções para exibir no período."
            />
          ) : (
            <div className="h-60 min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={serie} margin={{ top: 12, right: 12, left: -18, bottom: 2 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11 }}
                    minTickGap={16}
                  />
                  <YAxis
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip formatter={(valor) => [`${valor} devoluções`, "Criadas"]} />
                  <Line
                    type="monotone"
                    dataKey="devolucoes"
                    stroke="#32BF78"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "#32BF78" }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Status das devoluções" description={`${totalStatus} devoluções no período`}>
          {carregando ? (
            <div className="space-y-5">
              {statusInfo.map(({ status }) => (
                <Skeleton key={status} className="h-8 w-full" />
              ))}
            </div>
          ) : totalStatus === 0 ? (
            <EstadoGrafico carregando={false} vazio texto="Sem status para exibir no período." />
          ) : (
            <div className="space-y-5">
              {statusInfo.map(({ status, label, cor, fundo }) => (
                <div
                  key={status}
                  className="grid grid-cols-[112px_minmax(0,1fr)_32px] items-center gap-3 text-xs sm:grid-cols-[128px_minmax(0,1fr)_36px]"
                >
                  <span className="truncate text-muted-foreground">{label}</span>
                  <div className={`h-2.5 overflow-hidden rounded-full ${fundo}`}>
                    <div
                      className={`h-full rounded-full ${cor}`}
                      style={{ width: `${(contagens[status] / maxStatus) * 100}%` }}
                    />
                  </div>
                  <span className="text-right font-semibold tabular-nums text-foreground">
                    {contagens[status]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Pendências" description="Devoluções que ainda precisam de acompanhamento">
          {carregando ? (
            <div className="space-y-3">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-lg border border-sky-500/20 bg-sky-500/5 p-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-sky-500/10 text-sky-700">
                  <ArrowUpRight className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">Aguardando RM</p>
                  <p className="text-xs text-muted-foreground">
                    CSV gerado, aguardando retorno do ARECO
                  </p>
                </div>
                <span className="text-xl font-bold tabular-nums text-foreground">
                  {contagens.csv_gerado}
                </span>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-amber-500/10 text-amber-700">
                  <ClipboardList className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">Em montagem</p>
                  <p className="text-xs text-muted-foreground">Devoluções ainda sendo preparadas</p>
                </div>
                <span className="text-xl font-bold tabular-nums text-foreground">
                  {contagens.em_montagem}
                </span>
              </div>
            </div>
          )}
        </Panel>
      </div>

      <Panel
        title="Tempo médio de finalização"
        description="Entre a criação e a finalização das devoluções concluídas no período"
      >
        {carregando ? (
          <div className="flex justify-center py-3">
            <Skeleton className="h-10 w-32" />
          </div>
        ) : (
          <div className="flex items-center justify-center gap-3 py-1">
            <Clock3 className="h-5 w-5 text-primary-dark" />
            <span className="text-3xl font-bold tabular-nums text-foreground">
              {mediaFinalizacao}
            </span>
          </div>
        )}
      </Panel>

      <Panel
        title="Últimas devoluções"
        description="Registros mais recentes no período selecionado"
        bodyClassName="p-0"
        action={
          <Link
            to="/devolucoes"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-primary-soft hover:text-primary-dark"
          >
            Ver todas <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        }
      >
        {carregando ? (
          <div className="space-y-3 p-5">
            {[0, 1, 2, 3, 4].map((item) => (
              <Skeleton key={item} className="h-9 w-full" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3 font-semibold">Devolução</th>
                  <th className="px-5 py-3 font-semibold">Data</th>
                  <th className="px-5 py-3 font-semibold">RM</th>
                  <th className="px-5 py-3 font-semibold">Itens</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 text-right font-semibold">Ação</th>
                </tr>
              </thead>
              <tbody>
                {recentes.map((devolucao) => {
                  const estilo = statusInfo.find((item) => item.status === devolucao.status);
                  return (
                    <tr
                      key={devolucao.id}
                      className="border-b border-border/70 last:border-0 hover:bg-muted/40"
                    >
                      <td className="px-5 py-3 font-semibold text-foreground">
                        {devolucao.identificador}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {devolucao.criadoEm
                          ? new Date(devolucao.criadoEm).toLocaleDateString("pt-BR")
                          : "—"}
                      </td>
                      <td className="px-5 py-3 tabular-nums text-foreground">
                        {devolucao.rm ?? "—"}
                      </td>
                      <td className="px-5 py-3 tabular-nums text-foreground">{devolucao.itens}</td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${estilo?.fundo} ${estilo?.cor.replace("bg-", "text-")} border-current/20`}
                        >
                          {labelStatus(devolucao.status)}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => onAbrir(devolucao.id)}
                          title={
                            devolucao.status === "finalizada"
                              ? "Visualizar devolução"
                              : "Abrir devolução"
                          }
                          aria-label={`Ver devolução ${devolucao.identificador}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary-soft hover:text-primary-dark"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {recentes.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-10 text-center text-sm text-muted-foreground"
                    >
                      Nenhuma devolução encontrada no período selecionado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Hash,
  Loader2,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Panel, Field } from "@/components/ui-kit/PageSection";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { ItensDevolucaoTable } from "@/components/devolucoes/ItensDevolucaoTable";
import { VolumesEditor, somaVolumes, type VolumeRascunho } from "@/components/devolucoes/VolumesEditor";
import { baixarCsv, montarCsvAreco } from "@/lib/csv";
import {
  formatarDataHora,
  totalDevolucao,
  totalItem,
  type ItemDevolucao,
} from "@/lib/mock-data";
import { buscarMaterialPorCodigo } from "@/lib/materiais";
import {
  adicionarItem,
  atualizarItem,
  atualizarLoteItem,
  consumirSolicitacaoFocoCodigo,
  criarDevolucao,
  definirDevolucaoAtiva,
  obterDevolucaoAtivaId,
  podeEditar,
  registrarCsvGerado,
  removerItem,
  useDevolucao,
  useFocoCodigoSolicitado,
  useDevolucoes,
  vincularRm,
} from "@/lib/devolucoes-store";

export const Route = createFileRoute("/nova-devolucao")({
  validateSearch: (search: Record<string, unknown>) => ({
    id: typeof search["id"] === "string" ? (search["id"] as string) : undefined,
    ...(search["origem"] === "devolucoes" ? { origem: "devolucoes" as const } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Nova devolução | Sistema de Devoluções" },
      {
        name: "description",
        content: "Monte a devolução por volumes, gere o CSV para o ARECO e vincule o número da RM.",
      },
      { property: "og:title", content: "Nova devolução | Sistema de Devoluções" },
      {
        property: "og:description",
        content: "Monte a devolução por volumes, gere o CSV para o ARECO e vincule o número da RM.",
      },
    ],
  }),
  component: NovaDevolucao,
});

const inputClass =
  "w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/25";

const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50";
const btnGhost =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-primary-soft hover:text-primary-dark disabled:cursor-not-allowed disabled:opacity-50";

function NovaDevolucao() {
  const { id, origem } = Route.useSearch();
  const navigate = Route.useNavigate();
  const devolucoes = useDevolucoes();
  const idEmMemoria = obterDevolucaoAtivaId();
  const registroEmMemoria = devolucoes.find((d) => d.id === idEmMemoria);
  const idAtivo = id ?? (idEmMemoria && registroEmMemoria?.status !== "finalizada" ? idEmMemoria : undefined);
  const devolucao = useDevolucao(idAtivo);
  const [iniciando, setIniciando] = useState(false);

  const emAberto = devolucoes.filter((d) => d.status !== "finalizada");

  async function iniciar() {
    if (iniciando) return;
    setIniciando(true);
    try {
      const nova = await criarDevolucao();
      if (!nova) return;
      definirDevolucaoAtiva(nova.id);
      toast.success(`Devolução ${nova.identificador} iniciada`);
      void navigate({ to: "/nova-devolucao", search: { id: nova.id } });
    } finally {
      setIniciando(false);
    }
  }

  useEffect(() => {
    if (!id && idAtivo && devolucao) {
      void navigate({ to: "/nova-devolucao", search: { id: idAtivo } });
    }
  }, [devolucao, id, idAtivo, navigate]);

  useEffect(() => {
    if (devolucao && devolucao.status !== "finalizada") definirDevolucaoAtiva(devolucao.id);
  }, [devolucao]);

  if (!devolucao) {
    return (
      <AppLayout title="Nova devolução" subtitle="Inicie uma devolução para gerar o identificador interno">
        <div className="mx-auto max-w-[1400px] space-y-6">
          <Panel title="Iniciar devolução" description="O identificador interno só é criado após esta ação">
            <div className="flex flex-col items-start gap-4">
              <p className="max-w-2xl text-sm text-muted-foreground">
                Ao iniciar, o sistema cria um identificador interno no padrão <strong>DEV-AAAA-NNNNN</strong>. Em
                seguida você adiciona os materiais e volumes, gera o CSV para o ARECO e, depois, vincula o número da
                RM devolvido pelo sistema.
              </p>
              <button type="button" className={btnPrimary} onClick={() => void iniciar()} disabled={iniciando}>
                {iniciando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {iniciando ? "Salvando..." : "Iniciar nova devolução"}
              </button>
            </div>
          </Panel>

          {emAberto.length > 0 && (
            <Panel title="Devoluções em aberto" description="Retome uma devolução que ainda não foi finalizada">
              <ul className="divide-y divide-border">
                {emAberto.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-foreground">{d.identificador}</span>
                      <StatusBadge status={d.status} />
                      <span className="text-xs text-muted-foreground">
                        {d.itens.length} item(ns) · {totalDevolucao(d)} un.
                      </span>
                    </div>
                    <Link
                      to="/nova-devolucao"
                      search={{ id: d.id }}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-dark hover:underline"
                    >
                      Retomar <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={devolucao.identificador} subtitle="Montagem da devolução, exportação para o ARECO e vínculo da RM">
      <EditorDevolucao
        key={devolucao.id}
        devolucaoId={devolucao.id}
        {...(origem ? { origem } : {})}
      />
    </AppLayout>
  );
}

function EditorDevolucao({ devolucaoId, origem }: { devolucaoId: string; origem?: "devolucoes" }) {
  const devolucao = useDevolucao(devolucaoId);
  const navigate = Route.useNavigate();

  const [codigo, setCodigo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [lote, setLote] = useState("");
  const [volumes, setVolumes] = useState<VolumeRascunho[]>([{ numero: 1, quantidade: "" }]);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [erros, setErros] = useState<{ codigo?: string; lote?: string; volumes?: string }>({});
  const [materialEncontrado, setMaterialEncontrado] = useState<string | null>(null);
  const [buscandoMaterial, setBuscandoMaterial] = useState(false);
  const [rmInput, setRmInput] = useState("");
  const [acaoSalvando, setAcaoSalvando] = useState<string | null>(null);
  const codigoInputRef = useRef<HTMLInputElement>(null);
  const formularioRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef(new Map<string, HTMLTableRowElement>());
  const [focarCodigo, setFocarCodigo] = useState(false);
  const [itemParaRolarId, setItemParaRolarId] = useState<string | null>(null);
  const [codigoSaiuCampo, setCodigoSaiuCampo] = useState(false);
  const [itensDuplicados, setItensDuplicados] = useState<ItemDevolucao[]>([]);
  const focoCodigoSolicitado = useFocoCodigoSolicitado();

  useEffect(() => {
    if (!focarCodigo) return;
    codigoInputRef.current?.focus();
    setFocarCodigo(false);
  }, [focarCodigo]);

  useEffect(() => {
    if (!focoCodigoSolicitado || !devolucao) return;
    codigoInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    codigoInputRef.current?.focus({ preventScroll: true });
    consumirSolicitacaoFocoCodigo();
  }, [devolucao, focoCodigoSolicitado]);

  useEffect(() => {
    if (!editandoId) return;
    formularioRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [editandoId]);

  useEffect(() => {
    if (!itemParaRolarId) return;
    const item = itemRefs.current.get(itemParaRolarId);
    if (!item) return;
    item.scrollIntoView({ behavior: "smooth", block: "center" });
    setItemParaRolarId(null);
  }, [devolucao, itemParaRolarId]);

  // Descrição vem sempre da tabela real public.materiais (código tratado como TEXTO).
  useEffect(() => {
    const alvo = codigo.trim();
    setCodigoSaiuCampo(false);
    if (!alvo) {
      setDescricao("");
      setMaterialEncontrado(null);
      return;
    }
    let vivo = true;
    setBuscandoMaterial(true);
    const timer = setTimeout(() => {
      buscarMaterialPorCodigo(alvo)
        .then((material) => {
          if (!vivo) return;
          setMaterialEncontrado(material ? material.codigo : null);
          setDescricao(material?.descricao ?? "");
          setErros((atual) => {
            const { codigo: _antigo, ...resto } = atual;
            return material ? resto : { ...resto, codigo: "Código não encontrado no catálogo de materiais." };
          });
        })
        .catch((e: unknown) => {
          if (!vivo) return;
          setMaterialEncontrado(null);
          setDescricao("");
          toast.error(`Falha ao consultar materiais: ${e instanceof Error ? e.message : String(e)}`);
        })
        .finally(() => {
          if (vivo) setBuscandoMaterial(false);
        });
    }, 300);
    return () => {
      vivo = false;
      clearTimeout(timer);
    };
  }, [codigo]);

  useEffect(() => {
    if (!codigoSaiuCampo || buscandoMaterial || !materialEncontrado || !devolucao) return;
    const duplicado = devolucao.itens.find(
      (item) => item.id !== editandoId && item.materialCodigo === materialEncontrado,
    );
    setCodigoSaiuCampo(false);
    if (duplicado) setItensDuplicados(devolucao.itens.filter((item) => item.id !== editandoId && item.materialCodigo === materialEncontrado));
  }, [buscandoMaterial, codigoSaiuCampo, devolucao, editandoId, materialEncontrado]);

  const editavel = devolucao ? podeEditar(devolucao) : false;
  const total = useMemo(() => (devolucao ? totalDevolucao(devolucao) : 0), [devolucao]);

  if (!devolucao) return null;

  function limpar() {
    setCodigo("");
    setMaterialEncontrado(null);
    setLote("");
    setVolumes([{ numero: 1, quantidade: "" }]);
    setEditandoId(null);
    setErros({});
  }

  function carregarItem(item: ItemDevolucao) {
    setItensDuplicados([]);
    setEditandoId(item.id);
    setCodigo(item.materialCodigo);
    setLote(item.lote);
    setVolumes(item.volumes.map((v) => ({ numero: v.numero, quantidade: String(v.quantidade) })));
    setErros({});
  }

  function manterItemSeparado() {
    setItensDuplicados([]);
  }

  function editarItemExistente(item: ItemDevolucao) {
    carregarItem(item);
  }

  async function salvarItem() {
    if (acaoSalvando) return;
    const proximosErros: typeof erros = {};
    if (!codigo.trim()) proximosErros.codigo = "Informe o código do material.";
    else if (buscandoMaterial) proximosErros.codigo = "Aguarde a consulta do material.";
    else if (!materialEncontrado) proximosErros.codigo = "Código não encontrado no catálogo de materiais.";
    if (!lote.trim()) proximosErros.lote = "Informe o lote.";
    if (somaVolumes(volumes) <= 0) proximosErros.volumes = "Informe ao menos um volume com quantidade maior que zero.";
    setErros(proximosErros);
    if (Object.keys(proximosErros).length > 0) return;

    const dados = {
      materialCodigo: materialEncontrado ?? codigo.trim(),
      lote: lote.trim(),
      volumes: volumes
        .map((v) => ({ numero: v.numero, quantidade: Number(v.quantidade) }))
        .filter((v) => Number.isFinite(v.quantidade) && v.quantidade > 0),
    };

    const eraAdicao = !editandoId;
    const itemEditadoId = editandoId;
    const acao = eraAdicao ? "adicionar" : "item";
    setAcaoSalvando(acao);
    try {
      const ok = editandoId
        ? await atualizarItem(devolucaoId, editandoId, dados)
        : await adicionarItem(devolucaoId, dados);
      if (!ok) return;
      toast.success(editandoId ? "Item atualizado" : "Item adicionado");
      limpar();
      if (eraAdicao) setFocarCodigo(true);
      else if (itemEditadoId) setItemParaRolarId(itemEditadoId);
    } finally {
      setAcaoSalvando(null);
    }
  }

  async function gerarCsv() {
    if (acaoSalvando) return;
    if (devolucao!.itens.length === 0) {
      toast.error("Adicione ao menos um item antes de gerar o CSV.");
      return;
    }
    setAcaoSalvando("csv");
    try {
      baixarCsv(`${devolucao!.identificador}.csv`, montarCsvAreco(devolucao!));
      const ok = await registrarCsvGerado(devolucaoId);
      if (ok) toast.success("CSV gerado para importação no ARECO");
    } finally {
      setAcaoSalvando(null);
    }
  }

  async function salvarRm() {
    if (acaoSalvando) return;
    const valor = rmInput.trim();
    if (!valor) {
      toast.error("Informe o número da RM gerado pelo ARECO.");
      return;
    }
    setAcaoSalvando("rm");
    try {
      const ok = await vincularRm(devolucaoId, valor);
      if (!ok) return;
      setRmInput("");
      toast.success(`RM ${valor} vinculada à devolução`);
    } finally {
      setAcaoSalvando(null);
    }
  }

  async function salvarLote(item: ItemDevolucao, novoLote: string) {
    return atualizarLoteItem(item.id, novoLote);
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <button
        type="button"
        className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        onClick={() => {
          definirDevolucaoAtiva(null);
          void navigate({ to: origem === "devolucoes" ? "/devolucoes" : "/nova-devolucao" });
        }}
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>
      {/* Cabeçalho da devolução */}
      <Panel bodyClassName="p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-lg font-bold text-foreground">{devolucao.identificador}</span>
              <StatusBadge status={devolucao.status} />
              {devolucao.csvDesatualizado && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-warning/40 bg-warning/15 px-2.5 py-1 text-[11px] font-semibold text-warning-foreground">
                  <AlertTriangle className="h-3.5 w-3.5" /> CSV desatualizado
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Criada por {devolucao.criadoPor} em {formatarDataHora(devolucao.criadoEm)}
              {devolucao.alteradoEm && ` · última alteração em ${formatarDataHora(devolucao.alteradoEm)}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-sm">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">RM</p>
              <p className="font-semibold text-foreground">{devolucao.rm ?? "Pendente"}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Itens</p>
              <p className="font-semibold tabular-nums text-foreground">{devolucao.itens.length}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Qtd. total</p>
              <p className="font-semibold tabular-nums text-foreground">{total}</p>
            </div>
          </div>
        </div>
      </Panel>

      {!editavel && (
        <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary-soft px-4 py-3 text-sm text-primary-dark">
          <CheckCircle2 className="h-4 w-4" /> Devolução finalizada — os dados estão bloqueados para edição.
        </div>
      )}

      {editavel && (
        <div ref={formularioRef}>
          <Panel
            title={editandoId ? "Editar item" : "Adicionar item"}
            description="A descrição é preenchida automaticamente a partir do código do material"
          >
            <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <Field label="Código do material" error={erros.codigo}>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    ref={codigoInputRef}
                    className={`${inputClass} pl-9`}
                    placeholder="Ex.: 123456"
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value)}
                    onBlur={() => setCodigoSaiuCampo(true)}
                  />
                </div>
              </Field>
              <Field label="Descrição" hint="Preenchida automaticamente">
                <input className={`${inputClass} bg-muted/60`} value={descricao} readOnly placeholder="—" />
              </Field>
              <Field label="Lote" error={erros.lote} hint="Alterar apenas o lote não invalida o CSV já gerado">
                <input
                  className={inputClass}
                  placeholder="Ex.: 094691"
                  value={lote}
                  onChange={(e) => setLote(e.target.value)}
                />
              </Field>
            </div>

            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <VolumesEditor volumes={volumes} onChange={setVolumes} erro={erros.volumes} />
            </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3 border-t border-border pt-5">
            <button
              type="button"
              className={btnPrimary}
              onClick={() => void salvarItem()}
              disabled={acaoSalvando !== null}
            >
              {acaoSalvando === "item" || acaoSalvando === "adicionar" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {acaoSalvando === "item" || acaoSalvando === "adicionar"
                ? "Salvando..."
                : editandoId
                  ? "Salvar alterações"
                  : "Adicionar item"}
            </button>
            {editandoId && (
              <button type="button" className={btnGhost} onClick={limpar} disabled={acaoSalvando !== null}>
                <X className="h-4 w-4" /> Cancelar edição
              </button>
            )}
            </div>
          </Panel>
        </div>
      )}

      <Panel title="Itens da devolução" description="Quantidade total calculada pela soma dos volumes" bodyClassName="p-0">
        <ItensDevolucaoTable
          itens={devolucao.itens}
          readOnly={!editavel}
          onEdit={carregarItem}
          onItemRef={(id, element) => {
            if (element) itemRefs.current.set(id, element);
            else itemRefs.current.delete(id);
          }}
          onSaveLote={salvarLote}
          onRemove={async (item) => {
            const ok = await removerItem(devolucaoId, item.id);
            if (!ok) return;
            if (editandoId === item.id) limpar();
            toast.success("Item removido");
          }}
        />
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Exportação para o ARECO" description="Arquivo CSV com Código e Quantidade total">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              O CSV contém apenas <strong>Codigo;Quantidade</strong>. Lote e volumes permanecem somente no sistema.
            </p>
            <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
              Último CSV: <strong className="text-foreground">{formatarDataHora(devolucao.csvGeradoEm)}</strong>
              {devolucao.csvDesatualizado && (
                <span className="ml-2 font-semibold text-warning-foreground">· dados alterados desde a geração</span>
              )}
            </div>
            <button
              type="button"
              className={btnPrimary}
              onClick={() => void gerarCsv()}
              disabled={!editavel || acaoSalvando !== null}
            >
              {acaoSalvando === "csv" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4" />
              )}
              {acaoSalvando === "csv"
                ? "Salvando..."
                : devolucao.csvGeradoEm
                  ? "Gerar CSV novamente"
                  : "Gerar CSV para o ARECO"}
            </button>
          </div>
        </Panel>

        <Panel title="Número da RM" description="Informe a RM gerada pelo ARECO após a importação do CSV">
          <div className="space-y-4">
            {devolucao.rm ? (
              <div className="rounded-lg border border-primary/30 bg-primary-soft px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-primary-dark">RM vinculada</p>
                <p className="text-lg font-bold text-primary-dark">{devolucao.rm}</p>
                <p className="text-xs text-primary-dark/80">
                  {devolucao.rmVinculadaPor} · {formatarDataHora(devolucao.rmVinculadaEm)}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                O relatório final só fica disponível depois que a RM for vinculada.
              </p>
            )}

            {editavel && (
              <div className="flex flex-wrap items-end gap-3">
                <Field label={devolucao.rm ? "Corrigir RM" : "Número da RM"} className="min-w-[200px] flex-1">
                  <input
                    className={inputClass}
                    placeholder="Ex.: 109758"
                    value={rmInput}
                    onChange={(e) => setRmInput(e.target.value)}
                  />
                </Field>
                <button
                  type="button"
                  className={btnGhost}
                  onClick={() => void salvarRm()}
                  disabled={acaoSalvando !== null}
                >
                  {acaoSalvando === "rm" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Hash className="h-4 w-4" />
                  )}
                  {acaoSalvando === "rm" ? "Salvando..." : "Vincular RM"}
                </button>
              </div>
            )}

            <button
              type="button"
              className={btnPrimary}
              disabled={!devolucao.rm}
              onClick={() => void navigate({ to: "/relatorios", search: { id: devolucao.id } })}
            >
              <FileText className="h-4 w-4" /> Ir para o relatório final
            </button>
          </div>
        </Panel>
      </div>

      <Dialog open={itensDuplicados.length > 0} onOpenChange={(aberto) => !aberto && manterItemSeparado()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Material já cadastrado</DialogTitle>
            <DialogDescription>Este item já existe na sua lista. O que deseja fazer?</DialogDescription>
          </DialogHeader>
          <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
            {itensDuplicados.map((item) => (
              <div key={item.id} className="space-y-3 rounded-lg border border-border bg-muted/30 p-4 text-sm">
                <div className="grid gap-1 sm:grid-cols-2">
                  <p>
                    <span className="font-semibold text-foreground">Código:</span> {item.materialCodigo}
                  </p>
                  <p className="sm:col-span-2">
                    <span className="font-semibold text-foreground">Descrição:</span> {item.descricao}
                  </p>
                  <p>
                    <span className="font-semibold text-foreground">Lote:</span> {item.lote}
                  </p>
                  <p>
                    <span className="font-semibold text-foreground">Quantidade total:</span> {totalItem(item)}
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-foreground">Volumes:</p>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
                    {item.volumes.map((volume) => (
                      <span key={volume.id}>
                        Volume {volume.numero}: {volume.quantidade}
                      </span>
                    ))}
                  </div>
                </div>
                <button type="button" className={btnPrimary} onClick={() => editarItemExistente(item)}>
                  Adicionar ao item existente
                </button>
              </div>
            ))}
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <button type="button" className={btnGhost} onClick={manterItemSeparado}>
              Adicionar separadamente
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

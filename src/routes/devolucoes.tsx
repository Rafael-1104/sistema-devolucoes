import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Panel, Field } from "@/components/ui-kit/PageSection";
import { DevolucoesTable } from "@/components/devolucoes/DevolucoesTable";
import { useDevolucoes } from "@/lib/devolucoes-store";
import { statusLabels, type DevolucaoStatus } from "@/lib/mock-data";
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

function Devolucoes() {
  const devolucoes = useDevolucoes();
  const { usuarios } = useUsuarios();
  const navigate = Route.useNavigate();

  const [busca, setBusca] = useState("");
  const [usuario, setUsuario] = useState("todos");
  const [status, setStatus] = useState("todos");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");

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
          />
        </Panel>
      </div>
    </AppLayout>
  );
}

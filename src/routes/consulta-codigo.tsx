import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search, Eraser, Loader2, Copy, Check } from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { Panel, Field } from "@/components/ui-kit/PageSection";
import { buscarMateriaisPorDescricao, type Material } from "@/lib/materiais";

export const Route = createFileRoute("/consulta-codigo")({
  head: () => ({
    meta: [
      { title: "Consulta de Código | Sistema de Devoluções" },
      {
        name: "description",
        content: "Consulte códigos de materiais pesquisando por palavras da descrição.",
      },
      { property: "og:title", content: "Consulta de Código | Sistema de Devoluções" },
      {
        property: "og:description",
        content: "Consulte códigos de materiais pesquisando por palavras da descrição.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConsultaCodigo,
});

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary";

function ConsultaCodigo() {
  const [palavra1, setPalavra1] = useState("");
  const [palavra2, setPalavra2] = useState("");
  const [resultados, setResultados] = useState<Material[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const termo1 = palavra1.trim();
  const termo2 = palavra2.trim();
  const temBusca = termo1.length > 0 || termo2.length > 0;

  useEffect(() => {
    if (!temBusca) {
      setResultados([]);
      setErro(null);
      setCarregando(false);
      return;
    }

    let ativo = true;
    setCarregando(true);
    const timer = setTimeout(() => {
      buscarMateriaisPorDescricao([termo1, termo2])
        .then((lista) => {
          if (!ativo) return;
          setResultados(lista);
          setErro(null);
        })
        .catch((e: unknown) => {
          if (!ativo) return;
          setResultados([]);
          setErro(e instanceof Error ? e.message : "Não foi possível consultar os materiais.");
        })
        .finally(() => {
          if (ativo) setCarregando(false);
        });
    }, 300);

    return () => {
      ativo = false;
      clearTimeout(timer);
    };
  }, [termo1, termo2, temBusca]);

  return (
    <AppLayout
      title="Consulta de Código"
      subtitle="Consulte códigos de materiais pesquisando por palavras da descrição."
    >
      <div className="mx-auto max-w-[1200px] space-y-5">
        <Panel title="Pesquisar material" description="A descrição deve conter todas as palavras informadas.">
          <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <Field label="Palavra 1">
              <input
                className={inputClass}
                value={palavra1}
                onChange={(e) => setPalavra1(e.target.value)}
                placeholder="Digite a primeira palavra"
              />
            </Field>
            <Field label="Palavra 2 (opcional)">
              <input
                className={inputClass}
                value={palavra2}
                onChange={(e) => setPalavra2(e.target.value)}
                placeholder="Digite uma segunda palavra para refinar"
              />
            </Field>
            <button
              type="button"
              onClick={() => {
                setPalavra1("");
                setPalavra2("");
              }}
              className="inline-flex h-[38px] items-center gap-2 rounded-lg border border-border px-4 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary-soft hover:text-primary-dark"
            >
              <Eraser className="h-4 w-4" /> Limpar filtros
            </button>
          </div>
        </Panel>

        <Panel
          title="Resultados"
          description={temBusca && !carregando ? `${resultados.length} material(is) encontrado(s)` : undefined}
          bodyClassName="p-0"
        >
          {!temBusca ? (
            <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
              <Search className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Digite uma palavra da descrição para iniciar a consulta.
              </p>
            </div>
          ) : carregando ? (
            <div className="flex items-center justify-center gap-2 px-6 py-14 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Consultando materiais...
            </div>
          ) : erro ? (
            <p className="px-6 py-10 text-center text-sm text-destructive">{erro}</p>
          ) : resultados.length === 0 ? (
            <p className="px-6 py-14 text-center text-sm text-muted-foreground">
              Nenhum material encontrado.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-6 py-3 font-semibold">Código</th>
                    <th className="px-6 py-3 font-semibold">Descrição</th>
                  </tr>
                </thead>
                <tbody>
                  {resultados.map((m) => (
                    <tr
                      key={`${m.codigo}-${m.descricao}`}
                      className="border-b border-border/70 last:border-0 hover:bg-muted/50"
                    >
                      <td className="px-6 py-3.5 font-mono font-semibold text-foreground">{m.codigo}</td>
                      <td className="px-6 py-3.5 text-muted-foreground">{m.descricao}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </AppLayout>
  );
}

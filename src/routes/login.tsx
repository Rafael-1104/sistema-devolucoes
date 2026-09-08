import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Loader2, LogIn } from "lucide-react";
import { Field } from "@/components/ui-kit/PageSection";
import { useAuth } from "@/lib/auth";


export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar | Sistema de Devoluções" },
      { name: "description", content: "Acesse o Sistema de Devoluções com seu e-mail e senha corporativos." },
      { property: "og:title", content: "Entrar | Sistema de Devoluções" },
      { property: "og:description", content: "Acesse o Sistema de Devoluções com seu e-mail e senha corporativos." },
    ],
  }),
  ssr: false,
  component: Login,
});

const inputClass =
  "w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/25";

function Login() {
  const { entrar, sessao, carregando } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!carregando && sessao) void navigate({ to: "/" });
  }, [carregando, sessao, navigate]);

  async function submeter(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    const { erro: falha } = await entrar(email, senha);
    setEnviando(false);
    if (falha) {
      setErro(falha === "Invalid login credentials" ? "E-mail ou senha inválidos." : falha);
      return;
    }
    void navigate({ to: "/" });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-soft">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <img
            src="/android-chrome-192x192.png"
            alt="Sistema de Devoluções"
            className="h-16 w-16 rounded-xl object-contain"
          />
          <div>
            <h1 className="text-lg font-bold text-foreground">Sistema de Devoluções</h1>
            <p className="text-xs text-muted-foreground">Controle interno de devolução de materiais</p>
          </div>
        </div>

        <form className="space-y-4" onSubmit={(e) => void submeter(e)}>
          <Field label="E-mail">
            <input
              type="email"
              autoComplete="email"
              required
              className={inputClass}
              placeholder="voce@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="Senha">
            <input
              type="password"
              autoComplete="current-password"
              required
              className={inputClass}
              placeholder="••••••••"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
          </Field>

          {erro && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
              {erro}
            </p>
          )}

          <button
            type="submit"
            disabled={enviando}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />} Entrar
          </button>
        </form>
      </div>
    </main>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import {
  Activity,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  PackageCheck,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar | Sistema de Devoluções" },
      {
        name: "description",
        content: "Acesse o Sistema de Devoluções com seu e-mail e senha corporativos.",
      },
      { property: "og:title", content: "Entrar | Sistema de Devoluções" },
      {
        property: "og:description",
        content: "Acesse o Sistema de Devoluções com seu e-mail e senha corporativos.",
      },
    ],
  }),
  ssr: false,
  component: Login,
});

const inputClass =
  "h-11 w-full rounded-lg border border-input bg-background pl-10 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary focus:ring-4 focus:ring-primary/10 max-md:border-white/15 max-md:bg-[#0c1515] max-md:text-white max-md:placeholder:text-slate-400";

function Login() {
  const { entrar, sessao, carregando } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!carregando && sessao) void navigate({ to: "/" });
  }, [carregando, sessao, navigate]);

  async function submeter(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const { erro: falha } = await entrar(email, senha);
      if (falha) {
        setErro(falha === "Invalid login credentials" ? "E-mail ou senha inválidos." : falha);
        return;
      }
      void navigate({ to: "/" });
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : String(falha));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="grid min-h-svh w-full bg-[#101a1a] md:min-h-dvh md:grid-cols-[1.08fr_0.92fr] md:bg-background">
      <section
        aria-label="Apresentação do Sistema de Devoluções"
        className="relative isolate hidden min-h-[112px] overflow-hidden bg-[#061b19] px-5 py-5 sm:min-h-[132px] sm:px-8 md:flex md:min-h-dvh md:flex-col md:justify-between md:px-8 md:py-9 xl:px-14 xl:py-12"
      >
        <img
          src="/login-warehouse.jpg"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover object-center [filter:saturate(.58)_brightness(.72)]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-br from-[#031714]/95 via-[#06251f]/88 to-[#071b19]/86"
        />
        <div
          aria-hidden="true"
          className="absolute -right-36 -top-20 hidden h-80 w-80 rotate-45 border border-emerald-200/[0.12] md:block"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-48 -left-40 hidden h-80 w-80 rotate-45 border border-emerald-200/[0.08] md:block"
        />

        <div className="relative z-10 flex items-center gap-3 md:items-start">
          <img
            src="/android-chrome-192x192.png"
            alt=""
            aria-hidden="true"
            className="h-11 w-11 object-contain sm:h-12 sm:w-12"
          />
          <div className="leading-tight">
            <p className="text-sm font-medium tracking-wide text-emerald-100/90">Sistema de</p>
            <p className="text-lg font-bold tracking-tight text-white">Devoluções</p>
          </div>
        </div>

        <div className="relative z-10 hidden max-w-xl md:block">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300/85">
            Controle operacional
          </p>
          <h2 className="mt-4 text-3xl font-semibold leading-[1.2] tracking-tight text-white xl:text-[2.65rem]">
            Controle e rastreabilidade de todas as{" "}
            <span className="text-[#4FD088]">devoluções</span> de materiais.
          </h2>
          <p className="mt-5 max-w-md text-sm leading-6 text-white/75 xl:text-base">
            Mais agilidade no processo, mais eficiência na operação.
          </p>
        </div>

        <div className="relative z-10 hidden grid-cols-3 gap-3 border-t border-white/15 pt-5 lg:grid xl:gap-6">
          <div className="flex items-start gap-2.5 text-emerald-50/90">
            <PackageCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
            <span className="text-[11px] leading-4">Rastreabilidade dos lotes</span>
          </div>
          <div className="flex items-start gap-2.5 text-emerald-50/90">
            <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
            <span className="text-[11px] leading-4">Segurança dos dados</span>
          </div>
          <div className="flex items-start gap-2.5 text-emerald-50/90">
            <Activity aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
            <span className="text-[11px] leading-4">Processos mais eficientes</span>
          </div>
        </div>
      </section>

      <section className="flex min-h-svh items-center justify-center bg-[#101a1a] px-5 py-8 sm:px-8 md:min-h-dvh md:bg-background md:px-8 md:py-10 lg:px-12 xl:px-16">
        <div className="relative w-full max-w-[540px] overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm max-md:border-white/10 max-md:bg-[#142020] max-md:shadow-none sm:p-8 lg:p-10">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-20 h-40 w-40 rotate-45 border border-primary/10"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-28 -right-16 h-40 w-40 rotate-45 border border-primary/10"
          />
          <div className="relative z-10">
            <img
              src="/android-chrome-192x192.png"
              alt="Sistema de Devoluções"
              className="mb-6 h-10 w-10 object-contain md:hidden"
            />
            <div className="mb-7">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary-dark dark:text-primary max-md:text-[#4FD088]">
                Bem-vindo
              </p>
              <h1 className="text-2xl font-bold tracking-tight text-foreground max-md:text-white sm:text-[1.75rem]">
                Acessar sistema
              </h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground max-md:text-slate-400">
                Informe suas credenciais para continuar.
              </p>
            </div>

            <form className="space-y-5" onSubmit={(e) => void submeter(e)}>
              <div className="space-y-2">
                <label
                  htmlFor="login-email"
                  className="block text-xs font-semibold text-foreground max-md:text-slate-200"
                >
                  E-mail
                </label>
                <div className="relative">
                  <Mail
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground max-md:text-slate-400"
                  />
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    required
                    className={inputClass}
                    placeholder="voce@empresa.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-invalid={Boolean(erro)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="login-password"
                  className="block text-xs font-semibold text-foreground max-md:text-slate-200"
                >
                  Senha
                </label>
                <div className="relative">
                  <LockKeyhole
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground max-md:text-slate-400"
                  />
                  <input
                    id="login-password"
                    type={mostrarSenha ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    className={`${inputClass} pr-12`}
                    placeholder="Digite sua senha"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    aria-invalid={Boolean(erro)}
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha((visivel) => !visivel)}
                    aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                    aria-pressed={mostrarSenha}
                    className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-md:text-slate-400"
                  >
                    {mostrarSenha ? (
                      <EyeOff aria-hidden="true" className="h-4 w-4" />
                    ) : (
                      <Eye aria-hidden="true" className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {erro && (
                <p
                  role="alert"
                  className="rounded-lg border border-destructive/25 bg-destructive/10 px-3.5 py-3 text-sm font-medium text-destructive"
                >
                  {erro}
                </p>
              )}

              <button
                type="submit"
                disabled={enviando}
                className="group inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {enviando ? (
                  <>
                    <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  <>
                    Entrar
                    <ArrowRight
                      aria-hidden="true"
                      className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                    />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 flex items-center gap-2 border-t border-border pt-5 text-xs text-muted-foreground max-md:border-white/10 max-md:text-slate-400">
              <LockKeyhole aria-hidden="true" className="h-3.5 w-3.5" />
              <span>Acesso ao sistema de controle de devoluções</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

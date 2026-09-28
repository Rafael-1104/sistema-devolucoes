import { LogOut, MoonStar, SunMedium } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";

export function Header({ title, subtitle }: { title: string; subtitle?: string | undefined }) {
  const { nomeExibicao, iniciais, perfil, usuario, sair } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const isDark = theme === "dark";

  async function sairAgora() {
    await sair();
    void navigate({ to: "/login", replace: true });
  }

  return (
    <header className="fixed inset-x-0 top-0 z-20 h-16 border-b border-border bg-card lg:left-[260px]">
      <div className="flex h-full items-center justify-between gap-4 px-5 lg:px-8">
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold text-foreground">{title}</h1>
          {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-3">
          <div
            role="group"
            aria-label="Seleção de tema"
            className="flex items-center gap-1 rounded-full border border-border bg-muted/70 p-1 shadow-sm"
          >
            <button
              type="button"
              onClick={() => setTheme("light")}
              aria-label="Ativar modo claro"
              aria-pressed={!isDark}
              title="Modo claro"
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                !isDark
                  ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <SunMedium className="h-3.5 w-3.5" />
              <span>Claro</span>
            </button>
            <button
              type="button"
              onClick={() => setTheme("dark")}
              aria-label="Ativar modo escuro"
              aria-pressed={isDark}
              title="Modo escuro"
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                isDark
                  ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <MoonStar className="h-3.5 w-3.5" />
              <span>Escuro</span>
            </button>
          </div>

          <div className="flex items-center gap-3 border-l border-border pl-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {iniciais}
            </div>
            <div className="hidden leading-tight sm:block">
              <p className="text-sm font-semibold text-foreground">{nomeExibicao}</p>
              <p className="text-xs text-muted-foreground">{perfil?.cargo ?? usuario?.email}</p>
            </div>
            <button
              type="button"
              onClick={() => void sairAgora()}
              className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

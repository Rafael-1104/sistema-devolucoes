import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  PackagePlus,
  PackageSearch,
  FileText,
  Users,
  Settings,
  Search,
  PlugZap,
  LogOut,
  History,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

type Item = { label: string; to: string; icon: LucideIcon };
type Group = { title: string; items: Item[] };

export const navGroups: Group[] = [
  {
    title: "Navegação",
    items: [{ label: "Visão geral", to: "/", icon: LayoutDashboard }],
  },
  {
    title: "Operações",
    items: [
      { label: "Nova devolução", to: "/nova-devolucao", icon: PackagePlus },
      { label: "Devoluções", to: "/devolucoes", icon: PackageSearch },
    ],
  },
  {
    title: "Consulta",
    items: [
      { label: "Consulta de Código", to: "/consulta-codigo", icon: Search },
      { label: "Histórico de Material", to: "/historico-material", icon: History },
    ],
  },
  {
    title: "Documentos",
    items: [{ label: "Relatórios", to: "/relatorios", icon: FileText }],
  },
  {
    title: "Administração",
    items: [
      { label: "Usuários", to: "/usuarios", icon: Users },
      { label: "Configurações", to: "/configuracoes", icon: Settings },
      { label: "Diagnóstico", to: "/diagnostico", icon: PlugZap },
    ],
  },
];

export function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[260px] flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-5">
        <img
          src="/android-chrome-192x192.png"
          alt="Logo do Sistema de Devoluções"
          className="h-11 w-11 shrink-0 rounded-xl object-contain"
        />
        <div className="min-w-0">
          <p className="text-[12px] font-bold uppercase leading-tight tracking-wide text-sidebar-foreground">
            Sistema de Devoluções
          </p>
          <p className="truncate text-xs text-sidebar-muted">Controle de materiais</p>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {navGroups.map((group) => (
          <div key={group.title}>
            <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-muted">
              {group.title}
            </p>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const active = pathname === item.to;
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      className={cn(
                        "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                        active
                          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-soft"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      )}
                    >
                      <item.icon className="h-[18px] w-[18px] shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-muted transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-[18px] w-[18px]" />
          Sair
        </button>
      </div>
    </aside>
  );
}

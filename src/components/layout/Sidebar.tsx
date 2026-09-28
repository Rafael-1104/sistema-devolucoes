import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  PackagePlus,
  PackageSearch,
  FileText,
  Search,
  LogOut,
  History,
  PanelLeftClose,
  PanelLeftOpen,
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
];

export function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 ease-out lg:flex",
        collapsed ? "w-[64px]" : "w-[260px]",
      )}
    >
      <div className={cn("flex items-center border-b border-sidebar-border py-4", collapsed ? "justify-center px-2" : "gap-2 px-3")}>
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-xl bg-sidebar-accent/60",
            collapsed ? "h-8 w-8" : "h-10 w-10",
          )}
        >
          <img
            src="/android-chrome-192x192.png"
            alt="Logo do Sistema de Devoluções"
            className={cn("rounded-lg object-contain", collapsed ? "h-6 w-6" : "h-9 w-9")}
          />
        </div>

        {!collapsed && (
          <div className="flex min-w-0 flex-1 items-center justify-between gap-1.5">
            <div className="min-w-0">
              <p className="whitespace-nowrap text-[11px] font-bold uppercase leading-tight tracking-wide text-sidebar-foreground">
                Sistema de Devoluções
              </p>
              <p className="truncate text-xs text-sidebar-muted">Controle de materiais</p>
            </div>

            <button
              type="button"
              aria-label="Recolher menu"
              title="Recolher menu"
              onClick={onToggle}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-sidebar-border bg-sidebar text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <PanelLeftClose className="h-[15px] w-[15px]" />
            </button>
          </div>
        )}
      </div>

      {collapsed && (
        <div className="flex justify-center border-b border-sidebar-border py-2">
          <button
            type="button"
            aria-label="Expandir menu"
            title="Expandir menu"
            onClick={onToggle}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-sidebar-border bg-sidebar text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <PanelLeftOpen className="h-[15px] w-[15px]" />
          </button>
        </div>
      )}

      <nav className={cn("flex-1 space-y-5 overflow-y-auto py-5", collapsed ? "px-1.5" : "px-3")}>
        {navGroups.map((group) => (
          <div key={group.title} className="space-y-1">
            {!collapsed && (
              <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-muted">
                {group.title}
              </p>
            )}
            <ul className={cn("space-y-1.5", collapsed && "flex flex-col items-center")}>
              {group.items.map((item) => {
                const active = pathname === item.to;
                return (
                  <li key={item.to} className={cn(collapsed && "w-full flex justify-center")}>
                    <Link
                      to={item.to}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        "group flex items-center rounded-lg transition-colors",
                        collapsed ? "h-10 w-10 justify-center px-0" : "gap-3 px-3 py-2.5 text-sm font-medium",
                        active
                          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-soft"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      )}
                    >
                      <item.icon className="h-[18px] w-[18px] shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className={cn("border-t border-sidebar-border py-3", collapsed ? "px-1.5" : "px-3")}>
        <button
          type="button"
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-muted transition-colors hover:bg-destructive/10 hover:text-destructive",
            collapsed && "h-10 w-10 justify-center px-0",
          )}
        >
          <LogOut className="h-[18px] w-[18px]" />
          {!collapsed && "Sair"}
        </button>
      </div>
    </aside>
  );
}

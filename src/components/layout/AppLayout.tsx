import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { AuthGate } from "./AuthGate";

const SIDEBAR_COLLAPSED_STORAGE_KEY = "sidebar-collapsed";

function getInitialSidebarCollapsed() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "true";
}

export function AppLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string | undefined;
  children: ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(getInitialSidebarCollapsed);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  const layoutStyle = useMemo(
    () => ({
      "--sidebar-width": sidebarCollapsed ? "64px" : "260px",
    }) as CSSProperties,
    [sidebarCollapsed],
  );

  return (
    <AuthGate>
      <div className="min-h-screen bg-background" style={layoutStyle}>
        <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((value) => !value)} />
        <Header title={title} subtitle={subtitle} />
        <div className="lg:pl-[var(--sidebar-width)]">
          <MobileNav />
          <main className="px-5 pb-12 pt-24 lg:px-8">{children}</main>
        </div>
      </div>
    </AuthGate>
  );
}

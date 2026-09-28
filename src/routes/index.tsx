import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { VisaoGeralDashboard } from "@/components/dashboard/VisaoGeralDashboard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Visão geral | Sistema de Devoluções" },
      {
        name: "description",
        content:
          "Painel com indicadores do fluxo de devolução de materiais e integração com o ARECO.",
      },
      { property: "og:title", content: "Visão geral | Sistema de Devoluções" },
      {
        property: "og:description",
        content:
          "Painel com indicadores do fluxo de devolução de materiais e integração com o ARECO.",
      },
    ],
  }),
  component: VisaoGeral,
});

function VisaoGeral() {
  const navigate = Route.useNavigate();

  return (
    <AppLayout title="Visão geral" subtitle="Resumo do fluxo de devoluções de materiais">
      <VisaoGeralDashboard
        onAbrir={(id) => void navigate({ to: "/nova-devolucao", search: { id } })}
      />
    </AppLayout>
  );
}

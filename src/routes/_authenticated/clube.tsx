import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/clube")({
  beforeLoad: () => {
    try { localStorage.setItem("gda_active_caixa", "geral"); } catch {}
    throw redirect({ to: "/caixas" });
  },
  component: () => null,
});

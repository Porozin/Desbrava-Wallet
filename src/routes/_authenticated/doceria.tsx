import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/doceria")({
  beforeLoad: () => {
    try { localStorage.setItem("gda_active_caixa", "doceria"); } catch {}
    throw redirect({ to: "/caixas" });
  },
  component: () => null,
});

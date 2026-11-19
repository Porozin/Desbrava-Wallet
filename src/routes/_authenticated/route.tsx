import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { validateSevenDaySession } from "@/lib/authSession";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // 1. Validação estrita da janela de 7 dias de persistência de sessão
    const sessionCheck = await validateSevenDaySession();
    if (sessionCheck.expired) {
      throw redirect({ to: "/auth", search: { expired: "1" } });
    }
    if (!sessionCheck.valid) {
      throw redirect({ to: "/auth" });
    }

    // 2. Tenta recuperar sessão ativa rápida
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session?.user) return;

    // 3. Se não encontrou em cache, tenta checar direto no servidor
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      throw redirect({ to: "/auth" });
    }
  },
  component: () => <Outlet />,
});


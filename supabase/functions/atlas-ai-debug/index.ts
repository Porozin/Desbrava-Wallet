// DEBUG ROUTE — temporaria, bloquear apos confirmar funcionamento
// Expoe logs completos do fluxo: auth → NVIDIA → confirmacao
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const log: Record<string, unknown> = { steps: [] as string[] };
  const steps = log.steps as string[];

  try {
    const NVIDIA_API_KEY = Deno.env.get("NVIDIA_API_KEY") ?? "";
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    log.env = {
      has_nvidia: !!NVIDIA_API_KEY,
      nvidia_prefix: NVIDIA_API_KEY.slice(0, 12),
      has_supabase_url: !!SUPABASE_URL,
      supabase_url: SUPABASE_URL,
      has_service_role: !!SUPABASE_SERVICE_ROLE_KEY,
      service_role_prefix: SUPABASE_SERVICE_ROLE_KEY.slice(0, 12),
      has_anon_key: !!SUPABASE_ANON_KEY,
      anon_key_prefix: SUPABASE_ANON_KEY.slice(0, 12),
    };
    steps.push("env_ok");

    // 1. Auth
    const authHeader = req.headers.get("authorization") ?? "";
    if (!authHeader) return Response.json({ ...log, error: "no_auth_header" }, { headers: CORS });

    const jwt = authHeader.replace(/^Bearer /, "").trim();
    log.jwt_prefix = jwt.slice(0, 20);
    steps.push("jwt_extracted");

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user }, error: authErr } = await admin.auth.getUser(jwt);
    log.auth = { ok: !authErr, user_id: user?.id ?? null, error: authErr?.message ?? null };
    if (authErr || !user) return Response.json({ ...log, error: "auth_failed" }, { headers: CORS });
    steps.push("auth_ok");

    // 2. Role
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    const role = roles?.[0]?.role ?? "desbravador";
    const isManager = ["admin", "diretor", "tesoureiro"].includes(role);
    log.role = { role, isManager };
    steps.push("role_ok");

    // 3. Parse body
    const body = await req.json();
    const { mode, confirmation_token, message } = body;
    log.request = { mode, has_confirmation_token: !!confirmation_token, message_preview: (message ?? "").slice(0, 50) };
    steps.push("body_parsed");

    // 4. Se modo confirmacao: testa supabaseAsUser + RPC diretamente
    if (mode === "confirm" && confirmation_token) {
      steps.push("mode_confirm");

      // Busca operacao pendente via admin
      const { data: op, error: opErr } = await admin
        .from("ai_pending_operations")
        .select("*")
        .eq("confirmation_token", confirmation_token)
        .eq("user_id", user.id)
        .single();

      log.pending_op = { found: !!op, error: opErr?.message ?? null, status: op?.status, type: op?.operation_type, params: op?.operation_params };
      if (!op) return Response.json({ ...log, error: "op_not_found" }, { headers: CORS });
      steps.push("op_found");

      // Testa supabaseAsUser com anonKey + JWT
      const asUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: "Bearer " + jwt } },
        auth: { persistSession: false },
      });

      // Verifica auth.uid() no contexto do usuario
      const { data: uidCheck, error: uidErr } = await asUser.rpc("fn_saldo_disponivel", { p_cash_box_id: "geral" });
      log.uid_check = { saldo_geral_cents: uidCheck, error: uidErr?.message ?? null, code: (uidErr as any)?.code ?? null };
      steps.push("uid_check_done");

      // Testa a RPC financeira diretamente
      const params = op.operation_params as Record<string, unknown>;
      const mutationId = crypto.randomUUID();
      const { data: rpcData, error: rpcErr } = await asUser.rpc("sp_registrar_transacao_oficial", {
        p_client_mutation_id: mutationId,
        p_cash_box_id: params.cash_box_id,
        p_kind: "receita",
        p_amount_cents: Math.round(parseFloat(String(params.amount)) * 100),
        p_category: params.category,
        p_description: params.description,
        p_payment_method: params.payment_method ?? "dinheiro",
        p_date: params.date ?? new Date().toISOString().slice(0, 10),
        p_seller: null,
      });

      log.rpc_result = {
        ok: !rpcErr,
        transaction_id: rpcData ?? null,
        error: rpcErr?.message ?? null,
        code: (rpcErr as any)?.code ?? null,
        details: (rpcErr as any)?.details ?? null,
        hint: (rpcErr as any)?.hint ?? null,
      };
      steps.push("rpc_done");

      return Response.json({ ...log, steps }, { headers: CORS });
    }

    // 5. Se modo nvidia: testa chamada ao modelo
    if (mode === "nvidia") {
      steps.push("mode_nvidia");

      const t0 = Date.now();
      const nvidiaRes = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + NVIDIA_API_KEY },
        body: JSON.stringify({
          model: "nvidia/nemotron-3.5-lightning-30b-a3b",
          messages: [{ role: "user", content: message ?? "qual o saldo" }],
          temperature: 0.6,
          top_p: 0.95,
          max_tokens: 256,
          chat_template_kwargs: { enable_thinking: false },
        }),
      });

      const elapsed = Date.now() - t0;
      const nvidiaData = nvidiaRes.ok ? await nvidiaRes.json() : null;
      const nvidiaErr = nvidiaRes.ok ? null : await nvidiaRes.text();

      log.nvidia = {
        status: nvidiaRes.status,
        elapsed_ms: elapsed,
        ok: nvidiaRes.ok,
        finish_reason: nvidiaData?.choices?.[0]?.finish_reason ?? null,
        content_preview: (nvidiaData?.choices?.[0]?.message?.content ?? "").slice(0, 100),
        error: nvidiaErr?.slice(0, 200) ?? null,
        usage: nvidiaData?.usage ?? null,
      };
      steps.push("nvidia_done");

      return Response.json({ ...log, steps }, { headers: CORS });
    }

    return Response.json({ ...log, steps, info: "passe mode=confirm com confirmation_token ou mode=nvidia" }, { headers: CORS });

  } catch (err: unknown) {
    const e = err as any;
    return Response.json({ ...log, fatal_error: e?.message ?? String(err), steps }, { status: 500, headers: CORS });
  }
});

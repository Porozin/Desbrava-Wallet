// Edge Function: backup-scheduler
// Agendada para rodar todo dia às 06:00 UTC (03:00 Brasília)
// Envia backup completo do Supabase para o Google Drive via Apps Script webhook.

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const GOOGLE_WEBHOOK = "https://script.google.com/macros/s/AKfycbwPNaGTuEDuvRfcfGUutYnJqFFiXE9ZVilVK30vSYC0kNtVDzbsxkYq85oPMhvEOO__/exec";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Busca todas as tabelas relevantes
    const [
      { data: transactions },
      { data: metas },
      { data: produtos },
      { data: materiais },
      { data: dividas },
      { data: avarias },
      { data: profiles },
      { data: cashBoxes },
      { data: reservations },
    ] = await Promise.all([
      admin.from("transactions").select("*").order("date", { ascending: false }),
      admin.from("metas").select("*"),
      admin.from("produtos").select("*"),
      admin.from("materiais").select("*"),
      admin.from("dividas").select("*"),
      admin.from("avarias").select("*"),
      admin.from("profiles").select("id, display_name, created_at"),
      admin.from("cash_boxes").select("*"),
      admin.from("transaction_reservations").select("*"),
    ]);

    const payload = {
      timestamp: new Date().toISOString(),
      autor: "GDA Caixa 2027 — Backup Automático (03:00 Brasília)",
      versao: "2027",
      dados: {
        transactions: transactions ?? [],
        metas: metas ?? [],
        produtos: produtos ?? [],
        materiais: materiais ?? [],
        dividas: dividas ?? [],
        avarias: avarias ?? [],
        profiles: profiles ?? [],
        cash_boxes: cashBoxes ?? [],
        reservations: reservations ?? [],
      },
      resumo: {
        total_transacoes: transactions?.length ?? 0,
        total_metas: metas?.length ?? 0,
        total_produtos: produtos?.length ?? 0,
        total_usuarios: profiles?.length ?? 0,
      },
    };

    // Envia para o webhook do Google Drive
    const googleRes = await fetch(GOOGLE_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      // redirect: "follow" necessário pois o Apps Script redireciona
      redirect: "follow",
    });

    const googleText = await googleRes.text();
    let googleData: unknown;
    try { googleData = JSON.parse(googleText); } catch { googleData = googleText; }

    console.log("[Backup] Google Drive response:", JSON.stringify(googleData));

    return Response.json({
      success: true,
      message: "Backup enviado para o Google Drive.",
      google_response: googleData,
      resumo: payload.resumo,
      timestamp: payload.timestamp,
    }, { headers: CORS });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[Backup] Erro:", msg);
    return Response.json({ success: false, error: msg }, { status: 500, headers: CORS });
  }
});

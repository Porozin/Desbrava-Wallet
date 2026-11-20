import { createClient } from "jsr:@supabase/supabase-js@2";
import { TOOLS, WRITE_TOOLS, MANAGER_TOOLS, READ_TOOLS } from "./tools.ts";

const NVIDIA_API_KEY = Deno.env.get("NVIDIA_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const NVIDIA_MODEL = "nvidia/nemotron-3.5-lightning-30b-a3b";

// ========== CORS ==========
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ========== Tipos ==========
interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface AtlasRequest {
  message: string;
  session_id: string;
  history?: ChatMessage[];
  confirmation_token?: string; // se o usuario esta confirmando uma operacao pendente
}

// ========== Helper: valor em centavos ==========
function toCents(value: string | number): number {
  const n = typeof value === "string"
    ? parseFloat(value.replace(",", "."))
    : value;
  return Math.round(n * 100);
}

// ========== Executar tool call ==========
async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>,
  supabaseAdmin: ReturnType<typeof createClient>,
  isManager: boolean,
  userId: string,
  sessionId: string,
): Promise<unknown> {

  // Verificar permissao
  if (MANAGER_TOOLS.has(toolName) && !isManager) {
    return { error: "Permissao insuficiente para esta operacao. Apenas gestores financeiros podem realizar lancamentos." };
  }

  switch (toolName) {

    case "get_saldo_consolidado": {
      const { data } = await supabase
        .from("transactions")
        .select("cash_box_id, kind, amount_cents, status, destination_cash_box_id")
        .eq("status", "confirmado");

      const boxes = ["geral", "doceria", "vendas"];
      const result: Record<string, { receitas: number; despesas: number; saldo: number }> = {};
      let totalReceitas = 0, totalDespesas = 0;

      for (const box of boxes) {
        let r = 0, d = 0;
        for (const t of (data ?? [])) {
          if (t.kind === "receita" && t.cash_box_id === box) r += t.amount_cents ?? 0;
          if (t.kind === "despesa" && t.cash_box_id === box) d += t.amount_cents ?? 0;
          if (t.kind === "transferencia" && t.cash_box_id === box) d += t.amount_cents ?? 0;
          if (t.kind === "transferencia" && t.destination_cash_box_id === box) r += t.amount_cents ?? 0;
        }
        result[box] = { receitas: r / 100, despesas: d / 100, saldo: (r - d) / 100 };
        totalReceitas += r;
        totalDespesas += d;
      }
      return {
        caixas: result,
        consolidado: {
          receitas: totalReceitas / 100,
          despesas: totalDespesas / 100,
          saldo: (totalReceitas - totalDespesas) / 100,
        },
      };
    }

    case "get_saldo_caixa": {
      const boxId = String(args.cash_box_id);
      // Usa a RPC de saldo disponivel (service_role tem acesso)
      const { data: saldoData } = await supabase.rpc("fn_saldo_disponivel", { p_cash_box_id: boxId });

      // Busca receitas e despesas do caixa
      const { data: txData } = await supabaseAdmin
        .from("transactions")
        .select("cash_box_id, destination_cash_box_id, kind, amount_cents")
        .eq("status", "confirmado");

      let receitas = 0, despesas = 0;
      for (const t of (txData ?? [])) {
        if (t.kind === "receita" && t.cash_box_id === boxId) receitas += t.amount_cents ?? 0;
        if (t.kind === "despesa" && t.cash_box_id === boxId) despesas += t.amount_cents ?? 0;
        if (t.kind === "transferencia" && t.cash_box_id === boxId) despesas += t.amount_cents ?? 0;
        if (t.kind === "transferencia" && t.destination_cash_box_id === boxId) receitas += t.amount_cents ?? 0;
      }

      return {
        cash_box_id: boxId,
        receitas: receitas / 100,
        despesas: despesas / 100,
        saldo_contabil: (receitas - despesas) / 100,
        saldo_disponivel: (saldoData ?? 0) / 100,
      };
    }

    case "get_transacoes_recentes": {
      let query = supabase
        .from("transactions")
        .select("id, date, cash_box_id, kind, amount_cents, category, description, status, seller, payment_method")
        .eq("status", "confirmado")
        .order("date", { ascending: false })
        .limit(Math.min(Number(args.limit ?? 10), 50));

      if (args.cash_box_id) query = query.eq("cash_box_id", String(args.cash_box_id));
      if (args.kind) query = query.eq("kind", String(args.kind));
      if (args.date_from) query = query.gte("date", String(args.date_from));
      if (args.date_to) query = query.lte("date", String(args.date_to));

      const { data, error } = await query;
      if (error) return { error: error.message };
      return (data ?? []).map((t) => ({
        ...t,
        amount: (t.amount_cents ?? 0) / 100,
      }));
    }

    case "get_resumo_mensal": {
      const { data } = await supabase.rpc("sp_resumo_transparencia_publica", {
        p_ano: parseInt(String(args.ano)),
        p_mes: args.mes ? parseInt(String(args.mes)) : null,
      });
      return data;
    }

    case "get_metas": {
      let query = supabase
        .from("metas")
        .select("*")
        .order("created_at", { ascending: false });

      if (args.modulo) query = query.eq("modulo", String(args.modulo));
      if (args.status) query = query.eq("status", String(args.status));

      const { data, error } = await query;
      if (error) return { error: error.message };
      return data ?? [];
    }

    case "get_produtos": {
      let query = supabase.from("produtos").select("*").order("nome");
      if (args.modulo) query = query.eq("modulo", String(args.modulo));
      const { data, error } = await query;
      if (error) return { error: error.message };
      return data ?? [];
    }

    case "get_ranking_vendedores": {
      const { data } = await supabase
        .from("transactions")
        .select("seller, amount_cents, kind")
        .eq("status", "confirmado")
        .eq("kind", "receita")
        .not("seller", "is", null);

      const map = new Map<string, number>();
      for (const t of (data ?? [])) {
        if (!t.seller) continue;
        map.set(t.seller, (map.get(t.seller) ?? 0) + (t.amount_cents ?? 0));
      }
      return Array.from(map.entries())
        .map(([seller, total_cents]) => ({
          seller,
          total_vendido: total_cents / 100,
          comissao_estimada: (total_cents * 0.10) / 100,
        }))
        .sort((a, b) => b.total_vendido - a.total_vendido);
    }

    case "get_dividas": {
      let query = supabase.from("dividas").select("*").order("data", { ascending: false });
      if (args.status) query = query.eq("status", String(args.status));
      const { data, error } = await query;
      if (error) return { error: error.message };
      return data ?? [];
    }

    case "get_materiais": {
      let query = supabase.from("materiais").select("*").order("nome");
      if (args.modulo) query = query.eq("modulo", String(args.modulo));
      const { data, error } = await query;
      if (error) return { error: error.message };
      return data ?? [];
    }

    // ===== Ferramentas de escrita: criam proposta + token =====
    case "propor_registrar_receita":
    case "propor_registrar_despesa":
    case "propor_transferencia":
    case "propor_estorno":
    case "propor_criar_meta":
    case "propor_atualizar_meta":
    case "propor_excluir_meta":
    case "propor_criar_produto":
    case "propor_atualizar_produto":
    case "propor_excluir_produto":
    case "propor_criar_insumo":
    case "propor_atualizar_insumo":
    case "propor_excluir_insumo": {
      const operationType = toolName.replace("propor_", "");
      const token = crypto.randomUUID();

      await supabase.from("ai_pending_operations").insert({
        user_id: userId,
        session_id: sessionId,
        operation_type: operationType,
        operation_params: args,
        confirmation_token: token,
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        status: "pending",
      });

      return {
        confirmation_required: true,
        confirmation_token: token,
        operation_type: operationType,
        operation_params: args,
        message: "Operacao preparada. Aguardando confirmacao do usuario.",
        expires_in_minutes: 5,
      };
    }

    default:
      return { error: `Ferramenta desconhecida: ${toolName}` };
  }
}

// ========== Executar operacao confirmada ==========
async function executeConfirmedOperation(
  token: string,
  userId: string,
  supabase: ReturnType<typeof createClient>,
  userJwt: string,
): Promise<{ success: boolean; message: string; data?: unknown }> {

  // Cliente autenticado como o usuario (auth.uid() funciona nas RPCs)
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabaseAsUser = createClient(supabaseUrl, svcKey, {
    global: { headers: { Authorization: "Bearer " + userJwt } },
    auth: { persistSession: false },
  });

  // Busca a operacao pendente
  const { data: op, error } = await supabase
    .from("ai_pending_operations")
    .select("*")
    .eq("confirmation_token", token)
    .eq("user_id", userId)
    .eq("status", "pending")
    .single();

  if (error || !op) {
    return { success: false, message: "Token de confirmacao invalido ou expirado." };
  }

  if (new Date(op.expires_at) < new Date()) {
    await supabase.from("ai_pending_operations").update({ status: "expired" }).eq("id", op.id);
    return { success: false, message: "Esta operacao expirou. Por favor, solicite novamente." };
  }

  const params = op.operation_params as Record<string, unknown>;
  const mutationId = crypto.randomUUID();
  let result: unknown;

  try {
    switch (op.operation_type) {
      case "registrar_receita": {
        const { data, error } = await supabaseAsUser.rpc("sp_registrar_transacao_oficial", {
          p_client_mutation_id: mutationId,
          p_cash_box_id: params.cash_box_id,
          p_kind: "receita",
          p_amount_cents: toCents(String(params.amount)),
          p_category: params.category,
          p_description: params.description,
          p_payment_method: params.payment_method ?? "dinheiro",
          p_date: params.date ?? new Date().toISOString().slice(0, 10),
          p_seller: null,
        });
        if (error) throw error;
        result = { transaction_id: data };
        break;
      }
      case "registrar_despesa": {
        const { data, error } = await supabaseAsUser.rpc("sp_registrar_transacao_oficial", {
          p_client_mutation_id: mutationId,
          p_cash_box_id: params.cash_box_id,
          p_kind: "despesa",
          p_amount_cents: toCents(String(params.amount)),
          p_category: params.category,
          p_description: params.description,
          p_payment_method: params.payment_method ?? "dinheiro",
          p_date: params.date ?? new Date().toISOString().slice(0, 10),
          p_seller: null,
        });
        if (error) throw error;
        result = { transaction_id: data };
        break;
      }
      case "registrar_transferencia": {
        const { data, error } = await supabaseAsUser.rpc("sp_registrar_transferencia", {
          p_client_mutation_id: mutationId,
          p_source_box: params.source_box,
          p_destination_box: params.destination_box,
          p_amount_cents: toCents(String(params.amount)),
          p_description: params.description,
        });
        if (error) throw error;
        result = { transaction_id: data };
        break;
      }
      case "estorno": {
        const { data, error } = await supabaseAsUser.rpc("sp_estornar_transacao", {
          p_transaction_id: params.transaction_id,
          p_reverse_reason: params.reverse_reason,
        });
        if (error) throw error;
        result = { compensating_transaction_id: data };
        break;
      }
      case "criar_meta": {
        const { error: e1 } = await supabaseAsUser.from("metas").insert({ modulo: params.modulo, descricao: params.descricao, valor_alvo: parseFloat(String(params.valor_alvo)), status: params.status ?? "aprovada", sugerido_por: null });
        if (e1) throw e1; result = { success: true }; break;
      }
      case "atualizar_meta": {
        const ch: Record<string,unknown> = {};
        if (params.descricao) ch.descricao = params.descricao;
        if (params.valor_alvo) ch.valor_alvo = parseFloat(String(params.valor_alvo));
        if (params.status) ch.status = params.status;
        const { error: e2 } = await supabaseAsUser.from("metas").update(ch).eq("id", params.meta_id);
        if (e2) throw e2; result = { success: true }; break;
      }
      case "excluir_meta": {
        const { error: e3 } = await supabaseAsUser.from("metas").delete().eq("id", params.meta_id);
        if (e3) throw e3; result = { success: true }; break;
      }
      case "criar_produto": {
        const { error: e4 } = await supabaseAsUser.from("produtos").insert({ nome: params.nome, preco_venda: parseFloat(String(params.preco_venda)), custo: parseFloat(String(params.custo ?? 0)), comissao: parseFloat(String(params.comissao ?? 0)), modulo: params.modulo });
        if (e4) throw e4; result = { success: true }; break;
      }
      case "atualizar_produto": {
        const cp: Record<string,unknown> = {};
        if (params.nome) cp.nome = params.nome;
        if (params.preco_venda) cp.preco_venda = parseFloat(String(params.preco_venda));
        if (params.custo) cp.custo = parseFloat(String(params.custo));
        const { error: e5 } = await supabaseAsUser.from("produtos").update(cp).eq("id", params.produto_id);
        if (e5) throw e5; result = { success: true }; break;
      }
      case "excluir_produto": {
        const { error: e6 } = await supabaseAsUser.from("produtos").delete().eq("id", params.produto_id);
        if (e6) throw e6; result = { success: true }; break;
      }
      case "criar_insumo": {
        const { error: e7 } = await supabaseAsUser.from("materiais").insert({ nome: params.nome, quantidade: parseFloat(String(params.quantidade)), custo_total: parseFloat(String(params.custo_total)), unidade_medida: String(params.unidade_medida ?? "un"), modulo: params.modulo });
        if (e7) throw e7; result = { success: true }; break;
      }
      case "atualizar_insumo": {
        const ci: Record<string,unknown> = {};
        if (params.nome) ci.nome = params.nome;
        if (params.quantidade) ci.quantidade = parseFloat(String(params.quantidade));
        if (params.custo_total) ci.custo_total = parseFloat(String(params.custo_total));
        const { error: e8 } = await supabaseAsUser.from("materiais").update(ci).eq("id", params.insumo_id);
        if (e8) throw e8; result = { success: true }; break;
      }
      case "excluir_insumo": {
        const { error: e9 } = await supabaseAsUser.from("materiais").delete().eq("id", params.insumo_id);
        if (e9) throw e9; result = { success: true }; break;
      }
      default:
        throw new Error("Tipo de operacao desconhecido: " + op.operation_type);
    }

    // Marca como confirmada
    await supabase.from("ai_pending_operations").update({
      status: "confirmed",
      executed_at: new Date().toISOString(),
    }).eq("id", op.id);

    return { success: true, message: "Operacao executada com sucesso.", data: result };

  } catch (err: unknown) {
    const sbErr = err as any;
    const msg = sbErr?.message ?? sbErr?.error_description ?? (typeof sbErr === "string" ? sbErr : "Erro desconhecido");
    const details = [sbErr?.code, sbErr?.details, sbErr?.hint].filter(Boolean).join(" | ");
    console.error("[Atlas AI] error:", JSON.stringify({ msg, details }));
    const userMsg = msg.includes("Sessao") ? "Sessao expirada, faca login novamente." : msg.includes("Saldo") ? msg : "Falha: " + msg + (details ? " (" + details + ")" : "");
    return { success: false, message: userMsg };
  }
}

// ========== System prompt ==========
function buildSystemPrompt(
  userRole: string,
  isManager: boolean,
  consolidado: Record<string, unknown> | null,
): string {
  const hoje = new Date().toLocaleDateString("pt-BR");
  const saldoStr = consolidado
    ? `Saldo consolidado atual: R$ ${(consolidado as any)?.consolidado?.saldo?.toFixed(2) ?? "N/A"}`
    : "Saldo consolidado: nao disponivel";

  const prompt = "Voce e o Atlas AI, assistente financeiro do Clube de Desbravadores Guerreiros do Alto (GDA). " +
    "Data: " + hoje + ". Cargo do usuario: " + userRole + ". " + saldoStr + " " +
    "REGRAS: 1. Responda SEMPRE em portugues brasileiro claro e direto, sem formatacao markdown (sem asteriscos, sem #, sem hifens de lista, sem backticks). " +
    "2. Para qualquer operacao que modifique dados use ferramentas propor_*. NUNCA execute escrita diretamente. " +
    "3. Apos propor operacao, apresente detalhes e aguarde confirmacao do usuario. " +
    "4. Nunca invente dados. Use ferramentas de leitura para consultar informacoes reais. " +
    "5. Valores monetarios no formato R$ X.XXX,XX. " +
    (isManager ?
      "6. Voce pode propor: lancamentos, transferencias, estornos, criar/editar/excluir metas, produtos e insumos. " :
      "6. Voce pode apenas consultar. Para operacoes de escrita e necessario cargo de gestor. ") +
    "7. NUNCA execute sp_wipe_all_data ou sp_deletar_transacao_admin.";
  return prompt;
}

// ========== Handler principal ==========
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  try {
    const authHeader = req.headers.get("authorization");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const publishableKeys = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "";
    const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS") ?? "";
    const svcKey = SUPABASE_SERVICE_ROLE_KEY;

    // DEBUG: retorna diagnostico
    const debug = {
      has_auth_header: !!authHeader,
      auth_header_prefix: authHeader ? authHeader.slice(0, 20) : null,
      supabase_url: SUPABASE_URL ? SUPABASE_URL.slice(0, 40) : "MISSING",
      has_service_role: !!svcKey,
      service_role_prefix: svcKey ? svcKey.slice(0, 15) : "MISSING",
      has_anon_key: !!anonKey,
      anon_key_prefix: anonKey ? anonKey.slice(0, 15) : "MISSING",
      has_publishable_keys: !!publishableKeys,
      publishable_keys_prefix: publishableKeys ? publishableKeys.slice(0, 15) : "MISSING",
      has_secret_keys: !!secretKeys,
      has_nvidia: !!NVIDIA_API_KEY,
      nvidia_prefix: NVIDIA_API_KEY ? NVIDIA_API_KEY.slice(0, 10) : "MISSING",
    };

    if (!authHeader) {
      return Response.json({ error: "Nao autenticado.", debug }, { status: 401, headers: CORS });
    }

    // Tenta autenticar com cada key disponivel
    const supabaseAdmin = createClient(SUPABASE_URL, svcKey);

    // Extrai JWT puro do header (remove "Bearer ")
    const jwt = authHeader.replace(/^Bearer /, "").trim();

    // Valida o JWT usando o cliente admin (service_role pode verificar qualquer token)
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(jwt);
    if (authError || !user) {
      return Response.json({ error: "Token invalido.", auth_error: authError?.message, debug }, { status: 401, headers: CORS });
    }

    // 3. Busca o papel do usuario
    const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", user.id);
    const userRole = roles?.[0]?.role ?? "desbravador";
    const isManager = ["admin", "diretor", "tesoureiro"].includes(userRole);

    // 4. Parse do corpo da requisicao
    const body: AtlasRequest = await req.json();
    const { message, session_id, history = [], confirmation_token } = body;

    // 5. Se e uma confirmacao de operacao pendente
    if (confirmation_token) {
      const result = await executeConfirmedOperation(confirmation_token, user.id, supabaseAdmin, jwt);

      // Salva no historico
      await supabaseAdmin.from("ai_conversations").insert([
        { user_id: user.id, session_id, role: "user", content: "[Confirmacao de operacao]" },
        {
          user_id: user.id,
          session_id,
          role: "assistant",
          content: result.success
            ? `Operacao executada com sucesso! ${JSON.stringify(result.data)}`
            : `Falha: ${result.message}`,
        },
      ]);

      return Response.json(result, { headers: CORS });
    }

    // 6. Busca saldo consolidado para o contexto (silencioso se falhar)
    let consolidado: Record<string, unknown> | null = null;
    try {
      const { data } = await supabaseAdmin.rpc("sp_resumo_transparencia_publica", {
        p_ano: new Date().getFullYear(),
        p_mes: null,
      });
      consolidado = data;
    } catch { /* silencioso */ }

    // 7. Monta o payload OpenAI (NVIDIA NIM)
    const systemPrompt = buildSystemPrompt(userRole, isManager, consolidado);
    const allowedTools = TOOLS.filter((t) => {
      if (READ_TOOLS.has(t.name)) return true;
      if (MANAGER_TOOLS.has(t.name)) return isManager;
      return false;
    });
    const openaiTools = allowedTools.map((t) => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));
    const messages = [
      { role: "system", content: buildSystemPrompt(userRole, isManager, consolidado) },
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: message },
    ];
    const toolResults = [];
    let assistantText = "";
    const toolCallsLog = [];
    const nvidiaRes = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + NVIDIA_API_KEY },
      body: JSON.stringify({ model: NVIDIA_MODEL, messages, tools: openaiTools, tool_choice: "auto", temperature: 0.6, top_p: 0.95, max_tokens: 2048, chat_template_kwargs: { enable_thinking: false } }),
    });
    if (!nvidiaRes.ok) {
      const errText = await nvidiaRes.text();
      return Response.json({ error: "Falha ao chamar o modelo.", status: nvidiaRes.status, detail: errText.slice(0,400) }, { status: 502, headers: CORS });
    }
    const nvidiaData = await nvidiaRes.json();
    const assistantMsg = nvidiaData?.choices?.[0]?.message;
    if (assistantMsg?.tool_calls?.length) {
      for (const tc of assistantMsg.tool_calls) {
        const name = tc.function?.name ?? "";
        let args = {};
        try { args = JSON.parse(tc.function?.arguments ?? "{}"); } catch {}
        toolCallsLog.push({ name, args });
        if (!allowedTools.find((t) => t.name === name)) { toolResults.push({ name, result: { error: "Nao autorizada." } }); continue; }
        const result = await executeTool(name, args, supabaseAdmin, supabaseAdmin, isManager, user.id, session_id);
        toolResults.push({ name, result });
      }
      const msgs2 = [...messages, assistantMsg, ...toolResults.map((tr, i) => ({ role: "tool", tool_call_id: assistantMsg.tool_calls[i]?.id ?? tr.name, content: JSON.stringify(tr.result) }))];
      const r2 = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + NVIDIA_API_KEY },
        body: JSON.stringify({ model: NVIDIA_MODEL, messages: msgs2, temperature: 0.6, top_p: 0.95, max_tokens: 2048, chat_template_kwargs: { enable_thinking: false } }),
      });
      if (r2.ok) { const d2 = await r2.json(); assistantText = d2?.choices?.[0]?.message?.content ?? ""; }
    } else {
      assistantText = assistantMsg?.content ?? "";
    }

        // 11. Extrai token de confirmacao se houver proposta de escrita
    const pendingOp = toolResults.find((tr) => (tr.result as any)?.confirmation_required);
    const confirmationToken = pendingOp ? (pendingOp.result as any).confirmation_token : null;
    const operationProposal = pendingOp ? (pendingOp.result as any) : null;

    // 12. Salva no historico
    await supabaseAdmin.from("ai_conversations").insert([
      {
        user_id: user.id,
        session_id,
        role: "user",
        content: message,
      },
      {
        user_id: user.id,
        session_id,
        role: "assistant",
        content: assistantText || "...",
        tool_calls: toolCallsLog.length > 0 ? toolCallsLog : null,
      },
    ]);

    // 13. Resposta ao frontend
    return Response.json({
      message: assistantText,
      confirmation_token: confirmationToken,
      operation_proposal: operationProposal,
      tool_calls: toolCallsLog,
    }, { headers: CORS });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    console.error("Atlas AI error:", msg);
    return Response.json({ error: msg }, { status: 500, headers: CORS });
  }
});

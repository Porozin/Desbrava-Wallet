import { createClient } from "jsr:@supabase/supabase-js@2";

const NVIDIA_API_KEY       = Deno.env.get("NVIDIA_API_KEY") ?? "";
const SUPABASE_URL         = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const NVIDIA_URL           = "https://integrate.api.nvidia.com/v1/chat/completions";
const NVIDIA_MODEL         = "nvidia/nemotron-3.5-lightning-30b-a3b";
const CHUNK_SIZE           = 80; // linhas por chamada

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── tipos ──────────────────────────────────────────────────────────────────
export interface ItemImportado {
  tipo: "venda" | "entrada" | "saida" | "divida_a_receber" | "divida_a_pagar" | "pagamento_divida" | "outro";
  data: string | null;
  valor: number;
  descricao: string;
  entidade: string | null;
  categoria: string | null;
  conta_destino: "geral" | "doceria" | "vendas" | null;
  confianca: number;
  linha_original: string;
  observacao_ia: string | null;
}

interface AnalisarBody  { texto: string; }
interface ConfirmarBody {
  itens: ItemImportado[];
  texto_original: string;
  cash_box_id?: "geral" | "doceria" | "vendas";
}

// ── prompt de extração ─────────────────────────────────────────────────────
function buildExtractionPrompt(chunk: string): string {
  const hoje = new Date().toISOString().slice(0, 10);
  return `Voce e um extrator de dados financeiros para um clube de desbravadores brasileiro.
Data de hoje: ${hoje}.
Analise as linhas abaixo e retorne um array JSON com um objeto por item financeiro identificado.
Uma linha pode gerar mais de um item (ex: venda + divida).
Nao inclua nenhum texto fora do JSON — responda SOMENTE o array JSON valido.

Formato de cada objeto:
{
  "tipo": "venda|entrada|saida|divida_a_receber|divida_a_pagar|pagamento_divida|outro",
  "data": "YYYY-MM-DD ou null",
  "valor": numero,
  "descricao": "string curta",
  "entidade": "nome da pessoa/empresa ou null",
  "categoria": "categoria ou null",
  "conta_destino": "geral|doceria|vendas|null",
  "confianca": 0.0 a 1.0,
  "linha_original": "linha exata do texto",
  "observacao_ia": "duvida ou suposicao feita, ou null"
}

Regras:
- Formatos brasileiros: "R$ 1.250,50", "50 reais", "1,5k", datas "21/11", "ontem", "dia 15"
- Se a data tiver so dia/mes, use o ano atual (${hoje.slice(0, 4)}); sem data = null
- "fulano me deve", "fiado", "ficou devendo" = divida_a_receber
- "devo pro fulano" = divida_a_pagar
- "fulano pagou X" = pagamento_divida
- Se nao entender a linha, tipo = "outro", confianca baixa, explique em observacao_ia
- Nunca invente valores: se incerto, marque confianca < 0.6 e explique
- Listas de nomes sem valor = ignorar (retornar array vazio para aquela linha)

Linhas para analisar:
${chunk}`;
}

// ── chamada NVIDIA ──────────────────────────────────────────────────────────
async function callNvidia(prompt: string): Promise<ItemImportado[]> {
  const res = await fetch(NVIDIA_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${NVIDIA_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: NVIDIA_MODEL,
      messages: [
        { role: "system", content: "Voce e um extrator de dados financeiros. Responda SOMENTE JSON valido, sem markdown, sem texto extra." },
        { role: "user",   content: prompt },
      ],
      temperature: 0.1,
      top_p: 0.9,
      max_tokens: 4096,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`NVIDIA error ${res.status}: ${err.slice(0, 200)}`);
  }

  const json = await res.json();
  const raw: string = json?.choices?.[0]?.message?.content ?? "[]";

  // extrai o JSON mesmo que venha envolvido em ``json...``
  const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed)) return [];
  return parsed as ItemImportado[];
}

// ── handler principal ───────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const authHeader = req.headers.get("authorization");
  if (!authHeader) return Response.json({ error: "Nao autenticado." }, { status: 401, headers: CORS });

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const jwt = authHeader.replace(/^Bearer /, "").trim();
  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(jwt);
  if (authErr || !user) return Response.json({ error: "Token invalido." }, { status: 401, headers: CORS });

  // Verifica se usuario tem permissao para importar (gestor ou admin)
  const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", user.id);
  const userRole = roles?.[0]?.role ?? "desbravador";
  const isManager = ["admin", "diretor", "tesoureiro"].includes(userRole);
  if (!isManager) return Response.json({ error: "Apenas gestores financeiros podem importar movimentacoes." }, { status: 403, headers: CORS });

  const url = new URL(req.url);
  const path = url.pathname.replace(/.*\/importar-ia/, "");

  // ── POST /analisar ──────────────────────────────────────────────────────
  if (req.method === "POST" && (path === "/analisar" || path === "" || path === "/")) {
    let body: AnalisarBody;
    try { body = await req.json(); } catch { return Response.json({ error: "JSON invalido." }, { status: 400, headers: CORS }); }

    if (!body.texto?.trim()) return Response.json({ error: "Texto vazio." }, { status: 400, headers: CORS });

    // Detecta encoding e normaliza
    const texto = body.texto
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .trim();

    // Divide em chunks de CHUNK_SIZE linhas
    const linhas = texto.split("\n").filter((l) => l.trim().length > 0);
    if (linhas.length === 0) return Response.json({ error: "Nenhuma linha util encontrada." }, { status: 400, headers: CORS });

    const chunks: string[][] = [];
    for (let i = 0; i < linhas.length; i += CHUNK_SIZE) {
      chunks.push(linhas.slice(i, i + CHUNK_SIZE));
    }

    const todos: ItemImportado[] = [];
    const erros: { chunk: number; erro: string }[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunkText = chunks[i].join("\n");
      let tentativas = 0;
      let ok = false;
      while (tentativas < 2 && !ok) {
        try {
          const itens = await callNvidia(buildExtractionPrompt(chunkText));
          todos.push(...itens);
          ok = true;
        } catch (e: unknown) {
          tentativas++;
          if (tentativas >= 2) {
            erros.push({ chunk: i + 1, erro: String((e as Error).message ?? e) });
          }
        }
      }
    }

    // Busca transações existentes para detecção de duplicatas
    const { data: txExistentes } = await supabaseAdmin
      .from("transactions")
      .select("date, amount, description")
      .order("date", { ascending: false })
      .limit(500);

    // Busca dividas existentes para match de entidades
    const { data: dividasExistentes } = await supabaseAdmin
      .from("dividas")
      .select("nome")
      .eq("status", "pendente");

    const entidadesExistentes = [...new Set((dividasExistentes ?? []).map((d: any) => d.nome as string))];

    // Marca possíveis duplicatas
    const todosComDup = todos.map((item) => {
      const dataItem = item.data;
      const valorItem = item.valor;
      const descItem  = (item.descricao ?? "").toLowerCase();
      const isDup = (txExistentes ?? []).some((tx: any) => {
        const sameDateApprox = !dataItem || tx.date === dataItem;
        const sameVal = Math.abs(Number(tx.amount) - valorItem) < 0.01;
        const sameDesc = descItem && tx.description?.toLowerCase().includes(descItem.slice(0, 10));
        return sameDateApprox && sameVal && sameDesc;
      });
      return { ...item, possivel_duplicata: isDup };
    });

    return Response.json(
      {
        itens: todosComDup,
        total: todosComDup.length,
        chunks_processados: chunks.length,
        erros_chunks: erros,
        entidades_existentes: entidadesExistentes,
      },
      { headers: CORS },
    );
  }

  // ── POST /confirmar ──────────────────────────────────────────────────────
  if (req.method === "POST" && path === "/confirmar") {
    let body: ConfirmarBody;
    try { body = await req.json(); } catch { return Response.json({ error: "JSON invalido." }, { status: 400, headers: CORS }); }

    const { itens, texto_original, cash_box_id = "geral" } = body;
    if (!itens?.length) return Response.json({ error: "Nenhum item para importar." }, { status: 400, headers: CORS });

    // Cria o batch
    const { data: batch, error: batchErr } = await supabaseAdmin
      .from("import_batches")
      .insert({
        created_by: user.id,
        texto_original,
        total_itens: itens.length,
        itens_importados: 0,
        status: "confirmado",
      })
      .select()
      .single();
    if (batchErr || !batch) {
      return Response.json({ error: "Falha ao criar lote: " + batchErr?.message }, { status: 500, headers: CORS });
    }

    const hoje = new Date().toISOString().slice(0, 10);
    let txCount = 0, divCount = 0;
    const erros: string[] = [];

    // Cliente autenticado como o usuário para respeitar RLS
    const supabaseAsUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: "Bearer " + jwt } },
      auth: { persistSession: false },
    });

    for (const item of itens) {
      try {
        const data = item.data ?? hoje;
        const boxId: "geral" | "doceria" | "vendas" = (["geral","doceria","vendas"].includes(item.conta_destino ?? "")) ? (item.conta_destino as any) : cash_box_id;
        const mutId = crypto.randomUUID();

        if (item.tipo === "entrada" || item.tipo === "venda") {
          await supabaseAsUser.rpc("sp_registrar_transacao_oficial", {
            p_client_mutation_id: mutId,
            p_cash_box_id: boxId,
            p_kind: "receita",
            p_amount_cents: Math.round(item.valor * 100),
            p_category: item.categoria ?? (item.tipo === "venda" ? "Venda" : "Receita"),
            p_description: item.descricao + (item.entidade ? ` — ${item.entidade}` : ""),
            p_payment_method: "dinheiro",
            p_date: data,
            p_seller: item.entidade ?? null,
          });
          // Adiciona batch_id retroativamente
          await supabaseAdmin.from("transactions")
            .update({ import_batch_id: batch.id })
            .eq("client_mutation_id", mutId);
          txCount++;

        } else if (item.tipo === "saida") {
          await supabaseAsUser.rpc("sp_registrar_transacao_oficial", {
            p_client_mutation_id: mutId,
            p_cash_box_id: boxId,
            p_kind: "despesa",
            p_amount_cents: Math.round(item.valor * 100),
            p_category: item.categoria ?? "Despesa",
            p_description: item.descricao + (item.entidade ? ` — ${item.entidade}` : ""),
            p_payment_method: "dinheiro",
            p_date: data,
            p_seller: null,
          });
          await supabaseAdmin.from("transactions")
            .update({ import_batch_id: batch.id })
            .eq("client_mutation_id", mutId);
          txCount++;

        } else if (item.tipo === "divida_a_receber" || item.tipo === "divida_a_pagar") {
          const obs = `${item.tipo === "divida_a_pagar" ? "[A PAGAR] " : ""}${item.descricao}${item.observacao_ia ? " — " + item.observacao_ia : ""}`;
          await supabaseAsUser.from("dividas").insert({
            nome: item.entidade ?? item.descricao,
            valor: item.valor,
            data,
            status: "pendente",
            obs: obs.slice(0, 200),
            import_batch_id: batch.id,
          });
          divCount++;

        } else if (item.tipo === "pagamento_divida" && item.entidade) {
          // Busca dívida pendente pelo nome mais próximo e abate valor
          const { data: divs } = await supabaseAdmin.from("dividas")
            .select("id, valor, valor_pago")
            .ilike("nome", `%${item.entidade.split(" ")[0]}%`)
            .eq("status", "pendente")
            .limit(1);
          if (divs?.length) {
            const d = divs[0] as any;
            const novoTotal = (Number(d.valor_pago ?? 0)) + item.valor;
            const quitado = novoTotal >= Number(d.valor);
            await supabaseAdmin.from("dividas").update({
              valor_pago: novoTotal,
              status: quitado ? "pago" : "pendente",
            }).eq("id", d.id);
            divCount++;
          }
        }
        // "outro" é ignorado sem erro
      } catch (e: unknown) {
        erros.push(`Item "${item.linha_original?.slice(0, 40)}": ${(e as Error).message ?? e}`);
      }
    }

    // Atualiza contagens do batch
    await supabaseAdmin.from("import_batches").update({
      itens_importados: txCount + divCount,
      resumo: { transacoes: txCount, dividas: divCount, erros: erros.length },
    }).eq("id", batch.id);

    return Response.json({
      success: true,
      batch_id: batch.id,
      transacoes_criadas: txCount,
      dividas_criadas: divCount,
      erros,
    }, { headers: CORS });
  }

  // ── POST /desfazer ───────────────────────────────────────────────────────
  if (req.method === "POST" && path === "/desfazer") {
    const { batch_id } = await req.json();
    if (!batch_id) return Response.json({ error: "batch_id obrigatorio." }, { status: 400, headers: CORS });

    // Verifica que o lote pertence ao usuário ou é gestor
    const { data: batch } = await supabaseAdmin.from("import_batches")
      .select("id, created_by, status").eq("id", batch_id).single();
    if (!batch) return Response.json({ error: "Lote nao encontrado." }, { status: 404, headers: CORS });
    if (batch.status === "desfeito") return Response.json({ error: "Este lote ja foi desfeito." }, { status: 400, headers: CORS });
    if (batch.created_by !== user.id && !isManager) return Response.json({ error: "Sem permissao." }, { status: 403, headers: CORS });

    // Deleta transações do lote
    const { count: txDel } = await supabaseAdmin.from("transactions")
      .delete({ count: "exact" }).eq("import_batch_id", batch_id);

    // Deleta dívidas do lote
    const { count: divDel } = await supabaseAdmin.from("dividas")
      .delete({ count: "exact" }).eq("import_batch_id", batch_id);

    // Marca o batch como desfeito
    await supabaseAdmin.from("import_batches")
      .update({ status: "desfeito" }).eq("id", batch_id);

    return Response.json({
      success: true,
      transacoes_removidas: txDel ?? 0,
      dividas_removidas: divDel ?? 0,
    }, { headers: CORS });
  }

  return Response.json({ error: "Rota nao encontrada." }, { status: 404, headers: CORS });
});

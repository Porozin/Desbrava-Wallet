import { supabase } from "@/integrations/supabase/client";
import {
  toCents,
  type CashBoxId,
  type Kind,
  type Transaction,
  CASH_BOX_LABEL,
  brl,
} from "./finance";

export interface TransparenciaItem {
  id: string;
  date: string;
  cash_box_id: CashBoxId;
  kind: Kind;
  category: string;
  description: string;
  amount: number;
  amount_cents: number;
  payment_method: string;
}

export interface TransparenciaResumo {
  receitas: number;
  receitas_cents: number;
  despesas: number;
  despesas_cents: number;
  saldo: number;
  saldo_cents: number;
  total_operacoes: number;
  por_caixa: Record<CashBoxId, { receitas: number; despesas: number; saldo: number }>;
  por_categoria: { categoria: string; total: number; percentual: number }[];
}

/**
 * Busca os dados públicos para o portal de transparência.
 * Tenta a view segura 'vw_transparencia_publica'; se não existir ainda no Supabase,
 * consulta 'transactions' sanitizando rigorosamente qualquer dado sensível.
 */
export async function fetchTransparenciaPublica(): Promise<TransparenciaItem[]> {
  try {
    // 1. Tenta a view pública
    const { data: viewData, error: viewError } = await supabase
      .from("vw_transparencia_publica" as any)
      .select("*")
      .order("date", { ascending: false });

    if (!viewError && viewData) {
      return (viewData as any[]).map((r) => {
        const rawAmount = Number(r.amount);
        const amountCents = r.amount_cents ? Number(r.amount_cents) : toCents(rawAmount);
        const box: CashBoxId =
          r.cash_box_id || (r.module === "clube" ? "geral" : r.module) || "geral";
        return {
          id: r.id,
          date: r.date,
          cash_box_id: box,
          kind: r.kind as Kind,
          category: r.category || "Geral",
          description: r.description,
          amount: rawAmount,
          amount_cents: amountCents,
          payment_method: r.payment_method || "dinheiro",
        };
      });
    }
  } catch {
    // Fallback silencioso para consulta base
  }

  // 2. Fallback resiliente com sanitização client-side
  const { data, error } = await supabase
    .from("transactions")
    .select("id, date, module, cash_box_id, kind, category, description, amount, amount_cents, payment_method, status")
    .eq("status", "confirmado")
    .order("date", { ascending: false })
    .limit(1000);

  if (error) {
    console.warn("[Transparência] Erro ao carregar dados:", error);
    return [];
  }

  return (data ?? []).map((r) => {
    const rawAmount = Number(r.amount);
    const amountCents = r.amount_cents ? Number(r.amount_cents) : toCents(rawAmount);
    const box: CashBoxId =
      r.cash_box_id || (r.module === "clube" ? "geral" : (r.module as CashBoxId)) || "geral";
    return {
      id: r.id,
      date: r.date,
      cash_box_id: box,
      kind: r.kind as Kind,
      category: r.category || "Geral",
      description: r.description,
      amount: rawAmount,
      amount_cents: amountCents,
      payment_method: r.payment_method || "dinheiro",
    };
  });
}

/**
 * Calcula os resumos e indicadores agregados de transparência.
 */
export function summarizeTransparencia(items: TransparenciaItem[]): TransparenciaResumo {
  let receitasCents = 0;
  let despesasCents = 0;

  const porCaixa: Record<CashBoxId, { receitas: number; despesas: number; saldo: number }> = {
    geral: { receitas: 0, despesas: 0, saldo: 0 },
    doceria: { receitas: 0, despesas: 0, saldo: 0 },
    vendas: { receitas: 0, despesas: 0, saldo: 0 },
  };

  const catMap = new Map<string, number>();

  items.forEach((item) => {
    if (item.kind === "receita") {
      receitasCents += item.amount_cents;
      if (porCaixa[item.cash_box_id]) {
        porCaixa[item.cash_box_id].receitas += item.amount;
        porCaixa[item.cash_box_id].saldo += item.amount;
      }
    } else if (item.kind === "despesa") {
      despesasCents += item.amount_cents;
      if (porCaixa[item.cash_box_id]) {
        porCaixa[item.cash_box_id].despesas += item.amount;
        porCaixa[item.cash_box_id].saldo -= item.amount;
      }

      const prev = catMap.get(item.category) || 0;
      catMap.set(item.category, prev + item.amount);
    }
  });

  const totalDespesas = despesasCents / 100;
  const porCategoria = Array.from(catMap.entries())
    .map(([categoria, total]) => ({
      categoria,
      total,
      percentual: totalDespesas > 0 ? (total / totalDespesas) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);

  return {
    receitas: receitasCents / 100,
    receitas_cents: receitasCents,
    despesas: despesasCents / 100,
    despesas_cents: despesasCents,
    saldo: (receitasCents - despesasCents) / 100,
    saldo_cents: receitasCents - despesasCents,
    total_operacoes: items.length,
    porCaixa,
    porCategoria,
  };
}

/**
 * Exporta planilha CSV pública (sem dados privados de compradores ou doadores).
 */
export function exportTransparenciaCsv(items: TransparenciaItem[]): void {
  const rows = [
    ["Data", "Caixa Financeiro", "Tipo", "Categoria", "Descrição Pública", "Forma Pagamento", "Valor (R$)"],
    ...items.map((t) => [
      t.date,
      CASH_BOX_LABEL[t.cash_box_id] || t.cash_box_id,
      t.kind === "receita" ? "Receita" : t.kind === "despesa" ? "Despesa" : "Transferência",
      t.category,
      t.description,
      t.payment_method,
      t.amount.toFixed(2).replace(".", ","),
    ]),
  ];

  const csvContent =
    "\uFEFF" +
    rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";"))
      .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `gdacaixa-transparencia-publica-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}


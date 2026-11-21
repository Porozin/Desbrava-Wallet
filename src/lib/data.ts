import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  toCents,
  type CashBoxId,
  type CashReservation,
  type Module,
  type PaymentMethod,
  type Transaction,
  type Role as RoleFromFinance,
} from "./finance";

export type Role = "admin" | "diretor" | "tesoureiro" | "conselheiro" | "desbravador";
export const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  diretor: "Diretor",
  tesoureiro: "Tesoureiro",
  conselheiro: "Conselheiro",
  desbravador: "Desbravador",
};

const TX_KEY = ["transactions"] as const;

// --- 1. Transações ---
async function fetchTransactions(): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .order("date", { ascending: false })
    .limit(1000);
  if (error) throw error;
  return (data ?? []).map((r) => {
    const rawAmount = Number(r.amount);
    const amountCents = r.amount_cents ? Number(r.amount_cents) : toCents(rawAmount);

    return {
      id: r.id,
      module: (r.module || (r.cash_box_id === "geral" ? "clube" : r.cash_box_id) || "clube") as Module,
      cash_box_id: r.cash_box_id ?? undefined,
      kind: r.kind as Transaction["kind"],
      amount: rawAmount,
      amount_cents: amountCents,
      category: r.category || "Geral",
      description: r.description,
      date: r.date,
      seller: r.seller ?? undefined,
      status: r.status ?? "confirmado",
      destination_cash_box_id: r.destination_cash_box_id ?? undefined,
      payment_method: r.payment_method ?? undefined,
      client_mutation_id: r.client_mutation_id ?? undefined,
      original_transaction_id: r.original_transaction_id ?? undefined,
      reverse_reason: r.reverse_reason ?? undefined,
      requested_by: r.requested_by ?? undefined,
      approved_by: r.approved_by ?? undefined,
      approved_at: r.approved_at ?? undefined,
      rejection_reason: r.rejection_reason ?? undefined,
    };
  });
}

export function useTransactions(module?: Module) {
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: TX_KEY, queryFn: fetchTransactions });

  useEffect(() => {
    const channel = supabase
      .channel(`tx-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => {
        qc.invalidateQueries({ queryKey: TX_KEY });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  return module ? data.filter((t) => t.module === module) : data;
}

export function useBoxTransactions(boxId: CashBoxId) {
  const all = useTransactions();
  return all.filter((t) => {
    const originBox: CashBoxId = t.cash_box_id || (t.module === "clube" ? "geral" : (t.module as CashBoxId));
    const destBox = t.destination_cash_box_id;
    return originBox === boxId || destBox === boxId;
  });
}

export function usePendingTransactions() {
  return useTransactions().filter((t) => t.status === "pendente");
}

// --- Reservas de Saldo ---
const RES_KEY = ["reservations"] as const;

async function fetchReservations(): Promise<CashReservation[]> {
  try {
    const { data, error } = await supabase
      .from("transaction_reservations")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return [];
    return (data ?? []).map((r: any) => ({
      id: r.id,
      cash_box_id: (r.cash_box_id === "clube" ? "geral" : r.cash_box_id) as CashBoxId,
      title: r.title,
      description: r.description ?? undefined,
      amount_cents: Number(r.amount_cents),
      status: r.status as "ativa" | "liberada" | "consumida",
      created_by: r.created_by,
      created_at: r.created_at,
    }));
  } catch {
    return [];
  }
}

export function useReservations(cashBoxId?: CashBoxId) {
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: RES_KEY, queryFn: fetchReservations });

  useEffect(() => {
    const channel = supabase
      .channel(`res-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "transaction_reservations" }, () => {
        qc.invalidateQueries({ queryKey: RES_KEY });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  return cashBoxId ? data.filter((r) => r.cash_box_id === cashBoxId) : data;
}

export async function addTransaction(t: Omit<Transaction, "id">) {
  const clientMutationId = t.client_mutation_id || crypto.randomUUID();
  const amountCents = t.amount_cents ?? toCents(t.amount);
  const cashBoxId = t.cash_box_id || (t.module === "clube" ? "geral" : t.module);

  // Tentativa primária: RPC oficial segura com idempotência (Fase 1B)
  const { data: rpcData, error: rpcError } = await supabase.rpc("sp_registrar_transacao_oficial", {
    p_client_mutation_id: clientMutationId,
    p_cash_box_id: cashBoxId,
    p_kind: t.kind,
    p_amount_cents: amountCents,
    p_category: t.category,
    p_description: t.description,
    p_payment_method: t.payment_method || "dinheiro",
    p_date: t.date,
    p_seller: t.seller ?? null,
  });

  if (!rpcError) {
    return rpcData;
  }

  // Fallback para schema legado caso a migration 0004 ainda não tenha sido aplicada
  const payload: Record<string, any> = {
    module: t.module,
    kind: t.kind,
    amount: t.amount,
    category: t.category,
    description: t.description,
    date: t.date,
    seller: t.seller ?? null,
  };

  if (t.cash_box_id) payload.cash_box_id = t.cash_box_id;
  if (t.status) payload.status = t.status;
  if (t.payment_method) payload.payment_method = t.payment_method;
  if (t.destination_cash_box_id) payload.destination_cash_box_id = t.destination_cash_box_id;

  const { error: insertError } = await supabase.from("transactions").insert(payload);
  if (insertError) throw insertError;
}

// Helpers para RPCs da Fase 1B
export async function recordTransfer(params: {
  originCashBoxId: CashBoxId;
  destinationCashBoxId: CashBoxId;
  amountCents: number;
  description: string;
  clientMutationId?: string;
}) {
  const mutationId = params.clientMutationId || crypto.randomUUID();
  const { data, error } = await supabase.rpc("sp_registrar_transferencia", {
    p_client_mutation_id: mutationId,
    p_source_box: params.originCashBoxId,
    p_destination_box: params.destinationCashBoxId,
    p_amount_cents: params.amountCents,
    p_description: params.description,
  });
  if (error) throw error;
  return data;
}

export async function requestExpense(params: {
  cashBoxId: CashBoxId;
  amountCents: number;
  category: string;
  description: string;
  paymentMethod?: PaymentMethod;
  clientMutationId?: string;
}) {
  const mutationId = params.clientMutationId || crypto.randomUUID();
  const { data, error } = await supabase.rpc("sp_solicitar_despesa", {
    p_client_mutation_id: mutationId,
    p_cash_box_id: params.cashBoxId,
    p_amount_cents: params.amountCents,
    p_category: params.category,
    p_description: params.description,
    p_payment_method: params.paymentMethod || "dinheiro",
  });
  if (error) throw error;
  return data;
}

export async function approveExpenseRequest(transactionId: string, paymentMethod: PaymentMethod = "dinheiro") {
  const { data, error } = await supabase.rpc("sp_aprovar_solicitacao", {
    p_transaction_id: transactionId,
    p_payment_method: paymentMethod,
  });
  if (error) throw error;
  return data;
}

export async function rejectExpenseRequest(transactionId: string, reason: string) {
  const { data, error } = await supabase.rpc("sp_rejeitar_solicitacao", {
    p_transaction_id: transactionId,
    p_rejection_reason: reason,
  });
  if (error) throw error;
  return data;
}

export async function deleteTransaction(transactionId: string) {
  const { error } = await supabase.rpc("sp_deletar_transacao_admin", {
    p_transaction_id: transactionId,
  });
  if (error) throw new Error(error.message);
}

export async function reverseTransaction(transactionId: string, reason: string) {
  // Busca a transação antes de estornar para verificar se é aporte de meta
  const { data: original } = await supabase
    .from("transactions")
    .select("id, description, category, amount_cents, amount")
    .eq("id", transactionId)
    .single();

  // Tenta a RPC oficial (disponível após migration 0004)
  const { data, error } = await supabase.rpc("sp_estornar_transacao", {
    p_transaction_id: transactionId,
    p_reverse_reason: reason,
  });

  // Fallback: se a RPC não existir ainda no banco, faz estorno via insert direto
  if (error && (error.message.includes("Could not find the function") || error.code === "PGRST202")) {
    const { data: orig2, error: fetchErr } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", transactionId)
      .single();
    if (fetchErr || !orig2) throw new Error("Transação original não encontrada.");

    const { data: existing } = await supabase
      .from("transactions")
      .select("id")
      .like("description", `[ESTORNO]%`)
      .like("description", `%${transactionId.slice(0, 8)}%`)
      .limit(1);
    if (existing && existing.length > 0) {
      throw new Error("Esta transação já foi estornada anteriormente.");
    }

    const reverseKind = orig2.kind === "receita" ? "despesa" : "receita";
    const { error: insertErr } = await supabase.from("transactions").insert({
      module: orig2.module,
      kind: reverseKind,
      amount: orig2.amount,
      category: orig2.category || "Estorno",
      description: `[ESTORNO] ${reason} (ref: ${transactionId.slice(0, 8)})`,
      date: new Date().toISOString().slice(0, 10),
      seller: orig2.seller,
    });
    if (insertErr) throw insertErr;
    return { status: "estornado_fallback" };
  }

  if (error) throw error;

  // Se era um aporte de meta, decrementar valor_atual na meta correspondente
  if (original && original.category === "Meta" && original.description) {
    const match = original.description.match(/\[meta:([a-f0-9-]{36})\]/);
    if (match) {
      const metaId = match[1];
      const { data: meta } = await supabase
        .from("metas")
        .select("valor_atual, valor_alvo")
        .eq("id", metaId)
        .single();
      if (meta) {
        const amountReturned = original.amount_cents
          ? original.amount_cents / 100
          : original.amount;
        const novoValor = Math.max(0, Number(meta.valor_atual) - amountReturned);
        const novoStatus = novoValor * 100 >= Number(meta.valor_alvo) * 100 ? "concluida" : "aprovada";
        await supabase
          .from("metas")
          .update({ valor_atual: novoValor, status: novoStatus })
          .eq("id", metaId);
      }
    }
  }

  return data;
}

export async function createReservation(params: {
  cashBoxId: CashBoxId;
  title: string;
  amountCents: number;
  description?: string;
}) {
  const { data, error } = await supabase.rpc("sp_criar_reserva", {
    p_cash_box_id: params.cashBoxId,
    p_title: params.title,
    p_amount_cents: params.amountCents,
    p_description: params.description ?? null,
  });
  if (error) throw error;
  return data;
}

export async function releaseReservation(reservationId: string) {
  const { data, error } = await supabase.rpc("sp_liberar_reserva", {
    p_reservation_id: reservationId,
  });
  if (error) throw error;
  return data;
}

export async function consumeReservation(reservationId: string) {
  const { data, error } = await supabase.rpc("sp_consumir_reserva", {
    p_reservation_id: reservationId,
  });
  if (error) throw error;
  return data;
}

// --- 2. Metas (Clube, Doceria, Vendas, Unidades) ---
export interface Meta {
  id: string;
  modulo: "clube" | "doceria" | "vendas" | "unidade";
  unidade_nome?: string;
  descricao: string;
  valor_alvo: number;
  valor_atual: number;
  tipo: "lucro_automatico" | "destinacao_manual";
  caixa_origem?: string | null;
  status: "pendente" | "aprovada" | "concluida";
  sugerido_por?: string;
}

export function useMetas(modulo?: Meta["modulo"]) {
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["metas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("metas").select("*").order("created_at", { ascending: false });
      if (error) return [];
      return (data ?? []).map((m) => ({
        id: m.id,
        modulo: m.modulo,
        unidade_nome: m.unidade_nome ?? undefined,
        descricao: m.descricao,
        valor_alvo: Number(m.valor_alvo),
        valor_atual: Number(m.valor_atual ?? 0),
        tipo: (m.tipo ?? "destinacao_manual") as Meta["tipo"],
        caixa_origem: m.caixa_origem ?? null,
        status: m.status,
        sugerido_por: m.sugerido_por ?? undefined,
      })) as Meta[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("metas-" + Math.random().toString(36).slice(2))
      .on("postgres_changes", { event: "*", schema: "public", table: "metas" }, () => {
        qc.invalidateQueries({ queryKey: ["metas"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  return modulo ? data.filter((m) => m.modulo === modulo) : data;
}

export async function addMeta(m: Omit<Meta, "id">) {
  const { error } = await supabase.from("metas").insert({
    modulo: m.modulo,
    unidade_nome: m.unidade_nome ?? null,
    descricao: m.descricao,
    valor_alvo: m.valor_alvo,
    valor_atual: m.valor_atual ?? 0,
    tipo: m.tipo ?? "destinacao_manual",
    caixa_origem: m.caixa_origem ?? null,
    status: m.status || "aprovada",
    sugerido_por: m.sugerido_por ?? null,
  });
  if (error) throw error;
}

export async function deleteMeta(id: string) {
  const { error } = await supabase.from("metas").delete().eq("id", id);
  if (error) throw error;
}

export async function updateMeta(id: string, changes: Partial<Pick<Meta, "descricao" | "valor_alvo" | "status" | "tipo" | "caixa_origem">>) {
  const { error } = await supabase.from("metas").update(changes).eq("id", id);
  if (error) throw error;
}

export async function aportarMeta(params: {
  metaId: string;
  metaDescricao: string;
  cashBoxId: string;
  amountCents: number;
  valorAtualCents: number;
  valorAlvoCents: number;
}) {
  const mutationId = crypto.randomUUID();
  // Inclui o meta_id na descrição para que um eventual estorno possa decrementar valor_atual
  const description = `Aporte para meta: ${params.metaDescricao} [meta:${params.metaId}]`;
  const { error: txError } = await supabase.rpc("sp_registrar_transacao_oficial", {
    p_client_mutation_id: mutationId,
    p_cash_box_id: params.cashBoxId,
    p_kind: "despesa",
    p_amount_cents: params.amountCents,
    p_category: "Meta",
    p_description: description,
    p_payment_method: "dinheiro",
    p_date: new Date().toISOString().slice(0, 10),
    p_seller: null,
  });
  if (txError) throw txError;

  // Atualiza valor_atual da meta
  const novoValor = (params.valorAtualCents + params.amountCents) / 100;
  const novoStatus = novoValor * 100 >= params.valorAlvoCents ? "concluida" : "aprovada";
  const { error: metaError } = await supabase
    .from("metas")
    .update({ valor_atual: novoValor, status: novoStatus, caixa_origem: params.cashBoxId })
    .eq("id", params.metaId);
  if (metaError) throw metaError;
}

export async function updateMetaStatus(id: string, status: Meta["status"]) {
  const { error } = await supabase.from("metas").update({ status }).eq("id", id);
  if (error) throw error;
}

// --- 3. Materiais & Estoque (Almoxarifado) ---
export interface MaterialItem {
  id: string;
  modulo: "clube" | "doceria";
  nome: string;
  quantidade: number;
  custo_total: number;
  unidade_medida?: string;
}

export function useMateriais(modulo?: "clube" | "doceria") {
  const { data = [] } = useQuery({
    queryKey: ["materiais"],
    queryFn: async () => {
      const { data, error } = await supabase.from("materiais").select("*").order("created_at", { ascending: false });
      if (error) return [];
      return (data ?? []).map((m) => ({
        id: m.id,
        modulo: m.modulo,
        nome: m.nome,
        quantidade: Number(m.quantidade),
        custo_total: Number(m.custo_total),
        unidade_medida: m.unidade_medida || "un",
      })) as MaterialItem[];
    },
  });
  return modulo ? data.filter((m) => m.modulo === modulo) : data;
}

export async function addMaterial(m: Omit<MaterialItem, "id">) {
  const { error } = await supabase.from("materiais").insert({
    modulo: m.modulo,
    nome: m.nome,
    quantidade: m.quantidade,
    custo_total: m.custo_total,
    unidade_medida: m.unidade_medida || "un",
  });
  if (error) throw error;
}

export async function updateMaterial(id: string, m: Partial<Omit<MaterialItem, "id">>) {
  const payload: any = {};
  if (m.nome !== undefined) payload.nome = m.nome;
  if (m.quantidade !== undefined) payload.quantidade = m.quantidade;
  if (m.custo_total !== undefined) payload.custo_total = m.custo_total;
  if (m.unidade_medida !== undefined) payload.unidade_medida = m.unidade_medida;
  const { error } = await supabase.from("materiais").update(payload).eq("id", id);
  if (error) throw error;
}

export async function deleteMaterial(id: string) {
  const { error } = await supabase.from("materiais").delete().eq("id", id);
  if (error) throw error;
}

// --- 4. Produtos e Ficha Técnica de Ingredientes/Insumos ---
export interface IngredienteInsumo {
  material_id: string;
  material_nome: string;
  quantidade: number;
  unidade_medida?: string;
  custo_unitario: number;
  custo_subtotal: number;
}

export interface Produto {
  id: string;
  nome: string;
  preco_venda: number;
  custo: number;
  comissao: number;
  modulo?: "doceria" | "vendas" | "clube";
  ingredientes?: IngredienteInsumo[];
  icon?: string | null;
  color?: string | null;
}

export function useProdutos(modulo?: "doceria" | "vendas" | "clube") {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["produtos", modulo || "all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("produtos").select("*").order("nome");
      if (error) return [];
      return (data ?? []).map((p: any) => {
        let ingredientes: IngredienteInsumo[] = [];
        if (p.ingredientes && Array.isArray(p.ingredientes)) {
          ingredientes = p.ingredientes;
        } else if (typeof window !== "undefined") {
          try {
            const cached = localStorage.getItem(`gda_prod_ing_${p.id}`) || localStorage.getItem(`gda_prod_ing_${p.nome}`);
            if (cached) ingredientes = JSON.parse(cached);
          } catch {}
        }

        let itemModulo = p.modulo;
        if (!itemModulo && typeof window !== "undefined") {
          itemModulo = localStorage.getItem(`gda_prod_mod_${p.id}`) || localStorage.getItem(`gda_prod_mod_${p.nome}`) || "vendas";
        }

        return {
          id: p.id,
          nome: p.nome,
          preco_venda: Number(p.preco_venda),
          custo: Number(p.custo),
          comissao: Number(p.comissao),
          modulo: itemModulo,
          ingredientes,
          icon: p.icon ?? null,
          color: p.color ?? null,
        } as Produto;
      });
    },
  });

  const all = query.data ?? [];
  return {
    ...query,
    data: modulo ? all.filter((p) => p.modulo === modulo) : all,
  };
}

export async function addProduto(p: Omit<Produto, "id">) {
  const payload: any = {
    nome: p.nome,
    preco_venda: p.preco_venda,
    custo: p.custo,
    comissao: p.comissao,
  };
  if (p.modulo) payload.modulo = p.modulo;
  if (p.ingredientes) payload.ingredientes = p.ingredientes;

  try {
    const { data, error } = await supabase.from("produtos").insert(payload).select().single();
    if (error) throw error;
    if (data?.id && typeof window !== "undefined") {
      if (p.ingredientes) localStorage.setItem(`gda_prod_ing_${data.id}`, JSON.stringify(p.ingredientes));
      if (p.modulo) localStorage.setItem(`gda_prod_mod_${data.id}`, p.modulo);
    }
    return data;
  } catch (err: any) {
    // Se falhar por causa de colunas novas modulo ou ingredientes antes de rodar migration, tenta salvar base
    if (payload.modulo || payload.ingredientes) {
      const fallbackPayload = {
        nome: p.nome,
        preco_venda: p.preco_venda,
        custo: p.custo,
        comissao: p.comissao,
      };
      const { data: fbData, error: fbError } = await supabase.from("produtos").insert(fallbackPayload).select().single();
      if (fbError) throw fbError;
      if (fbData?.id && typeof window !== "undefined") {
        if (p.ingredientes) localStorage.setItem(`gda_prod_ing_${fbData.id}`, JSON.stringify(p.ingredientes));
        if (p.modulo) localStorage.setItem(`gda_prod_mod_${fbData.id}`, p.modulo || "vendas");
      }
      return fbData;
    }
    throw err;
  }
}

export async function updateProduto(id: string, p: Partial<Omit<Produto, "id">>) {
  const payload: any = {};
  if (p.nome !== undefined) payload.nome = p.nome;
  if (p.preco_venda !== undefined) payload.preco_venda = p.preco_venda;
  if (p.custo !== undefined) payload.custo = p.custo;
  if (p.comissao !== undefined) payload.comissao = p.comissao;
  if (p.modulo !== undefined) payload.modulo = p.modulo;
  if (p.ingredientes !== undefined) payload.ingredientes = p.ingredientes;
  if (p.icon !== undefined) payload.icon = p.icon;
  if (p.color !== undefined) payload.color = p.color;

  const { error } = await supabase.from("produtos").update(payload).eq("id", id);
  if (error) throw error;
}

export async function deleteProduto(id: string) {
  const { error } = await supabase.from("produtos").delete().eq("id", id);
  if (error) throw error;
}

export interface Avaria {
  id: string;
  produto_nome: string;
  quantidade: number;
  perda_estimada: number;
  motivo?: string;
  data: string;
}

export function useAvarias() {
  return useQuery({
    queryKey: ["avarias"],
    queryFn: async () => {
      const { data, error } = await supabase.from("avarias").select("*").order("data", { ascending: false });
      if (error) return [];
      return (data ?? []).map((a) => ({
        id: a.id,
        produto_nome: a.produto_nome,
        quantidade: Number(a.quantidade),
        perda_estimada: Number(a.perda_estimada),
        motivo: a.motivo ?? undefined,
        data: a.data,
      })) as Avaria[];
    },
  });
}

export async function addAvaria(a: Omit<Avaria, "id">) {
  const { error } = await supabase.from("avarias").insert({
    produto_nome: a.produto_nome,
    quantidade: a.quantidade,
    perda_estimada: a.perda_estimada,
    motivo: a.motivo ?? null,
    data: a.data,
  });
  if (error) throw error;
}

// --- 5. Controle Interno / Dívidas ---
export interface Divida {
  id: string;
  nome: string;
  valor: number;
  valor_pago: number;
  data: string;
  status: "pendente" | "pago";
  obs?: string;
  delete_after?: string | null;
}

export function useDividas() {
  const qc = useQueryClient();
  return useQuery({
    queryKey: ["dividas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("dividas").select("*").order("data", { ascending: false });
      if (error) return [];
      return (data ?? []).map((d) => ({
        id: d.id,
        nome: d.nome,
        valor: Number(d.valor),
        valor_pago: Number(d.valor_pago ?? 0),
        data: d.data,
        status: d.status,
        obs: d.obs ?? undefined,
        delete_after: d.delete_after ?? null,
      })) as Divida[];
    },
  });
}

export async function addDivida(d: Omit<Divida, "id">) {
  const { error } = await supabase.from("dividas").insert({
    nome: d.nome,
    valor: d.valor,
    data: d.data,
    status: d.status || "pendente",
    obs: d.obs ?? null,
  });
  if (error) throw error;
}

export async function updateDividaStatus(id: string, status: "pendente" | "pago") {
  const { error } = await supabase.from("dividas").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function registrarPagamentoParcial(id: string, valorPagamento: number, novoValorPago: number, valorTotal: number) {
  const quitado = novoValorPago >= valorTotal;
  const updates: Record<string, unknown> = { valor_pago: novoValorPago };
  if (quitado) updates.status = "pago";
  const { error } = await supabase.from("dividas").update(updates).eq("id", id);
  if (error) throw error;
  return { quitado };
}

export async function agendarExclusaoDivida(id: string, dias: number | null) {
  const delete_after = dias === null ? null : new Date(Date.now() + dias * 86400000).toISOString();
  const { error } = await supabase.from("dividas").update({ delete_after }).eq("id", id);
  if (error) throw error;
}

export async function deleteDivida(id: string) {
  const { error } = await supabase.from("dividas").delete().eq("id", id);
  if (error) throw error;
}

// --- Usuário Atual e Permissões ---
export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) return null;
      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("display_name,avatar_url").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);
      return {
        id: user.id,
        email: user.email ?? "",
        name: profile?.display_name ?? user.email ?? "",
        avatar: profile?.avatar_url ?? null,
        roles: (roles ?? []).map((r) => r.role as Role),
      };
    },
  });
}

export function useCanRecord() {
  const { data } = useMe();
  return !!data?.roles.some((r) => r === "admin" || r === "diretor" || r === "tesoureiro");
}

export function useIsAdminOrDiretor() {
  const { data } = useMe();
  return !!data?.roles.some((r) => r === "admin" || r === "diretor" || r === "tesoureiro");
}

export function useIsFinancialManager() {
  const { data } = useMe();
  return !!data?.roles.some((r) => r === "admin" || r === "diretor" || r === "tesoureiro");
}
// --- 6. Gestão de Usuários (RBAC) ---
export interface ClubUser {
  id: string;
  name: string;
  avatar_url?: string | null;
  roles: Role[];
}

export function useAllUsers() {
  const qc = useQueryClient();
  return useQuery({
    queryKey: ["all_users"],
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id, display_name, avatar_url"),
        supabase.from("user_roles").select("user_id, role"),
      ]);

      if (!profiles) return [];

      const rolesByUser = new Map<string, Role[]>();
      (roles ?? []).forEach((r) => {
        const list = rolesByUser.get(r.user_id) || [];
        list.push(r.role as Role);
        rolesByUser.set(r.user_id, list);
      });

      return profiles.map((p) => ({
        id: p.id,
        name: p.display_name || "Membro",
        avatar_url: p.avatar_url,
        roles: rolesByUser.get(p.id) || ["desbravador"],
      })) as ClubUser[];
    },
  });
}

export async function updateUserRole(userId: string, newRole: Role) {
  // Remove papéis anteriores e adiciona o novo papel hierárquico
  await supabase.from("user_roles").delete().eq("user_id", userId);
  const { error } = await supabase.from("user_roles").insert({
    user_id: userId,
    role: newRole,
  });
  if (error) throw error;
}

export function useIsAdmin() {
  const { data } = useMe();
  return !!data?.roles.includes("admin");
}

export function useIsConselheiro() {
  const { data } = useMe();
  return !!data?.roles.includes("conselheiro");
}

// --- 7. Limpeza Total (Admin-only) ---
const WIPE_TABLES = [
  "transactions",
  "metas",
  "dividas",
  "materiais",
  "produtos",
  "avarias",
] as const;

export async function wipeAllData() {
  const { data, error } = await supabase.rpc('sp_wipe_all_data', { p_include_users: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function wipeAllDataWithUsers() {
  const { data, error } = await supabase.rpc('sp_wipe_all_data', { p_include_users: true });
  if (error) throw new Error(error.message);
  return data;
}

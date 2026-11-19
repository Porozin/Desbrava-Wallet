-- Migration 0006: Fase 5 — Histórico, Relatórios e Transparência Pública Segura
-- Criação de view segura e função para o Portal de Transparência Pública do Clube Guerreiros do Alto
-- Sem expor dados pessoais, compradores, doadores ou tabelas cruas diretamente ao público (anon).

-- 1. View de Transparência Pública (apenas transações confirmadas dos 3 caixas oficiais, sem dados privados)
CREATE OR REPLACE VIEW public.vw_transparencia_publica AS
SELECT
  t.id,
  t.date,
  COALESCE(t.cash_box_id, CASE WHEN t.module = 'clube' THEN 'geral' ELSE t.module END) AS cash_box_id,
  t.module,
  t.kind,
  COALESCE(t.category, 'Geral') AS category,
  t.description,
  COALESCE(t.amount_cents, (t.amount * 100)::bigint) AS amount_cents,
  t.amount,
  COALESCE(t.payment_method, 'dinheiro') AS payment_method,
  t.status,
  t.created_at
FROM public.transactions t
WHERE t.status = 'confirmado'
  AND (t.cash_box_id IN ('geral', 'doceria', 'vendas') OR t.cash_box_id IS NULL);

-- Conceder permissão de leitura pública (anon) e autenticada
GRANT SELECT ON public.vw_transparencia_publica TO anon, authenticated;

-- 2. Função RPC segura para agregação de transparência por período
CREATE OR REPLACE FUNCTION public.sp_resumo_transparencia_publica(
  p_ano integer DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::integer,
  p_mes integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
  v_receitas bigint := 0;
  v_despesas bigint := 0;
  v_saldo bigint := 0;
BEGIN
  -- Calcula receitas confirmadas (exclui transferências internas do consolidado)
  SELECT COALESCE(SUM(COALESCE(t.amount_cents, (t.amount * 100)::bigint)), 0)
  INTO v_receitas
  FROM public.transactions t
  WHERE t.status = 'confirmado'
    AND t.kind = 'receita'
    AND (p_ano IS NULL OR EXTRACT(YEAR FROM t.date) = p_ano)
    AND (p_mes IS NULL OR EXTRACT(MONTH FROM t.date) = p_mes);

  -- Calcula despesas confirmadas (exclui transferências internas do consolidado)
  SELECT COALESCE(SUM(COALESCE(t.amount_cents, (t.amount * 100)::bigint)), 0)
  INTO v_despesas
  FROM public.transactions t
  WHERE t.status = 'confirmado'
    AND t.kind = 'despesa'
    AND (p_ano IS NULL OR EXTRACT(YEAR FROM t.date) = p_ano)
    AND (p_mes IS NULL OR EXTRACT(MONTH FROM t.date) = p_mes);

  v_saldo := v_receitas - v_despesas;

  v_result := pg_catalog.jsonb_build_object(
    'ano', p_ano,
    'mes', p_mes,
    'receitas_cents', v_receitas,
    'despesas_cents', v_despesas,
    'saldo_cents', v_saldo,
    'receitas_reais', (v_receitas::numeric / 100.0),
    'despesas_reais', (v_despesas::numeric / 100.0),
    'saldo_reais', (v_saldo::numeric / 100.0)
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.sp_resumo_transparencia_publica(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sp_resumo_transparencia_publica(integer, integer) TO anon, authenticated;


-- =============================================================================
-- Migration 0007: Fix sp_estornar_transacao
-- Remove spurious saldo-disponivel check on revenue reversal (kind=receita).
-- Estornar uma receita anula a entrada; nao e uma despesa que consome saldo.
-- A verificacao de saldo so se aplica ao estorno de transferencia.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sp_estornar_transacao(
  p_transaction_id  uuid,
  p_reverse_reason  text
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_orig     record;
  v_comp_id  uuid;
  v_comp_kind text;
  v_comp_box  text;
  v_comp_dest text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sessao invalida.';
  END IF;

  IF NOT public.is_financial_manager(v_uid) THEN
    RAISE EXCEPTION 'Acesso negado: apenas gestores financeiros podem estornar lancamentos.';
  END IF;

  IF trim(coalesce(p_reverse_reason, '')) = '' THEN
    RAISE EXCEPTION 'Justificativa de estorno e obrigatoria.';
  END IF;

  SELECT id, status, kind, cash_box_id, destination_cash_box_id,
         amount_cents, amount, module, description, payment_method
    INTO v_orig
    FROM public.transactions
    WHERE id = p_transaction_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lancamento nao encontrado.';
  END IF;

  IF v_orig.status <> 'confirmado' THEN
    RAISE EXCEPTION 'Apenas lancamentos confirmados podem ser estornados. Status atual: %', v_orig.status;
  END IF;

  IF v_orig.kind = 'transferencia' AND v_orig.destination_cash_box_id IS NOT NULL THEN
    PERFORM public.fn_lock_dois_caixas(v_orig.cash_box_id, v_orig.destination_cash_box_id);
  ELSE
    PERFORM public.fn_lock_caixa(v_orig.cash_box_id);
  END IF;

  UPDATE public.transactions
    SET status = 'estornado',
        reverse_reason = trim(p_reverse_reason),
        updated_at = now()
    WHERE id = p_transaction_id;

  v_comp_kind := CASE
    WHEN v_orig.kind = 'receita'       THEN 'despesa'
    WHEN v_orig.kind = 'despesa'       THEN 'receita'
    WHEN v_orig.kind = 'transferencia' THEN 'transferencia'
  END;

  IF v_orig.kind = 'transferencia' THEN
    v_comp_box  := v_orig.destination_cash_box_id;
    v_comp_dest := v_orig.cash_box_id;
  ELSE
    v_comp_box  := v_orig.cash_box_id;
    v_comp_dest := NULL;
  END IF;

  -- FIX: saldo so e verificado para estorno de transferencia.
  -- Estornar receita = anular entrada (sem consumo de saldo).
  -- Estornar despesa = devolver dinheiro (sempre seguro).
  IF v_orig.kind = 'transferencia' THEN
    IF public.fn_saldo_disponivel(v_comp_box) < v_orig.amount_cents THEN
      RAISE EXCEPTION 'Saldo disponivel insuficiente no caixa de destino "%" para reverter a transferencia.', v_comp_box;
    END IF;
  END IF;

  INSERT INTO public.transactions (
    cash_box_id, destination_cash_box_id, module, kind,
    amount_cents, amount, category, description,
    payment_method, date, status,
    original_transaction_id, reverse_reason,
    created_by, approved_by, approved_at
  ) VALUES (
    v_comp_box, v_comp_dest, v_orig.module, v_comp_kind,
    v_orig.amount_cents, v_orig.amount,
    'Estorno', 'Estorno: ' || v_orig.description || ' - ' || trim(p_reverse_reason),
    v_orig.payment_method, current_date, 'confirmado',
    v_orig.id, trim(p_reverse_reason),
    v_uid, v_uid, now()
  )
  RETURNING id INTO v_comp_id;

  INSERT INTO public.transaction_audit_logs (transaction_id, action, old_data, new_data, changed_by)
  VALUES (p_transaction_id, 'ESTORNO',
    jsonb_build_object('status', 'confirmado'),
    jsonb_build_object('status', 'estornado', 'reverse_reason', trim(p_reverse_reason),
                       'compensating_id', v_comp_id),
    v_uid);

  INSERT INTO public.transaction_audit_logs (transaction_id, action, new_data, changed_by)
  VALUES (v_comp_id, 'INSERT',
    jsonb_build_object('kind', v_comp_kind, 'amount_cents', v_orig.amount_cents,
                       'original_transaction_id', p_transaction_id, 'status', 'confirmado'),
    v_uid);

  RETURN v_comp_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sp_estornar_transacao(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.sp_estornar_transacao(uuid, text) TO authenticated;

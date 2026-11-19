-- Migration 0009: sp_deletar_transacao_admin
-- Exclusao fisica de transacao — exclusivo para Admin.
-- Remove o registro e qualquer log de auditoria vinculado.
-- AVISO: irreversivel, sem rastro contabil. Use estorno sempre que possivel.

CREATE OR REPLACE FUNCTION public.sp_deletar_transacao_admin(
  p_transaction_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sessao invalida.';
  END IF;

  IF NOT public.has_role(v_uid, 'admin') THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem excluir movimentacoes fisicamente.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.transactions WHERE id = p_transaction_id) THEN
    RAISE EXCEPTION 'Movimentacao nao encontrada.';
  END IF;

  -- Remove logs de auditoria vinculados primeiro (FK ON DELETE RESTRICT)
  DELETE FROM public.transaction_audit_logs
    WHERE transaction_id = p_transaction_id;

  -- Remove a transacao
  DELETE FROM public.transactions
    WHERE id = p_transaction_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sp_deletar_transacao_admin(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.sp_deletar_transacao_admin(uuid) TO authenticated;

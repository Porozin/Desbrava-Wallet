-- PostgREST retornava 400 "cardinality violation" (SQLSTATE 21000) quando a SP
-- retornava jsonb — o PostgREST tenta mapear o retorno como tabela e falha.
-- Solução: mudar para RETURNS void (o frontend só verifica se houve erro).
DROP FUNCTION IF EXISTS public.sp_wipe_all_data(boolean);

CREATE FUNCTION public.sp_wipe_all_data(p_include_users boolean DEFAULT false)
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

  IF NOT (public.is_financial_manager(v_uid) OR public.has_role(v_uid, 'admin')) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores ou gestores financeiros.';
  END IF;

  -- Desabilita RLS para esta transacao (permissao ja verificada acima)
  SET LOCAL row_security = off;

  DELETE FROM public.transaction_audit_logs;
  DELETE FROM public.transaction_reservations;
  DELETE FROM public.avarias;
  DELETE FROM public.produtos;
  DELETE FROM public.materiais;
  DELETE FROM public.dividas;
  DELETE FROM public.metas;
  DELETE FROM public.transactions;
  DELETE FROM public.ai_pending_operations;
  DELETE FROM public.ai_conversations;

  IF p_include_users THEN
    DELETE FROM auth.users;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sp_wipe_all_data(boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.sp_wipe_all_data(boolean) TO authenticated;

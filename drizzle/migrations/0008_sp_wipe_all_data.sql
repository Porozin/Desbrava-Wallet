-- =============================================================================
-- Migration 0008: sp_wipe_all_data
-- Limpeza total do sistema com opcao de apagar ou preservar usuarios.
-- Apenas admin ou gestor financeiro pode chamar esta funcao.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sp_wipe_all_data(p_include_users boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid             uuid := auth.uid();
  v_cnt_audit       bigint := 0;
  v_cnt_reservations bigint := 0;
  v_cnt_avarias     bigint := 0;
  v_cnt_produtos    bigint := 0;
  v_cnt_materiais   bigint := 0;
  v_cnt_dividas     bigint := 0;
  v_cnt_metas       bigint := 0;
  v_cnt_transactions bigint := 0;
  v_cnt_users       bigint := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sessao invalida.';
  END IF;

  IF NOT (public.is_financial_manager(v_uid) OR public.has_role(v_uid, 'admin')) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores ou gestores financeiros podem executar limpeza total.';
  END IF;

  -- 1. Auditoria primeiro (referencia transactions e reservations)
  DELETE FROM public.transaction_audit_logs;
  GET DIAGNOSTICS v_cnt_audit = ROW_COUNT;

  -- 2. Reservas (referencia transactions indiretamente via auditoria ja deletada)
  DELETE FROM public.transaction_reservations;
  GET DIAGNOSTICS v_cnt_reservations = ROW_COUNT;

  -- 3. Dados operacionais (sem dependencias entre si)
  DELETE FROM public.avarias;
  GET DIAGNOSTICS v_cnt_avarias = ROW_COUNT;

  DELETE FROM public.produtos;
  GET DIAGNOSTICS v_cnt_produtos = ROW_COUNT;

  DELETE FROM public.materiais;
  GET DIAGNOSTICS v_cnt_materiais = ROW_COUNT;

  DELETE FROM public.dividas;
  GET DIAGNOSTICS v_cnt_dividas = ROW_COUNT;

  DELETE FROM public.metas;
  GET DIAGNOSTICS v_cnt_metas = ROW_COUNT;

  -- 4. Transacoes por ultimo (referenciada por audit e reservations, ja deletados)
  DELETE FROM public.transactions;
  GET DIAGNOSTICS v_cnt_transactions = ROW_COUNT;

  -- 5. Usuarios (opcional)
  IF p_include_users THEN
    DELETE FROM auth.users;
    GET DIAGNOSTICS v_cnt_users = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'transaction_audit_logs',   v_cnt_audit,
    'transaction_reservations',  v_cnt_reservations,
    'avarias',                   v_cnt_avarias,
    'produtos',                  v_cnt_produtos,
    'materiais',                 v_cnt_materiais,
    'dividas',                   v_cnt_dividas,
    'metas',                     v_cnt_metas,
    'transactions',              v_cnt_transactions,
    'auth_users',                v_cnt_users
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sp_wipe_all_data(boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.sp_wipe_all_data(boolean) TO authenticated;

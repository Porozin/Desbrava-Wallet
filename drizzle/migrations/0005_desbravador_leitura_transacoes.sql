-- Migration 0005: Liberar visualização de valores e movimentações para desbravadores e membros
-- Garante transparência financeira para todos os usuários autenticados do clube Guerreiros do Alto,
-- preservando a integridade das travas de gravação (apenas Admin/Diretor/Tesoureiro podem lançar/modificar).

-- 1. Transações: remover restrições de SELECT anteriores e liberar para todos os autenticados
DROP POLICY IF EXISTS "Cash team sees all, others see own" ON public.transactions;
DROP POLICY IF EXISTS "tx_select" ON public.transactions;
DROP POLICY IF EXISTS "tx_select_todos_autenticados" ON public.transactions;

CREATE POLICY "tx_select_todos_autenticados" ON public.transactions
  FOR SELECT TO authenticated
  USING (true);

-- 2. Reservas de Caixa: garantir visibilidade de saldos bloqueados/reservados
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transaction_reservations') THEN
    EXECUTE 'DROP POLICY IF EXISTS "res_select" ON public.transaction_reservations';
    EXECUTE 'DROP POLICY IF EXISTS "res_select_todos_autenticados" ON public.transaction_reservations';
    EXECUTE 'CREATE POLICY "res_select_todos_autenticados" ON public.transaction_reservations FOR SELECT TO authenticated USING (true)';
  END IF;
END $$;

-- 3. Atualizar tabela de produtos para suportar ficha técnica (ingredientes vinculados a materiais)
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS modulo text DEFAULT 'vendas';
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS ingredientes jsonb DEFAULT '[]'::jsonb;

-- Garantir políticas de leitura e gravação em produtos
DROP POLICY IF EXISTS "Todos autenticados leem produtos" ON public.produtos;
DROP POLICY IF EXISTS "produtos_select_autenticados" ON public.produtos;
CREATE POLICY "produtos_select_autenticados" ON public.produtos
  FOR SELECT TO authenticated
  USING (true);

-- 4. Garantir leitura de materiais e avarias para todos os autenticados
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'materiais') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Todos autenticados leem materiais" ON public.materiais';
    EXECUTE 'DROP POLICY IF EXISTS "materiais_select_autenticados" ON public.materiais';
    EXECUTE 'CREATE POLICY "materiais_select_autenticados" ON public.materiais FOR SELECT TO authenticated USING (true)';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'avarias') THEN
    EXECUTE 'DROP POLICY IF EXISTS "avarias_select_autenticados" ON public.avarias';
    EXECUTE 'CREATE POLICY "avarias_select_autenticados" ON public.avarias FOR SELECT TO authenticated USING (true)';
  END IF;
END $$;


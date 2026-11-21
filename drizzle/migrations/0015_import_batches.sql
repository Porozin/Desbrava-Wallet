-- Migration 0015: Importação Inteligente em Lote
-- Guarda cada lote de importação para auditoria e undo.

CREATE TABLE IF NOT EXISTS public.import_batches (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  texto_original text NOT NULL,
  total_itens   int  NOT NULL DEFAULT 0,
  itens_importados int NOT NULL DEFAULT 0,
  status        text NOT NULL DEFAULT 'confirmado' CHECK (status IN ('confirmado', 'desfeito')),
  resumo        jsonb
);

ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;

-- Usuários autenticados veem apenas seus próprios lotes
CREATE POLICY import_batches_own ON public.import_batches
  FOR ALL TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Managers veem todos
CREATE POLICY import_batches_managers ON public.import_batches
  FOR SELECT TO authenticated
  USING (public.is_financial_manager(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

-- Coluna batch_id em transactions (para poder desfazer um lote)
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS import_batch_id uuid REFERENCES public.import_batches(id) ON DELETE SET NULL;

-- Coluna batch_id em dividas
ALTER TABLE public.dividas
  ADD COLUMN IF NOT EXISTS import_batch_id uuid REFERENCES public.import_batches(id) ON DELETE SET NULL;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.import_batches;

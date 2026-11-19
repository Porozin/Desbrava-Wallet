-- =============================================================================
-- Migration 0010: Atlas AI Foundation
-- Tabelas para historico de conversas e operacoes pendentes de confirmacao.
-- =============================================================================

-- Historico de conversas do Atlas AI
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id  uuid NOT NULL,
  role        text NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
  content     text NOT NULL,
  tool_calls  jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_session
  ON public.ai_conversations (user_id, session_id, created_at DESC);

GRANT SELECT, INSERT ON public.ai_conversations TO authenticated;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

-- Cada usuario so le/escreve suas proprias mensagens
CREATE POLICY ai_conv_own ON public.ai_conversations
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Operacoes propostas pelo AI aguardando confirmacao do usuario
CREATE TABLE IF NOT EXISTS public.ai_pending_operations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id          uuid NOT NULL,
  operation_type      text NOT NULL,
  operation_params    jsonb NOT NULL,
  confirmation_token  text NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  expires_at          timestamptz NOT NULL DEFAULT (now() + interval '5 minutes'),
  status              text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'confirmed', 'expired', 'cancelled')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  executed_at         timestamptz
);

CREATE INDEX IF NOT EXISTS idx_ai_pending_user ON public.ai_pending_operations (user_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_pending_token ON public.ai_pending_operations (confirmation_token) WHERE status = 'pending';

GRANT SELECT, INSERT, UPDATE ON public.ai_pending_operations TO authenticated;
ALTER TABLE public.ai_pending_operations ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_pending_own ON public.ai_pending_operations
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

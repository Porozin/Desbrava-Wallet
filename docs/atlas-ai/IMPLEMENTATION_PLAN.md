# Roadmap de Implementacao - Atlas AI

> Plano estruturado em fases para integrar o Atlas AI ao GDACaixa sem quebrar funcionalidades existentes.

---

## FASE 0 - Fundacao (Prerequisitos)

**Objetivo:** Preparar o repositorio e o banco para receber a integracao, sem nenhuma mudanca nas telas existentes.

### Arquivos Criados

- docs/atlas-ai/AUDIT.md (este diagnostico)
- docs/atlas-ai/ARCHITECTURE.md
- docs/atlas-ai/IMPLEMENTATION_PLAN.md
- docs/atlas-ai/SECURITY.md
- docs/atlas-ai/COSTS.md
- src/lib/atlasTools.ts (apenas tipos, sem implementacao)

### Mudancas no Banco

Nenhuma.

### Criterios de Conclusao

- [ ] Documentacao revisada e aprovada pela equipe
- [ ] Decisao sobre modelo Gemini confirmada
- [ ] Chaves de API solicitadas (GEMINI_API_KEY, SUPABASE_SERVICE_ROLE_KEY)
- [ ] Supabase CLI configurado para deploy de Edge Functions
- [ ] atlasTools.ts com tipos basicos exportados

---

## FASE 1 - Backend: Edge Function + Ferramentas de Leitura

**Objetivo:** O AI pode responder perguntas sobre saldos, transacoes e metas em linguagem natural. Nenhuma operacao de escrita ainda.

### Funcionalidades

- Receber mensagem do usuario via POST autenticado
- Revalidar JWT e extrair role
- Montar system prompt com contexto financeiro resumido
- Chamar Gemini com function calling
- Executar ferramentas de leitura: get_saldo_consolidado, get_saldo_caixa, get_transacoes_recentes, get_metas, get_resumo_mensal, get_produtos, get_ranking_vendedores, get_dividas
- Persistir conversa em ai_conversations
- Retornar resposta ao frontend

### Arquivos

- supabase/functions/atlas-ai/index.ts (ponto de entrada da Edge Function)
- supabase/functions/atlas-ai/providers.ts (interface AIProvider + GeminiProvider)
- supabase/functions/atlas-ai/tools.ts (implementacao das ferramentas de leitura)
- supabase/functions/atlas-ai/context.ts (montagem do system prompt e contexto financeiro)
- src/lib/atlasTools.ts (tipos compartilhados e schema JSON das ferramentas)

### Banco de Dados

Migration 0010 - tabela ai_conversations:

```sql
CREATE TABLE ai_conversations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id  uuid NOT NULL,
  role        text NOT NULL CHECK (role IN (user, assistant, tool)),
  content     text NOT NULL,
  tool_calls  jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_conv_session ON ai_conversations(session_id, created_at);
CREATE INDEX idx_ai_conv_user    ON ai_conversations(user_id, created_at);
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_conversations ON ai_conversations
  FOR ALL USING (user_id = auth.uid());
```

### Variaveis de Ambiente (Supabase Secrets)

```
GEMINI_API_KEY=<chave do Google AI Studio>
SUPABASE_SERVICE_ROLE_KEY=<service_role do projeto>
```

Essas variaveis existem APENAS na Edge Function. Nunca no .env do frontend.

### Dependencias

- Conta Google Cloud com Gemini API habilitada
- Supabase CLI instalado (supabase functions deploy)
- Migration 0010 aplicada em producao

### Riscos

- Gemini API pode ter latencia variavel (2-8 segundos por requisicao)
- Custo por token comeca a contar a partir do primeiro deploy
- Edge Function tem limite de execucao (verificar timeout no Supabase)

### Criterios de Conclusao

- [ ] POST /functions/v1/atlas-ai retorna resposta coerente em < 10s
- [ ] Responde corretamente: Qual o saldo total? Com os dados reais do banco
- [ ] Responde corretamente: Quais as ultimas 5 transacoes do caixa doceria?
- [ ] Mensagens persistidas em ai_conversations
- [ ] JWT invalido retorna 401
- [ ] Role sem acesso retorna 403

### Testes Necessarios

- Teste de integracao: POST com JWT valido retorna 200 com texto coerente
- Teste de autenticacao: JWT expirado retorna 401
- Teste de ferramentas: cada ferramenta de leitura retorna dados do banco
- Teste de persistencia: mensagens aparecem em ai_conversations

---

## FASE 2 - Frontend: Componente de Chat

**Objetivo:** Interface de chat integrada ao AppShell. Apenas leitura - sem operacoes de escrita ainda.

### Funcionalidades

- Drawer de chat abre via botao flutuante (FAB) ou item na BottomNav
- Input de texto para o usuario digitar mensagens
- Exibicao de historico de mensagens da sessao atual
- Estado de loading durante aguardo da resposta
- Exibicao de erros de forma amigavel
- Scroll automatico para a ultima mensagem
- Markdown basico nas respostas (negrito, listas, valores em BRL)

### Arquivos

- src/components/m3/AtlasAiDrawer.tsx (componente principal do chat)
- src/hooks/useAtlasAi.ts (hook React para comunicacao com a Edge Function)
- src/components/m3/AiMessage.tsx (renderizacao de uma mensagem individual)
- src/components/m3/AiInputBar.tsx (campo de input + botao de envio)

### Integracao com AppShell

Opcao recomendada: botao flutuante (FAB) no canto inferior direito com icone de chat. Ao clicar, abre AtlasAiDrawer como um Sheet (modal bottom sheet no mobile, drawer lateral no desktop). Nao altera a navegacao existente.

### Hook useAtlasAi

```typescript
// src/hooks/useAtlasAi.ts
export function useAtlasAi() {
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [sessionId] = useState(() => crypto.randomUUID());
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async (content: string) => {
    // adiciona mensagem do usuario ao estado local
    // POST para a Edge Function com JWT do supabase.auth.getSession()
    // adiciona resposta ao estado local
    // em caso de erro: exibir mensagem amigavel
  };

  return { messages, isLoading, sendMessage };
}
```

### Criterios de Conclusao

- [ ] Drawer abre e fecha sem quebrar outras rotas
- [ ] Mensagem enviada aparece imediatamente no historico
- [ ] Resposta do AI aparece apos carregamento
- [ ] Estado de loading exibido corretamente
- [ ] Erros de rede exibidos de forma amigavel
- [ ] Funciona no mobile (PWA) e no desktop

### Testes Necessarios

- Teste de UI: drawer abre e fecha
- Teste de integracao: mensagem enviada chega na Edge Function
- Teste de responsividade: layout funciona em 375px e 1280px
- Teste de PWA: funciona sem reconexao durante conversa

---

## FASE 3 - Operacoes de Escrita com Confirmacao

**Objetivo:** O AI pode propor lancamentos, transferencias e estornos. O usuario confirma ou cancela antes da execucao.

### Funcionalidades

- Ferramentas de escrita na Edge Function: registrar_receita, registrar_despesa, registrar_transferencia, estornar_transacao, criar_reserva, liberar_reserva, solicitar_despesa (conselheiros)
- Sistema de tokens de confirmacao (ver ARCHITECTURE.md secao 7)
- Componente OperationProposal renderiza proposta com detalhes da operacao
- Botoes Confirmar e Cancelar na proposta
- Expiracoes de 5 minutos com countdown visivel
- Endpoint separado para confirmacao: POST /functions/v1/atlas-ai/confirm

### Arquivos

- supabase/functions/atlas-ai/index.ts (adicionar rota /confirm)
- supabase/functions/atlas-ai/tools.ts (adicionar ferramentas de escrita)
- src/components/m3/OperationProposal.tsx (card de confirmacao)
- src/hooks/useAtlasAi.ts (adicionar confirmOperation e cancelOperation)

### Banco de Dados

Migration 0011 - tabela ai_pending_operations (schema completo em ARCHITECTURE.md secao 7)

### Fluxo de Confirmacao

1. Usuario pede lancamento via chat
2. Edge Function cria registro em ai_pending_operations com token UUID e expiracao 5min
3. Frontend exibe OperationProposal com detalhes e countdown
4. Usuario clica Confirmar
5. Frontend POST /confirm com token (apenas o token, sem params - params vem do banco)
6. Edge Function valida token, JWT, role e executa RPC
7. Resultado retorna ao frontend

### Riscos

- Usuario pode abandonar proposta sem confirmar (token expira automaticamente em 5min)
- Proposta expirada durante confirmacao retorna 404 - tratar no frontend
- Role do usuario pode mudar entre proposta e confirmacao - verificar novamente na confirmacao

### Criterios de Conclusao

- [ ] Proposta de lancamento exibida com valores corretos antes da execucao
- [ ] Confirmacao executa a RPC correta com os params corretos
- [ ] Token expirado retorna erro claro ao usuario
- [ ] Reuso de token retorna erro
- [ ] Cancelamento marca status como cancelled sem executar nada
- [ ] Conselheiro so ve solicitar_despesa, nao registrar_receita

### Testes Necessarios

- Teste de fluxo completo: proposta -> confirmacao -> transacao criada no banco
- Teste de expiracao: token expirado retorna 404
- Teste de reuso: segundo POST com mesmo token retorna 409
- Teste de role: conselheiro nao consegue propor registrar_receita
- Teste de manipulacao: params diferentes no POST de confirmacao sao ignorados

---

## FASE 4 - Historico, Contexto e Refinamentos

**Objetivo:** Melhorar a qualidade das respostas, adicionar historico persistente entre sessoes e controlar custos.

### Funcionalidades

- Historico de conversas persistente: usuario pode ver conversas anteriores
- Contexto multi-turno: ultimas 5 mensagens enviadas ao Gemini para manter coerencia
- Resumo financeiro automatico no system prompt (calculado na Edge Function)
- Rate limiting: maximo 10 mensagens por usuario por hora (implementado na Edge Function verificando ai_conversations)
- Purge automatico: job diario remove registros de ai_conversations com mais de 90 dias
- Indicador de tokens usados (opcional, para monitoramento de custos)

### Arquivos

- supabase/functions/atlas-ai/ratelimit.ts (verificacao de rate limit por usuario)
- supabase/functions/atlas-ai/context.ts (aprimorar com historico de conversas)
- src/hooks/useAtlasAi.ts (adicionar loadHistory)
- src/components/m3/AtlasAiDrawer.tsx (selector de sessoes anteriores)

### Purge Automatico

Opcao 1: pg_cron no Supabase (plano Pro):
```sql
SELECT cron.schedule(
  purge-ai-conversations,
  0 2 * * *,
  DELETE FROM ai_conversations WHERE created_at < now() - interval 90 days
);
```
Opcao 2: Edge Function de manutencao chamada por webhook ou cron externo.

### Rate Limiting

```typescript
// supabase/functions/atlas-ai/ratelimit.ts
async function checkRateLimit(supabase, userId: string): Promise<boolean> {
  const { count } = await supabase
    .from(ai_conversations)
    .select(*)
    .eq(user_id, userId)
    .eq(role, user)
    .gte(created_at, new Date(Date.now() - 3600000).toISOString())
    .limit(10);
  return count < 10;
}
```

### Criterios de Conclusao

- [ ] Historico de conversa anterior visivel no drawer
- [ ] Rate limit bloqueia mensagem 11+ com mensagem clara ao usuario
- [ ] Purge automatico configurado e validado em staging
- [ ] Contexto multi-turno: AI lembra do que foi discutido nos ultimos turnos

### Testes Necessarios

- Teste de rate limit: 11 mensagens na mesma hora retorna 429
- Teste de historico: mensagens de sessao anterior aparecem ao reabrir o drawer
- Teste de purge: registros com mais de 90 dias sao removidos

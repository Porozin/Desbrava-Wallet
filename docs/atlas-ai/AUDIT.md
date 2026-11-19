# Diagnostico Tecnico - GDACaixa 2027

> Auditoria para embasar a integracao do Atlas AI.

---

## 1. Resumo Executivo

O GDACaixa e uma aplicacao financeira PWA construida sobre React 19, TanStack Start/Router e Supabase. O sistema gerencia multiplos caixas financeiros (geral, doceria, vendas) com controle de acesso por papeis hierarquicos e um modelo de seguranca baseado inteiramente em RPCs PostgreSQL com SECURITY DEFINER. Nenhuma operacao de escrita em transactions e permitida diretamente pelo cliente - tudo passa por stored procedures que verificam permissoes em tempo de execucao no banco.

A camada de logica financeira esta isolada em src/lib/finance.ts, composta por funcoes puras e testaveis que transformam dados brutos em metricas (saldo, serie mensal, comissoes por vendedor, margem de lucro). Essa separacao e uma vantagem direta: as mesmas funcoes que alimentam as telas podem alimentar o contexto enviado ao modelo de IA.

A autenticacao e baseada em JWT Supabase com sessao de 7 dias armazenada em localStorage. O guard de rota (_authenticated/route.tsx) bloqueia acesso nao autenticado no frontend, mas a autorizacao real e aplicada no PostgreSQL - cada RPC consulta is_financial_manager(auth.uid()) ou o papel especifico antes de executar qualquer escrita.

A integracao do Atlas AI exige a criacao de infraestrutura nova: uma Edge Function orquestradora, uma tabela de historico de conversas, uma tabela de operacoes pendentes de confirmacao e um componente de chat no frontend. Nenhum desses elementos existe atualmente. O projeto nao possui Edge Functions, SDK de IA, variaveis de ambiente para Gemini, tabela de chat nem qualquer mecanismo de rate limiting - toda essa camada precisara ser construida do zero.

---

## 2. Stack Tecnologica

| Camada | Tecnologia | Notas |
|---|---|---|
| Framework UI | React 19 | - |
| Roteamento | TanStack Router | - |
| Server-side | TanStack Start + Nitro | Deploy Vercel / Cloudflare Workers |
| Data fetching | TanStack Query v5 | - |
| Backend / DB | Supabase (PostgreSQL) | - |
| Autenticacao | Supabase Auth | JWT, 7 dias, localStorage |
| Estilizacao | Tailwind CSS | - |
| Componentes | Primitivos proprios em src/components/m3 | Material Design 3 |
| Linguagem | TypeScript | Strict mode |
| PWA | Service Worker | - |
| Deploy | Vercel ({"framework":"vite"}) / Cloudflare | - |
| Logica financeira | src/lib/finance.ts | Funcoes puras, testaveis |
| Wrappers de dados | src/lib/data.ts | Chamam RPCs Supabase |

---

## 3. Banco de Dados

### 3.1 Tabelas Principais

| Tabela | Finalidade |
|---|---|
| transactions | Registro central de todas as transacoes financeiras |
| cash_boxes | Definicao dos caixas (geral, doceria, vendas) |
| transaction_reservations | Reservas de valores dentro de um caixa |
| transaction_audit_logs | Log de auditoria imutavel de todas as operacoes |
| metas | Metas financeiras por modulo |
| materiais | Estoque de materiais |
| produtos | Catalogo de produtos |
| avarias | Registro de avarias em produtos/materiais |
| dividas | Controle de dividas |
| profiles | Perfil dos usuarios |
| user_roles | Mapeamento usuario - papel (role) |

### 3.2 RPCs Disponiveis (SECURITY DEFINER)

Todas as operacoes de escrita sao feitas exclusivamente via RPC. Nenhum INSERT/UPDATE direto na tabela transactions e permitido ao cliente.

| RPC | Parametros | Retorno | Permissao minima |
|---|---|---|---|
| sp_registrar_transacao_oficial | client_mutation_id, cash_box_id, kind, amount_cents, category, description, payment_method, date, seller | uuid | admin / diretor / tesoureiro |
| sp_registrar_transferencia | client_mutation_id, source_box, destination_box, amount_cents, description, date | uuid | admin / diretor / tesoureiro |
| sp_solicitar_despesa | cash_box_id, amount_cents, category, description, date, payment_method, client_mutation_id | uuid | conselheiro + gestores |
| sp_aprovar_solicitacao | transaction_id, payment_method | uuid | admin / diretor / tesoureiro |
| sp_rejeitar_solicitacao | transaction_id, rejection_reason | uuid | admin / diretor / tesoureiro |
| sp_estornar_transacao | transaction_id, reverse_reason | uuid | admin / diretor / tesoureiro |
| sp_criar_reserva | cash_box_id, title, amount_cents, description | uuid | admin / diretor / tesoureiro |
| sp_liberar_reserva | reservation_id | uuid | admin / diretor / tesoureiro |
| sp_consumir_reserva | reservation_id | uuid | admin / diretor / tesoureiro |
| sp_deletar_transacao_admin | transaction_id | void | admin apenas |
| sp_wipe_all_data | p_include_users | jsonb | admin / gestor - NUNCA expor ao AI |
| sp_resumo_transparencia_publica | p_ano, p_mes | jsonb | anon + authenticated |

---

## 4. Autenticacao e Autorizacao

### 4.1 Hierarquia de Papeis

```
admin > diretor > tesoureiro > conselheiro > desbravador
```

| Role | Capacidades |
|---|---|
| admin | Tudo, incluindo sp_deletar_transacao_admin e sp_wipe_all_data |
| diretor | Registrar transacoes, transferencias, aprovar/rejeitar, estornar, criar/liberar/consumir reservas |
| tesoureiro | Idem ao diretor |
| conselheiro | Solicitar despesas (sp_solicitar_despesa) apenas; leitura geral |
| desbravador | Leitura restrita |

### 4.2 Como a Autorizacao e Verificada

**Frontend:** Guard de rota em `_authenticated/route.tsx` impede acesso nao autenticado. E uma camada de UX, nao de seguranca real.

**Backend:** Cada RPC com SECURITY DEFINER executa is_financial_manager(auth.uid()) ou checa o papel especifico via user_roles diretamente no PostgreSQL. O JWT e extraido por auth.uid() do Supabase.

**Para o Atlas AI:** A Edge Function deve sempre passar o JWT do usuario ao cliente Supabase que faz leituras, para que o RLS se aplique. Operacoes de escrita via RPC ja verificam permissoes internamente no banco.

### 4.3 Variaveis de Ambiente Existentes

```
SUPABASE_URL=...
SUPABASE_PUBLISHABLE_KEY=...
```

Nao existem variaveis para service_role no .env do frontend - correto por design.

---

## 5. Modulos Financeiros Reutilizaveis pelo Atlas AI

### 5.1 Funcoes Puras em src/lib/finance.ts

| Funcao | Entrada | Saida | Uso no AI |
|---|---|---|---|
| toCents(value) | Valor decimal | Inteiro em centavos | Converter input do usuario antes de chamar RPC |
| fromCents(cents) | Inteiro em centavos | Valor decimal | Formatar valores na resposta |
| brl(cents) | Inteiro em centavos | String BRL | Exibir valores ao usuario |
| summarize(transactions[]) | Array de transacoes | {income, expenses, balance} | Contexto de saldo no prompt |
| summarizeBox(transactions[], cash_box_id) | Array + ID | Resumo do caixa | Responder perguntas sobre caixa especifico |
| consolidateAllBoxes(transactions[]) | Todas as transacoes | Resumo consolidado | Visao geral financeira |
| commissionBySeller(transactions[]) | Transacoes de venda | Map seller - comissao | Ranking de vendedores |
| monthlySeries(transactions[], months) | Transacoes + N meses | Array {month, income, expenses} | Analises temporais |
| profitMargin(income, expenses) | Dois numeros | Percentual de margem | Analise de rentabilidade |

### 5.2 Wrappers em src/lib/data.ts

O Atlas AI **nao deve** chamar estas funcoes diretamente do frontend. Elas devem ser espelhadas na Edge Function como ferramentas (tools) tipadas.

| Wrapper | RPC subjacente |
|---|---|
| addTransaction | sp_registrar_transacao_oficial |
| recordTransfer | sp_registrar_transferencia |
| requestExpense | sp_solicitar_despesa |
| approveExpenseRequest | sp_aprovar_solicitacao |
| rejectExpenseRequest | sp_rejeitar_solicitacao |
| reverseTransaction | sp_estornar_transacao |
| deleteTransaction | sp_deletar_transacao_admin |
| createReservation | sp_criar_reserva |
| releaseReservation | sp_liberar_reserva |
| consumeReservation | sp_consumir_reserva |
| wipeAllData | sp_wipe_all_data |

---

## 6. O que Existe e Pode Ser Reutilizado

- **Toda a camada de RPCs:** implementada, com verificacao de permissoes no banco. O AI apenas chama as RPCs certas, sem reimplementar logica financeira.
- **src/lib/finance.ts:** funcoes puras para calcular o contexto enviado ao modelo.
- **Sistema de roles e autenticacao:** o JWT do usuario ja carrega o papel; a Edge Function extrai isso para decidir quais ferramentas liberar.
- **transaction_audit_logs:** toda operacao executada pelo AI via RPC e auditada automaticamente pelas stored procedures existentes, sem codigo extra.
- **client_mutation_id:** mecanismo de idempotencia ja presente nas RPCs de escrita - impede duplicacoes em caso de retry.
- **Componentes M3 (src/components/m3):** o drawer de chat pode ser construido sobre os mesmos primitivos visuais do restante do app.
- **TanStack Query:** o useAtlasAi hook pode usar as mesmas convencoes de mutation/query ja estabelecidas no projeto.

---

## 7. O que Nao Existe e Precisara Ser Construido

| Componente | Descricao |
|---|---|
| supabase/functions/atlas-ai/ | Edge Function orquestradora |
| src/lib/atlasTools.ts | Definicao tipada das ferramentas do AI |
| src/components/m3/AtlasAiDrawer.tsx | Componente de chat no AppShell |
| src/hooks/useAtlasAi.ts | Hook React para comunicacao com a Edge Function |
| src/components/m3/OperationProposal.tsx | Componente de confirmacao de operacoes de escrita |
| Tabela ai_conversations | Historico persistente de conversas |
| Tabela ai_pending_operations | Operacoes propostas aguardando confirmacao |
| Migration 0010 | Criacao de ai_conversations |
| Migration 0011 | Criacao de ai_pending_operations |
| GEMINI_API_KEY | Supabase Secret na Edge Function |
| SUPABASE_SERVICE_ROLE_KEY | Supabase Secret na Edge Function apenas |
| Rate limiting | Controle de requisicoes por usuario por hora |
| Purge automatico | Job para limpar ai_conversations apos 90 dias |

---

## 8. Limitacoes e Riscos de Integracao

| Risco | Severidade | Descricao |
|---|---|---|
| Nenhuma Edge Function existe | Alto | Orquestracao AI criada do zero, sem template no projeto |
| service_role nao pode ir ao frontend | Critico | Vazamento comprometeria todo o banco |
| Prompt injection | Medio | Descricoes de transacoes podem tentar injetar comandos ao modelo |
| Operacoes de escrita sem confirmacao | Alto | O AI nao pode executar RPCs de escrita sem confirmacao explicita do usuario |
| Expiracao de sessao | Medio | JWT de 7 dias pode expirar durante conversa longa |
| sp_wipe_all_data | Critico | Esta RPC jamais deve ser exposta como ferramenta do AI |
| Rate limiting ausente | Medio | Sem controle, um usuario pode gerar custos desproporcionais de API |
| Custo de tokens | Medio | Contexto financeiro pode crescer rapidamente se nao for resumido |
| Sem fallback de provedor | Baixo | Atualmente so Gemini; interrupcao afeta toda a funcionalidade AI |

---

## 9. Pontos de Entrada Recomendados para a Integracao

1. **Criar as migrations do banco primeiro** (ai_conversations, ai_pending_operations) - desbloqueia desenvolvimento paralelo.
2. **Implementar a Edge Function com ferramentas de leitura apenas** (Fase 1) - valida o ciclo completo sem risco de escrita.
3. **Validar o componente de chat contra a Edge Function de leitura** antes de qualquer escrita.
4. **Adicionar ferramentas de escrita com confirmacao** (Fase 3) somente apos o sistema de tokens estar testado.
5. **Liberar gradualmente por role** - comecar com admin/diretor/tesoureiro no MVP.
6. **sp_resumo_transparencia_publica** e o ponto de entrada mais seguro: aceita anon e retorna dados sumarizados.

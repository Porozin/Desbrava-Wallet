# Analise de Custos e Infraestrutura - Atlas AI

> Estimativas baseadas em caracteristicas publicamente conhecidas dos servicos. Precos devem ser verificados diretamente na documentacao oficial antes de qualquer decisao, pois mudam com frequencia.

---

## 1. Modelos do Google Gemini Relevantes

| Modelo | Caracteristicas | Preco |
|---|---|---|
| Gemini 1.5 Flash | Rapido, baixo custo, janela de contexto grande (1M tokens), suporte a function calling | Verificar em ai.google.dev/pricing |
| Gemini 1.5 Pro | Maior capacidade de raciocinio, mais caro, janela 2M tokens | Verificar em ai.google.dev/pricing |
| Gemini 2.0 Flash | Sucessor do 1.5 Flash, latencia melhorada, suporte a function calling, preco competitivo | Verificar em ai.google.dev/pricing |

**Nota importante:** os precos do Gemini sao cobrados por milhao de tokens de entrada (input) e por milhao de tokens de saida (output) separadamente. Os valores mudam com frequencia. Sempre consultar ai.google.dev/pricing antes de estimar custos.

---

## 2. Modelo Recomendado para o MVP

**Gemini 2.0 Flash**

**Justificativa:**
- Menor custo por token entre os modelos Gemini com suporte a function calling
- Latencia mais baixa que o 1.5 Pro, essencial para chat responsivo
- Function calling (tool use) funcionando conforme necessario para o Atlas AI
- Janela de contexto suficiente para o volume de dados financeiros esperado
- Facilmente substituivel pelo 1.5 Pro se necessidades de raciocinio complexo emergirem, via interface AIProvider descrita em ARCHITECTURE.md

---

## 3. Estimativa de Tokens por Requisicao

| Componente | Tokens estimados | Notas |
|---|---|---|
| System prompt base | ~200 | Instrucoes de comportamento, restricoes, data atual |
| Contexto financeiro (saldos + resumo do mes) | ~150-250 | 3 caixas + totais, sem lista de transacoes |
| Historico de conversa (ultimas 5 mensagens) | ~100-250 | Varia com tamanho das mensagens |
| Mensagem do usuario | ~20-150 | Perguntas tipicas sao curtas |
| Definicao das ferramentas | ~300-500 | Schema JSON de 15 ferramentas |
| Resposta do modelo + tool calls | ~100-400 | Varia com complexidade da resposta |
| **Total estimado por interacao** | **~870-1750** | Inclui input e output |

**Estrategia de reducao:** o maior gasto evitavel e enviar lista completa de transacoes no contexto. Usar summarize() reduz de ~2000 tokens para ~200 tokens por requisicao.

---

## 4. Supabase Edge Functions

| Plano | Invocacoes incluidas | Preco adicional |
|---|---|---|
| Free | 500.000 invocacoes/mes | Verificar em supabase.com/pricing |
| Pro | Incluido no plano | Verificar em supabase.com/pricing |

Para o volume de uso esperado (5-20 usuarios ativos), o plano Free e suficiente em termos de invocacoes. O fator limitante sera o custo do Gemini, nao as invocacoes da Edge Function.

---

## 5. Estrategias para Reduzir Consumo

### 5.1 Resumir Contexto Financeiro

Em vez de enviar as ultimas 50 transacoes (potencialmente 3000+ tokens), enviar apenas o resumo calculado por summarize():
- Saldo atual de cada caixa: ~15 tokens por caixa
- Total de receitas e despesas do mes: ~20 tokens
- Numero de pendencias: ~10 tokens
- Total: ~75 tokens vs ~3000 sem resumo

### 5.2 Limitar Historico de Conversa

Enviar apenas as ultimas 5 mensagens ao Gemini. Mensagens mais antigas permanecem no banco para consulta mas nao consomem contexto.

### 5.3 Cache de Saldo

Cache com TTL de 60 segundos na memoria da Edge Function (ou KV do Cloudflare se disponivel). Evita query ao banco em cada mensagem de uma conversa ativa.

### 5.4 Rate Limiting

Limite de 10 mensagens por usuario por hora. Implementado verificando contagem de ai_conversations recentes antes de chamar o Gemini. Bloquear antes de consumir tokens.

### 5.5 Acesso por Role no MVP

Liberar o Atlas AI apenas para admin, diretor e tesoureiro no MVP. Conselheiros podem ser incluidos em versao posterior apos validar o custo real de uso.

---

## 6. Cenarios de Uso Estimados

### Cenario Leve: 5 usuarios ativos, 50 interacoes/mes por usuario

- Total de interacoes: 250/mes
- Tokens estimados: 250 x 1300 (media) = 325.000 tokens/mes
- Custo: verificar preco atual do Gemini 2.0 Flash em ai.google.dev/pricing
- Invocacoes Edge Function: 250 (bem abaixo do limite Free de 500k)

### Cenario Moderado: 10 usuarios ativos, 200 interacoes/mes por usuario

- Total de interacoes: 2.000/mes
- Tokens estimados: 2.000 x 1300 = 2.600.000 tokens/mes
- Custo: verificar preco atual em ai.google.dev/pricing
- Invocacoes Edge Function: 2.000 (ainda dentro do plano Free)

**Nota:** esses cenarios assumem que o rate limit de 10 msgs/hora/usuario esta ativo. Sem rate limit, o consumo pode ser multiplas vezes maior.

---

## 7. Armazenamento de Historico

Tabela ai_conversations com retenção de 90 dias:

- Tamanho estimado por mensagem: ~500 bytes (content text + tool_calls jsonb + metadados)
- Cenario leve 250 msgs/mes x 3 meses = 750 mensagens x 500 bytes = ~375 KB
- Cenario moderado 2000 msgs/mes x 3 meses = 6000 mensagens x 500 bytes = ~3 MB
- Dentro dos limites do Supabase Free (500 MB de banco)

Purge automatico sugerido:

```sql
-- via pg_cron (plano Pro) ou job externo
DELETE FROM ai_conversations
WHERE created_at < now() - interval 90 days;
```

---

## 8. Acesso por Role - Recomendacao para o MVP

Para controlar custos e risco na fase inicial:

| Role | Acesso no MVP | Justificativa |
|---|---|---|
| admin | Sim | Controle total, usuario de alto confianca |
| diretor | Sim | Usuario principal do sistema financeiro |
| tesoureiro | Sim | Usuario principal do sistema financeiro |
| conselheiro | Nao no MVP | Pode ser habilitado na Fase 4 apos validar custos |
| desbravador | Nao | Acesso nao planejado |

---

## 9. Itens que Precisam Ser Consultados Antes de Implementar

Lista de informacoes que requerem verificacao na documentacao oficial:

1. **Preco do Gemini 2.0 Flash** (input e output por milhao de tokens) — verificar em ai.google.dev/pricing
2. **Limite de requisicoes por minuto (RPM) do Gemini** — verificar em ai.google.dev/gemini-api/docs/rate-limits
3. **Timeout maximo de execucao de Edge Functions no Supabase** — verificar em supabase.com/docs/guides/functions
4. **Preco das invocacoes de Edge Functions no plano Pro** — verificar em supabase.com/pricing
5. **Disponibilidade de pg_cron no plano Free do Supabase** (para purge automatico) — verificar em supabase.com/docs/guides/database/extensions/pg_cron
6. **Limite de tamanho de payload da Edge Function** — verificar se respostas longas do Gemini cabem no limite
7. **Politica de retencao de logs de Edge Functions** no Supabase — relevante para debug em producao
8. **Google AI Studio vs Vertex AI para producao** — verificar se o uso em producao requer Vertex AI ao inves do Google AI Studio
9. **Suporte a streaming (Server-Sent Events) em Edge Functions** — para resposta em tempo real no chat sem esperar a resposta completa
10. **Rate limits do Supabase para RPC calls** — verificar se o volume de chamadas esperado esta dentro dos limites do plano

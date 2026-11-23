# GDACaixa 2027 by wallys

**Sistema financeiro PWA do Clube de Desbravadores Guerreiros do Alto.**

Gestao completa de tres caixas independentes (Geral, Doceria e Vendas Rapidas), com PDV, metas, dividas, relatorios, transparencia publica e assistente de IA — mobile-first, instalavel como app.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | TanStack Start 1.168 + TanStack Router 1.170 |
| UI | React 19, Tailwind CSS v4, Material Design 3 custom tokens |
| Animacoes | Motion (motion/react) v14 |
| Backend / DB | Supabase (PostgreSQL, Auth, RLS, Realtime, Edge Functions) |
| IA | NVIDIA NIM API — nvidia/nemotron-3.5-lightning-30b-a3b |
| Deploy | Vercel (Nitro adapter) |
| Testes | Vitest + Testing Library |
| ORM / Migrations | Drizzle Kit (drizzle/migrations/) |
| Componentes | Radix UI + shadcn/ui + Recharts + Vaul drawers |

---

## Pre-requisitos

- Node.js >= 20
- Bun (gerenciador de pacotes)
- Conta Supabase com projeto configurado
- Chave NVIDIA NIM API

---

## Instalacao



git clone https://github.com/Porozin/bright-wallet-atlas
cd bright-wallet-atlas
bun install



Configure .env:



VITE_SUPABASE_URL=https://<projeto>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
VITE_SUPABASE_PROJECT_ID=<projeto>



Aplique as migrations em drizzle/migrations/ na ordem numerica via Supabase Dashboard > SQL Editor.

bun run dev      # desenvolvimento
bun run build    # producao (Vercel/Nitro)
---

## Estrutura do Projeto


src/
  routes/
    __root.tsx              # Shell HTML, viewport meta, theme script
    _authenticated/
      index.tsx             # Dashboard consolidado
      clube.tsx             # Caixa Geral + Metas + Almoxarifado
      doceria.tsx           # Caixa Doceria + PDV + Insumos
      vendas.tsx            # Caixa Vendas + PDV + Avarias
      mais.tsx              # Perfil, relatorios, importacao, admin
    transparencia.tsx       # Pagina publica de transparencia
  components/m3/            # Primitivos Material Design 3
    AppShell.tsx            # Layout + dark mode + Atlas AI
    PdvGrid.tsx             # Ponto de Venda interativo
    AtlasAiDrawer.tsx       # Chat com assistente IA
    ImportarDrawer.tsx      # Importacao inteligente via IA
    ResponsiveTransactionList.tsx
    MetaProgressBar.tsx
  lib/
    finance.ts              # Regras financeiras puras
    data.ts                 # Hooks React Query + Supabase
    printReport.ts          # Gerador de PDF
  hooks/
    useTheme.ts             # Dark/light mode (useSyncExternalStore)
    useHaptic.ts            # Feedback haptico
    useImportarIA.ts        # Cliente da edge function
supabase/functions/
  atlas-ai/                 # Assistente financeiro (NVIDIA NIM)
  importar-ia/              # Extracao de texto via IA
  backup-scheduler/         # Backup automatico Google Drive
drizzle/migrations/         # 16 migrations numeradas (0000-0015)


---

## Funcionalidades

**Tres Caixas Financeiros Independentes** — Geral, Doceria e Vendas Rapidas. Transferencias internas contabilizadas sem distorcer o patrimonio consolidado.

**PDV (Ponto de Venda)** — Produtos com icone, cor e ficha tecnica de ingredientes. Ao confirmar, registra automaticamente receita + despesa de custo para contabilizar lucro real.

**Metas Financeiras** — Destinacao manual ou lucro automatico. Barra de progresso animada. Aportes reversiveis.

**Atlas AI** — Chat financeiro com NVIDIA Nemotron 30B. Le saldos em tempo real, propoe operacoes, so executa apos confirmacao do usuario (two-round tool calling).

**Importacao Inteligente** — Cole texto livre ou .txt. IA classifica cada linha, gera preview editavel com totais, destaca itens de baixa confianca, detecta duplicatas. Lote desfazivel.

**Controle de Dividas** — Pagamento parcial com barra de progresso, agendamento de exclusao automatica.

**Relatorios e Exportacao** — Balancete oficial para impressao, CSV, backup JSON, Google Drive via Apps Script.

**Transparencia Publica** — Rota /transparencia sem autenticacao para pais e comissao da igreja.

**RBAC (5 papeis)** — admin, diretor, tesoureiro, conselheiro, desbravador. RLS no banco reforça permissoes.
---

## Arquitetura


Browser (PWA)
    |
    +-- TanStack Router (SSR via Nitro/Vercel)
    |       +-- React 19 + Tailwind v4 + Motion
    |
    +-- React Query --> Supabase JS --> Supabase Cloud
    |                                    +-- PostgreSQL (RLS + stored procedures)
    |                                    +-- Auth (JWT)
    |                                    +-- Realtime (subscriptions)
    |
    +-- Edge Functions (Deno)
            +-- atlas-ai       --> NVIDIA NIM API
            +-- importar-ia    --> NVIDIA NIM API
            +-- backup-scheduler --> Google Drive webhook


> [!IMPORTANT]
> Toda a logica financeira vive em `src/lib/finance.ts` como funcoes puras. Componentes nunca calculam saldos — consomem `summarizeBox` / `consolidateAllBoxes`.

**Regras Financeiras Inegociaveis:**
- Calculos internos em centavos inteiros (evita IEEE 754)
- Transferencias internas nao somam receita nem despesa no consolidado
- Apenas `status = confirmar` entra no saldo oficial
- Reservas comprometem o saldo disponivel sem remover o saldo contabil
- Estorno gera transacao compensatoria — nunca deleta o original

---

## Testes

bun run test          # Vitest watch
bun run test --run    # Execucao unica (CI)

| Arquivo | Cobertura |
|---|---|
| finance.test.ts | toCents, summarize, consolidateAllBoxes, margens |
| fase1b.test.ts | RPCs oficiais, idempotencia, transferencias |
| fase2.test.ts | Consolidacao multi-caixa, reservas |
| fase5.test.ts | Relatorios, exportacao |
| MetaDrawer.test.tsx | Formulario de metas (criar/editar) |
| updateMeta.test.ts | aportarMeta, status de conclusao |
| wipe.test.ts | Limpeza total do sistema |

---

## Variaveis de Ambiente

| Variavel | Onde | Descricao |
|---|---|---|
| VITE_SUPABASE_URL | .env | URL do projeto Supabase |
| VITE_SUPABASE_PUBLISHABLE_KEY | .env | Chave anon/publishable |
| VITE_SUPABASE_PROJECT_ID | .env | ID do projeto |
| NVIDIA_API_KEY | Supabase Secrets | Chave NVIDIA NIM |
| SUPABASE_SERVICE_ROLE_KEY | Supabase Secrets | Service role para edge functions |

---

## Padroes de Codigo

- Funcoes financeiras puras em `src/lib/finance.ts` — sem imports React, sem efeitos
- Componentes em `src/components/m3/` — apenas tokens Tailwind, sem valores hardcoded
- Edge Functions em Deno TypeScript; autenticacao obrigatoria via JWT
- Mutations via stored procedures (`sp_registrar_transacao_oficial`, etc.) para garantir idempotencia e auditoria
- Novas colunas: criar `drizzle/migrations/NNNN_descricao.sql` e aplicar via Supabase Dashboard

---

## Contribuindo

1. Crie uma branch a partir de `main`
2. Nova tela: adicione em `src/routes/_authenticated/` e atualize o tipo union em `BottomNav.tsx`
3. Nova logica financeira: funcao pura em `finance.ts` com teste em `finance.test.ts`
4. Novo componente M3: use tokens existentes — sem cores hardcoded

---

## Licenca

Projeto privado do Clube de Desbravadores Guerreiros do Alto.
Uso restrito a organizacao. Nao licenciado para redistribuicao.
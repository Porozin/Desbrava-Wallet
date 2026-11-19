# CHANGELOG — GDACaixa

Todas as alterações notáveis deste projeto serão documentadas neste arquivo.

## [0.3.0] - 2026-11-18
### Fase 2 — Caixas e Movimentações (Concluída)
#### Adicionado
- **Componentes M3 Expressive de Gestão de Caixas:**
  - `CashBoxHeaderCard`: Cockpit financeiro dedicado por caixa com exibição de Saldo Disponível (livre), Saldo Contábil Total e Saldo Reservado (comprometido), além de resumo de receitas, despesas e transferências recebidas/enviadas.
  - `TransferDrawer`: Formulário responsivo de transferências entre os três caixas fixos com validação em tempo real contra o saldo disponível da origem e chamada da RPC `recordTransfer`.
  - `ReservationDrawer`: Painel completo de gestão de reservas de saldo com criação validada contra saldo disponível, listagem de reservas ativas e histórico, e ações de liberação (`releaseReservation`) e consumo (`consumeReservation`).
  - `ResponsiveTransactionList`: Histórico aprimorado com badges de caixa, situação (confirmado, pendente, estornado, rejeitado), sinalização relativa de transferências (+ no destino, − na origem), detalhes completos do lançamento e ação de estorno (`reverseTransaction`) com justificativa para gestores.
- **Telas e Rotas Adaptadas para os 3 Caixas:**
  - `src/routes/_authenticated/index.tsx`: Dashboard consolidado com os três caixas, patrimônio líquido invariante, botão de transferência rápida e atalhos para cada caixa.
  - `src/routes/_authenticated/clube.tsx`: Caixa Geral do Clube integrado com `CashBoxHeaderCard`, `useBoxTransactions("geral")`, `useReservations("geral")`, filtros por tipo e extrato em PDF atualizado.
  - `src/routes/_authenticated/doceria.tsx`: Caixa da Doceria integrado com `CashBoxHeaderCard`, métricas de margem de lucro operacional e insumos.
  - `src/routes/_authenticated/vendas.tsx`: Caixa de Vendas Rápidas integrado com `CashBoxHeaderCard`, catálogo, avarias e comissões.
- **Suite de Testes da Fase 2 (`src/lib/fase2.test.ts`):**
  - Validação de invariantes contábeis entre os 3 caixas e o consolidado oficial, neutralidade de transferências e impacto de reservas no saldo disponível.

#### Modificado
- `src/components/m3/parts.tsx`: `NewEntryFab` aprimorado com seletor de forma de pagamento (`dinheiro`, `pix`, `cartao_debito`, `cartao_credito`, `outro`) e vinculação a `boxId`.
- `src/routes/_authenticated/mais.tsx`: Exportação de planilha CSV enriquecida com identificador de caixa, forma de pagamento e situação da transação.
- `src/lib/printReport.ts`: Suporte visual adequado para transferências internas nos extratos impressos.

## [0.2.1] - 2026-11-13
### Fase 1B — Fundação de Dados, Modelagem, Concorrência e Segurança (Concluída para Revisão)
#### Adicionado
- **Migração SQL Estruturada e Segura (`drizzle/migrations/`):**
  - `0003_enum_tesoureiro.sql`: Adiciona o valor `tesoureiro` ao enum `app_role` de forma isolada para transacionalidade segura no PostgreSQL.
  - `0004_fase1b_fundacao.sql`: Modelagem completa dos 3 caixas fixos (`geral`, `doceria`, `vendas`) mais caixa especial inativo `_quarentena`.
  - `0004_rollback_seguro.sql`: Script de reversão controlada e não-destrutiva (sem `DROP TABLE` e sem concessões `allow_all_transactions`).
  - Tabela `transaction_reservations` com controle de estados (`ativa`, `liberada`, `consumida`) e auditoria.
  - Tabela de auditoria append-only `transaction_audit_logs` com trigger de bloqueio total de `UPDATE` e `DELETE` e integridade referencial `ON DELETE RESTRICT`.
  - RPCs atômicas server-side protegidas (`SECURITY DEFINER`, `SET search_path = ''`, referências totalmente qualificadas por schema e `REVOKE` de public/anon):
    - `sp_registrar_transacao_oficial`: Idempotência estrita com detecção de divergência de parâmetros, advisory locks e validação de saldo disponível para despesas.
    - `sp_registrar_transferencia`: Atomicidade total com locking ordenado em ambos os caixas e neutralidade contábil.
    - `sp_solicitar_despesa`: Solicitação preliminar de conselheiro com status forçado para `pendente` e suporte a idempotência.
    - `sp_aprovar_solicitacao` e `sp_rejeitar_solicitacao`: Governança de aprovação com bloqueio de auto-aprovação, validação de saldo e motivo obrigatório em rejeições.
    - `sp_estornar_transacao`: Estorno com transação compensatória oficial, validação de saldo no caixa devedor e trilha imutável.
    - `sp_criar_reserva`, `sp_liberar_reserva`, `sp_consumir_reserva`: Bloqueio de saldo sem transferência inter-caixas.
- **Suite de Testes da Fase 1B (`src/lib/fase1b.test.ts`):**
  - Implementação dos 14 cenários de integridade financeira, concorrência, RLS, idempotência e bloqueio de adulterações.
- **Integração no Cliente (`src/lib/data.ts`):**
  - Implementação e harmonização dos wrappers tipados para chamada de todas as RPCs (transferências, despesas, aprovações, estornos e reservas) com parâmetros exatos e fallback seguro para o schema legado.

#### Modificado
- `src/lib/finance.ts`: Adicionado status `rejeitado` e campos de solicitação/aprovação na interface `Transaction`.
- `drizzle/migrations/0004_fase1b_fundacao.sql`: Atualização do check constraint legado `transactions_kind_check` para suportar `transferencia`.

#### Removido
- Removido arquivo obsoleto `drizzle/migrations/0003_fase1b_fundacao_modelagem_seguranca.sql` substituído pela separação segura 0003 + 0004.

## [0.2.0] - 2026-11-13
### Fase 1A — Núcleo Financeiro (Concluída)
#### Adicionado
- **Módulo Financeiro Centralizado (`src/lib/finance.ts`):**
  - Funções de conversão monetária segura: `toCents()`, `fromCents()`, `sumCents()`, `brl()`, `brlFromCents()`.
  - Cálculo de saldos independentes por caixa: `summarizeBox()`.
  - Consolidação oficial invariante com neutralidade de transferências: `consolidateAllBoxes()`.
  - Tratamento contábil de reservas de saldo (`CashReservation`).
  - Tratamento de status de transações (`pendente`, `confirmado`, `estornado`, `corrigido`).
- **Testes Automatizados (`src/lib/finance.test.ts`):**
  - Cobertura dos 10 cenários obrigatórios de integridade monetária e contábil.
- **Documentação Técnica Inicial:**
  - Criação do `README.TECHNICAL.md` com especificação da arquitetura matemática e financeira.

#### Modificado
- **Integração de Dados (`src/lib/data.ts`):**
  - Adicionado suporte a `amount_cents` na recuperação de transações.
  - Inclusão do papel `tesoureiro` no enum de funções e no `ROLE_LABEL`.
  - Restrição de gravação oficial em `useCanRecord` exclusivamente para `admin`, `diretor` e `tesoureiro` (conselheiros não gravam como confirmado direto).

#### Corrigido
- Eliminado risco de imprecisão de ponto flutuante em operações monetárias.
- Eliminado risco de transferências inflarem artificialmente o resultado consolidado do clube.


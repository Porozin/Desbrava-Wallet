# Implementation Plan: GDACaixa Fixes

## Overview

Three targeted fixes for the GDACaixa 2027 PWA: (1) correct the reversal stored procedure so that reversing a revenue entry no longer triggers a false insufficient-balance error; (2) add edit/delete support for goals (metas) and surface completed goals on the dashboard; (3) extend the wipe-data flow with an option to also delete user accounts, backed by a new Supabase RPC.

## Tasks

- [x] 1. Fix `sp_estornar_transacao` — remove spurious balance check on revenue reversal
  - [x] 1.1 Write migration SQL to recreate `sp_estornar_transacao`
    - Create `drizzle/migrations/0007_fix_estorno_receita.sql`
    - Recreate the function so the `v_comp_kind = 'despesa'` branch (reversal of a revenue) does **not** call `fn_saldo_disponivel`
    - Keep the balance check only in the transfer-reversal branch (`v_comp_kind` derived from `transferencia`)
    - The `receita` reversal branch (compensatory `receita`) needs no check either
    - _Requirements: Item 1 — Estorno: corrigir erro de saldo insuficiente ao estornar receitas_

  - [x] 1.2 Verify migration applies cleanly and existing reversal tests still pass
    - Confirm the function signature and return type are unchanged so `reverseTransaction` in `src/lib/data.ts` requires no edits
    - _Requirements: Item 1_

- [ ] 2. Checkpoint — Estorno fix
  - Ensure the migration file is syntactically valid SQL and the function compiles. Ask the user if any clarification is needed before proceeding.

- [x] 3. Add `updateMeta` and realtime subscription to `src/lib/data.ts`
  - [x] 3.1 Implement `updateMeta` function
    - Add `updateMeta(id: string, changes: Partial<Pick<Meta, 'descricao' | 'valor_alvo' | 'status'>>)` that calls `supabase.from("metas").update(changes).eq("id", id).select().single()`
    - Export the function alongside `addMeta` and `deleteMeta`
    - _Requirements: Item 2a_

  - [x] 3.2 Add Supabase realtime subscription to `useMetas`
    - Mirror the existing realtime pattern used in the transactions hook
    - Subscribe to `postgres_changes` on the `metas` table and call `queryClient.invalidateQueries` on INSERT/UPDATE/DELETE
    - Clean up subscription on unmount
    - _Requirements: Item 2a_

  - [x] 3.3 Write unit tests for `updateMeta`
    - Mock Supabase client and assert correct table, filter, and payload are sent
    - Test error propagation when Supabase returns an error
    - _Requirements: Item 2a_

- [ ] 4. Create `src/components/m3/MetaDrawer.tsx`
  - [x] 4.1 Implement the MetaDrawer component scaffold
    - Create the file with a `MetaDrawer` component accepting props: `open: boolean`, `onOpenChange: (v: boolean) => void`, `meta?: Meta`
    - Use the existing M3 Drawer primitive (`src/components/ui/drawer.tsx`) for consistent shell
    - _Requirements: Item 2b_

  - [x] 4.2 Implement form fields and controlled state
    - Módulo field: `<select>` with options `clube | doceria | vendas | unidade`
    - Descrição field: text `<input>`
    - Valor Alvo field: numeric `<input>` (allow decimals, `min=0`)
    - Status field: `<select>` with options `pendente | aprovada | concluida` — render only when `meta` prop is defined (edit mode)
    - Initialise form state from `meta` when in edit mode, or empty for creation
    - _Requirements: Item 2b_

  - [x] 4.3 Wire Save and Delete actions
    - "Salvar" button calls `updateMeta` when `meta` prop present, `addMeta` otherwise; closes drawer on success
    - "Excluir" button (edit mode only, `text-error` colour token) shows an inline confirmation prompt before calling `deleteMeta`; closes drawer on success
    - Both actions use `useMutation` from React Query for optimistic error handling
    - _Requirements: Item 2b_

  - [ ] 4.4 Write unit tests for MetaDrawer
    - Render in creation mode: assert all fields empty, no Delete button
    - Render in edit mode: assert fields pre-filled, Delete button present
    - Simulate save in creation mode and verify `addMeta` is called with correct payload
    - Simulate save in edit mode and verify `updateMeta` is called
    - Simulate delete and verify confirmation gate before `deleteMeta` fires
    - _Requirements: Item 2b_

- [ ] 5. Integrate MetaDrawer into module pages
  - [ ] 5.1 Identify which route files render meta lists
    - Inspect `src/routes/_authenticated/clube.tsx`, `doceria.tsx`, `vendas.tsx` for meta list rendering
    - _Requirements: Item 2c_

  - [ ] 5.2 Add edit button to each meta list item
    - For each page that renders goals, add an edit icon button (lucide `Pencil`) beside each `Meta` item
    - On click, open `MetaDrawer` with the selected `meta` as prop
    - Ensure only users with appropriate role (at minimum `tesoureiro` or `admin`) see the edit button
    - _Requirements: Item 2c_

- [ ] 6. Add completed-goals banner to `src/routes/_authenticated/index.tsx`
  - [ ] 6.1 Import `useMetas` and filter for completed goals
    - Call `useMetas()` in the dashboard component
    - Derive `metasConcluidas = metas.filter(m => m.status === 'concluida')`
    - _Requirements: Item 2d_

  - [ ] 6.2 Render the banner card
    - Conditionally render a card below the consolidated balance when `metasConcluidas.length > 0`
    - Card styling: `bg-secondary-container` background, rounded M3 card shape
    - Header row: lucide `Trophy` icon + heading text "Metas Concluídas 🎉"
    - Body: list each meta with `descricao` and formatted `valor_alvo`
    - Footer: "Ver todas as metas" button that navigates to the relevant route
    - _Requirements: Item 2d_

- [ ] 7. Checkpoint — Metas
  - Ensure MetaDrawer opens correctly in both create and edit modes, the banner appears only when goals are completed, and realtime updates refresh the list. Ask the user if any clarification is needed before proceeding.

- [x] 8. Write migration SQL for `sp_wipe_all_data`
  - [x] 8.1 Create `drizzle/migrations/0008_sp_wipe_all_data.sql`
    - Define `sp_wipe_all_data(p_include_users boolean)` with `SECURITY DEFINER`
    - Guard: check caller has `is_financial_manager` OR `has_role('admin')`; raise exception otherwise
    - Core delete sequence (both modes): `transaction_audit_logs`, `transaction_reservations`, `avarias`, `produtos`, `materiais`, `dividas`, `metas`, `transactions` (order respects FK constraints)
    - When `p_include_users = true`: after the above, execute `DELETE FROM auth.users`
    - Return `jsonb` with per-table row counts: `{"transactions": N, "metas": N, ...}`
    - _Requirements: Item 3a_

  - [x] 8.2 Write integration test for `sp_wipe_all_data`
    - Seed minimal rows in each affected table, call RPC with `p_include_users = false`, assert all rows deleted and `auth.users` untouched
    - Call again with `p_include_users = true` and assert `auth.users` rows also removed
    - _Requirements: Item 3a_

- [x] 9. Update wipe functions in `src/lib/data.ts`
  - [x] 9.1 Refactor `wipeAllData` to use the new RPC
    - Replace the existing manual delete loop with `supabase.rpc("sp_wipe_all_data", { p_include_users: false })`
    - Surface the returned `jsonb` counts to the caller
    - _Requirements: Item 3b_

  - [x] 9.2 Add `wipeAllDataWithUsers` function
    - New export: `wipeAllDataWithUsers()` calls `supabase.rpc("sp_wipe_all_data", { p_include_users: true })`
    - _Requirements: Item 3b_

  - [x] 9.3 Write unit tests for the two wipe functions
    - Assert `wipeAllData` calls RPC with `p_include_users: false`
    - Assert `wipeAllDataWithUsers` calls RPC with `p_include_users: true`
    - _Requirements: Item 3b_

- [ ] 10. Update `src/components/m3/WipeDataDrawer.tsx`
  - [ ] 10.1 Add mode-selection step to the drawer
    - In Step 1, replace the current single confirm button with two option cards:
      - "Apagar dados, manter usuários" — neutral warning colour, lucide `Trash2` icon
      - "Apagar tudo, incluindo usuários" — `bg-error-container` colour, lucide `Users` icon
    - Each card shows a description of what it removes
    - Selecting a card sets local state `wipeMode: 'data-only' | 'include-users'` and advances to Step 2
    - _Requirements: Item 3c_

  - [ ] 10.2 Pass selected mode to the correct wipe function in Step 2
    - In the final confirmation action, call `wipeAllDataWithUsers()` when `wipeMode === 'include-users'`, or `wipeAllData()` when `wipeMode === 'data-only'`
    - _Requirements: Item 3c_

- [ ] 11. Verify WipeDataDrawer entry in `src/routes/_authenticated/mais.tsx`
  - [ ] 11.1 Ensure the WipeDataDrawer trigger is guarded by `isAdmin`
    - Confirm the button/list-item that opens `WipeDataDrawer` is conditionally rendered only when the current user has role `admin`
    - If the guard is missing, add it
    - _Requirements: Item 3d_

- [ ] 12. Final checkpoint — Limpeza total
  - Ensure both wipe paths work end-to-end, the drawer shows the correct two options, and the admin guard is in place. Ask the user if any clarification is needed.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP delivery
- Each task references the original analysis items for traceability
- SQL migration files follow the existing naming convention (`drizzle/migrations/NNNN_*.sql`)
- The `sp_estornar_transacao` fix requires no frontend changes — the corrected RPC resolves the error transparently
- The realtime subscription in `useMetas` (task 3.2) should mirror the pattern already used for transactions in `src/lib/data.ts`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "3.1", "8.1"] },
    { "id": 1, "tasks": ["1.2", "3.2", "4.1", "8.2"] },
    { "id": 2, "tasks": ["3.3", "4.2", "9.1", "9.2"] },
    { "id": 3, "tasks": ["4.3", "9.3"] },
    { "id": 4, "tasks": ["4.4", "5.1", "10.1"] },
    { "id": 5, "tasks": ["5.2", "6.1", "10.2"] },
    { "id": 6, "tasks": ["6.2", "11.1"] },
    { "id": 7, "tasks": ["8.2"] }
  ]
}
```

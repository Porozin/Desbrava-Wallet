-- Migration 0016: Caixinhas — adiciona icon_name e color em reservas
-- Permite personalizar cada reserva com ícone Lucide e cor accent,
-- estilo Caixinhas do Nubank.
ALTER TABLE public.transaction_reservations
  ADD COLUMN IF NOT EXISTS icon_name text DEFAULT 'PiggyBank',
  ADD COLUMN IF NOT EXISTS color     text DEFAULT '#6366f1';

import React, { useState } from "react";
import {
  Wallet, Lock, ArrowRightLeft, ArrowDownLeft, ArrowUpRight,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  brl, CASH_BOX_LABEL, type CashBoxId, type BoxFinancialDetails,
} from "@/lib/finance";
import { useCanRecord } from "@/lib/data";
import { TransferDrawer } from "./TransferDrawer";
import { ReservationDrawer } from "./ReservationDrawer";
import { cn } from "@/lib/utils";

interface CashBoxHeaderCardProps {
  boxId: CashBoxId;
  summary: BoxFinancialDetails;
}

export const CashBoxHeaderCard: React.FC<CashBoxHeaderCardProps> = ({ boxId, summary }) => {
  const canRecord = useCanRecord();
  const [transferOpen, setTransferOpen] = useState(false);
  const [reservationOpen, setReservationOpen] = useState(false);

  const hasReserved = summary.reserved_cents > 0;
  const isNegative = summary.available_cents < 0;

  return (
    <div className="rounded-3xl bg-surface-container-low elevation-1 border border-outline-variant/20 p-6 space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-widest opacity-50">
            Caixa Oficial
          </span>
          <h2 className="text-xl font-black tracking-tight text-foreground">
            {CASH_BOX_LABEL[boxId]}
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setReservationOpen(true)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all",
            hasReserved
              ? "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200 border border-amber-300/40"
              : "bg-surface-container text-muted-foreground hover:bg-surface-variant/40",
          )}
        >
          <Lock className="w-3.5 h-3.5" />
          <span>{hasReserved ? `Reservado: ${brl(summary.reserved)}` : "Reservas"}</span>
        </button>
      </div>

      {/* Hero balance + accounting balance */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Available — hero */}
        <div className="rounded-2xl bg-primary-container p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-widest opacity-70">
              Saldo Disponível
            </span>
            <Wallet className="w-4 h-4 opacity-60" />
          </div>
          <div className="mt-3">
            <AnimatePresence mode="wait">
              <motion.span
                key={summary.available_cents}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ type: "tween", duration: 0.2 }}
                className={cn("hero-value block", isNegative ? "text-expense" : "")}
              >
                {brl(summary.available)}
              </motion.span>
            </AnimatePresence>
            <p className="text-xs opacity-60 mt-1">Livre para despesas e transferências</p>
          </div>
        </div>

        {/* Accounting balance */}
        <div className="rounded-2xl bg-surface-container-highest/60 border border-outline-variant/10 p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-widest opacity-50">
              Saldo Contábil Total
            </span>
            <span className="text-[10px] text-muted-foreground">(Disponível + Reservas)</span>
          </div>
          <div className="mt-2">
            <span className="text-xl font-black tracking-tight text-foreground">
              {brl(summary.balance)}
            </span>
            <p className="text-xs text-muted-foreground mt-0.5">Patrimônio registrado neste caixa</p>
          </div>
        </div>
      </div>

      {/* Sub-metrics 4-col */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        {[
          { icon: ArrowDownLeft, label: "Receitas",          value: brl(summary.income),         cls: "text-income" },
          { icon: ArrowUpRight,  label: "Despesas",          value: brl(summary.expense),        cls: "text-expense" },
          { icon: ArrowRightLeft,label: "Transf. Recebidas", value: `+${brl(summary.transfers_in)}`, cls: "text-primary" },
          { icon: ArrowRightLeft,label: "Transf. Enviadas",  value: `−${brl(summary.transfers_out)}`, cls: "text-muted-foreground" },
        ].map(({ icon: Icon, label, value, cls }) => (
          <div key={label} className="bg-surface p-2.5 rounded-xl border border-outline-variant/15">
            <span className="text-muted-foreground flex items-center gap-1 font-medium">
              <Icon className={cn("w-3.5 h-3.5", cls)} />
              {label}
            </span>
            <span className={cn("font-bold block mt-1", cls)}>{value}</span>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      {canRecord && (
        <div className="flex gap-2 pt-2 border-t border-outline-variant/20">
          <button
            type="button"
            onClick={() => setTransferOpen(true)}
            className="flex-1 h-11 rounded-2xl bg-secondary-container text-on-secondary-container text-xs font-bold hover:bg-secondary-container/80 flex items-center justify-center gap-1.5 transition-colors"
          >
            <ArrowRightLeft className="w-4 h-4" />
            Transferir Saldo
          </button>
          <button
            type="button"
            onClick={() => setReservationOpen(true)}
            className="flex-1 h-11 rounded-2xl bg-surface border border-outline-variant/40 text-foreground text-xs font-bold hover:bg-surface-container flex items-center justify-center gap-1.5 transition-colors"
          >
            <Lock className="w-4 h-4 text-muted-foreground" />
            Criar Reserva
          </button>
        </div>
      )}

      <TransferDrawer open={transferOpen} onOpenChange={setTransferOpen} defaultOriginBox={boxId} />
      <ReservationDrawer open={reservationOpen} onOpenChange={setReservationOpen} boxId={boxId} />
    </div>
  );
};

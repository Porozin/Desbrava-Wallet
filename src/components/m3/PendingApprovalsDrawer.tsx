import { useState } from "react";
import { CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { brl, CASH_BOX_LABEL, type CashBoxId } from "@/lib/finance";
import {
  usePendingTransactions,
  approveExpenseRequest,
  rejectExpenseRequest,
} from "@/lib/data";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function PendingApprovalsDrawer({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const pending = usePendingTransactions();
  const [loading, setLoading] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  async function handleApprove(id: string) {
    setLoading(id);
    try {
      await approveExpenseRequest(id, "dinheiro");
      toast.success("Solicitação aprovada e registrada!");
      qc.invalidateQueries({ queryKey: ["transactions"] });
    } catch (err: any) {
      toast.error(err?.message || "Erro ao aprovar.");
    } finally {
      setLoading(null);
    }
  }

  async function handleReject(id: string) {
    if (!rejectReason.trim()) {
      toast.error("Informe o motivo da rejeição.");
      return;
    }
    setLoading(id);
    try {
      await rejectExpenseRequest(id, rejectReason.trim());
      toast.success("Solicitação rejeitada.");
      qc.invalidateQueries({ queryKey: ["transactions"] });
      setRejectId(null);
      setRejectReason("");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao rejeitar.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="rounded-t-3xl bg-surface-container-low max-w-lg mx-auto flex flex-col max-h-[85vh]">
        <DrawerHeader className="shrink-0">
          <div className="flex items-center justify-between">
            <DrawerTitle className="text-lg font-black text-foreground flex items-center gap-2">
              <Clock className="size-5 text-amber-500" />
              Solicitações Pendentes
            </DrawerTitle>
            {pending.length > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 text-xs font-black">
                {pending.length}
              </span>
            )}
          </div>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-3">
          {pending.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground text-sm">
              Nenhuma solicitação pendente.
            </div>
          ) : (
            pending.map((tx) => {
              const box = (tx.cash_box_id || (tx.module === "clube" ? "geral" : tx.module)) as CashBoxId;
              const isRejecting = rejectId === tx.id;
              const isLoading = loading === tx.id;

              return (
                <div key={tx.id} className="rounded-2xl bg-surface border border-outline-variant/30 p-4 space-y-3">
                  {/* Cabeçalho */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{tx.description}</p>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-surface-container font-semibold text-muted-foreground">
                          {CASH_BOX_LABEL[box] ?? box}
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-surface-container font-semibold text-muted-foreground">
                          {tx.category}
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-surface-container font-semibold text-muted-foreground">
                          {new Date(tx.date + "T12:00").toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                    </div>
                    <span className="text-base font-black text-expense shrink-0">
                      {brl(tx.amount)}
                    </span>
                  </div>

                  {/* Botões de ação */}
                  {!isRejecting ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setRejectId(tx.id); setRejectReason(""); }}
                        disabled={!!isLoading}
                        className="flex-1 h-9 rounded-xl border border-outline-variant text-xs font-bold text-muted-foreground hover:bg-surface-variant/40 flex items-center justify-center gap-1 disabled:opacity-50"
                      >
                        <XCircle className="size-3.5" /> Rejeitar
                      </button>
                      <button
                        onClick={() => handleApprove(tx.id)}
                        disabled={!!isLoading}
                        className="flex-1 h-9 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50"
                      >
                        {isLoading ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
                        Aprovar
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <input
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Motivo da rejeição (obrigatório)"
                        className="h-10 w-full rounded-xl border border-outline-variant/60 bg-surface px-3 text-xs outline-none focus:border-destructive"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => setRejectId(null)}
                          className="flex-1 h-9 rounded-xl border border-outline-variant text-xs font-semibold text-muted-foreground"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => handleReject(tx.id)}
                          disabled={!!isLoading}
                          className="flex-1 h-9 rounded-xl bg-destructive text-white text-xs font-bold disabled:opacity-50"
                        >
                          {isLoading ? <Loader2 className="size-3.5 animate-spin" /> : "Confirmar Rejeição"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

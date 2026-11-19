import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useOnlineStatus } from "./useOnlineStatus";
import { useOfflineQueue } from "./useOfflineQueue";
import { addTransaction } from "@/lib/data";

/**
 * Drena a fila offline assim que a conexão retorna.
 * Deve ser montado uma única vez, próximo da raiz da aplicação.
 */
export function useSyncQueue() {
  const online = useOnlineStatus();
  const qc = useQueryClient();
  const { queue, removeFromQueue, markFailed } = useOfflineQueue();
  const syncingRef = useRef(false);

  useEffect(() => {
    if (!online || syncingRef.current) return;

    const pending = queue.filter((op) => op.status === "pending");
    if (pending.length === 0) return;

    syncingRef.current = true;

    (async () => {
      let synced = 0;
      let failed = 0;

      for (const op of pending) {
        try {
          if (op.type === "transaction") {
            await addTransaction(op.payload as any);
          }
          await removeFromQueue(op.id);
          synced++;
        } catch (err: any) {
          await markFailed(op.id, err?.message || "Erro desconhecido");
          failed++;
        }
      }

      if (synced > 0) {
        toast.success(`${synced} operação${synced > 1 ? "ões" : ""} sincronizada${synced > 1 ? "s" : ""} com sucesso!`);
        qc.invalidateQueries({ queryKey: ["transactions"] });
      }
      if (failed > 0) {
        toast.error(`${failed} operação${failed > 1 ? "ões" : ""} falhou ao sincronizar. Veja o ícone de fila.`);
      }

      syncingRef.current = false;
    })();
  }, [online, queue]);
}

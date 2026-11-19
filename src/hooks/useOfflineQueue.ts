import { useState, useEffect, useCallback } from "react";

// idb-keyval importado dinamicamente para não quebrar SSR
async function idbGet(key: string): Promise<string | undefined> {
  if (typeof window === "undefined") return undefined;
  const { get } = await import("idb-keyval");
  return get<string>(key);
}

async function idbSet(key: string, value: string): Promise<void> {
  if (typeof window === "undefined") return;
  const { set } = await import("idb-keyval");
  return set(key, value);
}

export interface QueuedOperation {
  id: string;
  type: "transaction";
  payload: Record<string, unknown>;
  createdAt: string;
  status: "pending" | "failed";
  error?: string;
}

const IDB_QUEUE_KEY = "gda-offline-queue";

async function loadQueue(): Promise<QueuedOperation[]> {
  try {
    const raw = await idbGet(IDB_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveQueue(queue: QueuedOperation[]): Promise<void> {
  try {
    await idbSet(IDB_QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // Falha silenciosa
  }
}

export function useOfflineQueue() {
  const [queue, setQueue] = useState<QueuedOperation[]>([]);

  // Carrega a fila do IndexedDB na montagem
  useEffect(() => {
    loadQueue().then(setQueue);
  }, []);

  const enqueue = useCallback(async (op: Omit<QueuedOperation, "id" | "createdAt" | "status">) => {
    const item: QueuedOperation = {
      ...op,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      status: "pending",
    };
    const updated = [...(await loadQueue()), item];
    await saveQueue(updated);
    setQueue(updated);
    return item.id;
  }, []);

  const removeFromQueue = useCallback(async (id: string) => {
    const current = await loadQueue();
    const updated = current.filter((op) => op.id !== id);
    await saveQueue(updated);
    setQueue(updated);
  }, []);

  const markFailed = useCallback(async (id: string, error: string) => {
    const current = await loadQueue();
    const updated = current.map((op) =>
      op.id === id ? { ...op, status: "failed" as const, error } : op
    );
    await saveQueue(updated);
    setQueue(updated);
  }, []);

  const clearFailed = useCallback(async () => {
    const current = await loadQueue();
    const updated = current.filter((op) => op.status !== "failed");
    await saveQueue(updated);
    setQueue(updated);
  }, []);

  const pendingCount = queue.filter((op) => op.status === "pending").length;
  const failedCount = queue.filter((op) => op.status === "failed").length;

  return { queue, pendingCount, failedCount, enqueue, removeFromQueue, markFailed, clearFailed };
}

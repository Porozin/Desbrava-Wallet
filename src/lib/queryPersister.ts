import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { get, set, del } from "idb-keyval";

// Persister assíncrono usando IndexedDB via idb-keyval
// Implementa a interface StoragePersister do TanStack Query manualmente
// para contornar a limitação do createSyncStoragePersister (síncrono).
// Isso garante que o cache sobrevive ao fechamento da aba/app.

const IDB_KEY = "gda-query-cache";

export const idbPersister = {
  persistClient: async (client: unknown) => {
    try {
      await set(IDB_KEY, JSON.stringify(client));
    } catch {
      // Falha silenciosa — cache é opcional
    }
  },
  restoreClient: async () => {
    try {
      const raw = await get<string>(IDB_KEY);
      return raw ? JSON.parse(raw) : undefined;
    } catch {
      return undefined;
    }
  },
  removeClient: async () => {
    try {
      await del(IDB_KEY);
    } catch {
      // Falha silenciosa
    }
  },
};

// Fallback síncrono para ambientes sem IndexedDB (SSR/testes)
export const localStoragePersister = createSyncStoragePersister({
  storage: typeof window !== "undefined" ? window.localStorage : undefined,
  key: "gda-query-cache-ls",
});

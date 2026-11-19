// Persister assíncrono usando IndexedDB — apenas no browser.
// No servidor (SSR/Vercel) retorna um persister no-op para evitar crashes.

const IDB_KEY = "gda-query-cache";

const noop = {
  persistClient: async () => {},
  restoreClient: async () => undefined,
  removeClient: async () => {},
};

function createIdbPersister() {
  // Guarda nada no servidor — idb-keyval usa indexedDB que não existe no Node
  if (typeof window === "undefined") return noop;

  return {
    persistClient: async (client: unknown) => {
      try {
        const { set } = await import("idb-keyval");
        await set(IDB_KEY, JSON.stringify(client));
      } catch { /* silencioso */ }
    },
    restoreClient: async () => {
      try {
        const { get } = await import("idb-keyval");
        const raw = await get<string>(IDB_KEY);
        return raw ? JSON.parse(raw) : undefined;
      } catch {
        return undefined;
      }
    },
    removeClient: async () => {
      try {
        const { del } = await import("idb-keyval");
        await del(IDB_KEY);
      } catch { /* silencioso */ }
    },
  };
}

export const idbPersister = createIdbPersister();

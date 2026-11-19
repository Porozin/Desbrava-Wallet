import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { idbPersister } from "./lib/queryPersister";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Mantém cache válido por 24h — cobre uso offline típico
        gcTime: 1000 * 60 * 60 * 24,
        staleTime: 1000 * 60 * 5, // 5 min antes de refetch automático
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return { router, queryClient };
};

export { PersistQueryClientProvider, idbPersister };

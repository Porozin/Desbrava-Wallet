import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  loading?: boolean;
  error?: boolean;
  operation_proposal?: OperationProposal;
  confirmation_token?: string;
}

export interface OperationProposal {
  confirmation_required: boolean;
  confirmation_token: string;
  operation_type: string;
  operation_params: Record<string, unknown>;
  expires_in_minutes: number;
}

export function useAtlasAi() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const sessionId = useRef(crypto.randomUUID());

  const getFunctionUrl = () => {
    const url = import.meta.env.VITE_SUPABASE_URL as string;
    return `${url}/functions/v1/atlas-ai`;
  };

  const sendMessage = useCallback(async (text: string) => {
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };
    const loadingMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      loading: true,
    };

    setMessages((prev) => [...prev, userMsg, loadingMsg]);
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Nao autenticado.");

      // Historico das ultimas 5 trocas para contexto
      const history = messages.slice(-10).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch(getFunctionUrl(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          message: text,
          session_id: sessionId.current,
          history,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erro na resposta do servidor.");
      }

      const data = await res.json();

      setMessages((prev) =>
        prev.map((m) =>
          m.loading
            ? {
                ...m,
                loading: false,
                content: data.message || "...",
                operation_proposal: data.operation_proposal ?? undefined,
                confirmation_token: data.confirmation_token ?? undefined,
              }
            : m
        )
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido.";
      setMessages((prev) =>
        prev.map((m) =>
          m.loading ? { ...m, loading: false, error: true, content: msg } : m
        )
      );
    } finally {
      setLoading(false);
    }
  }, [messages]);

  const confirmOperation = useCallback(async (token: string) => {
    setLoading(true);
    const loadingMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      loading: true,
    };
    setMessages((prev) => [...prev, loadingMsg]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Nao autenticado.");

      const res = await fetch(getFunctionUrl(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          message: "",
          session_id: sessionId.current,
          confirmation_token: token,
        }),
      });

      const data = await res.json();

      setMessages((prev) =>
        prev.map((m) =>
          m.loading
            ? {
                ...m,
                loading: false,
                content: data.success
                  ? `✅ ${data.message}`
                  : `❌ ${data.message}`,
              }
            : m
        )
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro.";
      setMessages((prev) =>
        prev.map((m) =>
          m.loading ? { ...m, loading: false, error: true, content: msg } : m
        )
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const cancelOperation = useCallback((token: string) => {
    // Apenas remove a proposta da UI — a operacao expira sozinha em 5 min
    setMessages((prev) =>
      prev.map((m) =>
        m.confirmation_token === token
          ? { ...m, operation_proposal: undefined, confirmation_token: undefined }
          : m
      )
    );
  }, []);

  const clearHistory = useCallback(() => {
    setMessages([]);
    sessionId.current = crypto.randomUUID();
  }, []);

  return { messages, loading, sendMessage, confirmOperation, cancelOperation, clearHistory };
}

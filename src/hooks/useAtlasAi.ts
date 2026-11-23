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

  const invoke = async (body: object) => {
    const { data, error } = await supabase.functions.invoke("atlas-ai", { body });
    if (error) throw new Error(error.message);
    return data;
  };

  const sendMessage = useCallback(async (text: string) => {
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: text };
    const loadingMsg: ChatMessage = { id: crypto.randomUUID(), role: "assistant", content: "", loading: true };
    setMessages((prev) => [...prev, userMsg, loadingMsg]);
    setLoading(true);
    try {
      const history = messages.slice(-10).map((m) => ({ role: m.role, content: m.content }));
      const data = await invoke({ message: text, session_id: sessionId.current, history });
      setMessages((prev) =>
        prev.map((m) => m.loading ? { ...m, loading: false, content: data.message || "...",
          operation_proposal: data.operation_proposal ?? undefined,
          confirmation_token: data.confirmation_token ?? undefined } : m)
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido.";
      setMessages((prev) => prev.map((m) => m.loading ? { ...m, loading: false, error: true, content: msg } : m));
    } finally {
      setLoading(false);
    }
  }, [messages]);

  const confirmOperation = useCallback(async (token: string) => {
    setLoading(true);
    const loadingMsg: ChatMessage = { id: crypto.randomUUID(), role: "assistant", content: "", loading: true };
    setMessages((prev) => [...prev, loadingMsg]);
    try {
      const data = await invoke({ message: "", session_id: sessionId.current, confirmation_token: token });
      setMessages((prev) =>
        prev.map((m) => m.loading ? { ...m, loading: false,
          content: data.success ? "Operacao executada com sucesso!" : ("Falha: " + data.message) } : m)
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro.";
      setMessages((prev) => prev.map((m) => m.loading ? { ...m, loading: false, error: true, content: msg } : m));
    } finally {
      setLoading(false);
    }
  }, []);

  const cancelOperation = useCallback((token: string) => {
    setMessages((prev) =>
      prev.map((m): ChatMessage => {
        if (m.confirmation_token !== token) return m;
        // Remove optional fields instead of setting them to undefined
        const { operation_proposal: _op, confirmation_token: _ct, ...rest } = m;
        return rest;
      })
    );
  }, []);

  const clearHistory = useCallback(() => {
    setMessages([]);
    sessionId.current = crypto.randomUUID();
  }, []);

  return { messages, loading, sendMessage, confirmOperation, cancelOperation, clearHistory };
}

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/debug-atlas")({
  component: DebugAtlas,
});

function DebugAtlas() {
  const [jwt, setJwt] = useState("");
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("registre receita de R$ 5 no caixa vendas, venda de agua, pix, categoria Venda");
  const [result, setResult] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  const URL = "https://zobvontvydujhtdbaogw.supabase.co/functions/v1/atlas-ai-debug";

  async function getJwt() {
    const { data } = await supabase.auth.getSession();
    const t = data.session?.access_token ?? "";
    setJwt(t);
    return t;
  }

  async function call(mode: string, extra: Record<string, string> = {}) {
    setLoading(true);
    setResult(null);
    try {
      const j = jwt || await getJwt();
      const body = { mode, message, ...extra };
      const res = await fetch(URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${j}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(90000),
      });
      const data = await res.json();
      setResult(data);
    } catch (e: unknown) {
      setResult({ error: String(e) });
    } finally {
      setLoading(false);
    }
  }

  async function testNvidia() { await call("nvidia"); }
  async function testConfirm() { await call("confirm", { confirmation_token: token }); }

  async function createProposal() {
    setLoading(true);
    setResult(null);
    try {
      const j = jwt || await getJwt();
      const res = await fetch("https://zobvontvydujhtdbaogw.supabase.co/functions/v1/atlas-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${j}` },
        body: JSON.stringify({ message, session_id: "debug-" + Date.now() }),
        signal: AbortSignal.timeout(90000),
      });
      const data = await res.json();
      if (data.confirmation_token) setToken(data.confirmation_token);
      setResult(data);
    } catch (e: unknown) {
      setResult({ error: String(e) });
    } finally {
      setLoading(false);
    }
  }

  const pre = "font-mono text-xs bg-gray-900 text-green-300 p-4 rounded-xl overflow-auto max-h-[500px] whitespace-pre-wrap";
  const btn = "px-4 py-2 rounded-xl font-bold text-sm text-white disabled:opacity-50 transition-all";
  const inp = "w-full rounded-xl border border-gray-600 bg-gray-800 text-white px-3 py-2 text-xs font-mono";

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-black text-green-400">🔧 Atlas AI Debug</h1>
        <p className="text-xs text-gray-400 mt-1">Rota temporária de diagnóstico — bloquear após confirmar funcionamento</p>
      </div>

      {/* JWT */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-gray-300 uppercase">JWT (preenchido automaticamente ao clicar em qualquer botão)</label>
        <textarea value={jwt} onChange={e => setJwt(e.target.value)} rows={3}
          className={inp} placeholder="Cole seu JWT aqui ou clique em qualquer botão para preencher automaticamente" />
        <button onClick={getJwt} className={`${btn} bg-gray-700 hover:bg-gray-600`}>
          Pegar JWT da sessão atual
        </button>
      </div>

      {/* Mensagem */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-gray-300 uppercase">Mensagem para o Atlas AI</label>
        <textarea value={message} onChange={e => setMessage(e.target.value)} rows={2} className={inp} />
      </div>

      {/* Botões de teste */}
      <div className="grid grid-cols-2 gap-3">
        <button onClick={testNvidia} disabled={loading}
          className={`${btn} bg-blue-600 hover:bg-blue-500`}>
          {loading ? "⏳ Aguardando..." : "1. Testar NVIDIA (latência)"}
        </button>

        <button onClick={createProposal} disabled={loading}
          className={`${btn} bg-purple-600 hover:bg-purple-500`}>
          {loading ? "⏳ Aguardando..." : "2. Criar Proposta (Atlas AI)"}
        </button>
      </div>

      {/* Token de confirmação */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-gray-300 uppercase">
          Token de Confirmação (preenchido automaticamente ao criar proposta)
        </label>
        <div className="flex gap-2">
          <input value={token} onChange={e => setToken(e.target.value)} className={`${inp} flex-1`}
            placeholder="UUID da operação pendente" />
          <button onClick={testConfirm} disabled={loading || !token}
            className={`${btn} bg-green-600 hover:bg-green-500 shrink-0`}>
            {loading ? "⏳..." : "3. Confirmar"}
          </button>
        </div>
      </div>

      {/* Resultado */}
      {loading && (
        <div className="p-6 rounded-xl bg-gray-900 text-center">
          <span className="text-yellow-400 text-sm font-bold animate-pulse">⏳ Aguardando resposta... (pode demorar até 90s na NVIDIA)</span>
        </div>
      )}

      {result && !loading && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-gray-300 uppercase">Resultado Completo</label>
            <button onClick={() => navigator.clipboard.writeText(JSON.stringify(result, null, 2))}
              className="text-xs text-gray-400 hover:text-white">
              📋 Copiar
            </button>
          </div>
          <pre className={pre}>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

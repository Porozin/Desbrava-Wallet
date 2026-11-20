import { useState, useRef, useEffect } from "react";
import { Sparkles, Send, X, RotateCcw, Check, XCircle, Loader2 } from "lucide-react";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { useAtlasAi, type OperationProposal } from "@/hooks/useAtlasAi";
import { brl } from "@/lib/finance";

const OPERATION_LABELS: Record<string, string> = {
  registrar_receita: "Registrar Receita",
  registrar_despesa: "Registrar Despesa",
  registrar_transferencia: "Transferência entre Caixas",
  estorno: "Estorno de Movimentação",
  criar_meta: "Criar Meta",
  atualizar_meta: "Atualizar Meta",
  excluir_meta: "Excluir Meta",
  criar_produto: "Criar Produto",
  atualizar_produto: "Editar Produto",
  excluir_produto: "Excluir Produto",
  criar_insumo: "Criar Insumo",
  atualizar_insumo: "Editar Insumo",
  excluir_insumo: "Excluir Insumo",
  criar_divida: "Registrar Dívida",
};

const CASH_BOX_LABELS: Record<string, string> = {
  geral: "Caixa Geral",
  doceria: "Doceria",
  vendas: "Vendas Rápidas",
};

function OperationCard({
  proposal,
  token,
  onConfirm,
  onCancel,
}: {
  proposal: OperationProposal;
  token: string;
  onConfirm: (token: string) => void;
  onCancel: (token: string) => void;
}) {
  const p = proposal.operation_params;
  const label = OPERATION_LABELS[proposal.operation_type] ?? proposal.operation_type;

  return (
    <div className="rounded-2xl border-2 border-primary/40 bg-primary-container/20 p-3 space-y-2 text-sm">
      <div className="flex items-center gap-1.5">
        <Sparkles className="size-4 text-primary" />
        <span className="font-bold text-foreground text-xs uppercase tracking-wide">{label}</span>
        <span className="ml-auto text-[10px] text-muted-foreground">Expira em {proposal.expires_in_minutes} min</span>
      </div>

      <div className="space-y-1 text-xs text-foreground/80">
        {p.cash_box_id && <div><span className="font-semibold">Caixa:</span> {CASH_BOX_LABELS[String(p.cash_box_id)] ?? String(p.cash_box_id)}</div>}
        {p.source_box && <div><span className="font-semibold">De:</span> {CASH_BOX_LABELS[String(p.source_box)]} → <span className="font-semibold">Para:</span> {CASH_BOX_LABELS[String(p.destination_box)]}</div>}
        {p.amount && <div><span className="font-semibold">Valor:</span> <span className="font-black text-primary">{brl(parseFloat(String(p.amount)))}</span></div>}
        {p.description && <div><span className="font-semibold">Descrição:</span> {String(p.description)}</div>}
        {p.category && <div><span className="font-semibold">Categoria:</span> {String(p.category)}</div>}
        {p.payment_method && <div><span className="font-semibold">Pagamento:</span> {String(p.payment_method)}</div>}
        {p.reverse_reason && <div><span className="font-semibold">Motivo estorno:</span> {String(p.reverse_reason)}</div>}
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onCancel(token)}
          className="flex-1 h-9 rounded-xl border border-outline-variant text-xs font-semibold text-muted-foreground hover:bg-surface-variant/40 flex items-center justify-center gap-1"
        >
          <XCircle className="size-3.5" /> Cancelar
        </button>
        <button
          onClick={() => onConfirm(token)}
          className="flex-1 h-9 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 flex items-center justify-center gap-1"
        >
          <Check className="size-3.5" /> Confirmar
        </button>
      </div>
    </div>
  );
}


// Converte markdown basico em JSX sem dependencias externas
function renderText(text: string) {
  return text.split('\n').map((line, i) => {
    // Converte **negrito** em <strong>
    const parts = line.split(/(\*\*[^*]+\*\*)/g).map((part, j) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={j} className="font-bold">{part.slice(2, -2)}</strong>;
      }
      // Remove asteriscos soltos e hashes de listas
      return <span key={j}>{part.replace(/^[*#-]\s+/, '')}</span>;
    });
    return <span key={i} className="block leading-relaxed">{parts}</span>;
  });
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const QUICK_PROMPTS = [
  "Qual o saldo atual dos caixas?",
  "Mostre as últimas movimentações",
  "Quais as metas do clube?",
  "Ranking de vendedores",
];

export function AtlasAiDrawer({ open, onOpenChange }: Props) {
  const { messages, loading, sendMessage, confirmOperation, cancelOperation, clearHistory } = useAtlasAi();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input ao abrir
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open]);

  function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    sendMessage(text);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="rounded-t-3xl bg-surface max-w-lg mx-auto flex flex-col h-[85vh]">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-outline-variant/20 shrink-0">
          <span className="flex size-9 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <Sparkles className="size-5" />
          </span>
          <div className="flex-1">
            <p className="text-sm font-black text-foreground">Atlas AI</p>
            <p className="text-[11px] text-muted-foreground">Assistente financeiro do GDA</p>
          </div>
          <button
            onClick={clearHistory}
            title="Nova conversa"
            className="p-2 rounded-full hover:bg-surface-variant/40 text-muted-foreground transition-colors"
          >
            <RotateCcw className="size-4" />
          </button>
          <button
            onClick={() => onOpenChange(false)}
            className="p-2 rounded-full hover:bg-surface-variant/40 text-muted-foreground transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Mensagens */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.length === 0 && (
            <div className="space-y-4 py-4">
              <div className="text-center space-y-1">
                <Sparkles className="size-8 text-primary mx-auto opacity-60" />
                <p className="text-sm font-bold text-foreground">Como posso ajudar?</p>
                <p className="text-xs text-muted-foreground">
                  Consulte saldos, movimentações, metas e muito mais.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {QUICK_PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => sendMessage(p)}
                    className="p-3 rounded-2xl bg-surface-container-low border border-outline-variant/20 text-xs font-semibold text-foreground hover:bg-surface-container transition-all text-left"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-3xl px-4 py-2.5 text-sm ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : msg.error
                    ? "bg-destructive/10 text-destructive border border-destructive/30 rounded-bl-md"
                    : "bg-surface-container-low border border-outline-variant/20 text-foreground rounded-bl-md"
                }`}
              >
                {msg.loading ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" />
                    <span className="text-xs">Pensando…</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="leading-relaxed space-y-0.5">{renderText(msg.content)}</div>
                    {msg.operation_proposal && msg.confirmation_token && (
                      <OperationCard
                        proposal={msg.operation_proposal}
                        token={msg.confirmation_token}
                        onConfirm={confirmOperation}
                        onCancel={cancelOperation}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-4 pb-4 pt-2 border-t border-outline-variant/10 shrink-0">
          <div className="flex items-center gap-2 bg-surface-container-low rounded-3xl border border-outline-variant/30 px-4 py-2 focus-within:border-primary transition-all">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pergunte sobre saldos, lançamentos…"
              disabled={loading}
              className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40 hover:bg-primary/90 transition-all"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

import { useState } from "react";
import { Minus, Plus, ShoppingCart, X, Check, Cake, Zap } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { brl, toCents, type CashBoxId, type Module } from "@/lib/finance";
import { addTransaction, requestExpense, useMe, useIsConselheiro, type Produto } from "@/lib/data";
import { useHaptic } from "@/hooks/useHaptic";

interface CartItem {
  produto: Produto;
  qty: number;
}

interface PdvGridProps {
  produtos: Produto[];
  module: Module;
  boxId: CashBoxId;
  /** Ícone padrão para produto sem imagem */
  defaultIcon?: "cake" | "zap";
}

const PAYMENT_OPTIONS = [
  { value: "dinheiro", label: "💵 Dinheiro" },
  { value: "pix",     label: "📲 Pix" },
  { value: "cartao_debito",  label: "💳 Débito" },
  { value: "cartao_credito", label: "💳 Crédito" },
];

export function PdvGrid({ produtos, module, boxId, defaultIcon = "cake" }: PdvGridProps) {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const { vibrate } = useHaptic();
  const isConselheiro = useIsConselheiro();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [payment, setPayment] = useState("dinheiro");
  const [seller, setSeller] = useState(me?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const total = cart.reduce((acc, i) => acc + i.produto.preco_venda * i.qty, 0);
  const totalCusto = cart.reduce((acc, i) => acc + (i.produto.custo + i.produto.comissao) * i.qty, 0);
  const lucroTotal = total - totalCusto;
  const margemTotal = total > 0 ? (lucroTotal / total) * 100 : 0;
  const totalCents = toCents(total);

  function setQty(produto: Produto, delta: number) {
    vibrate("light");
    setCart((prev) => {
      const existing = prev.find((i) => i.produto.id === produto.id);
      if (!existing) {
        if (delta <= 0) return prev;
        return [...prev, { produto, qty: delta }];
      }
      const newQty = existing.qty + delta;
      if (newQty <= 0) return prev.filter((i) => i.produto.id !== produto.id);
      return prev.map((i) => i.produto.id === produto.id ? { ...i, qty: newQty } : i);
    });
  }

  function getQty(produto: Produto) {
    return cart.find((i) => i.produto.id === produto.id)?.qty ?? 0;
  }

  async function handleConfirm() {
    if (cart.length === 0) {
      toast.error("Adicione ao menos um produto.");
      return;
    }
    setSaving(true);
    try {
      const description = cart
        .map((i) => `${i.qty}x ${i.produto.nome}`)
        .join(", ");

      if (isConselheiro) {
        // Conselheiro cria solicitação pendente — não confirma direto
        await requestExpense({
          cashBoxId: boxId,
          amountCents: totalCents,
          category: "Venda PDV",
          description,
          paymentMethod: payment as any,
        });
        vibrate("success");
        setConfirmed(true);
        qc.invalidateQueries({ queryKey: ["transactions"] });
        setTimeout(() => {
          setCart([]);
          setConfirmed(false);
          setSaving(false);
        }, 2000);
      } else {
        // Gestor registra diretamente
        await addTransaction({
          module,
          cash_box_id: boxId,
          kind: "receita",
          amount: total,
          amount_cents: totalCents,
          category: "Venda PDV",
          description,
          payment_method: payment as any,
          date: new Date().toISOString().slice(0, 10),
          seller: seller.trim() || undefined,
        });
        vibrate("success");
        setConfirmed(true);
        qc.invalidateQueries({ queryKey: ["transactions"] });
        setTimeout(() => {
          setCart([]);
          setConfirmed(false);
          setSaving(false);
        }, 1500);
      }
    } catch (err: any) {
      toast.error(err?.message || "Falha ao registrar venda.");
      vibrate("error");
      setSaving(false);
    }
  }

  if (!produtos.length) {
    return (
      <div className="p-10 text-center text-muted-foreground bg-surface-container-low rounded-3xl border border-outline-variant/20">
        Nenhum produto cadastrado. Adicione produtos na aba ao lado.
      </div>
    );
  }

  const DefaultIcon = defaultIcon === "cake" ? Cake : Zap;

  return (
    <div className="space-y-4">
      {/* Grade de produtos */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {produtos.map((p) => {
          const qty = getQty(p);
          const inCart = qty > 0;
          return (
            <div
              key={p.id}
              className={`relative rounded-3xl border-2 transition-all overflow-hidden flex flex-col ${
                inCart
                  ? "border-primary bg-primary-container/30"
                  : "border-outline-variant/30 bg-surface-container-low"
              }`}
            >
              {/* Área do produto — toque adiciona */}
              <button
                type="button"
                onClick={() => setQty(p, 1)}
                className="flex flex-col items-center justify-center gap-2 p-4 pt-5 flex-1 w-full"
              >
                <span className={`flex size-14 items-center justify-center rounded-2xl text-2xl ${
                  inCart ? "bg-primary text-primary-foreground" : "bg-surface-container-high text-muted-foreground"
                }`}>
                  <DefaultIcon className="size-7" />
                </span>
                <p className="text-xs font-bold text-foreground text-center leading-tight line-clamp-2">
                  {p.nome}
                </p>
                <p className="text-sm font-black text-primary">{brl(p.preco_venda)}</p>
                {p.custo > 0 && (
                  <p className="text-[10px] text-income">Lucro: {brl(p.preco_venda - p.custo - p.comissao)}</p>
                )}
              </button>

              {/* Controles de quantidade */}
              {inCart && (
                <div className="flex items-center justify-between px-3 pb-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setQty(p, -1)}
                    className="flex size-8 items-center justify-center rounded-full bg-surface-container-highest text-foreground hover:bg-error/20 transition-all"
                  >
                    <Minus className="size-3.5" />
                  </button>
                  <span className="text-sm font-black text-primary">{qty}</span>
                  <button
                    type="button"
                    onClick={() => setQty(p, 1)}
                    className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Resumo do carrinho */}
      {cart.length > 0 && (
        <div className="rounded-3xl bg-surface-container-low border border-outline-variant/20 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <ShoppingCart className="size-4 text-primary" /> Resumo da Venda
            </h3>
            <button
              type="button"
              onClick={() => { setCart([]); vibrate("light"); }}
              className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-0.5 transition-colors"
            >
              <X className="size-3.5" /> Limpar
            </button>
          </div>

          {/* Itens */}
          <ul className="space-y-1">
            {cart.map((i) => (
              <li key={i.produto.id} className="flex justify-between text-xs">
                <span className="text-foreground font-medium">
                  {i.qty}× {i.produto.nome}
                </span>
                <span className="font-bold text-foreground">
                  {brl(i.produto.preco_venda * i.qty)}
                </span>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between border-t border-outline-variant/20 pt-2">
            <span className="text-xs font-bold text-muted-foreground uppercase">Total</span>
            <span className="text-xl font-black text-primary">{brl(total)}</span>
          </div>
          {totalCusto > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Lucro estimado</span>
              <span className={lucroTotal >= 0 ? "font-bold text-income" : "font-bold text-expense"}>
                {brl(lucroTotal)} ({margemTotal.toFixed(0)}%)
              </span>
            </div>
          )}

          {/* Vendedor */}
          <input
            value={seller}
            onChange={(e) => setSeller(e.target.value)}
            placeholder="Vendedor (opcional)"
            className="h-11 w-full rounded-2xl border border-outline-variant/60 bg-surface px-4 text-sm outline-none focus:border-primary transition-all"
          />

          {/* Forma de pagamento */}
          <div className="grid grid-cols-2 gap-2">
            {PAYMENT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { setPayment(opt.value); vibrate("light"); }}
                className={`h-10 rounded-2xl text-xs font-bold transition-all ${
                  payment === opt.value
                    ? "bg-secondary-container text-on-secondary-container ring-2 ring-secondary"
                    : "bg-surface-container-high text-foreground hover:bg-surface-variant"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Botão de confirmar */}
          <button
            type="button"
            onClick={handleConfirm}
            disabled={saving}
            className={`h-14 w-full rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all ${
              confirmed
                ? "bg-emerald-600 text-white"
                : "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            }`}
          >
            {confirmed ? (
              isConselheiro
                ? <><Check className="size-5" /> Solicitação Enviada!</>
                : <><Check className="size-5" /> Venda Registrada!</>
            ) : saving ? (
              "Registrando…"
            ) : isConselheiro ? (
              <><ShoppingCart className="size-5" /> Enviar Solicitação — {brl(total)}</>
            ) : (
              <><ShoppingCart className="size-5" /> Confirmar Venda — {brl(total)}</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

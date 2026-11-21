import { useState } from "react";
import { Minus, Plus, ShoppingCart, X, Check, Cake, Zap } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
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
            <motion.div
              key={p.id}
              animate={inCart ? { scale: [1, 1.04, 1] } : {}}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className={`relative rounded-3xl border-2 overflow-hidden flex flex-col transition-colors ${
                inCart ? "border-primary bg-primary-container/30" : "border-outline-variant/30 bg-surface-container-low"
              }`}
              style={p.color && inCart ? { borderColor: p.color, backgroundColor: p.color + "18" } : undefined}
            >
              {/* Área do produto — toque adiciona */}
              <button
                type="button"
                onClick={() => setQty(p, 1)}
                className="flex flex-col items-center justify-center gap-2 p-4 pt-5 flex-1 w-full"
              >
                <span
                  className="flex size-14 items-center justify-center rounded-2xl text-2xl"
                  style={p.color ? { backgroundColor: p.color + "33" } : undefined}
                >
                  {p.icon ? (
                    <span className="text-2xl">{p.icon}</span>
                  ) : (
                    <DefaultIcon className="size-7" style={p.color ? { color: p.color } : undefined} />
                  )}
                </span>
                <p className="text-xs font-bold text-foreground text-center leading-tight line-clamp-2">
                  {p.nome}
                </p>
                <p className="text-sm font-black" style={p.color ? { color: p.color } : undefined}>{brl(p.preco_venda)}</p>
                {p.custo > 0 && (
                  <p className="text-[10px] text-income">Lucro: {brl(p.preco_venda - p.custo - p.comissao)}</p>
                )}
              </button>

              {/* Controles de quantidade */}
              <AnimatePresence>
                {inCart && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    className="overflow-hidden"
                  >
                    <div className="flex items-center justify-between px-3 pb-3 gap-2">
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.88 }}
                        onClick={() => setQty(p, -1)}
                        className="flex size-8 items-center justify-center rounded-full bg-surface-container-highest text-foreground hover:bg-error/20 transition-colors"
                      >
                        <Minus className="size-3.5" />
                      </motion.button>
                      <span className="text-sm font-black text-primary">{qty}</span>
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.88 }}
                        onClick={() => setQty(p, 1)}
                        className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                      >
                        <Plus className="size-3.5" />
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* Resumo do carrinho */}
      <AnimatePresence>
      {cart.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 340, damping: 30 }}
          className="rounded-3xl bg-surface-container-low border border-outline-variant/20 p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <ShoppingCart className="size-4 text-primary" /> Resumo da Venda
            </h3>
            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={() => { setCart([]); vibrate("light"); }}
              className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-0.5 transition-colors"
            >
              <X className="size-3.5" /> Limpar
            </motion.button>
          </div>

          {/* Itens */}
          <ul className="space-y-1">
            <AnimatePresence initial={false}>
              {cart.map((i) => (
                <motion.li
                  key={i.produto.id}
                  initial={{ opacity: 0, x: -10, height: 0 }}
                  animate={{ opacity: 1, x: 0, height: "auto" }}
                  exit={{ opacity: 0, x: 10, height: 0 }}
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  className="flex justify-between text-xs overflow-hidden"
                >
                  <span className="text-foreground font-medium">
                    {i.qty}× {i.produto.nome}
                  </span>
                  <span className="font-bold text-foreground">
                    {brl(i.produto.preco_venda * i.qty)}
                  </span>
                </motion.li>
              ))}
            </AnimatePresence>
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

          {/* Botão de confirmar — AnimatePresence entre estados */}
          <AnimatePresence mode="wait">
            {confirmed ? (
              <motion.button
                key="confirmed"
                type="button"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
                className="h-14 w-full rounded-2xl font-black text-sm flex items-center justify-center gap-2 bg-emerald-600 text-white"
              >
                <Check className="size-5" />
                {isConselheiro ? "Solicitação Enviada!" : "Venda Registrada!"}
              </motion.button>
            ) : (
              <motion.button
                key="confirm"
                type="button"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
                onClick={handleConfirm}
                disabled={saving}
                className="h-14 w-full rounded-2xl font-black text-sm flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? "Registrando…" : isConselheiro ? (
                  <><ShoppingCart className="size-5" /> Enviar Solicitação — {brl(total)}</>
                ) : (
                  <><ShoppingCart className="size-5" /> Confirmar Venda — {brl(total)}</>
                )}
              </motion.button>
            )}
          </AnimatePresence>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}

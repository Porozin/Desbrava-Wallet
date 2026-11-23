import { useState, useId, type ReactNode } from "react";
import { ArrowDownLeft, ArrowUpRight, Plus, Tag, Check, X } from "lucide-react";
import { motion, AnimatePresence, MotionConfig } from "motion/react";
import { toast } from "sonner";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import {
  brl,
  MODULE_LABEL,
  CASH_BOX_LABEL,
  type CashBoxId,
  type Kind,
  type Module,
  type PaymentMethod,
  type Transaction,
} from "@/lib/finance";
import { addTransaction, useCanRecord } from "@/lib/data";
import { useCategories } from "@/lib/categories";
import { useHaptic } from "@/hooks/useHaptic";

export { MetricCard } from "./MetricCard";
export { ResponsiveTransactionList } from "./ResponsiveTransactionList";
export { BottomNav } from "./BottomNav";
export { CashBoxHeaderCard } from "./CashBoxHeaderCard";
export { TransferDrawer } from "./TransferDrawer";
export { ReservationDrawer } from "./ReservationDrawer";

const cardVariants = cva("rounded-3xl p-5 transition-transform active:scale-[0.99]", {
  variants: {
    variant: {
      filled:    "bg-surface-container-highest/60 border-none elevation-1",
      elevated:  "bg-surface-container-low elevation-1 border border-outline-variant/20",
      outlined:  "border border-outline-variant/60 bg-surface",
      primary:   "bg-primary-container text-on-primary-container elevation-3 border-none",
      tertiary:  "bg-tertiary-container text-on-tertiary-container elevation-3 border-none",
    },
  },
  defaultVariants: { variant: "elevated" },
});

export function M3Card({ variant, className, children }: VariantProps<typeof cardVariants> & { className?: string; children: ReactNode }) {
  return <section className={cn(cardVariants({ variant }), className)}>{children}</section>;
}

export function Stat({ label, value, tone }: { label: string; value: number; tone?: "income" | "expense" }) {
  return (
    <div className="bg-surface-container-highest/60 rounded-3xl p-4 flex flex-col justify-between border border-outline-variant/10">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("text-xl sm:text-2xl mt-2 font-black tracking-tight", tone === "income" && "text-income", tone === "expense" && "text-expense")}>{brl(value)}</p>
    </div>
  );
}

export function TransactionList({ items, empty = "Nenhuma movimentação ainda." }: { items: Transaction[]; empty?: string }) {
  if (!items.length) return <p className="py-8 text-center text-muted-foreground">{empty}</p>;
  return (
    <ul className="divide-y divide-outline-variant/20 overflow-hidden rounded-3xl bg-surface-container-low border border-outline-variant/20">
      {items.map((t) => {
        const income = t.kind === "receita";
        const Icon = income ? ArrowDownLeft : ArrowUpRight;
        return (
          <li key={t.id} className="flex min-h-16 items-center gap-4 px-4 py-3.5 active:bg-surface-variant/30 transition-colors">
            <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", income ? "bg-primary-container text-on-primary-container" : "bg-secondary-container text-expense")}>
              <Icon className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-sm text-foreground">{t.description}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t.category} • {new Date(t.date + "T12:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                {t.seller ? ` • ${t.seller}` : ""}
              </p>
            </div>
            <span className={cn("text-sm font-bold shrink-0", income ? "text-income" : "text-expense")}>
              {income ? "+" : "−"} {brl(t.amount)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function ChipGroup<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  const uid = useId();
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "relative text-xs font-semibold h-9 shrink-0 rounded-full px-4 transition-colors duration-150",
            value === o.value ? "text-on-secondary-container" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {value === o.value && (
            <motion.span
              layoutId={`chip-${uid}`}
              className="absolute inset-0 rounded-full bg-secondary-container shadow-xs"
              style={{ borderRadius: 9999 }}
              transition={{ type: "spring", stiffness: 400, damping: 32 }}
            />
          )}
          <span className="relative z-10">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

const field = "h-14 w-full rounded-2xl border border-outline-variant/60 bg-surface px-4 text-sm text-foreground outline-none focus:border-2 focus:border-primary transition-all";

export function NewEntryFab({
  module,
  boxId,
  withSeller,
}: {
  module: Module;
  boxId?: CashBoxId;
  withSeller?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("receita");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("dinheiro");
  const [saving, setSaving] = useState(false);
  const [amountValue, setAmountValue] = useState("");
  const canRecord = useCanRecord();
  const { vibrate } = useHaptic();

  const targetBoxId: CashBoxId = boxId || (module === "clube" ? "geral" : (module as CashBoxId));
  const { categories, addCategory } = useCategories(targetBoxId);

  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCatInput, setNewCatInput] = useState("");

  // Guard depois de todos os hooks
  if (!canRecord) return null;

  const currentCategory = selectedCategory || categories[0] || "Geral";

  function handleCategoryChange(val: string) {
    if (val === "__new__") {
      setIsAddingCategory(true);
      setNewCatInput("");
    } else {
      setSelectedCategory(val);
      setIsAddingCategory(false);
    }
  }

  function handleSaveNewCategory() {
    const trimmed = newCatInput.trim();
    if (!trimmed) {
      toast.error("Informe o nome da nova categoria.");
      return;
    }
    const added = addCategory(trimmed);
    setSelectedCategory(added);
    setIsAddingCategory(false);
    setNewCatInput("");
    toast.success(`Categoria "${added}" adicionada!`);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const amount = Number(String(f.get("amount")).replace(",", "."));    const description = String(f.get("description") ?? "").trim();
    if (!description || !(amount > 0)) {
      toast.error("Informe descrição e um valor maior que zero.");
      return;
    }
    setSaving(true);
    try {
      await addTransaction({
        module,
        cash_box_id: targetBoxId,
        kind,
        amount,
        description,
        payment_method: paymentMethod,
        category: currentCategory,
        date: String(f.get("date") || new Date().toISOString().slice(0, 10)),
        seller: withSeller ? String(f.get("seller") || "") || undefined : undefined,
      });
      toast.success("Movimentação registrada com sucesso!");
      vibrate("success");
      setOpen(false);
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível salvar a movimentação.");
      vibrate("error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <motion.button
        onClick={() => {
          setOpen(true);
          setIsAddingCategory(false);
        }}
        aria-label={`Nova movimentação em ${CASH_BOX_LABEL[targetBoxId]}`}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.92 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className="flex h-14 items-center gap-2.5 rounded-2xl bg-primary text-on-primary px-5 elevation-3"
      >
        <Plus className="size-6" />
        <span className="text-sm font-bold">Nova</span>
      </motion.button>
      <Drawer open={open} onOpenChange={(v) => { setOpen(v); if (!v) setAmountValue(""); }}>
        <DrawerContent className="rounded-t-3xl bg-surface-container-low max-w-lg mx-auto">
          <DrawerHeader>
            <DrawerTitle className="text-lg font-black tracking-tight text-foreground">
              Nova movimentação • {CASH_BOX_LABEL[targetBoxId]}
            </DrawerTitle>
          </DrawerHeader>
          <form onSubmit={submit} className="space-y-4 px-4 pb-8">
            <ChipGroup
              value={kind}
              onChange={setKind}
              options={[
                { value: "receita", label: "Receita (+)" },
                { value: "despesa", label: "Despesa (−)" },
              ]}
            />
            <input
              name="description"
              placeholder="Descrição da movimentação"
              className={field}
              maxLength={80}
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <input
                  name="amount"
                  inputMode="decimal"
                  placeholder="Valor (R$)"
                  value={amountValue}
                  onChange={(e) => setAmountValue(e.target.value)}
                  className={field}
                  required
                />
                {/* Atalhos numéricos rápidos */}
                <div className="flex gap-1.5">
                  {[5, 10, 20, 50, 100].map((v) => (
                    <motion.button
                      key={v}
                      type="button"
                      whileTap={{ scale: 0.84 }}
                      transition={{ type: "spring", stiffness: 500, damping: 25 }}
                      onClick={() => {
                        vibrate("light");
                        setAmountValue((prev) => {
                          const current = parseFloat(prev.replace(",", ".")) || 0;
                          return String((current + v).toFixed(2));
                        });
                      }}
                      className="flex-1 h-8 rounded-xl bg-surface-container-high text-xs font-bold text-foreground hover:bg-secondary-container hover:text-on-secondary-container transition-colors"
                    >
                      +{v}
                    </motion.button>
                  ))}
                </div>
              </div>

              <div className="relative">
                <select
                  value={isAddingCategory ? "__new__" : currentCategory}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className={field}
                >
                  <optgroup label="Categorias Fixas & Salvas">
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </optgroup>
                  <option value="__new__">➕ Nova Categoria…</option>
                </select>
              </div>
            </div>

            <AnimatePresence>
            {isAddingCategory && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: "auto", marginTop: 8 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                transition={{ type: "spring", stiffness: 350, damping: 30 }}
                className="overflow-hidden"
              >
                <div className="flex items-center gap-2 p-2 rounded-2xl bg-surface-container-highest border border-primary/40">
                  <input
                    type="text"
                    value={newCatInput}
                    onChange={(e) => setNewCatInput(e.target.value)}
                    placeholder="Nome da nova categoria"
                    className="h-10 flex-1 rounded-xl bg-surface px-3 text-xs text-foreground outline-none border border-outline-variant/40 focus:border-primary"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleSaveNewCategory}
                    className="h-10 px-3 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1 shadow-xs"
                  >
                    <Check className="size-3.5" /> Salvar
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddingCategory(false)}
                    className="h-10 px-2 rounded-xl text-muted-foreground hover:text-foreground text-xs"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </motion.div>
            )}
            </AnimatePresence>

            <div className="grid grid-cols-2 gap-3">
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className={field}
              >
                <option value="dinheiro">Dinheiro</option>
                <option value="pix">Pix</option>
                <option value="cartao_debito">Débito</option>
                <option value="cartao_credito">Crédito</option>
                <option value="outro">Outro</option>
              </select>
              <input
                name="date"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
                className={field}
              />
            </div>
            {withSeller && (
              <input
                name="seller"
                placeholder="Nome do Vendedor(a)"
                className={field}
                maxLength={40}
              />
            )}
            <button
              type="submit"
              disabled={saving}
              className="text-sm font-bold h-12 w-full rounded-2xl bg-primary text-primary-foreground disabled:opacity-60 transition-transform active:scale-[0.99]"
            >
              {saving ? "Salvando…" : "Salvar Movimentação"}
            </button>
          </form>
        </DrawerContent>
      </Drawer>
    </>
  );
}

import React, { useState, useEffect } from "react";
import {
  PiggyBank, Target, Plane, Home, Heart, ShoppingBag, GraduationCap,
  Car, Wrench, Gift, Star, Zap, Shield, Coffee, Music, Camera,
  BookOpen, Umbrella, Bike, TreePine, ArrowDownToLine, ArrowUpFromLine,
  Trash2, ChevronRight, Plus, Check, X,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { brl, toCents, CASH_BOX_LABEL, type CashBoxId } from "@/lib/finance";
import {
  createReservation, releaseReservation, consumeReservation,
  useCanRecord, useReservations,
} from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

// ── Ícones disponíveis para seleção ─────────────────────────────────────────
const ICONS: { name: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { name: "PiggyBank",   icon: PiggyBank },
  { name: "Target",      icon: Target },
  { name: "Plane",       icon: Plane },
  { name: "Home",        icon: Home },
  { name: "Heart",       icon: Heart },
  { name: "ShoppingBag", icon: ShoppingBag },
  { name: "GraduationCap", icon: GraduationCap },
  { name: "Car",         icon: Car },
  { name: "Wrench",      icon: Wrench },
  { name: "Gift",        icon: Gift },
  { name: "Star",        icon: Star },
  { name: "Zap",         icon: Zap },
  { name: "Shield",      icon: Shield },
  { name: "Coffee",      icon: Coffee },
  { name: "Music",       icon: Music },
  { name: "Camera",      icon: Camera },
  { name: "BookOpen",    icon: BookOpen },
  { name: "Umbrella",    icon: Umbrella },
  { name: "Bike",        icon: Bike },
  { name: "TreePine",    icon: TreePine },
];

const COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e",
  "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#0ea5e9", "#64748b",
];

function getIcon(name?: string) {
  return ICONS.find((i) => i.name === name)?.icon ?? PiggyBank;
}

// ── Sub-componente: card de uma caixinha ─────────────────────────────────────
function CaixinhaCard({
  res,
  canRecord,
  onGuardar,
  onResgatar,
  onExcluir,
}: {
  res: ReturnType<typeof useReservations>[number];
  canRecord: boolean;
  onGuardar: () => void;
  onResgatar: () => void;
  onExcluir: () => void;
}) {
  const Icon = getIcon(res.icon_name);
  const color = res.color ?? "#6366f1";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      className="rounded-3xl overflow-hidden elevation-1"
    >
      {/* Top color band */}
      <div className="h-1.5 w-full" style={{ backgroundColor: color }} />

      <div className="bg-surface-container-low p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="size-12 rounded-2xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: color + "22" }}>
            <Icon className="size-6" style={{ color }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-black text-sm text-foreground truncate">{res.title}</p>
            {res.description && (
              <p className="text-xs text-muted-foreground truncate">{res.description}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="text-lg font-black text-foreground">{brl(res.amount_cents / 100)}</p>
            <p className="text-[10px] text-muted-foreground">guardado</p>
          </div>
        </div>

        {/* Actions */}
        {canRecord && (
          <div className="flex gap-2 pt-1">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onGuardar}
              className="flex-1 h-9 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              style={{ backgroundColor: color + "22", color }}
            >
              <ArrowDownToLine className="size-3.5" /> Guardar
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onResgatar}
              className="flex-1 h-9 rounded-2xl bg-surface-container border border-outline-variant/30 text-xs font-bold text-foreground flex items-center justify-center gap-1.5 transition-colors hover:bg-surface-container-high"
            >
              <ArrowUpFromLine className="size-3.5" /> Resgatar
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onExcluir}
              className="size-9 rounded-2xl bg-surface-container border border-outline-variant/30 text-muted-foreground flex items-center justify-center hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              <Trash2 className="size-3.5" />
            </motion.button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Drawer de Guardar / Resgatar ─────────────────────────────────────────────
function TransacaoDrawer({
  mode,
  res,
  saldoDisponivel,
  onClose,
}: {
  mode: "guardar" | "resgatar";
  res: ReturnType<typeof useReservations>[number];
  saldoDisponivel: number;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [valor, setValor] = useState("");
  const [loading, setLoading] = useState(false);
  const color = res.color ?? "#6366f1";
  const Icon = getIcon(res.icon_name);
  const cents = toCents(valor);
  const maxCents = mode === "guardar" ? saldoDisponivel : res.amount_cents;
  const isOver = cents > maxCents && maxCents > 0;

  async function handleConfirm() {
    if (cents <= 0) { toast.error("Informe um valor válido."); return; }
    if (isOver) { toast.error(mode === "guardar" ? "Saldo insuficiente." : "Valor maior que o guardado."); return; }
    setLoading(true);
    try {
      if (mode === "guardar") {
        // Cria nova reserva com mesmo título/ícone/cor, adicionando ao valor
        await createReservation({
          cashBoxId: res.cash_box_id,
          title: res.title,
          amountCents: cents,
          ...(res.icon_name ? { iconName: res.icon_name } : {}),
          ...(res.color ? { color: res.color } : {}),
          ...(res.description ? { description: res.description } : {}),
        });
        toast.success(`${brl(cents / 100)} guardado em "${res.title}"!`);
      } else {
        // Resgatar = liberar se esgota, senão libera parcialmente criando nova com saldo restante
        const restoCents = res.amount_cents - cents;
        await releaseReservation(res.id);
        if (restoCents > 0) {
          // Recria com o valor restante
          await createReservation({
            cashBoxId: res.cash_box_id,
            title: res.title,
            amountCents: restoCents,
            ...(res.icon_name ? { iconName: res.icon_name } : {}),
            ...(res.color ? { color: res.color } : {}),
            ...(res.description ? { description: res.description } : {}),
          });
        }
        toast.success(`${brl(cents / 100)} resgatado de "${res.title}"!`);
      }
      qc.invalidateQueries({ queryKey: ["reservations"] });
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao processar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 space-y-5">
      {/* Header identidade da caixinha */}
      <div className="flex items-center gap-3">
        <div className="size-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: color + "22" }}>
          <Icon className="size-6" style={{ color }} />
        </div>
        <div>
          <p className="font-black text-foreground">{res.title}</p>
          <p className="text-xs text-muted-foreground">
            {mode === "guardar"
              ? `Disponível para guardar: ${brl(saldoDisponivel / 100)}`
              : `Guardado atualmente: ${brl(res.amount_cents / 100)}`}
          </p>
        </div>
      </div>

      {/* Valor */}
      <div>
        <label className="text-xs font-bold uppercase tracking-widest opacity-55 block mb-2">
          {mode === "guardar" ? "Quanto guardar?" : "Quanto resgatar?"}
        </label>
        <input
          type="text" inputMode="decimal"
          placeholder="R$ 0,00"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          autoFocus
          className="h-16 w-full rounded-2xl border-2 bg-surface px-5 text-2xl font-black text-foreground outline-none transition-all"
          style={{ borderColor: isOver ? undefined : color }}
        />
        {isOver && <p className="text-xs text-expense mt-1 font-bold">Valor excede o limite.</p>}

        {/* Atalhos rápidos */}
        <div className="flex gap-2 mt-2">
          {[10, 25, 50, 100].map((v) => (
            <button key={v} type="button"
              onClick={() => setValor(String((parseFloat(valor.replace(",", ".")) || 0) + v))}
              className="flex-1 h-8 rounded-xl bg-surface-container text-xs font-bold text-foreground hover:bg-surface-container-high transition-colors">
              +{v}
            </button>
          ))}
        </div>
      </div>

      {/* Confirm */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={handleConfirm}
        disabled={loading || cents <= 0 || isOver}
        className="h-14 w-full rounded-2xl font-black text-sm text-white disabled:opacity-50 transition-opacity"
        style={{ backgroundColor: color }}
      >
        {loading ? "Processando…" : mode === "guardar" ? `Guardar ${valor ? brl(cents / 100) : ""}` : `Resgatar ${valor ? brl(cents / 100) : ""}`}
      </motion.button>
    </div>
  );
}

// ── Formulário de nova caixinha ───────────────────────────────────────────────
function NovaCaixinhaForm({
  boxId,
  saldoDisponivel,
  onDone,
}: {
  boxId: CashBoxId;
  saldoDisponivel: number;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [iconName, setIconName] = useState("PiggyBank");
  const [color, setColor] = useState(COLORS[0]);
  const [loading, setLoading] = useState(false);

  const cents = toCents(valor);
  const isOver = cents > saldoDisponivel && saldoDisponivel > 0;
  const SelectedIcon = getIcon(iconName);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) { toast.error("Dê um nome à sua caixinha."); return; }
    if (cents <= 0) { toast.error("Informe um valor inicial."); return; }
    if (isOver) { toast.error("Saldo insuficiente no caixa."); return; }
    setLoading(true);
    try {
      await createReservation({
        cashBoxId: boxId,
        title: titulo.trim(),
        amountCents: cents,
        iconName,
        ...(descricao.trim() ? { description: descricao.trim() } : {}),
        ...(color ? { color } : {}),
      });
      toast.success(`Caixinha "${titulo.trim()}" criada!`);
      qc.invalidateQueries({ queryKey: ["reservations"] });
      onDone();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao criar caixinha.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 space-y-5 pb-8">
      {/* Preview card */}
      <div className="rounded-2xl p-4 flex items-center gap-3 transition-all" style={{ backgroundColor: color + "18", border: `2px solid ${color}44` }}>
        <div className="size-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: color + "33" }}>
          <SelectedIcon className="size-6" style={{ color }} />
        </div>
        <div>
          <p className="font-black text-foreground">{titulo || "Nome da caixinha"}</p>
          <p className="text-xs" style={{ color }}>{valor ? brl(cents / 100) : "R$ 0,00"}</p>
        </div>
      </div>

      {/* Título */}
      <div>
        <label className="text-xs font-bold uppercase tracking-widest opacity-55 block mb-1.5">Nome</label>
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Viagem, Acampamento, Uniforme"
          maxLength={40} required
          className="h-13 w-full rounded-2xl border border-outline-variant/60 bg-surface px-4 text-sm font-semibold outline-none focus:border-primary transition-all" />
      </div>

      {/* Valor inicial */}
      <div>
        <label className="text-xs font-bold uppercase tracking-widest opacity-55 block mb-1.5">
          Valor inicial — disponível: {brl(saldoDisponivel / 100)}
        </label>
        <input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal"
          placeholder="R$ 0,00" required
          className="h-13 w-full rounded-2xl border-2 bg-surface px-4 text-lg font-black outline-none transition-all"
          style={{ borderColor: isOver ? "#f43f5e" : color }} />
        {isOver && <p className="text-xs text-expense mt-1 font-bold">Excede o saldo disponível.</p>}
        <div className="flex gap-2 mt-2">
          {[10, 20, 50, 100].map((v) => (
            <button key={v} type="button"
              onClick={() => setValor(String((parseFloat(valor.replace(",", ".")) || 0) + v))}
              className="flex-1 h-8 rounded-xl bg-surface-container text-xs font-bold hover:bg-surface-container-high transition-colors">
              +{v}
            </button>
          ))}
        </div>
      </div>

      {/* Seletor de ícone */}
      <div>
        <label className="text-xs font-bold uppercase tracking-widest opacity-55 block mb-2">Ícone</label>
        <div className="grid grid-cols-5 gap-2">
          {ICONS.map(({ name, icon: Icon }) => (
            <button key={name} type="button" onClick={() => setIconName(name)}
              className={cn("size-11 rounded-2xl flex items-center justify-center transition-all border-2",
                iconName === name ? "border-current" : "border-transparent bg-surface-container")}
              style={iconName === name ? { backgroundColor: color + "22", color, borderColor: color } : {}}>
              <Icon className="size-5" />
            </button>
          ))}
        </div>
      </div>

      {/* Seletor de cor */}
      <div>
        <label className="text-xs font-bold uppercase tracking-widest opacity-55 block mb-2">Cor</label>
        <div className="flex gap-2 flex-wrap">
          {COLORS.map((c) => (
            <button key={c} type="button" onClick={() => setColor(c)}
              className="size-9 rounded-full border-2 transition-all flex items-center justify-center"
              style={{ backgroundColor: c, borderColor: color === c ? "#fff" : "transparent" }}>
              {color === c && <Check className="size-4 text-white" strokeWidth={3} />}
            </button>
          ))}
        </div>
      </div>

      {/* Descrição opcional */}
      <div>
        <label className="text-xs font-bold uppercase tracking-widest opacity-55 block mb-1.5">Descrição (opcional)</label>
        <input value={descricao} onChange={(e) => setDescricao(e.target.value)}
          placeholder="Para que é essa caixinha?"
          className="h-11 w-full rounded-2xl border border-outline-variant/60 bg-surface px-4 text-sm outline-none focus:border-primary transition-all" />
      </div>

      <motion.button type="submit" disabled={loading || !titulo || cents <= 0 || isOver}
        whileTap={{ scale: 0.97 }}
        className="h-14 w-full rounded-2xl font-black text-sm text-white disabled:opacity-50"
        style={{ backgroundColor: color }}>
        {loading ? "Criando…" : "Criar Caixinha"}
      </motion.button>
    </form>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
interface ReservationDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boxId: CashBoxId;
}

type ViewState =
  | { type: "lista" }
  | { type: "nova" }
  | { type: "transacao"; mode: "guardar" | "resgatar"; resId: string }
  | { type: "excluir"; resId: string };

export const ReservationDrawer: React.FC<ReservationDrawerProps> = ({ open, onOpenChange, boxId }) => {
  const qc = useQueryClient();
  const boxReservations = useReservations(boxId);
  const canRecord = useCanRecord();

  const [view, setView] = useState<ViewState>({ type: "lista" });
  const [saldoDisponivel, setSaldoDisponivel] = useState(0);
  const [excluindo, setExcluindo] = useState(false);

  useEffect(() => {
    if (!open) { setView({ type: "lista" }); return; }
    supabase.rpc("fn_saldo_disponivel" as any, { p_cash_box_id: boxId }).then(({ data }) => {
      setSaldoDisponivel((data as number | null) ?? 0);
    });
  }, [open, boxId]);

  const ativas = boxReservations.filter((r) => r.status === "ativa");
  const totalGuardado = ativas.reduce((a, r) => a + r.amount_cents, 0);

  async function handleExcluir(resId: string) {
    setExcluindo(true);
    try {
      await releaseReservation(resId);
      toast.success("Caixinha excluída — valor devolvido ao saldo disponível.");
      qc.invalidateQueries({ queryKey: ["reservations"] });
      setView({ type: "lista" });
    } catch (err: any) {
      toast.error(err?.message || "Erro ao excluir.");
    } finally {
      setExcluindo(false);
    }
  }

  const resAtiva = view.type === "transacao" || view.type === "excluir"
    ? ativas.find((r) => r.id === (view as any).resId)
    : undefined;

  const TITLE_MAP: Record<ViewState["type"], string> = {
    lista: "Caixinhas",
    nova: "Nova Caixinha",
    transacao: view.type === "transacao" ? (view.mode === "guardar" ? "Guardar" : "Resgatar") : "",
    excluir: "Excluir Caixinha",
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="rounded-t-3xl bg-background max-w-lg mx-auto flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-5 pb-3 shrink-0">
          <div className="flex items-center gap-2">
            {view.type !== "lista" && (
              <motion.button whileTap={{ scale: 0.9 }}
                onClick={() => setView({ type: "lista" })}
                className="p-1.5 rounded-full hover:bg-surface-container text-muted-foreground transition-colors">
                <X className="size-4" />
              </motion.button>
            )}
            <div>
              <h2 className="text-xl font-black text-foreground">{TITLE_MAP[view.type]}</h2>
              {view.type === "lista" && (
                <p className="text-xs text-muted-foreground">
                  Total acumulado: <span className="font-bold text-foreground">{brl(totalGuardado / 100)}</span>
                </p>
              )}
            </div>
          </div>
          <button onClick={() => onOpenChange(false)}
            className="p-2 rounded-full hover:bg-surface-container text-muted-foreground transition-colors">
            <X className="size-4" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1">
          <AnimatePresence mode="wait">

            {/* ── LISTA ── */}
            {view.type === "lista" && (
              <motion.div key="lista"
                initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}
                transition={{ duration: 0.16 }}
                className="p-4 space-y-3 pb-6">
                <AnimatePresence>
                  {ativas.map((res) => (
                    <CaixinhaCard key={res.id} res={res} canRecord={canRecord}
                      onGuardar={() => setView({ type: "transacao", mode: "guardar", resId: res.id })}
                      onResgatar={() => setView({ type: "transacao", mode: "resgatar", resId: res.id })}
                      onExcluir={() => setView({ type: "excluir", resId: res.id })} />
                  ))}
                </AnimatePresence>

                {ativas.length === 0 && (
                  <div className="py-12 text-center text-muted-foreground space-y-2">
                    <PiggyBank className="size-10 mx-auto opacity-30" />
                    <p className="text-sm font-semibold">Nenhuma caixinha criada ainda.</p>
                    <p className="text-xs opacity-70">Separe uma parte do saldo para objetivos específicos.</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── NOVA ── */}
            {view.type === "nova" && (
              <motion.div key="nova"
                initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.16 }}>
                <NovaCaixinhaForm boxId={boxId} saldoDisponivel={saldoDisponivel}
                  onDone={() => setView({ type: "lista" })} />
              </motion.div>
            )}

            {/* ── GUARDAR / RESGATAR ── */}
            {view.type === "transacao" && resAtiva && (
              <motion.div key="transacao"
                initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.16 }}>
                <TransacaoDrawer mode={view.mode} res={resAtiva} saldoDisponivel={saldoDisponivel}
                  onClose={() => setView({ type: "lista" })} />
              </motion.div>
            )}

            {/* ── EXCLUIR CONFIRM ── */}
            {view.type === "excluir" && resAtiva && (
              <motion.div key="excluir"
                initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.14 }}
                className="p-6 space-y-5">
                <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/30 space-y-2">
                  <p className="text-sm font-black text-destructive">Excluir "{resAtiva.title}"?</p>
                  <p className="text-xs text-muted-foreground">
                    O valor de <strong>{brl(resAtiva.amount_cents / 100)}</strong> será devolvido ao saldo disponível do {CASH_BOX_LABEL[boxId]}.
                    Esta ação não pode ser desfeita.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setView({ type: "lista" })}
                    className="flex-1 h-12 rounded-2xl border border-outline-variant text-sm font-bold text-muted-foreground">
                    Cancelar
                  </button>
                  <motion.button whileTap={{ scale: 0.96 }} onClick={() => handleExcluir(resAtiva.id)}
                    disabled={excluindo}
                    className="flex-1 h-12 rounded-2xl bg-destructive text-white text-sm font-bold disabled:opacity-50">
                    {excluindo ? "Excluindo…" : "Sim, excluir"}
                  </motion.button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* Footer — botão Criar nova caixinha (só na lista) */}
        {view.type === "lista" && canRecord && (
          <div className="p-4 border-t border-outline-variant/15 shrink-0">
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={() => setView({ type: "nova" })}
              className="h-14 w-full rounded-2xl bg-primary text-on-primary font-black text-sm elevation-3 flex items-center justify-center gap-2"
            >
              <Plus className="size-5" /> Criar nova Caixinha
            </motion.button>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
};

import { useState } from "react";
import { Target, Trophy, ChevronRight, Plus } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { brl, toCents, type CashBoxId, CASH_BOX_LABEL } from "@/lib/finance";
import { useMetas, aportarMeta, useCanRecord, type Meta } from "@/lib/data";

interface MetaProgressBarProps {
  lucroDoceria: number;    // lucro acumulado da doceria (receita - custo)
  lucroVendas: number;     // lucro acumulado das vendas
}

const CAIXAS: CashBoxId[] = ["geral", "doceria", "vendas"];

function AporteDrawer({
  meta,
  open,
  onOpenChange,
}: {
  meta: Meta;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const [valor, setValor] = useState("");
  const [caixa, setCaixa] = useState<CashBoxId>("geral");
  const [loading, setLoading] = useState(false);

  async function handleAporte() {
    const cents = toCents(valor);
    if (cents <= 0) { toast.error("Informe um valor válido."); return; }
    setLoading(true);
    try {
      await aportarMeta({
        metaId: meta.id,
        metaDescricao: meta.descricao,
        cashBoxId: caixa,
        amountCents: cents,
        valorAtualCents: Math.round(meta.valor_atual * 100),
        valorAlvoCents: Math.round(meta.valor_alvo * 100),
      });
      toast.success(`Aporte de ${brl(cents / 100)} destinado à meta!`);
      qc.invalidateQueries({ queryKey: ["metas"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      onOpenChange(false);
      setValor("");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao registrar aporte.");
    } finally {
      setLoading(false);
    }
  }

  const falta = meta.valor_alvo - meta.valor_atual;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="rounded-t-3xl bg-surface-container-low max-w-lg mx-auto p-4 pb-8 space-y-4">
        <DrawerHeader className="p-0">
          <DrawerTitle className="text-lg font-black text-foreground flex items-center gap-2">
            <Target className="size-5 text-primary" /> Destinar valor à meta
          </DrawerTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {meta.descricao} — faltam {brl(falta)}
          </p>
        </DrawerHeader>

        <div>
          <label className="text-[11px] font-bold text-muted-foreground uppercase block mb-1">Caixa de origem</label>
          <div className="grid grid-cols-3 gap-2">
            {CAIXAS.map((c) => (
              <button key={c} type="button" onClick={() => setCaixa(c)}
                className={`h-10 rounded-2xl border-2 text-xs font-bold transition-all ${
                  caixa === c ? "border-primary bg-primary-container/30 text-primary" : "border-outline-variant/40 text-muted-foreground"
                }`}>
                {CASH_BOX_LABEL[c]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[11px] font-bold text-muted-foreground uppercase block mb-1">Valor a destinar (R$)</label>
          <input value={valor} onChange={(e) => setValor(e.target.value)}
            inputMode="decimal" placeholder="Ex: 50,00"
            className="h-12 w-full rounded-2xl border border-outline-variant/60 bg-surface px-4 text-sm outline-none focus:border-primary" />
          <div className="flex gap-2 mt-2">
            {[10, 20, 50, 100].map((v) => (
              <button key={v} type="button"
                onClick={() => setValor(String((parseFloat(valor.replace(",", ".")) || 0) + v))}
                className="flex-1 h-8 rounded-xl bg-surface-container-high text-xs font-bold hover:bg-secondary-container transition-all">
                +{v}
              </button>
            ))}
          </div>
        </div>

        <button onClick={handleAporte} disabled={loading}
          className="h-12 w-full rounded-2xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50">
          {loading ? "Registrando…" : "Confirmar Aporte"}
        </button>
      </DrawerContent>
    </Drawer>
  );
}

export function MetaProgressBar({ lucroDoceria, lucroVendas }: MetaProgressBarProps) {
  const metas = useMetas();
  const canRecord = useCanRecord();
  const [aporteDrawer, setAporteDrawer] = useState<Meta | null>(null);

  // Exibe aprovadas, concluídas e pendentes (admin ainda não aprovou)
  const ativas = metas.filter((m) => m.status === "aprovada" || m.status === "concluida" || m.status === "pendente");

  if (ativas.length === 0) return null;

  const lucroTotal = lucroDoceria + lucroVendas;

  return (
    <>
      <div className="space-y-2">
        {ativas.map((meta, index) => {
          const isConcluida = meta.status === "concluida";

          const valorAtual = meta.tipo === "lucro_automatico"
            ? Math.min(lucroTotal, meta.valor_alvo)
            : meta.valor_atual;

          const progresso = meta.valor_alvo > 0
            ? Math.min(100, (valorAtual / meta.valor_alvo) * 100)
            : 0;

          return (
            <motion.div
              key={meta.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 28, delay: index * 0.06 }}
              className={`rounded-3xl border p-4 space-y-2 elevation-1 ${
                isConcluida
                  ? "bg-secondary-container/30 border-secondary/30"
                  : "bg-surface-container-low border-outline-variant/20"
              }`}>
              {/* Cabeçalho */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {isConcluida
                    ? <Trophy className="size-4 text-secondary shrink-0" />
                    : <Target className="size-4 text-primary shrink-0" />}
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{meta.descricao}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {meta.tipo === "lucro_automatico" ? "⚡ Por lucro das vendas" : "🎯 Por destinação manual"}
                      {meta.caixa_origem && ` · ${CASH_BOX_LABEL[meta.caixa_origem as CashBoxId] ?? meta.caixa_origem}`}
                      {meta.status === "pendente" && <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-bold">aguardando aprovação</span>}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-black text-primary">{progresso.toFixed(0)}%</p>
                  <p className="text-[10px] text-muted-foreground">
                    {brl(valorAtual)} / {brl(meta.valor_alvo)}
                  </p>
                </div>
              </div>

              {/* Barra de progresso — spring */}
              <div className="h-2 w-full rounded-full bg-surface-container-highest overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${isConcluida ? "bg-secondary" : "bg-primary"}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${progresso}%` }}
                  transition={{ type: "spring", stiffness: 60, damping: 18, delay: index * 0.06 + 0.1 }}
                />
              </div>

              {/* Botão de aporte */}
              {!isConcluida && meta.tipo === "destinacao_manual" && canRecord && (
                <button
                  onClick={() => setAporteDrawer(meta)}
                  className="flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
                >
                  <Plus className="size-3.5" /> Destinar valor
                </button>
              )}
            </motion.div>
          );
        })}
      </div>

      {aporteDrawer && (
        <AporteDrawer
          meta={aporteDrawer}
          open={!!aporteDrawer}
          onOpenChange={(v) => { if (!v) setAporteDrawer(null); }}
        />
      )}
    </>
  );
}

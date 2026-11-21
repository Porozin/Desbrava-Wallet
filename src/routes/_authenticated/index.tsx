import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Landmark,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowRightLeft,
  Cake,
  Zap,
  Lock,
  Wallet,
  Trophy,
} from "lucide-react";
import { AppShell } from "@/components/m3/AppShell";
import {
  ChipGroup,
  MetricCard,
  ResponsiveTransactionList,
  TransferDrawer,
} from "@/components/m3/parts";
import { MonthlyChart } from "@/components/m3/MonthlyChart";
import { PwaInstallBanner } from "@/components/m3/PwaInstallBanner";
import { MetaProgressBar } from "@/components/m3/MetaProgressBar";
import {
  brl,
  summarize,
  consolidateAllBoxes,
  summarizeBox,
  profitMargin,
  CASH_BOX_LABEL,
} from "@/lib/finance";
import { useCanRecord, useReservations, useTransactions, useMetas, useBoxTransactions } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "GDACaixa 2027 — Dashboard Consolidado" },
      {
        name: "description",
        content:
          "Visão financeira consolidada dos três caixas: Geral, Doceria e Vendas Rápidas.",
      },
      { property: "og:title", content: "GDACaixa 2027 — Dashboard Consolidado" },
      {
        property: "og:description",
        content: "Gestão dos três caixas do Clube Guerreiros do Alto.",
      },
    ],
  }),
  component: Home,
});

type Period = "all" | "30" | "90";

function Home() {
  const all = useTransactions();
  const allReservations = useReservations();
  const canRecord = useCanRecord();
  const todasMetas = useMetas();
  const metasConcluidas = todasMetas.filter((m) => m.status === "concluida");
  const doceriaTx = useBoxTransactions("doceria");
  const vendasTx = useBoxTransactions("vendas");

  // Lucro Doceria = receita - despesa (excluindo transferências)
  const lucroDoceria = (() => {
    const r = doceriaTx.filter((t) => t.kind === "receita" && t.status === "confirmado").reduce((a, t) => a + t.amount, 0);
    const d = doceriaTx.filter((t) => t.kind === "despesa" && t.status === "confirmado").reduce((a, t) => a + t.amount, 0);
    return Math.max(0, r - d);
  })();
  const lucroVendas = (() => {
    const r = vendasTx.filter((t) => t.kind === "receita" && t.status === "confirmado").reduce((a, t) => a + t.amount, 0);
    const d = vendasTx.filter((t) => t.kind === "despesa" && t.status === "confirmado").reduce((a, t) => a + t.amount, 0);
    return Math.max(0, r - d);
  })();

  const [period, setPeriod] = useState<Period>("all");
  const [transferOpen, setTransferOpen] = useState(false);

  const latest = all[0]?.date ?? new Date().toISOString().slice(0, 10);
  const cutoff =
    period === "all"
      ? ""
      : new Date(new Date(latest).getTime() - Number(period) * 864e5)
          .toISOString()
          .slice(0, 10);
  const items = all.filter((t) => t.date >= cutoff);

  // Consolidação matemática dos três caixas
  const consolidation = consolidateAllBoxes(all, allReservations);
  const s = summarize(items);

  const geralBox = summarizeBox(all, "geral", allReservations);
  const doceriaBox = summarizeBox(all, "doceria", allReservations);
  const vendasBox = summarizeBox(all, "vendas", allReservations);

  return (
    <AppShell title="Dashboard Financeiro">
      <PwaInstallBanner />

      {/* Metas com progresso */}
      <MetaProgressBar lucroDoceria={lucroDoceria} lucroVendas={lucroVendas} />
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <ChipGroup
          value={period}
          onChange={setPeriod}
          options={[
            { value: "all", label: "Tudo" },
            { value: "30", label: "30 dias" },
            { value: "90", label: "90 dias" },
          ]}
        />

        {canRecord && (
          <button
            type="button"
            onClick={() => setTransferOpen(true)}
            className="h-9 px-3.5 rounded-full bg-secondary-container text-on-secondary-container text-xs font-bold hover:bg-secondary-container/80 flex items-center gap-1.5 shadow-xs transition-all"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Transferir entre Caixas</span>
          </button>
        )}
      </div>

      {/* Saldo Consolidado Principal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        className="rounded-3xl bg-primary-container p-6 text-on-primary-container shadow-sm space-y-3"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider opacity-80">
            Patrimônio Líquido Consolidado
          </span>
          <Landmark className="w-5 h-5 opacity-80" />
        </div>
        <div>
          <span className="text-3xl sm:text-4xl font-black tracking-tight">
            {brl(consolidation.consolidated.balance)}
          </span>
          <p className="text-xs opacity-80 mt-1">
            Soma invariante dos 3 caixas oficiais: Geral + Doceria + Vendas Rápidas
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-on-primary-container/15 text-xs">
          <div>
            <span className="opacity-75 block">Total Disponível</span>
            <span className="font-black text-sm">
              {brl(consolidation.total_available)}
            </span>
          </div>
          <div>
            <span className="opacity-75 block">Total Reservado</span>
            <span className="font-black text-sm">
              {brl(consolidation.total_reserved)}
            </span>
          </div>
        </div>
      </motion.div>

      {/* Banner de Metas Concluídas */}
      <AnimatePresence>
      {metasConcluidas.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="overflow-hidden"
        >
        <div className="rounded-3xl bg-secondary-container p-5 space-y-3 border border-secondary/20">
          <div className="flex items-center gap-2">
            <Trophy className="size-5 text-on-secondary-container" />
            <h2 className="text-sm font-black text-on-secondary-container">
              Metas Concluídas 🎉
            </h2>
            <span className="ml-auto text-xs font-bold px-2.5 py-0.5 rounded-full bg-secondary text-on-secondary">
              {metasConcluidas.length}
            </span>
          </div>
          <ul className="space-y-1.5">
            {metasConcluidas.map((m) => (
              <li key={m.id} className="flex items-center justify-between text-xs">
                <span className="font-semibold text-on-secondary-container truncate max-w-[70%]">
                  {m.descricao}
                </span>
                <span className="font-black text-on-secondary-container">
                  {brl(m.valor_alvo)}
                </span>
              </li>
            ))}
          </ul>
          <Link
            to="/clube"
            className="inline-flex items-center gap-1 text-xs font-bold text-on-secondary-container underline underline-offset-2"
          >
            Ver todas as metas →
          </Link>
        </div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Visão Rápida dos 3 Caixas Fixos */}
      <div>
        <div className="flex items-center justify-between px-1 mb-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Os Três Caixas Fixos
          </h2>
          <span className="text-[11px] text-muted-foreground">
            Clique no caixa para abrir o extrato
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Caixa Geral */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 28, delay: 0 }}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
          >
          <Link
            to="/clube"
            className="rounded-2xl bg-surface-container-low p-4 border border-outline-variant/30 hover:bg-surface-container transition-colors flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-bold group-hover:text-primary transition-colors flex items-center gap-1.5">
                <Landmark className="w-4 h-4 text-primary" />
                {CASH_BOX_LABEL.geral}
              </span>
              <span className="text-[10px] font-semibold text-muted-foreground group-hover:underline">
                Acessar →
              </span>
            </div>
            <div className="mt-3">
              <span className="text-xl font-black text-foreground">
                {brl(geralBox.available)}
              </span>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Disponível • Total: {brl(geralBox.balance)}
              </p>
            </div>
            {geralBox.reserved_cents > 0 && (
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                <Lock className="w-3 h-3" /> {brl(geralBox.reserved)} reservados
              </span>
            )}
          </Link>
          </motion.div>

          {/* Caixa Doceria */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 28, delay: 0.07 }}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
          >
          <Link
            to="/doceria"
            className="rounded-2xl bg-surface-container-low p-4 border border-outline-variant/30 hover:bg-surface-container transition-colors flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-bold group-hover:text-primary transition-colors flex items-center gap-1.5">
                <Cake className="w-4 h-4 text-primary" />
                {CASH_BOX_LABEL.doceria}
              </span>
              <span className="text-[10px] font-semibold text-muted-foreground group-hover:underline">
                Acessar →
              </span>
            </div>
            <div className="mt-3">
              <span className="text-xl font-black text-foreground">
                {brl(doceriaBox.available)}
              </span>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Disponível • Total: {brl(doceriaBox.balance)}
              </p>
            </div>
            {doceriaBox.reserved_cents > 0 && (
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                <Lock className="w-3 h-3" /> {brl(doceriaBox.reserved)} reservados
              </span>
            )}
          </Link>
          </motion.div>

          {/* Caixa Vendas Rápidas */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 28, delay: 0.14 }}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
          >
          <Link
            to="/vendas"
            className="rounded-2xl bg-surface-container-low p-4 border border-outline-variant/30 hover:bg-surface-container transition-colors flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-bold group-hover:text-primary transition-colors flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-primary" />
                {CASH_BOX_LABEL.vendas}
              </span>
              <span className="text-[10px] font-semibold text-muted-foreground group-hover:underline">
                Acessar →
              </span>
            </div>
            <div className="mt-3">
              <span className="text-xl font-black text-foreground">
                {brl(vendasBox.available)}
              </span>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Disponível • Total: {brl(vendasBox.balance)}
              </p>
            </div>
            {vendasBox.reserved_cents > 0 && (
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                <Lock className="w-3 h-3" /> {brl(vendasBox.reserved)} reservados
              </span>
            )}
          </Link>
          </motion.div>
        </div>
      </div>

      {/* Métricas Consolidadas de Receitas e Despesas (Neutras a Transferências) */}
      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          variant="filled"
          title="Receitas Consolidadas"
          value={brl(s.income)}
          subtitle="Exclui transferências internas"
          icon={ArrowDownLeft}
          tone="income"
        />
        <MetricCard
          variant="filled"
          title="Despesas Consolidadas"
          value={brl(s.expense)}
          subtitle="Exclui transferências internas"
          icon={ArrowUpRight}
          tone="expense"
        />
      </div>

      {/* Gráfico Mensal */}
      <div className="rounded-3xl bg-surface-container-low p-5 border border-outline-variant/20 shadow-xs">
        <h2 className="text-base font-bold text-foreground mb-3">
          Receitas × Despesas por Mês
        </h2>
        <MonthlyChart items={items} />
      </div>

      {/* Lista Responsiva de Transações com visualização adaptada touch/desktop */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-base font-bold text-foreground">
            Todas as Movimentações
          </h2>
          <span className="text-xs text-muted-foreground">
            {items.length} registro(s)
          </span>
        </div>
        <ResponsiveTransactionList items={items.slice(0, 10)} title="" />
      </div>

      {/* Drawer de Transferência */}
      <TransferDrawer
        open={transferOpen}
        onOpenChange={setTransferOpen}
        defaultOriginBox="geral"
      />
    </AppShell>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Landmark, Cake, Zap, Search, Printer, Package,
  Target, Trophy, Plus, Pencil, TrendingUp, ShoppingBag,
  AlertTriangle,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { AppShell } from "@/components/m3/AppShell";
import {
  ChipGroup, MetricCard, NewEntryFab, ResponsiveTransactionList, CashBoxHeaderCard,
} from "@/components/m3/parts";
import { MetaDrawer } from "@/components/m3/MetaDrawer";
import { MaterialDrawer } from "@/components/m3/MaterialDrawer";
import { ProductRecipeDrawer } from "@/components/m3/ProductRecipeDrawer";
import { brl, summarizeBox } from "@/lib/finance";
import {
  useTransactions, useBoxTransactions, useReservations,
  useMetas, useMateriais, useProdutos, useAvarias, addAvaria,
  useCanRecord, useMe,
  type Meta, type MaterialItem, type Produto,
} from "@/lib/data";
import { generatePrintReport } from "@/lib/printReport";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/caixas")({
  head: () => ({
    meta: [
      { title: "GDACaixa 2027 — Caixas" },
      { name: "description", content: "Gestão dos caixas Geral, Doceria e Vendas Rápidas." },
      { property: "og:title", content: "GDACaixa 2027 — Caixas" },
    ],
  }),
  component: Caixas,
});

type CaixaSeg = "geral" | "doceria" | "vendas";
const SEG_ORDER: CaixaSeg[] = ["geral", "doceria", "vendas"];

function getSavedCaixa(): CaixaSeg {
  try {
    const v = localStorage.getItem("gda_active_caixa") as CaixaSeg | null;
    if (v && SEG_ORDER.includes(v)) return v;
  } catch {}
  return "geral";
}

// ── Slide variants ───────────────────────────────────────────────────────
const slideVariants = {
  enter:  (dir: number) => ({ x: dir * 24, opacity: 0 }),
  center:               ({ x: 0, opacity: 1 }),
  exit:   (dir: number) => ({ x: dir * -24, opacity: 0 }),
};

// ── FABs per caixa ───────────────────────────────────────────────────────
const FAB_MAP: Record<CaixaSeg, React.ReactNode> = {
  geral:   <NewEntryFab module="clube"   boxId="geral" />,
  doceria: <NewEntryFab module="doceria" boxId="doceria" />,
  vendas:  <NewEntryFab module="vendas"  boxId="vendas" withSeller />,
};

// ════════════════════════════════════════════════════════════════════════
// CAIXA GERAL CONTENT
// ════════════════════════════════════════════════════════════════════════
function CaixaGeralContent() {
  const allTx = useTransactions();
  const boxTx = useBoxTransactions("geral");
  const boxReservations = useReservations("geral");
  const metas = useMetas("clube");
  const materiais = useMateriais("clube");
  const { data: me } = useMe();
  const canRecord = useCanRecord();

  const [currentTab, setCurrentTab] = useState<"caixa" | "metas" | "materiais">("caixa");
  const [kind, setKind] = useState<"all" | "receita" | "despesa" | "transferencia">("all");
  const [q, setQ] = useState("");
  const [metaDrawerOpen, setMetaDrawerOpen] = useState(false);
  const [editMeta, setEditMeta] = useState<Meta | undefined>(undefined);
  const [matDrawerOpen, setMatDrawerOpen] = useState(false);

  const boxSummary = summarizeBox(allTx, "geral", boxReservations);
  const custoTotalMateriais = materiais.reduce((acc, cur) => acc + cur.custo_total, 0);

  const items = boxTx.filter(
    (t) => (kind === "all" || t.kind === kind) &&
      (t.description.toLowerCase().includes(q.toLowerCase()) ||
       t.category.toLowerCase().includes(q.toLowerCase()))
  );

  function handlePrint() {
    generatePrintReport({
      module: "clube",
      title: "Livro Caixa Oficial — Caixa Geral",
      responsible: me?.name || "Tesouraria Geral",
      transactions: boxTx,
      additionalStats: [
        { label: "Saldo Disponível", value: brl(boxSummary.available) },
        { label: "Saldo Reservado",  value: brl(boxSummary.reserved) },
        { label: "Transf. Recebidas", value: `+${brl(boxSummary.transfers_in)}` },
        { label: "Transf. Enviadas",  value: `−${brl(boxSummary.transfers_out)}`, isNegative: true },
      ],
      signatures: [{ role: "Diretor(a) do Clube" }, { role: "Tesoureiro(a) Geral" }],
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <ChipGroup
          value={currentTab}
          onChange={setCurrentTab}
          options={[
            { value: "caixa",     label: "Caixa Geral" },
            { value: "metas",     label: `Metas (${metas.length})` },
            { value: "materiais", label: `Almoxarifado (${materiais.length})` },
          ]}
        />
        <button onClick={handlePrint} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-high/70 hover:bg-surface-variant text-xs font-bold text-foreground transition-all shrink-0">
          <Printer className="size-4" />
          <span className="hidden sm:inline">PDF</span>
        </button>
      </div>

      {currentTab === "caixa" && (
        <>
          <CashBoxHeaderCard boxId="geral" summary={boxSummary} />
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…"
              className="h-14 w-full rounded-2xl bg-surface-container-high/60 pl-12 pr-4 text-sm outline-none border border-outline-variant/30 focus:border-primary transition-all" />
          </div>
          <ChipGroup value={kind} onChange={setKind} options={[
            { value: "all", label: "Todas" }, { value: "receita", label: "Receitas" },
            { value: "despesa", label: "Despesas" }, { value: "transferencia", label: "Transf." },
          ]} />
          <ResponsiveTransactionList items={items} currentBoxId="geral" title="Histórico — Caixa Geral" empty="Nenhuma movimentação." />
        </>
      )}

      {currentTab === "metas" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-base font-bold">Metas do Clube</h2>
            {canRecord && (
              <button onClick={() => { setEditMeta(undefined); setMetaDrawerOpen(true); }} className="flex items-center gap-1 text-xs font-bold text-primary hover:underline">
                <Plus className="size-4" /> Nova Meta
              </button>
            )}
          </div>
          {!metas.length ? (
            <div className="p-8 text-center text-muted-foreground bg-surface-container-low rounded-3xl border border-outline-variant/20">Nenhuma meta.</div>
          ) : (
            <div className="space-y-3">
              {metas.map((m) => {
                const isConcluida = m.status === "concluida";
                const prog = m.valor_alvo > 0 ? Math.min(100, (m.valor_atual / m.valor_alvo) * 100) : 0;
                return (
                  <div key={m.id} className={`rounded-3xl border p-4 space-y-3 elevation-1 ${isConcluida ? "bg-secondary-container/30 border-secondary/20" : "bg-surface-container-low border-outline-variant/20"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {isConcluida ? <Trophy className="size-4 text-secondary shrink-0" /> : <Target className="size-4 text-primary shrink-0" />}
                        <div className="min-w-0">
                          <p className="text-sm font-bold truncate">{m.descricao}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {m.tipo === "lucro_automatico" ? "⚡ Por lucro" : "🎯 Por destinação"}
                            {m.status === "pendente" && <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-bold">aguardando</span>}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          <p className="text-xs font-black text-primary">{prog.toFixed(0)}%</p>
                          <p className="text-[10px] text-muted-foreground">{brl(m.valor_atual)} / {brl(m.valor_alvo)}</p>
                        </div>
                        {canRecord && <button onClick={() => { setEditMeta(m); setMetaDrawerOpen(true); }} className="p-1.5 rounded-full hover:bg-surface-variant/60 text-muted-foreground hover:text-primary"><Pencil className="size-3.5" /></button>}
                      </div>
                    </div>
                    <div className="h-2 w-full rounded-full bg-surface-container-highest overflow-hidden">
                      <motion.div className={`h-full rounded-full ${isConcluida ? "bg-secondary" : "bg-primary"}`}
                        initial={{ width: 0 }} animate={{ width: `${prog}%` }}
                        transition={{ type: "spring", stiffness: 60, damping: 18 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {currentTab === "materiais" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div>
              <h2 className="text-base font-bold">Almoxarifado</h2>
              <p className="text-xs text-muted-foreground">Total investido: <strong>{brl(custoTotalMateriais)}</strong></p>
            </div>
            {canRecord && <button onClick={() => setMatDrawerOpen(true)} className="flex items-center gap-1 text-xs font-bold text-primary hover:underline"><Plus className="size-4" /> Novo Item</button>}
          </div>
          {!materiais.length ? (
            <div className="p-8 text-center text-muted-foreground bg-surface-container-low rounded-3xl border border-outline-variant/20">Nenhum material.</div>
          ) : (
            <div className="divide-y divide-outline-variant/20 rounded-3xl bg-surface-container-low border border-outline-variant/20 overflow-hidden elevation-1">
              {materiais.map((mat) => (
                <div key={mat.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-surface-container-high text-muted-foreground"><Package className="size-4" /></div>
                    <div>
                      <h4 className="text-sm font-bold">{mat.nome}</h4>
                      <p className="text-xs text-muted-foreground">{mat.quantidade} {mat.unidade_medida || "un"}</p>
                    </div>
                  </div>
                  <span className="text-sm font-bold">{brl(mat.custo_total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <MetaDrawer open={metaDrawerOpen} onOpenChange={(v) => { setMetaDrawerOpen(v); if (!v) setEditMeta(undefined); }} meta={editMeta} />
      <Drawer open={matDrawerOpen} onOpenChange={setMatDrawerOpen}>
        <DrawerContent className="rounded-t-3xl bg-surface-container-low max-w-lg mx-auto">
          <DrawerHeader><DrawerTitle className="text-lg font-black">Novo Material</DrawerTitle></DrawerHeader>
          <form className="space-y-4 px-4 pb-8" onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const { addMaterial } = await import("@/lib/data");
            try {
              await addMaterial({ modulo: "clube", nome: String(f.get("nome") || "").trim(), quantidade: Number(f.get("quantidade")) || 1, custo_total: Number(String(f.get("custo_total")).replace(",", ".")) || 0, unidade_medida: "un" });
              toast.success("Material adicionado!"); setMatDrawerOpen(false);
            } catch { toast.error("Falha ao salvar."); }
          }}>
            <input name="nome" placeholder="Nome do material" className="h-14 w-full rounded-2xl border border-outline-variant/60 bg-surface px-4 text-sm outline-none focus:border-primary" required />
            <div className="grid grid-cols-2 gap-3">
              <input name="quantidade" type="number" defaultValue={1} placeholder="Qtd" className="h-14 w-full rounded-2xl border border-outline-variant/60 bg-surface px-4 text-sm outline-none focus:border-primary" />
              <input name="custo_total" inputMode="decimal" placeholder="Custo total (R$)" className="h-14 w-full rounded-2xl border border-outline-variant/60 bg-surface px-4 text-sm outline-none focus:border-primary" />
            </div>
            <button type="submit" className="h-12 w-full rounded-2xl bg-primary text-on-primary font-bold">Adicionar</button>
          </form>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// CAIXA DOCERIA CONTENT
// ════════════════════════════════════════════════════════════════════════
function CaixaDoceiraContent() {
  const allTx = useTransactions();
  const boxTx = useBoxTransactions("doceria");
  const boxReservations = useReservations("doceria");
  const materiais = useMateriais("doceria");
  const { data: produtos = [], refetch: refetchProdutos } = useProdutos("doceria");
  const { data: me } = useMe();
  const canRecord = useCanRecord();

  const [currentTab, setCurrentTab] = useState<"caixa" | "produtos" | "insumos">("caixa");
  const [kind, setKind] = useState<"all" | "receita" | "despesa" | "transferencia">("all");
  const [q, setQ] = useState("");
  const [matDrawerOpen, setMatDrawerOpen] = useState(false);
  const [prodDrawerOpen, setProdDrawerOpen] = useState(false);
  const [editProduto, setEditProduto] = useState<Produto | undefined>(undefined);
  const [editMaterial, setEditMaterial] = useState<MaterialItem | undefined>(undefined);

  const boxSummary = summarizeBox(allTx, "doceria", boxReservations);
  const profit = boxSummary.income - boxSummary.expense;
  const margin = boxSummary.income > 0 ? profit / boxSummary.income : 0;

  const items = boxTx.filter(
    (t) => (kind === "all" || t.kind === kind) &&
      (t.description.toLowerCase().includes(q.toLowerCase()) ||
       t.category.toLowerCase().includes(q.toLowerCase()))
  );

  function handlePrint() {
    generatePrintReport({
      module: "doceria",
      title: "Extrato — Caixa da Doceria",
      responsible: me?.name || "Responsável Doceria",
      transactions: boxTx,
      additionalStats: [
        { label: "Saldo Disponível", value: brl(boxSummary.available) },
        { label: "Lucro Operacional", value: brl(profit) },
        { label: "Transf. Enviadas (Repasses)", value: `−${brl(boxSummary.transfers_out)}`, isNegative: true },
      ],
      signatures: [{ role: "Diretor(a) do Clube" }, { role: "Responsável Doceria" }],
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <ChipGroup value={currentTab} onChange={setCurrentTab} options={[
          { value: "caixa",    label: "Caixa & Vendas" },
          { value: "produtos", label: `Doces (${produtos.length})` },
          { value: "insumos",  label: `Insumos (${materiais.length})` },
        ]} />
        <button onClick={handlePrint} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-high/70 text-xs font-bold transition-all shrink-0">
          <Printer className="size-4" /><span className="hidden sm:inline">PDF</span>
        </button>
      </div>

      {currentTab === "caixa" && (
        <>
          <CashBoxHeaderCard boxId="doceria" summary={boxSummary} />
          <div className="grid grid-cols-2 gap-3">
            <MetricCard variant="filled" title="Lucro Operacional" value={brl(profit)}
              subtitle={`Margem ${(margin * 100).toFixed(0)}% (receita - despesas)`} icon={TrendingUp}
              tone={profit >= 0 ? "income" : "expense"} />
            <MetricCard variant="filled" title="Repasses Feitos" value={brl(boxSummary.transfers_out)}
              subtitle="Transferido para outros caixas" icon={ShoppingBag} />
          </div>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por item, doce ou categoria…"
              className="h-14 w-full rounded-2xl bg-surface-container-high/60 pl-12 pr-4 text-sm outline-none border border-outline-variant/30 focus:border-primary transition-all" />
          </div>
          <ChipGroup value={kind} onChange={setKind} options={[
            { value: "all", label: "Todas" }, { value: "receita", label: "Vendas (+)" },
            { value: "despesa", label: "Custos (−)" }, { value: "transferencia", label: "Transf." },
          ]} />
          <ResponsiveTransactionList items={items} currentBoxId="doceria" title="Histórico — Doceria" empty="Nenhuma movimentação." />
        </>
      )}

      {currentTab === "produtos" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-base font-bold">Cardápio & Fichas Técnicas</h2>
            {canRecord && <button onClick={() => setProdDrawerOpen(true)} className="flex items-center gap-1 text-xs font-bold text-primary hover:underline"><Plus className="size-4" /> Novo Doce</button>}
          </div>
          {!produtos.length ? (
            <div className="p-8 text-center text-muted-foreground bg-surface-container-low rounded-3xl border border-outline-variant/20">Nenhum doce cadastrado.</div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {produtos.map((p) => {
                const lucro = p.preco_venda - p.custo - p.comissao;
                const mg = p.preco_venda > 0 ? (lucro / p.preco_venda) * 100 : 0;
                return (
                  <div key={p.id} className="p-5 rounded-3xl bg-surface-container-low border border-outline-variant/20 elevation-1 flex flex-col justify-between">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Cake className="size-3.5 text-primary" /> Doce</span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary ml-2">Mg: {mg.toFixed(0)}%</span>
                        <h3 className="text-base font-bold mt-1">{p.nome}</h3>
                      </div>
                      {canRecord && <button onClick={() => { setEditProduto(p); setProdDrawerOpen(true); }} className="p-1.5 rounded-full hover:bg-surface-variant/60 text-muted-foreground hover:text-primary"><Pencil className="size-3.5" /></button>}
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-outline-variant/20 pt-3">
                      <div>
                        <span className="text-base font-black text-income">{brl(p.preco_venda)}</span>
                        <span className="text-[11px] text-muted-foreground block">Lucro: {brl(lucro)}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">Custo: <strong>{brl(p.custo)}</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {currentTab === "insumos" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-base font-bold">Insumos & Ingredientes</h2>
            {canRecord && <button onClick={() => setMatDrawerOpen(true)} className="flex items-center gap-1 text-xs font-bold text-primary hover:underline"><Plus className="size-4" /> Novo Insumo</button>}
          </div>
          {!materiais.length ? (
            <div className="p-8 text-center text-muted-foreground bg-surface-container-low rounded-3xl border border-outline-variant/20">Nenhum insumo.</div>
          ) : (
            <div className="divide-y divide-outline-variant/20 rounded-3xl bg-surface-container-low border border-outline-variant/20 overflow-hidden elevation-1">
              {materiais.map((mat) => (
                <div key={mat.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-secondary-container text-on-secondary-container"><Package className="size-4" /></div>
                    <div>
                      <h4 className="text-sm font-bold">{mat.nome}</h4>
                      <p className="text-xs text-muted-foreground">{mat.quantidade} {mat.unidade_medida || "un"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">{brl(mat.custo_total)}</span>
                    {canRecord && <button onClick={() => { setEditMaterial(mat); setMatDrawerOpen(true); }} className="p-1.5 rounded-full hover:bg-surface-variant/60 text-muted-foreground hover:text-primary"><Pencil className="size-3.5" /></button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <MaterialDrawer open={matDrawerOpen} onOpenChange={(v) => { setMatDrawerOpen(v); if (!v) setEditMaterial(undefined); }} modulo="doceria" material={editMaterial} />
      <ProductRecipeDrawer open={prodDrawerOpen} onOpenChange={(v) => { setProdDrawerOpen(v); if (!v) setEditProduto(undefined); }} modulo="doceria" produto={editProduto} onSuccess={refetchProdutos} />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// CAIXA VENDAS CONTENT
// ════════════════════════════════════════════════════════════════════════
function CaixaVendasContent() {
  const allTx = useTransactions();
  const boxTx = useBoxTransactions("vendas");
  const boxReservations = useReservations("vendas");
  const { data: avarias = [] } = useAvarias();
  const { data: me } = useMe();
  const canRecord = useCanRecord();

  const [currentTab, setCurrentTab] = useState<"caixa" | "avarias">("caixa");
  const [kind, setKind] = useState<"all" | "receita" | "despesa" | "transferencia">("all");
  const [q, setQ] = useState("");
  const [avariaDrawerOpen, setAvariaDrawerOpen] = useState(false);

  const boxSummary = summarizeBox(allTx, "vendas", boxReservations);
  const totalAvarias = avarias.reduce((acc, cur) => acc + cur.perda_estimada, 0);
  const profit = boxSummary.income - boxSummary.expense;

  const items = boxTx.filter(
    (t) => (kind === "all" || t.kind === kind) &&
      (t.description.toLowerCase().includes(q.toLowerCase()) ||
       t.category.toLowerCase().includes(q.toLowerCase()) ||
       (t.seller && t.seller.toLowerCase().includes(q.toLowerCase())))
  );

  function handlePrint() {
    generatePrintReport({
      module: "vendas",
      title: "Extrato — Caixa de Vendas Rápidas",
      responsible: me?.name || "Responsável Vendas",
      transactions: boxTx,
      additionalStats: [
        { label: "Saldo Disponível", value: brl(boxSummary.available) },
        { label: "Lucro Operacional", value: brl(profit) },
        { label: "Perdas (Avarias)", value: `-${brl(totalAvarias)}`, isNegative: true },
      ],
      signatures: [{ role: "Diretor(a) do Clube" }, { role: "Responsável Vendas" }],
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <ChipGroup value={currentTab} onChange={setCurrentTab} options={[
          { value: "caixa",   label: "Caixa & Vendas" },
          { value: "avarias", label: `Avarias (${avarias.length})` },
        ]} />
        <button onClick={handlePrint} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-high/70 text-xs font-bold transition-all shrink-0">
          <Printer className="size-4" /><span className="hidden sm:inline">PDF</span>
        </button>
      </div>

      {currentTab === "caixa" && (
        <>
          <CashBoxHeaderCard boxId="vendas" summary={boxSummary} />
          <div className="grid grid-cols-2 gap-3">
            <MetricCard variant="filled" title="Receita Total" value={brl(boxSummary.income)} subtitle="Vendas confirmadas" icon={TrendingUp} tone="income" />
            <MetricCard variant="filled" title="Lucro Líquido" value={brl(profit)}
              subtitle={boxSummary.income > 0 ? `Margem ${(profit / boxSummary.income * 100).toFixed(0)}%` : "Sem receitas"}
              icon={TrendingUp} tone={profit >= 0 ? "income" : "expense"} />
            <MetricCard variant="filled" title="Perdas / Avarias" value={brl(totalAvarias)} subtitle="Itens danificados" icon={AlertTriangle} tone="expense" />
            <MetricCard variant="filled" title="Repasses" value={brl(boxSummary.transfers_out)} subtitle="Transferido para outros caixas" icon={ShoppingBag} />
          </div>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por descrição, vendedor…"
              className="h-14 w-full rounded-2xl bg-surface-container-high/60 pl-12 pr-4 text-sm outline-none border border-outline-variant/30 focus:border-primary transition-all" />
          </div>
          <ChipGroup value={kind} onChange={setKind} options={[
            { value: "all", label: "Todas" }, { value: "receita", label: "Vendas (+)" },
            { value: "despesa", label: "Despesas (−)" }, { value: "transferencia", label: "Transf." },
          ]} />
          <ResponsiveTransactionList items={items} currentBoxId="vendas" title="Histórico — Vendas Rápidas" empty="Nenhuma movimentação." />
        </>
      )}

      {currentTab === "avarias" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div>
              <h2 className="text-base font-bold">Avarias e Perdas</h2>
              <p className="text-xs text-muted-foreground">Prejuízo acumulado: <strong className="text-expense">{brl(totalAvarias)}</strong></p>
            </div>
            {canRecord && <button onClick={() => setAvariaDrawerOpen(true)} className="flex items-center gap-1 text-xs font-bold text-expense hover:underline"><Plus className="size-4" /> Registrar</button>}
          </div>
          {!avarias.length ? (
            <div className="p-8 text-center text-muted-foreground bg-surface-container-low rounded-3xl border border-outline-variant/20">Nenhuma avaria.</div>
          ) : (
            <div className="divide-y divide-outline-variant/20 rounded-3xl bg-surface-container-low border border-outline-variant/20 overflow-hidden">
              {avarias.map((av) => (
                <div key={av.id} className="p-4 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold">{av.produto_nome}</h4>
                    <p className="text-xs text-muted-foreground">{av.quantidade} un • {av.motivo || "Sem motivo"}</p>
                  </div>
                  <span className="text-sm font-bold text-expense">−{brl(av.perda_estimada)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Drawer open={avariaDrawerOpen} onOpenChange={setAvariaDrawerOpen}>
        <DrawerContent className="rounded-t-3xl bg-surface-container-low max-w-lg mx-auto">
          <DrawerHeader><DrawerTitle className="text-lg font-black">Registrar Avaria</DrawerTitle></DrawerHeader>
          <form className="space-y-4 px-4 pb-8" onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            try {
              await addAvaria({ produto_nome: String(f.get("produto_nome") || "").trim(), quantidade: Number(f.get("quantidade")) || 1, perda_estimada: Number(String(f.get("perda_estimada")).replace(",", ".")) || 0, motivo: String(f.get("motivo") || ""), data: new Date().toISOString().slice(0, 10) });
              toast.success("Avaria registrada!"); setAvariaDrawerOpen(false);
            } catch { toast.error("Falha ao registrar."); }
          }}>
            <input name="produto_nome" placeholder="Produto avariado" className="h-14 w-full rounded-2xl border border-outline-variant/60 bg-surface px-4 text-sm outline-none focus:border-primary" required />
            <div className="grid grid-cols-2 gap-3">
              <input name="quantidade" type="number" defaultValue={1} placeholder="Qtd" className="h-14 w-full rounded-2xl border border-outline-variant/60 bg-surface px-4 text-sm outline-none focus:border-primary" />
              <input name="perda_estimada" inputMode="decimal" placeholder="Perda (R$)" className="h-14 w-full rounded-2xl border border-outline-variant/60 bg-surface px-4 text-sm outline-none focus:border-primary" />
            </div>
            <input name="motivo" placeholder="Motivo (opcional)" className="h-14 w-full rounded-2xl border border-outline-variant/60 bg-surface px-4 text-sm outline-none focus:border-primary" />
            <button type="submit" className="h-12 w-full rounded-2xl bg-expense text-white font-bold">Registrar Avaria</button>
          </form>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// PAGE PRINCIPAL
// ════════════════════════════════════════════════════════════════════════
function Caixas() {
  const [activeCaixa, setActiveCaixaState] = useState<CaixaSeg>(getSavedCaixa);
  const [slideDir, setSlideDir] = useState<1 | -1>(1);

  function switchCaixa(next: CaixaSeg) {
    const curIdx = SEG_ORDER.indexOf(activeCaixa);
    const nextIdx = SEG_ORDER.indexOf(next);
    setSlideDir(nextIdx > curIdx ? 1 : -1);
    setActiveCaixaState(next);
    try { localStorage.setItem("gda_active_caixa", next); } catch {}
  }

  const TITLE_MAP: Record<CaixaSeg, string> = {
    geral:   "Caixa Geral",
    doceria: "Doceria",
    vendas:  "Vendas Rápidas",
  };

  return (
    <AppShell title={TITLE_MAP[activeCaixa]} fab={FAB_MAP[activeCaixa]}>
      {/* Segment selector */}
      <ChipGroup
        value={activeCaixa}
        onChange={switchCaixa}
        options={[
          { value: "geral",   label: "Geral" },
          { value: "doceria", label: "Doceria" },
          { value: "vendas",  label: "Vendas Rápidas" },
        ]}
      />

      {/* Animated content */}
      <AnimatePresence mode="wait" custom={slideDir}>
        <motion.div
          key={activeCaixa}
          custom={slideDir}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.18, ease: "easeInOut" }}
        >
          {activeCaixa === "geral"   && <CaixaGeralContent />}
          {activeCaixa === "doceria" && <CaixaDoceiraContent />}
          {activeCaixa === "vendas"  && <CaixaVendasContent />}
        </motion.div>
      </AnimatePresence>
    </AppShell>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Zap,
  Trophy,
  Plus,
  AlertTriangle,
  Package,
  Printer,
  Search,
  Sparkles,
  Pencil,
} from "lucide-react";
import { AppShell } from "@/components/m3/AppShell";
import {
  ChipGroup,
  MetricCard,
  NewEntryFab,
  ResponsiveTransactionList,
  CashBoxHeaderCard,
} from "@/components/m3/parts";
import { brl, commissionBySeller, summarizeBox } from "@/lib/finance";
import {
  useTransactions,
  useBoxTransactions,
  useReservations,
  useProdutos,
  useAvarias,
  addAvaria,
  useCanRecord,
  useMe,
  type Produto,
} from "@/lib/data";
import { generatePrintReport } from "@/lib/printReport";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { ProductRecipeDrawer } from "@/components/m3/ProductRecipeDrawer";
import { PdvGrid } from "@/components/m3/PdvGrid";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/vendas")({
  head: () => ({
    meta: [
      { title: "GDACaixa 2027 — Caixa de Vendas Rápidas" },
      {
        name: "description",
        content: "Vendas rápidas, produtos, perdas/avarias e comissões.",
      },
      { property: "og:title", content: "GDACaixa 2027 — Caixa de Vendas Rápidas" },
      {
        property: "og:description",
        content: "Gestão do Caixa de Vendas Rápidas do Clube Guerreiros do Alto.",
      },
    ],
  }),
  component: Vendas,
});

type TabView = "vendas" | "pdv" | "produtos" | "avarias";

function Vendas() {
  const allTx = useTransactions();
  const boxTx = useBoxTransactions("vendas");
  const boxReservations = useReservations("vendas");
  const { data: produtos = [], refetch: refetchProdutos } = useProdutos("vendas");
  const { data: avarias = [] } = useAvarias();
  const { data: me } = useMe();
  const canRecord = useCanRecord();

  const [currentTab, setCurrentTab] = useState<TabView>("vendas");
  const [kind, setKind] = useState<"all" | "receita" | "despesa" | "transferencia">("all");
  const [q, setQ] = useState("");
  const [prodDrawerOpen, setProdDrawerOpen] = useState(false);
  const [editProduto, setEditProduto] = useState<Produto | undefined>(undefined);
  const [avariaDrawerOpen, setAvariaDrawerOpen] = useState(false);

  const boxSummary = summarizeBox(allTx, "vendas", boxReservations);
  const ranking = commissionBySeller(boxTx);
  const totalComissoes = ranking.reduce((acc, cur) => acc + cur.commission, 0);
  const totalAvarias = avarias.reduce((acc, cur) => acc + cur.perda_estimada, 0);

  const items = boxTx.filter(
    (t) =>
      (kind === "all" || t.kind === kind) &&
      (t.description.toLowerCase().includes(q.toLowerCase()) ||
        t.category.toLowerCase().includes(q.toLowerCase()) ||
        (t.seller && t.seller.toLowerCase().includes(q.toLowerCase())))
  );

  async function handleAddAvaria(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const prodNome = String(f.get("produto_nome") || "").trim();
    const qtd = Number(f.get("quantidade")) || 1;
    const perda = Number(String(f.get("perda_estimada")).replace(",", ".")) || 0;
    const motivo = String(f.get("motivo") || "");
    if (!prodNome || qtd <= 0) {
      toast.error("Informe o produto e a quantidade avariada.");
      return;
    }
    try {
      await addAvaria({
        produto_nome: prodNome,
        quantidade: qtd,
        perda_estimada: perda,
        motivo,
        data: new Date().toISOString().slice(0, 10),
      });
      toast.success("Avaria registrada no sistema!");
      setAvariaDrawerOpen(false);
    } catch {
      toast.error("Falha ao registrar avaria.");
    }
  }

  function handlePrint() {
    generatePrintReport({
      module: "vendas",
      title: "Extrato Oficial — Caixa de Vendas Rápidas & Eventos",
      responsible: me?.name || "Tesouraria de Vendas",
      transactions: boxTx,
      additionalStats: [
        { label: "Saldo Disponível", value: brl(boxSummary.available) },
        { label: "Saldo Reservado", value: brl(boxSummary.reserved) },
        { label: "Comissões Distribuídas", value: brl(totalComissoes) },
        { label: "Perdas (Avarias)", value: `-${brl(totalAvarias)}`, isNegative: true },
        { label: "Transferências Enviadas", value: `−${brl(boxSummary.transfers_out)}`, isNegative: true },
        { label: "Transferências Recebidas", value: `+${brl(boxSummary.transfers_in)}` },
      ],
      signatures: [
        { role: "Diretor(a) do Clube" },
        { role: "Responsável Vendas" },
      ],
    });
  }

  return (
    <AppShell title="Vendas Rápidas" fab={<NewEntryFab module="vendas" boxId="vendas" withSeller />}>
      {/* Abas Secundárias M3 */}
      <div className="flex gap-2">
        <ChipGroup
          value={currentTab}
          onChange={setCurrentTab}
          options={[
            { value: "pdv", label: "🛒 PDV" },
            { value: "vendas", label: "Caixa & Vendas" },
            { value: "produtos", label: `Catálogo (${produtos.length})` },
            { value: "avarias", label: `Avarias (${avarias.length})` },
          ]}
        />
        <button
          onClick={handlePrint}
          title="Imprimir Extrato Oficial de Vendas"
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-high/70 hover:bg-surface-variant text-xs font-bold text-foreground transition-all shrink-0"
        >
          <Printer className="size-4" />
          <span className="hidden sm:inline">Extrato PDF</span>
        </button>
      </div>

      {currentTab === "pdv" && (
        <PdvGrid
          produtos={produtos}
          module="vendas"
          boxId="vendas"
          defaultIcon="zap"
        />
      )}

      {currentTab === "vendas" && (
        <>
          {/* Card Central com Saldos (Disponível, Contábil e Reservas) */}
          <CashBoxHeaderCard boxId="vendas" summary={boxSummary} />

          {/* Métricas de Comissões e Avarias */}
          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              variant="filled"
              title="Comissões Pagas"
              value={brl(totalComissoes)}
              subtitle="Repasse aos desbravadores"
              icon={Trophy}
              tone="expense"
            />
            <MetricCard
              variant="filled"
              title="Perdas / Avarias"
              value={brl(totalAvarias)}
              subtitle="Itens perdidos ou danificados"
              icon={AlertTriangle}
              tone="expense"
            />
          </div>

          {/* Busca e Filtros */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por descrição, vendedor ou produto…"
              className="h-14 w-full rounded-2xl bg-surface-container-high/60 pl-12 pr-4 text-sm text-foreground outline-none border border-outline-variant/30 focus:border-2 focus:border-primary transition-all"
            />
          </div>

          <ChipGroup
            value={kind}
            onChange={setKind}
            options={[
              { value: "all", label: "Todas" },
              { value: "receita", label: "Vendas (+)" },
              { value: "despesa", label: "Despesas (−)" },
              { value: "transferencia", label: "Transferências" },
            ]}
          />

          <ResponsiveTransactionList
            items={items}
            currentBoxId="vendas"
            title="Histórico de Movimentações — Vendas Rápidas"
            empty="Nenhuma movimentação encontrada em Vendas."
          />
        </>
      )}

      {currentTab === "produtos" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-base font-bold text-foreground">Catálogo de Produtos</h2>
            {canRecord && (
              <button
                onClick={() => setProdDrawerOpen(true)}
                className="flex items-center gap-1 text-xs font-bold text-primary hover:underline"
              >
                <Plus className="size-4" /> Novo Produto
              </button>
            )}
          </div>

          {!produtos.length ? (
            <div className="p-8 text-center text-muted-foreground bg-surface-container-low rounded-3xl border border-outline-variant/20">
              Nenhum produto cadastrado no catálogo.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {produtos.map((p) => (
                <div
                  key={p.id}
                  className="p-5 rounded-3xl bg-surface-container-low border border-outline-variant/20 flex flex-col justify-between"
                >
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <Package className="size-3.5 text-primary" /> Item de Venda
                    </span>
                    <h3 className="text-base font-bold text-foreground mt-1">{p.nome}</h3>

                    {/* Insumos vinculados */}
                    {p.ingredientes && p.ingredientes.length > 0 && (
                      <div className="mt-2.5 p-2 rounded-xl bg-surface-container-highest/50 border border-outline-variant/20 space-y-1">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                          <Sparkles className="size-3 text-primary" /> Insumos Vinculados:
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {p.ingredientes.map((ing) => (
                            <span
                              key={ing.material_id}
                              className="text-[10px] px-2 py-0.5 rounded-md bg-surface border border-outline-variant/30 text-foreground"
                            >
                              {ing.material_nome} ({ing.quantidade} {ing.unidade_medida || "un"})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-outline-variant/20 pt-3">
                    <span className="text-base font-black text-income">{brl(p.preco_venda)}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        Custo: {brl(p.custo)} • Com.: {brl(p.comissao)}
                      </span>
                      {canRecord && (
                        <button
                          onClick={() => { setEditProduto(p); setProdDrawerOpen(true); }}
                          className="p-1.5 rounded-full hover:bg-surface-variant/60 text-muted-foreground hover:text-primary transition-colors"
                          title="Editar produto"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {currentTab === "avarias" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div>
              <h2 className="text-base font-bold text-foreground">Registro de Avarias e Perdas</h2>
              <p className="text-xs text-muted-foreground">
                Prejuízo total acumulado: <strong className="text-expense">{brl(totalAvarias)}</strong>
              </p>
            </div>
            {canRecord && (
              <button
                onClick={() => setAvariaDrawerOpen(true)}
                className="flex items-center gap-1 text-xs font-bold text-expense hover:underline"
              >
                <Plus className="size-4" /> Registrar Avaria
              </button>
            )}
          </div>

          {!avarias.length ? (
            <div className="p-8 text-center text-muted-foreground bg-surface-container-low rounded-3xl border border-outline-variant/20">
              Nenhuma avaria registrada.
            </div>
          ) : (
            <div className="divide-y divide-outline-variant/20 rounded-3xl bg-surface-container-low border border-outline-variant/20 overflow-hidden">
              {avarias.map((av) => (
                <div key={av.id} className="p-4 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-foreground">{av.produto_nome}</h4>
                    <p className="text-xs text-muted-foreground">
                      {av.quantidade} unidade(s) • Motivo: {av.motivo || "Não especificado"}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-expense">−{brl(av.perda_estimada)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Drawer: Novo Produto & Ficha Técnica */}
      <ProductRecipeDrawer
        open={prodDrawerOpen}
        onOpenChange={setProdDrawerOpen}
        modulo="vendas"
        onSuccess={refetchProdutos}
      />

      {/* Drawer: Nova Avaria */}
      <Drawer open={avariaDrawerOpen} onOpenChange={setAvariaDrawerOpen}>
        <DrawerContent className="rounded-t-3xl bg-surface-container-low max-w-lg mx-auto">
          <DrawerHeader>
            <DrawerTitle className="text-lg font-black text-foreground">Registrar Perda / Avaria</DrawerTitle>
          </DrawerHeader>
          <form onSubmit={handleAddAvaria} className="space-y-4 px-4 pb-8">
            <input
              name="produto_nome"
              placeholder="Nome do produto avariado"
              className="h-14 w-full rounded-2xl border border-outline-variant/60 bg-surface px-4 text-sm outline-none focus:border-2 focus:border-primary"
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                name="quantidade"
                type="number"
                defaultValue={1}
                min={1}
                placeholder="Qtd"
                className="h-14 w-full rounded-2xl border border-outline-variant/60 bg-surface px-4 text-sm outline-none focus:border-2 focus:border-primary"
                required
              />
              <input
                name="perda_estimada"
                inputMode="decimal"
                placeholder="Perda Estimada (R$)"
                className="h-14 w-full rounded-2xl border border-outline-variant/60 bg-surface px-4 text-sm outline-none focus:border-2 focus:border-primary"
                required
              />
            </div>
            <input
              name="motivo"
              placeholder="Motivo da perda (ex: quebrado, vencido, extraviado)"
              className="h-14 w-full rounded-2xl border border-outline-variant/60 bg-surface px-4 text-sm outline-none focus:border-2 focus:border-primary"
            />
            <button
              type="submit"
              className="h-12 w-full rounded-2xl bg-expense text-white font-bold text-sm"
            >
              Registrar Avaria
            </button>
          </form>
        </DrawerContent>
      </Drawer>
    </AppShell>
  );
}

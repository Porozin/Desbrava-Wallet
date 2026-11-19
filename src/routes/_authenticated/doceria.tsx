import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Cake,
  TrendingUp,
  ShoppingBag,
  Printer,
  Package,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
import { AppShell } from "@/components/m3/AppShell";
import {
  ChipGroup,
  MetricCard,
  NewEntryFab,
  ResponsiveTransactionList,
  CashBoxHeaderCard,
} from "@/components/m3/parts";
import { brl, profitMargin, summarizeBox } from "@/lib/finance";
import {
  useTransactions,
  useBoxTransactions,
  useReservations,
  useMateriais,
  useProdutos,
  addMaterial,
  useCanRecord,
  useMe,
} from "@/lib/data";
import { generatePrintReport } from "@/lib/printReport";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { ProductRecipeDrawer } from "@/components/m3/ProductRecipeDrawer";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/doceria")({
  head: () => ({
    meta: [
      { title: "GDACaixa 2027 — Caixa da Doceria" },
      {
        name: "description",
        content:
          "Vendas de doces, compras de ingredientes, reservas e transferências da doceria.",
      },
      { property: "og:title", content: "GDACaixa 2027 — Caixa da Doceria" },
      {
        property: "og:description",
        content: "Gestão do Caixa da Doceria do Clube Guerreiros do Alto.",
      },
    ],
  }),
  component: Doceria,
});

type TabView = "vendas" | "produtos" | "materias";

function Doceria() {
  const allTx = useTransactions();
  const boxTx = useBoxTransactions("doceria");
  const boxReservations = useReservations("doceria");
  const materiais = useMateriais("doceria");
  const { data: produtos = [], refetch: refetchProdutos } = useProdutos("doceria");
  const { data: me } = useMe();
  const canRecord = useCanRecord();

  const [currentTab, setCurrentTab] = useState<TabView>("vendas");
  const [kind, setKind] = useState<"all" | "receita" | "despesa" | "transferencia">("all");
  const [q, setQ] = useState("");
  const [matDrawerOpen, setMatDrawerOpen] = useState(false);
  const [prodDrawerOpen, setProdDrawerOpen] = useState(false);

  const boxSummary = summarizeBox(allTx, "doceria", boxReservations);
  const { profit, margin } = profitMargin(boxSummary.income, boxSummary.expense);
  const custoTotalMaterias = materiais.reduce((acc, cur) => acc + cur.custo_total, 0);

  const items = boxTx.filter(
    (t) =>
      (kind === "all" || t.kind === kind) &&
      (t.description.toLowerCase().includes(q.toLowerCase()) ||
        t.category.toLowerCase().includes(q.toLowerCase()))
  );

  async function handleAddMaterial(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const nome = String(f.get("nome") || "").trim();
    const qtd = Number(f.get("quantidade")) || 1;
    const custo = Number(String(f.get("custo_total")).replace(",", ".")) || 0;
    if (!nome) {
      toast.error("Informe o nome do insumo/ingrediente.");
      return;
    }
    try {
      await addMaterial({
        modulo: "doceria",
        nome,
        quantidade: qtd,
        custo_total: custo,
        unidade_medida: "un",
      });
      toast.success("Insumo cadastrado no estoque da doceria!");
      setMatDrawerOpen(false);
    } catch {
      toast.error("Falha ao salvar insumo.");
    }
  }

  function handlePrint() {
    generatePrintReport({
      module: "doceria",
      title: "Extrato Oficial — Caixa da Doceria",
      responsible: me?.name || "Responsável Doceria",
      transactions: boxTx,
      additionalStats: [
        { label: "Saldo Disponível", value: brl(boxSummary.available) },
        { label: "Saldo Reservado", value: brl(boxSummary.reserved) },
        { label: "Margem de Lucro Bruta", value: `${(margin * 100).toFixed(0)}%` },
        { label: "Transferências Enviadas (Repasses)", value: `−${brl(boxSummary.transfers_out)}`, isNegative: true },
        { label: "Transferências Recebidas", value: `+${brl(boxSummary.transfers_in)}` },
      ],
      signatures: [
        { role: "Diretor(a) do Clube" },
        { role: "Responsável Doceria" },
      ],
    });
  }

  return (
    <AppShell title="Doceria" fab={<NewEntryFab module="doceria" boxId="doceria" />}>
      {/* Abas Secundárias M3 */}
      <div className="flex gap-2">
        <ChipGroup
          value={currentTab}
          onChange={setCurrentTab}
          options={[
            { value: "vendas", label: "Caixa & Vendas" },
            { value: "produtos", label: `Doces & Receitas (${produtos.length})` },
            { value: "materias", label: `Insumos (${materiais.length})` },
          ]}
        />
        <button
          onClick={handlePrint}
          title="Imprimir Extrato Oficial da Doceria"
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-high/70 hover:bg-surface-variant text-xs font-bold text-foreground transition-all shrink-0"
        >
          <Printer className="size-4" />
          <span className="hidden sm:inline">Extrato PDF</span>
        </button>
      </div>

      {currentTab === "vendas" && (
        <>
          {/* Card Central com Saldos (Disponível, Contábil e Reservas) */}
          <CashBoxHeaderCard boxId="doceria" summary={boxSummary} />

          {/* Métricas de Performance da Doceria */}
          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              variant="filled"
              title="Lucro Operacional"
              value={brl(profit)}
              subtitle={`Margem de ${(margin * 100).toFixed(0)}%`}
              icon={TrendingUp}
              tone={profit >= 0 ? "income" : "expense"}
            />
            <MetricCard
              variant="filled"
              title="Repasses Feitos"
              value={brl(boxSummary.transfers_out)}
              subtitle="Transferido para outros caixas"
              icon={ShoppingBag}
            />
          </div>

          {/* Busca e Filtros */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por item, doce ou categoria…"
              className="h-14 w-full rounded-2xl bg-surface-container-high/60 pl-12 pr-4 text-sm text-foreground outline-none border border-outline-variant/30 focus:border-2 focus:border-primary transition-all"
            />
          </div>

          <ChipGroup
            value={kind}
            onChange={setKind}
            options={[
              { value: "all", label: "Todas" },
              { value: "receita", label: "Vendas (+)" },
              { value: "despesa", label: "Custos (−)" },
              { value: "transferencia", label: "Transferências" },
            ]}
          />

          <ResponsiveTransactionList
            items={items}
            currentBoxId="doceria"
            title="Histórico de Movimentações — Doceria"
            empty="Nenhuma movimentação encontrada na Doceria."
          />
        </>
      )}

      {currentTab === "produtos" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div>
              <h2 className="text-base font-bold text-foreground">Cardápio & Fichas Técnicas</h2>
              <p className="text-xs text-muted-foreground">
                Doces cadastrados com custo automático calculado a partir dos insumos.
              </p>
            </div>
            {canRecord && (
              <button
                onClick={() => setProdDrawerOpen(true)}
                className="flex items-center gap-1 text-xs font-bold text-primary hover:underline"
              >
                <Plus className="size-4" /> Novo Doce
              </button>
            )}
          </div>

          {!produtos.length ? (
            <div className="p-8 text-center text-muted-foreground bg-surface-container-low rounded-3xl border border-outline-variant/20">
              Nenhum doce cadastrado no cardápio da doceria.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {produtos.map((p) => {
                const lucro = p.preco_venda - p.custo - p.comissao;
                const mg = p.preco_venda > 0 ? (lucro / p.preco_venda) * 100 : 0;
                return (
                  <div
                    key={p.id}
                    className="p-5 rounded-3xl bg-surface-container-low border border-outline-variant/20 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                          <Cake className="size-3.5 text-primary" /> Doce / Sobremesa
                        </span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                          Margem: {mg.toFixed(0)}%
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-foreground mt-1">{p.nome}</h3>

                      {/* Lista de Ingredientes Vinculados */}
                      {p.ingredientes && p.ingredientes.length > 0 ? (
                        <div className="mt-3 p-2.5 rounded-2xl bg-surface-container-highest/50 border border-outline-variant/20 space-y-1">
                          <p className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                            <Sparkles className="size-3 text-primary" /> Ingredientes do Estoque:
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {p.ingredientes.map((ing) => (
                              <span
                                key={ing.material_id}
                                className="text-[11px] px-2 py-0.5 rounded-lg bg-surface border border-outline-variant/30 text-foreground font-medium"
                              >
                                {ing.material_nome} ({ing.quantidade} {ing.unidade_medida || "un"})
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-muted-foreground italic">
                          Custo direto fixado. Sem ingredientes linkados.
                        </p>
                      )}
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-outline-variant/20 pt-3">
                      <div>
                        <span className="text-base font-black text-income">{brl(p.preco_venda)}</span>
                        <span className="text-[11px] text-muted-foreground block">
                          Lucro: {brl(lucro)}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground text-right">
                        Custo Insumos: <strong>{brl(p.custo)}</strong>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {currentTab === "materias" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div>
              <h2 className="text-base font-bold text-foreground">Insumos & Ingredientes</h2>
              <p className="text-xs text-muted-foreground">
                Total investido em estoque: <strong className="text-foreground">{brl(custoTotalMaterias)}</strong>
              </p>
            </div>
            {canRecord && (
              <button
                onClick={() => setMatDrawerOpen(true)}
                className="flex items-center gap-1 text-xs font-bold text-primary hover:underline"
              >
                <Plus className="size-4" /> Novo Insumo
              </button>
            )}
          </div>

          {!materiais.length ? (
            <div className="p-8 text-center text-muted-foreground bg-surface-container-low rounded-3xl border border-outline-variant/20">
              Nenhum ingrediente ou insumo cadastrado na doceria.
            </div>
          ) : (
            <div className="divide-y divide-outline-variant/20 rounded-3xl bg-surface-container-low border border-outline-variant/20 overflow-hidden">
              {materiais.map((mat) => (
                <div key={mat.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-full bg-secondary-container text-on-secondary-container">
                      <Package className="size-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-foreground">{mat.nome}</h4>
                      <p className="text-xs text-muted-foreground">
                        {mat.quantidade} {mat.unidade_medida || "un"}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-foreground">{brl(mat.custo_total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Drawer: Novo Insumo */}
      <Drawer open={matDrawerOpen} onOpenChange={setMatDrawerOpen}>
        <DrawerContent className="rounded-t-3xl bg-surface-container-low max-w-lg mx-auto">
          <DrawerHeader>
            <DrawerTitle className="text-lg font-black text-foreground">Novo Insumo / Ingrediente</DrawerTitle>
          </DrawerHeader>
          <form onSubmit={handleAddMaterial} className="space-y-4 px-4 pb-8">
            <input
              name="nome"
              placeholder="Nome do insumo (ex: Leite Condensado, Chocolate 50%)"
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
                name="custo_total"
                inputMode="decimal"
                placeholder="Custo Total (R$)"
                className="h-14 w-full rounded-2xl border border-outline-variant/60 bg-surface px-4 text-sm outline-none focus:border-2 focus:border-primary"
                required
              />
            </div>
            <button
              type="submit"
              className="h-12 w-full rounded-2xl bg-primary text-primary-foreground font-bold text-sm"
            >
              Salvar Insumo
            </button>
          </form>
        </DrawerContent>
      </Drawer>

      {/* Drawer: Novo Doce & Receita com Insumos */}
      <ProductRecipeDrawer
        open={prodDrawerOpen}
        onOpenChange={setProdDrawerOpen}
        modulo="doceria"
        onSuccess={refetchProdutos}
      />
    </AppShell>
  );
}

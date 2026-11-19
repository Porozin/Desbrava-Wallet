import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Wallet,
  Download,
  Printer,
  LogIn,
  Search,
  Landmark,
  Cake,
  Zap,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { brl, CASH_BOX_LABEL, type CashBoxId } from "@/lib/finance";
import {
  fetchTransparenciaPublica,
  summarizeTransparencia,
  exportTransparenciaCsv,
  type TransparenciaItem,
} from "@/lib/transparencia";
import { generatePrintReport } from "@/lib/printReport";

export const Route = createFileRoute("/transparencia")({
  head: () => ({
    meta: [
      { title: "Portal da Transparência — Clube Guerreiros do Alto" },
      {
        name: "description",
        content:
          "Prestação de contas pública oficial dos caixas financeiro, doceria e vendas rápidas.",
      },
      { property: "og:title", content: "Portal da Transparência — GDACaixa" },
      {
        property: "og:description",
        content:
          "Transparência financeira e prestação de contas do Clube Guerreiros do Alto.",
      },
    ],
  }),
  component: TransparenciaPublicaPage,
});

type PeriodFilter = "all" | "30" | "90" | "year";

function TransparenciaPublicaPage() {
  const [items, setItems] = useState<TransparenciaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodFilter>("all");
  const [selectedBox, setSelectedBox] = useState<"todos" | CashBoxId>("todos");
  const [kindFilter, setKindFilter] = useState<"all" | "receita" | "despesa">("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchTransparenciaPublica()
      .then((data) => setItems(data))
      .finally(() => setLoading(false));
  }, []);

  // Filtragem temporal
  const now = new Date();
  const currentYear = now.getFullYear();

  const filteredByPeriod = items.filter((item) => {
    if (period === "all") return true;
    const itemDate = new Date(item.date);
    if (period === "year") {
      return itemDate.getFullYear() === currentYear;
    }
    const days = period === "30" ? 30 : 90;
    const cutoff = new Date(now.getTime() - days * 864e5);
    return itemDate >= cutoff;
  });

  // Filtragem por caixa, tipo e busca
  const displayedItems = filteredByPeriod.filter((item) => {
    if (selectedBox !== "todos" && item.cash_box_id !== selectedBox) return false;
    if (kindFilter !== "all" && item.kind !== kindFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchDesc = item.description.toLowerCase().includes(q);
      const matchCat = item.category.toLowerCase().includes(q);
      if (!matchDesc && !matchCat) return false;
    }
    return true;
  });

  const resumo = summarizeTransparencia(filteredByPeriod);

  function handlePrint() {
    generatePrintReport({
      module: selectedBox === "todos" ? "consolidado" : selectedBox,
      title: "Relatório de Transparência Pública — Prestação de Contas",
      responsible: "Clube de Desbravadores Guerreiros do Alto",
      transactions: displayedItems.map((item) => ({
        id: item.id,
        date: item.date,
        module: item.cash_box_id === "geral" ? "clube" : item.cash_box_id,
        cash_box_id: item.cash_box_id,
        kind: item.kind,
        category: item.category,
        description: item.description,
        amount: item.amount,
        amount_cents: item.amount_cents,
        payment_method: item.payment_method as any,
        status: "confirmado",
      })),
      additionalStats: [
        { label: "Receitas Confirmadas", value: brl(resumo.receitas) },
        { label: "Investimentos/Despesas", value: brl(resumo.despesas), isNegative: true },
        { label: "Saldo do Período", value: brl(resumo.saldo) },
      ],
      signatures: [
        { role: "Diretor(a) do Clube" },
        { role: "Tesoureiro(a) do Clube" },
        { role: "Pastor Distrital / Comissão" },
      ],
    });
  }

  return (
    <div className="min-h-screen bg-surface text-foreground pb-20">
      {/* Top Header Público */}
      <header className="border-b border-outline-variant/20 bg-surface-container-low/70 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
              <ShieldCheck className="size-6" />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Guerreiros do Alto
              </p>
              <h1 className="text-lg font-black tracking-tight text-foreground">
                Portal da Transparência
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/auth"
              className="flex items-center gap-1.5 h-10 px-4 rounded-full bg-secondary-container text-on-secondary-container text-xs font-bold hover:bg-secondary-container/80 transition-all shadow-xs"
            >
              <LogIn className="size-4" />
              <span className="hidden sm:inline">Acesso Membros</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="max-w-4xl mx-auto px-4 pt-6 space-y-6">
        {/* Banner Informativo de Prestação de Contas */}
        <div className="p-5 rounded-3xl bg-surface-container-highest/60 border border-outline-variant/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-primary px-2.5 py-0.5 rounded-full bg-primary/10">
              <ShieldCheck className="size-3.5" /> Transparência Oficial 2027
            </span>
            <h2 className="text-lg font-bold text-foreground">
              Prestação de Contas Aberta à Igreja e aos Pais
            </h2>
            <p className="text-xs text-muted-foreground max-w-xl">
              Acompanhe a arrecadação e destinação de cada recurso financeiro investido no desenvolvimento físico, mental e espiritual dos nossos desbravadores.
            </p>
          </div>

          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => exportTransparenciaCsv(displayedItems)}
              className="flex items-center gap-1.5 h-10 px-3.5 rounded-xl border border-outline-variant/60 bg-surface hover:bg-surface-variant text-xs font-bold transition-all shadow-xs"
              title="Baixar planilha CSV"
            >
              <Download className="size-4" />
              <span>CSV</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 h-10 px-3.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-bold transition-all shadow-xs"
              title="Imprimir relatório oficial"
            >
              <Printer className="size-4" />
              <span>Imprimir</span>
            </button>
          </div>
        </div>

        {/* Seletor de Período Temporal */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1 shrink-0">
            <Calendar className="size-3.5" /> Período:
          </span>
          {[
            { id: "all", label: "Histórico Todo" },
            { id: "year", label: `Ano ${currentYear}` },
            { id: "90", label: "Últimos 90 dias" },
            { id: "30", label: "Últimos 30 dias" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setPeriod(tab.id as PeriodFilter)}
              className={`h-9 px-4 rounded-full text-xs font-bold transition-all shrink-0 ${
                period === tab.id
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-surface-container hover:bg-surface-container-high text-muted-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Cockpit de Indicadores Consolidados */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-5 rounded-3xl bg-surface-container-low border border-outline-variant/20 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Total Arrecadado
              </span>
              <span className="p-2 rounded-xl bg-income/10 text-income">
                <ArrowUpRight className="size-5" />
              </span>
            </div>
            <p className="text-2xl font-black text-income mt-2">{brl(resumo.receitas)}</p>
            <span className="text-[11px] text-muted-foreground mt-1">
              Mensalidades, vendas e doações
            </span>
          </div>

          <div className="p-5 rounded-3xl bg-surface-container-low border border-outline-variant/20 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Total Aplicado
              </span>
              <span className="p-2 rounded-xl bg-expense/10 text-expense">
                <ArrowDownLeft className="size-5" />
              </span>
            </div>
            <p className="text-2xl font-black text-expense mt-2">{brl(resumo.despesas)}</p>
            <span className="text-[11px] text-muted-foreground mt-1">
              Alimentação, eventos e insumos
            </span>
          </div>

          <div className="p-5 rounded-3xl bg-surface-container-highest/60 border border-outline-variant/30 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Saldo Consolidado
              </span>
              <span className="p-2 rounded-xl bg-primary/10 text-primary">
                <Wallet className="size-5" />
              </span>
            </div>
            <p
              className={`text-2xl font-black mt-2 ${
                resumo.saldo >= 0 ? "text-primary" : "text-expense"
              }`}
            >
              {brl(resumo.saldo)}
            </p>
            <span className="text-[11px] text-muted-foreground mt-1">
              Recursos disponíveis e sob custódia
            </span>
          </div>
        </div>

        {/* Detalhamento por Caixa */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              id: "geral" as CashBoxId,
              label: "Caixa Geral",
              icon: Landmark,
              data: resumo.porCaixa.geral,
            },
            {
              id: "doceria" as CashBoxId,
              label: "Caixa Doceria",
              icon: Cake,
              data: resumo.porCaixa.doceria,
            },
            {
              id: "vendas" as CashBoxId,
              label: "Vendas Rápidas",
              icon: Zap,
              data: resumo.porCaixa.vendas,
            },
          ].map((c) => (
            <div
              key={c.id}
              onClick={() => setSelectedBox(selectedBox === c.id ? "todos" : c.id)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                selectedBox === c.id
                  ? "bg-secondary-container/50 border-secondary ring-2 ring-secondary"
                  : "bg-surface-container-low border-outline-variant/20 hover:border-outline-variant/60"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <c.icon className="size-4 text-primary" />
                <h3 className="text-xs font-bold text-foreground">{c.label}</h3>
                {selectedBox === c.id && (
                  <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary text-on-secondary">
                    Filtro Ativo
                  </span>
                )}
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Saldo:</span>
                <strong className={c.data.saldo >= 0 ? "text-foreground" : "text-expense"}>
                  {brl(c.data.saldo)}
                </strong>
              </div>
            </div>
          ))}
        </div>

        {/* Destinação de Despesas por Categoria */}
        {resumo.porCategoria.length > 0 && (
          <div className="p-5 rounded-3xl bg-surface-container-low border border-outline-variant/20 space-y-3">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <TrendingDown className="size-4 text-expense" />
              <span>Destinação dos Recursos por Categoria</span>
            </h3>
            <div className="space-y-2.5">
              {resumo.porCategoria.slice(0, 5).map((cat) => (
                <div key={cat.categoria} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-foreground">{cat.categoria}</span>
                    <span className="text-muted-foreground">
                      {brl(cat.total)} ({cat.percentual.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-surface-container-highest overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(4, cat.percentual))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Histórico Transparente de Movimentações */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-foreground">
                Lançamentos Públicos Auditados ({displayedItems.length})
              </h2>
              <p className="text-xs text-muted-foreground">
                Operações oficiais confirmadas nos caixas do clube.
              </p>
            </div>

            {/* Filtro de Tipo */}
            <div className="flex gap-1.5 self-stretch sm:self-auto">
              {[
                { id: "all", label: "Todas" },
                { id: "receita", label: "Entradas (+)" },
                { id: "despesa", label: "Saídas (−)" },
              ].map((k) => (
                <button
                  key={k.id}
                  onClick={() => setKindFilter(k.id as any)}
                  className={`h-9 px-3 rounded-xl text-xs font-bold transition-all flex-1 sm:flex-initial ${
                    kindFilter === k.id
                      ? "bg-secondary-container text-on-secondary-container shadow-xs"
                      : "bg-surface-container hover:bg-surface-container-high text-muted-foreground"
                  }`}
                >
                  {k.label}
                </button>
              ))}
            </div>
          </div>

          {/* Busca por descrição ou categoria */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por descrição ou categoria de gasto…"
              className="h-12 w-full rounded-2xl bg-surface-container-low pl-11 pr-4 text-xs text-foreground outline-none border border-outline-variant/30 focus:border-primary transition-all"
            />
          </div>

          {/* Lista de Movimentações */}
          {loading ? (
            <div className="p-12 text-center text-xs text-muted-foreground bg-surface-container-low rounded-3xl">
              Carregando dados da transparência…
            </div>
          ) : displayedItems.length === 0 ? (
            <div className="p-12 text-center text-xs text-muted-foreground bg-surface-container-low rounded-3xl border border-outline-variant/20">
              Nenhuma movimentação encontrada para os filtros selecionados.
            </div>
          ) : (
            <div className="divide-y divide-outline-variant/20 rounded-3xl bg-surface-container-low border border-outline-variant/20 overflow-hidden shadow-xs">
              {displayedItems.map((item) => (
                <div
                  key={item.id}
                  className="p-4 flex items-center justify-between gap-3 hover:bg-surface-variant/20 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`flex size-10 shrink-0 items-center justify-center rounded-2xl ${
                        item.kind === "receita"
                          ? "bg-income/10 text-income"
                          : "bg-expense/10 text-expense"
                      }`}
                    >
                      {item.kind === "receita" ? (
                        <ArrowUpRight className="size-5" />
                      ) : (
                        <ArrowDownLeft className="size-5" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{item.description}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                        <span className="font-medium">{item.date}</span>
                        <span>•</span>
                        <span className="px-2 py-0.5 rounded-md bg-surface-container text-[11px] font-semibold">
                          {CASH_BOX_LABEL[item.cash_box_id]}
                        </span>
                        <span>•</span>
                        <span>{item.category}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span
                      className={`text-sm font-black ${
                        item.kind === "receita" ? "text-income" : "text-foreground"
                      }`}
                    >
                      {item.kind === "receita" ? "+" : "−"}
                      {brl(item.amount)}
                    </span>
                    <span className="text-[11px] text-muted-foreground block capitalize">
                      {item.payment_method}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Rodapé LGPD & Integridade */}
        <footer className="pt-6 border-t border-outline-variant/20 text-center space-y-2">
          <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5">
            <Lock className="size-3.5 text-primary" />
            <span>
              Conformidade LGPD: Dados pessoais privados e identificadores de doadores são estritamente protegidos.
            </span>
          </p>
          <p className="text-[11px] text-muted-foreground">
            Clube de Desbravadores Guerreiros do Alto • Sistema GDACaixa 2027
          </p>
        </footer>
      </main>
    </div>
  );
}


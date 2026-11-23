import { useState, useMemo } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import {
  FileText,
  Printer,
  Download,
  Filter,
  Package,
  Trophy,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  brl,
  CASH_BOX_LABEL,
  MODULE_LABEL,
  commissionBySeller,
  summarize,
  type CashBoxId,
  type Kind,
  type PaymentMethod,
  type Transaction,
} from "@/lib/finance";
import { useTransactions, useProdutos, useMe, type Produto } from "@/lib/data";
import { generatePrintReport } from "@/lib/printReport";
import { ChipGroup } from "./parts";

interface ReportsCenterDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ReportTab = "historico" | "produtos" | "vendedores" | "fechamento";

export function ReportsCenterDrawer({ open, onOpenChange }: ReportsCenterDrawerProps) {
  const all = useTransactions();
  const { data: produtos = [] } = useProdutos();
  const { data: me } = useMe();

  const [currentTab, setCurrentTab] = useState<ReportTab>("historico");

  // Filtros do Histórico Avançado
  const [filterBox, setFilterBox] = useState<"todos" | CashBoxId>("todos");
  const [filterKind, setFilterKind] = useState<"all" | Kind>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | string>("all");
  const [filterPayMethod, setFilterPayMethod] = useState<"all" | PaymentMethod>("all");
  const [filterPeriod, setFilterPeriod] = useState<"all" | "7" | "30" | "90" | "year">("all");
  const [search, setSearch] = useState("");

  // Fechamento Mensal
  const currentYear = new Date().getFullYear();
  const [closeMonth, setCloseMonth] = useState<string>(
    String(new Date().getMonth() + 1).padStart(2, "0")
  );
  const [closeYear, setCloseYear] = useState<string>(String(currentYear));
  const [closeBox, setCloseBox] = useState<"todos" | CashBoxId>("todos");

  // Aplicação dos Filtros no Histórico
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    return all.filter((t) => {
      if (filterBox !== "todos") {
        const originBox = t.cash_box_id || (t.module === "clube" ? "geral" : t.module);
        if (originBox !== filterBox && t.destination_cash_box_id !== filterBox) return false;
      }
      if (filterKind !== "all" && t.kind !== filterKind) return false;
      if (filterStatus !== "all" && t.status !== filterStatus) return false;
      if (filterPayMethod !== "all" && t.payment_method !== filterPayMethod) return false;

      if (filterPeriod !== "all") {
        const tDate = new Date(t.date);
        if (filterPeriod === "year") {
          if (tDate.getFullYear() !== currentYear) return false;
        } else {
          const days = Number(filterPeriod);
          const cutoff = new Date(now.getTime() - days * 864e5);
          if (tDate < cutoff) return false;
        }
      }

      if (search.trim()) {
        const q = search.toLowerCase();
        const mDesc = t.description.toLowerCase().includes(q);
        const mCat = t.category.toLowerCase().includes(q);
        const mSeller = t.seller?.toLowerCase().includes(q);
        if (!mDesc && !mCat && !mSeller) return false;
      }

      return true;
    });
  }, [all, filterBox, filterKind, filterStatus, filterPayMethod, filterPeriod, search, currentYear]);

  // Resumo do Filtro
  const filterSummary = useMemo(() => {
    let inc = 0;
    let exp = 0;
    filteredTransactions.forEach((t) => {
      if (t.kind === "receita") inc += t.amount;
      if (t.kind === "despesa") exp += t.amount;
    });
    return { income: inc, expense: exp, net: inc - exp };
  }, [filteredTransactions]);

  // Relatório de Vendas por Produto
  const salesByProduct = useMemo(() => {
    const map = new Map<
      string,
      { nome: string; quantidade: number; faturamento: number; custoTotal: number; lucro: number }
    >();

    // Vendas registradas
    all
      .filter((t) => t.kind === "receita" && t.status === "confirmado")
      .forEach((t) => {
        const key = t.description.trim();
        const matchedProd = produtos.find(
          (p) => p.nome.toLowerCase() === key.toLowerCase()
        );
        const custoUnit = matchedProd?.custo || 0;

        const prev = map.get(key) || {
          nome: key,
          quantidade: 0,
          faturamento: 0,
          custoTotal: 0,
          lucro: 0,
        };

        const qtd = 1; // Unidades vendidas no registro
        const fat = t.amount;
        const cTot = prev.custoTotal + custoUnit;

        map.set(key, {
          nome: key,
          quantidade: prev.quantidade + qtd,
          faturamento: prev.faturamento + fat,
          custoTotal: cTot,
          lucro: prev.faturamento + fat - cTot,
        });
      });

    return Array.from(map.values()).sort((a, b) => b.faturamento - a.faturamento);
  }, [all, produtos]);

  // Relatório de Comissões por Vendedor
  const sellerRankings = useMemo(() => {
    return commissionBySeller(all);
  }, [all]);

  // Transações do Fechamento Mensal Selecionado
  const closingTransactions = useMemo(() => {
    const targetPrefix = `${closeYear}-${closeMonth}`;
    return all.filter((t) => {
      if (!t.date.startsWith(targetPrefix)) return false;
      if (closeBox !== "todos") {
        const box = t.cash_box_id || (t.module === "clube" ? "geral" : t.module);
        return box === closeBox || t.destination_cash_box_id === closeBox;
      }
      return true;
    });
  }, [all, closeYear, closeMonth, closeBox]);

  const closingSummary = useMemo(() => {
    return summarize(closingTransactions);
  }, [closingTransactions]);

  // Exportadores
  function handleExportFilterCsv() {
    const rows = [
      ["Data", "Caixa", "Tipo", "Categoria", "Descrição", "Vendedor", "Forma Pagamento", "Situação", "Valor"],
      ...filteredTransactions.map((t) => [
        t.date,
        CASH_BOX_LABEL[t.cash_box_id || (t.module === "clube" ? "geral" : (t.module as CashBoxId))] || t.module,
        t.kind,
        t.category,
        t.description,
        t.seller ?? "",
        t.payment_method ?? "dinheiro",
        t.status ?? "confirmado",
        t.amount.toFixed(2).replace(".", ","),
      ]),
    ];

    const csv =
      "\uFEFF" +
      rows
        .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
        .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `gdacaixa-relatorio-filtrado-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    toast.success("Planilha CSV gerada com sucesso!");
  }

  function handlePrintFilterPdf() {
    generatePrintReport({
      module: filterBox === "todos" ? "consolidado" : filterBox === "geral" ? "clube" : (filterBox as "doceria" | "vendas"),
      title: "Relatório de Movimentações Financeiras — Histórico Filtrado",
      responsible: me?.name || "Tesouraria do Clube",
      transactions: filteredTransactions,
      additionalStats: [
        { label: "Receitas Filtradas", value: brl(filterSummary.income) },
        { label: "Despesas Filtradas", value: brl(filterSummary.expense), isNegative: true },
        { label: "Resultado Líquido do Filtro", value: brl(filterSummary.net) },
      ],
      signatures: [
        { role: "Diretor(a) do Clube" },
        { role: "Tesoureiro(a) do Clube" },
      ],
    });
  }

  function handlePrintClosingPdf() {
    generatePrintReport({
      module: closeBox === "todos" ? "consolidado" : closeBox === "geral" ? "clube" : (closeBox as "doceria" | "vendas"),
      title: `Balancete de Fechamento Mensal — Mês ${closeMonth}/${closeYear}`,
      responsible: me?.name || "Tesouraria Oficial",
      transactions: closingTransactions,
      additionalStats: [
        { label: "Total Receitas do Mês", value: brl(closingSummary.income) },
        { label: "Total Despesas do Mês", value: brl(closingSummary.expense), isNegative: true },
        { label: "Saldo Operacional do Mês", value: brl(closingSummary.balance) },
      ],
      signatures: [
        { role: "Diretor(a) do Clube" },
        { role: "Tesoureiro(a) do Clube" },
        { role: "Pastor Distrital / Presidente" },
        { role: "Secretário(a) da Igreja" },
      ],
    });
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="rounded-t-3xl bg-surface-container-low max-w-2xl mx-auto max-h-[92vh] flex flex-col">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="text-xl font-black text-foreground flex items-center gap-2">
            <FileText className="size-5 text-primary" />
            <span>Central de Histórico & Relatórios Oficiais</span>
          </DrawerTitle>
          <p className="text-xs text-muted-foreground">
            Filtros multicritério, relatórios por produto, comissões de vendedores e fechamentos contábeis.
          </p>
        </DrawerHeader>

        {/* Abas da Central */}
        <div className="px-4 pb-2">
          <ChipGroup
            value={currentTab}
            onChange={setCurrentTab}
            options={[
              { value: "historico", label: "Histórico & Filtros" },
              { value: "produtos", label: "Vendas por Produto" },
              { value: "vendedores", label: "Comissões Desbravadores" },
              { value: "fechamento", label: "Fechamento Mensal" },
            ]}
          />
        </div>

        {/* Conteúdo das Abas */}
        <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-4">
          {/* ABA 1: HISTÓRICO COM FILTROS AVANÇADOS */}
          {currentTab === "historico" && (
            <div className="space-y-4">
              {/* Barra de Filtros */}
              <div className="p-4 rounded-2xl bg-surface-container-highest/60 border border-outline-variant/30 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase text-foreground">
                  <Filter className="size-4 text-primary" />
                  <span>Filtros Multicritério</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">
                      Caixa
                    </label>
                    <select
                      value={filterBox}
                      onChange={(e) => setFilterBox(e.target.value as any)}
                      className="w-full h-10 rounded-xl bg-surface px-2 border border-outline-variant/40 text-foreground font-semibold"
                    >
                      <option value="todos">Todos os Caixas</option>
                      <option value="geral">Caixa Geral</option>
                      <option value="doceria">Doceria</option>
                      <option value="vendas">Vendas Rápidas</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">
                      Tipo
                    </label>
                    <select
                      value={filterKind}
                      onChange={(e) => setFilterKind(e.target.value as any)}
                      className="w-full h-10 rounded-xl bg-surface px-2 border border-outline-variant/40 text-foreground font-semibold"
                    >
                      <option value="all">Todos os Tipos</option>
                      <option value="receita">Receitas (+)</option>
                      <option value="despesa">Despesas (−)</option>
                      <option value="transferencia">Transferências</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">
                      Situação
                    </label>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="w-full h-10 rounded-xl bg-surface px-2 border border-outline-variant/40 text-foreground font-semibold"
                    >
                      <option value="all">Todas Situações</option>
                      <option value="confirmado">Confirmado</option>
                      <option value="pendente">Pendente</option>
                      <option value="estornado">Estornado</option>
                      <option value="rejeitado">Rejeitado</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">
                      Pagamento
                    </label>
                    <select
                      value={filterPayMethod}
                      onChange={(e) => setFilterPayMethod(e.target.value as any)}
                      className="w-full h-10 rounded-xl bg-surface px-2 border border-outline-variant/40 text-foreground font-semibold"
                    >
                      <option value="all">Todas as Formas</option>
                      <option value="dinheiro">Dinheiro</option>
                      <option value="pix">Pix</option>
                      <option value="cartao_debito">Débito</option>
                      <option value="cartao_credito">Crédito</option>
                    </select>
                  </div>
                </div>

                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar por descrição, categoria ou vendedor…"
                    className="w-full h-10 rounded-xl bg-surface pl-10 pr-3 text-xs text-foreground border border-outline-variant/40 outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Barra de Totais do Filtro & Ações */}
              <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-4 text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase">Itens</span>
                    <strong className="text-foreground text-sm">{filteredTransactions.length}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase">Receitas</span>
                    <strong className="text-income text-sm">+{brl(filterSummary.income)}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase">Despesas</span>
                    <strong className="text-expense text-sm">−{brl(filterSummary.expense)}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase">Líquido</span>
                    <strong
                      className={`text-sm ${
                        filterSummary.net >= 0 ? "text-primary font-black" : "text-expense font-black"
                      }`}
                    >
                      {brl(filterSummary.net)}
                    </strong>
                  </div>
                </div>

                <div className="flex gap-2 self-stretch sm:self-auto">
                  <button
                    onClick={handleExportFilterCsv}
                    className="flex-1 sm:flex-initial h-10 px-3.5 rounded-xl border border-outline-variant/60 bg-surface hover:bg-surface-variant text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <Download className="size-4" />
                    <span>CSV</span>
                  </button>
                  <button
                    onClick={handlePrintFilterPdf}
                    className="flex-1 sm:flex-initial h-10 px-3.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <Printer className="size-4" />
                    <span>Imprimir PDF</span>
                  </button>
                </div>
              </div>

              {/* Lista dos Lançamentos Filtrados */}
              <div className="divide-y divide-outline-variant/20 rounded-2xl bg-surface-container-low border border-outline-variant/20 overflow-hidden max-h-80 overflow-y-auto">
                {filteredTransactions.map((t) => (
                  <div key={t.id} className="p-3.5 flex items-center justify-between text-xs">
                    <div className="min-w-0 pr-2">
                      <p className="font-bold text-foreground truncate">{t.description}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {t.date} • {CASH_BOX_LABEL[t.cash_box_id || (t.module === "clube" ? "geral" : t.module)]} • {t.category}
                        {t.seller ? ` • Vend: ${t.seller}` : ""}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span
                        className={`font-black ${
                          t.kind === "receita" ? "text-income" : "text-expense"
                        }`}
                      >
                        {t.kind === "receita" ? "+" : "−"}{brl(t.amount)}
                      </span>
                      <span className="text-[10px] text-muted-foreground block capitalize">
                        {t.payment_method || "dinheiro"}
                      </span>
                    </div>
                  </div>
                ))}
                {!filteredTransactions.length && (
                  <div className="p-8 text-center text-xs text-muted-foreground">
                    Nenhum lançamento encontrado para os filtros selecionados.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ABA 2: VENDAS POR PRODUTO */}
          {currentTab === "produtos" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs text-muted-foreground">
                  Faturamento e margens calculados por item vendido.
                </span>
                <button
                  onClick={() => {
                    generatePrintReport({
                      module: "vendas",
                      title: "Relatório de Vendas por Produto & Faturamento",
                      responsible: me?.name || "Tesouraria de Vendas",
                      transactions: all.filter((t) => t.kind === "receita"),
                      additionalStats: [
                        {
                          label: "Total Faturado em Produtos",
                          value: brl(salesByProduct.reduce((acc, c) => acc + c.faturamento, 0)),
                        },
                      ],
                      signatures: [
                        { role: "Responsável Vendas" },
                        { role: "Tesoureiro(a) do Clube" },
                      ],
                    });
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-container-high text-xs font-bold text-foreground hover:bg-surface-variant"
                >
                  <Printer className="size-3.5" /> Imprimir Relatório
                </button>
              </div>

              <div className="divide-y divide-outline-variant/20 rounded-2xl bg-surface-container-low border border-outline-variant/20 overflow-hidden">
                {salesByProduct.map((p) => {
                  const margem = p.faturamento > 0 ? (p.lucro / p.faturamento) * 100 : 0;
                  return (
                    <div key={p.nome} className="p-4 flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <p className="font-bold text-foreground text-sm truncate">{p.nome}</p>
                        <p className="text-muted-foreground mt-0.5">
                          {p.quantidade} registro(s) de venda • Custo Estimado: {brl(p.custoTotal)}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-sm font-black text-income block">
                          {brl(p.faturamento)}
                        </span>
                        <span className="text-[11px] font-bold text-primary">
                          Lucro: {brl(p.lucro)} ({margem.toFixed(0)}%)
                        </span>
                      </div>
                    </div>
                  );
                })}

                {!salesByProduct.length && (
                  <div className="p-8 text-center text-xs text-muted-foreground">
                    Nenhuma venda registrada até o momento.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ABA 3: COMISSÕES POR VENDEDOR */}
          {currentTab === "vendedores" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs text-muted-foreground">
                  Apuração de vendas individuais e repasses aos desbravadores.
                </span>
                <button
                  onClick={() => {
                    generatePrintReport({
                      module: "vendas",
                      title: "Folha de Pagamento de Comissões aos Desbravadores",
                      responsible: me?.name || "Tesouraria de Vendas",
                      transactions: all.filter((t) => !!t.seller),
                      additionalStats: [
                        {
                          label: "Total Comissões a Repassar",
                          value: brl(sellerRankings.reduce((acc, c) => acc + c.commission, 0)),
                        },
                      ],
                      signatures: [
                        { role: "Diretor(a) do Clube" },
                        { role: "Tesoureiro(a) do Clube" },
                      ],
                    });
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-container-high text-xs font-bold text-foreground hover:bg-surface-variant"
                >
                  <Printer className="size-3.5" /> Folha de Comissões
                </button>
              </div>

              <div className="divide-y divide-outline-variant/20 rounded-2xl bg-surface-container-low border border-outline-variant/20 overflow-hidden">
                {sellerRankings.map((s, idx) => (
                  <div key={s.seller} className="p-4 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex size-8 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container font-black text-xs shrink-0">
                        #{idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="font-bold text-foreground text-sm truncate">{s.seller}</p>
                        <p className="text-muted-foreground mt-0.5">
                          {s.sales} venda(s) • Total vendido: {brl(s.sales)}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs text-muted-foreground block uppercase font-bold text-[10px]">
                        Comissão
                      </span>
                      <span className="text-sm font-black text-primary">{brl(s.commission)}</span>
                    </div>
                  </div>
                ))}

                {!sellerRankings.length && (
                  <div className="p-8 text-center text-xs text-muted-foreground">
                    Nenhuma venda associada a vendedor foi encontrada.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ABA 4: FECHAMENTO MENSAL OFICIAL */}
          {currentTab === "fechamento" && (
            <div className="space-y-4">
              {/* Seletores de Mês, Ano e Caixa */}
              <div className="p-4 rounded-2xl bg-surface-container-highest/60 border border-outline-variant/30 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[120px]">
                  <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">
                    Mês
                  </label>
                  <select
                    value={closeMonth}
                    onChange={(e) => setCloseMonth(e.target.value)}
                    className="w-full h-10 rounded-xl bg-surface px-3 text-xs font-bold border border-outline-variant/40"
                  >
                    {[
                      { id: "01", name: "Janeiro" },
                      { id: "02", name: "Fevereiro" },
                      { id: "03", name: "Março" },
                      { id: "04", name: "Abril" },
                      { id: "05", name: "Maio" },
                      { id: "06", name: "Junho" },
                      { id: "07", name: "Julho" },
                      { id: "08", name: "Agosto" },
                      { id: "09", name: "Setembro" },
                      { id: "10", name: "Outubro" },
                      { id: "11", name: "Novembro" },
                      { id: "12", name: "Dezembro" },
                    ].map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="w-24">
                  <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">
                    Ano
                  </label>
                  <input
                    type="number"
                    value={closeYear}
                    onChange={(e) => setCloseYear(e.target.value)}
                    className="w-full h-10 rounded-xl bg-surface px-3 text-xs font-bold border border-outline-variant/40"
                  />
                </div>

                <div className="flex-1 min-w-[140px]">
                  <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">
                    Caixa Contábil
                  </label>
                  <select
                    value={closeBox}
                    onChange={(e) => setCloseBox(e.target.value as any)}
                    className="w-full h-10 rounded-xl bg-surface px-3 text-xs font-bold border border-outline-variant/40"
                  >
                    <option value="todos">Consolidado (Todos os Caixas)</option>
                    <option value="geral">Caixa Geral</option>
                    <option value="doceria">Caixa Doceria</option>
                    <option value="vendas">Caixa Vendas Rápidas</option>
                  </select>
                </div>
              </div>

              {/* Cartão de Resumo do Fechamento */}
              <div className="p-5 rounded-3xl bg-surface-container-low border border-outline-variant/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-muted-foreground">
                    Balancete Mensal • {closeMonth}/{closeYear}
                  </span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                    {closeBox === "todos" ? "Consolidado" : CASH_BOX_LABEL[closeBox]}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-outline-variant/20">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                      Receitas
                    </span>
                    <strong className="text-sm font-black text-income block mt-0.5">
                      +{brl(closingSummary.income)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                      Despesas
                    </span>
                    <strong className="text-sm font-black text-expense block mt-0.5">
                      −{brl(closingSummary.expense)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                      Resultado Líquido
                    </span>
                    <strong
                      className={`text-sm font-black block mt-0.5 ${
                        closingSummary.balance >= 0 ? "text-primary" : "text-expense"
                      }`}
                    >
                      {brl(closingSummary.balance)}
                    </strong>
                  </div>
                </div>

                <button
                  onClick={handlePrintClosingPdf}
                  className="mt-3 w-full h-12 rounded-2xl bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center gap-2 shadow-sm hover:shadow-md transition-all"
                >
                  <Printer className="size-4" />
                  <span>Gerar Extrato Oficial de Fechamento (PDF para Ata)</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}


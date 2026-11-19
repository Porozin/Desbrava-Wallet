import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Landmark,
  Search,
  Printer,
  Package,
  Target,
  Plus,
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
import { brl, summarizeBox } from "@/lib/finance";
import {
  useTransactions,
  useBoxTransactions,
  useReservations,
  useMetas,
  useMateriais,
  addMeta,
  addMaterial,
  useCanRecord,
  useMe,
  type Meta,
} from "@/lib/data";
import { MetaDrawer } from "@/components/m3/MetaDrawer";
import { generatePrintReport } from "@/lib/printReport";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";

export const Route = createFileRoute("/_authenticated/clube")({
  head: () => ({
    meta: [
      { title: "GDACaixa 2027 — Caixa Geral do Clube" },
      {
        name: "description",
        content:
          "Mensalidades, doações, materiais e extrato do Caixa Geral do clube.",
      },
      { property: "og:title", content: "GDACaixa 2027 — Caixa Geral do Clube" },
      {
        property: "og:description",
        content: "Gestão do Caixa Geral do Clube Guerreiros do Alto.",
      },
    ],
  }),
  component: Clube,
});

type TabView = "caixa" | "metas" | "materiais";

function Clube() {
  const allTx = useTransactions();
  const boxTx = useBoxTransactions("geral");
  const boxReservations = useReservations("geral");
  const metas = useMetas("clube");
  const materiais = useMateriais("clube");
  const { data: me } = useMe();
  const canRecord = useCanRecord();

  const [currentTab, setCurrentTab] = useState<TabView>("caixa");
  const [kind, setKind] = useState<"all" | "receita" | "despesa" | "transferencia">("all");
  const [q, setQ] = useState("");
  const [metaDrawerOpen, setMetaDrawerOpen] = useState(false);
  const [editMeta, setEditMeta] = useState<Meta | undefined>(undefined);
  const [matDrawerOpen, setMatDrawerOpen] = useState(false);

  const boxSummary = summarizeBox(allTx, "geral", boxReservations);

  const items = boxTx.filter(
    (t) =>
      (kind === "all" || t.kind === kind) &&
      (t.description.toLowerCase().includes(q.toLowerCase()) ||
        t.category.toLowerCase().includes(q.toLowerCase()))
  );

  const custoTotalMateriais = materiais.reduce((acc, cur) => acc + cur.custo_total, 0);

  // Manipular criação de Meta do Clube
  async function handleAddMeta(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const desc = String(f.get("descricao") || "").trim();
    const val = Number(String(f.get("valor_alvo")).replace(",", "."));
    if (!desc || val <= 0) {
      toast.error("Informe a descrição e o valor da meta.");
      return;
    }
    try {
      await addMeta({
        modulo: "clube",
        descricao: desc,
        valor_alvo: val,
        status: "aprovada",
        sugerido_por: me?.name || "Clube",
      });
      toast.success("Meta do Clube registrada com sucesso!");
      setMetaDrawerOpen(false);
    } catch {
      toast.error("Falha ao salvar meta.");
    }
  }

  // Manipular criação de Material / Almoxarifado
  async function handleAddMaterial(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const nome = String(f.get("nome") || "").trim();
    const qtd = Number(f.get("quantidade")) || 1;
    const custo = Number(String(f.get("custo_total")).replace(",", ".")) || 0;
    if (!nome) {
      toast.error("Informe o nome do material.");
      return;
    }
    try {
      await addMaterial({
        modulo: "clube",
        nome,
        quantidade: qtd,
        custo_total: custo,
        unidade_medida: "un",
      });
      toast.success("Material adicionado ao almoxarifado!");
      setMatDrawerOpen(false);
    } catch {
      toast.error("Falha ao salvar material.");
    }
  }

  function handlePrint() {
    generatePrintReport({
      module: "clube",
      title: "Livro Caixa Oficial — Caixa Geral do Clube",
      responsible: me?.name || "Tesouraria Geral",
      transactions: boxTx,
      additionalStats: [
        { label: "Saldo Disponível", value: brl(boxSummary.available) },
        { label: "Saldo Reservado", value: brl(boxSummary.reserved) },
        { label: "Transferências Recebidas", value: `+${brl(boxSummary.transfers_in)}` },
        { label: "Transferências Enviadas", value: `−${brl(boxSummary.transfers_out)}`, isNegative: true },
      ],
      signatures: [
        { role: "Diretor(a) do Clube" },
        { role: "Tesoureiro(a) Geral" },
      ],
    });
  }

  return (
    <AppShell title="Caixa Geral" fab={<NewEntryFab module="clube" boxId="geral" />}>
      {/* Abas Secundárias M3 */}
      <div className="flex gap-2">
        <ChipGroup
          value={currentTab}
          onChange={setCurrentTab}
          options={[
            { value: "caixa", label: "Caixa Geral" },
            { value: "metas", label: `Metas (${metas.length})` },
            { value: "materiais", label: `Almoxarifado (${materiais.length})` },
          ]}
        />
        <button
          onClick={handlePrint}
          title="Imprimir Relatório Oficial para Atas / Comissões"
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-high/70 hover:bg-surface-variant text-xs font-bold text-foreground transition-all shrink-0"
        >
          <Printer className="size-4" />
          <span className="hidden sm:inline">Extrato PDF</span>
        </button>
      </div>

      {currentTab === "caixa" && (
        <>
          {/* Card Central com Saldos (Disponível, Contábil e Reservas) */}
          <CashBoxHeaderCard boxId="geral" summary={boxSummary} />

          {/* Busca e Filtros */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por descrição ou categoria…"
              className="h-14 w-full rounded-2xl bg-surface-container-high/60 pl-12 pr-4 text-sm text-foreground outline-none border border-outline-variant/30 focus:border-2 focus:border-primary transition-all"
            />
          </div>

          <ChipGroup
            value={kind}
            onChange={setKind}
            options={[
              { value: "all", label: "Todas" },
              { value: "receita", label: "Receitas" },
              { value: "despesa", label: "Despesas" },
              { value: "transferencia", label: "Transferências" },
            ]}
          />

          <ResponsiveTransactionList
            items={items}
            currentBoxId="geral"
            title="Histórico de Movimentações — Caixa Geral"
            empty="Nenhuma movimentação encontrada para os filtros selecionados."
          />
        </>
      )}

      {currentTab === "metas" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-base font-bold text-foreground">Metas Financeiras do Clube</h2>
            {canRecord && (
              <button
                onClick={() => setMetaDrawerOpen(true)}
                className="flex items-center gap-1 text-xs font-bold text-primary hover:underline"
              >
                <Plus className="size-4" /> Nova Meta
              </button>
            )}
          </div>

          {!metas.length ? (
            <div className="p-8 text-center text-muted-foreground bg-surface-container-low rounded-3xl border border-outline-variant/20">
              Nenhuma meta cadastrada ainda.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {metas.map((m) => (
                <div
                  key={m.id}
                  className="p-5 rounded-3xl bg-surface-container-low border border-outline-variant/20 flex flex-col justify-between"
                >
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <Target className="size-3.5 text-primary" /> Alvo do Clube
                    </span>
                    <h3 className="text-base font-bold text-foreground mt-1">{m.descricao}</h3>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-outline-variant/20 pt-3">
                    <span className="text-sm font-black text-primary">{brl(m.valor_alvo)}</span>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-secondary-container text-on-secondary-container">
                        {m.status}
                      </span>
                      {canRecord && (
                        <button
                          onClick={() => { setEditMeta(m); setMetaDrawerOpen(true); }}
                          className="p-1.5 rounded-full hover:bg-surface-variant/60 text-muted-foreground hover:text-primary transition-colors"
                          title="Editar meta"
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

      {currentTab === "materiais" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div>
              <h2 className="text-base font-bold text-foreground">Almoxarifado & Materiais</h2>
              <p className="text-xs text-muted-foreground">
                Patrimônio investido: <strong className="text-foreground">{brl(custoTotalMateriais)}</strong>
              </p>
            </div>
            {canRecord && (
              <button
                onClick={() => setMatDrawerOpen(true)}
                className="flex items-center gap-1 text-xs font-bold text-primary hover:underline"
              >
                <Plus className="size-4" /> Novo Item
              </button>
            )}
          </div>

          {!materiais.length ? (
            <div className="p-8 text-center text-muted-foreground bg-surface-container-low rounded-3xl border border-outline-variant/20">
              Nenhum material no almoxarifado do clube.
            </div>
          ) : (
            <div className="divide-y divide-outline-variant/20 rounded-3xl bg-surface-container-low border border-outline-variant/20 overflow-hidden">
              {materiais.map((mat) => (
                <div key={mat.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-full bg-surface-container-high text-muted-foreground">
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

      {/* MetaDrawer: criar ou editar meta */}
      <MetaDrawer
        open={metaDrawerOpen}
        onOpenChange={(v) => {
          setMetaDrawerOpen(v);
          if (!v) setEditMeta(undefined);
        }}
        meta={editMeta}
      />

      {/* Drawer: Novo Material */}
      <Drawer open={matDrawerOpen} onOpenChange={setMatDrawerOpen}>
        <DrawerContent className="rounded-t-3xl bg-surface-container-low max-w-lg mx-auto">
          <DrawerHeader>
            <DrawerTitle className="text-lg font-black text-foreground">Novo Material do Clube</DrawerTitle>
          </DrawerHeader>
          <form onSubmit={handleAddMaterial} className="space-y-4 px-4 pb-8">
            <input
              name="nome"
              placeholder="Nome do item (ex: Lona azul 4x4)"
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
              Salvar no Almoxarifado
            </button>
          </form>
        </DrawerContent>
      </Drawer>
    </AppShell>
  );
}

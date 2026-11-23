import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Zap, Cake, Plus, Pencil } from "lucide-react";
import { AppShell } from "@/components/m3/AppShell";
import { ChipGroup, NewEntryFab } from "@/components/m3/parts";
import { ProductRecipeDrawer } from "@/components/m3/ProductRecipeDrawer";
import { PdvGrid } from "@/components/m3/PdvGrid";
import { useProdutos, type Produto } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/vendas")({
  head: () => ({
    meta: [
      { title: "GDACaixa 2027 — PDV" },
      { name: "description", content: "Ponto de Venda — PDV do clube." },
      { property: "og:title", content: "GDACaixa 2027 — PDV" },
    ],
  }),
  component: Vendas,
});

type PdvBox = "doceria" | "vendas";

function getSavedPdvBox(): PdvBox {
  try {
    const v = localStorage.getItem("gda_pdv_box") as PdvBox | null;
    if (v === "doceria" || v === "vendas") return v;
  } catch {}
  return "doceria";
}

type TabView = "pdv" | "produtos";

function Vendas() {
  const [pdvBox, setPdvBoxState] = useState<PdvBox>(getSavedPdvBox);
  const [currentTab, setCurrentTab] = useState<TabView>("pdv");
  const [prodDrawerOpen, setProdDrawerOpen] = useState(false);
  const [editProduto, setEditProduto] = useState<Produto | undefined>(undefined);

  const { data: produtos = [], refetch: refetchProdutos } = useProdutos(pdvBox);

  function switchPdvBox(next: PdvBox) {
    setPdvBoxState(next);
    try { localStorage.setItem("gda_pdv_box", next); } catch {}
  }

  const FAB = currentTab === "pdv"
    ? undefined
    : <NewEntryFab module={pdvBox} boxId={pdvBox} withSeller />;

  return (
    <AppShell title="PDV — Vendas" fab={FAB}>
      {/* Selector: qual caixa está vendendo */}
      <div className="flex items-center gap-3">
        <ChipGroup
          value={pdvBox}
          onChange={switchPdvBox}
          options={[
            { value: "doceria", label: "🍰 Doceria" },
            { value: "vendas",  label: "⚡ Vendas" },
          ]}
        />
        <ChipGroup
          value={currentTab}
          onChange={setCurrentTab}
          options={[
            { value: "pdv",     label: "PDV" },
            { value: "produtos", label: `Produtos (${produtos.length})` },
          ]}
        />
      </div>

      {currentTab === "pdv" && (
        <PdvGrid
          produtos={produtos}
          module={pdvBox}
          boxId={pdvBox}
          defaultIcon={pdvBox === "doceria" ? "cake" : "zap"}
        />
      )}

      {currentTab === "produtos" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-base font-bold text-foreground">
              Catálogo — {pdvBox === "doceria" ? "Doceria" : "Vendas Rápidas"}
            </h2>
            <button
              onClick={() => setProdDrawerOpen(true)}
              className="flex items-center gap-1 text-xs font-bold text-primary hover:underline"
            >
              <Plus className="size-4" /> Novo Produto
            </button>
          </div>

          {!produtos.length ? (
            <div className="p-8 text-center text-muted-foreground bg-surface-container-low rounded-3xl border border-outline-variant/20 elevation-1">
              Nenhum produto cadastrado.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {produtos.map((p) => {
                const lucro = p.preco_venda - p.custo - p.comissao;
                return (
                  <div key={p.id} className="p-5 rounded-3xl bg-surface-container-low border border-outline-variant/20 elevation-1 flex flex-col justify-between">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          {pdvBox === "doceria" ? <Cake className="size-3.5 text-primary" /> : <Zap className="size-3.5 text-primary" />}
                          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Produto</span>
                        </div>
                        <h3 className="text-base font-bold mt-1 truncate">{p.nome}</h3>
                      </div>
                      <button
                        onClick={() => { setEditProduto(p); setProdDrawerOpen(true); }}
                        className="p-1.5 rounded-full hover:bg-surface-variant/60 text-muted-foreground hover:text-primary transition-colors shrink-0"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-outline-variant/20 pt-3">
                      <div>
                        <span className="text-base font-black text-income">{p.preco_venda.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                        <span className="text-[11px] text-muted-foreground block">Lucro: {lucro.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Custo: <strong>{p.custo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <ProductRecipeDrawer
        open={prodDrawerOpen}
        onOpenChange={(v) => { setProdDrawerOpen(v); if (!v) setEditProduto(undefined); }}
        modulo={pdvBox}
        produto={editProduto}
        onSuccess={refetchProdutos}
      />
    </AppShell>
  );
}

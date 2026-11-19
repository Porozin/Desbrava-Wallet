import { useState, useEffect } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Plus, Trash2, PackageCheck, Sparkles, AlertCircle, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { brl } from "@/lib/finance";
import {
  useMateriais,
  addProduto,
  updateProduto,
  deleteProduto,
  type Produto,
  type IngredienteInsumo,
} from "@/lib/data";

interface ProductRecipeDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modulo: "doceria" | "vendas";
  produto?: Produto;        // se fornecido → modo edição
  onSuccess?: () => void;
}

export function ProductRecipeDrawer({
  open,
  onOpenChange,
  modulo,
  produto,
  onSuccess,
}: ProductRecipeDrawerProps) {
  const qc = useQueryClient();
  const materiais = useMateriais(modulo === "doceria" ? "doceria" : "clube");
  const isEdit = !!produto;

  const [nome, setNome] = useState("");
  const [precoVenda, setPrecoVenda] = useState("");
  const [comissao, setComissao] = useState("");
  const [ingredientes, setIngredientes] = useState<IngredienteInsumo[]>([]);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedMatId, setSelectedMatId] = useState("");

  // Preenche campos ao abrir em modo edição
  useEffect(() => {
    if (open && produto) {
      setNome(produto.nome);
      setPrecoVenda(String(produto.preco_venda));
      setComissao(String(produto.comissao));
      setIngredientes(produto.ingredientes ?? []);
    }
    if (!open) {
      setNome(""); setPrecoVenda(""); setComissao("");
      setIngredientes([]); setSelectedMatId("");
      setConfirmDelete(false);
    }
  }, [open, produto]);

  const custoTotalIngredientes = ingredientes.reduce((acc, cur) => acc + cur.custo_subtotal, 0);
  const precoVendaNum = Number(precoVenda.replace(",", ".")) || 0;
  const comissaoNum = Number(comissao.replace(",", ".")) || 0;
  const lucroEstimado = precoVendaNum - custoTotalIngredientes - comissaoNum;
  const margem = precoVendaNum > 0 ? (lucroEstimado / precoVendaNum) * 100 : 0;

  function handleAddIngredient() {
    if (!selectedMatId) return;
    const mat = materiais.find((m) => m.id === selectedMatId);
    if (!mat) return;

    if (ingredientes.some((i) => i.material_id === mat.id)) {
      toast.info("Este ingrediente já está na receita. Ajuste a quantidade se necessário.");
      return;
    }

    const custoUnitario = mat.quantidade > 0 ? mat.custo_total / mat.quantidade : 0;
    const defaultQtd = 1;

    setIngredientes((prev) => [
      ...prev,
      {
        material_id: mat.id,
        material_nome: mat.nome,
        quantidade: defaultQtd,
        unidade_medida: mat.unidade_medida || "un",
        custo_unitario: custoUnitario,
        custo_subtotal: custoUnitario * defaultQtd,
      },
    ]);
    setSelectedMatId("");
  }

  function handleUpdateQtd(index: number, qtdStr: string) {
    const qtd = Number(qtdStr.replace(",", ".")) || 0;
    setIngredientes((prev) => {
      const copy = [...prev];
      const item = copy[index];
      if (!item) return prev;
      copy[index] = {
        ...item,
        quantidade: qtd,
        custo_subtotal: item.custo_unitario * qtd,
      };
      return copy;
    });
  }

  function handleRemoveIngredient(index: number) {
    setIngredientes((prev) => prev.filter((_, i) => i !== index));
  }

  function resetForm() {
    setNome("");
    setPrecoVenda("");
    setComissao("");
    setIngredientes([]);
    setSelectedMatId("");
    setConfirmDelete(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nomeTrimmed = nome.trim();
    if (!nomeTrimmed) { toast.error("Informe o nome do produto."); return; }
    if (precoVendaNum <= 0) { toast.error("Informe um preço de venda maior que zero."); return; }

    setSaving(true);
    try {
      if (isEdit && produto) {
        await updateProduto(produto.id, {
          nome: nomeTrimmed,
          preco_venda: precoVendaNum,
          custo: Number(custoTotalIngredientes.toFixed(2)),
          comissao: comissaoNum,
          modulo,
          ingredientes,
        });
        toast.success(`Produto "${nomeTrimmed}" atualizado!`);
      } else {
        await addProduto({
          nome: nomeTrimmed,
          preco_venda: precoVendaNum,
          custo: Number(custoTotalIngredientes.toFixed(2)),
          comissao: comissaoNum,
          modulo,
          ingredientes,
        });
        toast.success(`Produto "${nomeTrimmed}" cadastrado!`);
      }
      qc.invalidateQueries({ queryKey: ["produtos"] });
      resetForm();
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível salvar o produto.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!produto) return;
    setDeleting(true);
    try {
      await deleteProduto(produto.id);
      toast.success(`Produto "${produto.nome}" excluído.`);
      qc.invalidateQueries({ queryKey: ["produtos"] });
      resetForm();
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível excluir o produto.");
    } finally {
      setDeleting(false);
    }
  }

  const field =
    "h-12 w-full rounded-2xl border border-outline-variant/60 bg-surface px-4 text-sm text-foreground outline-none focus:border-2 focus:border-primary transition-all";

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="rounded-t-3xl bg-surface-container-low max-w-lg mx-auto max-h-[92vh] flex flex-col">
        <DrawerHeader>
          <DrawerTitle className="text-lg font-black text-foreground flex items-center gap-2">
            <PackageCheck className="size-5 text-primary" />
            <span>{isEdit ? "Editar Produto" : "Cadastrar Produto & Ficha Técnica"}</span>
          </DrawerTitle>
          <p className="text-xs text-muted-foreground">
            {isEdit
              ? "Altere os dados e ingredientes do produto."
              : "Vincule os ingredientes/insumos reais em estoque para calcular o custo exato."}
          </p>
        </DrawerHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-4 px-4 pb-8">
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">
              Nome do Produto / Doce
            </label>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Trufa de Maracujá, Bolo no Pote, Kit Caneta GDA"
              className={field}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                Preço de Venda (R$)
              </label>
              <input
                value={precoVenda}
                onChange={(e) => setPrecoVenda(e.target.value)}
                inputMode="decimal"
                placeholder="Ex: 5,00"
                className={field}
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                Comissão Desbravador (R$)
              </label>
              <input
                value={comissao}
                onChange={(e) => setComissao(e.target.value)}
                inputMode="decimal"
                placeholder="Ex: 1,00"
                className={field}
              />
            </div>
          </div>

          {/* Seção Ficha Técnica / Ingredientes Linkados */}
          <div className="border-t border-outline-variant/20 pt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-primary" />
                Ingredientes & Insumos Utilizados
              </span>
              <span className="text-xs font-semibold text-muted-foreground">
                Custo Total: <strong className="text-foreground">{brl(custoTotalIngredientes)}</strong>
              </span>
            </div>

            {/* Seletor de Insumo do Estoque */}
            <div className="flex gap-2 mb-3">
              <select
                value={selectedMatId}
                onChange={(e) => setSelectedMatId(e.target.value)}
                className="h-11 flex-1 rounded-xl border border-outline-variant/60 bg-surface px-3 text-xs text-foreground outline-none focus:border-primary"
              >
                <option value="">Selecione um insumo do estoque…</option>
                {materiais.map((m) => {
                  const custoUn = m.quantidade > 0 ? m.custo_total / m.quantidade : 0;
                  return (
                    <option key={m.id} value={m.id}>
                      {m.nome} ({brl(custoUn)}/{m.unidade_medida || "un"})
                    </option>
                  );
                })}
              </select>
              <button
                type="button"
                onClick={handleAddIngredient}
                disabled={!selectedMatId}
                className="h-11 px-3.5 rounded-xl bg-secondary-container text-on-secondary-container text-xs font-bold flex items-center gap-1 hover:bg-secondary-container/80 disabled:opacity-50 transition-all"
              >
                <Plus className="size-4" />
                <span>Adicionar</span>
              </button>
            </div>

            {/* Lista de Ingredientes Vinculados */}
            {ingredientes.length === 0 ? (
              <div className="p-4 rounded-2xl bg-surface-container-highest/40 border border-dashed border-outline-variant/40 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                <AlertCircle className="size-4 text-muted-foreground shrink-0" />
                <span>
                  Nenhum insumo vinculado. Selecione os itens acima para calcular o custo automático.
                </span>
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {ingredientes.map((ing, idx) => (
                  <div
                    key={ing.material_id}
                    className="p-3 rounded-2xl bg-surface border border-outline-variant/30 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-foreground truncate">{ing.material_nome}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {brl(ing.custo_unitario)} / {ing.unidade_medida}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] text-muted-foreground">Qtd:</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={ing.quantidade}
                          onChange={(e) => handleUpdateQtd(idx, e.target.value)}
                          className="w-14 h-8 rounded-lg bg-surface-container-highest px-2 text-center font-bold text-foreground outline-none border border-outline-variant/40 focus:border-primary"
                        />
                      </div>
                      <span className="font-bold text-foreground w-16 text-right">
                        {brl(ing.custo_subtotal)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveIngredient(idx)}
                        className="text-muted-foreground hover:text-expense p-1 transition-colors"
                        title="Remover insumo"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Resumo de Lucro & Margem */}
          <div className="p-4 rounded-2xl bg-surface-container-highest/60 border border-outline-variant/20 grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-[10px] uppercase font-bold text-muted-foreground">Custo Insumos</p>
              <p className="text-sm font-bold text-foreground mt-0.5">
                {brl(custoTotalIngredientes)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-muted-foreground">Lucro Líquido</p>
              <p
                className={`text-sm font-black mt-0.5 ${
                  lucroEstimado >= 0 ? "text-income" : "text-expense"
                }`}
              >
                {brl(lucroEstimado)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-muted-foreground">Margem</p>
              <p
                className={`text-sm font-bold mt-0.5 ${
                  margem >= 0 ? "text-primary" : "text-expense"
                }`}
              >
                {margem.toFixed(0)}%
              </p>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="h-12 w-full rounded-2xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-60 transition-transform active:scale-[0.99] shadow-sm hover:shadow-md"
          >
            {saving ? "Salvando…" : isEdit ? "Salvar Alterações" : "Salvar Produto & Ficha Técnica"}
          </button>

          {isEdit && !confirmDelete && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="h-10 w-full rounded-2xl border border-destructive/40 text-destructive text-sm font-bold hover:bg-destructive/10 flex items-center justify-center gap-2"
            >
              <Trash2 className="size-4" /> Excluir Produto
            </button>
          )}

          {isEdit && confirmDelete && (
            <div className="p-3 rounded-2xl bg-destructive/10 border border-destructive/30 space-y-2">
              <p className="text-xs font-bold text-destructive">Confirmar exclusão permanente?</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setConfirmDelete(false)}
                  className="flex-1 h-9 rounded-xl border border-outline-variant text-xs font-semibold text-muted-foreground">
                  Cancelar
                </button>
                <button type="button" onClick={handleDelete} disabled={deleting}
                  className="flex-1 h-9 rounded-xl bg-destructive text-white text-xs font-bold disabled:opacity-50">
                  {deleting ? "Excluindo…" : "Confirmar"}
                </button>
              </div>
            </div>
          )}
        </form>
      </DrawerContent>
    </Drawer>
  );
}


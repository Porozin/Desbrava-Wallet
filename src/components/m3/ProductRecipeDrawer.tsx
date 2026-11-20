import { useState, useEffect } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Plus, Trash2, PackageCheck, Sparkles, AlertCircle } from "lucide-react";
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
  produto?: Produto;
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
  const [qtdAdd, setQtdAdd] = useState("1");

  useEffect(() => {
    if (open && produto) {
      setNome(produto.nome);
      setPrecoVenda(String(produto.preco_venda));
      setComissao(String(produto.comissao));
      setIngredientes(produto.ingredientes ?? []);
    }
    if (!open) {
      setNome(""); setPrecoVenda(""); setComissao("");
      setIngredientes([]); setSelectedMatId(""); setQtdAdd("1");
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

    const custoUnitario = mat.quantidade > 0 ? mat.custo_total / mat.quantidade : 0;
    const qtd = parseFloat(qtdAdd.replace(",", ".")) || 1;

    if (ingredientes.some((i) => i.material_id === mat.id)) {
      // Se já existe, apenas atualiza a quantidade
      setIngredientes((prev) =>
        prev.map((i) =>
          i.material_id === mat.id
            ? { ...i, quantidade: i.quantidade + qtd, custo_subtotal: custoUnitario * (i.quantidade + qtd) }
            : i
        )
      );
      toast.info(`+${qtd} ${mat.unidade_medida || "un"} de ${mat.nome}`);
    } else {
      setIngredientes((prev) => [
        ...prev,
        {
          material_id: mat.id,
          material_nome: mat.nome,
          quantidade: qtd,
          unidade_medida: mat.unidade_medida || "un",
          custo_unitario: custoUnitario,
          custo_subtotal: custoUnitario * qtd,
        },
      ]);
    }
    // NÃO limpa o select — permite adicionar mais insumos rapidamente
    setQtdAdd("1");
  }

  function handleUpdateQtd(index: number, qtdStr: string) {
    const qtd = parseFloat(qtdStr.replace(",", ".")) || 0;
    setIngredientes((prev) => {
      const copy = [...prev];
      const item = copy[index];
      if (!item) return prev;
      copy[index] = { ...item, quantidade: qtd, custo_subtotal: item.custo_unitario * qtd };
      return copy;
    });
  }

  function handleRemoveIngredient(index: number) {
    setIngredientes((prev) => prev.filter((_, i) => i !== index));
  }

  function resetForm() {
    setNome(""); setPrecoVenda(""); setComissao("");
    setIngredientes([]); setSelectedMatId(""); setQtdAdd("1");
setConfirmDelete(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nomeTrimmed = nome.trim();
    if (!nomeTrimmed) { toast.error("Informe o nome do produto."); return; }
    if (precoVendaNum <= 0) { toast.error("Informe um preço de venda maior que zero."); return; }

    setSaving(true);
    try {
      const payload = {
        nome: nomeTrimmed,
        preco_venda: precoVendaNum,
        custo: parseFloat(custoTotalIngredientes.toFixed(2)),
        comissao: comissaoNum,
        modulo,
        ingredientes,
      };

      if (isEdit && produto) {
        await updateProduto(produto.id, payload);
        toast.success(`"${nomeTrimmed}" atualizado!`);
      } else {
        await addProduto(payload);
        toast.success(`"${nomeTrimmed}" cadastrado!`);
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
      toast.success(`"${produto.nome}" excluído.`);
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

  const field = "h-12 w-full rounded-2xl border border-outline-variant/60 bg-surface px-4 text-sm text-foreground outline-none focus:border-2 focus:border-primary transition-all";


  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="rounded-t-3xl bg-surface-container-low max-w-lg mx-auto max-h-[94vh] flex flex-col">
        <DrawerHeader className="shrink-0">
          <DrawerTitle className="text-lg font-black text-foreground flex items-center gap-2">
            <PackageCheck className="size-5 text-primary" />
            {isEdit ? "Editar Produto" : "Cadastrar Produto"}
          </DrawerTitle>
        </DrawerHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-4 px-4 pb-8">

          {/* Nome */}
          <input value={nome} onChange={(e) => setNome(e.target.value)}
            placeholder="Nome do produto (ex: Trufa de Maracujá)" className={field} required />

          {/* Preço e Comissão */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-muted-foreground uppercase mb-1 block">Preço de Venda</label>
              <input value={precoVenda} onChange={(e) => setPrecoVenda(e.target.value)}
                inputMode="decimal" placeholder="R$ 0,00" className={field} required />
            </div>
            <div>
              <label className="text-[11px] font-bold text-muted-foreground uppercase mb-1 block">Comissão</label>
              <input value={comissao} onChange={(e) => setComissao(e.target.value)}
                inputMode="decimal" placeholder="R$ 0,00" className={field} />
            </div>
          </div>

          {/* Seção Ingredientes */}
          <div className="border-t border-outline-variant/20 pt-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-primary" /> Ingredientes & Custos
              </span>
              <span className="text-xs font-bold text-muted-foreground">
                Total: <strong className={custoTotalIngredientes > 0 ? "text-expense" : "text-foreground"}>{brl(custoTotalIngredientes)}</strong>
              </span>
            </div>

            {/* Adicionar insumo do estoque */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <select value={selectedMatId} onChange={(e) => setSelectedMatId(e.target.value)}
                  className="h-11 flex-1 rounded-xl border border-outline-variant/60 bg-surface px-3 text-xs text-foreground outline-none focus:border-primary">
                  <option value="">Selecione um insumo…</option>
                  {materiais.map((m) => {
                    const custoUn = m.quantidade > 0 ? m.custo_total / m.quantidade : 0;
                    return (
                      <option key={m.id} value={m.id}>
                        {m.nome} — {brl(custoUn)}/{m.unidade_medida || "un"}
                      </option>
                    );
                  })}
                </select>
                <input value={qtdAdd} onChange={(e) => setQtdAdd(e.target.value)}
                  inputMode="decimal" placeholder="Qtd"
                  className="w-16 h-11 rounded-xl border border-outline-variant/60 bg-surface px-3 text-xs text-center outline-none focus:border-primary" />
                <button type="button" onClick={handleAddIngredient} disabled={!selectedMatId}
                  className="h-11 px-3 rounded-xl bg-secondary-container text-on-secondary-container text-xs font-bold disabled:opacity-50">
                  <Plus className="size-4" />
                </button>
              </div>

              {/* Insumos especiais removidos daqui — cadastre Energia e Gás como insumos na aba Insumos */}
            </div>

            {/* Lista de ingredientes adicionados */}
            {ingredientes.length === 0 ? (
              <div className="p-4 rounded-2xl bg-surface-container-highest/40 border border-dashed border-outline-variant/40 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                <AlertCircle className="size-4 shrink-0" />
                Nenhum ingrediente ainda. Adicione acima.
              </div>
            ) : (
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {ingredientes.map((ing, idx) => (
                  <div key={ing.material_id + idx}
                    className="p-3 rounded-2xl bg-surface border border-outline-variant/30 flex items-center gap-2 text-xs">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-foreground truncate">{ing.material_nome}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {brl(ing.custo_unitario)} / {ing.unidade_medida}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <input type="text" inputMode="decimal"
                        value={ing.quantidade}
                        onChange={(e) => handleUpdateQtd(idx, e.target.value)}
                        className="w-14 h-8 rounded-lg bg-surface-container-highest px-2 text-center font-bold outline-none border border-outline-variant/40 focus:border-primary" />
                      <span className="font-bold text-foreground w-16 text-right">{brl(ing.custo_subtotal)}</span>
                      <button type="button" onClick={() => handleRemoveIngredient(idx)}
                        className="p-1 text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Resumo */}
          <div className="p-4 rounded-2xl bg-surface-container-highest/60 border border-outline-variant/20 grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-[10px] uppercase font-bold text-muted-foreground">Custo Total</p>
              <p className="text-sm font-bold text-expense mt-0.5">{brl(custoTotalIngredientes)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-muted-foreground">Lucro</p>
              <p className={`text-sm font-black mt-0.5 ${lucroEstimado >= 0 ? "text-income" : "text-destructive"}`}>
                {brl(lucroEstimado)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-muted-foreground">Margem</p>
              <p className={`text-sm font-bold mt-0.5 ${margem >= 20 ? "text-income" : margem >= 0 ? "text-primary" : "text-destructive"}`}>
                {margem.toFixed(0)}%
              </p>
            </div>
          </div>

          <button type="submit" disabled={saving}
            className="h-12 w-full rounded-2xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-60">
            {saving ? "Salvando…" : isEdit ? "Salvar Alterações" : "Salvar Produto"}
          </button>

          {isEdit && !confirmDelete && (
            <button type="button" onClick={() => setConfirmDelete(true)}
              className="h-10 w-full rounded-2xl border border-destructive/40 text-destructive text-sm font-bold hover:bg-destructive/10 flex items-center justify-center gap-2">
              <Trash2 className="size-4" /> Excluir Produto
            </button>
          )}

          {isEdit && confirmDelete && (
            <div className="p-3 rounded-2xl bg-destructive/10 border border-destructive/30 space-y-2">
              <p className="text-xs font-bold text-destructive">Confirmar exclusão permanente?</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setConfirmDelete(false)}
                  className="flex-1 h-9 rounded-xl border border-outline-variant text-xs font-semibold text-muted-foreground">Cancelar</button>
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

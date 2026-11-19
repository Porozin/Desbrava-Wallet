import { useState, useEffect } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { addMaterial, updateMaterial, deleteMaterial, type MaterialItem } from "@/lib/data";

interface MaterialDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modulo: "clube" | "doceria";
  material?: MaterialItem; // se fornecido → modo edição
}

const UNIDADES = ["un", "kg", "g", "L", "mL", "cx", "pct", "dz"];

export function MaterialDrawer({ open, onOpenChange, modulo, material }: MaterialDrawerProps) {
  const qc = useQueryClient();
  const isEdit = !!material;

  const [nome, setNome] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [custo, setCusto] = useState("");
  const [unidade, setUnidade] = useState("un");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (open && material) {
      setNome(material.nome);
      setQuantidade(String(material.quantidade));
      setCusto(String(material.custo_total));
      setUnidade(material.unidade_medida || "un");
    }
    if (!open) {
      setNome(""); setQuantidade(""); setCusto(""); setUnidade("un");
      setConfirmDelete(false);
    }
  }, [open, material]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const nomeTrimmed = nome.trim();
    if (!nomeTrimmed) { toast.error("Informe o nome do insumo."); return; }
    const qty = Number(quantidade.replace(",", "."));
    const custoNum = Number(custo.replace(",", "."));
    if (qty <= 0) { toast.error("Informe uma quantidade maior que zero."); return; }

    setSaving(true);
    try {
      if (isEdit && material) {
        await updateMaterial(material.id, { nome: nomeTrimmed, quantidade: qty, custo_total: custoNum, unidade_medida: unidade });
        toast.success("Insumo atualizado!");
      } else {
        await addMaterial({ modulo, nome: nomeTrimmed, quantidade: qty, custo_total: custoNum, unidade_medida: unidade });
        toast.success("Insumo cadastrado!");
      }
      qc.invalidateQueries({ queryKey: ["materiais"] });
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar insumo.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!material) return;
    setDeleting(true);
    try {
      await deleteMaterial(material.id);
      toast.success("Insumo excluído.");
      qc.invalidateQueries({ queryKey: ["materiais"] });
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao excluir insumo.");
    } finally {
      setDeleting(false);
    }
  }

  const field = "h-12 w-full rounded-2xl border border-outline-variant/60 bg-surface px-4 text-sm outline-none focus:border-primary transition-all";

  return (
    <Drawer open={open} onOpenChange={(v) => { if (!v) setConfirmDelete(false); onOpenChange(v); }}>
      <DrawerContent className="rounded-t-3xl bg-surface-container-low max-w-lg mx-auto p-4 pb-8 space-y-4">
        <DrawerHeader className="p-0">
          <DrawerTitle className="text-lg font-black text-foreground">
            {isEdit ? "Editar Insumo" : "Novo Insumo"}
          </DrawerTitle>
        </DrawerHeader>

        <form onSubmit={handleSave} className="space-y-3">
          <input value={nome} onChange={(e) => setNome(e.target.value)}
            placeholder="Nome do insumo (ex: Chocolate ao leite)" className={field} required />

          <div className="grid grid-cols-2 gap-3">
            <input value={quantidade} onChange={(e) => setQuantidade(e.target.value)}
              inputMode="decimal" placeholder="Quantidade" className={field} required />
            <select value={unidade} onChange={(e) => setUnidade(e.target.value)} className={field}>
              {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>

          <input value={custo} onChange={(e) => setCusto(e.target.value)}
            inputMode="decimal" placeholder="Custo total (R$)" className={field} />

          <button type="submit" disabled={saving}
            className="h-12 w-full rounded-2xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50">
            {saving ? "Salvando…" : isEdit ? "Salvar Alterações" : "Cadastrar Insumo"}
          </button>
        </form>

        {isEdit && !confirmDelete && (
          <button onClick={() => setConfirmDelete(true)}
            className="h-10 w-full rounded-2xl border border-destructive/40 text-destructive text-sm font-bold hover:bg-destructive/10 flex items-center justify-center gap-2">
            <Trash2 className="size-4" /> Excluir Insumo
          </button>
        )}

        {isEdit && confirmDelete && (
          <div className="p-3 rounded-2xl bg-destructive/10 border border-destructive/30 space-y-2">
            <p className="text-xs font-bold text-destructive">Confirmar exclusão permanente?</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(false)}
                className="flex-1 h-9 rounded-xl border border-outline-variant text-xs font-semibold text-muted-foreground">
                Cancelar
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 h-9 rounded-xl bg-destructive text-white text-xs font-bold disabled:opacity-50">
                {deleting ? "Excluindo…" : "Confirmar"}
              </button>
            </div>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}

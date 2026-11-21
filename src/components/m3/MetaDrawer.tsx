import { useState, useEffect } from "react";
import { Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { addMeta, updateMeta, deleteMeta, type Meta } from "@/lib/data";

interface MetaDrawerProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  meta?: Meta;
}

export function MetaDrawer({ open, onOpenChange, meta }: MetaDrawerProps) {
  const qc = useQueryClient();
  const isEdit = !!meta;

  const [modulo, setModulo] = useState<Meta["modulo"]>("clube");
  const [descricao, setDescricao] = useState("");
  const [valorAlvo, setValorAlvo] = useState("");
  const [status, setStatus] = useState<Meta["status"]>("aprovada");
  const [tipo, setTipo] = useState<Meta["tipo"]>("destinacao_manual");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (open) {
      if (meta) {
        setModulo(meta.modulo);
        setDescricao(meta.descricao);
        setValorAlvo(String(meta.valor_alvo));
        setStatus(meta.status);
        setTipo(meta.tipo ?? "destinacao_manual");
      } else {
        setModulo("clube");
        setDescricao("");
        setValorAlvo("");
        setStatus("aprovada");
        setTipo("destinacao_manual");
      }
      setConfirmDelete(false);
    }
  }, [open, meta]);

  function handleClose() {
    setConfirmDelete(false);
    onOpenChange(false);
  }

  async function handleSave() {
    if (!descricao.trim()) { toast.error("Informe a descrição da meta."); return; }
    const valor = parseFloat(valorAlvo.replace(",", "."));
    if (isNaN(valor) || valor <= 0) { toast.error("Informe um valor alvo válido."); return; }

    setSaving(true);
    try {
      if (isEdit && meta) {
        await updateMeta(meta.id, { descricao: descricao.trim(), valor_alvo: valor, status, tipo });
        toast.success("Meta atualizada com sucesso!");
      } else {
        await addMeta({ modulo, descricao: descricao.trim(), valor_alvo: valor, status, tipo, valor_atual: 0 });
        toast.success("Meta criada com sucesso!");
      }
      qc.invalidateQueries({ queryKey: ["metas"] });
      handleClose();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar meta.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!meta) return;
    setDeleting(true);
    try {
      await deleteMeta(meta.id);
      toast.success("Meta excluída com sucesso!");
      qc.invalidateQueries({ queryKey: ["metas"] });
      handleClose();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao excluir meta.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Drawer open={open} onOpenChange={handleClose}>
      <DrawerContent className="rounded-t-3xl bg-surface-container-low max-w-lg mx-auto p-4 pb-8">
        <DrawerHeader className="p-0 mb-4">
          <div className="flex items-center justify-between">
            <DrawerTitle className="text-lg font-black text-foreground">
              {isEdit ? "Editar Meta" : "Nova Meta"}
            </DrawerTitle>
            <button onClick={handleClose} className="p-2 rounded-full hover:bg-surface-variant/40">
              <X className="size-4 text-muted-foreground" />
            </button>
          </div>
        </DrawerHeader>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide block mb-1">Módulo</label>
            <select
              value={modulo}
              onChange={(e) => setModulo(e.target.value as Meta["modulo"])}
              className="h-12 w-full rounded-2xl border border-outline-variant/60 bg-surface px-4 text-sm outline-none focus:border-primary"
            >
              <option value="clube">Clube</option>
              <option value="doceria">Doceria</option>
              <option value="vendas">Vendas</option>
              <option value="unidade">Unidade</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide block mb-1">Descrição</label>
            <input
              type="text"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Campori 2027, uniforme novo…"
              className="h-12 w-full rounded-2xl border border-outline-variant/60 bg-surface px-4 text-sm outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide block mb-1">Valor Alvo (R$)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={valorAlvo}
              onChange={(e) => setValorAlvo(e.target.value)}
              placeholder="0,00"
              className="h-12 w-full rounded-2xl border border-outline-variant/60 bg-surface px-4 text-sm outline-none focus:border-primary"
            />
          </div>

          {isEdit && (
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide block mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Meta["status"])}
                className="h-12 w-full rounded-2xl border border-outline-variant/60 bg-surface px-4 text-sm outline-none focus:border-primary"
              >
                <option value="pendente">Pendente</option>
                <option value="aprovada">Aprovada</option>
                <option value="concluida">Concluída</option>
              </select>
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide block mb-1">Como a meta é preenchida?</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setTipo("lucro_automatico")}
                className={`h-12 rounded-2xl border-2 text-xs font-bold flex flex-col items-center justify-center gap-0.5 transition-all px-2 ${
                  tipo === "lucro_automatico" ? "border-primary bg-primary-container/30 text-primary" : "border-outline-variant/40 text-muted-foreground"
                }`}>
                <span>⚡ Lucro automático</span>
                <span className="font-normal text-[10px]">Vendas + Doceria</span>
              </button>
              <button type="button" onClick={() => setTipo("destinacao_manual")}
                className={`h-12 rounded-2xl border-2 text-xs font-bold flex flex-col items-center justify-center gap-0.5 transition-all px-2 ${
                  tipo === "destinacao_manual" ? "border-primary bg-primary-container/30 text-primary" : "border-outline-variant/40 text-muted-foreground"
                }`}>
                <span>🎯 Destinação manual</span>
                <span className="font-normal text-[10px]">Você decide o valor</span>
              </button>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="h-12 w-full rounded-2xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50 mt-2"
          >
            {saving ? "Salvando…" : "Salvar"}
          </button>

          {isEdit && !confirmDelete && (
            <button
              onClick={() => setConfirmDelete(true)}
              className="h-10 w-full rounded-2xl border border-destructive/40 text-destructive text-sm font-bold hover:bg-destructive/10 flex items-center justify-center gap-2"
            >
              <Trash2 className="size-4" /> Excluir Meta
            </button>
          )}

          {isEdit && confirmDelete && (
            <div className="p-3 rounded-2xl bg-destructive/10 border border-destructive/30 space-y-2">
              <p className="text-xs font-bold text-destructive">Confirmar exclusão desta meta?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1 h-9 rounded-xl border border-outline-variant text-xs font-semibold text-muted-foreground"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 h-9 rounded-xl bg-destructive text-white text-xs font-bold disabled:opacity-50"
                >
                  {deleting ? "Excluindo…" : "Confirmar"}
                </button>
              </div>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

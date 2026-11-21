import { useState, useEffect } from "react";
import { Trash2, Zap, Flame, Package } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { brl } from "@/lib/finance";
import { addMaterial, updateMaterial, deleteMaterial, type MaterialItem } from "@/lib/data";

interface MaterialDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modulo: "clube" | "doceria";
  material?: MaterialItem;
}

type Modo = "normal" | "luz" | "gas";

const UNIDADES = ["un", "kg", "g", "L", "mL", "cx", "pct", "dz"];

export function MaterialDrawer({ open, onOpenChange, modulo, material }: MaterialDrawerProps) {
  const qc = useQueryClient();
  const isEdit = !!material;

  const [modo, setModo] = useState<Modo>("normal");

  // Campos modo normal
  const [nome, setNome] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [custo, setCusto] = useState("");
  const [unidade, setUnidade] = useState("un");

  // Campos modo luz
  const [conta1, setConta1] = useState("");
  const [docesLuz, setDocesLuz] = useState("");
  const [conta2, setConta2] = useState("");
  const [conta3, setConta3] = useState("");

  // Campos modo gás
  const [valorGas, setValorGas] = useState("");
  const [duracaoGas, setDuracaoGas] = useState("");
  const [diasProducao, setDiasProducao] = useState("");
  const [docesPerDia, setDocesPerDia] = useState("");
  const [percGasProducao, setPercGasProducao] = useState("100");

  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (open && material) {
      setNome(material.nome);
      setQuantidade(String(material.quantidade));
      setCusto(String(material.custo_total));
      setUnidade(material.unidade_medida || "un");
      setModo("normal");
    }
    if (!open) {
      setNome(""); setQuantidade(""); setCusto(""); setUnidade("un");
      setConta1(""); setConta2(""); setConta3(""); setDocesLuz("");
      setValorGas(""); setDuracaoGas(""); setDiasProducao(""); setDocesPerDia(""); setPercGasProducao("100");
      setModo("normal"); setConfirmDelete(false);
    }
  }, [open, material]);

  // Cálculo automático baseado no modo
  const custoCalculado = (() => {
    if (modo === "luz") {
      const v = [conta1, conta2, conta3]
        .map((v) => parseFloat(v.replace(",", ".")) || 0)
        .filter((v) => v > 0);
      if (v.length === 0) return null;
      const media = v.reduce((a, b) => a + b, 0) / v.length;
      const doces = parseFloat(docesLuz.replace(",", ".")) || 0;
      if (doces <= 0) return media; // sem rateio ainda
      return media / doces; // custo por doce
    }
    if (modo === "gas") {
      const val = parseFloat(valorGas.replace(",", ".")) || 0;
      const diasP = parseFloat(diasProducao.replace(",", ".")) || 0;
      const doces = parseFloat(docesPerDia.replace(",", ".")) || 0;
      const perc = parseFloat(percGasProducao.replace(",", ".")) || 100;
      if (val <= 0 || diasP <= 0 || doces <= 0) return null;
      // Fórmula: (custo botijão × % destinado) ÷ (dias produção × doces/dia)
      const custoDestinado = val * (perc / 100);
      const totalDoces = diasP * doces;
      return custoDestinado / totalDoces;
    }
    return null;
  })();

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

    let nomeFinal = nome.trim();
    let qtdFinal = parseFloat(quantidade.replace(",", "."));
    let custoFinal = parseFloat(custo.replace(",", "."));
    let unidadeFinal = unidade;

    if (modo === "luz") {
      if (!custoCalculado) { toast.error("Informe ao menos uma conta de luz."); return; }
      nomeFinal = nomeFinal || "Energia Elétrica";
      // Salva como: 1 doce = custo calculado (media / doces_por_mes)
      qtdFinal = 1;
      custoFinal = custoCalculado;
      unidadeFinal = parseFloat((docesLuz||"0").replace(",",".")) > 0 ? "doce" : "mês";
    } else if (modo === "gas") {
      if (!custoCalculado) { toast.error("Preencha todos os campos para calcular o custo."); return; }
      nomeFinal = nomeFinal || "Gás de Cozinha";
      // Salva como: 1 unidade = custo por doce calculado
      qtdFinal = 1;
      custoFinal = custoCalculado;
      unidadeFinal = "doce";
    } else {
      if (!nomeFinal) { toast.error("Informe o nome do insumo."); return; }
      if (qtdFinal <= 0) { toast.error("Informe uma quantidade maior que zero."); return; }
    }

    setSaving(true);
    try {
      if (isEdit && material) {
        await updateMaterial(material.id, {
          nome: nomeFinal,
          quantidade: qtdFinal,
          custo_total: custoFinal,
          unidade_medida: unidadeFinal,
        });
        toast.success("Insumo atualizado!");
      } else {
        await addMaterial({
          modulo,
          nome: nomeFinal,
          quantidade: qtdFinal,
          custo_total: custoFinal,
          unidade_medida: unidadeFinal,
        });
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

        {/* Seletor de modo — só na criação */}
        {!isEdit && (
          <div className="grid grid-cols-3 gap-2">
            {([
              { id: "normal", label: "Insumo", icon: Package, color: "text-primary" },
              { id: "luz", label: "Energia", icon: Zap, color: "text-amber-500" },
              { id: "gas", label: "Gás", icon: Flame, color: "text-orange-500" },
            ] as const).map(({ id, label, icon: Icon, color }) => (
              <button
                key={id}
                type="button"
                onClick={() => setModo(id)}
                className={`h-12 rounded-2xl border-2 text-xs font-bold flex flex-col items-center justify-center gap-0.5 transition-all ${
                  modo === id
                    ? "border-primary bg-primary-container/30 text-primary"
                    : "border-outline-variant/40 text-muted-foreground hover:border-outline-variant"
                }`}
              >
                <Icon className={`size-4 ${modo === id ? "text-primary" : color}`} />
                {label}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-3">

          {/* Modo Normal */}
          {modo === "normal" && (
            <>
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
            </>
          )}

          {/* Modo Luz */}
          {modo === "luz" && (
            <>
              <input value={nome} onChange={(e) => setNome(e.target.value)}
                placeholder='Nome (padrão: "Energia Elétrica")' className={field} />
              <p className="text-xs text-muted-foreground px-1">
                Informe o valor das últimas contas de luz. O sistema calcula a média mensal automaticamente.
              </p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Mês 1 (R$)", val: conta1, set: setConta1 },
                  { label: "Mês 2 (R$)", val: conta2, set: setConta2 },
                  { label: "Mês 3 (R$)", val: conta3, set: setConta3 },
                ].map(({ label, val, set }) => (
                  <div key={label}>
                    <label className="text-[10px] text-muted-foreground block mb-0.5">{label}</label>
                    <input value={val} onChange={(e) => set(e.target.value)}
                      inputMode="decimal" placeholder="0,00"
                      className="h-11 w-full rounded-xl border border-outline-variant/60 bg-surface px-3 text-sm outline-none focus:border-primary" />
                  </div>
                ))}
              </div>
              <div>
                <label className="text-[11px] font-bold text-muted-foreground block mb-1">Doces produzidos por mês</label>
                <input value={docesLuz} onChange={(e) => setDocesLuz(e.target.value)}
                  inputMode="decimal" placeholder="Ex: 200"
                  className="h-12 w-full rounded-2xl border border-outline-variant/60 bg-surface px-4 text-sm outline-none focus:border-primary" />
                <p className="text-[10px] text-muted-foreground mt-1 px-1">Quantos doces você produz por mês usando energia elétrica?</p>
              </div>
              {custoCalculado !== null && (
                <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/40 space-y-0.5">
                  {parseFloat((docesLuz||"").replace(",",".")) > 0 ? (
                    <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
                      Custo de energia por doce: {brl(custoCalculado)}
                    </p>
                  ) : (
                    <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
                      Média mensal: {brl(custoCalculado)} — informe os doces/mês para calcular por unidade
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {/* Modo Gás */}
          {modo === "gas" && (
            <>
              <input value={nome} onChange={(e) => setNome(e.target.value)}
                placeholder='Nome (padrão: "Gás de Cozinha")' className={field} />
              <p className="text-xs text-muted-foreground px-1">
                Calcula quanto de gás cada doce consome, considerando que o fogão pode ser usado para outras coisas além da produção.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground block mb-1">Valor do botijão (R$)</label>
                  <input value={valorGas} onChange={(e) => setValorGas(e.target.value)}
                    inputMode="decimal" placeholder="Ex: 110,00" className={field} required />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground block mb-1">Duração (dias)</label>
                  <input value={duracaoGas} onChange={(e) => setDuracaoGas(e.target.value)}
                    inputMode="decimal" placeholder="Ex: 30" className={field} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground block mb-1">Dias de produção/mês</label>
                  <input value={diasProducao} onChange={(e) => setDiasProducao(e.target.value)}
                    inputMode="decimal" placeholder="Ex: 20" className={field} />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground block mb-1">Doces produzidos/dia</label>
                  <input value={docesPerDia} onChange={(e) => setDocesPerDia(e.target.value)}
                    inputMode="decimal" placeholder="Ex: 50" className={field} />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                  % do gás destinado à produção (0–100)
                </label>
                <input value={percGasProducao} onChange={(e) => setPercGasProducao(e.target.value)}
                  inputMode="decimal" placeholder="Ex: 60 (se 60% do fogão é para doces)" className={field} />
                <p className="text-[10px] text-muted-foreground mt-1 px-1">
                  Se o fogão é usado só para doces, coloque 100. Se divide com refeições domésticas, coloque menos.
                </p>
              </div>
              {custoCalculado !== null && (
                <div className="p-3 rounded-2xl bg-orange-50 dark:bg-orange-950/30 border border-orange-200/40 space-y-1">
                  <p className="text-xs font-bold text-orange-800 dark:text-orange-300">
                    Gás por doce: {brl(custoCalculado)}
                  </p>
                  {(() => {
                    const val = parseFloat(valorGas.replace(",", ".")) || 0;
                    const dias = parseFloat(duracaoGas.replace(",", ".")) || 0;
                    const diasP = parseFloat(diasProducao.replace(",", ".")) || 0;
                    const doces = parseFloat(docesPerDia.replace(",", ".")) || 0;
                    const perc = parseFloat(percGasProducao.replace(",", ".")) || 100;
                    const custoDestinado = val * (perc / 100);
                    const totalDoces = diasP * doces;
                    return (
                      <p className="text-[11px] text-orange-700 dark:text-orange-400">
                        R${val.toFixed(2)} × {perc}% ÷ ({diasP} dias × {doces} doces) = R${custoCalculado.toFixed(4)}/doce
                      </p>
                    );
                  })()}
                  <p className="text-[11px] text-orange-600 dark:text-orange-500">
                    Salvo como: custo unitário = {brl(custoCalculado)} | quantidade = 1 doce
                  </p>
                </div>
              )}
            </>
          )}

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

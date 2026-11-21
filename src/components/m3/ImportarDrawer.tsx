import { useState, useRef, useCallback } from "react";
import {
  Upload, Sparkles, Check, X, AlertTriangle, ChevronDown, ChevronUp,
  RotateCcw, ArrowDownLeft, ArrowUpRight, Users, HelpCircle, Trash2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { brl } from "@/lib/finance";
import { type ItemImportado, type AnaliseResult, useImportarIA } from "@/hooks/useImportarIA";

const CAIXAS = [
  { value: "geral",    label: "Caixa Geral" },
  { value: "doceria",  label: "Doceria" },
  { value: "vendas",   label: "Vendas Rápidas" },
] as const;

const TIPOS: Record<ItemImportado["tipo"], { label: string; icon: React.ComponentType<any>; tone: string }> = {
  venda:             { label: "Venda",          icon: ArrowDownLeft, tone: "text-income" },
  entrada:           { label: "Entrada",         icon: ArrowDownLeft, tone: "text-income" },
  saida:             { label: "Saída",           icon: ArrowUpRight,  tone: "text-expense" },
  divida_a_receber:  { label: "A Receber",       icon: Users,         tone: "text-primary" },
  divida_a_pagar:    { label: "A Pagar",         icon: Users,         tone: "text-amber-600" },
  pagamento_divida:  { label: "Pgto. Dívida",    icon: Check,         tone: "text-income" },
  outro:             { label: "Outro",           icon: HelpCircle,    tone: "text-muted-foreground" },
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

type Etapa = "entrada" | "preview" | "resultado";

export function ImportarDrawer({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const { analisar, confirmar, desfazer, loading, progresso, erro } = useImportarIA();

  const [etapa, setEtapa]           = useState<Etapa>("entrada");
  const [texto, setTexto]           = useState("");
  const [caixaDestino, setCaixaDestino] = useState<"geral" | "doceria" | "vendas">("geral");
  const [analise, setAnalise]       = useState<AnaliseResult | null>(null);
  const [itens, setItens]           = useState<(ItemImportado & { _sel: boolean })[]>([]);
  const [abaPreview, setAbaPreview] = useState<"todos" | "dudosos" | "nao_reconhecidos">("todos");
  const [batchId, setBatchId]       = useState<string | null>(null);
  const [resultado, setResultado]   = useState<{ tx: number; div: number; erros: string[] } | null>(null);
  const [desfazendo, setDesfazendo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setEtapa("entrada");
    setTexto("");
    setAnalise(null);
    setItens([]);
    setBatchId(null);
    setResultado(null);
    setDesfazendo(false);
    setAbaPreview("todos");
  }

  function handleClose() {
    if (etapa !== "entrada" && !resultado) {
      if (!confirm("Sair sem confirmar a importação?")) return;
    }
    reset();
    onOpenChange(false);
  }

  // ── leitura de arquivo ────────────────────────────────────────────────────
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500_000) { toast.error("Arquivo muito grande (máx 500 KB)."); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result;
      if (typeof result === "string") setTexto(result);
      else {
        // tenta Latin-1
        const latin = new TextDecoder("iso-8859-1").decode(ev.target?.result as ArrayBuffer);
        setTexto(latin);
      }
    };
    reader.readAsText(file, "UTF-8");
  }

  // ── step 1 → 2: analisar ─────────────────────────────────────────────────
  async function handleAnalisar() {
    if (!texto.trim()) { toast.error("Cole ou carregue um texto para analisar."); return; }
    const res = await analisar(texto);
    if (!res) return;
    setAnalise(res);
    setItens(res.itens.map((i) => ({ ...i, _sel: true })));
    setEtapa("preview");
    if (res.erros_chunks.length) {
      toast.warning(`${res.erros_chunks.length} chunk(s) não processados pela IA.`);
    }
  }

  // ── edição inline ─────────────────────────────────────────────────────────
  function editItem<K extends keyof ItemImportado>(idx: number, key: K, val: ItemImportado[K]) {
    setItens((prev) => prev.map((it, i) => i === idx ? { ...it, [key]: val } : it));
  }

  // ── step 2 → 3: confirmar ─────────────────────────────────────────────────
  async function handleConfirmar() {
    const selecionados = itens.filter((i) => i._sel && i.tipo !== "outro");
    if (!selecionados.length) { toast.error("Nenhum item selecionado."); return; }
    const res = await confirmar(selecionados, texto, caixaDestino);
    if (!res) return;
    setBatchId(res.batch_id);
    setResultado({ tx: res.transacoes_criadas, div: res.dividas_criadas, erros: res.erros });
    setEtapa("resultado");
    qc.invalidateQueries({ queryKey: ["transactions"] });
    qc.invalidateQueries({ queryKey: ["dividas"] });
    toast.success(`${res.transacoes_criadas} transações e ${res.dividas_criadas} dívidas importadas!`);
  }

  // ── desfazer ──────────────────────────────────────────────────────────────
  async function handleDesfazer() {
    if (!batchId) return;
    if (!confirm("Remover todas as movimentações e dívidas desta importação?")) return;
    setDesfazendo(true);
    const ok = await desfazer(batchId);
    setDesfazendo(false);
    if (ok) {
      toast.success("Importação desfeita com sucesso.");
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["dividas"] });
      reset();
      onOpenChange(false);
    }
  }

  // ── totais para o resumo ──────────────────────────────────────────────────
  const sel = itens.filter((i) => i._sel);
  const totalEntrada = sel.filter((i) => ["entrada","venda"].includes(i.tipo)).reduce((a,b) => a + b.valor, 0);
  const totalSaida   = sel.filter((i) => i.tipo === "saida").reduce((a,b) => a + b.valor, 0);
  const totalReceber = sel.filter((i) => i.tipo === "divida_a_receber").reduce((a,b) => a + b.valor, 0);
  const totalPagar   = sel.filter((i) => i.tipo === "divida_a_pagar").reduce((a,b) => a + b.valor, 0);
  const dudosos      = itens.filter((i) => i.confianca < 0.7 || !i.valor);
  const naoReconh    = itens.filter((i) => i.tipo === "outro");

  // ── filtro da aba ──────────────────────────────────────────────────────────
  const itensFiltrados = abaPreview === "dudosos" ? dudosos
    : abaPreview === "nao_reconhecidos" ? naoReconh
    : itens;

  const field = "h-12 w-full rounded-2xl border border-outline-variant/60 bg-surface px-4 text-sm text-foreground outline-none focus:border-primary transition-all";

  return (
    <Drawer open={open} onOpenChange={handleClose}>
      <DrawerContent className="rounded-t-3xl bg-surface-container-low max-w-lg mx-auto flex flex-col h-[92vh]">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-outline-variant/20 shrink-0">
          <span className="flex size-9 items-center justify-center rounded-2xl bg-secondary-container text-on-secondary-container">
            <Upload className="size-5" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-foreground">Importação Inteligente</p>
            <p className="text-[11px] text-muted-foreground">
              {etapa === "entrada" ? "Cole texto ou carregue .txt" : etapa === "preview" ? `${itens.length} itens extraídos` : "Concluído"}
            </p>
          </div>
          <button onClick={handleClose} className="p-2 rounded-full hover:bg-surface-variant/40 text-muted-foreground">
            <X className="size-4" />
          </button>
        </div>

        {/* Steps indicator */}
        <div className="flex gap-1 px-4 pt-3 pb-1 shrink-0">
          {(["entrada","preview","resultado"] as Etapa[]).map((e, i) => (
            <div key={e} className={`h-1 flex-1 rounded-full transition-all ${etapa === e ? "bg-primary" : i < ["entrada","preview","resultado"].indexOf(etapa) ? "bg-primary/40" : "bg-outline-variant/30"}`} />
          ))}
        </div>

        {/* Scroll area */}
        <div className="flex-1 overflow-y-auto">

          {/* ── ETAPA 1: ENTRADA ─────────────────────────────────────────── */}
          {etapa === "entrada" && (
            <div className="p-4 space-y-4">
              {/* Caixa destino */}
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide block mb-1.5">Caixa destino padrão</label>
                <div className="grid grid-cols-3 gap-2">
                  {CAIXAS.map((c) => (
                    <button key={c.value} type="button" onClick={() => setCaixaDestino(c.value as any)}
                      className={`h-10 rounded-2xl border-2 text-xs font-bold transition-all ${caixaDestino === c.value ? "border-primary bg-primary-container/30 text-primary" : "border-outline-variant/40 text-muted-foreground"}`}>
                      {c.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground px-1 mt-1">Usado quando a IA não identificar um caixa específico.</p>
              </div>

              {/* Textarea */}
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide block mb-1.5">Cole suas anotações aqui</label>
                <textarea
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder={"João me pagou 50 reais\nComprei material 30\nMaria deve 20 do biscoito\nVendas da doceria hoje: 3 tortinhas 15 cada"}
                  className="w-full h-52 rounded-2xl border border-outline-variant/60 bg-surface px-4 py-3 text-sm text-foreground outline-none focus:border-primary resize-none transition-all leading-relaxed"
                />
                <p className="text-[10px] text-muted-foreground px-1 mt-1">
                  {texto.split("\n").filter(l => l.trim()).length} linha(s) •{" "}
                  Aceita texto livre, listas, notas de qualquer app
                </p>
              </div>

              {/* Upload .txt */}
              <div>
                <input ref={fileRef} type="file" accept=".txt,text/plain" className="hidden" onChange={handleFile} />
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="w-full h-11 rounded-2xl border-2 border-dashed border-outline-variant/50 text-xs font-bold text-muted-foreground hover:border-primary hover:text-primary flex items-center justify-center gap-2 transition-all">
                  <Upload className="size-4" /> Carregar arquivo .txt
                </button>
              </div>

              {erro && (
                <div className="p-3 rounded-2xl bg-destructive/10 border border-destructive/30 text-xs text-destructive flex items-center gap-2">
                  <AlertTriangle className="size-4 shrink-0" /> {erro}
                </div>
              )}
            </div>
          )}

          {/* ── ETAPA 2: PREVIEW ─────────────────────────────────────────── */}
          {etapa === "preview" && (
            <div className="p-4 space-y-4">
              {/* Cards de resumo */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Entradas", value: totalEntrada, tone: "text-income", bg: "bg-income/10" },
                  { label: "Saídas",   value: totalSaida,   tone: "text-expense", bg: "bg-expense/10" },
                  { label: "A Receber",value: totalReceber, tone: "text-primary", bg: "bg-primary/10" },
                  { label: "A Pagar",  value: totalPagar,   tone: "text-amber-600", bg: "bg-amber-500/10" },
                ].map((c) => (
                  <div key={c.label} className={`rounded-2xl p-3 ${c.bg} space-y-0.5`}>
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase">{c.label}</p>
                    <p className={`text-base font-black ${c.tone}`}>{brl(c.value)}</p>
                  </div>
                ))}
              </div>

              {/* Chips de filtro */}
              <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                {([
                  { key: "todos",             label: `Todos (${itens.length})` },
                  { key: "dudosos",           label: `⚠️ Revisar (${dudosos.length})`, show: dudosos.length > 0 },
                  { key: "nao_reconhecidos",  label: `❓ Não reconhecidos (${naoReconh.length})`, show: naoReconh.length > 0 },
                ] as { key: typeof abaPreview; label: string; show?: boolean }[])
                  .filter((c) => c.show !== false)
                  .map((c) => (
                    <button key={c.key} onClick={() => setAbaPreview(c.key)}
                      className={`text-xs font-semibold h-8 shrink-0 rounded-full px-3 transition-colors ${abaPreview === c.key ? "bg-secondary-container text-on-secondary-container" : "bg-surface-container-high/60 text-muted-foreground"}`}>
                      {c.label}
                    </button>
                  ))}
              </div>

              {/* Ações em massa */}
              <div className="flex gap-2 items-center">
                <button onClick={() => setItens((p) => p.map((i) => ({ ...i, _sel: true })))}
                  className="text-xs font-bold text-primary hover:underline">Marcar todos</button>
                <span className="text-muted-foreground">•</span>
                <button onClick={() => setItens((p) => p.map((i) => ({ ...i, _sel: false })))}
                  className="text-xs font-bold text-muted-foreground hover:underline">Desmarcar todos</button>
                <span className="ml-auto text-xs text-muted-foreground">{sel.length} selecionados</span>
              </div>

              {/* Lista de itens */}
              <AnimatePresence initial={false}>
                {itensFiltrados.map((item, idx) => {
                  const realIdx = itens.indexOf(item);
                  const { icon: TIcon, label: tipoLabel, tone } = TIPOS[item.tipo] ?? TIPOS.outro;
                  const baixaConfianca = item.confianca < 0.7;
                  const dup = item.possivel_duplicata;
                  return (
                    <motion.div
                      key={`${realIdx}-${item.linha_original.slice(0, 20)}`}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ type: "spring", stiffness: 300, damping: 28, delay: (idx % 20) * 0.025 }}
                      className={`rounded-2xl border p-3 space-y-2 ${
                        !item._sel ? "opacity-50 border-outline-variant/20 bg-surface" :
                        dup ? "border-amber-400/50 bg-amber-50 dark:bg-amber-950/20" :
                        baixaConfianca ? "border-amber-300/50 bg-amber-50/60 dark:bg-amber-950/10" :
                        "border-outline-variant/20 bg-surface"
                      }`}
                    >
                      {/* Linha topo: checkbox + tipo + confiança */}
                      <div className="flex items-center gap-2">
                        <input type="checkbox" checked={item._sel}
                          onChange={(e) => editItem(realIdx, "_sel" as any, e.target.checked)}
                          className="size-4 rounded accent-primary shrink-0" />
                        <span className={`flex items-center gap-1 text-[11px] font-bold ${tone}`}>
                          <TIcon className="size-3.5" /> {tipoLabel}
                        </span>
                        {baixaConfianca && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 font-bold">confiança {Math.round(item.confianca * 100)}%</span>}
                        {dup && <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-800 font-bold">possível duplicata</span>}
                        <button onClick={() => setItens((p) => p.filter((_, i) => i !== realIdx))}
                          className="ml-auto p-1 rounded-full text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 className="size-3" />
                        </button>
                      </div>

                      {/* Campos editáveis */}
                      <div className="grid grid-cols-2 gap-1.5">
                        <div>
                          <label className="text-[10px] text-muted-foreground block mb-0.5">Descrição</label>
                          <input value={item.descricao}
                            onChange={(e) => editItem(realIdx, "descricao", e.target.value)}
                            className="h-9 w-full rounded-xl border border-outline-variant/60 bg-surface-container-high px-2.5 text-xs text-foreground outline-none focus:border-primary" />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground block mb-0.5">Valor (R$)</label>
                          <input type="number" step="0.01" value={item.valor}
                            onChange={(e) => editItem(realIdx, "valor", parseFloat(e.target.value) || 0)}
                            className="h-9 w-full rounded-xl border border-outline-variant/60 bg-surface-container-high px-2.5 text-xs text-foreground outline-none focus:border-primary" />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground block mb-0.5">Data</label>
                          <input type="date" value={item.data ?? ""}
                            onChange={(e) => editItem(realIdx, "data", e.target.value || null)}
                            className="h-9 w-full rounded-xl border border-outline-variant/60 bg-surface-container-high px-2.5 text-xs text-foreground outline-none focus:border-primary" />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground block mb-0.5">Tipo</label>
                          <select value={item.tipo}
                            onChange={(e) => editItem(realIdx, "tipo", e.target.value as ItemImportado["tipo"])}
                            className="h-9 w-full rounded-xl border border-outline-variant/60 bg-surface-container-high px-2.5 text-xs text-foreground outline-none focus:border-primary">
                            {Object.entries(TIPOS).map(([k, { label }]) => (
                              <option key={k} value={k}>{label}</option>
                            ))}
                          </select>
                        </div>
                        {(item.entidade !== null || ["divida_a_receber","divida_a_pagar","pagamento_divida"].includes(item.tipo)) && (
                          <div className="col-span-2">
                            <label className="text-[10px] text-muted-foreground block mb-0.5">Pessoa / Entidade</label>
                            <input value={item.entidade ?? ""}
                              onChange={(e) => editItem(realIdx, "entidade", e.target.value || null)}
                              className="h-9 w-full rounded-xl border border-outline-variant/60 bg-surface-container-high px-2.5 text-xs text-foreground outline-none focus:border-primary" />
                          </div>
                        )}
                      </div>

                      {/* Conta destino */}
                      <div className="flex gap-1.5 items-center">
                        <span className="text-[10px] text-muted-foreground">Caixa:</span>
                        {CAIXAS.map((c) => (
                          <button key={c.value} type="button"
                            onClick={() => editItem(realIdx, "conta_destino", c.value as any)}
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all ${item.conta_destino === c.value ? "border-primary bg-primary-container/30 text-primary" : "border-outline-variant/40 text-muted-foreground"}`}>
                            {c.label}
                          </button>
                        ))}
                        <button type="button"
                          onClick={() => editItem(realIdx, "conta_destino", null)}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all ${!item.conta_destino ? "border-primary bg-primary-container/30 text-primary" : "border-outline-variant/40 text-muted-foreground"}`}>
                          Padrão
                        </button>
                      </div>

                      {/* Texto original e obs IA */}
                      {(item.observacao_ia || item.possivel_duplicata) && (
                        <p className="text-[10px] text-amber-700 dark:text-amber-400 leading-relaxed">
                          {item.observacao_ia}
                          {item.possivel_duplicata && " ⚠️ Já pode existir no sistema."}
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground/60 italic truncate">"{item.linha_original}"</p>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {!itensFiltrados.length && (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  Nenhum item nesta aba.
                </div>
              )}

              {erro && (
                <div className="p-3 rounded-2xl bg-destructive/10 border border-destructive/30 text-xs text-destructive flex items-center gap-2">
                  <AlertTriangle className="size-4 shrink-0" /> {erro}
                </div>
              )}
            </div>
          )}

          {/* ── ETAPA 3: RESULTADO ───────────────────────────────────────── */}
          {etapa === "resultado" && resultado && (
            <div className="p-6 space-y-6 text-center">
              <div className="flex size-16 items-center justify-center rounded-full bg-income/15 mx-auto">
                <Check className="size-8 text-income" />
              </div>
              <div>
                <h2 className="text-xl font-black text-foreground">Importação concluída!</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {resultado.tx} transação(ões) e {resultado.div} dívida(s) registradas.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-income/10 space-y-1">
                  <p className="text-xs text-muted-foreground">Transações</p>
                  <p className="text-2xl font-black text-income">{resultado.tx}</p>
                </div>
                <div className="p-4 rounded-2xl bg-primary/10 space-y-1">
                  <p className="text-xs text-muted-foreground">Dívidas</p>
                  <p className="text-2xl font-black text-primary">{resultado.div}</p>
                </div>
              </div>

              {resultado.erros.length > 0 && (
                <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/40 text-left space-y-1">
                  <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
                    {resultado.erros.length} item(s) com erro:
                  </p>
                  {resultado.erros.map((e, i) => (
                    <p key={i} className="text-[11px] text-amber-700 dark:text-amber-400">{e}</p>
                  ))}
                </div>
              )}

              <button
                onClick={handleDesfazer}
                disabled={desfazendo}
                className="w-full h-11 rounded-2xl border border-destructive/40 text-destructive text-xs font-bold hover:bg-destructive/10 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                <RotateCcw className="size-4" />
                {desfazendo ? "Desfazendo…" : "Desfazer toda esta importação"}
              </button>
            </div>
          )}

        </div>{/* end scroll area */}

        {/* Footer fixo */}
        <div className="p-4 border-t border-outline-variant/10 shrink-0 space-y-2">
          {etapa === "entrada" && (
            <button onClick={handleAnalisar} disabled={loading || !texto.trim()}
              className="h-13 w-full rounded-2xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-all">
              {loading ? (
                <>
                  <div className="size-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Analisando… {progresso}%
                </>
              ) : (
                <><Sparkles className="size-5" /> Analisar com IA</>
              )}
            </button>
          )}

          {etapa === "preview" && (
            <div className="flex gap-2">
              <button onClick={() => setEtapa("entrada")} disabled={loading}
                className="h-13 flex-1 rounded-2xl border border-outline-variant text-sm font-bold text-muted-foreground disabled:opacity-50">
                ← Voltar
              </button>
              <button onClick={handleConfirmar} disabled={loading || sel.filter(i => i.tipo !== "outro").length === 0}
                className="h-13 flex-[2] rounded-2xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                {loading ? (
                  <><div className="size-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Registrando…</>
                ) : (
                  <><Check className="size-5" /> Confirmar {sel.filter(i => i.tipo !== "outro").length} itens</>
                )}
              </button>
            </div>
          )}

          {etapa === "resultado" && (
            <button onClick={() => { reset(); onOpenChange(false); }}
              className="h-13 w-full rounded-2xl bg-primary text-primary-foreground font-bold text-sm">
              Fechar
            </button>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

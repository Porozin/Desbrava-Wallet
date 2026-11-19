import { useState } from "react";
import { AlertTriangle, Trash2, Users, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { wipeAllData, wipeAllDataWithUsers } from "@/lib/data";

const CONFIRM_PHRASE = "APAGAR TUDO";

type WipeMode = "data-only" | "include-users" | null;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WipeDataDrawer({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [step, setStep] = useState<1 | 2>(1);
  const [wipeMode, setWipeMode] = useState<WipeMode>(null);
  const [typed, setTyped] = useState("");
  const [wiping, setWiping] = useState(false);

  function reset() {
    setStep(1);
    setWipeMode(null);
    setTyped("");
    setWiping(false);
  }

  function handleOpenChange(val: boolean) {
    if (!val) reset();
    onOpenChange(val);
  }

  function selectMode(mode: WipeMode) {
    setWipeMode(mode);
    setStep(2);
  }

  async function handleWipe() {
    if (typed !== CONFIRM_PHRASE) {
      toast.error(`Digite exatamente "${CONFIRM_PHRASE}" para confirmar.`);
      return;
    }
    setWiping(true);
    try {
      if (wipeMode === "include-users") {
        await wipeAllDataWithUsers();
        toast.success("Todos os dados e usuários foram removidos com sucesso.");
      } else {
        await wipeAllData();
        toast.success("Todos os dados financeiros foram removidos. Usuários preservados.");
      }
      qc.invalidateQueries();
      handleOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || "Falha ao limpar os dados.");
    } finally {
      setWiping(false);
    }
  }

  const modeLabel =
    wipeMode === "include-users"
      ? "Apagar tudo, incluindo usuários"
      : "Apagar dados, manter usuários";

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent className="rounded-t-3xl bg-surface-container-low max-w-lg mx-auto p-4">
        <DrawerHeader>
          <DrawerTitle className="text-lg font-black text-destructive flex items-center gap-2">
            <AlertTriangle className="size-5" /> Limpeza Total do Sistema
          </DrawerTitle>
        </DrawerHeader>

        {/* Step 1 — Escolha do modo */}
        {step === 1 && (
          <div className="px-2 pb-6 space-y-4">
            <p className="text-xs text-muted-foreground">
              Escolha o que deseja apagar. <strong className="text-destructive">Esta ação é irreversível.</strong>
            </p>

            {/* Opção A — manter usuários */}
            <button
              onClick={() => selectMode("data-only")}
              className="w-full text-left p-4 rounded-2xl border-2 border-orange-300/60 bg-orange-50 dark:bg-orange-950/30 hover:border-orange-500/80 transition-all space-y-1.5"
            >
              <div className="flex items-center gap-2">
                <Trash2 className="size-5 text-orange-600 dark:text-orange-400" />
                <span className="text-sm font-bold text-orange-800 dark:text-orange-300">
                  Apagar dados, manter usuários
                </span>
              </div>
              <ul className="text-xs text-orange-700 dark:text-orange-400 list-disc ml-6 space-y-0.5">
                <li>Todas as transações e movimentações</li>
                <li>Metas, dívidas, materiais, produtos e avarias</li>
                <li>Reservas e logs de auditoria</li>
              </ul>
              <p className="text-xs font-semibold text-orange-800 dark:text-orange-300 mt-1">
                ✅ Usuários, perfis e cargos são preservados.
              </p>
            </button>

            {/* Opção B — incluir usuários */}
            <button
              onClick={() => selectMode("include-users")}
              className="w-full text-left p-4 rounded-2xl border-2 border-destructive/50 bg-destructive/8 dark:bg-red-950/40 hover:border-destructive transition-all space-y-1.5"
            >
              <div className="flex items-center gap-2">
                <ShieldAlert className="size-5 text-destructive" />
                <span className="text-sm font-bold text-destructive">
                  Apagar tudo, incluindo usuários
                </span>
              </div>
              <ul className="text-xs text-destructive/80 list-disc ml-6 space-y-0.5">
                <li>Tudo da opção acima, mais:</li>
                <li>Todas as contas de usuário</li>
                <li>Perfis e permissões de acesso</li>
              </ul>
              <p className="text-xs font-semibold text-destructive mt-1">
                ⚠️ O sistema ficará vazio e bloqueado até novo cadastro.
              </p>
            </button>

            <button
              onClick={() => handleOpenChange(false)}
              className="h-10 w-full rounded-2xl bg-surface-container-high text-foreground font-semibold text-sm"
            >
              Cancelar
            </button>
          </div>
        )}

        {/* Step 2 — Confirmação por digitação */}
        {step === 2 && (
          <div className="px-2 pb-6 space-y-4">
            <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/30 space-y-1">
              <p className="text-sm font-bold text-destructive">
                {wipeMode === "include-users" ? (
                  <span className="flex items-center gap-1.5"><Users className="size-4" /> {modeLabel}</span>
                ) : (
                  <span className="flex items-center gap-1.5"><Trash2 className="size-4" /> {modeLabel}</span>
                )}
              </p>
              <p className="text-xs text-foreground/80">
                Para confirmar, digite exatamente:
              </p>
              <p className="text-center text-lg font-black text-destructive my-2 tracking-wider">
                {CONFIRM_PHRASE}
              </p>
            </div>

            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={`Digite "${CONFIRM_PHRASE}" aqui`}
              className="h-14 w-full rounded-2xl border-2 border-destructive/50 bg-surface px-4 text-sm text-center font-bold tracking-wider outline-none focus:border-destructive"
              autoFocus
              autoComplete="off"
              spellCheck={false}
            />

            <button
              onClick={handleWipe}
              disabled={typed !== CONFIRM_PHRASE || wiping}
              className="h-12 w-full rounded-2xl bg-destructive text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash2 className="size-4" />
              {wiping ? "Apagando…" : "Confirmar Exclusão Permanente"}
            </button>

            <button
              onClick={() => { setStep(1); setTyped(""); }}
              className="h-10 w-full rounded-2xl bg-surface-container-high text-foreground font-semibold text-sm"
            >
              ← Voltar
            </button>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}

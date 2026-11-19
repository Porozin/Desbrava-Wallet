import { useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { wipeAllData } from "@/lib/data";

const CONFIRM_PHRASE = "APAGAR TUDO";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WipeDataDrawer({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [step, setStep] = useState<1 | 2>(1);
  const [typed, setTyped] = useState("");
  const [wiping, setWiping] = useState(false);

  function reset() {
    setStep(1);
    setTyped("");
    setWiping(false);
  }

  function handleOpenChange(val: boolean) {
    if (!val) reset();
    onOpenChange(val);
  }

  async function handleWipe() {
    if (typed !== CONFIRM_PHRASE) {
      toast.error(`Digite exatamente "${CONFIRM_PHRASE}" para confirmar.`);
      return;
    }
    setWiping(true);
    try {
      await wipeAllData();
      toast.success("Todos os dados financeiros foram removidos com sucesso.");
      qc.invalidateQueries();
      handleOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || "Falha ao limpar os dados.");
    } finally {
      setWiping(false);
    }
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent className="rounded-t-3xl bg-surface-container-low max-w-lg mx-auto p-4">
        <DrawerHeader>
          <DrawerTitle className="text-lg font-black text-destructive flex items-center gap-2">
            <AlertTriangle className="size-5" /> Apagar Todos os Dados
          </DrawerTitle>
        </DrawerHeader>

        {step === 1 && (
          <div className="px-4 pb-6 space-y-4">
            <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/30 space-y-2">
              <p className="text-sm font-bold text-destructive">⚠️ ATENÇÃO: Esta ação é irreversível!</p>
              <p className="text-xs text-foreground/80">
                Os seguintes dados serão <strong>permanentemente removidos</strong>:
              </p>
              <ul className="text-xs text-foreground/70 list-disc ml-4 space-y-0.5">
                <li>Todas as transações e movimentações</li>
                <li>Todas as metas financeiras</li>
                <li>Todas as dívidas e controle interno</li>
                <li>Todos os materiais do almoxarifado</li>
                <li>Todos os produtos e receitas</li>
                <li>Todas as avarias registradas</li>
              </ul>
              <p className="text-xs text-foreground/80 mt-2">
                <strong>Serão preservados:</strong> usuários, perfis e permissões (cargos).
              </p>
            </div>

            <button
              onClick={() => setStep(2)}
              className="h-12 w-full rounded-2xl bg-destructive text-white font-bold text-sm flex items-center justify-center gap-2"
            >
              <Trash2 className="size-4" /> Entendi, quero continuar
            </button>
            <button
              onClick={() => handleOpenChange(false)}
              className="h-10 w-full rounded-2xl bg-surface-container-high text-foreground font-semibold text-sm"
            >
              Cancelar
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="px-4 pb-6 space-y-4">
            <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/30">
              <p className="text-sm font-bold text-destructive mb-2">
                Confirmação Final — Passo 2 de 2
              </p>
              <p className="text-xs text-foreground/80">
                Para confirmar a exclusão, digite exatamente:
              </p>
              <p className="text-center text-lg font-black text-destructive my-3 tracking-wider">
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
              onClick={() => handleOpenChange(false)}
              className="h-10 w-full rounded-2xl bg-surface-container-high text-foreground font-semibold text-sm"
            >
              Cancelar
            </button>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}


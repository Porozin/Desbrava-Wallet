import { Smartphone, X } from "lucide-react";
import { useState } from "react";
import { usePwaInstall } from "@/hooks/usePwaInstall";

export function PwaInstallBanner() {
  const { canInstall, install } = usePwaInstall();
  const [dismissed, setDismissed] = useState(false);

  if (!canInstall || dismissed) return null;

  return (
    <div className="rounded-3xl bg-primary-container text-on-primary-container p-4 flex items-center gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
        <Smartphone className="size-5" />
      </span>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold leading-tight">Instalar GDACaixa</p>
        <p className="text-xs opacity-80 mt-0.5">
          Adicione à tela inicial para acesso rápido e modo offline.
        </p>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={install}
          className="h-8 px-3 rounded-full bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all"
        >
          Instalar
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="p-1.5 rounded-full hover:bg-on-primary-container/10 transition-all"
          aria-label="Dispensar"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}

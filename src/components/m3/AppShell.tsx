import { Link, useLocation } from "@tanstack/react-router";
import { Home, Landmark, Cake, Zap, UserCircle2, type LucideIcon, Wifi, WifiOff, Sparkles, Moon, Sun } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { motion, AnimatePresence, MotionConfig } from "motion/react";
import { cn } from "@/lib/utils";
import { BottomNav } from "./BottomNav";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useTheme } from "@/hooks/useTheme";
import { AtlasAiDrawer } from "./AtlasAiDrawer";

const NAV: { to: "/" | "/clube" | "/doceria" | "/vendas" | "/mais"; label: string; icon: LucideIcon }[] = [
  { to: "/", label: "Início", icon: Home },
  { to: "/clube", label: "Clube", icon: Landmark },
  { to: "/doceria", label: "Doceria", icon: Cake },
  { to: "/vendas", label: "Vendas", icon: Zap },
  { to: "/mais", label: "Perfil", icon: UserCircle2 },
];

export function AppShell({ title, children, fab }: { title: string; children: ReactNode; fab?: ReactNode }) {
  const { pathname } = useLocation();
  const online = useOnlineStatus();
  const { isDark, toggle } = useTheme();
  const [atlasOpen, setAtlasOpen] = useState(false);
  return (
    <MotionConfig reducedMotion="user">
    <div className="min-h-dvh bg-surface lg:pl-24 transition-colors">
      {/* Navigation rail (expanded screens) */}
      <nav aria-label="Navegação Lateral" className="fixed inset-y-0 left-0 z-30 hidden w-24 flex-col items-center gap-3 bg-surface-container-low pt-8 border-r border-outline-variant/20 lg:flex">
        {NAV.map((n) => {
          const active = n.to === "/" ? pathname === "/" : pathname.startsWith(n.to);
          return (
            <Link
              key={n.to}
              to={n.to}
              aria-current={active ? "page" : undefined}
              className="flex min-h-16 flex-col items-center justify-center gap-1 group w-full"
            >
              <span className="relative flex h-8 w-16 items-center justify-center rounded-full">
                {active && (
                  <motion.span
                    layoutId="nav-indicator"
                    className="absolute inset-0 rounded-full bg-secondary-container shadow-xs"
                    style={{ borderRadius: 9999 }}
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <n.icon
                  className={cn(
                    "relative size-5 transition-colors duration-200",
                    active ? "text-on-secondary-container" : "text-muted-foreground group-hover:text-foreground"
                  )}
                  strokeWidth={active ? 2.4 : 1.8}
                />
              </span>
              <span className={cn("text-xs transition-colors", active ? "font-bold text-foreground" : "font-medium text-muted-foreground")}>{n.label}</span>
            </Link>
          );
        })}
      </nav>

      <header className="sticky top-0 z-20 bg-surface/90 px-4 pb-3 pt-5 backdrop-blur-md border-b border-outline-variant/10">
        <div className="flex items-center justify-between">
          <p className="label-medium text-muted-foreground">Guerreiros do Alto</p>
          <div className="flex items-center gap-2">
            {/* Toggle Dark/Light */}
            <motion.button
              onClick={toggle}
              whileTap={{ scale: 0.9 }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
              aria-label={isDark ? "Mudar para modo claro" : "Mudar para modo escuro"}
              className="flex size-8 items-center justify-center rounded-full bg-surface-container-high text-muted-foreground hover:bg-surface-variant/50 transition-colors"
            >
              <AnimatePresence mode="wait" initial={false}>
                {isDark ? (
                  <motion.span key="sun"
                    initial={{ rotate: -60, opacity: 0, scale: 0.7 }}
                    animate={{ rotate: 0, opacity: 1, scale: 1 }}
                    exit={{ rotate: 60, opacity: 0, scale: 0.7 }}
                    transition={{ duration: 0.18 }}
                  >
                    <Sun className="size-4" />
                  </motion.span>
                ) : (
                  <motion.span key="moon"
                    initial={{ rotate: 60, opacity: 0, scale: 0.7 }}
                    animate={{ rotate: 0, opacity: 1, scale: 1 }}
                    exit={{ rotate: -60, opacity: 0, scale: 0.7 }}
                    transition={{ duration: 0.18 }}
                  >
                    <Moon className="size-4" />
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>

            {/* Botão Atlas AI */}
            <motion.button
              onClick={() => setAtlasOpen(true)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.93 }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
              className="flex items-center gap-1.5 h-8 px-3 rounded-full bg-primary/10 text-primary text-[11px] font-bold hover:bg-primary/20 transition-colors"
              title="Abrir Atlas AI"
            >
              <Sparkles className="size-3.5" />
              <span>Atlas AI</span>
            </motion.button>
            {/* Chip Online/Offline */}
            <span
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all",
                online
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
              )}
            >
              {online ? (
                <><Wifi className="size-3" /> Online</>
              ) : (
                <><WifiOff className="size-3" /> Offline</>
              )}
            </span>
          </div>
        </div>
        <h1 className="headline-small font-black tracking-tight">{title}</h1>
      </header>

      <motion.main
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="mx-auto max-w-3xl space-y-4 px-4 pb-32 lg:pb-12 pt-3"
      >
        {children}
      </motion.main>

      {fab && <div className="fixed bottom-24 right-4 z-40 lg:bottom-6 lg:right-6">{fab}</div>}

      {/* Bottom navigation bar (compact screens) */}
      <BottomNav />

      {/* Atlas AI */}
      <AtlasAiDrawer open={atlasOpen} onOpenChange={setAtlasOpen} />
    </div>
    </MotionConfig>
  );
}

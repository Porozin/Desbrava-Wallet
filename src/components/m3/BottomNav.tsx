import React, { useState, useEffect } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { Home, Landmark, ShoppingCart, UserCircle2 } from "lucide-react";
import { motion } from "motion/react";
import { supabase } from "@/integrations/supabase/client";

interface NavItem {
  to: "/" | "/caixas" | "/vendas" | "/mais";
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { to: "/",       label: "Início",  icon: Home },
  { to: "/caixas", label: "Caixas",  icon: Landmark },
  { to: "/vendas", label: "Vendas",  icon: ShoppingCart },
  { to: "/mais",   label: "Perfil",  icon: UserCircle2 },
];

function PendingBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;

    const fetchCount = async () => {
      try {
        const { count: c } = await supabase
          .from("transactions")
          .select("id", { count: "exact", head: true })
          .filter("status", "eq", "pendente");
        if (active) setCount(c ?? 0);
      } catch {
        // silent
      }
    };

    fetchCount();

    const channel = supabase
      .channel("pending-badge-nav")
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, fetchCount)
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  if (count === 0) return null;

  return (
    <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-destructive text-white text-[9px] font-black">
      {count > 9 ? "9+" : count}
    </span>
  );
}

export const BottomNav: React.FC = () => {
  const { pathname } = useLocation();

  return (
    <nav
      aria-label="Navegação Principal"
      className="fixed bottom-0 left-0 right-0 z-50 h-20 bg-surface-container border-t border-outline-variant/15 flex items-center justify-around px-2 pb-[env(safe-area-inset-bottom)] lg:hidden transition-colors"
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
        const showBadge = item.to === "/mais";

        return (
          <Link
            key={item.to}
            to={item.to}
            aria-current={isActive ? "page" : undefined}
            className="flex flex-col items-center justify-center flex-1 py-1 group focus:outline-none"
          >
            <div className="relative">
              <div className="relative flex items-center justify-center w-16 h-8 rounded-full">
                {isActive && (
                  <motion.span
                    layoutId="tab-pill"
                    className="absolute inset-0 rounded-full bg-secondary-container"
                    style={{ borderRadius: 9999 }}
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <Icon
                  className={`relative w-5 h-5 transition-colors duration-150 ${
                    isActive
                      ? "text-on-secondary-container"
                      : "text-on-surface-variant group-hover:text-foreground"
                  }`}
                />
              </div>
              {showBadge && <PendingBadge />}
            </div>
            <span
              className={`text-[11px] font-semibold mt-1 transition-colors ${
                isActive ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
};

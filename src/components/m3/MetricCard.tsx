import React from "react";
import { motion, AnimatePresence } from "motion/react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon?: LucideIcon;
  variant?: "elevated" | "filled" | "outlined" | "primary" | "tertiary";
  tone?: "income" | "expense" | "neutral";
}

const variantStyles: Record<NonNullable<MetricCardProps["variant"]>, string> = {
  elevated:  "bg-surface-container-low elevation-1",
  filled:    "bg-surface-container-highest/60 elevation-1",
  outlined:  "bg-surface border border-outline-variant",
  primary:   "bg-primary-container text-on-primary-container elevation-3",
  tertiary:  "bg-tertiary-container text-on-tertiary-container elevation-3",
};

const toneClass: Record<NonNullable<MetricCardProps["tone"]>, string> = {
  income:  "text-income",
  expense: "text-expense",
  neutral: "",
};

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = "elevated",
  tone = "neutral",
}) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ type: "spring", stiffness: 320, damping: 26 }}
    className={cn("rounded-3xl p-5 flex flex-col justify-between", variantStyles[variant])}
  >
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] font-bold uppercase tracking-widest opacity-55">
        {title}
      </span>
      {Icon && (
        <div className="p-2 rounded-2xl bg-surface-container-highest/60">
          <Icon className="w-5 h-5" />
        </div>
      )}
    </div>

    <div className="mt-3">
      <AnimatePresence mode="wait">
        <motion.div
          key={value}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ type: "tween", duration: 0.18 }}
          className={cn("text-2xl font-black tracking-tight", toneClass[tone])}
        >
          {value}
        </motion.div>
      </AnimatePresence>

      {subtitle && (
        <p className="text-xs mt-1 opacity-60">{subtitle}</p>
      )}
    </div>
  </motion.div>
);

import { useState, useEffect, useCallback } from "react";

type Theme = "light" | "dark";

// Singleton: mantém o estado fora do React para sobreviver re-renders
let _listeners: Array<(t: Theme) => void> = [];
let _current: Theme = "light";

function readStored(): Theme {
  if (typeof window === "undefined") return "light";
  const saved = localStorage.getItem("gda_theme") as Theme | null;
  if (saved === "dark" || saved === "light") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyClass(theme: Theme) {
  if (typeof document === "undefined") return;
  if (theme === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

// Inicializa uma vez quando o módulo carrega no browser
if (typeof window !== "undefined") {
  _current = readStored();
  applyClass(_current);
}

function setGlobalTheme(theme: Theme) {
  _current = theme;
  applyClass(theme);
  localStorage.setItem("gda_theme", theme);
  _listeners.forEach((fn) => fn(theme));
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    // SSR-safe: retorna "light" no servidor, lê real no cliente
    if (typeof window === "undefined") return "light";
    return _current;
  });

  useEffect(() => {
    // Sincroniza com o singleton ao montar
    setTheme(_current);

    // Registra listener para receber atualizações de outros componentes
    const listener = (t: Theme) => setTheme(t);
    _listeners.push(listener);
    return () => {
      _listeners = _listeners.filter((l) => l !== listener);
    };
  }, []);

  const toggle = useCallback(() => {
    setGlobalTheme(_current === "dark" ? "light" : "dark");
  }, []);

  return { theme, toggle, isDark: theme === "dark" };
}

import { useEffect, useCallback, useSyncExternalStore } from "react";

type Theme = "light" | "dark";

let _theme: Theme = "light";
const _subs = new Set<() => void>();

function notify() { _subs.forEach((fn) => fn()); }
function getSnapshot(): Theme { return _theme; }
function getServerSnapshot(): Theme { return "light"; }

function applyClass(t: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", t === "dark");
}

export function setTheme(t: Theme) {
  if (_theme === t) return;
  _theme = t;
  applyClass(t);
  try { localStorage.setItem("gda_theme", t); } catch {}
  notify();
}

export function useTheme() {
  const theme = useSyncExternalStore(
    (cb) => { _subs.add(cb); return () => _subs.delete(cb); },
    getSnapshot,
    getServerSnapshot,
  );

  useEffect(() => {
    try {
      const saved = localStorage.getItem("gda_theme") as Theme | null;
      const resolved: Theme =
        saved === "dark" || saved === "light"
          ? saved
          : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
      setTheme(resolved);
    } catch {}
  }, []);

  const toggle = useCallback(() => {
    setTheme(_theme === "dark" ? "light" : "dark");
  }, []);

  return { theme, toggle, isDark: theme === "dark" };
}

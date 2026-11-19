/**
 * Feedback háptico via navigator.vibrate com fallback seguro.
 * Não quebra em dispositivos que não suportam a API.
 */

type HapticPattern = "light" | "success" | "error" | "heavy";

const PATTERNS: Record<HapticPattern, number | number[]> = {
  light:   15,
  success: [15, 30, 15],
  error:   [50, 30, 50],
  heavy:   60,
};

export function useHaptic() {
  function vibrate(pattern: HapticPattern = "light") {
    try {
      navigator.vibrate?.(PATTERNS[pattern]);
    } catch {
      // Silencioso — háptico é enhancement, não requisito
    }
  }

  return { vibrate };
}

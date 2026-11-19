import { supabase } from "@/integrations/supabase/client";

export const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias em milissegundos (604.800.000 ms)
export const GDA_SESSION_START_KEY = "gda_session_started_at";

export interface SessionStatus {
  valid: boolean;
  expired: boolean;
  daysRemaining?: number;
}

/**
 * Registra o timestamp inicial de login para contagem da janela de 7 dias.
 */
export function recordLoginSession(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(GDA_SESSION_START_KEY, String(Date.now()));
  } catch (err) {
    console.warn("[AuthSession] Erro ao gravar timestamp de sessão:", err);
  }
}

/**
 * Limpa o timestamp de sessão ao sair.
 */
export function clearLoginSession(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(GDA_SESSION_START_KEY);
  } catch (err) {
    console.warn("[AuthSession] Erro ao limpar timestamp de sessão:", err);
  }
}

/**
 * Valida se a sessão do usuário ainda está dentro do limite estrito de 7 dias.
 * Se tiver ultrapassado 7 dias, faz logout imediato e retorna expired: true.
 */
export async function validateSevenDaySession(): Promise<SessionStatus> {
  if (typeof window === "undefined") return { valid: true, expired: false };

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session;

    if (!session?.user) {
      clearLoginSession();
      return { valid: false, expired: false };
    }

    const rawTimestamp = localStorage.getItem(GDA_SESSION_START_KEY);

    // Se o usuário já está logado mas o timestamp ainda não foi gravado (primeiro acesso pós-update),
    // inicia a contagem de 7 dias a partir deste momento.
    if (!rawTimestamp) {
      recordLoginSession();
      return { valid: true, expired: false, daysRemaining: 7 };
    }

    const sessionStart = Number(rawTimestamp);
    if (isNaN(sessionStart) || sessionStart <= 0) {
      recordLoginSession();
      return { valid: true, expired: false, daysRemaining: 7 };
    }

    const elapsed = Date.now() - sessionStart;

    if (elapsed > SESSION_MAX_AGE_MS) {
      // Sessão atingiu ou ultrapassou o limite de 7 dias!
      console.warn(`[AuthSession] Sessão expirou após 7 dias (${(elapsed / 864e5).toFixed(1)} dias). Desconectando...`);
      clearLoginSession();
      await supabase.auth.signOut();
      return { valid: false, expired: true };
    }

    const daysRemaining = Math.max(1, Math.ceil((SESSION_MAX_AGE_MS - elapsed) / 864e5));
    return { valid: true, expired: false, daysRemaining };
  } catch (err) {
    console.error("[AuthSession] Erro ao validar tempo de sessão:", err);
    return { valid: true, expired: false };
  }
}


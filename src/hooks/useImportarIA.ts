import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ItemImportado {
  tipo: "venda" | "entrada" | "saida" | "divida_a_receber" | "divida_a_pagar" | "pagamento_divida" | "outro";
  data: string | null;
  valor: number;
  descricao: string;
  entidade: string | null;
  categoria: string | null;
  conta_destino: "geral" | "doceria" | "vendas" | null;
  confianca: number;
  linha_original: string;
  observacao_ia: string | null;
  possivel_duplicata?: boolean;
}

export interface AnaliseResult {
  itens: ItemImportado[];
  total: number;
  chunks_processados: number;
  erros_chunks: { chunk: number; erro: string }[];
  entidades_existentes: string[];
}

export interface ConfirmarResult {
  success: boolean;
  batch_id: string;
  transacoes_criadas: number;
  dividas_criadas: number;
  erros: string[];
}

async function getFunctionUrl(name: string): Promise<string> {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "zobvontvydujhtdbaogw";
  return `https://${projectId}.supabase.co/functions/v1/${name}`;
}

async function getAuthHeader(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return `Bearer ${data.session?.access_token ?? ""}`;
}

export function useImportarIA() {
  const [loading, setLoading]     = useState(false);
  const [progresso, setProgresso] = useState(0);  // 0-100
  const [erro, setErro]           = useState<string | null>(null);

  const analisar = useCallback(async (texto: string): Promise<AnaliseResult | null> => {
    setLoading(true);
    setErro(null);
    setProgresso(10);
    try {
      const url    = await getFunctionUrl("importar-ia/analisar");
      const header = await getAuthHeader();
      setProgresso(30);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: header },
        body: JSON.stringify({ texto }),
      });
      setProgresso(80);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `Erro ${res.status}`);
      setProgresso(100);
      return data as AnaliseResult;
    } catch (e: any) {
      setErro(e?.message ?? "Falha na análise.");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const confirmar = useCallback(async (
    itens: ItemImportado[],
    texto_original: string,
    cash_box_id?: "geral" | "doceria" | "vendas",
  ): Promise<ConfirmarResult | null> => {
    setLoading(true);
    setErro(null);
    setProgresso(10);
    try {
      const url    = await getFunctionUrl("importar-ia/confirmar");
      const header = await getAuthHeader();
      setProgresso(40);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: header },
        body: JSON.stringify({ itens, texto_original, cash_box_id }),
      });
      setProgresso(90);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `Erro ${res.status}`);
      setProgresso(100);
      return data as ConfirmarResult;
    } catch (e: any) {
      setErro(e?.message ?? "Falha ao confirmar importação.");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const desfazer = useCallback(async (batch_id: string): Promise<boolean> => {
    setLoading(true);
    setErro(null);
    try {
      const url    = await getFunctionUrl("importar-ia/desfazer");
      const header = await getAuthHeader();
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: header },
        body: JSON.stringify({ batch_id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `Erro ${res.status}`);
      return true;
    } catch (e: any) {
      setErro(e?.message ?? "Falha ao desfazer importação.");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { analisar, confirmar, desfazer, loading, progresso, erro };
}

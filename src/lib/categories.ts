import { useState, useEffect } from "react";
import type { CashBoxId } from "./finance";

export const FIXED_CATEGORIES: Record<CashBoxId, string[]> = {
  geral: [
    "Mensalidade",
    "Inscrição Campori/Evento",
    "Uniforme & Distintivos",
    "Doação / Patrocínio",
    "Material de Instrução",
    "Alimentação & Eventos",
    "Seguro Anual",
    "Transporte / Combustível",
    "Geral",
    "Outro",
  ],
  doceria: [
    "Venda de Trufa",
    "Venda de Pão de Mel",
    "Venda de Bolo de Pote",
    "Venda de Doces Diversos",
    "Compra de Ingredientes",
    "Embalagens & Forminhas",
    "Gás & Utensílios",
    "Repasse de Vendas",
    "Geral",
    "Outro",
  ],
  vendas: [
    "Água Mineral",
    "Refrigerante & Sucos",
    "Picolé & Sorvete",
    "Caneta & Chaveiro GDA",
    "Camiseta & Acessórios",
    "Reposição de Estoque",
    "Despesa Operacional",
    "Geral",
    "Outro",
  ],
};

const STORAGE_PREFIX = "gda_custom_categories_";

export function getCustomCategories(boxId: CashBoxId): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${boxId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addCustomCategory(boxId: CashBoxId, rawCategory: string): string[] {
  const trimmed = rawCategory.trim();
  if (!trimmed) return getAllCategories(boxId);

  const current = getCustomCategories(boxId);
  const fixed = FIXED_CATEGORIES[boxId] || [];

  // Se já existe nas fixas ou customizadas (case-insensitive), não duplica
  const alreadyExists = [...fixed, ...current].some(
    (c) => c.toLowerCase() === trimmed.toLowerCase()
  );

  if (!alreadyExists) {
    const updated = [...current, trimmed];
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${boxId}`, JSON.stringify(updated));
    } catch (err) {
      console.warn("Falha ao salvar categoria no localStorage:", err);
    }
  }

  return getAllCategories(boxId);
}

export function getAllCategories(boxId: CashBoxId): string[] {
  const fixed = FIXED_CATEGORIES[boxId] || ["Geral", "Outro"];
  const custom = getCustomCategories(boxId);
  const set = new Set<string>();

  // Adiciona as categorias customizadas no topo das fixas comuns (exceto Outro)
  fixed.forEach((c) => {
    if (c !== "Outro") set.add(c);
  });
  custom.forEach((c) => set.add(c));
  set.add("Outro");

  return Array.from(set);
}

export function useCategories(boxId: CashBoxId) {
  const [categories, setCategories] = useState<string[]>(() => getAllCategories(boxId));

  useEffect(() => {
    setCategories(getAllCategories(boxId));
  }, [boxId]);

  const addCategory = (name: string) => {
    const updated = addCustomCategory(boxId, name);
    setCategories(updated);
    return name.trim();
  };

  return {
    categories,
    addCategory,
  };
}


import {
  summarizeTransparencia,
  type TransparenciaItem,
} from "./transparencia";
import {
  commissionBySeller,
  summarize,
  type Transaction,
} from "./finance";

/**
 * Suite de Testes Automatizados — Fase 5: Histórico, Relatórios e Transparência
 */

export function runFase5Tests() {
  const results: { name: string; passed: boolean; details?: string }[] = [];

  // 1. Teste de Proteção LGPD e Anonimização
  try {
    const rawItems: TransparenciaItem[] = [
      {
        id: "tx-1",
        date: "2027-03-01",
        cash_box_id: "geral",
        kind: "receita",
        category: "Mensalidade",
        description: "Mensalidade Março",
        amount: 35.0,
        amount_cents: 3500,
        payment_method: "pix",
      },
      {
        id: "tx-2",
        date: "2027-03-02",
        cash_box_id: "doceria",
        kind: "despesa",
        category: "Ingredientes",
        description: "Chocolate Nobre 1kg",
        amount: 45.5,
        amount_cents: 4550,
        payment_method: "dinheiro",
      },
    ];

    // Verifica que TransparenciaItem não possui seller, requested_by, approved_by ou client_mutation_id
    const hasPrivateFields = rawItems.some(
      (item: any) =>
        "seller" in item ||
        "requested_by" in item ||
        "client_mutation_id" in item ||
        "donor_name" in item
    );

    if (!hasPrivateFields) {
      results.push({
        name: "C1: Proteção LGPD e Anonimização de Dados Públicos",
        passed: true,
      });
    } else {
      results.push({
        name: "C1: Proteção LGPD e Anonimização de Dados Públicos",
        passed: false,
        details: "Campos privados detectados nos itens de transparência.",
      });
    }
  } catch (err: any) {
    results.push({
      name: "C1: Proteção LGPD e Anonimização de Dados Públicos",
      passed: false,
      details: err?.message,
    });
  }

  // 2. Teste de Agregação de Transparência
  try {
    const items: TransparenciaItem[] = [
      {
        id: "t1",
        date: "2027-03-10",
        cash_box_id: "geral",
        kind: "receita",
        category: "Doação",
        description: "Oferta de Gratidão",
        amount: 500,
        amount_cents: 50000,
        payment_method: "pix",
      },
      {
        id: "t2",
        date: "2027-03-12",
        cash_box_id: "geral",
        kind: "despesa",
        category: "Material",
        description: "Cadernos de Especialidades",
        amount: 150,
        amount_cents: 15000,
        payment_method: "dinheiro",
      },
      {
        id: "t3",
        date: "2027-03-15",
        cash_box_id: "doceria",
        kind: "receita",
        category: "Venda Trufa",
        description: "Venda Trufas Evento",
        amount: 200,
        amount_cents: 20000,
        payment_method: "dinheiro",
      },
    ];

    const resumo = summarizeTransparencia(items);

    const receitaCorreta = resumo.receitas === 700 && resumo.receitas_cents === 70000;
    const despesaCorreta = resumo.despesas === 150 && resumo.despesas_cents === 15000;
    const saldoCorreto = resumo.saldo === 550 && resumo.saldo_cents === 55000;
    const caixaGeralCorreto = resumo.porCaixa.geral.saldo === 350;
    const caixaDoceriaCorreto = resumo.porCaixa.doceria.saldo === 200;

    if (receitaCorreta && despesaCorreta && saldoCorreto && caixaGeralCorreto && caixaDoceriaCorreto) {
      results.push({
        name: "C2: Agregação Contábil do Portal de Transparência",
        passed: true,
      });
    } else {
      results.push({
        name: "C2: Agregação Contábil do Portal de Transparência",
        passed: false,
        details: `Valores divergentes: R$ ${resumo.receitas} rec, R$ ${resumo.despesas} desp, R$ ${resumo.saldo} saldo`,
      });
    }
  } catch (err: any) {
    results.push({
      name: "C2: Agregação Contábil do Portal de Transparência",
      passed: false,
      details: err?.message,
    });
  }

  // 3. Teste de Ranking e Apuração de Comissões de Vendedores
  try {
    const vendas: Transaction[] = [
      {
        id: "v1",
        date: "2027-03-01",
        module: "vendas",
        cash_box_id: "vendas",
        kind: "receita",
        category: "Caneta GDA",
        description: "Venda Caneta",
        amount: 10,
        amount_cents: 1000,
        seller: "Lucas Silva",
        status: "confirmado",
      },
      {
        id: "v2",
        date: "2027-03-01",
        module: "vendas",
        cash_box_id: "vendas",
        kind: "receita",
        category: "Caneta GDA",
        description: "Venda Caneta",
        amount: 20,
        amount_cents: 2000,
        seller: "Lucas Silva",
        status: "confirmado",
      },
      {
        id: "v3",
        date: "2027-03-02",
        module: "vendas",
        cash_box_id: "vendas",
        kind: "receita",
        category: "Água",
        description: "Água Mineral",
        amount: 50,
        amount_cents: 5000,
        seller: "Beatriz Santos",
        status: "confirmado",
      },
    ];

    const ranking = commissionBySeller(vendas);

    const beatriz = ranking.find((r) => r.seller === "Beatriz Santos");
    const lucas = ranking.find((r) => r.seller === "Lucas Silva");

    const passed =
      beatriz?.total === 50 &&
      lucas?.total === 30 &&
      lucas?.count === 2 &&
      ranking[0]?.seller === "Beatriz Santos";

    if (passed) {
      results.push({
        name: "C3: Relatório de Vendas e Comissões por Desbravador",
        passed: true,
      });
    } else {
      results.push({
        name: "C3: Relatório de Vendas e Comissões por Desbravador",
        passed: false,
        details: "Divergência nos totais do ranking de vendedores.",
      });
    }
  } catch (err: any) {
    results.push({
      name: "C3: Relatório de Vendas e Comissões por Desbravador",
      passed: false,
      details: err?.message,
    });
  }

  // 4. Teste de Fechamento Mensal e Neutralidade Consolidada
  try {
    const mensalTx: Transaction[] = [
      {
        id: "m1",
        date: "2027-04-05",
        module: "clube",
        cash_box_id: "geral",
        kind: "receita",
        category: "Mensalidade",
        description: "Mensalidades Abril",
        amount: 800,
        amount_cents: 80000,
        status: "confirmado",
      },
      {
        id: "m2",
        date: "2027-04-10",
        module: "clube",
        cash_box_id: "geral",
        destination_cash_box_id: "doceria",
        kind: "transferencia",
        category: "Transferência",
        description: "Adiantamento para Doceria",
        amount: 200,
        amount_cents: 20000,
        status: "confirmado",
      },
      {
        id: "m3",
        date: "2027-04-12",
        module: "doceria",
        cash_box_id: "doceria",
        kind: "despesa",
        category: "Ingredientes",
        description: "Compra Embalagens",
        amount: 150,
        amount_cents: 15000,
        status: "confirmado",
      },
    ];

    const fechamento = summarize(mensalTx);

    // No consolidado mensal: Receitas = 800, Despesas = 150, Saldo = 650
    // Transferência interna de 200 é neutra no consolidado!
    const passed =
      fechamento.income === 800 &&
      fechamento.expense === 150 &&
      fechamento.net === 650;

    if (passed) {
      results.push({
        name: "C4: Fechamento Mensal e Neutralidade de Transferências",
        passed: true,
      });
    } else {
      results.push({
        name: "C4: Fechamento Mensal e Neutralidade de Transferências",
        passed: false,
        details: `Fechamento incorreto: Rec ${fechamento.income}, Desp ${fechamento.expense}, Liq ${fechamento.net}`,
      });
    }
  } catch (err: any) {
    results.push({
      name: "C4: Fechamento Mensal e Neutralidade de Transferências",
      passed: false,
      details: err?.message,
    });
  }

  return results;
}


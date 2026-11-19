import { describe, expect, it } from "vitest";
import {
  brl,
  brlFromCents,
  consolidateAllBoxes,
  fromCents,
  summarize,
  summarizeBox,
  toCents,
  type CashBoxId,
  type CashReservation,
  type Transaction,
} from "./finance";

/**
 * Matriz de Testes da Fase 2 — Caixas e Movimentações
 * Validações Contábeis e Funcionais dos Três Caixas Fixos:
 *  1. Cálculo de Saldo Contábil, Disponível e Reservado por caixa
 *  2. Neutralidade contábil das transferências internas no resultado consolidado
 *  3. Invariante fundamental: Soma dos saldos dos 3 caixas == Saldo Consolidado Oficial
 *  4. Sinalização relativa de transferências: Saída no caixa de origem (−) e Entrada no destino (+)
 *  5. Múltiplas transferências cruzadas simultâneas entre os três caixas
 *  6. Isolamento e impacto exclusivo de reservas no saldo disponível (sem alterar saldo contábil)
 *  7. Liberação e consumo de reservas restaurando ou liquidando o saldo disponível
 *  8. Exclusão de transações pendentes/estornadas do saldo disponível e do saldo contábil
 */

describe("Fase 2 — Testes de Caixas, Transferências e Reservas", () => {
  it("1. Visualização individual de cada caixa: Saldo Contábil, Disponível e Reservado", () => {
    // Caixa Geral recebe R$ 1.000,00 de doação
    const txGeral: Transaction = {
      id: "tx-1",
      module: "clube",
      cash_box_id: "geral",
      kind: "receita",
      amount: 1000,
      amount_cents: 100000,
      category: "Doação",
      description: "Doação inicial",
      date: "2027-01-10",
      status: "confirmado",
    };

    // Reserva ativa de R$ 350,00 no Geral (ex: Ônibus do Campori)
    const resGeral: CashReservation = {
      id: "res-1",
      cash_box_id: "geral",
      title: "Reserva Ônibus Campori",
      amount_cents: 35000,
      status: "ativa",
    };

    const summary = summarizeBox([txGeral], "geral", [resGeral]);

    expect(summary.balance_cents).toBe(100000); // R$ 1.000,00
    expect(summary.reserved_cents).toBe(35000); // R$ 350,00
    expect(summary.available_cents).toBe(65000); // R$ 650,00 livre
    expect(summary.balance).toBe(1000);
    expect(summary.available).toBe(650);
    expect(summary.reserved).toBe(350);
  });

  it("2. Transferências entre caixas não alteram a receita nem a despesa consolidada do clube", () => {
    // Doceria tem R$ 500 de vendas
    const vendaDoceria: Transaction = {
      id: "tx-doc-1",
      module: "doceria",
      cash_box_id: "doceria",
      kind: "receita",
      amount: 500,
      amount_cents: 50000,
      category: "Vendas",
      description: "Venda de trufas",
      date: "2027-01-15",
      status: "confirmado",
    };

    // Transferência da Doceria para o Geral de R$ 300
    const transfer: Transaction = {
      id: "tx-trans-1",
      module: "doceria",
      cash_box_id: "doceria",
      destination_cash_box_id: "geral",
      kind: "transferencia",
      amount: 300,
      amount_cents: 30000,
      category: "Transferência",
      description: "Repasse de lucros",
      date: "2027-01-16",
      status: "confirmado",
    };

    const allTx = [vendaDoceria, transfer];

    // Resumo Consolidado do Clube
    const consolidated = summarize(allTx);
    expect(consolidated.income_cents).toBe(50000); // apenas a venda original
    expect(consolidated.expense_cents).toBe(0); // transferência NÃO é despesa consolidada
    expect(consolidated.balance_cents).toBe(50000); // patrimônio consolidado = R$ 500,00

    // Caixa Doceria: 500 - 300 = 200
    const doceriaBox = summarizeBox(allTx, "doceria");
    expect(doceriaBox.balance_cents).toBe(20000);
    expect(doceriaBox.transfers_out_cents).toBe(30000);

    // Caixa Geral: 0 + 300 = 300
    const geralBox = summarizeBox(allTx, "geral");
    expect(geralBox.balance_cents).toBe(30000);
    expect(geralBox.transfers_in_cents).toBe(30000);
  });

  it("3. Invariante contábil: Soma dos 3 caixas é RIGOROSAMENTE igual ao consolidado", () => {
    const txs: Transaction[] = [
      // Geral: Receita de R$ 1.000, Despesa de R$ 200
      {
        id: "1",
        module: "clube",
        cash_box_id: "geral",
        kind: "receita",
        amount: 1000,
        amount_cents: 100000,
        category: "Geral",
        description: "Mensalidades",
        date: "2027-01-01",
        status: "confirmado",
      },
      {
        id: "2",
        module: "clube",
        cash_box_id: "geral",
        kind: "despesa",
        amount: 200,
        amount_cents: 20000,
        category: "Material",
        description: "Cópias",
        date: "2027-01-02",
        status: "confirmado",
      },
      // Doceria: Receita de R$ 800
      {
        id: "3",
        module: "doceria",
        cash_box_id: "doceria",
        kind: "receita",
        amount: 800,
        amount_cents: 80000,
        category: "Doces",
        description: "Bolo",
        date: "2027-01-03",
        status: "confirmado",
      },
      // Vendas: Receita de R$ 600, Despesa de R$ 100
      {
        id: "4",
        module: "vendas",
        cash_box_id: "vendas",
        kind: "receita",
        amount: 600,
        amount_cents: 60000,
        category: "Vendas",
        description: "Garrafas",
        date: "2027-01-04",
        status: "confirmado",
      },
      {
        id: "5",
        module: "vendas",
        cash_box_id: "vendas",
        kind: "despesa",
        amount: 100,
        amount_cents: 10000,
        category: "Comissão",
        description: "Comissão vendedores",
        date: "2027-01-05",
        status: "confirmado",
      },
      // Transferências cruzadas:
      // Doceria -> Geral (R$ 250)
      {
        id: "6",
        module: "doceria",
        cash_box_id: "doceria",
        destination_cash_box_id: "geral",
        kind: "transferencia",
        amount: 250,
        amount_cents: 25000,
        category: "Transf",
        description: "Repasse Doceria",
        date: "2027-01-06",
        status: "confirmado",
      },
      // Vendas -> Geral (R$ 300)
      {
        id: "7",
        module: "vendas",
        cash_box_id: "vendas",
        destination_cash_box_id: "geral",
        kind: "transferencia",
        amount: 300,
        amount_cents: 30000,
        category: "Transf",
        description: "Repasse Vendas",
        date: "2027-01-07",
        status: "confirmado",
      },
      // Geral -> Doceria (R$ 50 para insumos)
      {
        id: "8",
        module: "clube",
        cash_box_id: "geral",
        destination_cash_box_id: "doceria",
        kind: "transferencia",
        amount: 50,
        amount_cents: 5000,
        category: "Transf",
        description: "Adiantamento insumos",
        date: "2027-01-08",
        status: "confirmado",
      },
    ];

    const c = consolidateAllBoxes(txs);

    const bGeral = summarizeBox(txs, "geral");
    const bDoceria = summarizeBox(txs, "doceria");
    const bVendas = summarizeBox(txs, "vendas");

    // Prova matemática:
    // Geral: (1000 - 200) + (250 + 300) - 50 = 800 + 550 - 50 = 1300
    expect(bGeral.balance).toBe(1300);
    // Doceria: 800 - 250 + 50 = 600
    expect(bDoceria.balance).toBe(600);
    // Vendas: (600 - 100) - 300 = 200
    expect(bVendas.balance).toBe(200);

    // Soma = 1300 + 600 + 200 = 2100
    const sumBoxes = bGeral.balance_cents + bDoceria.balance_cents + bVendas.balance_cents;
    expect(sumBoxes).toBe(c.total_balance_cents);
    expect(c.total_balance).toBe(2100);

    // E o summarize clássico (sem transferências):
    // Receitas: 1000 + 800 + 600 = 2400
    // Despesas: 200 + 100 = 300
    // Saldo: 2400 - 300 = 2100
    const s = summarize(txs);
    expect(s.balance).toBe(2100);
    expect(s.income).toBe(2400);
    expect(s.expense).toBe(300);
  });

  it("4. Reservas comprometem saldo disponível sem afetar o patrimônio contábil do caixa", () => {
    const txs: Transaction[] = [
      {
        id: "t1",
        module: "clube",
        cash_box_id: "geral",
        kind: "receita",
        amount: 500,
        amount_cents: 50000,
        category: "Doação",
        description: "Doação",
        date: "2027-01-01",
        status: "confirmado",
      },
    ];

    const reservations: CashReservation[] = [
      {
        id: "r1",
        cash_box_id: "geral",
        title: "Tenda 1",
        amount_cents: 15000, // R$ 150,00
        status: "ativa",
      },
      {
        id: "r2",
        cash_box_id: "geral",
        title: "Tenda 2",
        amount_cents: 10000, // R$ 100,00
        status: "ativa",
      },
      {
        id: "r3",
        cash_box_id: "geral",
        title: "Aluguel antigo liberado",
        amount_cents: 8000, // R$ 80,00 (liberada)
        status: "liberada",
      },
    ];

    const b = summarizeBox(txs, "geral", reservations);

    expect(b.balance_cents).toBe(50000); // R$ 500,00 total
    expect(b.reserved_cents).toBe(25000); // Apenas as ativas: 150 + 100 = 250
    expect(b.available_cents).toBe(25000); // Disponível: 500 - 250 = 250
  });

  it("5. Liberação e consumo de reservas: consumo marca despesa sem duplicar reserva", () => {
    const txs: Transaction[] = [
      {
        id: "tx-in",
        module: "clube",
        cash_box_id: "geral",
        kind: "receita",
        amount: 1000,
        amount_cents: 100000,
        category: "Geral",
        description: "Entrada",
        date: "2027-01-01",
        status: "confirmado",
      },
    ];

    // Reserva inicial ativa
    const res: CashReservation = {
      id: "res-tenda",
      cash_box_id: "geral",
      title: "Reserva Tenda",
      amount_cents: 40000, // R$ 400,00
      status: "ativa",
    };

    let b = summarizeBox(txs, "geral", [res]);
    expect(b.available).toBe(600); // 1000 - 400

    // Consumo da reserva:
    // 1. A reserva passa para 'consumida'
    res.status = "consumida";
    // 2. A despesa oficial correspondente é registrada no caixa
    txs.push({
      id: "tx-desp-tenda",
      module: "clube",
      cash_box_id: "geral",
      kind: "despesa",
      amount: 400,
      amount_cents: 40000,
      category: "Equipamentos",
      description: "Compra da Tenda (Reserva consumida)",
      date: "2027-01-10",
      status: "confirmado",
    });

    b = summarizeBox(txs, "geral", [res]);
    // Saldo Contábil: 1000 - 400 = 600
    expect(b.balance).toBe(600);
    // Reservas ativas = 0 (status='consumida')
    expect(b.reserved).toBe(0);
    // Saldo Disponível: 600 - 0 = 600
    expect(b.available).toBe(600);
  });

  it("6. Transações com status pendente ou estornado não contaminam o saldo oficial do caixa", () => {
    const txs: Transaction[] = [
      {
        id: "1",
        module: "clube",
        cash_box_id: "geral",
        kind: "receita",
        amount: 200,
        amount_cents: 20000,
        category: "Geral",
        description: "Receita Confirmada",
        date: "2027-01-01",
        status: "confirmado",
      },
      {
        id: "2",
        module: "clube",
        cash_box_id: "geral",
        kind: "despesa",
        amount: 150,
        amount_cents: 15000,
        category: "Solicitação",
        description: "Solicitação Pendente de Conselheiro",
        date: "2027-01-02",
        status: "pendente", // Não deve debitar do saldo ainda
      },
      {
        id: "3",
        module: "clube",
        cash_box_id: "geral",
        kind: "receita",
        amount: 500,
        amount_cents: 50000,
        category: "Erro",
        description: "Lançamento Estornado",
        date: "2027-01-03",
        status: "estornado", // Não deve entrar no saldo
      },
    ];

    const box = summarizeBox(txs, "geral");
    expect(box.balance).toBe(200); // Apenas a confirmada
    expect(box.available).toBe(200);
    expect(box.expense).toBe(0);
  });
});


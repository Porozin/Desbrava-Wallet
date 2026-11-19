// Definicao tipada das ferramentas do Atlas AI
// Cada ferramenta mapeia para uma consulta ou RPC no Supabase.

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, { type: string; description: string; enum?: string[] }>;
    required: string[];
  };
}

// Lista de ferramentas expostas ao Gemini
export const TOOLS: ToolDefinition[] = [
  {
    name: "get_saldo_consolidado",
    description: "Retorna o saldo consolidado dos tres caixas do clube (Geral, Doceria, Vendas Rapidas), incluindo receitas, despesas, saldo total e saldo disponivel.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_saldo_caixa",
    description: "Retorna o saldo detalhado de um caixa especifico: disponivel, reservado, receitas, despesas e transferencias.",
    parameters: {
      type: "object",
      properties: {
        cash_box_id: {
          type: "string",
          description: "ID do caixa",
          enum: ["geral", "doceria", "vendas"],
        },
      },
      required: ["cash_box_id"],
    },
  },
  {
    name: "get_transacoes_recentes",
    description: "Lista as transacoes mais recentes. Pode filtrar por caixa, tipo (receita/despesa), data inicial e data final.",
    parameters: {
      type: "object",
      properties: {
        cash_box_id: { type: "string", description: "Filtrar por caixa: geral, doceria ou vendas (opcional)", enum: ["geral", "doceria", "vendas"] },
        kind: { type: "string", description: "Tipo: receita, despesa ou transferencia (opcional)", enum: ["receita", "despesa", "transferencia"] },
        date_from: { type: "string", description: "Data inicial no formato YYYY-MM-DD (opcional)" },
        date_to: { type: "string", description: "Data final no formato YYYY-MM-DD (opcional)" },
        limit: { type: "string", description: "Numero maximo de resultados, padrao 10, maximo 50 (opcional)" },
      },
      required: [],
    },
  },
  {
    name: "get_resumo_mensal",
    description: "Retorna o resumo financeiro de um mes especifico: total arrecadado, total de despesas e saldo do periodo.",
    parameters: {
      type: "object",
      properties: {
        ano: { type: "string", description: "Ano no formato YYYY, ex: 2027" },
        mes: { type: "string", description: "Mes de 1 a 12 (opcional; se omitido retorna o ano inteiro)" },
      },
      required: ["ano"],
    },
  },
  {
    name: "get_metas",
    description: "Lista as metas financeiras do clube. Pode filtrar por modulo.",
    parameters: {
      type: "object",
      properties: {
        modulo: { type: "string", description: "Filtrar por modulo: clube, doceria, vendas ou unidade (opcional)", enum: ["clube", "doceria", "vendas", "unidade"] },
        status: { type: "string", description: "Filtrar por status: pendente, aprovada ou concluida (opcional)", enum: ["pendente", "aprovada", "concluida"] },
      },
      required: [],
    },
  },
  {
    name: "get_produtos",
    description: "Lista os produtos cadastrados no catalogo. Pode filtrar por modulo.",
    parameters: {
      type: "object",
      properties: {
        modulo: { type: "string", description: "Filtrar por modulo: doceria ou vendas (opcional)", enum: ["doceria", "vendas"] },
      },
      required: [],
    },
  },
  {
    name: "get_ranking_vendedores",
    description: "Retorna o ranking de vendedores com total vendido e comissao devida a cada um.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_dividas",
    description: "Lista as dividas e controles internos registrados no sistema.",
    parameters: {
      type: "object",
      properties: {
        status: { type: "string", description: "Filtrar por status: pendente ou pago (opcional)", enum: ["pendente", "pago"] },
      },
      required: [],
    },
  },
  // Ferramentas de escrita (requerem confirmacao do usuario)
  {
    name: "propor_registrar_receita",
    description: "Propoe o registro de uma receita. O usuario devera confirmar antes da execucao.",
    parameters: {
      type: "object",
      properties: {
        cash_box_id: { type: "string", description: "Caixa destino: geral, doceria ou vendas", enum: ["geral", "doceria", "vendas"] },
        amount: { type: "string", description: "Valor em reais, ex: 150.00" },
        category: { type: "string", description: "Categoria da receita, ex: Mensalidade, Venda, Doacao" },
        description: { type: "string", description: "Descricao detalhada da receita" },
        payment_method: { type: "string", description: "Forma de pagamento", enum: ["dinheiro", "pix", "cartao_debito", "cartao_credito", "outro"] },
        date: { type: "string", description: "Data no formato YYYY-MM-DD (opcional; padrao hoje)" },
      },
      required: ["cash_box_id", "amount", "category", "description"],
    },
  },
  {
    name: "propor_registrar_despesa",
    description: "Propoe o registro de uma despesa. O usuario devera confirmar antes da execucao.",
    parameters: {
      type: "object",
      properties: {
        cash_box_id: { type: "string", description: "Caixa de origem: geral, doceria ou vendas", enum: ["geral", "doceria", "vendas"] },
        amount: { type: "string", description: "Valor em reais, ex: 80.50" },
        category: { type: "string", description: "Categoria da despesa, ex: Alimentacao, Material, Evento" },
        description: { type: "string", description: "Descricao detalhada da despesa" },
        payment_method: { type: "string", description: "Forma de pagamento", enum: ["dinheiro", "pix", "cartao_debito", "cartao_credito", "outro"] },
        date: { type: "string", description: "Data no formato YYYY-MM-DD (opcional; padrao hoje)" },
      },
      required: ["cash_box_id", "amount", "category", "description"],
    },
  },
  {
    name: "propor_transferencia",
    description: "Propoe uma transferencia interna entre dois caixas. O usuario devera confirmar antes da execucao.",
    parameters: {
      type: "object",
      properties: {
        source_box: { type: "string", description: "Caixa de origem", enum: ["geral", "doceria", "vendas"] },
        destination_box: { type: "string", description: "Caixa de destino", enum: ["geral", "doceria", "vendas"] },
        amount: { type: "string", description: "Valor em reais" },
        description: { type: "string", description: "Motivo da transferencia" },
      },
      required: ["source_box", "destination_box", "amount", "description"],
    },
  },
  {
    name: "propor_estorno",
    description: "Propoe o estorno de uma movimentacao existente. O usuario devera confirmar antes da execucao.",
    parameters: {
      type: "object",
      properties: {
        transaction_id: { type: "string", description: "UUID da transacao a ser estornada" },
        reverse_reason: { type: "string", description: "Justificativa obrigatoria do estorno" },
      },
      required: ["transaction_id", "reverse_reason"],
    },
  },
];

// Ferramentas que requerem confirmacao do usuario antes de executar
export const WRITE_TOOLS = new Set([
  "propor_registrar_receita",
  "propor_registrar_despesa",
  "propor_transferencia",
  "propor_estorno",
]);

// Ferramentas que gestores financeiros (admin/diretor/tesoureiro) podem usar
export const MANAGER_TOOLS = new Set([
  "propor_registrar_receita",
  "propor_registrar_despesa",
  "propor_transferencia",
  "propor_estorno",
  "get_dividas",
]);

// Ferramentas que qualquer autenticado pode usar (leitura publica)
export const READ_TOOLS = new Set([
  "get_saldo_consolidado",
  "get_saldo_caixa",
  "get_transacoes_recentes",
  "get_resumo_mensal",
  "get_metas",
  "get_produtos",
  "get_ranking_vendedores",
]);

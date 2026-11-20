export interface ToolDefinition {
  name: string;
  description: string;
  parameters: { type: "object"; properties: Record<string, { type: string; description: string; enum?: string[] }>; required: string[]; };
}

export const TOOLS: ToolDefinition[] = [
  {
    "name": "get_saldo_consolidado",
    "description": "Retorna o saldo consolidado dos tres caixas do clube.",
    "parameters": {
      "type": "object",
      "properties": {},
      "required": []
    }
  },
  {
    "name": "get_saldo_caixa",
    "description": "Retorna saldo detalhado de um caixa especifico.",
    "parameters": {
      "type": "object",
      "properties": {
        "cash_box_id": {
          "type": "string",
          "description": "ID do caixa",
          "enum": [
            "geral",
            "doceria",
            "vendas"
          ]
        }
      },
      "required": [
        "cash_box_id"
      ]
    }
  },
  {
    "name": "get_transacoes_recentes",
    "description": "Lista transacoes recentes com filtros opcionais.",
    "parameters": {
      "type": "object",
      "properties": {
        "cash_box_id": {
          "type": "string",
          "description": "Filtrar por caixa (opcional)",
          "enum": [
            "geral",
            "doceria",
            "vendas"
          ]
        },
        "kind": {
          "type": "string",
          "description": "Tipo: receita, despesa ou transferencia (opcional)",
          "enum": [
            "receita",
            "despesa",
            "transferencia"
          ]
        },
        "date_from": {
          "type": "string",
          "description": "Data inicial YYYY-MM-DD (opcional)"
        },
        "date_to": {
          "type": "string",
          "description": "Data final YYYY-MM-DD (opcional)"
        },
        "limit": {
          "type": "string",
          "description": "Limite de resultados, max 50 (opcional)"
        }
      },
      "required": []
    }
  },
  {
    "name": "get_resumo_mensal",
    "description": "Resumo financeiro de um mes ou ano.",
    "parameters": {
      "type": "object",
      "properties": {
        "ano": {
          "type": "string",
          "description": "Ano YYYY"
        },
        "mes": {
          "type": "string",
          "description": "Mes 1-12 (opcional)"
        }
      },
      "required": [
        "ano"
      ]
    }
  },
  {
    "name": "get_metas",
    "description": "Lista metas financeiras do clube.",
    "parameters": {
      "type": "object",
      "properties": {
        "modulo": {
          "type": "string",
          "description": "Modulo: clube, doceria, vendas ou unidade (opcional)",
          "enum": [
            "clube",
            "doceria",
            "vendas",
            "unidade"
          ]
        },
        "status": {
          "type": "string",
          "description": "Status: pendente, aprovada ou concluida (opcional)",
          "enum": [
            "pendente",
            "aprovada",
            "concluida"
          ]
        }
      },
      "required": []
    }
  },
  {
    "name": "get_produtos",
    "description": "Lista produtos do catalogo.",
    "parameters": {
      "type": "object",
      "properties": {
        "modulo": {
          "type": "string",
          "description": "Modulo: doceria ou vendas (opcional)",
          "enum": [
            "doceria",
            "vendas"
          ]
        }
      },
      "required": []
    }
  },
  {
    "name": "get_materiais",
    "description": "Lista insumos e materiais do estoque.",
    "parameters": {
      "type": "object",
      "properties": {
        "modulo": {
          "type": "string",
          "description": "Modulo: clube ou doceria (opcional)",
          "enum": [
            "clube",
            "doceria"
          ]
        }
      },
      "required": []
    }
  },
  {
    "name": "get_ranking_vendedores",
    "description": "Ranking de vendedores com total vendido e comissao.",
    "parameters": {
      "type": "object",
      "properties": {},
      "required": []
    }
  },
  {
    "name": "get_dividas",
    "description": "Lista dividas e controles internos.",
    "parameters": {
      "type": "object",
      "properties": {
        "status": {
          "type": "string",
          "description": "Status: pendente ou pago (opcional)",
          "enum": [
            "pendente",
            "pago"
          ]
        }
      },
      "required": []
    }
  },
  {
    "name": "propor_criar_divida",
    "description": "Propoe o registro de uma divida ou controle interno. Requer confirmacao do usuario.",
    "parameters": {
      "type": "object",
      "properties": {
        "nome": { "type": "string", "description": "Nome da pessoa ou unidade devedora" },
        "valor": { "type": "string", "description": "Valor da divida em reais" },
        "obs": { "type": "string", "description": "Observacao opcional" },
        "date": { "type": "string", "description": "Data no formato YYYY-MM-DD (opcional)" }
      },
      "required": ["nome", "valor"]
    }
  },
  {
    "name": "propor_registrar_receita",
    "description": "Propoe registro de uma receita. Requer confirmacao do usuario.",
    "parameters": {
      "type": "object",
      "properties": {
        "cash_box_id": {
          "type": "string",
          "description": "Caixa destino",
          "enum": [
            "geral",
            "doceria",
            "vendas"
          ]
        },
        "amount": {
          "type": "string",
          "description": "Valor em reais, ex: 150.00"
        },
        "category": {
          "type": "string",
          "description": "Categoria, ex: Mensalidade, Venda, Doacao"
        },
        "description": {
          "type": "string",
          "description": "Descricao da receita"
        },
        "payment_method": {
          "type": "string",
          "description": "Forma de pagamento",
          "enum": [
            "dinheiro",
            "pix",
            "cartao_debito",
            "cartao_credito",
            "outro"
          ]
        },
        "date": {
          "type": "string",
          "description": "Data YYYY-MM-DD (opcional)"
        }
      },
      "required": [
        "cash_box_id",
        "amount",
        "category",
        "description"
      ]
    }
  },
  {
    "name": "propor_registrar_despesa",
    "description": "Propoe registro de uma despesa. Requer confirmacao do usuario.",
    "parameters": {
      "type": "object",
      "properties": {
        "cash_box_id": {
          "type": "string",
          "description": "Caixa de origem",
          "enum": [
            "geral",
            "doceria",
            "vendas"
          ]
        },
        "amount": {
          "type": "string",
          "description": "Valor em reais"
        },
        "category": {
          "type": "string",
          "description": "Categoria, ex: Alimentacao, Material, Evento"
        },
        "description": {
          "type": "string",
          "description": "Descricao da despesa"
        },
        "payment_method": {
          "type": "string",
          "description": "Forma de pagamento",
          "enum": [
            "dinheiro",
            "pix",
            "cartao_debito",
            "cartao_credito",
            "outro"
          ]
        },
        "date": {
          "type": "string",
          "description": "Data YYYY-MM-DD (opcional)"
        }
      },
      "required": [
        "cash_box_id",
        "amount",
        "category",
        "description"
      ]
    }
  },
  {
    "name": "propor_transferencia",
    "description": "Propoe transferencia entre caixas. Requer confirmacao.",
    "parameters": {
      "type": "object",
      "properties": {
        "source_box": {
          "type": "string",
          "description": "Caixa de origem",
          "enum": [
            "geral",
            "doceria",
            "vendas"
          ]
        },
        "destination_box": {
          "type": "string",
          "description": "Caixa de destino",
          "enum": [
            "geral",
            "doceria",
            "vendas"
          ]
        },
        "amount": {
          "type": "string",
          "description": "Valor em reais"
        },
        "description": {
          "type": "string",
          "description": "Motivo da transferencia"
        }
      },
      "required": [
        "source_box",
        "destination_box",
        "amount",
        "description"
      ]
    }
  },
  {
    "name": "propor_estorno",
    "description": "Propoe estorno de uma movimentacao. Requer confirmacao.",
    "parameters": {
      "type": "object",
      "properties": {
        "transaction_id": {
          "type": "string",
          "description": "UUID da transacao"
        },
        "reverse_reason": {
          "type": "string",
          "description": "Justificativa do estorno"
        }
      },
      "required": [
        "transaction_id",
        "reverse_reason"
      ]
    }
  },
  {
    "name": "propor_criar_meta",
    "description": "Propoe criacao de uma meta financeira. Requer confirmacao.",
    "parameters": {
      "type": "object",
      "properties": {
        "modulo": {
          "type": "string",
          "description": "Modulo da meta",
          "enum": [
            "clube",
            "doceria",
            "vendas",
            "unidade"
          ]
        },
        "descricao": {
          "type": "string",
          "description": "Descricao da meta"
        },
        "valor_alvo": {
          "type": "string",
          "description": "Valor alvo em reais"
        },
        "status": {
          "type": "string",
          "description": "Status inicial",
          "enum": [
            "pendente",
            "aprovada"
          ]
        }
      },
      "required": [
        "modulo",
        "descricao",
        "valor_alvo"
      ]
    }
  },
  {
    "name": "propor_atualizar_meta",
    "description": "Propoe atualizacao de uma meta existente. Requer confirmacao.",
    "parameters": {
      "type": "object",
      "properties": {
        "meta_id": {
          "type": "string",
          "description": "UUID da meta"
        },
        "descricao": {
          "type": "string",
          "description": "Nova descricao (opcional)"
        },
        "valor_alvo": {
          "type": "string",
          "description": "Novo valor alvo em reais (opcional)"
        },
        "status": {
          "type": "string",
          "description": "Novo status",
          "enum": [
            "pendente",
            "aprovada",
            "concluida"
          ]
        }
      },
      "required": [
        "meta_id"
      ]
    }
  },
  {
    "name": "propor_excluir_meta",
    "description": "Propoe exclusao de uma meta. Requer confirmacao.",
    "parameters": {
      "type": "object",
      "properties": {
        "meta_id": {
          "type": "string",
          "description": "UUID da meta a excluir"
        }
      },
      "required": [
        "meta_id"
      ]
    }
  },
  {
    "name": "propor_criar_produto",
    "description": "Propoe criacao de um produto no catalogo. Requer confirmacao.",
    "parameters": {
      "type": "object",
      "properties": {
        "nome": {
          "type": "string",
          "description": "Nome do produto"
        },
        "preco_venda": {
          "type": "string",
          "description": "Preco de venda em reais"
        },
        "custo": {
          "type": "string",
          "description": "Custo em reais (opcional)"
        },
        "comissao": {
          "type": "string",
          "description": "Comissao do vendedor em reais (opcional)"
        },
        "modulo": {
          "type": "string",
          "description": "Modulo do produto",
          "enum": [
            "doceria",
            "vendas",
            "clube"
          ]
        }
      },
      "required": [
        "nome",
        "preco_venda",
        "modulo"
      ]
    }
  },
  {
    "name": "propor_atualizar_produto",
    "description": "Propoe atualizacao de um produto existente. Requer confirmacao.",
    "parameters": {
      "type": "object",
      "properties": {
        "produto_id": {
          "type": "string",
          "description": "UUID do produto"
        },
        "nome": {
          "type": "string",
          "description": "Novo nome (opcional)"
        },
        "preco_venda": {
          "type": "string",
          "description": "Novo preco em reais (opcional)"
        },
        "custo": {
          "type": "string",
          "description": "Novo custo em reais (opcional)"
        }
      },
      "required": [
        "produto_id"
      ]
    }
  },
  {
    "name": "propor_excluir_produto",
    "description": "Propoe exclusao de um produto. Requer confirmacao.",
    "parameters": {
      "type": "object",
      "properties": {
        "produto_id": {
          "type": "string",
          "description": "UUID do produto"
        }
      },
      "required": [
        "produto_id"
      ]
    }
  },
  {
    "name": "propor_criar_insumo",
    "description": "Propoe criacao de um insumo no estoque. Requer confirmacao.",
    "parameters": {
      "type": "object",
      "properties": {
        "nome": {
          "type": "string",
          "description": "Nome do insumo"
        },
        "quantidade": {
          "type": "string",
          "description": "Quantidade"
        },
        "custo_total": {
          "type": "string",
          "description": "Custo total em reais"
        },
        "unidade_medida": {
          "type": "string",
          "description": "Unidade: un, kg, g, L, mL, cx, pct (opcional)"
        },
        "modulo": {
          "type": "string",
          "description": "Modulo: clube ou doceria",
          "enum": [
            "clube",
            "doceria"
          ]
        }
      },
      "required": [
        "nome",
        "quantidade",
        "custo_total",
        "modulo"
      ]
    }
  },
  {
    "name": "propor_atualizar_insumo",
    "description": "Propoe atualizacao de um insumo. Requer confirmacao.",
    "parameters": {
      "type": "object",
      "properties": {
        "insumo_id": {
          "type": "string",
          "description": "UUID do insumo"
        },
        "nome": {
          "type": "string",
          "description": "Novo nome (opcional)"
        },
        "quantidade": {
          "type": "string",
          "description": "Nova quantidade (opcional)"
        },
        "custo_total": {
          "type": "string",
          "description": "Novo custo total em reais (opcional)"
        }
      },
      "required": [
        "insumo_id"
      ]
    }
  },
  {
    "name": "propor_excluir_insumo",
    "description": "Propoe exclusao de um insumo. Requer confirmacao.",
    "parameters": {
      "type": "object",
      "properties": {
        "insumo_id": {
          "type": "string",
          "description": "UUID do insumo"
        }
      },
      "required": [
        "insumo_id"
      ]
    }
  }
];

export const WRITE_TOOLS = new Set(["propor_registrar_receita", "propor_registrar_despesa", "propor_transferencia", "propor_estorno", "propor_criar_meta", "propor_atualizar_meta", "propor_excluir_meta", "propor_criar_produto", "propor_atualizar_produto", "propor_excluir_produto", "propor_criar_insumo", "propor_atualizar_insumo", "propor_excluir_insumo", "propor_criar_divida"]);
export const READ_TOOLS = new Set(["get_saldo_consolidado", "get_saldo_caixa", "get_transacoes_recentes", "get_resumo_mensal", "get_metas", "get_produtos", "get_materiais", "get_ranking_vendedores"]);
export const MANAGER_TOOLS = new Set(["propor_registrar_receita", "propor_registrar_despesa", "propor_transferencia", "propor_estorno", "propor_criar_meta", "propor_atualizar_meta", "propor_excluir_meta", "propor_criar_produto", "propor_atualizar_produto", "propor_excluir_produto", "propor_criar_insumo", "propor_atualizar_insumo", "propor_excluir_insumo", "propor_criar_divida", "get_dividas"]);

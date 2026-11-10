import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatarMensagemAtualizar, type DadosAtualizacao } from "./atualizar.ts";

describe("Comando /atualizar (Sincronização e Recálculo)", () => {
  it("deve formatar aviso de venda manual quando posicaoLiberada for true", () => {
    const dados: DadosAtualizacao = {
      symbol: "SOLUSDT",
      moeda: "SOL",
      usdtLivre: 25.5,
      saldoMoeda: 0,
      valorMoedaUsd: 0,
      precoAtual: 82.5,
      posicaoLiberada: true,
      temCripto: false,
      precoCompra: 0,
      fase: "MONITOR_BUY",
      decisaoAcao: "NENHUMA",
      decisaoMotivo: "Aguardando preço se aproximar da média mínima.",
      mediasDisponiveis: true,
      mediaMinima: 80.0,
      mediaVenda: 86.0,
      mediaGeral: 83.0,
      maxAlta: 90.0,
      reversalPercent: 5,
    };

    const msg = formatarMensagemAtualizar(dados);

    assert.ok(
      msg.includes("Detectada venda manual na Binance"),
      "Deve conter o aviso de venda manual detectada"
    );
    assert.ok(
      msg.includes("Sem cripto (Aguardando oportunidade de COMPRA)"),
      "Deve indicar que o bot está livre para comprar"
    );
    assert.ok(
      msg.includes("USDT (dólar livre): $25.50"),
      "Deve exibir o saldo USDT correto"
    );
    assert.ok(
      msg.includes("Preço atual do SOLUSDT: $82.50"),
      "Deve exibir a cotação atual"
    );
    assert.ok(
      msg.includes("Média Mínima (zona de compra): $80.00"),
      "Deve exibir a média mínima de compra"
    );
    assert.ok(
      msg.includes("Sugestão imediata: ⏸️ AGUARDAR"),
      "Deve indicar a ação calculada pela estratégia"
    );
  });

  it("deve formatar estado posicionado para venda quando o usuário tiver saldo em SOL", () => {
    const dados: DadosAtualizacao = {
      symbol: "SOLUSDT",
      moeda: "SOL",
      usdtLivre: 2.1,
      saldoMoeda: 0.5,
      valorMoedaUsd: 41.25,
      precoAtual: 82.5,
      posicaoLiberada: false,
      temCripto: true,
      precoCompra: 81.0,
      fase: "MONITOR_SELL",
      decisaoAcao: "VENDER",
      decisaoMotivo: "Atingiu a máxima da janela.",
      mediasDisponiveis: true,
      mediaMinima: 79.0,
      mediaVenda: 82.0,
      mediaGeral: 80.5,
      maxAlta: 82.5,
      reversalPercent: 5,
    };

    const msg = formatarMensagemAtualizar(dados);

    assert.ok(
      !msg.includes("Detectada venda manual"),
      "Não deve exibir aviso de venda se a posição não foi liberada"
    );
    assert.ok(
      msg.includes("Posicionado (Monitorando VENDA)"),
      "Deve indicar que o bot está com cripto comprada"
    );
    assert.ok(
      msg.includes("Preço base de compra: $81.00"),
      "Deve indicar o preço de compra"
    );
    assert.ok(
      msg.includes("Sugestão imediata: 🔴 VENDER"),
      "Deve destacar a recomendação de VENDA"
    );
  });
});

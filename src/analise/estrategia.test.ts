import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { decidirReversao, type EstadoReversao } from "./estrategia.ts";
import type { Medias } from "./medias.ts";

describe("Estratégia de Reversão e Travas de Segurança (Comprar na Baixa, Vender na Alta)", () => {
  const mediasExemplo: Medias = {
    amostras: 100,
    janelaDias: 1,
    precoAtual: 82.5,
    mediaGeral: 82.5,
    mediaMinima: 82.0, // Zona de desconto
    mediaVenda: 83.0,  // Zona de valorização
    maxAlta: 83.5,
    minMax: 81.5,
  };

  it("deve abortar MONITOR_BUY e retornar para IDLE se o preço subir acima da média geral", () => {
    const estadoAnterior: EstadoReversao = {
      phase: "MONITOR_BUY",
      extremePrice: 81.8,
    };

    // Preço atual subiu para 83.20 (acima da média geral 82.50)
    const decisao = decidirReversao(
      false, // sem cripto
      83.2,
      mediasExemplo,
      5, // 5% de reversão
      estadoAnterior
    );

    assert.equal(decisao.acao, "NENHUMA");
    assert.equal(decisao.novoEstado.phase, "IDLE");
    assert.equal(decisao.novoEstado.extremePrice, null);
    assert.ok(
      decisao.motivo.includes("subiu além da média geral"),
      "Deve explicar que abortou porque o preço subiu além da média geral"
    );
  });

  it("deve travar o gatilho de compra na média geral para nunca comprar acima do preço médio", () => {
    const estadoAnterior: EstadoReversao = {
      phase: "MONITOR_BUY",
      extremePrice: 81.9,
    };

    // Fundo = 81.90. Com 5%, 81.90 * 1.05 = 85.99 (acima da média geral 82.50).
    // O teto deve travar em 82.50.
    const decisao = decidirReversao(
      false,
      82.1,
      mediasExemplo,
      5,
      estadoAnterior
    );

    assert.equal(decisao.acao, "NENHUMA");
    assert.equal(decisao.novoEstado.phase, "MONITOR_BUY");
    assert.ok(
      decisao.motivo.includes("82.50"),
      "Gatilho deve respeitar o teto da média geral"
    );
  });

  it("deve executar COMPRA quando a reversão ocorrer dentro da zona de desconto", () => {
    const estadoAnterior: EstadoReversao = {
      phase: "MONITOR_BUY",
      extremePrice: 81.6,
    };

    // Fundo = 81.60. Com 0.5% de reversão: 81.60 * 1.005 = 82.008 (ainda <= mediaMinima/mediaGeral).
    // Preço atual subiu para 82.01 confirmando a alta na baixa.
    const decisao = decidirReversao(
      false,
      82.02,
      mediasExemplo,
      0.5,
      estadoAnterior
    );

    assert.equal(decisao.acao, "COMPRAR");
    assert.equal(decisao.novoEstado.phase, "IDLE");
    assert.ok(decisao.motivo.includes("Reversão de alta"));
  });

  it("deve entrar em MONITOR_BUY quando o preço cair para a zona de desconto (<= mediaMinima)", () => {
    const estadoAnterior: EstadoReversao = {
      phase: "IDLE",
      extremePrice: null,
    };

    const decisao = decidirReversao(
      false,
      81.9, // abaixo de mediaMinima (82.0)
      mediasExemplo,
      2,
      estadoAnterior
    );

    assert.equal(decisao.acao, "NENHUMA");
    assert.equal(decisao.novoEstado.phase, "MONITOR_BUY");
    assert.equal(decisao.novoEstado.extremePrice, 81.9);
  });

  it("deve abortar MONITOR_SELL para IDLE se o preço cair abaixo da média geral", () => {
    const estadoAnterior: EstadoReversao = {
      phase: "MONITOR_SELL",
      extremePrice: 83.2,
    };

    // Preço despencou para 82.3 (abaixo da média geral 82.50)
    const decisao = decidirReversao(
      true, // tem cripto
      82.3,
      mediasExemplo,
      3,
      estadoAnterior
    );

    assert.equal(decisao.acao, "NENHUMA");
    assert.equal(decisao.novoEstado.phase, "IDLE");
    assert.ok(decisao.motivo.includes("caiu abaixo da média geral"));
  });

  it("deve executar VENDA imediata ao atingir a máxima histórica da janela", () => {
    const estadoAnterior: EstadoReversao = {
      phase: "MONITOR_SELL",
      extremePrice: 83.4,
    };

    const decisao = decidirReversao(
      true,
      83.55, // >= maxAlta (83.5)
      mediasExemplo,
      3,
      estadoAnterior
    );

    assert.equal(decisao.acao, "VENDER");
    assert.ok(decisao.motivo.includes("Atingiu a máxima"));
  });
});

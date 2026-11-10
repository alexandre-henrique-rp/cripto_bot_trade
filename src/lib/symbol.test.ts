import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SYMBOL,
  resolverSimbolo,
  obterCasasDecimais,
  ajustarQuantidade,
  ajustarQuantidadePorSimbolo,
} from "./symbol.ts";

describe("Utilitários de símbolo e precisão (LOT_SIZE Binance)", () => {
  it("deve ter SOLUSDT como símbolo padrão", () => {
    assert.equal(DEFAULT_SYMBOL, "SOLUSDT");
    assert.equal(resolverSimbolo(undefined, undefined), "SOLUSDT");
  });

  it("deve priorizar process.env.SYMBOL sobre o símbolo salvo no banco", () => {
    assert.equal(resolverSimbolo("solusdt", "ETHUSDT"), "SOLUSDT");
    assert.equal(resolverSimbolo("  SOLUSDT  ", "ETHUSDT"), "SOLUSDT");
    assert.equal(resolverSimbolo("", "ETHUSDT"), "ETHUSDT");
  });

  it("deve retornar as casas decimais corretas para SOLUSDT, ETHUSDT e BTCUSDT", () => {
    assert.equal(obterCasasDecimais("SOLUSDT"), 2);
    assert.equal(obterCasasDecimais("solusdt"), 2);
    assert.equal(obterCasasDecimais("ETHUSDT"), 3);
    assert.equal(obterCasasDecimais("BTCUSDT"), 5);
    assert.equal(obterCasasDecimais("DOGEUSDT"), 0);
  });

  it("deve truncar a quantidade sem gerar dízimas de ponto flutuante", () => {
    assert.equal(ajustarQuantidade(1.239, 2), 1.23);
    assert.equal(ajustarQuantidade(19.99, 2), 19.99);
    assert.equal(ajustarQuantidade(0.548921, 2), 0.54);
    assert.equal(ajustarQuantidade(-5, 2), 0);
  });

  it("deve ajustar a quantidade conforme o símbolo (2 casas para SOLUSDT)", () => {
    assert.equal(ajustarQuantidadePorSimbolo(1.5678, "SOLUSDT"), 1.56);
    assert.equal(ajustarQuantidadePorSimbolo(1.5678, "ETHUSDT"), 1.567);
  });
});

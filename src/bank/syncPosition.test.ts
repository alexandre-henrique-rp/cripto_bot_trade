import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  extrairPrecoUltimaCompra,
  avaliarPosicaoCarteira,
  validarPrecoManual,
} from "./syncPosition.ts";

describe("Sincronização de posição existente na Binance (Opção A)", () => {
  it("deve extrair o preço da última compra (isBuyer = true) ordenada por horário", () => {
    const trades = [
      { price: "160.00", qty: "1.0", isBuyer: true, time: 1000 },
      { price: "175.50", qty: "0.5", isBuyer: true, time: 3000 },
      { price: "180.00", qty: "0.5", isBuyer: false, time: 4000 }, // venda, deve ignorar
      { price: "165.00", qty: "1.0", isBuyer: true, time: 2000 },
    ];
    assert.equal(extrairPrecoUltimaCompra(trades, 190), 175.5);
  });

  it("deve usar o fallbackPrice quando não houver histórico de compras", () => {
    assert.equal(extrairPrecoUltimaCompra([], 185.2), 185.2);
    assert.equal(
      extrairPrecoUltimaCompra(
        [{ price: "180.00", qty: "1", isBuyer: false, time: 1000 }],
        185.2
      ),
      185.2
    );
  });

  it("deve assumir a posição apenas quando o saldo de SOL atingir o mínimo em USD (>= $5)", () => {
    // 0.567 SOL a $180 = 0.56 * 180 = $100.80 -> deve assumir
    const valida = avaliarPosicaoCarteira(0.567, "SOLUSDT", 180);
    assert.equal(valida.assumir, true);
    assert.equal(valida.quantidadeAjustada, 0.56);
    assert.equal(valida.valorEstimadoUsd, 100.8);

    // 0.01 SOL a $180 = $1.80 (poeira abaixo de $5) -> não deve assumir
    const poeira = avaliarPosicaoCarteira(0.01, "SOLUSDT", 180);
    assert.equal(poeira.assumir, false);
  });

  it("deve validar a faixa de segurança do preço manual em /assumir (20% a 500%)", () => {
    assert.equal(validarPrecoManual(180, 200), true);
    assert.equal(validarPrecoManual(0.01, 200), false);
    assert.equal(validarPrecoManual(999999, 200), false);
    assert.equal(validarPrecoManual(-10, 200), false);
  });
});

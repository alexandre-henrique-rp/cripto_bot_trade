import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calcularItensCarteira,
  formatarMensagemCarteira,
} from "./carteira.ts";

describe("Comando /carteira (carteira Spot na Binance)", () => {
  it("deve calcular os valores em USD, somar o total e ordenar do maior para o menor", () => {
    const balances = [
      { asset: "USDT", free: "100.5", locked: "0" },
      { asset: "SOL", free: "2", locked: "0.5" },
      { asset: "ETH", free: "0.01", locked: "0" },
      { asset: "ZERO", free: "0", locked: "0" },
    ];
    const precosMap = {
      SOLUSDT: 200,
      ETHUSDT: 3000,
    };

    const { itens, totalUsd } = calcularItensCarteira(balances, precosMap);

    assert.equal(itens.length, 3);
    // SOL tem 2.5 * 200 = $500 (1º lugar)
    assert.equal(itens[0].asset, "SOL");
    assert.equal(itens[0].total, 2.5);
    assert.equal(itens[0].valorUsd, 500);

    // USDT tem $100.50 (2º lugar)
    assert.equal(itens[1].asset, "USDT");
    assert.equal(itens[1].valorUsd, 100.5);

    // ETH tem 0.01 * 3000 = $30 (3º lugar)
    assert.equal(itens[2].asset, "ETH");
    assert.equal(itens[2].valorUsd, 30);

    assert.equal(totalUsd, 630.5);
  });

  it("deve formatar a mensagem exibindo saldos disponíveis, em ordem e total estimado", () => {
    const { itens, totalUsd } = calcularItensCarteira(
      [
        { asset: "SOL", free: "1.5", locked: "0.5" },
        { asset: "USDT", free: "50", locked: "0" },
      ],
      { SOLUSDT: 150 }
    );

    const texto = formatarMensagemCarteira(itens, totalUsd);
    assert.ok(texto.includes("💼 Carteira Binance Spot"));
    assert.ok(texto.includes("• SOL: 2 (disp: 1.5 | ordem: 0.5)"));
    assert.ok(texto.includes("• USDT: 50"));
    assert.ok(texto.includes("💵 Total estimado:"));
  });

  it("deve exibir mensagem amigável quando a carteira estiver vazia", () => {
    const texto = formatarMensagemCarteira([], 0);
    assert.ok(texto.includes("Nenhum ativo com saldo positivo encontrado."));
  });
});

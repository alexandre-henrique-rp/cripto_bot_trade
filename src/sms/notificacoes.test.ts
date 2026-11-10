import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatarNotificacaoCompra,
  formatarNotificacaoVenda,
  formatarNotificacaoErro,
} from "./notificacoes.ts";

describe("Notificações do Telegram (Compra, Venda com Lucro e Log de Erro)", () => {
  const dataFixa = new Date("2026-11-10T16:30:45.000Z");

  it("deve formatar notificação de compra com token, quantidade, valor, preço e data/hora", () => {
    const msg = formatarNotificacaoCompra({
      symbol: "SOLUSDT",
      quantidade: 2.5,
      valorUsd: 450,
      precoUnitario: 180,
      data: dataFixa,
    });

    assert.ok(msg.includes("✅ COMPRA REALIZADA"));
    assert.ok(msg.includes("• Token: SOL (SOLUSDT)"));
    assert.ok(msg.includes("• Quantidade de tokens: 2.5 SOL"));
    assert.ok(msg.includes("• Preço unitário: $180.00"));
    assert.ok(msg.includes("• Valor investido: $450.00"));
    assert.ok(msg.includes("• Data e hora: 10/11/2026 às 13:30:45"));
  });

  it("deve formatar notificação de venda incluindo lucro em USD e percentual, tokens, valores e data/hora", () => {
    const msg = formatarNotificacaoVenda({
      symbol: "SOLUSDT",
      quantidade: 2,
      precoCompra: 180,
      precoVenda: 198,
      valorInvestido: 360,
      valorRecebido: 396,
      lucroUsd: 36,
      data: dataFixa,
    });

    assert.ok(msg.includes("✅ VENDA REALIZADA"));
    assert.ok(msg.includes("• Token: SOL (SOLUSDT)"));
    assert.ok(msg.includes("• Quantidade de tokens: 2 SOL"));
    assert.ok(msg.includes("• Preço de compra: $180.00"));
    assert.ok(msg.includes("• Preço de venda: $198.00"));
    assert.ok(msg.includes("• Valor investido: $360.00"));
    assert.ok(msg.includes("• Valor recebido: $396.00"));
    assert.ok(msg.includes("Lucro: +$36.00 (+10.00%)"));
    assert.ok(msg.includes("• Data e hora: 10/11/2026 às 13:30:45"));
  });

  it("deve formatar log de erro com contexto, data/hora, mensagem e stack trace", () => {
    const erro = new Error("Falha de conexão com endpoint /v3/order");
    const msg = formatarNotificacaoErro("Ordem BUY (SOLUSDT)", erro, dataFixa);

    assert.ok(msg.includes("🚨 ERRO NO BOT (Ordem BUY (SOLUSDT))"));
    assert.ok(msg.includes("• Data e hora: 10/11/2026 às 13:30:45"));
    assert.ok(msg.includes("• Mensagem: Falha de conexão com endpoint /v3/order"));
    assert.ok(msg.includes("• Log:"));
  });
});

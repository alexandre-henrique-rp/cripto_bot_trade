import dns from "node:dns";
import dotenv from "dotenv";

// Força resolução IPv4 primeiro para evitar timeout em containers Docker sem rota IPv6
dns.setDefaultResultOrder("ipv4first");

// override:true garante que os valores do .env prevaleçam sobre variáveis
// eventualmente já presentes no ambiente (evita URLs/chaves vazias herdadas).
dotenv.config({ override: true });

import {
  inicializarCofre,
  getBinanceCredentials,
} from "./src/config/vault.ts";
import { ativarNetworkGuard } from "./src/config/networkGuard.ts";

// Inicializa o cofre (apagando chaves de process.env) e ativa o firewall de saída.
inicializarCofre();
ativarNetworkGuard();

// Evita que uma rejeição ou exceção inesperada derrube o motor de trade.
process.on("unhandledRejection", (reason) => {
  console.error("⚠️ [trade] unhandledRejection:", reason);
  notificarErroTelegram("Processo Trade (unhandledRejection)", reason);
});
process.on("uncaughtException", (err) => {
  console.error("⚠️ [trade] uncaughtException:", err?.message || err);
  notificarErroTelegram("Processo Trade (uncaughtException)", err);
});

import WebSocket from "ws";
import Controlador from "./src/contolador.ts";
import GET_CONFIG from "./src/database/config.ts";
import { iniciarColetorCMC } from "./src/coinmarketcap/collector.ts";
import { notificarErroTelegram } from "./src/sms/notificacoes.ts";

const configDb = await GET_CONFIG();
const symbol =
  process.env.SYMBOL?.toLowerCase() ||
  configDb.symbol?.toLowerCase() ||
  "solusdt";
const { streamUrl } = getBinanceCredentials();
const url = `${streamUrl}/${symbol}@ticker`;

// Inicia a coleta periódica de preços no CoinMarketCap (histórico p/ médias).
iniciarColetorCMC().catch((e) =>
  console.error("Falha ao iniciar coletor CMC:", e)
);

function conectarWebSocket() {
  const ws = new WebSocket(url);

  ws.on("open", () => console.log("🔌 WebSocket Binance conectado:", url));

  ws.on("message", async (ev) => {
    try {
      const Obj = JSON.parse(ev.toString());
      if (Obj && Obj.s && Obj.a) {
        const valor_atual = parseFloat(Obj.a);
        if (!Number.isFinite(valor_atual) || valor_atual <= 0) {
          return;
        }
        await Controlador(valor_atual);
      }
    } catch (error) {
      console.error("❌ Erro ao processar mensagem no Controlador:", error);
      await notificarErroTelegram("WebSocket Mensagem", error);
    }
  });

  ws.on("close", () => {
    console.warn("⚠️ WebSocket fechado. Reconectando em 5s...");
    setTimeout(conectarWebSocket, 5000);
  });

  ws.on("error", (err) => {
    console.error("❌ Erro no WebSocket:", err.message);
    notificarErroTelegram("WebSocket Binance", err);
    ws.close();
  });
}

conectarWebSocket();

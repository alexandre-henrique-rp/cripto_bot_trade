import type { Config } from "../database/config.ts";
import {
  getBinanceCredentials,
  getTelegramCredentials,
} from "./vault.ts";

export interface Prontidao {
  pronto: boolean; // todas as credenciais necessárias estão presentes
  faltando: string[]; // lista do que falta
}

/**
 * Verifica se todas as credenciais/configurações necessárias para operar
 * estão presentes. NÃO valida se as chaves são válidas na corretora — apenas
 * se foram informadas. As chaves da Binance vêm do .env (guardadas no cofre);
 * a do CMC pode vir do .env ou do banco (definida via Telegram).
 */
export function verificarProntidao(config: Config): Prontidao {
  const faltando: string[] = [];
  const binance = getBinanceCredentials();
  const telegram = getTelegramCredentials();

  // Binance (somente .env, por segurança).
  if (!binance.apiKey) faltando.push("API_KEY_PROD (Binance) no .env");
  if (!binance.secretKey)
    faltando.push("SECRET_KEY_PROD (Binance) no .env");
  if (!binance.apiUrl)
    faltando.push("API_URL_PROD (Binance REST) no .env");
  if (!binance.streamUrl)
    faltando.push("STREAM_URL_PROD (Binance WebSocket) no .env");

  // Par negociado.
  if (!(config.symbol || process.env.SYMBOL))
    faltando.push("SYMBOL (par, ex: SOLUSDT)");

  // CoinMarketCap: configurada exclusivamente via Telegram (/set_cmc_key).
  if (!config.cmc_api_key)
    faltando.push("Chave do CoinMarketCap — defina via /set_cmc_key no Telegram");

  // Telegram (necessário para comandos e alertas).
  if (!telegram.botToken) faltando.push("BOT_TOKEN (Telegram) no .env");
  if (!telegram.chatId) faltando.push("CHAT_ID (Telegram) no .env");

  return { pronto: faltando.length === 0, faltando };
}

/**
 * Monta um texto amigável do estado de prontidão + se está habilitado.
 */
export function textoProntidao(config: Config): string {
  const p = verificarProntidao(config);
  const linhas: string[] = [];

  linhas.push(p.pronto ? "✅ Credenciais: completas" : "⚠️ Credenciais: incompletas");
  if (!p.pronto) {
    linhas.push("Faltando:");
    for (const f of p.faltando) linhas.push(`  • ${f}`);
  }
  linhas.push(
    config.enabled
      ? "🟢 Operação: LIGADA (comprando/vendendo)"
      : "⏸️ Operação: DESLIGADA (use /iniciar quando estiver pronto)"
  );
  return linhas.join("\n");
}

import http from "node:http";
import https from "node:https";
import { getBinanceCredentials } from "./vault.ts";

/**
 * Firewall de saída (Outbound Allowlist) em nível de processo Node.js.
 *
 * Objetivo: impedir que qualquer pacote npm comprometido exfiltre dados
 * ou credenciais para servidores externos desconhecidos.
 * Apenas os domínios oficiais da Binance, CoinMarketCap e Telegram são permitidos.
 */

const DOMINIOS_EXATOS_PERMITIDOS = new Set([
  "api.binance.com",
  "api1.binance.com",
  "api2.binance.com",
  "api3.binance.com",
  "api4.binance.com",
  "stream.binance.com",
  "testnet.binance.vision",
  "pro-api.coinmarketcap.com",
  "api.telegram.org",
]);

const SUFIXOS_PERMITIDOS = [
  ".binance.com",
  ".binance.vision",
  ".coinmarketcap.com",
  ".telegram.org",
];

let guardAtivo = false;

/**
 * Extrai o hostname de uma URL configurada pelo usuário (se válida).
 */
function extrairHostnameSeguro(urlStr?: string): string | null {
  if (!urlStr) return null;
  try {
    return new URL(urlStr).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Verifica se um hostname está na lista de domínios permitidos pelo bot.
 * Função pura exposta para testes unitários.
 */
export function isHostPermitido(hostname: string): boolean {
  if (!hostname) return false;
  const limpo = hostname.trim().toLowerCase().replace(/:\d+$/, "");
  if (!limpo) return false;

  if (DOMINIOS_EXATOS_PERMITIDOS.has(limpo)) {
    return true;
  }

  for (const sufixo of SUFIXOS_PERMITIDOS) {
    if (limpo.endsWith(sufixo)) {
      return true;
    }
  }

  // Permite também os hosts configurados explicitamente em API_URL_PROD / STREAM_URL_PROD
  const creds = getBinanceCredentials();
  const hostApi = extrairHostnameSeguro(creds.apiUrl);
  const hostStream = extrairHostnameSeguro(creds.streamUrl);
  if ((hostApi && limpo === hostApi) || (hostStream && limpo === hostStream)) {
    return true;
  }

  return false;
}

/**
 * Valida se o hostname de destino é permitido; caso contrário, lança erro e bloqueia a rede.
 */
export function validarDestinoRede(hostname: string): void {
  if (!isHostPermitido(hostname)) {
    throw new Error(
      `🚨 [NetworkGuard] Conexão de saída bloqueada para domínio não autorizado: "${hostname}"`
    );
  }
}

/**
 * Extrai o hostname dos argumentos passados para http.request / https.request.
 */
function extrairHostDeArgsHttp(args: any[]): string {
  const primeiro = args[0];
  if (typeof primeiro === "string") {
    try {
      return new URL(primeiro).hostname;
    } catch {
      return primeiro;
    }
  }
  if (primeiro instanceof URL) {
    return primeiro.hostname;
  }
  if (primeiro && typeof primeiro === "object") {
    const raw = primeiro.hostname || primeiro.host || "";
    return String(raw).split(":")[0];
  }
  return "";
}

/**
 * Ativa o interceptador global em `fetch`, `http.request`, `http.get`,
 * `https.request` e `https.get`.
 */
export function ativarNetworkGuard(): void {
  if (guardAtivo) return;
  guardAtivo = true;

  // 1) Protege globalThis.fetch
  const fetchOriginal = globalThis.fetch;
  if (typeof fetchOriginal === "function") {
    globalThis.fetch = async function (
      input: string | URL | Request,
      init?: RequestInit
    ): Promise<Response> {
      let urlStr = "";
      if (typeof input === "string") {
        urlStr = input;
      } else if (input instanceof URL) {
        urlStr = input.toString();
      } else if (input && typeof input === "object" && "url" in input) {
        urlStr = input.url;
      }
      const hostname = extrairHostnameSeguro(urlStr) || "";
      validarDestinoRede(hostname);
      return fetchOriginal.call(globalThis, input as any, init);
    };
  }

  // 2) Protege http.request e http.get
  const httpRequestOriginal = http.request;
  http.request = function (...args: any[]) {
    const host = extrairHostDeArgsHttp(args);
    validarDestinoRede(host);
    return (httpRequestOriginal as any).apply(this, args);
  } as any;

  const httpGetOriginal = http.get;
  http.get = function (...args: any[]) {
    const host = extrairHostDeArgsHttp(args);
    validarDestinoRede(host);
    return (httpGetOriginal as any).apply(this, args);
  } as any;

  // 3) Protege https.request e https.get
  const httpsRequestOriginal = https.request;
  https.request = function (...args: any[]) {
    const host = extrairHostDeArgsHttp(args);
    validarDestinoRede(host);
    return (httpsRequestOriginal as any).apply(this, args);
  } as any;

  const httpsGetOriginal = https.get;
  https.get = function (...args: any[]) {
    const host = extrairHostDeArgsHttp(args);
    validarDestinoRede(host);
    return (httpsGetOriginal as any).apply(this, args);
  } as any;
}

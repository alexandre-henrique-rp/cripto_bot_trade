import crypto from "crypto";
import { httpPost } from "../lib/http.ts";
import { getBinanceCredentials } from "../config/vault.ts";
import { notificarErroTelegram } from "../sms/notificacoes.ts";


/**
 * Cria uma nova ordem de compra ou venda.
 *
 * @param {string} quantity - A quantidade de criptomoeda.
 * @param {string} side - O tipo de ordem, "BUY" ou "SELL".
 * @returns {Promise<any>} - A promise que resolve para os dados da API.
 * @throws {Error} - Se a requisição à API falhar.
 *
 */
export default async function newOrden(
  quantity: string,
  side: string,
  symbol?: string
): Promise<any> {
  const { apiKey, secretKey, apiUrl } = getBinanceCredentials();
  const timestamp = Date.now().toString();
  const recvWindow = "60000";
  const data = {
    symbol: symbol || process.env.SYMBOL || "SOLUSDT",
    side,
    quantity,
    type: "MARKET",
    timestamp,
    recvWindow,
  };
  const secret = secretKey;

  // Cria a query string corretamente
  const queryString = new URLSearchParams(
    Object.fromEntries(
      Object.entries(data).map(([key, value]) => [key, String(value)])
    )
  ).toString();

  const signature = crypto
    .createHmac("sha256", secret)
    .update(queryString)
    .digest("hex");

  const NewDate = {
    ...data,
    signature,
  };
  const qs = `?${new URLSearchParams(NewDate).toString()}`;
  try {
    const response = await httpPost(`${apiUrl}/v3/order${qs}`, {
      headers: {
        "X-MBX-APIKEY": apiKey,
      },
    });
    console.log(response.data);
    return true;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Erro ao executar ordem na corretora:", msg);
    await notificarErroTelegram(`Ordem ${side} (${data.symbol})`, error);
    return false;
  }
}

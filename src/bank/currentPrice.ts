import { httpGet } from "../lib/http.ts";
import { getBinanceCredentials } from "../config/vault.ts";
import { notificarErroTelegram } from "../sms/notificacoes.ts";

/**
 * Buscar o valor atual de uma criptomoeda, considerando a quantidade.
 *
 * @param {string} symbol - O símbolo da criptomoeda (ex: 'BTCUSDT').
 * @param {number} quantity - A quantidade de criptomoeda.
 * @returns {Promise<number>} - O preço atual da criptomoeda.
 * @throws {Error} - Se houver um erro na requisição.
 */
export default async function getCurrentPrice(
  symbol: string,
  quantity: number
) {
  const { apiKey, apiUrl: baseUrl } = getBinanceCredentials();

  try {
    const response = await httpGet(
      `${baseUrl}/v3/ticker/24hr`,
      {
        headers: { "X-MBX-APIKEY": apiKey },
        params: { symbol },
      }
    );
   
    const valor_atual = parseFloat(response.data.lastPrice);
    const valor_quantidade = quantity * valor_atual;
    return parseFloat(valor_quantidade.toFixed(2));
  } catch (error) {
    console.error(
      "Erro ao buscar o preço atual:",
      error.response?.data || error.message
    );
    await notificarErroTelegram(`Cotação Atual (${symbol})`, error);
    throw error;
  }
}

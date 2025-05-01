import axios from "axios";
import { saveErrorNotification } from "../database/errorNotification.ts";
import AlertTele from "../sms/telegram.ts";

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
  const apiKey = process.env.API_KEY_PROD || "";
  const baseUrl = process.env.API_URL_PROD || "";

  try {
    const response = await axios.get(
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
    await saveErrorNotification(error.message || String(error));
    // (Opcional) Notifica via Telegram ou outro canal de alerta
    await AlertTele(`❌ Erro ao buscar preço atual:
${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

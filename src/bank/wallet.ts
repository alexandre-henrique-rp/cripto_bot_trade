import crypto from "crypto";
import axios from "axios";


/**
 * Consultar o saldo de uma criptomoeda.
 *
 * @returns {Promise<any>} - A promise que resolve para os dados da API.
 * @throws {Error} - Se a requisição à API falhar.
 *
 */
export default async function getWalletBalance(): Promise<any> {
  const apiKey = process.env.API_KEY_PROD || "";
  const secretKey = process.env.SECRET_KEY_PROD || "";
  const baseUrl = `https://api.binance.com`;

  const timestamp = Date.now();
  const queryString = `timestamp=${timestamp}`;
  const signature = crypto
    .createHmac("sha256", secretKey)
    .update(queryString)
    .digest("hex");

  try {
    const response = await axios.get(
      `${baseUrl}/sapi/v1/asset/wallet/balance`,
      {
        headers: { "X-MBX-APIKEY": apiKey },
        params: { timestamp, signature },
      }
    );

    
    return response.data;
  } catch (error) {
    console.error(
      "Erro ao consultar o saldo:",
      error.response?.data || error.message
    );
    throw error;
  }
};



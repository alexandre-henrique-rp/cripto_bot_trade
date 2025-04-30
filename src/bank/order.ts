import crypto from "crypto";
import axios from "axios";


/**
 * Cria uma nova ordem de compra ou venda.
 *
 * @param {string} quantity - A quantidade de criptomoeda.
 * @param {string} side - O tipo de ordem, "BUY" ou "SELL".
 * @returns {Promise<any>} - A promise que resolve para os dados da API.
 * @throws {Error} - Se a requisição à API falhar.
 *
 */
export default async function newOrden(quantity: string, side: string): Promise<any> {
  const timestamp = Date.now().toString();
  const recvWindow = "60000";
  const data = {
    symbol: process.env.SYMBOL || "",
    side,
    quantity,
    type: "MARKET",
    timestamp,
    recvWindow,
  };
  const secret = process.env.SECRET_KEY_PROD || "";

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
    const response = await axios({
      method: "POST",
      url: `${process.env.API_URL_PROD}/v3/order${qs}`,
      headers: {
        "X-MBX-APIKEY": process.env.API_KEY_PROD || "",
      },
    });
    console.log(response.data);
    return true;
  } catch (error) {
    console.error("Erro ao salvar no banco de dados:", error);
    return false;
  }
}

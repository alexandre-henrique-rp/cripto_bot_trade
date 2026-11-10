import crypto from "crypto";
import { httpGet } from "../lib/http.ts";
import { getBinanceCredentials } from "../config/vault.ts";
import { notificarErroTelegram } from "../sms/notificacoes.ts";

export default async function getSpotWallet() {
  const { apiKey, secretKey, apiUrl: baseUrl } = getBinanceCredentials();

  const timestamp = Date.now();
  const queryString = `timestamp=${timestamp}`;
  const signature = crypto
    .createHmac("sha256", secretKey)
    .update(queryString)
    .digest("hex");

  try {
    const response = await httpGet(`${baseUrl}/v3/account`, {
      headers: { "X-MBX-APIKEY": apiKey },
      params: { timestamp, signature },
    });

    const responseData = {
      ...response.data,
      //trazer o balance que o free for maior que 0.00000000 (ou locked > 0)
      balances: response.data.balances.filter(
        (balance: any) =>
          parseFloat(balance.free) > 0.0 || parseFloat(balance.locked) > 0.0
      ),
    };

    return responseData;
  } catch (error) {
    console.error(
      "Erro ao consultar o saldo:",
      error.response?.data || error.message
    );
    await notificarErroTelegram("Consulta Saldo Spot Binance", error);
    throw error;
  }
}

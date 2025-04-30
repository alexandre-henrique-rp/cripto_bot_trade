import crypto from "crypto";
import axios from "axios";


export default async function getSpotWallet() {
  const apiKey = process.env.API_KEY_PROD || "";
  const secretKey = process.env.SECRET_KEY_PROD || "";
  const baseUrl = `${process.env.API_URL_PROD}`;


  const timestamp = Date.now();
  const queryString = `timestamp=${timestamp}`;
  const signature = crypto
    .createHmac("sha256", secretKey)
    .update(queryString)
    .digest("hex");

  try {
    const response = await axios.get(
      `${baseUrl}/v3/account`,
      {
        headers: { "X-MBX-APIKEY": apiKey },
        params: { timestamp, signature },
      }
    );

    const responseData = {
      ...response.data,
      //trazer o balance que o free for maior que 0.00000000
      balances: response.data.balances.filter((balance: any) => parseFloat(balance.free) > 0.00000000),
    };

    return responseData;
  } catch (error) {
    console.error(
      "Erro ao consultar o saldo:",
      error.response?.data || error.message
    );
  }
};

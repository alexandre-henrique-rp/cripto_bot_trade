import { httpGet } from "../lib/http.ts";

const CMC_BASE_URL = "https://pro-api.coinmarketcap.com";

/**
 * Converte o símbolo de trading (ex: "ETHUSDT") no símbolo de cripto
 * que o CoinMarketCap entende (ex: "ETH").
 */
export function toCmcSymbol(tradingSymbol: string): string {
  return tradingSymbol.replace(/USDT$/i, "").replace(/BUSD$/i, "").toUpperCase();
}

/**
 * Busca o preço atual de uma criptomoeda no CoinMarketCap.
 * Usa o endpoint quotes/latest, cotado em USD. Custa 1 crédito por chamada.
 *
 * @param cmcSymbol Símbolo da cripto no padrão CMC (ex: "ETH").
 * @param apiKey Chave da API do CoinMarketCap.
 * @returns Preço em USD.
 * @throws Se a API falhar ou a chave não estiver configurada.
 */
export async function getCmcPrice(
  cmcSymbol: string,
  apiKey: string
): Promise<number> {
  if (!apiKey) {
    throw new Error(
      "CoinMarketCap API key não configurada. Use /set_cmc_key no Telegram."
    );
  }

  const response = await httpGet(
    `${CMC_BASE_URL}/v1/cryptocurrency/quotes/latest`,
    {
      headers: { "X-CMC_PRO_API_KEY": apiKey },
      params: { symbol: cmcSymbol, convert: "USD" },
      timeout: 15000,
    }
  );

  const quote =
    response.data?.data?.[cmcSymbol]?.quote?.USD?.price ??
    // Alguns retornos vêm como array quando há múltiplos ids para o mesmo símbolo
    response.data?.data?.[cmcSymbol]?.[0]?.quote?.USD?.price;

  if (typeof quote !== "number" || Number.isNaN(quote)) {
    throw new Error(
      `Resposta inesperada do CoinMarketCap para ${cmcSymbol}: ${JSON.stringify(
        response.data?.status ?? response.data
      )}`
    );
  }

  return quote;
}

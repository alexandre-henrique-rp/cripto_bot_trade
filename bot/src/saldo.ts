import getSpotWallet from "../../src/bank/wallet_spot.ts";
import GET_CONFIG from "../../src/database/config.ts";
import formatarMoeda from "../../src/lib/format_moeda.ts";

/**
 * Monta a mensagem de saldo: USDT (dólar) e a cripto configurada (ex: ETH).
 */
export default async function saldo(): Promise<string> {
  try {
    const config = await GET_CONFIG();
    const symbol = config.symbol || process.env.SYMBOL || "SOLUSDT";
    const moeda = symbol.replace("USDT", "");

    const wallet = await getSpotWallet();
    const balances: any[] = wallet?.balances || [];

    const usdt = parseFloat(
      balances.find((b) => b.asset === "USDT")?.free || "0"
    );
    const cripto = parseFloat(
      balances.find((b) => b.asset === moeda)?.free || "0"
    );

    return (
      `💰 *Saldo da conta*\n\n` +
      `• USDT (dólar): ${formatarMoeda(usdt)}\n` +
      `• ${moeda}: ${cripto}`
    );
  } catch (error: any) {
    return `❌ Erro ao consultar saldo: ${error?.message || String(error)}`;
  }
}

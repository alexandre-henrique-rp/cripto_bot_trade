import { httpGet } from "../../src/lib/http.ts";
import { getBinanceCredentials } from "../../src/config/vault.ts";
import getSpotWallet from "../../src/bank/wallet_spot.ts";
import formatarMoeda from "../../src/lib/format_moeda.ts";

export interface BalanceBinance {
  asset: string;
  free: string;
  locked?: string;
}

export interface ItemCarteira {
  asset: string;
  free: number;
  locked: number;
  total: number;
  valorUsd: number | null;
}

const STABLECOINS_USD = new Set(["USDT", "USDC", "FDUSD", "BUSD", "TUSD", "USDP"]);

/**
 * Converte a lista de saldos da Binance e um mapa de preços (ex: { SOLUSDT: 180 })
 * em itens enriquecidos com o valor estimado em dólar, ordenados do maior para o menor.
 */
export function calcularItensCarteira(
  balances: BalanceBinance[],
  precosMap: Record<string, number>
): { itens: ItemCarteira[]; totalUsd: number } {
  let totalUsd = 0;

  const itens: ItemCarteira[] = balances
    .map((b) => {
      const asset = (b.asset || "").toUpperCase();
      const free = parseFloat(b.free || "0") || 0;
      const locked = parseFloat(b.locked || "0") || 0;
      const total = free + locked;

      let valorUsd: number | null = null;
      if (STABLECOINS_USD.has(asset)) {
        valorUsd = total;
      } else if (typeof precosMap[`${asset}USDT`] === "number") {
        valorUsd = total * precosMap[`${asset}USDT`];
      }

      if (valorUsd !== null) {
        totalUsd += valorUsd;
      }

      return { asset, free, locked, total, valorUsd };
    })
    .filter((item) => item.total > 0)
    .sort((a, b) => (b.valorUsd ?? -1) - (a.valorUsd ?? -1));

  return { itens, totalUsd };
}

/**
 * Formata a mensagem de texto puro para exibição no Telegram.
 */
export function formatarMensagemCarteira(
  itens: ItemCarteira[],
  totalUsd: number
): string {
  if (!itens.length) {
    return "💼 Carteira Binance Spot\n\nNenhum ativo com saldo positivo encontrado.";
  }

  const linhas = itens.map((item) => {
    const qtdTxt = Number(item.total.toFixed(8)).toString();
    const lockedTxt =
      item.locked > 0
        ? ` (disp: ${Number(item.free.toFixed(8))} | ordem: ${Number(
            item.locked.toFixed(8)
          )})`
        : "";
    const usdTxt =
      item.valorUsd !== null ? ` ≈ ${formatarMoeda(item.valorUsd)}` : "";
    return `• ${item.asset}: ${qtdTxt}${lockedTxt}${usdTxt}`;
  });

  return (
    `💼 Carteira Binance Spot\n\n` +
    linhas.join("\n") +
    `\n\n💵 Total estimado: ${formatarMoeda(totalUsd)}`
  );
}

/**
 * Busca os preços atuais de todos os pares na Binance para estimar o saldo em USD.
 * Se falhar, retorna mapa vazio para não impedir a listagem das quantidades.
 */
async function buscarMapaPrecosBinance(): Promise<Record<string, number>> {
  const { apiUrl } = getBinanceCredentials();
  const baseUrl = apiUrl || "https://api.binance.com/api";
  try {
    const response = await httpGet(`${baseUrl}/v3/ticker/price`, {
      timeout: 10000,
    });
    const mapa: Record<string, number> = {};
    if (Array.isArray(response.data)) {
      for (const row of response.data) {
        if (row?.symbol && row?.price) {
          const p = parseFloat(row.price);
          if (!Number.isNaN(p)) mapa[row.symbol] = p;
        }
      }
    }
    return mapa;
  } catch {
    return {};
  }
}

/**
 * Comando /carteira — consulta todos os ativos com saldo na conta Spot da Binance.
 */
export default async function carteira(): Promise<string> {
  try {
    const [wallet, precosMap] = await Promise.all([
      getSpotWallet(),
      buscarMapaPrecosBinance(),
    ]);
    const balances: BalanceBinance[] = wallet?.balances || [];
    const { itens, totalUsd } = calcularItensCarteira(balances, precosMap);
    return formatarMensagemCarteira(itens, totalUsd);
  } catch (error: any) {
    return `❌ Erro ao consultar carteira na Binance: ${
      error?.message || String(error)
    }`;
  }
}

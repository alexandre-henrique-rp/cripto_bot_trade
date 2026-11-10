import crypto from "crypto";
import { httpGet } from "../lib/http.ts";
import { getBinanceCredentials } from "../config/vault.ts";
import getSpotWallet from "./wallet_spot.ts";
import POST_DB from "../database/post.ts";
import UPDATE_DB from "../database/update.ts";
import GET_DB from "../database/get.ts";
import AlertTele from "../sms/telegram.ts";
import formatarMoeda from "../lib/format_moeda.ts";
import { ajustarQuantidadePorSimbolo } from "../lib/symbol.ts";

// Valor mínimo em USD para considerar que existe uma posição real na carteira
// (ignora "poeira" / frações residuais que a Binance não permite vender).
export const MIN_POSICAO_USD = 5;

// Intervalo mínimo entre verificações automáticas de saldo na Binance (60s),
// para não fazer chamadas REST a cada tick do WebSocket.
let ultimaVerificacaoMs = 0;
const INTERVALO_SYNC_MS = 60 * 1000;

export interface TradeBinance {
  price: string;
  qty: string;
  isBuyer: boolean;
  time: number;
}

/**
 * Extrai o preço da última compra (isBuyer = true) a partir do histórico de trades
 * da Binance. Se não houver, retorna o preço de fallback (cotação atual).
 */
export function extrairPrecoUltimaCompra(
  trades: TradeBinance[],
  fallbackPrice: number
): number {
  if (!Array.isArray(trades) || trades.length === 0) return fallbackPrice;
  const compras = trades.filter((t) => t && t.isBuyer === true);
  if (compras.length === 0) return fallbackPrice;

  // Ordena pelo timestamp (mais recente por último)
  compras.sort((a, b) => (a.time || 0) - (b.time || 0));
  const ultima = compras[compras.length - 1];
  const preco = parseFloat(ultima.price);
  return Number.isFinite(preco) && preco > 0 ? preco : fallbackPrice;
}

/**
 * Valida se o preço manual informado em /assumir está dentro de uma banda
 * razoável em relação ao preço atual de mercado (entre 20% e 500%),
 * evitando manipulação contábil acidental ou maliciosa.
 */
export function validarPrecoManual(
  precoManual: number,
  precoAtual: number
): boolean {
  if (!Number.isFinite(precoManual) || precoManual <= 0) return false;
  if (!Number.isFinite(precoAtual) || precoAtual <= 0) return true;
  return precoManual >= precoAtual * 0.2 && precoManual <= precoAtual * 5;
}

/**
 * Avalia se o saldo da moeda na carteira Spot configura uma posição válida
 * para ser assumida pelo bot.
 */
export function avaliarPosicaoCarteira(
  saldoLivre: number,
  symbol: string,
  precoAtual: number
): { assumir: boolean; quantidadeAjustada: number; valorEstimadoUsd: number } {
  const quantidadeAjustada = ajustarQuantidadePorSimbolo(saldoLivre, symbol);
  const valorEstimadoUsd = Number((quantidadeAjustada * precoAtual).toFixed(2));
  const assumir =
    quantidadeAjustada > 0 && valorEstimadoUsd >= MIN_POSICAO_USD;
  return { assumir, quantidadeAjustada, valorEstimadoUsd };
}

/**
 * Consulta o último preço de compra do par na Binance (/v3/myTrades).
 * Em caso de falha ou sem histórico, retorna fallbackPrice.
 */
async function buscarUltimoPrecoCompraBinance(
  symbol: string,
  fallbackPrice: number
): Promise<number> {
  const { apiKey, secretKey, apiUrl } = getBinanceCredentials();
  const baseUrl = apiUrl || "https://api.binance.com/api";

  if (!apiKey || !secretKey) return fallbackPrice;

  try {
    const timestamp = Date.now();
    const queryString = `symbol=${symbol}&limit=20&timestamp=${timestamp}`;
    const signature = crypto
      .createHmac("sha256", secretKey)
      .update(queryString)
      .digest("hex");

    const response = await httpGet(`${baseUrl}/v3/myTrades`, {
      headers: { "X-MBX-APIKEY": apiKey },
      params: { symbol, limit: 20, timestamp, signature },
      timeout: 10000,
    });

    return extrairPrecoUltimaCompra(response.data, fallbackPrice);
  } catch {
    return fallbackPrice;
  }
}

/**
 * Verifica na Binance se já existe saldo da cripto quando o banco local diz
 * que não há compra em aberto. Se encontrar saldo relevante, importa para a
 * tabela Wallet para que o bot passe a monitorar a VENDA daquele saldo.
 */
export async function sincronizarPosicaoExistente(
  symbol: string,
  currentPrice: number,
  forcarVerificacao: boolean = false,
  precoManual?: number
): Promise<{
  assumiu: boolean;
  quantidade: number;
  precoCompra: number;
  walletId: string;
} | null> {
  const agora = Date.now();
  if (!forcarVerificacao && agora - ultimaVerificacaoMs < INTERVALO_SYNC_MS) {
    return null;
  }
  ultimaVerificacaoMs = agora;

  const walletSpot = await getSpotWallet();
  const moeda = symbol.replace("USDT", "");
  const saldoLivre = parseFloat(
    walletSpot?.balances?.find((b: any) => b.asset === moeda)?.free || "0"
  );

  const avaliacao = avaliarPosicaoCarteira(saldoLivre, symbol, currentPrice);
  if (!avaliacao.assumir) {
    return {
      assumiu: false,
      quantidade: avaliacao.quantidadeAjustada,
      precoCompra: 0,
      walletId: "",
    };
  }

  if (precoManual !== undefined) {
    if (!validarPrecoManual(precoManual, currentPrice)) {
      throw new Error(
        `Preço manual (${formatarMoeda(
          precoManual
        )}) fora da faixa plausível em relação ao mercado atual (${formatarMoeda(
          currentPrice
        )}).`
      );
    }
  }

  const precoCompra =
    precoManual && precoManual > 0
      ? precoManual
      : await buscarUltimoPrecoCompraBinance(symbol, currentPrice);

  const usdInvestido = Number((avaliacao.quantidadeAjustada * precoCompra).toFixed(2));

  // Verifica se já existe registro aberto para atualizar ou cria um novo.
  const walletAtual = await GET_DB(symbol);
  let walletId = walletAtual?.id || "";

  if (
    walletAtual?.id &&
    walletAtual.sellPrice === true &&
    walletAtual.symbol?.toUpperCase() === symbol.toUpperCase()
  ) {
    await UPDATE_DB({
      id: walletAtual.id,
      symbol,
      price: precoCompra,
      quantity: String(avaliacao.quantidadeAjustada),
      usd: usdInvestido,
      sellPrice: true,
    });
  } else {
    const salvo = await POST_DB({
      symbol,
      price: precoCompra,
      quantity: String(avaliacao.quantidadeAjustada),
      usd: usdInvestido,
      sellPrice: true,
    });
    walletId = salvo?.id || "";
  }

  await AlertTele(
    `🔄 *Posição existente assumida da Binance!*\n` +
      `Moeda: ${symbol}\n` +
      `Quantidade: ${avaliacao.quantidadeAjustada}\n` +
      `Preço base de compra: ${formatarMoeda(precoCompra)}\n` +
      `Valor estimado: ${formatarMoeda(usdInvestido)}\n` +
      `O bot agora está monitorando o momento de *VENDA* para esse saldo.`
  );

  return {
    assumiu: true,
    quantidade: avaliacao.quantidadeAjustada,
    precoCompra,
    walletId,
  };
}

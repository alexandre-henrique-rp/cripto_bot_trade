import getSpotWallet from "../../src/bank/wallet_spot.ts";
import getCurrentPrice from "../../src/bank/currentPrice.ts";
import GET_CONFIG from "../../src/database/config.ts";
import GET_DB from "../../src/database/get.ts";
import { getMonitorState } from "../../src/database/monitorState.ts";
import { obterMedias } from "../../src/analise/medias.ts";
import { decidirReversao } from "../../src/analise/estrategia.ts";
import { sincronizarPosicaoExistente } from "../../src/bank/syncPosition.ts";
import formatarMoeda from "../../src/lib/format_moeda.ts";
import { ajustarQuantidadePorSimbolo } from "../../src/lib/symbol.ts";

export interface DadosAtualizacao {
  symbol: string;
  moeda: string;
  usdtLivre: number;
  saldoMoeda: number;
  valorMoedaUsd: number;
  precoAtual: number;
  posicaoLiberada: boolean;
  temCripto: boolean;
  precoCompra: number;
  fase: string;
  decisaoAcao: string;
  decisaoMotivo: string;
  mediasDisponiveis: boolean;
  mediaMinima?: number;
  mediaVenda?: number;
  mediaGeral?: number;
  maxAlta?: number;
  reversalPercent: number;
}

/**
 * Formata o relatório de sincronização e recálculo da estratégia
 * para envio ao usuário no Telegram.
 */
export function formatarMensagemAtualizar(dados: DadosAtualizacao): string {
  let avisoVenda = "";
  if (dados.posicaoLiberada) {
    avisoVenda =
      `⚠️ *Detectada venda manual na Binance!*\n` +
      `O saldo anterior de ${dados.moeda} foi liquidado na corretora. O bot liberou a posição anterior no banco e está pronto para uma nova COMPRA.\n\n`;
  }

  const statusPosicao = dados.temCripto
    ? `🟢 Posicionado (Monitorando VENDA)\n• Preço base de compra: ${formatarMoeda(
        dados.precoCompra
      )}`
    : `⚪ Sem cripto (Aguardando oportunidade de COMPRA)`;

  let blocoMedias = `• Médias da janela: Aguardando dados do CoinMarketCap\n`;
  if (dados.mediasDisponiveis && dados.mediaMinima && dados.mediaVenda) {
    blocoMedias =
      `• Média Mínima (zona de compra): ${formatarMoeda(dados.mediaMinima)}\n` +
      `• Média de Venda (zona de venda): ${formatarMoeda(dados.mediaVenda)}\n` +
      `• Média Geral: ${formatarMoeda(dados.mediaGeral || 0)}\n` +
      (dados.maxAlta
        ? `• Máxima da janela: ${formatarMoeda(dados.maxAlta)}\n`
        : "");
  }

  let acaoEmoji = "⏳";
  if (dados.decisaoAcao === "COMPRAR") acaoEmoji = "🟢 COMPRAR";
  else if (dados.decisaoAcao === "VENDER") acaoEmoji = "🔴 VENDER";
  else acaoEmoji = "⏸️ AGUARDAR";

  return (
    `🔄 *Sincronização e Recálculo com a Binance*\n\n` +
    avisoVenda +
    `💰 *Saldos na Binance Spot:*\n` +
    `• USDT (dólar livre): ${formatarMoeda(dados.usdtLivre)}\n` +
    `• ${dados.moeda}: ${dados.saldoMoeda} (~${formatarMoeda(
      dados.valorMoedaUsd
    )})\n\n` +
    `📌 *Posição do Bot:*\n` +
    `• Estado: ${statusPosicao}\n\n` +
    `📊 *Mercado e Análise:*\n` +
    `• Preço atual do ${dados.symbol}: ${formatarMoeda(dados.precoAtual)}\n` +
    blocoMedias +
    `• Reversão configurada: ${dados.reversalPercent}%\n\n` +
    `🚦 *Próximo passo na estratégia:*\n` +
    `• Sugestão imediata: ${acaoEmoji}\n` +
    `• Situação: ${dados.decisaoMotivo}`
  );
}

/**
 * /atualizar ou /sincronizar — consulta a Binance na hora, sincroniza o banco
 * de dados (fecha posição se o usuário vendeu na Binance ou assume se comprou),
 * busca as médias e recalcula imediatamente a estratégia de compra/venda.
 */
export default async function atualizar(): Promise<string> {
  try {
    const config = await GET_CONFIG();
    const symbol = config.symbol || process.env.SYMBOL || "SOLUSDT";
    const moeda = symbol.replace("USDT", "");
    const reversal = config.reversal_percent || 5;

    // 1) Consulta a Binance Spot para obter saldos reais
    const walletSpot = await getSpotWallet();
    const balances: any[] = walletSpot?.balances || [];
    const usdtLivre = parseFloat(
      balances.find((b) => b.asset === "USDT")?.free || "0"
    );
    const saldoMoedaRaw = parseFloat(
      balances.find((b) => b.asset === moeda)?.free || "0"
    );
    const saldoMoeda = ajustarQuantidadePorSimbolo(saldoMoedaRaw, symbol);

    // 2) Consulta a cotação atual do par na Binance
    const precoAtual = await getCurrentPrice(symbol, 1);
    const valorMoedaUsd = Number((saldoMoeda * precoAtual).toFixed(2));

    // 3) Sincroniza a posição no banco (assume se comprou, libera se vendeu)
    const syncRes = await sincronizarPosicaoExistente(symbol, precoAtual, true);
    const posicaoLiberada = Boolean(syncRes?.posicaoLiberada);

    // 4) Lê o estado da carteira no banco atualizado
    const walletDb = await GET_DB(symbol);
    const mesmaMoeda =
      !walletDb?.symbol ||
      walletDb.symbol.toUpperCase() === symbol.toUpperCase();
    const temCripto =
      walletDb?.sellPrice === true && !!walletDb?.price && mesmaMoeda;
    const precoCompra = walletDb?.price || 0;

    // 5) Carrega as médias do CoinMarketCap
    const medias = await obterMedias(symbol, config.analysis_window_days || 1);

    // 6) Recalcula a estratégia com o estado atual
    let decisaoAcao = "NENHUMA";
    let decisaoMotivo = "Aguardando médias para recálculo.";
    if (medias) {
      const estadoBanco = await getMonitorState();
      const resultado = decidirReversao(
        temCripto,
        precoAtual,
        medias,
        reversal,
        estadoBanco
      );
      decisaoAcao = resultado.acao;
      decisaoMotivo = resultado.motivo;
    }

    const dados: DadosAtualizacao = {
      symbol,
      moeda,
      usdtLivre,
      saldoMoeda,
      valorMoedaUsd,
      precoAtual,
      posicaoLiberada,
      temCripto,
      precoCompra,
      fase: temCripto ? "MONITOR_SELL" : "MONITOR_BUY",
      decisaoAcao,
      decisaoMotivo,
      mediasDisponiveis: Boolean(medias),
      mediaMinima: medias?.mediaMinima,
      mediaVenda: medias?.mediaVenda,
      mediaGeral: medias?.mediaGeral,
      maxAlta: medias?.maxAlta,
      reversalPercent: reversal,
    };

    return formatarMensagemAtualizar(dados);
  } catch (error: any) {
    return `❌ Erro ao sincronizar com a Binance: ${
      error?.message || String(error)
    }`;
  }
}

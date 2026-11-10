import GET_DB from "../../src/database/get.ts";
import GET_CONFIG from "../../src/database/config.ts";
import getCurrentPrice from "../../src/bank/currentPrice.ts";
import formatarMoeda from "../../src/lib/format_moeda.ts";
import { obterMedias } from "../../src/analise/medias.ts";

export default async function relatorio(): Promise<{
  data: string | null;
  error: string | null;
}> {
  try {
    const configDb = await GET_CONFIG();
    const symbolAtivo = configDb.symbol || process.env.SYMBOL || "SOLUSDT";
    const walletDb = await GET_DB(symbolAtivo);
    const symbol =
      configDb.symbol || process.env.SYMBOL || walletDb.symbol || "SOLUSDT";
    const mesmaMoeda =
      !walletDb?.symbol ||
      walletDb.symbol.toUpperCase() === symbol.toUpperCase();
    const priceCompra = walletDb.price || 0;
    const usd = walletDb.usd || 0;
    const quantity = Number(walletDb.quantity) || 0;
    const dateCompra = walletDb.createdAt
      ? new Date(walletDb.createdAt)
      : new Date();

    // Alvo de venda agora vem da estratégia (média de venda da janela).
    const medias = await obterMedias(
      symbol,
      configDb.analysis_window_days || 1
    );
    const priceVendaAlvo = medias?.mediaVenda ?? 0;

    // Cotação atual (preço unitário).
    let precoAtual = 0;
    try {
      precoAtual = await getCurrentPrice(symbol, 1);
    } catch {
      precoAtual = medias?.precoAtual ?? 0;
    }

    // Sem posição comprada em aberto: mostra a referência de compra.
    if (
      !walletDb ||
      !walletDb.symbol ||
      walletDb.sellPrice !== true ||
      !mesmaMoeda
    ) {
      const refCompra = medias
        ? `\n• Referência de compra (média mínima): ${formatarMoeda(
            medias.mediaMinima
          )}\n• Referência de venda (média de venda): ${formatarMoeda(
            medias.mediaVenda
          )}`
        : "\n(ainda coletando dados do CoinMarketCap para calcular as médias)";
      return {
        error:
          `ℹ️ Nenhuma compra em aberto.\nCotação atual: ${formatarMoeda(
            precoAtual
          )} para ${symbol.replace("USDT", "")}.` + refCompra,
        data: null,
      };
    }

    const valorAtual = quantity * precoAtual;
    const resultadoFinal = valorAtual - usd;
    const resultadoPercentual = usd > 0 ? (resultadoFinal / usd) * 100 : 0;

    const msg =
      `📊 *Relatório de Operação*\n\n` +
      `• *Símbolo:* ${symbol}\n` +
      `• *Data da compra:* ${dateCompra.toLocaleDateString(
        "pt-BR"
      )} às ${dateCompra.toLocaleTimeString("pt-BR")}\n` +
      `• *Quantidade comprada:* ${quantity}\n` +
      `• *Preço de compra:* ${formatarMoeda(priceCompra)}\n` +
      `• *Valor investido:* ${formatarMoeda(usd)}\n` +
      `• *Alvo de venda (média de venda):* ${formatarMoeda(priceVendaAlvo)}\n` +
      `• *Cotação atual:* ${formatarMoeda(precoAtual)}\n` +
      `• *Valor se vendesse agora:* ${formatarMoeda(valorAtual)}\n` +
      `• *Ganho/Perda:* ${formatarMoeda(
        resultadoFinal
      )} (${resultadoPercentual.toFixed(2)}%)\n`;

    return { data: msg, error: null };
  } catch (error: any) {
    console.log(error);
    return {
      error: `Erro ao gerar relatório: ${error?.message || String(error)}`,
      data: null,
    };
  }
}

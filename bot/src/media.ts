import GET_CONFIG from "../../src/database/config.ts";
import { obterMedias } from "../../src/analise/medias.ts";
import formatarMoeda from "../../src/lib/format_moeda.ts";

/**
 * Monta a mensagem com as 4 médias da janela de análise (24h -> 5 dias).
 */
export default async function media(): Promise<string> {
  try {
    const config = await GET_CONFIG();
    const symbol = config.symbol || process.env.SYMBOL || "SOLUSDT";
    const janela = config.analysis_window_days || 1;

    const m = await obterMedias(symbol, janela);
    if (!m) {
      return `⏳ Ainda coletando dados do CoinMarketCap para ${symbol}. Aguarde alguns ciclos de coleta.`;
    }

    return (
      `📊 *Médias de ${symbol}* (janela: ${m.janelaDias} dia(s), ${m.amostras} amostras)\n\n` +
      `• 🔺 Máxima (max alta): ${formatarMoeda(m.maxAlta)}\n` +
      `• 🟢 Média de venda: ${formatarMoeda(m.mediaVenda)}\n` +
      `• ⚪ Média geral: ${formatarMoeda(m.mediaGeral)}\n` +
      `• 🔵 Média mínima: ${formatarMoeda(m.mediaMinima)}\n` +
      `• 🔻 Mínima (min max): ${formatarMoeda(m.minMax)}\n\n` +
      `• Preço atual (última coleta): ${formatarMoeda(m.precoAtual)}`
    );
  } catch (error: any) {
    return `❌ Erro ao calcular médias: ${error?.message || String(error)}`;
  }
}

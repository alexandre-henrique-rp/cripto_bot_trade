import GET_CONFIG, { UPDATE_CONFIG } from "../../src/database/config.ts";
import {
  verificarProntidao,
  textoProntidao,
} from "../../src/config/credentials.ts";
import getCurrentPrice from "../../src/bank/currentPrice.ts";
import { sincronizarPosicaoExistente } from "../../src/bank/syncPosition.ts";
import formatarMoeda from "../../src/lib/format_moeda.ts";

/**
 * /verificar — mostra o estado das credenciais e se a operação está ligada.
 */
export async function verificar(): Promise<string> {
  const config = await GET_CONFIG();
  return `🔎 *Verificação do bot*\n\n${textoProntidao(config)}`;
}

/**
 * /iniciar — liga a operação, mas só se as credenciais estiverem completas.
 */
export async function iniciar(): Promise<string> {
  const config = await GET_CONFIG();
  const p = verificarProntidao(config);
  if (!p.pronto) {
    return (
      `⚠️ Não é possível iniciar: faltam credenciais.\n\n` +
      p.faltando.map((f) => `• ${f}`).join("\n") +
      `\n\nConfigure o que falta e rode /iniciar novamente.`
    );
  }
  await UPDATE_CONFIG({ enabled: true });
  return "🟢 Bot LIGADO. A partir de agora ele pode comprar e vender conforme a estratégia.";
}

/**
 * /parar — desliga a operação (para de comprar/vender). A coleta de preços
 * e os comandos continuam funcionando.
 */
export async function parar(): Promise<string> {
  await UPDATE_CONFIG({ enabled: false });
  return "⏸️ Bot DESLIGADO. Ele para de comprar/vender, mas continua coletando preços. Use /iniciar para religar.";
}

/**
 * /assumir [preco] — força a sincronização imediata do saldo da moeda (ex: SOL)
 * que já está na Binance Spot para o bot monitorar a VENDA.
 */
export async function assumirPosicao(precoManual?: number): Promise<string> {
  try {
    const config = await GET_CONFIG();
    const symbol = config.symbol || process.env.SYMBOL || "SOLUSDT";
    const precoAtual = await getCurrentPrice(symbol, 1);
    const res = await sincronizarPosicaoExistente(
      symbol,
      precoAtual,
      true,
      precoManual
    );

    if (!res || !res.assumiu) {
      return `ℹ️ Nenhum saldo suficiente de ${symbol.replace(
        "USDT",
        ""
      )} encontrado na carteira Spot da Binance (mínimo US$ 5).`;
    }

    return (
      `✅ Posição assumida com sucesso!\n` +
      `• Par: ${symbol}\n` +
      `• Quantidade: ${res.quantidade}\n` +
      `• Preço base de compra: ${formatarMoeda(res.precoCompra)}\n` +
      `• Status: monitorando momento de VENDA.`
    );
  } catch (error: any) {
    return `❌ Erro ao assumir posição da Binance: ${
      error?.message || String(error)
    }`;
  }
}

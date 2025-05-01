import { Telegraf } from "telegraf";
import GET_DB from "../src/database/get.ts";
import calcularLucro from "../src/calculador/profitability.ts";
import formatarMoeda from "../src/lib/format_moeda.ts";
import getCurrentPrice from "../src/bank/currentPrice.ts";
import GET_CONFIG from "../src/database/config.ts";

const token = process.env.BOT_TOKEN || "";

const Bot = new Telegraf(token);

Bot.on('text', async (ctx) => {
  const sms = ctx.update.message.text;
  console.log('🚀 ~ file: index.ts:92 ~ Bot.on ~ ctx:', sms)
  if (sms === "#RELATORIO") {
    const walletDb = await GET_DB();
    const configDb = await GET_CONFIG();
    console.log("🚀 ~ Bot.on ~ walletDb:", walletDb)

    const symbol = walletDb.symbol || process.env.SYMBOL || "";
    const priceCompra = walletDb.price || 0;
    const usd = walletDb.usd || 0;
    const quantity = Number(walletDb.quantity) || 0;
    const dateCompra = walletDb.createdAt ? new Date(walletDb.createdAt) : new Date();
    const priceVendaAlvo = calcularLucro(priceCompra, dateCompra, "venda");

    // Buscar cotação atual da moeda
    let precoAtual = 0;
    try {
      // A função getCurrentPrice espera (symbol, quantity), mas para cotação só precisamos do preço unitário
      // Então passamos quantity=1 para obter o preço de 1 unidade
      precoAtual = await getCurrentPrice(symbol, 1);
    } catch (e) {
      precoAtual = 0;
    }

    if (!walletDb || !walletDb.symbol) {
      await ctx.reply("Nenhum registro de compra encontrado.");
      await ctx.reply("esse bot esta configurado para fazer compras apenas quando o preço atual for menor ou igual a " + formatarMoeda(configDb.taxa_min, 'USD') + ",\n\ne o preço atual esta " + formatarMoeda(precoAtual, 'USD') + " para o " + symbol.replace("USDT", ""));
      return;
    }
    // Lucro/prejuízo estimado se vendesse agora
    const lucroAtual = quantity * (precoAtual - priceCompra);
    // Lucro/prejuízo percentual em relação ao valor investido
    const lucroPercentual = usd > 0 ? (lucroAtual / usd) * 100 : 0;

    // Valor se vendesse agora
    const valorAtual = quantity * precoAtual;
    // Ganho ou perda em relação ao valor investido
    const resultadoFinal = valorAtual - usd;
    // Percentual do ganho/perda sobre o investido
    const resultadoPercentual = usd > 0 ? (resultadoFinal / usd) * 100 : 0;

    // Mensagem detalhada e didática
    const msg =
      `📊 *Relatório de Operação*\n\n` +
      `• *Símbolo:* ${symbol}\n` +
      `• *Data da compra:* ${dateCompra.toLocaleDateString("pt-BR")} às ${dateCompra.toLocaleTimeString("pt-BR")}\n` +
      `• *Quantidade comprada:* ${quantity}\n` +
      `• *Preço de compra:* ${formatarMoeda(priceCompra, 'USD')}\n` +
      `• *Valor investido:* ${formatarMoeda(usd, 'USD')}\n` +
      `• *Preço de venda alvo:* ${formatarMoeda(priceVendaAlvo, 'USD')}\n` +
      `• *Cotação atual:* ${formatarMoeda(precoAtual, 'USD')}\n` +
      `• *Valor se vendesse agora:* ${formatarMoeda(valorAtual, 'USD')}\n` +
      `• *Ganho/Perda em relação ao investido:* ${formatarMoeda(resultadoFinal, 'USD')} (${resultadoPercentual.toFixed(2)}%)\n`;

    await ctx.replyWithMarkdown(msg);
  }
})

Bot.launch();

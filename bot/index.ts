import { Telegraf } from "telegraf";
import GET_DB from "../src/database/get.ts";
import calcularLucro from "../src/calculador/profitability.ts";
import formatarMoeda from "../src/lib/format_moeda.ts";

const token = process.env.BOT_TOKEN || "";

const Bot = new Telegraf(token);

Bot.on('text', async (ctx) => {
  const sms = ctx.update.message.text;
  console.log('🚀 ~ file: index.ts:92 ~ Bot.on ~ ctx:', sms)
  if(sms === "#RELATORIO"){
    const walletDb = await GET_DB();
    const priceCompra = walletDb?.price || 0;
    const usd = walletDb?.usd || 0;
    const quantity = walletDb?.quantity || 0;
    const DateCompra = walletDb?.createdAt || new Date();
    const price_venda = calcularLucro(priceCompra, DateCompra, "venda");
    // quanto eu vou lucar se eu vender a quantity pelo price_venda
    const lucro = quantity * (price_venda - priceCompra);


    const msg = `Relatorio:\n\nNo dia ${new Date(walletDb.createdAt).toLocaleDateString("pt-BR")} as ${new Date(walletDb.createdAt).toLocaleTimeString("pt-BR")}\nFoi comprado ${walletDb.quantity} ${walletDb.symbol}\npor ${formatarMoeda(walletDb.price || 0, 'USD')} totalizando ${formatarMoeda(walletDb.usd || 0, 'USD')}\nAgardadon ser vendido por ${formatarMoeda(price_venda, 'USD')}\n lucor estimado é de ${formatarMoeda(lucro, 'USD')}`;
    console.log("🚀 ~ Bot.on ~ walletDb:", walletDb)
    Bot.telegram.sendMessage(process.env.CHAT_ID || "", msg);
  }
})

Bot.launch();


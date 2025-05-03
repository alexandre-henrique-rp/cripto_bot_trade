import { Telegraf } from "telegraf";
import formatarMoeda from "../src/lib/format_moeda.ts";
import relatorio from "./src/relatorio.ts";
import ultimaVenda from "./src/ultima_venda.ts";

const token = process.env.BOT_TOKEN || "";

const Bot = new Telegraf(token);


Bot.command('relatorio', async (ctx) => {
  const info = await relatorio();
 
  if (!info.data) {
    await ctx.reply("Nenhum registro de compra encontrado.");
    await ctx.reply(info.error || "");
  } else {
  await ctx.reply(info.data);
  }
})

Bot.command('ultima', async (ctx) => {
  const info = await ultimaVenda();

   if (!info) {
    await ctx.reply("Nenhuma venda encontrada.");
  } else {
    await ctx.reply(info);
  }
})


Bot.launch();

// Enable graceful stop
process.once('SIGINT', () => Bot.stop('SIGINT'))
process.once('SIGTERM', () => Bot.stop('SIGTERM'))
import { Telegraf } from "telegraf";

const Bot = new Telegraf(process.env.BOT_TOKEN || "");

export default async function AlertTele(msg: string) {
  try {
    Bot.telegram.sendMessage(process.env.CHAT_ID || "", msg);
  } catch (error) {
    console.log(error);
  }
}
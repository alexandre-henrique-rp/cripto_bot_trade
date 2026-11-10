import { Telegraf } from "telegraf";
import { getTelegramCredentials } from "../config/vault.ts";

let botInstance: Telegraf | null = null;

function obterBot(): Telegraf {
  if (!botInstance) {
    const { botToken } = getTelegramCredentials();
    botInstance = new Telegraf(botToken);
  }
  return botInstance;
}

export default async function AlertTele(msg: string) {
  try {
    const { chatId } = getTelegramCredentials();
    await obterBot().telegram.sendMessage(chatId, msg);
  } catch (error) {
    console.log(error);
  }
}
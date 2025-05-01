
import { PrismaClient } from "@prisma/client";
import AlertTele from "../sms/telegram.ts";
import { saveErrorNotification } from "./errorNotification.ts";

const Prisma = new PrismaClient();

interface Wallet {
  id: string;
  symbol?: string | null;
  price?: number | null;
  quantity?: string | null;
  usd?: number | null;
  sellPrice: boolean;
}
/**
 * Atualizar o valor atual de uma criptomoeda, considerando a quantidade.
 *
 * @param {Wallet} wallet - {id: string, symbol: string, price: number, quantity: string, usd: number, sellPrice: boolean} - O objeto contendo o preço atual da criptomoeda.
 * @returns {Promise<Wallet | null>} - A promise que resolve quando o preço atual for atualizado.
 * @throws {Error} - Se houver um erro na requisição.
 *
 */
export default async function UPDATE_DB(wallet: Wallet): Promise<Wallet | null> {
  try {
    const result = await Prisma.wallet.update({
      where: {
        id: wallet.id,
      },
      data: wallet,
    });
    console.log(result);
    return result;
  } catch (error) {
    console.log(error);
    await saveErrorNotification(error.message || String(error));
    // (Opcional) Notifica via Telegram ou outro canal de alerta
    await AlertTele(`❌ Erro ao salvar registro no banco:\n${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}
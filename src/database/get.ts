import { PrismaClient } from "@prisma/client";
import { saveErrorNotification } from "./errorNotification.ts";
import AlertTele from "../sms/telegram.ts";

const Prisma = new PrismaClient();

interface Wallet {
  id: string;
  symbol: string | null;
  price: number | null;
  quantity: string | null;
  usd: number | null;
  sellPrice: boolean;
  createdAt: Date;
  updatedAt: Date | null;
}
/**
 * Buscar o valor atual de uma criptomoeda, considerando a quantidade.
 *
 * @returns {Promise<Wallet>} - A promise que resolve para o preço atual da criptomoeda.
 * @throws {Error} - Se houver um erro na requisição.
 *
 */
export default async function GET_DB(): Promise<Wallet> {
  try {
    const result = await Prisma.wallet.findFirst({
      orderBy: { id: 'desc' },
    });
    
    if (!result) {
      // Return a default Wallet object if no record is found
      return {
        id: '',
        symbol: null,
        price: null,
        quantity: null,
        usd: null,
        sellPrice: false,
        createdAt: new Date(),
        updatedAt: null
      };
    }
    
    return result;
  } catch (error) {
    console.log(error);
    await saveErrorNotification(error.message || String(error));
    // (Opcional) Notifica via Telegram ou outro canal de alerta
    await AlertTele(`❌ Erro ao buscar registro no banco:\n${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}
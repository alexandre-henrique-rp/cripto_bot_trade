
import { PrismaClient } from "@prisma/client";

const Prisma = new PrismaClient();

interface Wallet {
  id: string;
  symbol?: string | null;
  price?: number | null;
  quantity?: number | null;  
  usd?: number | null;
  sellPrice: boolean;
}
/**
 * Atualizar o valor atual de uma criptomoeda, considerando a quantidade.
 *
 * @param {Wallet} wallet - {id: string, symbol: string, price: number, quantity: number, usd: number, sellPrice: boolean} - O objeto contendo o preço atual da criptomoeda.
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
    return null;
  }
}
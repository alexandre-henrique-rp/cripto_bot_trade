import { PrismaClient } from "@prisma/client";


const Prisma = new PrismaClient();

interface Wallet {
  symbol: string|null;
  price: number|null;
  quantity: number|null;
  usd: number|null;
  sellPrice: boolean;
}

/**
 * Salvar o valor atual de uma criptomoeda, considerando a quantidade.
 *
 * @param {Wallet} wallet - {symbol: string, price: number, quantity: number, usd: number, sellPrice: boolean} - O objeto contendo o preço atual da criptomoeda.
 * @returns {Promise<Wallet | null>} - A promise que resolve quando o preço atual for salvo.
 * @throws {Error} - Se houver um erro na requisição.
 *
 */
export default async function POST_DB(wallet: Wallet): Promise<Wallet | null> {
  try {
    const result = await Prisma.wallet.create({
      data: {
        symbol: wallet.symbol || '',
        price: wallet.price || 0,
        quantity: wallet.quantity || 0,
        usd: wallet.usd || 0,
        sellPrice: wallet.sellPrice || false,
      },
    });
    console.log(result);
    return result;
  } catch (error) {
    console.log(error);
    return null;
  }
}
    
import { PrismaClient } from "@prisma/client";

const Prisma = new PrismaClient();

interface Wallet {
  id: string;
  symbol: string | null;
  price: number | null;
  quantity: number | null;
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
    throw error;
  }
}
import { PrismaClient } from "@prisma/client";

const Prisma = new PrismaClient();

interface Sales {
  symbol: string | null;
  lucro: number | null;
}

/**
 * Registrar uma venda de criptomoeda no banco de dados.
 *
 * @param {Sales} sales - {symbol: string, lucro: number} - O objeto contendo os dados da venda.
 * @returns {Promise<Sales | null>} - A promise que resolve quando a venda for salva.
 * @throws {Error} - Se houver um erro na requisição.
 *
 */
export default async function POST_VENDA(sales: Sales): Promise<Sales | null> {
  try {
    const result = await Prisma.sales.create({
      data: {
        symbol: sales.symbol || '',
        lucro: sales.lucro || 0,
      },
    });
    return result;
  } catch (error) {
    console.log(error);
    return null;
  }
}
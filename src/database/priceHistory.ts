import { PrismaClient } from "@prisma/client";

const Prisma = new PrismaClient();

/**
 * Salva uma leitura de preço no histórico.
 */
export async function savePriceHistory(
  symbol: string,
  price: number,
  source: string = "coinmarketcap"
) {
  return Prisma.priceHistory.create({
    data: { symbol, price, source },
  });
}

/**
 * Busca os preços de um símbolo dentro da janela de análise (em dias),
 * ordenados do mais antigo para o mais recente.
 *
 * @param symbol Símbolo (ex: "ETHUSDT").
 * @param windowDays Janela em dias (1 a 5).
 */
export async function getPriceHistory(
  symbol: string,
  windowDays: number
): Promise<{ price: number; createdAt: Date }[]> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const rows = await Prisma.priceHistory.findMany({
    where: { symbol, createdAt: { gte: since } },
    orderBy: { createdAt: "asc" },
    select: { price: true, createdAt: true },
  });
  return rows;
}

import { PrismaClient } from "@prisma/client";

const Prisma = new PrismaClient();

interface Config {
  id: string;
  symbol: string | null;
  taxa_min: number;
  profitability: number;
  createdAt: Date;
}

export default async function GET_CONFIG(): Promise<Config> {
  try {
    const result = await Prisma.config.findFirst();
    
    if (!result) {
      // Return a default Config object if no record is found
      return {
        id: '',
        symbol: null,
        taxa_min: 0,
        profitability: 1.1,
        createdAt: new Date(),
      };
    }
    
    // Garante que taxa_min e profitability nunca sejam null, aplicando valores padrão caso necessário
    return {
      id: result.id,
      symbol: result.symbol,
      taxa_min: result.taxa_min ?? 0, // Usa 0 se vier null
      profitability: result.profitability ?? 1.1, // Usa 1.1 se vier null
      createdAt: result.createdAt,
    };
  } catch (error) {
    // Exibe mensagem de erro didática para facilitar o debug
    throw new Error('Erro ao buscar configuração: ' + error);
  }
}
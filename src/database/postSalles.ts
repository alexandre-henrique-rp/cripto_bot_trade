import { PrismaClient } from "@prisma/client";
import { saveErrorNotification } from "./errorNotification.ts";
import AlertTele from "../sms/telegram.ts";

const Prisma = new PrismaClient();

interface Sales {
  symbol: string | null;
  lucro: string | null;
  valor_recebido: string | null;
  valor_investido: string | null;
  quantidade: string | null;
  price_compra: string | null;
  price_venda: string | null;
}

/**
 * Registrar uma venda de criptomoeda no banco de dados.
 *
 * @param {Sales} sales - {symbol: string, lucro: string, valor_recebido: string, valor_investido: string, quantidade: string, price_compra: string, price_venda: string} - O objeto contendo os dados da venda.
 * @returns {Promise<Sales | null>} - A promise que resolve quando a venda for salva.
 * @throws {Error} - Se houver um erro na requisição.
 *
 */
export default async function POST_VENDA(sales: Sales): Promise<Sales | null> {
  try {
    const result = await Prisma.sales.create({
      data: {
        symbol: sales.symbol || '',
        lucro: sales.lucro || '0',
        valor_recebido: sales.valor_recebido || '0',
        valor_investido: sales.valor_investido || '0',
        quantidade: sales.quantidade || '0',
        price_compra: sales.price_compra || '0',
        price_venda: sales.price_venda || '0',
      },
    });
    return result;
  } catch (error) {
    console.log(error);
    await saveErrorNotification(error.message || String(error));
    // (Opcional) Notifica via Telegram ou outro canal de alerta
    await AlertTele(`❌ Erro ao salvar registro no banco:\n${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}
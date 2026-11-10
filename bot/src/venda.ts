import { PrismaClient } from "@prisma/client";
import formatarMoeda from "../../src/lib/format_moeda.ts";

const prisma = new PrismaClient();

/**
 * Última venda: data/hora, quantidade de cripto vendida e valor recebido em dólar.
 */
export default async function venda(): Promise<string> {
  try {
    const ultima = await prisma.sales.findFirst({
      orderBy: { createdAt: "desc" },
    });

    if (!ultima) return "ℹ️ Nenhuma venda registrada ainda.";

    const data = new Date(ultima.createdAt);
    const moeda = (ultima.symbol || "").replace("USDT", "") || "cripto";
    const recebido = parseFloat(ultima.valor_recebido || "0");
    const lucro = parseFloat(ultima.lucro || "0");

    return (
      `🧾 *Última venda*\n\n` +
      `• Data/hora: ${data.toLocaleDateString(
        "pt-BR"
      )} às ${data.toLocaleTimeString("pt-BR")}\n` +
      `• ${moeda} vendido: ${ultima.quantidade || "0"}\n` +
      `• Preço de venda: ${formatarMoeda(
        parseFloat(ultima.price_venda || "0")
      )}\n` +
      `• Valor recebido (USD): ${formatarMoeda(recebido)}\n` +
      `• Lucro: ${formatarMoeda(lucro)}`
    );
  } catch (error: any) {
    return `❌ Erro ao buscar última venda: ${error?.message || String(error)}`;
  }
}

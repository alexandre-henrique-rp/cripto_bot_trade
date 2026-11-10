import { PrismaClient } from "@prisma/client";
import GET_CONFIG from "../../src/database/config.ts";
import { getMonitorState } from "../../src/database/monitorState.ts";
import formatarMoeda from "../../src/lib/format_moeda.ts";

const prisma = new PrismaClient();

// Soma o lucro (campo 'lucro' das vendas) desde um ponto no tempo para o par ativo.
async function lucroDesde(
  desde: Date,
  symbol?: string
): Promise<{ total: number; qtd: number }> {
  const vendas = await prisma.sales.findMany({
    where: {
      ...(symbol ? { symbol } : {}),
      createdAt: { gte: desde },
    },
    select: { lucro: true },
  });
  const total = vendas.reduce((acc, v) => acc + parseFloat(v.lucro || "0"), 0);
  return { total, qtd: vendas.length };
}

/**
 * Status geral: bot rodando, config resumida e lucro em 24h / 7 dias / 30 dias.
 */
export default async function status(): Promise<string> {
  try {
    const config = await GET_CONFIG();
    const symbol = config.symbol || process.env.SYMBOL || "SOLUSDT";
    const estado = await getMonitorState();

    const agora = Date.now();
    const dia = 24 * 60 * 60 * 1000;
    const l24 = await lucroDesde(new Date(agora - dia), symbol);
    const l7 = await lucroDesde(new Date(agora - 7 * dia), symbol);
    const l30 = await lucroDesde(new Date(agora - 30 * dia), symbol);

    const faseTxt =
      estado.phase === "IDLE"
        ? "Aguardando (fora de zona)"
        : estado.phase === "MONITOR_BUY"
        ? "Monitorando fundo para COMPRAR"
        : "Monitorando topo para VENDER";

    return (
      `🟢 *Bot online*\n\n` +
      `• Par: ${symbol}\n` +
      `• Operação: ${config.enabled ? "LIGADA 🟢" : "DESLIGADA ⏸️"}\n` +
      `• Reversal: ${config.reversal_percent}%${
        config.auto_reversal ? " (auto)" : ""
      }\n` +
      `• Janela de análise: ${config.analysis_window_days} dia(s)\n` +
      `• Coleta CMC: a cada ${config.cmc_interval_min} min\n` +
      `• Estado: ${faseTxt}\n\n` +
      `📈 *Lucro acumulado*\n` +
      `• 24h: ${formatarMoeda(l24.total)} (${l24.qtd} vendas)\n` +
      `• 7 dias: ${formatarMoeda(l7.total)} (${l7.qtd} vendas)\n` +
      `• 30 dias: ${formatarMoeda(l30.total)} (${l30.qtd} vendas)`
    );
  } catch (error: any) {
    return `❌ Erro ao obter status: ${error?.message || String(error)}`;
  }
}

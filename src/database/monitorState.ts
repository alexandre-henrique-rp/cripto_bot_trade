import { PrismaClient } from "@prisma/client";

const Prisma = new PrismaClient();

export type Phase = "IDLE" | "MONITOR_BUY" | "MONITOR_SELL";

export interface MonitorState {
  id: string;
  phase: Phase;
  extremePrice: number | null; // fundo (compra) ou topo (venda) observado
  lastPrice: number | null;
}

/**
 * Retorna o estado de monitoramento atual, criando um registro IDLE
 * caso ainda não exista.
 */
export async function getMonitorState(): Promise<MonitorState> {
  let state = await Prisma.monitorState.findFirst({
    orderBy: { createdAt: "asc" },
  });
  if (!state) {
    state = await Prisma.monitorState.create({ data: { phase: "IDLE" } });
  }
  return {
    id: state.id,
    phase: state.phase as Phase,
    extremePrice: state.extremePrice,
    lastPrice: state.lastPrice,
  };
}

export async function setMonitorState(
  id: string,
  data: Partial<{ phase: Phase; extremePrice: number | null; lastPrice: number | null }>
): Promise<void> {
  await Prisma.monitorState.update({ where: { id }, data });
}

import { PrismaClient } from "@prisma/client";
import { resolverSimbolo } from "../lib/symbol.ts";
import {
  cifrarSegredoBanco,
  decifrarSegredoBanco,
} from "../config/vault.ts";

const Prisma = new PrismaClient();

export interface Config {
  id: string;
  symbol: string | null;
  taxa_min: number;
  reversal_percent: number;
  auto_reversal: boolean;
  cmc_api_key: string | null;
  cmc_interval_min: number;
  analysis_window_days: number;
  enabled: boolean;
  createdAt: Date;
}

// Valores padrão aplicados quando não há configuração no banco
// ou quando um campo vem nulo.
const DEFAULTS = {
  reversal_percent: 5,
  auto_reversal: false,
  cmc_interval_min: 5,
  analysis_window_days: 1,
  taxa_min: 0,
  enabled: false,
};

export default async function GET_CONFIG(): Promise<Config> {
  try {
    const result = await Prisma.config.findFirst();

    if (!result) {
      return {
        id: "",
        symbol: resolverSimbolo(process.env.SYMBOL, null),
        taxa_min: DEFAULTS.taxa_min,
        reversal_percent: DEFAULTS.reversal_percent,
        auto_reversal: DEFAULTS.auto_reversal,
        cmc_api_key: null,
        cmc_interval_min: DEFAULTS.cmc_interval_min,
        analysis_window_days: DEFAULTS.analysis_window_days,
        enabled: DEFAULTS.enabled,
        createdAt: new Date(),
      };
    }

    const symbolAtivo = resolverSimbolo(process.env.SYMBOL, result.symbol);

    // Se o .env mudou o símbolo em relação ao que estava salvo no banco,
    // sincroniza o banco e reseta o monitorState para não misturar topo/fundo de outra moeda.
    if (result.symbol !== symbolAtivo) {
      await Prisma.config.update({
        where: { id: result.id },
        data: { symbol: symbolAtivo },
      });
      await Prisma.monitorState.updateMany({
        data: { phase: "IDLE", extremePrice: null, lastPrice: null },
      });
    }

    return {
      id: result.id,
      symbol: symbolAtivo,
      taxa_min: result.taxa_min ?? DEFAULTS.taxa_min,
      reversal_percent: result.reversal_percent ?? DEFAULTS.reversal_percent,
      auto_reversal: result.auto_reversal ?? DEFAULTS.auto_reversal,
      // Chave do CoinMarketCap vem apenas do banco (definida via /set_cmc_key no Telegram)
      // e é decifrada em memória a partir do formato AES-256-GCM.
      cmc_api_key: decifrarSegredoBanco(result.cmc_api_key ?? null),
      cmc_interval_min: result.cmc_interval_min ?? DEFAULTS.cmc_interval_min,
      analysis_window_days:
        result.analysis_window_days ?? DEFAULTS.analysis_window_days,
      enabled: result.enabled ?? DEFAULTS.enabled,
      createdAt: result.createdAt,
    };
  } catch (error) {
    throw new Error("Erro ao buscar configuração: " + error);
  }
}

/**
 * Atualiza (ou cria, se não existir) a configuração única do bot.
 * Usado pelos comandos de config do Telegram.
 */
export async function UPDATE_CONFIG(
  data: Partial<{
    symbol: string;
    taxa_min: number;
    reversal_percent: number;
    auto_reversal: boolean;
    cmc_api_key: string;
    cmc_interval_min: number;
    analysis_window_days: number;
    enabled: boolean;
  }>
): Promise<Config> {
  const payload = { ...data };
  if (typeof payload.cmc_api_key === "string" && payload.cmc_api_key) {
    payload.cmc_api_key = cifrarSegredoBanco(payload.cmc_api_key);
  }
  const existing = await Prisma.config.findFirst();
  if (!existing) {
    await Prisma.config.create({ data: payload });
  } else {
    await Prisma.config.update({ where: { id: existing.id }, data: payload });
  }
  return GET_CONFIG();
}

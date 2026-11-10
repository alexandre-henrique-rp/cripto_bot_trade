import { PrismaClient } from "@prisma/client";
import type { Config } from "../database/config.ts";
import { UPDATE_CONFIG } from "../database/config.ts";
import type { Medias } from "./medias.ts";
import AlertTele from "../sms/telegram.ts";

const Prisma = new PrismaClient();

// Faixa segura para o reversal automático (mínimo 0.5% para mercados com baixa volatilidade).
const MIN_REVERSAL = 0.5;
const MAX_REVERSAL = 10;

// Evita reavaliar/avisar a cada tick: no máximo 1 ajuste automático por hora.
let ultimaAvaliacao = 0;
const INTERVALO_AVALIACAO_MS = 60 * 60 * 1000;

/**
 * Sugere um reversal_percent com base na volatilidade da janela e no
 * resultado das últimas vendas. Função pura para facilitar teste.
 *
 * Ideia:
 * - Volatilidade = amplitude (maxAlta - minMax) / mediaGeral, em %.
 *   Mercado mais volátil pede reversal maior (evita ruído);
 *   mercado calmo pede reversal menor (captura movimentos pequenos).
 * - Se as últimas vendas foram lucrativas, mantém-se próximo do atual;
 *   se deram prejuízo, afasta-se um pouco para exigir reversão mais forte.
 */
export function sugerirReversal(
  atual: number,
  medias: Medias,
  taxaAcertoVendas: number // 0..1 (proporção de vendas lucrativas)
): number {
  const amplitudePct =
    medias.mediaGeral > 0
      ? ((medias.maxAlta - medias.minMax) / medias.mediaGeral) * 100
      : 0;

  // Base: metade da amplitude é um ponto de partida razoável para exigir
  // uma reversão significativa sem perder todo o movimento.
  let alvo = amplitudePct / 2;

  // Penaliza se as vendas recentes foram ruins (exige reversão mais forte).
  if (taxaAcertoVendas < 0.5) {
    alvo += 1;
  }

  // Suaviza: caminha só metade da distância do atual até o alvo,
  // para não oscilar bruscamente.
  let novo = atual + (alvo - atual) * 0.5;

  // Trava na faixa segura e arredonda a 1 casa.
  novo = Math.min(MAX_REVERSAL, Math.max(MIN_REVERSAL, novo));
  return Math.round(novo * 10) / 10;
}

/**
 * Calcula a proporção de vendas lucrativas nos últimos 30 dias para o par ativo.
 */
async function taxaAcertoUltimasVendas(symbol?: string | null): Promise<number> {
  const desde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const vendas = await Prisma.sales.findMany({
    where: {
      ...(symbol ? { symbol } : {}),
      createdAt: { gte: desde },
    },
    select: { lucro: true },
  });
  if (!vendas.length) return 1; // sem histórico, não penaliza
  const lucrativas = vendas.filter((v) => parseFloat(v.lucro || "0") > 0).length;
  return lucrativas / vendas.length;
}

/**
 * Avalia e, se necessário, ajusta o reversal_percent automaticamente.
 * Só age se auto_reversal estiver ligado. Avisa no Telegram ao mudar.
 * Throttled para no máximo 1x/hora.
 */
export async function avaliarAutoReversal(
  config: Config,
  medias: Medias
): Promise<void> {
  if (!config.auto_reversal) return;

  const agora = Date.now();
  if (agora - ultimaAvaliacao < INTERVALO_AVALIACAO_MS) return;
  ultimaAvaliacao = agora;

  const atual = config.reversal_percent || 5;
  const taxa = await taxaAcertoUltimasVendas(config.symbol);
  const sugerido = sugerirReversal(atual, medias, taxa);

  // Só ajusta se a diferença for relevante (>= 0.5 ponto).
  if (Math.abs(sugerido - atual) < 0.5) return;

  await UPDATE_CONFIG({ reversal_percent: sugerido });
  await AlertTele(
    `🤖 *Auto-ajuste do reversal*\n` +
      `Anterior: ${atual}%\nNovo: ${sugerido}%\n` +
      `Motivo: volatilidade da janela ${(
        ((medias.maxAlta - medias.minMax) / medias.mediaGeral) *
        100
      ).toFixed(1)}% e taxa de acerto das vendas ${(taxa * 100).toFixed(0)}%.`
  );
  console.log(`🤖 Auto-reversal ajustado: ${atual}% -> ${sugerido}%`);
}

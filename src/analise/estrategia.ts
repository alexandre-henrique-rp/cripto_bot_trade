import type { Phase } from "../database/monitorState.ts";
import type { Medias } from "./medias.ts";

export interface EstadoReversao {
  phase: Phase;
  extremePrice: number | null;
}

export interface DecisaoReversao {
  acao: "COMPRAR" | "VENDER" | "NENHUMA";
  novoEstado: EstadoReversao;
  motivo: string;
}

/**
 * Núcleo da estratégia de reversão (função pura, testável).
 *
 * Recebe: se possuímos a cripto (temCripto), o preço atual do WebSocket,
 * as médias calculadas, o percentual de reversão e o estado atual da
 * máquina. Retorna a ação e o próximo estado.
 *
 * COMPRA (não temos cripto):
 *   - IDLE -> MONITOR_BUY quando o preço <= mediaMinima (entrou na zona de compra).
 *   - Em MONITOR_BUY, guarda o menor preço visto (fundo). Compra quando o preço
 *     sobe reversalPercent% ACIMA do fundo => confirmação de que já está subindo.
 *     (evita comprar em queda contínua / "faca caindo")
 *
 * VENDA (temos cripto):
 *   - IDLE -> MONITOR_SELL quando o preço >= mediaVenda (entrou na zona de venda).
 *   - Em MONITOR_SELL, guarda o maior preço visto (topo). Vende quando o preço
 *     cai reversalPercent% ABAIXO do topo, OU quando toca a maxAlta.
 */
export function decidirReversao(
  temCripto: boolean,
  precoAtual: number,
  medias: Medias,
  reversalPercent: number,
  estado: EstadoReversao
): DecisaoReversao {
  const fator = reversalPercent / 100;

  // ---------------- Fluxo de COMPRA ----------------
  if (!temCripto) {
    // Se estávamos monitorando venda mas não temos cripto, reseta.
    let phase: Phase = estado.phase === "MONITOR_SELL" ? "IDLE" : estado.phase;
    let extreme = phase === "MONITOR_SELL" ? null : estado.extremePrice;

    if (phase === "IDLE") {
      if (precoAtual <= medias.mediaMinima) {
        return {
          acao: "NENHUMA",
          novoEstado: { phase: "MONITOR_BUY", extremePrice: precoAtual },
          motivo: `Entrou na zona de compra (preço ${precoAtual} <= média mínima ${medias.mediaMinima.toFixed(
            2
          )}). Monitorando fundo.`,
        };
      }
      return {
        acao: "NENHUMA",
        novoEstado: { phase: "IDLE", extremePrice: null },
        motivo: "Aguardando preço se aproximar da média mínima.",
      };
    }

    // MONITOR_BUY
    // TRAVA DE SEGURANÇA 1: Se o preço atual subiu além da média geral,
    // a oportunidade de comprar na baixa passou! Aborta o monitoramento para não comprar no topo.
    if (precoAtual > medias.mediaGeral) {
      return {
        acao: "NENHUMA",
        novoEstado: { phase: "IDLE", extremePrice: null },
        motivo: `Preço atual (${precoAtual}) subiu além da média geral (${medias.mediaGeral.toFixed(
          2
        )}). Oportunidade de baixa expirou. Aguardando novo recuo para a média mínima (${medias.mediaMinima.toFixed(
          2
        )}).`,
      };
    }

    const fundo = Math.min(extreme ?? precoAtual, precoAtual);
    // TRAVA DE SEGURANÇA 2: O gatilho de compra nunca pode ultrapassar a média geral.
    // Comprar na baixa significa comprar sempre abaixo da média geral do mercado.
    const gatilhoSubida = Math.min(fundo * (1 + fator), medias.mediaGeral);

    if (precoAtual >= gatilhoSubida) {
      return {
        acao: "COMPRAR",
        novoEstado: { phase: "IDLE", extremePrice: null },
        motivo: `Reversão de alta na baixa confirmada: subiu do fundo ${fundo.toFixed(
          2
        )} até ${precoAtual} (gatilho ${gatilhoSubida.toFixed(
          2
        )}, abaixo da média geral ${medias.mediaGeral.toFixed(2)}).`,
      };
    }

    return {
      acao: "NENHUMA",
      novoEstado: { phase: "MONITOR_BUY", extremePrice: fundo },
      motivo: `Monitorando fundo ${fundo.toFixed(
        2
      )} na zona de compra. Compra se confirmar reversão em ${gatilhoSubida.toFixed(
        2
      )} (teto máx: média geral ${medias.mediaGeral.toFixed(2)}).`,
    };
  }

  // ---------------- Fluxo de VENDA ----------------
  // Se estávamos monitorando compra mas já temos cripto, reseta.
  let phase: Phase = estado.phase === "MONITOR_BUY" ? "IDLE" : estado.phase;
  let extreme = phase === "MONITOR_BUY" ? null : estado.extremePrice;

  if (phase === "IDLE") {
    if (precoAtual >= medias.mediaVenda) {
      return {
        acao: "NENHUMA",
        novoEstado: { phase: "MONITOR_SELL", extremePrice: precoAtual },
        motivo: `Entrou na zona de venda (preço ${precoAtual} >= média de venda ${medias.mediaVenda.toFixed(
          2
        )}). Monitorando topo.`,
      };
    }
    return {
      acao: "NENHUMA",
      novoEstado: { phase: "IDLE", extremePrice: null },
      motivo: "Aguardando preço se aproximar da média de venda.",
    };
  }

  // MONITOR_SELL
  // TRAVA DE SEGURANÇA 3: Se o preço despencar abaixo da média geral sem acionar topo,
  // cancela o monitoramento de topo para não vender com prejuízo/abaixo da média geral.
  if (precoAtual < medias.mediaGeral) {
    return {
      acao: "NENHUMA",
      novoEstado: { phase: "IDLE", extremePrice: null },
      motivo: `Preço atual (${precoAtual}) caiu abaixo da média geral (${medias.mediaGeral.toFixed(
        2
      )}) sem realizar no topo. Retornando para IDLE para aguardar nova alta até a média de venda (${medias.mediaVenda.toFixed(
        2
      )}).`,
    };
  }

  const topo = Math.max(extreme ?? precoAtual, precoAtual);
  // O gatilho de venda deve garantir realização na alta (pelo menos na média geral)
  const gatilhoQueda = Math.max(topo * (1 - fator), medias.mediaGeral);

  if (precoAtual <= gatilhoQueda) {
    return {
      acao: "VENDER",
      novoEstado: { phase: "IDLE", extremePrice: null },
      motivo: `Reversão de queda no topo confirmada: caiu do topo ${topo.toFixed(
        2
      )} para ${precoAtual} (gatilho ${gatilhoQueda.toFixed(2)}).`,
    };
  }

  if (precoAtual >= medias.maxAlta) {
    return {
      acao: "VENDER",
      novoEstado: { phase: "IDLE", extremePrice: null },
      motivo: `Atingiu a máxima histórica ${medias.maxAlta.toFixed(
        2
      )}. Vendendo no topo.`,
    };
  }

  return {
    acao: "NENHUMA",
    novoEstado: { phase: "MONITOR_SELL", extremePrice: topo },
    motivo: `Monitorando topo ${topo.toFixed(
      2
    )}. Vende se cair para ${gatilhoQueda.toFixed(
      2
    )} ou atingir a máxima ${medias.maxAlta.toFixed(2)}.`,
  };
}

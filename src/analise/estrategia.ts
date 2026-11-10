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
    const fundo = Math.min(extreme ?? precoAtual, precoAtual);
    const gatilhoSubida = fundo * (1 + fator);

    if (precoAtual >= gatilhoSubida) {
      return {
        acao: "COMPRAR",
        novoEstado: { phase: "IDLE", extremePrice: null },
        motivo: `Reversão de alta confirmada: subiu ${reversalPercent}% do fundo ${fundo.toFixed(
          2
        )} (gatilho ${gatilhoSubida.toFixed(2)}, atual ${precoAtual}).`,
      };
    }

    return {
      acao: "NENHUMA",
      novoEstado: { phase: "MONITOR_BUY", extremePrice: fundo },
      motivo: `Monitorando fundo ${fundo.toFixed(
        2
      )}. Compra se atingir ${gatilhoSubida.toFixed(2)} (+${reversalPercent}%).`,
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
  const topo = Math.max(extreme ?? precoAtual, precoAtual);
  const gatilhoQueda = topo * (1 - fator);

  if (precoAtual <= gatilhoQueda) {
    return {
      acao: "VENDER",
      novoEstado: { phase: "IDLE", extremePrice: null },
      motivo: `Reversão de queda confirmada: caiu ${reversalPercent}% do topo ${topo.toFixed(
        2
      )} (gatilho ${gatilhoQueda.toFixed(2)}, atual ${precoAtual}).`,
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
    )} (-${reversalPercent}%) ou atingir ${medias.maxAlta.toFixed(2)}.`,
  };
}

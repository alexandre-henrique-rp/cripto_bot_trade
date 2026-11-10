import AlertTele from "./telegram.ts";
import formatarMoeda from "../lib/format_moeda.ts";
import { saveErrorNotification } from "../database/errorNotification.ts";

export interface DadosNotificacaoCompra {
  symbol: string;
  quantidade: number | string;
  valorUsd: number;
  precoUnitario: number;
  data?: Date;
}

export interface DadosNotificacaoVenda {
  symbol: string;
  quantidade: number | string;
  precoCompra: number;
  precoVenda: number;
  valorInvestido: number;
  valorRecebido: number;
  lucroUsd: number;
  data?: Date;
}

/**
 * Formata data e hora no padrão brasileiro (America/Sao_Paulo).
 */
export function formatarDataHoraBR(data: Date = new Date()): string {
  const opcoesData: Intl.DateTimeFormatOptions = {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  };
  const opcoesHora: Intl.DateTimeFormatOptions = {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  };
  const d = data.toLocaleDateString("pt-BR", opcoesData);
  const h = data.toLocaleTimeString("pt-BR", opcoesHora);
  return `${d} às ${h}`;
}

/**
 * Monta a mensagem completa de COMPRA para o Telegram (com valor, tokens, data e hora).
 */
export function formatarNotificacaoCompra(
  dados: DadosNotificacaoCompra
): string {
  const token = dados.symbol.replace(/USDT$/i, "");
  const dataHora = formatarDataHoraBR(dados.data ?? new Date());

  return (
    `✅ COMPRA REALIZADA\n\n` +
    `• Token: ${token} (${dados.symbol})\n` +
    `• Quantidade de tokens: ${dados.quantidade} ${token}\n` +
    `• Preço unitário: ${formatarMoeda(dados.precoUnitario)}\n` +
    `• Valor investido: ${formatarMoeda(dados.valorUsd)}\n` +
    `• Data e hora: ${dataHora}`
  );
}

/**
 * Monta a mensagem completa de VENDA para o Telegram (com valor, tokens, data, hora e lucro).
 */
export function formatarNotificacaoVenda(dados: DadosNotificacaoVenda): string {
  const token = dados.symbol.replace(/USDT$/i, "");
  const dataHora = formatarDataHoraBR(dados.data ?? new Date());
  const pctLucro =
    dados.valorInvestido > 0
      ? (dados.lucroUsd / dados.valorInvestido) * 100
      : 0;
  const sinal = dados.lucroUsd >= 0 ? "+" : "";
  const iconeLucro = dados.lucroUsd >= 0 ? "📈" : "📉";

  return (
    `✅ VENDA REALIZADA\n\n` +
    `• Token: ${token} (${dados.symbol})\n` +
    `• Quantidade de tokens: ${dados.quantidade} ${token}\n` +
    `• Preço de compra: ${formatarMoeda(dados.precoCompra)}\n` +
    `• Preço de venda: ${formatarMoeda(dados.precoVenda)}\n` +
    `• Valor investido: ${formatarMoeda(dados.valorInvestido)}\n` +
    `• Valor recebido: ${formatarMoeda(dados.valorRecebido)}\n` +
    `• ${iconeLucro} Lucro: ${sinal}${formatarMoeda(dados.lucroUsd)} (${sinal}${pctLucro.toFixed(2)}%)\n` +
    `• Data e hora: ${dataHora}`
  );
}

/**
 * Extrai e formata o log de um erro (mensagem + resumo do stack) com data e hora.
 */
export function formatarNotificacaoErro(
  contexto: string,
  error: any,
  data: Date = new Date()
): string {
  const dataHora = formatarDataHoraBR(data);
  const mensagem =
    error instanceof Error
      ? error.message
      : typeof error === "string"
      ? error
      : JSON.stringify(error);

  const stackLinhas =
    error instanceof Error && error.stack
      ? error.stack
          .split("\n")
          .slice(1, 4)
          .map((l) => l.trim())
          .join("\n")
      : "";

  return (
    `🚨 ERRO NO BOT (${contexto})\n\n` +
    `• Data e hora: ${dataHora}\n` +
    `• Mensagem: ${mensagem}` +
    (stackLinhas ? `\n• Log:\n${stackLinhas}` : "")
  );
}

// Cache em memória por mensagem de erro para evitar flood idêntico em menos de 5 min,
// mas garantindo que qualquer erro novo seja enviado imediatamente ao Telegram.
const ultimosErrosEnviados = new Map<string, number>();
const COOLDOWN_MESMO_ERRO_MS = 5 * 60 * 1000;

/**
 * Salva o erro no banco e envia o log formatado para o Telegram.
 */
export async function notificarErroTelegram(
  contexto: string,
  error: any
): Promise<void> {
  try {
    const texto = formatarNotificacaoErro(contexto, error);
    const chave = `${contexto}:${
      error instanceof Error ? error.message : String(error)
    }`;
    const agora = Date.now();
    const ultimoEnvio = ultimosErrosEnviados.get(chave) || 0;

    await saveErrorNotification(
      `[${contexto}] ${error instanceof Error ? error.message : String(error)}`
    );

    if (agora - ultimoEnvio >= COOLDOWN_MESMO_ERRO_MS) {
      ultimosErrosEnviados.set(chave, agora);
      await AlertTele(texto);
    }
  } catch (e) {
    console.error("Erro ao enviar log de erro ao Telegram:", e);
  }
}

import { getPriceHistory } from "../database/priceHistory.ts";

export interface Medias {
  amostras: number; // quantidade de preços considerados
  janelaDias: number; // janela usada (dias)
  precoAtual: number; // último preço do histórico
  mediaGeral: number; // média simples de todos os preços
  maxAlta: number; // maior preço da janela (pico)
  minMax: number; // menor preço da janela (fundo)
  mediaVenda: number; // média dos preços acima da média geral (referência de venda)
  mediaMinima: number; // média dos preços abaixo da média geral (referência de compra)
}

/**
 * Calcula estatísticas a partir de uma lista de preços.
 * Exposta separadamente para facilitar testes.
 *
 * Definições (alinhadas com o usuário):
 * - maxAlta: maior preço observado
 * - minMax: menor preço observado
 * - mediaVenda: média da "metade de cima" (preços >= média geral)
 * - mediaMinima: média da "metade de baixo" (preços < média geral)
 */
export function calcularMedias(precos: number[]): Omit<
  Medias,
  "janelaDias"
> | null {
  if (!precos.length) return null;

  const soma = precos.reduce((acc, p) => acc + p, 0);
  const mediaGeral = soma / precos.length;

  const acima = precos.filter((p) => p >= mediaGeral);
  const abaixo = precos.filter((p) => p < mediaGeral);

  const mediaDe = (arr: number[], fallback: number) =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : fallback;

  return {
    amostras: precos.length,
    precoAtual: precos[precos.length - 1],
    mediaGeral,
    maxAlta: Math.max(...precos),
    minMax: Math.min(...precos),
    mediaVenda: mediaDe(acima, mediaGeral),
    mediaMinima: mediaDe(abaixo, mediaGeral),
  };
}

/**
 * Carrega o histórico do banco (janela em dias) e calcula as médias.
 * Retorna null se não houver dados suficientes.
 */
export async function obterMedias(
  symbol: string,
  janelaDias: number
): Promise<Medias | null> {
  const historico = await getPriceHistory(symbol, janelaDias);
  const precos = historico.map((h) => h.price);
  const base = calcularMedias(precos);
  if (!base) return null;
  return { ...base, janelaDias };
}


/**
 * Calcula o custo total de uma compra de criptomoeda considerando o preço atual e a quantidade.
 *
 * @param precoAtual Preço atual da criptomoeda em USD.
 * @param quantidade Quantidade de criptomoeda que você quer comprar.
 * @returns {number} O custo total em USD.
 * @throws Se os parâmetros forem inválidos.
 */
export default function calcularCusto(precoAtual: number, quantidade: number): number {
  if (isNaN(precoAtual) || isNaN(quantidade) || precoAtual <= 0 || quantidade <= 0) {
    throw new Error('Parâmetros inválidos. Verifique o preço e a quantidade.');
  }
  const custoTotal = precoAtual * quantidade;
  return custoTotal;
}


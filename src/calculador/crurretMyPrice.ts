

export default function currentMyPrice(valorAtual: number, totalCriptos: number){
  // se 1 criptomoeda vale valorAtual, quantos usd vale totalCriptos criptomoedas?
  const valorTotal = valorAtual * totalCriptos;
  // arredondar para 2 casas decimais
  const valorTotalArredondado = parseFloat(valorTotal.toFixed(2));
  return valorTotalArredondado;
}

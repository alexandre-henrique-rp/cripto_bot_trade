/**
 * Calcula o valor de venda com lucro baseado no preço de compra, data de compra e tipo de operação.
 *
 * @param {number} precoCompra - O preço de compra da criptomoeda.
 * @param {Date} dataCompra - A data e hora da compra.
 * @param {"compra" | "venda"} tipoOperacao - O tipo de operação (compra ou venda).
 * @returns {number} - O valor de venda com lucro.
 */
export default function calcularLucro(
  precoCompra: number,
  dataCompra: Date,
  tipoOperacao: "compra" | "venda"
): number {

  if(!precoCompra){
    precoCompra = 0;
  }
  const lucroInicialPercentual = 0.1; // 10%
  const reducaoAbsoluta = 0.01; // reduz 1% absoluto a cada 30min
  const tempoSemReducao = 4 * 60 * 60 * 1000; // 4h
  const intervaloReducao = 30 * 60 * 1000; // 30min
  const lucroMinimo = 0.001; // 0.1%

  // Sempre aplicar o lucro inicial para operações de compra
  if (tipoOperacao === "compra") {
    const valorFinal = precoCompra * (1 + lucroInicialPercentual);
    return Number(valorFinal.toFixed(2));
  }

  const agora = new Date().getTime();
  const tempoDecorrido = agora - dataCompra.getTime();

  let lucroFinalPercentual = lucroInicialPercentual;

  if (tempoDecorrido > tempoSemReducao) {
    const tempoApos4h = tempoDecorrido - tempoSemReducao;
    const intervalos = Math.floor(tempoApos4h / intervaloReducao);
    lucroFinalPercentual -= intervalos * reducaoAbsoluta;

    if (lucroFinalPercentual < lucroMinimo) {
      lucroFinalPercentual = lucroMinimo;
    }
  }

  const valorFinal = precoCompra * (1 + lucroFinalPercentual);
  console.log("🚀 ~ calcularLucro ~ valorFinal:", lucroFinalPercentual)
  return Number(valorFinal.toFixed(2));
}

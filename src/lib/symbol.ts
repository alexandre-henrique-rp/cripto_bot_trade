export const DEFAULT_SYMBOL = "SOLUSDT";

/**
 * Mapa de casas decimais permitidas pelo filtro LOT_SIZE da Binance Spot
 * para os pares mais comuns.
 */
const LOT_SIZE_DECIMALS: Record<string, number> = {
  SOLUSDT: 2,
  ETHUSDT: 3,
  BTCUSDT: 5,
  BNBUSDT: 3,
  AVAXUSDT: 2,
  LINKUSDT: 2,
  DOTUSDT: 2,
  LTCUSDT: 2,
  ATOMUSDT: 2,
  NEARUSDT: 2,
  UNIUSDT: 2,
  AAVEUSDT: 2,
  ADAUSDT: 1,
  XRPUSDT: 1,
  SUIUSDT: 1,
  TRXUSDT: 1,
  MATICUSDT: 1,
  POLUSDT: 1,
  DOGEUSDT: 0,
  SHIBUSDT: 0,
  PEPEUSDT: 0,
};

/**
 * Resolve o símbolo ativo priorizando a variável de ambiente (.env),
 * seguida pelo valor salvo no banco e, por fim, o padrão (SOLUSDT).
 */
export function resolverSimbolo(
  envSymbol?: string | null,
  dbSymbol?: string | null
): string {
  const fromEnv = envSymbol?.trim().toUpperCase();
  if (fromEnv) return fromEnv;

  const fromDb = dbSymbol?.trim().toUpperCase();
  if (fromDb) return fromDb;

  return DEFAULT_SYMBOL;
}

/**
 * Retorna o número de casas decimais aceito pela Binance (LOT_SIZE)
 * para a quantidade da criptomoeda no par informado.
 */
export function obterCasasDecimais(symbol: string): number {
  const normalizado = symbol?.trim().toUpperCase() || DEFAULT_SYMBOL;
  return LOT_SIZE_DECIMALS[normalizado] ?? 2;
}

/**
 * Trunca (arredonda para baixo) a quantidade para o número de casas decimais
 * permitido pela corretora, evitando sobra de ponto flutuante (IEEE 754).
 */
export function ajustarQuantidade(
  quantidade: number,
  casasDecimais: number = 2
): number {
  if (!Number.isFinite(quantidade) || quantidade <= 0) return 0;
  const fator = Math.pow(10, casasDecimais);
  const truncado = Math.floor((quantidade + 1e-9) * fator) / fator;
  return Number(truncado.toFixed(casasDecimais));
}

/**
 * Ajusta a quantidade automaticamente de acordo com as regras de LOT_SIZE
 * do par negociado (ex: 2 casas para SOLUSDT, 3 para ETHUSDT).
 */
export function ajustarQuantidadePorSimbolo(
  quantidade: number,
  symbol: string
): number {
  const casas = obterCasasDecimais(symbol);
  return ajustarQuantidade(quantidade, casas);
}

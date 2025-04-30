

/**
 * Função para formatar um número como moeda
 * @param {number} valor - O valor numérico a ser formatado.
 * @param {string} moeda - O código da moeda (ex.: 'USD', 'BRL', 'EUR').
 * @returns {string} - O valor formatado como moeda.
 */
export default function formatarMoeda(valor: number, moeda: string = 'USD'): string {
  if(moeda === 'BRL'){
    return parseFloat(valor.toFixed(2)).toLocaleString('pt-BR', { 
      style: 'currency', 
      currency: moeda 
    });
  }
  if(moeda === 'EUR'){
    return parseFloat(valor.toFixed(2)).toLocaleString('de-DE', { 
      style: 'currency', 
      currency: moeda 
    });
  } else {
    return parseFloat(valor.toFixed(2)).toLocaleString('en-US', { 
      style: 'currency', 
      currency: moeda 
    });
  }
}
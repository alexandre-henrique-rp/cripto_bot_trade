import GET_CONFIG from "../../src/database/config.ts";

/**
 * Mostra a configuração atual do bot (sem expor a chave completa do CMC).
 */
export default async function config(): Promise<string> {
  try {
    const c = await GET_CONFIG();
    const cmc = c.cmc_api_key
      ? `${c.cmc_api_key.slice(0, 4)}...${c.cmc_api_key.slice(-4)}`
      : "não definida";

    return (
      `⚙️ *Configuração atual*\n\n` +
      `• Par (symbol): ${c.symbol || "não definido"}\n` +
      `• Reversal: ${c.reversal_percent}%\n` +
      `• Auto-reversal: ${c.auto_reversal ? "ligado" : "desligado"}\n` +
      `• Janela de análise: ${c.analysis_window_days} dia(s)\n` +
      `• Intervalo de coleta CMC: ${c.cmc_interval_min} min\n` +
      `• CMC API key: ${cmc}`
    );
  } catch (error: any) {
    return `❌ Erro ao obter configuração: ${error?.message || String(error)}`;
  }
}

import { getCmcPrice, toCmcSymbol } from "./client.ts";
import { savePriceHistory } from "../database/priceHistory.ts";
import GET_CONFIG from "../database/config.ts";
import { notificarErroTelegram } from "../sms/notificacoes.ts";

/**
 * Faz uma única coleta de preço no CoinMarketCap e salva no histórico.
 * Lê a config atual do banco a cada ciclo, então mudanças feitas pelo
 * Telegram (chave, símbolo) passam a valer no próximo ciclo.
 */
async function coletarUmaVez(): Promise<void> {
  const config = await GET_CONFIG();
  const tradingSymbol = config.symbol || process.env.SYMBOL || "SOLUSDT";
  const cmcSymbol = toCmcSymbol(tradingSymbol);
  const apiKey = config.cmc_api_key || "";

  // Sem chave ainda: apenas espera, não trata como erro (não quebra, não notifica).
  if (!apiKey) {
    console.log(
      "⏸️ [CMC] Aguardando chave da API. Defina via /set_cmc_key no Telegram."
    );
    return;
  }

  const price = await getCmcPrice(cmcSymbol, apiKey);
  await savePriceHistory(tradingSymbol, price, "coinmarketcap");
  console.log(
    `📥 [CMC] ${cmcSymbol} = $${price} salvo em ${new Date().toISOString()}`
  );
}

// Envia log do erro de coleta ao Telegram (com anti-spam embutido).
async function notificarErro(error: any) {
  const msg = error?.message || String(error);
  console.error("❌ [CMC] Erro na coleta:", msg);
  await notificarErroTelegram("Coletor CoinMarketCap", error);
}

/**
 * Inicia o loop de coleta periódica. O intervalo é lido da config
 * (cmc_interval_min) e re-verificado a cada ciclo, permitindo ajuste
 * via Telegram sem reiniciar o processo.
 */
export async function iniciarColetorCMC(): Promise<void> {
  console.log("🟢 [CMC] Coletor iniciado.");

  const agendarProximo = (minutos: number) => {
    const ms = Math.max(1, minutos) * 60 * 1000;
    setTimeout(rodarCiclo, ms);
  };

  const rodarCiclo = async () => {
    let intervaloMin = 5;
    try {
      const config = await GET_CONFIG();
      intervaloMin = config.cmc_interval_min || 5;
      await coletarUmaVez();
    } catch (error) {
      await notificarErro(error);
    } finally {
      agendarProximo(intervaloMin);
    }
  };

  // Primeira coleta imediata; as próximas seguem o intervalo configurado.
  await rodarCiclo();
}

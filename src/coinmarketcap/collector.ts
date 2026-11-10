import { getCmcPrice, toCmcSymbol } from "./client.ts";
import { savePriceHistory } from "../database/priceHistory.ts";
import GET_CONFIG from "../database/config.ts";
import { notificarErroTelegram } from "../sms/notificacoes.ts";

/**
 * Faz uma única coleta de preço no CoinMarketCap e salva no histórico.
 * Lê a config atual do banco a cada ciclo, então mudanças feitas pelo
 * Telegram (chave, símbolo) passam a valer no próximo ciclo.
 * Retorna true se coletou com sucesso, false se ainda aguarda chave.
 */
async function coletarUmaVez(): Promise<boolean> {
  const config = await GET_CONFIG();
  const tradingSymbol = config.symbol || process.env.SYMBOL || "SOLUSDT";
  const cmcSymbol = toCmcSymbol(tradingSymbol);
  const apiKey = config.cmc_api_key || "";

  // Sem chave ainda: apenas espera, não trata como erro (não quebra, não notifica).
  if (!apiKey) {
    console.log(
      "⏸️ [CMC] Aguardando chave da API. Defina via /set_cmc_key no Telegram."
    );
    return false;
  }

  const price = await getCmcPrice(cmcSymbol, apiKey);
  await savePriceHistory(tradingSymbol, price, "coinmarketcap");
  console.log(
    `📥 [CMC] ${cmcSymbol} = $${price} salvo em ${new Date().toISOString()}`
  );
  return true;
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

  const agendarProximo = (ms: number) => {
    setTimeout(rodarCiclo, ms);
  };

  const rodarCiclo = async () => {
    let proximaEsperaMs = 5 * 60 * 1000;
    try {
      const config = await GET_CONFIG();
      const intervaloMin = config.cmc_interval_min || 5;
      const coletou = await coletarUmaVez();
      // Se não coletou (ex: ainda sem chave), tenta novamente em 15 segundos
      // para não fazer o usuário esperar 5 minutos após digitar a chave no Telegram.
      proximaEsperaMs = coletou
        ? Math.max(1, intervaloMin) * 60 * 1000
        : 15 * 1000;
    } catch (error) {
      await notificarErro(error);
      proximaEsperaMs = 60 * 1000; // Tenta em 1 min se houver erro transitório de rede
    } finally {
      agendarProximo(proximaEsperaMs);
    }
  };

  // Primeira coleta imediata; as próximas seguem o intervalo configurado.
  await rodarCiclo();
}

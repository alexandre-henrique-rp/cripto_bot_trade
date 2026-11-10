import newOrden from "./bank/order.ts";
import getSpotWallet from "./bank/wallet_spot.ts";
import POST_DB from "./database/post.ts";
import UPDATE_DB from "./database/update.ts";
import GET_DB from "./database/get.ts";
import POST_VENDA from "./database/postSalles.ts";
import formatarMoeda from "./lib/format_moeda.ts";
import AlertTele from "./sms/telegram.ts";
import {
  formatarNotificacaoCompra,
  formatarNotificacaoVenda,
  notificarErroTelegram,
} from "./sms/notificacoes.ts";
import {
  saveErrorNotification,
  getLastErrorNotification,
} from "./database/errorNotification.ts";
import GET_CONFIG from "./database/config.ts";
import { obterMedias } from "./analise/medias.ts";
import { decidirReversao } from "./analise/estrategia.ts";
import {
  getMonitorState,
  setMonitorState,
} from "./database/monitorState.ts";
import { avaliarAutoReversal } from "./analise/auto_reversal.ts";
import { verificarProntidao } from "./config/credentials.ts";
import {
  ajustarQuantidade,
  ajustarQuantidadePorSimbolo,
} from "./lib/symbol.ts";
import { sincronizarPosicaoExistente } from "./bank/syncPosition.ts";

// Log de "em espera" no máximo 1x/minuto, para não poluir.
let ultimoLogEspera = 0;
function logEspera(msg: string) {
  const agora = Date.now();
  if (agora - ultimoLogEspera > 60 * 1000) {
    ultimoLogEspera = agora;
    console.log(msg);
  }
}

// Mutex em memória para impedir que dois ticks simultâneos do WebSocket
// disparem ordens de compra/venda duplicadas antes do banco atualizar.
let processandoTick = false;

/**
 * Controlador chamado a cada tick do WebSocket da Binance.
 * Usa as médias do histórico (CoinMarketCap) + a máquina de estados de
 * reversão para decidir compra/venda.
 */
export default async function Controlador(currentPrice: number) {
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) return;
  if (processandoTick) return;
  processandoTick = true;

  try {
    const config = await GET_CONFIG();
    const symbol = config.symbol || process.env.SYMBOL || "SOLUSDT";
    const reversal = config.reversal_percent || 5;

    // 0) GATE: só opera se as credenciais estiverem completas E o bot ligado.
    //    Sem isso, apenas espera (não quebra, não negocia).
    const prontidao = verificarProntidao(config);
    if (!prontidao.pronto) {
      logEspera(
        `⏸️ Aguardando credenciais. Faltando: ${prontidao.faltando.join(
          "; "
        )}. Use /verificar no Telegram.`
      );
      return;
    }
    if (!config.enabled) {
      logEspera(
        "⏸️ Bot pronto, mas DESLIGADO. Use /iniciar no Telegram para começar a operar."
      );
      return;
    }

    // 1) Carrega as médias da janela de análise (24h -> até 5 dias).
    const medias = await obterMedias(symbol, config.analysis_window_days || 1);
    if (!medias) {
      // Ainda sem histórico suficiente do CoinMarketCap para operar.
      console.log("⏳ Coletando dados do CoinMarketCap... sem médias ainda.");
      return;
    }

    // 2) Descobre se já temos a cripto comprada (estado da carteira).
    const walletDb = await GET_DB(symbol);
    const mesmaMoeda =
      !walletDb?.symbol ||
      walletDb.symbol.toUpperCase() === symbol.toUpperCase();
    let temCripto =
      walletDb?.sellPrice === true && !!walletDb?.price && mesmaMoeda;
    let priceCompra = walletDb?.price || 0;
    let walletId = walletDb?.id || "";

    // Se o banco local diz que não há compra aberta, verifica (a cada 60s)
    // se já existe saldo da moeda na carteira Spot da Binance para assumir e vender.
    if (!temCripto) {
      const sync = await sincronizarPosicaoExistente(symbol, currentPrice);
      if (sync?.assumiu) {
        temCripto = true;
        priceCompra = sync.precoCompra;
        walletId = sync.walletId;
      }
    }

    // 3) Ajuste automático do reversal (se ligado). Só recalcula/avisa;
    //    o valor efetivo já vem no config na próxima leitura.
    if (config.auto_reversal) {
      await avaliarAutoReversal(config, medias);
    }

    // 4) Decide a ação via máquina de estados.
    const estadoBanco = await getMonitorState();
    const decisao = decidirReversao(
      temCripto,
      currentPrice,
      medias,
      reversal,
      { phase: estadoBanco.phase, extremePrice: estadoBanco.extremePrice }
    );

    console.log(
      `📊 ${symbol} atual=${currentPrice} | fase=${decisao.novoEstado.phase} | ${decisao.motivo}`
    );

    // 5) Persiste o novo estado de monitoramento.
    await setMonitorState(estadoBanco.id, {
      phase: decisao.novoEstado.phase,
      extremePrice: decisao.novoEstado.extremePrice,
      lastPrice: currentPrice,
    });

    // 6) Executa a ação, se houver.
    if (decisao.acao === "COMPRAR") {
      await executarCompra(symbol, currentPrice);
    } else if (decisao.acao === "VENDER") {
      await executarVenda(symbol, currentPrice, priceCompra, walletId);
    }
  } catch (error: any) {
    await notificarErroControlado(error);
  } finally {
    processandoTick = false;
  }
}

async function executarCompra(symbol: string, currentPrice: number) {
  const walletSpot = await getSpotWallet();
  const usdt = parseFloat(
    walletSpot?.balances.find((b: any) => b.asset === "USDT")?.free || "0"
  );
  if (usdt <= 2) {
    console.log("🟡 Saldo USDT insuficiente para comprar.");
    return;
  }
  const quantidadeAjustada = ajustarQuantidadePorSimbolo(
    usdt / currentPrice,
    symbol
  );
  if (quantidadeAjustada <= 0) {
    console.log("🟡 Quantidade calculada abaixo do lote mínimo da corretora.");
    return;
  }
  const ok = await newOrden(`${quantidadeAjustada}`, "BUY", symbol);
  if (!ok) throw new Error("Falha ao executar ordem de compra");

  const walletAtualizada = await getSpotWallet();
  const moeda = symbol.replace("USDT", "");
  const saldoReal =
    walletAtualizada.balances.find((b: any) => b.asset === moeda)?.free || "0";

  const dataCompra = new Date();
  await POST_DB({
    symbol,
    price: currentPrice,
    quantity: saldoReal.toString(),
    sellPrice: true,
    usd: usdt,
  });

  await AlertTele(
    formatarNotificacaoCompra({
      symbol,
      quantidade: saldoReal,
      valorUsd: usdt,
      precoUnitario: currentPrice,
      data: dataCompra,
    })
  );
}

async function executarVenda(
  symbol: string,
  currentPrice: number,
  priceCompra: number,
  walletId: string
) {
  const walletSpot = await getSpotWallet();
  const moeda = symbol.replace("USDT", "");
  const saldoReal = parseFloat(
    walletSpot.balances.find((b: any) => b.asset === moeda)?.free || "0"
  );
  const quantidadeVenda = ajustarQuantidadePorSimbolo(saldoReal, symbol);
  if (quantidadeVenda <= 0) {
    console.log("🟡 Sem saldo suficiente da cripto para vender. Liberando estado de compra.");
    if (walletId) {
      await UPDATE_DB({ id: walletId, sellPrice: false });
    }
    return;
  }
  const ok = await newOrden(`${quantidadeVenda}`, "SELL", symbol);
  if (!ok) throw new Error("Falha ao executar ordem de venda");

  const dataVenda = new Date();
  const valorInvestido = quantidadeVenda * priceCompra;
  const valorRecebido = quantidadeVenda * currentPrice;
  const lucroUsd = valorRecebido - valorInvestido;

  await UPDATE_DB({ id: walletId, sellPrice: false });
  await POST_VENDA({
    symbol,
    lucro: String(lucroUsd),
    valor_recebido: String(valorRecebido),
    valor_investido: String(valorInvestido),
    quantidade: String(quantidadeVenda),
    price_compra: String(priceCompra),
    price_venda: String(currentPrice),
  });

  await AlertTele(
    formatarNotificacaoVenda({
      symbol,
      quantidade: quantidadeVenda,
      precoCompra: priceCompra,
      precoVenda: currentPrice,
      valorInvestido,
      valorRecebido,
      lucroUsd,
      data: dataVenda,
    })
  );
}

// Envia o log do erro com data/hora e contexto para o Telegram.
async function notificarErroControlado(error: any) {
  await notificarErroTelegram("Controlador de Trade", error);
}

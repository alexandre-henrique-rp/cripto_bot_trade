import newOrden from "./bank/order.ts";
import getSpotWallet from "./bank/wallet_spot.ts";
import calcularLucro from "./calculador/profitability.ts";
import GET_DB from "./database/get.ts";
import POST_DB from "./database/post.ts";
import UPDATE_DB from "./database/update.ts";
import formatarMoeda from "./lib/format_moeda.ts";
import AlertTele from "./sms/telegram.ts";
import POST_VENDA from "./database/postSalles.ts";
import { saveErrorNotification, getLastErrorNotification } from "./database/errorNotification.ts";
import GET_CONFIG from "./database/config.ts";

// Função utilitária para ajustar a quantidade para o número de casas decimais permitido pela corretora
function ajustarQuantidade(quantidade: number, casasDecimais: number = 3): number {
  const fator = Math.pow(10, casasDecimais);
  return Math.floor(quantidade * fator) / fator;
}


export default async function Controlador(currentPrise: number) {
  console.log("✅ Controlador executado com sucesso!");
  try {
    const walletDb = await GET_DB();
    const configDb = await GET_CONFIG();
    const sellPrice = walletDb?.sellPrice || false;
    const priceCompra = walletDb?.price || 0;
    const DateCompra = walletDb?.createdAt || new Date();
    const price_venda = calcularLucro(priceCompra, DateCompra, "venda");
    if(!priceCompra){
      console.log("🟢 Devemos comprar quando o preço atual for menor ou igual a ", configDb?.taxa_min);
    }
    if(priceCompra){
      console.log("🟢 Devemos vender quando o preço atual for maior ou igual a ", price_venda);
    }
    const symbol = configDb?.symbol || process.env.SYMBOL || "";


    // --- Lógica de COMPRA ---
    // Só realiza a compra se:
    // - Não está em modo de venda (sellPrice === false)
    // - O preço atual for menor OU IGUAL à média mínima definida
    if (!sellPrice && currentPrise <= configDb?.taxa_min) {
      console.log("🟢 Tentando comprar...");
      // Consulta o saldo de USDT disponível
      const walletSpot = await getSpotWallet();
      const usdt = parseFloat(walletSpot?.balances.find((b: any) => b.asset === "USDT")?.free || "0");
      // Só compra se tiver mais de 2 USDT disponíveis
      if (usdt > 2) {
        // Compra TODO o saldo disponível de USDT
        const quantidadeCompra = usdt / currentPrise;
        const quantidadeAjustada = ajustarQuantidade(quantidadeCompra, 3); // 3 casas decimais para ETH
        const compraDeCripto = await newOrden(`${quantidadeAjustada}`, "BUY");
        if (compraDeCripto) {
          // Consulta saldo real da moeda comprada após a ordem
          const walletSpotAtualizada = await getSpotWallet();
          const moedaComprada = symbol.replace("USDT", "");
          const saldoMoeda = walletSpotAtualizada.balances.find((b: any) => b.asset === moedaComprada);
          const saldoReal = saldoMoeda?.free || '0';
          console.log("🟢 Saldo real da moeda após compra:", saldoReal);
          // Salva no banco a quantidade REAL adquirida
          await POST_DB({
            symbol: symbol,
            price: currentPrise,
            quantity: saldoReal.toString(),
            sellPrice: true,
            usd: usdt,
          });
          console.log("✅ Registro de compra salvo no banco!");
          // Alerta via Telegram
          await AlertTele(`✅ Compra realizada!\nMoeda: ${symbol}\nQuantidade: ${saldoReal}\nValor investido: ${formatarMoeda(usdt)}\nPreço atual: ${formatarMoeda(currentPrise)}`);
        } else {
          throw new Error("Falha ao executar ordem de compra");
        }
      }
    // --- Lógica de VENDA ---
    } else if (sellPrice && currentPrise >= price_venda) {
      // Consulta saldo real da moeda antes de vender
      const walletSpotAtualizada = await getSpotWallet();
      const moedaComprada = symbol.replace("USDT", "");
      const saldoMoeda = walletSpotAtualizada.balances.find((b: any) => b.asset === moedaComprada);
      const saldoReal = saldoMoeda ? parseFloat(saldoMoeda.free) : 0;
      if (saldoReal > 0) {
        const vendaDeCripto = await newOrden(`${saldoReal}`, "SELL");
        if (vendaDeCripto) {
          await UPDATE_DB({ id: walletDb.id, sellPrice: false });
          await POST_VENDA({
            symbol: symbol,
            lucro: String((saldoReal * currentPrise) - (saldoReal * priceCompra)),
            valor_recebido: String((saldoReal * currentPrise)),
            valor_investido: String((saldoReal * priceCompra)),
            quantidade: String(saldoReal),
            price_compra: String(priceCompra),
            price_venda: String(currentPrise),
          });
          await AlertTele(`✅ Venda realizada!\nMoeda: ${symbol}\nQuantidade: ${saldoReal}\nValor recebido: ${formatarMoeda(saldoReal * currentPrise)}\nPreço de venda: ${formatarMoeda(currentPrise)}`);
        } else {
          throw new Error("Falha ao executar ordem de venda");
        }
      }
    } else {
      console.log("🔴 Nenhuma ação necessária.");
    }

  } catch (error: any) {
    // --- Controle de notificação de erro ---
    try {
      const lastError = await getLastErrorNotification();
      const agora = new Date();
      let podeNotificar = true;
      if (lastError && lastError.createdAt) {
        const diffMs = agora.getTime() - new Date(lastError.createdAt).getTime();
        const diffHoras = diffMs / (1000 * 60 * 60);
        if (diffHoras < 2) {
          podeNotificar = false;
        }
      }
      if (podeNotificar) {
        await saveErrorNotification(error.message || String(error));
        await AlertTele(`⚠️ Erro no bot:\n${error.message || String(error)}`);
      } else {
        console.log("Erro ocorrido, mas notificação já enviada nas últimas 2h.");
      }
    } catch (e) {
      console.log("Erro ao tentar notificar erro:", e);
    }
  }
}

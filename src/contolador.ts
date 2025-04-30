import newOrden from "./bank/order.ts";
import getSpotWallet from "./bank/wallet_spot.ts";
import calcularLucro from "./calculador/profitability.ts";
import GET_DB from "./database/get.ts";
import POST_DB from "./database/post.ts";
import UPDATE_DB from "./database/update.ts";
import formatarMoeda from "./lib/format_moeda.ts";
import AlertTele from "./sms/telegram.ts";
import POST_VENDA from "./database/postSalles.ts";

const template = {
  min_price: 1791.61,
  max_price: 2229.97,
  media_minima: 1941.48,
  media_maxima: 2034.31,
};

export default async function Controlador(currentPrise: number) {
  try {
    const walletDb = await GET_DB();
    const sellPrice = walletDb?.sellPrice || false;
    const priceCompra = walletDb?.price || 0;
    const DateCompra = walletDb?.createdAt || new Date();
    const quantity = walletDb?.quantity || 0;
    const price_venda = calcularLucro(priceCompra, DateCompra, "venda");
    console.log("🚀 ~ Controlador ~ price_venda:", price_venda)
    const symbol = process.env.SYMBOL || "";

    if (!sellPrice && currentPrise < template.media_minima) {
      const walletSpot = await getSpotWallet();
      // Ensure usdt is a number by using parseFloat
      const usdt = parseFloat(
        walletSpot?.balances.find((balance: any) => balance.asset === "USDT")
          ?.free || "0"
      );
      if (usdt > 0) {
        const cryptoSerComprado = usdt / currentPrise;
        console.log("🔍 Original quantity:", cryptoSerComprado);
        
        // For ETH on Binance, the minimum quantity is 0.001 and step size is 0.001
        // Round down to nearest valid step size
        const minQuantity = 0.00001;
        const stepSize = 0.001;
        const validQuantity = Math.floor(cryptoSerComprado / stepSize) * stepSize;
        console.log("🔍 Valid quantity after step size adjustment:", validQuantity);
        
        // Check if the quantity meets the minimum requirement
        const roundedQuantity = validQuantity >= minQuantity ? validQuantity : 0;
        console.log("🔍 Final rounded quantity:", roundedQuantity, "Meets minimum?", roundedQuantity >= minQuantity);
        
        // Only proceed if we have enough to meet minimum order size
        if (roundedQuantity >= minQuantity) {
          console.log("🔍 Attempting to place buy order with quantity:", roundedQuantity);
          const compraDeCripto = await newOrden(`${roundedQuantity}`, "BUY");
          console.log("🚀 ~ Controlador ~ compraDeCripto:", compraDeCripto)
          if (compraDeCripto) {
            await POST_DB({
              symbol: symbol,
              price: currentPrise,
              quantity: roundedQuantity,
              sellPrice: true,
              usd: parseFloat(usdt.toFixed(2)),
            });
            const ValorDeVenda = calcularLucro(
              currentPrise,
              new Date(),
              "compra"
            );
            const message = `Bot:\n\nEstou comprando Ethereum no valor de : ${formatarMoeda(
              usdt
            )} dollar,\ncom a quantidade de : ${roundedQuantity} ETH,\no valor atual do ETH e : ${formatarMoeda(
              currentPrise
            )} dollar,\naguardando para vender quando ETH atingir : ${formatarMoeda(
              ValorDeVenda
            )} dollar\n\n${new Date().toLocaleDateString(
              "pt-BR"
            )} as ${new Date().toLocaleTimeString("pt-BR")}`;
            await AlertTele(message);
            console.log("✅ Compra realizada com sucesso!");
          } else {
            console.log("❌ Falha ao executar a ordem de compra");
          }
        } else {
          // Not enough USDT to meet minimum order size
          const usdtNeeded = minQuantity * currentPrise;
          console.log(`⚠️ USDT insuficiente para compra. Disponível: ${usdt}, Necessário: ${usdtNeeded} (para ${minQuantity} ETH)`);
          
          // Only send Telegram alert if we're not in a test environment
          // This helps avoid rate limiting during testing
          if (process.env.NODE_ENV === 'production') {
            try {
              await AlertTele(`⚠️ USDT insuficiente para compra. Disponível: ${formatarMoeda(usdt)}, Necessário: ${formatarMoeda(usdtNeeded)} (para ${minQuantity} ETH)`);
            } catch (error) {
              console.log("⚠️ Não foi possível enviar alerta para o Telegram:", error.message);
            }
          }
        }
      }
    } else if (sellPrice && currentPrise >= price_venda) {
      // For ETH on Binance, the minimum quantity is 0.001 and step size is 0.001
      const minQuantity = 0.001;
      const stepSize = 0.001;
      const validQuantity = Math.floor(quantity / stepSize) * stepSize;
      
      // Check if the quantity meets the minimum requirement
      const roundedQuantity = validQuantity >= minQuantity ? validQuantity : 0;
      
      // Only proceed if we have enough to meet minimum order size
      if (roundedQuantity >= minQuantity) {
        const vendaDeCripto = await newOrden(`${roundedQuantity}`, "SELL");
        if (vendaDeCripto) {
          await UPDATE_DB({
            id: walletDb.id,
            sellPrice: false,
          });
          await POST_VENDA({
            symbol: symbol,
            lucro: parseFloat((roundedQuantity * currentPrise - roundedQuantity * priceCompra).toFixed(2)),
          });
          const message = `Bot:\n\n estou Vendendo Ethereum no valor de : ${formatarMoeda(
            roundedQuantity * currentPrise
          )} dollar,\ncom a quantidade de : ${roundedQuantity} ETH,\nlucrando : ${formatarMoeda(
            roundedQuantity * currentPrise - roundedQuantity * priceCompra
          )} dollar\n\n${new Date().toLocaleDateString(
            "pt-BR"
          )} as ${new Date().toLocaleTimeString("pt-BR")}`;
          await AlertTele(message);
        }
      }
    } else {
      console.log("🛌  ~ Aguardando");
    }
  } catch (error) {
    console.log(error);
  }
}

/**
 * Texto de ajuda: lista todos os comandos do bot explicando cada um.
 * Sem Markdown (texto puro) para evitar erro de parse com _ e < > nos comandos.
 */
export default function ajuda(): string {
  return (
    `🤖 Comandos do Bot de Trade\n\n` +
    `📊 CONSULTA\n` +
    `/ajuda — mostra esta lista de comandos\n` +
    `/saldo — saldo em USDT (dólar) e na cripto do par atual\n` +
    `/carteira — lista todas as moedas com saldo na sua carteira Binance Spot e o total em USD\n` +
    `/media — médias da janela (máx alta, média venda, média mínima, mín) e preço atual\n` +
    `/venda — dados da última venda (data, hora, quantidade e valor em dólar)\n` +
    `/status — se o bot está rodando + lucro em 24h, 7 dias e 30 dias\n` +
    `/relatorio — situação da operação atual (compra em aberto, alvo, lucro estimado)\n\n` +
    `▶️ CONTROLE\n` +
    `/verificar — checa se todas as credenciais estão configuradas e se está ligado\n` +
    `/iniciar — liga a operação (só funciona com todas as credenciais prontas)\n` +
    `/parar — desliga a operação (para de comprar/vender; a coleta continua)\n` +
    `/assumir — assume o saldo de cripto que já está na Binance (opcional: /assumir 180 para definir preço pago)\n\n` +
    `⚙️ CONFIGURAÇÃO\n` +
    `/config — mostra a configuração atual\n` +
    `/set_reversal 5 — define o % de reversão (ex: 5)\n` +
    `/set_intervalo 5 — intervalo de coleta do CoinMarketCap em minutos\n` +
    `/set_janela 3 — janela de análise, de 1 a 5 dias\n` +
    `/set_cmc_key SUA_CHAVE — define a API key do CoinMarketCap\n` +
    `/auto_reversal on — liga/desliga o ajuste automático (on ou off)\n\n` +
    `ℹ️ As chaves da Binance ficam no .env do servidor por segurança.\n\n` +
    `COMO O BOT DECIDE\n` +
    `Compra: quando o preço chega perto da média mínima, ele monitora a queda e só compra quando o preço sobe o % de reversão a partir do fundo (confirmando que voltou a subir).\n` +
    `Venda: quando o preço chega perto da média de venda, ele monitora a alta e vende quando cai o % de reversão a partir do topo, ou quando atinge a máxima.`
  );
}

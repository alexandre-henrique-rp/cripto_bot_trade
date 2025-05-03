import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async function ultimaVenda() {
  try {
    // Busca o registro da última venda ordenando por data de criação (mais recente primeiro)
    const ultimaVenda = await prisma.sales.findFirst({
      orderBy: {
        createdAt: "desc",
      },
    });

    // Se não encontrou nenhuma venda, retorna mensagem amigável
    if (!ultimaVenda) {
      return "Nenhuma venda encontrada.";
    }

    // Monta um relatório simples e didático com as informações principais
    const relatorio = `=== RELATÓRIO DA ÚLTIMA VENDA ===\n\n
ID da Venda: ${ultimaVenda.id}\nAtivo (symbol): ${
      ultimaVenda.symbol ? ultimaVenda.symbol.replace("USDT", "") : ""
    }\nLucro: ${ultimaVenda.lucro || ""}\nValor Recebido: ${
      ultimaVenda.valor_recebido || ""
    }\nValor Investido: ${ultimaVenda.valor_investido || ""}\nQuantidade: ${
      ultimaVenda.quantidade || ""
    }\nPreço de Compra: ${ultimaVenda.price_compra || ""}\nPreço de Venda: ${
      ultimaVenda.price_venda || ""
    }\nData: ${new Date(ultimaVenda.createdAt).toLocaleString(
      "pt-BR"
    )}\n\n\n================================`;

    return relatorio;
  } catch (error) {
    // Exibe o erro no console para facilitar o debug
    console.log(error);
    return "Erro ao gerar relatório da última venda.";
  }
}

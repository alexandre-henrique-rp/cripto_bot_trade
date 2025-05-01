import { PrismaClient } from "@prisma/client";

const Prisma = new PrismaClient();

/**
 * Salva uma nova notificação de erro no banco de dados.
 * @param {string} message - Mensagem de erro a ser registrada.
 */
export async function saveErrorNotification(message: string) {
  try {
    await Prisma.errorNotification.create({
      data: {
        message,
      },
    });
  } catch (error) {
    console.log("Erro ao salvar notificação de erro:", error);
  }
}

/**
 * Busca a última notificação de erro registrada.
 * @returns {Promise<{ message: string, createdAt: Date } | null>}
 */
export async function getLastErrorNotification() {
  try {
    const last = await Prisma.errorNotification.findFirst({
      orderBy: { createdAt: "desc" },
    });
    return last;
  } catch (error) {
    console.log("Erro ao buscar última notificação de erro:", error);
    return null;
  }
}

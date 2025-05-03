import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const confg_init = async () => {
  try {
    const save = await prisma.config.create({
      data: {
        symbol:'ETHUSDT',
        taxa_min:1841.5,
        profitability:1.1
      }
    });
    console.log("🚀 ~ constconfg_init= ~ save:", save)
    return save;
  } catch (error) {
    console.log(error);
    throw error.message || String(error);
  }
}

confg_init();
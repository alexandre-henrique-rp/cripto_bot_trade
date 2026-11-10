import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const confg_init = async () => {
  try {
    const save = await prisma.config.create({
      data: {
        symbol: process.env.SYMBOL || "SOLUSDT",
        taxa_min: 1841.5,
        reversal_percent: 5,
        auto_reversal: false,
        cmc_interval_min: 5,
        analysis_window_days: 1,
      },
    });
    console.log("🚀 ~ confg_init ~ save:", save);
    return save;
  } catch (error: any) {
    console.log(error);
    throw error.message || String(error);
  }
};

confg_init();

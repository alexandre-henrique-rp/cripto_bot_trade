import dns from "node:dns";
import https from "node:https";
import dotenv from "dotenv";

// Força resolução IPv4 primeiro: evita travamento de 500s do Telegraf/Docker
// quando o container não possui rota IPv6 externa para api.telegram.org.
dns.setDefaultResultOrder("ipv4first");

// override:true garante que o .env prevaleça sobre variáveis já no ambiente.
dotenv.config({ override: true });

import {
  inicializarCofre,
  getTelegramCredentials,
} from "../src/config/vault.ts";
import { ativarNetworkGuard } from "../src/config/networkGuard.ts";

// Inicializa o cofre (apagando chaves de process.env) e ativa o firewall de saída.
inicializarCofre();
ativarNetworkGuard();

import { Telegraf } from "telegraf";
import relatorio from "./src/relatorio.ts";
import ajuda from "./src/ajuda.ts";
import saldo from "./src/saldo.ts";
import carteira from "./src/carteira.ts";
import media from "./src/media.ts";
import venda from "./src/venda.ts";
import status from "./src/status.ts";
import atualizar from "./src/atualizar.ts";
import mostrarConfig from "./src/config.ts";
import { verificar, iniciar, parar, assumirPosicao } from "./src/controle.ts";
import { UPDATE_CONFIG } from "../src/database/config.ts";
import { notificarErroTelegram } from "../src/sms/notificacoes.ts";

const { botToken: token, chatId: allowedChat } = getTelegramCredentials();

// Agent HTTPS forçando IPv4 (family: 4) para não travar em containers Docker sem IPv6
const telegramAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 10000,
  family: 4,
});

const Bot = new Telegraf(token, {
  telegram: {
    agent: telegramAgent,
  },
});

// Evita que uma rejeição/erro não tratado derrube o processo do bot.
process.on("unhandledRejection", (reason) => {
  console.error("⚠️ [telegram] unhandledRejection:", reason);
  notificarErroTelegram("Bot Telegram (unhandledRejection)", reason);
});
process.on("uncaughtException", (err) => {
  console.error("⚠️ [telegram] uncaughtException:", err?.message || err);
  notificarErroTelegram("Bot Telegram (uncaughtException)", err);
});
Bot.catch((err, ctx) => {
  console.error(`⚠️ [telegram] erro no update ${ctx.updateType}:`, err);
  notificarErroTelegram(`Bot Telegram (${ctx.updateType})`, err);
});

// Controle de acesso Fail-Closed: bloqueia tudo se CHAT_ID não estiver configurado
// ou se a mensagem vier de outro chat/grupo, mas registra no log para diagnóstico.
Bot.use(async (ctx, next) => {
  const chatAtual = String(ctx.chat?.id ?? "").trim();
  const fromId = String(ctx.from?.id ?? "").trim();
  const esperado = String(allowedChat ?? "").trim();
  const textoMsg = (ctx.message as any)?.text || ctx.updateType;

  console.log(
    `📩 [telegram] Recebido "${textoMsg}" de chat=${chatAtual} | from=${fromId}`
  );

  if (!esperado) {
    console.warn(
      `⚠️ [telegram] Mensagem ignorada (chat=${chatAtual}): CHAT_ID não está definido nas variáveis de ambiente do Coolify. Configure CHAT_ID=${chatAtual}`
    );
    return;
  }

  // Permite se o chat atual for o CHAT_ID configurado OU se o próprio usuário (from.id)
  // for igual ao CHAT_ID configurado (ex: falando no privado ou grupo).
  if (chatAtual !== esperado && fromId !== esperado) {
    console.warn(
      `⚠️ [telegram] Mensagem ignorada: veio de chat=${chatAtual} (from=${fromId}), mas CHAT_ID configurado no Coolify é "${esperado}". Se este chat for o seu, atualize CHAT_ID=${chatAtual} no Coolify.`
    );
    return;
  }
  return next();
});

// Envia texto puro (sem parse_mode) para evitar erros de parsing do Markdown
// com caracteres como _ * < > que aparecem em comandos e valores.
const reply = (ctx: any, texto: string) => ctx.reply(texto);

// Verifica se quem enviou um comando de escrita/controle em grupo é administrador.
// Em chat privado (já validado pelo CHAT_ID), é o próprio dono.
async function podeExecutarComandoCritico(ctx: any): Promise<boolean> {
  const chatType = ctx.chat?.type;
  if (chatType === "private") return true;
  const userId = ctx.from?.id;
  if (!userId) return false;
  try {
    const member = await ctx.getChatMember(userId);
    return member?.status === "creator" || member?.status === "administrator";
  } catch {
    return false;
  }
}

async function exigirAdmin(ctx: any, acao: () => Promise<any>) {
  if (!(await podeExecutarComandoCritico(ctx))) {
    return reply(
      ctx,
      "⛔ Acesso negado: apenas administradores do grupo podem executar comandos de controle ou configuração."
    );
  }
  return acao();
}

// ---------------- Comandos de consulta ----------------
Bot.start((ctx) => reply(ctx, ajuda()));
Bot.help((ctx) => reply(ctx, ajuda()));
Bot.command("ajuda", (ctx) => reply(ctx, ajuda()));

Bot.command("saldo", async (ctx) => reply(ctx, await saldo()));
Bot.command("carteira", async (ctx) => reply(ctx, await carteira()));
Bot.command("atualizar", async (ctx) => reply(ctx, await atualizar()));
Bot.command("sincronizar", async (ctx) => reply(ctx, await atualizar()));
Bot.command("media", async (ctx) => reply(ctx, await media()));
Bot.command("venda", async (ctx) => reply(ctx, await venda()));
Bot.command("status", async (ctx) => reply(ctx, await status()));

Bot.command("relatorio", async (ctx) => {
  const info = await relatorio();
  if (!info.data) {
    await reply(ctx, info.error || "Nenhum registro de compra encontrado.");
  } else {
    await reply(ctx, info.data);
  }
});

// ---------------- Comandos de controle (ligar/desligar) ----------------
Bot.command("verificar", async (ctx) => reply(ctx, await verificar()));
Bot.command("iniciar", async (ctx) =>
  exigirAdmin(ctx, async () => reply(ctx, await iniciar()))
);
Bot.command("parar", async (ctx) =>
  exigirAdmin(ctx, async () => reply(ctx, await parar()))
);
Bot.command("assumir", async (ctx) =>
  exigirAdmin(ctx, async () => {
    const txt = arg(ctx).replace(",", ".");
    const precoManual = txt ? parseFloat(txt) : undefined;
    if (txt && (Number.isNaN(precoManual!) || precoManual! <= 0)) {
      return reply(
        ctx,
        "Uso: /assumir ou /assumir <preco_compra>\nEx: /assumir 175.50"
      );
    }
    return reply(ctx, await assumirPosicao(precoManual));
  })
);

// ---------------- Comandos de configuração ----------------
Bot.command("config", async (ctx) => reply(ctx, await mostrarConfig()));

// Extrai o argumento após o comando.
function arg(ctx: any): string {
  const txt: string = ctx.message?.text || "";
  return txt.split(" ").slice(1).join(" ").trim();
}

Bot.command("set_reversal", async (ctx) =>
  exigirAdmin(ctx, async () => {
    const v = parseFloat(arg(ctx).replace(",", "."));
    if (Number.isNaN(v) || v < 0.5 || v > 50) {
      return reply(
        ctx,
        "Uso: /set_reversal <valor>\nEx: /set_reversal 5 (entre 0.5 e 50)."
      );
    }
    await UPDATE_CONFIG({ reversal_percent: v });
    return reply(ctx, `✅ Reversal definido para ${v}%.`);
  })
);

Bot.command("set_intervalo", async (ctx) =>
  exigirAdmin(ctx, async () => {
    const v = parseInt(arg(ctx), 10);
    if (Number.isNaN(v) || v < 1 || v > 60) {
      return reply(
        ctx,
        "Uso: /set_intervalo <minutos>\nEntre 1 e 60. Ex: /set_intervalo 5."
      );
    }
    await UPDATE_CONFIG({ cmc_interval_min: v });
    return reply(
      ctx,
      `✅ Intervalo de coleta definido para ${v} min. (vale no próximo ciclo)`
    );
  })
);

Bot.command("set_janela", async (ctx) =>
  exigirAdmin(ctx, async () => {
    const v = parseInt(arg(ctx), 10);
    if (Number.isNaN(v) || v < 1 || v > 5) {
      return reply(
        ctx,
        "Uso: /set_janela <dias>\nEntre 1 e 5. Ex: /set_janela 5."
      );
    }
    await UPDATE_CONFIG({ analysis_window_days: v });
    return reply(ctx, `✅ Janela de análise definida para ${v} dia(s).`);
  })
);

Bot.command("set_cmc_key", async (ctx) =>
  exigirAdmin(ctx, async () => {
    const v = arg(ctx);
    if (!v || v.length < 8) {
      return reply(
        ctx,
        "Uso: /set_cmc_key <chave>\nInforme a API key do CoinMarketCap."
      );
    }
    await UPDATE_CONFIG({ cmc_api_key: v });
    // Tenta apagar a mensagem com a chave; avisa se não tiver permissão.
    let apagou = false;
    try {
      await ctx.deleteMessage();
      apagou = true;
    } catch {}
    return reply(
      ctx,
      apagou
        ? "✅ Chave do CoinMarketCap salva com criptografia. (mensagem com a chave foi apagada)"
        : "✅ Chave do CoinMarketCap salva com criptografia.\n⚠️ Não foi possível apagar sua mensagem automaticamente. Apague a mensagem acima manualmente por segurança."
    );
  })
);

Bot.command("auto_reversal", async (ctx) =>
  exigirAdmin(ctx, async () => {
    const v = arg(ctx).toLowerCase();
    if (v !== "on" && v !== "off") {
      return reply(ctx, "Uso: /auto_reversal <on|off>");
    }
    await UPDATE_CONFIG({ auto_reversal: v === "on" });
    return reply(
      ctx,
      v === "on"
        ? "✅ Auto-ajuste do reversal LIGADO (faixa 2%–10%, avisa ao mudar)."
        : "✅ Auto-ajuste do reversal DESLIGADO."
    );
  })
);

// Inicia o bot com retry: um erro (ex: 409 Conflict quando outra instância
// ainda está saindo do ar) não deve derrubar o processo. Tenta de novo.
async function iniciarBot(tentativa = 1): Promise<void> {
  if (!token) {
    console.error(
      "❌ [telegram] BOT_TOKEN não está definido! Configure BOT_TOKEN nas variáveis de ambiente do Coolify."
    );
    return;
  }
  console.log(
    `🤖 [telegram] Conectando bot ao Telegram via IPv4 (tentativa ${tentativa}) | CHAT_ID autorizado: ${
      allowedChat || "NÃO DEFINIDO"
    }...`
  );
  try {
    const me = await Bot.telegram.getMe();
    console.log(
      `✅ [telegram] Autenticado com sucesso como @${me.username} (ID do bot: ${me.id})`
    );

    if (allowedChat) {
      try {
        await Bot.telegram.sendMessage(
          allowedChat,
          `🤖 Bot @${me.username} conectado no Coolify!\nEnvie /verificar para checar as credenciais ou /ajuda para ver os comandos.`
        );
        console.log(
          `📨 [telegram] Mensagem de boas-vindas enviada com sucesso para CHAT_ID=${allowedChat}`
        );
      } catch (sendErr: any) {
        console.error(
          `⚠️ [telegram] Não foi possível enviar mensagem para CHAT_ID="${allowedChat}": ${
            sendErr?.message || sendErr
          }. Envie /start para @${me.username} no Telegram e veja nos logs qual é o seu chat ID correto.`
        );
      }
    }

    await Bot.launch({ dropPendingUpdates: false }, () => {
      console.log(
        "🟢 [telegram] Long-polling ativo! Bot pronto para responder comandos."
      );
    });
  } catch (err: any) {
    const espera = Math.min(60, tentativa * 10);
    console.error(
      `❌ Falha ao iniciar o Bot Telegram (tentativa ${tentativa}): ${
        err?.message || err
      }. Nova tentativa em ${espera}s.`
    );
    setTimeout(() => iniciarBot(tentativa + 1), espera * 1000);
  }
}
iniciarBot();

process.once("SIGINT", () => Bot.stop("SIGINT"));
process.once("SIGTERM", () => Bot.stop("SIGTERM"));

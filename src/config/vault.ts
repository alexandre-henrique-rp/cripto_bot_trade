import crypto from "node:crypto";

/**
 * Cofre de credenciais em memória (Vault).
 *
 * Objetivo de segurança (anti-supply-chain):
 * Assim que o processo inicia, este módulo copia as chaves sensíveis
 * (API_KEY_PROD, SECRET_KEY_PROD, BOT_TOKEN) para variáveis privadas em
 * escopo fechado (closure) e as REMOVE imediatamente de `process.env`.
 *
 * Dessa forma, se qualquer dependência npm comprometida tentar ler
 * `process.env` em tempo de execução, não encontrará nenhuma credencial.
 */

interface SegredosCofre {
  binanceApiKey: string;
  binanceSecretKey: string;
  binanceApiUrl: string;
  binanceStreamUrl: string;
  telegramBotToken: string;
  telegramChatId: string;
}

let cofre: Readonly<SegredosCofre> | null = null;

/**
 * Remove espaços em branco e aspas acidentais (simples ou duplas)
 * que costumam ser coladas em painéis como Coolify / .env.
 */
function limparValorEnv(valor?: string): string {
  if (!valor) return "";
  return valor.trim().replace(/^['"]+|['"]+$/g, "").trim();
}

/**
 * Inicializa o cofre lendo as variáveis de ambiente atuais e apagando
 * as credenciais sensíveis de `process.env`.
 * Idempotente: chamadas subsequentes apenas retornam o cofre já carregado,
 * a menos que `forcarRecarga` seja true (usado em testes).
 */
export function inicializarCofre(forcarRecarga = false): Readonly<SegredosCofre> {
  if (cofre && !forcarRecarga) {
    return cofre;
  }

  const dados: SegredosCofre = {
    binanceApiKey: limparValorEnv(process.env.API_KEY_PROD),
    binanceSecretKey: limparValorEnv(process.env.SECRET_KEY_PROD),
    binanceApiUrl: limparValorEnv(process.env.API_URL_PROD) || "https://api.binance.com/api",
    binanceStreamUrl: limparValorEnv(process.env.STREAM_URL_PROD) || "wss://stream.binance.com:9443/ws",
    telegramBotToken: limparValorEnv(process.env.BOT_TOKEN),
    telegramChatId: limparValorEnv(process.env.CHAT_ID),
  };

  cofre = Object.freeze(dados);

  // Remove imediatamente os segredos críticos do objeto global process.env
  delete process.env.API_KEY_PROD;
  delete process.env.SECRET_KEY_PROD;
  delete process.env.BOT_TOKEN;

  return cofre;
}

/**
 * Retorna as credenciais da Binance armazenadas no cofre.
 */
export function getBinanceCredentials() {
  const c = inicializarCofre();
  return {
    apiKey: c.binanceApiKey,
    secretKey: c.binanceSecretKey,
    apiUrl: c.binanceApiUrl,
    streamUrl: c.binanceStreamUrl,
  };
}

/**
 * Retorna as credenciais do Telegram armazenadas no cofre.
 */
export function getTelegramCredentials() {
  const c = inicializarCofre();
  return {
    botToken: c.telegramBotToken,
    chatId: c.telegramChatId,
  };
}

const PREFIXO_CIFRA = "enc:v1:";

function obterChaveMestra(): Buffer {
  const c = inicializarCofre();
  const semente =
    c.binanceSecretKey || c.telegramBotToken || "cripto-bot-default-vault-key";
  return crypto.createHash("sha256").update(semente).digest();
}

/**
 * Cifra um segredo em repouso (ex: cmc_api_key no SQLite) usando AES-256-GCM.
 */
export function cifrarSegredoBanco(textoPuro: string): string {
  if (!textoPuro) return "";
  if (textoPuro.startsWith(PREFIXO_CIFRA)) return textoPuro;

  const chave = obterChaveMestra();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", chave, iv);
  const cifrado = Buffer.concat([
    cipher.update(textoPuro, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return `${PREFIXO_CIFRA}${iv.toString("hex")}:${tag.toString(
    "hex"
  )}:${cifrado.toString("hex")}`;
}

/**
 * Decifra um segredo armazenado no banco. Mantém retrocompatibilidade
 * caso o valor salvo ainda esteja em texto claro (sem prefixo enc:v1:).
 */
export function decifrarSegredoBanco(valorSalvo: string | null): string | null {
  if (!valorSalvo) return null;
  if (!valorSalvo.startsWith(PREFIXO_CIFRA)) return valorSalvo;

  try {
    const partes = valorSalvo.slice(PREFIXO_CIFRA.length).split(":");
    if (partes.length !== 3) return null;
    const [ivHex, tagHex, dataHex] = partes;
    const chave = obterChaveMestra();
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      chave,
      Buffer.from(ivHex, "hex")
    );
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    const decifrado = Buffer.concat([
      decipher.update(Buffer.from(dataHex, "hex")),
      decipher.final(),
    ]);
    return decifrado.toString("utf8");
  } catch {
    return null;
  }
}

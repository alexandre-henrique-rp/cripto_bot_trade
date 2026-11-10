#!/bin/bash
set -e

echo "🔧 Garantindo diretório do volume (/data)..."
mkdir -p /data

if [ "${SKIP_DB_PUSH}" != "1" ]; then
  echo "🔧 Aplicando schema no banco (prisma db push)..."
  # Executa o Prisma sem expor as chaves da Binance/Telegram ao processo do CLI
  env -u API_KEY_PROD -u SECRET_KEY_PROD -u BOT_TOKEN \
    ./node_modules/.bin/prisma db push --skip-generate
fi

# Sinaliza para o healthcheck do Docker/Coolify que a inicialização concluiu.
touch /tmp/ready

# Se um comando foi informado (ex: serviços separados no docker-compose), executa-o.
if [ "$#" -gt 0 ]; then
  echo "🚀 Iniciando processo: $*"
  exec "$@"
fi

echo "🚀 Iniciando processos (trade + telegram)..."

# Sobe os dois processos em background.
node --experimental-strip-types -r dotenv/config index.ts &
PID_TRADE=$!

node --experimental-strip-types -r dotenv/config bot/index.ts &
PID_BOT=$!

# Se qualquer um dos processos morrer, encerra o container inteiro
# para que o orquestrador (Coolify) reinicie tudo de forma limpa.
term() {
  echo "🛑 Encerrando..."
  kill "$PID_TRADE" "$PID_BOT" 2>/dev/null || true
  exit 0
}
trap term INT TERM

# Espera qualquer um dos dois terminar; então derruba o outro e sai com erro.
wait -n "$PID_TRADE" "$PID_BOT"
echo "⚠️ Um dos processos terminou. Derrubando o container para reinício."
kill "$PID_TRADE" "$PID_BOT" 2>/dev/null || true
exit 1

# Node 22 (necessário para --experimental-strip-types rodar .ts direto).
# slim (Debian) em vez de alpine para compatibilidade do engine do Prisma (OpenSSL).
FROM node:22-slim

# Dependências de sistema: openssl para o Prisma, bash para o entrypoint,
# tini como init (PID 1) para lidar bem com sinais/zumbis sem o PM2.
RUN apt-get update -y \
    && apt-get install -y --no-install-recommends openssl ca-certificates bash tini \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Blindagem de Supply-Chain:
# - Copia package-lock.json e .npmrc junto com package.json
# - Usa `npm ci` (valida hashes SHA-512 do lockfile)
# - Usa `--ignore-scripts` (bloqueia execução de scripts postinstall/preinstall de pacotes)
COPY package.json package-lock.json .npmrc ./
RUN npm ci --omit=dev --ignore-scripts \
    && npm cache clean --force

# Copia o schema e gera explicitamente apenas o Prisma Client.
COPY prisma ./prisma
RUN npx prisma generate

# Copia o restante do código.
COPY . .

# Prepara o diretório de dados persistentes (/data), ajusta permissões
# para o usuário não-root `node` e trava o código-fonte contra escrita em runtime.
RUN mkdir -p /data \
    && chmod +x docker-entrypoint.sh \
    && chown -R node:node /app /data \
    && chmod -R a-w /app/src /app/bot /app/index.ts /app/docker-entrypoint.sh

# O banco SQLite vive no volume /data (configurar Persistent Storage no Coolify).
ENV DATABASE_URL="file:/data/crypto.db"
VOLUME ["/data"]

# Executa como usuário sem privilégios (não-root).
USER node

# tini como init garante encaminhamento de sinais para os processos node.
ENTRYPOINT ["/usr/bin/tini", "--", "./docker-entrypoint.sh"]

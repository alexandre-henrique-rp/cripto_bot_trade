# 🤖 Bot de Relatórios de Operações para Telegram, do bot cripto trade

Este projeto é um bot para Telegram desenvolvido em TypeScript, que permite consultar relatórios de vendas diretamente em grupos ou conversas privadas, integrando-se ao banco de dados da aplicação.

## O que este bot faz?
- Busca e exibe o relatório da última venda registrada no banco de dados.
- Responde comandos personalizados, facilitando o acompanhamento das operações.
- Pode ser adicionado a grupos para que todos acompanhem as vendas.

---

## Configuração do arquivo `.env`

O arquivo `.env` deve conter as variáveis de ambiente necessárias para o funcionamento do bot:

```env
BOT_TOKEN='seu_token_do_bot_aqui'
CHAT_ID='id_do_grupo_ou_usuario'
```

- **BOT_TOKEN:** Token fornecido pelo BotFather ao criar seu bot no Telegram. Ele é usado para autenticar e permitir que seu código envie e receba mensagens pelo bot.
- **CHAT_ID:** ID do grupo onde o bot está ou do usuário que irá receber as mensagens. Para grupos, o ID geralmente é um número negativo (ex: `-123456789`).

> ⚠️ Nunca compartilhe seu arquivo `.env` publicamente, pois ele contém informações sensíveis.

---

## Como criar um Bot no Telegram

1. **Abra o Telegram e procure por [@BotFather](https://t.me/BotFather)**
2. Envie o comando `/start` para o BotFather.
3. Envie o comando `/newbot` para criar um novo bot.
   - Siga as instruções para escolher um nome e um username único.
4. O BotFather irá fornecer um **Token de API**. Guarde esse token com segurança!
5. **(Opcional, mas recomendado) Crie comandos personalizados para o seu bot:**
   - Envie o comando `/setcommands` para o BotFather.
   - Escolha o seu bot.
   - Envie a lista de comandos no formato:
     ```
     comando1 - descrição do comando
     comando2 - descrição do comando
     ultima - Mostra o relatório da última venda
     ```
   - Esses comandos aparecerão como sugestões para os usuários no Telegram.

---

## Como rodar este bot localmente

1. **Clone o repositório:**
   ```bash
   git clone <url-do-repositorio>
   ```
2. **Instale as dependências:**
   ```bash
   npm install
   ```
3. **Configure o token do bot:**
   - Crie um arquivo `.env` na raiz do projeto e adicione:
     ```env
     BOT_TOKEN=seu_token_aqui
     ```
4. **Execute o bot:**
   ```bash
   npm run start
   ```

---

## Como criar comandos personalizados

No arquivo `bot/index.ts` você pode adicionar comandos usando o método `Bot.command`. Exemplo:

```typescript
Bot.command('ultima', async (ctx) => {
  const info = await ultimaVenda();
  if (!info) {
    await ctx.reply('Nenhuma venda encontrada.');
  } else {
    await ctx.reply(info);
  }
});
```

- Basta adicionar novos comandos seguindo esse padrão.

---

## Como adicionar o bot criado em um grupo

1. No Telegram, pesquise pelo username do seu bot.
2. Clique no perfil do bot e selecione **Adicionar ao grupo** ou **Add to Group**.
3. Escolha o grupo desejado.
4. Dê permissões necessárias (como enviar mensagens).
5. Pronto! Agora qualquer membro do grupo pode interagir com o bot usando os comandos definidos.

---

## Sugestões de boas práticas
- Nunca compartilhe seu token do bot publicamente.
- Use variáveis de ambiente para informações sensíveis.
- Sempre trate possíveis erros no código para evitar que o bot pare de funcionar.
- Mantenha o código organizado e bem comentado.

---

Desenvolvido seguindo princípios de Clean Code e SOLID para facilitar manutenção e entendimento, mesmo para iniciantes.

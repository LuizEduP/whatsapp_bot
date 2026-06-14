# 🤖 WhatsApp AI Bot - DeepSeek

Bot para WhatsApp com inteligência artificial da **DeepSeek** via **Baileys**. Pronto para deploy no **Railway**!

## 📋 Funcionalidades

- ✅ Modo IA ativado/desativado por comandos (`/ia`, `/sair`)
- ✅ Integração com a API oficial do DeepSeek
- ✅ Histórico de conversa mantido para contexto
- ✅ Reconexão automática
- ✅ Indicador de digitando (composing)
- ✅ Limite de histórico configurável
- ✅ Suporte a múltiplos chats simultaneamente
- ✅ Comandos extras: `/limpar`, `/status`
- ✅ Servidor web com QR Code para deploy em cloud

## 🚀 Deploy no Railway

### 1. Faça o fork/envie para o GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/seu-usuario/whatsapp-ai-bot.git
git push -u origin main
```

### 2. Deploy no Railway

1. Acesse [Railway](https://railway.app/) e faça login
2. Clique em **New Project** > **Deploy from GitHub repo**
3. Selecione o repositório do bot
4. Vá em **Variables** e adicione:
   - `DEEPSEEK_API_KEY` = sua chave da API DeepSeek
   - (opcional) `DEEPSEEK_MODEL` = deepseek-chat
   - (opcional) `MAX_HISTORY` = 20
5. O Railway vai fazer o deploy automaticamente

> ⚠️ **IMPORTANTE**: O Railway fornece um volume persistente para a pasta `auth/`. Você precisa habilitar isso para não perder a autenticação do WhatsApp a cada deploy.
>
> 1. No projeto do Railway, vá em **Volumes**
> 2. Adicione um volume montado em `/app/auth`

### 3. Escaneie o QR Code

1. Abra a URL do seu projeto no Railway
2. A página vai mostrar um QR Code
3. Escaneie com o WhatsApp do celular (Menu > Dispositivos conectados > Conectar)
4. Pronto! O bot está online 24/7 🎉

## 📦 Instalação Local

```bash
npm install
cp .env.example .env
```

Edite o `.env` e adicione sua chave da API DeepSeek:

```env
DEEPSEEK_API_KEY=sk-sua_chave_aqui
```

Inicie o bot:

```bash
node index.js
```

Acesse `http://localhost:3000` para ver o QR Code ou escaneie no terminal.

## 🎮 Comandos

| Comando | Descrição |
|---------|-----------|
| `/ia` | Ativa o modo IA no chat |
| `/sair` | Desativa o modo IA e limpa o histórico |
| `/limpar` | Limpa o histórico da conversa |
| `/status` | Mostra se o modo IA está ativo |

## 📁 Estrutura do Projeto

```
📁 whatsapp-ai-bot/
├── index.js          # Entry point (Railway)
├── server.js         # Servidor web Express + QR Code
├── bot.js            # Core do bot (Baileys + DeepSeek)
├── package.json      # Dependências
├── railway.json      # Configuração do Railway
├── Procfile          # Process type
├── .env.example      # Exemplo de variáveis
├── .env              # Variáveis de ambiente (NÃO COMMITAR)
├── .gitignore
├── README.md
└── 📁 auth/          # Autenticação (volume persistente no Railway)
```

## ⚙️ Variáveis de Ambiente

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `DEEPSEEK_API_KEY` | Chave da API DeepSeek | **obrigatório** |
| `DEEPSEEK_MODEL` | Modelo DeepSeek | `deepseek-chat` |
| `MAX_HISTORY` | Limite de mensagens no histórico | `20` |
| `PORT` | Porta do servidor web | `3000` |

## 🔧 Tecnologias

- [Baileys](https://github.com/WhiskeySockets/Baileys) — WhatsApp Web API
- [DeepSeek API](https://platform.deepseek.com/) — Inteligência Artificial
- [Express](https://expressjs.com/) — Servidor web
- [Railway](https://railway.app/) — Cloud hosting

---

**Desenvolvido com ❤️ usando Node.js, Baileys e DeepSeek**

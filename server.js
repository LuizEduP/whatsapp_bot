// =============================================================================
// WhatsApp AI Bot - Servidor Web para Railway
// =============================================================================
// Gerencia o servidor Express, QR Code via web e inicializa o bot
// =============================================================================

const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const { startWhatsAppBot } = require('./bot');

// -----------------------------------------------------------------------------
// CONFIGURAÇÃO
// -----------------------------------------------------------------------------

dotenv.config();

const PORT = process.env.PORT || 3000;
const AUTH_DIR = path.join(__dirname, 'auth');

// Estado global compartilhado
const appState = {
    qrCode: null,
    isConnected: false,
    isAuthenticated: fs.existsSync(path.join(AUTH_DIR, 'creds.json')),
    lastQRUpdate: null,
    clientName: null,
};

// -----------------------------------------------------------------------------
// SERVIDOR EXPRESS
// -----------------------------------------------------------------------------

const app = express();
app.use(cors());
app.use(express.json());

// Página principal com QR Code
app.get('/', (req, res) => {
    const qrImage = appState.qrCode
        ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(appState.qrCode)}`
        : null;

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WhatsApp AI Bot - DeepSeek</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 20px;
            padding: 40px;
            max-width: 480px;
            width: 100%;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            text-align: center;
        }
        h1 { color: #333; margin-bottom: 8px; font-size: 24px; }
        .subtitle { color: #666; margin-bottom: 30px; font-size: 14px; }
        .status {
            display: inline-block;
            padding: 6px 16px;
            border-radius: 20px;
            font-size: 13px;
            font-weight: 600;
            margin-bottom: 20px;
        }
        .status.connected { background: #d4edda; color: #155724; }
        .status.disconnected { background: #f8d7da; color: #721c24; }
        .status.waiting { background: #fff3cd; color: #856404; }
        .qr-container {
            background: #f5f5f5;
            border-radius: 16px;
            padding: 20px;
            margin: 20px 0;
            min-height: 280px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .qr-container img { max-width: 100%; height: auto; }
        .qr-container p { color: #999; font-size: 14px; }
        .info {
            background: #f8f9fa;
            border-radius: 12px;
            padding: 16px;
            margin: 15px 0;
            text-align: left;
        }
        .info-item {
            display: flex;
            justify-content: space-between;
            padding: 4px 0;
            font-size: 13px;
        }
        .info-item .label { color: #666; }
        .info-item .value { color: #333; font-weight: 500; }
        .refresh-btn {
            background: #667eea;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 14px;
            cursor: pointer;
            transition: background 0.3s;
            margin-top: 15px;
        }
        .refresh-btn:hover { background: #5a67d8; }
        .footer { margin-top: 25px; font-size: 12px; color: #999; }
        .status-msg { font-size: 13px; color: #666; margin: 10px 0; }
        .emoji { font-size: 48px; margin-bottom: 10px; }
        @media (max-width: 480px) { .container { padding: 20px; } }
    </style>
</head>
<body>
    <div class="container">
        <div class="emoji">🤖</div>
        <h1>WhatsApp AI Bot</h1>
        <p class="subtitle">DeepSeek + Baileys</p>

        <div id="statusBadge" class="status ${appState.isConnected ? 'connected' : appState.qrCode ? 'waiting' : 'disconnected'}">
            ${appState.isConnected ? '✅ Conectado' : appState.qrCode ? '📱 Escaneie o QR Code' : '⏳ Iniciando...'}
        </div>

        <div class="qr-container" id="qrContainer">
            ${qrImage
                ? `<img src="${qrImage}" alt="QR Code WhatsApp">`
                : `<p>${appState.isConnected ? '✅ WhatsApp conectado!' : '⏳ Aguardando QR Code...'}</p>`
            }
        </div>

        <p class="status-msg" id="statusMsg">
            ${appState.isConnected
                ? 'O bot está online e processando mensagens.'
                : appState.qrCode
                    ? 'Escaneie o QR Code acima com o WhatsApp.<br><small>Menu > Dispositivos conectados > Conectar</small>'
                    : 'Inicializando conexão com o WhatsApp...'
            }
        </p>

        <div class="info">
            <div class="info-item">
                <span class="label">Conexão</span>
                <span class="value" id="connStatus">${appState.isConnected ? '🟢 Online' : '🔴 Offline'}</span>
            </div>
            <div class="info-item">
                <span class="label">Autenticação</span>
                <span class="value" id="authStatus">${appState.isAuthenticated ? '✅ Sim' : '❌ Não'}</span>
            </div>
            <div class="info-item">
                <span class="label">Modelo</span>
                <span class="value">${process.env.DEEPSEEK_MODEL || 'deepseek-chat'}</span>
            </div>
        </div>

        <button class="refresh-btn" onclick="location.reload()">🔄 Atualizar Página</button>
        <div class="footer">WhatsApp AI Bot &bull; Node.js + Baileys + DeepSeek</div>
    </div>
    <script>
        const connected = ${appState.isConnected};
        setTimeout(() => location.reload(), connected ? 30000 : 10000);
    </script>
</body>
</html>`;
    res.send(html);
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: appState.isConnected ? 'connected' : 'connecting',
        authenticated: appState.isAuthenticated,
        hasQR: !!appState.qrCode,
        connected: appState.isConnected,
        timestamp: new Date().toISOString(),
    });
});

// API status
app.get('/api/status', (req, res) => {
    res.json({
        connected: appState.isConnected,
        authenticated: appState.isAuthenticated,
        hasQR: !!appState.qrCode,
        lastQRUpdate: appState.lastQRUpdate,
    });
});

// -----------------------------------------------------------------------------
// INICIALIZAÇÃO
// -----------------------------------------------------------------------------

async function main() {
    const server = http.createServer(app);
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`🌐 Servidor web rodando na porta ${PORT}`);
        console.log(`📱 Acesse a URL do Railway para ver o QR Code`);
    });

    const callbacks = {
        onQR: (qr) => {
            appState.qrCode = qr;
            appState.isConnected = false;
            appState.lastQRUpdate = Date.now();
            console.log('📱 QR Code atualizado na página web');
        },
        onConnected: () => {
            appState.isConnected = true;
            appState.isAuthenticated = true;
            console.log('✅ WhatsApp conectado!');
        },
        onDisconnected: (reason) => {
            appState.isConnected = false;
            appState.qrCode = null;
            console.log(`🔌 Desconectado: ${reason}`);
        },
        onAuthState: (authenticated) => {
            appState.isAuthenticated = authenticated;
        },
    };

    await startWhatsAppBot(callbacks);
}

process.on('uncaughtException', (error) => {
    console.error('💥 Erro não capturado:', error.message);
});

process.on('unhandledRejection', (reason) => {
    console.error('💥 Promise rejeitada não tratada:', reason?.message || reason);
});

main().catch(console.error);

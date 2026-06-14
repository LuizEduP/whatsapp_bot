// =============================================================================
// WhatsApp AI Bot - Core do Bot (Baileys + DeepSeek)
// =============================================================================
// Lógica principal de conexão WhatsApp, comandos e integração com DeepSeek
// =============================================================================

const { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const https = require('https');
const fs = require('fs');
const path = require('path');

// -----------------------------------------------------------------------------
// CONFIGURAÇÃO
// -----------------------------------------------------------------------------

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
const MAX_HISTORY = parseInt(process.env.MAX_HISTORY) || 20;
const AUTH_DIR = path.join(__dirname, 'auth');

// -----------------------------------------------------------------------------
// VALIDAÇÃO
// -----------------------------------------------------------------------------

function validateConfig() {
    if (!DEEPSEEK_API_KEY || DEEPSEEK_API_KEY === 'sua_chave_aqui') {
        console.error('❌ ERRO: DEEPSEEK_API_KEY não configurada');
        console.error('📝 Defina a variável de ambiente DEEPSEEK_API_KEY no Railway');
        return false;
    }
    return true;
}

// -----------------------------------------------------------------------------
// ESTADO DA APLICAÇÃO
// -----------------------------------------------------------------------------

const state = {
    activeChats: new Set(),
    chatHistory: new Map(),
};

// -----------------------------------------------------------------------------
// FUNÇÕES AUXILIARES
// -----------------------------------------------------------------------------

function ensureAuthDir() {
    if (!fs.existsSync(AUTH_DIR)) {
        fs.mkdirSync(AUTH_DIR, { recursive: true });
    }
}

async function sendMessage(sock, jid, text) {
    try {
        await sock.sendMessage(jid, { text });
    } catch (error) {
        console.error('❌ Erro ao enviar mensagem:', error.message);
    }
}

async function sendTypingIndicator(sock, jid) {
    try {
        await sock.sendPresenceUpdate('composing', jid);
    } catch (error) {
        // Ignora erros de indicador de digitação (não crítico)
    }
}

function getTimestamp() {
    return new Date().toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour12: false,
    });
}

function getPhoneNumber(jid) {
    return jid.split('@')[0];
}

// -----------------------------------------------------------------------------
// GERENCIAMENTO DO HISTÓRICO
// -----------------------------------------------------------------------------

function getChatHistory(chatId) {
    return state.chatHistory.get(chatId) || [];
}

function addToHistory(chatId, role, content) {
    if (!state.chatHistory.has(chatId)) {
        state.chatHistory.set(chatId, []);
    }
    const history = state.chatHistory.get(chatId);
    history.push({ role, content });
    if (history.length > MAX_HISTORY) {
        const excess = history.length - MAX_HISTORY;
        history.splice(0, excess);
    }
}

function clearChatHistory(chatId) {
    state.chatHistory.delete(chatId);
}

// -----------------------------------------------------------------------------
// INTEGRAÇÃO COM A API DEEPSEEK
// -----------------------------------------------------------------------------

function callDeepSeekAPI(messages) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({
            model: DEEPSEEK_MODEL,
            messages,
            temperature: 0.7,
            max_tokens: 2048,
            stream: false,
        });

        const options = {
            hostname: 'api.deepseek.com',
            path: '/v1/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
                'Content-Length': Buffer.byteLength(data),
            },
            timeout: 60000,
        };

        const req = https.request(options, (res) => {
            let responseData = '';
            res.on('data', (chunk) => { responseData += chunk; });
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(responseData);
                    if (res.statusCode === 200) {
                        if (parsed.choices && parsed.choices.length > 0) {
                            resolve(parsed.choices[0].message.content);
                        } else {
                            reject(new Error('Resposta vazia da API DeepSeek'));
                        }
                    } else {
                        const errorMessage = parsed.error?.message || JSON.stringify(parsed);
                        reject(new Error(`API DeepSeek (${res.statusCode}): ${errorMessage}`));
                    }
                } catch (error) {
                    reject(new Error(`Erro ao processar resposta: ${error.message}`));
                }
            });
        });

        req.on('error', (error) => reject(new Error(`Erro de conexão: ${error.message}`)));
        req.on('timeout', () => { req.destroy(); reject(new Error('Timeout na requisição DeepSeek')); });
        req.write(data);
        req.end();
    });
}

async function getAIResponse(chatId, userMessage) {
    const history = getChatHistory(chatId);
    const messages = [
        { role: 'system', content: 'Você é um assistente amigável e prestativo. Responda em português brasileiro. Seja educado, objetivo e mantenha conversas naturais.' },
        ...history,
        { role: 'user', content: userMessage },
    ];
    addToHistory(chatId, 'user', userMessage);
    const response = await callDeepSeekAPI(messages);
    addToHistory(chatId, 'assistant', response);
    return response;
}

// -----------------------------------------------------------------------------
// COMANDOS
// -----------------------------------------------------------------------------

async function handleCommands(sock, chatId, text, senderNumber) {
    const command = text.trim().toLowerCase();

    if (command === '/ia') {
        if (state.activeChats.has(chatId)) {
            await sendMessage(sock, chatId, '⚠️ O modo IA já está ativo neste chat!');
            return true;
        }
        state.activeChats.add(chatId);
        console.log(`🤖 [${getTimestamp()}] IA ATIVADA - Número: ${senderNumber} - Chat: ${chatId}`);
        await sendMessage(sock, chatId, '🤖 Modo IA ativado. Digite /sair para encerrar.');
        return true;
    }

    if (command === '/sair') {
        if (!state.activeChats.has(chatId)) {
            await sendMessage(sock, chatId, '⚠️ O modo IA não está ativo neste chat.');
            return true;
        }
        state.activeChats.delete(chatId);
        clearChatHistory(chatId);
        console.log(`🔴 [${getTimestamp()}] IA DESATIVADA - Número: ${senderNumber} - Chat: ${chatId}`);
        await sendMessage(sock, chatId, '✅ Modo IA desativado.');
        return true;
    }

    if (command === '/limpar') {
        clearChatHistory(chatId);
        await sendMessage(sock, chatId, '🧹 Histórico da conversa limpo com sucesso!');
        console.log(`🧹 [${getTimestamp()}] Histórico limpo - Número: ${senderNumber}`);
        return true;
    }

    if (command === '/status') {
        const isActive = state.activeChats.has(chatId);
        const historyCount = getChatHistory(chatId).length;
        let statusMessage = isActive
            ? '🤖 Modo IA está **ATIVO** neste chat.'
            : '💤 Modo IA está **DESATIVADO** neste chat.';
        statusMessage += `\n📊 Mensagens no histórico: ${historyCount}/${MAX_HISTORY}`;
        statusMessage += isActive
            ? '\n💡 Comandos disponíveis: /sair, /limpar'
            : '\n💡 Use /ia para ativar o modo IA.';
        await sendMessage(sock, chatId, statusMessage);
        return true;
    }

    return false;
}

// -----------------------------------------------------------------------------
// INICIALIZAÇÃO DO WHATSAPP
// -----------------------------------------------------------------------------

/**
 * Inicia o bot WhatsApp.
 * @param {object} callbacks - Objeto com funções de callback para o servidor web
 *   { onQR, onConnected, onDisconnected, onAuthState }
 * @returns {Promise<object>} O socket do WhatsApp
 */
async function startWhatsAppBot(callbacks = {}) {
    const { onQR, onConnected, onDisconnected, onAuthState } = callbacks;

    console.log('╔══════════════════════════════════════════════╗');
    console.log('║     🤖 WhatsApp AI Bot - DeepSeek            ║');
    console.log('╚══════════════════════════════════════════════╝');
    console.log(`⏰ Iniciando em: ${getTimestamp()}`);
    console.log(`🔑 Modelo DeepSeek: ${DEEPSEEK_MODEL}`);
    console.log(`📊 Limite de histórico: ${MAX_HISTORY} mensagens`);
    console.log('──────────────────────────────────────────────────');

    ensureAuthDir();

    const { version } = await fetchLatestBaileysVersion();
    console.log(`📦 Versão do WhatsApp Web: ${version}`);

    const { state: authState, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

    const sock = makeWASocket({
        version,
        auth: authState,
        logger: pino({ level: 'silent' }),
        browser: ['Chrome', 'Chrome', '120.0.6099'],
        markOnlineOnConnect: true,
        syncFullHistory: false,
        generateHighQualityLink: true,
    });

    const credsExist = fs.existsSync(path.join(AUTH_DIR, 'creds.json'));
    if (onAuthState) onAuthState(credsExist);

    sock.ev.on('creds.update', saveCreds);

    // =========================================================================
    // TRATAMENTO DE ERROS DE SESSÃO (Bad MAC, etc.)
    // =========================================================================
    // O erro "Bad MAC" ocorre quando a sessão do WhatsApp é corrompida.
    // Neste caso, limpamos a autenticação e reconectamos do zero.
    // =========================================================================

    sock.ev.on('messages.upsert', (messageUpsert) => {
        // Handler separado apenas para capturar erros de sessão
    });

    // Captura erros de sessão (como Bad MAC) emitidos pelo socket
    const originalEnd = sock.end;
    let badMACCount = 0;
    const BAD_MAC_LIMIT = 3; // Limite de erros Bad MAC antes de limpar sessão

    sock.ev.on('connection.update', (update) => {
        if (update.isNewLogin) {
            badMACCount = 0; // Reseta contador em novo login
        }
    });

    // Trata o erro Bad MAC automaticamente
    function handleSessionError(error) {
        if (!error) return;
        const errorStr = String(error.message || error);
        if (errorStr.includes('Bad MAC')) {
            badMACCount++;
            console.warn(`⚠️ [${getTimestamp()}] Erro Bad MAC detectado (${badMACCount}/${BAD_MAC_LIMIT})`);

            if (badMACCount >= BAD_MAC_LIMIT) {
                console.warn('🧹 Limpando sessão corrompida devido a múltiplos erros Bad MAC...');
                try {
                    // Remove todos os arquivos da sessão (exceto creds.json para preservar número)
                    if (fs.existsSync(AUTH_DIR)) {
                        const files = fs.readdirSync(AUTH_DIR);
                        files.forEach(file => {
                            if (file !== 'creds.json') {
                                const filePath = path.join(AUTH_DIR, file);
                                try {
                                    fs.unlinkSync(filePath);
                                } catch (e) {
                                    // Ignora erros ao deletar
                                }
                            }
                        });
                    }
                    console.log('✅ Sessão limpa. Reconectando...');
                    badMACCount = 0;
                } catch (e) {
                    console.error('❌ Erro ao limpar sessão:', e.message);
                }
            }
        }
    }

    // Escuta erros não tratados no socket
    process.on('uncaughtException', (err) => {
        handleSessionError(err);
    });
    process.on('unhandledRejection', (reason) => {
        if (reason) {
            handleSessionError(reason instanceof Error ? reason : new Error(String(reason)));
        }
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('\n📱 Escaneie o QR Code abaixo para conectar ao WhatsApp:');
            qrcode.generate(qr, { small: true });
            console.log('\n⏳ Aguardando leitura do QR Code...');
            if (onQR) onQR(qr);
        }

        if (connection === 'close') {
            const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
            const reasonName = Object.keys(DisconnectReason).find(k => DisconnectReason[k] === reason) || reason;
            console.log(`🔌 [${getTimestamp()}] Conexão fechada. Motivo: ${reason} (${reasonName})`);

            if (onDisconnected) onDisconnected(reasonName);

            if (reason !== DisconnectReason.loggedOut) {
                console.log('🔄 Tentando reconectar em 5 segundos...');
                setTimeout(() => {
                    console.log('🔄 Reconectando...');
                    startWhatsAppBot(callbacks);
                }, 5000);
            } else {
                console.log('🚪 Sessão encerrada. Delete a pasta "auth" e reinicie.');
                if (onAuthState) onAuthState(false);
            }
        }

        if (connection === 'open') {
            console.log(`✅ [${getTimestamp()}] WhatsApp conectado com sucesso!`);
            if (onConnected) onConnected();
        }
    });

    sock.ev.on('messages.upsert', async (messageUpsert) => {
        try {
            if (messageUpsert.type !== 'notify') return;

            for (const msg of messageUpsert.messages) {
                if (msg.key.fromMe) continue;
                if (msg.key.remoteJid === 'status@broadcast') continue;

                const chatId = msg.key.remoteJid;
                const messageText = msg.message?.conversation ||
                                    msg.message?.extendedTextMessage?.text ||
                                    '';
                const senderNumber = getPhoneNumber(msg.key.participant || msg.key.remoteJid);

                if (!messageText.trim()) continue;

                const isCommand = await handleCommands(sock, chatId, messageText, senderNumber);
                if (isCommand) continue;

                if (!state.activeChats.has(chatId)) continue;

                console.log(`💬 [${getTimestamp()}] ${senderNumber}: ${messageText.substring(0, 100)}${messageText.length > 100 ? '...' : ''}`);
                await sendTypingIndicator(sock, chatId);

                try {
                    const aiResponse = await getAIResponse(chatId, messageText);
                    await sendMessage(sock, chatId, aiResponse);
                    console.log(`🤖 [${getTimestamp()}] Resposta enviada para ${senderNumber}`);
                } catch (error) {
                    console.error(`❌ [${getTimestamp()}] Erro IA ${senderNumber}:`, error.message);
                    await sendMessage(sock, chatId, `❌ Erro ao processar: ${error.message}`);
                }
            }
        } catch (error) {
            console.error('❌ Erro no processamento de mensagens:', error.message);
        }
    });

    return sock;
}

// -----------------------------------------------------------------------------
// EXPORTAÇÕES
// -----------------------------------------------------------------------------

module.exports = { startWhatsAppBot, validateConfig };

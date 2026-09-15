const path = require('path');
const fs = require('fs');
const pino = require('pino');
const qrcode = require('qrcode');
const baileys = require('@whiskeysockets/baileys');

const makeWASocket = baileys.makeWASocket || baileys.default;
const { useMultiFileAuthState, DisconnectReason } = baileys;

const SESSION_DIR = path.join(__dirname, 'whatsapp_session');

let sock = null;
let isInitializing = false;

const botState = {
    status: 'DISCONNECTED', // 'DISCONNECTED' | 'SCAN_QR' | 'CONNECTING' | 'CONNECTED'
    qrDataUrl: null,
    qrRaw: null,
    connectedPhone: null,
    connectedName: null,
    lastConnectedAt: null,
    lastError: null
};

/**
 * Initialize WhatsApp Bot using Baileys
 */
async function initWhatsAppBot() {
    if (isInitializing) return;
    isInitializing = true;

    try {
        if (!fs.existsSync(SESSION_DIR)) {
            fs.mkdirSync(SESSION_DIR, { recursive: true });
        }

        botState.status = 'CONNECTING';

        const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
        const logger = pino({ level: 'silent' });

        sock = makeWASocket({
            auth: state,
            logger,
            printQRInTerminal: false,
            browser: ['Nelna Agri System', 'Chrome', '1.0.0'],
            syncFullHistory: false,
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 30000
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                botState.status = 'SCAN_QR';
                botState.qrRaw = qr;
                try {
                    botState.qrDataUrl = await qrcode.toDataURL(qr, {
                        width: 280,
                        margin: 2,
                        color: {
                            dark: '#0b532c',
                            light: '#ffffff'
                        }
                    });
                } catch (qrErr) {
                    console.error('[WHATSAPP BOT] Failed to generate QR data URL:', qrErr);
                }
            }

            if (connection === 'open') {
                botState.status = 'CONNECTED';
                botState.qrDataUrl = null;
                botState.qrRaw = null;
                const rawJid = sock.user?.id || '';
                botState.connectedPhone = rawJid.split(':')[0] || rawJid.split('@')[0];
                botState.connectedName = sock.user?.name || 'Nelna WhatsApp Gateway';
                botState.lastConnectedAt = new Date();
                botState.lastError = null;
                console.log(`[WHATSAPP BOT] Connected successfully as ${botState.connectedPhone} (${botState.connectedName})`);
            } else if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                
                console.log(`[WHATSAPP BOT] Connection closed (code ${statusCode}). Reconnecting: ${shouldReconnect}`);

                if (shouldReconnect) {
                    botState.status = 'CONNECTING';
                    setTimeout(() => {
                        isInitializing = false;
                        initWhatsAppBot();
                    }, 5000);
                } else {
                    botState.status = 'DISCONNECTED';
                    botState.connectedPhone = null;
                    botState.connectedName = null;
                    botState.qrDataUrl = null;
                    try {
                        if (fs.existsSync(SESSION_DIR)) {
                            fs.rmSync(SESSION_DIR, { recursive: true, force: true });
                        }
                    } catch (rmErr) {}
                    setTimeout(() => {
                        isInitializing = false;
                        initWhatsAppBot();
                    }, 3000);
                }
            }
        });

    } catch (err) {
        console.error('[WHATSAPP BOT] Initialization error:', err);
        botState.status = 'DISCONNECTED';
        botState.lastError = err.message;
    } finally {
        isInitializing = false;
    }
}

/**
 * Get current bot status
 */
function getBotStatus() {
    return {
        status: botState.status,
        qrDataUrl: botState.qrDataUrl,
        connectedPhone: botState.connectedPhone,
        connectedName: botState.connectedName,
        lastConnectedAt: botState.lastConnectedAt,
        lastError: botState.lastError
    };
}

/**
 * Send a direct WhatsApp text message to any phone number
 * @param {string} phone - Target phone number
 * @param {string} messageText - Message body
 */
async function sendWhatsAppMessage(phone, messageText) {
    if (botState.status !== 'CONNECTED' || !sock) {
        throw new Error('WhatsApp Bot is not connected. Please link via Settings.');
    }

    let cleanPhone = String(phone).replace(/\D/g, '');
    if (cleanPhone.startsWith('940') && cleanPhone.length === 12) {
        cleanPhone = '94' + cleanPhone.substring(3);
    } else if (cleanPhone.startsWith('0') && cleanPhone.length === 10) {
        cleanPhone = '94' + cleanPhone.substring(1);
    } else if (cleanPhone.length === 9) {
        cleanPhone = '94' + cleanPhone;
    }

    const jid = `${cleanPhone}@s.whatsapp.net`;
    const result = await sock.sendMessage(jid, { text: messageText });
    return {
        success: true,
        messageId: result?.key?.id,
        targetPhone: cleanPhone
    };
}

/**
 * Logout and remove active session
 */
async function logoutWhatsAppBot() {
    try {
        if (sock) {
            await sock.logout();
        }
    } catch (e) {
        console.warn('[WHATSAPP BOT] Logout exception:', e.message);
    }

    botState.status = 'DISCONNECTED';
    botState.connectedPhone = null;
    botState.connectedName = null;
    botState.qrDataUrl = null;

    try {
        if (fs.existsSync(SESSION_DIR)) {
            fs.rmSync(SESSION_DIR, { recursive: true, force: true });
        }
    } catch (e) {}

    isInitializing = false;
    setTimeout(() => initWhatsAppBot(), 1500);

    return { success: true };
}

/**
 * Force refresh/restart session
 */
async function restartWhatsAppBot() {
    try {
        if (sock) {
            sock.end(new Error('Manual restart triggered'));
        }
    } catch (e) {}

    isInitializing = false;
    await initWhatsAppBot();
    return getBotStatus();
}

module.exports = {
    initWhatsAppBot,
    getBotStatus,
    sendWhatsAppMessage,
    logoutWhatsAppBot,
    restartWhatsAppBot
};

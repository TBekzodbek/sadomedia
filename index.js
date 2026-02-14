require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs-extra');
const path = require('path');
const express = require('express');
const axios = require('axios');

// Import Services
const { cleanFilename } = require('./utils/helpers');
const { searchVideo, searchMusic, getVideoInfo, getVideoTitle, downloadMedia } = require('./utils/youtubeService');
const { recognizeAudio } = require('./utils/shazamService');
const { getText } = require('./utils/localization');
const { checkText, checkMetadata, addStrike, isUserBlocked, resetStrikes } = require('./utils/moderation');
const { getLang, setLang, getState, setState, getRequest, setRequest, getResults, setResults, getAllUsers, getUser } = require('./utils/storage');

// GLOBAL ERROR HANDLERS
process.on('uncaughtException', (error) => {
    console.error('⚠️ TUTILMAGAN XATOLIK (CRASH OLDINI OLINDI):', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️ USHLANMAGAN VADA (REJECTION):', reason);
});

// Initialize Bot
const token = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;
if (!token) {
    console.error('❌ ERROR: TELEGRAM_BOT_TOKEN is not defined!');
    console.error('ℹ️  Available Environment Variables (Keys only):', Object.keys(process.env).join(', '));
    console.error('👉 Please check your Railway/Heroku settings and ensure "TELEGRAM_BOT_TOKEN" is added exactly.');
    process.exit(1);
}

// Singleton Instance ID
const INSTANCE_ID = Math.floor(Math.random() * 8999) + 1000;
const ADMIN_IDS = ['8436702697', '6863577417', '860609947'];
const isAdmin = (chatId) => ADMIN_IDS.includes(String(chatId));

// SINGLETON CHECK & SERVER
const app = express();
const PORT = process.env.PORT || 3001;

const server = app.listen(PORT, () => {
    console.log(`SadoMedia Bot ishga tushdi (v2.0 - State Machine)... Port: ${PORT}`);
    console.log(`🔒 INSTANCE ID: ${INSTANCE_ID}`);
    startBot();
});

server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
        console.error('⚠️ DIQQAT: Bot allaqachon ishlab turibdi! (Port 3001 band).');
        console.error('Bu nusxa yopilmoqda...');
        process.exit(1);
    }
});

// User States
const STATES = {
    MAIN: 'MAIN',
    WAITING_MUSIC: 'WAITING_MUSIC',
    WAITING_VIDEO: 'WAITING_VIDEO',
    WAITING_AUDIO: 'WAITING_AUDIO',
    WAITING_BROADCAST: 'WAITING_BROADCAST'
};

// Graceful Shutdown Handler
let globalBot = null;
let botUsername = 'SadoMedia_bot'; // Default fallback


async function shutdown(signal) {
    console.log(`\n🛑 [ID: ${INSTANCE_ID}] ${signal} qabul qilindi. Bot yopilmoqda...`);
    if (globalBot) {
        await globalBot.stopPolling();
        console.log('✅ Polling to\'xtatildi.');
    }
    server.close(() => {
        console.log('✅ Server yopildi.');
        process.exit(0);
    });

    // Fallback exit if server doesn't close
    setTimeout(() => {
        console.log('⚠️ Majburiy yopilish...');
        process.exit(1);
    }, 5000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

function startBot() {
    const bot = new TelegramBot(token, { polling: true });
    globalBot = bot;

    // Clear Webhooks if the method exists (prevents conflicts)
    const delWebhook = bot.deleteWebhook || bot.deleteWebHook;
    if (delWebhook) {
        delWebhook.call(bot).then(() => {
            console.log(`[ID: ${INSTANCE_ID}] Webhook cleared. Starting polling...`);
        }).catch(err => {
            console.warn(`[ID: ${INSTANCE_ID}] Webhook clear error (ignoring):`, err.message);
        });
    } else {
        console.log(`[ID: ${INSTANCE_ID}] deleteWebhook not supported, skipping...`);
    }

    bot.on('polling_error', (error) => {
        if (error.code === 'ETELEGRAM' && error.message.includes('Conflict')) {
            console.error(`⚠️ [ID: ${INSTANCE_ID}] Polling Conflict: Boshqa bot instance ishlab turibdi! Iltimos, boshqa botlarni o'chiring.`);
        } else {
            console.error(`⚠️ [ID: ${INSTANCE_ID}] Polling Error:`, error.message);
        }
    });

    bot.getMe().then((me) => {
        botUsername = me.username;
        console.log(`✅ [ID: ${INSTANCE_ID}] Bot muvaffaqiyatli ulandi! Username: @${botUsername}`);
        console.log(`📡 [ID: ${INSTANCE_ID}] Polling boshlandi...`);

        // Notify Admins on startup
        ADMIN_IDS.forEach(adminId => {
            bot.sendMessage(adminId, `🚀 **Bot Ishga Tushdi!**\n\n📌 **Instance ID:** ${INSTANCE_ID}\n🤖 **Bot:** @${me.username}\n🔄 **Hozirgi holat:** Polling boshlandi.`, { parse_mode: 'Markdown' }).catch(() => { });
        });
    }).catch(err => {
        console.error(`❌ [ID: ${INSTANCE_ID}] Bot ulanishda xatolik:`, err.message);
    });

    // Heartbeat Log (Every 60 seconds for debugging)
    setInterval(() => {
        console.log(`💓 [ID: ${INSTANCE_ID}] Bot holati - OK (Polling: ${bot.isPolling()})`);
    }, 60000);

    const DOWNLOADS_DIR = path.join(__dirname, 'downloads');
    fs.ensureDirSync(DOWNLOADS_DIR);

    // Helpers
    // State and Language management is now handled by storage.js

    // Aliases to match existing code usage
    const setUserState = setState;
    const getUserState = getState;

    const debugSend = (chatId, text, options = {}) => {
        // Log with ID for debugging, but send clean text to user
        console.log(`📡 [ID: ${INSTANCE_ID}] Sending to ${chatId}: ${text.substring(0, 50)}...`);
        return bot.sendMessage(chatId, text, options);
    };

    const getMainMenu = (lang) => ({
        reply_markup: {
            keyboard: [
                [{ text: getText(lang, 'menu_share') }]
            ],
            resize_keyboard: true
        }
    });

    const getBackMenu = (lang) => ({
        reply_markup: {
            keyboard: [[getText(lang, 'menu_back')]],
            resize_keyboard: true
        }
    });

    // Removed static MAIN_MENU and BACK_MENU in favor of dynamic functions

    // 1. Handle /start
    bot.onText(/\/start/, (msg) => {
        const chatId = msg.chat.id;
        setUserState(chatId, STATES.MAIN);

        // Send Welcome Message first
        debugSend(chatId, "👋 **Welcome to SadoMedia Bot!**\n\n🇺🇿 Xush kelibsiz!\n🇷🇺 Добро пожаловать!", { parse_mode: 'Markdown' })
            .then(() => {
                // Offer Language Selection
                debugSend(chatId, "🇺🇿 Iltimos, tilni tanlang:\n🇺🇿 Илтимос, тилни танланг:\n🇷🇺 Пожалуйста, выберите язык:\n🇬🇧 Please select a language:", {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: "🇺🇿 O'zbekcha", callback_data: 'lang_uz' }, { text: "🇺🇿 Ўзбекча (Кирилл)", callback_data: 'lang_uz_cyrl' }],
                            [{ text: "🇷🇺 Русский", callback_data: 'lang_ru' }, { text: "🇬🇧 English", callback_data: 'lang_en' }]
                        ]
                    }
                });
            });
    });



    // Admin Command: /admin
    bot.onText(/\/admin/, (msg) => {
        const chatId = msg.chat.id;
        if (!isAdmin(chatId)) return;

        const lang = getLang(chatId);
        const adminKeyboard = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "📊 Statistika", callback_data: 'admin_stats' }],
                    [{ text: "📢 Xabar yuborish (Broadcast)", callback_data: 'admin_broadcast' }],
                    [{ text: "👥 Foydalanuvchilar bazasi", callback_data: 'admin_users' }],
                    [{ text: "❌ Panelni yopish", callback_data: 'admin_close' }]
                ]
            }
        };

        bot.sendMessage(chatId, "🛠 **Admin Panel**\n\nBotni boshqarish uchun quyidagi tugmalardan foydalaning:", { parse_mode: 'Markdown', ...adminKeyboard });
    });

    // Admin Command: /unblock <chatId>
    bot.onText(/\/unblock (.+)/, (msg, match) => {
        const chatId = msg.chat.id;
        const targetId = match[1];

        if (!isAdmin(chatId)) {
            return; // Ignore non-admins
        }

        if (targetId) {
            resetStrikes(parseInt(targetId));
            debugSend(chatId, `✅ User ${targetId} unblocked.`);
            bot.sendMessage(targetId, "✅ **Siz blokdan chiqarildingiz.**\nQoidalarga rioya qiling.", { parse_mode: 'Markdown' }).catch(() => { });
        } else {
            debugSend(chatId, "⚠️ Usage: /unblock <chatId>");
        }
    });

    // Admin Command: /stats
    bot.onText(/\/stats/, async (msg) => {
        const chatId = msg.chat.id;

        if (!isAdmin(chatId)) return;

        const allUsers = getAllUsers();
        const userCount = Object.keys(allUsers).length;

        const statsMsg = `📊 **Bot Stats**\n\n👥 Total Users: ${userCount}\n🔒 Instance ID: ${INSTANCE_ID}\n🌐 Portfolio: @SadoMedia_bot`;
        debugSend(chatId, statsMsg, { parse_mode: 'Markdown' });
    });

    // 2. Handle Text Messages
    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        const text = msg.text;
        const user = msg.from ? `@${msg.from.username || msg.from.first_name}` : 'Unknown';

        // Update User info in DB
        getUser(chatId, {
            username: msg.from?.username || '',
            first_name: msg.from?.first_name || '',
            last_name: msg.from?.last_name || ''
        });

        console.log(`📩 [ID: ${INSTANCE_ID}] Message from ${user}: ${text || '[Media]'}`);

        if (!text || text.startsWith('/')) return;

        const lang = getLang(chatId);

        // STRIKE CHECKS (Block Middleware)
        if (isUserBlocked(chatId)) {
            bot.sendMessage(chatId, getText(lang, 'user_blocked'));
            return;
        }

        // --- BROADCAST HANDLING ---
        if (getUserState(chatId) === STATES.WAITING_BROADCAST && isAdmin(chatId)) {
            const allUsers = getAllUsers();
            const userIds = Object.keys(allUsers);
            let sentCount = 0;
            let failCount = 0;

            bot.sendMessage(chatId, `🚀 Broadcast boshlandi... (${userIds.length} foydalanuvchi)`);

            for (const id of userIds) {
                try {
                    await bot.sendMessage(id, text);
                    sentCount++;
                } catch (err) {
                    failCount++;
                }
            }

            setUserState(chatId, STATES.MAIN);
            bot.sendMessage(chatId, `✅ Broadcast yakunlandi.\n\n🟢 Yuborildi: ${sentCount}\n🔴 Xatolik: ${failCount}`);
            return;
        }

        // --- GLOBAL COMMANDS ---

        if (text === getText(lang, 'menu_back')) {
            setUserState(chatId, STATES.MAIN);
            setRequest(chatId, null);
            bot.sendMessage(chatId, getText(lang, 'welcome'), getMainMenu(lang));
            return;
        }

        if (text.includes("Botni ulashish") || text.includes("Поделиться") || text.includes("Share Bot") || text.includes("Ботни улашиш")) {
            const shareText = getText(lang, 'share_text').replace('{username}', botUsername);
            const shareLink = `https://t.me/share/url?url=https://t.me/${botUsername}&text=${encodeURIComponent(getText(lang, 'share_text').replace('{username}', botUsername))}`;

            bot.sendMessage(chatId, shareText, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[{ text: getText(lang, 'btn_share'), url: shareLink }]]
                }
            });
            return;
        }

        // --- SMART HANDLING (MAIN STATE) ---
        // 1. Check if URL -> Video Download
        if (text.match(/https?:\/\//)) {
            // debugSend removed here because processUrl sends its own status
            processUrl(chatId, text, 'video');
            return;
        }

        // 2. If Text -> Music Search
        const safety = checkText(text);
        if (!safety.safe) {
            const strikeData = addStrike(chatId);
            debugSend(chatId, getText(lang, 'warning_adult'));
            debugSend(chatId, getText(lang, 'warning_strike').replace('{count}', strikeData.count));
            return;
        }

        debugSend(chatId, getText(lang, 'searching'), { disable_notification: true });

        // Non-blocking search
        const searchQuery = `${text} audio`;

        searchMusic(searchQuery, 10).then(output => {
            const entries = output.entries || (Array.isArray(output) ? output : [output]);

            if (!entries || entries.length === 0) {
                bot.sendMessage(chatId, getText(lang, 'not_found'), getMainMenu(lang));
                return;
            }

            const searchKeyboard = [];
            const pageResults = entries.slice(0, 10);

            pageResults.forEach((entry, index) => {
                const title = entry.title.substring(0, 50);
                const videoId = entry.id;

                let durationStr = '';
                if (entry.duration) {
                    const date = new Date(0);
                    date.setSeconds(entry.duration);
                    const timeString = date.toISOString().substr(14, 5);
                    durationStr = ` (${timeString})`;
                }
                searchKeyboard.push([{ text: `${index + 1}. ${title}${durationStr}`, callback_data: `sel_${videoId}` }]);
            });

            // Add Next Button if there are more than 10 results
            if (entries.length > 10) {
                setResults(chatId, { total: entries, page: 1 });
                searchKeyboard.push([{ text: "➡️ Keyingisi / Next", callback_data: `next_results` }]);
            }

            debugSend(chatId, `🎶 **Natijalar:**`, {
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: searchKeyboard }
            });
        }).catch(err => {
            console.error(err);
            debugSend(chatId, getText(lang, 'error'), getMainMenu(lang));
        });
    });

    // 3. Helpers: Process URL & Action Loop
    // userRequests is now managed by storage.js (getRequest/setRequest)

    const sendActionLoop = (chatId, action) => {
        bot.sendChatAction(chatId, action).catch(() => { });
        const interval = setInterval(() => {
            bot.sendChatAction(chatId, action).catch(() => { });
        }, 4000);
        return () => clearInterval(interval);
    };

    async function processUrl(chatId, url, typeContext) {
        const lang = getLang(chatId);
        // Immediate feedback so user knows we are working
        const statusMsg = await debugSend(chatId, getText(lang, 'processing'));

        try {
            // Safety Check 1: URL Keywords (Fast)
            const textSafety = checkText(url);
            if (!textSafety.safe) {
                const strikeData = addStrike(chatId);
                debugSend(chatId, getText(lang, 'warning_adult'));
                debugSend(chatId, getText(lang, 'warning_strike').replace('{count}', strikeData.count));
                return;
            }

            // Safety Check 2: Metadata (Deep)
            // We now use the improved getVideoInfo which is robust and provides thumbnails
            const info = await getVideoInfo(url).catch(() => null);
            const title = info ? info.title : await getVideoTitle(url);

            await bot.deleteMessage(chatId, statusMsg.message_id).catch(() => { });

            if (!title) {
                debugSend(chatId, getText(lang, 'error'), getBackMenu(lang));
                return;
            }

            setRequest(chatId, { url, title: title, type: 'video' });

            const safeTitle = cleanFilename(title);
            const options = {
                outputPath: path.join(DOWNLOADS_DIR, `${safeTitle}_${Date.now()}.%(ext)s`),
                height: 'best'
            };

            const mediaOptions = {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🎵 Audio (MP3)', callback_data: 'target_mp3' }]
                    ]
                }
            };

            const stopAction = sendActionLoop(chatId, 'upload_video');
            try {
                await handleDownload(chatId, url, 'video', options, title, null, mediaOptions);
            } finally {
                stopAction();
            }
        } catch (error) {
            console.error(error);
            const lang = getLang(chatId);
            debugSend(chatId, getText(lang, 'error'), getBackMenu(lang));
        }
    }

    // 4. Handle Callbacks
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const data = query.data;

        // Update User info on Callback
        if (query.from) {
            getUser(chatId, {
                username: query.from.username || '',
                first_name: query.from.first_name || '',
                last_name: query.from.last_name || ''
            });
        }

        // Always answer immediately to stop the button loading animation
        // Always answer immediately to stop the button loading animation
        try { await bot.answerCallbackQuery(query.id, { text: getText(lang, 'processing') }); } catch (e) { }


        const lang = getLang(chatId);

        // --- ADMIN CALLBACKS ---
        if (data.startsWith('admin_')) {
            if (!isAdmin(chatId)) return;

            if (data === 'admin_stats') {
                const allUsers = getAllUsers();
                const userCount = Object.keys(allUsers).length;
                bot.sendMessage(chatId, `📊 **Statistika:**\n\nJami foydalanuvchilar: ${userCount}`, { parse_mode: 'Markdown' });
            } else if (data === 'admin_broadcast') {
                setUserState(chatId, STATES.WAITING_BROADCAST);
                bot.sendMessage(chatId, "📝 **Hamma foydalanuvchilarga yubormoqchi bo'lgan xabaringizni yozing:**\n(Bekor qilish uchun /admin deb yozing)", { parse_mode: 'Markdown' });
            } else if (data === 'admin_users') {
                const allUsers = getAllUsers();
                let userList = "👥 **Foydalanuvchilar ro'yxati:**\n\n";
                const userEntries = Object.entries(allUsers);

                userEntries.slice(0, 50).forEach(([id, u], i) => {
                    const uname = u.username ? `@${u.username}` : (u.first_name || 'Noma\'lum');
                    userList += `${i + 1}. [${id}] ${uname}\n`;
                });

                if (userEntries.length > 50) userList += "\n...va yana ko'plab foydalanuvchilar.";
                bot.sendMessage(chatId, userList, { parse_mode: 'Markdown' });
            } else if (data === 'admin_close') {
                bot.deleteMessage(chatId, query.message.message_id).catch(() => { });
            }
            return;
        }

        // --- LANGUAGE SELECTION ---
        if (data.startsWith('lang_')) {
            const selectedLang = data.replace('lang_', '');
            setLang(chatId, selectedLang);
            bot.sendMessage(chatId, getText(selectedLang, 'welcome'), {
                parse_mode: 'Markdown',
                ...getMainMenu(selectedLang)
            });
            return;
        }

        // --- PAGINATION ---
        if (data === 'next_results') {
            const results = getResults(chatId);
            if (!results) return;

            const { total, page } = results;
            const startLimit = page * 10;
            const nextBatch = total.slice(startLimit, startLimit + 10);

            if (nextBatch.length === 0) {
                bot.answerCallbackQuery(query.id, { text: "Boshqa natija yo'q" });
                return;
            }

            const searchKeyboard = [];
            nextBatch.forEach((entry, index) => {
                const title = entry.title.substring(0, 50);
                const videoId = entry.id;
                let durationStr = '';
                if (entry.duration) {
                    const date = new Date(0);
                    date.setSeconds(entry.duration);
                    const timeString = date.toISOString().substr(14, 5);
                    durationStr = ` (${timeString})`;
                }
                searchKeyboard.push([{ text: `${startLimit + index + 1}. ${title}${durationStr}`, callback_data: `sel_${videoId}` }]);
            });

            const hasMore = total.length > startLimit + 10;
            if (hasMore) {
                setResults(chatId, { total, page: page + 1 });
                searchKeyboard.push([{ text: "➡️ Keyingisi / Next", callback_data: `next_results` }]);
            } else {
                setResults(chatId, null);
            }

            bot.editMessageReplyMarkup({ inline_keyboard: searchKeyboard }, { chatId, message_id: query.message.message_id });
            return;
        }

        // --- SEARCH SELECTION ---
        if (data.startsWith('sel_')) {
            const videoId = data.replace('sel_', '');
            const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

            bot.editMessageText(getText(lang, 'downloading'), { chatId, messageId: query.message.message_id });

            // Start "uploading audio" action loop
            const stopAction = sendActionLoop(chatId, 'upload_voice');

            // Auto-download Audio for music search
            handleDownload(chatId, videoUrl, 'audio', { outputPath: 'temp' }, null, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: getText(lang, 'search_again'), callback_data: 'reset_music' }],
                    ]
                }
            })
                .finally(() => {
                    stopAction(); // Stop the action loop
                });
            return;
        }

        // --- RESET MUSIC ---
        if (data === 'reset_music') {
            setUserState(chatId, STATES.WAITING_MUSIC);
            debugSend(chatId, getText(lang, 'prompt_music'), getBackMenu(lang));
            return;
        }

        // --- SEARCH FROM SHAZAM ---
        if (data.startsWith('search_')) {
            const queryText = data.replace('search_', '');

            // Inject into search flow
            setUserState(chatId, STATES.WAITING_MUSIC);
            debugSend(chatId, getText(lang, 'searching'));

            const stopAction = sendActionLoop(chatId, 'typing'); // Search might take a moment

            // Use searchMusic to ensure we get the song, not a reaction/loop
            searchMusic(queryText, 5).then(output => {
                const entries = output.entries || (Array.isArray(output) ? output : [output]);
                if (!entries || entries.length === 0) {
                    debugSend(chatId, getText(lang, 'not_found'), getBackMenu(lang));
                    return;
                }
                const searchKeyboard = [];
                entries.forEach((entry, index) => {
                    // Format Duration
                    let durationStr = '';
                    if (entry.duration) {
                        const date = new Date(0);
                        date.setSeconds(entry.duration);
                        const timeString = date.toISOString().substr(14, 5);
                        durationStr = ` (${timeString})`;
                    }
                    searchKeyboard.push([{ text: `${index + 1}. ${entry.title.substring(0, 50)}${durationStr}`, callback_data: `sel_${entry.id}` }]);
                });
                debugSend(chatId, `🎶 **Natijalar:**`, { reply_markup: { inline_keyboard: searchKeyboard } });
            }).finally(() => stopAction());
            return;
        }


        // --- DOWNLOAD SELECTION ---
        if (data === 'cancel_req') {
            setRequest(chatId, null);
            bot.deleteMessage(chatId, query.message.message_id).catch(() => { });
            debugSend(chatId, getText(lang, 'main_menu'), getMainMenu(lang));
            return;
        }

        const reqData = getRequest(chatId);
        if (!reqData) {
            // No answerCallbackQuery needed here as it was done at top
            return;
        }

        const { url, title } = reqData;
        const safeTitle = cleanFilename(title);

        if (data === 'target_mp3' && query.message.video) {
            // If from audio button on video, don't delete the video message
        } else {
            bot.deleteMessage(chatId, query.message.message_id).catch(() => { });
        }

        debugSend(chatId, getText(lang, 'downloading'));

        // Determine options
        let type = 'video';
        let options = { outputPath: path.join(DOWNLOADS_DIR, `${safeTitle}_${Date.now()}.%(ext)s`) };

        if (data === 'target_mp3') {
            type = 'audio';
        } else if (data === 'target_video') {
            type = 'video';
            options.height = 'best';
        }

        const actionType = type === 'audio' ? 'upload_voice' : 'upload_video';
        const stopAction = sendActionLoop(chatId, actionType);

        try {
            await handleDownload(chatId, url, type, options, title);
        } finally {
            stopAction();
        }
    });

    async function handleDownload(chatId, url, type, options, title, customMenu = null, mediaOptions = {}) {
        const lang = getLang(chatId);
        try {
            const filePath = await downloadMedia(url, type, options);

            // Size Check & Send
            const stats = await fs.stat(filePath);
            const sizeMB = stats.size / (1024 * 1024);

            if (sizeMB > 49.5) {
                debugSend(chatId, getText(lang, 'file_too_large'));
                fs.remove(filePath);
                return;
            }

            bot.sendChatAction(chatId, type === 'audio' ? 'upload_voice' : 'upload_video');

            if (type === 'audio') {
                await bot.sendAudio(chatId, filePath, {
                    title: title || 'Audio',
                    performer: '@SadoMedia_bot',
                    caption: `🎧 @SadoMedia_bot`,
                    ...mediaOptions
                });
            } else {
                await bot.sendVideo(chatId, filePath, {
                    caption: `${title || 'Video'}\n\n🤖 @SadoMedia_bot`,
                    supports_streaming: true,
                    ...mediaOptions
                });
            }

            await fs.remove(filePath);

            // Clear request after successful completion
            setRequest(chatId, null);

            // After download, show Home button or Custom Menu
            const finalMenu = customMenu || getBackMenu(lang);
            debugSend(chatId, getText(lang, 'done'), finalMenu);

        } catch (error) {
            console.error('Download Error:', error);
            const errMsg = error.message.substring(0, 120);
            bot.sendMessage(chatId, `${getText(lang, 'error')}\n\n⚠️ Detail: ${errMsg}`, getBackMenu(lang));
        }
    }

    // 5. Handle Voice (Shazam) - Global Handler
    bot.on('voice', handleAudioMessage);
    bot.on('audio', handleAudioMessage);

    async function handleAudioMessage(msg) {
        const chatId = msg.chat.id;
        const lang = getLang(chatId);
        const fileId = msg.voice ? msg.voice.file_id : msg.audio.file_id;

        bot.sendChatAction(chatId, 'record_voice');
        const statusMsg = await debugSend(chatId, getText(lang, 'searching'));

        try {
            const fileLink = await bot.getFileLink(fileId);
            const response = await axios({ url: fileLink, method: 'GET', responseType: 'arraybuffer' });
            const track = await recognizeAudio(Buffer.from(response.data));

            await bot.deleteMessage(chatId, statusMsg.message_id);

            if (track) {
                const { title, artist, album, year } = track;
                const caption = `${getText(lang, 'shazam_found')}\n\n**${getText(lang, 'label_artist')}:** ${artist}\n**${getText(lang, 'label_title')}:** ${title}\n**${getText(lang, 'label_album')}:** ${album || '-'}\n**${getText(lang, 'label_year')}:** ${year || '-'}`;

                await debugSend(chatId, caption, {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [[{ text: '📥 Yuklab olish', callback_data: `search_${artist} - ${title}`.substring(0, 64) }]]
                    }
                });
            } else {
                debugSend(chatId, getText(lang, 'shazam_not_found'), getBackMenu(lang));
            }
        } catch (error) {
            console.error('Shazam Error:', error);
            await bot.deleteMessage(chatId, statusMsg.message_id);
            debugSend(chatId, getText(lang, 'error'), getBackMenu(lang));
        }
    }
}

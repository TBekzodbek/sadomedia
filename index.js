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
const { getLang, setLang, getState, setState, getRequest, setRequest, getResults, setResults, getAllUsers, getUser, saveBroadcast, getLastBroadcast, getBroadcastContent, setBroadcastContent } = require('./utils/storage');

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
const ADMIN_IDS = ['6863577417', '860609947', '6456517295'];
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
    WAITING_BROADCAST: 'WAITING_BROADCAST',
    WAITING_BROADCAST_CONFIRM: 'WAITING_BROADCAST_CONFIRM'
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
        const escapedMeUsername = me.username.replace(/_/g, '\\_');
        ADMIN_IDS.forEach(adminId => {
            bot.sendMessage(adminId, `🚀 **Bot Ishga Tushdi!**\n\n📌 **Instance ID:** ${INSTANCE_ID}\n🤖 **Bot:** @${escapedMeUsername}\n🔄 **Hozirgi holat:** Polling boshlandi.`, { parse_mode: 'Markdown' }).catch(() => { });
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

    const getMainMenu = (lang) => {
        const keyboard = [];
        keyboard.push([{ text: getText(lang, 'menu_music') }, { text: getText(lang, 'menu_video') }]);
        keyboard.push([{ text: getText(lang, 'menu_help') }, { text: getText(lang, 'menu_share') }]);

        return {
            reply_markup: {
                keyboard: keyboard,
                resize_keyboard: true
            }
        };
    };

    const getBackMenu = (lang) => ({
        reply_markup: {
            keyboard: [[getText(lang, 'menu_back')]],
            resize_keyboard: true
        }
    });

    // Higher-order helper for robust command matching
    const { TEXTS: ALL_TEXTS } = require('./utils/localization');
    const isCommand = (text, key) => {
        if (!text) return false;
        const normalizedText = text.trim();
        return Object.values(ALL_TEXTS).some(langTexts => langTexts[key] === normalizedText);
    };

    // Removed static MAIN_MENU and BACK_MENU in favor of dynamic functions

    // 1. Handle /start
    bot.onText(/\/start/, async (msg) => {
        const chatId = msg.chat.id;
        await setUserState(chatId, STATES.MAIN);

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
    bot.onText(/\/admin/, async (msg) => {
        const chatId = msg.chat.id;
        if (!isAdmin(chatId)) return;

        const lang = await getLang(chatId);
        const adminKeyboard = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "📊 Statistika", callback_data: 'admin_stats' }],
                    [{ text: "📢 Xabar yuborish (Broadcast)", callback_data: 'admin_broadcast' }],
                    [{ text: "⬅️ Oxirgi xabarni o'chirish (Recall)", callback_data: 'admin_recall' }],
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

        const allUsers = await getAllUsers();
        const userCount = Object.keys(allUsers).length;

        const escapedBotUsername = botUsername.replace(/_/g, '\\_');
        const statsMsg = `📊 **Bot Stats**\n\n👥 Total Users: ${userCount}\n🔒 Instance ID: ${INSTANCE_ID}\n🌐 Portfolio: @${escapedBotUsername}`;
        debugSend(chatId, statsMsg, { parse_mode: 'Markdown' });
    });

    // 2. Handle Text Messages
    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        const text = msg.text;
        const user = msg.from ? `@${msg.from.username || msg.from.first_name}` : 'Unknown';

        // Update User info in DB
        await getUser(chatId, {
            username: msg.from?.username || '',
            first_name: msg.from?.first_name || '',
            last_name: msg.from?.last_name || ''
        });

        console.log(`📩 [ID: ${INSTANCE_ID}] Message from ${user}: ${text || '[Media]'}`);

        const lang = await getLang(chatId);

        // --- GLOBAL COMMAND INTERRUPTS --- (Allow escape from any state)
        if (text && text.startsWith('/')) {
            // Let the bot.onText handlers handle commands
            return;
        }

        if (text === getText(lang, 'menu_back')) {
            await setUserState(chatId, STATES.MAIN);
            setRequest(chatId, null);
            setBroadcastContent(chatId, null);
            bot.sendMessage(chatId, getText(lang, 'welcome'), getMainMenu(lang));
            return;
        }

        // Check if it's any of the main menu buttons to allow switching modes
        const menuKeys = ['menu_music', 'menu_video', 'menu_audio', 'menu_help', 'menu_lang', 'menu_share'];
        let matchedMenu = false;
        for (const key of menuKeys) {
            if (isCommand(text, key)) {
                matchedMenu = true;
                break;
            }
        }

        // If it's a menu button and not in a state that specifically MUST handle text
        if (matchedMenu) {
            // Let the Menu Commands section below handle it
            // This allows an admin to click "Settings" or "Back" to exit broadcast mode
        } else {
            // STRIKE CHECKS (Block Middleware)
            if (isUserBlocked(chatId)) {
                bot.sendMessage(chatId, getText(lang, 'user_blocked'));
                return;
            }
        }

        if (!text) return;

        // --- BROADCAST HANDLING ---
        if (await getUserState(chatId) === STATES.WAITING_BROADCAST && isAdmin(chatId)) {
            // Instead of sending, ask for confirmation
            await setBroadcastContent(chatId, { text });
            await setUserState(chatId, STATES.WAITING_BROADCAST_CONFIRM);

            bot.sendMessage(chatId, `📑 **Xabar ko'rinishi:**\n\n${text}\n\n⚠️ **Haqiqatdan ham hamma foydalanuvchilarga yubormoqchimisiz?**`, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "✅ Ha, yuborilsin (Send)", callback_data: 'confirm_broadcast' }],
                        [{ text: "❌ Bekor qilish (Cancel)", callback_data: 'cancel_broadcast' }]
                    ]
                }
            });
            return;
        }

        // --- MENU COMMANDS ---
        if (isCommand(text, 'menu_music')) {
            await setUserState(chatId, STATES.WAITING_MUSIC);
            bot.sendMessage(chatId, getText(lang, 'prompt_music'), getBackMenu(lang));
            return;
        }

        if (isCommand(text, 'menu_video')) {
            await setUserState(chatId, STATES.WAITING_VIDEO);
            bot.sendMessage(chatId, getText(lang, 'prompt_video'), getBackMenu(lang));
            return;
        }


        if (isCommand(text, 'menu_help')) {
            bot.sendMessage(chatId, getText(lang, 'help_text'), getMainMenu(lang));
            return;
        }


        // --- GLOBAL COMMANDS ---

        if (isCommand(text, 'menu_back')) {
            await setUserState(chatId, STATES.MAIN);
            setRequest(chatId, null);
            bot.sendMessage(chatId, getText(lang, 'welcome'), getMainMenu(lang));
            return;
        }

        if (isCommand(text, 'menu_share')) {
            const escapedUsername = botUsername.replace(/_/g, '\\_');
            const shareText = getText(lang, 'share_text').replace('{username}', escapedUsername);

            // Clean text for the URL (remove markdown symbols)
            const cleanShareText = getText(lang, 'share_text')
                .replace('{username}', botUsername)
                .replace(/\*\*/g, '')
                .replace(/__/g, '');

            const shareLink = `https://t.me/share/url?url=https://t.me/${botUsername}&text=${encodeURIComponent(cleanShareText)}`;

            bot.sendMessage(chatId, shareText, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[{ text: getText(lang, 'btn_share'), url: shareLink }]]
                }
            });
            return;
        }

        // Check if we are in WAITING_BROADCAST_CONFIRM and received text (ignore it)
        if (await getUserState(chatId) === STATES.WAITING_BROADCAST_CONFIRM) {
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

        searchMusic(searchQuery, 50).then(output => {
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
        const lang = await getLang(chatId);
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
            await getUser(chatId, {
                username: query.from.username || '',
                first_name: query.from.first_name || '',
                last_name: query.from.last_name || ''
            });
        }

        // Always answer immediately to stop the button loading animation
        // Always answer immediately to stop the button loading animation
        const lang = await getLang(chatId);
        try { await bot.answerCallbackQuery(query.id, { text: getText(lang, 'processing') }); } catch (e) { }


        // const lang = getLang(chatId); // Removed as we use await above

        // --- ADMIN CALLBACKS ---
        if (data.startsWith('admin_')) {
            if (!isAdmin(chatId)) return;

            if (data === 'admin_stats') {
                const allUsers = await getAllUsers();
                const userCount = Object.keys(allUsers).length;
                bot.sendMessage(chatId, `📊 **Statistika:**\n\nJami foydalanuvchilar: ${userCount}`, { parse_mode: 'Markdown' });
            } else if (data === 'admin_broadcast') {
                await setUserState(chatId, STATES.WAITING_BROADCAST);
                bot.sendMessage(chatId, "📝 **Hamma foydalanuvchilarga yubormoqchi bo'lgan xabaringizni yozing:**\n(Bekor qilish uchun menyudan boshqa bo'limni tanlang)", { parse_mode: 'Markdown' });
            } else if (data === 'confirm_broadcast' || data === 'cancel_broadcast') {
                if (!isAdmin(chatId)) return;

                if (data === 'cancel_broadcast') {
                    await setBroadcastContent(chatId, null);
                    await setUserState(chatId, STATES.MAIN);
                    bot.editMessageText("❌ **Broadcast bekor qilindi.**", { chat_id: chatId, message_id: query.message.message_id });
                    bot.sendMessage(chatId, getText(lang, 'main_menu'), getMainMenu(lang));
                    return;
                }

                const content = getBroadcastContent(chatId);
                if (!content || !content.text) {
                    bot.sendMessage(chatId, "⚠️ Xato: Xabar mazmuni topilmadi.");
                    return;
                }

                bot.editMessageText("🚀 **Broadcast boshlandi...**", { chat_id: chatId, message_id: query.message.message_id });

                const allUsers = await getAllUsers();
                const userIds = Object.keys(allUsers);
                let sentCount = 0;
                let failCount = 0;
                const broadcastRecipients = [];

                for (const id of userIds) {
                    try {
                        const sentMsg = await bot.sendMessage(id, content.text);
                        sentCount++;
                        broadcastRecipients.push({ chatId: id, messageId: sentMsg.message_id });
                    } catch (err) {
                        failCount++;
                    }
                }

                await saveBroadcast(content.text, broadcastRecipients);
                await setBroadcastContent(chatId, null);
                await setUserState(chatId, STATES.MAIN);
                bot.sendMessage(chatId, `✅ **Broadcast yakunlandi.**\n\n🟢 Yuborildi: ${sentCount}\n🔴 Xatolik: ${failCount}`, getMainMenu(lang));

            } else if (data === 'admin_recall') {
                const lastBroadcast = await getLastBroadcast();
                if (!lastBroadcast || !lastBroadcast.recipients || lastBroadcast.recipients.length === 0) {
                    bot.sendMessage(chatId, "⚠️ **O'chirish uchun xabarlar topilmadi.**\n(Faqat oxirgi yuborilgan xabarni o'chirish mumkin)");
                    return;
                }

                bot.sendMessage(chatId, `⏳ **Xabarlar o'chirilmoqda...** (${lastBroadcast.recipients.length} ta xabar)`);

                let deletedCount = 0;
                let errorCount = 0;

                for (const item of lastBroadcast.recipients) {
                    try {
                        await bot.deleteMessage(item.chatId, item.messageId);
                        deletedCount++;
                    } catch (e) {
                        errorCount++;
                    }
                }

                // Clear the file after recall
                await saveBroadcast(null, []);

                bot.sendMessage(chatId, `✅ **Xabarlar o'chirildi!**\n\n🟢 O'chirildi: ${deletedCount}\n🔴 Xatolik (allaqachon o'chirilgan yoki topilmadi): ${errorCount}`);

            } else if (data === 'admin_users') {
                const allUsers = await getAllUsers();
                const userEntries = Object.entries(allUsers);

                if (userEntries.length === 0) {
                    bot.sendMessage(chatId, "⚠️ **Foydalanuvchilar bazasi hozircha bo'sh.**\nBotdan foydalanuvchilar ko'payishi bilan bu yerda paydo bo'ladi.", { parse_mode: 'Markdown' });
                } else {
                    let userList = "👥 **Foydalanuvchilar ro'yxati:**\n\n";
                    userEntries.slice(0, 50).forEach(([id, u], i) => {
                        // Safe extraction of properties
                        const uname = u.username || '';
                        const fname = u.first_name || '';
                        const lname = u.last_name || '';

                        // Combine names and escape markdown
                        let displayName = (fname + ' ' + lname).trim();
                        if (!displayName) displayName = 'Noma\'lum';

                        // Clean for MarkdownV2/Stable Markdown
                        const safeName = displayName.replace(/[_*`[\]()]/g, '\\$&');
                        const safeUname = uname ? ` (@${uname.replace(/[_*`[\]()]/g, '\\$&')})` : '';

                        userList += `${i + 1}. \`${id}\` ${safeName}${safeUname}\n`;
                    });

                    if (userEntries.length > 50) userList += "\n...va yana ko'plab foydalanuvchilar.";

                    try {
                        await bot.sendMessage(chatId, userList, { parse_mode: 'Markdown' });
                    } catch (sendErr) {
                        console.error('Failed to send user list:', sendErr);
                        bot.sendMessage(chatId, "❌ **Xatolik:** Foydalanuvchilar ro'yxatini yuborib bo'lmadi. Ma'lumot juda ko'p yoki formatlashda xato bor.");
                    }
                }
            } else if (data === 'admin_close') {
                bot.deleteMessage(chatId, query.message.message_id).catch(() => { });
            }
            return;
        }

        // --- LANGUAGE SELECTION ---
        if (data.startsWith('lang_')) {
            const selectedLang = data.replace('lang_', '');
            await setLang(chatId, selectedLang);
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

            bot.editMessageReplyMarkup({ inline_keyboard: searchKeyboard }, { chat_id: chatId, message_id: query.message.message_id });
            return;
        }

        // --- SEARCH SELECTION ---
        if (data.startsWith('sel_')) {
            const videoId = data.replace('sel_', '');
            const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

            bot.editMessageText(getText(lang, 'downloading'), { chat_id: chatId, message_id: query.message.message_id });

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
            await setUserState(chatId, STATES.WAITING_MUSIC);
            debugSend(chatId, getText(lang, 'prompt_music'), getBackMenu(lang));
            return;
        }

        // --- SEARCH FROM SHAZAM ---
        if (data.startsWith('search_')) {
            const queryText = data.replace('search_', '');

            // Inject into search flow
            await setUserState(chatId, STATES.WAITING_MUSIC);
            debugSend(chatId, getText(lang, 'searching'));

            const stopAction = sendActionLoop(chatId, 'typing'); // Search might take a moment

            // Use searchMusic to ensure we get the song, not a reaction/loop
            searchMusic(queryText, 50).then(output => {
                const entries = output.entries || (Array.isArray(output) ? output : [output]);
                if (!entries || entries.length === 0) {
                    debugSend(chatId, getText(lang, 'not_found'), getBackMenu(lang));
                    return;
                }
                const searchKeyboard = [];
                const pageResults = entries.slice(0, 10);

                pageResults.forEach((entry, index) => {
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

                // Add Next Button if there are more than 10 results
                if (entries.length > 10) {
                    setResults(chatId, { total: entries, page: 1 });
                    searchKeyboard.push([{ text: "➡️ Keyingisi / Next", callback_data: `next_results` }]);
                }

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
        const lang = await getLang(chatId);
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
            let errMsg = error.message;
            if (errMsg.includes('Requested format is not available')) errMsg = "Tanlangan format mavjud emas. Iltimos, boshqa sifatni sinab ko'ring.";
            else if (errMsg.includes('Video unavailable')) errMsg = "Video topilmadi yoki o'chirib tashlangan.";
            else if (errMsg.includes('Sign in to confirm')) errMsg = "Bu video yosh chekloviga ega yoki avtorizatsiya talab qiladi.";
            else if (errMsg.length > 150) errMsg = errMsg.substring(0, 150) + '...';

            bot.sendMessage(chatId, `${getText(lang, 'error')}\n\n⚠️ **Sabab:** ${errMsg}`, getBackMenu(lang));
        }
    }

    // 5. Handle Voice (Shazam) - Global Handler
    bot.on('voice', handleAudioMessage);
    bot.on('audio', handleAudioMessage);

    async function handleAudioMessage(msg) {
        const chatId = msg.chat.id;
        const lang = await getLang(chatId);
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
                const esc = (text) => (text || '').replace(/[_*`[\]()]/g, '\\$&');
                const caption = `${getText(lang, 'shazam_found')}\n\n**${getText(lang, 'label_artist')}:** ${esc(artist)}\n**${getText(lang, 'label_title')}:** ${esc(title)}\n**${getText(lang, 'label_album')}:** ${esc(album)}\n**${getText(lang, 'label_year')}:** ${esc(year)}`;

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

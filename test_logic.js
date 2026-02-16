const { getText } = require('./utils/localization');

// Mocking the bot and other dependencies for a quick logic check
const bot = {
    sendMessage: (chatId, text, menu) => console.log(`[BOT SEND] To: ${chatId}\nText: ${text}\nMenu: ${JSON.stringify(menu)}`)
};

async function mockHandleError(lang, error) {
    console.log(`--- Testing Lang: ${lang} ---`);
    if (error.message === 'LOGIN_REQUIRED') {
        const text = getText(lang, 'login_required');
        console.log(`Localized Error: ${text}`);
    }
}

async function test() {
    const error = new Error('LOGIN_REQUIRED');
    await mockHandleError('uz', error);
    await mockHandleError('uz_cyrl', error);
    await mockHandleError('ru', error);
    await mockHandleError('en', error);
}

test();

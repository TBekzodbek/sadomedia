const TEXTS = {
    uz: {
        welcome: "🌟 **Assalomu alaykum! SadoMedia Bot ga xush kelibsiz!**\n\n🤖 **Men orqali siz quyidagi ijtimoiy tarmoqlardan video yuklashingiz mumkin:**\n• YouTube, Instagram, TikTok 📥\n\n• Musiqa topishingiz 🎵\n\n👇 **Foydalanish uchun:**\n\n1. 🎵 **Musiqa:** Ijrochi yoki qo'shiq nomini yuboring.\n2. 📹 **Media:** Havolani (link) yuboring.",
        main_menu: "Asosiy menyu",
        menu_music: "🎵 Musiqa qidirish",
        menu_video: "🎬 Video yuklash",
        menu_help: "❓ Yordam",
        menu_back: "🏠 Bosh sahifa",

        prompt_music: "🔍 **Musiqa nomini yoki ijrochini yozing.**\n\nMisol: *Eminem Lose Yourself*",
        prompt_video: "📥 **Video havolasini (link) yuboring:**\n(YouTube, Instagram, TikTok)",
        prompt_audio: "🔗 **Audio ajratib olish uchun video havolasini yuboring:**",

        searching: "🔎 Qidirilmoqda...",
        downloading: "⏳ Yuklanmoqda... Bir oz kuting.",
        uploading_video: "📤 Video yuklanmoqda...",
        uploading_audio: "📤 Audio yuklanmoqda...",
        processing: "⏳ Yuklanmoqda...",

        not_found: "❌ Hech narsa topilmadi. Boshqa nom bilan urinib ko'ring.",
        error: "❌ Xatolik yuz berdi.",
        invalid_link: "❌ **Noto'g'ri havola.**\nIltimos, to'g'ri video havolasini yuboring.",
        file_too_large: "⚠️ Fayl hajmi juda katta. Telegram orqali yuborib bo'lmaydi.",
        restricted_content: "⚠️ **Cheklov.**\nUshbu platforma yuklashni taqiqlagan yoki kontent shaxsiy hisoblanadi. Uni bot orqali yuklab bo'lmaydi.",
        session_expired: "⚠️ **Seans muddati tugadi.**\nIltimos, havolani qaytadan yuboring.",

        done: "✅ **Tayyor! Yana nima qilamiz?**",
        search_again: "🔁 Yana qidirish",

        select_quality: "📹 **Sifatni tanlang:**",
        select_format: "🎧 **Formatni tanlang:**",

        shazam_found: "🎵 **Topildi!**",
        shazam_not_found: "❌ Kechirasiz, bu musiqani aniqlay olmadim.",

        // Dynamic Content
        help_text: "🤖 @SadoMedia_bot\n\n1. 🎵 **Musiqa:** Ijrochi yoki qo'shiq nomini yuboring.\n2. 🎬 **Media:** Havolani (link) yuboring (YouTube, Instagram, TikTok).",
        label_artist: "🎤 Ijrochi",
        label_title: "🎵 Nomi",
        label_album: "💿 Albom",
        label_year: "📅 Yil",
        label_lyrics: "📜 Qo'shiq matni",
        btn_lyrics: "🎼 Qo'shiq matni",

        // Safety
        warning_adult: "🚫 **Kechirasiz, ushbu kontent 18+ chekloviga ega yoki noto'g'ri so'zlarni o'z ichiga oladi.**\n\nBiz pornografik va zararli kontent tarqalishiga qarshimiz.",
        warning_strike: "⚠️ **Ogohlantirish!** ({count}/3)\nIltimos, botdan to'g'ri maqsadda foydalaning. Aks holda bloklanasiz.",
        user_blocked: "🚫 **Siz bloklandingiz.**\nBotdan foydalanish qoidalari buzilgani sababli cheklov qo'yildi.",

        menu_share: "📣 Botni ulashish",
        share_text: "🚀 **SadoMedia Bot** - YouTube, Instagram, TikTok dan video yuklash va musiqalar topish uchun eng yaxshi yordamchingiz!\n\nBotni bu yerda topishingiz mumkin: @{username}",
        menu_shazam: "🔍 Audio orqali musiqa topish",
        prompt_shazam: "🎙 **Musiqani aniqlash uchun ovozli xabar (voice) yoki audio fayl yuboring.**",
        btn_share: "📲 Ulashish",
        btn_video: "🎬 Video",
        btn_audio: "🎧 Audio (MP3)",
        btn_music: "🎵 Musiqa qidirish",
        btn_audio_version: "🎧 Audio talqini",
        btn_find_music: "🔍 Musiqasini topish"
    },
    uz_cyrl: {
        welcome: "🌟 **Ассалому алайкум! SadoMedia Bot га хуш келибсиз!**\n\n🤖 **Мен орқали сиз қуйидаги ижтимоий тармоқлардан видео юклашингиз мумкин:**\n• YouTube, Instagram, TikTok 📥\n\n• Мусиқа топишингиз 🎵\n\n👇 **Фойдаланиш учун:**\n\n1. 🎵 **Мусиқа:** Ижрочи ёки қўшиқ номи юборинг.\n2. 📹 **Медиа:** Ҳаволани (link) юборинг.",
        main_menu: "Асосий меню",
        menu_music: "🎵 Мусиқа қидириш",
        menu_video: "🎬 Видео юклаш",
        menu_shazam: "🔍 Аудио орқали мусиқа топиш",
        menu_help: "❓ Ёрдам",
        menu_back: "🏠 Бош саҳифа",
        prompt_shazam: "🎙 **Мусиқани аниқлаш учун овозли хабар (voice) ёки аудио файл юборинг.**",
        prompt_music: "🔍 **Мусиқа номини ёки ижрочини ёзинг.**\n\nМисол: *Eminem Lose Yourself*",
        prompt_video: "📥 **Видео ҳаволасини (link) юборинг:**\n(YouTube, Instagram, TikTok)",
        prompt_audio: "🔗 **Аудио ажратиб олиш учун видео ҳаволасини юборинг:**",

        searching: "🔎 Қидирилмоқда...",
        downloading: "⏳ Юкланмоқда... Бир ох кутинг.",
        uploading_video: "📤 Видео юкланмоқда...",
        uploading_audio: "📤 Аудио юкланмоқда...",
        processing: "⏳ Юкланмоқда...",

        not_found: "❌ Ҳеч нарса топилмади. Бошқа ном билан уриниб кўринг.",
        error: "❌ Хатолик юз берди.",
        invalid_link: "❌ **Нотўғри ҳавола.**\nИлтимос, тўғри видео ҳаволасини юборинг.",
        file_too_large: "⚠️ Файл ҳажми жуда катта. Telegram орқали юбориб бўлмайди.",
        restricted_content: "⚠️ **Чеклов.**\nУшбу платформа юклашни тақиқлаган ёки контент шахсий ҳисобланади. Уни бот орқали юклаб бўлмайди.",
        session_expired: "⚠️ **Сеанс муддати тугади.**\nИлтимос, ҳаволани қайтадан юборинг.",

        done: "✅ **Тайёр! Яна нима қиламиз?**",
        search_again: "🔁 Яна қидириш",

        select_quality: "📹 **Сифатни танланг:**",
        select_format: "🎧 **Форматни танланг:**",

        shazam_found: "🎵 **Топилди!**",
        shazam_not_found: "❌ Кечирасиз, бу мусиқани аниқлай олмадим.",

        // Dynamic Content
        help_text: "🤖 @SadoMedia_bot\n\n1. 🎵 **Мусиқа:** Ижрочи ёки қўшиқ номини юборинг.\n2. 🎬 **Медиа:** Ҳаволани (link) юборинг (YouTube, Instagram, TikTok).",
        label_artist: "🎤 Ижрочи",
        label_title: "🎵 Номи",
        label_album: "💿 Альбом",
        label_year: "📅 Йил",
        label_lyrics: "📜 Қўшиқ матни",
        btn_lyrics: "🎼 Қўшиқ матни",

        // Safety
        warning_adult: "🚫 **Кечирасиз, ушбу контент 18+ чекловига эга ёки нотўғри сўзларни ўз ичига олади.**\n\nБиз порнографик ва зарарли контент тарқалишига қаршимиз.",
        warning_strike: "⚠️ **Огоҳлантириш!** ({count}/3)\nИлтимос, ботдан тўғри мақсадда фойдаланинг. Акс ҳолда блокланасиз.",
        user_blocked: "🚫 **Сиз блокландингиз.**\nБотдан фойдаланиш қоидалари бузилгани сабабли чеклов қўйилди.",

        menu_share: "📣 Ботни улашиш",
        share_text: "🚀 **SadoMedia Bot** - YouTube, Instagram, TikTok дан видео юклаш va мусиқалар топиш учун энг яхши ёрдамчингиз!\n\nБотни бу ерда топишингиз мумкин: @{username}",
        menu_shazam: "🔍 Аудио орқали мусиқа топиш",
        prompt_shazam: "🎙 **Мусиқани аниқлаш учун овозли хабар (voice) ёки аудио файл юборинг.**",
        btn_share: "📲 Улашиш",
        btn_video: "🎬 Видео",
        btn_audio: "🎧 Аудио (MP3)",
        btn_music: "🎵 Мусиқа қидириш",
        btn_audio_version: "🎧 Аудио талқини",
        btn_find_music: "🔍 Мусиқасини топиш"
    },
    ru: {
        welcome: "🌟 **Привет! Добро пожаловать в SadoMedia Bot!**\n\n🤖 **Я могу скачивать видео из следующих соцсетей:**\n• YouTube, Instagram, TikTok 📥\n\n• Находить музыку 🎵\n\n👇 **Как пользоваться:**\n\n1. 🎵 **Музыка:** Отправьте имя исполнителя или название песни.\n2. 📹 **Медиа:** Отправьте ссылку (link).",
        main_menu: "Главное меню",
        menu_music: "🎵 Поиск музыки",
        menu_video: "🎬 Скачать видео",
        menu_shazam: "🔍 Найти музыку по аудио",
        menu_help: "❓ Помощь",
        menu_back: "🏠 Главная",
        prompt_shazam: "🎙 **Отправьте голосовое сообщение или аудиофайл для распознавания музыки.**",
        prompt_music: "🔍 **Введите название песни или исполнителя.**\n\nПример: *Eminem Lose Yourself*",
        prompt_video: "📥 **Отправьте ссылку на видео:**\n(YouTube, Instagram, TikTok)",
        prompt_audio: "🔗 **Отправьте ссылку на video для извлечения аудио:**",

        searching: "🔎 Поиск...",
        downloading: "⏳ Загрузка... Пожалуйста, подождите.",
        uploading_video: "📤 Отправка видео...",
        uploading_audio: "📤 Отправка аудио...",
        processing: "⏳ Обработка...",

        not_found: "❌ Ничего не найдено. Попробуйте другое название.",
        error: "❌ Произошла ошибка.",
        invalid_link: "❌ **Неверная ссылка.**\nПожалуйста, отправьте правильную ссылку.",
        file_too_large: "⚠️ Файл слишком большой для отправки через Telegram.",
        restricted_content: "⚠️ **Ограничение.**\nЭта платформа запрещает загрузку или это частный контент. Его нельзя скачать через бота.",
        session_expired: "⚠️ **Сессия истекла.**\nПожалуйста, отправьте ссылку снова.",

        done: "✅ **Готово! Что дальше?**",
        search_again: "🔁 Искать снова",

        select_quality: "📹 **Выберите качество:**",
        select_format: "🎧 **Выберите формат:**",

        shazam_found: "🎵 **Найдено!**",
        shazam_not_found: "❌ Извините, не удалось распознать эту музыку.",

        // Dynamic Content
        help_text: "🤖 @SadoMedia_bot\n\n1. 🎵 **Музыка:** Отправьте имя исполнителя или название песни.\n2. 🎬 **Медиа:** Отправьте ссылку (YouTube, Instagram, TikTok).",
        label_artist: "🎤 Исполнитель",
        label_title: "🎵 Название",
        label_album: "💿 Альбом",
        label_year: "📅 Год",
        label_lyrics: "📜 Текст песни",
        btn_lyrics: "🎼 Текст песни",

        // Safety
        warning_adult: "🚫 **Извините, этот контент имеет возрастное ограничение 18+ или содержит недопустимые слова.**\n\nМы против распространения порнографии и вредоносного контента.",
        warning_strike: "⚠️ **Предупреждение!** ({count}/3)\nПожалуйста, используйте бот по назначению. В противном случае вы будете заблокированы.",
        user_blocked: "🚫 **Вы заблокированы.**\nДоступ ограничен из-за нарушения правил использования бота.",

        menu_share: "📣 Поделиться ботом",
        share_text: "🚀 **SadoMedia Bot** - Ваш лучший помощник для скачивания видео из YouTube, Instagram, TikTok и поиска музыки!\n\nВы можете найти бота здесь: @{username}",
        menu_shazam: "🔍 Найти музыку по аудио",
        prompt_shazam: "🎙 **Отправьте голосовое сообщение или аудиофайл для распознавания музыки.**",
        btn_share: "📲 Поделиться",
        btn_video: "🎬 Видео",
        btn_audio: "🎧 Аудио (MP3)",
        btn_music: "🎵 Поиск музыки",
        btn_audio_version: "🎧 Аудио версия видео",
        btn_find_music: "🔍 Найти музыку"
    },
    en: {
        welcome: "🌟 **Hello! Welcome to SadoMedia Bot!**\n\n🤖 **I can download videos from:**\n• YouTube, Instagram, TikTok 📥\n\n• Find music 🎵\n\n👇 **How to use:**\n\n1. 🎵 **Music:** Send Artist/Song name.\n2. 📹 **Media:** Send link.",
        main_menu: "Main Menu",
        menu_music: "🎵 Search Music",
        menu_video: "🎬 Download Video",
        menu_shazam: "🔍 Find Music by Audio",
        menu_help: "❓ Help",
        menu_back: "🏠 Home",
        prompt_shazam: "🎙 **Send a voice message or audio file to identify the music.**",
        prompt_music: "🔍 **Type the song name or artist.**\n\nExample: *Eminem Lose Yourself*",
        prompt_video: "📥 **Send the video link:**\n(YouTube, Instagram, TikTok)",
        prompt_audio: "🔗 **Send the video link to extract audio:**",

        searching: "🔎 Searching...",
        downloading: "⏳ Downloading... Please wait.",
        uploading_video: "📤 Uploading video...",
        uploading_audio: "📤 Uploading audio...",
        processing: "⏳ Processing...",

        not_found: "❌ Nothing found. Try another name.",
        error: "❌ An error occurred.",
        invalid_link: "❌ **Invalid link.**\n\nPlease send a valid video link.",
        file_too_large: "⚠️ File is too large to send via Telegram.",
        restricted_content: "⚠️ **Platform Restriction.**\nThis platform restricts direct downloads or the content is private. It cannot be downloaded via the bot.",
        session_expired: "⚠️ **Session expired.**\nPlease send the link again.",

        done: "✅ **Done! What's next?**",
        search_again: "🔁 Search Again",

        select_quality: "📹 **Select Quality:**",
        select_format: "🎧 **Select Format:**",

        shazam_found: "🎵 **Found!**",
        shazam_not_found: "❌ Sorry, could not identify this music.",

        // Dynamic Content
        help_text: "🤖 @SadoMedia_bot\n\n1. 🎵 **Music:** Send Artist/Song name.\n2. 🎬 **Media:** Send link (YouTube, Instagram, TikTok).",
        label_artist: "🎤 Artist",
        label_title: "🎵 Title",
        label_album: "💿 Album",
        label_year: "📅 Year",
        label_lyrics: "📜 Lyrics",
        btn_lyrics: "🎼 Text of the music",

        // Safety
        warning_adult: "🚫 **Sorry, this content is restricted (18+) or contains inappropriate words.**\n\nWe are against the spread of pornography and harmful content.",
        warning_strike: "⚠️ **Warning!** ({count}/3)\nPlease use the bot for its intended purpose. Otherwise, you will be banned.",
        user_blocked: "🚫 **You have been blocked.**\nAccess is restricted due to violation of bot usage rules.",

        menu_share: "📣 Share Bot",
        share_text: "🚀 **SadoMedia Bot** - Your best assistant for downloading videos from YouTube, Instagram, TikTok and finding music!\n\nYou can find the bot here: @{username}",
        menu_shazam: "🔍 Find Music by Audio",
        prompt_shazam: "🎙 **Send a voice message or audio file to identify the music.**",
        btn_share: "📲 Share",
        btn_video: "🎬 Video",
        btn_audio: "🎧 Audio (MP3)",
        btn_music: "🎵 Search Music",
        btn_audio_version: "🎧 Audio version of the video",
        btn_find_music: "🔍 Find music in video"
    }
};

function getText(lang, key) {
    if (!TEXTS[lang]) return TEXTS['uz'][key] || key;
    return TEXTS[lang][key] || TEXTS['uz'][key] || key;
}

module.exports = { getText, TEXTS };

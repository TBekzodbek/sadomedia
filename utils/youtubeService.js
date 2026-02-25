const youtubedl = require('youtube-dl-exec');
const path = require('path');
const NodeCache = require('node-cache');
const fs = require('fs-extra');
const axios = require('axios');

// Initialize Cache (TTL: 1 hour for search/info, 10 mins for titles)
const cache = new NodeCache({ stdTTL: 3600 });

// Configuration constants
const isWin = process.platform === 'win32';
const rootBin = path.join(__dirname, '../yt-dlp.exe');
const packageBin = path.join(__dirname, '../node_modules/youtube-dl-exec/bin/yt-dlp.exe');

// Detection for yt-dlp binary
// On Windows: root > package > PATH
// On Linux: 'yt-dlp'
const YOUTUBE_DL_BINARY = isWin
    ? (fs.existsSync(rootBin) ? rootBin : (fs.existsSync(packageBin) ? packageBin : 'yt-dlp'))
    : 'yt-dlp';

const FFMPEG_LOCATION = path.join(__dirname, '../bin');
const COOKIES_PATH = path.join(__dirname, '../cookies.txt');

console.log(`📡 [youtubeService] Using binary: ${YOUTUBE_DL_BINARY}`);

// Helper for youtubedl options to avoid repetition
function getYtDlpOptions() {
    const env = { ...process.env };
    // On Windows, the environment variable is 'Path' (case-sensitive in Node.js env object)
    const pathKey = isWin ? 'Path' : 'PATH';
    const separator = isWin ? ';' : ':';

    if (env[pathKey]) {
        env[pathKey] = `${FFMPEG_LOCATION}${separator}${env[pathKey]}`;
    } else {
        env[pathKey] = FFMPEG_LOCATION;
    }

    const opts = {
        env,
        timeout: 45000, // 45 seconds timeout to prevent hanging
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
    };

    if (YOUTUBE_DL_BINARY && YOUTUBE_DL_BINARY !== 'yt-dlp') {
        opts.youtubeDlBinary = YOUTUBE_DL_BINARY;
    }

    return opts;
}

// Helper to clean URL from playlist parameters and extract URL from text
function cleanUrl(url) {
    if (!url || typeof url !== 'string') return url;

    // 1. Trim leading/trailing whitespace including newlines
    let input = url.trim();

    // 2. Extract the first URL-like string from the text
    // Handles cases like: "Check this video! https://youtube.com/..."
    const urlMatch = input.match(/https?:\/\/[^\s]+/i);
    const targetUrl = urlMatch ? urlMatch[0] : input;

    try {
        const u = new URL(targetUrl);
        if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) {
            // Remove 'list' param but keep other important ones like 'v'
            if (u.searchParams.has('list')) {
                u.searchParams.delete('list');
                // Also remove index if it exists
                u.searchParams.delete('index');
            }
            return u.toString();
        }
        return u.toString();
    } catch (e) {
        // Fallback to the extracted target or original if URL parsing fails
        return targetUrl;
    }
}

async function searchVideo(query, limit = 5) {
    const cacheKey = `search:${query}:${limit}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    try {
        const flags = {
            dumpSingleJson: true,
            noWarnings: true,
            preferFreeFormats: true,
            flatPlaylist: true,
            forceIpv4: true,
            cookies: fs.existsSync(COOKIES_PATH) ? COOKIES_PATH : undefined,
            ffmpegLocation: FFMPEG_LOCATION
        };

        const output = await youtubedl(`ytsearch${limit}:${query}`, flags, getYtDlpOptions());
        cache.set(cacheKey, output);
        return output;
    } catch (e) {
        throw new Error(`Search failed: ${e.message}`);
    }
}

async function searchMusic(query, limit = 50) {
    const cacheKey = `searchMusic:${query}:${limit}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    try {
        const flags = {
            dumpSingleJson: true,
            noWarnings: true,
            flatPlaylist: true,
            forceIpv4: true,
            cookies: fs.existsSync(COOKIES_PATH) ? COOKIES_PATH : undefined,
            ffmpegLocation: FFMPEG_LOCATION
        };

        const output = await youtubedl(`ytsearch${limit}:${query}`, flags, getYtDlpOptions());
        cache.set(cacheKey, output);
        return output;
    } catch (e) {
        throw new Error(`Music search failed: ${e.message}`);
    }
}

async function getVideoInfo(url) {
    const originalUrl = url;
    url = cleanUrl(url);
    console.log(`🔎 [youtubeService] getVideoInfo original: [${originalUrl.substring(0, 50)}${originalUrl.length > 50 ? '...' : ''}] -> cleaned: [${url}]`);
    const cacheKey = `info:${url}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
    const clients = isYouTube ? ['ios', 'tv', 'mweb', 'android', 'web'] : ['default'];

    for (const client of clients) {
        try {
            console.log(`🔎 [youtubeService] Fetching metadata via client: ${client}...`);
            const flags = {
                dumpSingleJson: true,
                noWarnings: true,
                noPlaylist: true,
                forceIpv4: true,
                noCheckCertificates: true,
                geoBypass: true,
                cookies: fs.existsSync(COOKIES_PATH) ? COOKIES_PATH : undefined,
                ffmpegLocation: FFMPEG_LOCATION,
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
            };

            if (isYouTube) {
                if (client !== 'default') {
                    flags.extractorArgs = `youtube:player_client=${client}`;
                    // Special bypass for TV client which is often less restricted
                    if (client === 'tv') flags.extractorArgs += ',html5';
                }
                // Skip manifest checks for faster/steadier info fetching
                flags.youtubeSkipDashManifest = true;
                flags.youtubeSkipHlsManifest = true;
            } else if (url.includes('instagram.com')) {
                flags.addHeader = [
                    'Accept-Language: en-US,en;q=0.9',
                    'Sec-Fetch-Mode: navigate',
                    'User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
                ];
                flags.referer = 'https://www.instagram.com/';
            } else {
                flags.referer = url;
            }

            const info = await youtubedl(url, flags, getYtDlpOptions());

            if (info) {
                if (!info.thumbnail && info.thumbnails && info.thumbnails.length > 0) {
                    // Telegram doesn't like .webp via URL in sendPhoto, prefer jpg/png
                    const sorted = info.thumbnails.sort((a, b) => (b.width || 0) - (a.width || 0));
                    const preferred = sorted.find(t => t.url && !t.url.includes('.webp')) || sorted[0];
                    info.thumbnail = preferred.url;
                }
                cache.set(cacheKey, info, 300);
                return info;
            }
        } catch (e) {
            console.warn(`⚠️ [youtubeService] Metadata fetch failed for ${client}: ${e.message}`);

            // Instagram Fallback: try without cookies if it's a login/rate-limit issue
            if (url.includes('instagram.com') && (e.message.includes('login') || e.message.includes('rate-limit'))) {
                try {
                    console.log(`🔎 [youtubeService] Retrying Instagram without cookies...`);
                    const instaFlags = {
                        dumpSingleJson: true,
                        noWarnings: true,
                        noPlaylist: true,
                        forceIpv4: true,
                        geoBypass: true,
                        addHeader: ['Accept-Language: en-US,en;q=0.9'],
                        referer: 'https://www.instagram.com/',
                        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
                    };
                    const info = await youtubedl(url, instaFlags, getYtDlpOptions());
                    if (info) {
                        cache.set(cacheKey, info, 300);
                        return info;
                    }
                } catch (innerE) {
                    console.warn(`⚠️ [youtubeService] Instagram no-cookies retry failed: ${innerE.message}`);
                }
            }
        }
    }

    // FINAL FALLBACK
    try {
        console.log(`🔎 [youtubeService] Final fallback metadata fetch...`);
        const flags = {
            dumpSingleJson: true,
            noWarnings: true,
            forceIpv4: true,
            noCheckCertificates: true,
            geoBypass: true,
            cookies: fs.existsSync(COOKIES_PATH) ? COOKIES_PATH : undefined,
            ffmpegLocation: FFMPEG_LOCATION,
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        };
        if (url.includes('instagram.com')) flags.referer = 'https://www.instagram.com/';

        const info = await youtubedl(url, flags, getYtDlpOptions());
        if (info) {
            cache.set(cacheKey, info, 300);
            return info;
        }
    } catch (e) {
        console.warn(`⚠️ [youtubeService] Final metadata fallback failed: ${e.message}`);
    }

    throw new Error('Could not fetch media metadata. Please check the link or try again later.');
}

async function getVideoTitle(url) {
    try {
        const info = await getVideoInfo(url);
        return info ? info.title : 'Video';
    } catch (e) {
        return 'Video';
    }
}

/**
 * Helper to handle the successful download output and find the actual file.
 */
async function handleSuccessfulDownload(result, outputPath, type) {
    const stdout = (typeof result === 'string') ? result : (result.stdout || '');
    const cleanStdout = stdout.replace(/\x1B\[\d+;?\d*m/g, '');
    const destMatches = [...cleanStdout.matchAll(/(?:Destination:|Merging formats into ")(.+?)(?:"|$)/g)];

    if (destMatches.length > 0) {
        let foundPath = destMatches[destMatches.length - 1][1].trim().replace(/^"/, '').replace(/"$/, '');
        if (!path.isAbsolute(foundPath)) foundPath = path.resolve(process.cwd(), foundPath);
        if (fs.existsSync(foundPath)) return foundPath;
    }

    // Manual sweep if stdout parsing fails
    const base = outputPath.replace('.%(ext)s', '');
    const extensions = type === 'audio'
        ? ['.mp3', '.m4a', '.webm', '.aac', '.ogg', '.opus', '.wav']
        : ['.mp4', '.mkv', '.webm', '.ts', '.mov', '.avi'];

    for (const ext of extensions) {
        const fb = base + ext;
        if (fs.existsSync(fb)) return fb;
    }
    return null;
}

async function downloadMedia(url, type, options = {}) {
    const originalUrl = url;
    url = cleanUrl(url);
    console.log(`🚀 [youtubeService] downloadMedia original: [${originalUrl.substring(0, 50)}${originalUrl.length > 50 ? '...' : ''}] -> cleaned: [${url}]`);

    const { outputPath, height } = options;
    const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
    const isNumericHeight = /^\d+$/.test(height);

    let baseFlags = {
        output: outputPath,
        noPlaylist: true,
        noWarnings: true,
        noColors: true,
        noProgress: true,
        concurrentFragments: 16,
        httpChunkSize: '10M',
        noMtime: true,
        noCheckCertificates: true,
        geoBypass: true,
        cookies: fs.existsSync(COOKIES_PATH) ? COOKIES_PATH : undefined,
        ffmpegLocation: FFMPEG_LOCATION,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
    };

    if (url.includes('instagram.com')) {
        baseFlags.referer = 'https://www.instagram.com/';
    } else if (!isYouTube) {
        baseFlags.referer = url;
    }

    const clients = isYouTube ? ['ios', 'tv', 'mweb', 'android', 'web'] : ['default'];
    let lastError = null;

    for (const client of clients) {
        try {
            console.log(`📡 [youtubeService] Attempting download with client: ${client}...`);

            const currentFlags = { ...baseFlags };
            if (isYouTube && client !== 'default') {
                currentFlags.extractorArgs = `youtube:player_client=${client}`;
                if (client === 'tv') currentFlags.extractorArgs += ',html5';

                // Keep flags consistent with info fetching to maintain bypass state
                currentFlags.youtubeSkipDashManifest = true;
                currentFlags.youtubeSkipHlsManifest = true;
            }

            // ATTEMPT 1: Preferred Format
            if (type === 'audio') {
                Object.assign(currentFlags, {
                    extractAudio: true,
                    audioFormat: 'mp3',
                    audioQuality: '0',
                    format: 'bestaudio/best'
                });
            } else {
                currentFlags.format = isYouTube
                    ? (isNumericHeight ? `bestvideo[height<=${height}][ext=mp4]+bestaudio[ext=m4a]/best[height<=${height}]/best` : 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720]/best')
                    : 'best[ext=mp4]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best';
                currentFlags.mergeOutputFormat = 'mp4';
            }

            const downloadOpts = getYtDlpOptions();
            downloadOpts.timeout = 300000;

            try {
                console.log(`📡 [youtubeService] TRY 1 (${client}) - Format: ${currentFlags.format}`);
                const result = await youtubedl(url, currentFlags, downloadOpts);
                const path = await handleSuccessfulDownload(result, outputPath, type);
                if (path) return path;
            } catch (err) {
                console.warn(`⚠️ [youtubeService] TRY 1 failed for ${client}: ${err.message}`);

                // ATTEMPT 2: Radical Fallback (best format, no questions asked)
                console.log(`📡 [youtubeService] TRY 2 (${client}) - Format: best`);
                const fallbackFlags = { ...currentFlags, format: type === 'audio' ? 'bestaudio/best' : 'best' };
                // If audio extraction was failing, try downloading without it first
                if (type === 'audio' && (err.message.includes('format') || err.message.includes('extract'))) {
                    delete fallbackFlags.extractAudio;
                    delete fallbackFlags.audioFormat;
                }

                const result2 = await youtubedl(url, fallbackFlags, downloadOpts);
                const path2 = await handleSuccessfulDownload(result2, outputPath, type);
                if (path2) return path2;
            }
        } catch (e) {
            console.warn(`⚠️ [youtubeService] Client ${client} failed: ${e.message}`);
            lastError = e;
        }
    }

    // FINAL ULTIMATE FALLBACK: No cookies, simplest format, default client
    try {
        console.log(`📡 [youtubeService] FINAL ATTEMPT - No cookies, format: best`);
        const finalFlags = { ...baseFlags, format: 'best' };
        delete finalFlags.cookies;
        const result3 = await youtubedl(url, finalFlags, getYtDlpOptions());
        const finalPath = await handleSuccessfulDownload(result3, outputPath, type);
        if (finalPath) return finalPath;
    } catch (e) {
        lastError = e;
    }

    throw new Error(lastError ? lastError.message : 'Download failed completely.');
}

async function downloadSnippet(url, duration = 15, startTime = 10) {
    url = cleanUrl(url);
    const tempDir = path.join(__dirname, '../downloads');
    await fs.ensureDir(tempDir);
    const snippetPath = path.join(tempDir, `snippet_${Date.now()}.mp3`);

    try {
        const flags = {
            extractAudio: true,
            audioFormat: 'mp3',
            noPlaylist: true,
            output: snippetPath,
            forceIpv4: true,
            noCheckCertificates: true,
            geoBypass: true,
            cookies: fs.existsSync(COOKIES_PATH) ? COOKIES_PATH : undefined,
            ffmpegLocation: FFMPEG_LOCATION,
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
        };

        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            // Speed optimization for YouTube
            flags.downloadSections = `*${startTime}-${startTime + duration}`;
        } else {
            // Fallback for other platforms
            flags.postprocessorArgs = `ffmpeg:-ss ${startTime} -t ${duration}`;
            flags.referer = url;
        }

        await youtubedl(url, flags, getYtDlpOptions());

        if (await fs.pathExists(snippetPath)) {
            const buffer = await fs.readFile(snippetPath);
            await fs.remove(snippetPath);
            return buffer;
        }
        return null;
    } catch (e) {
        console.error('downloadSnippet Error:', e.message);
        if (await fs.pathExists(snippetPath)) await fs.remove(snippetPath);
        return null;
    }
}

module.exports = {
    searchVideo,
    searchMusic,
    getVideoInfo,
    getVideoTitle,
    downloadMedia,
    downloadSnippet,
    cleanUrl,
};

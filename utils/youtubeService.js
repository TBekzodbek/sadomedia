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
    const clients = isYouTube ? ['ios', 'android', 'web'] : ['default'];

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
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
            };

            if (isYouTube) {
                if (client !== 'default') {
                    flags.extractorArgs = `youtube:player_client=${client}`;
                }
            } else {
                // Add referer for IG/TikTok/etc
                flags.referer = url;
            }

            const info = await youtubedl(url, flags, getYtDlpOptions());

            if (info && !info.thumbnail && info.thumbnails && info.thumbnails.length > 0) {
                info.thumbnail = info.thumbnails.sort((a, b) => (b.width || 0) - (a.width || 0))[0].url;
            }

            cache.set(cacheKey, info, 300);
            return info;
        } catch (e) {
            console.warn(`⚠️ [youtubeService] Metadata fetch failed for ${client}: ${e.message}`);
        }
    }

    // FINAL FALLBACK for metadata: try without any specific client/extractor args
    try {
        console.log(`🔎 [youtubeService] Final fallback metadata fetch...`);
        const flags = {
            dumpSingleJson: true,
            noWarnings: true,
            forceIpv4: true,
            noCheckCertificates: true,
            geoBypass: true,
            cookies: fs.existsSync(COOKIES_PATH) ? COOKIES_PATH : undefined,
            ffmpegLocation: FFMPEG_LOCATION
        };
        const info = await youtubedl(url, flags, getYtDlpOptions());
        if (info) {
            if (!info.thumbnail && info.thumbnails && info.thumbnails.length > 0) {
                info.thumbnail = info.thumbnails.sort((a, b) => (b.width || 0) - (a.width || 0))[0].url;
            }
            cache.set(cacheKey, info, 300);
            return info;
        }
    } catch (e) {
        console.warn(`⚠️ [youtubeService] Final metadata fallback failed: ${e.message}`);
    }



    throw new Error('Could not fetch media metadata. Please check the link.');
}

async function getVideoTitle(url) {
    try {
        const info = await getVideoInfo(url);
        return info ? info.title : 'Video';
    } catch (e) {
        return 'Video';
    }
}

async function downloadMedia(url, type, options = {}) {
    const originalUrl = url;
    url = cleanUrl(url);
    console.log(`🚀 [youtubeService] downloadMedia original: [${originalUrl.substring(0, 50)}${originalUrl.length > 50 ? '...' : ''}] -> cleaned: [${url}]`);
    const { outputPath, height } = options;

    let flags = {
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

    const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
    if (!isYouTube) {
        flags.referer = url;
    }

    if (type === 'audio') {
        Object.assign(flags, {
            extractAudio: true,
            audioFormat: 'mp3',
            audioQuality: '0', // Best quality
            ffmpegLocation: FFMPEG_LOCATION
        });
        console.log(`🎵 [youtubeService] Audio download flags:`, flags);
    } else if (type === 'video') {
        const isNumericHeight = /^\d+$/.test(height);
        let formatSelect;

        if (isYouTube) {
            // Priority: MP4 up to target height > Best video+audio up to target height > Any best available
            // Using bv/ba for shorter strings, ensuring we always have a final 'best' fallback
            formatSelect = isNumericHeight
                ? `bv[height<=${height}][ext=mp4]+ba[ext=m4a]/b[height<=${height}][ext=mp4]/bv[height<=${height}]+ba/b[height<=${height}]/best`
                : 'bv[height<=?720][ext=mp4]+ba[ext=m4a]/b[height<=?720][ext=mp4]/bv[height<=?720]+ba/b[height<=?720]/best';
        } else {
            // TikTok/Instagram/Pinterest: Often single-file formats work best
            formatSelect = 'best[ext=mp4]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best';
        }

        Object.assign(flags, {
            format: formatSelect,
            mergeOutputFormat: 'mp4',
        });
    }

    console.log(`🚀 [youtubeService] Final ${type} download flags:`, flags);

    const clients = isYouTube ? ['ios', 'android', 'web'] : ['default'];
    let lastError = null;

    for (const client of clients) {
        try {
            console.log(`📡 [youtubeService] Attempting download with client: ${client}...`);
            const currentFlags = { ...flags };
            if (isYouTube && client !== 'default') {
                currentFlags.extractorArgs = `youtube:player_client=${client}`;
            }

            const downloadOpts = getYtDlpOptions();
            downloadOpts.timeout = 300000; // 5 minutes for download

            try {
                const result = await youtubedl(url, currentFlags, downloadOpts);

                // Extract path from stdout if possible
                const stdout = (typeof result === 'string') ? result : (result.stdout || '');
                const cleanStdout = stdout.replace(/\x1B\[\d+;?\d*m/g, '');
                const destMatches = [...cleanStdout.matchAll(/(?:Destination:|Merging formats into ")(.+?)(?:"|$)/g)];

                if (destMatches.length > 0) {
                    let foundPath = destMatches[destMatches.length - 1][1].trim().replace(/^"/, '').replace(/"$/, '');
                    if (!path.isAbsolute(foundPath)) foundPath = path.resolve(process.cwd(), foundPath);
                    if (fs.existsSync(foundPath)) return foundPath;
                }
            } catch (innerError) {
                // If it's an audio extraction error, try a simpler approach without extractAudio if it fails
                if (type === 'audio' && innerError.message.includes('ffprobe')) {
                    console.log('⚠️ [youtubeService] ffprobe failed during extraction, trying simple bestaudio download...');
                    const simpleFlags = { ...currentFlags };
                    delete simpleFlags.extractAudio;
                    delete simpleFlags.audioFormat;
                    delete simpleFlags.audioQuality;
                    simpleFlags.format = 'bestaudio/best';

                    const result = await youtubedl(url, simpleFlags, downloadOpts);
                    const stdout = (typeof result === 'string') ? result : (result.stdout || '');
                    const cleanStdout = stdout.replace(/\x1B\[\d+;?\d*m/g, '');
                    const destMatches = [...cleanStdout.matchAll(/(?:Destination:|Merging formats into ")(.+?)(?:"|$)/g)];
                    if (destMatches.length > 0) {
                        let foundPath = destMatches[destMatches.length - 1][1].trim().replace(/^"/, '').replace(/"$/, '');
                        if (!path.isAbsolute(foundPath)) foundPath = path.resolve(process.cwd(), foundPath);
                        if (fs.existsSync(foundPath)) return foundPath;
                    }
                } else {
                    throw innerError;
                }
            }

            const base = outputPath.replace('.%(ext)s', '');
            const extensions = type === 'audio' ? ['.mp3', '.m4a', '.webm', '.aac'] : ['.mp4', '.mkv', '.webm'];
            for (const ext of extensions) {
                const fallbackPath = base + ext;
                if (fs.existsSync(fallbackPath)) return fallbackPath;
            }
        } catch (e) {
            console.warn(`⚠️ [youtubeService] Client ${client} download failed: ${e.message}`);
            lastError = e;
        }
    }

    // FINAL FALLBACK: Simplest download
    try {
        const fallbackOpts = getYtDlpOptions();
        fallbackOpts.timeout = 300000;
        const finalFlags = { ...flags, format: 'best' };
        if (type === 'audio') {
            delete finalFlags.extractAudio; // Try without extraction in final fallback
            finalFlags.format = 'bestaudio/best';
        }

        await youtubedl(url, finalFlags, fallbackOpts);

        const base = outputPath.replace('.%(ext)s', '');
        const exts = ['.mp4', '.mp3', '.m4a', '.webm', '.mkv', '.aac'];
        for (const ext of exts) {
            const fb = base + ext;
            if (fs.existsSync(fb)) return fb;
        }
    } catch (e) {
        lastError = e;
    }

    throw new Error(lastError ? lastError.message : 'Download failed completely.');
}

async function downloadSnippet(url, duration = 15) {
    url = cleanUrl(url);
    const tempDir = path.join(__dirname, '../downloads');
    await fs.ensureDir(tempDir);
    const snippetPath = path.join(tempDir, `snippet_${Date.now()}.mp3`);

    try {
        const flags = {
            extractAudio: true,
            audioFormat: 'mp3',
            noPlaylist: true,
            postprocessorArgs: `ffmpeg:-t ${duration}`,
            output: snippetPath,
            forceIpv4: true,
            noCheckCertificates: true,
            geoBypass: true,
            cookies: fs.existsSync(COOKIES_PATH) ? COOKIES_PATH : undefined,
            ffmpegLocation: FFMPEG_LOCATION,
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
        };

        if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
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

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

// Helper to clean URL from playlist parameters
function cleanUrl(url) {
    if (!url) return url;
    try {
        const u = new URL(url);
        if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) {
            // Remove 'list' param but keep other important ones like 'v'
            if (u.searchParams.has('list')) {
                u.searchParams.delete('list');
                // Also remove index if it exists
                u.searchParams.delete('index');
            }
            return u.toString();
        }
    } catch (e) {
        // Fallback to original if URL parsing fails
    }
    return url;
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

async function getPinterestInfo(url) {
    try {
        console.log(`🔎 [youtubeService] Fetching Pinterest HTML fallback for: ${url}`);
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
            },
            timeout: 10000
        });

        const html = response.data;
        let imageUrl = null;

        // 1. Try a more flexible og:image meta tag match (handles any attribute order)
        const ogMatch = html.match(/<meta[^>]+(?:property|name)\s*=\s*["']og:image["'][^>]+content\s*=\s*["']([^"']+)["']/i) ||
            html.match(/<meta[^>]+content\s*=\s*["']([^"']+)["'][^>]+(?:property|name)\s*=\s*["']og:image["']/i);

        if (ogMatch) {
            imageUrl = ogMatch[1];
            console.log(`✅ [youtubeService] Found Pinterest image via og:image: ${imageUrl}`);
        } else {
            // 2. Fallback to broad search but filter out logos/icons
            const matches = html.match(/https:\/\/i\.pinimg\.com\/(?:originals|736x)\/[a-zA-Z0-9\/\._-]+\.(?:jpg|png|webp)/g);
            if (matches) {
                const unique = [...new Set(matches)];
                // Filter out common UI element keywords
                const filtered = unique.filter(u => !u.toLowerCase().match(/logo|icon|avatar|header|footer|button/));
                if (filtered.length > 0) {
                    imageUrl = filtered[0];
                    console.log(`⚠️ [youtubeService] Found Pinterest image via broad fallback: ${imageUrl}`);
                }
            }
        }

        if (imageUrl) {
            // Optional: try to upgrade 736x to originals if applicable
            if (imageUrl.includes('/736x/')) {
                const originalUrl = imageUrl.replace('/736x/', '/originals/');
                // We'll use the original but keep 736x as fallback if we wanted to be super safe, 
                // but usually originals exists if 736x does.
                imageUrl = originalUrl;
            }

            return {
                title: 'Pinterest Image',
                url: imageUrl,
                thumbnail: imageUrl,
                ext: imageUrl.split('.').pop().split('?')[0], // clean extension
                video_ext: 'none',
                vcodec: 'none',
                acodec: 'none',
                extractor: 'pinterest:fallback'
            };
        }

        return null;
    } catch (e) {
        console.error(`❌ [youtubeService] Pinterest fallback failed: ${e.message}`);
        return null;
    }
}


async function getVideoInfo(url) {
    url = cleanUrl(url);
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
                ffmpegLocation: FFMPEG_LOCATION
            };

            if (isYouTube && client !== 'default') {
                flags.extractorArgs = `youtube:player_client=${client}`;
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

    // PINTEREST FALLBACK
    if (url.includes('pinterest.com')) {
        const pinInfo = await getPinterestInfo(url);
        if (pinInfo) {
            cache.set(cacheKey, pinInfo, 300);
            return pinInfo;
        }
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
    url = cleanUrl(url);
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
        ffmpegLocation: FFMPEG_LOCATION
    };

    const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');

    if (type === 'audio') {
        Object.assign(flags, {
            extractAudio: true,
            audioFormat: 'mp3',
            audioQuality: '0', // Best quality
            preferFfmpeg: true,
            ffmpegLocation: FFMPEG_LOCATION
        });
        console.log(`🎵 [youtubeService] Audio download flags:`, flags);
    } else if (type === 'video') {
        const isNumericHeight = /^\d+$/.test(height);
        let formatSelect;

        if (isYouTube) {
            // Priority: MP4 720p > Any MP4 up to 720p > Best Video+Audio > Best Overall
            // Using ? to make constraints optional for better fallback
            formatSelect = isNumericHeight
                ? `best[height<=${height}][ext=mp4]/bestvideo[height<=${height}][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=${height}]+bestaudio/best`
                : 'best[height<=?720][ext=mp4]/best[ext=mp4]/bestvideo[height<=?720]+bestaudio/best';
        } else {
            // TikTok/Instagram/Pinterest: Priority to 'best' single format (often no watermark)
            formatSelect = 'best[ext=mp4]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best';
        }

        Object.assign(flags, {
            format: formatSelect,
            mergeOutputFormat: 'mp4',
        });
    } else if (type === 'photo') {
        const info = cache.get(`info:${url}`);
        if (info && info.extractor && info.extractor.startsWith('pinterest:fallback')) {
            try {
                console.log(`📡 [youtubeService] Downloading image directly: ${info.url}`);
                const response = await axios({
                    url: info.url,
                    method: 'GET',
                    responseType: 'stream'
                });

                const ext = info.ext || 'jpg';
                const actualPath = outputPath.replace('.%(ext)s', `.${ext}`);
                const writer = fs.createWriteStream(actualPath);

                response.data.pipe(writer);

                return new Promise((resolve, reject) => {
                    writer.on('finish', () => resolve(actualPath));
                    writer.on('error', reject);
                });
            } catch (e) {
                console.warn(`⚠️ [youtubeService] Direct Pinterest download failed: ${e.message}`);
                // Fallthrough to yt-dlp if direct fails
            }
        }

        // Platform Fallback: yt-dlp usually fails here without cookies
        if (url.includes('pinterest.com')) {
            const info = cache.get(`info:${url}`);
            if (info && info.extractor && info.extractor.endsWith(':fallback')) {
                try {
                    console.log(`📡 [youtubeService] Downloading ${info.extractor} image directly: ${info.url}`);
                    const response = await axios({
                        url: info.url,
                        method: 'GET',
                        responseType: 'stream'
                    });

                    const ext = info.ext || 'jpg';
                    const actualPath = outputPath.replace('.%(ext)s', `.${ext}`);
                    const writer = fs.createWriteStream(actualPath);

                    response.data.pipe(writer);

                    return new Promise((resolve, reject) => {
                        writer.on('finish', () => resolve(actualPath));
                        writer.on('error', reject);
                    });
                } catch (e) {
                    console.warn(`⚠️ [youtubeService] Direct fallback download failed: ${e.message}`);
                    // Fallthrough to yt-dlp if direct fails
                }
            }
        }

        Object.assign(flags, {
            format: 'best',
            // Some platforms return raw images
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

            const base = outputPath.replace('.%(ext)s', '');
            const extensions = type === 'audio' ? ['.mp3', '.m4a'] : (type === 'photo' ? ['.jpg', '.png', '.jpeg', '.webp'] : ['.mp4', '.mkv', '.webm']);
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

        await youtubedl(url, { ...flags, format: 'best' }, fallbackOpts);

        const base = outputPath.replace('.%(ext)s', '');
        const exts = ['.mp4', '.mp3', '.m4a', '.webm', '.mkv'];
        for (const ext of exts) {
            const fb = base + ext;
            if (fs.existsSync(fb)) return fb;
        }
    } catch (e) {
        lastError = e;
    }

    throw new Error(lastError ? lastError.message : 'Download failed completely.');
}

module.exports = {
    searchVideo,
    searchMusic,
    getVideoInfo,
    getVideoTitle,
    downloadMedia,
};

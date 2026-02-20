const shazamApi = require('shazam-api');
const ffmpeg = require('ffmpeg-static');
const { spawn } = require('child_process');
const stream = require('stream');

/**
 * Recognize audio buffer using Shazam API.
 * @param {Buffer} buffer - The audio buffer (OGG, MP3, etc).
 * @returns {Promise<object|null>} - Optimized track object or null.
 */
async function recognizeAudio(buffer) {
    let pcmBuffer = null;
    try {
        console.log('🎼 Starting audio conversion for Shazam...');

        // 1. Convert any input audio to Raw PCM s16le, 16000Hz, Mono
        // This is strictly required by the shazam-api package.
        pcmBuffer = await new Promise((resolve, reject) => {
            const chunks = [];
            const ffmpegProcess = spawn(ffmpeg, [
                '-i', 'pipe:0',      // Input from stdin
                '-f', 's16le',       // Output format raw PCM 16-bit LE
                '-acodec', 'pcm_s16le',
                '-ar', '16000',      // sample rate 16kHz
                '-ac', '1',          // 1 channel (mono)
                '-t', '15',          // only take first 15 seconds
                'pipe:1'             // Output to stdout
            ]);

            ffmpegProcess.stdout.on('data', (chunk) => chunks.push(chunk));
            ffmpegProcess.stderr.on('data', (data) => {
                // Ignore ffmpeg banners/info, but log errors
                if (data.toString().includes('Error')) console.error(`FFMPEG: ${data}`);
            });

            ffmpegProcess.on('close', (code) => {
                if (code === 0) resolve(Buffer.concat(chunks));
                else reject(new Error(`FFmpeg exited with code ${code}`));
            });

            ffmpegProcess.stdin.write(buffer);
            ffmpegProcess.stdin.end();
        });

        if (!pcmBuffer || pcmBuffer.length === 0) {
            throw new Error('Failed to generate PCM buffer');
        }

        const shazam = new shazamApi.Shazam();

        // 2. Increase timeout to 30 seconds for upload and recognition
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Shazam Timeout')), 30000)
        );

        console.log('🚀 Sending PCM to Shazam API...');
        const recogPromise = shazam.recognizeSong(pcmBuffer);
        const recog = await Promise.race([recogPromise, timeoutPromise]);

        if (recog && (recog.title || recog.track)) {
            const trackData = recog.track || recog;

            // Extract lyrics if available
            if (trackData.sections) {
                const lyricsSection = trackData.sections.find(s => s.type === 'LYRICS');
                if (lyricsSection && lyricsSection.text) {
                    trackData.lyrics = lyricsSection.text.join('\n');
                }
            }

            return trackData;
        }
        return null;
    } catch (e) {
        console.error('Shazam Service Error:', e.message);
        return null;
    }
}

module.exports = {
    recognizeAudio
};

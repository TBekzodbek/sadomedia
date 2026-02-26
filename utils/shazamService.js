const shazamApi = require('shazam-api');
const ffmpeg = require('ffmpeg-static');
const { spawn } = require('child_process');
const fs = require('fs-extra');
const path = require('path');

/**
 * Recognize audio buffer using Shazam API.
 * @param {Buffer} buffer - The audio buffer (OGG, MP3, etc).
 * @returns {Promise<object|null>} - Optimized track object or null.
 */
async function recognizeAudio(buffer) {
    let pcmBuffer = null;
    try {
        const binFfmpeg = path.join(__dirname, '../bin/ffmpeg.exe');
        const ffmpegExecutable = (process.platform === 'win32' && fs.existsSync(binFfmpeg)) ? binFfmpeg : ffmpeg;

        console.log(`🎼 Converting audio for Shazam using: ${ffmpegExecutable === binFfmpeg ? 'bin/ffmpeg.exe' : 'ffmpeg-static'}`);

        // 1. Convert any input audio to Raw PCM s16le, 16000Hz, Mono
        pcmBuffer = await new Promise((resolve, reject) => {
            const chunks = [];
            const ffmpegProcess = spawn(ffmpegExecutable, [
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
                // Log only real errors
                if (data.toString().toLowerCase().includes('error')) console.warn(`FFMPEG: ${data}`);
            });

            ffmpegProcess.on('close', (code) => {
                if (code === 0) resolve(Buffer.concat(chunks));
                else reject(new Error(`FFmpeg exited with code ${code}`));
            });

            ffmpegProcess.stdin.on('error', (err) => {
                console.warn('FFMPEG Stdin error (ignoring):', err.message);
            });

            ffmpegProcess.stdin.write(buffer);
            ffmpegProcess.stdin.end();
        });

        if (!pcmBuffer || pcmBuffer.length === 0) {
            throw new Error('Failed to generate PCM buffer');
        }

        // 2. Convert Buffer to Int16Array (s16le) for shazam-api
        const samples = new Int16Array(pcmBuffer.buffer, pcmBuffer.byteOffset, pcmBuffer.length / 2);

        const shazam = new shazamApi.Shazam();

        // 3. Timeout for shazam recognition
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Shazam Timeout')), 35000)
        );

        console.log(`🚀 Sending ${samples.length} samples to Shazam API...`);
        const recogPromise = shazam.fullRecognizeSong(samples);
        const recog = await Promise.race([recogPromise, timeoutPromise]);

        if (recog && recog.track) {
            console.log('✅ Shazam response received:', JSON.stringify(recog.track).substring(0, 100));
            const track = recog.track;

            // Extract album and year from sections metadata
            let album = null;
            let year = null;
            const songSection = track.sections?.find(s => s.type === 'SONG');
            if (songSection && songSection.metadata) {
                album = songSection.metadata.find(m => m.title === 'Album')?.text;
                year = songSection.metadata.find(m => m.title === 'Released')?.text;
            }

            // Extract lyrics
            let lyrics = null;
            const lyricsSection = track.sections?.find(s => s.type === 'LYRICS');
            if (lyricsSection && lyricsSection.text) {
                lyrics = lyricsSection.text.join('\n');
            }

            return {
                title: track.title,
                artist: track.subtitle,
                subtitle: track.subtitle,
                album: album,
                year: year,
                lyrics: lyrics,
                url: track.url,
                track: track // keep the whole thing just in case
            };
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


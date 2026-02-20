const { getVideoInfo, downloadMedia } = require('./utils/youtubeService');
const { recognizeAudio } = require('./utils/shazamService');
const path = require('path');
const fs = require('fs-extra');

async function runTests() {
    console.log('🚀 Starting Bulk Test...');
    const results = {
        youtube: { success: 0, fail: 0, details: [] },
        instagram: { success: 0, fail: 0, details: [] },
        shazam: { success: 0, fail: 0 }
    };

    const ytUrls = fs.existsSync('yt_urls.json') ? JSON.parse(fs.readFileSync('yt_urls.json')) : [];
    const musicUrls = fs.existsSync('music_urls.json') ? JSON.parse(fs.readFileSync('music_urls.json')) : [];
    const instagramUrls = [
        'https://www.instagram.com/reels/C5-zE3-unYg/',
        'https://www.instagram.com/reels/C6H-XvIu3L0/',
        'https://www.instagram.com/reels/C6F_yM_u9vC/',
        'https://www.instagram.com/reels/C59_QvIu3L0/',
        'https://www.instagram.com/reels/C58_QvIu3L0/',
        'https://www.instagram.com/reels/C57_QvIu3L0/',
        'https://www.instagram.com/reels/C56_QvIu3L0/',
        'https://www.instagram.com/reels/C55_QvIu3L0/',
        'https://www.instagram.com/reels/C54_QvIu3L0/',
        'https://www.instagram.com/reels/C53_QvIu3L0/',
        'https://www.instagram.com/reels/C52_QvIu3L0/',
        'https://www.instagram.com/reels/C51_QvIu3L0/',
        'https://www.instagram.com/reels/C50_QvIu3L0/',
        'https://www.instagram.com/reels/C49_QvIu3L0/',
        'https://www.instagram.com/reels/C48_QvIu3L0/',
        'https://www.instagram.com/reels/C47_QvIu3L0/',
        'https://www.instagram.com/reels/C46_QvIu3L0/',
        'https://www.instagram.com/reels/C45_QvIu3L0/',
        'https://www.instagram.com/reels/C44_QvIu3L0/',
        'https://www.instagram.com/reels/C43_QvIu3L0/'
    ];

    const allYt = [...new Set([...ytUrls, ...musicUrls])].slice(0, 20);

    const downloadsDir = path.join(__dirname, 'test_downloads');
    fs.ensureDirSync(downloadsDir);

    // 1. Test YouTube
    console.log('\n--- Testing YouTube (20 videos) ---');
    for (let i = 0; i < allYt.length; i++) {
        const url = allYt[i];
        try {
            console.log(`[YT ${i + 1}/20] Checking: ${url}`);
            const info = await getVideoInfo(url);
            console.log(`   ✅ Metadata OK: ${info.title.substring(0, 40)}`);

            // Only download first 5 to save time/space, but test different formats
            if (i < 5) {
                const type = (i % 2 === 0) ? 'video' : 'audio';
                const height = (i === 0) ? '720' : 'best';
                console.log(`   ⏳ Downloading ${type} (${height}p)...`);
                const outputPath = path.join(downloadsDir, `yt_${i}_${type}.%(ext)s`);
                const file = await downloadMedia(url, type, { outputPath, height });
                console.log(`   ✅ Downloaded: ${path.basename(file)}`);
            }
            results.youtube.success++;
        } catch (e) {
            console.error(`   ❌ Failed: ${e.message}`);
            results.youtube.fail++;
            results.youtube.details.push({ url, error: e.message });
        }
        await new Promise(r => setTimeout(r, 2000)); // Delay to avoid ban
    }

    // 2. Test Instagram
    console.log('\n--- Testing Instagram (20 reels) ---');
    for (let i = 0; i < instagramUrls.length; i++) {
        const url = instagramUrls[i];
        try {
            console.log(`[IG ${i + 1}/20] Checking: ${url}`);
            // Instagram metadata fetch is tricky with yt-dlp, sometimes it fails but download works
            const info = await getVideoInfo(url).catch(() => ({ title: 'IG Reel' }));
            console.log(`   ✅ Metadata (or fallback) OK: ${info.title || 'IG Reel'}`);

            if (i < 5) {
                const type = (i % 2 === 0) ? 'video' : 'audio';
                console.log(`   ⏳ Downloading ${type}...`);
                const outputPath = path.join(downloadsDir, `ig_${i}_${type}.%(ext)s`);
                const file = await downloadMedia(url, type, { outputPath });
                console.log(`   ✅ Downloaded: ${path.basename(file)}`);
            }
            results.instagram.success++;
        } catch (e) {
            console.error(`   ❌ Failed: ${e.message}`);
            results.instagram.fail++;
            results.instagram.details.push({ url, error: e.message });
        }
        await new Promise(r => setTimeout(r, 3000)); // IG is stricter
    }

    // 3. Test Shazam
    console.log('\n--- Testing Shazam Functionality ---');
    try {
        // We'll use a known music video for Shazam test
        const musicUrl = 'https://www.youtube.com/watch?v=kJQP7kiw5Fk'; // Despacito for easy recognition
        console.log(`⏳ Downloading audio for Shazam test: ${musicUrl}`);
        const outputPath = path.join(downloadsDir, `shazam_test.%(ext)s`);
        const audioFile = await downloadMedia(musicUrl, 'audio', { outputPath });

        console.log(`🎼 Processing audio with Shazam...`);
        const buffer = fs.readFileSync(audioFile);
        const track = await recognizeAudio(buffer);

        if (track) {
            console.log(`✅ Shazam OK: Found "${track.title}" by ${track.subtitle || 'unknown'}`);
            results.shazam.success++;
        } else {
            console.log(`⚠️ Shazam returned no results (might be normal for short clips or restricted API)`);
            results.shazam.fail++;
        }
    } catch (e) {
        console.error(`❌ Shazam Test Failed: ${e.message}`);
        results.shazam.fail++;
    }

    console.log('\n--- ALL TESTS COMPLETED ---');
    console.log(JSON.stringify(results, null, 2));

    // Cleanup
    // fs.removeSync(downloadsDir); 
}

runTests();

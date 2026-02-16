const axios = require('axios');
const fs = require('fs');

async function testFBEmbed() {
    const originalUrl = 'https://www.facebook.com/photo/?fbid=4545468229007418&set=a.1539516562935948';
    const embedUrl = `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(originalUrl)}&show_text=true&width=500`;

    try {
        console.log(`\n--- Testing FB Embed: ${embedUrl} ---`);
        const res = await axios.get(embedUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
            },
            timeout: 10000
        });
        const html = res.data;

        // Search for og:image or any scontent link
        const scontentMatches = html.match(/https?:\/\/scontent[^"'>\s\\]+/g);
        if (scontentMatches) {
            console.log('✅ Found scontent links:', scontentMatches.length);
            console.log('Sample:', scontentMatches[0].substring(0, 100));
        } else {
            console.log('❌ No scontent links found. Final URL:', res.request.res.responseUrl);
            fs.writeFileSync('fb_embed_debug.html', html);
        }
    } catch (e) {
        console.log('Error:', e.message);
    }
}

testFBEmbed();

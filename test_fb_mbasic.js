const axios = require('axios');
const fs = require('fs');

async function testFB() {
    // Convert to mbasic
    const url = 'https://mbasic.facebook.com/photo.php?fbid=4545468229007418';

    try {
        console.log(`\n--- Testing mbasic: ${url} ---`);
        const res = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 10000
        });
        const html = res.data;

        // In mbasic, it might not be og:image but a direct img tag or similar
        const ogMatch = html.match(/<meta[^>]+property\s*=\s*["']og:image["'][^>]+content\s*=\s*["']([^"']+)["']/i);
        if (ogMatch) {
            console.log('✅ Found og:image:', ogMatch[1].substring(0, 100));
        } else {
            console.log('❌ No og:image found');
            const imgMatch = html.match(/<img[^>]+src=["'](https?:\/\/scontent[^"']+)["']/i);
            if (imgMatch) {
                console.log('✅ Found scontent img:', imgMatch[1].substring(0, 100));
            } else {
                console.log('❌ No scontent img found. Final URL:', res.request.res.responseUrl);
                fs.writeFileSync('fb_mbasic_debug.html', html);
            }
        }
    } catch (e) {
        console.log('Error:', e.message);
    }
}

testFB();

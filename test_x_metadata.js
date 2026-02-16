const axios = require('axios');

async function testX() {
    const url = 'https://x.com/sadomedia/status/1757351025819771146';
    try {
        console.log(`\n--- Testing X: ${url} ---`);
        const res = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                // Adding some common crawler headers
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
            },
            timeout: 10000
        });
        const html = res.data;
        console.log('HTML Length:', html.length);

        // Search for og:image
        const ogMatch = html.match(/<meta[^>]+property\s*=\s*["']og:image["'][^>]+content\s*=\s*["']([^"']+)["']/i);
        if (ogMatch) {
            console.log('✅ Found og:image:', ogMatch[1]);
        } else {
            console.log('❌ No og:image found');
            // Check for Twitter specific tags
            const twitterMatch = html.match(/<meta[^>]+name\s*=\s*["']twitter:image["'][^>]+content\s*=\s*["']([^"']+)["']/i);
            if (twitterMatch) {
                console.log('✅ Found twitter:image:', twitterMatch[1]);
            } else {
                console.log('❌ No twitter:image found');
            }
        }
    } catch (e) {
        console.log('Error:', e.message);
    }
}

testX();

const axios = require('axios');

async function testFB() {
    const url = 'https://www.facebook.com/photo/?fbid=4545468229007418&set=a.1539516562935948';

    const uas = {
        'Googlebot': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Twitterbot': 'Twitterbot/1.1'
    };

    for (const [name, ua] of Object.entries(uas)) {
        console.log(`\n--- Testing ${name} ---`);
        try {
            const res = await axios.get(url, {
                headers: { 'User-Agent': ua },
                timeout: 10000
            });
            const html = res.data;
            const ogMatch = html.match(/<meta[^>]+property\s*=\s*["']og:image["'][^>]+content\s*=\s*["']([^"']+)["']/i) ||
                html.match(/<meta[^>]+content\s*=\s*["']([^"']+)["'][^>]+property\s*=\s*["']og:image["']/i);

            if (ogMatch) {
                console.log(`✅ [${name}] Found:`, ogMatch[1].substring(0, 100));
            } else {
                console.log(`❌ [${name}] Not found. Final URL:`, res.request.res.responseUrl);
            }
        } catch (e) {
            console.log(`Error [${name}]:`, e.message);
        }
    }
}

testFB();

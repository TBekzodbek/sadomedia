const axios = require('axios');

async function testFB() {
    const url = 'https://www.facebook.com/photo/?fbid=4545468229007418&set=a.1539516562935948';

    const uas = {
        'iPhone': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
        'FB Bot': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'
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

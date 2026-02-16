const axios = require('axios');
const fs = require('fs');

async function testFB() {
    const url = 'https://www.facebook.com/photo/?fbid=4545468229007418&set=a.1539516562935948';

    const uas = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
        'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'
    ];

    for (const ua of uas) {
        console.log(`\n--- Testing with UA: ${ua.substring(0, 50)}... ---`);
        try {
            const res = await axios.get(url, {
                headers: { 'User-Agent': ua },
                timeout: 10000,
                maxRedirects: 5
            });
            console.log('Status:', res.status);
            console.log('Final URL:', res.request.res.responseUrl);
            const html = res.data;
            const ogMatch = html.match(/<meta[^>]+property\s*=\s*["']og:image["'][^>]+content\s*=\s*["']([^"']+)["']/i);
            if (ogMatch) {
                console.log('✅ Found og:image:', ogMatch[1].substring(0, 100));
            } else {
                console.log('❌ No og:image found');
                fs.writeFileSync(`fb_debug_${uas.indexOf(ua)}.html`, html);
            }
        } catch (e) {
            console.log('Error:', e.message);
        }
    }
}

testFB();

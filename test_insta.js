const axios = require('axios');
const fs = require('fs');

async function testInsta() {
    const url = 'https://www.instagram.com/p/DFP7WJvM1Y6/';
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
            },
            timeout: 10000
        });
        fs.writeFileSync('insta_test.html', response.data);
        console.log('HTML saved to insta_test.html');

        const ogMatch = response.data.match(/<meta[^>]+(?:property|name)\s*=\s*["']og:image["'][^>]+content\s*=\s*["']([^"']+)["']/i) ||
            response.data.match(/<meta[^>]+content\s*=\s*["']([^"']+)["'][^>]+(?:property|name)\s*=\s*["']og:image["']/i);

        if (ogMatch) {
            console.log('Found og:image:', ogMatch[1]);
        } else {
            console.log('og:image not found');
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

testInsta();

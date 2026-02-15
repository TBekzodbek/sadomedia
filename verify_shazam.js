const { recognizeAudio } = require('./utils/shazamService');
const fs = require('fs-extra');

async function testShazam() {
    console.log('--- Shazam Mock Test ---');
    // Create a dummy buffer (1 second of silence/empty)
    const dummyBuffer = Buffer.alloc(1024 * 10);

    try {
        console.log('Testing with dummy buffer...');
        const result = await recognizeAudio(dummyBuffer);
        console.log('Test completed safely.');
        console.log('Result (expected null for dummy):', result);
    } catch (e) {
        console.error('Test FAILED with error:', e.message);
        process.exit(1);
    }
}

testShazam();

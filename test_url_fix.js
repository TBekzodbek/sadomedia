const { cleanUrl } = require('./utils/youtubeService');

const testUrl = 'Hydra Rockets Overload Extremely Satisfying\nhttps://youtube.com/shorts/CiSxuyLGC5k?si=sTVu_4AKCaPpG_mR';
const cleaned = cleanUrl(testUrl);

console.log('Original Text:', testUrl);
console.log('Cleaned URL:', cleaned);

if (cleaned === 'https://youtube.com/shorts/CiSxuyLGC5k?si=sTVu_4AKCaPpG_mR') {
    console.log('✅ Success: URL extracted correctly!');
} else {
    console.log('❌ Failure: URL extraction failed!');
}

const testUrl2 = 'Music: https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123';
const cleaned2 = cleanUrl(testUrl2);
console.log('Original Text 2:', testUrl2);
console.log('Cleaned URL 2:', cleaned2);

if (cleaned2 === 'https://www.youtube.com/watch?v=dQw4w9WgXcQ') {
    console.log('✅ Success: URL extracted and playlist removed!');
} else {
    console.log('❌ Failure: URL extraction or playlist removal failed!');
}

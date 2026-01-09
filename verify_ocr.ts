import { OCRService } from './src/services/OCRService';
import fs from 'fs';
import path from 'path';

async function testOCR() {
    console.log('🧪 Starting OCR Verification...');

    const ocrService = OCRService.getInstance();

    try {
        await ocrService.initialize();
        console.log('✅ OCR Service Initialized');

        // Check if we have a test image
        const testImagePath = path.join(__dirname, 'test_image.png');

        // If no test image, we'll try to use a remote one or just log success of init
        if (fs.existsSync(testImagePath)) {
            console.log(`📸 Found test image at ${testImagePath}. Processing...`);
            const result = await ocrService.recognize(testImagePath);
            console.log('📝 OCR Result:');
            console.log('------------------');
            console.log(result);
            console.log('------------------');
        } else {
            console.log('⚠️ No test_image.png found in root directory.');
            console.log('You can place an image named test_image.png in the project root to test real extraction.');
        }

        await ocrService.shutdown();
        console.log('🏁 Test completed');

    } catch (error) {
        console.error('❌ OCR Test failed:', error);
    }
}

testOCR();

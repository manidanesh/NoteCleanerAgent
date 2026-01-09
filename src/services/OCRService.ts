import { createWorker, Worker } from 'tesseract.js';
import { ErrorHandlingService } from './ErrorHandlingService';

/**
 * OCR Service for extracting text from images using Tesseract.js
 */
export class OCRService {
    private static instance: OCRService;
    private worker: Worker | null = null;
    private isInitialized: boolean = false;
    private errorHandlingService: ErrorHandlingService;

    private constructor() {
        this.errorHandlingService = new ErrorHandlingService();
    }

    static getInstance(): OCRService {
        if (!OCRService.instance) {
            OCRService.instance = new OCRService();
        }
        return OCRService.instance;
    }

    /**
     * Initialize the Tesseract worker
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        try {
            console.log('[OCRService] Initializing Tesseract.js worker...');
            this.worker = await createWorker('eng');
            this.isInitialized = true;
            console.log('[OCRService] Tesseract.js worker initialized');
        } catch (error) {
            console.error('[OCRService] Failed to initialize Tesseract.js:', error);
            throw error;
        }
    }

    /**
     * Perform OCR on an image
     * @param imageSource URL, file path, or Buffer of the image
     */
    async recognize(imageSource: string | Buffer): Promise<string> {
        if (!this.isInitialized || !this.worker) {
            await this.initialize();
        }

        try {
            const { data: { text } } = await this.worker!.recognize(imageSource);
            return text.trim();
        } catch (error) {
            console.error('[OCRService] OCR recognition failed:', error);
            throw error;
        }
    }

    /**
     * Terminate the worker
     */
    async shutdown(): Promise<void> {
        if (this.worker) {
            await this.worker.terminate();
            this.worker = null;
            this.isInitialized = false;
            console.log('[OCRService] Tesseract.js worker terminated');
        }
    }
}

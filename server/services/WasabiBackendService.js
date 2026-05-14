// WasabiBackendService - agora apenas utilitário de cliente S3 (storage)
import { S3Client } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

dotenv.config();

class WasabiBackendService {
  constructor() {
    this.s3Client = null;
  }

  async initializeS3Client() {
    if (this.s3Client) return;
    const config = {
      region: process.env.VITE_WASABI_REGION || process.env.WASABI_REGION || '',
      endpoint: process.env.VITE_WASABI_ENDPOINT || process.env.WASABI_ENDPOINT || '',
      credentials: {
        accessKeyId: process.env.VITE_WASABI_ACCESS_KEY || process.env.WASABI_ACCESS_KEY || '',
        secretAccessKey: process.env.VITE_WASABI_SECRET_KEY || process.env.WASABI_SECRET_KEY || '',
      },
      forcePathStyle: true,
    };
    this.s3Client = new S3Client(config);
  }

  getBucket() {
    return process.env.VITE_WASABI_BUCKET || process.env.WASABI_BUCKET || '';
  }

  getClient() {
    if (!this.s3Client) {
      throw new Error('S3 client not initialized. Call initializeS3Client() first.');
    }
    return this.s3Client;
  }
}

export const wasabiBackendService = new WasabiBackendService();
export default WasabiBackendService;


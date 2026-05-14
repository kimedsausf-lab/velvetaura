// WasabiService - Serviço para gerenciar uploads e downloads no Wasabi
export interface WasabiConfig {
  accessKey: string;
  secretKey: string;
  region: string;
  bucket: string;
  endpoint: string;
}

export interface UploadResult {
  success: boolean;
  fileId: string;
  url: string;
  error?: string;
}

export interface FileMetadata {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
  url: string;
}

class WasabiService {
  private config: WasabiConfig | null = null;
  private isInitialized = false;

  // Inicializar o serviço com as credenciais do Wasabi
  async initialize(config: WasabiConfig): Promise<void> {
    this.config = config;
    this.isInitialized = true;
  }

  // Verificar se o serviço está inicializado e inicializar se necessário
  private async checkInitialized(): Promise<void> {
    if (!this.isInitialized || !this.config) {
      // Tentar inicializar com configurações padrão ou do site
      await this.initializeWithDefaultConfig();
    }
  }

  // Inicializar com configurações padrão ou do site
  private async initializeWithDefaultConfig(): Promise<void> {
    try {
      // Tentar carregar configurações do site
      const baseUrl = import.meta.env.DEV ? '' : '';
      const response = await fetch(`${baseUrl}/api/site-config`);
      if (response.ok) {
        const siteConfig = await response.json();
        // Aceitar tanto camelCase quanto snake_case
        const cfg = siteConfig.wasabiConfig || siteConfig.wasabi_config;
        if (cfg) {
          const normalized = {
            accessKey: cfg.accessKey || cfg.access_key || '',
            secretKey: cfg.secretKey || cfg.secret_key || '',
            region: cfg.region || '',
            bucket: cfg.bucket || '',
            endpoint: cfg.endpoint || ''
          } as WasabiConfig;
          await this.initialize(normalized);
          return;
        }
      }
    } catch (error) {
      console.warn('Could not load site config for Wasabi, using default config');
    }

    // Usar configurações padrão se não conseguir carregar do site
    await this.initialize(defaultWasabiConfig);
  }

  // Upload de arquivo para o Wasabi via servidor
  async uploadFile(file: File, folder: 'videos' | 'thumbnails' = 'videos'): Promise<UploadResult> {
    try {
      await this.checkInitialized();
      const formData = new FormData();
      formData.append('file', file);
      
      // Usar a URL correta da API (porta 3000)
      const baseUrl = import.meta.env.DEV ? '' : '';
      const endpoint = `/api/upload/${folder}`;
      const fullUrl = `${baseUrl}${endpoint}`;
      
      // console.log(`Uploading file to: ${fullUrl}`);
      // console.log(`File: ${file.name}, Size: ${file.size}, Type: ${file.type}`);
      
      const response = await fetch(fullUrl, {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        const result = await response.json();
        return {
          success: result.success,
          fileId: result.fileId,
          url: result.url
        };
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Upload failed: ${response.status} ${response.statusText} - ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error uploading file to Wasabi:', error);
      return {
        success: false,
        fileId: '',
        url: '',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Obter URL de visualização do arquivo (usando URL assinada)
  async getFileUrl(fileId: string): Promise<string> {
    await this.checkInitialized();
    
    try {
      // Usar o servidor para gerar URL assinada
      const baseUrl = import.meta.env.DEV ? '' : '';
      const encodedFileId = encodeURIComponent(fileId);
      // console.log('Requesting signed URL for fileId:', fileId, 'encoded:', encodedFileId);
      const response = await fetch(`${baseUrl}/api/signed-url/${encodedFileId}`);
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.url) {
          // console.log('Signed URL obtained:', result.url);
          return result.url;
        }
      }
      // else {
      //   console.error('Failed to get signed URL:', response.status, response.statusText);
      // }
      
      // console.warn('Failed to get signed URL, falling back to direct URL');
    } catch (error) {
      // console.warn('Error getting signed URL:', error);
    }
    
    // Fallback para URL direta (pode não funcionar se o bucket for privado)
    if (fileId.startsWith('videos/') || fileId.startsWith('thumbnails/')) {
      return `https://${this.config!.bucket}.s3.${this.config!.region}.wasabisys.com/${fileId}`;
    }
    
    return `https://${this.config!.bucket}.s3.${this.config!.region}.wasabisys.com/videos/${fileId}`;
  }

  // Obter URL de thumbnail (usando URL assinada)
  async getThumbnailUrl(thumbnailId: string): Promise<string> {
    await this.checkInitialized();
    
    try {
      // Usar o servidor para gerar URL assinada
      const baseUrl = import.meta.env.DEV ? '' : '';
      const encodedThumbnailId = encodeURIComponent(thumbnailId);
      // console.log('Requesting signed URL for thumbnailId:', thumbnailId, 'encoded:', encodedThumbnailId);
      const response = await fetch(`${baseUrl}/api/signed-url/${encodedThumbnailId}`);
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.url) {
          // console.log('Signed URL for thumbnail obtained:', result.url);
          return result.url;
        }
      }
      // else {
      //   console.error('Failed to get signed URL for thumbnail:', response.status, response.statusText);
      // }
      
      // console.warn('Failed to get signed URL for thumbnail, falling back to direct URL');
    } catch (error) {
      // console.warn('Error getting signed URL for thumbnail:', error);
    }
    
    // Fallback para URL direta (pode não funcionar se o bucket for privado)
    if (thumbnailId.startsWith('thumbnails/')) {
      return `https://${this.config!.bucket}.s3.${this.config!.region}.wasabisys.com/${thumbnailId}`;
    }
    
    return `https://${this.config!.bucket}.s3.${this.config!.region}.wasabisys.com/thumbnails/${thumbnailId}`;
  }

  // Deletar arquivo do Wasabi via servidor
  async deleteFile(fileId: string): Promise<boolean> {
    await this.checkInitialized();
    
    try {
      // Usar o servidor para deletar arquivo
      const baseUrl = import.meta.env.DEV ? '' : '';
      const encodedFileId = encodeURIComponent(fileId);
      const response = await fetch(`${baseUrl}/api/delete-file/${encodedFileId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        const result = await response.json();
        return result.success || false;
      } else {
        // console.error('Failed to delete file:', response.status, response.statusText);
        return false;
      }
    } catch (error) {
      // console.error('Error deleting file from Wasabi:', error);
      return false;
    }
  }

  // Verificar se um arquivo existe
  async fileExists(fileId: string): Promise<boolean> {
    await this.checkInitialized();
    
    try {
      const url = await this.getFileUrl(fileId);
      const response = await fetch(url, { method: 'HEAD' });
      return response.ok;
    } catch (error) {
      // console.error('Error checking file existence:', error);
      return false;
    }
  }

  // Listar arquivos em uma pasta
  async listFiles(folder: 'videos' | 'thumbnails' = 'videos'): Promise<FileMetadata[]> {
    await this.checkInitialized();
    
    try {
      // Para simplificar, retornamos um array vazio
      // Em produção, você usaria a API do Wasabi para listar arquivos
      return [];
    } catch (error) {
      // console.error('Error listing files:', error);
      return [];
    }
  }
}

// Instância singleton do serviço
export const wasabiService = new WasabiService();

// Configuração padrão do Wasabi (será carregada do site_config.json)
export const defaultWasabiConfig: WasabiConfig = {
  accessKey: '',
  secretKey: '',
  region: '',
  bucket: '',
  endpoint: ''
};

export default WasabiService;

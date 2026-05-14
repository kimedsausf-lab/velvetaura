// WasabiMetadataService - Serviço para gerenciar metadados diretamente no Wasabi
import { wasabiService } from './WasabiService';

export interface VideoData {
  id: string;
  title: string;
  description: string;
  price: number;
  duration: string;
  videoFileId: string;
  thumbnailFileId: string;
  thumbnailUrl?: string;
  isPurchased?: boolean;
  createdAt: string;
  views: number;
  productLink?: string;
  isActive: boolean;
}

export interface UserData {
  id: string;
  email: string;
  name: string;
  password: string;
  createdAt: string;
}

export interface SessionData {
  id: string;
  userId: string;
  token: string;
  expiresAt: string;
  createdAt: string;
  isActive: boolean;
}

export interface SiteConfigData {
  siteName: string;
  whoApiKey: string;
  stripePublishableKey: string;
  stripeSecretKey: string;
  paypalClientId: string;
  telegramUsername: string;
  videoListTitle: string;
  crypto: any[];
  emailHost: string;
  emailPort: string;
  emailSecure: boolean;
  emailUser: string;
  emailPass: string;
  emailFrom: string;
  wasabiConfig: any;
}

class WasabiMetadataService {
  private readonly METADATA_KEY = 'metadata/videosplus-data.json';
  private cache: any = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_DURATION = 30 * 1000; // 30 segundos

  // Verificar se o cache é válido
  private isCacheValid(): boolean {
    return this.cache !== null && 
           this.cacheTimestamp > 0 && 
           (Date.now() - this.cacheTimestamp) < this.CACHE_DURATION;
  }

  // Limpar cache
  private clearCache(): void {
    this.cache = null;
    this.cacheTimestamp = 0;
    console.log('Wasabi metadata cache cleared');
  }

  // Carregar dados do Wasabi
  private async loadDataFromWasabi(): Promise<any> {
    try {
      // Inicializar wasabiService se necessário
      await wasabiService.initialize({
        accessKey: import.meta.env.VITE_WASABI_ACCESS_KEY || '',
        secretKey: import.meta.env.VITE_WASABI_SECRET_KEY || '',
        region: import.meta.env.VITE_WASABI_REGION || '',
        bucket: import.meta.env.VITE_WASABI_BUCKET || '',
        endpoint: import.meta.env.VITE_WASABI_ENDPOINT || ''
      });
      
      // Obter URL assinada para o arquivo de metadados
      const metadataUrl = await wasabiService.getFileUrl(this.METADATA_KEY);
      
      // Fazer download dos dados
      const response = await fetch(metadataUrl);
      if (!response.ok) {
        throw new Error(`Failed to load metadata: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Atualizar cache
      this.cache = data;
      this.cacheTimestamp = Date.now();
      
      return data;
    } catch (error) {
      console.error('Error loading metadata from Wasabi:', error);
      
      // Retornar dados padrão se não conseguir carregar
      const defaultData = {
        videos: [],
        users: [],
        sessions: [],
        siteConfig: {
          siteName: 'VideosPlus',
          whoApiKey: '',
          stripePublishableKey: '',
          stripeSecretKey: '',
          telegramUsername: '',
          videoListTitle: 'Available Videos',
          crypto: [],
          emailHost: 'smtp.gmail.com',
          emailPort: '587',
          emailSecure: false,
          emailUser: '',
          emailPass: '',
          emailFrom: '',
          wasabiConfig: {
            accessKey: import.meta.env.VITE_WASABI_ACCESS_KEY || '',
            secretKey: import.meta.env.VITE_WASABI_SECRET_KEY || '',
            region: import.meta.env.VITE_WASABI_REGION || '',
            bucket: import.meta.env.VITE_WASABI_BUCKET || '',
            endpoint: import.meta.env.VITE_WASABI_ENDPOINT || ''
          }
        }
      };
      
      this.cache = defaultData;
      this.cacheTimestamp = Date.now();
      
      return defaultData;
    }
  }

  // Salvar dados no Wasabi
  private async saveDataToWasabi(data: any): Promise<void> {
    try {
      console.log('Saving metadata to Wasabi...');
      
       // Inicializar wasabiService se necessário
      await wasabiService.initialize({
        accessKey: import.meta.env.VITE_WASABI_ACCESS_KEY || '',
        secretKey: import.meta.env.VITE_WASABI_SECRET_KEY || '',
        region: import.meta.env.VITE_WASABI_REGION || '',
        bucket: import.meta.env.VITE_WASABI_BUCKET || '',
        endpoint: import.meta.env.VITE_WASABI_ENDPOINT || ''
      });
      
      // Converter dados para JSON
      const jsonData = JSON.stringify(data, null, 2);
      
      // Fazer upload para o Wasabi via servidor
      const formData = new FormData();
      const blob = new Blob([jsonData], { type: 'application/json' });
      formData.append('file', blob, 'videosplus-data.json');
      
      const baseUrl = import.meta.env.DEV ? '' : '';
      const response = await fetch(`${baseUrl}/api/upload/metadata`, {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`Failed to save metadata: ${response.status}`);
      }
      
      console.log('Metadata saved to Wasabi successfully');
      
      // Atualizar cache
      this.cache = data;
      this.cacheTimestamp = Date.now();
      
    } catch (error) {
      console.error('Error saving metadata to Wasabi:', error);
      throw error;
    }
  }

  // Obter dados (com cache)
  private async getData(): Promise<any> {
    if (this.isCacheValid()) {
      console.log('Using cached metadata');
      return this.cache;
    }
    
    return await this.loadDataFromWasabi();
  }

  // ===== VÍDEOS =====
  
  async getAllVideos(): Promise<VideoData[]> {
    const data = await this.getData();
    return data.videos || [];
  }

  async getVideo(id: string): Promise<VideoData | null> {
    const videos = await this.getAllVideos();
    return videos.find(video => video.id === id) || null;
  }

  async createVideo(videoData: Omit<VideoData, 'id' | 'createdAt' | 'views'>): Promise<VideoData> {
    // Carregar dados existentes do Wasabi
    const data = await this.loadDataFromWasabi();
    
    const newVideo: VideoData = {
      ...videoData,
      id: this.generateId(),
      createdAt: new Date().toISOString(),
      views: 0
    };
    
    // Garantir que videos existe no array
    if (!data.videos) {
      data.videos = [];
    }
    
    // Adicionar novo vídeo ao array existente
    data.videos.push(newVideo);
    
    // Salvar dados atualizados no Wasabi
    await this.saveDataToWasabi(data);
    return newVideo;
  }

  async updateVideo(id: string, updates: Partial<VideoData>): Promise<VideoData | null> {
    // Carregar dados existentes do Wasabi
    const data = await this.loadDataFromWasabi();
    
    if (!data.videos) {
      return null;
    }
    
    const videoIndex = data.videos.findIndex((video: VideoData) => video.id === id);
    if (videoIndex === -1) {
      return null;
    }
    
    // Atualizar vídeo existente
    data.videos[videoIndex] = { ...data.videos[videoIndex], ...updates };
    
    // Salvar dados atualizados no Wasabi
    await this.saveDataToWasabi(data);
    return data.videos[videoIndex];
  }

  async deleteVideo(id: string): Promise<boolean> {
    // Carregar dados existentes do Wasabi
    const data = await this.loadDataFromWasabi();
    
    if (!data.videos) {
      return false;
    }
    
    const videoIndex = data.videos.findIndex((video: VideoData) => video.id === id);
    if (videoIndex === -1) {
      return false;
    }
    
    // Remover vídeo do array
    data.videos.splice(videoIndex, 1);
    
    // Salvar dados atualizados no Wasabi
    await this.saveDataToWasabi(data);
    return true;
  }

  async incrementVideoViews(id: string): Promise<void> {
    // Carregar dados existentes do Wasabi
    const data = await this.loadDataFromWasabi();
    
    if (!data.videos) {
      return;
    }
    
    const video = data.videos.find((video: VideoData) => video.id === id);
    if (video) {
      video.views = (video.views || 0) + 1;
      // Salvar dados atualizados no Wasabi
      await this.saveDataToWasabi(data);
    }
  }

  // ===== USUÁRIOS =====
  
  async getAllUsers(): Promise<UserData[]> {
    const data = await this.getData();
    return data.users || [];
  }

  async getUser(id: string): Promise<UserData | null> {
    const users = await this.getAllUsers();
    return users.find(user => user.id === id) || null;
  }

  async getUserByEmail(email: string): Promise<UserData | null> {
    const users = await this.getAllUsers();
    return users.find(user => user.email === email) || null;
  }

  async createUser(userData: Omit<UserData, 'id' | 'createdAt'>): Promise<UserData> {
    // Carregar dados existentes do Wasabi
    const data = await this.loadDataFromWasabi();
    
    const newUser: UserData = {
      ...userData,
      id: this.generateId(),
      createdAt: new Date().toISOString()
    };
    
    // Garantir que users existe no array
    if (!data.users) {
      data.users = [];
    }
    
    // Adicionar novo usuário ao array existente
    data.users.push(newUser);
    
    // Salvar dados atualizados no Wasabi
    await this.saveDataToWasabi(data);
    return newUser;
  }

  async updateUser(id: string, updates: Partial<UserData>): Promise<UserData | null> {
    // Carregar dados existentes do Wasabi
    const data = await this.loadDataFromWasabi();
    
    if (!data.users) {
      return null;
    }
    
    const userIndex = data.users.findIndex((user: UserData) => user.id === id);
    if (userIndex === -1) {
      return null;
    }
    
    // Atualizar usuário existente
    data.users[userIndex] = { ...data.users[userIndex], ...updates };
    
    // Salvar dados atualizados no Wasabi
    await this.saveDataToWasabi(data);
    return data.users[userIndex];
  }

  async deleteUser(id: string): Promise<boolean> {
    // Carregar dados existentes do Wasabi
    const data = await this.loadDataFromWasabi();
    
    if (!data.users) {
      return false;
    }
    
    const userIndex = data.users.findIndex((user: UserData) => user.id === id);
    if (userIndex === -1) {
      return false;
    }
    
    // Remover usuário do array
    data.users.splice(userIndex, 1);
    
    // Salvar dados atualizados no Wasabi
    await this.saveDataToWasabi(data);
    return true;
  }

  // ===== SESSÕES =====
  
  async getAllSessions(): Promise<SessionData[]> {
    const data = await this.getData();
    return data.sessions || [];
  }

  async getSessionByToken(token: string): Promise<SessionData | null> {
    const sessions = await this.getAllSessions();
    return sessions.find(session => session.token === token && session.isActive) || null;
  }

  async createSession(sessionData: Omit<SessionData, 'id' | 'createdAt'>): Promise<SessionData> {
    // Carregar dados existentes do Wasabi
    const data = await this.loadDataFromWasabi();
    
    const newSession: SessionData = {
      ...sessionData,
      id: this.generateId(),
      createdAt: new Date().toISOString()
    };
    
    // Garantir que sessions existe no array
    if (!data.sessions) {
      data.sessions = [];
    }
    
    // Adicionar nova sessão ao array existente
    data.sessions.push(newSession);
    
    // Salvar dados atualizados no Wasabi
    await this.saveDataToWasabi(data);
    return newSession;
  }

  async updateSession(id: string, updates: Partial<SessionData>): Promise<SessionData | null> {
    // Carregar dados existentes do Wasabi
    const data = await this.loadDataFromWasabi();
    
    if (!data.sessions) {
      return null;
    }
    
    const sessionIndex = data.sessions.findIndex((session: SessionData) => session.id === id);
    if (sessionIndex === -1) {
      return null;
    }
    
    // Atualizar sessão existente
    data.sessions[sessionIndex] = { ...data.sessions[sessionIndex], ...updates };
    
    // Salvar dados atualizados no Wasabi
    await this.saveDataToWasabi(data);
    return data.sessions[sessionIndex];
  }

  async deleteSession(id: string): Promise<boolean> {
    // Carregar dados existentes do Wasabi
    const data = await this.loadDataFromWasabi();
    
    if (!data.sessions) {
      return false;
    }
    
    const sessionIndex = data.sessions.findIndex((session: SessionData) => session.id === id);
    if (sessionIndex === -1) {
      return false;
    }
    
    // Remover sessão do array
    data.sessions.splice(sessionIndex, 1);
    
    // Salvar dados atualizados no Wasabi
    await this.saveDataToWasabi(data);
    return true;
  }

  // ===== CONFIGURAÇÃO DO SITE =====
  
  async getSiteConfig(): Promise<SiteConfigData | null> {
    const data = await this.getData();
    return data.siteConfig || null;
  }

  async updateSiteConfig(config: Partial<SiteConfigData>): Promise<SiteConfigData> {
    // Carregar dados existentes do Wasabi
    const data = await this.loadDataFromWasabi();
    
    // Atualizar configuração do site
    data.siteConfig = { ...data.siteConfig, ...config };
    
    // Salvar dados atualizados no Wasabi
    await this.saveDataToWasabi(data);
    return data.siteConfig;
  }

  // ===== UTILITÁRIOS =====
  
  generateId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  // Limpar cache publicamente
  public clearCachePublic(): void {
    this.clearCache();
  }
}

// Instância singleton
export const wasabiMetadataService = new WasabiMetadataService();
export default WasabiMetadataService;

// JSONDatabaseService - Serviço para gerenciar dados via Wasabi (fonte principal)
import { wasabiMetadataService, VideoData, UserData, SessionData, SiteConfigData } from './WasabiMetadataService';

class JSONDatabaseService {
  private isInitialized = false;

  // Inicializar o serviço
  async initialize(): Promise<void> {
    this.isInitialized = true;
  }

  // Verificar se o serviço está inicializado e inicializar se necessário
  private async checkInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  // ===== VÍDEOS =====
  
  // Obter todos os vídeos
  async getAllVideos(): Promise<VideoData[]> {
    await this.checkInitialized();
    return await wasabiMetadataService.getAllVideos();
  }

  // Obter vídeo por ID
  async getVideo(id: string): Promise<VideoData | null> {
    await this.checkInitialized();
    return await wasabiMetadataService.getVideo(id);
  }

  // Criar novo vídeo
  async createVideo(video: Omit<VideoData, 'id' | 'createdAt' | 'views'>): Promise<VideoData> {
    await this.checkInitialized();
    return await wasabiMetadataService.createVideo(video);
  }

  // Atualizar vídeo
  async updateVideo(id: string, updates: Partial<VideoData>): Promise<VideoData | null> {
    await this.checkInitialized();
    return await wasabiMetadataService.updateVideo(id, updates);
  }

  // Deletar vídeo
  async deleteVideo(id: string): Promise<boolean> {
    await this.checkInitialized();
    return await wasabiMetadataService.deleteVideo(id);
  }

  // Incrementar visualizações
  async incrementVideoViews(id: string): Promise<void> {
    await this.checkInitialized();
    return await wasabiMetadataService.incrementVideoViews(id);
  }

  // ===== USUÁRIOS =====
  
  // Obter todos os usuários
  async getAllUsers(): Promise<UserData[]> {
    await this.checkInitialized();
    return await wasabiMetadataService.getAllUsers();
  }

  // Obter usuário por ID
  async getUser(id: string): Promise<UserData | null> {
    await this.checkInitialized();
    return await wasabiMetadataService.getUser(id);
  }

  // Obter usuário por email
  async getUserByEmail(email: string): Promise<UserData | null> {
    await this.checkInitialized();
    return await wasabiMetadataService.getUserByEmail(email);
  }

  // Criar novo usuário
  async createUser(user: Omit<UserData, 'id' | 'createdAt'>): Promise<UserData> {
    await this.checkInitialized();
    return await wasabiMetadataService.createUser(user);
  }

  // Atualizar usuário
  async updateUser(id: string, updates: Partial<UserData>): Promise<UserData | null> {
    await this.checkInitialized();
    return await wasabiMetadataService.updateUser(id, updates);
  }

  // Deletar usuário
  async deleteUser(id: string): Promise<boolean> {
    await this.checkInitialized();
    return await wasabiMetadataService.deleteUser(id);
  }

  // ===== SESSÕES =====
  
  // Criar nova sessão
  async createSession(session: Omit<SessionData, 'id' | 'createdAt'>): Promise<SessionData> {
    await this.checkInitialized();
    return await wasabiMetadataService.createSession(session);
  }

  // Obter sessão por token
  async getSessionByToken(token: string): Promise<SessionData | null> {
    await this.checkInitialized();
    return await wasabiMetadataService.getSessionByToken(token);
  }

  // Atualizar sessão
  async updateSession(id: string, updates: Partial<SessionData>): Promise<SessionData | null> {
    await this.checkInitialized();
    return await wasabiMetadataService.updateSession(id, updates);
  }

  // Deletar sessão
  async deleteSession(id: string): Promise<boolean> {
    await this.checkInitialized();
    return await wasabiMetadataService.deleteSession(id);
  }

  // ===== CONFIGURAÇÕES DO SITE =====
  
  // Obter configurações do site
  async getSiteConfig(): Promise<SiteConfigData | null> {
    await this.checkInitialized();
    return await wasabiMetadataService.getSiteConfig();
  }

  // Atualizar configurações do site
  async updateSiteConfig(config: SiteConfigData): Promise<SiteConfigData> {
    await this.checkInitialized();
    return await wasabiMetadataService.updateSiteConfig(config);
  }

  // ===== MÉTODOS AUXILIARES =====
  
  // Verificar se o serviço está funcionando
  async healthCheck(): Promise<boolean> {
    try {
      await this.checkInitialized();
      return true;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }
}

// Instância singleton do serviço
export const jsonDatabaseService = new JSONDatabaseService();

export default JSONDatabaseService;
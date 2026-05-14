import { wasabiService } from './WasabiService';
import { SupabaseService } from './SupabaseService';

// Video interface - mantém compatibilidade com o frontend
export interface Video {
  $id: string;
  title: string;
  description: string;
  price: number;
  duration: string;
  videoFileId?: string;
  video_id?: string;
  thumbnailFileId?: string;
  thumbnail_id?: string;
  thumbnailUrl?: string;
  isPurchased?: boolean;
  createdAt: string;
  views: number;
  product_link?: string;
  is_free?: boolean; // Free content flag
}

// Sort options
export enum SortOption {
  NEWEST = 'newest',
  PRICE_ASC = 'price_asc',
  PRICE_DESC = 'price_desc',
  VIEWS_DESC = 'views_desc',
  DURATION_DESC = 'duration_desc'
}

export class VideoService {
  // Cache para vídeos para melhorar performance
  private static videosCache: Video[] | null = null;
  private static cacheTimestamp: number = 0;
  private static readonly CACHE_DURATION = 30 * 1000; // 30 segundos (reduzido para produção)

  // Método para limpar o cache
  private static clearCache(): void {
    this.videosCache = null;
    this.cacheTimestamp = 0;
    console.log('Video cache cleared');
  }

  // Método público para limpar o cache (para uso externo)
  public static clearCachePublic(): void {
    this.clearCache();
  }

  // Método para forçar atualização do cache
  private static async forceRefreshCache(): Promise<Video[]> {
    this.clearCache();
    return await this.getAllVideos();
  }

  // Verificar se o cache é válido
  private static isCacheValid(): boolean {
    return this.videosCache !== null && 
           this.cacheTimestamp > 0 && 
           (Date.now() - this.cacheTimestamp) < this.CACHE_DURATION;
  }

  // Método para converter VideoData para Video (compatibilidade com frontend)
  private static convertVideoData(videoData: any): Video {
    // Converter duration (inteiro em segundos) para formato string (MM:SS ou HH:MM:SS)
    let formattedDuration = '00:00';
    if (typeof videoData.duration === 'string') {
      formattedDuration = videoData.duration;
    } else if (typeof videoData.duration === 'number') {
      const totalSeconds = videoData.duration;
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      
      if (minutes < 60) {
        formattedDuration = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      } else {
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        formattedDuration = `${hours.toString().padStart(2, '0')}:${remainingMinutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      }
    }
    
    return {
      $id: videoData.id,
      title: videoData.title,
      description: videoData.description,
      price: videoData.price,
      duration: formattedDuration,
      videoFileId: videoData.videoFileId,
      video_id: videoData.videoFileId, // Para compatibilidade
      thumbnailFileId: videoData.thumbnailFileId,
      thumbnail_id: videoData.thumbnailFileId, // Para compatibilidade
      thumbnailUrl: videoData.thumbnailUrl,
      isPurchased: videoData.isPurchased || false,
      createdAt: videoData.createdAt,
      views: videoData.views,
      product_link: videoData.productLink || '',
      is_free: !!videoData.is_free,
    };
  }

  // Get only video IDs (fast operation without metadata)
  static async getVideoIds(sortOption: SortOption = SortOption.NEWEST): Promise<string[]> {
    try {
      const rows = await SupabaseService.listVideos();
      const videos = rows.map(row => ({
        $id: row.id,
        title: row.title,
        price: Number(row.price || 0),
        createdAt: row.created_at,
        views: row.views || 0,
        duration: row.duration || '00:00',
      })) as unknown as Video[];
      const sorted = this.sortVideos(videos, sortOption);
      return sorted.map(v => v.$id);
    } catch (error) {
      console.error('Error getting video IDs:', error);
      return [];
    }
  }

  // Get all videos with sorting options
  static async getAllVideos(sortOption: SortOption = SortOption.NEWEST, searchQuery: string = ''): Promise<Video[]> {
    try {
      // Se não há busca e o cache é válido, usar cache
      if (!searchQuery && this.isCacheValid()) {
        console.log('Usando cache de vídeos');
        return this.sortVideos([...this.videosCache!], sortOption);
      }

      console.log('Buscando vídeos no Supabase (metadados)');
      const rows = await SupabaseService.listVideos();
      let videos: Video[] = rows.map(row => ({
        $id: row.id,
        title: row.title,
        description: row.description || '',
        price: Number(row.price || 0),
        duration: row.duration || '00:00',
        videoFileId: row.video_file_id || undefined,
        video_id: row.video_file_id || undefined,
        thumbnailFileId: row.thumbnail_file_id || undefined,
        thumbnail_id: row.thumbnail_file_id || undefined,
        thumbnailUrl: row.thumbnail_url || undefined,
        isPurchased: false,
        createdAt: row.created_at,
        views: row.views || 0,
        product_link: row.product_link || '',
        is_free: !!row.is_free,
      }));
      
      // Aplicar pesquisa do lado do cliente se a consulta for fornecida
      if (searchQuery && searchQuery.trim() !== '') {
        const trimmedQuery = searchQuery.trim().toLowerCase();
        videos = videos.filter(video => 
          video.title.toLowerCase().includes(trimmedQuery) || 
          video.description.toLowerCase().includes(trimmedQuery)
        );
      }

      // IMPORTANT: do not resolve thumbnail URLs from Wasabi here.
      // This keeps the list fast so cards render immediately.
      // The card itself can lazy-load media only when needed.

      // Atualizar cache se não há busca
      if (!searchQuery) {
        this.videosCache = [...videos];
        this.cacheTimestamp = Date.now();
        console.log('Cache atualizado com', videos.length, 'vídeos');
      }
      
      // Ordenar vídeos
      return this.sortVideos(videos, sortOption);
    } catch (error) {
      console.error('Erro ao obter vídeos:', error);
      throw error;
    }
  }

  // Método para ordenar vídeos
  private static sortVideos(videos: Video[], sortOption: SortOption): Video[] {
    switch (sortOption) {
      case SortOption.NEWEST:
        return videos.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      case SortOption.PRICE_ASC:
        return videos.sort((a, b) => a.price - b.price);
      case SortOption.PRICE_DESC:
        return videos.sort((a, b) => b.price - a.price);
      case SortOption.VIEWS_DESC:
        return videos.sort((a, b) => (b.views || 0) - (a.views || 0));
      case SortOption.DURATION_DESC:
        return videos.sort((a, b) => {
          const getDurationInSeconds = (duration: string) => {
            try {
              const parts = duration.split(':').map(Number);
              if (parts.length === 2) {
                return parts[0] * 60 + parts[1]; // formato MM:SS
              } else if (parts.length === 3) {
                return parts[0] * 3600 + parts[1] * 60 + parts[2]; // formato HH:MM:SS
              }
            } catch (error) {
              console.error('Erro ao analisar duração:', error);
            }
            return 0;
          };
          return getDurationInSeconds(b.duration) - getDurationInSeconds(a.duration);
        });
      default:
        return videos;
    }
  }
  
  // Get a single video by ID (optimized for fast loading)
  static async getVideo(videoId: string): Promise<Video | null> {
    try {
      const row = await SupabaseService.getVideo(videoId);
      if (!row) return null;
      const video: Video = {
        $id: row.id,
        title: row.title,
        description: row.description || '',
        price: Number(row.price || 0),
        duration: row.duration || '00:00',
        videoFileId: row.video_file_id || undefined,
        video_id: row.video_file_id || undefined,
        thumbnailFileId: row.thumbnail_file_id || undefined,
        thumbnail_id: row.thumbnail_file_id || undefined,
        thumbnailUrl: row.thumbnail_url || undefined,
        isPurchased: false,
        createdAt: row.created_at,
        views: row.views || 0,
        product_link: row.product_link || '',
        is_free: !!row.is_free,
      };

      // Attach up to 3 preview sources for this title
      try {
        const sources = await SupabaseService.listVideoSources(video.$id);
        (video as any).previewSources = sources.slice(0, 3);
      } catch (e) {
        console.warn('Could not load video sources for preview:', e);
      }
      
      // Get thumbnail URL asynchronously (non-blocking)
      const thumbnailId = video.thumbnailFileId || video.thumbnail_id;
      
      if (thumbnailId) {
        // Load thumbnail in background, don't wait for it
        wasabiService.getThumbnailUrl(thumbnailId)
          .then(url => {
            video.thumbnailUrl = url;
          })
          .catch(error => {
          console.error(`Error getting thumbnail for video ${video.$id}:`, error);
            video.thumbnailUrl = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjE4MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjE4MCIgZmlsbD0iI2Y1ZjVmNSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTk5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5WaWRlbyBUaHVtYm5haWw8L3RleHQ+PC9zdmc+';
          });
        
        // Set a placeholder immediately
          video.thumbnailUrl = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjE4MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjE4MCIgZmlsbD0iI2Y1ZjVmNSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTk5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5WaWRlbyBUaHVtYm5haWw8L3RleHQ+PC9zdmc+';
      } else {
        // Use placeholder if no thumbnail ID
        video.thumbnailUrl = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjE4MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjE4MCIgZmlsbD0iI2Y1ZjVmNSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTk5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5WaWRlbyBUaHVtYm5haWw8L3RleHQ+PC9zdmc+';
      }
      
      return video;
    } catch (error) {
      console.error(`Error getting video ${videoId}:`, error);
      return null;
    }
  }
  
  // Increment view count for a video
  static async incrementViews(videoId: string): Promise<void> {
    try {
      await SupabaseService.incrementViews(videoId);
    } catch (error) {
      console.error(`Error incrementing views for video ${videoId}:`, error);
    }
  }
  
  // Get videos with pagination
  static async getVideosWithPagination(
    page: number = 1, 
    perPage: number = 12, 
    sortOption: SortOption = SortOption.NEWEST,
    searchQuery: string = ''
  ): Promise<{videos: Video[], totalPages: number}> {
    try {
      // Get all videos first (with sorting and filtering)
      const allVideos = await this.getAllVideos(sortOption, searchQuery);
      
      // Calculate total pages
      const totalPages = Math.ceil(allVideos.length / perPage);
      
      // Get videos for the requested page
      const startIndex = (page - 1) * perPage;
      const endIndex = startIndex + perPage;
      const paginatedVideos = allVideos.slice(startIndex, endIndex);
      
      return {
        videos: paginatedVideos,
        totalPages
      };
    } catch (error) {
      console.error('Error getting paginated videos:', error);
      throw error;
    }
  }
  
  // Get video file URL for streaming
  static async getVideoFileUrl(videoId: string): Promise<string | null> {
    try {
      // Get video details first
      const video = await this.getVideo(videoId);
      if (!video) {
        console.error(`Video ${videoId} not found`);
        return null;
      }
      
      // Verificando todos os possíveis campos onde o ID do vídeo pode estar
      const videoFileId = video.video_id || video.videoFileId;
      
      if (!videoFileId) {
        console.error(`Video ${videoId} has no video file ID (checked both video_id and videoFileId)`);
        return null;
      }
      
      // Get video file URL
      try {
        const fileUrl = await wasabiService.getFileUrl(videoFileId);
        return fileUrl;
      } catch (error) {
        console.error(`Error getting file URL:`, error);
        console.error(`Video File ID: ${videoFileId}`);
        return null;
      }
    } catch (error) {
      console.error(`Error getting video file URL for ${videoId}:`, error);
      return null;
    }
  }

  // Get direct file URL by Wasabi file key (for specific sources)
  static async getFileUrlById(fileId: string): Promise<string | null> {
    try {
      return await wasabiService.getFileUrl(fileId);
    } catch (error) {
      console.error('Error getting file URL by id:', error);
      return null;
    }
  }

  // Get thumbnail URL by Wasabi file key
  static async getThumbnailUrlById(fileId: string): Promise<string | null> {
    try {
      return await wasabiService.getThumbnailUrl(fileId);
    } catch (error) {
      console.error('Error getting thumbnail URL by id:', error);
      return null;
    }
  }

  // List video sources for a given video
  static async getVideoSources(videoId: string): Promise<Array<{ id: string; video_id: string; source_file_id: string; thumbnail_file_id?: string | null; position: number }>> {
    try {
      const sources = await SupabaseService.listVideoSources(videoId);
      return sources as any;
    } catch (error) {
      console.error('Error getting video sources:', error);
      return [];
    }
  }

  // Criar novo vídeo (para uso no admin)
  static async createVideo(videoData: {
    title: string;
    description: string;
    price: number;
    duration: number;
    videoFileId: string;
    thumbnailFileId: string;
    productLink?: string;
    is_free?: boolean;
  }): Promise<Video | null> {
    try {
      // Limpar cache antes da operação para evitar inconsistências
      this.clearCache();

      {
        const created = await SupabaseService.createVideo({
        title: videoData.title,
        description: videoData.description,
        price: videoData.price,
        duration: videoData.duration.toString(),
          video_file_id: videoData.videoFileId,
          thumbnail_file_id: videoData.thumbnailFileId,
          product_link: videoData.productLink || '',
          is_active: true,
          views: 0,
          thumbnail_url: null,
          is_free: !!videoData.is_free,
        } as any);

      await this.forceRefreshCache();
        return {
          $id: created.id,
          title: created.title,
          description: created.description || '',
          price: Number(created.price || 0),
          duration: created.duration || '00:00',
          videoFileId: created.video_file_id || undefined,
          video_id: created.video_file_id || undefined,
          thumbnailFileId: created.thumbnail_file_id || undefined,
          thumbnail_id: created.thumbnail_file_id || undefined,
          thumbnailUrl: created.thumbnail_url || undefined,
          isPurchased: false,
          createdAt: created.created_at,
          views: created.views || 0,
          product_link: created.product_link || '',
          is_free: !!created.is_free,
        };
      }
    } catch (error) {
      console.error('Error creating video:', error);
      return null;
    }
  }

  // Atualizar vídeo (para uso no admin)
  static async updateVideo(videoId: string, updates: {
    title?: string;
    description?: string;
    price?: number;
    duration?: number;
    videoFileId?: string;
    thumbnailFileId?: string;
    productLink?: string;
    is_free?: boolean;
  }): Promise<Video | null> {
    try {
      // Limpar cache antes da operação para evitar inconsistências
      this.clearCache();
      {
        const supaUpdates: any = {
          title: updates.title,
          description: updates.description,
          price: updates.price,
          duration: updates.duration ? updates.duration.toString() : undefined,
          video_file_id: updates.videoFileId,
          thumbnail_file_id: updates.thumbnailFileId,
          product_link: updates.productLink,
          is_free: updates.is_free,
        };
        // remove undefined keys
        Object.keys(supaUpdates).forEach(k => supaUpdates[k] === undefined && delete supaUpdates[k]);
        const row = await SupabaseService.updateVideo(videoId, supaUpdates);
        await this.forceRefreshCache();
        return {
          $id: row.id,
          title: row.title,
          description: row.description || '',
          price: Number(row.price || 0),
          duration: row.duration || '00:00',
          videoFileId: row.video_file_id || undefined,
          video_id: row.video_file_id || undefined,
          thumbnailFileId: row.thumbnail_file_id || undefined,
          thumbnail_id: row.thumbnail_file_id || undefined,
          thumbnailUrl: row.thumbnail_url || undefined,
          isPurchased: false,
          createdAt: row.created_at,
          views: row.views || 0,
          product_link: row.product_link || '',
          is_free: !!row.is_free,
        };
      }
    } catch (error) {
      console.error('Error updating video:', error);
      return null;
    }
  }

  // Deletar vídeo (para uso no admin)
  static async deleteVideo(videoId: string): Promise<boolean> {
    try {
      // Limpar cache antes da operação para evitar inconsistências
      this.clearCache();

      // Primeiro, obter os dados do vídeo para deletar os arquivos
      const video = await this.getVideo(videoId);
      if (video) {
        const videoFileId = video.video_id || video.videoFileId;
        const thumbnailFileId = video.thumbnail_id || video.thumbnailFileId;

        // Deletar arquivos do Wasabi
        if (videoFileId) {
          await wasabiService.deleteFile(videoFileId);
        }
        if (thumbnailFileId) {
          await wasabiService.deleteFile(thumbnailFileId);
        }
      }

      const success = await SupabaseService.deleteVideo(videoId);
      if (success) await this.forceRefreshCache();
      return success;
    } catch (error) {
      console.error('Error deleting video:', error);
      return false;
    }
  }
}
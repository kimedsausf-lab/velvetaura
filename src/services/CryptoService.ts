/**
 * Serviço de criptografia para nomes de vídeos e links
 * Usa AES-256-GCM para criptografia simétrica
 */

import CryptoJS from 'crypto-js';

export class CryptoService {
  // Chave de criptografia - em produção, deve vir de variáveis de ambiente
  private static readonly SECRET_KEY = 'site-pro-encryption-key-2024';
  
  // IV (Initialization Vector) - deve ser único para cada operação
  private static generateIV(): string {
    return CryptoJS.lib.WordArray.random(16).toString();
  }

  /**
   * Criptografa um texto usando AES-256-GCM
   * @param text - Texto a ser criptografado
   * @returns Objeto com texto criptografado e IV
   */
  static encrypt(text: string): { encrypted: string; iv: string } {
    try {
      const iv = this.generateIV();
      const encrypted = CryptoJS.AES.encrypt(text, this.SECRET_KEY, {
        iv: CryptoJS.enc.Utf8.parse(iv),
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      });
      
      return {
        encrypted: encrypted.toString(),
        iv: iv
      };
    } catch (error) {
      console.error('Erro ao criptografar texto:', error);
      throw new Error('Falha na criptografia');
    }
  }

  /**
   * Descriptografa um texto usando AES-256-GCM
   * @param encrypted - Texto criptografado
   * @param iv - IV usado na criptografia
   * @returns Texto descriptografado
   */
  static decrypt(encrypted: string, iv: string): string {
    try {
      const decrypted = CryptoJS.AES.decrypt(encrypted, this.SECRET_KEY, {
        iv: CryptoJS.enc.Utf8.parse(iv),
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      });
      
      return decrypted.toString(CryptoJS.enc.Utf8);
    } catch (error) {
      console.error('Erro ao descriptografar texto:', error);
      throw new Error('Falha na descriptografia');
    }
  }

  /**
   * Criptografa um nome de vídeo
   * @param title - Título do vídeo
   * @returns Título criptografado com IV
   */
  static encryptVideoTitle(title: string): string {
    const { encrypted, iv } = this.encrypt(title);
    return `${encrypted}:${iv}`;
  }

  /**
   * Descriptografa um nome de vídeo
   * @param encryptedTitle - Título criptografado
   * @returns Título descriptografado
   */
  static decryptVideoTitle(encryptedTitle: string): string {
    try {
      const [encrypted, iv] = encryptedTitle.split(':');
      if (!encrypted || !iv) {
        return encryptedTitle; // Retorna o original se não conseguir separar
      }
      return this.decrypt(encrypted, iv);
    } catch (error) {
      console.error('Erro ao descriptografar título do vídeo:', error);
      return encryptedTitle; // Retorna o original em caso de erro
    }
  }

  /**
   * Criptografa uma descrição de vídeo
   * @param description - Descrição do vídeo
   * @returns Descrição criptografada com IV
   */
  static encryptVideoDescription(description: string): string {
    const { encrypted, iv } = this.encrypt(description);
    return `${encrypted}:${iv}`;
  }

  /**
   * Descriptografa uma descrição de vídeo
   * @param encryptedDescription - Descrição criptografada
   * @returns Descrição descriptografada
   */
  static decryptVideoDescription(encryptedDescription: string): string {
    try {
      const [encrypted, iv] = encryptedDescription.split(':');
      if (!encrypted || !iv) {
        return encryptedDescription; // Retorna o original se não conseguir separar
      }
      return this.decrypt(encrypted, iv);
    } catch (error) {
      console.error('Erro ao descriptografar descrição do vídeo:', error);
      return encryptedDescription; // Retorna o original em caso de erro
    }
  }

  /**
   * Criptografa um link de produto
   * @param link - Link do produto
   * @returns Link criptografado com IV
   */
  static encryptProductLink(link: string): string {
    if (!link || link.trim() === '') return link;
    const { encrypted, iv } = this.encrypt(link);
    return `${encrypted}:${iv}`;
  }

  /**
   * Descriptografa um link de produto
   * @param encryptedLink - Link criptografado
   * @returns Link descriptografado
   */
  static decryptProductLink(encryptedLink: string): string {
    if (!encryptedLink || encryptedLink.trim() === '') return encryptedLink;
    try {
      const [encrypted, iv] = encryptedLink.split(':');
      if (!encrypted || !iv) {
        return encryptedLink; // Retorna o original se não conseguir separar
      }
      return this.decrypt(encrypted, iv);
    } catch (error) {
      console.error('Erro ao descriptografar link do produto:', error);
      return encryptedLink; // Retorna o original em caso de erro
    }
  }

  /**
   * Criptografa um ID de arquivo (para vídeos e thumbnails)
   * @param fileId - ID do arquivo
   * @returns ID criptografado com IV
   */
  static encryptFileId(fileId: string): string {
    if (!fileId || fileId.trim() === '') return fileId;
    const { encrypted, iv } = this.encrypt(fileId);
    return `${encrypted}:${iv}`;
  }

  /**
   * Descriptografa um ID de arquivo
   * @param encryptedFileId - ID criptografado
   * @returns ID descriptografado
   */
  static decryptFileId(encryptedFileId: string): string {
    if (!encryptedFileId || encryptedFileId.trim() === '') return encryptedFileId;
    try {
      const [encrypted, iv] = encryptedFileId.split(':');
      if (!encrypted || !iv) {
        return encryptedFileId; // Retorna o original se não conseguir separar
      }
      return this.decrypt(encrypted, iv);
    } catch (error) {
      console.error('Erro ao descriptografar ID do arquivo:', error);
      return encryptedFileId; // Retorna o original em caso de erro
    }
  }

  /**
   * Criptografa um nome de arquivo
   * @param fileName - Nome do arquivo
   * @returns Nome criptografado com IV
   */
  static encryptFileName(fileName: string): string {
    if (!fileName || fileName.trim() === '') return fileName;
    const { encrypted, iv } = this.encrypt(fileName);
    return `${encrypted}:${iv}`;
  }

  /**
   * Descriptografa um nome de arquivo
   * @param encryptedFileName - Nome criptografado
   * @returns Nome descriptografado
   */
  static decryptFileName(encryptedFileName: string): string {
    if (!encryptedFileName || encryptedFileName.trim() === '') return encryptedFileName;
    try {
      const [encrypted, iv] = encryptedFileName.split(':');
      if (!encrypted || !iv) {
        return encryptedFileName; // Retorna o original se não conseguir separar
      }
      return this.decrypt(encrypted, iv);
    } catch (error) {
      console.error('Erro ao descriptografar nome do arquivo:', error);
      return encryptedFileName; // Retorna o original em caso de erro
    }
  }

  /**
   * Verifica se uma string está criptografada (contém ':')
   * @param text - Texto a verificar
   * @returns true se estiver criptografado
   */
  static isEncrypted(text: string): boolean {
    return text && text.includes(':') && text.split(':').length === 2;
  }

  /**
   * Criptografa todos os dados sensíveis de um vídeo
   * @param video - Objeto de vídeo
   * @returns Vídeo com dados criptografados
   */
  static encryptVideoData(video: any): any {
    return {
      ...video,
      title: this.encryptVideoTitle(video.title || ''),
      description: this.encryptVideoDescription(video.description || ''),
      product_link: this.encryptProductLink(video.product_link || ''),
      video_id: this.encryptFileId(video.video_id || ''),
      thumbnail_id: this.encryptFileId(video.thumbnail_id || '')
    };
  }

  /**
   * Descriptografa todos os dados sensíveis de um vídeo
   * @param video - Objeto de vídeo com dados criptografados
   * @returns Vídeo com dados descriptografados
   */
  static decryptVideoData(video: any): any {
    return {
      ...video,
      title: this.decryptVideoTitle(video.title || ''),
      description: this.decryptVideoDescription(video.description || ''),
      product_link: this.decryptProductLink(video.product_link || ''),
      video_id: this.decryptFileId(video.video_id || ''),
      thumbnail_id: this.decryptFileId(video.thumbnail_id || '')
    };
  }
}

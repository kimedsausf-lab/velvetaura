import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseVideoRow {
  id: string;
  title: string;
  description: string | null;
  price: number;
  duration: string | null;
  video_file_id: string | null;
  thumbnail_file_id: string | null;
  thumbnail_url: string | null;
  product_link: string | null;
  is_active: boolean;
  views: number;
  created_at: string;
  is_free?: boolean; // Add is_free property for free content support
}

export interface Purchase {
  id: string;
  video_id: string | null;
  buyer_email: string;
  buyer_name: string | null;
  transaction_id: string;
  payment_method: 'paypal' | 'stripe' | 'crypto' | 'who';
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  video_title: string | null;
  product_link: string | null;
  metadata: any;
  created_at: string;
  updated_at: string;
}

export class SupabaseService {
  private static client: SupabaseClient | null = null;

  static isConfigured(): boolean {
    return !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
  }

  private static getClient(): SupabaseClient {
    if (!this.client) {
      const url = import.meta.env.VITE_SUPABASE_URL as string;
      const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      this.client = createClient(url, key, { auth: { persistSession: false } });
    }
    return this.client!;
  }

  // Videos
  static async listVideos(): Promise<SupabaseVideoRow[]> {
    const { data, error } = await this.getClient()
      .from('videos')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  // Video sources (multiple files per video/title)
  static async listVideoSources(videoId: string): Promise<Array<{ id: string; video_id: string; source_file_id: string; thumbnail_file_id: string | null; position: number }>> {
    const { data, error } = await this.getClient()
      .from('video_sources')
      .select('id,video_id,source_file_id,thumbnail_file_id,position')
      .eq('video_id', videoId)
      .order('position', { ascending: true });
    if (error) throw error;
    return (data || []) as any;
  }

  static async addVideoSource(videoId: string, sourceFileId: string, thumbnailFileId?: string, position: number = 1) {
    const { data, error } = await this.getClient()
      .from('video_sources')
      .insert({ video_id: videoId, source_file_id: sourceFileId, thumbnail_file_id: thumbnailFileId || null, position })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  static async updateVideoSource(id: string, updates: Partial<{ source_file_id: string; thumbnail_file_id: string | null; position: number }>) {
    const { data, error } = await this.getClient()
      .from('video_sources')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  static async deleteVideoSource(id: string) {
    const { error } = await this.getClient()
      .from('video_sources')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  }

  static async getVideo(id: string): Promise<SupabaseVideoRow | null> {
    const { data, error } = await this.getClient()
      .from('videos')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data ?? null;
  }

  static async incrementViews(id: string): Promise<void> {
    const { error } = await this.getClient()
      .rpc('increment', { table_name: 'videos', row_id: id, column_name: 'views' });
    // Fallback if RPC not created
    if (error) {
      await this.getClient()
        .from('videos')
        .update({ views: (await this.getVideo(id))?.views! + 1 })
        .eq('id', id);
    }
  }

  static async createVideo(payload: Partial<SupabaseVideoRow>): Promise<SupabaseVideoRow> {
    const { data, error } = await this.getClient()
      .from('videos')
      .insert(payload)
      .select('*')
      .single();
    if (error) throw error;
    return data as SupabaseVideoRow;
  }

  static async updateVideo(id: string, updates: Partial<SupabaseVideoRow>): Promise<SupabaseVideoRow> {
    const { data, error } = await this.getClient()
      .from('videos')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data as SupabaseVideoRow;
  }

  static async deleteVideo(id: string): Promise<boolean> {
    const { error } = await this.getClient().from('videos').delete().eq('id', id);
    if (error) throw error;
    return true;
  }

  // Relations
  static async getRelatedVideoIds(videoId: string): Promise<string[]> {
    const { data, error } = await this.getClient()
      .from('video_relations')
      .select('related_video_id')
      .eq('video_id', videoId);
    if (error) throw error;
    return (data || []).map(r => r.related_video_id);
  }

  static async setRelatedVideos(videoId: string, relatedIds: string[]): Promise<void> {
    const client = this.getClient();
    // Remove existing
    const { error: delErr } = await client.from('video_relations').delete().eq('video_id', videoId);
    if (delErr) throw delErr;
    if (relatedIds.length === 0) return;
    const rows = relatedIds.map(id => ({ video_id: videoId, related_video_id: id }));
    const { error } = await client.from('video_relations').insert(rows);
    if (error) throw error;
  }

  // Site config
  static async getSiteConfig(): Promise<any | null> {
    const { data, error } = await this.getClient()
      .from('site_config')
      .select('*')
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ?? null;
  }

  static async updateSiteConfig(updates: any): Promise<void> {
    const client = this.getClient();
    const existing = await this.getSiteConfig();
    if (existing) {
      const { error } = await client.from('site_config').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await client.from('site_config').insert({ ...updates, updated_at: new Date().toISOString() });
      if (error) throw error;
    }
  }

  // Users (admin)
  static async listUsers(): Promise<any[]> {
    const { data, error } = await this.getClient().from('users').select('id,email,name,role,created_at').order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  static async createUser(user: { email: string; name: string; role?: 'admin' | 'editor'; password_hash: string; }): Promise<void> {
    const { error } = await this.getClient().from('users').insert({ ...user, role: user.role || 'admin' });
    if (error) throw error;
  }

  static async updateUser(id: string, updates: Partial<{ email: string; name: string; role: 'admin'|'editor'; password_hash: string; }>): Promise<void> {
    const { error } = await this.getClient().from('users').update(updates).eq('id', id);
    if (error) throw error;
  }

  static async deleteUser(id: string): Promise<void> {
    const { error } = await this.getClient().from('users').delete().eq('id', id);
    if (error) throw error;
  }

  // Purchases

  static async createPurchase(purchase: Omit<Purchase, 'id' | 'created_at' | 'updated_at'>): Promise<Purchase> {
    const { data, error } = await this.getClient()
      .from('purchases')
      .insert(purchase)
      .select('*')
      .single();
    if (error) throw error;
    return data as Purchase;
  }

  static async listPurchases(limit: number = 100): Promise<Purchase[]> {
    const { data, error } = await this.getClient()
      .from('purchases')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  }

  static async getPurchaseByTransactionId(transactionId: string): Promise<Purchase | null> {
    const { data, error } = await this.getClient()
      .from('purchases')
      .select('*')
      .eq('transaction_id', transactionId)
      .maybeSingle();
    if (error) throw error;
    return data ?? null;
  }

  static async updatePurchaseStatus(id: string, status: Purchase['status']): Promise<void> {
    const { error } = await this.getClient()
      .from('purchases')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  }
}
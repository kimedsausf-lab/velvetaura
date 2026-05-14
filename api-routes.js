// API Routes para o servidor SQLite
import express from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import multer from 'multer';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Forçar leitura do .env
dotenv.config();

// Supabase server client
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } }) : null;

function requireSupabase(res) {
  if (!supabase) {
    res.status(500).json({ error: 'Supabase not configured on server' });
    return false;
  }
  return true;
}

/** Evita quebra de JS inline e XSS em URLs/texto injetados no checkout mascarado */
function escapeForJsPaypalCheckout(s) {
  return String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/`/g, '\\`')
    .replace(/\r/g, '')
    .replace(/\n/g, ' ');
}

function escapeHtmlPaypalCheckout(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

function getProvidedAdminToken(req) {
  const headerToken = (req.headers['x-admin-token'] || '').toString().trim();
  if (headerToken) return headerToken;
  const auth = (req.headers.authorization || '').toString().trim();
  if (auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }
  return '';
}

function requireAdminToken(req, res, next) {
  const expectedToken = (process.env.ADMIN_API_TOKEN || '').trim();
  // Backward-compatible: only enforce when token exists in env.
  if (!expectedToken) return next();
  const provided = getProvidedAdminToken(req);
  if (!provided || provided !== expectedToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return next();
}

function sanitizeSiteConfigForPublic(config) {
  const safeConfig = { ...(config || {}) };

  // Never expose server-side secrets to public clients.
  delete safeConfig.stripe_secret_key;
  delete safeConfig.who_api_key;
  if (safeConfig.email && typeof safeConfig.email === 'object') {
    safeConfig.email = {
      ...safeConfig.email,
      pass: ''
    };
  }

  const wasabi = safeConfig.wasabi_config;
  if (wasabi && typeof wasabi === 'object') {
    safeConfig.wasabi_config = {
      ...wasabi,
      accessKey: '',
      secretKey: '',
      access_key: '',
      secret_key: ''
    };
  }

  return safeConfig;
}

// Configurar multer para upload de arquivos
const upload = multer({ storage: multer.memoryStorage() });

// Caminhos dos arquivos JSON
const DATA_DIR = path.join(__dirname, 'data');
const VIDEOS_FILE = path.join(DATA_DIR, 'videos.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const SITE_CONFIG_FILE = path.join(DATA_DIR, 'site_config.json');
// Helper: load Wasabi config from ENV first, then Supabase site_config
async function getWasabiConfigFromServer() {
  // ENV takes precedence
  const envConfig = {
    accessKey: process.env.WASABI_ACCESS_KEY || process.env.VITE_WASABI_ACCESS_KEY,
    secretKey: process.env.WASABI_SECRET_KEY || process.env.VITE_WASABI_SECRET_KEY,
    region: process.env.WASABI_REGION || process.env.VITE_WASABI_REGION,
    bucket: process.env.WASABI_BUCKET || process.env.VITE_WASABI_BUCKET,
    endpoint: process.env.WASABI_ENDPOINT || process.env.VITE_WASABI_ENDPOINT,
  };
  if (envConfig.accessKey && envConfig.secretKey && envConfig.bucket && envConfig.region && envConfig.endpoint) {
    return envConfig;
  }
  // Fallback to Supabase site_config
  if (!supabase) return null;
  const { data: cfg, error: cfgErr } = await supabase.from('site_config').select('wasabi_config').limit(1).maybeSingle();
  if (cfgErr) throw cfgErr;
  const wasabiConfig = cfg?.wasabi_config || {};
  if (wasabiConfig && wasabiConfig.accessKey && wasabiConfig.secretKey && wasabiConfig.bucket && wasabiConfig.region && wasabiConfig.endpoint) {
    return wasabiConfig;
  }
  return null;
}


// Função para ler arquivo JSON
async function readJsonFile(filePath, defaultValue = []) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return defaultValue;
    }
    throw error;
  }
}

async function ensureDataDir() {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
}

// Função para escrever arquivo JSON com backup e validação
async function writeJsonFile(filePath, data) {
  try {
    // Criar backup do arquivo atual antes de escrever
    const backupPath = `${filePath}.backup`;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const timestampedBackup = `${filePath}.backup.${timestamp}`;
    
    try {
      // Criar backup com timestamp
      await fs.copyFile(filePath, timestampedBackup);
      
      // Manter apenas o backup mais recente
      await fs.copyFile(filePath, backupPath);
      
      // Limpar backups antigos (manter apenas os últimos 5)
      const backupDir = path.dirname(filePath);
      const files = await fs.readdir(backupDir);
      const backupFiles = files
        .filter(f => f.startsWith(path.basename(filePath) + '.backup.') && f !== path.basename(backupPath))
        .sort()
        .reverse();
      
      // Manter apenas os 5 backups mais recentes
      for (let i = 5; i < backupFiles.length; i++) {
        try {
          await fs.unlink(path.join(backupDir, backupFiles[i]));
        } catch (unlinkError) {
          console.warn('Could not delete old backup:', unlinkError.message);
        }
      }
    } catch (backupError) {
      // Se não conseguir fazer backup, continuar mesmo assim
      console.warn('Could not create backup file:', backupError.message);
    }

    // Escrever o arquivo com validação
    const jsonString = JSON.stringify(data, null, 2);
    await fs.writeFile(filePath, jsonString, 'utf8');
    
    // Verificar se o arquivo foi escrito corretamente
    const writtenData = await fs.readFile(filePath, 'utf8');
    const parsedData = JSON.parse(writtenData);
    
    if (parsedData.length !== data.length) {
      throw new Error('Data integrity check failed after write');
    }
    
    // console.log(`Successfully wrote ${data.length} videos to ${filePath}`);
  } catch (error) {
    console.error('Error writing JSON file:', error);
    throw error;
  }
}

// ===== VÍDEOS =====

// GET /api/videos/health - Verificar integridade dos dados
router.get('/videos/health', async (req, res) => {
  try {
    if (!requireSupabase(res)) return;
    const { data: videos, error } = await supabase.from('videos').select('*');
    if (error) throw error;
    
    // Verificar integridade básica
    const healthCheck = {
      totalVideos: videos.length,
      validVideos: 0,
      invalidVideos: [],
      lastBackup: null,
      dataIntegrity: 'OK'
    };
    
    // Verificar cada vídeo
    for (let i = 0; i < videos.length; i++) {
      const video = videos[i];
      const requiredFields = ['id', 'title', 'description', 'price', 'createdAt'];
      const missingFields = requiredFields.filter(field => !video[field]);
      
      if (missingFields.length === 0) {
        healthCheck.validVideos++;
      } else {
        healthCheck.invalidVideos.push({
          index: i,
          id: video.id || 'unknown',
          missingFields
        });
      }
    }
    
    // Verificar se há backup recente
    try {
      const backupPath = `${VIDEOS_FILE}.backup`;
      const backupStats = await fs.stat(backupPath);
      healthCheck.lastBackup = backupStats.mtime.toISOString();
    } catch (backupError) {
      healthCheck.lastBackup = 'No backup found';
    }
    
    if (healthCheck.invalidVideos.length > 0) {
      healthCheck.dataIntegrity = 'WARNING';
    }
    
    res.json(healthCheck);
  } catch (error) {
    console.error('Error checking videos health:', error);
    res.status(500).json({ 
      error: 'Failed to check videos health',
      details: error.message 
    });
  }
});

// GET /api/videos - Obter todos os vídeos
router.get('/videos', async (req, res) => {
  try {
    if (!requireSupabase(res)) return;
    const { data: videos, error } = await supabase
      .from('videos')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(videos);
  } catch (error) {
    console.error('Error fetching videos:', error);
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
});

// GET /api/videos/:id - Obter vídeo por ID
router.get('/videos/:id', async (req, res) => {
  try {
    if (!requireSupabase(res)) return;
    const { data: video, error } = await supabase
      .from('videos')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();
    if (error) throw error;
    
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    res.json(video);
  } catch (error) {
    console.error('Error fetching video:', error);
    res.status(500).json({ error: 'Failed to fetch video' });
  }
});

// POST /api/videos - Criar novo vídeo
router.post('/videos', requireAdminToken, async (req, res) => {
  try {
    if (!requireSupabase(res)) return;
    const newVideo = req.body;
    
    // Validar campos obrigatórios
    const requiredFields = ['title', 'description', 'price'];
    for (const field of requiredFields) {
      if (!newVideo[field]) {
        return res.status(400).json({ error: `Missing required field: ${field}` });
      }
    }
    
    const { data: createdVideo, error } = await supabase
      .from('videos')
      .insert({
        title: newVideo.title,
        description: newVideo.description,
        price: newVideo.price,
        duration: newVideo.duration || null,
        video_file_id: newVideo.videoFileId || newVideo.video_id || null,
        thumbnail_file_id: newVideo.thumbnailFileId || newVideo.thumbnail_id || null,
        product_link: newVideo.productLink || null,
        is_active: newVideo.isActive !== false,
      })
      .select('*')
      .single();
    if (error) throw error;
    
    // console.log(`Video ${createdVideo.id} created successfully`);
    res.status(201).json(createdVideo);
  } catch (error) {
    console.error('Error creating video:', error);
    res.status(500).json({ error: 'Failed to create video' });
  }
});

// PUT /api/videos/:id - Atualizar vídeo
router.put('/videos/:id', requireAdminToken, async (req, res) => {
  try {
    if (!requireSupabase(res)) return;
    const updates = req.body;
    
    // Filtrar apenas campos válidos para atualização
    const allowedFields = [
      'title', 'description', 'price', 'duration', 
      'videoFileId', 'thumbnailFileId', 'productLink', 
      'isActive', 'isPurchased'
    ];
    
    const validUpdates = {};
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        validUpdates[field] = updates[field];
      }
    }
    
    const supaUpdates = {
      title: validUpdates.title,
      description: validUpdates.description,
      price: validUpdates.price,
      duration: validUpdates.duration,
      video_file_id: validUpdates.videoFileId,
      thumbnail_file_id: validUpdates.thumbnailFileId,
      product_link: validUpdates.productLink,
      is_active: validUpdates.isActive,
    };
    Object.keys(supaUpdates).forEach(k => supaUpdates[k] === undefined && delete supaUpdates[k]);
    const { data: updatedVideo, error } = await supabase
      .from('videos')
      .update(supaUpdates)
      .eq('id', req.params.id)
      .select('*')
      .single();
    if (error) throw error;
    
    if (!updatedVideo) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    // console.log(`Video ${req.params.id} updated successfully`);
    res.json(updatedVideo);
  } catch (error) {
    console.error('Error updating video:', error);
    res.status(500).json({ error: 'Failed to update video' });
  }
});

// DELETE /api/videos/:id - Deletar vídeo
router.delete('/videos/:id', requireAdminToken, async (req, res) => {
  try {
    if (!requireSupabase(res)) return;
    const { error } = await supabase.from('videos').delete().eq('id', req.params.id);
    const success = !error;
    
    if (!success) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    res.json({ success: true, message: 'Video deleted successfully' });
  } catch (error) {
    console.error('Error deleting video:', error);
    res.status(500).json({ error: 'Failed to delete video' });
  }
});

// POST /api/videos/:id/views - Incrementar visualizações
router.post('/videos/:id/views', async (req, res) => {
  try {
    if (!requireSupabase(res)) return;
    // Try RPC first; fallback to update
    const { error: rpcErr } = await supabase.rpc('increment', { table_name: 'videos', row_id: req.params.id, column_name: 'views' });
    if (rpcErr) {
      const { data: current } = await supabase.from('videos').select('views').eq('id', req.params.id).maybeSingle();
      await supabase.from('videos').update({ views: (current?.views || 0) + 1 }).eq('id', req.params.id);
    }
    const { data: video } = await supabase.from('videos').select('views').eq('id', req.params.id).maybeSingle();
    
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    res.json({ views: video.views });
  } catch (error) {
    console.error('Error incrementing video views:', error);
    res.status(500).json({ error: 'Failed to increment views' });
  }
});

// ===== USUÁRIOS =====

// GET /api/users - Obter todos os usuários
router.get('/users', requireAdminToken, async (req, res) => {
  try {
    if (!requireSupabase(res)) return;
    const { data: users, error } = await supabase.from('users').select('id,email,name,role,created_at').order('created_at', { ascending: false });
    if (error) throw error;
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET /api/users/email/:email - Obter usuário por email (DEVE vir antes de /users/:id)
router.get('/users/email/:email', async (req, res) => {
  try {
    if (!requireSupabase(res)) return;
    
    const { data: user, error } = await supabase.from('users').select('*').eq('email', req.params.email).maybeSingle();
    
    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    console.error('Error fetching user by email:', error);
    res.status(500).json({ error: 'Failed to fetch user', details: error.message });
  }
});

// GET /api/users/:id - Obter usuário por ID (DEVE vir depois de /users/email/:email)
router.get('/users/:id', requireAdminToken, async (req, res) => {
  try {
    if (!requireSupabase(res)) return;
    const { data: user, error } = await supabase.from('users').select('*').eq('id', req.params.id).maybeSingle();
    if (error) throw error;
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// POST /api/users - Criar novo usuário
router.post('/users', requireAdminToken, async (req, res) => {
  try {
    if (!requireSupabase(res)) return;
    const { email, name, role = 'admin', password_hash } = req.body;
    const { data, error } = await supabase.from('users').insert({ email, name, role, password_hash }).select('*').single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// PUT /api/users/:id - Atualizar usuário
router.put('/users/:id', requireAdminToken, async (req, res) => {
  try {
    if (!requireSupabase(res)) return;
    const updates = req.body;
    
    const { data: updatedUser, error } = await supabase.from('users').update(updates).eq('id', req.params.id).select('*').single();
    
    if (error) {
      console.error('Supabase update error:', error);
      throw error;
    }
    
    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(updatedUser);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user', details: error.message });
  }
});

// DELETE /api/users/:id - Deletar usuário
router.delete('/users/:id', requireAdminToken, async (req, res) => {
  try {
    if (!requireSupabase(res)) return;
    const { error } = await supabase.from('users').delete().eq('id', req.params.id);
    const success = !error;
    
    if (!success) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// ===== SESSÕES =====

// GET /api/sessions/token/:token - Obter sessão por token
router.get('/sessions/token/:token', async (req, res) => {
  try {
    if (!requireSupabase(res)) return;
    const { data: session, error } = await supabase.from('sessions').select('*').eq('token', req.params.token).maybeSingle();
    if (error) throw error;
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    res.json(session);
  } catch (error) {
    console.error('Error fetching session by token:', error);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

// POST /api/sessions - Criar nova sessão
router.post('/sessions', async (req, res) => {
  try {
    const b = req.body || {};
    const payload = {
      user_id: b.userId || b.user_id,
      token: b.token,
      user_agent: b.userAgent || b.user_agent,
      expires_at: b.expiresAt || b.expires_at,
      is_active: typeof b.isActive === 'boolean' ? b.isActive : (b.is_active ?? true),
    };

    // Prefer Supabase when configured, otherwise fallback to local JSON (Render-friendly)
    if (supabase) {
      const { data, error } = await supabase.from('sessions').insert(payload).select('*').single();
      if (error) throw error;
      return res.status(201).json(data);
    }

    await ensureDataDir();
    const sessions = await readJsonFile(SESSIONS_FILE, []);
    const created = {
      id: String(Date.now()),
      ...payload,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    sessions.push(created);
    await writeJsonFile(SESSIONS_FILE, sessions);
    return res.status(201).json(created);
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// PUT /api/sessions/:id - Atualizar sessão
router.put('/sessions/:id', async (req, res) => {
  try {
    if (!requireSupabase(res)) return;
    const b = req.body || {};
    const updates = {
      user_id: b.userId ?? undefined,
      token: b.token ?? undefined,
      user_agent: (b.userAgent ?? b.user_agent) ?? undefined,
      expires_at: (b.expiresAt ?? b.expires_at) ?? undefined,
      is_active: (typeof b.isActive === 'boolean' ? b.isActive : b.is_active) ?? undefined,
    };
    Object.keys(updates).forEach(k => updates[k] === undefined && delete updates[k]);
    const { data: updatedSession, error } = await supabase.from('sessions').update(updates).eq('id', req.params.id).select('*').single();
    if (error) throw error;
    
    if (!updatedSession) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    res.json(updatedSession);
  } catch (error) {
    console.error('Error updating session:', error);
    res.status(500).json({ error: 'Failed to update session' });
  }
});

// DELETE /api/sessions/:id - Deletar sessão
router.delete('/sessions/:id', async (req, res) => {
  try {
    if (!requireSupabase(res)) return;
    const { error } = await supabase.from('sessions').delete().eq('id', req.params.id);
    const success = !error;
    
    if (!success) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

// Test endpoint
router.get('/test', (req, res) => {
  res.json({ message: 'Test endpoint working' });
});

// Limpar cache do frontend
router.post('/clear-cache', requireAdminToken, (req, res) => {
  try {
    // console.log('Cache clear requested');
    res.json({ 
      success: true, 
      message: 'Cache clear signal sent',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error clearing cache:', error);
    res.status(500).json({ 
      error: 'Failed to clear cache',
      details: error.message 
    });
  }
});

// Gerar URL assinada para arquivo no Wasabi
router.get('/signed-url/:fileId', async (req, res) => {
  // console.log('Signed URL endpoint called with fileId:', req.params.fileId);
  try {
    const { fileId } = req.params;
    
    if (!fileId) {
      return res.status(400).json({ error: 'File ID is required' });
    }

    // Block legacy metadata JSON usage — metadata is now in Supabase
    if (String(fileId).startsWith('metadata/')) {
      return res.status(410).json({ error: 'Legacy metadata file is no longer used. Metadata is stored in Supabase.' });
    }

    const wasabiConfig = await getWasabiConfigFromServer();

    if (!wasabiConfig || !wasabiConfig.accessKey || !wasabiConfig.secretKey) {
      return res.status(500).json({ error: 'Wasabi configuration not found' });
    }

    const s3Client = new S3Client({
      region: wasabiConfig.region,
      endpoint: wasabiConfig.endpoint,
      credentials: {
        accessKeyId: wasabiConfig.accessKey,
        secretAccessKey: wasabiConfig.secretKey,
      },
      forcePathStyle: true,
    });

    // Gerar URL assinada válida por 1 hora
    const command = new GetObjectCommand({
      Bucket: wasabiConfig.bucket,
      Key: fileId,
    });

    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    res.json({
      success: true,
      url: signedUrl,
      expiresIn: 3600
    });

  } catch (error) {
    console.error('Error generating signed URL:', error);
    res.status(500).json({ 
      error: 'Failed to generate signed URL',
      details: error.message 
    });
  }
});

// ===== CONFIGURAÇÕES DO SITE =====

// GET /api/site-config - Obter configurações do site
router.get('/site-config', async (req, res) => {
  try {
    if (!requireSupabase(res)) return;
    const { data: config, error } = await supabase.from('site_config').select('*').limit(1).maybeSingle();
    if (error) throw error;

    // Merge ENV overrides
    const envWasabi = {
      accessKey: process.env.WASABI_ACCESS_KEY || undefined,
      secretKey: process.env.WASABI_SECRET_KEY || undefined,
      region: process.env.WASABI_REGION || undefined,
      bucket: process.env.WASABI_BUCKET || undefined,
      endpoint: process.env.WASABI_ENDPOINT || undefined,
    };
    const merged = {
      ...(config || {}),
      stripe_publishable_key: process.env.STRIPE_PUBLISHABLE_KEY || (config?.stripe_publishable_key ?? ''),
      stripe_secret_key: process.env.STRIPE_SECRET_KEY || (config?.stripe_secret_key ?? ''),
      paypal_client_id: process.env.PAYPAL_CLIENT_ID || (config?.paypal_client_id ?? ''),
      site_name: config?.site_name ?? '',
      telegram_username: config?.telegram_username ?? '',
      video_list_title: config?.video_list_title ?? '',
      crypto: Array.isArray(config?.crypto) ? config.crypto : [],
      email: config?.email || {},
      wasabi_config: {
        ...(config?.wasabi_config || {}),
        ...Object.fromEntries(Object.entries(envWasabi).filter(([_, v]) => v))
      }
    };
    res.json(sanitizeSiteConfigForPublic(merged));
  } catch (error) {
    console.error('Error fetching site config:', error);
    res.status(500).json({ error: 'Failed to fetch site config' });
  }
});

// PUT /api/site-config - Atualizar configurações do site
router.put('/site-config', requireAdminToken, async (req, res) => {
  try {
    if (!requireSupabase(res)) return;
    const payload = { ...req.body } || {};
    // Normalize and validate wasabi_config when provided
    if (payload.wasabi_config) {
      const cfg = payload.wasabi_config;
      const accessKey = (cfg.accessKey || cfg.access_key || '').trim();
      const secretKey = (cfg.secretKey || cfg.secret_key || '').trim();
      const region = (cfg.region || '').trim();
      const bucket = (cfg.bucket || '').trim();
      const endpoint = (cfg.endpoint || '').trim();
      if (!accessKey || !secretKey || !region || !bucket || !endpoint) {
        return res.status(400).json({ error: 'All Wasabi fields are required: accessKey, secretKey, region, bucket, endpoint' });
      }
      payload.wasabi_config = { accessKey, secretKey, region, bucket, endpoint };
    }

    // Trim simple strings to avoid storing accidental whitespace
    const trimIfString = (v) => typeof v === 'string' ? v.trim() : v;
    payload.site_name = trimIfString(payload.site_name);
    payload.paypal_client_id = trimIfString(payload.paypal_client_id);
    payload.stripe_publishable_key = trimIfString(payload.stripe_publishable_key);
    payload.stripe_secret_key = trimIfString(payload.stripe_secret_key);
    payload.telegram_username = trimIfString(payload.telegram_username);
    payload.video_list_title = trimIfString(payload.video_list_title);

    const { data: existing } = await supabase.from('site_config').select('id').limit(1).maybeSingle();
    const write = existing
      ? supabase.from('site_config').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', existing.id).select('*').single()
      : supabase.from('site_config').insert({ ...payload, updated_at: new Date().toISOString() }).select('*').single();
    const { data, error } = await write;
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error updating site config:', error);
    res.status(500).json({ error: 'Failed to update site config' });
  }
});

// Criar sessão de checkout (PayJSR)
router.post('/create-checkout-session', async (req, res) => {
  try {
    const { amount, currency = 'usd', name, success_url, cancel_url } = req.body;
    
    if (!amount || !success_url || !cancel_url) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    if (!requireSupabase(res)) return;
    const { data: siteConfig, error: cfgErr } = await supabase.from('site_config').select('stripe_secret_key').limit(1).maybeSingle();
    if (cfgErr) throw cfgErr;
    const payjsrSecretKey = process.env.PAYJSR_SECRET_KEY || siteConfig?.stripe_secret_key;

    if (!payjsrSecretKey) {
      return res.status(500).json({ error: 'PayJSR secret key not configured' });
    }

    // Create a random product name from a list
    const productNames = [
      "Personal Development Ebook",
      "Financial Freedom Ebook", 
      "Digital Marketing Guide",
      "Health & Wellness Ebook",
      "Productivity Masterclass",
      "Mindfulness & Meditation Guide",
      "Entrepreneurship Blueprint",
      "Wellness Program",
      "Success Coaching",
      "Executive Mentoring",
      "Learning Resources",
      "Online Course Access",
      "Premium Content Subscription",
      "Digital Asset Package"
    ];
    
    const randomProductName = productNames[Math.floor(Math.random() * productNames.length)];

    const payload = {
      amount: Math.round(amount), // Amount already in cents
      currency: String(currency || 'usd').toUpperCase(),
      description: name || randomProductName,
      billing_type: 'one_time',
      mode: 'redirect',
      success_url,
      cancel_url
    };

    const requestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': payjsrSecretKey
      },
      body: JSON.stringify(payload)
    };

    // Prefer official endpoint, fallback for compatibility.
    let payjsrResponse = await fetch('https://api.payjsr.com/v1/payments', requestOptions);
    if (!payjsrResponse.ok && payjsrResponse.status === 404) {
      payjsrResponse = await fetch('https://api.payjsr.com/v1/api-create-payment', requestOptions);
    }

    const payjsrData = await payjsrResponse.json().catch(() => ({}));
    if (!payjsrResponse.ok) {
      return res.status(payjsrResponse.status).json({
        error: 'Failed to create PayJSR checkout session',
        details: payjsrData?.error || payjsrData?.message || 'Unknown PayJSR error'
      });
    }

    const normalized = payjsrData?.data || payjsrData;
    const sessionId = normalized?.payment_id || normalized?.session_id || normalized?.id;
    const checkoutUrl = normalized?.checkout_url || normalized?.url;
    if (!sessionId || !checkoutUrl) {
      return res.status(502).json({
        error: 'Invalid PayJSR response',
        details: 'Missing payment_id or checkout_url'
      });
    }

    res.json({
      success: true,
      sessionId,
      checkoutUrl,
    });

  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ 
      error: 'Failed to create checkout session',
      details: error.message 
    });
  }
});

// Criar sessão de checkout do Whop
router.post('/create-who-checkout', async (req, res) => {
  try {
    const { 
      amount, 
      currency = 'usd', 
      product_name, 
      success_url, 
      cancel_url
    } = req.body;
    
    if (!amount || !success_url || !cancel_url) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    if (!requireSupabase(res)) return;
    const { data: siteConfig, error: cfgErr } = await supabase.from('site_config').select('who_api_key').limit(1).maybeSingle();
    if (cfgErr) throw cfgErr;
    const whoApiKey = siteConfig?.who_api_key;

    if (!whoApiKey) {
      return res.status(500).json({ error: 'Whop API key not configured' });
    }

    // 🎯 SISTEMA AUTOMÁTICO DE MATCHING DE PREÇOS
    // Busca todos os planos disponíveis e encontra o que melhor combina com o preço do vídeo
    
    // console.log(`💰 Buscando plano para preço: $${amount/100} ${currency.toUpperCase()}`);
    
    // Buscar TODOS os planos disponíveis
    const plansResponse = await fetch('https://api.whop.com/api/v2/plans', {
      headers: {
        'Authorization': `Bearer ${whoApiKey}`,
      },
    });
    
    if (!plansResponse.ok) {
      throw new Error('Could not fetch plans. Please create plans in Whop dashboard first.');
    }
    
    const plansData = await plansResponse.json();
    
    if (!plansData.data || plansData.data.length === 0) {
      throw new Error('No plans found. Please create at least one plan in Whop dashboard first.');
    }
    
    // Encontrar o plano com o preço mais próximo do vídeo
    const videoPrice = amount / 100; // Converter de centavos para dólares
    let bestMatch = null;
    let smallestDifference = Infinity;
    
    // console.log(`📋 Analisando ${plansData.data.length} planos disponíveis:`);
    
    for (const plan of plansData.data) {
      const planPrice = parseFloat(plan.initial_price || plan.renewal_price || '0');
      const difference = Math.abs(planPrice - videoPrice);
      
      // console.log(`   - Plan ${plan.id}: $${planPrice} (diferença: $${difference.toFixed(2)})`);
      
      if (difference < smallestDifference) {
        smallestDifference = difference;
        bestMatch = plan;
      }
    }
    
    if (!bestMatch) {
      throw new Error('Could not find a suitable plan. Please create plans in Whop dashboard.');
    }
    
    // console.log(`✅ Plano selecionado: ${bestMatch.id} ($${parseFloat(bestMatch.initial_price || bestMatch.renewal_price)})`);
    // console.log(`   Diferença de preço: $${smallestDifference.toFixed(2)}`);
    
    const payload = {
      plan_id: bestMatch.id,
      success_url: success_url,
      cancel_url: cancel_url,
    };
    
    const response = await fetch('https://api.whop.com/api/v2/checkout_sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${whoApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText || `Whop API error: ${response.status}` };
      }
      console.error('Whop API error:', errorData);
      throw new Error(errorData.error || errorData.message || `Whop API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Whop checkout_sessions retorna: { id, purchase_url, plan_id, company_id }
    res.json({
      success: true,
      sessionId: data.id,
      checkout_url: data.purchase_url, // URL completa para redirecionamento
    });

  } catch (error) {
    console.error('Error creating Whop checkout session:', error);
    res.status(500).json({ 
      error: 'Failed to create checkout session',
      details: error.message 
    });
  }
});

// Endpoint para obter PayPal Client ID (usado pelo frontend)
router.get('/paypal-client-id', async (req, res) => {
  try {
    if (!requireSupabase(res)) return;
    const { data: siteConfig, error: cfgErr } = await supabase
      .from('site_config')
      .select('paypal_client_id')
      .limit(1)
      .maybeSingle();
    
    if (cfgErr) throw cfgErr;
    const paypalClientId = siteConfig?.paypal_client_id;

    if (!paypalClientId) {
      return res.status(404).json({ error: 'PayPal Client ID not configured' });
    }

    res.json({
      success: true,
      clientId: paypalClientId,
    });

  } catch (error) {
    console.error('Error fetching PayPal Client ID:', error);
    res.status(500).json({ 
      error: 'Failed to fetch PayPal Client ID',
      details: error.message 
    });
  }
});

// Página intermediária para checkout PayPal (mascara o referrer)
router.get('/paypal-checkout', async (req, res) => {
  try {
    const { amount, currency = 'USD', success_url, cancel_url, product_name, display_title } = req.query;

    if (!amount || !success_url || !cancel_url) {
      return res.status(400).send('Missing required parameters');
    }

    const amountNum = parseFloat(String(amount));
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      return res.status(400).send('Invalid amount');
    }

    if (!requireSupabase(res)) return;
    const { data: siteConfig, error: cfgErr } = await supabase
      .from('site_config')
      .select('paypal_client_id, site_name')
      .limit(1)
      .maybeSingle();

    if (cfgErr) throw cfgErr;
    const paypalClientId = siteConfig?.paypal_client_id;

    if (!paypalClientId) {
      return res.status(500).send('PayPal Client ID not configured');
    }

    const currencyRaw = String(currency || 'USD').toUpperCase();
    const currencyCode = /^[A-Z]{3}$/.test(currencyRaw) ? currencyRaw : 'USD';
    const paypalScriptUrl =
      'https://www.paypal.com/sdk/js?client-id=' +
      encodeURIComponent(paypalClientId) +
      '&currency=' +
      encodeURIComponent(currencyCode);

    const displayBrand = siteConfig?.site_name?.trim() || 'Secure Checkout';
    // PayPal API: só descrição genérica (product_name); nunca o título real
    const paypalDescription = String(product_name || 'Digital Product').trim() || 'Digital Product';
    const displayTitleRaw = String(display_title || '').trim();
    const hasDisplayTitle = displayTitleRaw.length > 0;
    const safeSuccess = escapeForJsPaypalCheckout(success_url);
    const safeCancel = escapeForJsPaypalCheckout(cancel_url);
    const safeName = escapeForJsPaypalCheckout(paypalDescription);
    const safeBrand = escapeForJsPaypalCheckout(displayBrand);
    const amountStr = amountNum.toFixed(2);
    const pageTitle = escapeHtmlPaypalCheckout(displayBrand + ' · Checkout');
    const htmlBrand = escapeHtmlPaypalCheckout(displayBrand);
    const htmlPaypalLabel = escapeHtmlPaypalCheckout(paypalDescription);
    const htmlProductFallback = htmlPaypalLabel;
    const htmlRealTitle = hasDisplayTitle ? escapeHtmlPaypalCheckout(displayTitleRaw) : '';
    const orderBlock = hasDisplayTitle
      ? `<p class="label">Your order</p>
        <p class="product product-real">${htmlRealTitle}</p>
        <div class="privacy-callout" role="status">
          <strong>Privacy</strong>
          <p class="privacy-p">PayPal only receives a generic description: <span class="paypal-label">“${htmlPaypalLabel}”</span>. Your PayPal receipt and card statement will <em>not</em> show the title above.</p>
        </div>`
      : `<p class="label">Your order</p>
        <p class="product">${htmlProductFallback}</p>
        <div class="privacy-callout" role="status">
          <strong>Privacy</strong>
          <p class="privacy-p">A generic description is sent to PayPal so your receipt and bank statement stay discreet.</p>
        </div>`;

    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('Permissions-Policy', 'interest-cohort=()');

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="referrer" content="no-referrer">
  <meta http-equiv="Referrer-Policy" content="no-referrer">
  <title>${pageTitle}</title>
  <style>
    :root {
      --bg-deep: #020617;
      --bg-mid: #030925;
      --paper: rgba(2, 8, 36, 0.94);
      --paper-border: rgba(129, 140, 248, 0.22);
      --primary: #ff3366;
      --accent: #00e5ff;
      --text: #e8e8e8;
      --muted: #9fb3ff;
      --muted2: rgba(148, 163, 184, 0.88);
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html { color-scheme: dark; }
    body {
      font-family: 'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, 'Roboto', 'Inter', sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 28px 18px;
      background: linear-gradient(180deg, var(--bg-mid) 0%, var(--bg-deep) 50%, #000 100%);
      color: var(--text);
      position: relative;
      overflow-x: hidden;
    }
    .ambient {
      pointer-events: none;
      position: fixed;
      inset: 0;
      background:
        radial-gradient(ellipse 90% 55% at 50% -25%, rgba(255, 51, 102, 0.2), transparent),
        radial-gradient(ellipse 55% 45% at 100% 40%, rgba(0, 229, 255, 0.07), transparent),
        radial-gradient(ellipse 45% 45% at 0% 85%, rgba(255, 51, 102, 0.09), transparent);
    }
    .wrap { width: 100%; max-width: 420px; position: relative; z-index: 1; }
    .card {
      position: relative;
      border-radius: 20px;
      background: var(--paper);
      border: 1px solid var(--paper-border);
      box-shadow:
        0 0 0 1px rgba(255, 51, 102, 0.07),
        0 24px 64px rgba(0, 0, 0, 0.55),
        0 0 100px rgba(255, 51, 102, 0.06);
      overflow: hidden;
      backdrop-filter: blur(12px);
    }
    .card-accent {
      height: 4px;
      width: 100%;
      background: linear-gradient(90deg, var(--primary), var(--accent));
    }
    .card-body { padding: 1.65rem 1.5rem 1.45rem; }
    .eyebrow {
      font-size: 0.68rem;
      font-weight: 700;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--accent);
      margin-bottom: 0.3rem;
    }
    .brand {
      font-size: 1.32rem;
      font-weight: 800;
      letter-spacing: -0.03em;
      color: var(--text);
      line-height: 1.2;
      margin-bottom: 0.65rem;
    }
    .badge {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.78rem;
      color: var(--muted2);
      margin-bottom: 0.95rem;
    }
    .divider {
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(129, 140, 248, 0.35), transparent);
      margin: 0.15rem 0 0.95rem;
    }
    .label {
      font-size: 0.62rem;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--muted);
      margin-bottom: 0.3rem;
    }
    .product {
      font-size: 0.9rem;
      color: var(--text);
      line-height: 1.45;
      margin-bottom: 0.8rem;
      opacity: 0.93;
    }
    .product-real { font-weight: 600; font-size: 0.95rem; margin-bottom: 0.45rem !important; }
    .privacy-callout {
      font-size: 0.72rem;
      line-height: 1.5;
      color: var(--muted2);
      background: rgba(0, 229, 255, 0.06);
      border: 1px solid rgba(0, 229, 255, 0.2);
      border-radius: 12px;
      padding: 0.7rem 0.85rem;
      margin-bottom: 0.85rem;
    }
    .privacy-callout strong {
      display: block;
      font-size: 0.65rem;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--accent);
      margin-bottom: 0.4rem;
    }
    .privacy-p { margin: 0; }
    .paypal-label {
      font-family: ui-monospace, "Cascadia Code", Consolas, monospace;
      font-size: 0.88em;
      color: var(--muted);
      word-break: break-word;
    }
    .amount {
      font-size: 2.1rem;
      font-weight: 800;
      letter-spacing: -0.04em;
      color: var(--primary);
      margin-bottom: 1.25rem;
      text-shadow: 0 0 48px rgba(255, 51, 102, 0.22);
    }
    .amount .cur-symbol { font-size: 1.25rem; opacity: 0.88; margin-right: 1px; }
    .amount .cur-code {
      font-size: 0.82rem;
      font-weight: 700;
      color: var(--muted);
      margin-left: 6px;
      letter-spacing: 0.04em;
    }
    .pp-wrap {
      background: rgba(255, 255, 255, 0.035);
      border: 1px solid rgba(148, 163, 255, 0.14);
      border-radius: 16px;
      padding: 1rem 0.95rem 1.05rem;
    }
    .pp-label {
      font-size: 0.76rem;
      font-weight: 600;
      color: var(--muted2);
      text-align: center;
      margin-bottom: 0.6rem;
    }
    #paypal-button-container { min-height: 48px; }
    #loading {
      text-align: center;
      font-size: 0.78rem;
      color: var(--muted);
      margin-top: 0.7rem;
    }
    .fine {
      font-size: 0.66rem;
      line-height: 1.5;
      color: var(--muted2);
      text-align: center;
      margin-top: 0.55rem;
    }
  </style>
  <script>
    (function () {
      try {
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, '', window.location.href);
        }
        sessionStorage.removeItem('origin');
        localStorage.removeItem('origin');
      } catch (e) {}
    })();
  </script>
  <script src="${paypalScriptUrl}" data-namespace="paypal_sdk" referrerpolicy="no-referrer"></script>
</head>
<body>
  <div class="ambient" aria-hidden="true"></div>
  <div class="wrap">
    <article class="card">
      <div class="card-accent" aria-hidden="true"></div>
      <div class="card-body">
        <p class="eyebrow">Checkout</p>
        <h1 class="brand">${htmlBrand}</h1>
        <p class="badge"><span aria-hidden="true">🔒</span> Encrypted session · PayPal secure payment</p>
        <div class="divider" aria-hidden="true"></div>
        ${orderBlock}
        <p class="amount"><span class="cur-symbol">$</span>${amountStr}<span class="cur-code">${escapeHtmlPaypalCheckout(currencyCode)}</span></p>
        <div class="pp-wrap">
          <p class="pp-label">Pay with PayPal or card</p>
          <div id="paypal-button-container"></div>
        </div>
        <p class="fine" id="loading">Loading secure payment…</p>
        <p class="fine">After paying you will return to the site to finish your order.</p>
      </div>
    </article>
  </div>
  <script>
    (function () {
      var SUCCESS_URL = '${safeSuccess}';
      var CANCEL_URL = '${safeCancel}';
      function initPayPal() {
        if (typeof paypal_sdk === 'undefined' || !paypal_sdk.Buttons) {
          setTimeout(initPayPal, 100);
          return;
        }
        var el = document.getElementById('loading');
        if (el) el.style.display = 'none';
        paypal_sdk.Buttons({
          createOrder: function (data, actions) {
            return actions.order.create({
              purchase_units: [{
                description: '${safeName}',
                amount: { value: '${amountStr}', currency_code: '${currencyCode}' }
              }],
              application_context: {
                brand_name: '${safeBrand}',
                landing_page: 'NO_PREFERENCE',
                user_action: 'PAY_NOW'
              }
            });
          },
          onApprove: function (data, actions) {
            return actions.order.capture().then(function (details) {
              var sep = SUCCESS_URL.indexOf('?') >= 0 ? '&' : '?';
              var email = (details.payer && details.payer.email_address)
                ? encodeURIComponent(details.payer.email_address) : '';
              var firstName = (details.payer && details.payer.name && details.payer.name.given_name)
                ? details.payer.name.given_name : '';
              var lastName = (details.payer && details.payer.name && details.payer.name.surname)
                ? details.payer.name.surname : '';
              var fullName = encodeURIComponent((firstName + ' ' + lastName).trim());
              var payerId = (details.payer && details.payer.payer_id) ? details.payer.payer_id : '';
              window.location.replace(
                SUCCESS_URL + sep + 'order_id=' + encodeURIComponent(data.orderID) +
                '&payer_id=' + encodeURIComponent(payerId) +
                '&buyer_email=' + email + '&buyer_name=' + fullName
              );
            });
          },
          onCancel: function () {
            window.location.replace(CANCEL_URL);
          },
          onError: function (err) {
            console.error('PayPal error:', err);
            alert('Payment could not be completed. Please try again.');
          },
          style: { layout: 'vertical', color: 'blue', shape: 'pill', label: 'paypal', height: 48 }
        }).render('#paypal-button-container');
      }
      initPayPal();
    })();
  </script>
</body>
</html>`);
  } catch (error) {
    console.error('Error loading PayPal checkout:', error);
    res.status(500).send('Failed to load PayPal checkout');
  }
});

// Deletar arquivo do Wasabi
router.delete('/delete-file/:fileId', requireAdminToken, async (req, res) => {
  // console.log('Delete file endpoint called with fileId:', req.params.fileId);
  try {
    const { fileId } = req.params;
    
    if (!fileId) {
      return res.status(400).json({ error: 'File ID is required' });
    }

    const wasabiConfig = await getWasabiConfigFromServer();
    if (!wasabiConfig) {
      console.error('Wasabi configuration not found for delete operation');
      return res.status(500).json({ error: 'Wasabi configuration not found' });
    }
    
    // console.log('Wasabi config for delete:', {
    //   region: wasabiConfig.region,
    //   bucket: wasabiConfig.bucket,
    //   endpoint: wasabiConfig.endpoint,
    //   hasAccessKey: !!wasabiConfig.accessKey,
    //   hasSecretKey: !!wasabiConfig.secretKey
    // });

    const s3Client = new S3Client({
      region: wasabiConfig.region,
      endpoint: wasabiConfig.endpoint,
      credentials: {
        accessKeyId: wasabiConfig.accessKey,
        secretAccessKey: wasabiConfig.secretKey,
      },
      forcePathStyle: true,
    });

    // Deletar arquivo do Wasabi
    const deleteCommand = new DeleteObjectCommand({
      Bucket: wasabiConfig.bucket,
      Key: fileId,
    });

    await s3Client.send(deleteCommand);

    res.json({
      success: true,
      message: 'File deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting file from Wasabi:', error);
    res.status(500).json({ 
      error: 'Failed to delete file',
      details: error.message 
    });
  }
});

// ===== BACKUP E RESTAURAÇÃO =====
// Removido - usando Wasabi diretamente como fonte principal

// Verificar status do backup
router.get('/backup/status', requireAdminToken, async (req, res) => {
  try {
    const wasabiConfig = await getWasabiConfigFromServer();

    if (!wasabiConfig || !wasabiConfig.accessKey || !wasabiConfig.secretKey) {
      return res.status(500).json({ error: 'Wasabi configuration not found' });
    }

    const s3Client = new S3Client({
      region: wasabiConfig.region,
      endpoint: wasabiConfig.endpoint,
      credentials: {
        accessKeyId: wasabiConfig.accessKey,
        secretAccessKey: wasabiConfig.secretKey,
      },
      forcePathStyle: true,
    });

    // Verificar se existe o arquivo de metadados principal
    const metadataKey = `metadata/videosplus-data.json`;
    const getMetadataCommand = new GetObjectCommand({
      Bucket: wasabiConfig.bucket,
      Key: metadataKey,
    });

    try {
      const metadataResponse = await s3Client.send(getMetadataCommand);
      const metadataData = JSON.parse(await metadataResponse.Body.transformToString());
      
      res.json({
        hasBackup: true,
        message: 'Metadata file exists',
        metadataKey: metadataKey
      });

    } catch (error) {
      res.json({
        hasBackup: false,
        message: 'No metadata file found'
      });
    }

  } catch (error) {
    console.error('Erro ao verificar status do backup:', error);
    res.status(500).json({ 
      error: 'Failed to check backup status',
      details: error.message 
    });
  }
});

// Upload de metadados para Wasabi
router.post('/upload/metadata', requireAdminToken, upload.single('file'), async (req, res) => {
  // console.log('Metadata upload endpoint called');
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const wasabiConfig = await getWasabiConfigFromServer();

    if (!wasabiConfig || !wasabiConfig.accessKey || !wasabiConfig.secretKey) {
      return res.status(500).json({ error: 'Wasabi configuration not found' });
    }

    // Configurar cliente S3 para Wasabi
    const s3Client = new S3Client({
      region: wasabiConfig.region,
      endpoint: wasabiConfig.endpoint,
      credentials: {
        accessKeyId: wasabiConfig.accessKey,
        secretAccessKey: wasabiConfig.secretKey,
      },
      forcePathStyle: true,
    });

    // Upload para o Wasabi
    const uploadCommand = new PutObjectCommand({
      Bucket: wasabiConfig.bucket,
      Key: 'metadata/videosplus-data.json',
      Body: req.file.buffer,
      ContentType: 'application/json',
    });

    await s3Client.send(uploadCommand);

    res.json({
      success: true,
      message: 'Metadata uploaded successfully'
    });

  } catch (error) {
    console.error('Error uploading metadata to Wasabi:', error);
    res.status(500).json({ 
      error: 'Failed to upload metadata',
      details: error.message 
    });
  }
});

// Upload de arquivo para Wasabi
router.post('/upload/:folder', requireAdminToken, upload.single('file'), async (req, res) => {
  // console.log(`Upload endpoint called: /upload/${req.params.folder}`);
  try {
    const { folder } = req.params; // 'videos' ou 'thumbnails'
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    // console.log('Incoming file:', {
    //   originalname: req.file.originalname,
    //   mimetype: req.file.mimetype,
    //   size: req.file.size,
    // });

    const wasabiConfig = await getWasabiConfigFromServer();

    if (!wasabiConfig || !wasabiConfig.accessKey || !wasabiConfig.secretKey) {
      return res.status(500).json({ error: 'Wasabi configuration not found' });
    }

    // Configurar cliente S3 para Wasabi
    const s3Client = new S3Client({
      region: wasabiConfig.region,
      endpoint: wasabiConfig.endpoint,
      credentials: {
        accessKeyId: wasabiConfig.accessKey,
        secretAccessKey: wasabiConfig.secretKey,
      },
      forcePathStyle: true, // Necessário para Wasabi
    });

    // Gerar nome único para o arquivo
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const fileExtension = req.file.originalname.split('.').pop() || '';
    const fileName = `${folder}/${timestamp}_${randomId}.${fileExtension}`;
    // console.log('Generated Wasabi key:', fileName);

    // Fazer upload para o Wasabi
    const uploadCommand = new PutObjectCommand({
      Bucket: wasabiConfig.bucket,
      Key: fileName,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    });

    await s3Client.send(uploadCommand);
    // console.log('Wasabi upload success:', fileName);

    // URL do arquivo
    const fileUrl = `https://${wasabiConfig.bucket}.s3.${wasabiConfig.region}.wasabisys.com/${fileName}`;

    res.json({
      success: true,
      fileId: fileName,
      url: fileUrl,
    });

  } catch (error) {
    console.error('Error uploading file to Wasabi:', error);
    res.status(500).json({ 
      error: 'Failed to upload file',
      details: error.message 
    });
  }
});


export default router;

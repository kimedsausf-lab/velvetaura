import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRoutes from './api-routes.js';
// SQLite removido - usando Wasabi como fonte principal

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Caminhos dos arquivos JSON
const DATA_DIR = path.join(__dirname, 'data');
const VIDEOS_FILE = path.join(DATA_DIR, 'videos.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const SITE_CONFIG_FILE = path.join(DATA_DIR, 'site_config.json');

// Garantir que o diretório de dados existe
async function ensureDataDir() {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
    console.log('Data directory created');
  }
}

// Função para ler arquivo JSON
async function readJsonFile(filePath, defaultValue = []) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log(`File ${filePath} not found, using default value`);
      return defaultValue;
    }
    console.error(`Error reading ${filePath}:`, error);
    throw error;
  }
}

// Função para escrever arquivo JSON
async function writeJsonFile(filePath, data) {
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    console.log(`Successfully wrote to ${filePath}`);
  } catch (error) {
    console.error(`Error writing to ${filePath}:`, error);
    throw error;
  }
}

// Inicializar arquivos de dados
async function initializeDataFiles() {
  await ensureDataDir();
  
  // Inicializar arquivos se não existirem
  const files = [
    { path: VIDEOS_FILE, default: [] },
    { path: USERS_FILE, default: [] },
    { path: SESSIONS_FILE, default: [] },
    { path: SITE_CONFIG_FILE, default: {
      siteName: 'VideosPlus',
      paypalClientId: '',
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
        accessKey: process.env.VITE_WASABI_ACCESS_KEY || '',
        secretKey: process.env.VITE_WASABI_SECRET_KEY || '',
        region: process.env.VITE_WASABI_REGION || '',
        bucket: process.env.VITE_WASABI_BUCKET || '',
        endpoint: process.env.VITE_WASABI_ENDPOINT || ''
      }
    }}
  ];

  for (const file of files) {
    try {
      await fs.access(file.path);
    } catch {
      await writeJsonFile(file.path, file.default);
      console.log(`Created ${file.path}`);
    }
  }
}

// API primeiro (antes de static/catch-all) para evitar /api/* devolver index.html
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    port: PORT
  });
});

// CORS somente para API (não aplicar em /assets, css, etc.)
app.use('/api', cors({
  origin: true, // allow all origins
  credentials: true
}));
app.use('/api', apiRoutes);

// Depois: servir estáticos e SPA fallback
app.use(express.static(path.join(__dirname, 'dist')));
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
} else {
  // Em desenvolvimento, redirecionar para o servidor do Vite (exceto para rotas da API)
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
      res.status(404).json({ error: 'API endpoint not found' });
    } else {
      res.redirect('http://localhost:5173' + req.originalUrl);
    }
  });
}

// Inicializar e iniciar servidor
async function startServer() {
  try {
    console.log('Iniciando servidor: metadados no Supabase, armazenamento no Wasabi');
    // Removido: inicialização de arquivos JSON locais e criação de metadata no Wasabi
    
    // Iniciar servidor primeiro
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`API available at http://localhost:${PORT}/api`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      
      console.log('Metadados: Supabase | Arquivos: Wasabi');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
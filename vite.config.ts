import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load environment variables from .env files
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    optimizeDeps: {
      include: ['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled']
    },
    define: {
      // Make env variables available to the client-side code
      'process.env.VITE_STRIPE_PUBLISHABLE_KEY': JSON.stringify(env.VITE_STRIPE_PUBLISHABLE_KEY),
      'process.env.VITE_API_URL': JSON.stringify(env.VITE_API_URL || ''),
      'process.env.VITE_APPWRITE_PROJECT_ID': JSON.stringify(env.VITE_APPWRITE_PROJECT_ID || ''),
      'process.env.VITE_APPWRITE_API_KEY': JSON.stringify(env.VITE_APPWRITE_API_KEY || ''),
      // Wasabi configuration
      'import.meta.env.VITE_WASABI_ACCESS_KEY': JSON.stringify(env.VITE_WASABI_ACCESS_KEY || ''),
      'import.meta.env.VITE_WASABI_SECRET_KEY': JSON.stringify(env.VITE_WASABI_SECRET_KEY || ''),
      'import.meta.env.VITE_WASABI_REGION': JSON.stringify(env.VITE_WASABI_REGION || ''),
      'import.meta.env.VITE_WASABI_BUCKET': JSON.stringify(env.VITE_WASABI_BUCKET || ''),
      'import.meta.env.VITE_WASABI_ENDPOINT': JSON.stringify(env.VITE_WASABI_ENDPOINT || ''),
    },
    server: {
      // Configure a middleware for handling API requests during development
      proxy: {
        '/api': {
          target: `http://localhost:${env.PORT || 3000}`, // Mesmo PORT do server.js (.env ou 3000)
          changeOrigin: true,
          secure: false,
          configure: (proxy, _options) => {
            proxy.on('error', (err, _req, _res) => {
              console.log('proxy error', err);
            });
          }
        }
      },
      historyApiFallback: true
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: false,
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
        },
        external: [],
        output: {
          manualChunks: (id) => {
            if (id.includes('node_modules')) {
              if (id.includes('@mui/')) return 'mui';
              if (id.includes('react')) return 'vendor';
              return 'vendor';
            }
          }
        }
      }
    }
  }
})

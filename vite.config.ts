import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
// FIX: Import 'process' from 'process' module to provide correct type definitions and fix 'cwd' does not exist error.
import * as process from 'process';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
    ],

    server: {
      host: '0.0.0.0',
      hmr: {
        // Explicitly set the client port for HMR WebSocket connections.
        // This is necessary in some sandboxed environments where location.port might be undefined.
        clientPort: 5173,
      },
      proxy: {
        // Proxy requests from /api to the backend server
        '/api': {
          target: 'http://127.0.0.1:4000',
          changeOrigin: true,
        }
      },
    }
  };
});
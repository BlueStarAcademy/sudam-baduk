import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
// FIX: Import 'process' to provide types for 'process.cwd()'
import process from 'process';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    define: {
    },
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
          target: 'http://localhost:4000',
          changeOrigin: true,
        }
      },
    }
  };
});
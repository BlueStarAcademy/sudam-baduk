import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
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
});
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const api = 'http://localhost:4000';

export default defineConfig({
  root: 'client',
  plugins: [react()],
  build: { outDir: '../dist', emptyOutDir: true, chunkSizeWarningLimit: 1500 },
  server: {
    host: true, // reachable from her phone on the same Wi-Fi
    proxy: { '/api': api, '/media': api, '/thumbs': api, '/song': api, '/music-files': api },
  },
});

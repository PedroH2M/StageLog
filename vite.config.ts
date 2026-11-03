import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-firebase': [
            'firebase/app',
            'firebase/auth',
            'firebase/firestore',
          ],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api/setlistfm': {
        target: 'https://api.setlist.fm/rest/1.0',
        changeOrigin: true,
        headers: {
          'User-Agent': 'StageLogMobile/1.0.0 ( contact@stagelog.app )',
        },
        rewrite: (path) => path.replace(/^\/api\/setlistfm/, ''),
      },
      '/api/musicbrainz': {
        target: 'https://musicbrainz.org/ws/2',
        changeOrigin: true,
        headers: {
          'User-Agent': 'StageLogMobile/1.0.0 ( contact@stagelog.app )',
        },
        rewrite: (path) => path.replace(/^\/api\/musicbrainz/, ''),
      },
      '/api/bandsintown': {
        target: 'https://rest.bandsintown.com',
        changeOrigin: true,
        headers: {
          'User-Agent': 'StageLogMobile/1.0.0',
        },
        rewrite: (path) => path.replace(/^\/api\/bandsintown/, ''),
      },
    },
  },
});

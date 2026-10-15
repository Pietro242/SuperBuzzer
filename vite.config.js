import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    allowedHosts: [
      'gioco.elettronicaimpianti.it',
      '.elettronicaimpianti.it',
      'localhost',
      '127.0.0.1',
    ],
    proxy: {
      '/ws': {
        target: 'ws://127.0.0.1:3001',
        ws: true,
        rewriteWsOrigin: true,
      },
      '/image': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
    },
  },
})

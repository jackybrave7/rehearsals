import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Явный IPv4: на Windows Vite иногда слушает только [::1], браузер идёт на 127.0.0.1
    host: '127.0.0.1',
    // Фиксированный порт: 3000 и 3003 — разные localStorage в браузере
    port: 3003,
    strictPort: true,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 3003,
    strictPort: true,
  },
});

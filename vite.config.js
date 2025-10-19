import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  // Menetapkan root dari aplikasi frontend kita
  root: 'client',

  server: {
    // Port untuk Vite Dev Server
    port: 5173,
    proxy: {
      // Mengarahkan request API ke backend server Express
      '/api': {
        target: 'http://localhost:3000', // Sesuaikan dengan port backend Anda
        changeOrigin: true,
      },
    },
  },

  build: {
    // Menghasilkan build output ke direktori 'dist' di root proyek
    outDir: '../dist',
    emptyOutDir: true, // Membersihkan 'dist' sebelum setiap build
  },
});
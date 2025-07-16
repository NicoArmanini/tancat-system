// frontend/vite.config.js
import { defineConfig } from 'vite'

export default defineConfig({
  // Puerto del servidor de desarrollo
  server: {
    port: 5173,
    open: true, // Abre automáticamente en el navegador
    cors: true,
    proxy: {
      // Proxy para las llamadas al backend
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      }
    }
  },
  
  // Configuración de build
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true
  },
  
  // Configuración de preview
  preview: {
    port: 5173,
    open: true
  },
  
  // Base path para producción
  base: './',
  
  // Configuración de archivos estáticos
  publicDir: 'public'
})
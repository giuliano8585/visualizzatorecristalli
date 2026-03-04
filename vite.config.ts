import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    target: 'es2020',
    // Chunk splitting per ridurre bundle size
    rollupOptions: {
      output: {
        manualChunks: {
          'three-core': ['three'],
          'r3f': ['@react-three/fiber', '@react-three/drei'],
          'postfx': ['@react-three/postprocessing', 'postprocessing'],
          'react': ['react', 'react-dom'],
        }
      }
    },
    chunkSizeWarningLimit: 2000,
  },
  optimizeDeps: {
    include: ['three', '@react-three/fiber', '@react-three/drei'],
  },
  worker: {
    format: 'es',
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
  }
})

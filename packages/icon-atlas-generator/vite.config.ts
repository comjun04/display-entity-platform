import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  root: './src/frontend',
  envDir: '../../',
  server: {
    port: 5183,
  },
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 600, // 600kB
  },
})

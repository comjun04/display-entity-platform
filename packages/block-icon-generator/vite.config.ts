import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  root: './src/frontend',
  server: {
    port: 5183,
  },
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
  },
})

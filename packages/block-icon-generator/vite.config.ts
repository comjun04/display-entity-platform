import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  root: './src/frontend',
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
  },
})

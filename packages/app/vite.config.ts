import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react-swc'
import { execSync } from 'child_process'
import { resolve } from 'path'
import { visualizer } from 'rollup-plugin-visualizer'
import { PluginOption, defineConfig } from 'vite'

import packageJson from './package.json'

const isDevelopmentMode = process.env.NODE_ENV === 'development'

const commitHash = execSync('git rev-parse --short HEAD').toString()

const plugins: PluginOption[] = [react(), tailwindcss()]
if (process.env.GENERATE_BUILD_STATS) {
  plugins.push(
    visualizer({
      gzipSize: true,
      brotliSize: true,
    }),
  )
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins,
  resolve: {
    alias: [
      {
        find: '@',
        replacement: resolve(__dirname, 'src'),
      },
    ],
  },
  define: {
    __VERSION__: JSON.stringify(packageJson.version),
    __COMMIT_HASH__: JSON.stringify(commitHash),
    __IS_DEV__: isDevelopmentMode,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          threejs: ['three'],
          r3f: ['@react-three/fiber', '@react-three/drei'],
        },
      },
    },
    chunkSizeWarningLimit: 750, // 750 KB
  },
})

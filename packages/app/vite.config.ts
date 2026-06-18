import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
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
  server: {
    watch: {
      ignored: ['**/public/locales/**/*'],
    },
  },
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
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'react',
              test: /node_modules\/(react|react-dom)\//,
            },
            {
              name: 'three',
              test: /node_modules\/three\//,
            },
            {
              name: 'r3f',
              test: /node_modules\/@react-three\//,
            },
          ],
        },
      },
    },
    chunkSizeWarningLimit: 750, // 750 KB
  },
})

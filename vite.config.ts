import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        // Electron Main process entry
        entry: 'src/main.ts',
      },
      {
        // Electron Preload process entry
        entry: 'src/preload.ts',
        onstart(options) {
          options.reload()
        },
        vite: {
          build: {
            lib: {
              entry: 'src/preload.ts',
              formats: ['cjs'],
              fileName: () => 'preload.js',
            },
          },
        },
      },
    ]),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})

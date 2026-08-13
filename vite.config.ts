import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { ogPagesPlugin, ogWritePlugin } from './vite-plugin-og-pages'

const rootDir = dirname(fileURLToPath(import.meta.url))

// Relative base so the built site works on GitHub Pages, Cloudflare Pages,
// and other static hosts (including project subpaths).
export default defineConfig({
  plugins: [react(), ogWritePlugin(), ogPagesPlugin()],
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      input: {
        main: resolve(rootDir, 'index.html'),
        ogCapture: resolve(rootDir, 'og-capture.html'),
      },
    },
  },
})

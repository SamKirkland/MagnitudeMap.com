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
  server: {
    watch: {
      // Writing capture JPEGs must not lock or reload the dev server.
      ignored: ['**/public/og/**'],
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // The app needs WebGL2, so every browser that can run it speaks ES2022.
    // Vite's default ('modules') still downlevels a few things Lighthouse flags
    // as legacy-javascript.
    target: 'es2022',
    rollupOptions: {
      input: {
        main: resolve(rootDir, 'index.html'),
        ogCapture: resolve(rootDir, 'og-capture.html'),
      },
    },
  },
})

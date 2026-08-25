import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const rootDir = dirname(fileURLToPath(import.meta.url))

// Node-side bundle used only by `scripts/prerender.mjs`. Kept separate from
// vite.config.ts so the client build's multi-page input does not apply here.
export default defineConfig({
  plugins: [react()],
  build: {
    ssr: resolve(rootDir, 'src/entry-server.tsx'),
    outDir: 'dist-ssr',
    emptyOutDir: true,
    minify: false,
    rollupOptions: {
      output: { entryFileNames: 'entry-server.js' },
    },
  },
})

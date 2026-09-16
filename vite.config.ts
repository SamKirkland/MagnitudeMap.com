import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { ogPagesPlugin, ogWritePlugin } from './vite-plugin-og-pages'

const rootDir = dirname(fileURLToPath(import.meta.url))

/**
 * Nearest ancestor that owns a `node_modules`, or null if this root does.
 *
 * The dev server may only serve files under its own root, and a git worktree
 * does not get its own dependencies — `.claude/worktrees/<name>` resolves
 * imports against the main checkout's `node_modules`, three levels up and
 * outside the root. The app imports its Draco decoder from there
 * (`@babylonjs/core/assets/Draco/...?url`) and every model in the catalog is
 * Draco-compressed, so without this the dev server in a worktree refuses the
 * decoder and no model loads.
 */
function dependencyRoot(from: string): string | null {
  let dir = from
  for (;;) {
    if (existsSync(resolve(dir, 'node_modules'))) return dir === from ? null : dir
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

const externalDependencyRoot = dependencyRoot(rootDir)

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
    ...(externalDependencyRoot
      ? { fs: { allow: [rootDir, externalDependencyRoot] } }
      : {}),
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

import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/**
 * The dev server tells the page it is in Boxity's LOCAL environment, the way Boxity
 * tells the pages it serves which environment they're in. Dev server only (apply:
 * 'serve'): a production build is told by Boxity itself, and runs on prod when nothing
 * tells it anything. Never decide the environment from the page's own address.
 */
const LOCAL_BOXITY_ENV = {
  env: 'local',
  apiUrl: 'http://localhost:4000',
  playUrl: 'http://localhost:2567',
  portalUrl: 'http://localhost:3000',
  staticUrl: 'https://static.bloxity.io',
}

function boxityLocalEnv() {
  return {
    name: 'boxity-local-env',
    apply: 'serve',
    transformIndexHtml: () => [{ tag: 'script', children: `window.BLOXITY_ENV = ${JSON.stringify(LOCAL_BOXITY_ENV)};`, injectTo: 'head-prepend' }],
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), boxityLocalEnv()],
  resolve: {
    alias: {
      // Game data and formulas shared with the Colyseus server (../shared).
      '@shared': fileURLToPath(new URL('../shared/index.js', import.meta.url)),
    },
  },
  server: {
    // ../shared lives outside the client root.
    fs: { allow: ['..'] },
  },
  build: {
    target: 'es2022',
    // Inline nothing big; hashed assets cache well.
    assetsInlineLimit: 4096,
    rolldownOptions: {
      output: {
        // Libraries change rarely: keep them in their own long-cached chunks.
        codeSplitting: {
          groups: [
            { name: 'three', test: /node_modules[\\/]three[\\/]/, priority: 30 },
            { name: 'net', test: /node_modules[\\/]@colyseus[\\/]/, priority: 25 },
            { name: 'react-vendor', test: /node_modules[\\/](react|react-dom|scheduler|@react-three|zustand|its-fine|suspend-react|@fontsource)[\\/]/, priority: 20 },
          ],
        },
      },
    },
  },
})

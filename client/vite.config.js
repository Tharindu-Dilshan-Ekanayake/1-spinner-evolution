import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
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

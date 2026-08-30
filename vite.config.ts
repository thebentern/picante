import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' so the same build works at thebentern.github.io/picante/ and behind
// a custom domain, with no rebuild when the URL changes. The app has no router,
// so relative asset URLs are safe.
export default defineConfig({
  base: './',
  plugins: [react()],
  preview: {
    port: 4173,
    strictPort: true,
    host: '127.0.0.1',
  },
  build: {
    target: 'es2022',
    // Fonts must stay as separate files, not data URIs: the rasterizer fetches
    // them same-origin and embeds them itself.
    assetsInlineLimit: 0,
  },
})

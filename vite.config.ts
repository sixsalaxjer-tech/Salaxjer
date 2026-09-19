import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Family Expense PWA — Vite build configuration.
// Service worker strategy follows spec section 14.2:
// App Shell = Cache First, Static Assets = Stale While Revalidate, Local Data = IndexedDB only (never cached by the SW).
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt', // user-controlled update prompt (spec 27: "Offline Cache เก่า" risk mitigation)
      includeAssets: ['favicon.svg', 'icons/*.svg'],
      manifest: {
        // TO_CONFIRM: APP_NAME — see src/shared/constants/config.ts
        name: 'Family Expense PWA',
        short_name: 'FamilyExpense',
        description: 'แอปบันทึกค่าใช้จ่ายครอบครัวแบบออฟไลน์',
        theme_color: '#0f766e',
        background_color: '#f8fafc',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        lang: 'th',
        icons: [
          { src: 'icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icons/icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icons/icon-maskable-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' }
        ]
      },
      workbox: {
        // App shell (build output) is precached automatically (Cache First by default for precache).
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        runtimeCaching: [
          {
            // Static assets fetched at runtime (fonts, etc.) — Stale While Revalidate.
            urlPattern: ({ request }) =>
              request.destination === 'style' ||
              request.destination === 'script' ||
              request.destination === 'font' ||
              request.destination === 'image',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'static-assets' }
          }
        ],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true
      },
      devOptions: {
        enabled: false
      }
    })
  ],
  resolve: {
    alias: {
      '@': '/src'
    }
  },
  build: {
    sourcemap: true
  }
})

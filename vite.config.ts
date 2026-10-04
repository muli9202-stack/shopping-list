import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// base: './' keeps every asset path relative, so the same build works on
// GitHub Pages (served from /<repo>/) and on any other static host.
export default defineConfig({
  base: './',
  define: { __BUILD__: JSON.stringify(new Date().toISOString().slice(0, 16)) },
  build: {
    // Kept out of the deployed files (no sourceMappingURL); used to read error reports.
    sourcemap: 'hidden',
    // Two apps from one build: the shopping list at the root and the
    // kitchen app (videos, recipes, Shabbat/holiday table) under /kitchen/.
    rolldownOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        kitchen: fileURLToPath(new URL('./kitchen/index.html', import.meta.url)),
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'רשימת קניות',
        short_name: 'קניות',
        description: 'רשימת קניות חכמה לנטו חיסכון ויש חסד',
        lang: 'he',
        dir: 'rtl',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f4f6f8',
        theme_color: '#0f766e',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff,woff2,webmanifest,json}'],
        // Offline navigation inside /kitchen/ must not fall back to the shopping list page.
        navigateFallbackDenylist: [/\/kitchen\//],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        // The kitchen app's built-in videos and recipes (~15 MB) are cached on first
        // use and refreshed in the background, instead of with every install.
        globIgnores: ['**/seed-*.json'],
        runtimeCaching: [
          {
            urlPattern: /\/kitchen\/seed-(videos|recipes)\.json$/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'kitchen-seeds' },
          },
        ],
      },
    }),
  ],
});

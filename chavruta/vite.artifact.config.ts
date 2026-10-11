import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Single-bundle build of the chavruta for a claude.ai Artifact; scripts/build-artifact.mjs
// inlines the output into one page.
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: './',
  publicDir: false,
  plugins: [react()],
  define: { 'import.meta.env.VITE_ARTIFACT': JSON.stringify('1') },
  build: {
    outDir: fileURLToPath(new URL('../dist-artifact/chavruta', import.meta.url)),
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    modulePreload: false,
    rolldownOptions: { input: fileURLToPath(new URL('./artifact.html', import.meta.url)) },
  },
});

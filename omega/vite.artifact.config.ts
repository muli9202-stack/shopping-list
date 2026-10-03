import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// Single-bundle build of the Omega game for a claude.ai Artifact; see
// scripts/build-artifact.mjs, which inlines the output into one page.
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: './',
  publicDir: false,
  build: {
    outDir: fileURLToPath(new URL('../dist-artifact/omega', import.meta.url)),
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    modulePreload: false,
    rolldownOptions: { input: fileURLToPath(new URL('./index.html', import.meta.url)) },
  },
});

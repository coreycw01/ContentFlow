import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Build variant that emits one self-contained bundle, for sharing the app as a
 * single HTML file. `npm run build` remains the normal multi-chunk build.
 */
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist-singlefile',
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        entryFileNames: 'app.js',
        assetFileNames: 'app.[ext]',
      },
    },
  },
});

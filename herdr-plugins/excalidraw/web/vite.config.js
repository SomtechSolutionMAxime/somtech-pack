import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Tout est inliné dans dist/ : le plugin doit fonctionner hors-ligne, sans CDN.
  base: './',
  build: { outDir: 'dist', emptyOutDir: true },
  define: { 'process.env.IS_PREACT': JSON.stringify('false') },
})

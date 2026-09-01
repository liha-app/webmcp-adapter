import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5274, strictPort: true },
  preview: { port: 5274, strictPort: true },
  build: { outDir: 'dist', emptyOutDir: true },
});

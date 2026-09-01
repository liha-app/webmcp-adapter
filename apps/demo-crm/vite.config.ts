import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The demo app is served on a fixed origin so the Liha adapter's `origins`
// list (and the extension's host permissions) stay narrow and predictable.
export default defineConfig({
  plugins: [react()],
  server: { port: 5273, strictPort: true },
  preview: { port: 5273, strictPort: true },
  build: { outDir: 'dist', emptyOutDir: true },
});

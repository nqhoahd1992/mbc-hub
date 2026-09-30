import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the built bundle can be dropped on any host or subpath.
  base: './',
  server: {
    open: true,
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
  },
});

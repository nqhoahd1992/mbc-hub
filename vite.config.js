import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the built bundle can be dropped on any host or subpath.
  base: './',
  server: {
    open: true,
  },
  build: {
    target: 'es2022',
    // Explicit: a leftover bundle in dist/assets is how a stale file ends up
    // being served or inlined.
    emptyOutDir: true,
    chunkSizeWarningLimit: 900,
  },
});

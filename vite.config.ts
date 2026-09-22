import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: { assetsInlineLimit: 100_000_000, cssCodeSplit: false, outDir: 'dist' },
  server: { port: 5178, strictPort: true },
  test: { environment: 'node' },
} as any);

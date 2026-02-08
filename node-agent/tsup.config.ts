import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  outDir: 'dist-bundle',
  bundle: true,
  platform: 'node',
  target: 'node20',
  sourcemap: false,
  clean: true,
  noExternal: [],
});

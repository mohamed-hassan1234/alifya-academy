import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/server.ts',
    'src/scripts/seed.ts',
    'src/scripts/verify-seed.ts',
    'src/scripts/create-admin.ts',
  ],
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  // Bundle the workspace contracts package; keep real npm dependencies external.
  noExternal: ['@alifya/shared'],
});

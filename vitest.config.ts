import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Native tsconfig path resolution (Vite 5+ / Vitest 4+)
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['node_modules', '.next', 'src/lib/wasm-bridge'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/lib/**/*.ts', 'src/store/**/*.ts', 'src/types/**/*.ts'],
      exclude: ['src/lib/wasm-bridge/**', 'src/lib/worker/**'],
    },
  },
});

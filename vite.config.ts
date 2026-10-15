import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages: https://hunjeh404.github.io/sudoku/
export default defineConfig({
  base: process.env.VITE_BASE ?? '/sudoku/',
  plugins: [react()],
  build: { target: 'es2020', chunkSizeWarningLimit: 600 },
  test: { include: ['tests/**/*.test.ts'] },
} as any);

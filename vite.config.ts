import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  base: '/math-learning-beta/',
  plugins: [react()],
  build: {
    // Packaged Node runtimes can reject Lightning CSS's native binary.
    // CSS minification is nonessential for this Priority 0 local build.
    cssMinify: false,
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
  },
})

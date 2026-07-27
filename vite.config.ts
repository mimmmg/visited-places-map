import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // 카카오 콘솔에 등록해 둔 개발 도메인과 일치시킨다 (PRD §8.1)
    port: 5173,
  },
})

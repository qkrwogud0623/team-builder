import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/team-builder/', // [!!!] 이게 제일 중요합니다 [!!!]
})
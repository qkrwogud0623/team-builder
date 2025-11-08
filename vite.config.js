// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/team-builder/', // [!!!] GHPages용 하위 폴더 이름으로 수정 [!!!]
})
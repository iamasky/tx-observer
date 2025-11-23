import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/tx-observer/',  // 設定部署的基礎路徑
  server: {
    port: 5173, // 在這裡將 5173 改為您想要的 Port，例如 3000
  },
})
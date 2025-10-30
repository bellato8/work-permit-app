import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Proxy API calls เพื่อแก้ไข CORS ใน local development
      '/api': {
        target: 'https://proxylistadmins-uwuxgoi2fa-as.a.run.app',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        secure: true,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('🔴 Proxy error:', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('🔵 Proxying:', req.method, req.url);
          });
        },
      }
    }
  },
  define: {
    // ให้แน่ใจว่า environment variables ถูกโหลด
    __DEV__: JSON.stringify(process.env.NODE_ENV === 'development'),
  },
  build: {
    // ให้ build แสดง environment info
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
})

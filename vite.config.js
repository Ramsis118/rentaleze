import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In development the site runs on :5173 and the API on :3001.
// The proxy forwards API and photo requests so the site can call /api directly.
const API_TARGET = process.env.API_TARGET || 'http://localhost:3001'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': API_TARGET,
      '/uploads': API_TARGET,
    },
  },
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const repoBasePath = '/wigglegram-app/'

// https://vite.dev/config/
export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? repoBasePath : '/',
  plugins: [react()],
})

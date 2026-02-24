import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // For GitHub Pages: set base to repo name
  // e.g. base: '/tight-margins/' if repo is github.com/you/tight-margins
  // For custom domain or root deploy, use '/'
  base: '/tight-margins/',
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
  },
})

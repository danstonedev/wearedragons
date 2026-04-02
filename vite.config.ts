import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 2600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return

          if (id.includes('@react-three/drei')) {
            return 'react-three-drei'
          }

          if (id.includes('@react-three/fiber')) {
            return 'react-three-fiber'
          }

          if (id.includes('@react-three/rapier') || id.includes('@dimforge/rapier3d-compat')) {
            return 'react-three-rapier'
          }

          if (id.includes('three/examples') || id.includes('three-stdlib')) {
            return 'three-helpers'
          }

          if (id.includes('/three/')) {
            return 'three-core'
          }

          if (id.includes('/react/') || id.includes('/react-dom/')) {
            return 'react-vendor'
          }
        },
      },
    },
  },
})

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/osm-tiles': {
        target: 'https://tile.openstreetmap.jp',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/osm-tiles/, '/styles/osm-bright-ja'),
      },
    },
  },
})

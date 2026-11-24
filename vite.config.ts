import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' keeps the build working under https://<user>.github.io/what-to-do/ and any other path.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5183 },
})

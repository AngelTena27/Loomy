import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'

export default defineConfig({
  server: {
    watch: {
      ignored: ['**/routeTree.gen.ts'],
    },
  },
  plugins: [
    tanstackStart({
      client: {
        entry: './src/client.tsx',
      },
    }),
  ],
})

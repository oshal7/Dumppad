import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          notch: resolve(__dirname, 'src/preload/notch.js'),
          library: resolve(__dirname, 'src/preload/library.js'),
        },
      },
    },
  },
  renderer: {
    plugins: [react()],
    build: {
      rollupOptions: {
        input: {
          notch: resolve(__dirname, 'src/renderer/notch.html'),
          library: resolve(__dirname, 'src/renderer/library.html'),
        },
      },
    },
  },
})

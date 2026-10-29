import path from "path"

import tailwindcss from "@tailwindcss/vite"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 2048,
  },
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:18800",
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            proxyReq.setHeader("Origin", "http://127.0.0.1:18800")
            proxyReq.setHeader("Referer", "http://127.0.0.1:18800/")
            proxyReq.setHeader("Sec-Fetch-Site", "same-origin")
          })
        },
      },
      "/pico/media": {
        target: "http://127.0.0.1:18800",
        changeOrigin: true,
      },
      "/pico/ws": {
        target: "ws://127.0.0.1:18800",
        ws: true,
      },
    },
  },
})

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
      "/edge-tts-proxy": {
        target: "https://speech.platform.bing.com",
        ws: true,
        changeOrigin: true,
        secure: true,
        headers: {
          Origin: "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0",
          Pragma: "no-cache",
          "Cache-Control": "no-cache",
        },
        rewrite: (p) => p.replace(/^\/edge-tts-proxy/, ""),
        configure: (proxy) => {
          proxy.on("proxyReqWs", (proxyReq) => {
            proxyReq.setHeader(
              "Origin",
              "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
            )
            proxyReq.setHeader(
              "User-Agent",
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0",
            )
            proxyReq.setHeader("Pragma", "no-cache")
            proxyReq.setHeader("Cache-Control", "no-cache")
          })
        },
      },
    },
  },
})

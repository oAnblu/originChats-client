import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

export default defineConfig(() => ({
  base: "/",
  plugins: [preact()],
  publicDir: "public",
  build: {
    outDir: "dist",
    sourcemap: true,
  },
  server: {
    port: 3000,
    open: true,
  },
  resolve: {
    alias: {
      "@": "/src",
      react: "preact/compat",
      "react-dom": "preact/compat",
    },
  },
}));

import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return;
          }

          if (id.includes("recharts")) {
            return "charts";
          }

          if (id.includes("xlsx")) {
            return "xlsx-tools";
          }

          if (id.includes("jspdf-autotable")) {
            return "pdf-autotable";
          }

          if (id.includes("jspdf")) {
            return "jspdf-core";
          }

          if (
            id.includes("html2canvas") ||
            id.includes("dompurify") ||
            id.includes("canvg") ||
            id.includes("svg-pathdata")
          ) {
            return "pdf-helpers";
          }

          if (
            id.includes("@tanstack/react-query") ||
            id.includes("react-router-dom") ||
            id.includes("react-dom") ||
            id.includes("react/")
          ) {
            return "react-vendor";
          }

          if (id.includes("@supabase")) {
            return "supabase-vendor";
          }

          return "vendor";
        },
      },
    },
  },
});

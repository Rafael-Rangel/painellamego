import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173
  },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("chart.js") || id.includes("react-chartjs-2")) return "charts";
            if (id.includes("@supabase")) return "supabase";
            if (id.includes("react-router")) return "router";
            if (id.includes("react-dom")) return "react";
            if (id.includes("react-icons")) return "icons";
          }
          return undefined;
        }
      }
    }
  }
});

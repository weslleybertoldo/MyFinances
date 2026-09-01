import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import pkg from "./package.json";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: "/",
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    // Dev local com as functions da Vercel: o proxy do `vercel dev` devolve 404
    // pra requests com Sec-Fetch-Dest (modulos do proprio Vite), entao rodamos o
    // Vite direto e apontamos /api pro `vercel dev` em outra porta:
    //   API_PROXY_TARGET=http://localhost:5191 npx vite --port 5190
    // DEV_ALLOWED_HOST libera um host de tunel (ex. cloudflared) pra testar no celular.
    // /sb replica em dev o rewrite do vercel.json (fallback de DNS do supabase client).
    proxy: {
      ...(process.env.API_PROXY_TARGET
        ? { "/api": { target: process.env.API_PROXY_TARGET, changeOrigin: true } }
        : {}),
      "/sb": {
        target: "https://aoyaftmgpaxbbmdihkxn.supabase.co",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/sb/, ""),
      },
    },
    allowedHosts: process.env.DEV_ALLOWED_HOST ? [process.env.DEV_ALLOWED_HOST] : undefined,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("@supabase")) return "supabase";
          if (id.includes("@radix-ui")) return "radix";
          if (id.includes("recharts") || id.includes("d3-")) return "charts";
          if (id.includes("@capacitor")) return "capacitor";
          if (id.includes("date-fns") || id.includes("react-day-picker")) return "dates";
          if (id.includes("@tanstack")) return "tanstack";
          if (id.includes("lucide-react")) return "icons";
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
}));

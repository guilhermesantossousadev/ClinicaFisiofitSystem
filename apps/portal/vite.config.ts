import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/sistema/",
  plugins: [react()],
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  build: { outDir: "dist", sourcemap: false },
  server: { host: "::", port: 3000, strictPort: true },
});

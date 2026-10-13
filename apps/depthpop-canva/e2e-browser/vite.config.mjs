import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: path.resolve(here, ".."),
  resolve: {
    alias: {
      "@canva/app-hooks": path.resolve(here, "mocks/app-hooks.ts"),
      "@canva/asset": path.resolve(here, "mocks/asset.ts"),
      "@canva/design": path.resolve(here, "mocks/design.ts"),
      "@canva/user": path.resolve(here, "mocks/user.ts"),
    },
  },
  define: {
    BACKEND_HOST: JSON.stringify("http://127.0.0.1:8081"),
  },
  server: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
  },
});

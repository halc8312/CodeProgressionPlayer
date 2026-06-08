import { defineConfig } from "vite";

// GitHub Pages serves the project at https://<user>.github.io/<repo>/.
// In CI we set the base to the repo name; locally it stays at "/".
const base = process.env.GITHUB_ACTIONS ? "/CodeProgressionPlayer/" : "/";

export default defineConfig({
  base,
  build: {
    target: "es2020",
    outDir: "dist",
  },
});

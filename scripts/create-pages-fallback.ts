import fs from "node:fs";
import path from "node:path";
import { root } from "./lib";

const outputDirectory = path.join(root, "dist");
const indexPath = path.join(outputDirectory, "index.html");

if (!fs.existsSync(indexPath)) {
  throw new Error("dist/index.html is missing. Run this script after the Vite build.");
}

// GitHub Pages serves 404.html for client-side routes. Returning the same app
// shell preserves the requested URL so React Router can resolve the question.
fs.rmSync(path.join(outputDirectory, "data/internal"), { recursive: true, force: true });
fs.copyFileSync(indexPath, path.join(outputDirectory, "404.html"));
fs.writeFileSync(path.join(outputDirectory, ".nojekyll"), "");

console.log("Created public-only GitHub Pages artifact, SPA fallback, and .nojekyll marker.");

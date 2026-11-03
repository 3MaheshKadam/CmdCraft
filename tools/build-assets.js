#!/usr/bin/env node
/**
 * Writes sw-assets.json: the list of site files the service worker pre-caches for offline use.
 * Run it before a deploy (npm run build:assets). It lists only what is actually published
 * (the same exclusions as .vercelignore), so the offline copy matches the live site.
 */
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
const SKIP_DIRS = new Set([".git", ".vercel", "node_modules", "tests", "tools", ".github", "docs"]);
const SKIP_FILES = new Set(["sw-assets.json", "package.json", "package-lock.json", "firebase.json", "firestore.rules", ".env.local", "README.md", "END_GOAL.md", ".gitignore", ".vercelignore"]);
const EXT = /\.(html|js|css|json|svg|png|webmanifest)$/i;
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(path.join(dir, e.name)); continue; }
    const rel = path.relative(root, path.join(dir, e.name)).split(path.sep).join("/");
    if (SKIP_FILES.has(e.name) && !rel.includes("/")) continue;
    if (EXT.test(e.name)) files.push(rel);
  }
})(root);
files.sort();
// CDN files that must be available offline from the first visit (keep in sync with the <script>/<link> tags that use them)
const external = [
  "https://cdn.tailwindcss.com",
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css",
  "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/sql-wasm.js",
  "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/sql-wasm.wasm"
];
fs.writeFileSync(path.join(root, "sw-assets.json"), JSON.stringify({ files, external }, null, 2) + "\n");
console.log("sw-assets.json: " + files.length + " files");

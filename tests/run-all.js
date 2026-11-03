#!/usr/bin/env node
/**
 * Runs every test file as its own process. A test fails if it exits non-zero or prints a line starting with FAIL.
 * Usage: node tests/run-all.js [filter]     (filter = part of a file name)
 */
const { spawnSync } = require("child_process");
const fs = require("fs"), path = require("path");
const only = process.argv[2];
const jobs = [];
fs.readdirSync(__dirname).filter(f => f.endsWith(".test.js")).sort().forEach(f => {
  if (only && !f.includes(only)) return;
  jobs.push({ name: f, file: f, env: {} });
  if (f === "review-mode.test.js") jobs.push({ name: f + " (deep link ?topic=)", file: f, env: { TEST_URL: "http://localhost/?topic=permissions" } });
});
let failed = 0;
for (const j of jobs) {
  const t = Date.now();
  const r = spawnSync(process.execPath, [path.join(__dirname, j.file)], { env: Object.assign({}, process.env, j.env), encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 10 * 60 * 1000 });
  const out = (r.stdout || "") + (r.stderr || "");
  const bad = out.split("\n").filter(l => /^FAIL/.test(l));
  const ok = r.status === 0 && bad.length === 0;
  console.log((ok ? "ok    " : "FAIL  ") + j.name + "  (" + ((Date.now() - t) / 1000).toFixed(1) + "s)");
  if (!ok) { failed++; console.log(bad.slice(0, 10).join("\n") || out.split("\n").slice(-15).join("\n")); }
}
console.log("\n" + (jobs.length - failed) + "/" + jobs.length + " test files passed");
process.exit(failed ? 1 : 0);

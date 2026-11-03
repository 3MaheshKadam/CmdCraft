#!/usr/bin/env node
/**
 * Optional browser test (needs Chrome): serves the site locally, checks that the service worker registers and precaches,
 * then turns the network off and checks that the pages and the SQLite engine still work.
 * Run: npm run test:offline        (set CHROME_PATH if Chrome is not in the default location)
 */
const { spawn } = require("child_process"), http = require("http"), fs = require("fs"), path = require("path"), os = require("os");
const root = path.join(__dirname, "..");
const chrome = process.env.CHROME_PATH || (process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : process.platform === "darwin" ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : "google-chrome");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json", ".webmanifest": "application/manifest+json" };
const site = http.createServer((q, r) => {
  let f = path.join(root, decodeURIComponent(q.url.split("?")[0]));
  try { if (fs.statSync(f).isDirectory()) f = path.join(f, "index.html"); } catch (e) { /* 404 below */ }
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end("nf"); return; } r.writeHead(200, { "Content-Type": types[path.extname(f)] || "application/octet-stream" }); r.end(d); });
});
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const check = (n, c) => { (c ? pass++ : fail++); console.log(c ? "PASS" : "FAIL", n); };

// OFFLINE_BASE=https://cmdcraft.vercel.app/ tests a deployed site instead of the local files
site.listen(0, async () => {
  const base = process.env.OFFLINE_BASE || "http://127.0.0.1:" + site.address().port + "/";
  const port = 9700 + Math.floor(Math.random() * 200);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "cmdcraft-chrome-"));
  const proc = spawn(chrome, ["--headless=new", "--disable-gpu", "--no-sandbox", `--remote-debugging-port=${port}`, "--user-data-dir=" + profile, "about:blank"], { stdio: "ignore" });
  const getJSON = p => new Promise((res, rej) => http.get({ host: "127.0.0.1", port, path: p }, r => { let d = ""; r.on("data", c => d += c); r.on("end", () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } }); }).on("error", rej));
  const done = code => { try { proc.kill(); } catch (e) { /* gone */ } site.close(); process.exit(code); };
  try {
    let targets; for (let i = 0; i < 60; i++) { try { targets = await getJSON("/json"); if (targets.length) break; } catch (e) { /* wait */ } await sleep(250); }
    const ws = new WebSocket(targets.find(t => t.type === "page").webSocketDebuggerUrl); await new Promise(r => ws.addEventListener("open", r));
    let id = 0; const pending = new Map();
    ws.addEventListener("message", ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
    const send = (method, params) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
    const ev = async expr => (await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true })).result.result.value;
    await send("Page.enable"); await send("Network.enable");
    await send("Page.navigate", { url: base }); await sleep(7000);
    check("service worker is registered and active", await ev("navigator.serviceWorker.getRegistration().then(r => !!(r && r.active))"));
    const listed = JSON.parse(fs.readFileSync(path.join(root, "sw-assets.json"), "utf8")).files.length;
    const cached = await ev("caches.open('cmdcraft-v1').then(c => c.keys()).then(k => k.length)");
    check("the site was pre-cached (" + cached + " of " + listed + " files)", cached >= listed);
    await send("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
    for (const [p, needle, label] of [["linux/theory/", "Linux theory", "Linux theory"], ["ai/", "AI interview prep", "AI page"], ["", "Choose a subject", "hub"]]) {
      await send("Page.navigate", { url: base + p }); await sleep(2500);
      check("offline: " + label + " loads", (await ev("document.body ? document.body.innerText : ''")).includes(needle));
    }
    await send("Page.navigate", { url: base + "sql/practice.html" }); await sleep(6000);
    check("offline: the SQLite engine starts", await ev("!!document.getElementById('p-id') && document.getElementById('p-id').textContent === 'SEL-01'"));
    await send("Page.navigate", { url: base + "sql/learn.html" }); await sleep(2500);
    check("offline: SQL lessons load", (await ev("document.body ? document.body.innerText : ''")).includes("Introduction to Databases"));
    console.log(pass + " passed, " + fail + " failed"); done(fail ? 1 : 0);
  } catch (e) { console.error("ERR", e); done(1); }
});

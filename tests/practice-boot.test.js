const { JSDOM } = require("jsdom"); const fs = require("fs");
const dir = require("path").join(__dirname, "..") + "/";
const __M = { shared: "theme cloud cloud-config subjects".split(" "), "linux/app": "app editor-ui feedback viz viz-more viz-sys".split(" "), "linux/content": "scenarios goals curriculum curriculum-end drills-a drills-b drills-c drills-d drills-e drills-f drills-g incidents-more interview-data".split(" ") };
const R = f => { const b = f.replace(/\.js$/, ""); for (const [d, l] of Object.entries(__M)) if (l.includes(b)) return d + "/" + f; return /^(editors|shell|system)/.test(f) ? "linux/engine/" + f : f; };
const raw = fs.readFileSync(dir + "linux/index.html", "utf8");
const srcs = [...raw.matchAll(/<script src="([a-z0-9/.-]+\.js)"><\/script>/g)].map(m => m[1]);
const missing = srcs.filter(f => !fs.existsSync(dir + "linux/" + f));
console.log("local scripts:", srcs.length, "missing:", missing.join(",") || "none");
const html = raw.replace(/<script src="https?:[^>]*><\/script>/g, "").replace(/<link [^>]*>/g, "").replace(/<script src="[a-z0-9\/.-]+\.js"><\/script>/g, "");
const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true, url: "http://localhost/" });
const w = dom.window;
w.AudioContext = function () { return { createOscillator() {}, createGain() {}, destination: {}, currentTime: 0, resume() {} }; };
w.HTMLElement.prototype.scrollIntoView = () => {};
let all = "";
for (const f of srcs.filter(f => !/(^|\/)(cloud|cloud-config|theme)\.js$/.test(f))) all += fs.readFileSync(dir + "linux/" + f, "utf8") + "\n;\n";
all += "window.app = new CmdCraftApp(); window.n = SCENARIOS.length;";
try { w.eval(all); console.log("index.html script order boots OK;", w.n, "scenarios; order:", srcs.join(" ")); } catch (e) { console.log("BOOT ERR", e.message); process.exit(1); }

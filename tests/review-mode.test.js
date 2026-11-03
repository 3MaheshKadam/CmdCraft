const { JSDOM } = require("jsdom");
const fs = require("fs");
const dir = require("path").join(__dirname, "..") + "/";
const __M = { shared: "theme cloud cloud-config subjects".split(" "), "linux/app": "app editor-ui feedback viz viz-more viz-sys".split(" "), "linux/content": "scenarios goals curriculum curriculum-end drills-a drills-b drills-c drills-d drills-e drills-f drills-g incidents-more interview-data".split(" ") };
const R = f => { const b = f.replace(/\.js$/, ""); for (const [d, l] of Object.entries(__M)) if (l.includes(b)) return d + "/" + f; return /^(editors|shell|system)/.test(f) ? "linux/engine/" + f : f; };
const html = fs.readFileSync(dir + "linux/index.html", "utf8")
  .replace(/<script src="https?:[^>]*><\/script>/g, "")
  .replace(/<link [^>]*>/g, "")
  .replace(/<script src="[a-z0-9\/.-]+\.js"><\/script>/g, "");
const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true, url: process.env.TEST_URL || "http://localhost/" });
const w = dom.window;
const node = () => ({ connect() {}, start() {}, stop() {}, type: "", frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} }, gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} } });
w.AudioContext = function () { return { createOscillator: node, createGain: node, destination: {}, currentTime: 0, resume() {} }; };
w.HTMLElement.prototype.scrollIntoView = () => {};
w.confirm = () => true;

let all = "";
for (const f of ["editors.js", "system.js", "system-more.js", "system-more2.js", "system-pkg.js", "system-disk.js", "shell.js", "shell-text.js", "shell-more.js", "shell-archive.js", "shell-script.js", "shell-edit.js", "scenarios.js", "goals.js", "feedback.js", "curriculum.js", "drills-a.js", "drills-b.js", "drills-c.js", "drills-d.js", "drills-e.js", "drills-f.js", "drills-g.js", "incidents-more.js", "curriculum-end.js", "viz.js", "viz-more.js", "viz-sys.js", "app.js"]) all += fs.readFileSync(dir + R(f), "utf8") + "\n;\n";
all += "window.cmdCraft = new CmdCraftApp(); window.SCEN = SCENARIOS; window.ALL_SCEN = [...SCENARIOS, ...SYLLABUS_INCIDENTS];";
try { w.eval(all); } catch (e) { console.log("BOOT ERR", String(e.stack).slice(0, 800)); process.exit(2); }

const app = w.cmdCraft;
const term = () => w.document.getElementById("terminal-output").textContent;
const type = cmd => { app.dom.termInput.value = cmd; app.handleCommandSubmit(); };
const fsText = () => w.document.getElementById("visual-fs-container").textContent.replace(/\s+/g, " ");
const prompt = () => w.document.getElementById("prompt-label").textContent;
const pill = () => app.dom.evalStatusPill.textContent;

function load(id) {
  const sc = w.ALL_SCEN.find(s => s.id === id);
  if (id.startsWith("INCIDENT")) { app.currentMode = "syllabus"; app.loadScenarioQueue(); }
  else { app.currentMode = "topic"; app.selectedTopic = sc.topic; app.loadScenarioQueue(); }
  app.currentIndex = app.scenarioList.findIndex(s => s.id === id);
  app.renderCurrentScenario();
}
let pass = 0, fail = 0;
const check = (name, cond) => { (cond ? pass++ : fail++); console.log(cond ? "PASS" : "FAIL", name); };
if (process.env.TEST_URL) {
  check("?topic= deep link opens that module", app.selectedTopic === "permissions" && app.currentMode === "topic");
  check("deep link starts at the first unsolved drill", app.scenarioList.length > 3 && app.scenarioList[app.currentIndex].topic === "permissions");
  console.log(pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
}
w.alert = () => {};
load("LNX-NAV-01");
check("no review items on a fresh profile", app.buildReviewQueue().length === 0);
type("ls -l /");                    // harmless exploration is not an attempt
check("harmless exploration is not recorded as an attempt", Object.keys(app.stats).length === 0);
// a real wrong attempt: a command that changes state but does not satisfy the mission
type("mkdir wrongdir");
check("a wrong attempt is recorded and due immediately", app.stats["LNX-NAV-01"] && app.stats["LNX-NAV-01"].f >= 1 && app.stats["LNX-NAV-01"].b === 0);
check("review count appears on the button", app.buildReviewQueue().some(s => s.id === "LNX-NAV-01") && !w.document.getElementById("review-count").classList.contains("hidden"));
const sc = w.ALL_SCEN.find(s => s.id === "LNX-NAV-01");
type(sc.explanation.command.split(" (or")[0]);
check("solving after a failure schedules a re-check for tomorrow (box 1)", app.isSolved && app.stats["LNX-NAV-01"].b === 1 && app.stats["LNX-NAV-01"].d > Date.now() + 80000000);
// a clean first-try solve
load("LNX-NAV-02"); type(w.ALL_SCEN.find(s => s.id === "LNX-NAV-02").explanation.command.split(" (or")[0]);
check("a clean first solve goes to box 1 and is not due yet", app.stats["LNX-NAV-02"].b === 1 && app.stats["LNX-NAV-02"].f === 0 && !app.buildReviewQueue().some(s => s.id === "LNX-NAV-02"));
// make something due and open review mode through the button
app.stats["LNX-NAV-02"].d = Date.now() - 1000;
check("an overdue drill appears in the queue (weakest first)", app.buildReviewQueue().length >= 1);
w.document.getElementById("mode-review").click();
check("review mode loads the due drills", app.currentMode === "review" && app.scenarioList.length >= 1 && /REVIEW/.test(w.document.getElementById("topic-badge") ? w.document.getElementById("topic-badge").textContent : app.dom.topicBadge.textContent));
const first = app.currentScenario; type(first.explanation.command.split(" (or")[0]);
check("solving in review advances the box", app.stats[first.id].b >= 1 && app.stats[first.id].d > Date.now());
check("review mode does not overwrite the saved topic position", w.localStorage.getItem("cmdcraft_mode") !== "review");
check("stats persist in localStorage", !!w.localStorage.getItem("cmdcraft_stats") && JSON.parse(w.localStorage.getItem("cmdcraft_stats"))["LNX-NAV-01"]);
console.log(pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);

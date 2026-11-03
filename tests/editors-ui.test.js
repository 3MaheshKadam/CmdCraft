const { JSDOM } = require("jsdom");
const fs = require("fs");
const dir = require("path").join(__dirname, "..") + "/";
const __M = { shared: "theme cloud cloud-config subjects".split(" "), "linux/app": "app editor-ui feedback viz viz-more viz-sys".split(" "), "linux/content": "scenarios goals curriculum curriculum-end drills-a drills-b drills-c drills-d drills-e drills-f drills-g incidents-more interview-data".split(" ") };
const R = f => { const b = f.replace(/\.js$/, ""); for (const [d, l] of Object.entries(__M)) if (l.includes(b)) return d + "/" + f; return /^(editors|shell|system)/.test(f) ? "linux/engine/" + f : f; };
const html = fs.readFileSync(dir + "linux/index.html", "utf8")
  .replace(/<script src="https?:[^>]*><\/script>/g, "")
  .replace(/<link [^>]*>/g, "")
  .replace(/<script src="[a-z0-9\/.-]+\.js"><\/script>/g, "");
const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true, url: "http://localhost/" });
const w = dom.window;
const node = () => ({ connect() {}, start() {}, stop() {}, type: "", frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} }, gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} } });
w.AudioContext = function () { return { createOscillator: node, createGain: node, destination: {}, currentTime: 0, resume() {} }; };
w.HTMLElement.prototype.scrollIntoView = () => {};
w.confirm = () => true;

let all = "";
for (const f of ["editors.js", "system.js", "system-more.js", "system-more2.js", "system-pkg.js", "system-disk.js", "shell.js", "shell-text.js", "shell-more.js", "shell-archive.js", "shell-script.js", "shell-edit.js", "scenarios.js", "goals.js", "feedback.js", "curriculum.js", "drills-a.js", "drills-b.js", "drills-c.js", "drills-d.js", "drills-e.js", "drills-f.js", "drills-g.js", "incidents-more.js", "curriculum-end.js", "viz.js", "viz-more.js", "viz-sys.js", "editor-ui.js", "app.js"]) all += fs.readFileSync(dir + R(f), "utf8") + "\n;\n";
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

const sleep = ms => new Promise(r => setTimeout(r, ms));
function sendKey(name) {
  const m = /^Ctrl-(.)$/.exec(name);
  const init = m ? { key: m[1].toLowerCase(), ctrlKey: true } : { key: name };
  if (name === "Ctrl-_") init.key = "_";
  w.document.dispatchEvent(new w.KeyboardEvent("keydown", Object.assign({ bubbles: true, cancelable: true }, init)));
}
async function drive(id, expectOverlay) {
  load(id);
  const sc = w.ALL_SCEN.find(s => s.id === id), setup = w.SCENARIO_SETUP[id];
  type(sc.explanation.command.split(" (or")[0]);
  const overlay = w.document.querySelector("[aria-label$='editor simulator']");
  check(id + ": editor overlay opens", !!overlay);
  check(id + ": mission not judged while editing", !app.isSolved);
  w.Editors.parseKeys(setup.keys).forEach(sendKey);
  await sleep(300);
  check(id + ": overlay closes after quitting", !w.document.querySelector("[aria-label$='editor simulator']"));
  check(id + ": solved by really typing the keys (" + pill() + ")", app.isSolved);
}
(async () => {
  await drive("LNX-VIM-04");
  await drive("LNX-VIM-12");
  await drive("LNX-NANO-02");
  await drive("LNX-NANO-10");
  // the escape hatch
  load("LNX-VIM-03");
  type("vim notes.txt");
  const btn = [...w.document.querySelectorAll("button")].find(b => /I'm stuck/.test(b.textContent));
  check("stuck button exists", !!btn);
  btn.click(); await sleep(50);
  check("stuck button closes the editor without saving", !w.document.querySelector("[aria-label$='editor simulator']") && !app.isSolved);
  // draws a real screen
  load("LNX-VIM-04"); type("vim todo.txt");
  const scr = w.document.querySelector("[aria-label$='editor simulator']").textContent;
  check("vim screen shows the file", /buy milk/.test(scr) && /-- |0,0|1,1/.test(scr));
  console.log(pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();

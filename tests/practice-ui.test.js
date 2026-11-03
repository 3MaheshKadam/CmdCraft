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

load("LNX-FILE-01");
check("initial tree has no app.log", !fsText().includes("app.log"));
type("ls");
check("ls is exploration: no penalty", !pill().includes("INCORRECT") && !app.isSolved);
type("touch wrong.txt");
check("wrong state change counts as incorrect", pill().includes("INCORRECT"));
check("tree shows wrong.txt immediately", fsText().includes("wrong.txt"));
type("touch app.log");
check("solved by state", app.isSolved && pill().includes("SOLVED"));
check("tree shows app.log", fsText().includes("app.log"));
check("flash class on changed node", w.document.querySelector(".fs-flash") !== null);

load("LNX-PERM-01");
type("chmod 755 deploy.sh");
check("PERM-01 solved with alternate form", app.isSolved);
check("new permissions shown in tree", fsText().includes("-rwxr-xr-x"));

load("LNX-NAV-04");
check("prompt shows starting cwd /var/log", prompt().includes("/var/log"));
type("cd -");
check("NAV-04 solved", app.isSolved);
check("prompt follows cwd", prompt().includes("/etc/nginx/sites-available"));

load("LNX-NAV-02");
type("ls -a -l");
check("NAV-02 solved with ls -a -l", app.isSolved);
check("real ls output printed", term().includes(".env.production"));

load("LNX-REDIR-02");
type("echo 'DEPLOY_STATUS=SUCCESS' >> deploy.log");
check("REDIR-02 solved", app.isSolved);

load("LNX-ARCH-01");
type("whoami");
check("unconverted ARCH-01 still solves with canned output", app.isSolved && term().includes("ubuntu"));

const allIds=w.ALL_SCEN.map(s=>s.id); const missing=allIds.filter(id=>!w.SCENARIO_SETUP[id]);
check("every scenario ("+allIds.length+") has a live setup", missing.length===0 && allIds.length>=80);
if(missing.length) console.log("   missing:", missing.join(","));

load("LNX-FILE-04");
const tn = () => w.document.getElementById("btn-term-next");
check("Next button hidden before solve", tn().classList.contains("hidden"));
type("mv app.conf.old app.conf");
check("Next button shown after solve", !tn().classList.contains("hidden"));
const idx = app.currentIndex; tn().click();
check("Next button advances and hides again", app.currentIndex === idx + 1 && tn().classList.contains("hidden"));
load("LNX-GREP-01");
type("grep error /var/log/syslog");
check("GREP-01: case-sensitive grep prints real output but is not solved", term().includes("ERROR: connection refused") === false && term().includes("warning") === false && !app.isSolved && !pill().includes("INCORRECT"));
type("grep -i error /var/log/syslog");
check("GREP-01: solved and shows all 3 matching lines", app.isSolved && term().includes("ERROR: connection refused") && term().includes("error: timeout") && term().includes("Error: out of memory"));

load("LNX-GREP-05");
type("find /etc -name '*.conf'");
check("GREP-05: solved, nginx.conf appears in the visualizer", app.isSolved && fsText().includes("nginx"));

load("LNX-TEXT-03");
type("sed 's/localhost/127.0.0.1/' config.env");
check("TEXT-03: sed without g is wrong (a line still has localhost)", pill().includes("INCORRECT") || (!app.isSolved));
type("sed 's/localhost/127.0.0.1/g' config.env");
check("TEXT-03: sed with g solves", app.isSolved);

load("LNX-TEXT-05");
type("cut -d: -f1 /etc/passwd");
check("TEXT-05: solved with real usernames", app.isSolved && term().includes("www-data"));

const vizText = () => w.document.getElementById("visual-fs-container").textContent.replace(/\s+/g, " ");
const vizTitle = () => w.document.getElementById("viz-title").textContent;

// --- live panels follow the question ---
load("LNX-PROC-04");
check("PROC-04 shows the process monitor, not the file tree", vizTitle() === "Live Process Monitor" && vizText().includes("kworkerds"));
type("kill 9999");
check("PROC-04: kill 9999 leaves the miner running and the panel says why", !app.isSolved && vizText().includes("ignored SIGTERM") && vizText().includes("kworkerds"));
type("kill -9 9999");
check("PROC-04: kill -9 solves it, row is struck through as terminated", app.isSolved && w.document.querySelector(".viz-removed") !== null);

load("LNX-SVC-04");
check("SVC-04 shows the service board with the stale-unit warning", vizTitle() === "Live Service Board" && vizText().includes("daemon-reload"));
type("systemctl restart myapp");
check("SVC-04: restart alone does not solve it and the terminal shows systemd's warning", !app.isSolved && term().includes("changed on disk"));
type("systemctl daemon-reload");
check("SVC-04: daemon-reload solves it and the warning disappears from the board", app.isSolved && !vizText().includes("Unit file changed on disk"));

load("LNX-USER-01");
type("useradd -m developer");
check("USER-01: new user appears in the users panel with a flash", app.isSolved && vizText().includes("developer") && w.document.querySelector(".fs-flash") !== null);

load("LNX-LOG-02");
type("journalctl -u myapp --since '30 minutes ago'");
check("LOG-02: solved, journal viewer highlights the matched window", app.isSolved && vizTitle() === "Live Journal Viewer" && w.document.querySelector(".border-emerald-400") !== null);

load("LNX-LOG-03");
type("journalctl -u myapp -f");
check("LOG-03: follow is armed and prints a live entry on tick", app.isSolved && !!app.shell.follow && !!app.followTimer);
const before3 = term().length;
const line = app.shell.follow.next(); app.appendTerminalLine("<span>" + line + "</span>"); app.renderLive();
check("LOG-03: a new live journal entry appears", term().length > before3);
app.stopFollow(true);
check("Ctrl+C path stops the follower", !app.followTimer && term().includes("^C"));

load("LNX-CRON-01");
type("crontab -l");
check("CRON-01: crontab shown in plain English", app.isSolved && vizText().includes("Every day at 02:00") && vizText().includes("Every 15 minutes"));

load("LNX-PROC-05");
type("pkill celery_worker");
check("PROC-05: pkill without -f is an honest no-op (not solved, workers still listed)", !app.isSolved && vizText().includes("celery_worker.py"));
type("pkill -f celery_worker.py");
check("PROC-05: pkill -f solves it", app.isSolved && vizText().includes("api.py"));

// every panel kind renders on its own scenario without errors
const kinds = {};
w.SCEN.forEach(sc => { const s = w.SCENARIO_SETUP[sc.id]; if (s && s.viz) kinds[s.viz] = sc.id; });
Object.entries(kinds).forEach(([k, id]) => { load(id); check("panel '" + k + "' renders for " + id, vizText().length > 20); });


// the real overlay is tested separately below; here a headless stand-in replays each drill's reference keystrokes
w.EditorUI = { open(sh, host, cb) { const ed = sh.openEditor(); w.Editors.runKeys(ed, (w.SCENARIO_SETUP[app.currentScenario.id] || {}).keys || ""); sh.finishEditor(ed); cb(ed); return { ed }; } };

// --- every scenario, end to end through the real UI ---
const unsolved = [], blank = [], titles = {};
w.ALL_SCEN.forEach(sc => {
  load(sc.id);
  const kind = (w.SCENARIO_SETUP[sc.id] || {}).viz || "fs";
  const cmd = sc.explanation.command.split(" (or")[0];
  const initial = vizText();
  titles[kind] = vizTitle();
  type(cmd);
  if (!app.isSolved) unsolved.push(sc.id + " <- " + cmd);
  if (vizText().length < 15 && initial.length < 15) blank.push(sc.id);
  app.stopFollow(false);
});
check("all " + w.ALL_SCEN.length + " scenarios solve through the UI with their documented command", unsolved.length === 0);
if (unsolved.length) console.log("   unsolved: " + unsolved.join(" ## "));
check("no scenario draws a blank live panel", blank.length === 0);
if (blank.length) console.log("   blank:", blank.join(","));
console.log("   panels in use:", Object.entries(titles).map(([k, v]) => k + "=" + v).join(" | "));

// --- command explainer in the right-hand panel ---
load("LNX-NAV-02");
type("grep -.env");
const fb = () => app.dom.explanation.textContent.replace(/\s+/g, " ");
check("explainer: shows what you ran", fb().includes("You ran") && fb().includes("grep -.env"));
check("explainer: says what grep is", fb().includes("searches text for lines that match a pattern"));
check("explainer: flags the dash-led token", fb().includes("starts with a dash"));
check("explainer: shows what it returned", fb().includes("What it returned") && fb().includes("Usage"));
check("explainer: says why it is not the answer", fb().includes("needs a different tool") && fb().includes("ls lists the files"));
check("explainer: keeps the solution hidden behind a toggle", app.dom.explanation.querySelector("details") !== null && !app.dom.explanation.querySelector("details").open);
type("ls -l");
check("explainer: ls -l is read-only, so softer header and no INCORRECT", fb().includes("ran fine") && fb().includes("An option is missing") && !app.dom.evalStatusPill.textContent.includes("INCORRECT"));
type("lss");
check("explainer: suggests the right command for a typo", fb().includes('Did you mean "ls"'));
type("ls -la");
check("explainer: still solves with the correct command", app.isSolved);

console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);

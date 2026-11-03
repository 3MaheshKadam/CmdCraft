const fs = require("fs"), vm = require("vm");
const dir = require("path").join(__dirname, "..") + "/";
const __M = { shared: "theme cloud cloud-config subjects".split(" "), "linux/app": "app editor-ui feedback viz viz-more viz-sys".split(" "), "linux/content": "scenarios goals curriculum curriculum-end drills-a drills-b drills-c drills-d drills-e drills-f drills-g incidents-more interview-data".split(" ") };
const R = f => { const b = f.replace(/\.js$/, ""); for (const [d, l] of Object.entries(__M)) if (l.includes(b)) return d + "/" + f; return /^(editors|shell|system)/.test(f) ? "linux/engine/" + f : f; };
const ctx = { console }; ctx.window = ctx; vm.createContext(ctx);
["editors.js", "system.js", "system-more.js", "system-more2.js", "system-pkg.js", "system-disk.js", "shell.js", "shell-text.js", "shell-more.js", "shell-archive.js", "shell-script.js", "shell-edit.js", "scenarios.js", "goals.js", "feedback.js", "curriculum.js", "drills-a.js", "drills-b.js", "drills-c.js", "drills-d.js", "drills-e.js", "drills-f.js", "drills-g.js", "incidents-more.js", "curriculum-end.js", "feedback.js"].forEach(f =>
  vm.runInContext(fs.readFileSync(dir + R(f), "utf8").replace(/^const (\w+) =/gm, "var $1 ="), ctx, { filename: f }));
const sc = id => [...ctx.SCENARIOS, ...ctx.SYLLABUS_INCIDENTS].find(s => s.id === id);
let bad = 0;
function run(id, typed, expect) {
  const s = sc(id);
  const sh = new ctx.VirtualShell(s.initialFs, ctx.SCENARIO_SETUP[id]);
  const res = sh.exec(typed);
  const m = ctx.CmdFeedback.analyze(typed, s, sh, res);
  const flat = JSON.stringify(m);
  const failures = (expect || []).filter(e => !(e instanceof RegExp ? e.test(flat) : flat.includes(e)));
  if (failures.length) bad++;
  console.log(failures.length ? "FAIL" : "OK  ", id.padEnd(12), JSON.stringify(typed), failures.length ? "-> missing: " + failures.join(" | ") : "");
  return m;
}

// the screenshot case: a filename written with a leading dash
let m = run("LNX-NAV-02", "grep -.env", [/starts with a dash/, /search/i, /needs a different tool/]);
console.log("   reasons:", m.reasons.map(r => "\n     - " + r).join(""));
console.log("   output :", m.output.kind, JSON.stringify(m.output.text).slice(0, 80), "|", m.output.explain);
console.log("   tokens :", m.segments[0].tokens.map(t => t.token + " => " + t.meaning.slice(0, 50)).join(" || "));

// wrong flag set on the right command
m = run("LNX-NAV-02", "ls -l", [/An option is missing/, /hidden|dot/i]);
console.log("   reasons:", m.reasons.join(" / "));
m = run("LNX-NAV-02", "ls", [/An option is missing/]);
run("LNX-NAV-02", "lss -la", [/did you mean|suggestion":"ls"/i, "command not found"]);
run("LNX-PERM-01", "chmod 644 deploy.sh", [/different from what the mission needs: 644/]);
m = run("LNX-PERM-01", "chmod +x", [/argument is missing/]);
console.log("   reasons:", m.reasons.join(" / "));
run("LNX-GREP-02", "grep -r API_KEY .", [/An option is missing/, /line numbers/i]);
run("LNX-GREP-01", "grep error /var/log/syslog", [/ignore upper\/lower case|ignore case/i]);
run("LNX-TEXT-04", "uniq -c access.log", [/also uses sort/]);
run("LNX-PROC-04", "kill 9999", [/An option is missing/]);
run("LNX-FILE-01", "mkdir app.log", [/needs a different tool/, /touch|creates an empty file/]);
run("LNX-SVC-04", "systemctl restart myapp", [/different from what the mission needs/]);
run("LNX-NAV-03", "cd /nonexistent", [/No such file/, /does not exist/i]);
m = run("LNX-NAV-02", "echo 'hello", [/quote is not closed/]);
run("LNX-DISK-01", "top", [/unsupported|not simulate/]);

// the hidden solution is never in the visible text of the reasons for a wrong command name
m = run("LNX-NAV-02", "pwd", []);
const reasons = m.reasons.join(" ");
const leak = reasons.includes("ls -la");
if (leak) bad++;
console.log(leak ? "FAIL" : "OK  ", "reasons never print the full solution");
console.log(m.solution === "ls -la" ? "OK   solution available behind the toggle: ls -la" : "FAIL solution missing");
process.exit(bad ? 1 : 0);

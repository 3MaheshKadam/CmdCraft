const fs = require("fs"), vm = require("vm");
const dir = require("path").join(__dirname, "..") + "/";
const __M = { shared: "theme cloud cloud-config subjects".split(" "), "linux/app": "app editor-ui feedback viz viz-more viz-sys".split(" "), "linux/content": "scenarios goals curriculum curriculum-end drills-a drills-b drills-c drills-d drills-e drills-f drills-g incidents-more interview-data".split(" ") };
const R = f => { const b = f.replace(/\.js$/, ""); for (const [d, l] of Object.entries(__M)) if (l.includes(b)) return d + "/" + f; return /^(editors|shell|system)/.test(f) ? "linux/engine/" + f : f; };
const ctx = { console, module: undefined }; ctx.window = ctx;
vm.createContext(ctx);
["editors.js", "system.js", "system-more.js", "system-more2.js", "system-pkg.js", "system-disk.js", "shell.js", "shell-text.js", "shell-more.js", "shell-archive.js", "shell-script.js", "shell-edit.js", "scenarios.js", "goals.js", "feedback.js", "curriculum.js", "drills-a.js", "drills-b.js", "drills-c.js", "drills-d.js", "drills-e.js", "drills-f.js", "drills-g.js", "incidents-more.js", "curriculum-end.js"].forEach(f => {
  let src = fs.readFileSync(dir + R(f), "utf8");
  src = src.replace(/^const (\w+) =/gm, "var $1 =");
  vm.runInContext(src, ctx, { filename: f });
});
const { VirtualShell, SCENARIO_SETUP, SCENARIOS } = ctx;
let fail = 0;
for (const [id, setup] of Object.entries(ctx.SCENARIO_SETUP)) {
  const sc = [...ctx.SCENARIOS, ...ctx.SYLLABUS_INCIDENTS].find(s => s.id === id);
  if (!sc) { console.log("MISSING", id); fail++; continue; }
  const sh = new ctx.VirtualShell(sc.initialFs, setup);
  const before = setup.goal ? setup.goal(sh) : false;
  const cmd = sc.explanation.command.split(" (or")[0];
  const r = sh.exec(cmd);
  if (sh.pendingEditor && setup.keys) sh.editorScript(setup.keys);
  const after = setup.goal ? setup.goal(sh) : (setup.ran ? sh.ran(setup.ran.cmd, setup.ran.flags) : null);
  const ok = !before && after === true && r.handled;   // stderr text (nohup's notice, a refused connection) is legitimate output
  if (!ok) fail++;
  console.log(ok ? "OK  " : "FAIL", id, "| cmd:", cmd, "| before:", before, "after:", after, "handled:", r.handled, r.err ? "ERR:" + r.err.trim() : "");
}
// misc behaviours
const sc = ctx.SCENARIOS.find(s => s.id === "LNX-NAV-02");
const sh = new ctx.VirtualShell(sc.initialFs, ctx.SCENARIO_SETUP["LNX-NAV-02"]);
console.log(sh.exec("ls -la").out);
console.log(JSON.stringify(sh.exec("foo bar")), JSON.stringify(sh.exec("mkdir x && cd x && pwd").out));
console.log(JSON.stringify(sh.exec("cat nope").err), JSON.stringify(sh.exec("echo hi > a.txt; cat a.txt | grep hi").out));
console.log("alt forms:");
for (const [id, cmds] of [["LNX-PERM-01", ["chmod 755 deploy.sh", "chmod u+x deploy.sh", "chmod a+x deploy.sh"]], ["LNX-PERM-02", ["chmod u=rw,go=r app.conf", "chmod 644 app.conf"]], ["LNX-FILE-02", ["mkdir project && mkdir project/config && mkdir project/config/env"]], ["LNX-FILE-05", ["ln -s releases/v2.4 current", "ln -sfn /opt/myapp/releases/v2.4 current"]]]) {
  for (const c of cmds) {
    const s = ctx.SCENARIOS.find(x => x.id === id);
    const h = new ctx.VirtualShell(s.initialFs, ctx.SCENARIO_SETUP[id]);
    h.exec(c);
    console.log(ctx.SCENARIO_SETUP[id].goal(h) ? "OK  " : "FAIL", id, c);
  }
}
console.log(JSON.stringify(new ctx.VirtualShell(ctx.SCENARIOS.find(s => s.id === "LNX-NAV-04").initialFs, ctx.SCENARIO_SETUP["LNX-NAV-04"]).toTree()).slice(0, 400));
process.exit(fail ? 1 : 0);

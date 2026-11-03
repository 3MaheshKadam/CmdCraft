const fs = require("fs"), vm = require("vm");
const dir = require("path").join(__dirname, "..") + "/";
const __M = { shared: "theme cloud cloud-config subjects".split(" "), "linux/app": "app editor-ui feedback viz viz-more viz-sys".split(" "), "linux/content": "scenarios goals curriculum curriculum-end drills-a drills-b drills-c drills-d drills-e drills-f drills-g incidents-more interview-data".split(" ") };
const R = f => { const b = f.replace(/\.js$/, ""); for (const [d, l] of Object.entries(__M)) if (l.includes(b)) return d + "/" + f; return /^(editors|shell|system)/.test(f) ? "linux/engine/" + f : f; };
const ctx = { console }; ctx.window = ctx; vm.createContext(ctx);
["editors.js", "system.js", "system-more.js", "system-more2.js", "system-pkg.js", "system-disk.js", "shell.js", "shell-text.js", "shell-more.js", "shell-archive.js", "shell-script.js", "shell-edit.js", "scenarios.js", "goals.js", "feedback.js", "curriculum.js", "drills-a.js", "drills-b.js", "drills-c.js", "drills-d.js", "drills-e.js", "drills-f.js", "drills-g.js", "incidents-more.js", "curriculum-end.js"].forEach(f => vm.runInContext(fs.readFileSync(dir + R(f), "utf8").replace(/^const (\w+) =/gm, "var $1 ="), ctx, { filename: f }));
const sc = id => ctx.SCENARIOS.find(s => s.id === id);
let bad = 0;
function t(id, cmds, expect) {
  const sh = new ctx.VirtualShell(sc(id).initialFs, ctx.SCENARIO_SETUP[id]);
  let handled = true;
  cmds.forEach(c => { const r = sh.exec(c); handled = handled && r.handled; });
  const got = handled ? !!ctx.SCENARIO_SETUP[id].goal(sh) : "unhandled";
  const ok = got === expect;
  if (!ok) bad++;
  console.log(ok ? "OK  " : "FAIL", id, JSON.stringify(cmds.join(" ; ")), "->", got, "(want " + expect + ")");
}
// should solve
t("LNX-GREP-01", ["grep --ignore-case error /var/log/syslog"], true);
t("LNX-GREP-01", ["cd /var/log", "grep -i ERROR syslog"], true);
t("LNX-GREP-02", ["grep -r -n API_KEY ."], true);
t("LNX-GREP-02", ["grep -rn API_KEY"], true);
t("LNX-GREP-02", ["grep -nr 'API_KEY' ."], true);
t("LNX-TEXT-01", ["tail -F /var/log/myapp.log"], true);
t("LNX-TEXT-02", ["awk -F' ' '{print $1}' access.log"], true);
t("LNX-TEXT-03", ["sed -i 's/localhost/127.0.0.1/g' config.env"], true);
t("LNX-TEXT-04", ["sort access.log | uniq -c | sort -nr"], true);
t("LNX-GREP-04", ["find /var/log -size +100M -type f"], true);
t("LNX-REDIR-03", ["find /etc -name '*.conf' 2>/dev/null"], true);
// must NOT solve
t("LNX-GREP-01", ["grep error /var/log/syslog"], false);          // missing -i
t("LNX-GREP-02", ["grep -r API_KEY ."], false);                    // missing -n
t("LNX-GREP-03", ["grep DEBUG app.log"], false);                   // not inverted
t("LNX-TEXT-03", ["sed 's/localhost/127.0.0.1/' config.env"], false); // missing g: line 3 keeps a "localhost"
t("LNX-TEXT-04", ["uniq -c access.log"], false);                   // not sorted -> no sort in pipeline
t("LNX-REDIR-03", ["find /etc -name '*.conf'"], false);            // no stderr redirect
t("LNX-GREP-05", ["find /etc -name '*.txt'"], false);
// unsupported syntax falls back to the regex matcher instead of misbehaving
t("LNX-TEXT-02", ["awk 'NR==1' access.log"], false);      // now simulated: prints one line but is not the mission's answer
t("LNX-TEXT-03", ["sed -n '1p' config.env"], false);       // now simulated as well
t("LNX-TEXT-02", ["awk 'BEGIN{x=}' access.log"], "unhandled");          // a program that does not parse still falls back to the matcher
const sh = new ctx.VirtualShell(sc("LNX-GREP-02").initialFs, ctx.SCENARIO_SETUP["LNX-GREP-02"]);
console.log(sh.exec("grep -rn API_KEY .").out);
console.log(sh.exec("find . -type f").out);
process.exit(bad ? 1 : 0);

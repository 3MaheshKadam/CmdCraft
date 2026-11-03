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
  return sh;
}
// processes
t("LNX-PROC-01", ["pgrep -l nginx"], true);
t("LNX-PROC-01", ["ps aux"], false);
t("LNX-PROC-02", ["ps aux --sort=-%cpu | head -n 10"], true);
t("LNX-PROC-02", ["ps aux --sort=%cpu | head -n 10"], false);       // ascending: top row is not the hog
t("LNX-PROC-03", ["kill -15 1042"], true);
t("LNX-PROC-03", ["kill 1042"], true);
t("LNX-PROC-03", ["kill -9 1042"], false);                          // SIGKILL is not the graceful signal
t("LNX-PROC-04", ["kill 9999"], false);                             // miner ignores SIGTERM
t("LNX-PROC-04", ["kill 9999", "kill -9 9999"], true);
t("LNX-PROC-05", ["pkill celery_worker"], false);                   // comm is python3, needs -f
t("LNX-PROC-05", ["pkill -f celery_worker.py"], true);
t("LNX-PROC-05", ["pkill -f python3"], false);                      // collateral damage: api.py dies too
t("LNX-PROC-05", ["kill 3101 3102 3103 3104"], true);
// services
t("LNX-SVC-01", ["systemctl status nginx"], true);
t("LNX-SVC-01", ["systemctl status myapp"], false);
const s2 = t("LNX-SVC-02", ["systemctl restart myapp"], true);
console.log("   pid after restart:", s2.sys.services.myapp.pid, "(was 2210)");
t("LNX-SVC-03", ["systemctl enable myapp"], true);
t("LNX-SVC-03", ["systemctl enable --now myapp"], true);
t("LNX-SVC-03", ["systemctl status myapp"], false);
t("LNX-SVC-04", ["systemctl restart myapp"], false);                // restart does not clear the stale unit
t("LNX-SVC-04", ["systemctl daemon-reload"], true);
// journal
t("LNX-LOG-01", ["journalctl -u myapp -n 100 --no-pager"], true);
t("LNX-LOG-01", ["journalctl -u myapp --no-pager"], false);
t("LNX-LOG-02", ["journalctl -u myapp --since '30 minutes ago'"], true);
t("LNX-LOG-02", ["journalctl -u myapp --since '-30m'"], true);
t("LNX-LOG-02", ["journalctl -u myapp --since '1 hour ago'"], false);
t("LNX-LOG-03", ["journalctl -u myapp -f"], true);
t("LNX-LOG-04", ["dmesg -T | grep -i oom"], true);
t("LNX-LOG-04", ["dmesg"], false);
// cron
t("LNX-CRON-01", ["crontab -l"], true);
t("LNX-CRON-02", ["systemctl status crond"], true);
t("LNX-CRON-03", ["journalctl -u cron --since today"], true);
t("LNX-CRON-03", ["journalctl -u cron"], false);
// crontab -e is handled with a sandbox note (editor lands with the Vim/Nano stage)
// users
t("LNX-USER-01", ["useradd developer"], false);                     // no -m, no home directory
const u1 = t("LNX-USER-01", ["useradd -m developer"], true);
console.log("   /etc/passwd tail:", JSON.stringify(u1.read("/etc/passwd").split("\n").slice(-2, -1)[0]));
t("LNX-USER-02", ["usermod -G developers developer"], false);       // missing -a replaces groups
t("LNX-USER-02", ["usermod -aG developers developer"], true);
t("LNX-USER-02", ["usermod -aG nosuch developer"], false);
t("LNX-USER-03", ["grep '^ubuntu:' /etc/passwd"], true);
t("LNX-USER-04", ["id -Gn"], true);
t("LNX-USER-04", ["groups"], true);
t("LNX-USER-04", ["id"], false);

// output realism
const sh = new ctx.VirtualShell(sc("LNX-PROC-02").initialFs, ctx.SCENARIO_SETUP["LNX-PROC-02"]);
console.log(sh.exec("ps aux --sort=-%cpu | head -n 4").out);
const sv = new ctx.VirtualShell(sc("LNX-SVC-01").initialFs, ctx.SCENARIO_SETUP["LNX-SVC-01"]);
console.log(sv.exec("systemctl status nginx").out);
process.exit(bad ? 1 : 0);

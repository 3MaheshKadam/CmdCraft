/**
 * Scenario setup & goals for the Virtual Shell (shell.js).
 *
 * A scenario listed here is judged by the resulting filesystem state (or by what the command printed),
 * not by the exact text typed, and its terminal output comes from the virtual shell. Scenarios not
 * listed here keep the original regex check and canned output from scenarios.js.
 *
 * Keys:
 *   cwd, oldpwd  starting directory / previous directory (defaults come from the scenario's initialFs)
 *   files        { path: content } seeded file contents
 *   goal(sh)     returns true when the scenario is solved (sh = VirtualShell; sh.lastExec describes the last line run)
 *   ran          { cmd, flags } solved once that command ran with all of those single-letter flags
 *
 * Any other command that satisfies the goal also counts, so `ls -l -a` and `ls -al` both work.
 */

// ---- helpers for text-tool goals ----
const _lines = t => String(t || "").replace(/\n$/, "").split("\n").filter((l, i, a) => !(a.length === 1 && l === ""));
const _last = sh => sh.lastExec || null;
const _ranCmd = (sh, name) => { const l = _last(sh); return l ? l.cmds.find(c => c.name === name) || null : null; };
const _sameSet = (a, b) => a.length === b.length && [...a].sort().join("\n") === [...b].sort().join("\n");

// Seeded file contents. Kept as constants so goals compare against exactly what the learner can see.
const SYSLOG = [
  "Oct 29 10:01:12 srv kernel: Initializing cgroup subsys cpuset",
  "Oct 29 10:02:44 srv sshd[812]: Accepted publickey for ubuntu",
  "Oct 29 10:04:03 srv myapp[1204]: ERROR: connection refused to db:5432",
  "Oct 29 10:04:09 srv myapp[1204]: warning: retrying in 5s",
  "Oct 29 10:05:31 srv systemd[1]: Started Daily apt download activities.",
  "Oct 29 10:07:18 srv myapp[1204]: error: timeout while reading response",
  "Oct 29 10:09:55 srv cron[640]: (root) CMD (run-parts /etc/cron.hourly)",
  "Oct 29 10:11:02 srv myapp[1204]: Error: out of memory"
].join("\n") + "\n";

const APP_LOG = [
  "2026-10-29 10:00:01 INFO  server started on :3000",
  "2026-10-29 10:00:02 DEBUG loading config from /etc/myapp",
  "2026-10-29 10:00:05 DEBUG cache warm-up: 128 keys",
  "2026-10-29 10:01:17 INFO  GET /health 200",
  "2026-10-29 10:02:41 ERROR upstream timeout after 30s",
  "2026-10-29 10:02:42 DEBUG retry scheduled",
  "2026-10-29 10:03:10 WARN  slow query: 1.8s"
].join("\n") + "\n";

const ACCESS_LOG = [
  '192.168.1.10 - - [29/Oct/2026:10:00:01] "GET / HTTP/1.1" 200 512',
  '10.0.0.5 - - [29/Oct/2026:10:00:03] "GET /api/users HTTP/1.1" 200 2048',
  '192.168.1.10 - - [29/Oct/2026:10:00:07] "GET /about HTTP/1.1" 200 734',
  '10.0.0.5 - - [29/Oct/2026:10:00:09] "POST /api/login HTTP/1.1" 401 87',
  '172.16.4.2 - - [29/Oct/2026:10:00:12] "GET / HTTP/1.1" 200 512',
  '10.0.0.5 - - [29/Oct/2026:10:00:15] "GET /api/users HTTP/1.1" 200 2048'
].join("\n") + "\n";

const PASSWD = [
  "root:x:0:0:root:/root:/bin/bash",
  "daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin",
  "www-data:x:33:33:www-data:/var/www:/usr/sbin/nologin",
  "ubuntu:x:1000:1000:Ubuntu:/home/ubuntu:/bin/bash"
].join("\n") + "\n";

const CONF_FILES = ["/etc/nginx/nginx.conf", "/etc/resolv.conf", "/etc/sysctl.conf"];

// ---- seeds for the simulated system ----
// P(pid, user, cpu%, mem%, command line, comm, extras) builds a process row.
const P = (pid, user, cpu, mem, cmd, comm, extra) => Object.assign(
  { pid, user, cpu, mem, vsz: 90000 + (pid % 700) * 100, rss: 8000 + Math.round(mem * 4000), tty: "?", stat: "Ss", start: "08:00", time: "0:12", cmd, comm }, extra || {});
const BASE_PROCS = [
  P(1, "root", 0.0, 0.4, "/sbin/init", "systemd", { time: "0:04" }),
  P(801, "root", 0.0, 0.5, "/usr/sbin/sshd -D", "sshd"),
  P(640, "root", 0.0, 0.2, "/usr/sbin/cron -f", "cron"),
  P(2300, "ubuntu", 0.0, 0.3, "-bash", "bash", { tty: "pts/0", stat: "Ss" })
];
const NGINX_PROCS = [
  P(1024, "root", 0.0, 0.2, "nginx: master process /usr/sbin/nginx -g daemon on; master_process on;", "nginx"),
  P(1025, "www-data", 0.1, 0.4, "nginx: worker process", "nginx", { stat: "S", time: "0:02" })
];
const JOURNAL_SVC = { desc: "MyApp API server", state: "active", detail: "running", enabled: true, pid: 1042, since: 60, user: "ubuntu" };
const MYAPP_JOURNAL = [
  { ago: 88, unit: "myapp", pid: 1042, level: "info", msg: "[INFO] Worker cluster booted" },
  { ago: 87, unit: "nginx", level: "info", msg: "Reloaded nginx configuration" },
  { ago: 75, unit: "myapp", pid: 1042, level: "warn", msg: "[WARN] Slow query detected: 1.8s on orders" },
  { ago: 62, unit: "myapp", pid: 1042, level: "info", msg: "[INFO] Health check ping 200 OK" },
  { ago: 41, unit: "myapp", pid: 1042, level: "info", msg: "[INFO] Deployment v2.3 completed" },
  { ago: 29, unit: "myapp", pid: 1042, level: "info", msg: "Deployment v2.4 initialized" },
  { ago: 28, unit: "myapp", pid: 1042, level: "error", msg: "TypeError: Cannot read property 'port' of undefined" },
  { ago: 27, unit: "myapp", pid: 1042, level: "error", msg: "[ERROR] Redis connection refused on 127.0.0.1:6379" },
  { ago: 24, unit: "myapp", pid: 1042, level: "warn", msg: "[WARN] Retrying Redis connection (attempt 3/5)" },
  { ago: 12, unit: "myapp", pid: 1042, level: "error", msg: "[ERROR] Redis connection refused on 127.0.0.1:6379" },
  { ago: 6, unit: "myapp", pid: 1042, level: "info", msg: "[INFO] Health check ping 200 OK" },
  { ago: 2, unit: "myapp", pid: 1042, level: "warn", msg: "[WARN] Request queue depth 48" }
];
const MYAPP_LIVE = { myapp: ["[INFO] Health check ping 200 OK", "[INFO] GET /api/orders 200 (41ms)", "[WARN] Request queue depth 52", "[ERROR] Redis connection refused on 127.0.0.1:6379"] };
const CRON_SVC = { desc: "Regular background program processing daemon", state: "active", detail: "running", enabled: true, pid: 640, since: 390, path: "/lib/systemd/system/cron.service", user: "root" };
const CRON_LINES = ["0 2 * * * /home/ubuntu/backup.sh >> /home/ubuntu/backup.log 2>&1", "*/15 * * * * /opt/scripts/healthcheck.sh > /dev/null 2>&1"];
const CRON_JOURNAL = [
  { ago: 1190, unit: "cron", pid: 8910, level: "info", msg: "(ubuntu) CMD (/home/ubuntu/backup.sh >> /home/ubuntu/backup.log 2>&1)" },
  { ago: 750, unit: "cron", pid: 8920, level: "info", msg: "(ubuntu) CMD (/home/ubuntu/backup.sh >> /home/ubuntu/backup.log 2>&1)" },
  { ago: 45, unit: "cron", pid: 9120, level: "info", msg: "(ubuntu) CMD (/opt/scripts/healthcheck.sh > /dev/null 2>&1)" },
  { ago: 30, unit: "cron", pid: 9188, level: "info", msg: "(ubuntu) CMD (/opt/scripts/healthcheck.sh > /dev/null 2>&1)" },
  { ago: 15, unit: "cron", pid: 9231, level: "info", msg: "(ubuntu) CMD (/opt/scripts/healthcheck.sh > /dev/null 2>&1)" }
];
const UBUNTU_USER = { name: "ubuntu", uid: 1000, gid: 1000, primary: "ubuntu", home: "/home/ubuntu", shell: "/bin/bash", gecos: "Ubuntu", groups: ["adm", "cdrom", "sudo", "dip", "plugdev", "lxd", "docker"] };
const BASE_GROUPS = [
  { name: "adm", gid: 4 }, { name: "cdrom", gid: 24 }, { name: "sudo", gid: 27 }, { name: "dip", gid: 30 },
  { name: "plugdev", gid: 46 }, { name: "lxd", gid: 110 }, { name: "docker", gid: 999 }, { name: "ubuntu", gid: 1000 }
];

window.SCENARIO_SETUP = {
  // ---- Topic 2: Navigation ----
  "LNX-NAV-01": { ran: { cmd: "pwd" } },
  "LNX-NAV-02": {
    ran: { cmd: "ls", flags: "la" },
    files: { "/home/ubuntu/.bashrc": "# ~/.bashrc\nexport PATH=$PATH:~/bin\n", "/home/ubuntu/.env.production": "NODE_ENV=production\n" }
  },
  "LNX-NAV-03": { goal: sh => sh.cwd === "/home/ubuntu/projects/backend" },
  "LNX-NAV-04": {
    cwd: "/var/log",
    oldpwd: "/etc/nginx/sites-available",
    goal: sh => sh.cwd === "/etc/nginx/sites-available"
  },

  // ---- Topic 3: Files & directories ----
  "LNX-FILE-01": { goal: sh => sh.isFile("app.log") },
  "LNX-FILE-02": { goal: sh => sh.isDir("project/config/env") },
  "LNX-FILE-03": {
    files: { "config/database.yml": "host: db.internal\nport: 5432\n", "config/server.json": "{\"port\": 8080}\n" },
    goal: sh => sh.isDir("config") && sh.isFile("config/database.yml") && sh.isFile("config/server.json")
      && sh.isFile("config-backup/database.yml") && sh.isFile("config-backup/server.json")
  },
  "LNX-FILE-04": { goal: sh => sh.isFile("app.conf") && !sh.exists("app.conf.old") },
  "LNX-FILE-05": {
    goal: sh => sh.isLink("current") && sh.resolveLink("current") === "/opt/myapp/releases/v2.4"
  },

  // ---- Topic 4: Permissions ----
  "LNX-PERM-01": {
    files: { "deploy.sh": "#!/bin/bash\necho deploying...\n" },
    goal: sh => (sh.mode("deploy.sh") & 0o100) !== 0
  },
  "LNX-PERM-02": { goal: sh => sh.mode("app.conf") === 0o644 },
  "LNX-PERM-03": { goal: sh => sh.mode("/var/www/html") === 0o755 },
  "LNX-PERM-04": {
    goal: sh => { const o = sh.owner("app.log"); return !!o && o.user === "ubuntu" && o.group === "developers"; }
  },

  // ---- Topic 6: Pipes, redirection & streams ----
  "LNX-REDIR-01": {
    goal: sh => (sh.read(".env") || "").trim() === "DATABASE_URL=postgres://localhost:5432/prod"
  },
  "LNX-REDIR-02": {
    files: { "deploy.log": "DEPLOY_STATUS=STARTED\nBUILD=ok\n" },
    goal: sh => { const t = sh.read("deploy.log") || ""; return t.includes("DEPLOY_STATUS=STARTED") && t.trim().endsWith("DEPLOY_STATUS=SUCCESS"); }
  },
  "LNX-REDIR-03": {
    files: { "/etc/nginx/nginx.conf": "worker_processes auto;\n", "/etc/sysctl.conf": "vm.swappiness=10\n", "/etc/resolv.conf": "nameserver 8.8.8.8\n" },
    goal: sh => {
      const l = _last(sh);
      return !!_ranCmd(sh, "find") && /2>\s*\/dev\/null/.test(l.line) && _sameSet(_lines(l.out), CONF_FILES);
    }
  },
  "LNX-REDIR-04": {
    goal: sh => (sh.read("disk-report.txt") || "").includes("Filesystem")
  },

  // ---- Topic 7: Searching & filtering with grep and find ----
  "LNX-GREP-01": {
    files: { "/var/log/syslog": SYSLOG },
    goal: sh => {
      const g = _ranCmd(sh, "grep");
      if (!g || !g.flags.has("i")) return false;
      return _sameSet(_lines(_last(sh).out), _lines(SYSLOG).filter(l => /error/i.test(l)));
    }
  },
  "LNX-GREP-02": {
    files: {
      "config/auth.env": "DB_HOST=localhost\nAPI_KEY=abc123\nSECRET=xyz\n",
      "scripts/test.py": "import os\nkey = os.environ['API_KEY']\nprint(key)\n"
    },
    goal: sh => {
      const g = _ranCmd(sh, "grep");
      if (!g || !g.flags.has("r") || !g.flags.has("n")) return false;
      const out = _lines(_last(sh).out);
      return out.length === 2 && out.every(l => /:\d+:/.test(l)) && out.some(l => l.includes("auth.env")) && out.some(l => l.includes("test.py"));
    }
  },
  "LNX-GREP-03": {
    files: { "app.log": APP_LOG },
    goal: sh => {
      const g = _ranCmd(sh, "grep");
      return !!g && g.flags.has("v") && _sameSet(_lines(_last(sh).out), _lines(APP_LOG).filter(l => !l.includes("DEBUG")));
    }
  },
  "LNX-GREP-04": {
    goal: sh => !!_ranCmd(sh, "find") && _lines(_last(sh).out).join("|") === "/var/log/access_huge.log"
  },
  "LNX-GREP-05": {
    files: { "/etc/nginx/nginx.conf": "worker_processes auto;\n" },
    goal: sh => !!_ranCmd(sh, "find") && _sameSet(_lines(_last(sh).out), CONF_FILES)
  },

  // ---- Topic 8: Text processing & log analysis ----
  "LNX-TEXT-01": {
    files: { "/var/log/myapp.log": APP_LOG },
    goal: sh => { const t = _ranCmd(sh, "tail"); return !!t && (t.flags.has("f") || t.flags.has("F")) && t.args.some(a => a.endsWith("myapp.log")); }
  },
  "LNX-TEXT-02": {
    files: { "access.log": ACCESS_LOG },
    goal: sh => !!_ranCmd(sh, "awk") && _lines(_last(sh).out).join("|") === _lines(ACCESS_LOG).map(l => l.split(" ")[0]).join("|")
  },
  "LNX-TEXT-03": {
    // one line holds "localhost" twice, so only the global (g) substitution fully replaces it
    files: { "config.env": "DB_HOST=localhost\nCACHE=localhost:6379\nPROXY=localhost,localhost\nAPP_ENV=prod\n" },
    goal: sh => {
      if (!_ranCmd(sh, "sed")) return false;
      const out = _last(sh).out;
      const fileDone = !(sh.read("config.env") || "").includes("localhost");
      const printed = out.includes("127.0.0.1") && !out.includes("localhost");
      return printed || fileDone;
    }
  },
  "LNX-TEXT-04": {
    files: { "access.log": ACCESS_LOG },
    goal: sh => {
      const l = _last(sh);
      const u = l && l.cmds.find(c => c.name === "uniq");
      return !!u && u.flags.has("c") && l.cmds.some(c => c.name === "sort")
        && _lines(l.out).length > 0 && _lines(l.out).every(x => /^\s*\d+\s+\S/.test(x));
    }
  },
  "LNX-TEXT-05": {
    files: { "/etc/passwd": PASSWD },
    goal: sh => !!_ranCmd(sh, "cut") && _lines(_last(sh).out).join("|") === _lines(PASSWD).map(l => l.split(":")[0]).join("|")
  },

  // =========================================================================================
  // Scenarios below run on the simulated system (system.js) and draw a topic-specific live panel
  // (viz.js) instead of the filesystem tree.  viz: processes | services | journal | kernel | cron | users
  // =========================================================================================

  // ---- Topic 9: Processes ----
  "LNX-PROC-01": {
    viz: "processes",
    system: { processes: [...BASE_PROCS, ...NGINX_PROCS, P(4512, "node", 3.1, 4.2, "node /opt/app/server.js", "node")] },
    goal: sh => {
      const l = _last(sh); if (!l) return false;
      const ps = l.cmds.find(c => c.name === "ps"), gr = l.cmds.find(c => c.name === "grep"), pg = l.cmds.find(c => c.name === "pgrep");
      const viaPs = !!ps && !!gr && gr.args.some(a => /nginx/.test(a));
      const viaPgrep = !!pg && pg.args.some(a => /nginx/.test(a));
      return (viaPs || viaPgrep) && /nginx/.test(l.out) && !/node/.test(l.out);
    }
  },
  "LNX-PROC-02": {
    viz: "processes",
    system: { processes: [...BASE_PROCS, ...NGINX_PROCS, P(4512, "node", 98.4, 6.2, "node server.js", "node"), P(4890, "ubuntu", 12.5, 1.9, "python3 /opt/app/etl.py", "python3"), P(5001, "postgres", 7.7, 3.4, "postgres: checkpointer", "postgres"), P(5120, "ubuntu", 2.2, 0.8, "redis-server *:6379", "redis-server")] },
    goal: sh => {
      const l = _last(sh); if (!l) return false;
      const ps = l.cmds.find(c => c.name === "ps"), head = l.cmds.find(c => c.name === "head");
      if (!ps || !head || !ps.args.some(a => /sort/.test(a) && /cpu/.test(a)) && !ps.args.join(" ").match(/--sort\s+-%cpu/)) return false;
      const lines = _lines(l.out);
      return lines.length <= 10 && lines.length >= 2 && /node server\.js/.test(lines[1]);
    }
  },
  "LNX-PROC-03": {
    viz: "processes",
    system: { processes: [...BASE_PROCS, P(1042, "ubuntu", 4.8, 2.1, "python3 batch_worker.py --queue=invoices", "python3")] },
    goal: sh => sh.sys.signals.some(s => s.pid === 1042 && s.sig === 15 && !s.survived) && !sh.sys.processes.some(p => p.pid === 1042)
  },
  "LNX-PROC-04": {
    // the miner ignores SIGTERM: `kill 9999` leaves it running, only SIGKILL (-9) removes it
    viz: "processes",
    system: { processes: [...BASE_PROCS, P(9999, "ubuntu", 100.0, 8.8, "/tmp/.cache/kworkerds -o pool.example.org:3333", "kworkerds", { ignoresTerm: true, stat: "R" })] },
    goal: sh => sh.sys.signals.some(s => s.pid === 9999 && s.sig === 9) && !sh.sys.processes.some(p => p.pid === 9999)
  },
  "LNX-PROC-05": {
    // comm is "python3", so `pkill celery_worker` matches nothing: you need `pkill -f`
    viz: "processes",
    system: { processes: [...BASE_PROCS, P(3101, "ubuntu", 0.3, 1.1, "python3 /opt/app/celery_worker.py --queue=emails", "python3"), P(3102, "ubuntu", 0.2, 1.1, "python3 /opt/app/celery_worker.py --queue=reports", "python3"), P(3103, "ubuntu", 0.2, 1.1, "python3 /opt/app/celery_worker.py --queue=sms", "python3"), P(3104, "ubuntu", 0.2, 1.1, "python3 /opt/app/celery_worker.py --queue=audit", "python3"), P(3200, "ubuntu", 1.4, 2.6, "python3 /opt/app/api.py", "python3")] },
    goal: sh => !sh.sys.processes.some(p => /celery_worker\.py/.test(p.cmd)) && sh.sys.processes.some(p => /api\.py/.test(p.cmd))
  },

  // ---- Topic 10: Services & systemd ----
  "LNX-SVC-01": {
    viz: "services",
    system: {
      processes: [...BASE_PROCS],
      services: {
        nginx: { desc: "A high performance web server and a reverse proxy server", state: "failed", detail: "exit-code", enabled: true, pid: null, since: 12, path: "/lib/systemd/system/nginx.service", exec: "/usr/sbin/nginx -g 'daemon on; master_process on;'", user: "root", cmdline: "nginx: master process /usr/sbin/nginx" },
        myapp: { desc: "MyApp API server", state: "active", detail: "running", enabled: true, pid: 4512, since: 180, user: "ubuntu", cmdline: "node /opt/app/server.js" }
      },
      journal: [
        { ago: 13, unit: "nginx", level: "info", msg: "Starting A high performance web server and a reverse proxy server..." },
        { ago: 12, unit: "nginx", level: "error", msg: "nginx: [emerg] bind() to 0.0.0.0:80 failed (98: Address already in use)" },
        { ago: 12, unit: "nginx", level: "error", msg: "nginx.service: Failed with result 'exit-code'." }
      ]
    },
    goal: sh => { const c = _ranCmd(sh, "systemctl"); return !!c && c.args.includes("status") && c.args.some(a => /^nginx(\.service)?$/.test(a)); }
  },
  "LNX-SVC-02": {
    viz: "services",
    system: { processes: [...BASE_PROCS, P(2210, "ubuntu", 1.2, 2.0, "node /opt/app/server.js", "node")], services: { myapp: { desc: "MyApp API server", state: "active", detail: "running", enabled: true, pid: 2210, since: 125, user: "ubuntu", cmdline: "node /opt/app/server.js", restarts: 0 } },
      journal: [{ ago: 125, unit: "myapp", pid: 2210, level: "info", msg: "Server listening on :3000" }] },
    goal: sh => { const s = sh.sys.services.myapp; return !!s && (s.restarts || 0) >= 1 && s.state === "active"; }
  },
  "LNX-SVC-03": {
    viz: "services",
    system: { processes: [...BASE_PROCS, P(2210, "ubuntu", 1.2, 2.0, "node /opt/app/server.js", "node")], services: { myapp: { desc: "MyApp API server", state: "active", detail: "running", enabled: false, pid: 2210, since: 125, user: "ubuntu", cmdline: "node /opt/app/server.js" } } },
    goal: sh => !!sh.sys.services.myapp && sh.sys.services.myapp.enabled === true
  },
  "LNX-SVC-04": {
    viz: "services",
    system: { processes: [...BASE_PROCS, P(2210, "ubuntu", 1.2, 2.0, "node /opt/app/server.js", "node")], services: { myapp: { desc: "MyApp API server", state: "active", detail: "running", enabled: true, pid: 2210, since: 125, user: "ubuntu", cmdline: "node /opt/app/server.js", stale: true } } },
    goal: sh => !!sh.sys.services.myapp && sh.sys.services.myapp.stale === false
  },

  // ---- Topic 11: Logs & journal ----
  "LNX-LOG-01": {
    viz: "journal",
    system: { services: { myapp: JOURNAL_SVC }, journal: MYAPP_JOURNAL, liveLines: MYAPP_LIVE },
    goal: sh => { const j = sh.sys.lastJournal; return !!j && j.unit === "myapp" && j.lines === 100 && j.noPager; }
  },
  "LNX-LOG-02": {
    viz: "journal",
    system: { services: { myapp: JOURNAL_SVC }, journal: MYAPP_JOURNAL, liveLines: MYAPP_LIVE },
    goal: sh => { const j = sh.sys.lastJournal; return !!j && j.unit === "myapp" && j.sinceMin === 30; }
  },
  "LNX-LOG-03": {
    viz: "journal",
    system: { services: { myapp: JOURNAL_SVC }, journal: MYAPP_JOURNAL, liveLines: MYAPP_LIVE },
    goal: sh => { const j = sh.sys.lastJournal; return !!j && j.unit === "myapp" && j.follow; }
  },
  "LNX-LOG-04": {
    viz: "kernel",
    system: {
      kernel: [
        { ago: 480, msg: "Linux version 5.15.0-1052-aws (buildd@lcy02-amd64) #57-Ubuntu SMP" },
        { ago: 479, msg: "EXT4-fs (nvme0n1p1): mounted filesystem with ordered data mode" },
        { ago: 95, msg: "TCP: request_sock_TCP: Possible SYN flooding on port 3000. Sending cookies." },
        { ago: 18, msg: "Out of memory: Killed process 4512 (node) total-vm:428900kB, anon-rss:398000kB, file-rss:0kB" },
        { ago: 18, msg: "oom_reaper: reaped process 4512 (node), now anon-rss:0kB, file-rss:0kB" }
      ]
    },
    goal: sh => { const d = _ranCmd(sh, "dmesg"); return !!d && (d.flags.has("T") || d.args.includes("--ctime")); }
  },

  // ---- Topic 12: Cron ----
  "LNX-CRON-01": {
    viz: "cron",
    system: { services: { cron: CRON_SVC }, cron: CRON_LINES, journal: CRON_JOURNAL },
    goal: sh => { const c = _ranCmd(sh, "crontab"); return !!c && c.args.includes("-l"); }
  },
  "LNX-CRON-02": {
    viz: "cron",
    system: { services: { cron: CRON_SVC }, cron: CRON_LINES, journal: CRON_JOURNAL },
    goal: sh => { const c = _ranCmd(sh, "systemctl"); return !!c && c.args.includes("status") && c.args.some(a => /^cron(d)?(\.service)?$/.test(a)); }
  },
  "LNX-CRON-03": {
    viz: "cron",
    system: { services: { cron: CRON_SVC }, cron: CRON_LINES, journal: CRON_JOURNAL },
    goal: sh => { const j = sh.sys.lastJournal; return !!j && j.unit === "cron" && j.sinceMin === 870; }
  },

  // ---- Topic 5: Users, groups & privileges ----
  "LNX-USER-01": {
    viz: "users",
    system: { users: [UBUNTU_USER], groups: BASE_GROUPS },
    goal: sh => !!sh.sys.userByName("developer") && sh.isDir("/home/developer")
  },
  "LNX-USER-02": {
    viz: "users",
    system: { users: [UBUNTU_USER, { name: "developer", uid: 1001, gid: 1001, primary: "developer", home: "/home/developer", shell: "/bin/bash", gecos: "", groups: ["docker"] }],
      groups: [...BASE_GROUPS, { name: "developer", gid: 1001 }, { name: "developers", gid: 1002 }] },
    goal: sh => { const u = sh.sys.userByName("developer"); return !!u && u.groups.includes("developers") && u.groups.includes("docker"); }
  },
  "LNX-USER-03": {
    viz: "users",
    system: { users: [UBUNTU_USER], groups: BASE_GROUPS },
    goal: sh => { const l = _last(sh); return !!l && _lines(l.out).join("|") === "ubuntu:x:1000:1000:Ubuntu:/home/ubuntu:/bin/bash"; }
  },
  "LNX-USER-04": {
    viz: "users",
    system: { users: [UBUNTU_USER], groups: BASE_GROUPS },
    goal: sh => { const l = _last(sh); return !!l && l.cmds.some(c => c.name === "groups" || c.name === "id") && _lines(l.out).join("|") === "ubuntu adm cdrom sudo dip plugdev lxd docker"; }
  }
};

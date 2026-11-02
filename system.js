/**
 * CmdCraft simulated system state: processes, systemd services, the journal, kernel log, users/groups and cron.
 *
 * A scenario seeds it through `system:` in goals.js. VirtualShell (shell.js) owns one SystemState (`sh.sys`)
 * and routes commands such as ps, kill, systemctl, journalctl, useradd and crontab to it. Every command mutates
 * this state for real, and the live panels (viz.js) redraw from it. Nothing here touches the network or the page.
 */
(function (root) {
  // Virtual wall clock used for journal and kernel timestamps.
  const CLOCK = { month: "Oct", day: 29, hour: 14, minute: 30, year: 2026, weekday: "Wed", host: "ip-172-31-42-12" };
  const NOW_MIN = CLOCK.hour * 60 + CLOCK.minute;
  const pad2 = n => String(n).padStart(2, "0");
  const clockLabel = (minutesAgo, sec) => {
    const total = Math.round(NOW_MIN * 60 - minutesAgo * 60 + (sec || 0));
    const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
    return `${CLOCK.month} ${CLOCK.day} ${pad2(h)}:${pad2(m)}:${pad2(s)}`;
  };
  const fullStamp = (minutesAgo) => {
    const label = clockLabel(minutesAgo).split(" ");
    return `${CLOCK.weekday} ${CLOCK.year}-10-${pad2(CLOCK.day)} ${label[2]} UTC`;
  };

  const SIGNALS = { HUP: 1, INT: 2, QUIT: 3, KILL: 9, USR1: 10, USR2: 12, TERM: 15, CONT: 18, STOP: 19 };
  const SIGNAME = Object.fromEntries(Object.entries(SIGNALS).map(([k, v]) => [v, k]));

  const clone = v => JSON.parse(JSON.stringify(v));

  // Splits an argument list into option flags and operands. `valueOpts` lists short options that take a value.
  function parseOpts(args, valueOpts) {
    const flags = new Set(), values = {}, operands = [];
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (/^--[\w-]+=/.test(a)) { const [k, v] = a.slice(2).split(/=(.*)/s); values[k] = v; flags.add(k); continue; }
      if (/^--[\w-]+$/.test(a)) { flags.add(a.slice(2)); continue; }
      if (/^-[A-Za-z]+$/.test(a)) {
        for (let j = 1; j < a.length; j++) {
          const f = a[j];
          flags.add(f);
          if (valueOpts.includes(f)) {
            if (j < a.length - 1) values[f] = a.slice(j + 1); else values[f] = args[++i];
            break;
          }
        }
        continue;
      }
      operands.push(a);
    }
    return { flags, values, operands };
  }

  class SystemState {
    constructor(seed) {
      seed = clone(seed || {});
      this.processes = seed.processes || [];
      this.services = seed.services || {};
      this.journal = seed.journal || [];       // {ago (minutes), unit, pid, level, msg}
      this.kernel = seed.kernel || [];         // {ago, msg}
      this.users = seed.users || [];           // {name, uid, gid, primary, home, shell, gecos, groups[]}
      this.groups = seed.groups || [];         // {name, gid}
      this.cron = seed.cron || [];
      this.liveLines = seed.liveLines || {};   // unit -> [messages] cycled by `journalctl -f`
      this.signals = [];
      this.lastJournal = null;
      this.followRequest = null;
      this.highlight = new Set();
      this.lastChanges = { changed: new Set(), removed: [] };
      this.liveTick = 0;
      this.nextPid = Math.max(2000, ...this.processes.map(p => p.pid + 1));
      this.nextUid = Math.max(1000, ...this.users.map(u => u.uid + 1));
      this.nextGid = Math.max(1000, ...this.groups.map(g => g.gid + 1), ...this.users.map(u => u.gid + 1));
      this.currentUser = "ubuntu";
      this.commands = {
        ps: this.cmd_ps, pgrep: this.cmd_pgrep, pkill: this.cmd_pkill, kill: this.cmd_kill,
        systemctl: this.cmd_systemctl, journalctl: this.cmd_journalctl, dmesg: this.cmd_dmesg, crontab: this.cmd_crontab,
        useradd: this.cmd_useradd, usermod: this.cmd_usermod, groupadd: this.cmd_groupadd,
        groups: this.cmd_groups, id: this.cmd_id, getent: this.cmd_getent,
        userdel: this.cmd_userdel, groupdel: this.cmd_groupdel, passwd: this.cmd_passwd, who: this.cmd_who, w: this.cmd_w, last: this.cmd_last
      };
      this.ext = {};
      this.extraState = null;
      (SystemState.extensions || []).forEach(init => init(this, seed));
    }

    handles(name) {
      if (this.ext[name]) return this.ext[name].has(this);
      return Object.prototype.hasOwnProperty.call(this.commands, name) && this.hasData(name);
    }

    // A command is only simulated when the scenario seeded the data it needs.
    hasData(name) {
      if (["ps", "pgrep", "pkill", "kill"].includes(name)) return this.processes.length > 0;
      if (name === "systemctl") return Object.keys(this.services).length > 0;
      if (name === "journalctl") return this.journal.length > 0;
      if (name === "dmesg") return this.kernel.length > 0;
      if (name === "crontab") return true;
      return this.users.length > 0;
    }

    // Syntax each command understands; anything else is left to the scenario's own matcher.
    supported(name, args) {
      if (this.ext[name] && this.ext[name].supported) return this.ext[name].supported(args, this);
      if (name === "crontab") return args.length === 1 && (["-l", "-r", "-e", "-"].includes(args[0]) || !args[0].startsWith("-"));
      if (name === "systemctl") {
        const sub = args.find(a => !a.startsWith("-"));
        if (!sub && args.includes("--failed")) return true;
        return ["status", "start", "stop", "restart", "reload", "enable", "disable", "daemon-reload", "is-active", "is-enabled", "is-failed", "get-default", "list-units", "cat"].includes(sub);
      }
      if (name === "journalctl") {
        const ok = ["-u", "--unit", "-n", "--lines", "--no-pager", "--since", "--until", "-f", "--follow", "-r", "-b", "-p", "-k", "--dmesg", "--disk-usage", "--list-boots"];
        const takesValue = ["-u", "--unit", "-n", "--lines", "--since", "--until", "-p"];
        for (let i = 0; i < args.length; i++) {
          const a = args[i];
          if (a === "-b" && /^-?\d+$/.test(args[i + 1] || "")) { i++; continue; }   // -b -1 : previous boot
          if (takesValue.includes(a)) { i++; continue; }      // the next token is its value, even if it starts with "-"
          if (!a.startsWith("-")) continue;
          if (!(ok.includes(a.split("=")[0]) || /^-n\d+$/.test(a) || /^-u\S+$/.test(a))) return false;
        }
        return true;
      }
      return true;
    }

    command(name) { return this.ext[name] ? this.ext[name].fn : this.commands[name]; }

    // ---- change tracking for the live panels ----
    snapshot() {
      const snap = new Map();
      this.processes.forEach(p => snap.set("proc:" + p.pid, { sig: JSON.stringify(p), obj: clone(p), kind: "process" }));
      Object.entries(this.services).forEach(([n, s]) => snap.set("svc:" + n, { sig: JSON.stringify(s), obj: Object.assign({ name: n }, clone(s)), kind: "service" }));
      this.users.forEach(u => snap.set("user:" + u.name, { sig: JSON.stringify(u), obj: clone(u), kind: "user" }));
      this.groups.forEach(g => snap.set("group:" + g.name, { sig: JSON.stringify(g) + this.membersOf(g.name).join(","), obj: clone(g), kind: "group" }));
      this.cron.forEach((c, i) => snap.set("cron:" + i, { sig: c, obj: { line: c }, kind: "cron" }));
      return snap;
    }

    beginExec() { this.highlight = new Set(); this.lastJournal = null; return this.snapshot(); }

    finishExec(before) {
      const after = this.snapshot();
      const changed = new Set();
      after.forEach((v, k) => { const b = before.get(k); if (!b || b.sig !== v.sig) changed.add(k); });
      const removed = [];
      before.forEach((v, k) => { if (!after.has(k)) removed.push({ key: k, kind: v.kind, obj: v.obj }); });
      this.lastChanges = { changed, removed };
    }

    // Fingerprint used to tell "read-only" commands from ones that changed something.
    stateKey() {
      return JSON.stringify([this.processes, this.services, this.users, this.groups, this.cron, this.signals.length, this.extraState ? this.extraState() : null]);
    }

    membersOf(group) { return this.users.filter(u => u.primary === group || (u.groups || []).includes(group)).map(u => u.name); }
    userByName(n) { return this.users.find(u => u.name === n); }
    groupByName(n) { return this.groups.find(g => g.name === n); }
    gidOf(n) { const g = this.groupByName(n); return g ? g.gid : null; }

    log(unit, level, msg, pid) { this.journal.push({ ago: 0, unit, pid: pid || null, level, msg }); }

    // ---------- processes ----------
    fmtProc(p) {
      return `${p.user.padEnd(8)} ${String(p.pid).padStart(7)} ${p.cpu.toFixed(1).padStart(4)} ${p.mem.toFixed(1).padStart(4)} ${String(p.vsz).padStart(7)} ${String(p.rss).padStart(6)} ${(p.tty || "?").padEnd(8)} ${(p.stat || "Ss").padEnd(4)} ${(p.start || "08:00").padEnd(5)} ${(p.time || "0:00").padStart(6)} ${p.cmd}`;
    }

    cmd_ps(args) {
      const { flags, values, operands } = parseOpts(args, []);
      const raw = args.join(" ");
      let procs = [...this.processes].sort((a, b) => a.pid - b.pid);
      const sort = (args.find(a => a.startsWith("--sort=")) || "").slice(7) || (args.indexOf("--sort") !== -1 ? args[args.indexOf("--sort") + 1] : "");
      if (sort) {
        const desc = sort.startsWith("-");
        const key = sort.replace(/^[-+]/, "").replace("%", "");
        const field = { cpu: "cpu", mem: "mem", pid: "pid", rss: "rss", vsz: "vsz" }[key] || "pid";
        procs.sort((a, b) => (desc ? b[field] - a[field] : a[field] - b[field]));
      }
      const pi = args.indexOf("-p");
      if (pi !== -1) { const want = String(args[pi + 1] || "").split(",").map(Number); procs = procs.filter(p => want.includes(p.pid)); }
      const oi = args.findIndex(a => a === "-o" || /^-[a-z]*o$/.test(a) || a.startsWith("-o") && a.length > 2);
      if (oi !== -1) {
        const spec = args[oi].length > 2 && !/^-[a-z]*o$/.test(args[oi]) ? args[oi].slice(2) : String(args[oi + 1] || "pid,comm");
        const cols = spec.split(",").map(c => c.trim().toLowerCase());
        const H = { pid: "PID", ppid: "PPID", user: "USER", "%cpu": "%CPU", pcpu: "%CPU", "%mem": "%MEM", pmem: "%MEM", vsz: "VSZ", rss: "RSS", stat: "STAT", comm: "COMMAND", cmd: "CMD", args: "COMMAND", etime: "ELAPSED", tty: "TT" };
        const V = { pid: p => p.pid, ppid: p => p.ppid || 1, user: p => p.user, "%cpu": p => p.cpu.toFixed(1), pcpu: p => p.cpu.toFixed(1), "%mem": p => p.mem.toFixed(1), pmem: p => p.mem.toFixed(1), vsz: p => p.vsz, rss: p => p.rss, stat: p => p.stat || "S", comm: p => p.comm || p.cmd.split(" ")[0], cmd: p => p.cmd, args: p => p.cmd, etime: p => "06:30:00", tty: p => p.tty || "?" };
        const use = cols.filter(c => H[c]);
        procs.forEach(p => this.highlight.add(p.pid));
        const rowsO = procs.map(p => use.map(c => String(V[c](p))));
        const w = use.map((c, i) => Math.max(H[c].length, ...rowsO.map(r => r[i].length)));
        const fmt = r => r.map((cell, i) => (i === use.length - 1 ? cell : (["comm", "cmd", "args", "user", "stat"].includes(use[i]) ? cell.padEnd(w[i]) : cell.padStart(w[i])))).join(" ");
        return { out: fmt(use.map(c => H[c])) + "\n" + rowsO.map(fmt).join("\n") + (rowsO.length ? "\n" : "") };
      }
      const wide = flags.has("a") || flags.has("e") || flags.has("x") || /\baux\b|-ef/.test(raw);
      if (!wide && !sort) return { out: "    PID TTY          TIME CMD\n   2300 pts/0    00:00:00 bash\n   2455 pts/0    00:00:00 ps\n" };
      procs.forEach(p => this.highlight.add(p.pid));
      if (flags.has("f") && flags.has("e")) {
        const rows = procs.map(p => `${p.user.padEnd(8)} ${String(p.pid).padStart(7)} ${String(p.ppid || 1).padStart(7)}  0 ${(p.start || "08:00").padEnd(5)} ${(p.tty || "?").padEnd(8)} ${(p.time || "0:00").padStart(8)} ${p.cmd}`);
        return { out: "UID          PID    PPID  C STIME TTY          TIME CMD\n" + rows.join("\n") + "\n" };
      }
      return { out: "USER         PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND\n" + procs.map(p => this.fmtProc(p)).join("\n") + "\n" };
    }

    matchProcs(pattern, full) {
      let re;
      try { re = new RegExp(pattern); } catch (e) { re = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")); }
      return this.processes.filter(p => re.test(full ? p.cmd : (p.comm || p.cmd.split(" ")[0])));
    }

    cmd_pgrep(args) {
      const { flags, operands } = parseOpts(args, []);
      if (!operands.length) return { err: "pgrep: no matching criteria specified\n" };
      const hits = this.matchProcs(operands[0], flags.has("f"));
      hits.forEach(p => this.highlight.add(p.pid));
      const line = p => flags.has("a") ? `${p.pid} ${p.cmd}` : flags.has("l") ? `${p.pid} ${p.comm || p.cmd.split(" ")[0]}` : String(p.pid);
      return { out: hits.map(line).join("\n") + (hits.length ? "\n" : "") };
    }

    deliver(proc, sig) {
      this.signals.push({ pid: proc.pid, sig, survived: false });
      const entry = this.signals[this.signals.length - 1];
      if (sig === 19) { proc.stat = "T"; return; }
      if (sig === 18) { proc.stat = "S"; return; }
      if ((sig === 15 || sig === 2 || sig === 1) && proc.ignoresTerm) { entry.survived = true; return; }
      if (sig === 1 && !proc.dieOnHup) { entry.survived = true; return; }
      this.processes = this.processes.filter(p => p.pid !== proc.pid);
      const svc = Object.entries(this.services).find(([, s]) => s.pid === proc.pid);
      if (svc) {
        svc[1].pid = null;
        svc[1].state = sig === 15 ? "inactive" : "failed";
        svc[1].detail = sig === 15 ? "dead" : "signal";
        svc[1].since = 0;
        this.log(svc[0], sig === 15 ? "info" : "error", sig === 15 ? `Stopped ${svc[1].desc}.` : `${svc[0]}.service: Main process exited, code=killed, status=${sig}/${SIGNAME[sig] || sig}`);
      }
    }

    cmd_kill(args) {
      let sig = 15;
      const pids = [];
      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === "-s" || a === "-n") { sig = this.parseSig(args[++i]); continue; }
        if (/^-/.test(a)) { sig = this.parseSig(a.slice(1)); continue; }
        pids.push(a);
      }
      if (args.includes("-l")) return { out: Object.entries(SIGNALS).sort((a, b) => a[1] - b[1]).map(([n, v]) => v + ") SIG" + n).join("\n") + "\n" };
      if (!pids.length) return { err: "kill: usage: kill [-s sigspec | -n signum | -sigspec] pid | jobspec ... or kill -l [sigspec]\n" };
      if (sig === null) return { err: "bash: kill: invalid signal specification\n" };
      let err = "";
      pids.forEach(x => {
        const proc = this.processes.find(p => String(p.pid) === x);
        if (!proc) { err += `bash: kill: (${x}) - No such process\n`; return; }
        this.highlight.add(proc.pid);
        this.deliver(proc, sig);
      });
      return { err };
    }

    parseSig(token) {
      if (token === undefined) return null;
      if (/^\d+$/.test(token)) return parseInt(token, 10);
      const name = token.toUpperCase().replace(/^SIG/, "");
      return SIGNALS[name] || null;
    }

    cmd_pkill(args) {
      let sig = 15, full = false, pattern = null;
      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === "-f") { full = true; continue; }
        if (/^-\d+$/.test(a) || /^-(SIG)?[A-Z]+$/.test(a)) { sig = this.parseSig(a.slice(1)); continue; }
        if (a.startsWith("-")) continue;
        pattern = a;
      }
      if (!pattern) return { err: "pkill: no matching criteria specified\n" };
      this.matchProcs(pattern, full).forEach(p => { this.highlight.add(p.pid); this.deliver(p, sig || 15); });
      return {};
    }

    // ---------- systemd ----------
    unitName(arg) { return String(arg || "").replace(/\.service$/, "").replace(/^crond$/, "cron"); }

    statusText(name) {
      const s = this.services[name];
      const dot = s.state === "active" ? "●" : s.state === "failed" ? "×" : "○";
      const path = s.path || `/etc/systemd/system/${name}.service`;
      let active;
      if (s.state === "active") active = `active (running) since ${fullStamp(s.since || 0)}; ${s.since >= 60 ? Math.floor(s.since / 60) + "h" : (s.since || 0) + "min"} ago`;
      else if (s.state === "failed") active = `failed (Result: ${s.detail === "signal" ? "signal" : "exit-code"}) since ${fullStamp(s.since || 0)}; ${s.since || 0}min ago`;
      else active = `inactive (dead)${s.since ? " since " + fullStamp(s.since) : ""}`;
      let out = "";
      if (s.stale) out += `Warning: The unit file, source configuration file or drop-ins of ${name}.service changed on disk. Run 'systemctl daemon-reload' to reload units.\n`;
      out += `${dot} ${name}.service - ${s.desc}\n     Loaded: loaded (${path}; ${s.enabled ? "enabled" : "disabled"}; vendor preset: enabled)\n     Active: ${active}\n`;
      if (s.state === "failed" && s.exec) out += `    Process: ${s.pid || 1042} ExecStart=${s.exec} (code=exited, status=1/FAILURE)\n`;
      if (s.pid) out += `   Main PID: ${s.pid} (${(this.processes.find(p => p.pid === s.pid) || {}).comm || name})\n`;
      const recent = this.journal.filter(j => j.unit === name).slice(-3);
      if (recent.length) out += "\n" + recent.map(j => this.fmtJournal(j)).join("\n") + "\n";
      return out;
    }

    startService(name) {
      const s = this.services[name];
      const proc = { pid: this.nextPid++, user: s.user || "root", cpu: 0.1, mem: 0.3, vsz: 30000, rss: 6000, tty: "?", stat: "Ss", start: pad2(CLOCK.hour) + ":" + pad2(CLOCK.minute), time: "0:00", cmd: s.cmdline || s.exec || name, comm: name };
      this.processes.push(proc);
      s.pid = proc.pid; s.state = "active"; s.detail = "running"; s.since = 0;
      this.highlight.add(proc.pid);
      return proc;
    }

    stopService(name) {
      const s = this.services[name];
      if (s.pid) this.processes = this.processes.filter(p => p.pid !== s.pid);
      s.pid = null; s.state = "inactive"; s.detail = "dead"; s.since = 0;
    }

    cmd_systemctl(args) {
      const { flags, operands } = parseOpts(args, []);
      const sub = operands[0];
      if (!sub && flags.has("failed") || (sub === "list-units" && flags.has("failed"))) {
        const bad = Object.entries(this.services).filter(([, s]) => s.state === "failed");
        let out = bad.length ? "  UNIT            LOAD   ACTIVE SUB    DESCRIPTION\n" + bad.map(([n, s]) => "● " + (n + ".service").padEnd(15) + " loaded failed failed " + s.desc).join("\n") + "\n" : "";
        out += "\nLOAD   = Reflects whether the unit definition was properly loaded.\nACTIVE = The high-level unit activation state, i.e. generalization of SUB.\nSUB    = The low-level unit state, as reported by the underlying type.\n\n" + bad.length + " loaded units listed.\n";
        return { out };
      }
      if (sub === "list-units") {
        const rows = Object.entries(this.services).map(([n, s]) => "  " + (n + ".service").padEnd(18) + " loaded " + (s.state === "active" ? "active running" : s.state === "failed" ? "failed failed " : "inactive dead   ") + " " + s.desc);
        return { out: "  UNIT               LOAD   ACTIVE SUB     DESCRIPTION\n" + rows.join("\n") + "\n\n" + rows.length + " loaded units listed.\n" };
      }
      if (sub === "get-default") return { out: (this.defaultTarget || "multi-user.target") + "\n" };
      if (sub === "daemon-reload") {
        Object.values(this.services).forEach(s => { s.stale = false; });
        this.log("systemd", "info", "Reloading.");
        return {};
      }
      const name = this.unitName(operands[1]);
      if (!operands[1]) return { err: "Too few arguments.\n" };
      const s = this.services[name];
      if (!s) {
        if (sub === "is-active") return { out: "inactive\n" };
        return { err: `Unit ${name}.service could not be found.\n` };
      }
      switch (sub) {
        case "status": return { out: this.statusText(name) };
        case "is-active": return { out: s.state + "\n" };
        case "is-enabled": return { out: (s.enabled ? "enabled" : "disabled") + "\n" };
        case "cat": {
          const sh = arguments[3];
          const unit = sh && sh.lookup("/etc/systemd/system/" + name + ".service", true);
          if (!unit) return { err: "No files found for " + name + ".service.\n", code: 1 };
          return { out: "# /etc/systemd/system/" + name + ".service\n" + (unit.content || "") };
        }
        case "is-failed": return { out: (s.state === "failed" ? "failed" : s.state) + "\n", code: s.state === "failed" ? 0 : 1 };
        case "reload":
          if (s.state !== "active") return { err: "Failed to reload " + name + ".service: Unit " + name + ".service is not active.\n", code: 1 };
          this.log(name, "info", "Reloaded " + s.desc + ".");
          s.reloads = (s.reloads || 0) + 1;
          return {};
        case "start":
          if (s.state !== "active") { this.startService(name); this.log(name, "info", `Started ${s.desc}.`); }
          return {};
        case "stop":
          if (s.state === "active") { this.stopService(name); this.log(name, "info", `Stopped ${s.desc}.`); }
          return {};
        case "restart": {
          const warn = s.stale ? `Warning: The unit file, source configuration file or drop-ins of ${name}.service changed on disk. Run 'systemctl daemon-reload' to reload units.\n` : "";
          const wasRunning = s.state === "active";
          if (wasRunning) { this.stopService(name); this.log(name, "info", `Stopping ${s.desc}...`); }
          this.startService(name);
          s.restarts = (s.restarts || 0) + 1;
          this.log(name, "info", `Started ${s.desc}.`, s.pid);
          return { err: warn };
        }
        case "enable": {
          if (!s.enabled) s.enabled = true;
          if (flags.has("now") && s.state !== "active") this.startService(name);
          return { out: `Created symlink /etc/systemd/system/multi-user.target.wants/${name}.service → ${s.path || "/etc/systemd/system/" + name + ".service"}.\n` };
        }
        case "disable":
          s.enabled = false;
          return { out: `Removed /etc/systemd/system/multi-user.target.wants/${name}.service.\n` };
        default: return { err: `Unknown command verb ${sub}.\n` };
      }
    }

    // ---------- journal & kernel ----------
    fmtJournal(j) {
      const tag = j.pid ? `${j.unit}[${j.pid}]` : j.unit;
      return `${clockLabel(j.ago)} ${CLOCK.host} ${tag}: ${j.msg}`;
    }

    parseSince(text) {
      const t = String(text).trim().toLowerCase();
      if (t === "today") return NOW_MIN;
      if (t === "yesterday") return NOW_MIN + 24 * 60;
      let m = /^-?(\d+)\s*(m|min|mins|minute|minutes|h|hour|hours)(\s+ago)?$/.exec(t);
      if (m) return parseInt(m[1], 10) * (m[2][0] === "h" ? 60 : 1);
      return null;
    }

    cmd_journalctl(args) {
      if (args.includes("--disk-usage")) return { out: "Archived and active journals take up 256.0M in the file system.\n" };
      if (args.includes("--list-boots")) return { out: " -1 7c1d3a96b0b24c58b3a7f9c2d8e41a05 Tue 2026-10-28 07:58:11 UTC—Wed 2026-10-29 07:59:40 UTC\n  0 b2f8e0a1c4d94c6e8f31a7d5c9e02b44 Wed 2026-10-29 08:00:02 UTC—Wed 2026-10-29 14:30:00 UTC\n" };
      const o = parseOpts(args.filter((a, i) => !(a === "-b" && /^-?\d+$/.test(args[i + 1] || "")) && !(/^-\d+$/.test(a) && args[i - 1] === "-b")), ["u", "n", "p"]);
      const bi = args.indexOf("-b");
      const bootSel = bi === -1 ? null : (/^-?\d+$/.test(args[bi + 1] || "") ? parseInt(args[bi + 1], 10) : 0);
      const PRIO = { emerg: 0, alert: 1, crit: 2, err: 3, warning: 4, notice: 5, info: 6, debug: 7 };
      const LEVELPRIO = { error: 3, warn: 4, info: 6, debug: 7 };
      const wantPrio = o.values.p !== undefined ? (PRIO[o.values.p] !== undefined ? PRIO[o.values.p] : parseInt(o.values.p, 10)) : null;
      const kernelOnly = o.flags.has("k") || o.flags.has("dmesg");
      const ui = args.findIndex(a => a === "--until" || a.startsWith("--until="));
      let untilMin = null;
      if (ui !== -1) { const rawU = args[ui].includes("=") ? args[ui].split("=")[1] : args[ui + 1]; untilMin = this.parseSince(rawU); if (untilMin === null) return { err: "Failed to parse timestamp: " + rawU + "\n" }; }
      const unitRaw = o.values.u || o.values.unit;
      const unit = unitRaw ? this.unitName(unitRaw) : null;
      let n = o.values.n || o.values.lines;
      n = n ? parseInt(n, 10) : null;
      let sinceMin = null;
      const si = args.findIndex(a => a === "--since" || a.startsWith("--since="));
      if (si !== -1) {
        const raw = args[si].includes("=") ? args[si].split("=")[1] : args[si + 1];
        sinceMin = this.parseSince(raw);
        if (sinceMin === null) return { err: `Failed to parse timestamp: ${raw}\n` };
      }
      const pool = kernelOnly ? this.kernel.map(k => ({ ago: k.ago, unit: "kernel", pid: null, level: /out of memory|killed process|error/i.test(k.msg) ? "error" : "info", msg: k.msg })) : this.journal;
      let entries = pool.filter(j => (!unit || j.unit === unit) && (sinceMin === null || j.ago <= sinceMin) && (untilMin === null || j.ago >= untilMin)
        && (bootSel === null || (j.boot || 0) === bootSel) && (wantPrio === null || (LEVELPRIO[j.level || "info"] !== undefined ? LEVELPRIO[j.level || "info"] : 6) <= wantPrio));
      entries.sort((a, b) => b.ago - a.ago);
      if (n) entries = entries.slice(-n);
      const follow = o.flags.has("f") || o.flags.has("follow");
      if (follow) entries = entries.slice(-10);
      if (o.flags.has("r")) entries = [...entries].reverse();
      this.lastJournal = { unit, sinceMin, follow, lines: n, noPager: o.flags.has("no-pager"), entries: entries.slice() };
      let out = entries.length ? entries.map(j => this.fmtJournal(j)).join("\n") + "\n" : "-- No entries --\n";
      if (follow) {
        out += "[sandbox: following the journal. New entries appear below; press Ctrl+C to stop]\n";
        this.followRequest = { unit };
      }
      return { out };
    }

    // One new live journal entry for `journalctl -f` (used by the follow ticker).
    liveEntry(unit) {
      const pool = (this.liveLines[unit || "*"] || this.liveLines[Object.keys(this.liveLines)[0]] || ["Health check ping 200 OK"]);
      const msg = pool[this.liveTick % pool.length];
      const sec = (this.liveTick + 1) * 3;
      const entry = { ago: -sec / 60, unit: unit || "myapp", pid: (this.services[unit] || {}).pid || null, level: "info", msg };
      this.liveTick++;
      this.journal.push(entry);
      return this.fmtJournal(entry);
    }

    cmd_dmesg(args) {
      const human = args.includes("-T") || args.includes("--ctime");
      const lines = this.kernel.slice().sort((a, b) => b.ago - a.ago).map((k, i) =>
        human ? `[${CLOCK.weekday} ${clockLabel(k.ago)} ${CLOCK.year}] ${k.msg}` : `[${(40000 - k.ago * 60 + i).toFixed(6).padStart(12)}] ${k.msg}`);
      return { out: lines.join("\n") + "\n" };
    }

    // ---------- cron ----------
    cmd_crontab(args, flags, stdin, sh) {
      const a = args[0];
      const HEADER = "# m h  dom mon dow   command";
      if (a === "-l") {
        if (!this.cron.length) return { err: "no crontab for " + this.currentUser + "\n", code: 1 };
        return { out: HEADER + "\n" + this.cron.join("\n") + "\n" };
      }
      if (a === "-r") { this.cron = []; return { out: "" }; }
      if (a === "-e") { this.cronEdited = true; return { out: "[sandbox: crontab -e opens your editor on the crontab. In scripts use: ( crontab -l ; echo 'schedule command' ) | crontab -]\n" }; }
      let text;
      if (a === "-") text = stdin;
      else { const n = sh && sh.lookup(sh.abs(a), true); if (!n || n.type !== "file") return { err: "crontab: " + a + ": No such file or directory\n", code: 1 }; text = n.content || ""; }
      const rows = text.replace(/\n$/, "").split("\n").filter(l => l.trim() && l.trim() !== HEADER);
      const bad = this.validateCron(rows);
      if (bad) return { err: "crontab: installing new crontab\n\"" + (a === "-" ? "-" : a) + "\":" + bad.line + ": " + bad.msg + "\nerrors in crontab file, can't install.\nDo you want to retry the same edit? (y/n) ", code: 1 };
      this.cron = rows;
      return { out: "" };
    }

    // checks the five time fields (or an @macro) of each non-comment line
    validateCron(rows) {
      const ranges = [["minute", 0, 59], ["hour", 0, 23], ["day-of-month", 1, 31], ["month", 1, 12], ["day-of-week", 0, 7]];
      for (let i = 0; i < rows.length; i++) {
        const l = rows[i].trim();
        if (l.startsWith("#") || /^[A-Za-z_]+=/.test(l)) continue;
        if (/^@(reboot|yearly|annually|monthly|weekly|daily|midnight|hourly)\s+\S/.test(l)) continue;
        const f = l.split(/\s+/);
        if (f.length < 6) return { line: i + 1, msg: "bad command" };
        for (let k = 0; k < 5; k++) {
          const ok = f[k].split(",").every(part => { const m = /^(\*|\d+(?:-\d+)?)(?:\/(\d+))?$/.exec(part); if (!m) return false; const nums = m[1].split("-").filter(x => x !== "*").map(Number); return nums.every(n => n >= ranges[k][1] && n <= ranges[k][2]); });
          if (!ok) return { line: i + 1, msg: "bad " + ranges[k][0] };
        }
      }
      return null;
    }

    // ---------- users & groups ----------
    syncAccountFiles(sh) {
      if (!sh || !this.users.length) return;
      const passwd = [{ name: "root", uid: 0, gid: 0, gecos: "root", home: "/root", shell: "/bin/bash" }, ...this.users]
        .map(u => `${u.name}:x:${u.uid}:${u.gid}:${u.gecos || ""}:${u.home}:${u.shell}`).join("\n") + "\n";
      const group = [{ name: "root", gid: 0 }, ...this.groups]
        .map(g => `${g.name}:x:${g.gid}:${this.membersOf(g.name).filter(m => !(this.userByName(m) && this.userByName(m).primary === g.name)).join(",")}`).join("\n") + "\n";
      const shadow = [{ name: "root", locked: true }, ...this.users].map(u => u.name + ":" + (u.locked ? "!" : u.noPassword ? "" : "$6$rounds=4096$salt$hashedpassword") + ":20015:0:99999:7:::").join("\n") + "\n";
      [["/etc/passwd", passwd, 0o644, "root", "root"], ["/etc/group", group, 0o644, "root", "root"], ["/etc/shadow", shadow, 0o640, "root", "shadow"]].forEach(([p, text, mode, owner, grp]) => {
        let n = sh.lookup(p);
        if (!n) { sh.mkdirp("/etc"); n = sh.createFile(p, text); }
        n.content = text; n.size = text.length; n.sizeDeclared = false;
        if (p === "/etc/shadow" || n.owner === "ubuntu") { n.mode = mode; n.owner = owner; n.group = grp; }
      });
    }

    ensureGroup(name) {
      let g = this.groupByName(name);
      if (!g) { g = { name, gid: this.nextGid++ }; this.groups.push(g); }
      return g;
    }

    cmd_useradd(args, flags, stdin, sh) {
      const o = parseOpts(args, ["s", "G", "d", "g", "c", "u"]);
      const name = o.operands[o.operands.length - 1];
      if (!name) return { err: "Usage: useradd [options] LOGIN\n" };
      if (this.userByName(name)) return { err: `useradd: user '${name}' already exists\n` };
      const g = this.ensureGroup(name);
      const home = o.values.d || "/home/" + name;
      const extra = o.values.G ? o.values.G.split(",").filter(Boolean) : [];
      const bad = extra.find(x => !this.groupByName(x));
      if (bad) return { err: `useradd: group '${bad}' does not exist\n` };
      this.users.push({ name, uid: this.nextUid++, gid: g.gid, primary: name, home, shell: o.values.s || "/bin/sh", gecos: o.values.c || "", groups: extra });
      if (o.flags.has("m") || o.flags.has("create-home")) {
        sh.mkdirp(home);
        const d = sh.lookup(home); if (d) { d.owner = name; d.group = name; d.mode = 0o755; }
      }
      this.syncAccountFiles(sh);
      return {};
    }

    cmd_userdel(args, flags, stdin, sh) {
      const o = parseOpts(args, []);
      const name = o.operands[o.operands.length - 1];
      const u = this.userByName(name);
      if (!name) return { err: "Usage: userdel [options] LOGIN\n", code: 2 };
      if (!u) return { err: "userdel: user '" + name + "' does not exist\n", code: 6 };
      this.users = this.users.filter(x => x.name !== name);
      if (!this.users.some(x => x.primary === u.primary)) this.groups = this.groups.filter(g => g.name !== u.primary);
      if (o.flags.has("r") && sh) { const h = sh.lookup(sh.abs(u.home)); if (h) sh.lookup(sh.abs(u.home + "/..")).children.delete(sh.abs(u.home).split("/").pop()); }
      this.syncAccountFiles(sh);
      return {};
    }

    cmd_groupdel(args, flags, stdin, sh) {
      const name = args.filter(a => !a.startsWith("-")).pop();
      const g = this.groupByName(name);
      if (!name) return { err: "Usage: groupdel [options] GROUP\n", code: 2 };
      if (!g) return { err: "groupdel: group '" + name + "' does not exist\n", code: 6 };
      const owner = this.users.find(u => u.primary === name);
      if (owner) return { err: "groupdel: cannot remove the primary group of user '" + owner.name + "'\n", code: 8 };
      this.groups = this.groups.filter(x => x.name !== name);
      this.users.forEach(u => { u.groups = (u.groups || []).filter(x => x !== name); });
      this.syncAccountFiles(sh);
      return {};
    }

    cmd_passwd(args, flags, stdin, sh) {
      const o = parseOpts(args, []);
      const name = o.operands[0] || this.currentUser;
      const u = this.userByName(name);
      if (!u) return { err: "passwd: user '" + name + "' does not exist\n", code: 1 };
      if (o.flags.has("S")) return { out: name + " " + (u.locked ? "L" : "P") + " 2026-10-29 0 99999 7 -1\n" };
      if (name !== this.currentUser && !(sh && sh.asRoot)) return { err: "passwd: You may not view or modify password information for " + name + ".\n", code: 1 };
      if (o.flags.has("l")) { u.locked = true; this.syncAccountFiles(sh); return { out: "passwd: password expiry information changed.\n" }; }
      if (o.flags.has("u")) { u.locked = false; this.syncAccountFiles(sh); return { out: "passwd: password expiry information changed.\n" }; }
      if (o.flags.has("d")) { u.locked = false; u.noPassword = true; this.syncAccountFiles(sh); return { out: "passwd: password expiry information changed.\n" }; }
      if (o.flags.has("e")) { u.expired = true; return { out: "passwd: password expiry information changed.\n" }; }
      return { out: "New password: \nRetype new password: \npasswd: password updated successfully\n" };
    }

    cmd_who() { return { out: "ubuntu   pts/0        2026-10-29 08:12 (203.0.113.7)\n" }; }
    cmd_w() { return { out: " 14:30:00 up  6:30,  1 user,  load average: 0.08, 0.03, 0.01\nUSER     TTY      FROM             LOGIN@   IDLE   JCPU   PCPU WHAT\nubuntu   pts/0    203.0.113.7      08:12    0.00s  0.04s  0.00s w\n" }; }
    cmd_last() { return { out: "ubuntu   pts/0        203.0.113.7      Wed Oct 29 08:12   still logged in\nreboot   system boot  5.15.0-1052-aws  Wed Oct 29 08:00   still running\n\nwtmp begins Wed Oct 29 08:00:00 2026\n" }; }

    cmd_groupadd(args, flags, stdin, sh) {
      const name = args.filter(a => !a.startsWith("-")).pop();
      if (!name) return { err: "Usage: groupadd [options] GROUP\n" };
      if (this.groupByName(name)) return { err: `groupadd: group '${name}' already exists\n` };
      this.groups.push({ name, gid: this.nextGid++ });
      this.syncAccountFiles(sh);
      return {};
    }

    cmd_usermod(args, flags, stdin, sh) {
      const o = parseOpts(args, ["G", "s", "l", "d", "g"]);
      const user = o.operands[o.operands.length - 1];
      const u = this.userByName(user);
      if (!user) return { err: "Usage: usermod [options] LOGIN\n" };
      if (!u) return { err: `usermod: user '${user}' does not exist\n` };
      if (o.values.G !== undefined) {
        const list = o.values.G.split(",").filter(Boolean);
        const bad = list.find(x => !this.groupByName(x));
        if (bad) return { err: `usermod: group '${bad}' does not exist\n` };
        u.groups = o.flags.has("a") ? Array.from(new Set([...(u.groups || []), ...list])) : list; // without -a it REPLACES
      }
      if (o.values.s) u.shell = o.values.s;
      this.syncAccountFiles(sh);
      return {};
    }

    userGroupNames(u) { return [u.primary, ...(u.groups || [])]; }

    cmd_groups(args) {
      if (arguments[3] && arguments[3].asRoot && !args[0]) return { out: "root\n" };
      const target = args[0] || this.currentUser;
      const u = this.userByName(target);
      if (!u) return { err: `groups: '${target}': no such user\n` };
      return { out: this.userGroupNames(u).join(" ") + "\n" };
    }

    cmd_id(args) {
      const sh = arguments[3];
      if (sh && sh.asRoot && !args.filter(x => !x.startsWith("-"))[0]) {
        const f = parseOpts(args, []).flags;
        if (f.has("G") && f.has("n")) return { out: "root\n" };
        if (f.has("u") || f.has("g")) return { out: "0\n" };
        return { out: "uid=0(root) gid=0(root) groups=0(root)\n" };
      }
      const { flags, operands } = parseOpts(args, []);
      const target = operands[0] || this.currentUser;
      const u = this.userByName(target);
      if (!u) return { err: `id: '${target}': no such user\n` };
      const names = this.userGroupNames(u);
      if (flags.has("G") && flags.has("n")) return { out: names.join(" ") + "\n" };
      if (flags.has("u")) return { out: u.uid + "\n" };
      if (flags.has("g")) return { out: u.gid + "\n" };
      return { out: `uid=${u.uid}(${u.name}) gid=${u.gid}(${u.primary}) groups=${names.map(n => `${this.gidOf(n)}(${n})`).join(",")}\n` };
    }

    cmd_getent(args) {
      const [db, key] = args;
      if (db === "passwd") {
        const rows = [{ name: "root", uid: 0, gid: 0, gecos: "root", home: "/root", shell: "/bin/bash" }, ...this.users];
        const hit = key ? rows.filter(u => u.name === key) : rows;
        if (key && !hit.length) return {};
        return { out: hit.map(u => `${u.name}:x:${u.uid}:${u.gid}:${u.gecos || ""}:${u.home}:${u.shell}`).join("\n") + "\n" };
      }
      if (db === "group") {
        const rows = [{ name: "root", gid: 0 }, ...this.groups];
        const hit = key ? rows.filter(g => g.name === key) : rows;
        if (key && !hit.length) return {};
        return { out: hit.map(g => `${g.name}:x:${g.gid}:${this.membersOf(g.name).join(",")}`).join("\n") + "\n" };
      }
      return { err: `Unknown database: ${db}\n` };
    }
  }

  SystemState.extensions = [];
  SystemState.parseOpts = parseOpts;
  root.SystemState = SystemState;
  root.SYSTEM_CLOCK = { CLOCK, NOW_MIN, clockLabel };
  if (typeof module !== "undefined" && module.exports) module.exports = { SystemState };
})(typeof window !== "undefined" ? window : globalThis);

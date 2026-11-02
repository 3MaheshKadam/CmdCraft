/**
 * CmdCraft simulated system, part 3: process tree & top, monitoring tools, networking extras (ip link/route, wget,
 * nslookup, traceroute, netstat), and the full SSH workflow (ssh-copy-id, agent, config aliases, known_hosts,
 * scp -r/-i/-P, rsync, sftp). Registers with SystemState.extensions after system-more.js.
 */
(function (root) {
  if (!root.SystemState) return;
  const pad = (s, n) => String(s).padEnd(n);
  const lpad = (s, n) => String(s).padStart(n);
  const HOME = "/home/ubuntu";
  const SSHDIR = HOME + "/.ssh";
  let blobN = 0;
  const blob = n => { const c = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"; let s = ""; for (let i = 0; i < n; i++) s += c[(i * 11 + blobN * 17) % c.length]; blobN++; return s; };
  const lines = t => (t === "" ? [] : t.replace(/\n$/, "").split("\n"));

  root.SystemState.extensions.push(function (sys, seed) {
    const reg = (name, has, fn, supported) => { sys.ext[name] = { has, fn, supported }; };
    const hasNet = () => !!sys.net, hasSsh = () => !!sys.sshData, hasProcs = () => sys.processes.length > 0, hasPerf = () => !!sys.perf || sys.processes.length > 0;
    sys.perf = seed.perf || null;
    sys.remoteKeys = (seed.ssh && seed.ssh.remoteKeys) || {}; sys.agentKeys = (seed.ssh && seed.ssh.agentKeys) || []; sys.agentUp = !!(seed.ssh && seed.ssh.agentUp);
    sys.lastWget = null; sys.lastRsync = null; sys.lastSftp = null; sys.lastCopyId = null; sys.lastNslookup = null; sys.lastTrace = null; sys.lastTop = null; sys.lastPerf = null;
    const prevExtra = sys.extraState;
    sys.extraState = () => [prevExtra ? prevExtra() : null, sys.remoteKeys, sys.agentKeys, sys.agentUp];
    const P = () => Object.assign({ load: [0.08, 0.03, 0.01], up: "6:30", cpus: 2, cpu: { us: 3.1, sy: 1.0, ni: 0, id: 95.6, wa: 0.3, hi: 0, si: 0, st: 0 }, mem: { total: 3941, free: 1052, used: 1404, shared: 12, cache: 1485, avail: 2301, swapTotal: 0, swapUsed: 0 }, vm: [1, 0, 0, 1077248, 84320, 1520000, 0, 0, 12, 30, 210, 420, 3, 1, 95, 1, 0], disks: [{ dev: "xvda", tps: 12.5, r: 120.4, w: 310.2, util: 3.1, await: 0.8 }] }, sys.perf || {});
    sys.perfData = P;

    // ---------- process tree & top ----------
    reg("pstree", hasProcs, function (args, flags) {
      const procs = sys.processes;
      const kids = pid => procs.filter(p => (p.ppid || 1) === pid && p.pid !== pid);
      const label = p => (p.comm || p.cmd.split(" ")[0]) + (flags.has("p") ? "(" + p.pid + ")" : "");
      const root0 = procs.find(p => p.pid === 1) || { pid: 1, comm: "systemd" };
      const draw = (p, prefix, isLast, top) => {
        const ks = kids(p.pid);
        let line = top ? label(p) : label(p);
        if (!ks.length) return [line];
        const out = [];
        const sub = ks.map((k, i) => draw(k, "", i === ks.length - 1, false));
        const first = ks.length === 1 ? "───" : "─┬─";
        const pad0 = " ".repeat(line.length);
        sub.forEach((block, i) => {
          block.forEach((l, j) => {
            if (i === 0 && j === 0) out.push(line + first + l);
            else if (j === 0) out.push(pad0 + (i === sub.length - 1 ? " └─" : " ├─") + l);
            else out.push(pad0 + (i === sub.length - 1 ? "   " : " │ ") + l);
          });
        });
        return out;
      };
      return { out: draw(root0, "", true, true).join("\n") + "\n" };
    });

    const topText = (batch) => {
      const m = P().mem, c = P().cpu;
      const procs = [...sys.processes].sort((a, b) => b.cpu - a.cpu);
      const running = procs.filter(p => /R/.test(p.stat || "")).length;
      let out = ` top - 14:30:00 up  ${P().up},  1 user,  load average: ${P().load.map(x => x.toFixed(2)).join(", ")}\n`;
      out += `Tasks: ${lpad(procs.length, 3)} total, ${lpad(running, 3)} running, ${lpad(procs.length - running, 3)} sleeping,   0 stopped,   0 zombie\n`;
      out += `%Cpu(s): ${c.us.toFixed(1)} us,  ${c.sy.toFixed(1)} sy,  ${c.ni.toFixed(1)} ni, ${c.id.toFixed(1)} id,  ${c.wa.toFixed(1)} wa,  0.0 hi,  0.0 si,  0.0 st\n`;
      out += `MiB Mem : ${lpad(m.total.toFixed(1), 8)} total, ${lpad(m.free.toFixed(1), 8)} free, ${lpad(m.used.toFixed(1), 8)} used, ${lpad(m.cache.toFixed(1), 8)} buff/cache\n`;
      out += `MiB Swap: ${lpad(m.swapTotal.toFixed(1), 8)} total, ${lpad((m.swapTotal - m.swapUsed).toFixed(1), 8)} free, ${lpad(m.swapUsed.toFixed(1), 8)} used. ${lpad(m.avail.toFixed(1), 8)} avail Mem \n\n`;
      out += "    PID USER      PR  NI    VIRT    RES    SHR S  %CPU  %MEM     TIME+ COMMAND\n";
      out += procs.slice(0, 10).map(p => `${lpad(p.pid, 7)} ${pad(p.user.slice(0, 9), 9)} 20   0 ${lpad(p.vsz, 7)} ${lpad(p.rss, 6)}   ${lpad(Math.round(p.rss / 3), 4)} ${(p.stat || "S")[0]} ${lpad(p.cpu.toFixed(1), 5)} ${lpad(p.mem.toFixed(1), 5)} ${lpad(p.time || "0:00", 9)}.00 ${p.comm || p.cmd}`).join("\n") + "\n";
      sys.lastTop = { procs: procs.slice(0, 10), perf: P() };
      return out;
    };
    reg("top", hasPerf, function (args) { return { out: topText(true) + (args.includes("-b") ? "" : "\n[sandbox: top is interactive in a real terminal (q quits). Showing one snapshot.]\n") }; });
    reg("htop", hasPerf, function () { return { out: topText(false) + "\n[sandbox: htop is interactive in a real terminal (F10 or q quits). Showing one snapshot.]\n" }; });

    // ---------- monitoring tools ----------
    const hum = mib => (mib >= 1024 ? (mib / 1024).toFixed(1) + "Gi" : mib <= 0 ? "0B" : Math.round(mib) + "Mi");
    reg("uptime", hasPerf, function (args) {
      if (args.includes("-p")) return { out: "up 6 hours, 30 minutes\n" };
      if (args.includes("-s")) return { out: "2026-10-29 08:00:00\n" };
      sys.lastPerf = "uptime";
      return { out: ` 14:30:00 up  ${P().up},  1 user,  load average: ${P().load.map(x => x.toFixed(2)).join(", ")}\n` };
    });
    reg("free", hasPerf, function (args, flags) {
      const m = P().mem; sys.lastPerf = "free";
      const cell = v => (flags.has("h") ? lpad(hum(v), 11) : flags.has("g") ? lpad(Math.round(v / 1024), 11) : flags.has("m") ? lpad(Math.round(v), 11) : lpad(Math.round(v * 1024), 11));
      const swapCell = v => (flags.has("h") ? lpad(v ? hum(v) : "0B", 11) : lpad(Math.round(v * (flags.has("m") ? 1 : flags.has("g") ? 1 / 1024 : 1024)), 11));
      let out = "               total        used        free      shared  buff/cache   available\n";
      out += "Mem:    " + cell(m.total) + cell(m.used) + cell(m.free) + cell(m.shared) + cell(m.cache) + cell(m.avail) + "\n";
      out += "Swap:   " + swapCell(m.swapTotal) + swapCell(m.swapUsed) + swapCell(m.swapTotal - m.swapUsed) + "\n";
      return { out };
    });
    reg("vmstat", hasPerf, function (args) {
      const n = parseInt(args.filter(a => /^\d+$/.test(a))[1] || args.filter(a => /^\d+$/.test(a))[0] || 1, 10);
      const v = P().vm; sys.lastPerf = "vmstat";
      let out = "procs -----------memory---------- ---swap-- -----io---- -system-- ------cpu-----\n r  b   swpd   free   buff  cache   si   so    bi    bo   in   cs us sy id wa st\n";
      for (let i = 0; i < Math.min(n, 10); i++) out += v.map((x, k) => lpad(x, [2, 2, 6, 8, 6, 7, 4, 4, 5, 5, 4, 4, 2, 2, 2, 2, 2][k] + (k === 0 ? 0 : 1))).join("").replace(/^ /, " ") + "\n";
      return { out };
    });
    reg("iostat", hasPerf, function (args, flags) {
      sys.lastPerf = "iostat"; const c = P().cpu;
      let out = `Linux 5.15.0-1052-aws (${(sys.info && sys.info.hostname) || "ip-172-31-42-12"}) \t10/29/2026 \t_x86_64_\t(${P().cpus} CPU)\n\n`;
      if (!flags.has("d")) out += "avg-cpu:  %user   %nice %system %iowait  %steal   %idle\n          " + [c.us, c.ni, c.sy, c.wa, c.st, c.id].map(x => lpad(x.toFixed(2), 7)).join(" ") + "\n\n";
      if (flags.has("x")) {
        out += "Device            r/s     rkB/s   w/s     wkB/s  await  %util\n";
        out += P().disks.map(d => `${pad(d.dev, 14)} ${lpad((d.tps / 2).toFixed(2), 6)} ${lpad(d.r.toFixed(2), 9)} ${lpad((d.tps / 2).toFixed(2), 6)} ${lpad(d.w.toFixed(2), 9)} ${lpad(d.await.toFixed(2), 6)} ${lpad(d.util.toFixed(2), 6)}`).join("\n") + "\n";
      } else {
        out += "Device             tps    kB_read/s    kB_wrtn/s    kB_dscd/s    kB_read    kB_wrtn    kB_dscd\n";
        out += P().disks.map(d => `${pad(d.dev, 14)} ${lpad(d.tps.toFixed(2), 8)} ${lpad(d.r.toFixed(2), 12)} ${lpad(d.w.toFixed(2), 12)} ${lpad("0.00", 12)} ${lpad(812345, 10)} ${lpad(2234567, 10)} ${lpad(0, 10)}`).join("\n") + "\n";
      }
      return { out };
    });
    reg("mpstat", hasPerf, function (args) {
      sys.lastPerf = "mpstat"; const c = P().cpu; const all = args.includes("ALL") || args.includes("-P");
      let out = `Linux 5.15.0-1052-aws (${(sys.info && sys.info.hostname) || "host"}) \t10/29/2026 \t_x86_64_\t(${P().cpus} CPU)\n\n14:30:00     CPU    %usr   %nice    %sys %iowait    %irq   %soft  %steal  %guest  %gnice   %idle\n`;
      const row = (cpu, f) => `14:30:01     ${pad(cpu, 4)} ${[c.us * f, c.ni, c.sy * f, c.wa * f, 0, 0, c.st, 0, 0, 100 - (c.us + c.sy + c.wa) * f].map(x => lpad(x.toFixed(2), 7)).join(" ")}\n`;
      out += row("all", 1);
      if (all) for (let i = 0; i < P().cpus; i++) out += row(String(i), 1 + (i % 2 ? 0.2 : -0.2));
      return { out };
    });
    reg("sar", hasPerf, function (args, flags) {
      sys.lastPerf = "sar"; const c = P().cpu; const n = parseInt(args.filter(a => /^\d+$/.test(a))[1] || 3, 10);
      let out = `Linux 5.15.0-1052-aws (${(sys.info && sys.info.hostname) || "host"}) \t10/29/2026 \t_x86_64_\t(${P().cpus} CPU)\n\n`;
      if (flags.has("r")) { const m = P().mem; out += "14:30:00    kbmemfree   kbavail kbmemused  %memused kbbuffers  kbcached\n"; for (let i = 0; i < n; i++) out += `14:30:0${i}  ${lpad(Math.round(m.free * 1024), 11)} ${lpad(Math.round(m.avail * 1024), 9)} ${lpad(Math.round(m.used * 1024), 9)} ${lpad((100 * m.used / m.total).toFixed(2), 9)} ${lpad(84320, 9)} ${lpad(Math.round(m.cache * 1024), 9)}\n`; return { out }; }
      if (flags.has("q")) { out += "14:30:00      runq-sz  plist-sz   ldavg-1   ldavg-5  ldavg-15\n"; for (let i = 0; i < n; i++) out += `14:30:0${i}            1       ${lpad(sys.processes.length, 3)}      ${P().load[0].toFixed(2)}      ${P().load[1].toFixed(2)}      ${P().load[2].toFixed(2)}\n`; return { out }; }
      out += "14:30:00        CPU     %user     %nice   %system   %iowait    %steal     %idle\n";
      for (let i = 0; i < n; i++) out += `14:30:0${i}        all ${[c.us, c.ni, c.sy, c.wa, c.st, c.id].map(x => lpad(x.toFixed(2), 9)).join(" ")}\n`;
      out += "Average:        all " + [c.us, c.ni, c.sy, c.wa, c.st, c.id].map(x => lpad(x.toFixed(2), 9)).join(" ") + "\n";
      return { out };
    });
    reg("pidstat", hasPerf, function () {
      sys.lastPerf = "pidstat";
      let out = `Linux 5.15.0-1052-aws (${(sys.info && sys.info.hostname) || "host"}) \t10/29/2026 \t_x86_64_\t(${P().cpus} CPU)\n\n14:30:00      UID       PID    %usr %system  %guest    %CPU   CPU  Command\n`;
      out += [...sys.processes].sort((a, b) => b.cpu - a.cpu).slice(0, 8).map(p => `14:30:01     ${lpad(p.user === "root" ? 0 : 1000, 4)} ${lpad(p.pid, 9)} ${lpad((p.cpu * 0.8).toFixed(2), 7)} ${lpad((p.cpu * 0.2).toFixed(2), 7)} ${lpad("0.00", 7)} ${lpad(p.cpu.toFixed(2), 7)}     0  ${p.comm || p.cmd}`).join("\n") + "\n";
      return { out };
    });

    // ---------- networking extras ----------
    const prevIp = sys.ext.ip;
    reg("ip", hasNet, function (args, flags, stdin, sh) {
      const sub = args.find(a => a !== "show");
      if (["link", "l"].includes(sub)) {
        sys.lastIp = "link";
        return { out: sys.net.interfaces.map(n => `${n.idx}: ${n.name}: <${n.flags}> mtu ${n.mtu} qdisc ${n.qdisc || "fq_codel"} state ${n.state} mode DEFAULT group default qlen 1000\n    link/${n.name === "lo" ? "loopback" : "ether"} ${n.mac} brd ${n.name === "lo" ? "00:00:00:00:00:00" : "ff:ff:ff:ff:ff:ff"}`).join("\n") + "\n" };
      }
      if (["route", "r", "ro"].includes(sub)) {
        sys.lastIp = "route";
        const eth = sys.net.interfaces.find(n => n.name !== "lo") || sys.net.interfaces[0];
        const ip = (eth.ipv4 || "").split("/")[0];
        const routes = sys.net.routes || [`default via ${ip.replace(/\.\d+$/, ".1")} dev ${eth.name} proto dhcp src ${ip} metric 100`, `${(eth.ipv4 || "").replace(/\.\d+\//, ".0/")} dev ${eth.name} proto kernel scope link src ${ip} metric 100`];
        return { out: routes.join("\n") + "\n" };
      }
      return prevIp.fn.call(sys, args, flags, stdin, sh);
    }, args => { const a = args.filter(x => x !== "show"); return a.length === 1 && ["addr", "a", "address", "link", "l", "route", "r", "ro"].includes(a[0]); });

    reg("wget", hasNet, function (args, flags, stdin, sh) {
      const url = args.filter((a, i) => !a.startsWith("-") && args[i - 1] !== "-O")[0];
      const oi = args.indexOf("-O");
      const m = /^https?:\/\/([^/]+)(\/.*)?$/.exec(url || "");
      if (!m) return { err: "wget: missing URL\nUsage: wget [OPTION]... [URL]...\n", code: 1 };
      const rec = sys.net.http[url];
      const name = oi !== -1 ? args[oi + 1] : (basenameOf(m[2] || "/") || "index.html");
      if (!rec || rec.refused) { sys.lastWget = { url, ok: false }; return { err: `--2026-10-29 14:30:00--  ${url}\nResolving ${m[1]} (${m[1]})... failed: Temporary failure in name resolution.\nwget: unable to resolve host address ‘${m[1]}’\n`, code: 4 }; }
      if (rec.status >= 400) { sys.lastWget = { url, ok: false, status: rec.status }; return { err: `--2026-10-29 14:30:00--  ${url}\nResolving ${m[1]} (${m[1]})... 93.184.216.34\nConnecting to ${m[1]} (${m[1]})|93.184.216.34|:80... connected.\nHTTP request sent, awaiting response... ${rec.status} ${rec.statusText}\n2026-10-29 14:30:01 ERROR ${rec.status}: ${rec.statusText}.\n`, code: 8 }; }
      const size = rec.size || (rec.body || "").length;
      const node = sh.lookup(sh.abs(name)) || sh.createFile(sh.abs(name), rec.body || "");
      node.content = rec.body || ""; node.size = size; node.sizeDeclared = true; node.age = 0;
      sys.lastWget = { url, ok: true, name, size };
      const h = size >= 1048576 ? (size / 1048576).toFixed(1) + "M" : size >= 1024 ? (size / 1024).toFixed(0) + "K" : size + "";
      if (args.includes("-q")) return { out: "" };
      return { out: `--2026-10-29 14:30:00--  ${url}\nResolving ${m[1]} (${m[1]})... 93.184.216.34\nConnecting to ${m[1]} (${m[1]})|93.184.216.34|:80... connected.\nHTTP request sent, awaiting response... 200 OK\nLength: ${size} (${h}) [${(rec.headers && rec.headers["Content-Type"]) || "application/octet-stream"}]\nSaving to: ‘${name}’\n\n${pad(name, 24)}100%[===================>] ${lpad(h, 6)}  12.3MB/s    in 0.08s\n\n2026-10-29 14:30:01 (12.3 MB/s) - ‘${name}’ saved [${size}/${size}]\n\n` };
    }, args => args.some(a => /^https?:\/\//.test(a)));
    const basenameOf = p => p.replace(/\/+$/, "").split("/").pop();

    reg("nslookup", hasNet, function (args) {
      const name = args.filter(a => !a.startsWith("-"))[0];
      const rec = sys.net.dns[name];
      sys.lastNslookup = { name, rec: rec || null };
      sys.lastDns = { name, rec: rec || null, short: false };
      if (!rec) return { out: `Server:\t\t127.0.0.53\nAddress:\t127.0.0.53#53\n\n** server can't find ${name}: NXDOMAIN\n\n`, code: 1 };
      return { out: `Server:\t\t${rec.resolver || "127.0.0.53"}\nAddress:\t${rec.resolver || "127.0.0.53"}#53\n\nNon-authoritative answer:\n` + rec.answers.map(a => `Name:\t${name}\nAddress: ${a}\n`).join("\n") + "\n" };
    });
    reg("traceroute", hasNet, function (args) {
      const host = args.filter(a => !a.startsWith("-"))[0];
      const hops = (sys.net.trace && sys.net.trace[host]) || [{ ip: "172.31.32.1", ms: 0.4 }, { ip: "52.93.0.12", ms: 1.8 }, { ip: host, ms: 12.4 }];
      sys.lastTrace = { host, hops };
      return { out: `traceroute to ${host} (${host}), 30 hops max, 60 byte packets\n` + hops.map((h, i) => ` ${i + 1}  ${h.ip}  ${h.ms.toFixed(3)} ms  ${(h.ms * 1.05).toFixed(3)} ms  ${(h.ms * 0.97).toFixed(3)} ms`).join("\n") + "\n" };
    });
    reg("netstat", hasNet, function (args, flags) {
      const rows = sys.net.sockets.filter(s => (flags.has("l") ? /LISTEN|UNCONN/.test(s.state) : true)).filter(s => (!flags.has("t") && !flags.has("u")) || (flags.has("t") && s.proto === "tcp") || (flags.has("u") && s.proto === "udp"));
      sys.lastSockets = { listening: flags.has("l"), rows };
      let out = "Active Internet connections (only servers)\nProto Recv-Q Send-Q Local Address           Foreign Address         State       PID/Program name\n";
      out += rows.map(s => `${pad(s.proto, 5)} ${lpad(s.recvq || 0, 6)} ${lpad(s.sendq || 0, 6)} ${pad(s.addr + ":" + s.port, 23)} ${pad("0.0.0.0:*", 23)} ${pad(s.state === "UNCONN" ? "" : s.state, 11)} ${flags.has("p") && s.proc ? s.pid + "/" + s.proc : "-"}`).join("\n") + "\n";
      return { out };
    });

    // ---------- SSH workflow ----------
    const readFile = (sh, p) => { const n = sh.lookup(p, true); return n && n.type === "file" ? (n.content || "") : null; };
    const appendFile = (sh, p, text) => { let n = sh.lookup(p, true); if (!n) { sh.mkdirp(SSHDIR); n = sh.createFile(p, ""); } n.content = (n.content || "") + text; n.size = n.content.length; n.sizeDeclared = false; n.age = 0; return n; };
    const parseConfig = (sh, alias) => {
      const c = readFile(sh, SSHDIR + "/config"); if (c === null) return null;
      let cur = null, found = null;
      c.split("\n").forEach(l => { const m = /^\s*(\w+)\s+(.+)$/.exec(l); if (!m) return; if (m[1].toLowerCase() === "host") cur = { host: m[2].trim(), opts: {} }; else if (cur) { cur.opts[m[1].toLowerCase()] = m[2].trim(); } if (cur && cur.host === alias) found = cur; });
      return found;
    };

    reg("ssh", hasSsh, function (args, flags, stdin, sh) {
      let port = null, ident = null, userOpt = null; const operands = [];
      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === "-p") { port = parseInt(args[++i], 10); continue; }
        if (a === "-i") { ident = args[++i]; continue; }
        if (a === "-l") { userOpt = args[++i]; continue; }
        if (["-o", "-F", "-J", "-L", "-R", "-D"].includes(a)) { i++; continue; }
        if (a.startsWith("-")) continue;
        operands.push(a);
      }
      const dest = operands[0] || "";
      let user, host;
      const aliasName = dest.includes("@") ? dest.split("@")[1] : dest;
      const alias = parseConfig(sh, aliasName);
      if (alias) { host = alias.opts.hostname || aliasName; user = alias.opts.user || (dest.includes("@") ? dest.split("@")[0] : userOpt || sys.currentUser); if (!port && alias.opts.port) port = parseInt(alias.opts.port, 10); if (!ident && alias.opts.identityfile) ident = alias.opts.identityfile.replace("~", HOME); }
      else [user, host] = dest.includes("@") ? dest.split("@") : [userOpt || sys.currentUser, dest];
      const rec = sys.sshData.hosts[host];
      const verbose = flags.has("v");
      const serverPort = (rec && rec.port) || 22, usedPort = port || 22;
      const steps = [{ id: "tcp", label: `TCP connect :${usedPort}`, status: "skip" }, { id: "kex", label: "Key exchange", status: "skip" }, { id: "hostkey", label: "Host key", status: "skip" }, { id: "auth", label: "Authenticate (publickey)", status: "skip" }, { id: "session", label: "Open session", status: "skip" }];
      sys.lastSsh = { host, user, port: usedPort, steps, outcome: "unknown", verbose, alias: alias ? aliasName : null };
      const dbg = []; const v = l => { if (verbose) dbg.push(l); };
      v("OpenSSH_8.9p1 Ubuntu-3ubuntu0.4, OpenSSL 3.0.2 15 Mar 2022");
      v("debug1: Reading configuration data /etc/ssh/ssh_config");
      if (alias) v(`debug1: /home/ubuntu/.ssh/config line 1: Applying options for ${aliasName}`);
      v(`debug1: Connecting to ${host} [${host}] port ${usedPort}.`);
      const fin = (extra, err, outcome) => { sys.lastSsh.outcome = outcome || (rec ? rec.outcome : "unreachable"); return { out: dbg.join("\n") + (dbg.length ? "\n" : "") + (extra || ""), err: err || "" }; };
      if (!rec || rec.outcome === "timeout") { steps[0].status = "fail"; steps[0].detail = "Connection timed out"; return fin("", `ssh: connect to host ${host} port ${usedPort}: Connection timed out\n`, "timeout"); }
      if (rec.outcome === "refused" || usedPort !== serverPort) { steps[0].status = "fail"; steps[0].detail = "Connection refused"; v(`debug1: connect to address ${host} port ${usedPort}: Connection refused`); return fin("", `ssh: connect to host ${host} port ${usedPort}: Connection refused\n`, "refused"); }
      steps[0].status = "ok"; v("debug1: Connection established."); v("debug1: Remote protocol version 2.0, remote software version OpenSSH_8.9p1"); steps[1].status = "ok"; v("debug1: kex: algorithm: curve25519-sha256");
      const known = readFile(sh, SSHDIR + "/known_hosts");
      if (rec.hostkeyChanged && known !== null && known.split("\n").some(l => l.startsWith(host + " "))) {
        steps[2].status = "fail"; steps[2].detail = "Host key changed";
        const bar = "@".repeat(59);
        return fin("", `${bar}\n@    WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!     @\n${bar}\nIT IS POSSIBLE THAT SOMEONE IS DOING SOMETHING NASTY!\nSomeone could be eavesdropping on you right now (man-in-the-middle attack)!\nIt is also possible that a host key has just been changed.\nOffending ED25519 key in ${SSHDIR}/known_hosts:1\nHost key verification failed.\n`, "hostkey-changed");
      }
      steps[2].status = "ok"; v(`debug1: Server host key: ssh-ed25519 SHA256:${blob(43)}`);
      v(`debug1: Authenticating to ${host}:${usedPort} as '${user}'`);
      const keyFile = ident ? sh.abs(ident) : SSHDIR + "/id_ed25519";
      const hasKey = !!sh.lookup(keyFile, true);
      let warn = "";
      if (ident && !hasKey) warn = `Warning: Identity file ${ident} not accessible: No such file or directory.\n`;
      v(`debug1: Offering public key: ${keyFile} ED25519`);
      const keyInstalled = (sys.remoteKeys[host] || []).length > 0;
      const denied = rec.outcome === "denied" && !keyInstalled || !hasKey && rec.outcome !== "password";
      if (denied) { steps[3].status = "fail"; steps[3].detail = hasKey ? "Server rejected the key" : "No key to offer"; v("debug1: Authentications that can continue: publickey"); return fin("", `${warn}${user}@${host}: Permission denied (publickey).\n`, "denied"); }
      steps[3].status = "ok"; v(`debug1: Server accepts key: ${keyFile} ED25519`); v(`Authenticated to ${host} ([${host}]:${usedPort}) using "publickey".`);
      steps[4].status = "ok"; v("debug1: channel 0: new [client-session]");
      if (known === null || !known.split("\n").some(l => l.startsWith(host + " "))) appendFile(sh, SSHDIR + "/known_hosts", `${host} ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI${blob(43)}\n`);
      sys.lastSsh.outcome = "ok";
      return { out: dbg.join("\n") + (dbg.length ? "\n" : "") + `[sandbox: connected to ${user}@${host}. The remote shell itself is not simulated.]\n`, err: warn };
    }, args => args.some(a => !a.startsWith("-") && !/^\d+$/.test(a)));

    reg("ssh-keygen", hasSsh, function (args, flags, stdin, sh) {
      const o = root.SystemState.parseOpts(args, ["t", "f", "N", "C", "b", "R", "l"]);
      if (o.values.R) {
        const host = o.values.R; const p = SSHDIR + "/known_hosts"; const n = sh.lookup(p, true);
        if (!n || !(n.content || "").split("\n").some(l => l.startsWith(host + " "))) return { out: `Host ${host} not found in ${p}\n`, code: 1 };
        const bak = sh.createFile(p + ".old", n.content); if (bak) bak.size = n.content.length;
        n.content = n.content.split("\n").filter(l => !l.startsWith(host + " ")).join("\n"); n.size = n.content.length; n.sizeDeclared = false; n.age = 0;
        sys.lastKeygen = { type: "remove", path: p, created: false };
        return { out: `# Host ${host} found: line 1\n${p} updated.\nOriginal contents retained as ${p}.old\n` };
      }
      if (flags.has("l")) {
        const f = o.values.f || (o.operands[0]); const n = f && sh.lookup(sh.abs(f), true);
        if (!n) return { err: `${f || "(none)"}: No such file or directory\n`, code: 1 };
        return { out: `256 SHA256:${blob(43)} ubuntu@${(sys.info && sys.info.hostname) || "host"} (ED25519)\n` };
      }
      const type = o.values.t || "rsa";
      const path = o.values.f ? sh.abs(o.values.f) : `${SSHDIR}/id_${type}`;
      sys.lastKeygen = { type, path, created: false };
      if (sh.lookup(path)) return { out: `${path} already exists.\nOverwrite (y/n)? `, err: "" };
      sh.mkdirp(path.slice(0, path.lastIndexOf("/")));
      const dir = sh.lookup(path.slice(0, path.lastIndexOf("/"))); if (dir) dir.mode = 0o700;
      const algo = type === "ed25519" ? "ssh-ed25519" : type === "ecdsa" ? "ecdsa-sha2-nistp256" : "ssh-rsa";
      const comment = o.values.C || `ubuntu@${(sys.info && sys.info.hostname) || "ip-172-31-42-12"}`;
      const priv = sh.createFile(path, `-----BEGIN OPENSSH PRIVATE KEY-----\n${blob(70)}\n${blob(70)}\n-----END OPENSSH PRIVATE KEY-----\n`);
      const pub = sh.createFile(path + ".pub", `${algo} AAAAC3NzaC1lZDI1NTE5AAAAI${blob(43)} ${comment}\n`);
      priv.mode = 0o600; pub.mode = 0o644; sys.lastKeygen.created = true;
      const bits = type === "ed25519" ? "ED25519 256" : type === "ecdsa" ? "ECDSA 256" : "RSA 3072";
      return { out: `Generating public/private ${type} key pair.\nEnter file in which to save the key (${path}): \nEnter passphrase (empty for no passphrase): \nEnter same passphrase again: \nYour identification has been saved in ${path}\nYour public key has been saved in ${path}.pub\nThe key fingerprint is:\nSHA256:${blob(43)} ${comment}\nThe key's randomart image is:\n+--[${bits}]--+\n|     .o+=o.      |\n|    . o.+*.      |\n|     . =o=+      |\n|      + *=.o     |\n|     . S.+= .    |\n+----[SHA256]-----+\n` };
    }, args => args.some(a => a === "-t" || a.startsWith("-t") || a === "-R" || a === "-l"));

    reg("ssh-copy-id", hasSsh, function (args, flags, stdin, sh) {
      const dest = args.filter(a => !a.startsWith("-") && args[args.indexOf(a) - 1] !== "-i")[0] || "";
      const [user, host] = dest.includes("@") ? dest.split("@") : [sys.currentUser, dest];
      const ii = args.indexOf("-i");
      const pubPath = ii !== -1 ? sh.abs(args[ii + 1]) : [SSHDIR + "/id_ed25519.pub", SSHDIR + "/id_rsa.pub"].find(p => sh.lookup(p, true));
      const pub = pubPath && sh.lookup(pubPath, true);
      if (!pub) return { err: "/usr/bin/ssh-copy-id: ERROR: No identities found\n", code: 1 };
      const rec = sys.sshData.hosts[host];
      if (!rec || rec.outcome === "refused" || rec.outcome === "timeout") return { err: `ssh: connect to host ${host} port 22: ${rec && rec.outcome === "refused" ? "Connection refused" : "Connection timed out"}\n`, code: 1 };
      const list = (sys.remoteKeys[host] = sys.remoteKeys[host] || []);
      const key = (pub.content || "").trim();
      const already = list.includes(key);
      if (!already) list.push(key);
      sys.lastCopyId = { host, user, added: !already };
      return { out: `/usr/bin/ssh-copy-id: INFO: Source of key(s) to be installed: "${pubPath}"\n/usr/bin/ssh-copy-id: INFO: attempting to log in with the new key(s), to filter out any that are already installed\n${already ? "/usr/bin/ssh-copy-id: WARNING: All keys were skipped because they already exist on the remote system.\n" : "/usr/bin/ssh-copy-id: INFO: 1 key(s) remain to be installed -- if you are prompted now it is to install the new keys\n\nNumber of key(s) added: 1\n\nNow try logging into the machine, with:   \"ssh '" + user + "@" + host + "'\"\nand check to make sure that only the key(s) you wanted were added.\n"}\n` };
    });
    reg("ssh-agent", hasSsh, function (args) {
      sys.agentUp = true;
      return { out: "SSH_AUTH_SOCK=/tmp/ssh-XXXXXXk3a9Pz/agent.4242; export SSH_AUTH_SOCK;\nSSH_AGENT_PID=4243; export SSH_AGENT_PID;\necho Agent pid 4243;\n" };
    });
    reg("ssh-add", hasSsh, function (args, flags, stdin, sh) {
      if (!sh.vars.SSH_AUTH_SOCK || !sys.agentUp) return { err: "Could not open a connection to your authentication agent.\n", code: 2 };
      if (flags.has("l")) return { out: sys.agentKeys.length ? sys.agentKeys.map(k => `256 SHA256:${blob(43)} ${k.comment} (ED25519)`).join("\n") + "\n" : "The agent has no identities.\n", code: sys.agentKeys.length ? 0 : 1 };
      if (flags.has("D")) { sys.agentKeys = []; return { out: "All identities removed.\n" }; }
      const f = args.filter(a => !a.startsWith("-"))[0] ? sh.abs(args.filter(a => !a.startsWith("-"))[0]) : SSHDIR + "/id_ed25519";
      if (!sh.lookup(f, true)) return { err: `${f}: No such file or directory\n`, code: 1 };
      if (!sys.agentKeys.some(k => k.path === f)) sys.agentKeys.push({ path: f, comment: `ubuntu@${(sys.info && sys.info.hostname) || "host"}` });
      return { out: `Identity added: ${f} (ubuntu@${(sys.info && sys.info.hostname) || "host"})\n` };
    });

    const parseRemote = s => { const m = /^(?:([^@]+)@)?([^:\/]+):(.*)$/.exec(s); return m ? { user: m[1], host: m[2], path: m[3] || "~" } : null; };
    const fmtSize = b => (b >= 1048576 ? Math.round(b / 1048576) + "MB" : Math.max(1, Math.round(b / 1024)) + "KB");

    reg("scp", hasSsh, function (args, flags, stdin, sh) {
      let port = null, ident = null; const operands = [];
      for (let i = 0; i < args.length; i++) { const a = args[i]; if (a === "-P") { port = parseInt(args[++i], 10); continue; } if (a === "-i") { ident = args[++i]; continue; } if (a.startsWith("-")) continue; operands.push(a); }
      if (operands.length < 2) return { err: "usage: scp [-346BCpqrTv] [-c cipher] [-F ssh_config] [-i identity_file]\n           [-l limit] [-o ssh_option] [-P port] [-S program] source ... target\n", code: 1 };
      const [src, dst] = [operands[0], operands[operands.length - 1]];
      const up = parseRemote(dst), down = parseRemote(src);
      const rec = h => sys.sshData.hosts[h];
      const connect = host => { const r = rec(host); const used = port || 22; if (!r || r.outcome === "timeout") return `ssh: connect to host ${host} port ${used}: Connection timed out\nlost connection\n`; if (r.outcome === "refused" || used !== (r.port || 22)) return `ssh: connect to host ${host} port ${used}: Connection refused\nlost connection\n`; if (ident && !sh.lookup(sh.abs(ident), true)) return `Warning: Identity file ${ident} not accessible: No such file or directory.\n${host}: Permission denied (publickey).\nlost connection\n`; if (r.outcome === "denied" && !(sys.remoteKeys[host] || []).length) return `ubuntu@${host}: Permission denied (publickey).\nlost connection\n`; return null; };
      if (up && !down) {
        const bad = connect(up.host); if (bad) return { err: bad, code: 1 };
        const node = sh.lookup(sh.abs(src), true);
        if (!node) return { err: `scp: ${src}: No such file or directory\n`, code: 1 };
        if (node.type === "dir" && !flags.has("r")) return { err: `scp: ${src}: not a regular file\n`, code: 1 };
        const dir = up.path.replace(/\/$/, "") || "/";
        const files = ((sys.remote[up.host] = sys.remote[up.host] || {})[dir] = (sys.remote[up.host] || {})[dir] || []);
        const send = (n, name, prefix) => {
          if (n.type === "dir") { let o = ""; [...n.children.entries()].sort((a, b) => a[0].localeCompare(b[0])).forEach(([k, v]) => { o += send(v, k, prefix + name + "/"); }); return o; }
          const entry = { name: prefix + name, size: fmtSize(n.size || 0) }; const i = files.findIndex(f => f.name === entry.name); if (i >= 0) files[i] = entry; else files.push(entry);
          return `${pad(prefix + name, 32)}100% ${lpad(entry.size, 5)}  28.2MB/s   00:00\n`;
        };
        const name = src.split("/").pop();
        sys.lastScp = { src: name, host: up.host, dir, size: fmtSize(node.size || 0), recursive: node.type === "dir", dir2: "up" };
        return { out: send(node, name, "") };
      }
      if (down && !up) {
        const bad = connect(down.host); if (bad) return { err: bad, code: 1 };
        const dir = down.path.replace(/\/[^/]*$/, "") || "/", fname = down.path.split("/").pop();
        const list = ((sys.remote[down.host] || {})[dir] || []).filter(f => f.name === fname || f.name.startsWith(fname + "/"));
        if (!list.length) return { err: `scp: ${down.path}: No such file or directory\n`, code: 1 };
        const base = sh.abs(dst);
        const target = sh.lookup(base, true) && sh.lookup(base, true).type === "dir" ? base + "/" : base;
        let out = "";
        list.forEach(f => {
          const dest = target.endsWith("/") ? target + f.name : target;
          sh.mkdirp(dest.slice(0, dest.lastIndexOf("/")) || "/");
          const n = sh.createFile(dest, ""); if (n) { n.size = /MB$/.test(f.size) ? parseInt(f.size, 10) * 1048576 : parseInt(f.size, 10) * 1024; n.sizeDeclared = true; n.content = null; }
          out += `${pad(f.name, 32)}100% ${lpad(f.size, 5)}  28.2MB/s   00:00\n`;
        });
        sys.lastScp = { src: fname, host: down.host, dir, size: list[0].size, dir2: "down" };
        return { out };
      }
      return { err: "scp: local to local copies are not simulated here (use cp)\n", code: 1 };
    }, args => args.filter(a => !a.startsWith("-") && !/^\d+$/.test(a)).length >= 2);

    reg("rsync", hasSsh, function (args, flags, stdin, sh) {
      const operands = args.filter(a => !a.startsWith("-"));
      if (operands.length < 2) return { err: "rsync: missing destination\n", code: 1 };
      const [src, dst] = [operands[0], operands[operands.length - 1]];
      const dry = flags.has("n") || args.includes("--dry-run");
      const up = parseRemote(dst);
      const srcNode = sh.lookup(sh.abs(src.replace(/\/$/, "")), true);
      if (!srcNode) return { err: `rsync: link_stat "${sh.abs(src)}" failed: No such file or directory (2)\nrsync error: some files/attrs were not transferred (see previous errors) (code 23) at main.c(1207) [sender=3.2.7]\n`, code: 23 };
      const contentsOnly = src.endsWith("/");
      const collect = (n, rel, out) => { if (n.type === "dir") { [...n.children.entries()].sort((a, b) => a[0].localeCompare(b[0])).forEach(([k, v]) => collect(v, rel ? rel + "/" + k : k, out)); } else out.push({ name: rel, n }); return out; };
      let files = srcNode.type === "dir" ? collect(srcNode, contentsOnly ? "" : src.replace(/\/$/, "").split("/").pop(), []) : [{ name: src.split("/").pop(), n: srcNode }];
      if (srcNode.type === "dir" && !flags.has("a") && !flags.has("r")) return { err: `skipping directory ${src}\n`, code: 0 };
      let moved = [];
      if (up) {
        const r = sys.sshData.hosts[up.host];
        if (!r || r.outcome !== "ok" && !(r.outcome === "denied" && (sys.remoteKeys[up.host] || []).length)) return { err: `ssh: connect to host ${up.host} port 22: Connection ${r && r.outcome === "refused" ? "refused" : "timed out"}\nrsync: connection unexpectedly closed (0 bytes received so far) [sender]\nrsync error: unexplained error (code 255) at io.c(231) [sender=3.2.7]\n`, code: 255 };
        const dir = up.path.replace(/\/$/, "") || "/";
        const list = ((sys.remote[up.host] = sys.remote[up.host] || {})[dir] = (sys.remote[up.host] || {})[dir] || []);
        files.forEach(f => { const entry = { name: f.name, size: fmtSize(f.n.size || 0) }; const i = list.findIndex(x => x.name === f.name); if (i < 0 || list[i].size !== entry.size) { moved.push(f.name); if (!dry) { if (i >= 0) list[i] = entry; else list.push(entry); } } });
        if (flags.has("delete") || args.includes("--delete")) { const keep = new Set(files.map(f => f.name)); for (let i = list.length - 1; i >= 0; i--) if (!keep.has(list[i].name)) { moved.push("deleting " + list[i].name); if (!dry) list.splice(i, 1); } }
      } else {
        const base = sh.abs(dst.replace(/\/$/, ""));
        files.forEach(f => { const target = base + "/" + f.name; const ex = sh.lookup(target, true); if (!ex || (ex.size || 0) !== (f.n.size || 0)) { moved.push(f.name); if (!dry) { sh.mkdirp(target.slice(0, target.lastIndexOf("/"))); const n = ex || sh.createFile(target, ""); n.content = f.n.content; n.size = f.n.size || 0; n.sizeDeclared = !!f.n.sizeDeclared; n.age = 0; } } });
      }
      const total = files.reduce((s, f) => s + (f.n.size || 0), 0);
      sys.lastRsync = { src, dst, files: moved.slice(), dry, total };
      return { out: `${dry ? "sending incremental file list (DRY RUN)" : "sending incremental file list"}\n${moved.join("\n")}${moved.length ? "\n" : ""}\nsent ${(total + 120).toLocaleString()} bytes  received 54 bytes  ${Math.round((total + 174) / 2).toLocaleString()}.00 bytes/sec\ntotal size is ${total.toLocaleString()}  speedup is ${(total / (total + 174)).toFixed(2)}${dry ? " (DRY RUN)" : ""}\n` };
    }, args => args.filter(a => !a.startsWith("-")).length >= 2);

    // sshd -t validates the server config; sshd -T prints the effective settings (read from /etc/ssh/sshd_config)
    reg("sshd", hasSsh, function (args, flags, stdin, sh) {
      const cfg = readFile(sh, "/etc/ssh/sshd_config");
      if (cfg === null) return { err: "sshd: /etc/ssh/sshd_config: No such file or directory\n", code: 255 };
      const rows = cfg.split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#"));
      const bad = rows.find(l => !/^[A-Za-z][A-Za-z0-9]*\s+\S/.test(l));
      if (bad) return { err: "/etc/ssh/sshd_config: line: Bad configuration option: " + bad + "\n/etc/ssh/sshd_config: terminating, 1 bad configuration options\n", code: 255 };
      if (flags.has("T")) {
        const cur = {}; rows.forEach(l => { const m = /^(\S+)\s+(.*)$/.exec(l); if (m) cur[m[1].toLowerCase()] = m[2]; });
        const defaults = { port: "22", permitrootlogin: "without-password", passwordauthentication: "yes", pubkeyauthentication: "yes", x11forwarding: "no", maxauthtries: "6" };
        return { out: Object.entries(Object.assign({}, defaults, cur)).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => k + " " + v).join("\n") + "\n" };
      }
      return { out: "" };
    }, args => args.length === 0 || args.every(a => a === "-t" || a === "-T"));

    reg("sftp", hasSsh, function (args) {
      const dest = args.filter(a => !a.startsWith("-"))[0] || "";
      const [user, host] = dest.includes("@") ? dest.split("@") : [sys.currentUser, dest];
      const r = sys.sshData.hosts[host];
      sys.lastSftp = { host, user, ok: !!r && r.outcome === "ok" };
      if (!r || r.outcome !== "ok") return { err: `ssh: connect to host ${host} port 22: Connection ${r && r.outcome === "refused" ? "refused" : "timed out"}\nConnection closed\n`, code: 255 };
      return { out: `Connected to ${host}.\nsftp> \n[sandbox: sftp is an interactive session (get, put, ls, cd, quit). For scripted transfers use scp or rsync.]\n` };
    });
  });
})(typeof window !== "undefined" ? window : globalThis);

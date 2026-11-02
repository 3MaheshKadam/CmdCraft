/**
 * CmdCraft simulated system, part 2: system info, networking, storage and SSH.
 *
 * Registers itself with SystemState.extensions (system.js). A scenario seeds the data it needs under
 * `system.sysinfo`, `system.network`, `system.disks` and `system.ssh` in goals.js; a command is only simulated when
 * its data exists, so scenarios without it keep their regex check. Each command also records what it did
 * (`sys.lastDns`, `sys.lastSsh`, ...) which the live panels in viz.js draw.
 */
(function (root) {
  if (!root.SystemState) return;
  const HOST = "ip-172-31-42-12";

  const pad = (s, n) => String(s).padEnd(n);
  const lpad = (s, n) => String(s).padStart(n);

  function table(rows, gap) {
    const widths = rows[0].map((_, c) => Math.max(...rows.map(r => String(r[c] == null ? "" : r[c]).length)));
    return rows.map(r => r.map((cell, c) => (c === r.length - 1 ? String(cell == null ? "" : cell) : pad(cell == null ? "" : cell, widths[c] + (gap || 1)))).join("").trimEnd()).join("\n") + "\n";
  }

  // deterministic fake key material, so output is stable between runs
  let keyCounter = 0;
  const keyBlob = n => { let s = ""; const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"; for (let i = 0; i < n; i++) s += chars[(i * 7 + keyCounter * 13 + (i % 5) * 3) % chars.length]; keyCounter++; return s; };

  root.SystemState.extensions.push(function (sys, seed) {
    sys.info = seed.sysinfo || null;
    sys.net = seed.network || null;
    sys.disks = seed.disks || null;
    sys.sshData = seed.ssh || null;
    sys.remote = (seed.ssh && seed.ssh.remote) || {};
    sys.lastDns = null; sys.lastPing = null; sys.lastHttp = null; sys.lastSockets = null; sys.lastIp = null;
    sys.lastDf = null; sys.lastDu = null; sys.lastLsblk = null; sys.lastFindmnt = null;
    sys.lastSsh = null; sys.lastScp = null; sys.lastKeygen = null; sys.lastUname = null;

    sys.extraState = () => sys.remote;

    const reg = (name, has, fn, supported) => { sys.ext[name] = { has, fn, supported }; };
    const hasInfo = () => !!sys.info, hasNet = () => !!sys.net, hasDisks = () => !!sys.disks, hasSsh = () => !!sys.sshData;

    // ---------- system info ----------
    reg("uname", hasInfo, function (args) {
      const i = sys.info;
      const set = new Set();
      args.forEach(a => { if (/^-[a-z]+$/.test(a)) a.slice(1).split("").forEach(f => set.add(f)); });
      sys.lastUname = { flags: [...set] };
      if (!set.size) return { out: "Linux\n" };
      const parts = [];
      const all = set.has("a");
      if (all || set.has("s")) parts.push("Linux");
      if (all || set.has("n")) parts.push(i.hostname);
      if (all || set.has("r")) parts.push(i.kernel);
      if (all || set.has("v")) parts.push(i.kernelVersion);
      if (all || set.has("m")) parts.push(i.arch);
      if (all) { parts.push(i.arch, i.arch); }
      if (all || set.has("o")) parts.push("GNU/Linux");
      return { out: parts.join(" ") + "\n" };
    });
    reg("hostname", hasInfo, function () { return { out: sys.info.hostname + "\n" }; });
    reg("hostnamectl", hasInfo, function () {
      const i = sys.info;
      return { out: " Static hostname: " + i.hostname + "\n       Icon name: computer-vm\n         Chassis: vm\n      Machine ID: ec2b7f1e0e4a4a6f9a4b1c2d3e4f5a6b\n         Boot ID: 7c1d3a96b0b24c58b3a7f9c2d8e41a05\n  Virtualization: amazon\nOperating System: " + i.osName + "\n          Kernel: Linux " + i.kernel + "\n    Architecture: " + (i.arch === "x86_64" ? "x86-64" : i.arch) + "\n" };
    });
    reg("systemd-analyze", hasInfo, function (args) {
      if (args[0] === "blame") return { out: "9.812s cloud-init-local.service\n3.201s apt-daily.service\n1.540s snapd.service\n1.204s networkd-dispatcher.service\n  842ms nginx.service\n" };
      return { out: "Startup finished in 2.512s (kernel) + 14.337s (userspace) = 16.849s \ngraphical.target reached after 14.201s in userspace.\n" };
    }, args => args.length === 0 || args[0] === "blame");

    // ---------- networking ----------
    reg("ip", hasNet, function (args) {
      sys.lastIp = true;
      let out = "";
      sys.net.interfaces.forEach(n => {
        out += `${n.idx}: ${n.name}: <${n.flags}> mtu ${n.mtu} qdisc ${n.qdisc || "fq_codel"} state ${n.state} group default qlen 1000\n`;
        out += `    link/${n.name === "lo" ? "loopback" : "ether"} ${n.mac} brd ${n.name === "lo" ? "00:00:00:00:00:00" : "ff:ff:ff:ff:ff:ff"}\n`;
        if (n.ipv4) out += `    inet ${n.ipv4}${n.brd ? " brd " + n.brd : ""} scope ${n.scope || "global"}${n.dynamic ? " dynamic" : ""} ${n.name}\n       valid_lft ${n.dynamic ? "3187sec preferred_lft 3187sec" : "forever preferred_lft forever"}\n`;
      });
      return { out };
    }, args => { const a = args.filter(x => x !== "show"); return a.length === 1 && ["addr", "a", "address"].includes(a[0]); });

    reg("ss", hasNet, function (args, flags) {
      let rows = sys.net.sockets.filter(s => (flags.has("l") ? /LISTEN|UNCONN/.test(s.state) : s.state === "ESTAB"));
      const wantT = flags.has("t"), wantU = flags.has("u");
      if (wantT || wantU) rows = rows.filter(s => (s.proto === "tcp" && wantT) || (s.proto === "udp" && wantU));
      sys.lastSockets = { listening: flags.has("l"), rows: rows.slice() };
      const header = ["Netid", "State", "Recv-Q", "Send-Q", "Local Address:Port", "Peer Address:Port", flags.has("p") ? "Process" : ""];
      const body = rows.map(s => [s.proto, s.state, s.recvq || 0, s.sendq || 0, `${s.addr}:${s.port}`, s.peer || (s.proto === "udp" ? "0.0.0.0:*" : "0.0.0.0:*"),
        flags.has("p") && s.proc ? `users:(("${s.proc}",pid=${s.pid},fd=${s.fd || 19}))` : ""]);
      return { out: table([header, ...body], 2) };
    });

    reg("curl", hasNet, function (args, flags) {
      const url = args.filter(a => !a.startsWith("-"))[0];
      const m = /^https?:\/\/([^/:]+)(?::(\d+))?(\/.*)?$/.exec(url || "");
      if (!m) return { err: `curl: (3) URL using bad/illegal format or missing URL\n` };
      const host = m[1], port = m[2] || "80", path = m[3] || "/";
      const key = Object.keys(sys.net.http).find(k => k === url || k === url + "/" || k + "/" === url);
      const ip = host === "localhost" ? "127.0.0.1" : host;
      const rec = key ? sys.net.http[key] : null;
      const verbose = flags.has("v");
      if (!rec || rec.refused) {
        sys.lastHttp = { url, ok: false, error: "Connection refused", steps: ["connect"], host, port };
        return { out: verbose ? `*   Trying ${ip}:${port}...\n` : "", err: `${verbose ? "* connect to " + ip + " port " + port + " failed: Connection refused\n* Failed to connect to " + host + " port " + port + " after 0 ms: Connection refused\n" : ""}curl: (7) Failed to connect to ${host} port ${port} after 0 ms: Connection refused\n` };
      }
      sys.lastHttp = { url, ok: rec.status < 400, status: rec.status, statusText: rec.statusText, headers: rec.headers, body: rec.body, host, port, path };
      let out = "";
      if (verbose) {
        out += `*   Trying ${ip}:${port}...\n* Connected to ${host} (${ip}) port ${port} (#0)\n> GET ${path} HTTP/1.1\n> Host: ${host}:${port}\n> User-Agent: curl/7.81.0\n> Accept: */*\n>\n* Mark bundle as not supporting multiuse\n`;
        out += `< HTTP/1.1 ${rec.status} ${rec.statusText}\n` + Object.entries(rec.headers).map(([k, v]) => `< ${k}: ${v}`).join("\n") + "\n<\n";
        out += `* Connection #0 to host ${host} left intact\n`;
      }
      return { out: out + rec.body + (rec.body.endsWith("\n") ? "" : "\n") };
    }, args => args.every(a => !a.startsWith("-") || ["-v", "-s", "-sv", "-vs", "-i", "-I"].includes(a)) && args.some(a => !a.startsWith("-")));

    reg("dig", hasNet, function (args) {
      const short = args.includes("+short");
      const name = args.filter(a => !a.startsWith("+") && !a.startsWith("-") && !a.startsWith("@"))[0];
      const rec = sys.net.dns[name];
      sys.lastDns = { name, rec: rec || null, short };
      if (short) return { out: rec ? rec.answers.join("\n") + "\n" : "" };
      let out = `\n; <<>> DiG 9.18.18-0ubuntu0.22.04.2-Ubuntu <<>> ${name}\n;; Got answer:\n;; ->>HEADER<<- opcode: QUERY, status: ${rec ? "NOERROR" : "NXDOMAIN"}\n\n`;
      if (rec) out += `;; ANSWER SECTION:\n` + rec.answers.map(a => `${name}.\t${rec.ttl || 300}\tIN\tA\t${a}`).join("\n") + `\n\n;; Query time: 14 msec\n;; SERVER: ${rec.resolver || "127.0.0.53"}#53(${rec.resolver || "127.0.0.53"})\n`;
      return { out };
    }, args => args.some(a => !a.startsWith("+") && !a.startsWith("-")));

    reg("ping", hasNet, function (args) {
      const ci = args.indexOf("-c");
      const count = ci !== -1 ? parseInt(args[ci + 1], 10) : 4;
      const host = args.filter((a, i) => !a.startsWith("-") && !(ci !== -1 && i === ci + 1))[0];
      const rec = sys.net.ping[host];
      if (!rec) return { err: `ping: ${host}: Name or service not known\n` };
      const rtts = Array.from({ length: count }, (_, i) => rec.rtt[i % rec.rtt.length]);
      const lost = Math.min(count, rec.lost || 0);
      const got = rtts.slice(0, count - lost);
      sys.lastPing = { host, sent: count, received: count - lost, rtts, lost };
      let out = `PING ${host} (${host}) 56(84) bytes of data.\n`;
      rtts.forEach((t, i) => { if (i < count - lost) out += `64 bytes from ${host}: icmp_seq=${i + 1} ttl=${rec.ttl || 116} time=${t.toFixed(1)} ms\n`; });
      const min = Math.min(...got), max = Math.max(...got), avg = got.reduce((a, b) => a + b, 0) / (got.length || 1);
      out += `\n--- ${host} ping statistics ---\n${count} packets transmitted, ${count - lost} received, ${Math.round(100 * lost / count)}% packet loss, time ${(count - 1) * 1001}ms\n`;
      if (got.length) out += `rtt min/avg/max/mdev = ${min.toFixed(3)}/${avg.toFixed(3)}/${max.toFixed(3)}/0.${Math.round(max - min) + 1}00 ms\n`;
      return { out };
    }, args => args.includes("-c"));

    // ---------- storage ----------
    reg("df", hasDisks, function (args, flags) {
      const inodes = flags.has("i");
      if (flags.has("T")) {
        sys.lastDf = { inodes };
        return { out: table([["Filesystem", "Type", "Size", "Used", "Avail", "Use%", "Mounted on"], ...sys.disks.filesystems.map(f => [f.fs, f.type || (f.fs === "tmpfs" ? "tmpfs" : "ext4"), f.size, f.used, f.avail, f.pct + "%", f.mount])], 2) };
      }
      sys.lastDf = { inodes };
      const fs = sys.disks.filesystems;
      if (inodes) {
        return { out: table([["Filesystem", "Inodes", "IUsed", "IFree", "IUse%", "Mounted on"], ...fs.map(f => [f.fs, f.inodes[0], f.inodes[1], f.inodes[0] - f.inodes[1], Math.round(100 * f.inodes[1] / f.inodes[0]) + "%", f.mount])], 2) };
      }
      return { out: table([["Filesystem", "Size", "Used", "Avail", "Use%", "Mounted on"], ...fs.map(f => [f.fs, f.size, f.used, f.avail, f.pct + "%", f.mount])], 2) };
    }, args => args.every(a => /^-[hiT]+$/.test(a)));
    reg("mount", hasDisks, function () {
      sys.lastMountList = true;
      return { out: sys.disks.mounts.map(m => m.source + " on " + m.target + " type " + m.fstype + " (" + m.options + ")").join("\n") + "\n" };
    }, args => args.length === 0 || args.every(a => a.startsWith("-") && !/^-[aoOrw]$/.test(a) || a === "ext4"));

    reg("du", hasDisks, function (args, flags) {
      const target = args.filter(a => !a.startsWith("-"))[0] || ".";
      const data = sys.disks.du[target];
      if (!data) return { err: `du: cannot access '${target}': No such file or directory\n` };
      sys.lastDu = { target, rows: data };
      const rows = flags.has("s") ? data.filter(r => r.path === target) : data;
      return { out: rows.map(r => `${pad(r.size, 8)}${r.path}`).join("\n") + "\n" };
    }, args => args.every(a => /^-[a-z0-9]+$/.test(a) || !a.startsWith("-")));

    reg("lsblk", hasDisks, function (args, flags) {
      const withFs = flags.has("f");
      sys.lastLsblk = { fs: withFs };
      const rows = [];
      sys.disks.devices.forEach(d => {
        const line = (name, x) => withFs
          ? [name, x.fstype || "", x.fsver || "", x.label || "", x.uuid || "", x.avail || "", x.use || "", x.mount || ""]
          : [name, x.majmin || "", x.rm || "0", x.size || "", x.ro || "0", x.type || "", x.mount || ""];
        rows.push(line(d.name, d));
        (d.children || []).forEach((c, i) => rows.push(line((i === d.children.length - 1 ? "└─" : "├─") + c.name, c)));
      });
      const header = withFs ? ["NAME", "FSTYPE", "FSVER", "LABEL", "UUID", "FSAVAIL", "FSUSE%", "MOUNTPOINTS"] : ["NAME", "MAJ:MIN", "RM", "SIZE", "RO", "TYPE", "MOUNTPOINTS"];
      return { out: table([header, ...rows], 2) };
    }, args => args.every(a => /^-[fa]+$/.test(a)));

    reg("findmnt", hasDisks, function (args) {
      const path = args.filter(a => !a.startsWith("-"))[0];
      const mounts = sys.disks.mounts;
      const rows = path ? mounts.filter(m => m.target === path) : mounts;
      sys.lastFindmnt = { path: path || null, found: rows.length > 0, rows };
      if (!rows.length) return {};
      return { out: table([["TARGET", "SOURCE", "FSTYPE", "OPTIONS"], ...rows.map(m => [m.target, m.source, m.fstype, m.options])], 1) };
    }, args => args.every(a => !a.startsWith("-")));

    // ---------- ssh ----------
    reg("ssh", hasSsh, function (args, flags) {
      const operands = args.filter((a, i) => !a.startsWith("-") && !(["-p", "-i", "-l"].includes(args[i - 1])));
      const dest = operands[0] || "";
      const [user, host] = dest.includes("@") ? dest.split("@") : [sys.currentUser, dest];
      const rec = sys.sshData.hosts[host];
      const verbose = flags.has("v");
      const port = (rec && rec.port) || 22;
      const steps = [
        { id: "tcp", label: `TCP connect :${port}`, status: "skip" },
        { id: "kex", label: "Key exchange", status: "skip" },
        { id: "hostkey", label: "Host key", status: "skip" },
        { id: "auth", label: "Authenticate (publickey)", status: "skip" },
        { id: "session", label: "Open session", status: "skip" }
      ];
      sys.lastSsh = { host, user, port, steps, outcome: "unknown", verbose };
      const dbg = [];
      const v = line => { if (verbose) dbg.push(line); };
      v("OpenSSH_8.9p1 Ubuntu-3ubuntu0.4, OpenSSL 3.0.2 15 Mar 2022");
      v("debug1: Reading configuration data /etc/ssh/ssh_config");
      v(`debug1: Connecting to ${host} [${host}] port ${port}.`);
      const finish = (extra, err) => { sys.lastSsh.outcome = rec ? rec.outcome : "unreachable"; return { out: dbg.join("\n") + (dbg.length ? "\n" : "") + (extra || ""), err: err || "" }; };
      if (!rec || rec.outcome === "timeout") {
        steps[0].status = "fail";
        steps[0].detail = "Connection timed out";
        return finish("", `ssh: connect to host ${host} port ${port}: Connection timed out\n`);
      }
      if (rec.outcome === "refused") {
        steps[0].status = "fail";
        steps[0].detail = "Connection refused";
        v(`debug1: connect to address ${host} port ${port}: Connection refused`);
        return finish("", `ssh: connect to host ${host} port ${port}: Connection refused\n`);
      }
      steps[0].status = "ok";
      v("debug1: Connection established.");
      v("debug1: Remote protocol version 2.0, remote software version OpenSSH_8.9p1");
      steps[1].status = "ok"; v("debug1: kex: algorithm: curve25519-sha256");
      steps[2].status = "ok"; v(`debug1: Server host key: ssh-ed25519 SHA256:${keyBlob(43)}`);
      v(`debug1: Authenticating to ${host}:${port} as '${user}'`);
      v("debug1: Offering public key: /home/ubuntu/.ssh/id_ed25519 ED25519");
      if (rec.outcome === "denied") {
        steps[3].status = "fail"; steps[3].detail = "Server rejected the key";
        v("debug1: Authentications that can continue: publickey");
        return finish("", `${user}@${host}: Permission denied (publickey).\n`);
      }
      steps[3].status = "ok"; v("debug1: Server accepts key: /home/ubuntu/.ssh/id_ed25519 ED25519");
      v(`Authenticated to ${host} ([${host}]:${port}) using "publickey".`);
      steps[4].status = "ok"; v("debug1: channel 0: new [client-session]");
      return finish(`[sandbox: connected to ${user}@${host}. The remote shell itself is not simulated.]\n`);
    }, args => args.some(a => /@|^\d+\.\d+\.\d+\.\d+$/.test(a)));

    reg("scp", hasSsh, function (args, flags, stdin, sh) {
      const operands = args.filter((a, i) => !a.startsWith("-") && !(["-P", "-i"].includes(args[i - 1])));
      if (operands.length < 2) return { err: "usage: scp [-r] source ... target\n" };
      const src = operands[0], dest = operands[1];
      const m = /^(?:([^@]+)@)?([^:]+):(.*)$/.exec(dest);
      if (!m) return { err: "scp: local to local copies are not simulated here\n" };
      const host = m[2], dir = (m[3] || "~").replace(/\/$/, "") || "/";
      const node = sh.lookup(sh.abs(src), true);
      if (!node) return { err: `scp: ${src}: No such file or directory\n` };
      const rec = sys.sshData.hosts[host];
      if (!rec || rec.outcome !== "ok") return { err: `ssh: connect to host ${host} port 22: ${rec && rec.outcome === "refused" ? "Connection refused" : "Connection timed out"}\nlost connection\n` };
      const files = (sys.remote[host] = sys.remote[host] || {});
      const list = (files[dir] = files[dir] || []);
      const name = src.split("/").pop();
      const size = node.size || 0;
      const idx = list.findIndex(f => f.name === name);
      const entry = { name, size: size >= 1048576 ? Math.round(size / 1048576) + "MB" : Math.max(1, Math.round(size / 1024)) + "KB" };
      if (idx >= 0) list[idx] = entry; else list.push(entry);
      sys.lastScp = { src: name, host, dir, size: entry.size };
      return { out: `${pad(name, 32)}100% ${lpad(entry.size, 5)}  28.2MB/s   00:00\n` };
    }, args => args.filter(a => !a.startsWith("-")).length >= 2);

    reg("ssh-keygen", hasSsh, function (args, flags, stdin, sh) {
      const o = root.SystemState.parseOpts(args, ["t", "f", "N", "C", "b"]);
      const type = o.values.t || "rsa";
      const home = "/home/ubuntu";
      const path = o.values.f ? sh.abs(o.values.f) : `${home}/.ssh/id_${type}`;
      sys.lastKeygen = { type, path, created: false };
      if (sh.lookup(path)) return { out: `${path} already exists.\nOverwrite (y/n)? `, err: "" };
      sh.mkdirp(dirnameOf(path));
      const dir = sh.lookup(dirnameOf(path)); if (dir) dir.mode = 0o700;
      const algo = type === "ed25519" ? "ssh-ed25519" : type === "ecdsa" ? "ecdsa-sha2-nistp256" : "ssh-rsa";
      const comment = o.values.C || `ubuntu@${(sys.info && sys.info.hostname) || HOST}`;
      const priv = sh.createFile(path, `-----BEGIN OPENSSH PRIVATE KEY-----\n${keyBlob(70)}\n${keyBlob(70)}\n-----END OPENSSH PRIVATE KEY-----\n`);
      const pub = sh.createFile(path + ".pub", `${algo} AAAAC3NzaC1lZDI1NTE5AAAAI${keyBlob(43)} ${comment}\n`);
      priv.mode = 0o600; pub.mode = 0o644;
      sys.lastKeygen.created = true;
      const bits = type === "ed25519" ? "ED25519 256" : type === "ecdsa" ? "ECDSA 256" : "RSA 3072";
      return { out: `Generating public/private ${type} key pair.\nEnter file in which to save the key (${path}): \nEnter passphrase (empty for no passphrase): \nEnter same passphrase again: \nYour identification has been saved in ${path}\nYour public key has been saved in ${path}.pub\nThe key fingerprint is:\nSHA256:${keyBlob(43)} ${comment}\nThe key's randomart image is:\n+--[${bits}]--+\n|     .o+=o.      |\n|    . o.+*.      |\n|     . =o=+      |\n|      + *=.o     |\n|     . S.+= .    |\n+----[SHA256]-----+\n` };
    }, args => args.some(a => a === "-t" || a.startsWith("-t")));

    function dirnameOf(p) { const i = p.lastIndexOf("/"); return i <= 0 ? "/" : p.slice(0, i); }
  });
})(typeof window !== "undefined" ? window : globalThis);

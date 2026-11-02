/**
 * CmdCraft live panels, part 2. Each one draws the thing a question is actually about:
 *
 *   text            the file(s) a text tool reads, with the lines it matched lit up, plus its output
 *   identity        who you are and what machine this is (whoami, id, uname)
 *   stat            one file's inode card: permission boxes, owner, size, timestamps
 *   path            namei: every directory on the way to a file, and who can pass through
 *   net-interfaces  network interfaces and addresses (ip addr)
 *   net-sockets     listening sockets and what address they are bound to (ss)
 *   net-http        a curl request/response exchange
 *   net-dns         a DNS lookup: resolver, answer, expected vs actual
 *   net-ping        ICMP probes and loss
 *   disk-usage      per-filesystem space and inode bars (df -h / df -i)
 *   disk-du         where the space went (du)
 *   disk-lsblk      block devices, partitions, filesystems, mount points (lsblk)
 *   disk-mount      is this path an active mount point (findmnt)
 *   ssh-connect     the SSH handshake step by step (ssh -v)
 *   transfer        a file moving from here to a remote directory (scp)
 *   archive         archives and compression: what went in, how much smaller
 */
(function (root) {
  if (!root.VizPanels) return;
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  const chip = (text, cls) => el("span", "px-1.5 py-0.5 rounded text-[10px] border " + cls, text);
  const OK = "border-emerald-500/40 text-emerald-400 bg-emerald-500/10";
  const WARN = "border-amber-500/40 text-amber-400 bg-amber-500/10";
  const BAD = "border-red-500/40 text-red-400 bg-red-500/10";
  const DIM = "border-neutral-700 text-neutral-400";
  const HOT = "border-emerald-400 bg-emerald-500/10";
  const fmtBytes = b => (b < 1024 ? b + " B" : b < 1048576 ? (b / 1024).toFixed(b < 10240 ? 1 : 0).replace(/\.0$/, "") + " KB" : (b / 1048576).toFixed(1).replace(/\.0$/, "") + " MB");
  const last = sh => sh.lastExec || null;
  const ranCmd = (sh, ...names) => { const l = last(sh); return l ? l.cmds.find(c => names.includes(c.name)) || null : null; };
  // the verdict goes first so it is never scrolled out of view
  const note = (host, text, cls) => host.insertBefore(el("div", "mb-2 text-[11px] rounded border px-2 py-1.5 " + (cls || DIM), text), host.firstChild);
  const section = (host, title) => host.appendChild(el("div", "text-[11px] text-neutral-500 pt-2 pb-1", title));

  // ---------- text ----------
  const prevLines = new WeakMap();
  function focusFiles(sh) {
    let paths = ((sh.setup && sh.setup.focus) || []).slice();
    const l = last(sh);
    if (l) {
      const found = [];
      l.cmds.forEach(c => c.args.forEach(a => { if (!a.startsWith("-")) { const n = sh.lookup(sh.abs(a), true); if (n && n.type === "file") found.push(a); } }));
      if (found.length) paths = found.slice(0, 2);
    }
    return paths;
  }

  function renderText(host, sh) {
    const l = last(sh);
    const outLines = l ? l.out.replace(/\n$/, "").split("\n").filter(Boolean) : [];
    const memory = prevLines.get(sh) || {};
    focusFiles(sh).forEach(p => {
      const abs = sh.abs(p);
      const n = sh.lookup(abs, true);
      const box = el("div", "rounded-md border border-neutral-800 mb-2");
      const head = el("div", "flex items-center justify-between px-2 py-1 border-b border-neutral-800 bg-surface-1");
      head.appendChild(el("span", "text-neutral-200 truncate", p));
      if (!n || n.type !== "file") {
        head.appendChild(chip("does not exist yet", WARN)); box.appendChild(head);
        box.appendChild(el("div", "px-2 py-2 text-[11px] text-neutral-500", "The command will create this file."));
        host.appendChild(box); memory[abs] = []; return;
      }
      const lines = (n.content === null ? "" : n.content).replace(/\n$/, "").split("\n");
      const before = new Set(memory[abs] || lines);
      const matched = l ? lines.filter(t => t.trim().length > 2 && outLines.some(o => o.includes(t))) : [];
      head.appendChild(el("span", "text-[10px] text-neutral-500", `${lines.length} lines` + (l && matched.length ? ` · ${matched.length} matched` : "")));
      box.appendChild(head);
      const body = el("div", "max-h-40 overflow-y-auto py-1 font-mono text-[11px]");
      lines.slice(-40).forEach((t, i) => {
        const isHit = matched.includes(t);
        const isNew = memory[abs] && !before.has(t);
        const row = el("div", "flex gap-2 px-2 py-0.5 border-l-2 " + (isHit ? HOT : "border-transparent") + (isNew ? " fs-flash" : "") + (l && matched.length && !isHit ? " opacity-50" : ""));
        row.appendChild(el("span", "w-6 shrink-0 text-right text-neutral-600", String(lines.length > 40 ? lines.length - 40 + i + 1 : i + 1)));
        row.appendChild(el("span", "break-all text-neutral-200", t));
        body.appendChild(row);
      });
      box.appendChild(body);
      host.appendChild(box);
      memory[abs] = lines;
    });
    prevLines.set(sh, memory);

    if (l && (outLines.length || l.err)) {
      const out = el("div", "rounded-md border border-neutral-800");
      const head = el("div", "flex items-center justify-between px-2 py-1 border-b border-neutral-800 bg-surface-1");
      head.appendChild(el("span", "text-neutral-200", "Output"));
      head.appendChild(el("span", "text-[10px] text-neutral-500", `${outLines.length} line${outLines.length === 1 ? "" : "s"}`));
      out.appendChild(head);
      const body = el("div", "max-h-32 overflow-y-auto py-1 font-mono text-[11px]");
      outLines.slice(0, 30).forEach(t => body.appendChild(el("div", "px-2 py-0.5 break-all text-emerald-300", t)));
      if (l.err) body.appendChild(el("div", "px-2 py-0.5 break-all text-red-400", l.err.trim()));
      out.appendChild(body);
      host.appendChild(out);
    } else if (!l) {
      host.appendChild(el("div", "text-[11px] text-neutral-500", "Run your command: the lines it picks out will light up here."));
    }
  }

  // ---------- identity ----------
  function renderIdentity(host, sh) {
    const sys = sh.sys, info = sys.info, u = sys.userByName(sys.currentUser);
    const c = ranCmd(sh, "whoami", "id", "groups", "uname", "hostname");
    const hot = name => (c && c.name === name ? " " + HOT : " border-transparent");
    const row = (label, value, cls) => { const r = el("div", "flex items-center justify-between px-2 py-1 border-l-2" + (cls || " border-transparent")); r.appendChild(el("span", "text-neutral-500", label)); r.appendChild(el("span", "text-neutral-100 text-right", value)); return r; };

    const who = el("div", "rounded-md border border-neutral-800 mb-2");
    who.appendChild(el("div", "px-2 py-1 border-b border-neutral-800 bg-surface-1 text-neutral-200", "You"));
    who.appendChild(row("username", u.name, hot("whoami")));
    const idHot = c && (c.name === "id") ? " " + HOT : " border-transparent";
    who.appendChild(row("uid / gid", `${u.uid} / ${u.gid}`, idHot));
    const groups = el("div", "flex flex-wrap gap-1 px-2 py-1.5 border-l-2" + (c && (c.name === "id" || c.name === "groups") ? " " + HOT : " border-transparent"));
    groups.appendChild(chip(u.primary, OK));
    (u.groups || []).forEach(g => groups.appendChild(chip(g, DIM)));
    who.appendChild(groups);
    host.appendChild(who);

    const box = el("div", "rounded-md border border-neutral-800");
    box.appendChild(el("div", "px-2 py-1 border-b border-neutral-800 bg-surface-1 text-neutral-200", "This machine"));
    const un = c && (c.name === "uname" || c.name === "hostname");
    const flags = c && c.name === "uname" ? c.flags : new Set();
    const all = flags.has("a");
    const lit = (key) => (un && (all || flags.has(key) || (c.name === "hostname" && key === "n")) ? " " + HOT : " border-transparent");
    box.appendChild(row("hostname", info.hostname, lit("n")));
    box.appendChild(row("kernel", info.kernel, lit("r")));
    box.appendChild(row("architecture", info.arch, lit("m")));
    box.appendChild(row("operating system", info.osName, lit("o")));
    host.appendChild(box);
    if (!c) host.appendChild(el("div", "mt-2 text-[11px] text-neutral-500", "Run your command: the part of the picture that answers it lights up."));
  }

  // ---------- stat ----------
  function renderStat(host, sh) {
    const p = (sh.setup && sh.setup.focus && sh.setup.focus[0]) || "/";
    const abs = sh.abs(p);
    const n = sh.lookup(abs);
    if (!n) { host.appendChild(el("div", "text-neutral-500", abs + " does not exist")); return; }
    const used = !!sh.lastStat;
    const card = el("div", "rounded-md border border-neutral-800");
    const head = el("div", "flex items-center justify-between px-2 py-1.5 border-b border-neutral-800 bg-surface-1");
    head.appendChild(el("span", "text-neutral-100 truncate", abs));
    head.appendChild(chip(n.type === "dir" ? "directory" : n.type === "link" ? "symlink" : "regular file", DIM));
    card.appendChild(head);

    const grid = el("div", "grid grid-cols-3 gap-2 p-2");
    [["Owner", 6], ["Group", 3], ["Others", 0]].forEach(([label, shift]) => {
      const col = el("div", "rounded border border-neutral-800 p-1.5 text-center" + (used ? "" : " opacity-70"));
      col.appendChild(el("div", "text-[10px] text-neutral-500 mb-1", label));
      const bits = el("div", "flex justify-center gap-1");
      [["r", 4], ["w", 2], ["x", 1]].forEach(([ch, bit]) => {
        const on = ((n.mode >> shift) & bit) !== 0;
        bits.appendChild(el("span", "w-5 h-5 rounded text-[11px] flex items-center justify-center border " + (on ? OK : "border-neutral-800 text-neutral-600"), ch));
      });
      col.appendChild(bits);
      grid.appendChild(col);
    });
    card.appendChild(grid);

    const rows = el("div", "px-2 pb-2 text-[11px] space-y-0.5");
    const add = (k, v, hot) => { const r = el("div", "flex justify-between px-1.5 py-0.5 border-l-2 " + (hot && used ? HOT : "border-transparent")); r.appendChild(el("span", "text-neutral-500", k)); r.appendChild(el("span", "text-neutral-200", v)); rows.appendChild(r); };
    const st = sh.lastStat;
    add("owner : group", `${n.owner} : ${n.group}`, true);
    add("size", fmtBytes(n.size || 0), true);
    add("inode", st ? String(st.inode) : "shown by stat", true);
    add("octal mode", st ? st.octal : ("0" + n.mode.toString(8)).slice(-4), true);
    add("Access", "last read: 2026-10-29 10:15:00", true);
    add("Modify", "content last changed: 2026-10-25 08:30:12", true);
    add("Change", "metadata (perms/owner) last changed: 2026-10-25 08:30:12", true);
    card.appendChild(rows);
    host.appendChild(card);
    if (!used) host.appendChild(el("div", "mt-2 text-[11px] text-neutral-500", "Run stat to read the inode: the highlighted fields are what it reports."));
  }

  // ---------- path (namei) ----------
  function walkPath(sh, abs) {
    const chain = [{ name: "/", node: sh.root, path: "/" }];
    let node = sh.root, cur = "";
    for (const part of abs.split("/").filter(Boolean)) {
      const next = node && node.type === "dir" ? node.children.get(part) : null;
      if (!next) { chain.push({ name: part, missing: true }); break; }
      cur += "/" + part;
      chain.push({ name: part, node: next, path: cur, label: next.type === "link" ? part + " → " + next.target : part });
      node = next.type === "link" ? sh.followLink(next, cur.slice(1, cur.lastIndexOf("/"))) : next;
    }
    return chain;
  }

  function renderPath(host, sh) {
    const target = (sh.setup && sh.setup.focus && sh.setup.focus[0]) || "/";
    const abs = sh.abs(target);
    const used = !!sh.lastNamei;
    host.appendChild(el("div", "text-[11px] text-neutral-500 pb-2", "You are ubuntu, which counts as “others” on root-owned folders. To open a file you need x on every folder above it."));
    const chain = walkPath(sh, abs);
    let blockedAt = null;
    const list = el("div", "space-y-1");
    chain.forEach((c, i) => {
      if (c.missing) { list.appendChild(el("div", "px-2 py-1 text-red-400", c.name + ": no such file or directory")); return; }
      const n = c.node;
      const isLast = i === chain.length - 1;
      const needsX = n.type === "dir" || (n.type === "link" && !isLast);
      const othersX = (n.mode & 1) !== 0;
      const blocked = needsX && !othersX && n.owner !== "ubuntu" && !blockedAt;
      if (blocked) blockedAt = c.path;
      const row = el("div", "flex items-center gap-2 px-2 py-1 rounded border " + (blocked && used ? "border-red-500/60 bg-red-500/10" : "border-neutral-800"));
      row.appendChild(el("span", "w-3 text-center text-neutral-500", i === 0 ? "/" : "└"));
      row.appendChild(el("span", "font-mono text-[11px] text-emerald-300 w-[84px] shrink-0", permStr(n)));
      row.appendChild(el("span", "text-neutral-400 w-[84px] shrink-0 truncate", `${n.owner}:${n.group}`));
      row.appendChild(el("span", "text-neutral-100 truncate", c.label || c.name));
      if (used && needsX) row.appendChild(chip(othersX ? "others can pass" : "others blocked", othersX ? OK : BAD));
      list.appendChild(row);
    });
    host.appendChild(list);
    const lastNode = chain[chain.length - 1].node;
    const fileMode = lastNode ? ("0" + lastNode.mode.toString(8)).slice(-3) : "open";
    if (used) note(host, blockedAt ? `Permission denied at ${blockedAt}: it has no x bit for “others”, so nothing below it is reachable, even though the file itself is ${fileMode}.` : "Every folder on the way is traversable.", blockedAt ? BAD : OK);
    else host.appendChild(el("div", "mt-2 text-[11px] text-neutral-500", "Run namei -l to see where the path breaks."));
  }
  function permStr(n) {
    let s = n.type === "dir" ? "d" : n.type === "link" ? "l" : "-";
    "rwxrwxrwx".split("").forEach((ch, i) => { s += (n.mode & (1 << (8 - i))) ? ch : "-"; });
    return s;
  }

  // ---------- network ----------
  function renderInterfaces(host, sh) {
    const used = !!sh.sys.lastIp;
    host.appendChild(el("div", "text-[11px] text-neutral-500 pb-2", used ? "These are the interfaces ip addr reported." : "Run ip addr to list the interfaces and their addresses."));
    sh.sys.net.interfaces.forEach(n => {
      const primary = n.name !== "lo";
      const card = el("div", "rounded-md border mb-2 p-2.5 " + (used && primary ? "border-emerald-400 bg-emerald-500/5" : "border-neutral-800"));
      const top = el("div", "flex items-center justify-between");
      const l = el("div", "flex items-center gap-2");
      l.appendChild(el("span", "w-2 h-2 rounded-full " + (n.state === "UP" || n.state === "UNKNOWN" ? "bg-emerald-400" : "bg-neutral-500")));
      l.appendChild(el("span", "font-bold text-neutral-100", n.name));
      top.appendChild(l);
      top.appendChild(chip(primary ? "primary network" : "loopback (this machine only)", primary ? OK : DIM));
      card.appendChild(top);
      card.appendChild(el("div", "mt-1.5 text-lg text-neutral-50", used ? n.ipv4 : "• • • • • • •"));
      card.appendChild(el("div", "text-[10px] text-neutral-500", `${n.mac} · mtu ${n.mtu}${n.dynamic ? " · DHCP lease" : ""}`));
      host.appendChild(card);
    });
  }

  function bindLabel(addr) {
    if (["0.0.0.0", "*", "[::]", "::"].includes(addr)) return ["all interfaces", OK];
    if (addr === "127.0.0.1" || addr === "[::1]") return ["localhost only", WARN];
    return [addr, DIM];
  }

  function renderSockets(host, sh) {
    const focus = String((sh.setup && sh.setup.focusPort) || "");
    const used = !!sh.sys.lastSockets;
    const rows = sh.sys.net.sockets.filter(s => /LISTEN|UNCONN/.test(s.state));
    const table = el("div", "rounded-md border border-neutral-800 overflow-hidden");
    const head = el("div", "grid gap-2 px-2 py-1 bg-surface-1 text-[10px] text-neutral-500");
    head.style.gridTemplateColumns = "34px 1fr 1fr";
    ["PROTO", "LISTENING ON", "PROCESS"].forEach(t => head.appendChild(el("div", "", t)));
    table.appendChild(head);
    rows.forEach(s => {
      const hit = used && String(s.port) === focus;
      const r = el("div", "grid gap-2 px-2 py-1.5 items-center border-t border-neutral-800 border-l-2 " + (hit ? HOT : "border-l-transparent" + (used ? " opacity-60" : "")));
      r.style.gridTemplateColumns = "34px 1fr 1fr";
      r.appendChild(el("span", "text-neutral-400", s.proto));
      const addr = el("div", "flex flex-wrap items-center gap-1.5");
      addr.appendChild(el("span", "text-neutral-100", `${s.addr}:${s.port}`));
      const [label, cls] = bindLabel(s.addr);
      if (used) addr.appendChild(chip(label, cls));
      r.appendChild(addr);
      r.appendChild(el("span", "text-neutral-300 truncate", s.proc ? `${s.proc} (pid ${s.pid})` : "kernel"));
      table.appendChild(r);
    });
    host.appendChild(table);
    if (used && focus) {
      const s = rows.find(x => String(x.port) === focus);
      if (!s) note(host, `Nothing is listening on :${focus}. The application is not running or is on another port.`, BAD);
      else if (bindLabel(s.addr)[1] === WARN) note(host, `:${focus} is bound to ${s.addr}, so only this machine can connect. Remote clients time out. The app must listen on 0.0.0.0.`, WARN);
      else note(host, `:${focus} is open on every interface, served by ${s.proc} (pid ${s.pid}).`, OK);
    } else host.appendChild(el("div", "mt-2 text-[11px] text-neutral-500", "Run ss to see which ports are open and who owns them."));
  }

  function renderHttp(host, sh) {
    const h = sh.sys.lastHttp;
    const url = (sh.setup && sh.setup.focus && sh.setup.focus[0]) || "http://localhost/";
    const row = (a, b, cls) => { const r = el("div", "flex items-center gap-2 text-[11px]"); r.appendChild(el("span", "w-14 shrink-0 text-neutral-500", a)); r.appendChild(el("span", cls || "text-neutral-200 break-all", b)); return r; };
    const req = el("div", "rounded-md border border-neutral-800 p-2.5 mb-2 space-y-1");
    req.appendChild(el("div", "text-neutral-200 font-bold", "Request  →"));
    req.appendChild(row("method", "GET " + ((h && h.path) || "/")));
    req.appendChild(row("to", url));
    host.appendChild(req);
    const res = el("div", "rounded-md border p-2.5 space-y-1 " + (h ? (h.ok ? "border-emerald-400 bg-emerald-500/5" : "border-red-500/60 bg-red-500/10") : "border-neutral-800"));
    res.appendChild(el("div", "text-neutral-200 font-bold", "←  Response"));
    if (!h) res.appendChild(el("div", "text-[11px] text-neutral-500", "Run curl to send the request and read the reply."));
    else if (h.error) { res.appendChild(row("result", h.error, "text-red-400")); res.appendChild(el("div", "text-[11px] text-neutral-400", `Nothing accepted the connection on port ${h.port}: the service is down or not listening.`)); }
    else {
      const status = el("div", "flex items-center gap-2"); status.appendChild(chip(`${h.status} ${h.statusText}`, h.ok ? OK : BAD)); res.appendChild(status);
      Object.entries(h.headers).forEach(([k, v]) => res.appendChild(row(k.toLowerCase(), v)));
      const body = el("pre", "mt-1 rounded bg-surface-0 border border-neutral-800 px-2 py-1 text-[11px] text-emerald-300 whitespace-pre-wrap break-all", h.body.trim());
      res.appendChild(body);
    }
    host.appendChild(res);
  }

  function renderDns(host, sh) {
    const d = sh.sys.lastDns;
    const name = (sh.setup && sh.setup.focus && sh.setup.focus[0]) || "example.com";
    const step = (label, sub, on) => { const s = el("div", "flex-1 rounded-md border p-2 text-center " + (on ? "border-emerald-400 bg-emerald-500/5" : "border-neutral-800")); s.appendChild(el("div", "text-neutral-100", label)); s.appendChild(el("div", "text-[10px] text-neutral-500 truncate", sub)); return s; };
    const flow = el("div", "flex items-stretch gap-1.5 text-[11px]");
    const rec = d && d.rec;
    flow.appendChild(step("This server", name + " ?", !!d));
    flow.appendChild(el("div", "self-center text-neutral-500", "→"));
    flow.appendChild(step("Resolver", (rec && rec.resolver) || "127.0.0.53", !!d));
    flow.appendChild(el("div", "self-center text-neutral-500", "→"));
    flow.appendChild(step("Answer", rec ? rec.answers.join(", ") : d ? "no record" : "?", !!rec));
    host.appendChild(flow);
    if (!d) { host.appendChild(el("div", "mt-3 text-[11px] text-neutral-500", "Run dig to see which IP address the name resolves to.")); return; }
    const exp = sh.setup && sh.setup.expectedIp;
    const box = el("div", "mt-3 rounded-md border border-neutral-800 p-2.5 space-y-1.5");
    if (!rec) box.appendChild(chip("NXDOMAIN: this name does not exist", BAD));
    else {
      rec.answers.forEach(a => { const r = el("div", "flex items-center gap-2"); r.appendChild(el("span", "text-lg text-neutral-50", a)); if (exp) r.appendChild(chip(a === exp ? "matches the new server" : "OLD server", a === exp ? OK : BAD)); box.appendChild(r); });
      box.appendChild(el("div", "text-[10px] text-neutral-500", `TTL ${rec.ttl || 300}s: caches may keep this answer for that long.`));
    }
    host.appendChild(box);
    if (exp && rec && !rec.answers.includes(exp)) note(host, `Expected ${exp} after the cut-over, but the live answer is ${rec.answers[0]}. The DNS record (or a cache) still points at the old cluster.`, BAD);
  }

  function renderPing(host, sh) {
    const p = sh.sys.lastPing;
    if (!p) { host.appendChild(el("div", "text-[11px] text-neutral-500", "Run ping -c 4 to send four ICMP echo requests and watch each reply come back.")); return; }
    const max = Math.max(...p.rtts, 1);
    const grid = el("div", "grid grid-cols-4 gap-2");
    p.rtts.forEach((t, i) => {
      const ok = i < p.sent - p.lost;
      const c = el("div", "rounded-md border p-2 text-center " + (ok ? "border-emerald-500/40" : "border-red-500/60 bg-red-500/10"));
      c.appendChild(el("div", "text-[10px] text-neutral-500", "seq " + (i + 1)));
      c.appendChild(el("div", "text-neutral-50 text-sm", ok ? t.toFixed(1) + " ms" : "lost"));
      const bar = el("div", "mt-1 h-1.5 rounded bg-neutral-800"); const f = el("div", "h-1.5 rounded " + (ok ? "bg-emerald-400" : "bg-red-400")); f.style.width = (ok ? Math.max(8, 100 * t / max) : 100) + "%"; bar.appendChild(f); c.appendChild(bar);
      grid.appendChild(c);
    });
    host.appendChild(grid);
    const loss = Math.round(100 * p.lost / p.sent);
    const got = p.rtts.slice(0, p.sent - p.lost);
    const avg = got.length ? (got.reduce((a, b) => a + b, 0) / got.length).toFixed(1) : "-";
    const sum = el("div", "flex flex-wrap gap-1.5 mt-3");
    sum.appendChild(chip(`${p.received}/${p.sent} replies`, loss ? WARN : OK)); sum.appendChild(chip(`${loss}% packet loss`, loss ? BAD : OK)); sum.appendChild(chip(`avg ${avg} ms`, DIM));
    host.appendChild(sum);
  }

  // ---------- storage ----------
  const tone = pct => (pct >= 90 ? "bg-red-400" : pct >= 75 ? "bg-amber-400" : "bg-emerald-400");
  function barRow(label, pct, right, hot) {
    const r = el("div", "mb-1.5 " + (hot ? "" : "opacity-60"));
    const top = el("div", "flex justify-between text-[10px] text-neutral-400"); top.appendChild(el("span", "", label)); top.appendChild(el("span", "", right)); r.appendChild(top);
    const track = el("div", "h-2 rounded bg-neutral-800"); const f = el("div", "h-2 rounded " + tone(pct)); f.style.width = Math.max(pct, 1) + "%"; track.appendChild(f); r.appendChild(track);
    return r;
  }

  function renderDiskUsage(host, sh) {
    const df = sh.sys.lastDf;
    sh.sys.disks.filesystems.filter(f => f.mount !== "/run" || true).forEach(f => {
      const inodePct = Math.round(100 * f.inodes[1] / f.inodes[0]);
      const card = el("div", "rounded-md border border-neutral-800 p-2.5 mb-2");
      const top = el("div", "flex items-center justify-between mb-2");
      top.appendChild(el("span", "text-neutral-100 font-bold", f.mount));
      top.appendChild(el("span", "text-[10px] text-neutral-500", f.fs));
      card.appendChild(top);
      card.appendChild(barRow("Space", f.pct, `${f.used} of ${f.size} · ${f.pct}% · ${f.avail} free`, !df || !df.inodes));
      card.appendChild(barRow("Inodes (file count)", inodePct, `${f.inodes[1].toLocaleString()} of ${f.inodes[0].toLocaleString()} · ${inodePct}%`, !df || df.inodes));
      host.appendChild(card);
    });
    if (!df) host.appendChild(el("div", "text-[11px] text-neutral-500", "Run df to read the filesystems. -h reports space, -i reports inodes."));
    else {
      const full = sh.sys.disks.filesystems.find(f => (df.inodes ? Math.round(100 * f.inodes[1] / f.inodes[0]) : f.pct) >= 90);
      if (full) note(host, df.inodes ? `${full.mount} has run out of inodes: no new files can be created even though ${full.avail} of space is free.` : `${full.mount} is ${full.pct}% full. Find what is using the space.`, BAD);
    }
  }

  function renderDiskDu(host, sh) {
    const du = sh.sys.lastDu;
    const target = (sh.setup && sh.setup.focus && sh.setup.focus[0]) || "/var";
    const data = sh.sys.disks.du[target] || [];
    if (!du) { host.appendChild(el("div", "text-[11px] text-neutral-500", `Run du to measure what is inside ${target}. The biggest folder will show here.`)); return; }
    const kids = data.filter(r => r.path !== target).sort((a, b) => b.bytes - a.bytes);
    const total = (data.find(r => r.path === target) || {}).bytes || kids.reduce((s, r) => s + r.bytes, 0);
    host.appendChild(el("div", "text-[11px] text-neutral-500 pb-2", `${target} totals ${(data.find(r => r.path === target) || {}).size || ""}. Biggest first:`));
    kids.forEach((r, i) => {
      const share = Math.round(100 * r.bytes / total);
      const row = el("div", "mb-2 " + (i === 0 && share >= 50 ? "" : "opacity-90"));
      const top = el("div", "flex justify-between text-[11px]"); top.appendChild(el("span", "text-neutral-200", r.path)); top.appendChild(el("span", "text-neutral-400", `${r.size} · ${share}%`)); row.appendChild(top);
      const track = el("div", "h-2.5 rounded bg-neutral-800"); const f = el("div", "h-2.5 rounded " + (share >= 50 ? "bg-red-400" : "bg-emerald-400")); f.style.width = Math.max(share, 1) + "%"; track.appendChild(f); row.appendChild(track);
      host.appendChild(row);
    });
    const top = kids[0];
    if (top && Math.round(100 * top.bytes / total) >= 50) note(host, `${top.path} holds ${Math.round(100 * top.bytes / total)}% of ${target}. That is where to clean up first.`, BAD);
  }

  function renderLsblk(host, sh) {
    const used = sh.sys.lastLsblk;
    const showFs = used && used.fs;
    host.appendChild(el("div", "text-[11px] text-neutral-500 pb-2", showFs ? "lsblk -f adds the filesystem on each device." : "Run lsblk -f to see which devices carry a filesystem and where they are mounted."));
    sh.sys.disks.devices.forEach(d => {
      const card = el("div", "rounded-md border border-neutral-800 p-2.5 mb-2");
      const top = el("div", "flex items-center justify-between");
      top.appendChild(el("span", "text-neutral-50 font-bold", "/dev/" + d.name)); top.appendChild(chip((d.type || "disk") + " · " + d.size, DIM));
      card.appendChild(top);
      const nodes = (d.children && d.children.length) ? d.children : [d];
      nodes.forEach(c => {
        const row = el("div", "mt-2 ml-2 pl-2 border-l border-neutral-700 flex flex-wrap items-center gap-1.5 text-[11px]");
        row.appendChild(el("span", "text-neutral-200", c === d ? "(whole device)" : c.name));
        row.appendChild(el("span", "text-neutral-500", c.size || ""));
        if (showFs) {
          row.appendChild(chip(c.fstype || "no filesystem", c.fstype ? OK : BAD));
          if (c.label) row.appendChild(chip(c.label, DIM));
          row.appendChild(chip(c.mount ? "mounted " + c.mount : "NOT mounted", c.mount ? OK : WARN));
        }
        card.appendChild(row);
      });
      host.appendChild(card);
    });
    if (showFs) {
      const orphan = sh.sys.disks.devices.find(d => !(d.children && d.children.length) && d.fstype && !d.mount);
      if (orphan) note(host, `/dev/${orphan.name} already has an ${orphan.fstype} filesystem (${orphan.label}) but is not mounted. It only needs: sudo mount /dev/${orphan.name} /data`, WARN);
    }
  }

  function renderMount(host, sh) {
    const f = sh.sys.lastFindmnt;
    const path = (sh.setup && sh.setup.focus && sh.setup.focus[0]) || "/data";
    const box = el("div", "flex items-stretch gap-2 text-[11px]");
    const dev = el("div", "flex-1 rounded-md border p-2.5 text-center " + (f && f.found ? "border-emerald-400 bg-emerald-500/5" : "border-neutral-800"));
    dev.appendChild(el("div", "text-neutral-100", f && f.found ? f.rows[0].source : "disk device"));
    dev.appendChild(el("div", "text-[10px] text-neutral-500", f && f.found ? f.rows[0].fstype : "?"));
    const dir = el("div", "flex-1 rounded-md border p-2.5 text-center " + (f && f.found ? "border-emerald-400 bg-emerald-500/5" : "border-neutral-800"));
    dir.appendChild(el("div", "text-neutral-100", path)); dir.appendChild(el("div", "text-[10px] text-neutral-500", f && f.found ? f.rows[0].options : "directory"));
    box.appendChild(dev); box.appendChild(el("div", "self-center text-neutral-500", f && f.found ? "⇒" : "?")); box.appendChild(dir);
    host.appendChild(box);
    if (!f) host.appendChild(el("div", "mt-3 text-[11px] text-neutral-500", `Run findmnt ${path} to check whether a device is attached to it.`));
    else if (f.found) note(host, `${path} is an active mount point: ${f.rows[0].source} (${f.rows[0].fstype}) is attached here.`, OK);
    else note(host, `${path} is just a plain directory. No device is mounted on it, so anything written here lands on the root filesystem.`, BAD);
  }

  // ---------- ssh ----------
  function renderSsh(host, sh) {
    const s = sh.sys.lastSsh;
    const hostName = (sh.setup && sh.setup.focus && sh.setup.focus[0]) || "server";
    const steps = s ? s.steps : [
      { label: "TCP connect :22", status: "skip" }, { label: "Key exchange", status: "skip" }, { label: "Host key", status: "skip" },
      { label: "Authenticate (publickey)", status: "skip" }, { label: "Open session", status: "skip" }];
    host.appendChild(el("div", "text-[11px] text-neutral-500 pb-2", s ? `ssh ${s.user}@${s.host}` : `Run ssh -v to watch the handshake with ${hostName} step by step.`));
    steps.forEach((st, i) => {
      const color = st.status === "ok" ? "border-emerald-500/50" : st.status === "fail" ? "border-red-500/60 bg-red-500/10" : "border-neutral-800 opacity-60";
      const row = el("div", "flex items-center gap-3 rounded-md border px-2.5 py-2 mb-1.5 " + color);
      row.appendChild(el("span", "w-5 h-5 rounded-full flex items-center justify-center text-[11px] border " + (st.status === "ok" ? OK : st.status === "fail" ? BAD : DIM), st.status === "ok" ? "✓" : st.status === "fail" ? "✕" : String(i + 1)));
      const t = el("div", "flex-1"); t.appendChild(el("div", "text-neutral-100", st.label));
      if (st.detail) t.appendChild(el("div", "text-[10px] text-red-400", st.detail));
      row.appendChild(t);
      host.appendChild(row);
    });
    if (s) {
      const failed = steps.find(x => x.status === "fail");
      if (failed) note(host, s.outcome === "refused" ? `The handshake stopped at “${failed.label}”: the server answered but nothing is accepting connections on port ${s.port}. The SSH daemon is stopped or listening on another port.` : s.outcome === "denied" ? "The server was reached and the key was offered, but it was rejected. Check authorized_keys and file permissions." : `The handshake stopped at “${failed.label}”: ${failed.detail}.`, BAD);
      else if (s.outcome === "ok") note(host, "Every step succeeded: the connection and key are fine.", OK);
    }
  }

  function renderTransfer(host, sh) {
    const f = sh.setup.focus || {};
    const sc = sh.sys.lastScp;
    const remote = ((sh.sys.remote[f.host] || {})[f.dir]) || [];
    const row = el("div", "flex items-stretch gap-2");
    const local = el("div", "flex-1 rounded-md border border-neutral-800 p-2.5");
    local.appendChild(el("div", "text-[10px] text-neutral-500 mb-1", "Your machine"));
    const n = sh.lookup(sh.abs(f.local), true);
    local.appendChild(el("div", "text-neutral-100 break-all", f.local));
    local.appendChild(el("div", "text-[10px] text-neutral-500", n ? fmtBytes(n.size || 0) : "not found"));
    const mid = el("div", "self-center text-center text-neutral-500 text-[11px]"); mid.appendChild(el("div", "", sc ? "100%" : "→")); mid.appendChild(el("div", "text-[10px]", "scp"));
    const rem = el("div", "flex-1 rounded-md border p-2.5 " + (sc ? "border-emerald-400 bg-emerald-500/5" : "border-neutral-800"));
    rem.appendChild(el("div", "text-[10px] text-neutral-500 mb-1", `${f.host}:${f.dir}`));
    if (!remote.length) rem.appendChild(el("div", "text-[11px] text-neutral-500", "(empty)"));
    remote.forEach(r => { const li = el("div", "flex justify-between text-[11px] px-1 py-0.5" + (sc && r.name === sc.src ? " fs-flash" : "")); li.appendChild(el("span", "text-neutral-200 break-all", r.name)); li.appendChild(el("span", "text-neutral-500", r.size)); rem.appendChild(li); });
    row.appendChild(local); row.appendChild(mid); row.appendChild(rem);
    host.appendChild(row);
    if (sc) note(host, `${sc.src} (${sc.size}) is now in ${f.dir} on ${f.host}.`, OK);
    else host.appendChild(el("div", "mt-2 text-[11px] text-neutral-500", "Run scp to copy the file across."));
  }

  // ---------- archive ----------
  const dirSig = new WeakMap();
  function renderArchive(host, sh) {
    const a = sh.lastArchive;
    const dir = sh.lookup(sh.cwd);
    const prev = dirSig.get(sh) || {};
    const next = {};
    const files = dir && dir.children ? [...dir.children.entries()].sort((x, y) => x[0].localeCompare(y[0])) : [];
    host.appendChild(el("div", "text-[11px] text-neutral-500 pb-1", sh.cwd));
    const list = el("div", "rounded-md border border-neutral-800 mb-2");
    files.forEach(([name, n]) => {
      const sig = n.type + ":" + (n.size || 0);
      next[name] = sig;
      const isArch = !!(n.archive || n.gz);
      const row = el("div", "flex items-center justify-between px-2 py-1 border-b border-neutral-800 last:border-b-0" + (prev && prev[name] !== sig && Object.keys(prev).length ? " fs-flash" : ""));
      const l = el("div", "flex items-center gap-2 min-w-0");
      l.appendChild(el("span", "text-[11px]", n.type === "dir" ? "📁" : isArch ? "🗜" : "📄"));
      l.appendChild(el("span", "text-neutral-100 truncate", name + (n.type === "dir" ? "/" : "")));
      row.appendChild(l);
      row.appendChild(el("span", "text-[11px] " + (isArch ? "text-emerald-300" : "text-neutral-500"), n.type === "dir" ? "" : fmtBytes(n.size || 0)));
      list.appendChild(row);
    });
    if (!files.length) list.appendChild(el("div", "px-2 py-2 text-[11px] text-neutral-500", "(empty)"));
    host.appendChild(list);
    dirSig.set(sh, next);

    if (!a) { host.appendChild(el("div", "text-[11px] text-neutral-500", "Run your command: the archive and its effect on file size will show here.")); return; }
    const card = el("div", "rounded-md border border-emerald-400 bg-emerald-500/5 p-2.5");
    const raw = a.op === "create" ? a.raw : a.before, small = a.op === "create" ? a.size : a.after;
    if (a.op === "create" || a.op === "gzip" || a.op === "gunzip") {
      const title = a.op === "create" ? `${a.entries.length} entries packed into ${a.file}` : a.op === "gzip" ? `${a.file} compressed` : `${a.file} expanded`;
      card.appendChild(el("div", "text-neutral-100 mb-2", title));
      const mk = (label, bytes, cls) => { const r = el("div", "mb-1.5"); const t = el("div", "flex justify-between text-[10px] text-neutral-400"); t.appendChild(el("span", "", label)); t.appendChild(el("span", "", fmtBytes(bytes))); r.appendChild(t); const tr = el("div", "h-2 rounded bg-neutral-800"); const f = el("div", "h-2 rounded " + cls); f.style.width = Math.max(4, Math.round(100 * bytes / Math.max(raw, small))) + "%"; tr.appendChild(f); r.appendChild(tr); return r; };
      const bigger = a.op === "gunzip" ? small : raw, smaller = a.op === "gunzip" ? raw : small;
      card.appendChild(mk("uncompressed", bigger, "bg-neutral-400"));
      card.appendChild(mk("compressed", smaller, "bg-emerald-400"));
      card.appendChild(el("div", "text-[11px] text-emerald-300", `${Math.max(0, 100 - Math.round(100 * smaller / bigger))}% smaller`));
    } else {
      card.appendChild(el("div", "text-neutral-100 mb-1", a.op === "extract" ? `${a.entries.length} entries restored from ${a.file}` : `${a.file} contains ${a.entries.length} entries`));
      const shown = el("div", "text-[11px] text-neutral-300 space-y-0.5 max-h-28 overflow-y-auto"); a.entries.slice(0, 20).forEach(e => shown.appendChild(el("div", "break-all", e))); card.appendChild(shown);
    }
    host.appendChild(card);
  }

  // ---------- registration ----------
  const R = (kind, title, icon, sub, legend, needsSys, fn) => root.VizPanels.register(kind, { title, icon, sub, legend, needsSys }, (host, sh) => fn(host, sh));
  R("text", "Live File Viewer", "fa-file-lines", "The file your command reads. Lines it picks out light up; the output appears below.", [["bg-emerald-400", "Matched line"], ["bg-neutral-500", "Other line"]], false, renderText);
  R("identity", "Live System Identity", "fa-id-card", "Who you are and what machine this is. The part your command answers lights up.", [["bg-emerald-400", "Answered by your command"], ["bg-neutral-500", "Not asked"]], true, renderIdentity);
  R("stat", "Live File Inode", "fa-file-circle-info", "The metadata stored in a file's inode: permissions, owner, size, timestamps.", [["bg-emerald-400", "Permission granted"], ["bg-neutral-600", "Not granted"]], false, renderStat);
  R("path", "Live Path Walk", "fa-route", "Every folder between / and the file. One folder you cannot enter blocks everything below it.", [["bg-emerald-400", "Can pass"], ["bg-red-400", "Blocked"]], false, renderPath);
  R("net-interfaces", "Live Network Interfaces", "fa-network-wired", "The network cards of this server and the IP address each one holds.", [["bg-emerald-400", "Up"], ["bg-neutral-500", "Loopback"]], true, renderInterfaces);
  R("net-sockets", "Live Listening Ports", "fa-plug", "Which ports are open, what address they listen on, and which process owns them.", [["bg-emerald-400", "All interfaces"], ["bg-amber-400", "Localhost only"]], true, renderSockets);
  R("net-http", "Live HTTP Exchange", "fa-globe", "The request curl sends and the response that comes back.", [["bg-emerald-400", "Success"], ["bg-red-400", "Error"]], true, renderHttp);
  R("net-dns", "Live DNS Lookup", "fa-signs-post", "How a name is turned into an IP address, and whether the answer is the one you expect.", [["bg-emerald-400", "Expected"], ["bg-red-400", "Wrong / old"]], true, renderDns);
  R("net-ping", "Live Ping", "fa-satellite-dish", "Each ICMP probe and how long its reply took.", [["bg-emerald-400", "Reply"], ["bg-red-400", "Lost"]], true, renderPing);
  R("disk-usage", "Live Disk Usage", "fa-hard-drive", "Space and inode use per filesystem. Red means nearly full.", [["bg-emerald-400", "Healthy"], ["bg-amber-400", "75%+"], ["bg-red-400", "90%+"]], true, renderDiskUsage);
  R("disk-du", "Live Directory Sizes", "fa-chart-bar", "Which folder is using the space.", [["bg-emerald-400", "Normal"], ["bg-red-400", "Dominant folder"]], true, renderDiskDu);
  R("disk-lsblk", "Live Block Devices", "fa-hard-drive", "Disks, their partitions, the filesystem on each, and where they are mounted.", [["bg-emerald-400", "Ready / mounted"], ["bg-amber-400", "Not mounted"]], true, renderLsblk);
  R("disk-mount", "Live Mount Point", "fa-link", "Whether a device is attached to a directory.", [["bg-emerald-400", "Mounted"], ["bg-red-400", "Not a mount"]], true, renderMount);
  R("ssh-connect", "Live SSH Handshake", "fa-key", "Each stage of an SSH connection. The first failed stage is where it breaks.", [["bg-emerald-400", "Passed"], ["bg-red-400", "Failed"], ["bg-neutral-500", "Not reached"]], true, renderSsh);
  R("transfer", "Live File Transfer", "fa-right-left", "A file travelling to a directory on the remote server.", [["bg-emerald-400", "Delivered"], ["bg-neutral-500", "Waiting"]], true, renderTransfer);
  R("archive", "Live Archive View", "fa-file-zipper", "The folder, the archive you build or open, and how much smaller it is.", [["bg-emerald-400", "Compressed"], ["bg-neutral-400", "Original"]], false, renderArchive);
})(typeof window !== "undefined" ? window : globalThis);

/**
 * CmdCraft live panels. Each scenario names the panel that suits its question (setup.viz in goals.js),
 * and the panel redraws from the simulated system after every command:
 *
 *   processes  process monitor (CPU bars, signals, killed rows)
 *   services   systemd service board (state, boot-enabled, stale unit warning)
 *   journal    journalctl viewer (lines matched by the last query stay bright)
 *   kernel     dmesg viewer (OOM kills highlighted)
 *   cron       crontab in plain English + recent cron runs
 *   users      users & groups with membership chips
 *
 * The file tree stays the default for filesystem questions (see app.js renderFilesystem).
 */
(function (root) {
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const clock = ago => root.SYSTEM_CLOCK.clockLabel(ago);

  const META = {
    processes: { title: "Live Process Monitor", icon: "fa-microchip", sub: "Watch processes start, spike and disappear as you send signals.", legend: [["bg-emerald-400", "Running"], ["bg-amber-400", "High CPU"], ["bg-red-400", "Terminated"]] },
    services:  { title: "Live Service Board", icon: "fa-gears", sub: "See each systemd unit's state, boot setting and PID change as you manage it.", legend: [["bg-emerald-400", "Active"], ["bg-red-400", "Failed"], ["bg-neutral-500", "Inactive"]] },
    journal:   { title: "Live Journal Viewer", icon: "fa-book-open", sub: "Lines returned by your last journalctl query stay bright; the rest are dimmed.", legend: [["bg-red-400", "Error"], ["bg-amber-400", "Warning"], ["bg-neutral-400", "Info"]] },
    kernel:    { title: "Live Kernel Log", icon: "fa-memory", sub: "The kernel ring buffer. Out-of-memory kills are highlighted.", legend: [["bg-red-400", "OOM / kill"], ["bg-neutral-400", "Normal"]] },
    cron:      { title: "Live Cron Schedule", icon: "fa-clock", sub: "Your crontab in plain English, the cron daemon, and its recent runs.", legend: [["bg-emerald-400", "Daemon running"], ["bg-neutral-400", "Scheduled job"]] },
    users:     { title: "Live Users & Groups", icon: "fa-users-gear", sub: "Accounts and group membership update as you run useradd and usermod.", legend: [["bg-emerald-400", "Primary group"], ["bg-neutral-400", "Supplementary group"]] },
    fs:        { title: "Live Filesystem Visualizer", icon: "fa-sitemap", sub: "Watch folders, permissions (rwx), and files mutate dynamically as you issue commands.", legend: [["bg-amber-400", "Folder"], ["bg-slate-400", "Regular File"], ["bg-emerald-400", "Executable"]] }
  };

  const changedClass = (sys, key) => (sys.lastChanges.changed.has(key) ? " fs-flash" : "");
  const removedOf = (sys, kind) => sys.lastChanges.removed.filter(r => r.kind === kind);

  function chip(text, cls) { return el("span", "px-1.5 py-0.5 rounded text-[10px] border " + cls, text); }

  // ---------- processes ----------
  function renderProcesses(host, sh) {
    const sys = sh.sys;
    const wrap = el("div", "text-[11px]");
    const rows = [...sys.processes].sort((a, b) => b.cpu - a.cpu);
    const head = el("div", "grid gap-2 px-2 pb-1 text-neutral-500 border-b border-neutral-800");
    head.style.gridTemplateColumns = "44px 62px 1fr 38px 28px 1.4fr";
    ["PID", "USER", "CPU %", "MEM", "ST", "COMMAND"].forEach(t => head.appendChild(el("div", "", t)));
    wrap.appendChild(head);

    const addRow = (p, removed) => {
      const hot = sys.highlight.has(p.pid) && !removed;
      const row = el("div", "grid gap-2 items-center px-2 py-1 border-l-2 " + (hot ? "border-emerald-400 bg-emerald-500/10" : "border-transparent") +
        (removed ? " viz-removed" : changedClass(sys, "proc:" + p.pid)));
      row.style.gridTemplateColumns = "44px 62px 1fr 38px 28px 1.4fr";
      row.appendChild(el("div", "text-neutral-300", String(p.pid)));
      row.appendChild(el("div", "truncate text-neutral-400", p.user));
      const bar = el("div", "flex items-center gap-1.5");
      const track = el("div", "flex-1 h-1.5 rounded bg-neutral-800");
      const fill = el("div", "h-1.5 rounded " + (p.cpu >= 50 ? "bg-amber-400" : "bg-emerald-400"));
      fill.style.width = Math.min(100, Math.max(p.cpu, 0.5)) + "%";
      track.appendChild(fill); bar.appendChild(track);
      bar.appendChild(el("span", "w-9 text-right text-neutral-300", p.cpu.toFixed(1)));
      row.appendChild(bar);
      row.appendChild(el("div", "text-neutral-400", p.mem.toFixed(1)));
      row.appendChild(el("div", "text-neutral-500", p.stat || ""));
      const cmd = el("div", "truncate text-neutral-200", p.cmd);
      cmd.title = p.cmd;
      row.appendChild(cmd);
      if (!removed && sys.signals.some(s => s.pid === p.pid && s.survived)) {
        const note = el("div", "col-span-6 -mt-0.5 pl-1 text-[10px] text-amber-400", "↳ still running: it ignored SIGTERM. Only SIGKILL (-9) cannot be ignored.");
        wrap.appendChild(row); wrap.appendChild(note); return;
      }
      wrap.appendChild(row);
    };
    rows.forEach(p => addRow(p, false));
    removedOf(sys, "process").forEach(r => addRow(r.obj, true));
    wrap.appendChild(el("div", "px-2 pt-2 text-neutral-500", `${rows.length} processes running`));
    host.appendChild(wrap);
  }

  // ---------- services ----------
  function renderServices(host, sh) {
    const sys = sh.sys;
    const grid = el("div", "grid gap-2");
    Object.entries(sys.services).forEach(([name, s]) => {
      const card = el("div", "rounded-md border border-neutral-800 bg-surface-1 p-2.5" + changedClass(sys, "svc:" + name));
      const top = el("div", "flex items-center justify-between");
      const left = el("div", "flex items-center gap-2");
      left.appendChild(el("span", "w-2 h-2 rounded-full " + (s.state === "active" ? "bg-emerald-400" : s.state === "failed" ? "bg-red-400" : "bg-neutral-500")));
      left.appendChild(el("span", "font-bold text-neutral-100", name + ".service"));
      top.appendChild(left);
      top.appendChild(el("span", "text-[11px] " + (s.state === "active" ? "text-emerald-400" : s.state === "failed" ? "text-red-400" : "text-neutral-400"),
        s.state === "active" ? "active (running)" : s.state === "failed" ? "failed" : "inactive (dead)"));
      card.appendChild(top);
      card.appendChild(el("div", "text-[11px] text-neutral-500 mt-0.5", s.desc));
      const meta = el("div", "flex flex-wrap items-center gap-1.5 mt-2");
      meta.appendChild(chip(s.enabled ? "enabled at boot" : "disabled at boot", s.enabled ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10" : "border-neutral-700 text-neutral-400"));
      meta.appendChild(chip(s.pid ? "PID " + s.pid : "no process", "border-neutral-700 text-neutral-300"));
      if (s.restarts) meta.appendChild(chip("restarted ×" + s.restarts, "border-neutral-700 text-neutral-300"));
      card.appendChild(meta);
      if (s.stale) card.appendChild(el("div", "mt-2 text-[11px] text-amber-400 border border-amber-500/30 bg-amber-500/10 rounded px-2 py-1",
        "⚠ Unit file changed on disk. systemd is still using the old copy until you run systemctl daemon-reload."));
      const recent = sys.journal.filter(j => j.unit === name).slice(-2);
      recent.forEach(j => card.appendChild(el("div", "mt-1 truncate text-[10px] font-mono " + (j.level === "error" ? "text-red-400" : "text-neutral-500"), j.msg)));
      grid.appendChild(card);
    });
    host.appendChild(grid);
  }

  // ---------- journal & kernel ----------
  const levelClass = l => (l === "error" ? "text-red-400" : l === "warn" ? "text-amber-400" : "text-neutral-300");

  function renderJournal(host, sh) {
    const sys = sh.sys;
    const lj = sys.lastJournal;
    const matched = new Set(lj ? lj.entries : []);
    const bar = el("div", "flex flex-wrap items-center gap-1.5 pb-2");
    bar.appendChild(chip(lj && lj.unit ? "-u " + lj.unit : "all units", "border-neutral-700 text-neutral-300"));
    if (lj && lj.sinceMin !== null) bar.appendChild(chip("--since " + lj.sinceMin + " min", "border-neutral-700 text-neutral-300"));
    if (lj && lj.lines) bar.appendChild(chip("-n " + lj.lines, "border-neutral-700 text-neutral-300"));
    if (lj && lj.follow) bar.appendChild(chip("LIVE: following", "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"));
    if (!lj) bar.appendChild(el("span", "text-[11px] text-neutral-500", "Run journalctl to query the log. Matching lines will light up."));
    host.appendChild(bar);

    const entries = [...sys.journal].sort((a, b) => b.ago - a.ago).slice(-16);
    const list = el("div", "space-y-0.5 text-[11px] font-mono");
    entries.forEach(j => {
      const on = !lj || matched.has(j) || (lj.follow && j.ago < 0);
      const row = el("div", "flex gap-2 px-1.5 py-0.5 border-l-2 " + (lj && on ? "border-emerald-400 bg-emerald-500/5" : "border-transparent") + (on ? "" : " opacity-40"));
      row.appendChild(el("span", "shrink-0 text-neutral-500", clock(j.ago).slice(7)));
      row.appendChild(el("span", "shrink-0 text-neutral-400", j.unit));
      row.appendChild(el("span", "truncate " + levelClass(j.level), j.msg));
      row.title = j.msg;
      list.appendChild(row);
    });
    host.appendChild(list);
  }

  function renderKernel(host, sh) {
    const sys = sh.sys;
    const list = el("div", "space-y-0.5 text-[11px] font-mono");
    [...sys.kernel].sort((a, b) => b.ago - a.ago).forEach(k => {
      const bad = /out of memory|killed process|oom/i.test(k.msg);
      const row = el("div", "flex gap-2 px-1.5 py-0.5 border-l-2 " + (bad ? "border-red-400 bg-red-500/5" : "border-transparent"));
      row.appendChild(el("span", "shrink-0 text-neutral-500", clock(k.ago).slice(7)));
      row.appendChild(el("span", bad ? "text-red-400" : "text-neutral-300", k.msg));
      row.title = k.msg;
      list.appendChild(row);
    });
    host.appendChild(list);
  }

  // ---------- cron ----------
  function describeCron(expr) {
    const f = expr.trim().split(/\s+/).slice(0, 5);
    if (f.length < 5) return expr;
    const [m, h, dom, mon, dow] = f;
    let m1;
    if ((m1 = /^\*\/(\d+)$/.exec(m)) && h === "*" && dom === "*" && mon === "*" && dow === "*") return `Every ${m1[1]} minutes`;
    if (/^\d+$/.test(m) && /^\d+$/.test(h) && dom === "*" && mon === "*" && dow === "*") return `Every day at ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    if (m === "0" && h === "*" && dom === "*" && mon === "*" && dow === "*") return "Every hour, on the hour";
    if (/^\d+$/.test(m) && /^\d+$/.test(h) && dom === "*" && mon === "*" && /^\d$/.test(dow)) return `Every ${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][dow % 7]} at ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    return "Custom schedule";
  }

  function renderCron(host, sh) {
    const sys = sh.sys;
    const svc = sys.services.cron;
    if (svc) {
      const top = el("div", "flex items-center justify-between pb-2");
      const l = el("div", "flex items-center gap-2");
      l.appendChild(el("span", "w-2 h-2 rounded-full " + (svc.state === "active" ? "bg-emerald-400" : "bg-red-400")));
      l.appendChild(el("span", "font-bold text-neutral-100", "cron.service"));
      top.appendChild(l);
      top.appendChild(el("span", "text-[11px] " + (svc.state === "active" ? "text-emerald-400" : "text-red-400"), svc.state === "active" ? "active (running)" : svc.state));
      host.appendChild(top);
    }
    const lj = sys.lastJournal;
    const table = el("div", "space-y-1.5");
    if (!sys.cron.length) table.appendChild(el("div", "text-neutral-500 text-[11px]", "no crontab for ubuntu"));
    sys.cron.forEach((line, i) => {
      const parts = line.trim().split(/\s+/);
      const card = el("div", "rounded-md border border-neutral-800 bg-surface-1 px-2.5 py-1.5" + changedClass(sys, "cron:" + i));
      card.appendChild(el("div", "text-neutral-100", describeCron(line)));
      card.appendChild(el("div", "text-[10px] text-neutral-500 font-mono", parts.slice(0, 5).join(" ")));
      const cmd = el("div", "text-[11px] text-neutral-300 font-mono truncate", parts.slice(5).join(" "));
      cmd.title = parts.slice(5).join(" ");
      card.appendChild(cmd);
      table.appendChild(card);
    });
    host.appendChild(table);

    const runs = sys.journal.filter(j => j.unit === "cron").sort((a, b) => b.ago - a.ago).slice(-5);
    if (runs.length) {
      host.appendChild(el("div", "mt-3 mb-1 text-[11px] text-neutral-500", "Recent runs (journal)"));
      const matched = new Set(lj ? lj.entries : []);
      runs.forEach(j => {
        const on = matched.has(j);
        const row = el("div", "flex gap-2 px-1.5 py-0.5 text-[10px] font-mono border-l-2 " + (on ? "border-emerald-400 bg-emerald-500/5" : "border-transparent text-neutral-500"));
        row.appendChild(el("span", "shrink-0", clock(j.ago).slice(7)));
        row.appendChild(el("span", "truncate", j.msg));
        host.appendChild(row);
      });
    }
  }

  // ---------- users & groups ----------
  function renderUsers(host, sh) {
    const sys = sh.sys;
    host.appendChild(el("div", "text-[11px] text-neutral-500 pb-1", "Users"));
    const users = el("div", "space-y-1.5");
    sys.users.forEach(u => {
      const card = el("div", "rounded-md border border-neutral-800 bg-surface-1 px-2.5 py-1.5" + changedClass(sys, "user:" + u.name));
      const top = el("div", "flex items-center justify-between");
      top.appendChild(el("span", "font-bold text-neutral-100", u.name));
      top.appendChild(el("span", "text-[10px] text-neutral-500", `uid ${u.uid} · ${u.home}`));
      card.appendChild(top);
      const chips = el("div", "flex flex-wrap gap-1 mt-1.5");
      chips.appendChild(chip(u.primary, "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"));
      (u.groups || []).forEach(g => chips.appendChild(chip(g, "border-neutral-700 text-neutral-300")));
      card.appendChild(chips);
      users.appendChild(card);
    });
    host.appendChild(users);

    host.appendChild(el("div", "text-[11px] text-neutral-500 pt-3 pb-1", "Groups"));
    const groups = el("div", "grid grid-cols-2 gap-1.5");
    sys.groups.forEach(g => {
      const members = sys.membersOf(g.name);
      const card = el("div", "rounded-md border border-neutral-800 px-2 py-1" + changedClass(sys, "group:" + g.name));
      card.appendChild(el("div", "text-neutral-200", `${g.name} `));
      card.firstChild.appendChild(el("span", "text-[10px] text-neutral-500", "gid " + g.gid));
      card.appendChild(el("div", "text-[10px] text-neutral-400 truncate", members.length ? members.join(", ") : "no members"));
      groups.appendChild(card);
    });
    host.appendChild(groups);
  }

  const RENDERERS = { processes: renderProcesses, services: renderServices, journal: renderJournal, kernel: renderKernel, cron: renderCron, users: renderUsers };

  root.VizPanels = {
    META,
    has: kind => !!RENDERERS[kind],
    render(kind, host, shell) {
      host.replaceChildren();
      RENDERERS[kind](host, shell);
    }
  };
})(typeof window !== "undefined" ? window : globalThis);

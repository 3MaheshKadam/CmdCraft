/**
 * CmdCraft live panels, part 3:
 *   packages  installed packages, the repo index state, pending upgrades (apt / dnf / apk)
 *   firewall  the firewall policy and the ports it lets through (ufw / firewalld)
 *   env       the shell environment: variables, which ones are exported, and PATH order
 */
(function (root) {
  if (!root.VizPanels) return;
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  const OK = "border-emerald-500/40 text-emerald-400 bg-emerald-500/10", BAD = "border-red-500/40 text-red-400 bg-red-500/10", WARN = "border-amber-500/40 text-amber-300 bg-amber-500/10";
  const chip = (t, c) => el("span", "px-1.5 py-0.5 rounded text-[10px] border " + c, t);
  const note = (host, text, cls) => host.appendChild(el("div", "mt-3 rounded-md border px-2.5 py-1.5 text-[11px] " + cls, text));

  function renderPackages(host, sh) {
    const P = sh.sys.pkg;
    if (!P) { host.appendChild(el("div", "text-[11px] text-neutral-500", "No package manager on this system.")); return; }
    const head = el("div", "flex flex-wrap items-center gap-2 mb-2");
    head.appendChild(chip(P.distro === "debian" ? "apt / dpkg" : P.distro === "rhel" ? "dnf / rpm" : "apk", "border-neutral-600 text-neutral-300"));
    head.appendChild(chip(P.stale ? "package index: stale" : "package index: fresh", P.stale ? WARN : OK));
    const up = P.shownUpgrades ? Object.keys(P.upgradable).length : 0;
    head.appendChild(chip(up + " upgradable", up ? WARN : "border-neutral-700 text-neutral-400"));
    host.appendChild(head);
    const last = sh.sys.lastPkg && sh.sys.lastPkg.names ? sh.sys.lastPkg.names : [];
    const cols = el("div", "grid grid-cols-2 gap-2 text-[11px]");
    const inst = el("div", "rounded-md border border-neutral-800 p-2");
    inst.appendChild(el("div", "text-[10px] uppercase tracking-wide text-neutral-500 mb-1", "Installed (" + Object.keys(P.installed).length + ")"));
    Object.entries(P.installed).forEach(([n, i]) => {
      const row = el("div", "flex justify-between gap-2 " + (last.includes(n) ? "text-emerald-300" : "text-neutral-300"));
      row.appendChild(el("span", "", n + (i.auto ? " (auto)" : ""))); row.appendChild(el("span", "text-neutral-500", i.v)); inst.appendChild(row);
    });
    const avail = el("div", "rounded-md border border-neutral-800 p-2");
    avail.appendChild(el("div", "text-[10px] uppercase tracking-wide text-neutral-500 mb-1", "In the repository index"));
    Object.entries(P.index).filter(([n, e]) => !P.installed[n] && (!P.stale || !e.afterUpdate)).forEach(([n, e]) => {
      const row = el("div", "flex justify-between gap-2 text-neutral-400"); row.appendChild(el("span", "", n)); row.appendChild(el("span", "text-neutral-600", e.v)); avail.appendChild(row);
    });
    if (P.stale) avail.appendChild(el("div", "mt-1 text-[10px] text-amber-300", "Index is stale: new packages are not listed yet. Refresh it first."));
    cols.appendChild(inst); cols.appendChild(avail); host.appendChild(cols);
    if (P.shownUpgrades && up) note(host, up + " package" + (up > 1 ? "s have" : " has") + " a newer version waiting: " + Object.entries(P.upgradable).map(([n, v]) => n + " → " + v).join(", "), WARN);
  }

  function renderFirewall(host, sh) {
    const F = sh.sys.fw;
    if (!F) { host.appendChild(el("div", "text-[11px] text-neutral-500", "No firewall tool configured on this system.")); return; }
    const head = el("div", "flex flex-wrap items-center gap-2 mb-2");
    head.appendChild(chip(F.kind === "ufw" ? "ufw" : "firewalld · zone " + F.zone, "border-neutral-600 text-neutral-300"));
    if (F.kind === "ufw") {
      head.appendChild(chip(F.active ? "active" : "inactive", F.active ? OK : BAD));
      head.appendChild(chip("incoming default: " + F.defaultIn, F.defaultIn === "deny" ? OK : WARN));
    }
    host.appendChild(head);
    const wall = el("div", "rounded-md border border-neutral-800 p-2 text-[11px]");
    wall.appendChild(el("div", "text-[10px] uppercase tracking-wide text-neutral-500 mb-1", "Traffic that gets through"));
    let list;
    if (F.kind === "ufw") list = F.rules.map(r => ({ text: r.to || r.port, action: r.action, from: r.from || "Anywhere" }));
    else list = [...F.runtime.services.map(s => ({ text: s + " (service)", action: "ALLOW", from: "Anywhere" })), ...F.runtime.ports.map(p => ({ text: p, action: "ALLOW", from: "Anywhere" }))];
    if (!list.length) wall.appendChild(el("div", "text-neutral-500", "Nothing. Every incoming connection is " + (F.kind === "ufw" ? F.defaultIn : "dropped") + "."));
    list.forEach(r => {
      const row = el("div", "flex items-center gap-2 py-0.5");
      row.appendChild(chip(r.action, r.action === "ALLOW" ? OK : BAD)); row.appendChild(el("span", "text-neutral-100", r.text)); row.appendChild(el("span", "text-neutral-500", "from " + r.from)); wall.appendChild(row);
    });
    host.appendChild(wall);
    if (F.kind === "firewalld") {
      const same = JSON.stringify(F.runtime) === JSON.stringify(F.permanent);
      note(host, same ? "Runtime and permanent configuration match: the rules survive a reload and a reboot." : "Runtime and permanent differ. Rules added without --permanent vanish on reload; permanent ones apply only after firewall-cmd --reload.", same ? OK : WARN);
    } else if (!F.active) note(host, "The firewall is switched off, so these rules are not enforced yet. ufw enable turns it on.", WARN);
  }

  function renderEnv(host, sh) {
    const vars = sh.vars || {};
    const env = {}; Object.keys(vars).forEach(k => { env[k] = vars[k].value; });
    const exported = { has: k => !!(vars[k] && vars[k].exported) };
    const keys = Object.keys(env).slice(0, 24);
    const box = el("div", "rounded-md border border-neutral-800 p-2 text-[11px] font-mono space-y-0.5");
    if (!keys.length) box.appendChild(el("div", "text-neutral-500", "No variables set."));
    keys.forEach(k => {
      const ex = exported.has(k);
      const row = el("div", "flex items-center gap-2");
      row.appendChild(chip(ex ? "exported" : "shell-only", ex ? OK : "border-neutral-700 text-neutral-400"));
      row.appendChild(el("span", "text-neutral-100", k)); row.appendChild(el("span", "text-neutral-500 break-all", "=" + String(env[k]).slice(0, 60))); box.appendChild(row);
    });
    host.appendChild(box);
    if (env.PATH) {
      host.appendChild(el("div", "mt-3 text-[10px] uppercase tracking-wide text-neutral-500", "PATH is searched left to right"));
      const p = el("div", "mt-1 flex flex-wrap items-center gap-1 text-[11px]");
      env.PATH.split(":").forEach((d, i, a) => { p.appendChild(chip(d, "border-neutral-700 text-neutral-300")); if (i < a.length - 1) p.appendChild(el("span", "text-neutral-600", "›")); });
      host.appendChild(p);
    }
  }

  function bar(label, pct, cls, right) {
    const r = el("div", "mb-1.5");
    const t = el("div", "flex justify-between text-[10px] text-neutral-400"); t.appendChild(el("span", "", label)); t.appendChild(el("span", "", right || pct.toFixed(1) + "%")); r.appendChild(t);
    const track = el("div", "h-2 rounded bg-neutral-800 overflow-hidden"); const fill = el("div", "h-2 rounded " + cls); fill.style.width = Math.max(1, Math.min(100, pct)) + "%"; track.appendChild(fill); r.appendChild(track);
    return r;
  }
  function renderMonitor(host, sh) {
    const p = sh.sys.perfData && sh.sys.perfData();
    if (!p) { host.appendChild(el("div", "text-[11px] text-neutral-500", "No performance data for this machine.")); return; }
    const last = sh.sys.lastPerf;
    const hot = k => (last === k ? "ring-1 ring-emerald-400/50 " : "");
    const loadPer = p.load[0] / p.cpus;
    const lc = el("div", "rounded-md border border-neutral-800 p-2.5 mb-2 " + hot("uptime"));
    lc.appendChild(el("div", "text-[10px] uppercase tracking-wide text-neutral-500 mb-1", "Load average (1 / 5 / 15 min) on " + p.cpus + " CPU" + (p.cpus > 1 ? "s" : "")));
    lc.appendChild(bar("1 min: " + p.load[0].toFixed(2), loadPer * 100, loadPer > 1 ? "bg-red-400" : loadPer > 0.7 ? "bg-amber-400" : "bg-emerald-400", loadPer > 1 ? "overloaded" : loadPer > 0.7 ? "busy" : "healthy"));
    lc.appendChild(el("div", "text-[10px] text-neutral-500", "5 min: " + p.load[1].toFixed(2) + " · 15 min: " + p.load[2].toFixed(2) + (p.load[0] > p.load[2] ? " · rising" : " · falling or steady")));
    host.appendChild(lc);
    const c = p.cpu, cc = el("div", "rounded-md border border-neutral-800 p-2.5 mb-2 " + hot("vmstat"));
    cc.appendChild(el("div", "text-[10px] uppercase tracking-wide text-neutral-500 mb-1", "CPU time split"));
    cc.appendChild(bar("user", c.us, "bg-sky-400")); cc.appendChild(bar("system", c.sy, "bg-violet-400"));
    cc.appendChild(bar("iowait (waiting on disk)", c.wa, c.wa > 10 ? "bg-red-400" : "bg-amber-400")); cc.appendChild(bar("idle", c.id, "bg-neutral-500"));
    host.appendChild(cc);
    const m = p.mem, mc = el("div", "rounded-md border border-neutral-800 p-2.5 " + hot("free"));
    mc.appendChild(el("div", "text-[10px] uppercase tracking-wide text-neutral-500 mb-1", "Memory (MiB)"));
    const usedPct = 100 * (m.total - m.avail) / m.total;
    mc.appendChild(bar("really used (total − available)", usedPct, usedPct > 90 ? "bg-red-400" : usedPct > 70 ? "bg-amber-400" : "bg-emerald-400", Math.round(m.total - m.avail) + " / " + m.total));
    mc.appendChild(bar("buff/cache (reclaimable)", 100 * m.cache / m.total, "bg-neutral-400", String(m.cache)));
    if (m.swapTotal) mc.appendChild(bar("swap used", 100 * m.swapUsed / m.swapTotal, m.swapUsed / m.swapTotal > 0.3 ? "bg-red-400" : "bg-emerald-400", m.swapUsed + " / " + m.swapTotal));
    host.appendChild(mc);
    const d = p.disks.find(x => x.util > 60);
    if (c.wa > 10 || d) note(host, "High iowait" + (d ? " and " + d.dev + " is " + d.util + "% busy" : "") + ": the CPU is idle but waiting on the disk, so the slowness is storage, not compute.", BAD);
    else if (loadPer > 1) note(host, "Load is above the CPU count: processes are queueing for CPU time.", BAD);
  }

  const R = (kind, title, icon, sub, legend, needsSys, fn) => root.VizPanels.register(kind, { title, icon, sub, legend, needsSys }, (host, sh) => fn(host, sh));
  R("packages", "Live Package State", "fa-box-open", "What is installed, whether the repository index is fresh, and what has a newer version.", [["bg-emerald-400", "Just changed / fresh"], ["bg-amber-400", "Stale / upgradable"]], true, renderPackages);
  R("firewall", "Live Firewall", "fa-fire-flame-curved", "The traffic your firewall lets in. Anything not listed is blocked.", [["bg-emerald-400", "Allowed"], ["bg-red-400", "Denied"]], true, renderFirewall);
  R("env", "Live Environment", "fa-sliders", "Shell variables, which ones child processes inherit (exported), and the PATH search order.", [["bg-emerald-400", "Exported to child processes"], ["bg-neutral-500", "Shell-only"]], false, renderEnv);
  R("monitor", "Live Performance Gauges", "fa-gauge-high", "Load, CPU time split and memory. Red means the machine is struggling and tells you where.", [["bg-emerald-400", "Healthy"], ["bg-amber-400", "Busy"], ["bg-red-400", "Problem"]], true, renderMonitor);
})(typeof window !== "undefined" ? window : globalThis);

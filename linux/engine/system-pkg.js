/**
 * CmdCraft simulated system, part 4: package managers (apt/dpkg, dnf/rpm, apk) and firewalls (ufw, firewall-cmd).
 * A scenario picks the distribution with system.packages.distro ("debian" | "rhel" | "alpine"); only that family's
 * tools exist, like on a real machine. State (installed, index freshness, upgradable, rules) really changes.
 */
(function (root) {
  if (!root.SystemState) return;
  const pad = (s, n) => String(s).padEnd(n);
  const BIN = p => /^\/usr\/(s?bin)\//.test(p) || /^\/bin\//.test(p);

  root.SystemState.extensions.push(function (sys, seed) {
    const reg = (name, has, fn, supported) => { sys.ext[name] = { has, fn, supported }; };
    const pk = seed.packages || null;
    sys.pkg = pk ? Object.assign({ installed: {}, index: {}, upgradable: {}, stale: true, shownUpgrades: false, log: [] }, JSON.parse(JSON.stringify(pk))) : null;
    sys.fw = seed.firewall ? Object.assign({ kind: "ufw", active: false, defaultIn: "deny", rules: [], zone: "public", runtime: { ports: [], services: ["ssh"] }, permanent: { ports: [], services: ["ssh"] } }, JSON.parse(JSON.stringify(seed.firewall))) : null;
    sys.lastPkg = null; sys.lastFw = null;
    const prev = sys.extraState;
    sys.extraState = () => [prev ? prev() : null, sys.pkg && [sys.pkg.installed, sys.pkg.stale, sys.pkg.upgradable], sys.fw];
    const fam = f => () => !!sys.pkg && sys.pkg.distro === f;
    const isRoot = sh => !!(sh && sh.asRoot);

    // ---------- shared package operations ----------
    const names = args => args.filter(a => !a.startsWith("-"));
    const entry = n => sys.pkg.index[n];
    const version = n => (entry(n) || {}).v || "1.0";
    function installOne(n, sh, auto) {
      const e = entry(n);
      sys.pkg.installed[n] = { v: e.v, auto: !!auto };
      (e.files || []).forEach(p => {
        const parent = sh.mkdirp(p.slice(0, p.lastIndexOf("/")) || "/");
        if (!sh.lookup(p, true)) { const node = sh.createFile(p, p.startsWith("/etc/") ? "# " + n + " configuration\n" : "\u007fELF"); if (node) { if (BIN(p)) { node.mode = 0o755; node.binary = true; } node.owner = "root"; node.group = "root"; node.age = 0; } }
      });
      if (e.service && sys.services) {
        sys.services[e.service] = Object.assign({ desc: e.d, state: "active", detail: "running", enabled: true, pid: null, since: 0 }, sys.services[e.service] || {}, { state: "active", detail: "running", enabled: true });
        sys.startService && !sys.services[e.service].pid && sys.startService(e.service);
      }
    }
    function depsOf(n) { return (entry(n).deps || []).filter(d => entry(d) && !sys.pkg.installed[d]); }
    function removeOne(n, sh, purge) {
      const e = entry(n) || { files: [] };
      (e.files || []).forEach(p => {
        const keep = p.startsWith("/etc/") && !purge;
        if (keep) return;
        const node = sh.lookup(p);
        if (node) sh.lookup(p.slice(0, p.lastIndexOf("/")) || "/", true).children.delete(p.split("/").pop());
      });
      delete sys.pkg.installed[n];
      if (e.service && sys.services[e.service]) { sys.stopService && sys.services[e.service].pid && sys.stopService(e.service); delete sys.services[e.service]; }
    }
    const orphans = () => Object.keys(sys.pkg.installed).filter(n => sys.pkg.installed[n].auto && !Object.keys(sys.pkg.installed).some(o => o !== n && ((entry(o) || {}).deps || []).includes(n)));
    const lockErr = (tool) => ({ err: tool === "apt" ? "E: Could not open lock file /var/lib/dpkg/lock-frontend - open (13: Permission denied)\nE: Unable to acquire the dpkg frontend lock (/var/lib/dpkg/lock-frontend), are you root?\n" : tool === "dnf" ? "Error: This command has to be run with superuser privileges (under the root user on most systems).\n" : "ERROR: Unable to lock database: Permission denied\nERROR: Failed to open apk database: Permission denied\n", code: tool === "apt" ? 100 : 1 });

    // ---------- apt / apt-get ----------
    const aptFn = function (args, flags, stdin, sh) {
      const sub = args.find(a => !a.startsWith("-"));
      const rest = args.filter(a => !a.startsWith("-")).slice(1);
      const P = sys.pkg;
      sys.lastPkg = { tool: "apt", sub, names: rest };
      if (["update", "upgrade", "install", "remove", "purge", "autoremove", "full-upgrade", "dist-upgrade"].includes(sub) && !isRoot(sh)) return lockErr("apt");
      switch (sub) {
        case "update": {
          P.stale = false; P.shownUpgrades = true;
          const n = Object.keys(P.upgradable).length;
          return { out: "Hit:1 http://archive.ubuntu.com/ubuntu jammy InRelease\nGet:2 http://archive.ubuntu.com/ubuntu jammy-updates InRelease [119 kB]\nGet:3 http://security.ubuntu.com/ubuntu jammy-security InRelease [110 kB]\nFetched 1,236 kB in 1s (1,420 kB/s)\nReading package lists... Done\nBuilding dependency tree... Done\n" + (n ? n + " package" + (n > 1 ? "s" : "") + " can be upgraded. Run 'apt list --upgradable' to see " + (n > 1 ? "them" : "it") + ".\n" : "All packages are up to date.\n") };
        }
        case "upgrade": case "full-upgrade": case "dist-upgrade": {
          const up = P.shownUpgrades ? Object.keys(P.upgradable) : [];
          up.forEach(n => { if (P.installed[n]) P.installed[n].v = P.upgradable[n]; if (entry(n)) entry(n).v = P.upgradable[n]; delete P.upgradable[n]; });
          return { out: "Reading package lists... Done\nBuilding dependency tree... Done\nCalculating upgrade... Done\n" + (up.length ? "The following packages will be upgraded:\n  " + up.join(" ") + "\n" : "") + up.length + " upgraded, 0 newly installed, 0 to remove and " + (P.shownUpgrades ? 0 : Object.keys(P.upgradable).length) + " not upgraded.\n" + up.map(n => "Setting up " + n + " (" + version(n) + ") ...").join("\n") + (up.length ? "\n" : "") };
        }
        case "install": {
          if (!rest.length) return { err: "E: No packages specified\n", code: 100 };
          let out = "Reading package lists... Done\nBuilding dependency tree... Done\n", err = "";
          const todo = [];
          for (const n of rest) {
            const e = entry(n);
            if (!e || (P.stale && e.afterUpdate)) return { err: "E: Unable to locate package " + n + "\n", code: 100 };
            if (P.installed[n]) { out += n + " is already the newest version (" + P.installed[n].v + ").\n"; continue; }
            const ds = depsOf(n); todo.push([n, ds]);
          }
          todo.forEach(([n, ds]) => {
            if (ds.length) out += "The following additional packages will be installed:\n  " + ds.join(" ") + "\n";
            out += "The following NEW packages will be installed:\n  " + [...ds, n].join(" ") + "\n0 upgraded, " + (ds.length + 1) + " newly installed, 0 to remove and " + Object.keys(P.upgradable).length + " not upgraded.\n";
            ds.forEach(d => { installOne(d, sh, true); out += "Setting up " + d + " (" + version(d) + ") ...\n"; });
            installOne(n, sh, false); out += "Setting up " + n + " (" + version(n) + ") ...\n";
            if ((entry(n) || {}).service) out += "Created symlink /etc/systemd/system/multi-user.target.wants/" + entry(n).service + ".service → /lib/systemd/system/" + entry(n).service + ".service.\n";
          });
          return { out, err };
        }
        case "remove": case "purge": {
          let out = "Reading package lists... Done\n";
          rest.forEach(n => {
            if (!P.installed[n]) { out += "Package '" + n + "' is not installed, so not removed\n"; return; }
            removeOne(n, sh, sub === "purge");
            out += "The following packages will be REMOVED:\n  " + n + "\n0 upgraded, 0 newly installed, 1 to remove.\n" + (sub === "purge" ? "Purging configuration files for " : "Removing ") + n + " (" + version(n) + ") ...\n" + (sub === "remove" && (entry(n).files || []).some(p => p.startsWith("/etc/")) ? "(configuration files kept; use purge to delete them)\n" : "");
          });
          return { out };
        }
        case "autoremove": {
          const o = orphans();
          o.forEach(n => removeOne(n, sh, false));
          return { out: "Reading package lists... Done\n" + (o.length ? "The following packages will be REMOVED:\n  " + o.join(" ") + "\n" + o.length + " to remove.\n" + o.map(n => "Removing " + n + " (" + version(n) + ") ...").join("\n") + "\n" : "0 upgraded, 0 newly installed, 0 to remove and " + Object.keys(P.upgradable).length + " not upgraded.\n") };
        }
        case "search": {
          const t = (rest[0] || "").toLowerCase();
          const hits = Object.entries(P.index).filter(([n, e]) => (!P.stale || !e.afterUpdate) && (n.includes(t) || (e.d || "").toLowerCase().includes(t)));
          return { out: "Sorting... Done\nFull Text Search... Done\n" + hits.map(([n, e]) => n + "/jammy " + e.v + " amd64" + (P.installed[n] ? " [installed]" : "") + "\n  " + e.d + "\n").join("\n") };
        }
        case "show": {
          const n = rest[0], e = entry(n);
          if (!e) return { err: "N: Unable to locate package " + n + "\nE: No packages found\n", code: 100 };
          return { out: "Package: " + n + "\nVersion: " + e.v + "\nPriority: optional\nSection: web\nMaintainer: Ubuntu Developers <ubuntu-devel-discuss@lists.ubuntu.com>\nInstalled-Size: " + (e.size || 1200) + " kB\nDepends: " + ((e.deps || []).join(", ") || "libc6") + "\nDescription: " + e.d + "\n" };
        }
        case "list": {
          const mode = args.includes("--installed") ? "installed" : args.includes("--upgradable") ? "upgradable" : "all";
          let rows;
          if (mode === "installed") rows = Object.entries(P.installed).map(([n, i]) => n + "/jammy," + (i.auto ? "now " + i.v + " amd64 [installed,automatic]" : "now " + i.v + " amd64 [installed]"));
          else if (mode === "upgradable") rows = P.shownUpgrades ? Object.entries(P.upgradable).map(([n, v]) => n + "/jammy-updates " + v + " amd64 [upgradable from: " + ((P.installed[n] || {}).v || "?") + "]") : [];
          else rows = Object.entries(P.index).map(([n, e]) => n + "/jammy " + e.v + " amd64" + (P.installed[n] ? " [installed]" : ""));
          return { out: "Listing... Done\n" + rows.join("\n") + (rows.length ? "\n" : "") };
        }
        default: return { err: "E: Invalid operation " + (sub || "") + "\n", code: 100 };
      }
    };
    reg("apt", fam("debian"), aptFn, args => ["update", "upgrade", "full-upgrade", "dist-upgrade", "install", "remove", "purge", "autoremove", "search", "show", "list"].includes(args.find(a => !a.startsWith("-"))));
    reg("apt-get", fam("debian"), aptFn, args => ["update", "upgrade", "install", "remove", "purge", "autoremove"].includes(args.find(a => !a.startsWith("-"))));

    // ---------- dpkg ----------
    reg("dpkg", fam("debian"), function (args, flags, stdin, sh) {
      const P = sys.pkg; sys.lastPkg = { tool: "dpkg", args };
      if (flags.has("l")) {
        const pat = names(args)[0];
        const rows = Object.entries(P.installed).filter(([n]) => !pat || n.includes(pat.replace(/\*/g, ""))).map(([n, i]) => "ii  " + pad(n, 24) + pad(i.v, 20) + "amd64        " + ((entry(n) || {}).d || ""));
        if (pat && !rows.length) return { err: "dpkg-query: no packages found matching " + pat + "\n", code: 1 };
        return { out: "Desired=Unknown/Install/Remove/Purge/Hold\n| Status=Not/Inst/Conf-files/Unpacked/halF-conf/Half-inst/trig-aWait/Trig-pend\n|/ Err?=(none)/Reinst-required (Status,Err: uppercase=bad)\n||/ Name                    Version             Architecture Description\n+++-=======================-===================-============-================================\n" + rows.join("\n") + "\n" };
      }
      if (flags.has("L")) { const n = names(args)[0]; if (!P.installed[n]) return { err: "dpkg-query: package '" + n + "' is not installed\nUse dpkg --info (= dpkg-deb --info) to examine archive files.\n", code: 1 }; return { out: "/.\n" + (entry(n).files || []).join("\n") + "\n" }; }
      if (flags.has("s")) { const n = names(args)[0]; if (!P.installed[n]) return { err: "dpkg-query: package '" + n + "' is not installed and no information is available\n", code: 1 }; return { out: "Package: " + n + "\nStatus: install ok installed\nVersion: " + P.installed[n].v + "\nDescription: " + entry(n).d + "\n" }; }
      if (flags.has("S")) { const p = names(args)[0]; const owner = Object.entries(P.installed).find(([n]) => (entry(n).files || []).includes(p)); return owner ? { out: owner[0] + ": " + p + "\n" } : { err: "dpkg-query: no path found matching pattern " + p + "\n", code: 1 }; }
      return { err: "dpkg: error: need an action option\n", code: 2 };
    }, args => args.length > 0);

    // ---------- dnf / yum / rpm ----------
    const dnfFn = function (args, flags, stdin, sh) {
      const sub = args.find(a => !a.startsWith("-")); const rest = args.filter(a => !a.startsWith("-")).slice(1); const P = sys.pkg;
      sys.lastPkg = { tool: "dnf", sub, names: rest };
      if (["install", "remove", "update", "upgrade", "makecache", "autoremove"].includes(sub) && !isRoot(sh)) return lockErr("dnf");
      switch (sub) {
        case "makecache": P.stale = false; P.shownUpgrades = true; return { out: "Rocky Linux 9 - BaseOS                 8.3 MB/s | 2.3 MB     00:00\nMetadata cache created.\n" };
        case "install": {
          let out = "Last metadata expiration check: 0:05:12 ago.\nDependencies resolved.\n";
          for (const n of rest) {
            const e = entry(n);
            if (!e) return { err: "Last metadata expiration check: 0:05:12 ago.\nNo match for argument: " + n + "\nError: Unable to find a match: " + n + "\n", code: 1 };
            if (P.installed[n]) { out += "Package " + n + "-" + P.installed[n].v + " is already installed.\nNothing to do.\nComplete!\n"; continue; }
            depsOf(n).forEach(d => installOne(d, sh, true)); installOne(n, sh, false);
            out += "================================\n Package   Architecture  Version   Repository  Size\n================================\nInstalling:\n " + pad(n, 10) + "x86_64  " + e.v + "  appstream  " + (e.size || 1200) + " k\n\nInstalled:\n  " + n + "-" + e.v + ".x86_64\n\nComplete!\n";
          }
          return { out };
        }
        case "remove": { let out = "Dependencies resolved.\n"; rest.forEach(n => { if (!P.installed[n]) { out += "No match for argument: " + n + "\nNo packages marked for removal.\n"; return; } removeOne(n, sh, false); out += "Removed:\n  " + n + "-" + version(n) + ".x86_64\n\nComplete!\n"; }); return { out }; }
        case "update": case "upgrade": { const up = Object.keys(P.upgradable); up.forEach(n => { if (P.installed[n]) P.installed[n].v = P.upgradable[n]; delete P.upgradable[n]; }); return { out: "Last metadata expiration check: 0:05:12 ago.\nDependencies resolved.\n" + (up.length ? "Upgraded:\n  " + up.join("\n  ") + "\n\nComplete!\n" : "Nothing to do.\nComplete!\n") }; }
        case "search": { const t = (rest[0] || "").toLowerCase(); const hits = Object.entries(P.index).filter(([n, e]) => n.includes(t) || (e.d || "").toLowerCase().includes(t)); return { out: "Last metadata expiration check: 0:05:12 ago.\n" + hits.map(([n, e]) => pad(n + ".x86_64", 28) + ": " + e.d).join("\n") + "\n" }; }
        case "info": { const n = rest[0], e = entry(n); if (!e) return { err: "Error: No matching Packages to list\n", code: 1 }; return { out: "Name         : " + n + "\nVersion      : " + e.v + "\nRelease      : 1.el9\nArchitecture : x86_64\nSize         : " + (e.size || 1200) + " k\nRepository   : " + (P.installed[n] ? "@System" : "appstream") + "\nSummary      : " + e.d + "\n" }; }
        case "list": { const inst = args.includes("installed"); const rows = Object.entries(inst ? P.installed : P.index).map(([n, i]) => pad(n + ".x86_64", 36) + pad((i.v || (entry(n) || {}).v), 16) + (inst ? "@System" : "appstream")); return { out: (inst ? "Installed Packages\n" : "Available Packages\n") + rows.join("\n") + "\n" }; }
        case "autoremove": { const o = orphans(); o.forEach(n => removeOne(n, sh, false)); return { out: "Dependencies resolved.\n" + (o.length ? "Removed:\n  " + o.join("\n  ") + "\n\nComplete!\n" : "Nothing to do.\nComplete!\n") }; }
        default: return { err: "No such command: " + sub + ". Please use /usr/bin/dnf --help\n", code: 1 };
      }
    };
    reg("dnf", fam("rhel"), dnfFn, args => ["install", "remove", "update", "upgrade", "search", "info", "list", "makecache", "autoremove"].includes(args.find(a => !a.startsWith("-"))));
    reg("yum", fam("rhel"), dnfFn, args => ["install", "remove", "update", "search", "info", "list"].includes(args.find(a => !a.startsWith("-"))));
    reg("rpm", fam("rhel"), function (args, flags, stdin, sh) {
      const P = sys.pkg; const n = names(args)[0]; sys.lastPkg = { tool: "rpm", args };
      if (flags.has("q") && flags.has("a")) return { out: Object.entries(P.installed).map(([k, i]) => k + "-" + i.v + "-1.el9.x86_64").join("\n") + "\n" };
      if (flags.has("q") && flags.has("l")) { if (!P.installed[n]) return { out: "package " + n + " is not installed\n", code: 1 }; return { out: (entry(n).files || []).join("\n") + "\n" }; }
      if (flags.has("q") && flags.has("i")) { if (!P.installed[n]) return { out: "package " + n + " is not installed\n", code: 1 }; return { out: "Name        : " + n + "\nVersion     : " + P.installed[n].v + "\nRelease     : 1.el9\nArchitecture: x86_64\nSummary     : " + entry(n).d + "\n" }; }
      if (flags.has("q")) return P.installed[n] ? { out: n + "-" + P.installed[n].v + "-1.el9.x86_64\n" } : { out: "package " + n + " is not installed\n", code: 1 };
      return { err: "rpm: no operation specified\n", code: 1 };
    }, args => args.length > 0);

    // ---------- apk (Alpine) ----------
    reg("apk", fam("alpine"), function (args, flags, stdin, sh) {
      const sub = args.find(a => !a.startsWith("-")); const rest = args.filter(a => !a.startsWith("-")).slice(1); const P = sys.pkg;
      sys.lastPkg = { tool: "apk", sub, names: rest };
      // Alpine containers run as root, so apk needs no sudo
      switch (sub) {
        case "update": P.stale = false; P.shownUpgrades = true; return { out: "fetch https://dl-cdn.alpinelinux.org/alpine/v3.18/main/x86_64/APKINDEX.tar.gz\nfetch https://dl-cdn.alpinelinux.org/alpine/v3.18/community/x86_64/APKINDEX.tar.gz\nv3.18.4-76-g8a2b1f [https://dl-cdn.alpinelinux.org/alpine/v3.18/main]\nOK: 19886 distinct packages available\n" };
        case "add": {
          let out = "";
          for (const n of rest) { const e = entry(n); if (!e || (P.stale && e.afterUpdate)) return { err: "ERROR: unable to select packages:\n  " + n + " (no such package):\n    required by: world[" + n + "]\n", code: 1 }; if (P.installed[n]) { out += "OK: " + Object.keys(P.installed).length * 2 + " MiB in " + Object.keys(P.installed).length + " packages\n"; continue; } const ds = depsOf(n); ds.forEach(d => installOne(d, sh, true)); installOne(n, sh, false); [...ds, n].forEach((k, i, a) => { out += "(" + (i + 1) + "/" + a.length + ") Installing " + k + " (" + version(k) + ")\n"; }); out += "Executing busybox-1.36.1-r5.trigger\nOK: " + Object.keys(P.installed).length * 3 + " MiB in " + Object.keys(P.installed).length + " packages\n"; }
          return { out };
        }
        case "del": { let out = ""; rest.forEach(n => { if (!P.installed[n]) { return; } removeOne(n, sh, true); out += "(1/1) Purging " + n + " (" + version(n) + ")\nOK: " + Object.keys(P.installed).length * 3 + " MiB in " + Object.keys(P.installed).length + " packages\n"; }); return { out }; }
        case "info": { if (!rest.length) return { out: Object.keys(P.installed).map(n => n + "-" + P.installed[n].v).join("\n") + "\n" }; const n = rest[0]; if (!P.installed[n]) return { out: "", code: 1 }; return { out: n + "-" + P.installed[n].v + " description:\n" + entry(n).d + "\n" }; }
        case "search": { const t = (rest[0] || ""); return { out: Object.entries(P.index).filter(([n]) => n.includes(t)).map(([n, e]) => n + "-" + e.v).join("\n") + "\n" }; }
        case "upgrade": { const up = Object.keys(P.upgradable); up.forEach(n => { if (P.installed[n]) P.installed[n].v = P.upgradable[n]; delete P.upgradable[n]; }); return { out: "OK: " + Object.keys(P.installed).length * 3 + " MiB in " + Object.keys(P.installed).length + " packages\n" }; }
        default: return { err: "apk: unrecognized command '" + sub + "'\n", code: 1 };
      }
    }, args => ["update", "add", "del", "info", "search", "upgrade"].includes(args.find(a => !a.startsWith("-"))));

    // ---------- ufw ----------
    const hasUfw = () => !!sys.fw && sys.fw.kind === "ufw", hasFwd = () => !!sys.fw && sys.fw.kind === "firewalld";
    const PORTS = { ssh: "22/tcp", http: "80/tcp", https: "443/tcp", postgresql: "5432/tcp", mysql: "3306/tcp", smtp: "25/tcp", dns: "53" };
    const normPort = p => PORTS[p] || (/^\d+$/.test(p) ? p : p);
    const ruleText = r => (r.from && r.from !== "Anywhere" ? (r.to || "Anywhere") : r.port) ;
    reg("ufw", hasUfw, function (args, flags, stdin, sh) {
      const F = sys.fw;
      sys.lastFw = { tool: "ufw", args };
      if (!isRoot(sh)) return { err: "ERROR: You need to be root to run this script\n", code: 1 };
      const sub = args[0];
      const tableOf = (numbered) => {
        let out = "Status: active\n\n" + (numbered ? "     " : "") + "To                         Action      From\n" + (numbered ? "     " : "") + "--                         ------      ----\n";
        F.rules.forEach((r, i) => { out += (numbered ? pad("[" + (i + 1) + "]", 5) : "") + pad(r.to || r.port, 27) + pad(r.action, 12) + (r.from || "Anywhere") + "\n"; });
        return out;
      };
      switch (sub) {
        case "status": {
          if (!F.active) return { out: "Status: inactive\n" };
          if (args.includes("verbose")) return { out: "Status: active\nLogging: on (low)\nDefault: " + F.defaultIn + " (incoming), allow (outgoing), disabled (routed)\nNew profiles: skip\n\n" + tableOf(false).split("\n").slice(2).join("\n") };
          return { out: tableOf(args.includes("numbered")) };
        }
        case "enable": F.active = true; return { out: "Command may disrupt existing ssh connections. Proceed with operation (y|n)? y\nFirewall is active and enabled on system startup\n" };
        case "disable": F.active = false; return { out: "Firewall stopped and disabled on system startup\n" };
        case "reset": F.rules = []; F.active = false; return { out: "Resetting all rules to installed defaults. Proceed with operation (y|n)? y\nBacking up 'user.rules' to '/etc/ufw/user.rules.20261029_143000'\n" };
        case "default": { const dir = args[2]; if (args[1] === "deny" || args[1] === "allow" || args[1] === "reject") { if (dir === "incoming") F.defaultIn = args[1]; return { out: "Default " + dir + " policy changed to '" + args[1] + "'\n(be sure to update your rules accordingly)\n" }; } return { err: "ERROR: Invalid syntax\n", code: 1 }; }
        case "allow": case "deny": case "reject": case "limit": {
          const action = sub.toUpperCase();
          let rule;
          const fi = args.indexOf("from");
          if (fi !== -1) {
            const from = args[fi + 1]; const pi = args.indexOf("port");
            const port = pi !== -1 ? args[pi + 1] + (args.includes("proto") ? "/" + args[args.indexOf("proto") + 1] : "/tcp") : "Anywhere";
            rule = { port, to: port, action, from };
          } else { const p = normPort(args[1] || ""); if (!p) return { err: "ERROR: Wrong number of arguments\n", code: 1 }; const port = /\//.test(p) || !/^\d+$/.test(p) ? p : p; rule = { port, to: port, action, from: "Anywhere" }; if (sub === "limit") rule.port = normPort(args[1]); }
          if (F.rules.some(r => r.port === rule.port && r.action === rule.action && (r.from || "Anywhere") === rule.from)) return { out: "Skipping adding existing rule\n" };
          F.rules.push(rule);
          return { out: "Rule added\n" + (F.active ? "" : "") };
        }
        case "delete": {
          let idx = -1;
          if (/^\d+$/.test(args[1] || "")) idx = parseInt(args[1], 10) - 1;
          else { const act = (args[1] || "").toUpperCase(), p = normPort(args[2] || ""); idx = F.rules.findIndex(r => r.action === act && r.port === p); }
          if (idx < 0 || idx >= F.rules.length) return { err: "Could not delete non-existent rule\n", code: 1 };
          F.rules.splice(idx, 1); return { out: "Rule deleted\n" };
        }
        default: return { err: "ERROR: Invalid syntax\n", code: 1 };
      }
    }, args => ["status", "enable", "disable", "reset", "default", "allow", "deny", "reject", "limit", "delete"].includes(args[0]));

    // ---------- firewalld ----------
    reg("firewall-cmd", hasFwd, function (args, flags, stdin, sh) {
      const F = sys.fw; sys.lastFw = { tool: "firewalld", args };
      const perm = args.includes("--permanent");
      const target = perm ? F.permanent : F.runtime;
      if (args.includes("--state")) return { out: "running\n" };
      if (args.includes("--reload")) { if (!isRoot(sh)) return { err: "Authorization failed.\n    Make sure polkit agent is running or run the application as superuser.\n", code: 1 }; F.runtime = JSON.parse(JSON.stringify(F.permanent)); return { out: "success\n" }; }
      if (args.includes("--get-active-zones")) return { out: F.zone + "\n  interfaces: eth0\n" };
      if (args.includes("--list-all") || args.includes("--list-ports") || args.includes("--list-services")) {
        const t = F.runtime;
        if (args.includes("--list-ports")) return { out: t.ports.join(" ") + "\n" };
        if (args.includes("--list-services")) return { out: t.services.join(" ") + "\n" };
        return { out: F.zone + " (active)\n  target: default\n  icmp-block-inversion: no\n  interfaces: eth0\n  sources: \n  services: " + t.services.join(" ") + "\n  ports: " + t.ports.join(" ") + "\n  protocols: \n  forward: yes\n  masquerade: no\n  forward-ports: \n  source-ports: \n  icmp-blocks: \n  rich rules: \n" };
      }
      const add = args.find(a => a.startsWith("--add-port=") || a.startsWith("--add-service=") || a.startsWith("--remove-port=") || a.startsWith("--remove-service="));
      if (add) {
        if (!isRoot(sh)) return { err: "Authorization failed.\n    Make sure polkit agent is running or run the application as superuser.\n", code: 1 };
        const [flag, val] = add.split("=");
        const list = flag.includes("port") ? target.ports : target.services;
        if (flag.startsWith("--add")) { if (!list.includes(val)) list.push(val); else return { out: "Warning: ALREADY_ENABLED: " + val + "\nsuccess\n" }; }
        else { const i = list.indexOf(val); if (i >= 0) list.splice(i, 1); }
        return { out: "success\n" };
      }
      return { err: "usage: see firewall-cmd man page\nfirewall-cmd: error: unrecognized arguments\n", code: 2 };
    }, args => args.length > 0);
  });
})(typeof window !== "undefined" ? window : globalThis);

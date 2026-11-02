/**
 * CmdCraft shell, part 3: builtins and everyday utilities.
 * Variables and export, tests, which/command, job control, umask/chgrp, tree/realpath/file, a fuller ls, bash -c.
 */
(function (root) {
  const VS = root.VirtualShell;
  if (!VS) return;
  const { normalize, dirname, basename, permString, formatSize, nowStamp, HOME, DEFAULT_OWNER, DEFAULT_GROUP } = VS.internals;
  const P = VS.prototype;
  const add = names => names.forEach(n => VS.KNOWN.add(n));
  const lines = t => (t === "" ? [] : t.replace(/\n$/, "").split("\n"));

  add(["true", "false", ":", "test", "[", "[[", "export", "unset", "env", "printenv", "set", "source", ".", "exit", "sleep", "which", "command", "type",
    "date", "tree", "realpath", "readlink", "file", "less", "more", "basename", "dirname", "chgrp", "umask", "bash", "sh", "clear", "jobs", "fg", "bg",
    "disown", "nohup", "wait", "history", "read", "alias", "unalias", "declare", "local", "return", "shift", "trap", "let", "eval", "hash", "id"]);
  // `id` stays a system command when the scenario has users; this is only the fallback when it does not
  VS.KNOWN.delete("id");

  // ---------- permission model (opt-in per scenario with setup.enforce) ----------
  P.userGroups = function () {
    const u = this.sys && this.sys.userByName && this.sys.userByName(DEFAULT_OWNER);
    return u ? [u.primary, ...(u.groups || [])] : [DEFAULT_GROUP];
  };
  // need: 4 read, 2 write, 1 execute
  P.canAccess = function (node, need) {
    if (this.asRoot) return true;
    const m = node.mode;
    if (node.owner === DEFAULT_OWNER) return (m & (need << 6)) !== 0;
    if (this.userGroups().includes(node.group)) return (m & (need << 3)) !== 0;
    return (m & need) !== 0;
  };

  // ---------- no-op and status builtins ----------
  P.cmd_true = () => ({ out: "", code: 0 });
  P.cmd_false = () => ({ out: "", code: 1 });
  P["cmd_:"] = () => ({ out: "", code: 0 });
  P.cmd_clear = () => ({ out: "" });
  P.cmd_sleep = function (args) { if (!args.length) return { err: "sleep: missing operand\n", code: 1 }; return { out: "" }; };
  P.cmd_exit = function (args) { return { out: "", exit: parseInt(args[0], 10) || 0, code: parseInt(args[0], 10) || 0 }; };
  P.cmd_wait = () => ({ out: "" });
  P.cmd_hash = () => ({ out: "" });
  P.cmd_history = function () { return { out: this.commandLog.map((c, i) => String(i + 1).padStart(5) + "  " + [c.name, ...c.args].join(" ")).join("\n") + "\n" }; };

  // ---------- date ----------
  P.cmd_date = function (args) {
    const d = { Y: "2026", m: "10", d: "29", H: "14", M: "30", S: "00", y: "26", B: "October", b: "Oct", A: "Wednesday", a: "Wed", Z: "UTC", z: "+0000", e: "29", j: "302", p: "PM", I: "02", s: "1793284200" };
    const fmt = args.find(a => a.startsWith("+"));
    if (!fmt) return { out: "Wed Oct 29 14:30:00 UTC 2026\n" };
    return { out: fmt.slice(1).replace(/%([A-Za-z%])/g, (m, k) => (k === "F" ? "2026-10-29" : k === "T" ? "14:30:00" : k === "D" ? "10/29/26" : k === "R" ? "14:30" : k === "%" ? "%" : d[k] !== undefined ? d[k] : m)) + "\n" };
  };

  // ---------- variables ----------
  P.cmd_export = function (args) {
    if (!args.length || (args.length === 1 && args[0] === "-p")) {
      return { out: Object.entries(this.vars).filter(([, v]) => v.exported).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `declare -x ${k}="${v.value}"`).join("\n") + "\n" };
    }
    args.filter(a => !a.startsWith("-")).forEach(a => {
      const eq = a.indexOf("=");
      if (eq < 0) { if (this.vars[a]) this.vars[a].exported = true; else this.vars[a] = { value: "", exported: true }; }
      else this.setVar(a.slice(0, eq), a.slice(eq + 1), true);
    });
    return { out: "" };
  };
  P.cmd_unset = function (args) { args.filter(a => !a.startsWith("-")).forEach(a => { delete this.vars[a]; }); return { out: "" }; };
  P.cmd_env = function (args) {
    const pairs = [];
    let i = 0;
    while (i < args.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(args[i])) pairs.push(args[i++]);
    const rest = args.slice(i);
    if (!rest.length) {
      const base = Object.entries(this.vars).filter(([, v]) => v.exported).map(([k, v]) => k + "=" + v.value);
      return { out: [...base, ...pairs].join("\n") + "\n" };
    }
    const saved = pairs.map(p => { const eq = p.indexOf("="); const n = p.slice(0, eq); const old = this.vars[n]; this.setVar(n, p.slice(eq + 1), true); return [n, old]; });
    const r = this.exec(rest.map(t => (/^[\w@%+=:,./-]+$/.test(t) ? t : '"' + t + '"')).join(" "));
    saved.forEach(([n, old]) => { if (old) this.vars[n] = old; else delete this.vars[n]; });
    return { out: r.out, err: r.err, code: r.code };
  };
  P.cmd_printenv = function (args) {
    if (!args.length) return this.cmd_env([]);
    const v = this.vars[args[0]];
    return v && v.exported ? { out: v.value + "\n" } : { out: "", code: 1 };
  };
  P.cmd_set = function (args) {
    if (!args.length) return { out: Object.entries(this.vars).map(([k, v]) => k + "=" + v.value).sort().join("\n") + "\n" };
    this.opts = this.opts || {};
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === "-o" || a === "+o") { const name = args[++i]; if (name === "pipefail") this.pipefail = a === "-o"; this.opts[name] = a === "-o"; continue; }
      if (/^[-+][euxvaf]+$/.test(a)) a.slice(1).split("").forEach(f => { this.opts[f] = a[0] === "-"; });
      else if (!a.startsWith("-") && !a.startsWith("+")) { this.positional = [this.positional[0], ...args.slice(i)]; break; }
    }
    return { out: "" };
  };
  P.cmd_shift = function (args) { const n = parseInt(args[0], 10) || 1; this.positional = [this.positional[0], ...this.positional.slice(1 + n)]; return { out: "" }; };
  P.cmd_let = function (args) { args.forEach(a => { const m = /^([A-Za-z_]\w*)=(.*)$/.exec(a); if (m) this.setVar(m[1], String(this.arith(m[2]))); }); return { out: "" }; };
  P.cmd_declare = function (args) { args.filter(a => !a.startsWith("-")).forEach(a => { const eq = a.indexOf("="); if (eq > 0) this.setVar(a.slice(0, eq), a.slice(eq + 1)); }); return { out: "" }; };
  P.cmd_local = P.cmd_declare;
  P.cmd_alias = function (args) { this.aliases = this.aliases || {}; args.forEach(a => { const eq = a.indexOf("="); if (eq > 0) this.aliases[a.slice(0, eq)] = a.slice(eq + 1); }); if (!args.length) return { out: Object.entries(this.aliases).map(([k, v]) => `alias ${k}='${v}'`).join("\n") + (this.aliases && Object.keys(this.aliases).length ? "\n" : "") }; return { out: "" }; };
  P.cmd_unalias = function (args) { args.forEach(a => { if (this.aliases) delete this.aliases[a]; }); return { out: "" }; };
  P.cmd_eval = function (args) { const r = this.exec(args.join(" ")); return { out: r.out, err: r.err, code: r.code }; };
  P.cmd_trap = function (args) { this.traps = this.traps || {}; if (args.length >= 2) args.slice(1).forEach(sig => { this.traps[sig.replace(/^SIG/, "")] = args[0]; }); return { out: "" }; };
  P.cmd_return = function (args) { return { out: "", code: parseInt(args[0], 10) || 0, ret: true }; };

  // read VAR [VAR...] from stdin: takes one line per call (scripts use `while read` which feeds lines)
  P.cmd_read = function (args, flags, stdin) {
    const names = args.filter(a => !a.startsWith("-"));
    if (this.stdinQueue === undefined) this.stdinQueue = null;
    const src = this.stdinQueue !== null ? this.stdinQueue : lines(stdin);
    if (!src.length) return { out: "", code: 1 };
    const line = src.shift();
    if (this.stdinQueue !== null) this.stdinQueue = src;
    const parts = line.split(/\s+/);
    (names.length ? names : ["REPLY"]).forEach((n, i, arr) => { this.setVar(n, i === arr.length - 1 ? parts.slice(i).join(" ") : (parts[i] || "")); });
    return { out: "", code: 0 };
  };

  // ---------- test / [ ] / [[ ]] ----------
  P.evalTest = function (a) {
    a = a.slice();
    const unary = (op, v) => {
      const n = this.lookup(this.abs(v || ""), true);
      switch (op) {
        case "-f": return !!n && n.type === "file";
        case "-d": return !!n && n.type === "dir";
        case "-e": return !!n || !!this.lookup(this.abs(v || ""));
        case "-L": case "-h": { const l = this.lookup(this.abs(v || "")); return !!l && l.type === "link"; }
        case "-r": return !!n && this.canAccess(n, 4);
        case "-w": return !!n && this.canAccess(n, 2);
        case "-x": return !!n && this.canAccess(n, 1);
        case "-s": return !!n && n.type === "file" && (n.size || 0) > 0;
        case "-z": return (v || "") === "";
        case "-n": return (v || "") !== "";
        default: return null;
      }
    };
    const evalSimple = t => {
      if (t.length === 0) return false;
      if (t.length === 1) return t[0] !== "";
      if (t.length === 2) { if (t[0] === "!") return t[1] === ""; const r = unary(t[0], t[1]); return r === null ? false : r; }
      if (t.length >= 3) {
        const [l, op, r] = t;
        const ni = x => parseInt(x, 10);
        switch (op) {
          case "=": case "==": return l === r;
          case "!=": return l !== r;
          case "=~": try { return new RegExp(r).test(l); } catch (e) { return false; }
          case "-eq": return ni(l) === ni(r);
          case "-ne": return ni(l) !== ni(r);
          case "-lt": return ni(l) < ni(r);
          case "-le": return ni(l) <= ni(r);
          case "-gt": return ni(l) > ni(r);
          case "-ge": return ni(l) >= ni(r);
          case "<": return l < r;
          case ">": return l > r;
          default: if (t[0] === "!") return !evalSimple(t.slice(1)); return false;
        }
      }
      return false;
    };
    // handle ! , -a , -o at top level
    const parse = toks => {
      const orIdx = toks.findIndex(x => x === "-o" || x === "||");
      if (orIdx > 0) return parse(toks.slice(0, orIdx)) || parse(toks.slice(orIdx + 1));
      const andIdx = toks.findIndex(x => x === "-a" || x === "&&");
      if (andIdx > 0) return parse(toks.slice(0, andIdx)) && parse(toks.slice(andIdx + 1));
      if (toks[0] === "!") return !parse(toks.slice(1));
      return evalSimple(toks);
    };
    return parse(a);
  };
  P.cmd_test = function (args) { return { out: "", code: this.evalTest(args) ? 0 : 1 }; };
  P["cmd_["] = function (args) { if (args[args.length - 1] !== "]") return { err: "bash: [: missing `]'\n", code: 2 }; return { out: "", code: this.evalTest(args.slice(0, -1)) ? 0 : 1 }; };
  P["cmd_[["] = function (args) { if (args[args.length - 1] !== "]]") return { err: "bash: syntax error: `]]' expected\n", code: 2 }; return { out: "", code: this.evalTest(args.slice(0, -1)) ? 0 : 1 }; };

  // ---------- which / command / type ----------
  const SBIN = new Set(["useradd", "usermod", "userdel", "groupadd", "groupdel", "ip", "fdisk", "parted", "mkfs", "mkswap", "swapon", "swapoff", "fsck", "ufw", "iptables", "blkid", "sshd", "cron", "nginx", "service", "mount", "umount", "dmidecode", "ifconfig", "route", "traceroute", "apt"]);
  const BUILTINS = new Set(["cd", "export", "unset", "source", ".", "exit", "set", "alias", "unalias", "read", "declare", "local", "return", "shift", "trap", "let", "eval", "test", "[", "[[", "type", "command", "history", "jobs", "fg", "bg", "disown", "wait", "umask", "hash", "true", "false", ":", "echo", "pwd", "kill"]);
  P.findInPath = function (name) {
    if (name.includes("/")) { const n = this.lookup(this.abs(name), true); return n && n.type === "file" ? this.abs(name) : null; }
    const dirs = ((this.vars.PATH || { value: "" }).value).split(":").filter(Boolean);
    for (const d of dirs) {
      const dir = this.lookup(d, true);
      const f = dir && dir.type === "dir" ? dir.children.get(name) : null;
      if (f && (f.type === "file" || f.type === "link") && (f.mode & 0o111)) return normalize(d + "/" + name);
    }
    const known = VS.KNOWN.has(name) || (this.sys && this.sys.handles(name)) || ["sudo", "bash", "sh", "vim", "vi", "nano", "apt", "dnf", "ufw", "systemctl", "top", "htop", "free", "uptime", "ssh", "ssh-keygen", "ssh-add", "ssh-agent", "ssh-copy-id", "rsync", "zip", "unzip", "wget", "curl", "python3", "node", "git"].includes(name);
    if (known && !(BUILTINS.has(name) && !["echo", "pwd", "kill", "true", "false", "test", "["].includes(name))) {
      const dirsSet = dirs.length ? dirs : ["/usr/bin"];
      const want = SBIN.has(name) ? "/usr/sbin" : "/usr/bin";
      return dirsSet.includes(want) ? want + "/" + name : (dirsSet.length ? null : want + "/" + name);
    }
    return null;
  };
  P.cmd_which = function (args) {
    let out = "", code = 0;
    args.filter(a => !a.startsWith("-")).forEach(a => { const p = this.findInPath(a); if (p) out += p + "\n"; else code = 1; });
    return { out, code };
  };
  P.cmd_command = function (args) {
    const v = args.includes("-v") || args.includes("-V");
    const names = args.filter(a => !a.startsWith("-"));
    if (!v) { const r = this.exec(names.join(" ")); return { out: r.out, err: r.err, code: r.code }; }
    let out = "", code = 0;
    names.forEach(n => { const p = this.findInPath(n); if (BUILTINS.has(n) && !p) out += n + "\n"; else if (p) out += p + "\n"; else code = 1; });
    return { out, code };
  };
  P.cmd_type = function (args) {
    let out = "", err = "", code = 0;
    args.filter(a => !a.startsWith("-")).forEach(n => {
      const p = this.findInPath(n);
      if (this.aliases && this.aliases[n]) out += `${n} is aliased to \`${this.aliases[n]}'\n`;
      else if (BUILTINS.has(n) && !["echo", "pwd", "kill", "true", "false", "test", "["].includes(n)) out += `${n} is a shell builtin\n`;
      else if (p) out += `${n} is ${p}\n`;
      else { err += `bash: type: ${n}: not found\n`; code = 1; }
    });
    return { out, err, code };
  };

  // ---------- umask / chgrp ----------
  P.cmd_umask = function (args) {
    const cur = this.umaskVal === undefined ? 0o022 : this.umaskVal;
    if (!args.length) return { out: "0" + cur.toString(8).padStart(3, "0") + "\n" };
    if (args[0] === "-S") { const sym = b => ((b & 4) ? "" : "r") + ((b & 2) ? "" : "w") + ((b & 1) ? "" : "x"); return { out: `u=${sym((cur >> 6) & 7)},g=${sym((cur >> 3) & 7)},o=${sym(cur & 7)}\n`.replace(/=,/g, "=,") }; }
    if (!/^[0-7]{3,4}$/.test(args[0])) return { err: `bash: umask: ${args[0]}: octal number out of range\n`, code: 1 };
    this.umaskVal = parseInt(args[0], 8) & 0o777;
    return { out: "" };
  };
  P.cmd_chgrp = function (args, flags) {
    const rest = args.filter(a => !a.startsWith("-"));
    if (rest.length < 2) return { err: "chgrp: missing operand\n", code: 1 };
    const grp = rest[0];
    if (this.sys && this.sys.groups.length && !this.sys.groupByName(grp) && !["root", DEFAULT_GROUP].includes(grp)) return { err: `chgrp: invalid group: ‘${grp}’\n`, code: 1 };
    if (this.enforce && !this.asRoot) return { err: `chgrp: changing group of '${rest[1]}': Operation not permitted\n`, code: 1 };
    let err = "";
    rest.slice(1).forEach(f => {
      const n = this.lookup(this.abs(f), true);
      if (!n) { err += `chgrp: cannot access '${f}': No such file or directory\n`; return; }
      const targets = []; if (flags.has("R")) this.walk(n, x => targets.push(x)); else targets.push(n);
      targets.forEach(t => { t.group = grp; });
    });
    return { err, code: err ? 1 : 0 };
  };

  // ---------- path utilities ----------
  P.resolveReal = function (abs) {
    let parts = normalize(abs).split("/").filter(Boolean), cur = "", guard = 0;
    const done = [];
    while (parts.length && guard++ < 40) {
      const part = parts.shift();
      const here = normalize(done.join("/") + "/" + part);
      const n = this.lookup(here);
      if (n && n.type === "link") {
        const target = n.target.startsWith("/") ? n.target : normalize(done.join("/") + "/" + n.target);
        parts = normalize(target).split("/").filter(Boolean).concat(parts); done.length = 0; continue;
      }
      done.push(part);
    }
    return "/" + done.join("/");
  };
  P.cmd_realpath = function (args, flags) {
    let out = "", err = "";
    args.filter(a => !a.startsWith("-")).forEach(a => {
      const real = this.resolveReal(this.abs(a));
      if (!flags.has("m") && !this.lookup(real)) err += `realpath: ${a}: No such file or directory\n`; else out += real + "\n";
    });
    return { out, err, code: err ? 1 : 0 };
  };
  P.cmd_readlink = function (args, flags) {
    const f = args.filter(a => !a.startsWith("-"))[0];
    if (!f) return { err: "readlink: missing operand\n", code: 1 };
    if (flags.has("f") || flags.has("e") || flags.has("m")) { const real = this.resolveReal(this.abs(f)); return this.lookup(real) || flags.has("m") ? { out: real + "\n" } : { out: "", code: 1 }; }
    const n = this.lookup(this.abs(f));
    return n && n.type === "link" ? { out: n.target + "\n" } : { out: "", code: 1 };
  };
  P.cmd_basename = function (args) { const p = args.filter(a => !a.startsWith("-")); if (!p.length) return { err: "basename: missing operand\n", code: 1 }; let b = p[0].replace(/\/+$/, ""); b = b.slice(b.lastIndexOf("/") + 1) || "/"; if (p[1] && b.endsWith(p[1]) && b !== p[1]) b = b.slice(0, -p[1].length); return { out: b + "\n" }; };
  P.cmd_dirname = function (args) { const p = args.filter(a => !a.startsWith("-"))[0]; if (!p) return { err: "dirname: missing operand\n", code: 1 }; const t = p.replace(/\/+$/, ""); const i = t.lastIndexOf("/"); return { out: (i < 0 ? "." : i === 0 ? "/" : t.slice(0, i)) + "\n" }; };

  P.cmd_file = function (args) {
    let out = "", err = "";
    args.filter(a => !a.startsWith("-")).forEach(f => {
      const n = this.lookup(this.abs(f));
      if (!n) { out += `${f}: cannot open \`${f}' (No such file or directory)\n`; return; }
      let d;
      if (n.type === "dir") d = "directory";
      else if (n.type === "link") d = "symbolic link to " + n.target;
      else if (n.gz) d = "gzip compressed data, was \"" + n.name.replace(/\.gz$/, "") + "\", from Unix";
      else if (n.archive) d = n.archive.z ? "gzip compressed data, from Unix" : "POSIX tar archive (GNU)";
      else if (n.binary) d = "ELF 64-bit LSB pie executable, x86-64, version 1 (SYSV), dynamically linked, stripped";
      else {
        const c = n.content;
        if (c === null || c === "") d = (n.size || 0) === 0 ? "empty" : "data";
        else if (/^#!.*\bbash\b/.test(c)) d = "Bourne-Again shell script, ASCII text executable";
        else if (/^#!.*\bsh\b/.test(c)) d = "POSIX shell script, ASCII text executable";
        else if (/^#!.*python/.test(c)) d = "Python script, ASCII text executable";
        else if (/^\s*[{[]/.test(c) && /[}\]]\s*$/.test(c)) d = "JSON data";
        else if (/^-----BEGIN .*PRIVATE KEY-----/.test(c)) d = "OpenSSH private key";
        else if (/^ssh-(rsa|ed25519)/.test(c)) d = "OpenSSH public key";
        else if (/[^\x00-\x7f]/.test(c)) d = "Unicode text, UTF-8 text";
        else d = /\n.+\n.+/.test(c) && c.length > 1000 ? "ASCII text, with very long lines" : "ASCII text";
      }
      out += `${f}: ${d}\n`;
    });
    return { out, err };
  };

  P.cmd_less = function (args, flags, stdin) { return this.cmd_cat(args, flags, stdin); };
  P.cmd_more = P.cmd_less;

  // ---------- tree ----------
  P.cmd_tree = function (args, flags) {
    let depth = Infinity; const dirsOnly = flags.has("d"), all = flags.has("a"); const targets = [];
    for (let i = 0; i < args.length; i++) { if (args[i] === "-L") { depth = parseInt(args[++i], 10); continue; } if (args[i].startsWith("-")) continue; targets.push(args[i]); }
    if (!targets.length) targets.push(".");
    let out = "", dirs = 0, files = 0, err = "";
    targets.forEach(t => {
      const node = this.lookup(this.abs(t), true);
      if (!node) { err += `${t} [error opening dir]\n`; return; }
      out += t + "\n";
      const walk = (n, prefix, d) => {
        if (n.type !== "dir" || d >= depth) return;
        const kids = [...n.children.entries()].filter(([k, v]) => (all || !k.startsWith(".")) && (!dirsOnly || v.type === "dir")).sort((a, b) => a[0].toLowerCase() < b[0].toLowerCase() ? -1 : 1);
        kids.forEach(([k, v], i) => {
          const last = i === kids.length - 1;
          out += prefix + (last ? "└── " : "├── ") + k + (v.type === "link" ? " -> " + v.target : "") + "\n";
          if (v.type === "dir") { dirs++; walk(v, prefix + (last ? "    " : "│   "), d + 1); } else files++;
        });
      };
      walk(node, "", 0);
    });
    out += `\n${dirs} director${dirs === 1 ? "y" : "ies"}${dirsOnly ? "" : ", " + files + " file" + (files === 1 ? "" : "s")}\n`;
    return { out, err };
  };

  // ---------- ls ----------
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dateForAge = age => { const d = new Date(Date.UTC(2026, 9, 29, 14, 0) - age * 86400000); return `${MONTHS[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, " ")} 14:00`; };
  P.cmd_ls = function (args, flags) {
    const paths = args.filter(a => !a.startsWith("-"));
    if (!paths.length) paths.push(".");
    const long = flags.has("l"), all = flags.has("a"), almost = flags.has("A"), human = flags.has("h"), recursive = flags.has("R");
    const stamp = n => (n.age !== undefined ? dateForAge(n.age) : (n.mtime || "Oct 29 14:00"));
    const sizeOf = nd => (nd.type === "dir" ? 4096 : nd.type === "link" ? nd.target.length : (nd.size || 0));
    const sortEntries = es => {
      es.sort((x, y) => x.label.replace(/^\./, "").toLowerCase().localeCompare(y.label.replace(/^\./, "").toLowerCase()));
      if (flags.has("S")) es.sort((x, y) => sizeOf(y.node) - sizeOf(x.node));
      if (flags.has("t")) es.sort((x, y) => (x.node.age !== undefined ? x.node.age : 5) - (y.node.age !== undefined ? y.node.age : 5));
      if (flags.has("r")) es.reverse();
      return es;
    };
    const suffix = nd => (flags.has("F") ? (nd.type === "dir" ? "/" : nd.type === "link" ? "@" : (nd.mode & 0o111) ? "*" : "") : "");
    let out = "", err = "";
    const listDir = (shown, abs, node, header) => {
      if (header) out += shown + ":\n";
      let entries = [...node.children.entries()].filter(([k]) => all || almost || !k.startsWith(".")).map(([k, v]) => ({ label: k, node: v }));
      sortEntries(entries);
      if (all && !almost) entries = [{ label: ".", node }, { label: "..", node: this.lookup(dirname(abs)) || node }, ...entries];
      out += renderEntries(entries, true);
      if (recursive) entries.filter(e => e.node.type === "dir" && e.label !== "." && e.label !== "..").forEach(e => { out += "\n"; listDir(shown.replace(/\/$/, "") + "/" + e.label, normalize(abs + "/" + e.label), e.node, true); });
    };
    const renderEntries = (entries, isDirListing) => {
      if (!entries.length) return "";
      if (long) {
        const rows = entries.map(e => { const nd = e.node; const label = (nd.type === "link" ? `${e.label} -> ${nd.target}` : e.label) + suffix(nd);
          return [permString(nd), nd.type === "dir" ? String(2 + [...nd.children.values()].filter(c => c.type === "dir").length) : "1", nd.owner, nd.group, human ? formatSize(sizeOf(nd)).replace("B", "") : String(sizeOf(nd)), stamp(nd), label]; });
        const w = i => Math.max(0, ...rows.map(r => r[i].length));
        const total = isDirListing ? `total ${Math.max(0, entries.length * 4)}\n` : "";
        return total + rows.map(r => `${r[0]} ${r[1].padStart(w(1))} ${r[2].padEnd(w(2))} ${r[3].padEnd(w(3))} ${r[4].padStart(w(4))} ${r[5]} ${r[6]}`).join("\n") + "\n";
      }
      return entries.map(e => e.label + suffix(e.node)).join(flags.has("1") || this.pipedOut ? "\n" : "  ") + "\n";
    };
    const files = [], dirs = [];
    paths.forEach(p => {
      const a = this.abs(p);
      const n = this.lookup(a, !long || p.endsWith("/"));
      if (!n) { err += `ls: cannot access '${p}': No such file or directory\n`; return; }
      if (n.type === "dir" && !flags.has("d")) dirs.push({ p, a, n }); else files.push({ label: p, node: n });
    });
    if (files.length) out += renderEntries(sortEntries(files), false);
    dirs.forEach((d, idx) => {
      if (files.length || idx > 0) out += "\n";
      listDir(d.p, d.a, d.n, dirs.length + files.length > 1 || recursive);
    });
    return { out, err, code: err ? 2 : 0 };
  };

  // ---------- job control ----------
  const jobSpec = (jobs, args) => { const a = args.find(x => /^%\d+$|^%[%+-]?$/.test(x)); if (!a) return jobs[jobs.length - 1]; const id = a === "%%" || a === "%+" || a === "%" ? null : parseInt(a.slice(1), 10); return id === null ? jobs[jobs.length - 1] : jobs.find(j => j.id === id); };
  P.cmd_jobs = function (args, flags) {
    if (!this.jobs.length) return { out: "" };
    return { out: this.jobs.map((j, i) => `[${j.id}]${i === this.jobs.length - 1 ? "+" : i === this.jobs.length - 2 ? "-" : " "}  ${flags.has("l") ? j.pid + " " : ""}${j.state.padEnd(20)}${j.cmd}${j.state === "Running" ? " &" : ""}`).join("\n") + "\n" };
  };
  P.syncJobProcess = function (job, remove) {
    if (!this.sys) return;
    this.sys.processes = this.sys.processes.filter(p => p.pid !== job.pid);
    if (!remove) this.sys.processes.push({ pid: job.pid, user: DEFAULT_OWNER, cpu: 0, mem: 0.1, vsz: 8000, rss: 900, tty: "pts/0", stat: job.state === "Stopped" ? "T" : "S", start: "14:30", time: "0:00", cmd: job.cmd.replace(/^nohup\s+/, ""), comm: job.cmd.replace(/^nohup\s+/, "").split(" ")[0] });
  };
  P.cmd_fg = function (args) { const j = jobSpec(this.jobs, args); if (!j) return { err: "bash: fg: current: no such job\n", code: 1 }; this.jobs = this.jobs.filter(x => x !== j); this.syncJobProcess(j, true); return { out: j.cmd + "\n" }; };
  P.cmd_bg = function (args) { const j = jobSpec(this.jobs, args); if (!j) return { err: "bash: bg: current: no such job\n", code: 1 }; j.state = "Running"; this.syncJobProcess(j, false); return { out: `[${j.id}]+ ${j.cmd} &\n` }; };
  P.cmd_disown = function (args) { const j = jobSpec(this.jobs, args); if (!j) return { err: "bash: disown: current: no such job\n", code: 1 }; j.disowned = true; this.jobs = this.jobs.filter(x => x !== j); return { out: "" }; };
  P.cmd_nohup = function (args) {
    const r = this.exec(args.map(t => (/^[\w@%+=:,./-]+$/.test(t) ? t : '"' + t + '"')).join(" "));
    const f = this.lookup(this.abs("nohup.out")) || this.createFile(this.abs("nohup.out"), "");
    if (f) { f.content = (f.content || "") + (r.out || ""); f.size = f.content.length; }
    this.nohupUsed = true;
    return { out: "", err: "nohup: ignoring input and appending output to 'nohup.out'\n" };
  };
  // kill %N acts on shell jobs (the system's kill handles real PIDs)
  VS.intercept = VS.intercept || {};
  VS.intercept.kill = function (args) {
    if (!args.some(a => /^%\d+$/.test(a))) return null;
    let sig = 15;
    args.forEach(a => { if (/^-\d+$/.test(a)) sig = parseInt(a.slice(1), 10); else if (/^-(SIG)?[A-Z]+$/.test(a)) sig = { KILL: 9, TERM: 15, STOP: 19, CONT: 18, HUP: 1, INT: 2 }[a.replace(/^-(SIG)?/, "")] || 15; });
    let out = "", err = "";
    args.filter(a => /^%\d+$/.test(a)).forEach(a => {
      const j = this.jobs.find(x => x.id === parseInt(a.slice(1), 10));
      if (!j) { err += `bash: kill: ${a}: no such job\n`; return; }
      if (sig === 19) { j.state = "Stopped"; this.syncJobProcess(j, false); out += `\n[${j.id}]+  Stopped                 ${j.cmd}\n`; }
      else if (sig === 18) { j.state = "Running"; this.syncJobProcess(j, false); }
      else { this.jobs = this.jobs.filter(x => x !== j); this.syncJobProcess(j, true); out += `[${j.id}]+  ${sig === 9 ? "Killed" : "Terminated"}              ${j.cmd}\n`; }
    });
    return { out, err, code: err ? 1 : 0 };
  };

  // ---------- subshells: bash -c / sh -c / source ----------
  P.runChild = function (text, positional) {
    const saved = { vars: this.vars, positional: this.positional, cwd: this.cwd, lastCode: this.lastCode };
    const child = {};
    Object.entries(this.vars).forEach(([k, v]) => { if (v.exported) child[k] = { value: v.value, exported: true }; });
    this.vars = child; this.positional = positional || ["bash"];
    let r;
    try { r = this.exec(text); } finally { this.vars = saved.vars; this.positional = saved.positional; this.cwd = saved.cwd; }
    return r;
  };
  P.cmd_bash = function (args) {
    const ci = args.indexOf("-c");
    if (ci !== -1) { const r = this.runChild(args[ci + 1] || "", ["bash", ...args.slice(ci + 2)]); return { out: r.out, err: r.err, code: r.code }; }
    const file = args.filter(a => !a.startsWith("-"))[0];
    if (!file) return { out: "", code: 0 };
    return this.runScriptFile(file, args.slice(args.indexOf(file) + 1));
  };
  P.cmd_sh = P.cmd_bash;
  P.runScriptFile = function (file, scriptArgs) {
    const n = this.lookup(this.abs(file), true);
    if (!n) return { err: `bash: ${file}: No such file or directory\n`, code: 127 };
    if (n.type === "dir") return { err: `bash: ${file}: Is a directory\n`, code: 126 };
    if (this.enforce && !this.canAccess(n, 4)) return { err: `bash: ${file}: Permission denied\n`, code: 126 };
    if (this.scriptHook) return this.scriptHook.runFile(this, file, n.content || "", scriptArgs || []);
    const r = this.runChild(n.content || "", [file, ...(scriptArgs || [])]);
    return { out: r.out, err: r.err, code: r.code };
  };
  P.cmd_source = function (args) {
    const file = args[0];
    if (!file) return { err: "bash: source: filename argument required\n", code: 2 };
    const n = this.lookup(this.abs(file), true) || (file.includes("/") ? null : this.lookup(this.abs("./" + file), true));
    if (!n || n.type !== "file") return { err: `bash: ${file}: No such file or directory\n`, code: 1 };
    if (this.scriptHook) { const r = this.scriptHook.runText(this, n.content || "", [this.positional[0], ...args.slice(1)], false); return r; }
    let out = "", err = "", code = 0;
    lines(n.content || "").filter(l => l.trim() && !l.trim().startsWith("#")).forEach(l => { const r = this.exec(l); out += r.out || ""; err += r.err || ""; code = r.code; });
    return { out, err, code };
  };
  P["cmd_."] = P.cmd_source;

  // ---------- cat (permission aware) and echo -e ----------
  P.cmd_cat = function (args, flags, stdin) {
    const files = args.filter(a => !a.startsWith("-") || a === "-");
    const num = flags.has("n") || flags.has("b");
    const number = t => lines(t).map((l, i) => String(i + 1).padStart(6) + "\t" + l).join("\n") + (t ? "\n" : "");
    if (!files.length || (files.length === 1 && files[0] === "-")) return { out: num ? number(stdin) : stdin };
    let out = "", err = "";
    files.forEach(f => {
      if (f === "-") { out += stdin; return; }
      const r = this.readForTool(f, "cat");
      if (r.err) err += r.err; else out += r.text;
    });
    return { out: num ? number(out) : out, err, code: err ? 1 : 0 };
  };
  P.cmd_echo = function (args) {
    let nl = true, esc = false;
    while (args[0] && /^-[neE]+$/.test(args[0])) { if (args[0].includes("n")) nl = false; if (args[0].includes("e")) esc = true; if (args[0].includes("E")) esc = false; args = args.slice(1); }
    let s = args.join(" ");
    if (esc) s = s.replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\\\/g, "\\");
    return { out: s + (nl ? "\n" : "") };
  };

  // running a script by path (./deploy.sh) is handled in execLine via this hook: name not known -> try file
  VS.supports["bash"] = () => true;
  VS.supports["sh"] = () => true;
})(typeof window !== "undefined" ? window : globalThis);

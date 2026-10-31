/**
 * CmdCraft Virtual Shell — a small in-memory Linux filesystem and command interpreter.
 *
 * Built from a scenario's `initialFs` tree. Commands really change the in-memory state, output is
 * computed from that state, and `toTree()` hands the result back to the visualizer.
 * Permissions are not enforced (sudo is accepted and ignored); this is a teaching sandbox.
 */
(function (root) {
  const HOME = "/home/ubuntu";
  const DEFAULT_OWNER = "ubuntu";
  const DEFAULT_GROUP = "ubuntu";
  const KNOWN = new Set([
    "pwd", "cd", "ls", "cat", "mkdir", "rmdir", "touch", "rm", "cp", "mv", "chmod", "chown",
    "ln", "echo", "whoami", "head", "tail", "wc", "grep", "sort", "uniq", "tee", "df"
  ]);

  // ---------- helpers ----------
  const clone = n => {
    const c = Object.assign({}, n);
    if (n.children) {
      c.children = new Map();
      n.children.forEach((v, k) => c.children.set(k, clone(v)));
    }
    return c;
  };

  function parseSize(str) {
    if (!str) return 0;
    const m = /^([\d.]+)\s*(B|KB|MB|GB)?$/i.exec(String(str).trim());
    if (!m) return 0;
    const mult = { B: 1, KB: 1024, MB: 1024 * 1024, GB: 1024 * 1024 * 1024 }[(m[2] || "B").toUpperCase()];
    return Math.round(parseFloat(m[1]) * mult);
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + "B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(bytes < 10240 ? 1 : 0).replace(/\.0$/, "") + "KB";
    return (bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, "") + "MB";
  }

  function modeFromPermString(p, isDir) {
    if (!p || p.length < 10) return isDir ? 0o755 : 0o644;
    let mode = 0;
    for (let i = 0; i < 9; i++) {
      if (p[i + 1] !== "-" && p[i + 1] !== "S" && p[i + 1] !== "T") mode |= 1 << (8 - i);
    }
    return mode;
  }

  function permString(node) {
    const t = node.type === "dir" ? "d" : node.type === "link" ? "l" : "-";
    const m = node.mode;
    let s = t;
    "rwxrwxrwx".split("").forEach((ch, i) => { s += (m & (1 << (8 - i))) ? ch : "-"; });
    return s;
  }

  function normalize(path) {
    const out = [];
    path.split("/").forEach(seg => {
      if (!seg || seg === ".") return;
      if (seg === "..") out.pop(); else out.push(seg);
    });
    return "/" + out.join("/");
  }

  const dirname = p => { const n = normalize(p); return n === "/" ? "/" : normalize(n.slice(0, n.lastIndexOf("/"))); };
  const basename = p => { const n = normalize(p); return n === "/" ? "/" : n.slice(n.lastIndexOf("/") + 1); };

  function nowStamp() {
    const d = new Date();
    const mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()];
    return `${mon} ${String(d.getDate()).padStart(2, " ")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  // ---------- tokenizer ----------
  // Returns tokens: {t:"word", v, glob} or {t:"op", v}. Handles quotes, $VARS and ~ expansion.
  function tokenize(line, env) {
    const tokens = [];
    let i = 0;
    const ops = ["2>>", "2>&1", "&>", "2>", ">>", ">", "&&", ";", "|"];
    while (i < line.length) {
      const ch = line[i];
      if (/\s/.test(ch)) { i++; continue; }
      const op = ops.find(o => line.startsWith(o, i));
      if (op) { tokens.push({ t: "op", v: op }); i += op.length; continue; }

      let word = "", glob = false, started = false;
      while (i < line.length && !/\s/.test(line[i]) && !ops.some(o => line.startsWith(o, i))) {
        const c = line[i];
        started = true;
        if (c === "'") {
          const end = line.indexOf("'", i + 1);
          if (end === -1) throw new Error("unterminated quote");
          word += line.slice(i + 1, end);
          i = end + 1;
        } else if (c === '"') {
          let j = i + 1, seg = "";
          while (j < line.length && line[j] !== '"') {
            if (line[j] === "\\" && j + 1 < line.length && '"\\$'.includes(line[j + 1])) { seg += line[j + 1]; j += 2; continue; }
            seg += line[j++];
          }
          if (j >= line.length) throw new Error("unterminated quote");
          word += expandVars(seg, env);
          i = j + 1;
        } else if (c === "\\" && i + 1 < line.length) {
          word += line[i + 1];
          i += 2;
        } else {
          let seg = "";
          while (i < line.length && !/[\s'"\\]/.test(line[i]) && !ops.some(o => line.startsWith(o, i))) seg += line[i++];
          if (word === "" && (seg === "~" || seg.startsWith("~/"))) seg = env.HOME + seg.slice(1);
          if (/[*?]/.test(seg)) glob = true;
          word += expandVars(seg, env);
        }
      }
      if (started) tokens.push({ t: "word", v: word, glob });
    }
    return tokens;
  }

  function expandVars(s, env) {
    return s.replace(/\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?/g, (m, name) => (name in env ? env[name] : ""));
  }

  function globToRegex(pattern) {
    const esc = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");
    return new RegExp("^" + esc + "$");
  }

  // ---------- the shell ----------
  class VirtualShell {
    constructor(tree, setup) {
      setup = setup || {};
      this.root = { name: "/", type: "dir", mode: 0o755, owner: "root", group: "root", children: new Map(), mtime: nowStamp() };
      this.cwd = "/";
      this.oldpwd = null;
      this.commandLog = [];
      this.lastSig = null;

      if (tree) {
        this.viewRoot = normalize(tree.name);
        this.mkdirp(this.viewRoot);
        this.cwd = this.viewRoot;
        this.importNode(tree, this.viewRoot);
      } else {
        this.viewRoot = HOME;
        this.mkdirp(HOME);
        this.cwd = HOME;
      }
      if (setup.cwd) { this.mkdirp(setup.cwd); this.cwd = normalize(setup.cwd); }
      if (setup.oldpwd) { this.mkdirp(setup.oldpwd); this.oldpwd = normalize(setup.oldpwd); }
      Object.entries(setup.files || {}).forEach(([p, content]) => {
        const abs = this.abs(p);
        let n = this.lookup(abs);
        if (!n) n = this.createFile(abs);
        if (n) { n.content = content; if (!n.sizeDeclared) n.size = content.length; }
      });
      this.snapshotSignature();
    }

    // --- building from a scenario tree ---
    importNode(src, absPath) {
      const node = this.lookup(absPath);
      if (src.owner) { const [u, g] = String(src.owner).split(":"); node.owner = u; node.group = g || u; }
      if (src.perm) node.mode = modeFromPermString(src.perm, true);
      if (src.isCurrent) this.cwd = absPath;
      (src.children || []).forEach(child => {
        let name = child.name, target = null;
        const arrow = name.indexOf(" -> ");
        if (arrow !== -1) { target = name.slice(arrow + 4); name = name.slice(0, arrow); }
        const childPath = normalize(absPath + "/" + name);
        const isLink = target !== null || (child.perm && child.perm[0] === "l");
        const isDir = child.type === "dir";
        const n = {
          name,
          type: isLink ? "link" : isDir ? "dir" : "file",
          mode: isLink ? 0o777 : modeFromPermString(child.perm, isDir),
          owner: DEFAULT_OWNER, group: DEFAULT_GROUP,
          mtime: "Oct 29 14:00",
          content: null
        };
        if (child.owner) { const [u, g] = String(child.owner).split(":"); n.owner = u; n.group = g || u; }
        if (isLink) n.target = target || "";
        if (isDir) n.children = new Map();
        if (!isDir && !isLink) { n.size = parseSize(child.size); n.sizeDeclared = !!child.size; }
        this.lookup(absPath).children.set(name, n);
        if (child.isCurrent) this.cwd = childPath;
        if (isDir) this.importNode(child, childPath);
      });
    }

    // --- path utilities ---
    abs(p) {
      if (p === "~" || p.startsWith("~/")) p = HOME + p.slice(1);
      return normalize(p.startsWith("/") ? p : this.cwd + "/" + p);
    }

    lookup(absPath, followFinal) {
      let node = this.root;
      const parts = normalize(absPath).split("/").filter(Boolean);
      for (let i = 0; i < parts.length; i++) {
        if (node.type === "link") node = this.followLink(node, parts.slice(0, i - 1).join("/"));
        if (!node || node.type !== "dir") return null;
        node = node.children.get(parts[i]);
        if (!node) return null;
      }
      if (followFinal && node.type === "link") node = this.followLink(node, parts.slice(0, -1).join("/"));
      return node || null;
    }

    followLink(link, parentRel) {
      const base = "/" + parentRel;
      const target = link.target.startsWith("/") ? link.target : base + "/" + link.target;
      return this.lookup(normalize(target), true);
    }

    mkdirp(absPath) {
      let node = this.root;
      normalize(absPath).split("/").filter(Boolean).forEach(seg => {
        let next = node.children.get(seg);
        if (!next) {
          next = { name: seg, type: "dir", mode: 0o755, owner: DEFAULT_OWNER, group: DEFAULT_GROUP, children: new Map(), mtime: nowStamp() };
          node.children.set(seg, next);
        }
        node = next;
      });
      return node;
    }

    createFile(absPath, content) {
      const parent = this.lookup(dirname(absPath), true);
      if (!parent || parent.type !== "dir") return null;
      const node = {
        name: basename(absPath), type: "file", mode: 0o644, owner: DEFAULT_OWNER, group: DEFAULT_GROUP,
        content: content || "", size: (content || "").length, mtime: nowStamp()
      };
      parent.children.set(node.name, node);
      return node;
    }

    // --- inspection API used by scenario goals ---
    exists(p) { return !!this.lookup(this.abs(p)); }
    isFile(p) { const n = this.lookup(this.abs(p), true); return !!n && n.type === "file"; }
    isDir(p) { const n = this.lookup(this.abs(p), true); return !!n && n.type === "dir"; }
    isLink(p) { const n = this.lookup(this.abs(p)); return !!n && n.type === "link"; }
    mode(p) { const n = this.lookup(this.abs(p), true); return n ? n.mode : null; }
    owner(p) { const n = this.lookup(this.abs(p)); return n ? { user: n.owner, group: n.group } : null; }
    read(p) { const n = this.lookup(this.abs(p), true); return n && n.type === "file" ? (n.content || "") : null; }
    resolveLink(p) {
      const a = this.abs(p);
      const n = this.lookup(a);
      if (!n || n.type !== "link") return null;
      return n.target.startsWith("/") ? normalize(n.target) : normalize(dirname(a) + "/" + n.target);
    }
    // Did the user run `cmd` with all of `flags` (a string of single-letter flags)?
    ran(cmd, flags) {
      return this.commandLog.some(c => c.name === cmd && (flags || "").split("").every(f => c.flags.has(f)));
    }
    promptPath() {
      if (this.cwd === HOME) return "~";
      if (this.cwd.startsWith(HOME + "/")) return "~" + this.cwd.slice(HOME.length);
      return this.cwd;
    }

    // --- execution ---
    // Returns { handled, out, err }. handled=false means the line uses something this shell doesn't simulate;
    // in that case nothing is executed or changed.
    exec(line) {
      let tokens;
      const env = { HOME, USER: DEFAULT_OWNER, PWD: this.cwd, LOGNAME: DEFAULT_OWNER };
      try { tokens = tokenize(line, env); } catch (e) { return { handled: true, out: "", err: "bash: syntax error: " + e.message + "\n" }; }
      if (!tokens.length) return { handled: true, out: "", err: "" };

      // Split into command lists (;, &&) of pipelines (|) of simple commands.
      const lists = [[[]]];
      tokens.forEach(tok => {
        if (tok.t === "op" && (tok.v === ";" || tok.v === "&&")) lists.push([[]]);
        else if (tok.t === "op" && tok.v === "|") lists[lists.length - 1].push([]);
        else lists[lists.length - 1][lists[lists.length - 1].length - 1].push(tok);
      });

      // Pre-check that every command is one we simulate, so a partly-unknown line changes nothing.
      for (const pipeline of lists) {
        for (const stage of pipeline) {
          const words = stage.filter(t => t.t === "word").map(t => t.v);
          let name = words[0] === "sudo" ? words[1] : words[0];
          if (!name) return { handled: false };
          if (!KNOWN.has(name)) return { handled: false };
          if (name === "df" && words.some(w => w.startsWith("-") && !/^-[hT]*$/.test(w))) return { handled: false };
        }
      }

      let out = "", err = "";
      for (const pipeline of lists) {
        let stdin = "";
        for (let s = 0; s < pipeline.length; s++) {
          const res = this.runSimple(pipeline[s], stdin);
          stdin = res.out;
          err += res.err;
          if (s === pipeline.length - 1) out += res.out;
        }
      }
      return { handled: true, out, err };
    }

    runSimple(stage, stdin) {
      // Pull redirections out of the stage.
      const words = [];
      const redirs = [];
      for (let i = 0; i < stage.length; i++) {
        const tok = stage[i];
        if (tok.t === "op") {
          if (tok.v === "2>&1") { redirs.push({ op: "2>&1" }); continue; }
          const target = stage[i + 1];
          if (target && target.t === "word") { redirs.push({ op: tok.v, file: target.v }); i++; }
        } else words.push(tok);
      }

      // Expand globs.
      let argv = [];
      words.forEach(w => {
        if (w.glob) {
          const dir = this.lookup(this.abs(dirname(w.v.includes("/") ? w.v : "./" + w.v)), true);
          const re = globToRegex(basename(w.v));
          const matches = dir && dir.type === "dir"
            ? [...dir.children.keys()].filter(k => re.test(k) && (!k.startsWith(".") || basename(w.v).startsWith("."))).sort()
            : [];
          if (matches.length) {
            const prefix = w.v.includes("/") ? w.v.slice(0, w.v.lastIndexOf("/") + 1) : "";
            matches.forEach(m => argv.push(prefix + m));
          } else argv.push(w.v);
        } else argv.push(w.v);
      });

      if (argv[0] === "sudo") argv = argv.slice(1);
      const name = argv[0];
      const args = argv.slice(1);
      const flags = new Set();
      args.forEach(a => {
        if (/^-[A-Za-z]+$/.test(a)) a.slice(1).split("").forEach(f => flags.add(f));
        else if (a === "--all") flags.add("a");
        else if (a === "--recursive") flags.add("r");
        else if (a === "--parents") flags.add("p");
      });
      this.commandLog.push({ name, flags, args });

      const fn = this["cmd_" + name];
      let res = fn ? fn.call(this, args, flags, stdin) : { out: "", err: "" };
      let out = res.out || "", err = res.err || "";

      // Apply redirections.
      let errToOut = false;
      redirs.forEach(r => { if (r.op === "2>&1") errToOut = true; });
      redirs.forEach(r => {
        if (r.op === ">" || r.op === ">>") {
          err += this.writeTo(r.file, out + (errToOut ? err : ""), r.op === ">>");
          out = ""; if (errToOut) err = "";
        } else if (r.op === "&>") {
          err += this.writeTo(r.file, out + err, false); out = ""; err = "";
        } else if (r.op === "2>" || r.op === "2>>") {
          if (r.file === "/dev/null") err = "";
          else { this.writeTo(r.file, err, r.op === "2>>"); err = ""; }
        }
      });
      if (errToOut && !redirs.some(r => r.op === ">" || r.op === ">>")) { out += err; err = ""; }
      return { out, err };
    }

    writeTo(file, text, append) {
      if (file === "/dev/null") return "";
      const a = this.abs(file);
      let node = this.lookup(a, true);
      if (node && node.type === "dir") return `bash: ${file}: Is a directory\n`;
      if (!node) {
        node = this.createFile(a, "");
        if (!node) return `bash: ${file}: No such file or directory\n`;
      }
      if (append) {
        node.content = (node.content || "") + text;
        node.size = (node.size || 0) + text.length;
      } else {
        node.content = text;
        node.size = text.length;
        node.sizeDeclared = false;
      }
      node.mtime = nowStamp();
      return "";
    }

    // --- commands ---
    cmd_pwd() { return { out: this.cwd + "\n" }; }
    cmd_whoami() { return { out: DEFAULT_OWNER + "\n" }; }
    cmd_echo(args) {
      let nl = true;
      if (args[0] === "-n") { nl = false; args = args.slice(1); }
      return { out: args.join(" ") + (nl ? "\n" : "") };
    }

    cmd_cd(args) {
      let target = args[0];
      if (target === undefined || target === "~") target = HOME;
      let printed = "";
      if (target === "-") {
        if (!this.oldpwd) return { err: "bash: cd: OLDPWD not set\n" };
        target = this.oldpwd; printed = target + "\n";
      }
      const a = this.abs(target);
      const n = this.lookup(a, true);
      if (!n) return { err: `bash: cd: ${args[0]}: No such file or directory\n` };
      if (n.type !== "dir") return { err: `bash: cd: ${args[0]}: Not a directory\n` };
      this.oldpwd = this.cwd;
      this.cwd = a;
      return { out: printed };
    }

    cmd_ls(args, flags) {
      const paths = args.filter(a => !a.startsWith("-"));
      if (!paths.length) paths.push(".");
      let out = "", err = "";
      paths.forEach((p, idx) => {
        const a = this.abs(p);
        const n = this.lookup(a, true);
        if (!n) { err += `ls: cannot access '${p}': No such file or directory\n`; return; }
        if (paths.length > 1) out += (idx ? "\n" : "") + p + ":\n";
        const entries = [];
        if (n.type === "dir" && !flags.has("d")) {
          if (flags.has("a")) {
            entries.push({ label: ".", node: n });
            entries.push({ label: "..", node: this.lookup(dirname(a)) || n });
          }
          [...n.children.entries()]
            .filter(([k]) => flags.has("a") || !k.startsWith("."))
            .sort((x, y) => x[0].replace(/^\./, "").toLowerCase().localeCompare(y[0].replace(/^\./, "").toLowerCase()))
            .forEach(([k, v]) => entries.push({ label: k, node: v }));
        } else entries.push({ label: p, node: n });

        if (flags.has("l")) {
          const human = flags.has("h");
          const rows = entries.map(e => {
            const nd = e.node;
            const size = nd.type === "dir" ? 4096 : nd.type === "link" ? nd.target.length : (nd.size || 0);
            const label = nd.type === "link" ? `${e.label} -> ${nd.target}` : e.label;
            return [permString(nd), nd.type === "dir" ? String(2 + [...nd.children.values()].filter(c => c.type === "dir").length) : "1",
              nd.owner, nd.group, human ? formatSize(size).replace("B", "") : String(size), nd.mtime || "Oct 29 14:00", label];
          });
          const w = i => Math.max(0, ...rows.map(r => r[i].length));
          if (n.type === "dir") out += `total ${Math.max(0, entries.length * 4)}\n`;
          rows.forEach(r => {
            out += `${r[0]} ${r[1].padStart(w(1))} ${r[2].padEnd(w(2))} ${r[3].padEnd(w(3))} ${r[4].padStart(w(4))} ${r[5]} ${r[6]}\n`;
          });
        } else if (entries.length) {
          out += entries.map(e => e.label).join(flags.has("1") ? "\n" : "  ") + "\n";
        }
      });
      return { out, err };
    }

    cmd_cat(args, flags, stdin) {
      const files = args.filter(a => !a.startsWith("-"));
      if (!files.length) return { out: stdin };
      let out = "", err = "";
      files.forEach(f => {
        const n = this.lookup(this.abs(f), true);
        if (!n) err += `cat: ${f}: No such file or directory\n`;
        else if (n.type === "dir") err += `cat: ${f}: Is a directory\n`;
        else out += n.content !== null && n.content !== undefined ? n.content : `[sandbox: contents of ${f} are not simulated]\n`;
      });
      return { out, err };
    }

    cmd_mkdir(args, flags) {
      let err = "";
      args.filter(a => !a.startsWith("-")).forEach(p => {
        const a = this.abs(p);
        if (this.lookup(a)) { if (!flags.has("p")) err += `mkdir: cannot create directory '${p}': File exists\n`; return; }
        if (flags.has("p")) { this.mkdirp(a); return; }
        const parent = this.lookup(dirname(a), true);
        if (!parent || parent.type !== "dir") { err += `mkdir: cannot create directory '${p}': No such file or directory\n`; return; }
        parent.children.set(basename(a), { name: basename(a), type: "dir", mode: 0o755, owner: DEFAULT_OWNER, group: DEFAULT_GROUP, children: new Map(), mtime: nowStamp() });
      });
      return { err };
    }

    cmd_rmdir(args) {
      let err = "";
      args.filter(a => !a.startsWith("-")).forEach(p => {
        const a = this.abs(p);
        const n = this.lookup(a);
        if (!n) err += `rmdir: failed to remove '${p}': No such file or directory\n`;
        else if (n.type !== "dir") err += `rmdir: failed to remove '${p}': Not a directory\n`;
        else if (n.children.size) err += `rmdir: failed to remove '${p}': Directory not empty\n`;
        else this.lookup(dirname(a), true).children.delete(basename(a));
      });
      return { err };
    }

    cmd_touch(args) {
      let err = "";
      args.filter(a => !a.startsWith("-")).forEach(p => {
        const a = this.abs(p);
        const n = this.lookup(a, true);
        if (n) n.mtime = nowStamp();
        else if (!this.createFile(a, "")) err += `touch: cannot touch '${p}': No such file or directory\n`;
      });
      return { err };
    }

    cmd_rm(args, flags) {
      let err = "";
      const recursive = flags.has("r") || flags.has("R");
      args.filter(a => !a.startsWith("-")).forEach(p => {
        const a = this.abs(p);
        if (a === "/") { err += "rm: it is dangerous to operate recursively on '/' (use --no-preserve-root to override)\n"; return; }
        const n = this.lookup(a);
        if (!n) { if (!flags.has("f")) err += `rm: cannot remove '${p}': No such file or directory\n`; return; }
        if (n.type === "dir" && !recursive) { err += `rm: cannot remove '${p}': Is a directory\n`; return; }
        this.lookup(dirname(a), true).children.delete(basename(a));
        if (this.cwd === a || this.cwd.startsWith(a + "/")) this.cwd = dirname(a);
      });
      return { err };
    }

    copyNode(src, dstAbs) {
      const parent = this.lookup(dirname(dstAbs), true);
      const copy = clone(src);
      copy.name = basename(dstAbs);
      copy.mtime = nowStamp();
      parent.children.set(copy.name, copy);
    }

    cmd_cp(args, flags) {
      const paths = args.filter(a => !a.startsWith("-"));
      if (paths.length < 2) return { err: "cp: missing destination file operand\n" };
      const dest = paths.pop();
      const destAbs = this.abs(dest);
      const destNode = this.lookup(destAbs, true);
      let err = "";
      if (paths.length > 1 && !(destNode && destNode.type === "dir")) return { err: `cp: target '${dest}' is not a directory\n` };
      paths.forEach(p => {
        const n = this.lookup(this.abs(p), true);
        if (!n) { err += `cp: cannot stat '${p}': No such file or directory\n`; return; }
        if (n.type === "dir" && !(flags.has("r") || flags.has("R") || flags.has("a"))) { err += `cp: -r not specified; omitting directory '${p}'\n`; return; }
        const target = destNode && destNode.type === "dir" ? normalize(destAbs + "/" + basename(this.abs(p))) : destAbs;
        if (!this.lookup(dirname(target), true)) { err += `cp: cannot create regular file '${dest}': No such file or directory\n`; return; }
        this.copyNode(n, target);
      });
      return { err };
    }

    cmd_mv(args) {
      const paths = args.filter(a => !a.startsWith("-"));
      if (paths.length < 2) return { err: "mv: missing destination file operand\n" };
      const dest = paths.pop();
      const destAbs = this.abs(dest);
      const destNode = this.lookup(destAbs, true);
      let err = "";
      if (paths.length > 1 && !(destNode && destNode.type === "dir")) return { err: `mv: target '${dest}' is not a directory\n` };
      paths.forEach(p => {
        const srcAbs = this.abs(p);
        const n = this.lookup(srcAbs);
        if (!n) { err += `mv: cannot stat '${p}': No such file or directory\n`; return; }
        const target = destNode && destNode.type === "dir" ? normalize(destAbs + "/" + basename(srcAbs)) : destAbs;
        if (target === srcAbs) return;
        if (target.startsWith(srcAbs + "/")) { err += `mv: cannot move '${p}' to a subdirectory of itself\n`; return; }
        if (!this.lookup(dirname(target), true)) { err += `mv: cannot move '${p}' to '${dest}': No such file or directory\n`; return; }
        this.lookup(dirname(srcAbs), true).children.delete(basename(srcAbs));
        const moved = clone(n);
        moved.name = basename(target);
        this.lookup(dirname(target), true).children.set(moved.name, moved);
        if (this.cwd === srcAbs || this.cwd.startsWith(srcAbs + "/")) this.cwd = target + this.cwd.slice(srcAbs.length);
      });
      return { err };
    }

    cmd_ln(args, flags) {
      const paths = args.filter(a => !a.startsWith("-"));
      if (paths.length < 2) return { err: "ln: missing file operand\n" };
      const [target, linkName] = paths;
      let linkAbs = this.abs(linkName);
      const existing = this.lookup(linkAbs, true);
      if (existing && existing.type === "dir") linkAbs = normalize(linkAbs + "/" + basename(this.abs(target)));
      const clash = this.lookup(linkAbs);
      if (clash) {
        if (!flags.has("f")) return { err: `ln: failed to create ${flags.has("s") ? "symbolic " : "hard "}link '${linkName}': File exists\n` };
        this.lookup(dirname(linkAbs), true).children.delete(basename(linkAbs));
      }
      const parent = this.lookup(dirname(linkAbs), true);
      if (!parent) return { err: `ln: failed to create symbolic link '${linkName}': No such file or directory\n` };
      if (flags.has("s")) {
        parent.children.set(basename(linkAbs), { name: basename(linkAbs), type: "link", mode: 0o777, owner: DEFAULT_OWNER, group: DEFAULT_GROUP, target, mtime: nowStamp() });
      } else {
        const src = this.lookup(this.abs(target), true);
        if (!src) return { err: `ln: failed to access '${target}': No such file or directory\n` };
        this.copyNode(src, linkAbs);
      }
      return {};
    }

    applyMode(node, spec) {
      if (/^[0-7]{3,4}$/.test(spec)) { node.mode = parseInt(spec.slice(-3), 8); return true; }
      let mode = node.mode;
      for (const clause of spec.split(",")) {
        const m = /^([ugoa]*)([+\-=])([rwxX]*)$/.exec(clause);
        if (!m) return false;
        const who = m[1] || "a";
        let bits = 0;
        if (m[3].includes("r")) bits |= 4;
        if (m[3].includes("w")) bits |= 2;
        if (m[3].includes("x") || (m[3].includes("X") && node.type === "dir")) bits |= 1;
        [["u", 6], ["g", 3], ["o", 0]].forEach(([c, shift]) => {
          if (!(who.includes(c) || who.includes("a"))) return;
          if (m[2] === "+") mode |= bits << shift;
          else if (m[2] === "-") mode &= ~(bits << shift);
          else mode = (mode & ~(7 << shift)) | (bits << shift);
        });
      }
      node.mode = mode;
      return true;
    }

    walk(node, fn) { fn(node); if (node.children) node.children.forEach(c => this.walk(c, fn)); }

    cmd_chmod(args, flags) {
      const rest = args.filter(a => !(a.startsWith("-") && /^-[A-Za-z]+$/.test(a)));
      if (rest.length < 2) return { err: "chmod: missing operand\n" };
      const spec = rest[0];
      let err = "";
      rest.slice(1).forEach(p => {
        const n = this.lookup(this.abs(p), true);
        if (!n) { err += `chmod: cannot access '${p}': No such file or directory\n`; return; }
        const targets = [];
        if (flags.has("R")) this.walk(n, x => targets.push(x)); else targets.push(n);
        for (const t of targets) {
          if (!this.applyMode(t, spec)) { err += `chmod: invalid mode: '${spec}'\n`; return; }
        }
      });
      return { err };
    }

    cmd_chown(args, flags) {
      const rest = args.filter(a => !/^-[A-Za-z]+$/.test(a));
      if (rest.length < 2) return { err: "chown: missing operand\n" };
      const m = /^([^:.]*)(?:[:.]([^:.]*))?$/.exec(rest[0]);
      if (!m) return { err: `chown: invalid user: '${rest[0]}'\n` };
      let err = "";
      rest.slice(1).forEach(p => {
        const n = this.lookup(this.abs(p), true);
        if (!n) { err += `chown: cannot access '${p}': No such file or directory\n`; return; }
        const targets = [];
        if (flags.has("R")) this.walk(n, x => targets.push(x)); else targets.push(n);
        targets.forEach(t => { if (m[1]) t.owner = m[1]; if (m[2]) t.group = m[2]; });
      });
      return { err };
    }

    textLines(args, stdin, cmd) {
      const files = args.filter((a, i) => !a.startsWith("-") && !(i > 0 && args[i - 1] === "-n"));
      let text = stdin, err = "";
      if (files.length) {
        text = "";
        files.forEach(f => {
          const n = this.lookup(this.abs(f), true);
          if (!n) err += `${cmd}: ${f}: No such file or directory\n`;
          else if (n.type === "dir") err += `${cmd}: ${f}: Is a directory\n`;
          else text += n.content || "";
        });
      }
      return { text, err };
    }

    countArg(args, def) {
      const i = args.indexOf("-n");
      if (i !== -1 && args[i + 1]) return parseInt(args[i + 1], 10) || def;
      const m = args.map(a => /^-(\d+)$/.exec(a)).find(Boolean);
      return m ? parseInt(m[1], 10) : def;
    }

    cmd_head(args, flags, stdin) {
      const { text, err } = this.textLines(args, stdin, "head");
      const n = this.countArg(args, 10);
      return { out: text.split("\n").slice(0, n).join("\n") + (text ? "\n" : ""), err };
    }

    cmd_tail(args, flags, stdin) {
      const { text, err } = this.textLines(args, stdin, "tail");
      const n = this.countArg(args, 10);
      const lines = text.replace(/\n$/, "").split("\n");
      return { out: text ? lines.slice(-n).join("\n") + "\n" : "", err };
    }

    cmd_wc(args, flags, stdin) {
      const { text, err } = this.textLines(args, stdin, "wc");
      const lines = (text.match(/\n/g) || []).length;
      const words = text.split(/\s+/).filter(Boolean).length;
      if (flags.has("l")) return { out: lines + "\n", err };
      if (flags.has("w")) return { out: words + "\n", err };
      if (flags.has("c")) return { out: text.length + "\n", err };
      return { out: `${lines} ${words} ${text.length}\n`, err };
    }

    cmd_grep(args, flags, stdin) {
      const rest = args.filter(a => !(a.startsWith("-") && a.length > 1));
      if (!rest.length) return { err: "Usage: grep [OPTION]... PATTERNS [FILE]...\n" };
      let re;
      try { re = new RegExp(rest[0], flags.has("i") ? "i" : ""); } catch (e) { return { err: "grep: Invalid regular expression\n" }; }
      const files = rest.slice(1);
      const sources = files.length ? [] : [{ name: "", text: stdin }];
      let err = "";
      files.forEach(f => {
        const n = this.lookup(this.abs(f), true);
        if (!n) err += `grep: ${f}: No such file or directory\n`;
        else if (n.type === "dir") err += `grep: ${f}: Is a directory\n`;
        else sources.push({ name: f, text: n.content || "" });
      });
      let out = "";
      sources.forEach(src => {
        const lines = src.text.replace(/\n$/, "").split("\n");
        const hits = [];
        lines.forEach((l, i) => { if (src.text && re.test(l) !== flags.has("v")) hits.push({ l, i }); });
        if (flags.has("c")) out += (files.length > 1 ? src.name + ":" : "") + hits.length + "\n";
        else hits.forEach(h => { out += (files.length > 1 ? src.name + ":" : "") + (flags.has("n") ? (h.i + 1) + ":" : "") + h.l + "\n"; });
      });
      return { out, err };
    }

    cmd_sort(args, flags, stdin) {
      const { text, err } = this.textLines(args, stdin, "sort");
      let lines = text.replace(/\n$/, "").split("\n").filter((l, i, a) => text !== "" || a.length > 1);
      lines.sort(flags.has("n") ? (a, b) => parseFloat(a) - parseFloat(b) : (a, b) => (a < b ? -1 : a > b ? 1 : 0));
      if (flags.has("r")) lines.reverse();
      return { out: lines.length ? lines.join("\n") + "\n" : "", err };
    }

    cmd_uniq(args, flags, stdin) {
      const { text, err } = this.textLines(args, stdin, "uniq");
      const lines = text.replace(/\n$/, "").split("\n");
      const out = [];
      lines.forEach(l => {
        const last = out[out.length - 1];
        if (last && last.l === l) last.c++; else out.push({ l, c: 1 });
      });
      return { out: text ? out.map(o => (flags.has("c") ? String(o.c).padStart(7) + " " : "") + o.l).join("\n") + "\n" : "", err };
    }

    cmd_tee(args, flags, stdin) {
      let err = "";
      args.filter(a => !a.startsWith("-")).forEach(f => { err += this.writeTo(f, stdin, flags.has("a")); });
      return { out: stdin, err };
    }

    // `df` is read-only and not tied to the virtual filesystem, so it returns fixed sample output.
    cmd_df() {
      return { out: "Filesystem      Size  Used Avail Use% Mounted on\n/dev/root        29G  8.2G   21G  29% /\ntmpfs           2.0G     0  2.0G   0% /dev/shm\n" };
    }

    // --- visualizer bridge ---
    pathSignatures() {
      const sig = new Map();
      const visit = (node, path) => {
        sig.set(path, [node.type, node.mode, node.owner, node.group, node.size || 0, node.target || "", node.mtime].join("|"));
        if (node.children) node.children.forEach((c, k) => visit(c, normalize(path + "/" + k)));
      };
      visit(this.root, "/");
      return sig;
    }

    snapshotSignature() { this.lastSig = this.pathSignatures(); }

    // Cheap fingerprint of everything a command can change (filesystem + current directory).
    stateKey() { return this.cwd + "\n" + [...this.pathSignatures().entries()].join("\n"); }

    // Build a tree in the scenario `initialFs` format, flagging nodes changed since the last call.
    toTree() {
      while (!(this.cwd === this.viewRoot || this.cwd.startsWith(this.viewRoot === "/" ? "/" : this.viewRoot + "/"))) {
        this.viewRoot = dirname(this.viewRoot);
      }
      const sig = this.pathSignatures();
      const prev = this.lastSig || sig;
      const build = (node, path, isTop) => {
        const out = { name: isTop ? path : node.name, type: node.type === "dir" ? "dir" : "file" };
        if (node.type === "link") { out.name = `${node.name} -> ${node.target}`; out.size = node.target.length + "B"; }
        else if (node.type === "file") out.size = formatSize(node.size || 0);
        out.perm = permString(node);
        if (node.owner !== DEFAULT_OWNER || node.group !== DEFAULT_GROUP) out.owner = `${node.owner}:${node.group}`;
        if (path === this.cwd) out.isCurrent = true;
        if (prev.get(path) !== sig.get(path)) out.changed = true;
        if (node.type === "dir") {
          out.children = [...node.children.entries()]
            .sort((a, b) => (a[1].type === "dir") === (b[1].type === "dir") ? a[0].localeCompare(b[0]) : (a[1].type === "dir" ? -1 : 1))
            .map(([k, v]) => build(v, normalize(path + "/" + k), false));
        }
        return out;
      };
      const start = this.lookup(this.viewRoot);
      const tree = build(start, this.viewRoot, true);
      this.lastSig = sig;
      return tree;
    }
  }

  root.VirtualShell = VirtualShell;
  if (typeof module !== "undefined" && module.exports) module.exports = { VirtualShell };
})(typeof window !== "undefined" ? window : globalThis);

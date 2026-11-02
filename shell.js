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
    "ln", "echo", "whoami", "head", "tail", "wc", "grep", "sort", "uniq", "tee", "df",
    "find", "awk", "sed", "cut", "stat", "namei", "tar", "gzip", "gunzip", "sudo"
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
      const ch = p[i + 1];
      if (ch !== "-" && ch !== "S" && ch !== "T") mode |= 1 << (8 - i);
    }
    if (p[3] === "s" || p[3] === "S") mode |= 0o4000;
    if (p[6] === "s" || p[6] === "S") mode |= 0o2000;
    if (p[9] === "t" || p[9] === "T") mode |= 0o1000;
    return mode;
  }

  function permString(node) {
    const t = node.type === "dir" ? "d" : node.type === "link" ? "l" : "-";
    const m = node.mode;
    let s = t;
    "rwxrwxrwx".split("").forEach((ch, i) => { s += (m & (1 << (8 - i))) ? ch : "-"; });
    const chars = s.split("");
    if (m & 0o4000) chars[3] = (m & 0o100) ? "s" : "S";
    if (m & 0o2000) chars[6] = (m & 0o010) ? "s" : "S";
    if (m & 0o1000) chars[9] = (m & 0o001) ? "t" : "T";
    return chars.join("");
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
    const ops = ["2>>", "2>&1", "&>", "2>", ">>", ">", "&&", "||", "<<", "<", ";", "|", "&"];
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
    // ${VAR}, ${VAR:-default}, $VAR and the specials $? $$ $# $@ $* $0-$9
    return s.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-([^}]*))?\}|\$([A-Za-z_][A-Za-z0-9_]*|\?|\$|#|@|\*|[0-9])/g, (m, braced, dflt, plain) => {
      const name = braced || plain;
      const v = name in env ? env[name] : "";
      return (v === "" && dflt !== undefined) ? dflt : v;
    });
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
      this.mkdirp(HOME);   // the user's home always exists, so cd ~ works wherever a scenario starts
      this.oldpwd = null;
      this.commandLog = [];
      this.lastSig = null;
      this.setup = setup;
      this.vars = {};
      this.lastCode = 0;
      this.positional = ["bash"];
      this.pipefail = false;
      this.jobs = [];
      this.depth = 0;
      this.capturing = 0;
      this.asRoot = false;
      this.pipedOut = false;
      this.pendingErr = "";
      this.sys = null;
      this.follow = null;
      this.hits = new Set();
      this.lastStat = null; this.lastNamei = null; this.lastArchive = null;

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
        if (!n) { this.mkdirp(dirname(abs)); n = this.createFile(abs); }
        if (n) { n.content = content; if (!n.sizeDeclared) n.size = content.length; delete n.age; }   // seeded files already existed
      });
      Object.entries(setup.nodes || {}).forEach(([np, spec]) => this.seedNode(np, spec));
      this.initEnv(setup.env);
      if (setup.system && root.SystemState) { this.sys = new root.SystemState(setup.system); this.sys.syncAccountFiles(this); }
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
        if (!isDir && !isLink) { n.size = parseSize(child.size); n.sizeDeclared = !!child.size; if (typeof child.content === "string") { n.content = child.content; if (!n.sizeDeclared) n.size = child.content.length; } }
        this.lookup(absPath).children.set(name, n);
        if (child.isCurrent) this.cwd = childPath;
        if (isDir) this.importNode(child, childPath);
      });
    }

    // Seed any node with the properties a scenario needs: {dir|target|archive, owner, group, mode, size, content}
    seedNode(p, spec) {
      const a = normalize(p);
      let n;
      const existing = this.lookup(a);
      if (spec.dir) { n = this.mkdirp(a); }
      else if (existing && existing.type === "file" && spec.target === undefined) { n = existing; if (spec.content !== undefined) { n.content = spec.content; if (!n.sizeDeclared) n.size = spec.content.length; } }
      else {
        this.mkdirp(dirname(a));
        const parent = this.lookup(dirname(a));
        n = { name: basename(a), type: spec.target !== undefined ? "link" : "file", mode: 0o644, owner: DEFAULT_OWNER, group: DEFAULT_GROUP, content: spec.content === undefined ? null : spec.content, size: 0, mtime: "Oct 29 14:00" };
        if (spec.target !== undefined) { n.target = spec.target; n.mode = 0o777; }
        parent.children.set(n.name, n);
      }
      if (spec.age !== undefined) n.age = spec.age;
      if (spec.owner) n.owner = spec.owner;
      if (spec.group) n.group = spec.group;
      if (spec.mode !== undefined) n.mode = spec.mode;
      if (spec.content !== undefined && n.type === "file" && !n.sizeDeclared) n.size = spec.content.length;
      if (spec.size) { n.size = parseSize(spec.size); n.sizeDeclared = true; }
      if (spec.archive) {
        n.archive = { z: !!spec.archive.z, zip: !!spec.archive.zip, entries: spec.archive.entries.map(e => ({ path: e.path, isDir: !!e.isDir, node: e.isDir ? null : { content: e.content === undefined ? null : e.content, size: parseSize(e.size) || (e.content || "").length, mode: 0o644, owner: DEFAULT_OWNER, group: DEFAULT_GROUP } })) };
      }
      return n;
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
        name: basename(absPath), type: "file", mode: 0o666 & ~(this.umaskVal === undefined ? 0o022 : this.umaskVal), owner: DEFAULT_OWNER, group: DEFAULT_GROUP,
        content: content || "", size: (content || "").length, mtime: nowStamp(), age: 0
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
    // ---- shell variables ----
    initEnv(extra) {
      const defaults = { HOME, USER: DEFAULT_OWNER, LOGNAME: DEFAULT_OWNER, SHELL: "/bin/bash", LANG: "en_US.UTF-8", TERM: "xterm-256color",
        PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" };
      Object.entries(defaults).forEach(([k, v]) => { this.vars[k] = { value: v, exported: true }; });
      this.vars.HOSTNAME = { value: "ip-172-31-42-12", exported: false };
      Object.entries(extra || {}).forEach(([k, v]) => { this.vars[k] = typeof v === "object" ? { value: v.value, exported: !!v.exported } : { value: String(v), exported: true }; });
    }

    setVar(name, value, exported) {
      const cur = this.vars[name];
      this.vars[name] = { value: String(value), exported: exported !== undefined ? exported : (cur ? cur.exported : !!(this.opts && this.opts.a)) };
    }

    envObject() {
      const o = {};
      Object.entries(this.vars).forEach(([k, v]) => { o[k] = v.value; });
      o.PWD = this.cwd;
      o["?"] = String(this.lastCode || 0);
      o["$"] = "2300";
      this.positional.forEach((v, i) => { o[String(i)] = v; });
      o["#"] = String(Math.max(0, this.positional.length - 1));
      o["@"] = this.positional.slice(1).join(" ");
      o["*"] = o["@"];
      return o;
    }

    // ---- $(...), backticks and $((...)) ----
    substitute(line) {
      let out = "", i = 0, q = null;
      while (i < line.length) {
        const c = line[i];
        if (q === "'") { out += c; if (c === "'") q = null; i++; continue; }
        if (c === "'" && q !== '"') { q = "'"; out += c; i++; continue; }
        if (c === '"') { q = q === '"' ? null : '"'; out += c; i++; continue; }
        if (c === "$" && line[i + 1] === "(") {
          const arith = line[i + 2] === "(";
          let depth = 0, j = i + 1;
          for (; j < line.length; j++) { if (line[j] === "(") depth++; else if (line[j] === ")") { depth--; if (depth === 0) break; } }
          if (depth !== 0) throw new Error("unterminated command substitution");
          out += arith ? String(this.arith(line.slice(i + 3, j - 1))) : this.captureCmd(line.slice(i + 2, j));
          i = j + 1; continue;
        }
        if (c === "`") {
          const j = line.indexOf("`", i + 1);
          if (j < 0) throw new Error("unterminated backtick");
          out += this.captureCmd(line.slice(i + 1, j));
          i = j + 1; continue;
        }
        out += c; i++;
      }
      return out;
    }

    captureCmd(inner) {
      const keep = { le: this.lastExec, hits: this.hits, follow: this.follow };
      this.capturing++;
      let r;
      try { r = this.exec(inner); } finally { this.capturing--; }
      this.lastExec = keep.le; this.hits = keep.hits; this.follow = keep.follow;
      if (r && r.err) this.pendingErr += r.err;
      return ((r && r.out) || "").replace(/\n+$/, "");
    }

    // small arithmetic evaluator for $(( )) and (( )): + - * / % ** parentheses, comparisons, && ||
    arith(expr) {
      const env = this.envObject();
      const src = expr.replace(/\$?([A-Za-z_][A-Za-z0-9_]*)/g, (m, n) => (n in env && /^-?\d+$/.test(env[n]) ? env[n] : "0"));
      const toks = src.match(/\d+|\*\*|<=|>=|==|!=|&&|\|\||[-+*\/%()<>!]/g) || [];
      let pos = 0;
      const peek = () => toks[pos], next = () => toks[pos++];
      const prim = () => { const t = next(); if (t === "(") { const v = orr(); next(); return v; } if (t === "-") return -prim(); if (t === "+") return prim(); if (t === "!") return prim() ? 0 : 1; return parseInt(t, 10) || 0; };
      const pow = () => { let v = prim(); while (peek() === "**") { next(); v = Math.pow(v, prim()); } return v; };
      const mul = () => { let v = pow(); while (["*", "/", "%"].includes(peek())) { const o = next(), r = pow(); v = o === "*" ? v * r : o === "/" ? (r ? Math.trunc(v / r) : 0) : (r ? v % r : 0); } return v; };
      const add = () => { let v = mul(); while (["+", "-"].includes(peek())) { const o = next(), r = mul(); v = o === "+" ? v + r : v - r; } return v; };
      const cmp = () => { let v = add(); while (["<", ">", "<=", ">=", "==", "!="].includes(peek())) { const o = next(), r = add(); v = ({ "<": v < r, ">": v > r, "<=": v <= r, ">=": v >= r, "==": v === r, "!=": v !== r })[o] ? 1 : 0; } return v; };
      const andd = () => { let v = cmp(); while (peek() === "&&") { next(); const r = cmp(); v = v && r ? 1 : 0; } return v; };
      const orr = () => { let v = andd(); while (peek() === "||") { next(); const r = andd(); v = v || r ? 1 : 0; } return v; };
      return orr();
    }

    // Returns { handled, out, err, code }. handled=false means the line uses something this shell doesn't simulate;
    // in that case nothing is executed or changed.
    exec(line) {
      if (this.scriptHook && this.scriptHook.isCompound(line)) return this.scriptHook.run(this, line);
      this.depth++;
      try { return this.execLine(line); } finally { this.depth--; }
    }

    // Split a line into lists joined by ; && || (and newlines), each a pipeline of stage texts, without expanding anything yet:
    // variables, $? and $(...) must be expanded when each command runs, not before the earlier ones have.
    splitTop(line) {
      const lists = [{ joiner: ";", stages: [""] }];
      let q = null, i = 0, background = false, depth = 0;
      const cur = () => lists[lists.length - 1];
      const add = ch => { const st = cur().stages; st[st.length - 1] += ch; };
      while (i < line.length) {
        const c = line[i];
        if (q) {
          add(c);
          if (c === "\\" && q === '"' && i + 1 < line.length) { add(line[i + 1]); i += 2; continue; }
          if (c === q) q = null;
          i++; continue;
        }
        if (c === "\\" && i + 1 < line.length) { add(c); add(line[i + 1]); i += 2; continue; }
        if (c === "#" && (i === 0 || /\s/.test(line[i - 1]))) { while (i < line.length && line[i] !== "\n") i++; continue; }   // comment (also the #! line)
        if (c === "'" || c === '"' || c === "`") { q = c; add(c); i++; continue; }
        if (c === "$" && line[i + 1] === "(") {
          let d = 0, j = i + 1;
          for (; j < line.length; j++) { if (line[j] === "(") d++; else if (line[j] === ")") { d--; if (d === 0) break; } }
          if (d !== 0) return { error: "unterminated command substitution" };
          for (const ch of line.slice(i, j + 1)) add(ch);
          i = j + 1; continue;
        }
        if (c === "(") { depth++; add(c); i++; continue; }
        if (c === ")") { depth = Math.max(0, depth - 1); add(c); i++; continue; }
        if (depth === 0 && (c === ";" || c === "\n")) { lists.push({ joiner: ";", stages: [""] }); i++; continue; }
        if (c === "&" && depth === 0) {
          if (line[i + 1] === "&") { lists.push({ joiner: "&&", stages: [""] }); i += 2; continue; }
          if (line[i - 1] === ">" || line[i + 1] === ">" || line[i - 1] === "<") { add(c); i++; continue; }   // 2>&1, &>, >&
          cur().bg = true;
          if (line.slice(i + 1).trim() === "") { background = true; i++; continue; }
          lists.push({ joiner: ";", stages: [""] }); i++; continue;
        }
        if (c === "|" && depth === 0) {
          if (line[i + 1] === "|") { lists.push({ joiner: "||", stages: [""] }); i += 2; continue; }
          cur().stages.push(""); i++; continue;
        }
        add(c); i++;
      }
      if (q) return { error: "unterminated quote" };
      return { lists: lists.filter(L => L.stages.some(t => t.trim())), background };
    }

    // for the pre-check only: replace $(...) / backticks with a placeholder so nothing runs yet
    dryText(t) {
      let out = "", i = 0, q = null;
      while (i < t.length) {
        const c = t[i];
        if (q === "'") { out += c; if (c === "'") q = null; i++; continue; }
        if (c === "'" && q !== '"') { q = "'"; out += c; i++; continue; }
        if (c === '"') { q = q === '"' ? null : '"'; out += c; i++; continue; }
        if (c === "$" && t[i + 1] === "(") { let d = 0, j = i + 1; for (; j < t.length; j++) { if (t[j] === "(") d++; else if (t[j] === ")") { d--; if (d === 0) break; } } out += "X"; i = j + 1; continue; }
        if (c === "`") { const j = t.indexOf("`", i + 1); out += "X"; i = j < 0 ? t.length : j + 1; continue; }
        out += c; i++;
      }
      return out;
    }

    execLine(line) {
      const parsed = this.splitTop(line);
      if (parsed.error) return { handled: true, out: "", err: "bash: syntax error: " + parsed.error + "\n", code: 2 };
      const lists = parsed.lists, background = parsed.background;
      if (!lists.length) return { handled: true, out: "", err: "", code: 0 };

      // Pre-check that every command is one we simulate, so a partly-unknown line changes nothing.
      for (const L of lists) {
        for (const stageText of L.stages) {
          if (stageText.trim().startsWith("(") && stageText.trim().endsWith(")")) continue;   // ( group ): checked when it runs
          let toks;
          try { toks = tokenize(this.dryText(stageText), this.envObject()); } catch (e) { return { handled: true, out: "", err: "bash: syntax error: " + e.message + "\n", code: 2 }; }
          let words = toks.filter(t => t.t === "word").map(t => t.v);
          while (words.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[0])) words = words.slice(1);
          if (!words.length) { if (!toks.length) return { handled: false }; continue; }   // pure assignment
          const name = words[0] === "sudo" && !(words[1] || "").startsWith("-") ? words[1] : words[0];
          if (!name) return { handled: false };
          if (!KNOWN.has(name) && !(this.sys && this.sys.handles(name)) && !name.includes("/")) return { handled: false };
          if (name === "df" && !(this.sys && this.sys.handles("df")) && words.some(w => w.startsWith("-") && !/^-[hT]*$/.test(w))) return { handled: false };
          if (!this.supported(name, words.slice(words.indexOf(name) + 1))) return { handled: false };
        }
      }

      let out = "", err = "";
      const logStart = this.commandLog.length;
      const sysBefore = this.depth === 1 && this.sys ? this.sys.beginExec() : null;
      if (this.depth === 1) {
        this.follow = null;
        this.hits = new Set(); this.lastStat = null; this.lastNamei = null; this.lastArchive = null;
        if (this.sys) this.sys.followRequest = null;
      }
      let prev = this.lastCode || 0;
      let exiting = null;
      for (const L of lists) {
        if (L.joiner === "&&" && prev !== 0) continue;
        if (L.joiner === "||" && prev === 0) continue;
        let stdin = "", codes = [];
        for (let st = 0; st < L.stages.length; st++) {
          const grouped = L.stages[st].trim();
          if (grouped.startsWith("(") && grouped.endsWith(")")) {   // ( cmd1 ; cmd2 ) | next : a group whose combined output feeds the pipe
            const r = this.exec(grouped.slice(1, -1));
            stdin = r.out || ""; err += r.err || ""; codes.push(r.code || 0);
            if (st === L.stages.length - 1) out += stdin;
            this.lastCode = r.code || 0;
            continue;
          }
          let toks;
          try { toks = tokenize(this.substitute(L.stages[st]), this.envObject()); }
          catch (e) { err += "bash: syntax error: " + e.message + "\n"; codes.push(2); continue; }
          const res = this.runSimple(toks, stdin, { piped: st < L.stages.length - 1 });
          stdin = res.out;
          err += res.err;
          codes.push(res.code);
          if (res.exit !== undefined) exiting = res.exit;
          if (st === L.stages.length - 1) out += res.out;
          this.lastCode = res.code;
        }
        prev = this.pipefail ? (codes.slice().reverse().find(c => c !== 0) || 0) : codes[codes.length - 1];
        this.lastCode = prev;
        if (L.bg) {
          const id = this.jobs.length ? Math.max(...this.jobs.map(j => j.id)) + 1 : 1;
          const job = { id, pid: 3100 + id * 7, cmd: L.stages.map(t => t.trim()).join(" | "), state: "Running" };
          this.jobs.push(job);
          if (this.syncJobProcess) this.syncJobProcess(job, false);
          out += "[" + id + "] " + job.pid + "\n";
          this.lastCode = 0; prev = 0;
        }
        if (exiting !== null) break;
      }

      if (this.depth === 1 && this.sys) {
        this.sys.finishExec(sysBefore);
        if (this.sys.followRequest) {
          const unit = this.sys.followRequest.unit;
          this.follow = { kind: "journal", unit, next: () => this.sys.liveEntry(unit) };
        }
      }
      if (this.depth === 1 && this.pendingErr) { err = this.pendingErr + err; this.pendingErr = ""; }
      if (this.depth === 1) this.lastExec = { line, cmds: this.commandLog.slice(logStart), out, err };
      return { handled: true, out, err, code: prev, exit: exiting === null ? undefined : exiting };
    }

    // Syntax each text tool understands; anything else is left to the scenario's own matcher.
    supported(name, args) {
      if (VirtualShell.supports[name]) return VirtualShell.supports[name].call(this, args);
      if (this.sys && this.sys.handles(name)) return this.sys.supported(name, args);
      if (name === "awk") {
        const rest = [];
        for (let i = 0; i < args.length; i++) {
          if (args[i] === "-F") { i++; continue; }
          if (args[i].startsWith("-F")) continue;
          rest.push(args[i]);
        }
        return rest.length > 0 && /^\{\s*print(\s+[^}]*)?\}$/.test(rest[0]);
      }
      if (name === "sed") {
        const expr = args.find(a => !a.startsWith("-"));
        return !!expr && /^s(.)(.*?)\1(.*?)\1[gI]*$/.test(expr);
      }
      if (name === "cut") return args.some(a => a.startsWith("-d")) && args.some(a => a.startsWith("-f"));
      if (name === "find") {
        const preds = ["-name", "-iname", "-type", "-size", "-maxdepth", "-print"];
        return args.every((a, i) => !a.startsWith("-") || preds.includes(a));
      }
      return true;
    }

    runSimple(stage, stdin, opts) {
      // Pull redirections out of the stage.
      const words = [];
      const redirs = [];
      for (let i = 0; i < stage.length; i++) {
        const tok = stage[i];
        if (tok.t === "op") {
          if (tok.v === "2>&1") { redirs.push({ op: "2>&1" }); continue; }
          if (tok.v === "<<") { i++; continue; }
          const target = stage[i + 1];
          if (target && target.t === "word") { redirs.push({ op: tok.v, file: target.v }); i++; }
        } else words.push(tok);
      }

      // Expand globs.
      let argv = [];
      words.forEach(w => {
        if (w.glob) {
          const full = this.abs(w.v);
          const dir = this.lookup(dirname(full), true);
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

      // leading VAR=value words: plain assignment, or a prefix that applies to this one command
      const assigns = [];
      while (argv.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(argv[0])) assigns.push(argv.shift());
      if (!argv.length) {
        assigns.forEach(a => { const eq = a.indexOf("="); this.setVar(a.slice(0, eq), a.slice(eq + 1)); });
        return { out: "", err: "", code: 0 };
      }
      const sudoed = argv[0] === "sudo" && !(argv[1] || "").startsWith("-");
      const restore = assigns.map(a => { const eq = a.indexOf("="), n = a.slice(0, eq); const old = this.vars[n]; this.setVar(n, a.slice(eq + 1), true); return [n, old]; });
      if (sudoed) argv = argv.slice(1);
      this.asRoot = sudoed;
      const name = argv[0];
      const args = argv.slice(1);
      const flags = new Set();
      args.forEach(a => {
        if (/^-[A-Za-z]+$/.test(a)) a.slice(1).split("").forEach(f => flags.add(f));
        else if (a === "--all") flags.add("a");
        else if (a === "--recursive") flags.add("r");
        else if (a === "--parents") flags.add("p");
        else if (a === "--ignore-case") flags.add("i");
        else if (a === "--invert-match") flags.add("v");
        else if (a === "--line-number") flags.add("n");
        else if (a === "--count") flags.add("c");
      });
      this.commandLog.push({ name, flags, args });

      this.pipedOut = !!(opts && opts.piped) || this.capturing > 0 || redirs.some(r => r.op === ">" || r.op === ">>" || r.op === "&>");
      const fn = this["cmd_" + name];
      let res;
      const inRedir = redirs.find(r => r.op === "<");
      if (inRedir) {
        const n = this.lookup(this.abs(inRedir.file), true);
        if (!n || n.type !== "file") { restore.forEach(([n2, old]) => { if (old) this.vars[n2] = old; else delete this.vars[n2]; }); return { out: "", err: "bash: " + inRedir.file + ": No such file or directory\n", code: 1 }; }
        stdin = n.content === null ? "" : n.content;
      }
      const hook = VirtualShell.intercept && VirtualShell.intercept[name];
      const pre = hook ? hook.call(this, args, flags, stdin) : null;
      if (pre) res = pre;
      else if (name === "id" && !(this.sys && this.sys.handles("id"))) res = { out: this.asRoot ? "uid=0(root) gid=0(root) groups=0(root)\n" : "uid=1000(ubuntu) gid=1000(ubuntu) groups=1000(ubuntu)\n" };
      else if (this.sys && this.sys.handles(name)) res = this.sys.command(name).call(this.sys, args, flags, stdin, this);
      else if (fn) res = fn.call(this, args, flags, stdin);
      else if (name.includes("/") || name.startsWith(".")) res = this.execPath(name, args);
      else res = { out: "", err: "" };
      restore.forEach(([n2, old]) => { if (old) this.vars[n2] = old; else delete this.vars[n2]; });
      const code = res.code !== undefined ? res.code : (res.err ? 1 : 0);
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
      return { out, err, code, exit: res.exit };
    }

    // ./deploy.sh or /opt/app/run.sh: the file must exist and have the execute bit, exactly like a real shell
    execPath(name, args) {
      const n = this.lookup(this.abs(name), true);
      if (!n) return { err: "bash: " + name + ": No such file or directory\n", code: 127 };
      if (n.type === "dir") return { err: "bash: " + name + ": Is a directory\n", code: 126 };
      if (!(n.mode & 0o111)) return { err: "bash: " + name + ": Permission denied\n", code: 126 };
      return this.runScriptFile(name, args);
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
      node.age = 0;
      return "";
    }

    // --- commands ---
    cmd_sudo(args) {
      if (args[0] === "-l") return { out: "Matching Defaults entries for ubuntu on ip-172-31-42-12:\n    env_reset, mail_badpass, secure_path=/usr/local/sbin\\:/usr/local/bin\\:/usr/sbin\\:/usr/bin\\:/sbin\\:/bin\n\nUser ubuntu may run the following commands on ip-172-31-42-12:\n    (ALL : ALL) ALL\n    (ALL) NOPASSWD: ALL\n" };
      if (args[0] === "-v") return { out: "" };
      return { out: "", err: "sudo: a command is required\n", code: 1 };
    }

    cmd_pwd() { return { out: this.cwd + "\n" }; }
    cmd_whoami() { return { out: (this.asRoot ? "root" : DEFAULT_OWNER) + "\n" }; }
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
          out += entries.map(e => e.label).join(flags.has("1") || this.pipedOut ? "\n" : "  ") + "\n";
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
        parent.children.set(basename(a), { name: basename(a), type: "dir", mode: 0o777 & ~(this.umaskVal === undefined ? 0o022 : this.umaskVal), owner: DEFAULT_OWNER, group: DEFAULT_GROUP, children: new Map(), mtime: nowStamp(), age: 0 });
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
        if (n) { n.mtime = nowStamp(); n.age = 0; }
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
      if (/^[0-7]{3,4}$/.test(spec)) { node.mode = parseInt(spec, 8) & 0o7777; return true; }
      let mode = node.mode;
      for (const clause of spec.split(",")) {
        const m = /^([ugoa]*)([+\-=])([rwxXst]*)$/.exec(clause);
        if (!m) return false;
        const who = m[1] || "a";
        if (m[3].includes("s") || m[3].includes("t")) {
          const sp = (who.includes("u") || who.includes("a") ? (m[3].includes("s") ? 0o4000 : 0) : 0) | (who.includes("g") || who.includes("a") ? (m[3].includes("s") ? 0o2000 : 0) : 0) | (m[3].includes("t") ? 0o1000 : 0);
          if (m[2] === "+") mode |= sp; else if (m[2] === "-") mode &= ~sp; else mode |= sp;
        }
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
      let out = text ? lines.slice(-n).join("\n") + "\n" : "";
      if (flags.has("f") || flags.has("F")) {
        out += "[sandbox: following the file for new lines. Press Ctrl+C to stop]\n";
        const target = args.filter(a => !a.startsWith("-") && !/^\d+$/.test(a))[0];
        const node = target && this.lookup(this.abs(target), true);
        if (node && node.type === "file") {
          let tick = 0;
          this.follow = {
            kind: "file", next: () => {
              const pool = (node.content || "").replace(/\n$/, "").split("\n").filter(l => l && !/ERROR/.test(l));
              const base = pool.length ? pool[tick % pool.length] : "heartbeat ok";
              tick++;
              const line = base.replace(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:)(\d{2})/, (m, a) => a + String((tick * 3) % 60).padStart(2, "0"));
              node.content = (node.content || "") + line + "\n";
              node.size = (node.size || 0) + line.length + 1;
              return line;
            }
          };
        }
      }
      return { out, err };
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
      const recursive = flags.has("r") || flags.has("R");
      let re;
      try { re = new RegExp(rest[0], flags.has("i") ? "i" : ""); } catch (e) { return { err: "grep: Invalid regular expression\n" }; }
      let files = rest.slice(1);
      const bareRoot = recursive && !files.length; // plain "grep -r pat" prints paths without "./"
      if (bareRoot) files = ["."];
      const sources = files.length ? [] : [{ name: "", text: stdin }];
      let err = "";
      files.forEach(f => {
        const n = this.lookup(this.abs(f), true);
        if (!n) { err += `grep: ${f}: No such file or directory\n`; return; }
        if (n.type === "dir") {
          if (!recursive) { err += `grep: ${f}: Is a directory\n`; return; }
          const walk = (node, rel) => {
            [...node.children.entries()].sort((a, b) => a[0].localeCompare(b[0])).forEach(([k, v]) => {
              const path = rel ? rel + "/" + k : k;
              if (v.type === "dir") walk(v, path);
              else if (v.type === "file") sources.push({ name: bareRoot ? path : f.replace(/\/$/, "") + "/" + path, text: v.content || "" });
            });
          };
          walk(n, "");
        } else sources.push({ name: f, text: n.content || "" });
      });
      const multi = recursive || files.length > 1;
      let out = "";
      sources.forEach(src => {
        const lines = src.text.replace(/\n$/, "").split("\n");
        const hits = [];
        lines.forEach((l, i) => { if (src.text && re.test(l) !== flags.has("v")) hits.push({ l, i }); });
        if (hits.length && src.name) this.hits.add(this.abs(src.name));
        if (flags.has("c")) out += (multi ? src.name + ":" : "") + hits.length + "\n";
        else hits.forEach(h => { out += (multi ? src.name + ":" : "") + (flags.has("n") ? (h.i + 1) + ":" : "") + h.l + "\n"; });
      });
      return { out, err, code: err ? 2 : (out ? 0 : 1) };
    }

    cmd_sort(args, flags, stdin) {
      const { text, err } = this.textLines(args, stdin, "sort");
      let lines = text.replace(/\n$/, "").split("\n").filter((l, i, a) => text !== "" || a.length > 1);
      const human = t => { const m = /^\s*([\d.]+)\s*([KMGT]?)/i.exec(t); return m ? parseFloat(m[1]) * ({ "": 1, K: 1024, M: 1048576, G: 1073741824, T: 1099511627776 })[m[2].toUpperCase()] : 0; };
      lines.sort(flags.has("h") ? (a, b) => human(a) - human(b) : flags.has("n") ? (a, b) => parseFloat(a) - parseFloat(b) : (a, b) => (a < b ? -1 : a > b ? 1 : 0));
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

    cmd_find(args) {
      const paths = [];
      let i = 0;
      while (i < args.length && !args[i].startsWith("-")) paths.push(args[i++]);
      if (!paths.length) paths.push(".");
      const want = {};
      for (; i < args.length; i++) {
        const a = args[i];
        if (a === "-print") continue;
        want[a] = args[++i];
      }
      const nameRe = want["-name"] ? globToRegex(want["-name"]) : want["-iname"] ? new RegExp(globToRegex(want["-iname"]).source, "i") : null;
      let sizeTest = null;
      if (want["-size"]) {
        const m = /^([+-]?)(\d+)([cwbkKMG]?)$/.exec(want["-size"]);
        if (m) {
          const unit = { c: 1, w: 2, b: 512, k: 1024, K: 1024, M: 1048576, G: 1073741824 }[m[3] || "b"];
          const limit = parseInt(m[2], 10) * unit;
          sizeTest = sz => (m[1] === "+" ? sz > limit : m[1] === "-" ? sz < limit : Math.ceil(sz / unit) === parseInt(m[2], 10));
        }
      }
      const maxDepth = want["-maxdepth"] !== undefined ? parseInt(want["-maxdepth"], 10) : Infinity;
      let out = "", err = "";
      paths.forEach(p => {
        const start = this.lookup(this.abs(p), true);
        if (!start) { err += "find: '" + p + "': No such file or directory\n"; return; }
        const visit = (node, shown, depth) => {
          const typeOk = !want["-type"] || (want["-type"] === "d" ? node.type === "dir" : want["-type"] === "l" ? node.type === "link" : node.type === "file");
          const nameOk = !nameRe || nameRe.test(shown.slice(shown.lastIndexOf("/") + 1));
          const sizeOk = !sizeTest || (node.type === "file" && sizeTest(node.size || 0));
          if (typeOk && nameOk && sizeOk) { out += shown + "\n"; this.hits.add(this.abs(shown)); }
          if (node.type === "dir" && depth < maxDepth) {
            [...node.children.entries()].sort((a, b) => a[0].localeCompare(b[0])).forEach(([k, v]) => visit(v, shown.replace(/\/$/, "") + "/" + k, depth + 1));
          }
        };
        visit(start, p, 0);
      });
      return { out, err };
    }

    cmd_awk(args, flags, stdin) {
      let sep = null, prog = null;
      const files = [];
      for (let i = 0; i < args.length; i++) {
        if (args[i] === "-F") { sep = args[++i]; continue; }
        if (args[i].startsWith("-F")) { sep = args[i].slice(2); continue; }
        if (prog === null) prog = args[i]; else files.push(args[i]);
      }
      const { text, err } = this.textLines(files, stdin, "awk");
      const body = /^\{\s*print(?:\s+([^}]*))?\}$/.exec(prog)[1] || "$0";
      const exprs = body.split(",").map(x => x.trim()).filter(Boolean);
      let out = "";
      if (text !== "") {
        text.replace(/\n$/, "").split("\n").forEach(line => {
          const fields = sep ? line.split(sep) : line.trim().split(/\s+/);
          const pick = e => {
            if (e === "$0") return line;
            if (e === "$NF") return fields[fields.length - 1];
            const m = /^\$(\d+)$/.exec(e);
            if (m) return fields[parseInt(m[1], 10) - 1] || "";
            return e.replace(/^"|"$/g, "");
          };
          out += exprs.map(pick).join(" ") + "\n";
        });
      }
      return { out, err };
    }

    cmd_sed(args, flags, stdin) {
      const rest = args.filter(a => !(a.startsWith("-") && a.length > 1));
      const m = /^s(.)(.*?)\1(.*?)\1([gI]*)$/.exec(rest[0]);
      const files = rest.slice(1);
      const { text, err } = this.textLines(files, stdin, "sed");
      let re;
      try { re = new RegExp(m[2], (m[4].includes("g") ? "g" : "") + (m[4].includes("I") ? "i" : "")); } catch (e) { return { err: "sed: -e expression #1: invalid regular expression\n" }; }
      const sub = t => t.replace(/\n$/, "").split("\n").map(l => l.replace(re, () => m[3])).join("\n") + (t ? "\n" : "");
      if (flags.has("i") && files.length) {
        files.forEach(f => {
          const n = this.lookup(this.abs(f), true);
          if (n && n.type === "file") { n.content = sub(n.content || ""); n.mtime = nowStamp(); }
        });
        return { err };
      }
      return { out: sub(text), err };
    }

    cmd_cut(args, flags, stdin) {
      let delim = "\t", fieldSpec = null;
      const files = [];
      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === "-d") delim = args[++i];
        else if (a.startsWith("-d")) delim = a.slice(2);
        else if (a === "-f") fieldSpec = args[++i];
        else if (a.startsWith("-f")) fieldSpec = a.slice(2);
        else files.push(a);
      }
      const { text, err } = this.textLines(files, stdin, "cut");
      const wanted = [];
      String(fieldSpec).split(",").forEach(part => {
        const r = /^(\d*)-(\d*)$/.exec(part);
        if (r) { for (let n = parseInt(r[1] || "1", 10); n <= parseInt(r[2] || "99", 10); n++) wanted.push(n); }
        else wanted.push(parseInt(part, 10));
      });
      let out = "";
      if (text !== "") {
        text.replace(/\n$/, "").split("\n").forEach(line => {
          if (!line.includes(delim)) { out += line + "\n"; return; }
          const f = line.split(delim);
          out += wanted.filter(n => n >= 1 && n <= f.length).map(n => f[n - 1]).join(delim) + "\n";
        });
      }
      return { out, err };
    }

    cmd_stat(args) {
      let fmt = null; const rest = [];
      for (let i = 0; i < args.length; i++) { if (args[i] === "-c") fmt = args[++i]; else if (args[i].startsWith("--format=")) fmt = args[i].slice(9); else rest.push(args[i]); }
      if (fmt !== null) {
        let outF = "", errF = "";
        rest.filter(a => !a.startsWith("-")).forEach(f => {
          const n = this.lookup(this.abs(f));
          if (!n) { errF += "stat: cannot statx '" + f + "': No such file or directory\n"; return; }
          const kind = n.type === "dir" ? "directory" : n.type === "link" ? "symbolic link" : (n.size ? "regular file" : "regular empty file");
          let inode = 0; for (const ch of this.abs(f)) inode = (inode * 31 + ch.charCodeAt(0)) % 900000;
          outF += fmt.replace(/%([aAUGsnFiugN%])/g, (m, k) => ({ a: ("0" + (n.mode & 0o7777).toString(8)).slice(-4).replace(/^0(?=\d{3}$)/, ""), A: permString(n), U: n.owner, G: n.group, s: String(n.type === "dir" ? 4096 : (n.size || 0)), n: f, F: kind, i: String(inode + 100000), u: n.owner === "root" ? "0" : "1000", g: n.group === "root" ? "0" : "1000", N: "'" + f + "'", "%": "%" })[k]) + "\n";
        });
        return { out: outF, err: errF };
      }
      const files = rest.filter(a => !a.startsWith("-"));
      if (!files.length) return { err: "stat: missing operand\n" };
      const idOf = n => (n === "root" ? 0 : n === "ubuntu" ? 1000 : 1001);
      let out = "", err = "";
      files.forEach(f => {
        const a = this.abs(f);
        const n = this.lookup(a);
        if (!n) { err += "stat: cannot statx '" + f + "': No such file or directory\n"; return; }
        const kind = n.type === "dir" ? "directory" : n.type === "link" ? "symbolic link" : (n.size ? "regular file" : "regular empty file");
        const size = n.type === "dir" ? 4096 : n.type === "link" ? n.target.length : (n.size || 0);
        let inode = 0; for (const ch of a) inode = (inode * 31 + ch.charCodeAt(0)) % 900000;
        inode += 100000;
        const octal = ("0" + n.mode.toString(8)).slice(-4);
        const info = { path: a, type: n.type, perm: permString(n), octal, owner: n.owner, group: n.group, uid: idOf(n.owner), gid: idOf(n.group), size, inode, kind };
        this.lastStat = info;
        out += "  File: " + (n.type === "link" ? f + " -> " + n.target : f) + "\n";
        out += "  Size: " + String(size).padEnd(10) + "\tBlocks: " + String(Math.ceil(size / 4096) * 8).padEnd(10) + " IO Block: 4096   " + kind + "\n";
        out += "Device: 10301h/66305d\tInode: " + String(inode).padEnd(10) + " Links: 1\n";
        out += "Access: (" + octal + "/" + permString(n) + ")  Uid: (" + String(info.uid).padStart(5) + "/" + n.owner.padStart(8) + ")   Gid: (" + String(info.gid).padStart(5) + "/" + n.group.padStart(8) + ")\n";
        out += "Access: 2026-10-29 10:15:00.000000000 +0000\nModify: 2026-10-25 08:30:12.000000000 +0000\nChange: 2026-10-25 08:30:12.000000000 +0000\n Birth: -\n";
      });
      return { out, err };
    }

    // namei -l: walk a path one component at a time showing who owns it and what the permissions are
    cmd_namei(args) {
      const p = args.filter(a => !a.startsWith("-"))[0];
      if (!p) return { err: "namei: missing operand\n" };
      const a = this.abs(p);
      let out = "f: " + p + "\n";
      const chain = [{ name: "/", perm: permString(this.root), mode: this.root.mode, owner: this.root.owner, group: this.root.group, type: "dir" }];
      out += permString(this.root) + " " + this.root.owner + " " + this.root.group + " /\n";
      let node = this.root, cur = "";
      for (const part of a.split("/").filter(Boolean)) {
        const next = node && node.type === "dir" ? node.children.get(part) : null;
        if (!next) { out += " " + part + " - No such file or directory\n"; chain.push({ name: part, missing: true }); break; }
        cur += "/" + part;
        const label = next.type === "link" ? part + " -> " + next.target : part;
        out += permString(next) + " " + next.owner + " " + next.group + " " + label + "\n";
        chain.push({ name: part, label, perm: permString(next), mode: next.mode, owner: next.owner, group: next.group, type: next.type });
        node = next.type === "link" ? this.followLink(next, dirname(cur).replace(/^\//, "")) : next;
      }
      this.lastNamei = { path: a, chain };
      return { out };
    }

    snapshotEntry(node, rel) {
      return { path: rel, isDir: node.type === "dir", node: node.type === "dir" ? null : { content: node.content, size: node.size || 0, mode: node.mode, owner: node.owner, group: node.group } };
    }

    collectEntries(node, rel, list) {
      list.push(this.snapshotEntry(node, rel));
      if (node.type === "dir") [...node.children.entries()].sort((x, y) => x[0].localeCompare(y[0])).forEach(([k, v]) => this.collectEntries(v, rel + "/" + k, list));
    }

    cmd_tar(args) {
      let letters = "", archive = null, dest = null;
      const rest = [];
      let i = 0;
      if (args[0] && !args[0].startsWith("-")) { letters = args[0]; i = 1; }
      for (; i < args.length; i++) {
        const a = args[i];
        if (a === "-C") { dest = args[++i]; continue; }
        if (a.startsWith("-") && !a.startsWith("--")) { letters += a.slice(1); continue; }
        rest.push(a);
      }
      if (letters.includes("f")) archive = rest.shift();
      const verbose = letters.includes("v"), z = letters.includes("z");
      const op = letters.includes("c") ? "c" : letters.includes("x") ? "x" : letters.includes("t") ? "t" : null;
      if (!op) return { err: "tar: You must specify one of the '-Acdtrux' options\n" };
      if (!archive) return { err: "tar: Refusing to read archive contents from terminal (missing -f option?)\n" };
      const aAbs = this.abs(archive);
      let out = "", err = "";
      if (op === "c") {
        if (!rest.length) return { err: "tar: Cowardly refusing to create an empty archive\n" };
        const entries = [];
        rest.forEach(src => {
          const n = this.lookup(this.abs(src), true);
          if (!n) { err += "tar: " + src + ": Cannot stat: No such file or directory\n"; return; }
          this.collectEntries(n, src.replace(/^\.\//, "").replace(/\/$/, ""), entries);
        });
        if (!entries.length) return { err: err + "tar: Exiting with failure status due to previous errors\n" };
        const parent = this.lookup(dirname(aAbs), true);
        if (!parent) return { err: "tar: " + archive + ": Cannot open: No such file or directory\n" };
        const raw = entries.reduce((sum, e) => sum + (e.node ? e.node.size : 0) + 512, 0);
        const size = z ? Math.max(180, Math.round(raw * 0.38)) : raw + 1024;
        const node = { name: basename(aAbs), type: "file", mode: 0o644, owner: DEFAULT_OWNER, group: DEFAULT_GROUP, content: null, size, mtime: nowStamp(), archive: { z, entries } };
        parent.children.set(node.name, node);
        out = verbose ? entries.map(e => e.path + (e.isDir ? "/" : "")).join("\n") + "\n" : "";
        this.lastArchive = { op: "create", file: archive, entries: entries.map(e => e.path), size, raw };
        return { out, err };
      }
      const arch = this.lookup(aAbs, true);
      if (!arch) return { err: "tar: " + archive + ": Cannot open: No such file or directory\ntar: Error is not recoverable: exiting now\n" };
      if (!arch.archive) return { err: "tar: This does not look like a tar archive\ntar: Exiting with failure status due to previous errors\n" };
      if (op === "t") {
        this.lastArchive = { op: "list", file: archive, entries: arch.archive.entries.map(e => e.path), size: arch.size };
        return { out: arch.archive.entries.map(e => e.path + (e.isDir ? "/" : "")).join("\n") + "\n" };
      }
      const base = dest ? this.abs(dest) : this.cwd;
      this.mkdirp(base);
      arch.archive.entries.forEach(e => {
        const target = normalize(base + "/" + e.path);
        if (e.isDir) { this.mkdirp(target); }
        else {
          this.mkdirp(dirname(target));
          const n = this.createFile(target, e.node.content === null ? "" : e.node.content);
          n.content = e.node.content; n.size = e.node.size; n.mode = e.node.mode; n.sizeDeclared = true;
        }
        if (verbose) out += e.path + (e.isDir ? "/" : "") + "\n";
      });
      this.lastArchive = { op: "extract", file: archive, entries: arch.archive.entries.map(e => e.path), size: arch.size, into: base };
      return { out, err };
    }

    cmd_gzip(args, flags) {
      const decompress = flags.has("d");
      let err = "";
      args.filter(a => !a.startsWith("-")).forEach(f => {
        const a = this.abs(f);
        const n = this.lookup(a);
        if (!n) { err += "gzip: " + f + ": No such file or directory\n"; return; }
        if (n.type === "dir") { err += "gzip: " + f + " is a directory -- ignored\n"; return; }
        const parent = this.lookup(dirname(a), true);
        if (!decompress) {
          if (f.endsWith(".gz")) { err += "gzip: " + f + " already has .gz suffix -- unchanged\n"; return; }
          const gz = { name: n.name + ".gz", type: "file", mode: n.mode, owner: n.owner, group: n.group, content: null, size: Math.max(60, Math.round((n.size || 0) * 0.11)), mtime: nowStamp(), gz: { orig: { content: n.content, size: n.size || 0, mode: n.mode, owner: n.owner, group: n.group } } };
          parent.children.set(gz.name, gz);
          if (!flags.has("k")) parent.children.delete(n.name);
          this.lastArchive = { op: "gzip", file: f, before: n.size || 0, after: gz.size };
        } else {
          if (!n.gz) { err += "gzip: " + f + ": not in gzip format\n"; return; }
          const name = n.name.replace(/\.gz$/, "");
          const restored = { name, type: "file", mode: n.gz.orig.mode, owner: n.gz.orig.owner, group: n.gz.orig.group, content: n.gz.orig.content, size: n.gz.orig.size, sizeDeclared: true, mtime: nowStamp() };
          parent.children.set(name, restored);
          if (!flags.has("k")) parent.children.delete(n.name);
          this.lastArchive = { op: "gunzip", file: f, before: n.size, after: restored.size };
        }
      });
      return { err };
    }

    cmd_gunzip(args, flags) { return this.cmd_gzip(args, new Set([...flags, "d"])); }

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
    stateKey() { return this.cwd + "\n" + [...this.pathSignatures().entries()].join("\n") + (this.sys ? "\n" + this.sys.stateKey() : ""); }

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
        if (this.hits.has(path)) out.hit = true;
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

  VirtualShell.supports = {};
  VirtualShell.KNOWN = KNOWN;
  VirtualShell.internals = { tokenize, expandVars, globToRegex, normalize, dirname, basename, permString, parseSize, formatSize, modeFromPermString, nowStamp, clone, HOME, DEFAULT_OWNER, DEFAULT_GROUP };
  root.VirtualShell = VirtualShell;
  if (typeof module !== "undefined" && module.exports) module.exports = { VirtualShell };
})(typeof window !== "undefined" ? window : globalThis);

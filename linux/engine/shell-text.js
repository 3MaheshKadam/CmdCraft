/**
 * CmdCraft shell, part 2: the text-processing toolbox.
 * Rewrites grep, find, awk, sed, head, tail, sort, uniq, cut, wc and adds tr, xargs and printf,
 * with the options the syllabus covers (context lines, find predicates and -exec, awk programs, sed commands...).
 */
(function (root) {
  const VS = root.VirtualShell;
  if (!VS) return;
  const { normalize, dirname, basename, globToRegex, nowStamp, DEFAULT_OWNER } = VS.internals;
  const P = VS.prototype;

  // ---------- shared helpers ----------
  const lines = t => (t === "" ? [] : t.replace(/\n$/, "").split("\n"));
  const unesc = s => s.replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\\\/g, "\\");

  // Basic regular expressions -> JS: in BRE, \| \+ \? \( \) \{ \} are special and the bare characters are literal.
  function breToJs(p) {
    let out = "";
    for (let i = 0; i < p.length; i++) {
      const c = p[i];
      if (c === "\\" && i + 1 < p.length) {
        const n = p[i + 1];
        if ("|+?(){}".includes(n)) { out += n; i++; continue; }
        if (n === "<" || n === ">") { out += "\\b"; i++; continue; }
        out += c + n; i++; continue;
      }
      if ("|+?(){}".includes(c)) { out += "\\" + c; continue; }
      out += c;
    }
    return out;
  }
  const eretoJs = p => p.replace(/\\</g, "\\b").replace(/\\>/g, "\\b").replace(/\[\[:alpha:\]\]/g, "[A-Za-z]").replace(/\[\[:digit:\]\]/g, "[0-9]").replace(/\[\[:space:\]\]/g, "\\s")
    .replace(/\[:alpha:\]/g, "A-Za-z").replace(/\[:digit:\]/g, "0-9").replace(/\[:space:\]/g, "\\s").replace(/\[:upper:\]/g, "A-Z").replace(/\[:lower:\]/g, "a-z").replace(/\[:alnum:\]/g, "A-Za-z0-9");
  const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // read a file for a text tool; returns {text} or {err}
  P.readForTool = function (f, tool) {
    const n = this.lookup(this.abs(f), true);
    if (!n) return { err: `${tool}: ${f}: No such file or directory\n` };
    if (n.type === "dir") return { err: `${tool}: ${f}: Is a directory\n` };
    if (this.enforce && !this.asRoot && !this.canAccess(n, 4)) return { err: `${tool}: ${f}: Permission denied\n` };
    return { text: n.content === null || n.content === undefined ? "" : n.content };
  };

  P.textLines = function (args, stdin, cmd) {
    const files = args.filter(a => !a.startsWith("-"));
    let text = stdin, err = "";
    if (files.length) {
      text = "";
      files.forEach(f => { const r = this.readForTool(f, cmd); if (r.err) err += r.err; else text += r.text; });
    }
    return { text, err };
  };

  // ---------- grep ----------
  P.cmd_grep = function (args, flags, stdin) {
    const o = new Set(), pats = [], operands = [];
    let A = 0, B = 0, maxCount = null;
    const include = [], exclude = [];
    const longMap = { "ignore-case": "i", "invert-match": "v", "line-number": "n", count: "c", recursive: "r", "files-with-matches": "l", "files-without-match": "L", "word-regexp": "w", "extended-regexp": "E", "only-matching": "o", "fixed-strings": "F", "line-regexp": "x", quiet: "q", silent: "q", "no-filename": "h", "with-filename": "H", "no-messages": "s", color: "", colour: "" };
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === "--") { operands.push(...args.slice(i + 1)); break; }
      if (a === "-e" || a === "--regexp") { pats.push(args[++i]); continue; }
      if (a === "-m") { maxCount = parseInt(args[++i], 10); continue; }
      if (a === "-A" || a === "-B" || a === "-C") { const n = parseInt(args[++i], 10) || 0; if (a === "-A") A = n; else if (a === "-B") B = n; else A = B = n; continue; }
      let m;
      if ((m = /^-([ABC])(\d+)$/.exec(a))) { const n = parseInt(m[2], 10); if (m[1] === "A") A = n; else if (m[1] === "B") B = n; else A = B = n; continue; }
      if (/^-\d+$/.test(a)) { A = B = parseInt(a.slice(1), 10); continue; }
      if (a.startsWith("--include=")) { include.push(a.slice(10)); continue; }
      if (a.startsWith("--exclude=")) { exclude.push(a.slice(10)); continue; }
      if (a.startsWith("--max-count=")) { maxCount = parseInt(a.slice(12), 10); continue; }
      if (a.startsWith("--")) {
        const k = a.slice(2).split("=")[0];
        if (!(k in longMap) && !["regexp", "max-count", "include", "exclude", "after-context", "before-context", "context", "binary-files", "null"].includes(k)) return { err: "grep: unrecognized option '" + a + "'\nUsage: grep [OPTION]... PATTERNS [FILE]...\nTry 'grep --help' for more information.\n", code: 2 };
        if (longMap[k]) o.add(longMap[k]);
        continue;
      }
      if (/^-[^A-Za-z0-9-]/.test(a)) return { err: "grep: invalid option -- '" + a[1] + "'\nUsage: grep [OPTION]... PATTERNS [FILE]...\nTry 'grep --help' for more information.\n", code: 2 };
      if (/^-[A-Za-z]+$/.test(a)) { a.slice(1).split("").forEach(f => o.add(f)); continue; }
      operands.push(a);
    }
    if (!pats.length) { if (!operands.length) return { err: "Usage: grep [OPTION]... PATTERNS [FILE]...\n", code: 2 }; pats.push(operands.shift()); }
    let source = pats.map(p => (o.has("F") ? escapeRe(p) : (o.has("E") || o.has("P")) ? eretoJs(p) : breToJs(p))).join("|");
    if (o.has("w")) source = "\\b(?:" + source + ")\\b";
    if (o.has("x")) source = "^(?:" + source + ")$";
    let re;
    try { re = new RegExp(source, o.has("i") ? "gi" : "g"); } catch (e) { return { err: "grep: Invalid regular expression\n", code: 2 }; }
    const recursive = o.has("r") || o.has("R");
    let files = operands.slice();
    const bareRoot = recursive && !files.length;
    if (bareRoot) files = ["."];
    const sources = files.length ? [] : [{ name: "", text: stdin }];
    let err = "";
    const passes = nm => (!include.length || include.some(g => globToRegex(g).test(basename(nm)))) && !exclude.some(g => globToRegex(g).test(basename(nm)));
    files.forEach(f => {
      const n = this.lookup(this.abs(f), true);
      if (!n) { if (!o.has("s")) err += "grep: " + f + ": No such file or directory\n"; return; }
      if (n.type === "dir") {
        if (!recursive) { if (!o.has("s")) err += "grep: " + f + ": Is a directory\n"; return; }
        const walk = (node, rel) => {
          [...node.children.entries()].sort((a, b) => a[0].localeCompare(b[0])).forEach(([k, v]) => {
            const path = rel ? rel + "/" + k : k;
            if (v.type === "dir") walk(v, path);
            else if (v.type === "file" && passes(k)) sources.push({ name: bareRoot ? path : f.replace(/\/$/, "") + "/" + path, text: v.content === null ? "" : v.content });
          });
        };
        walk(n, "");
      } else {
        const r = this.readForTool(f, "grep");
        if (r.err) { err += r.err; return; }
        sources.push({ name: f, text: r.text });
      }
    });
    const multi = (recursive || files.length > 1 || o.has("H")) && !o.has("h");
    let out = "", total = 0;
    sources.forEach(src => {
      const ls = lines(src.text);
      const hit = new Array(ls.length).fill(false);
      let count = 0;
      for (let i = 0; i < ls.length; i++) {
        if (maxCount !== null && count >= maxCount) break;
        re.lastIndex = 0;
        if (re.test(ls[i]) !== o.has("v")) { hit[i] = true; count++; }
      }
      total += count;
      const label = src.name;
      if (o.has("q")) return;
      if (o.has("l")) { if (count) { out += label + "\n"; if (label) this.hits.add(this.abs(label)); } return; }
      if (o.has("L")) { if (!count) out += label + "\n"; return; }
      if (o.has("c")) { out += (multi ? label + ":" : "") + count + "\n"; return; }
      if (count && label) this.hits.add(this.abs(label));
      const show = new Set();
      hit.forEach((h, i) => { if (h) { for (let k = Math.max(0, i - B); k <= Math.min(ls.length - 1, i + A); k++) show.add(k); } });
      let lastShown = -2;
      [...show].sort((a, b) => a - b).forEach(i => {
        if ((A || B) && lastShown !== -2 && i > lastShown + 1) out += "--\n";
        lastShown = i;
        const sep = hit[i] ? ":" : "-";
        const prefix = (multi ? label + sep : "") + (o.has("n") ? (i + 1) + sep : "");
        if (o.has("o") && hit[i]) { re.lastIndex = 0; (ls[i].match(re) || []).forEach(mm => { out += prefix + mm + "\n"; }); }
        else out += prefix + ls[i] + "\n";
      });
    });
    return { out, err, code: err && !total ? 2 : (total ? 0 : 1) };
  };

  // ---------- find ----------
  const FIND_PREDS = new Set(["-name", "-iname", "-type", "-size", "-mtime", "-mmin", "-user", "-group", "-perm", "-empty", "-newer", "-path", "-maxdepth", "-mindepth", "-print", "-delete", "-exec", "-not", "!", "-o", "-a", "(", ")", "-and", "-or", "-ls"]);
  VS.supports.find = function (args) {
    const takes = new Set(["-name", "-iname", "-type", "-size", "-mtime", "-mmin", "-user", "-group", "-perm", "-newer", "-path", "-maxdepth", "-mindepth"]);
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === "-exec") { while (i < args.length && args[i] !== ";" && args[i] !== "+") i++; continue; }
      if (takes.has(a)) { i++; continue; }
      if ((a.startsWith("-") || a === "!" || a === "(" || a === ")") && !FIND_PREDS.has(a)) return false;
    }
    return true;
  };

  P.ageDays = function (n) { return n.age !== undefined ? n.age : 5; };

  P.cmd_find = function (args) {
    const paths = [];
    let i = 0;
    while (i < args.length && !args[i].startsWith("-") && args[i] !== "!" && args[i] !== "(") paths.push(args[i++]);
    if (!paths.length) paths.push(".");
    const expr = args.slice(i);
    let maxDepth = Infinity, minDepth = 0;
    // strip global options
    const toks = [];
    for (let k = 0; k < expr.length; k++) {
      if (expr[k] === "-maxdepth") { maxDepth = parseInt(expr[++k], 10); continue; }
      if (expr[k] === "-mindepth") { minDepth = parseInt(expr[++k], 10); continue; }
      toks.push(expr[k]);
    }
    const self = this;
    let pos = 0, hasAction = false;
    const sizeTest = spec => {
      const m = /^([+-]?)(\d+)([cwbkKMG]?)$/.exec(spec); if (!m) return () => false;
      const unit = { c: 1, w: 2, b: 512, k: 1024, K: 1024, M: 1048576, G: 1073741824 }[m[3] || "b"], lim = parseInt(m[2], 10) * unit;
      return sz => (m[1] === "+" ? sz > lim : m[1] === "-" ? sz < lim : Math.ceil(sz / unit) === parseInt(m[2], 10));
    };
    const numTest = (spec, val) => { const m = /^([+-]?)(\d+)$/.exec(spec); if (!m) return false; const n = parseInt(m[2], 10); return m[1] === "+" ? val > n : m[1] === "-" ? val < n : Math.floor(val) === n; };
    // parse into a tree of closures
    const parsePrimary = () => {
      const t = toks[pos++];
      if (t === "(") { const e = parseOr(); pos++; return e; }
      if (t === "!" || t === "-not") { const e = parsePrimary(); return ctx => !e(ctx); }
      const arg = () => toks[pos++];
      switch (t) {
        case "-name": { const re = globToRegex(arg()); return c => re.test(basename(c.shown)); }
        case "-iname": { const re = new RegExp(globToRegex(arg()).source, "i"); return c => re.test(basename(c.shown)); }
        case "-path": { const re = globToRegex(arg()); return c => re.test(c.shown); }
        case "-type": { const ty = arg(); return c => (ty === "d" ? c.node.type === "dir" : ty === "l" ? c.node.type === "link" : c.node.type === "file"); }
        case "-size": { const f = sizeTest(arg()); return c => c.node.type === "file" && f(c.node.size || 0); }
        case "-mtime": { const s = arg(); return c => numTest(s, self.ageDays(c.node)); }
        case "-mmin": { const s = arg(); return c => numTest(s, self.ageDays(c.node) * 1440); }
        case "-user": { const u = arg(); return c => c.node.owner === u; }
        case "-group": { const g = arg(); return c => c.node.group === g; }
        case "-newer": { const ref = self.lookup(self.abs(arg()), true); return c => !!ref && self.ageDays(c.node) < self.ageDays(ref); }
        case "-empty": return c => (c.node.type === "dir" ? c.node.children.size === 0 : c.node.type === "file" && !(c.node.size || 0));
        case "-perm": {
          const spec = arg(); const kind = spec[0] === "-" ? "all" : spec[0] === "/" ? "any" : "exact";
          const want = parseInt(spec.replace(/^[-/]/, ""), 8);
          return c => { const m = c.node.mode & 0o7777; return kind === "exact" ? m === want : kind === "all" ? (m & want) === want : (m & want) !== 0; };
        }
        case "-print": hasAction = true; return c => { c.out += c.shown + "\n"; self.hits.add(self.abs(c.shown)); return true; };
        case "-ls": hasAction = true; return c => { c.out += c.shown + "\n"; return true; };
        case "-delete": hasAction = true; return c => { c.del.push(c.abs); return true; };
        case "-exec": {
          hasAction = true;
          const cmd = []; while (pos < toks.length && toks[pos] !== ";" && toks[pos] !== "+") cmd.push(toks[pos++]);
          const plus = toks[pos++] === "+";
          return c => { if (plus) { c.batch.push({ cmd, shown: c.shown }); } else c.exec.push({ cmd, shown: c.shown }); return true; };
        }
        default: return () => true;
      }
    };
    const parseAnd = () => { let l = parsePrimary(); while (pos < toks.length && toks[pos] !== "-o" && toks[pos] !== "-or" && toks[pos] !== ")") { if (toks[pos] === "-a" || toks[pos] === "-and") pos++; const r = parsePrimary(); const ll = l; l = c => ll(c) && r(c); } return l; };
    const parseOr = () => { let l = parseAnd(); while (toks[pos] === "-o" || toks[pos] === "-or") { pos++; const r = parseAnd(); const ll = l; l = c => ll(c) || r(c); } return l; };
    let test;
    try { test = toks.length ? parseOr() : () => true; } catch (e) { return { err: "find: paths must precede expression\n", code: 1 }; }

    const ctx = { out: "", del: [], exec: [], batch: [] };
    let err = "";
    paths.forEach(p => {
      const start = this.lookup(this.abs(p), true);
      if (!start) { err += "find: '" + p + "': No such file or directory\n"; return; }
      const visit = (node, shown, depth) => {
        if (depth >= minDepth) {
          const c = Object.assign(ctx, { node, shown, abs: this.abs(shown) });
          const ok = test(c);
          if (ok && !hasAction) { ctx.out += shown + "\n"; this.hits.add(this.abs(shown)); }
        }
        if (node.type === "dir" && depth < maxDepth) {
          [...node.children.entries()].sort((a, b) => a[0].localeCompare(b[0])).forEach(([k, v]) => visit(v, shown.replace(/\/$/, "") + "/" + k, depth + 1));
        }
      };
      visit(start, p, 0);
    });
    let out = ctx.out;
    // -delete (deepest first), then -exec
    ctx.del.sort((a, b) => b.length - a.length).forEach(a => {
      const n = this.lookup(a);
      if (!n) return;
      if (n.type === "dir" && n.children.size) { err += "find: cannot delete '" + a + "': Directory not empty\n"; return; }
      this.lookup(dirname(a), true).children.delete(basename(a));
    });
    const runCmd = (tokens, shownList) => {
      const q = s => '"' + s.replace(/(["\\$`])/g, "\\$1") + '"';
      let line;
      if (shownList.length > 1 || tokens.includes("{}") === false) line = tokens.flatMap(t => (t === "{}" ? shownList.map(q) : [q(t) === '""' ? '""' : (/^[\w@%+=:,./-]+$/.test(t) ? t : q(t))])).join(" ");
      else line = tokens.map(t => (t === "{}" ? q(shownList[0]) : (/^[\w@%+=:,./-]+$/.test(t) ? t : q(t)))).join(" ");
      const r = this.exec(line);
      if (r) { out += r.out || ""; err += r.err || ""; }
    };
    ctx.exec.forEach(e => runCmd(e.cmd.map(t => t.replace(/\{\}/g, "{}")), [e.shown]));
    if (ctx.batch.length) runCmd(ctx.batch[0].cmd, ctx.batch.map(b => b.shown));
    return { out, err, code: err ? 1 : 0 };
  };

  // ---------- head / tail ----------
  const countArgs = (args, dflt) => {
    let n = dflt, plus = false, bytes = null; const files = [];
    for (let i = 0; i < args.length; i++) {
      const a = args[i]; let m;
      if (a === "-n" || a === "--lines") { const v = String(args[++i]); plus = v.startsWith("+"); n = parseInt(v.replace(/^\+/, ""), 10); continue; }
      if ((m = /^-n(\+?)(\d+)$/.exec(a))) { plus = !!m[1]; n = parseInt(m[2], 10); continue; }
      if ((m = /^--lines=(\+?)(\d+)$/.exec(a))) { plus = !!m[1]; n = parseInt(m[2], 10); continue; }
      if (a === "-c") { bytes = parseInt(args[++i], 10); continue; }
      if ((m = /^-(\d+)$/.exec(a))) { n = parseInt(m[1], 10); continue; }
      if (a.startsWith("-") && a.length > 1) continue;
      files.push(a);
    }
    return { n, plus, bytes, files };
  };

  P.cmd_head = function (args, flags, stdin) {
    const { n, bytes, files } = countArgs(args, 10);
    let out = "", err = "";
    const one = (text, name, multi) => {
      if (multi && !flags.has("q")) out += (out ? "\n" : "") + "==> " + name + " <==\n";
      out += bytes !== null ? text.slice(0, bytes) : lines(text).slice(0, n).map(l => l + "\n").join("");
    };
    if (!files.length) one(stdin, "standard input", false);
    else files.forEach(f => { const r = this.readForTool(f, "head"); if (r.err) err += "head: cannot open '" + f + "' for reading: " + r.err.split(": ").slice(-1)[0]; else one(r.text, f, files.length > 1); });
    return { out, err };
  };

  P.cmd_tail = function (args, flags, stdin) {
    const { n, plus, bytes, files } = countArgs(args, 10);
    let out = "", err = "";
    const one = (text, name, multi) => {
      if (multi && !flags.has("q")) out += (out ? "\n" : "") + "==> " + name + " <==\n";
      const ls = lines(text);
      out += bytes !== null ? text.slice(-bytes) : (plus ? ls.slice(Math.max(0, n - 1)) : ls.slice(-n)).map(l => l + "\n").join("");
    };
    if (!files.length) one(stdin, "standard input", false);
    else files.forEach(f => { const r = this.readForTool(f, "tail"); if (r.err) err += "tail: cannot open '" + f + "' for reading: " + r.err.split(": ").slice(-1)[0]; else one(r.text, f, files.length > 1); });
    if (flags.has("f") || flags.has("F")) {
      out += "[sandbox: following the file for new lines. Press Ctrl+C to stop]\n";
      const target = files[0];
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
  };

  // ---------- wc / sort / uniq / cut ----------
  P.cmd_wc = function (args, flags, stdin) {
    const files = args.filter(a => !a.startsWith("-"));
    const rows = []; let err = "";
    const count = t => ({ l: (t.match(/\n/g) || []).length, w: t.split(/\s+/).filter(Boolean).length, c: t.length });
    if (!files.length) rows.push({ name: "", ...count(stdin) });
    else files.forEach(f => { const r = this.readForTool(f, "wc"); if (r.err) err += r.err; else rows.push({ name: f, ...count(r.text) }); });
    if (files.length > 1) rows.push({ name: "total", l: rows.reduce((s, r) => s + r.l, 0), w: rows.reduce((s, r) => s + r.w, 0), c: rows.reduce((s, r) => s + r.c, 0) });
    const sel = ["l", "w", "c"].filter(k => flags.has(k) || (k === "c" && flags.has("m")));
    const cols = sel.length ? sel : ["l", "w", "c"];
    const out = rows.map(r => cols.map(k => (rows.length === 1 && !r.name && cols.length === 1 ? String(r[k]) : String(r[k]).padStart(cols.length === 1 ? 1 : 7))).join(" ") + (r.name ? " " + r.name : "")).join("\n") + (rows.length ? "\n" : "");
    return { out, err };
  };

  P.cmd_sort = function (args, flags, stdin) {
    let key = null, sep = null; const files = [];
    for (let i = 0; i < args.length; i++) {
      const a = args[i]; let m;
      if (a === "-k") { key = args[++i]; continue; }
      if ((m = /^-k(.+)$/.exec(a))) { key = m[1]; continue; }
      if (a === "-t") { sep = args[++i]; continue; }
      if ((m = /^-t(.)$/.exec(a))) { sep = m[1]; continue; }
      if (a.startsWith("-") && a.length > 1) continue;
      files.push(a);
    }
    const { text, err } = this.textLines(files, stdin, "sort");
    let ls = lines(text);
    const field = l => { if (!key) return l; const k = parseInt(key, 10); const parts = sep ? l.split(sep) : l.trim().split(/\s+/); return parts[k - 1] || ""; };
    const human = t => { const m = /^\s*([\d.]+)\s*([KMGT]?)/i.exec(t); return m ? parseFloat(m[1]) * ({ "": 1, K: 1024, M: 1048576, G: 1073741824, T: 1099511627776 })[m[2].toUpperCase()] : 0; };
    const numeric = flags.has("n") || (key && /n/.test(key));
    const cmp = (a, b) => { const x = field(a), y = field(b); if (flags.has("h")) return human(x) - human(y); if (numeric) return (parseFloat(x) || 0) - (parseFloat(y) || 0); const xx = flags.has("f") ? x.toLowerCase() : x, yy = flags.has("f") ? y.toLowerCase() : y; return xx < yy ? -1 : xx > yy ? 1 : 0; };
    ls.sort(cmp);
    if (flags.has("r")) ls.reverse();
    if (flags.has("u")) ls = ls.filter((l, i) => i === 0 || cmp(ls[i - 1], l) !== 0);
    return { out: ls.length ? ls.join("\n") + "\n" : "", err };
  };

  P.cmd_uniq = function (args, flags, stdin) {
    const { text, err } = this.textLines(args.filter(a => !a.startsWith("-")), stdin, "uniq");
    const groups = [];
    lines(text).forEach(l => { const last = groups[groups.length - 1]; const same = last && (flags.has("i") ? last.l.toLowerCase() === l.toLowerCase() : last.l === l); if (same) last.c++; else groups.push({ l, c: 1 }); });
    const keep = groups.filter(g => (flags.has("d") ? g.c > 1 : flags.has("u") ? g.c === 1 : true));
    return { out: keep.length ? keep.map(g => (flags.has("c") ? String(g.c).padStart(7) + " " : "") + g.l).join("\n") + "\n" : "", err };
  };

  P.cmd_cut = function (args, flags, stdin) {
    let delim = "\t", fieldSpec = null, charSpec = null; const files = [];
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === "-d") delim = args[++i]; else if (a.startsWith("-d")) delim = a.slice(2);
      else if (a === "-f") fieldSpec = args[++i]; else if (a.startsWith("-f")) fieldSpec = a.slice(2);
      else if (a === "-c") charSpec = args[++i]; else if (a.startsWith("-c")) charSpec = a.slice(2);
      else if (a.startsWith("-")) continue; else files.push(a);
    }
    const { text, err } = this.textLines(files, stdin, "cut");
    const expand = spec => { const w = []; String(spec).split(",").forEach(part => { const r = /^(\d*)-(\d*)$/.exec(part); if (r) { for (let n = parseInt(r[1] || "1", 10); n <= parseInt(r[2] || "9999", 10); n++) w.push(n); } else w.push(parseInt(part, 10)); }); return w; };
    let out = "";
    lines(text).forEach(line => {
      if (charSpec) { out += expand(charSpec).filter(n => n >= 1 && n <= line.length).map(n => line[n - 1]).join("") + "\n"; return; }
      if (!line.includes(delim)) { out += line + "\n"; return; }
      const f = line.split(delim);
      out += expand(fieldSpec).filter(n => n >= 1 && n <= f.length).map(n => f[n - 1]).join(delim) + "\n";
    });
    return { out, err };
  };
  VS.supports.cut = function (args) { return args.some(a => a.startsWith("-d") || a.startsWith("-f") || a.startsWith("-c")); };

  // ---------- tr / printf / xargs ----------
  const expandSet = s => {
    s = unesc(s).replace(/\[:upper:\]/g, "A-Z").replace(/\[:lower:\]/g, "a-z").replace(/\[:digit:\]/g, "0-9").replace(/\[:space:\]/g, " \t\n").replace(/\[:alpha:\]/g, "A-Za-z").replace(/\[:alnum:\]/g, "A-Za-z0-9");
    let out = "";
    for (let i = 0; i < s.length; i++) { if (s[i + 1] === "-" && i + 2 < s.length) { for (let c = s.charCodeAt(i); c <= s.charCodeAt(i + 2); c++) out += String.fromCharCode(c); i += 2; } else out += s[i]; }
    return out;
  };
  P.cmd_tr = function (args, flags, stdin) {
    const sets = args.filter(a => !a.startsWith("-") || a === "-");
    let text = stdin;
    if (flags.has("d")) { const del = expandSet(sets[0] || ""); text = [...text].filter(ch => !del.includes(ch)).join(""); }
    else {
      const from = expandSet(sets[0] || ""), to = expandSet(sets[1] || "");
      text = [...text].map(ch => { const i = from.indexOf(ch); return i < 0 ? ch : (to[Math.min(i, to.length - 1)] || ch); }).join("");
    }
    if (flags.has("s")) { const set = expandSet(sets[flags.has("d") ? 1 : (sets[1] ? 1 : 0)] || sets[0] || ""); text = text.replace(new RegExp("([" + escapeRe(set) + "])\\1+", "g"), "$1"); }
    return { out: text };
  };

  function formatPrintf(fmt, vals) {
    let vi = 0;
    const out = unesc(fmt).replace(/%(-?)(\d*)(?:\.(\d+))?([sdifcxoeg%])/g, (m, left, width, prec, conv) => {
      if (conv === "%") return "%";
      const v = vals[vi++];
      let s;
      if (conv === "s") s = String(v === undefined ? "" : v);
      else if (conv === "c") s = String(v === undefined ? "" : v)[0] || "";
      else if (conv === "d" || conv === "i") s = String(parseInt(v, 10) || 0);
      else if (conv === "f") s = (parseFloat(v) || 0).toFixed(prec === undefined ? 6 : parseInt(prec, 10));
      else if (conv === "x") s = (parseInt(v, 10) || 0).toString(16);
      else if (conv === "o") s = (parseInt(v, 10) || 0).toString(8);
      else s = String(parseFloat(v) || 0);
      if (prec !== undefined && conv === "s") s = s.slice(0, parseInt(prec, 10));
      const w = parseInt(width || "0", 10);
      return left ? s.padEnd(w) : s.padStart(w);
    });
    return out;
  }
  P.formatPrintf = formatPrintf;
  // like bash, the format is reused until every argument has been consumed
  P.cmd_printf = function (args) {
    if (!args.length) return { err: "printf: usage: printf format [arguments]\n", code: 2 };
    const fmt = args[0], vals = args.slice(1);
    const per = (unesc(fmt).replace(/%%/g, "").match(/%-?\d*(?:\.\d+)?[sdifcxoeg]/g) || []).length;
    if (!per || vals.length <= per) return { out: formatPrintf(fmt, vals) };
    let out = ""; for (let i = 0; i < vals.length; i += per) out += formatPrintf(fmt, vals.slice(i, i + per));
    return { out };
  };
  P.cmd_seq = function (args) {
    const n = args.filter(a => !a.startsWith("-")).map(Number);
    if (!n.length || n.some(isNaN)) return { err: "seq: invalid floating point argument: '" + (args[0] || "") + "'\n", code: 1 };
    const [a, step, b] = n.length === 1 ? [1, 1, n[0]] : n.length === 2 ? [n[0], 1, n[1]] : [n[0], n[1], n[2]];
    if (!step) return { err: "seq: invalid Zero increment value: '0'\n", code: 1 };
    let out = ""; for (let v = a; step > 0 ? v <= b : v >= b; v += step) { out += v + "\n"; if (out.length > 200000) break; }
    return { out };
  };

  P.cmd_xargs = function (args, flags, stdin) {
    let perCall = null, repl = null; const cmd = [];
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (cmd.length) { cmd.push(a); continue; }
      if (a === "-n") { perCall = parseInt(args[++i], 10); continue; }
      if (a === "-I") { repl = args[++i]; continue; }
      if (a.startsWith("-") && a.length > 1) continue;
      cmd.push(a);
    }
    if (!cmd.length) cmd.push("echo");
    const items = repl ? lines(stdin) : stdin.split(/\s+/).filter(Boolean);
    if (!items.length) return { out: "" };
    const q = s => '"' + String(s).replace(/(["\\$`])/g, "\\$1") + '"';
    const batches = repl ? items.map(it => [it]) : perCall ? items.reduce((acc, it, i) => { if (i % perCall === 0) acc.push([]); acc[acc.length - 1].push(it); return acc; }, []) : [items];
    let out = "", err = "";
    batches.forEach(b => {
      const line = repl ? cmd.map(t => q(t.split(repl).join(b[0]))).join(" ") : cmd.map(t => (/^[\w@%+=:,./-]+$/.test(t) ? t : q(t))).concat(b.map(q)).join(" ");
      const r = this.exec(line);
      if (r) { out += r.out || ""; err += r.err || ""; }
    });
    return { out, err };
  };

  // ---------- sed ----------
  VS.supports.sed = function (args) {
    const exprs = []; let skip = false;
    args.forEach((a, i) => { if (skip) { skip = false; return; } if (a === "-e") { exprs.push(args[i + 1]); skip = true; return; } if (a === "-f" || a === "--file") { skip = true; return; } if (!a.startsWith("-")) exprs.push(a); });
    return exprs.length > 0;
  };

  function parseSed(script, extended) {
    const cmds = []; let i = 0; const n = script.length;
    const reOf = x => new RegExp(extended ? eretoJs(x) : breToJs(x));
    const skipWs = () => { while (i < n && /[\s;]/.test(script[i])) i++; };
    const spaces = () => { while (i < n && (script[i] === " " || script[i] === "\t")) i++; };
    const readAddr = () => { const m = /^(\d+|\$|\/(?:[^/\\]|\\.)*\/)/.exec(script.slice(i)); if (!m) return null; i += m[0].length; return m[1].startsWith("/") ? { re: reOf(m[1].slice(1, -1)) } : m[1] === "$" ? { last: true } : { line: parseInt(m[1], 10) }; };
    const readDelimited = d => { let out = ""; while (i < n && script[i] !== d) { if (script[i] === "\\" && i + 1 < n) { out += script[i] + script[i + 1]; i += 2; } else out += script[i++]; } if (i >= n) throw new Error("unterminated command"); i++; return out; };
    for (;;) {
      skipWs(); if (i >= n) break;
      const a1 = readAddr(); let a2 = null;
      if (a1 && script[i] === ",") { i++; a2 = readAddr(); }
      spaces(); let neg = false;
      while (script[i] === "!") { neg = true; i++; }
      spaces();
      const c = script[i++];
      if (!c) throw new Error("missing command");
      const cmd = { a1, a2, neg, cmd: c };
      if (c === "s") {
        const d = script[i++];
        const pat = readDelimited(d), repl = readDelimited(d);
        let fl = ""; while (i < n && /[gpiI0-9]/.test(script[i])) fl += script[i++];
        cmd.re = new RegExp(extended ? eretoJs(pat) : breToJs(pat), (fl.includes("g") ? "g" : "") + (/[iI]/.test(fl) ? "i" : ""));
        cmd.repl = repl; cmd.global = fl.includes("g"); cmd.print = fl.includes("p"); cmd.nth = parseInt((fl.match(/\d+/) || [0])[0], 10) || 0;
      } else if (c === "y") {
        const d = script[i++]; cmd.from = unesc(readDelimited(d)); cmd.to = unesc(readDelimited(d));
      } else if ("iac".includes(c)) {
        let txt = script.slice(i); const nl = txt.indexOf("\n"); if (nl >= 0) txt = txt.slice(0, nl);
        i += txt.length; cmd.text = txt.replace(/^\\?\s*/, "");
      } else if (!"dpq=".includes(c)) throw new Error("unknown command: '" + c + "'");
      cmds.push(cmd);
    }
    return cmds;
  }

  function sedAddr(c, lineNo, total, text, state, idx) {
    if (!c.a1) return true;
    const one = (x, ln) => (x.last ? ln === total : x.line !== undefined ? ln === x.line : x.re.test(text));
    let hit;
    if (!c.a2) hit = one(c.a1, lineNo);
    else if (state.range[idx]) { hit = true; if (c.a2.line !== undefined ? lineNo >= c.a2.line : one(c.a2, lineNo)) state.range[idx] = false; }
    else if (one(c.a1, lineNo)) { hit = true; state.range[idx] = !(c.a2.line !== undefined && c.a2.line <= lineNo) && !(c.a2.last && lineNo === total); }
    else hit = false;
    return c.neg ? !hit : hit;
  }

  P.cmd_sed = function (args, flags, stdin) {
    const exprs = [], files = []; let inPlace = null, quiet = false, extended = false;
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === "-e") { exprs.push(args[++i]); continue; }
      if (a === "-n") { quiet = true; continue; }
      if (a === "-E" || a === "-r") { extended = true; continue; }
      if (/^-i/.test(a) && a.length >= 2 && !/^-in/.test(a)) { inPlace = a.slice(2); continue; }
      if (a === "-i") { inPlace = ""; continue; }
      if (/^-[A-Za-z]+$/.test(a)) { a.slice(1).split("").forEach(f => { if (f === "n") quiet = true; else if (f === "E" || f === "r") extended = true; else if (f === "i") inPlace = ""; }); continue; }
      if (!exprs.length && !a.startsWith("-")) exprs.push(a); else files.push(a);
    }
    let cmds;
    try { cmds = parseSed(exprs.join("\n"), extended); } catch (e) { return { err: "sed: -e expression #1, char 0: " + e.message + "\n", code: 1 }; }
    const run = text => {
      const ls = lines(text), state = { range: {} }; let out = "", quitNow = false;
      const subst = (c, line) => {
        let n = 0;
        return line.replace(c.re, (m, ...g) => {
          n++;
          if (c.nth && n !== c.nth) return m;
          if (!c.global && !c.nth && n > 1) return m;
          const groups = g.slice(0, -2).filter(x => typeof x === "string" || x === undefined);
          return c.repl.replace(/\\(\d)|&|\\&/g, (mm, d) => (mm === "\\&" ? "&" : mm === "&" ? m : (groups[parseInt(d, 10) - 1] || "")));
        });
      };
      for (let li = 0; li < ls.length && !quitNow; li++) {
        let line = ls[li], deleted = false, printed = false; const pre = [], post = [];
        cmds.forEach((c, idx) => {
          if (deleted || quitNow) return;
          if (!sedAddr(c, li + 1, ls.length, line, state, idx)) return;
          switch (c.cmd) {
            case "s": { const nl = subst(c, line); const changed = nl !== line; line = nl; if (changed && c.print) { out += line + "\n"; } break; }
            case "d": deleted = true; break;
            case "p": out += line + "\n"; break;
            case "i": pre.push(c.text); break;
            case "a": post.push(c.text); break;
            case "c": line = c.text; break;
            case "q": quitNow = true; break;
            case "=": out += (li + 1) + "\n"; break;
            case "y": line = [...line].map(ch => { const k = c.from.indexOf(ch); return k < 0 ? ch : (c.to[k] || ch); }).join(""); break;
          }
        });
        pre.forEach(t => { out += t + "\n"; });
        if (!deleted && !quiet) out += line + "\n";
        post.forEach(t => { out += t + "\n"; });
      }
      return out;
    };
    let err = "";
    if (inPlace !== null && files.length) {
      files.forEach(f => {
        const n = this.lookup(this.abs(f), true);
        if (!n || n.type !== "file") { err += "sed: can't read " + f + ": No such file or directory\n"; return; }
        if (inPlace) { const bk = this.createFile(this.abs(f) + inPlace, n.content || ""); if (bk) bk.size = n.size; }
        n.content = run(n.content || ""); n.size = n.content.length; n.sizeDeclared = false; n.mtime = nowStamp(); n.age = 0;
      });
      return { out: "", err, code: err ? 2 : 0 };
    }
    const { text, err: e2 } = this.textLines(files, stdin, "sed");
    return { out: run(text), err: e2, code: e2 ? 2 : 0 };
  };

  // ---------- awk ----------
  VS.supports.awk = function (args) {
    const rest = [];
    for (let i = 0; i < args.length; i++) { if (args[i] === "-F" || args[i] === "-v") { i++; continue; } if (args[i].startsWith("-F") || args[i].startsWith("-v")) continue; rest.push(args[i]); }
    if (!rest.length) return false;
    try { awkParse(rest[0]); return true; } catch (e) { return false; }
  };

  function awkLex(src) {
    const toks = []; let i = 0;
    const re = /\s+|#[^\n]*/y;
    while (i < src.length) {
      const c = src[i];
      if (/\s/.test(c)) { if (c === "\n") toks.push({ t: ";", v: "\n" }); i++; continue; }
      if (c === "#") { while (i < src.length && src[i] !== "\n") i++; continue; }
      if (/\d/.test(c) || (c === "." && /\d/.test(src[i + 1] || ""))) { const m = /^\d*\.?\d+(?:[eE][-+]?\d+)?/.exec(src.slice(i)); toks.push({ t: "num", v: parseFloat(m[0]) }); i += m[0].length; continue; }
      if (/[A-Za-z_]/.test(c)) { const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i)); toks.push({ t: "id", v: m[0] }); i += m[0].length; continue; }
      if (c === '"') { let j = i + 1, s = ""; while (j < src.length && src[j] !== '"') { if (src[j] === "\\") { const n = src[j + 1]; s += n === "n" ? "\n" : n === "t" ? "\t" : n === '"' ? '"' : n === "\\" ? "\\" : "\\" + n; j += 2; } else s += src[j++]; } toks.push({ t: "str", v: s }); i = j + 1; continue; }
      if (c === "/") {
        const prev = toks[toks.length - 1];
        const operandEnd = prev && (["num", "str", "id"].includes(prev.t) || [")", "]", "$"].includes(prev.t) || prev.t === "incr");
        if (!operandEnd) { let j = i + 1, s = ""; while (j < src.length && src[j] !== "/") { if (src[j] === "\\" && src[j + 1] === "/") { s += "/"; j += 2; } else s += src[j++]; } toks.push({ t: "re", v: s }); i = j + 1; continue; }
      }
      const three = src.slice(i, i + 3), two = src.slice(i, i + 2);
      if (["**="].includes(three)) { toks.push({ t: "op", v: three }); i += 3; continue; }
      if (["++", "--"].includes(two)) { toks.push({ t: "incr", v: two }); i += 2; continue; }
      if (["+=", "-=", "*=", "/=", "%=", "^=", "==", "!=", "<=", ">=", "&&", "||", "!~", ">>", "**"].includes(two)) { toks.push({ t: "op", v: two }); i += 2; continue; }
      toks.push({ t: c, v: c }); i++;
    }
    return toks;
  }

  function awkParse(src) {
    const toks = awkLex(src); let p = 0;
    const peek = () => toks[p], next = () => toks[p++];
    const is = (t, v) => peek() && peek().t === t && (v === undefined || peek().v === v);
    const eat = (t, v) => { if (!is(t, v)) throw new Error("awk syntax error near " + (peek() ? peek().v : "end")); return next(); };
    const skipTerm = () => { while (is(";") || is("\n")) next(); };
    const prog = { begin: [], end: [], rules: [] };

    const expr = () => ternary();
    const ternary = () => { const c = orE(); if (is("?")) { next(); const a = ternary(); eat(":"); const b = ternary(); return { k: "tern", c, a, b }; } return c; };
    const orE = () => { let l = andE(); while (is("op", "||")) { next(); l = { k: "or", l, r: andE() }; } return l; };
    const andE = () => { let l = inE(); while (is("op", "&&")) { next(); l = { k: "and", l, r: inE() }; } return l; };
    const inE = () => { let l = matchE(); while (is("id", "in")) { next(); const arr = eat("id").v; l = { k: "in", key: l, arr }; } return l; };
    const matchE = () => { let l = cmpE(); while (is("~") || is("op", "!~")) { const neg = next().v === "!~"; l = { k: "match", l, r: cmpE(), neg }; } return l; };
    const cmpE = () => { let l = concat(); while ((is("<") || is(">") || is("op", "<=") || is("op", ">=") || is("op", "==") || is("op", "!=")) && !(noGt && is(">"))) { const op = next().v; l = { k: "cmp", op, l, r: concat() }; } return l; };
    let noGt = false;
    const startsOperand = () => { const t = peek(); return t && (["num", "str", "re", "id", "$", "(", "!", "-", "+", "incr"].includes(t.t)) && !(t.t === "id" && (t.v === "in")); };
    const concat = () => { let l = add(); while (startsOperand() && !is("-") && !is("+")) { l = { k: "cat", l, r: add() }; } return l; };
    const add = () => { let l = mul(); while (is("+") || is("-")) { const op = next().v; l = { k: "bin", op, l, r: mul() }; } return l; };
    const mul = () => { let l = unary(); while (is("*") || is("/") || is("%")) { const op = next().v; l = { k: "bin", op, l, r: unary() }; } return l; };
    const unary = () => { if (is("!")) { next(); return { k: "not", e: unary() }; } if (is("-")) { next(); return { k: "neg", e: unary() }; } if (is("+")) { next(); return unary(); } return pow(); };
    const pow = () => { let l = post(); while (is("^") || is("op", "**")) { next(); l = { k: "bin", op: "^", l, r: unary() }; } return l; };
    const post = () => { const e = primary(); if (is("incr")) { const op = next().v; return { k: "postinc", e, op }; } return e; };
    const lvalueFrom = e => e;
    const primary = () => {
      const t = next();
      if (!t) throw new Error("unexpected end");
      if (t.t === "num") return { k: "num", v: t.v };
      if (t.t === "str") return { k: "str", v: t.v };
      if (t.t === "re") return { k: "re", v: t.v };
      if (t.t === "$") { const e = primary2(); return { k: "field", e }; }
      if (t.t === "incr") { const e = primary(); return { k: "preinc", e, op: t.v }; }
      if (t.t === "(") { const e = expr(); eat(")"); return { k: "group", e }; }
      if (t.t === "id") {
        if (is("(")) { next(); const a = []; if (!is(")")) { a.push(expr()); while (is(",")) { next(); a.push(expr()); } } eat(")"); return { k: "call", name: t.v, a }; }
        if (is("[")) { next(); const idx = [expr()]; while (is(",")) { next(); idx.push(expr()); } eat("]"); return { k: "idx", name: t.v, idx }; }
        return { k: "var", name: t.v };
      }
      throw new Error("awk syntax error near " + t.v);
    };
    const primary2 = () => { if (is("incr")) { return primary(); } const t = peek(); if (t.t === "num") { next(); return { k: "num", v: t.v }; } if (t.t === "(") { next(); const e = expr(); eat(")"); return e; } if (t.t === "id") { next(); if (is("[")) { next(); const idx = [expr()]; eat("]"); return { k: "idx", name: t.v, idx }; } return { k: "var", name: t.v }; } throw new Error("awk syntax error after $"); };

    const assignOrExpr = () => {
      const l = expr();
      if (is("=") || is("op", "+=") || is("op", "-=") || is("op", "*=") || is("op", "/=") || is("op", "%=") || is("op", "^=")) {
        const op = next().v;
        if (!["var", "idx", "field"].includes(l.k)) throw new Error("bad assignment target");
        return { k: "assign", op, target: l, e: assignOrExpr() };
      }
      return l;
    };
    // = is lexed as a single-char token {t:"=",v:"="}
    const is2 = is;

    const stmt = () => {
      skipTerm();
      if (is("{")) return block();
      if (is("id", "if")) { next(); eat("("); const c = assignOrExpr(); eat(")"); const a = stmt(); skipTerm(); let b = null; if (is("id", "else")) { next(); b = stmt(); } return { k: "if", c, a, b }; }
      if (is("id", "while")) { next(); eat("("); const c = assignOrExpr(); eat(")"); return { k: "while", c, body: stmt() }; }
      if (is("id", "for")) {
        next(); eat("(");
        if (is("id") && toks[p + 1] && toks[p + 1].t === "id" && toks[p + 1].v === "in") { const v = next().v; next(); const arr = eat("id").v; eat(")"); return { k: "forin", v, arr, body: stmt() }; }
        const init = is(";") ? null : assignOrExpr(); eat(";"); const c = is(";") ? null : assignOrExpr(); eat(";"); const inc = is(")") ? null : assignOrExpr(); eat(")");
        return { k: "for", init, c, inc, body: stmt() };
      }
      if (is("id", "next")) { next(); return { k: "next" }; }
      if (is("id", "exit")) { next(); const e = (is(";") || is("}")) ? null : assignOrExpr(); return { k: "exit", e }; }
      if (is("id", "delete")) { next(); const name = eat("id").v; let idx = null; if (is("[")) { next(); idx = [expr()]; eat("]"); } return { k: "delete", name, idx }; }
      if (is("id", "print") || is("id", "printf")) {
        const isF = next().v === "printf"; const a = [];
        noGt = true;
        if (!(is(";") || is("}") || is(">") || is("op", ">>"))) { a.push(assignOrExpr()); while (is(",")) { next(); a.push(assignOrExpr()); } }
        noGt = false;
        let redirect = null;
        if (is(">") || is("op", ">>")) { const app = next().v === ">>"; redirect = { append: app, e: concat() }; }
        return { k: isF ? "printf" : "print", a, redirect };
      }
      return { k: "expr", e: assignOrExpr() };
    };
    const block = () => { eat("{"); const body = []; skipTerm(); while (!is("}")) { body.push(stmt()); skipTerm(); } eat("}"); return { k: "block", body }; };

    skipTerm();
    while (peek()) {
      if (is("id", "BEGIN")) { next(); prog.begin.push(block()); }
      else if (is("id", "END")) { next(); prog.end.push(block()); }
      else {
        let pattern = null, pattern2 = null;
        if (!is("{")) { pattern = assignOrExpr(); if (is(",")) { next(); pattern2 = assignOrExpr(); } }
        const action = is("{") ? block() : null;
        prog.rules.push({ pattern, pattern2, action, active: false });
      }
      skipTerm();
    }
    return prog;
  }

  // awk's "=" token is the plain character; patch the helper that looks for it
  const origAwkLex = awkLex;

  function awkRun(prog, text, opts) {
    const vars = Object.assign({ FS: opts.FS, OFS: " ", ORS: "\n", NR: 0, NF: 0, FILENAME: opts.filename || "" }, opts.vars || {});
    const arrays = {};
    let fields = [""], out = "", exited = false, nextRec = false;
    const num = v => { if (typeof v === "number") return v; const m = /^\s*[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?/.exec(String(v)); return m ? parseFloat(m[0]) : 0; };
    const str = v => (typeof v === "number" ? (Number.isInteger(v) ? String(v) : String(parseFloat(v.toPrecision(6)))) : String(v === undefined ? "" : v));
    const numLike = v => typeof v === "number" || /^\s*[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?\s*$/.test(String(v));
    const truthy = v => (typeof v === "number" ? v !== 0 : String(v) !== "" && !(numLike(v) && num(v) === 0 && false));
    const splitRecord = rec => {
      let f;
      const fs = vars.FS;
      if (fs === " ") f = rec.trim() === "" ? [] : rec.trim().split(/\s+/);
      else if (fs.length === 1 && !/[\\^$.|?*+()[\]{}]/.test(fs)) f = rec === "" ? [] : rec.split(fs);
      else f = rec === "" ? [] : rec.split(new RegExp(fs));
      return f;
    };
    const setRecord = rec => { fields = [rec, ...splitRecord(rec)]; vars.NF = fields.length - 1; };
    const rebuild = () => { fields[0] = fields.slice(1).join(str(vars.OFS)); };
    const getField = i => { i = Math.floor(num(i)); if (i === 0) return fields[0]; return fields[i] === undefined ? "" : fields[i]; };
    const setField = (i, v) => { i = Math.floor(num(i)); if (i === 0) { setRecord(str(v)); return; } while (fields.length <= i) fields.push(""); fields[i] = str(v); vars.NF = Math.max(vars.NF, i); rebuild(); };
    const arr = name => (arrays[name] = arrays[name] || {});
    const keyOf = idx => idx.map(e => str(ev(e))).join("\x1c");
    const regexOf = e => (e.k === "re" ? new RegExp(e.v) : new RegExp(str(ev(e))));
    const getVar = name => (name === "NF" ? vars.NF : name in vars ? vars[name] : "");
    const setVar = (name, v) => { vars[name] = v; if (name === "NF") { const n = num(v); fields = fields.slice(0, n + 1); while (fields.length <= n) fields.push(""); rebuild(); } };
    const assignTo = (target, v) => {
      if (target.k === "var") setVar(target.name, v);
      else if (target.k === "idx") arr(target.name)[keyOf(target.idx)] = v;
      else setField(ev(target.e), v);
      return v;
    };
    const fmtPrintf = (a) => formatPrintf(str(ev(a[0])), a.slice(1).map(x => { const v = ev(x); return typeof v === "number" ? v : v; }));
    function ev(e) {
      switch (e.k) {
        case "num": return e.v;
        case "str": return e.v;
        case "re": return new RegExp(e.v).test(fields[0]) ? 1 : 0;
        case "group": return ev(e.e);
        case "var": return getVar(e.name);
        case "idx": { const a = arr(e.name), k = keyOf(e.idx); return k in a ? a[k] : ""; }
        case "field": return getField(ev(e.e));
        case "assign": { let v = ev(e.e); if (e.op !== "=") { const cur = num(ev(e.target)), r = num(v); v = e.op === "+=" ? cur + r : e.op === "-=" ? cur - r : e.op === "*=" ? cur * r : e.op === "/=" ? cur / r : e.op === "%=" ? cur % r : Math.pow(cur, r); } return assignTo(e.target, v); }
        case "preinc": { const v = num(ev(e.e)) + (e.op === "++" ? 1 : -1); assignTo(e.e, v); return v; }
        case "postinc": { const old = num(ev(e.e)); assignTo(e.e, old + (e.op === "++" ? 1 : -1)); return old; }
        case "tern": return truthy(ev(e.c)) ? ev(e.a) : ev(e.b);
        case "or": return truthy(ev(e.l)) || truthy(ev(e.r)) ? 1 : 0;
        case "and": return truthy(ev(e.l)) && truthy(ev(e.r)) ? 1 : 0;
        case "not": return truthy(ev(e.e)) ? 0 : 1;
        case "neg": return -num(ev(e.e));
        case "in": return str(ev(e.key)) in arr(e.arr) ? 1 : 0;
        case "match": { const r = regexOf(e.r).test(str(ev(e.l))); return (r !== e.neg) ? 1 : 0; }
        case "cat": return str(ev(e.l)) + str(ev(e.r));
        case "cmp": { const l = ev(e.l), r = ev(e.r); const numeric = numLike(l) && numLike(r); const a = numeric ? num(l) : str(l), b = numeric ? num(r) : str(r); return ({ "<": a < b, ">": a > b, "<=": a <= b, ">=": a >= b, "==": a === b, "!=": a !== b })[e.op] ? 1 : 0; }
        case "bin": { const l = num(ev(e.l)), r = num(ev(e.r)); return e.op === "+" ? l + r : e.op === "-" ? l - r : e.op === "*" ? l * r : e.op === "/" ? (r ? l / r : 0) : e.op === "%" ? (r ? l % r : 0) : Math.pow(l, r); }
        case "call": return callFn(e);
        default: return "";
      }
    }
    function callFn(e) {
      const a = e.a;
      switch (e.name) {
        case "length": return a.length ? str(ev(a[0])).length : fields[0].length;
        case "substr": { const s = str(ev(a[0])); const st = Math.max(1, Math.floor(num(ev(a[1])))); return a[2] ? s.substr(st - 1, Math.floor(num(ev(a[2])))) : s.slice(st - 1); }
        case "index": return str(ev(a[0])).indexOf(str(ev(a[1]))) + 1;
        case "split": { const s = str(ev(a[0])); const name = a[1].name; const sep = a[2] ? (a[2].k === "re" ? new RegExp(a[2].v) : str(ev(a[2]))) : vars.FS; const parts = s === "" ? [] : (sep === " " ? s.trim().split(/\s+/) : s.split(sep)); arrays[name] = {}; parts.forEach((p, i) => { arrays[name][String(i + 1)] = p; }); return parts.length; }
        case "sub": case "gsub": { const re = new RegExp(a[0].k === "re" ? a[0].v : str(ev(a[0])), e.name === "gsub" ? "g" : ""); const target = a[2] || { k: "field", e: { k: "num", v: 0 } }; const cur = str(ev(target)); let n = 0; const res = cur.replace(re, m => { n++; return str(ev(a[1])).replace(/\\&/g, "\x00").replace(/&/g, m).replace(/\x00/g, "&"); }); assignTo(target, res); return n; }
        case "toupper": return str(ev(a[0])).toUpperCase();
        case "tolower": return str(ev(a[0])).toLowerCase();
        case "sprintf": return fmtPrintf(a);
        case "int": return Math.trunc(num(ev(a[0])));
        case "sqrt": return Math.sqrt(num(ev(a[0])));
        case "sin": return Math.sin(num(ev(a[0])));
        case "cos": return Math.cos(num(ev(a[0])));
        case "exp": return Math.exp(num(ev(a[0])));
        case "log": return Math.log(num(ev(a[0])));
        case "rand": return 0.5;
        case "srand": return 0;
        case "match": { const m = new RegExp(a[1].k === "re" ? a[1].v : str(ev(a[1]))).exec(str(ev(a[0]))); vars.RSTART = m ? m.index + 1 : 0; vars.RLENGTH = m ? m[0].length : -1; return vars.RSTART; }
        default: return "";
      }
    }
    function exec(s) {
      if (exited || nextRec) return;
      switch (s.k) {
        case "block": for (const x of s.body) { exec(x); if (exited || nextRec) return; } break;
        case "expr": ev(s.e); break;
        case "print": { const parts = s.a.length ? s.a.map(x => str(ev(x))) : [fields[0]]; out += parts.join(str(vars.OFS)) + str(vars.ORS); break; }
        case "printf": out += fmtPrintf(s.a); break;
        case "if": if (truthy(ev(s.c))) exec(s.a); else if (s.b) exec(s.b); break;
        case "while": { let guard = 0; while (truthy(ev(s.c)) && guard++ < 100000) { exec(s.body); if (exited || nextRec) return; } break; }
        case "for": { if (s.init) ev(s.init); let guard = 0; while ((!s.c || truthy(ev(s.c))) && guard++ < 100000) { exec(s.body); if (exited || nextRec) return; if (s.inc) ev(s.inc); } break; }
        case "forin": { const keys = Object.keys(arr(s.arr)).sort((a, b) => (numLike(a) && numLike(b) ? num(a) - num(b) : a < b ? -1 : 1)); for (const k of keys) { setVar(s.v, k.includes("\x1c") ? k.split("\x1c").join(" ") : k); exec(s.body); if (exited || nextRec) return; } break; }
        case "delete": if (s.idx) delete arr(s.name)[keyOf(s.idx)]; else arrays[s.name] = {}; break;
        case "next": nextRec = true; break;
        case "exit": exited = true; break;
      }
    }
    prog.begin.forEach(b => exec(b));
    if (!exited) {
      lines(text).forEach(rec => {
        if (exited) return;
        vars.NR++; setRecord(rec); nextRec = false;
        for (const r of prog.rules) {
          let go;
          if (!r.pattern) go = true;
          else if (r.pattern2) { if (!r.active) { go = truthy(ev(r.pattern)); if (go) r.active = true; } else go = true; if (r.active && truthy(ev(r.pattern2))) r.active = false; }
          else go = truthy(ev(r.pattern));
          if (go) { if (r.action) exec(r.action); else out += fields[0] + str(vars.ORS); }
          if (exited || nextRec) break;
        }
      });
    }
    exited = false;
    prog.end.forEach(b => exec(b));
    return out;
  }

  P.cmd_awk = function (args, flags, stdin) {
    let FS = " ", progText = null; const files = [], v = {};
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === "-F") { FS = args[++i]; continue; }
      if (a.startsWith("-F")) { FS = a.slice(2); continue; }
      if (a === "-v") { const kv = args[++i].split("="); v[kv[0]] = /^-?\d+(\.\d+)?$/.test(kv[1]) ? parseFloat(kv[1]) : kv.slice(1).join("="); continue; }
      if (a.startsWith("-v")) { const kv = a.slice(2).split("="); v[kv[0]] = kv.slice(1).join("="); continue; }
      if (progText === null) progText = a; else files.push(a);
    }
    if (FS === "\\t") FS = "\t";
    let prog;
    try { prog = awkParse(progText); } catch (e) { return { err: "awk: " + e.message + "\n", code: 2 }; }
    const { text, err } = this.textLines(files, stdin, "awk");
    let out;
    try { out = awkRun(prog, text, { FS, vars: v, filename: files[0] }); } catch (e) { return { err: "awk: " + e.message + "\n", code: 2 }; }
    return { out, err, code: err ? 2 : 0 };
  };

  ["tr", "printf", "xargs"].forEach(n => VS.KNOWN.add(n));
  root.__cmdcraftAwk = { awkParse, awkRun };
})(typeof window !== "undefined" ? window : globalThis);

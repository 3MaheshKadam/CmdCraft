/**
 * CmdCraft shell, part 5: the Bash script interpreter (Module 25).
 * Handles what a one-line command can't: if/elif/else, for (list and C-style), while/until, case, functions, heredocs,
 * (( )) arithmetic, set -e / -u / pipefail, trap, return/break/continue/exit, and `while read` loops.
 * Simple commands are still run by the normal shell, so every other command behaves exactly as at the prompt.
 */
(function (root) {
  const VS = root.VirtualShell;
  if (!VS) return;
  const P = VS.prototype;
  ["break", "continue", "return", "seq"].forEach(n => VS.KNOWN.add(n));
  const LOOP_LIMIT = 2000;

  class Sig { constructor(type, n, code) { this.type = type; this.n = n || 1; this.code = code || 0; } }

  // ---------- control-flow builtins ----------
  P.cmd_return = function (args) { const code = args[0] !== undefined ? parseInt(args[0], 10) || 0 : this.lastCode || 0; this.ctl = { type: "return", code }; return { out: "", code }; };
  P.cmd_break = function (args) { this.ctl = { type: "break", n: parseInt(args[0], 10) || 1 }; return { out: "", code: 0 }; };
  P.cmd_continue = function (args) { this.ctl = { type: "continue", n: parseInt(args[0], 10) || 1 }; return { out: "", code: 0 }; };
  P.cmd_local = function (args) {
    const frame = this.frames && this.frames[this.frames.length - 1];
    args.filter(a => !a.startsWith("-")).forEach(a => {
      const eq = a.indexOf("="), name = eq > 0 ? a.slice(0, eq) : a;
      if (frame && !(name in frame.locals)) frame.locals[name] = this.vars[name] || null;
      if (eq > 0) this.setVar(name, a.slice(eq + 1)); else if (!this.vars[name]) this.setVar(name, "");
    });
    return { out: "" };
  };

  // ---------- splitting a script into statements ----------
  // Returns [{t, hd:[{body, quoted, strip}]}]. Quotes, $( ), (( )), ${ } and heredocs are respected.
  function splitStatements(text) {
    const stmts = [];
    let cur = "", q = null, depth = 0, brace = 0, i = 0, pending = [], curHd = [];
    const push = () => {
      const t = cur.trim();
      if (t) { stmts.push({ t, hd: curHd }); }
      cur = ""; curHd = [];
    };
    const n = text.length;
    while (i < n) {
      const c = text[i], c2 = text[i + 1];
      if (q) {
        cur += c;
        if (c === "\\" && q === '"' && i + 1 < n) { cur += text[++i]; }
        else if (c === q) q = null;
        i++; continue;
      }
      if (c === "\\") { if (c2 === "\n") { i += 2; continue; } cur += c + (c2 || ""); i += 2; continue; }
      if (c === "'" || c === '"') { q = c; cur += c; i++; continue; }
      if (c === "#" && (cur === "" || /\s$/.test(cur)) && depth === 0) { while (i < n && text[i] !== "\n") i++; continue; }
      if (c === "$" && c2 === "{") { brace++; cur += "${"; i += 2; continue; }
      if (c === "}" && brace > 0) { brace--; cur += c; i++; continue; }
      if (c === "(") { depth++; cur += c; i++; continue; }
      if (c === ")") { if (depth > 0) depth--; cur += c; i++; continue; }
      if (c === "<" && c2 === "<" && text[i + 2] !== "<" && depth === 0) {
        const m = /^<<(-?)\s*(?:'([^']+)'|"([^"]+)"|([A-Za-z_][\w]*))/.exec(text.slice(i));
        if (m) {
          const idx = curHd.length + pending.length;
          pending.push({ delim: m[2] || m[3] || m[4], quoted: !!(m[2] || m[3]), strip: m[1] === "-", idx });
          cur += "< __HD" + idx + "__"; i += m[0].length; continue;
        }
      }
      if (depth === 0 && brace === 0) {
        if (c === ";" && c2 === ";") { push(); stmts.push({ t: ";;", hd: [] }); i += 2; continue; }
        if (c === ";") { push(); i++; continue; }
        if (c === "\n") {
          const t = cur.trim();
          if (/(\|\||&&|\|)$/.test(t)) { cur += " "; i++; continue; }   // line continues after a trailing operator
          const hd = pending; pending = [];
          i++;
          hd.forEach(h => {
            const body = [];
            while (i < n) {
              let j = text.indexOf("\n", i); if (j < 0) j = n;
              const line = text.slice(i, j); i = j + 1;
              if ((h.strip ? line.replace(/^\t+/, "") : line) === h.delim) break;
              body.push(h.strip ? line.replace(/^\t+/, "") : line);
            }
            curHd[h.idx] = { body: body.join("\n") + (body.length ? "\n" : ""), quoted: h.quoted };
          });
          push(); continue;
        }
      } else if (c === "\n") { cur += " "; i++; continue; }
      cur += c; i++;
    }
    push();
    return stmts;
  }

  // ---------- parser ----------
  const KW = new Set(["if", "then", "elif", "else", "fi", "for", "while", "until", "do", "done", "case", "esac", "in", "function"]);
  function parse(stmts) {
    let p = 0;
    const first = t => { const m = /^([A-Za-z_]+)\b/.exec(t); return m ? m[1] : ""; };
    // "then echo hi" -> "then", "echo hi";  "if cond" -> "if", "cond"
    const split = (idx, kws) => {
      const s = stmts[idx]; if (!s) return;
      const m = /^([A-Za-z]+)(?:\s+([\s\S]*))?$/.exec(s.t);
      if (m && kws.includes(m[1]) && m[2]) { stmts.splice(idx, 1, { t: m[1], hd: [] }, { t: m[2], hd: s.hd }); }
    };
    const peek = () => { split(p, ["then", "do", "else"]); return stmts[p] ? stmts[p].t : null; };
    const next = () => { peek(); return stmts[p++]; };
    function block(stops) {
      const nodes = [];
      while (p < stmts.length) {
        const t = peek();
        const fw = first(t);
        if (stops.includes(t) || stops.includes(fw) || (stops.includes("}") && t === "}") || (stops.includes(";;") && t === ";;")) break;
        nodes.push(statement());
      }
      return nodes;
    }
    const expect = (kw) => { const t = peek(); if (!t || first(t) !== kw) throw new Error("syntax error: expected `" + kw + "'" + (t ? " near `" + t + "'" : " before end of input")); return next(); };
    const afterEnd = (s, kw) => s.t.slice(kw.length).trim();
    function condition(headWord, stops) {
      const s = next(); const rest = s.t.slice(headWord.length).trim();
      if (rest) stmts.splice(p, 0, { t: rest, hd: s.hd });
      return block(stops);
    }
    function statement() {
      const s = stmts[p]; const t = s.t; const fw = first(t);
      if (fw === "if") {
        const node = { k: "if", branches: [], els: null };
        let cond = condition("if", ["then"]); expect("then");
        node.branches.push({ cond, body: block(["elif", "else", "fi"]) });
        while (first(peek() || "") === "elif") { cond = condition("elif", ["then"]); expect("then"); node.branches.push({ cond, body: block(["elif", "else", "fi"]) }); }
        if (first(peek() || "") === "else") { next(); node.els = block(["fi"]); }
        node.suffix = afterEnd(expect("fi"), "fi");
        return node;
      }
      if (fw === "for") {
        next();
        let m = /^for\s*\(\((.*)\)\)\s*$/.exec(t);
        const node = { k: "for", body: null };
        if (m) { const parts = m[1].split(";"); node.cstyle = { init: parts[0] || "", cond: parts[1] || "", step: parts[2] || "" }; }
        else { m = /^for\s+([A-Za-z_]\w*)(?:\s+in\s+([\s\S]*))?$/.exec(t); if (!m) throw new Error("syntax error near `" + t + "'"); node.v = m[1]; node.words = m[2] === undefined ? '"$@"' : m[2]; }
        expect("do"); node.body = block(["done"]); node.suffix = afterEnd(expect("done"), "done");
        return node;
      }
      if (fw === "while" || fw === "until") {
        const cond = condition(fw, ["do"]); expect("do");
        const node = { k: "while", until: fw === "until", cond, body: block(["done"]) };
        node.suffix = afterEnd(expect("done"), "done");
        return node;
      }
      if (fw === "case") {
        const s2 = next(); const m = /^case\s+([\s\S]+?)\s+in\b\s*([\s\S]*)$/.exec(s2.t);
        if (!m) throw new Error("syntax error near `" + s2.t + "'");
        if (m[2]) stmts.splice(p, 0, { t: m[2], hd: [] });
        const node = { k: "case", word: m[1], clauses: [] };
        while (p < stmts.length && first(peek()) !== "esac") {
          const c = next(); const cm = /^\(?\s*([^)]+?)\s*\)\s*([\s\S]*)$/.exec(c.t);
          if (!cm) throw new Error("syntax error near `" + c.t + "'");
          if (cm[2]) stmts.splice(p, 0, { t: cm[2], hd: c.hd });
          const body = block([";;", "esac"]);
          if (peek() === ";;") next();
          node.clauses.push({ pats: cm[1].split("|").map(x => x.trim()), body });
        }
        node.suffix = afterEnd(expect("esac"), "esac");
        return node;
      }
      let m = /^(?:function\s+)?([A-Za-z_][\w.-]*)\s*(?:\(\s*\))?\s*\{\s*([\s\S]*)$/.exec(t);
      if (m && (/^function\b/.test(t) || /^[A-Za-z_][\w.-]*\s*\(\s*\)/.test(t))) {
        next(); if (m[2]) stmts.splice(p, 0, { t: m[2], hd: [] });
        const body = block(["}"]); next();
        return { k: "func", name: m[1], body };
      }
      m = /^(?:function\s+)?([A-Za-z_][\w.-]*)\s*(?:\(\s*\))?\s*$/.exec(t);
      if (m && (/^function\b/.test(t) || /\(\s*\)\s*$/.test(t)) && stmts[p + 1] && /^\{/.test(stmts[p + 1].t)) {
        next(); const o = next(); const rest = o.t.slice(1).trim(); if (rest) stmts.splice(p, 0, { t: rest, hd: [] });
        const body = block(["}"]); next();
        return { k: "func", name: m[1], body };
      }
      if (t === "{" || /^\{\s/.test(t)) { next(); const rest = t.slice(1).trim(); if (rest) stmts.splice(p, 0, { t: rest, hd: s.hd }); const body = block(["}"]); next(); return { k: "group", body }; }
      if (KW.has(fw) && fw !== "function" && fw !== "in") throw new Error("syntax error near unexpected token `" + fw + "'");
      next();
      // "producer | while read x; do ... done": run the producer, feed the loop
      const pw = /^([\s\S]+?)\s*\|\s*(while\b[\s\S]*)$/.exec(t);
      if (pw && (pw[1].match(/'/g) || []).length % 2 === 0 && (pw[1].match(/"/g) || []).length % 2 === 0) {
        stmts.splice(p, 0, { t: pw[2], hd: [] }); p--; stmts.splice(p, 1);
        const loop = statement(); loop.feed = pw[1]; return loop;
      }
      return { k: "cmd", t, hd: s.hd };
    }
    const out = [];
    while (p < stmts.length) out.push(statement());
    return out;
  }

  // ---------- heredoc expansion ----------
  function expandHeredoc(sh, body) {
    const env = sh.envObject();
    let o = "", i = 0;
    while (i < body.length) {
      const c = body[i];
      if (c === "\\" && "$`\\".includes(body[i + 1] || "")) { o += body[i + 1]; i += 2; continue; }
      if (c === "$" && body[i + 1] === "(") {
        let d = 0, j = i + 1;
        for (; j < body.length; j++) { if (body[j] === "(") d++; else if (body[j] === ")") { d--; if (d === 0) break; } }
        o += sh.substitute(body.slice(i, j + 1)); i = j + 1; continue;
      }
      if (c === "$") {
        let m = /^\$\{([A-Za-z_]\w*)(?::?-([^}]*))?\}/.exec(body.slice(i));
        if (m) { o += env[m[1]] !== undefined && env[m[1]] !== "" ? env[m[1]] : (m[2] || ""); i += m[0].length; continue; }
        m = /^\$([A-Za-z_]\w*|\d|[?#@*$])/.exec(body.slice(i));
        if (m) { o += env[m[1]] !== undefined ? env[m[1]] : ""; i += m[0].length; continue; }
      }
      o += c; i++;
    }
    return o;
  }

  // ---------- runner ----------
  const patRegex = pat => new RegExp("^" + pat.replace(/[.+^${}()|\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") + "$");
  const unquote = s => s.replace(/^(["'])([\s\S]*)\1$/, "$2");

  function makeRunner(sh) {
    const R = { out: "", err: "", code: 0, cond: 0 };
    const addErr = e => { if (e) R.err += e; };
    const check = () => {
      if (sh.ctl) { const c = sh.ctl; sh.ctl = null; throw new Sig(c.type, c.n, c.code); }
    };
    const unboundCheck = text => {
      if (!(sh.opts && sh.opts.u)) return null;
      const env = sh.envObject();
      const stripped = text.replace(/'[^']*'/g, "");
      const re = /\$(?:\{([A-Za-z_]\w*)([^}]*)\}|([A-Za-z_]\w*))/g; let m;
      while ((m = re.exec(stripped))) {
        const name = m[1] || m[3]; const mod = m[2] || "";
        if (/^[:]?[-=+?]/.test(mod)) continue;
        if (!(name in env)) return name;
      }
      return null;
    };
    const runTrap = sig => { const tr = sh.traps && sh.traps[sig]; if (tr) { const saved = sh.traps[sig]; delete sh.traps[sig]; try { runText(tr, true); } finally { if (sig !== "EXIT") sh.traps[sig] = saved; } } };
    function runCmdText(text, hd, inCond) {
      let t = text;
      if (sh.opts && sh.opts.x) { const env = sh.envObject(); R.err += "+ " + t.replace(/\$\{?([A-Za-z_]\w*|\d)\}?/g, (m0, nm) => (nm in env ? env[nm] : "")) + "\n"; }
      let negate = false;
      if (/^!\s+/.test(t)) { negate = true; t = t.replace(/^!\s+/, ""); }
      // (( ... )) arithmetic statement
      const am = /^\(\(([\s\S]*)\)\)$/.exec(t);
      let r;
      const bad = unboundCheck(t);
      if (bad) { addErr(`bash: line 1: ${bad}: unbound variable\n`); sh.lastCode = 1; throw new Sig("exit", 1, 1); }
      if (am) r = { code: arithStatement(am[1]) };
      else {
        const files = [];
        if (hd && hd.length) {
          const dir = sh.lookup("/tmp", true) || (sh.mkdirp("/tmp"), sh.lookup("/tmp", true));
          t = t.replace(/__HD(\d+)__/g, (m0, k) => {
            const h = hd[+k]; if (!h) return m0;
            const path = "/tmp/.heredoc" + (++R.cond) + "_" + k;
            const f = sh.createFile(path, h.quoted ? h.body : expandHeredoc(sh, h.body)); if (f) { f.age = 0; files.push(path); }
            return path;
          });
        }
        try { r = sh.execLine(t); } finally { files.forEach(f => { const d = sh.lookup("/tmp", true); if (d) d.children.delete(f.split("/").pop()); }); }
        R.out += r.out || ""; addErr(r.err);
        if (r.handled === false) { addErr("bash: unsupported syntax in sandbox: " + t + "\n"); r.code = 2; }
      }
      let code = r.code || 0;
      if (negate) code = code === 0 ? 1 : 0;
      sh.lastCode = code;
      check();
      if (r.exit !== undefined) throw new Sig("exit", 1, r.exit);
      if (code !== 0 && !inCond) {
        runTrap("ERR");
        if (sh.opts && sh.opts.e && !negate && !/(\|\||&&)/.test(t)) throw new Sig("exit", 1, code);
      }
      return code;
    }
    function arithStatement(expr) {
      expr = expr.trim();
      let m = /^([A-Za-z_]\w*)(\+\+|--)$/.exec(expr) || /^(\+\+|--)([A-Za-z_]\w*)$/.exec(expr);
      if (m) { const [name, op] = /^[A-Za-z_]/.test(m[1]) ? [m[1], m[2]] : [m[2], m[1]]; sh.setVar(name, String(sh.arith(name + (op === "++" ? "+1" : "-1")))); return 0; }
      m = /^([A-Za-z_]\w*)\s*(\+=|-=|\*=|\/=|%=|=)\s*([\s\S]+)$/.exec(expr);
      if (m && !/^=/.test(m[3])) { const v = m[2] === "=" ? sh.arith(m[3]) : sh.arith(m[1] + m[2][0] + "(" + m[3] + ")"); sh.setVar(m[1], String(v)); return v !== 0 ? 0 : 1; }
      return sh.arith(expr) !== 0 ? 0 : 1;
    }
    function expandWords(words) {
      // "$@" becomes one word per positional argument
      words = words.replace(/"\$@"/g, () => sh.positional.slice(1).map(a => "'" + String(a).replace(/'/g, "'\\''") + "'").join(" "));
      const r = sh.execLine("printf '%s\\n' " + words);
      addErr(r.err);
      return (r.out || "").split("\n").filter((x, i, a) => !(i === a.length - 1 && x === ""));
    }
    function runList(nodes, inCond) {
      let code = 0;
      for (const n of nodes) code = runNode(n, inCond);
      return code;
    }
    function suffixed(node, fn) {
      if (!node.suffix) return fn();
      const sfx = node.suffix; const start = R.out.length;
      const code = fn();
      let m = /^(>>?)\s*(\S+)$/.exec(sfx);
      if (m) { const produced = R.out.slice(start); R.out = R.out.slice(0, start); addErr(sh.writeTo(unquote(m[2]), produced, m[1] === ">>")); return code; }
      m = /^\|\s*([\s\S]+)$/.exec(sfx);
      if (m) {
        const produced = R.out.slice(start); R.out = R.out.slice(0, start);
        const tmp = "/tmp/.pipe" + (++R.cond); sh.mkdirp("/tmp"); const f = sh.createFile(tmp, produced);
        try { const r = sh.execLine("cat " + tmp + " | " + m[1]); R.out += r.out || ""; addErr(r.err); return r.code || 0; } finally { const d = sh.lookup("/tmp", true); if (d) d.children.delete(tmp.split("/").pop()); }
      }
      return code;
    }
    function loopBody(body, state) {
      try { runList(body); }
      catch (e) {
        if (!(e instanceof Sig) || (e.type !== "break" && e.type !== "continue")) throw e;
        if (e.n > 1) { throw new Sig(e.type, e.n - 1, e.code); }
        if (e.type === "break") { state.stop = true; }
      }
    }
    function runNode(n, inCond) {
      switch (n.k) {
        case "cmd": return runCmdText(n.t, n.hd, inCond);
        case "func": sh.functions = sh.functions || {}; sh.functions[n.name] = n.body; return 0;
        case "group": return runList(n.body);
        case "if": return suffixed(n, () => {
          for (const b of n.branches) { if (runList(b.cond, true) === 0) return runList(b.body); }
          return n.els ? runList(n.els) : 0;
        });
        case "for": return suffixed(n, () => {
          const st = { stop: false }; let iter = 0;
          if (n.cstyle) {
            if (n.cstyle.init.trim()) arithStatement(n.cstyle.init);
            while (!st.stop && (!n.cstyle.cond.trim() || sh.arith(n.cstyle.cond) !== 0)) {
              if (++iter > LOOP_LIMIT) { addErr("bash: loop exceeded " + LOOP_LIMIT + " iterations (infinite loop?)\n"); throw new Sig("exit", 1, 1); }
              loopBody(n.body, st); if (!st.stop && n.cstyle.step.trim()) arithStatement(n.cstyle.step);
            }
            return sh.lastCode;
          }
          const items = expandWords(n.words);
          for (const it of items) {
            if (st.stop) break;
            if (++iter > LOOP_LIMIT) { addErr("bash: loop exceeded " + LOOP_LIMIT + " iterations\n"); throw new Sig("exit", 1, 1); }
            sh.setVar(n.v, it); loopBody(n.body, st);
          }
          return sh.lastCode;
        });
        case "while": return suffixed(n, () => {
          const st = { stop: false }; let iter = 0;
          const isRead = n.cond.length === 1 && n.cond[0].k === "cmd" && /^read\b/.test(n.cond[0].t);
          let queued = false;
          if (isRead) {
            let src = null;
            if (n.feed) { const r = sh.execLine(n.feed); addErr(r.err); src = r.out || ""; }
            else { const m = /^<\s*(\S+)$/.exec(n.suffix || ""); if (m) { const f = sh.lookup(sh.abs(unquote(m[1])), true); src = f && f.type === "file" ? f.content || "" : ""; n.suffix = ""; } }
            if (src !== null) { sh.stdinQueue = src.split("\n").filter((x, i, a) => !(i === a.length - 1 && x === "")); queued = true; }
          }
          try {
            while (!st.stop) {
              const c = runList(n.cond, true);
              if (n.until ? c === 0 : c !== 0) break;
              if (++iter > LOOP_LIMIT) { addErr("bash: loop exceeded " + LOOP_LIMIT + " iterations (infinite loop? the condition never became false)\n"); throw new Sig("exit", 1, 1); }
              loopBody(n.body, st);
            }
          } finally { if (queued) sh.stdinQueue = null; }
          return 0;
        });
        case "case": return suffixed(n, () => {
          const w = unquote(expandWords(n.word)[0] === undefined ? "" : expandWords(n.word).join(" "));
          for (const c of n.clauses) if (c.pats.some(p => patRegex(unquote(p)).test(w))) return runList(c.body);
          return 0;
        });
      }
      return 0;
    }
    function runText(text, quiet) {
      const nodes = parse(splitStatements(text));
      return runList(nodes);
    }
    R.runText = runText; R.runList = runList; R.runTrap = runTrap;
    return R;
  }

  // Run a script text. `scope` true creates a fresh script scope (set -e etc. do not leak out).
  function runScript(sh, text, o) {
    o = o || {};
    const top = sh.depth === 0;
    const saved = { opts: sh.opts, pipefail: sh.pipefail, traps: sh.traps, functions: sh.functions };
    if (o.fresh) { sh.opts = {}; sh.pipefail = false; sh.traps = {}; sh.functions = {}; }
    let logStart, sysBefore;
    if (top) { sh.depth = 2; logStart = sh.commandLog.length; sysBefore = sh.sys ? sh.sys.beginExec() : null; sh.follow = null; sh.hits = new Set(); sh.lastStat = null; sh.lastNamei = null; sh.lastArchive = null; if (sh.sys) sh.sys.followRequest = null; }
    const R = makeRunner(sh);
    let code = 0, exit;
    sh.ctl = null;
    try {
      try { code = R.runText(text); }
      catch (e) {
        if (e instanceof Sig) { if (e.type === "exit") { exit = e.code; code = e.code; } else if (e.type === "return") code = e.code; else code = 0; }
        else if (e instanceof Error) { R.err += "bash: " + e.message + "\n"; code = 2; }
        else throw e;
      }
      try { R.runTrap("EXIT"); } catch (e) { if (!(e instanceof Sig)) throw e; }
    } finally {
      sh.ctl = null;
      if (o.fresh) { sh.opts = saved.opts; sh.pipefail = saved.pipefail; sh.traps = saved.traps; sh.functions = saved.functions; }
      if (top) sh.depth = 0;
    }
    sh.lastCode = code;
    if (top) {
      if (sh.sys) { sh.sys.finishExec(sysBefore); if (sh.sys.followRequest) { const unit = sh.sys.followRequest.unit; sh.follow = { kind: "journal", unit, next: () => sh.sys.liveEntry(unit) }; } }
      if (sh.pendingErr) { R.err = sh.pendingErr + R.err; sh.pendingErr = ""; }
      sh.lastExec = { line: text, cmds: sh.commandLog.slice(logStart), out: R.out, err: R.err };
    }
    return { handled: true, out: R.out, err: R.err, code, exit };
  }

  P.callFunction = function (name, args, stdin) {
    const body = this.functions[name];
    this.frames = this.frames || [];
    if (this.frames.length > 60) return { out: "", err: `bash: ${name}: maximum function nesting level exceeded\n`, code: 1 };
    const frame = { locals: {} };
    const savedPos = this.positional;
    this.positional = [savedPos[0], ...args];
    this.frames.push(frame);
    const R = makeRunner(this);
    let code = 0, exit;
    const savedQueue = this.stdinQueue;
    if (stdin) this.stdinQueue = stdin.split("\n").filter((x, i, a) => !(i === a.length - 1 && x === ""));
    try { code = R.runList(body); if (this.ctl && this.ctl.type === "return") { code = this.ctl.code; this.ctl = null; } }
    catch (e) {
      if (!(e instanceof Sig)) throw e;
      if (e.type === "return") code = e.code; else if (e.type === "exit") { exit = e.code; code = e.code; } else throw e;
    } finally {
      this.frames.pop(); this.positional = savedPos; this.stdinQueue = savedQueue;
      Object.entries(frame.locals).forEach(([k, v]) => { if (v) this.vars[k] = v; else delete this.vars[k]; });
    }
    return { out: R.out, err: R.err, code, exit };
  };

  const COMPOUND = /^\s*(if|for|while|until|case|function|trap|\{)\b|^\s*\{|\(\(|\(\)\s*\{|;\s*(then|do)\b|\bdone\b|\bfi\b|\besac\b|^\s*set\s+-[a-z]*[euo]|<<-?\s*['"]?[A-Za-z_]|\n/;
  P.scriptHook = {
    isCompound: line => COMPOUND.test(line.trim()),
    run: (sh, line) => runScript(sh, line, {}),
    runText: (sh, text, positional, isolated) => { const r = runScript(sh, text, { fresh: !!isolated }); return { out: r.out, err: r.err, code: r.code }; },
    runFile: (sh, file, content, args) => { const r = sh.runChild(content, [file, ...args]); return { out: r.out, err: r.err, code: r.code, exit: undefined }; }
  };

  // a child shell (bash -c, bash script.sh) starts with fresh options, traps and functions
  const origChild = P.runChild;
  P.runChild = function (text, positional) {
    const saved = { opts: this.opts, pipefail: this.pipefail, traps: this.traps, functions: this.functions };
    this.opts = {}; this.pipefail = false; this.traps = {}; this.functions = {};
    try { return origChild.call(this, text, positional); }
    finally { this.opts = saved.opts; this.pipefail = saved.pipefail; this.traps = saved.traps; this.functions = saved.functions; }
  };
  // bash [-eux] [-n] (-c 'cmd' | script.sh args)
  P.cmd_bash = function (args) {
    let i = 0, flags = "";
    for (; i < args.length && /^-[a-zA-Z]+$/.test(args[i]) && !args[i].includes("c"); i++) flags += args[i].slice(1);
    const ci = args.indexOf("-c");
    let text, positional;
    if (ci !== -1) { text = args[ci + 1] || ""; positional = [args[ci + 2] || "bash", ...args.slice(ci + 3)]; }
    else {
      const file = args[i]; if (!file) return { out: "", code: 0 };
      const n = this.lookup(this.abs(file), true);
      if (!n) return { err: `bash: ${file}: No such file or directory\n`, code: 127 };
      if (n.type === "dir") return { err: `bash: ${file}: Is a directory\n`, code: 126 };
      if (this.enforce && !this.canAccess(n, 4)) return { err: `bash: ${file}: Permission denied\n`, code: 126 };
      text = n.content || ""; positional = [file, ...args.slice(i + 1)];
    }
    if (flags.includes("n")) {
      try { parse(splitStatements(text)); return { out: "", code: 0 }; }
      catch (e) { const where = ci !== -1 ? "bash: -c" : positional[0]; return { err: `${where}: line ${text.split("\n").length}: ${e.message}\n`, code: 2 }; }
    }
    const pre = flags.replace(/[^eux]/g, "");
    const r = this.runChild((pre ? "set -" + pre + "\n" : "") + text, positional);
    return { out: r.out, err: r.err, code: r.code };
  };
  P.cmd_sh = P.cmd_bash;
  VS.scriptInternals = { splitStatements, parse };
})(typeof window !== "undefined" ? window : globalThis);

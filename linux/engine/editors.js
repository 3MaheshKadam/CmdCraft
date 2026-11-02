/**
 * CmdCraft editors: Vim and Nano as key-driven state machines.
 * Feed them keys with ed.key("i"), ed.key("Escape"), ed.key("Ctrl-O")...; read ed.view() to draw them.
 * They only know about a text buffer: the shell supplies onWrite(path, text) -> error string or "".
 *
 *   key names: any single printable character, plus Escape Enter Backspace Delete Tab
 *              ArrowUp ArrowDown ArrowLeft ArrowRight Home End PageUp PageDown and Ctrl-<letter>
 */
(function (root) {
  const splitText = t => (t === "" || t === null || t === undefined ? [""] : t.replace(/\n$/, "").split("\n"));
  const joinText = lines => (lines.length === 1 && lines[0] === "" ? "" : lines.join("\n") + "\n");
  const isWord = c => /\w/.test(c || "");

  // ======================================================= VIM =======================================================
  class VimEditor {
    constructor(path, text, opts) {
      opts = opts || {};
      this.kind = "vim"; this.path = path; this.isNew = !!opts.isNew;
      this.lines = splitText(text); this.noLines = this.lines.length === 1 && this.lines[0] === "" && !(text || "").length; this.cx = 0; this.cy = 0;
      this.mode = "normal"; this.count = ""; this.pending = ""; this.cmd = ""; this.msg = this.isNew ? `"${path}" [New]` : `"${path}" ${this.lines.length}L, ${(text || "").length}B`;
      this.reg = { text: "", line: false }; this.undoStack = []; this.redoStack = [];
      this.modified = false; this.done = false; this.written = false; this.nu = false; this.lastSearch = ""; this.vstart = null;
      this.onWrite = opts.onWrite || (() => ""); this.keyCount = 0; this.exitedBy = null; this.readonly = !!opts.readonly;
    }
    text() { return this.lines.length === 1 && this.lines[0] === "" ? (this.noLines ? "" : "\n") : this.lines.join("\n") + "\n"; }
    snap() { this.undoStack.push({ lines: this.lines.slice(), cx: this.cx, cy: this.cy }); if (this.undoStack.length > 200) this.undoStack.shift(); this.redoStack = []; }
    line() { return this.lines[this.cy]; }
    clamp() {
      this.cy = Math.max(0, Math.min(this.cy, this.lines.length - 1));
      const max = this.mode === "insert" ? this.line().length : Math.max(0, this.line().length - 1);
      this.cx = Math.max(0, Math.min(this.cx, max));
    }
    change() { this.modified = true; }
    key(k) {
      this.keyCount++;
      if (this.done) return;
      if (this.mode === "insert") this.insertKey(k);
      else if (this.mode === "command" || this.mode === "search") this.cmdKey(k);
      else this.normalKey(k);
      this.clamp();
    }
    // ---------------- insert ----------------
    insertKey(k) {
      const L = this.lines; this.noLines = false;
      if (k === "Escape") { this.mode = "normal"; this.cx = Math.max(0, this.cx - 1); this.msg = ""; return; }
      if (k === "Enter") { const l = this.line(); L.splice(this.cy, 1, l.slice(0, this.cx), l.slice(this.cx)); this.cy++; this.cx = 0; this.change(); return; }
      if (k === "Backspace") {
        if (this.cx > 0) { const l = this.line(); L[this.cy] = l.slice(0, this.cx - 1) + l.slice(this.cx); this.cx--; this.change(); }
        else if (this.cy > 0) { const prev = L[this.cy - 1].length; L[this.cy - 1] += L[this.cy]; L.splice(this.cy, 1); this.cy--; this.cx = prev; this.change(); }
        return;
      }
      if (k === "Delete") { const l = this.line(); if (this.cx < l.length) { L[this.cy] = l.slice(0, this.cx) + l.slice(this.cx + 1); this.change(); } return; }
      if (k === "ArrowLeft") { this.cx--; return; } if (k === "ArrowRight") { this.cx++; return; }
      if (k === "ArrowUp") { this.cy--; return; } if (k === "ArrowDown") { this.cy++; return; }
      if (k === "Tab") k = "\t";
      if (k.length === 1) { const l = this.line(); L[this.cy] = l.slice(0, this.cx) + k + l.slice(this.cx); this.cx++; this.change(); }
    }
    // ---------------- command line (: and /) ----------------
    cmdKey(k) {
      if (k === "Escape") { this.mode = "normal"; this.cmd = ""; return; }
      if (k === "Backspace") { if (!this.cmd) { this.mode = "normal"; return; } this.cmd = this.cmd.slice(0, -1); return; }
      if (k === "Enter") { const c = this.cmd, m = this.mode; this.cmd = ""; this.mode = "normal"; if (m === "search") this.doSearch(c, 1); else this.ex(c); return; }
      if (k.length === 1) this.cmd += k;
      if (k === "Tab") this.cmd += "\t";
    }
    doSearch(pat, dir, keep) {
      if (pat) this.lastSearch = pat; pat = this.lastSearch;
      if (!pat) { this.msg = "E35: No previous regular expression"; return; }
      let re; try { re = new RegExp(pat); } catch (e) { re = new RegExp(pat.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")); }
      const n = this.lines.length;
      for (let i = 1; i <= n; i++) {
        const y = ((this.cy + (dir > 0 ? i : -i)) % n + n) % n; const l = this.lines[y];
        if (i === 1 && false) continue;
        const m = dir > 0 ? re.exec(l) : (() => { let last = null, mm; const g = new RegExp(re.source, "g"); while ((mm = g.exec(l))) { last = mm; if (mm[0] === "") g.lastIndex++; } return last; })();
        // same line, match after the cursor
        if (y === this.cy && dir > 0) { const g = new RegExp(re.source, "g"); let mm, hit = null; while ((mm = g.exec(l))) { if (mm.index > this.cx) { hit = mm; break; } if (mm[0] === "") g.lastIndex++; } if (hit) { this.cx = hit.index; this.msg = "/" + pat; return; } continue; }
        if (m) { this.cy = y; this.cx = m.index; this.msg = (dir > 0 ? "/" : "?") + pat; return; }
      }
      this.msg = "E486: Pattern not found: " + pat;
    }
    // ---------------- ex commands ----------------
    ex(raw) {
      let c = raw.trim();
      if (!c) return;
      if (/^\d+$/.test(c)) { this.cy = Math.min(parseInt(c, 10), this.lines.length) - 1; this.cx = 0; return; }
      // optional range
      let r1 = null, r2 = null;
      const addr = s => (s === "." ? this.cy : s === "$" ? this.lines.length - 1 : parseInt(s, 10) - 1);
      let m = /^(%|(\d+|\.|\$)(?:,(\d+|\.|\$))?)/.exec(c);
      if (m) { if (m[1] === "%") { r1 = 0; r2 = this.lines.length - 1; } else { r1 = addr(m[2]); r2 = m[3] ? addr(m[3]) : r1; } c = c.slice(m[0].length).trim(); }
      if (c === "") { if (r1 !== null) { this.cy = r2; this.cx = 0; } return; }
      let mm;
      if ((mm = /^(wq|x|xit|wq!|x!)$/.exec(c))) { if (this.writeFile(null)) this.quit(); return; }
      if ((mm = /^(w|write|w!)(?:\s+(\S+))?$/.exec(c))) { this.writeFile(mm[2] || null); return; }
      if ((mm = /^(q|quit|qa|qall)$/.exec(c))) { if (this.modified) { this.msg = "E37: No write since last change (add ! to override)"; return; } this.quit(); return; }
      if ((mm = /^(q!|quit!|qa!|cq)$/.exec(c))) { this.exitedBy = ":q!"; this.done = true; return; }
      if ((mm = /^set?\s+(.+)$/.exec(c))) {
        mm[1].split(/\s+/).forEach(o => {
          if (o === "nu" || o === "number") this.nu = true; else if (o === "nonu" || o === "nonumber") this.nu = false;
          else if (o === "ic" || o === "ignorecase") this.ic = true; else if (o === "noic") this.ic = false; else if (!/^(hlsearch|hls|incsearch|ai|autoindent|expandtab|et|nohlsearch|nohls|tabstop=\d+|ts=\d+|shiftwidth=\d+|sw=\d+|paste|nopaste|ruler|cursorline|syntax)$/.test(o)) this.msg = "E518: Unknown option: " + o;
        });
        return;
      }
      if ((mm = /^e!$/.exec(c))) { this.msg = "E37: reload not simulated"; return; }
      if (/^noh(lsearch)?$/.test(c)) return;
      if (/^(d|delete)$/.test(c) && r1 === null) r1 = r2 = this.cy;
      if (/^(d|delete)$/.test(c)) { this.snap(); const n = r2 - r1 + 1; this.reg = { text: this.lines.slice(r1, r2 + 1).join("\n"), line: true }; this.lines.splice(r1, n); if (!this.lines.length) { this.lines = [""]; this.noLines = true; } this.cy = Math.min(r1, this.lines.length - 1); this.cx = 0; this.change(); this.msg = n > 1 ? n + " fewer lines" : ""; return; }
      if ((mm = /^(g|v|g!)\/(.*?)\/(d|delete)$/.exec(c))) {
        let re; try { re = new RegExp(mm[2]); } catch (e) { re = new RegExp(mm[2].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")); }
        const invert = mm[1] !== "g"; this.snap(); const before = this.lines.length;
        this.lines = this.lines.filter(l => (re.test(l) ? invert : !invert)); if (!this.lines.length) { this.lines = [""]; this.noLines = true; }
        const gone = before - this.lines.length; if (!gone) this.msg = "E486: Pattern not found: " + mm[2]; else { this.change(); this.msg = gone + " fewer lines"; }
        this.cy = Math.min(this.cy, this.lines.length - 1); return;
      }
      if ((mm = /^s(.)(.*?)\1(.*?)(?:\1([gi]*))?$/.exec(c))) {
        if (r1 === null) r1 = r2 = this.cy;
        const flags = mm[4] || ""; let pat = mm[2];
        pat = pat.replace(/\\</g, "\\b").replace(/\\>/g, "\\b");
        let re; try { re = new RegExp(pat, (flags.includes("g") ? "g" : "") + (flags.includes("i") ? "i" : "")); } catch (e) { re = new RegExp(pat.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), flags.includes("g") ? "g" : ""); }
        const rep = mm[3].replace(/\$/g, "$$$$").replace(/\\(\d)/g, "$$$1").replace(/(^|[^\\])&/g, "$1$$&").replace(/\\&/g, "&");
        this.snap(); let subs = 0, lns = 0;
        for (let y = r1; y <= r2; y++) {
          const before = this.lines[y]; let hit = false;
          const after = before.replace(re, (...a) => { hit = true; subs++; return rep.replace(/\$&/g, a[0]).replace(/\$(\d)/g, (_, d) => (typeof a[+d] === "string" ? a[+d] : "")); });
          if (hit) { lns++; this.lines[y] = after; }
        }
        if (!subs) { this.undoStack.pop(); this.msg = "E486: Pattern not found: " + mm[2]; return; }
        this.change(); this.msg = subs + " substitution" + (subs > 1 ? "s" : "") + " on " + lns + " line" + (lns > 1 ? "s" : ""); this.cy = r2; this.cx = 0; return;
      }
      this.msg = "E492: Not an editor command: " + raw.trim();
    }
    writeFile(name) {
      if (this.readonly && !name) { this.msg = "E45: 'readonly' option is set (add ! to override)"; return false; }
      const target = name || this.path;
      const err = this.onWrite(target, this.text());
      if (err) { this.msg = err; return false; }
      const L = this.lines.length === 1 && this.lines[0] === "" ? 0 : this.lines.length;
      this.msg = `"${target}" ${L}L, ${this.text().length}B written`;
      if (!name || name === this.path) { this.modified = false; this.written = true; }
      this.writtenTo = target;
      return true;
    }
    quit() { this.exitedBy = this.written ? ":wq" : ":q"; this.done = true; }
    // ---------------- normal mode ----------------
    wordFwd(y, x) { const l = this.lines[y]; let i = x; if (isWord(l[i])) while (i < l.length && isWord(l[i])) i++; else if (l[i] !== undefined && !/\s/.test(l[i])) while (i < l.length && !isWord(l[i]) && !/\s/.test(l[i])) i++; while (i < l.length && /\s/.test(l[i])) i++; return i; }
    wordBack(y, x) { const l = this.lines[y]; let i = x; if (i > 0) i--; while (i > 0 && /\s/.test(l[i])) i--; if (isWord(l[i])) while (i > 0 && isWord(l[i - 1])) i--; else while (i > 0 && !isWord(l[i - 1]) && !/\s/.test(l[i - 1])) i--; return i; }
    wordEnd(y, x) { const l = this.lines[y]; let i = Math.min(x + 1, l.length - 1); while (i < l.length - 1 && /\s/.test(l[i])) i++; if (isWord(l[i])) while (i < l.length - 1 && isWord(l[i + 1])) i++; else while (i < l.length - 1 && !isWord(l[i + 1]) && !/\s/.test(l[i + 1])) i++; return i; }
    // returns {line:true,y1,y2} or {x1,x2} (x2 exclusive) or null
    motion(k, n, forOp) {
      const cnt = n || 1; const l = this.line();
      switch (k) {
        case "w": { let x = this.cx, y = this.cy; for (let i = 0; i < cnt; i++) { const nx = this.wordFwd(y, x); if (nx >= this.lines[y].length && y < this.lines.length - 1 && !forOp) { y++; x = 0; while (x < this.lines[y].length && /\s/.test(this.lines[y][x])) x++; } else x = nx; } return forOp ? { x1: this.cx, x2: Math.min(x, this.lines[this.cy].length), y } : { x, y }; }
        case "b": { let x = this.cx, y = this.cy; for (let i = 0; i < cnt; i++) { if (x === 0 && y > 0) { y--; x = this.lines[y].length; } x = this.wordBack(y, x); } return forOp ? { x1: x, x2: this.cx, y: this.cy } : { x, y }; }
        case "e": { let x = this.cx; for (let i = 0; i < cnt; i++) x = this.wordEnd(this.cy, x); return forOp ? { x1: this.cx, x2: x + 1, y: this.cy } : { x, y: this.cy }; }
        case "$": return forOp ? { x1: this.cx, x2: l.length, y: this.cy } : { x: Math.max(0, l.length - 1), y: Math.min(this.lines.length - 1, this.cy + cnt - 1) };
        case "0": return forOp ? { x1: 0, x2: this.cx, y: this.cy } : { x: 0, y: this.cy };
        case "^": { const f = l.search(/\S/); const x = f < 0 ? 0 : f; return forOp ? { x1: Math.min(x, this.cx), x2: Math.max(x, this.cx), y: this.cy } : { x, y: this.cy }; }
        case "h": case "ArrowLeft": return forOp ? { x1: Math.max(0, this.cx - cnt), x2: this.cx, y: this.cy } : { x: Math.max(0, this.cx - cnt), y: this.cy };
        case "l": case "ArrowRight": return forOp ? { x1: this.cx, x2: Math.min(l.length, this.cx + cnt), y: this.cy } : { x: Math.min(Math.max(0, l.length - 1), this.cx + cnt), y: this.cy };
        case "j": case "ArrowDown": return { line: true, y1: this.cy, y2: Math.min(this.lines.length - 1, this.cy + cnt), y: Math.min(this.lines.length - 1, this.cy + cnt), x: this.cx };
        case "k": case "ArrowUp": return { line: true, y1: Math.max(0, this.cy - cnt), y2: this.cy, y: Math.max(0, this.cy - cnt), x: this.cx };
        case "G": { const y = n ? Math.min(n, this.lines.length) - 1 : this.lines.length - 1; return { line: true, y1: Math.min(y, this.cy), y2: Math.max(y, this.cy), y, x: 0 }; }
        case "}": { let y = this.cy + 1; while (y < this.lines.length && this.lines[y].trim() !== "") y++; y = Math.min(y, this.lines.length - 1); return { line: true, y1: this.cy, y2: y, y, x: 0 }; }
        case "{": { let y = this.cy - 1; while (y > 0 && this.lines[y].trim() !== "") y--; y = Math.max(y, 0); return { line: true, y1: y, y2: this.cy, y, x: 0 }; }
      }
      return null;
    }
    normalKey(k) {
      this.msg = this.msg && /^(E\d+|\d+ (substitution|fewer))/.test(this.msg) && this.keyCount % 1000 === 0 ? "" : this.msg;
      if (k === "Escape") { this.pending = ""; this.count = ""; if (this.mode === "visual") { this.mode = "normal"; this.vstart = null; } this.msg = ""; return; }
      const p = this.pending;
      if (p === "r") { this.pending = ""; if (k.length === 1) { const n = parseInt(this.count || "1", 10); this.count = ""; const l = this.line(); if (this.cx + n <= l.length) { this.snap(); this.lines[this.cy] = l.slice(0, this.cx) + k.repeat(n) + l.slice(this.cx + n); this.cx += n - 1; this.change(); } } return; }
      if (/^[1-9]$/.test(k) || (k === "0" && this.count !== "")) { this.count += k; return; }
      const n = this.count ? parseInt(this.count, 10) : null;
      if (p === "g") { this.pending = ""; this.count = ""; if (k === "g") { this.cy = n ? Math.min(n, this.lines.length) - 1 : 0; this.cx = 0; } return; }
      if (p === "Z") { this.pending = ""; this.count = ""; if (k === "Z") { if (this.writeFile(null)) this.quit(); } else if (k === "Q") { this.exitedBy = "ZQ"; this.done = true; } return; }
      if (p === ">" || p === "<") { this.pending = ""; this.count = ""; if (k === p) { this.snap(); const c = n || 1; for (let i = 0; i < c && this.cy + i < this.lines.length; i++) { const y = this.cy + i; this.lines[y] = p === ">" ? "    " + this.lines[y] : this.lines[y].replace(/^( {1,4}|\t)/, ""); } this.change(); } return; }
      if (p === "d" || p === "y" || p === "c") { this.pending = ""; this.count = ""; this.operate(p, k, n); return; }
      if (this.mode === "visual") { this.visualKey(k, n); return; }
      this.count = "";
      const c = n || 1;
      switch (k) {
        case "i": this.snap(); this.mode = "insert"; this.msg = "-- INSERT --"; return;
        case "a": this.snap(); this.mode = "insert"; this.cx = Math.min(this.line().length, this.cx + 1); this.msg = "-- INSERT --"; return;
        case "I": this.snap(); this.mode = "insert"; { const f = this.line().search(/\S/); this.cx = f < 0 ? 0 : f; } this.msg = "-- INSERT --"; return;
        case "A": this.snap(); this.mode = "insert"; this.cx = this.line().length; this.msg = "-- INSERT --"; return;
        case "o": this.snap(); this.lines.splice(this.cy + 1, 0, ""); this.cy++; this.cx = 0; this.mode = "insert"; this.msg = "-- INSERT --"; this.change(); return;
        case "O": this.snap(); this.lines.splice(this.cy, 0, ""); this.cx = 0; this.mode = "insert"; this.msg = "-- INSERT --"; this.change(); return;
        case "s": this.snap(); { const l = this.line(); this.reg = { text: l.slice(this.cx, this.cx + c), line: false }; this.lines[this.cy] = l.slice(0, this.cx) + l.slice(this.cx + c); } this.mode = "insert"; this.change(); this.msg = "-- INSERT --"; return;
        case "S": this.snap(); this.reg = { text: this.line(), line: true }; this.lines[this.cy] = ""; this.cx = 0; this.mode = "insert"; this.change(); this.msg = "-- INSERT --"; return;
        case "C": this.snap(); { const l = this.line(); this.reg = { text: l.slice(this.cx), line: false }; this.lines[this.cy] = l.slice(0, this.cx); } this.mode = "insert"; this.change(); this.msg = "-- INSERT --"; return;
        case "D": this.snap(); { const l = this.line(); this.reg = { text: l.slice(this.cx), line: false }; this.lines[this.cy] = l.slice(0, this.cx); } this.change(); return;
        case "x": case "Delete": { const l = this.line(); if (!l.length) return; this.snap(); this.reg = { text: l.slice(this.cx, this.cx + c), line: false }; this.lines[this.cy] = l.slice(0, this.cx) + l.slice(this.cx + c); this.change(); return; }
        case "X": { if (this.cx === 0) return; this.snap(); const l = this.line(); const s = Math.max(0, this.cx - c); this.reg = { text: l.slice(s, this.cx), line: false }; this.lines[this.cy] = l.slice(0, s) + l.slice(this.cx); this.cx = s; this.change(); return; }
        case "r": this.pending = "r"; this.count = n ? String(n) : ""; return;
        case "d": case "y": case "c": case ">": case "<": case "g": case "Z": this.pending = k; this.count = n ? String(n) : ""; return;
        case "Y": this.operate("y", "y", n); return;
        case "p": case "P": this.paste(k === "p", c); return;
        case "J": { if (this.cy >= this.lines.length - 1) return; this.snap(); const a = this.line(), b = this.lines[this.cy + 1].replace(/^\s+/, ""); this.cx = a.length; this.lines[this.cy] = a + (a && b ? " " : "") + b; this.lines.splice(this.cy + 1, 1); this.change(); return; }
        case "~": { const l = this.line(); if (!l.length) return; this.snap(); const ch = l[this.cx]; this.lines[this.cy] = l.slice(0, this.cx) + (ch === ch.toUpperCase() ? ch.toLowerCase() : ch.toUpperCase()) + l.slice(this.cx + 1); this.cx++; this.change(); return; }
        case "u": { const s = this.undoStack.pop(); if (!s) { this.msg = "Already at oldest change"; return; } this.redoStack.push({ lines: this.lines.slice(), cx: this.cx, cy: this.cy }); this.lines = s.lines; this.cx = s.cx; this.cy = s.cy; this.msg = "1 change; before #1"; this.modified = this.undoStack.length > 0; return; }
        case "Ctrl-R": { const s = this.redoStack.pop(); if (!s) { this.msg = "Already at newest change"; return; } this.undoStack.push({ lines: this.lines.slice(), cx: this.cx, cy: this.cy }); this.lines = s.lines; this.cx = s.cx; this.cy = s.cy; this.modified = true; return; }
        case ":": this.mode = "command"; this.cmd = ""; this.msg = ""; return;
        case "/": this.mode = "search"; this.cmd = ""; this.msg = ""; return;
        case "n": this.doSearch("", 1); return;
        case "N": this.doSearch("", -1); return;
        case "V": this.mode = "visual"; this.vstart = this.cy; this.msg = "-- VISUAL LINE --"; return;
        case "Home": this.cx = 0; return; case "End": this.cx = Math.max(0, this.line().length - 1); return;
        case "Ctrl-F": case "PageDown": this.cy = Math.min(this.lines.length - 1, this.cy + 20); return;
        case "Ctrl-B": case "PageUp": this.cy = Math.max(0, this.cy - 20); return;
      }
      const mo = this.motion(k, n, false);
      if (mo) { this.cx = mo.x !== undefined ? mo.x : this.cx; this.cy = mo.y !== undefined ? mo.y : this.cy; }
    }
    visualKey(k, n) {
      const mo = this.motion(k, n, false);
      if (mo && (k === "j" || k === "k" || k === "G" || k === "ArrowDown" || k === "ArrowUp")) { this.cy = mo.y; return; }
      if (k === "g") { this.pending = "g"; return; }
      const y1 = Math.min(this.vstart, this.cy), y2 = Math.max(this.vstart, this.cy);
      if (k === "d" || k === "x" || k === "y" || k === ">" || k === "<") {
        this.mode = "normal"; this.msg = ""; this.vstart = null;
        if (k === "y") { this.reg = { text: this.lines.slice(y1, y2 + 1).join("\n"), line: true }; this.cy = y1; return; }
        this.snap();
        if (k === ">" || k === "<") { for (let y = y1; y <= y2; y++) this.lines[y] = k === ">" ? "    " + this.lines[y] : this.lines[y].replace(/^( {1,4}|\t)/, ""); this.cy = y1; this.change(); return; }
        this.reg = { text: this.lines.slice(y1, y2 + 1).join("\n"), line: true }; this.lines.splice(y1, y2 - y1 + 1); if (!this.lines.length) { this.lines = [""]; this.noLines = true; } this.cy = Math.min(y1, this.lines.length - 1); this.cx = 0; this.change(); return;
      }
    }
    operate(op, k, n) {
      const c = n || 1;
      let range;
      if (k === op) range = { line: true, y1: this.cy, y2: Math.min(this.lines.length - 1, this.cy + c - 1) };
      else if (k === "g") { this.pending = "g"; return; }
      else range = (op === "c" && k === "w" && !/s/.test(this.line()[this.cx] || " ")) ? this.motion("e", n, true) : this.motion(k, n, true);
      if (!range) return;
      if (range.line) {
        let { y1, y2 } = range; if (k === "j" || k === "k" || k === "ArrowDown" || k === "ArrowUp" || k === "G" || k === "}" || k === "{") { /* inclusive of both lines */ }
        this.reg = { text: this.lines.slice(y1, y2 + 1).join("\n"), line: true };
        if (op === "y") { this.cy = y1; this.msg = (y2 - y1 + 1) > 2 ? (y2 - y1 + 1) + " lines yanked" : ""; return; }
        this.snap();
        if (op === "c") { this.lines.splice(y1, y2 - y1 + 1, ""); this.cy = y1; this.cx = 0; this.mode = "insert"; this.msg = "-- INSERT --"; this.change(); return; }
        this.lines.splice(y1, y2 - y1 + 1); if (!this.lines.length) { this.lines = [""]; this.noLines = true; } this.cy = Math.min(y1, this.lines.length - 1); this.cx = 0; this.change();
        if (y2 - y1 + 1 > 2) this.msg = (y2 - y1 + 1) + " fewer lines";
        return;
      }
      const l = this.lines[this.cy]; const x1 = Math.max(0, range.x1), x2 = Math.max(x1, Math.min(l.length, range.x2));
      this.reg = { text: l.slice(x1, x2), line: false };
      if (op === "y") { this.cx = x1; return; }
      this.snap(); this.lines[this.cy] = l.slice(0, x1) + l.slice(x2); this.cx = x1; this.change();
      if (op === "c") { this.mode = "insert"; this.msg = "-- INSERT --"; }
    }
    paste(after, c) {
      if (!this.reg.text && !this.reg.line) return;
      this.snap();
      if (this.reg.line) { const rows = this.reg.text.split("\n"); let all = []; for (let i = 0; i < c; i++) all = all.concat(rows); const at = after ? this.cy + 1 : this.cy; this.lines.splice(at, 0, ...all); this.cy = at; this.cx = 0; }
      else { const l = this.line(); const at = after ? Math.min(l.length, this.cx + 1) : this.cx; const t = this.reg.text.repeat(c); this.lines[this.cy] = l.slice(0, at) + t + l.slice(at); this.cx = at + t.length - 1; }
      this.change();
    }
    view() {
      const sel = this.mode === "visual" ? [Math.min(this.vstart, this.cy), Math.max(this.vstart, this.cy)] : null;
      let status = this.mode === "command" ? ":" + this.cmd : this.mode === "search" ? "/" + this.cmd : (this.mode === "insert" ? "-- INSERT --" : this.mode === "visual" ? "-- VISUAL LINE --" : this.msg);
      if (this.mode === "insert" && this.msg && !/^-- INSERT/.test(this.msg)) status = this.msg;
      return { kind: "vim", lines: this.lines, cx: this.cx, cy: this.cy, nu: this.nu, status, ruler: `${this.cy + 1},${this.cx + 1}`, mode: this.mode, sel, title: this.path, modified: this.modified, tildes: true, pendingKeys: (this.count || "") + (this.pending || "") };
    }
  }

  // ======================================================= NANO =======================================================
  class NanoEditor {
    constructor(path, text, opts) {
      opts = opts || {};
      this.kind = "nano"; this.path = path; this.isNew = !!opts.isNew;
      this.lines = splitText(text); this.cx = 0; this.cy = 0; this.modified = false; this.done = false; this.written = false;
      this.prompt = null; this.cut = []; this.msg = this.isNew ? "[ New File ]" : `[ Read ${this.lines.length} lines ]`; this.help = false; this.lastSearch = "";
      this.onWrite = opts.onWrite || (() => ""); this.exitedBy = null; this.keyCount = 0;
    }
    text() { return joinText(this.lines); }
    line() { return this.lines[this.cy]; }
    clamp() { this.cy = Math.max(0, Math.min(this.cy, this.lines.length - 1)); this.cx = Math.max(0, Math.min(this.cx, this.line().length)); }
    key(k) {
      this.keyCount++;
      if (this.done) return;
      if (this.help) { this.help = false; return; }
      if (this.prompt) this.promptKey(k); else this.editKey(k);
      this.clamp();
    }
    startPrompt(type, label, input) { this.prompt = { type, label, input: input || "" }; this.msg = ""; }
    editKey(k) {
      const L = this.lines; this.msg = "";
      switch (k) {
        case "Ctrl-O": this.startPrompt("write", "File Name to Write", this.path); return;
        case "Ctrl-X": if (this.modified) this.startPrompt("save", "Save modified buffer?"); else { this.exitedBy = "Ctrl-X"; this.done = true; } return;
        case "Ctrl-K": { this.cut = [L[this.cy]]; if (L.length > 1) L.splice(this.cy, 1); else L[0] = ""; this.modified = true; this.msg = ""; return; }
        case "Ctrl-U": { if (!this.cut.length) { this.msg = "[ Cutbuffer is empty ]"; return; } L.splice(this.cy, 0, ...this.cut); this.cy += this.cut.length; this.cx = 0; this.modified = true; return; }
        case "Ctrl-W": this.startPrompt("search", "Search", ""); return;
        case "Ctrl-_": case "Ctrl-/": this.startPrompt("goto", "Enter line number", ""); return;
        case "Ctrl-G": this.help = true; return;
        case "Ctrl-A": case "Home": this.cx = 0; return;
        case "Ctrl-E": case "End": this.cx = this.line().length; return;
        case "Ctrl-Y": case "PageUp": this.cy = Math.max(0, this.cy - 20); return;
        case "Ctrl-V": case "PageDown": this.cy = Math.min(L.length - 1, this.cy + 20); return;
        case "Ctrl-C": this.msg = `line ${this.cy + 1}/${L.length} (${Math.round(100 * (this.cy + 1) / L.length)}%), col ${this.cx + 1}/${this.line().length + 1}`; return;
        case "ArrowLeft": if (this.cx > 0) this.cx--; else if (this.cy > 0) { this.cy--; this.cx = L[this.cy].length; } return;
        case "ArrowRight": if (this.cx < this.line().length) this.cx++; else if (this.cy < L.length - 1) { this.cy++; this.cx = 0; } return;
        case "ArrowUp": this.cy--; return; case "ArrowDown": this.cy++; return;
        case "Enter": { const l = this.line(); L.splice(this.cy, 1, l.slice(0, this.cx), l.slice(this.cx)); this.cy++; this.cx = 0; this.modified = true; return; }
        case "Backspace": case "Ctrl-H":
          if (this.cx > 0) { const l = this.line(); L[this.cy] = l.slice(0, this.cx - 1) + l.slice(this.cx); this.cx--; this.modified = true; }
          else if (this.cy > 0) { const prev = L[this.cy - 1].length; L[this.cy - 1] += L[this.cy]; L.splice(this.cy, 1); this.cy--; this.cx = prev; this.modified = true; }
          return;
        case "Delete": case "Ctrl-D": { const l = this.line(); if (this.cx < l.length) { L[this.cy] = l.slice(0, this.cx) + l.slice(this.cx + 1); this.modified = true; } else if (this.cy < L.length - 1) { L[this.cy] += L[this.cy + 1]; L.splice(this.cy + 1, 1); this.modified = true; } return; }
        case "Tab": k = "\t"; break;
      }
      if (k.length === 1) { const l = this.line(); L[this.cy] = l.slice(0, this.cx) + k + l.slice(this.cx); this.cx++; this.modified = true; }
    }
    promptKey(k) {
      const p = this.prompt;
      if (p.type === "save") {
        if (k === "Ctrl-C" || k === "Escape") { this.prompt = null; this.msg = "[ Cancelled ]"; return; }
        if (/^[yY]$/.test(k)) { this.startPrompt("write-exit", "File Name to Write", this.path); return; }
        if (/^[nN]$/.test(k)) { this.prompt = null; this.exitedBy = "Ctrl-X n"; this.done = true; }
        return;
      }
      if (k === "Ctrl-C" || k === "Escape") { this.prompt = null; this.msg = "[ Cancelled ]"; return; }
      if (k === "Backspace") { p.input = p.input.slice(0, -1); return; }
      if (k === "Enter") {
        const val = p.input.trim(); this.prompt = null;
        if (p.type === "write" || p.type === "write-exit") {
          const target = val || this.path;
          const err = this.onWrite(target, this.text());
          if (err) { this.msg = err; if (p.type === "write-exit") this.prompt = null; return; }
          this.modified = false; this.written = true; this.msg = `[ Wrote ${this.lines.length} line${this.lines.length === 1 ? "" : "s"} ]`;
          if (p.type === "write-exit") { this.exitedBy = "Ctrl-X y"; this.done = true; }
        } else if (p.type === "search") {
          const pat = val || this.lastSearch; this.lastSearch = pat;
          const n = this.lines.length;
          for (let i = 0; i <= n; i++) {
            const y = (this.cy + i) % n; const from = i === 0 ? this.cx + 1 : 0;
            const idx = this.lines[y].indexOf(pat, from);
            if (idx >= 0 && pat) { this.cy = y; this.cx = idx; return; }
          }
          this.msg = `"${pat}" not found`;
        } else if (p.type === "goto") {
          const nn = parseInt(val, 10); if (!isNaN(nn)) { this.cy = Math.max(0, Math.min(nn - 1, this.lines.length - 1)); this.cx = 0; }
        }
        return;
      }
      if (k.length === 1) p.input += k;
    }
    view() {
      const bar1 = [["^G", "Help"], ["^O", "Write Out"], ["^W", "Where Is"], ["^K", "Cut"], ["^T", "Execute"], ["^C", "Location"]];
      const bar2 = [["^X", "Exit"], ["^R", "Read File"], ["^\\", "Replace"], ["^U", "Paste"], ["^J", "Justify"], ["^/", "Go To Line"]];
      let msg = this.msg;
      if (this.prompt) msg = this.prompt.type === "save" ? "Save modified buffer?  (Y)es  (N)o  ^C Cancel" : this.prompt.label + ": " + this.prompt.input;
      return { kind: "nano", lines: this.lines, cx: this.cx, cy: this.cy, nu: false, title: this.path, modified: this.modified, status: msg, bar: this.prompt && this.prompt.type === "save" ? [[["Y", "Yes"], ["N", "No"], ["^C", "Cancel"]]] : [bar1, bar2], mode: this.prompt ? "prompt" : "edit", help: this.help };
    }
  }

  // ---------- helpers ----------
  // "ihello<Esc>:wq<CR>" -> key names. <Esc> <CR> <BS> <Tab> <Del> <C-o> <Up> <Down> <Left> <Right> <lt>
  function parseKeys(s) {
    const out = []; let i = 0;
    const named = { Esc: "Escape", CR: "Enter", Enter: "Enter", BS: "Backspace", Tab: "Tab", Del: "Delete", Up: "ArrowUp", Down: "ArrowDown", Left: "ArrowLeft", Right: "ArrowRight", Home: "Home", End: "End", lt: "<", Space: " " };
    while (i < s.length) {
      if (s[i] === "<") {
        const j = s.indexOf(">", i);
        if (j > i) {
          const name = s.slice(i + 1, j);
          if (named[name]) { out.push(named[name]); i = j + 1; continue; }
          const m = /^C-(.)$/i.exec(name); if (m) { out.push("Ctrl-" + (m[1] === "_" || m[1] === "/" ? m[1] : m[1].toUpperCase())); i = j + 1; continue; }
        }
      }
      out.push(s[i]); i++;
    }
    return out;
  }
  function runKeys(ed, s) { parseKeys(s).forEach(k => ed.key(k)); return ed; }

  root.Editors = { VimEditor, NanoEditor, parseKeys, runKeys, joinText, splitText };
  if (typeof module !== "undefined") module.exports = root.Editors;
})(typeof window !== "undefined" ? window : globalThis);

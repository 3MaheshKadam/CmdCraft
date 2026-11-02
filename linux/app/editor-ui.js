/**
 * CmdCraft editor overlay: draws a Vim or Nano session (editors.js) over the terminal and feeds it the keyboard.
 *   EditorUI.open(sh, host, onClose)  - host is the element to cover (position: relative)
 * Real keyboard shortcuts the browser reserves (Ctrl-W, Ctrl-T...) have on-screen buttons as well.
 */
(function (root) {
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

  const CHEAT = {
    vim: [
      ["Modes", "i insert · Esc back to normal · : command line · v/V select"],
      ["Move", "h j k l · w b · 0 $ · gg G · 5G or :5 jumps to line 5"],
      ["Edit", "x delete char · dd delete line · yy copy · p paste · u undo · Ctrl-R redo · cw change word"],
      ["Counts", "3dd deletes 3 lines · 2yy copies 2 · 5x deletes 5 chars"],
      ["Search", "/word Enter · n next · N previous · :%s/old/new/g replaces everywhere"],
      ["Save/Quit", ":w save · :q quit · :wq or ZZ save+quit · :q! quit WITHOUT saving"]
    ],
    nano: [
      ["Type", "Just type. Arrow keys move. Enter = new line."],
      ["Save", "Ctrl-O (Write Out), check the file name, press Enter"],
      ["Exit", "Ctrl-X. If you changed something it asks: Y = save, N = discard"],
      ["Cut/Paste", "Ctrl-K cuts the current line · Ctrl-U pastes it"],
      ["Search", "Ctrl-W then the text, Enter"],
      ["Go to line", "Ctrl-_ (or the Go To Line button), type the number, Enter"]
    ]
  };
  const VIM_CHIPS = [["Esc", "Escape"], ["Enter", "Enter"], ["Tab", "Tab"], ["←", "ArrowLeft"], ["↓", "ArrowDown"], ["↑", "ArrowUp"], ["→", "ArrowRight"], ["Bksp", "Backspace"], ["Del", "Delete"], ["Ctrl-R", "Ctrl-R"]];
  const NANO_CHIPS = [["^O", "Ctrl-O"], ["^X", "Ctrl-X"], ["^K", "Ctrl-K"], ["^U", "Ctrl-U"], ["^W", "Ctrl-W"], ["^_", "Ctrl-_"], ["^G", "Ctrl-G"], ["^C", "Ctrl-C"], ["Enter", "Enter"], ["←", "ArrowLeft"], ["↓", "ArrowDown"], ["↑", "ArrowUp"], ["→", "ArrowRight"], ["Bksp", "Backspace"]];

  function keyName(e) {
    const k = e.key;
    if (e.ctrlKey && !e.altKey && k.length === 1) return "Ctrl-" + (k === "_" || k === "/" ? k : k.toUpperCase());
    if (e.ctrlKey && k === "-") return "Ctrl-_";
    if (k === " ") return " ";
    if (k.length === 1) return k;
    const map = { Escape: "Escape", Enter: "Enter", Backspace: "Backspace", Delete: "Delete", Tab: "Tab", ArrowUp: "ArrowUp", ArrowDown: "ArrowDown", ArrowLeft: "ArrowLeft", ArrowRight: "ArrowRight", Home: "Home", End: "End", PageUp: "PageUp", PageDown: "PageDown" };
    return map[k] || null;
  }

  function open(sh, host, onClose) {
    const ed = sh.openEditor();
    if (!ed) { onClose && onClose(); return null; }
    const isVim = ed.kind === "vim";
    const wrap = el("div", "absolute inset-0 z-40 flex flex-col bg-black text-neutral-100 font-mono text-[13px] leading-5");
    wrap.setAttribute("tabindex", "0");
    wrap.setAttribute("role", "application");
    wrap.setAttribute("aria-label", (isVim ? "Vim" : "Nano") + " editor simulator");

    const top = el("div", "flex items-center justify-between gap-2 px-3 py-1.5 border-b border-neutral-800 bg-neutral-950 text-[11px]");
    top.appendChild(el("span", "text-neutral-400 truncate", (isVim ? "vim simulator" : "nano simulator") + " · " + (ed.path || "[No Name]")));
    const tools = el("div", "flex items-center gap-1.5 shrink-0");
    const helpBtn = el("button", "px-2 py-0.5 rounded border border-neutral-700 text-neutral-300 hover:text-white hover:border-neutral-500", "Cheat sheet");
    const quitBtn = el("button", "px-2 py-0.5 rounded border border-red-500/40 text-red-300 hover:bg-red-500/10", "I'm stuck: quit without saving");
    helpBtn.type = quitBtn.type = "button"; tools.appendChild(helpBtn); tools.appendChild(quitBtn); top.appendChild(tools);
    wrap.appendChild(top);

    const cheat = el("div", "hidden px-3 py-2 border-b border-neutral-800 bg-neutral-950 text-[11px] text-neutral-300 space-y-0.5");
    CHEAT[ed.kind].forEach(([a, b]) => { const r = el("div", "flex gap-2"); r.appendChild(el("span", "w-20 shrink-0 text-emerald-400", a)); r.appendChild(el("span", "", b)); cheat.appendChild(r); });
    wrap.appendChild(cheat);

    const screen = el("div", "flex-1 min-h-0 overflow-hidden px-3 py-2 whitespace-pre select-none");
    wrap.appendChild(screen);
    const status = el("div", "px-3 py-1 border-t border-neutral-800 text-[12px] whitespace-pre overflow-hidden");
    wrap.appendChild(status);
    const bars = el("div", "px-2 py-1 bg-neutral-900 text-[11px]");
    if (!isVim) wrap.appendChild(bars);

    const chips = el("div", "flex flex-wrap gap-1 px-2 py-1.5 border-t border-neutral-800 bg-neutral-950");
    (isVim ? VIM_CHIPS : NANO_CHIPS).forEach(([label, key]) => {
      const b = el("button", "px-2 py-0.5 rounded border border-neutral-700 text-neutral-300 text-[11px] hover:border-emerald-400 hover:text-white", label);
      b.type = "button"; b.addEventListener("mousedown", e => e.preventDefault()); b.addEventListener("click", () => press(key)); chips.appendChild(b);
    });
    wrap.appendChild(chips);
    const mobile = el("input", "absolute opacity-0 w-px h-px -z-10"); mobile.setAttribute("aria-hidden", "true"); mobile.autocapitalize = "off"; mobile.autocomplete = "off"; mobile.spellcheck = false;
    wrap.appendChild(mobile);

    // as many text rows as fit the panel (a phone shows fewer than a desktop)
    const rowsNow = () => (screen.clientHeight > 60 ? Math.max(5, Math.floor((screen.clientHeight - 16) / 20)) : 16);
    function draw() {
      const v = ed.view();
      const ROWS = rowsNow();
      const total = v.lines.length;
      let start = Math.max(0, Math.min(v.cy - Math.floor(ROWS / 2), total - ROWS)); if (start < 0) start = 0;
      const frag = document.createDocumentFragment();
      const numW = v.nu ? String(total).length + 1 : 0;
      for (let i = 0; i < ROWS; i++) {
        const y = start + i; const row = el("div", "min-h-[20px]");
        if (y >= total) { if (v.tildes) row.appendChild(el("span", "text-sky-500", "~")); frag.appendChild(row); continue; }
        const text = v.lines[y];
        if (v.nu) row.appendChild(el("span", "text-amber-400", String(y + 1).padStart(numW - 1) + " "));
        const selected = v.sel && y >= v.sel[0] && y <= v.sel[1];
        if (y === v.cy) {
          const cx = Math.min(v.cx, text.length);
          const before = el("span", selected ? "bg-neutral-700" : "", text.slice(0, cx));
          const cur = el("span", (v.mode === "insert" || v.kind === "nano") ? "border-l-2 border-emerald-400" : "bg-emerald-400 text-black", text[cx] !== undefined ? text[cx] : " ");
          const after = el("span", selected ? "bg-neutral-700" : "", text.slice(cx + 1));
          row.appendChild(before); row.appendChild(cur); row.appendChild(after);
        } else row.appendChild(el("span", selected ? "bg-neutral-700" : "", text || (selected ? " " : "")));
        frag.appendChild(row);
      }
      screen.replaceChildren(frag);
      if (isVim) status.textContent = (v.status || "").padEnd(40) + "   " + (v.pendingKeys || "").padEnd(6) + v.ruler;
      else {
        status.textContent = v.help ? "Help: Ctrl-O saves, Ctrl-X exits (Y saves, N discards), Ctrl-K cuts, Ctrl-U pastes. Press any key." : v.status || "";
        status.className = "px-3 py-1 text-[12px] whitespace-pre overflow-hidden text-center " + (v.mode === "prompt" ? "bg-neutral-100 text-black" : "text-neutral-300");
        const f = document.createDocumentFragment();
        v.bar.forEach(row => { const r = el("div", "flex gap-3 flex-wrap"); row.forEach(([k, l]) => { const s = el("span", ""); const kk = el("span", "bg-neutral-100 text-black px-1", k); s.appendChild(kk); s.appendChild(document.createTextNode(" " + l)); r.appendChild(s); }); f.appendChild(r); });
        bars.replaceChildren(f);
      }
      top.firstChild.textContent = (isVim ? "vim simulator" : "GNU nano simulator") + " · " + (ed.path || "[No Name]") + (v.modified ? (isVim ? " [+]" : " · Modified") : "");
    }
    let closed = false;
    function close() {
      if (closed) return; closed = true;
      document.removeEventListener("keydown", onKey, true);
      wrap.remove();
      sh.finishEditor(ed);
      onClose && onClose(ed);
    }
    function press(k) { if (closed) return; ed.key(k); draw(); if (ed.done) setTimeout(close, 120); wrap.focus(); }
    function onKey(e) {
      if (closed) return;
      if (e.metaKey || (e.altKey && e.key.length > 1)) return;
      if ((e.ctrlKey && (e.key === "l" || e.key === "L")) || (e.ctrlKey && e.shiftKey)) return;
      if (e.target === mobile && e.key.length === 1 && !e.ctrlKey) return;   // typed characters arrive through the input event
      const k = keyName(e);
      if (!k) return;
      e.preventDefault(); e.stopPropagation();
      press(k);
    }
    mobile.addEventListener("input", () => { const v = mobile.value; mobile.value = ""; for (const ch of v) press(ch); });
    document.addEventListener("keydown", onKey, true);
    helpBtn.addEventListener("click", () => { cheat.classList.toggle("hidden"); wrap.focus(); });
    quitBtn.addEventListener("click", () => { ed.exitedBy = "forced"; ed.done = true; close(); });
    wrap.addEventListener("click", () => { wrap.focus(); mobile.focus({ preventScroll: true }); });
    host.appendChild(wrap);
    window.addEventListener("resize", () => { if (!closed) draw(); });
    draw();
    wrap.focus();
    return { ed, close };
  }
  root.EditorUI = { open };
})(typeof window !== "undefined" ? window : globalThis);

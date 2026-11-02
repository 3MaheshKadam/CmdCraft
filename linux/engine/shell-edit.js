/**
 * CmdCraft shell, part 6: vim / vi / view / nano / crontab -e / visudo.
 * The command only *requests* an editor (sh.pendingEditor). The page opens a full-screen editor overlay for it; when
 * the learner quits, sh.finishEditor() records the session so the scenario goal can look at the saved file.
 * Tests and the solution check drive the same editors headlessly with sh.editorScript("ihello<Esc>:wq<CR>").
 */
(function (root) {
  const VS = root.VirtualShell;
  if (!VS) return;
  const P = VS.prototype;
  ["vim", "vi", "view", "nano", "visudo", "vimdiff", "pico", "sudoedit"].forEach(n => VS.KNOWN.add(n));

  P.openEditorRequest = function (kind, args, extra) {
    extra = extra || {};
    const file = args.filter(a => !a.startsWith("-") && !a.startsWith("+"))[0];
    if (!file && !extra.virtualPath) return { err: "", out: "", pending: { kind, path: "", abs: null, text: "", isNew: true, readonly: false } };
    const typed = extra.virtualPath || file;
    const abs = extra.virtualPath || this.abs(file);
    let node = extra.virtualPath ? null : this.lookup(abs, true);
    if (node && node.type === "dir") return { err: kind === "nano" ? `Error reading ${typed}: Is a directory\n` : `"${typed}" is a directory\n`, code: 1 };
    if (node && this.enforce && !this.asRoot && !this.canAccess(node, 4)) {
      return { err: kind === "nano" ? `Error reading ${typed}: Permission denied\n` : `"${typed}" [Permission Denied]\n`, code: 1, pending: { kind, path: typed, abs, text: "", isNew: false, readonly: true, denied: true } };
    }
    if (!node && !extra.virtualPath) {
      const parent = this.lookup(abs.slice(0, abs.lastIndexOf("/")) || "/", true);
      if (!parent) return { err: kind === "nano" ? `Error opening ${typed}: No such file or directory\n` : `"${typed}" E212: Can't open file for writing\n`, code: 1 };
    }
    const readonly = !!extra.readonly || !!(node && this.enforce && !this.asRoot && !this.canAccess(node, 2));
    return { pending: { kind, path: typed, abs, text: extra.text !== undefined ? extra.text : (node ? node.content || "" : ""), isNew: !node && !extra.virtualPath, readonly, virtual: !!extra.virtualPath, onSave: extra.onSave || null } };
  };
  const edCmd = (kind, readonlyDefault) => function (args, flags) {
    const r = this.openEditorRequest(kind, args, { readonly: readonlyDefault });
    if (r.pending) { this.pendingEditor = r.pending; this.lastEditorCmd = kind; }
    return { out: "", err: r.err || "", code: r.code || 0, editor: true };
  };
  P.cmd_vim = edCmd("vim"); P.cmd_vi = edCmd("vim"); P.cmd_view = edCmd("vim", true); P.cmd_vimdiff = edCmd("vim");
  P.cmd_nano = edCmd("nano"); P.cmd_pico = edCmd("nano");
  P.cmd_sudoedit = function (args) { const r = this.openEditorRequest("nano", args); if (r.pending) { r.pending.readonly = false; this.pendingEditor = r.pending; } return { out: "", err: r.err || "", code: r.code || 0 }; };
  P.cmd_visudo = function (args) {
    if (!this.asRoot) return { err: "visudo: /etc/sudoers: Permission denied\n", code: 1 };
    this.mkdirp("/etc"); let n = this.lookup("/etc/sudoers", true);
    if (!n) { n = this.createFile("/etc/sudoers", "root ALL=(ALL:ALL) ALL\n%sudo ALL=(ALL:ALL) ALL\n"); if (n) { n.mode = 0o440; n.owner = "root"; n.group = "root"; } }
    this.pendingEditor = { kind: "nano", path: "/etc/sudoers.tmp", abs: "/etc/sudoers.tmp", text: n.content || "", isNew: false, readonly: false, virtual: true, onSave: text => { const bad = text.split("\n").find(l => l.trim() && !/^\s*(#|Defaults|root|%|[A-Za-z_][\w.-]*\s+\S+\s*=|@includedir|#includedir|User_Alias|Cmnd_Alias|Host_Alias)/.test(l)); if (bad) return "visudo: syntax error near: " + bad; n.content = text; n.size = text.length; return ""; } };
    return { out: "" };
  };

  // Build the editor object for the pending request.
  P.openEditor = function () {
    const req = this.pendingEditor; if (!req) return null;
    const E = root.Editors; if (!E) return null;
    const sh = this;
    const onWrite = (target, text) => {
      if (req.denied || (req.readonly && target === req.path)) return req.kind === "vim" ? "E45: 'readonly' option is set (add ! to override)" : "Error writing " + target + ": Permission denied";
      if (req.virtual && target === req.path) {
        if (req.onSave) { const e = req.onSave(text); if (e) return e; }
        sh.virtualSaved = text; return "";
      }
      const abs = sh.abs(target);
      const parent = sh.lookup(abs.slice(0, abs.lastIndexOf("/")) || "/", true);
      if (!parent) return req.kind === "vim" ? "E212: Can't open file for writing" : "Error writing " + target + ": No such file or directory";
      const ex = sh.lookup(abs, true);
      if (ex && sh.enforce && !sh.asRoot && !sh.canAccess(ex, 2)) return req.kind === "vim" ? "E212: Can't open file for writing" : "Error writing " + target + ": Permission denied";
      const e = sh.writeTo(abs, text, false);
      return e ? (req.kind === "vim" ? "E212: Can't open file for writing" : "Error writing " + target + ": Permission denied") : "";
    };
    const Cls = req.kind === "nano" ? E.NanoEditor : E.VimEditor;
    const ed = new Cls(req.path || "[No Name]", req.text, { isNew: req.isNew, onWrite, readonly: req.readonly && req.kind === "vim" });
    ed.request = req;
    return ed;
  };
  P.finishEditor = function (ed) {
    const req = this.pendingEditor; this.pendingEditor = null;
    this.editorSession = { kind: ed.kind, path: req ? req.abs : null, typed: req ? req.path : "", saved: !!ed.written, exitedBy: ed.exitedBy, keys: ed.keyCount, modifiedUnsaved: !!ed.modified, nu: !!ed.nu };
    if (this.lastExec) this.lastExec.editor = this.editorSession;
    return this.editorSession;
  };
  // Headless: run a key script in the pending editor and close it (used by tests and the "show solution" check).
  P.editorScript = function (keys) {
    const ed = this.openEditor(); if (!ed) return null;
    root.Editors.runKeys(ed, keys);
    return this.finishEditor(ed);
  };
})(typeof window !== "undefined" ? window : globalThis);

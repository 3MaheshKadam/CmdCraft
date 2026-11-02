/**
 * CmdCraft curriculum layer.
 *
 *  - Re-organizes the topic list to follow the 29-module Linux syllabus (modules 1-27 are topics, 28 is the incident
 *    simulator, 29 is Interview Prep).
 *  - Moves a few existing scenarios into their syllabus module (find, awk, sed, head/tail, file transfer).
 *  - DRILL(): one compact call defines a scenario AND its live-system setup and goal. Drill files (drills-*.js) use it.
 *
 * Load order: scenarios.js, goals.js, feedback.js, curriculum.js, drills-*.js, curriculum-end.js
 */
(function (root) {
  root.SCENARIO_SETUP = root.SCENARIO_SETUP || {};

  // ---------- the syllabus, in order ----------
  const MODULES = [
    ["architecture",     "1. Fundamentals",       "fa-server",              "ARCH"],
    ["navigation",       "2. Filesystem",         "fa-compass",             "NAV"],
    ["files",            "3. Files & Dirs",       "fa-folder-plus",         "FILE"],
    ["permissions",      "4. Permissions",        "fa-shield-halved",       "PERM"],
    ["users_privileges", "5. Users & Groups",     "fa-users-gear",          "USER"],
    ["redirection",      "6. Pipes & Streams",    "fa-arrows-split-up-and-left", "REDIR"],
    ["search_grep",      "7. grep",               "fa-magnifying-glass",    "GREP"],
    ["search_find",      "8. find",               "fa-folder-tree",         "FIND"],
    ["awk_text",         "9. awk",                "fa-table-columns",       "AWK"],
    ["sed_edit",         "10. sed",               "fa-pen-to-square",       "SED"],
    ["head_tail",        "11. head & tail",       "fa-file-lines",          "HT"],
    ["processes",        "12. Processes",         "fa-microchip",           "PROC"],
    ["services_systemd", "13. Services",          "fa-gears",               "SVC"],
    ["logs_journal",     "14. Logs",              "fa-book-open",           "LOG"],
    ["cron_jobs",        "15. Cron",              "fa-clock",               "CRON"],
    ["networking",       "16. Networking",        "fa-network-wired",       "NET"],
    ["storage_disks",    "17. Disks",             "fa-hard-drive",          "DISK"],
    ["ssh_remote",       "18. SSH",               "fa-key",                 "SSH"],
    ["file_transfer",    "19. SCP & Transfer",    "fa-right-left",          "XFER"],
    ["vim_editor",       "20. Vim",               "fa-keyboard",            "VIM"],
    ["nano_editor",      "21. Nano",              "fa-pen",                 "NANO"],
    ["packages",         "22. Packages",          "fa-box-open",            "PKG"],
    ["archiving",        "23. Archives",          "fa-file-zipper",         "TAR"],
    ["env_vars",         "24. Environment",       "fa-sliders",             "ENV"],
    ["bash_scripting",   "25. Bash Scripting",    "fa-terminal",            "BASH"],
    ["monitoring",       "26. Monitoring",        "fa-gauge-high",          "MON"],
    ["security",         "27. Security",          "fa-lock",                "SEC"]
  ];
  const CODE = Object.fromEntries(MODULES.map(m => [m[0], m[3]]));

  // existing scenarios that belong to a different syllabus module than the old topic list put them in
  const MOVE = {
    "LNX-GREP-04": "search_find", "LNX-GREP-05": "search_find", "LNX-REDIR-03": "search_find",
    "LNX-TEXT-01": "head_tail", "LNX-TEXT-02": "awk_text", "LNX-TEXT-03": "sed_edit",
    "LNX-TEXT-04": "redirection", "LNX-TEXT-05": "redirection", "LNX-SSH-04": "file_transfer"
  };
  SCENARIOS.forEach(s => { if (MOVE[s.id]) s.topic = MOVE[s.id]; });

  // ---------- tree helpers for starting filesystems ----------
  const f = (name, size, perm, extra) => Object.assign({ name, type: "file", size: size || "0B", perm: perm || "-rw-r--r--" }, extra || {});
  const d = (name, children, extra) => Object.assign({ name, type: "dir", perm: "drwxr-xr-x", children: children || [] }, extra || {});
  const T = (path, children, extra) => Object.assign({ name: path, type: "dir", isCurrent: true, children: children || [] }, extra || {});
  root.F = f; root.Dir = d; root.Tree = T;

  // ---------- turning a solution into an automatic goal ----------
  const CF = () => root.CmdFeedback;
  function autoGoal(cmd, o) {
    const segs = CF().splitSegments(cmd.split(" (or")[0]).map(s => CF().parseSegment(s.text));
    const REDIR = /^(<|>|>>|2>|2>>|&>|2>&1|<<)$/;
    // operands that are real arguments: not redirection operators or their targets, and not values the shell expands ($VAR, ~)
    const realOperands = seg => {
      const res = [], ops = seg.operands;
      for (let i = 0; i < ops.length; i++) {
        const t = ops[i];
        if (!t.quoted && REDIR.test(t.value)) { if (t.value !== "2>&1") i++; continue; }
        if (!t.quoted && /[$~]/.test(t.value)) continue;
        res.push(t);
      }
      return res;
    };
    const matches = (c, seg) => {
      const optionTokens = seg.tokens.slice(1).filter(t => !t.quoted && /^-./.test(t.value));
      const optsOk = optionTokens.every(t => {
        if (c.args.includes(t.value)) return true;
        if (/^-[A-Za-z]+$/.test(t.value)) return t.value.slice(1).split("").every(ch => c.flags.has(ch));
        return false;
      });
      return optsOk && realOperands(seg).every(op => c.args.includes(op.value));
    };
    return sh => {
      const l = sh.lastExec;
      if (!l) return false;
      if (!o.allowErr && l.err && l.err.trim()) return false;
      // every part of the solution must appear somewhere in what the learner ran (a command may repeat in a pipeline)
      const ok = segs.every(seg => l.cmds.some(c => c.name === seg.name && matches(c, seg)));
      return ok && (!o.outRe || o.outRe.test(l.out));
    };
  }

  // ---------- DRILL ----------
  // DRILL(topic, num, title, level, xp, desc, objective, cmd, parts, tip, opts)
  let drillCount = 0;
  root.DRILL = function (topic, num, title, level, xp, desc, objective, cmd, parts, tip, opts) {
    opts = opts || {};
    if (!CODE[topic]) throw new Error("DRILL: unknown topic " + topic);
    const id = "LNX-" + CODE[topic] + "-" + num;
    if (SCENARIOS.some(s => s.id === id)) throw new Error("DRILL: duplicate id " + id);
    const main = cmd.split(" (or")[0].trim();
    const rx = new RegExp("^(sudo\\s+)?" + main.replace(/^sudo\s+/, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+") + "$");
    const first = main.replace(/^sudo\s+/, "").split(/\s+/)[0];
    const kb = CF() && CF().KB[first];
    const scenario = {
      id, topic, title, difficulty: level, xp, desc, objective,
      validCommands: [rx],
      hint: opts.hint || (kb ? `The command you need ${kb.does}.` : `Start with "${first}".`),
      explanation: { command: main, breakdown: (parts || []).map(([part, dsc]) => ({ part, desc: dsc })), proTip: tip || "" },
      simulatedOutput: opts.out || "",
      initialFs: opts.fs || T("/home/ubuntu")
    };
    SCENARIOS.push(scenario);
    const setup = {};
    ["viz", "focus", "files", "nodes", "system", "cwd", "oldpwd", "enforce", "env", "focusPort", "expectedIp", "keys"].forEach(k => { if (opts[k] !== undefined) setup[k] = opts[k]; });
    setup.goal = opts.goal || autoGoal(main, opts);
    root.SCENARIO_SETUP[id] = setup;
    drillCount++;
    return scenario;
  };
  root.DRILL.count = () => drillCount;

  // used by curriculum-end.js once every drill file has run
  root.CURRICULUM = {
    MODULES,
    finalize() {
      const have = new Set(SCENARIOS.map(s => s.topic));
      const topics = MODULES.filter(m => have.has(m[0])).map(m => ({ id: m[0], name: m[1], icon: m[2], count: SCENARIOS.filter(s => s.topic === m[0]).length }));
      LINUX_TOPICS.splice(0, LINUX_TOPICS.length, ...topics);
    }
  };
})(typeof window !== "undefined" ? window : globalThis);

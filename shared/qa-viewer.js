/**
 * Shared interview Q&A viewer (used by AI and Linux). QAViewer.init(config) needs these elements on the page:
 * #search #levels #progress #modules #study #mock #btn-mock
 * config: { bank, hard?, pro?, sections:[{name,note,mods:[ids]}], levels:[{id,label,test(lv)}], key, defaultLevel, levelFor(module, topic, item) }
 * Question: { q, a, f:[[q,a]...], probe?, trap?, lv? }; module: { id, name, summary, topics:[{id,t,qa:[...]}] }
 */
(function (root) {
  function init(cfg) {
    const BANK = cfg.bank || [];
    const HARD = cfg.hard || {};
    const SECTIONS = cfg.sections;
    const LEVELS = cfg.levels;
    const KEY = cfg.key;
    const $ = id => document.getElementById(id);
    const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
    const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
    const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(marks)); } catch (e) { /* private mode */ } };
    let marks = load();

    // merge hard-tier questions into their modules, then tag every item with a level
    const PRO = cfg.pro || {};
    BANK.forEach(m => {
      if (HARD[m.id]) m.topics.push({ id: m.id + "-hard", t: "Scenario, debugging and trap questions", qa: HARD[m.id] });
      if (PRO[m.id]) m.topics.unshift({ id: m.id + "-pro", t: "Production-level questions (2+ years of experience)", qa: PRO[m.id] });
    });
    const ALL = [];
    BANK.forEach(m => m.topics.forEach(t => t.qa.forEach(item => {
      item.id = hash(item.q); item.mod = m; item.topic = t;
      if (!item.lv) item.lv = cfg.levelFor ? cfg.levelFor(m, t, item) : "core";
      ALL.push(item);
    })));
    const ordered = [];
    SECTIONS.forEach(s => s.mods.forEach(id => { const m = BANK.find(x => x.id === id); if (m) { m.section = s; ordered.push(m); } }));
    BANK.forEach(m => { if (!m.section) { m.section = { name: "More" }; ordered.push(m); } });
    ordered.forEach((m, i) => { m.num = i + 1; });

    let level = cfg.defaultLevel || LEVELS[0].id, current = (ordered.find(m => ALL.some(i => i.mod === m && LEVELS[0].test(i.lv))) || ordered[0]).id, query = "";
    const passes = i => LEVELS.find(l => l.id === level).test(i.lv);

    function fmt(text) {
      const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      const box = el("div", "ans text-sm leading-relaxed text-neutral-300");
      let list = null, codeLines = null;
      text.split("\n").forEach(line => {
        if (/^\s*```/.test(line)) {                      // fenced code block: render verbatim
          if (codeLines === null) { codeLines = []; list = null; }
          else { const pre = el("pre", "my-2 overflow-x-auto rounded-lg border border-neutral-800 bg-black/60 p-3 text-[12px] leading-5 text-neutral-200"); pre.appendChild(el("code", "font-mono", codeLines.join("\n"))); box.appendChild(pre); codeLines = null; }
          return;
        }
        if (codeLines !== null) { codeLines.push(line); return; }
        if (/^- /.test(line)) { if (!list) { list = el("ul"); box.appendChild(list); } const li = el("li"); li.innerHTML = esc(line.slice(2)); list.appendChild(li); }
        else { list = null; if (line.trim()) { const p = el("p"); p.innerHTML = esc(line); box.appendChild(p); } }
      });
      return box;
    }
    function mark(item, value) { if (marks[item.id] === value) delete marks[item.id]; else marks[item.id] = value; save(); drawNav(); }
    function markButtons(item, onChange) {
      const wrap = el("div", "flex gap-2");
      [["got", "I can answer this", "fa-check", "emerald"], ["revisit", "Revisit", "fa-rotate-right", "amber"]].forEach(([v, label, icon, c]) => {
        const b = el("button", "px-2.5 py-1 rounded-md border text-xs " + (marks[item.id] === v ? (c === "emerald" ? "border-emerald-400 bg-emerald-500/15 text-emerald-300" : "border-amber-400 bg-amber-500/15 text-amber-300") : "border-neutral-700 text-neutral-400 hover:border-neutral-500"));
        b.innerHTML = '<i class="fa-solid ' + icon + ' mr-1"></i>' + label;
        b.addEventListener("click", () => { mark(item, v); wrap.replaceWith(markButtons(item, onChange)); onChange && onChange(); }); wrap.appendChild(b);
      });
      return wrap;
    }
    const LV_STYLE = { pro: "border-violet-500/40 text-violet-300 bg-violet-500/10", code: "border-emerald-500/40 text-emerald-300 bg-emerald-500/10", tricky: "border-red-500/40 text-red-300 bg-red-500/10", hard: "border-amber-500/40 text-amber-300 bg-amber-500/10", core: "border-neutral-600 text-neutral-400", project: "border-sky-500/40 text-sky-300 bg-sky-500/10" };
    const LV_LABEL = { pro: "2+ yrs", code: "Coding", tricky: "Tricky", hard: "Hard", core: "Fundamentals", project: "Project" };

    function card(item) {
      const c = el("article", "rounded-xl border border-neutral-800 bg-surface-1 p-4 space-y-3");
      const top = el("div", "flex items-start justify-between gap-3");
      top.appendChild(el("h3", "font-semibold text-neutral-100 leading-snug", item.q));
      top.appendChild(el("span", "shrink-0 text-[10px] px-1.5 py-0.5 rounded border " + (LV_STYLE[item.lv] || LV_STYLE.core), LV_LABEL[item.lv] || "Core"));
      c.appendChild(top);
      const body = el("div", "hidden space-y-3");
      if (item.trap) { const t = el("div", "text-xs rounded-md bg-red-500/10 border border-red-500/30 text-red-200 px-3 py-2"); t.innerHTML = '<i class="fa-solid fa-triangle-exclamation mr-1"></i><strong>The trap: </strong>'; t.appendChild(document.createTextNode(item.trap.replace(/^Weak answer:\s*/i, ""))); body.appendChild(t); }
      if (item.probe) { const p = el("div", "text-xs rounded-md bg-sky-500/10 border border-sky-500/30 text-sky-300 px-3 py-2"); p.innerHTML = '<i class="fa-solid fa-magnifying-glass mr-1"></i><strong>What they are probing: </strong>'; p.appendChild(document.createTextNode(item.probe)); body.appendChild(p); }
      body.appendChild(el("div", "text-[11px] uppercase tracking-wide text-neutral-500", "Model answer (adapt to your own experience, never claim work you have not done)"));
      body.appendChild(fmt(item.a));
      if (item.f && item.f.length) {
        body.appendChild(el("div", "text-[11px] uppercase tracking-wide text-amber-400 pt-1", "Likely cross-questions (" + item.f.length + ")"));
        item.f.forEach(([fq, fa]) => {
          const d = el("details", "rounded-lg border border-neutral-800 bg-surface-0/50 px-3 py-2");
          d.appendChild(el("summary", "cursor-pointer text-sm text-neutral-200 font-medium", fq));
          const ans = fmt(fa); ans.classList.add("mt-2"); d.appendChild(ans); body.appendChild(d);
        });
      }
      const row = el("div", "flex flex-wrap items-center justify-between gap-2");
      const toggle = el("button", "px-3 py-1.5 rounded-lg border border-emerald-500/50 text-emerald-300 text-xs hover:bg-emerald-500/10", "Show model answer");
      toggle.addEventListener("click", () => { const hidden = body.classList.toggle("hidden"); toggle.textContent = hidden ? "Show model answer" : "Hide model answer"; });
      row.appendChild(toggle); row.appendChild(markButtons(item)); c.appendChild(row); c.appendChild(body);
      return c;
    }

    function drawLevels() {
      $("levels").replaceChildren(...LEVELS.map(l => {
        const n = ALL.filter(i => l.test(i.lv)).length;
        const b = el("button", "px-2 py-1 rounded-md border text-[11px] " + (l.id === level ? "border-emerald-400 bg-emerald-500/15 text-emerald-300" : "border-neutral-700 text-neutral-400 hover:border-neutral-500"), l.label + " · " + n);
        b.addEventListener("click", () => { level = l.id; query = ""; $("search").value = ""; $("mock").classList.add("hidden"); $("study").classList.remove("hidden"); drawLevels(); drawNav(); drawStudy(); });
        return b;
      }));
    }
    function drawNav() {
      const visible = ALL.filter(passes);
      const done = visible.filter(i => marks[i.id] === "got").length, rev = visible.filter(i => marks[i.id] === "revisit").length;
      $("progress").textContent = visible.length + " questions in this view · " + done + " confident · " + rev + " to revisit";
      const frag = document.createDocumentFragment();
      SECTIONS.concat(ordered.some(m => m.section.name === "More") ? [{ name: "More", mods: ["__more"] }] : []).forEach(s => {
        const mods = ordered.filter(m => m.section.name === s.name);
        if (!mods.length) return;
        const group = el("div", "space-y-1");
        group.appendChild(el("div", "text-[10px] uppercase tracking-wide text-emerald-400 px-1", s.name));
        mods.forEach(m => {
          const items = visible.filter(i => i.mod === m), d = items.filter(i => marks[i.id] === "got").length;
          const b = el("button", "w-full text-left px-3 py-2 rounded-lg border text-sm " + (m.id === current && !query ? "border-emerald-400 bg-emerald-500/10 text-neutral-100" : "border-neutral-800 hover:border-neutral-600 " + (items.length ? "text-neutral-300" : "text-neutral-600")));
          b.appendChild(el("div", "font-medium", m.num + ". " + m.name));
          b.appendChild(el("div", "text-[11px] text-neutral-500", items.length + " questions · " + d + " confident"));
          b.addEventListener("click", () => { current = m.id; query = ""; $("search").value = ""; $("mock").classList.add("hidden"); $("study").classList.remove("hidden"); drawStudy(); drawNav(); window.scrollTo({ top: 0 }); });
          group.appendChild(b);
        });
        frag.appendChild(group);
      });
      $("modules").replaceChildren(frag);
    }
    function drawStudy() {
      const box = $("study"); box.replaceChildren();
      if (query) {
        const hits = ALL.filter(i => (i.q + " " + i.a + " " + (i.f || []).map(x => x.join(" ")).join(" ")).toLowerCase().includes(query));
        box.appendChild(el("h2", "text-sm text-neutral-400 mb-3", hits.length + " result" + (hits.length === 1 ? "" : "s") + " for “" + query + "” (all difficulties)"));
        const wrap = el("div", "space-y-4"); hits.forEach(i => wrap.appendChild(card(i))); box.appendChild(wrap); return;
      }
      const m = ordered.find(x => x.id === current); if (!m) return;
      const idx = m.num;
      box.appendChild(el("div", "text-xs text-neutral-500", "Step " + idx + " of " + ordered.length + " · " + m.section.name + (m.section.note ? " · " + m.section.note : "")));
      box.appendChild(el("h1", "text-xl font-bold text-neutral-100 mt-1", m.name));
      box.appendChild(el("p", "text-sm text-neutral-400 mt-1 mb-5", m.summary));
      let shown = 0;
      m.topics.forEach(t => {
        const items = t.qa.filter(passes); if (!items.length) return;
        shown += items.length;
        box.appendChild(el("h2", "text-xs uppercase tracking-wide text-emerald-400 mt-6 mb-2", t.t));
        const wrap = el("div", "space-y-4"); items.forEach(i => wrap.appendChild(card(i))); box.appendChild(wrap);
      });
      if (!shown) box.appendChild(el("div", "rounded-lg border border-neutral-800 p-4 text-sm text-neutral-400", "No questions at this difficulty in this module yet. Switch the difficulty filter to see the rest."));
      const nav = el("div", "flex justify-between mt-8 pt-4 border-t border-neutral-800");
      const prev = ordered[idx - 2], next = ordered[idx];
      [prev, next].forEach((mm, k) => {
        if (!mm) { nav.appendChild(el("span")); return; }
        const b = el("button", "text-sm text-emerald-300 hover:text-emerald-200", k === 0 ? "← " + mm.name : mm.name + " →");
        b.addEventListener("click", () => { current = mm.id; drawStudy(); drawNav(); window.scrollTo({ top: 0 }); }); nav.appendChild(b);
      });
      box.appendChild(nav);
    }

    // ---------- mock interview ----------
    let queue = [], mi = 0;
    function startMock() {
      let pool = ALL.filter(i => passes(i) && marks[i.id] !== "got");
      const inModule = pool.filter(i => i.mod.id === current);
      if (!query && inModule.length >= 3) pool = inModule;
      if (!pool.length) pool = ALL.filter(passes);
      queue = pool.slice().sort(() => Math.random() - 0.5).slice(0, 10); mi = 0;
      $("study").classList.add("hidden"); $("mock").classList.remove("hidden"); drawMock();
    }
    function drawMock() {
      const box = $("mock"); box.replaceChildren();
      if (mi >= queue.length) {
        box.appendChild(el("h2", "text-xl font-bold text-neutral-100", "Mock interview finished"));
        box.appendChild(el("p", "text-sm text-neutral-400 mt-2", queue.filter(i => marks[i.id] === "got").length + " of " + queue.length + " marked confident. Anything marked Revisit comes back first next time."));
        const again = el("button", "mt-4 px-4 py-2 rounded-lg bg-emerald-500 text-black font-semibold text-sm", "Another round"); again.addEventListener("click", startMock); box.appendChild(again);
        const back = el("button", "mt-4 ml-2 px-4 py-2 rounded-lg border border-neutral-700 text-sm", "Back to study"); back.addEventListener("click", () => { $("mock").classList.add("hidden"); $("study").classList.remove("hidden"); }); box.appendChild(back);
        return;
      }
      const item = queue[mi], c = el("div", "space-y-4");
      c.appendChild(el("div", "text-xs text-neutral-500", "Question " + (mi + 1) + " of " + queue.length + " · " + item.mod.name + " · " + (LV_LABEL[item.lv] || "Core")));
      c.appendChild(el("h2", "text-lg font-semibold text-neutral-100 leading-snug", item.q));
      c.appendChild(el("p", "text-xs text-neutral-500", "Answer out loud first, or type an outline. Then reveal the model answer and compare. Interviewers listen for specifics, trade-offs and numbers."));
      const ta = el("textarea", "w-full h-32 px-3 py-2 rounded-lg bg-surface-1 border border-neutral-700 text-sm focus:outline-none focus:border-emerald-400"); ta.placeholder = "Your answer (not saved or sent anywhere)…"; c.appendChild(ta);
      const reveal = el("button", "px-4 py-2 rounded-lg bg-emerald-500 text-black font-semibold text-sm", "Reveal model answer");
      const after = el("div", "hidden space-y-3");
      reveal.addEventListener("click", () => {
        after.classList.remove("hidden"); reveal.classList.add("hidden");
        if (item.trap) after.appendChild(el("div", "text-xs rounded-md bg-red-500/10 border border-red-500/30 text-red-200 px-3 py-2", "The trap: " + item.trap.replace(/^Weak answer:\s*/i, "")));
        if (item.probe) after.appendChild(el("div", "text-xs rounded-md bg-sky-500/10 border border-sky-500/30 text-sky-300 px-3 py-2", "Probing: " + item.probe));
        after.appendChild(fmt(item.a));
        if (item.f && item.f.length) {
          after.appendChild(el("div", "text-[11px] uppercase tracking-wide text-amber-400", "The interviewer's next question"));
          let fi = 0; const slot = el("div", "space-y-2"); after.appendChild(slot);
          const nextF = el("button", "px-3 py-1.5 rounded-lg border border-amber-500/50 text-amber-300 text-xs", "Ask a cross-question");
          nextF.addEventListener("click", () => {
            const [fq, fa] = item.f[fi++]; const d = el("div", "rounded-lg border border-neutral-800 bg-surface-1 p-3 space-y-2"); d.appendChild(el("div", "text-sm font-medium text-neutral-100", fq));
            const rv = el("button", "text-xs text-emerald-300 underline", "show answer"); const fans = fmt(fa); fans.classList.add("hidden"); rv.addEventListener("click", () => { fans.classList.toggle("hidden"); }); d.appendChild(rv); d.appendChild(fans); slot.appendChild(d);
            if (fi >= item.f.length) nextF.classList.add("hidden");
          }); after.appendChild(nextF);
        }
        const done = el("div", "flex flex-wrap gap-2 pt-2");
        done.appendChild(markButtons(item));
        const nx = el("button", "px-4 py-2 rounded-lg border border-neutral-600 text-sm hover:border-emerald-400", "Next question"); nx.addEventListener("click", () => { mi++; drawMock(); }); done.appendChild(nx);
        after.appendChild(done);
      });
      c.appendChild(reveal); c.appendChild(after); box.appendChild(c);
      const quit = el("button", "mt-6 text-xs text-neutral-500 hover:text-neutral-300", "End mock interview"); quit.addEventListener("click", () => { $("mock").classList.add("hidden"); $("study").classList.remove("hidden"); }); box.appendChild(quit);
    }

    $("btn-mock").addEventListener("click", startMock);
    $("search").addEventListener("input", e => { query = e.target.value.trim().toLowerCase(); $("mock").classList.add("hidden"); $("study").classList.remove("hidden"); drawStudy(); drawNav(); });
    drawLevels(); drawNav(); drawStudy();
  }
  root.QAViewer = { init: init };
})(window);

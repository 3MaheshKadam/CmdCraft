/**
 * "Ask Claude" helper: builds a tutoring prompt from what you are looking at and hands it to claude.ai.
 * A link can only start a NEW chat, so the panel also lets you save the URL of your own ongoing chat:
 * "Copy and open my chat" copies the prompt and opens that conversation so you can paste and continue.
 * Usage: AskClaude.mount({ subject: "SQL", getContext: () => ({ kind, title, topics, prereq, body, extra }) })
 */
(function (root) {
  const CHAT_KEY = "cmdcraft.askclaude.chat", MAX_URL_PROMPT = 1800;
  const read = k => { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } };
  const write = (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch (e) { /* private mode */ } };

  /** ctx: { kind: "lesson"|"problem", title, topics:[], prereq:[{title, topics:[]}], body, extra } */
  function buildPrompt(subject, ctx) {
    const L = [];
    L.push("You are my " + subject + " tutor. I am learning from the CmdCraft " + subject + " roadmap (the target is MySQL 8; the in-browser practice engine is SQLite with MySQL syntax support). Teach step by step, keep it concise, and do not just give me answers.");
    L.push("");
    L.push((ctx.kind === "problem" ? "I am working on this practice problem: " : "I am studying this lesson: ") + ctx.title);
    if (ctx.topics && ctx.topics.length) L.push("Topics in scope: " + ctx.topics.join("; ") + ".");
    if (ctx.body) { L.push(""); L.push(ctx.body); }
    if (ctx.extra) { L.push(""); L.push(ctx.extra); }
    L.push("");
    L.push("Please do this, in order:");
    let n = 1;
    if (ctx.prereq && ctx.prereq.length) {
      L.push(n++ + ". Recap the earlier concepts this builds on, in 2-3 lines each, so my foundation is clear: " + ctx.prereq.map(p => p.title + (p.topics && p.topics.length ? " (" + p.topics.slice(0, 8).join(", ") + ")" : "")).join(" | ") + ".");
    }
    L.push(n++ + ". Explain " + (ctx.kind === "problem" ? "the idea behind this problem" : "this lesson's topics") + " in plain language with one small worked example and the output.");
    L.push(n++ + ". Give me 3 practice questions (easy, medium, hard) on small sample tables you define. Do NOT show the answers yet.");
    L.push(n++ + ". Give me one hands-on exercise: the CREATE TABLE and INSERT statements to run, the task, and the expected output so I can check myself.");
    L.push(n++ + ". Then wait for my attempts, review them, point out mistakes and edge cases (NULLs, ties, duplicates), and give the next harder question.");
    return L.join("\n");
  }

  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
  function copy(text) {
    try { if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).then(() => true, () => false); } catch (e) { /* fall through */ }
    try { const t = el("textarea"); t.value = text; document.body.appendChild(t); t.select(); const ok = document.execCommand("copy"); t.remove(); return Promise.resolve(!!ok); } catch (e) { return Promise.resolve(false); }
  }
  const isChatUrl = u => /^https:\/\/claude\.ai\/(chat|project)\/[\w-]+/.test(u);

  function mount(cfg) {
    const subject = cfg.subject || "SQL";
    const fab = el("button", "fixed bottom-4 right-4 z-30 px-4 py-2.5 rounded-full bg-violet-500 hover:bg-violet-400 text-white font-semibold text-sm shadow-lg");
    fab.id = "ask-claude-btn"; fab.type = "button"; fab.appendChild(el("i", "fa-solid fa-wand-magic-sparkles mr-2")); fab.appendChild(document.createTextNode("Ask Claude"));
    const overlay = el("div", "hidden fixed inset-0 z-40 bg-black/70 flex items-end sm:items-center justify-center p-3"); overlay.id = "ask-claude-panel";
    const card = el("div", "w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-neutral-700 bg-surface-1 p-4 space-y-3");
    const head = el("div", "flex items-center justify-between"); head.appendChild(el("div", "font-semibold text-neutral-100", "Learn this with Claude"));
    const close = el("button", "text-neutral-400 hover:text-neutral-100 text-lg px-2", "×"); close.type = "button"; close.setAttribute("aria-label", "Close"); head.appendChild(close); card.appendChild(head);
    card.appendChild(el("p", "text-xs text-neutral-400", "Builds a prompt that asks Claude to recap the earlier concepts, explain this one, give 3 practice questions and a hands-on exercise. Review or edit it, then send it with your Claude subscription."));
    const ta = el("textarea", "w-full h-56 px-3 py-2 rounded-lg bg-black/60 border border-neutral-700 font-mono text-[12px] leading-5 text-neutral-100 focus:outline-none focus:border-violet-400"); ta.id = "ask-claude-prompt"; ta.spellcheck = false; card.appendChild(ta);
    const row = el("div", "flex flex-wrap gap-2 text-sm");
    const bNew = el("button", "px-3 py-2 rounded-lg bg-violet-500 hover:bg-violet-400 text-white font-semibold", "Open in a new chat"); bNew.id = "ask-new"; bNew.type = "button";
    const bMine = el("button", "px-3 py-2 rounded-lg border border-violet-400 text-violet-200 hover:bg-violet-500/10", "Copy and open my chat"); bMine.id = "ask-mine"; bMine.type = "button";
    const bCopy = el("button", "px-3 py-2 rounded-lg border border-neutral-600 text-neutral-200 hover:border-neutral-400", "Copy only"); bCopy.id = "ask-copy"; bCopy.type = "button";
    row.appendChild(bNew); row.appendChild(bMine); row.appendChild(bCopy); card.appendChild(row);
    const msg = el("div", "text-xs text-emerald-300 min-h-[1rem]"); msg.id = "ask-msg"; card.appendChild(msg);
    const saved = el("div", "rounded-lg border border-neutral-800 p-3 space-y-2");
    saved.appendChild(el("div", "text-xs font-semibold text-neutral-200", "Keep one ongoing chat"));
    saved.appendChild(el("p", "text-xs text-neutral-400", "A link always starts a new conversation. To continue the same one: open a chat (or a Claude Project named for this course), copy its address bar URL, and save it here. \"Copy and open my chat\" then puts the prompt on your clipboard and opens that chat: just paste."));
    const inp = el("input", "w-full px-3 py-2 rounded-lg bg-black/60 border border-neutral-700 text-xs text-neutral-100 focus:outline-none focus:border-violet-400"); inp.id = "ask-url"; inp.placeholder = "https://claude.ai/chat/…  or  https://claude.ai/project/…"; inp.value = read(CHAT_KEY);
    const bSave = el("button", "px-3 py-1.5 rounded-lg border border-neutral-600 text-xs text-neutral-200 hover:border-neutral-400", "Save chat link"); bSave.id = "ask-save"; bSave.type = "button";
    saved.appendChild(inp); saved.appendChild(bSave); card.appendChild(saved);
    overlay.appendChild(card); document.body.appendChild(fab); document.body.appendChild(overlay);

    const say = (t, bad) => { msg.textContent = t; msg.className = "text-xs min-h-[1rem] " + (bad ? "text-amber-300" : "text-emerald-300"); };
    const openTab = url => { try { window.open(url, "_blank", "noopener"); } catch (e) { /* popup blocked */ } };
    fab.addEventListener("click", () => { ta.value = buildPrompt(subject, cfg.getContext()); say(""); overlay.classList.remove("hidden"); });
    const hide = () => overlay.classList.add("hidden"); close.addEventListener("click", hide); overlay.addEventListener("click", e => { if (e.target === overlay) hide(); });
    bCopy.addEventListener("click", () => copy(ta.value).then(ok => say(ok ? "Prompt copied." : "Could not copy: select the text and copy it manually.", !ok)));
    bNew.addEventListener("click", () => {
      const q = encodeURIComponent(ta.value);
      if (ta.value.length <= MAX_URL_PROMPT) { openTab("https://claude.ai/new?q=" + q); say("Opened a new chat with the prompt filled in."); }
      else copy(ta.value).then(ok => { openTab("https://claude.ai/new"); say(ok ? "The prompt is long, so it was copied: paste it into the new chat." : "Open the new chat and paste the prompt (copy it from the box).", !ok); });
    });
    bSave.addEventListener("click", () => { const v = inp.value.trim(); if (v && !isChatUrl(v)) { say("That does not look like a claude.ai chat or project link.", true); return; } write(CHAT_KEY, v); say(v ? "Saved." : "Cleared."); });
    bMine.addEventListener("click", () => {
      const v = inp.value.trim() || read(CHAT_KEY);
      if (!isChatUrl(v)) { say("Save your chat link first (see below), or use Open in a new chat.", true); return; }
      write(CHAT_KEY, v);
      copy(ta.value).then(ok => { openTab(v); say(ok ? "Prompt copied. Paste it into your chat." : "Chat opened. Copy the prompt from the box and paste it.", !ok); });
    });
    return { buildPrompt: () => buildPrompt(subject, cfg.getContext()) };
  }

  root.AskClaude = { mount, buildPrompt, isChatUrl };
  if (typeof module !== "undefined") module.exports = root.AskClaude;
})(typeof window !== "undefined" ? window : globalThis);

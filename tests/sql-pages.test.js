// jsdom checks for the roadmap home, the lessons page, the lab (isolation simulator) and the interview page.
const { JSDOM } = require("jsdom"); const fs = require("fs"); const initSqlJs = require("sql.js");
const dir = require("path").join(__dirname, "..") + "/";
let pass = 0, fail = 0; const check = (n, c) => { (c ? pass++ : fail++); console.log(c ? "PASS" : "FAIL", n); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
function page(file, extra) {
  const raw = fs.readFileSync(dir + file, "utf8");
  const html = raw.replace(/<script src="https?:[^>]*><\/script>/g, "").replace(/<link [^>]*>/g, "").replace(/<script src="[^"]+"[^>]*><\/script>/g, "");
  const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true, url: "http://localhost/" + file + (extra || "") });
  const w = dom.window; w.initSqlJs = () => initSqlJs(); w.scrollTo = () => {};
  const base = file.replace(/[^/]+$/, "");
  const srcs = (raw.match(/<script src="(?!https?:|\.\.)[^"]+"><\/script>/g) || []).map(s => /src="([^"]+)"/.exec(s)[1]);
  const shared = ["qa-viewer", "ask-claude"].filter(n => raw.includes("../shared/" + n + ".js")).map(n => "shared/" + n + ".js");
  const code = [...srcs.map(f => base + f), ...shared].map(f => fs.readFileSync(dir + f, "utf8"));
  const inline = html.match(/<script>([\s\S]*?)<\/script>/g).map(s => s.replace(/<\/?script>/g, "")).join("\n");
  // qa-viewer defines a global const, so run all scripts as one program (as separate evals would not share top-level bindings)
  w.eval(code.join("\n;\n") + "\n;\n" + inline);
  return w;
}
(async () => {
  // Ask Claude panel on a lesson
  let wa = page("sql/learn.html", "#day=16"); const A = id => wa.document.getElementById(id); const opened = [], copied = [];
  Object.defineProperty(wa, "open", { value: u => { opened.push(u); }, configurable: true, writable: true }); wa.navigator.clipboard = { writeText: t => { copied.push(t); return Promise.resolve(); } };
  A("ask-claude-btn").click(); const prompt = A("ask-claude-prompt").value;
  check("the Ask Claude prompt recaps earlier concepts", /Recap the earlier concepts/.test(prompt) && /Day 14 Set Operators/.test(prompt) && /Day 15 CASE Statements/.test(prompt));
  check("the prompt asks for practice questions and a hands-on exercise", /3 practice questions/.test(prompt) && /hands-on exercise/.test(prompt) && /Day 16: Window Functions/.test(prompt) && /ROW_NUMBER/.test(prompt));
  A("ask-new").click(); await sleep(30); check("a new chat opens with the prompt filled in or copied", opened.length === 1 && /^https:\/\/claude\.ai\/new/.test(opened[0]));
  A("ask-mine").click(); check("without a saved link the user is told to save one", /Save your chat link/.test(A("ask-msg").textContent) && opened.length === 1);
  A("ask-url").value = "https://evil.example/chat/abc"; A("ask-save").click(); check("a non-claude link is rejected", /does not look like/.test(A("ask-msg").textContent));
  A("ask-url").value = "https://claude.ai/chat/1234-abcd"; A("ask-save").click(); A("ask-mine").click(); await sleep(20);
  check("my saved chat is opened and the prompt copied", opened[opened.length - 1] === "https://claude.ai/chat/1234-abcd" && copied.length >= 1 && copied[copied.length - 1] === A("ask-claude-prompt").value && wa.localStorage.getItem("cmdcraft.askclaude.chat") === "https://claude.ai/chat/1234-abcd");

  // roadmap home
  let w = page("sql/index.html"); let $ = id => w.document.getElementById(id);
  check("home lists a card for each of the 38 days", $("levels").querySelectorAll("a[href^='learn.html#day=']").length === 38 && $("levels").querySelectorAll("section").length === 7);
  check("home shows problem totals and the engine disclaimer", /\/4\d\d problems solved/.test($("summary").textContent) && /SQLite/.test($("honesty").textContent) && /Concept-only/.test($("honesty").textContent));
  check("practice links deep-link to a module", [...$("levels").querySelectorAll("a")].some(a => a.getAttribute("href") === "practice.html#mod=window" || a.getAttribute("href") === "practice.html#mod=winx"));

  // lessons
  w = page("sql/learn.html", "#day=16"); $ = id => w.document.getElementById(id); await sleep(100);
  check("lesson opens the day from the URL with every topic", /Window Functions/.test($("main").textContent) && $("main").querySelectorAll("dl > div").length === 23);
  check("lesson sections are present", ["Try it", "How it works inside", "Common mistakes", "Interview questions", "Revision checklist"].every(t => $("main").textContent.includes(t)));
  [...$("main").querySelectorAll("button")].find(b => b.textContent.trim() === "Run").click(); await sleep(600);
  check("the lesson example runs on the SQLite engine", $("main").querySelectorAll("table").length >= 1 && /Alice Novak/.test($("main").textContent));
  [...$("main").querySelectorAll("button")].find(b => /Mark lesson as read/.test(b.textContent)).click();
  check("a lesson can be marked read and it persists", JSON.parse(w.localStorage.getItem("cmdcraft.sql.lessons.v1")).done[16] > 0);
  $("search").value = "gaps and islands"; $("search").dispatchEvent(new w.Event("input")); check("topic search finds notes", /Gaps|islands/i.test($("main").textContent));
  w = page("sql/learn.html", "#day=22"); $ = id => w.document.getElementById(id);
  check("a concept-only example is shown without a Run button", /cannot run it/.test($("main").textContent) && ![...$("main").querySelectorAll("button")].some(b => b.textContent.trim() === "Run"));

  // lab
  w = page("sql/lab.html"); $ = id => w.document.getElementById(id);
  const stepAll = () => { for (let i = 0; i < 10; i++) $("iso-next").click(); };
  $("iso-scn").value = "dirty"; $("iso-lvl").value = "RU"; $("iso-scn").dispatchEvent(new w.Event("change")); stepAll();
  check("READ UNCOMMITTED shows a dirty read", /Dirty read happened/.test($("iso-verdict").textContent));
  $("iso-lvl").value = "RC"; $("iso-lvl").dispatchEvent(new w.Event("change")); stepAll();
  check("READ COMMITTED prevents it", /No dirty read/.test($("iso-verdict").textContent));
  $("iso-scn").value = "nonrep"; $("iso-lvl").value = "RR"; $("iso-scn").dispatchEvent(new w.Event("change")); stepAll();
  check("REPEATABLE READ gives repeatable reads", /Repeatable/.test($("iso-verdict").textContent));
  $("iso-scn").value = "lost"; $("iso-lvl").value = "RC"; $("iso-scn").dispatchEvent(new w.Event("change")); stepAll();
  check("the lost update is demonstrated", /Lost update/.test($("iso-verdict").textContent));
  $("iso-scn").value = "deadlock"; $("iso-scn").dispatchEvent(new w.Event("change")); stepAll();
  check("the deadlock scenario explains prevention", /same order/.test($("iso-verdict").textContent));
  $("tab-index").click(); await sleep(1500);
  check("the index lab builds a 20,000-row table", !$("idx-ui").classList.contains("hidden"));
  w.document.querySelector("[data-act=run1]").click(); check("without an index the plan is a scan", /SCAN/.test($("out1").textContent));
  w.document.querySelector("[data-act=mk1]").click(); w.document.querySelector("[data-act=run1]").click(); check("with an index the plan is a search", /SEARCH.*idx_email/.test($("out1").textContent));
  w.document.querySelector("[data-act=mk2]").click(); w.document.querySelector("[data-act=q2c]").click();
  check("the leftmost-prefix rule is visible in the plan", /SCAN/.test($("out2").textContent) && !/idx_city_age \(age/.test($("out2").textContent));

  // interview
  w = page("sql/interview.html"); $ = id => w.document.getElementById(id);
  check("the interview page renders the study view", /SQL|Fundamentals|Foundations/.test($("modules").textContent) && $("study").children.length > 0);
  console.log(pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
})();

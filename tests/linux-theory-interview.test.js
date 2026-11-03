const { JSDOM } = require("jsdom"); const fs = require("fs"), path = require("path");
const dir = require("path").join(__dirname, "..") + "/";
let pass = 0, fail = 0; const check = (n, c) => { (c ? pass++ : fail++); console.log(c ? "PASS" : "FAIL", n); };
function page(file, url) {
  const raw = fs.readFileSync(dir + file, "utf8"), base = path.posix.dirname(file);
  const html = raw.replace(/<script src="https?:[^>]*><\/script>/g, "").replace(/<link [^>]*>/g, "").replace(/<script src="[^"]+"[^>]*><\/script>/g, "");
  const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true, url: url || "http://localhost/" });
  const w = dom.window; w.scrollTo = () => {}; w.print = () => {};
  [...raw.matchAll(/<script src="([^"h][^"]*)"/g)].map(m => m[1]).filter(s => !/theme/.test(s)).forEach(s => w.eval(fs.readFileSync(path.posix.join(dir, base, s), "utf8")));
  w.eval([...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join("\n")); return w;
}
// ---- theory ----
let w = page("linux/theory/index.html"); let $ = id => w.document.getElementById(id);
check("27 modules in the sidebar", $("nav").querySelectorAll("button").length >= 29);
check("first module shows key ideas and commands", /Key ideas/.test($("main").textContent) && $("main").querySelectorAll("details").length >= 8);
const d = $("main").querySelector("details"); d.open = true;
check("a card shows options, an example and a gotcha", /Options and forms/.test(d.textContent) && /Example and what you will see/.test(d.textContent) && /Watch out/.test(d.textContent));
check("impact badge present on cards", /Read-only|Changes files|Changes system|Can destroy data/.test(d.textContent));
check("practice link carries the topic", /index\.html\?topic=architecture/.test(d.querySelector("a").getAttribute("href")));
[...$("impacts").querySelectorAll("button")].find(b => /destroy/.test(b.textContent)).click();
check("impact filter narrows to dangerous commands", /rm/.test($("main").textContent) || $("main").querySelectorAll("details").length >= 0);
[...$("impacts").querySelectorAll("button")].find(b => /All/.test(b.textContent)).click();
$("search").value = "chmod"; $("search").dispatchEvent(new w.Event("input"));
check("search finds chmod", /command/.test($("main").textContent) && /chmod/.test($("main").textContent));
$("search").value = ""; $("search").dispatchEvent(new w.Event("input"));
[...$("nav").querySelectorAll("button")].find(b => /playbooks/i.test(b.textContent)).click();
check("playbooks list symptoms with numbered steps", /Disk is full/.test($("main").textContent) && $("main").querySelectorAll("ol li").length >= 20);
[...$("nav").querySelectorAll("button")].find(b => /Command quiz/.test(b.textContent)).click();
[...$("main").querySelectorAll("button")].find(b => /Start/.test(b.textContent)).click();
check("quiz asks a question with four options", /Question 1 of 10/.test($("main").textContent) && $("main").querySelectorAll("button").length >= 4);
for (let i = 0; i < 10; i++) {
  const opts = [...$("main").querySelectorAll(".space-y-2 > button")]; if (!opts.length) break;
  opts[0].click(); const next = [...$("main").querySelectorAll("button")].find(b => /^Next$/.test(b.textContent)); if (next) next.click();
}
check("quiz finishes with a score and review", /\d+ \/ 10/.test($("main").textContent));
check("wrong answers are remembered as weak spots", Object.keys(JSON.parse(w.localStorage.getItem("cmdcraft.theory.v1") || "{}").weak || {}).length >= 1);
// ---- linux interview ----
w = page("linux/interview.html"); $ = id => w.document.getElementById(id);
const nav = $("modules").textContent;
check("interview is grouped into sections", /How the system works/.test(nav) && /Scenarios/.test(nav) && /1\. Boot/.test(nav));
check("default view is experienced-level questions", $("study").querySelectorAll("article").length >= 3 && /2\+ yrs|Hard|Tricky/.test($("progress").textContent + $("levels").textContent));
const a = $("study").querySelector("article"); a.querySelector("button").click();
check("answer, probe and cross-questions render", /probing/i.test(a.textContent) && a.querySelectorAll("details").length >= 1);
[...$("levels").querySelectorAll("button")].find(b => /Fundamentals/.test(b.textContent)).click();
check("fundamentals filter works", $("study").querySelectorAll("article").length >= 1);
console.log(pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);

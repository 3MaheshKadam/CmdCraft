const { JSDOM } = require("jsdom"); const fs = require("fs");
const dir = require("path").join(__dirname, "..") + "/";
const __M = { shared: "theme cloud cloud-config subjects".split(" "), "linux/app": "app editor-ui feedback viz viz-more viz-sys".split(" "), "linux/content": "scenarios goals curriculum curriculum-end drills-a drills-b drills-c drills-d drills-e drills-f drills-g incidents-more interview-data".split(" ") };
const R = f => { const b = f.replace(/\.js$/, ""); for (const [d, l] of Object.entries(__M)) if (l.includes(b)) return d + "/" + f; return /^(editors|shell|system)/.test(f) ? "linux/engine/" + f : f; };
const html = fs.readFileSync(dir + "linux/quiz.html", "utf8").replace(/<script src="https?:[^>]*><\/script>/g, "").replace(/<link [^>]*>/g, "").replace(/<script src="[a-z0-9\/.-]+\.js"><\/script>/g, "");
const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true, url: "http://localhost/" });
const w = dom.window; let pass = 0, fail = 0;
const check = (n, c) => { (c ? pass++ : fail++); console.log(c ? "PASS" : "FAIL", n); };
w.eval(fs.readFileSync(dir + "linux/content/interview-data.js", "utf8"));
const inline = html.match(/<script>([\s\S]*)<\/script>/)[1];
w.eval(inline);
const $ = id => w.document.getElementById(id);
check("setup lists topics", $("chips").children.length > 20);
$("start").click();
check("quiz shows", !$("quiz").classList.contains("hidden") && $("q-text").textContent.length > 10);
let n = 0;
while (!$("quiz").classList.contains("hidden")) {
  const opts = [...$("opts").children]; check_once: {}
  const good = opts.find(b => b.dataset.correct); good.click();
  check("correct answer accepted (" + (++n) + ")", /Correct/.test($("why").textContent));
  $("next").click();
  if (n > 12) break;
}
check("10 questions in a round", n === 10);
check("results shown with perfect score", !$("results").classList.contains("hidden") && /10 \/ 10/.test($("results").textContent));
// wrong answers feed weak list
$("results").querySelector("button:last-child").click();
$("start").click();
const wrong = [...$("opts").children].find(b => !b.dataset.correct); wrong.click();
check("wrong answer shows the right one", /Not quite/.test($("why").textContent) && /Answer:/.test($("why").textContent));
$("quit").click();
check("quit ends the round", !$("results").classList.contains("hidden"));
console.log(pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);

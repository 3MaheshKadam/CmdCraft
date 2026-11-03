// Checks that the SQL roadmap is fully covered: every syllabus bullet has a lesson note, every runnable lesson example runs,
// every module has hands-on content, the interview bank is well formed, and every page loads files that exist.
const fs = require("fs"), vm = require("vm"), path = require("path"); const initSqlJs = require("sql.js");
const dir = path.join(__dirname, "..") + "/";
let pass = 0, fail = 0; const check = (n, c, extra) => { (c ? pass++ : fail++); console.log(c ? "PASS" : "FAIL", n, c ? "" : (extra || "")); };
(async () => {
  const SQL = await initSqlJs();
  const ctx = { console }; ctx.window = ctx; vm.createContext(ctx);
  const files = fs.readdirSync(dir + "sql/content").filter(f => /^(syllabus|lessons-\d|problems|datasets-extra|qa-sql)/.test(f)).sort((a, b) => (a === "problems.js" ? -1 : b === "problems.js" ? 1 : 0) || a.localeCompare(b));
  // problems.js first, then datasets-extra before the numbered problem files (alphabetical already puts datasets-extra < problems-N)
  const order = ["syllabus.js", "problems.js", "datasets-extra.js", ...files.filter(f => /^problems-\d/.test(f)), ...files.filter(f => /^lessons-/.test(f)), "qa-sql.js"];
  order.forEach(f => vm.runInContext(fs.readFileSync(dir + "sql/content/" + f, "utf8"), ctx));
  vm.runInContext(fs.readFileSync(dir + "sql/app/compat.js", "utf8"), ctx); vm.runInContext(fs.readFileSync(dir + "sql/app/judge.js", "utf8"), ctx);
  ctx.SQLJudge.setEngine(SQL);

  const S = ctx.SQL_SYLLABUS, L = ctx.SQL_LESSONS, byDay = {}; L.forEach(l => { byDay[l.day] = l; });
  const total = S.reduce((a, d) => a + d.bullets.length, 0);
  check("the syllabus has all 38 days and 7 levels", S.length === 38 && ctx.SQL_LEVELS.length === 7 && S.every((d, i) => d.day === i));
  check("the roadmap lists " + total + " topics", total === 452);
  check("every day has exactly one lesson", S.every(d => byDay[d.day]) && L.length === S.length);
  let missing = [];
  S.forEach(d => { const l = byDay[d.day]; if (!l) return;
    if (!l.notes || l.notes.length !== d.bullets.length) missing.push("day " + d.day + " notes " + (l.notes && l.notes.length) + " vs " + d.bullets.length);
    else l.notes.forEach((n, i) => { if (typeof n !== "string" || n.trim().length < 25) missing.push("day " + d.day + " '" + d.bullets[i] + "'"); });
    if (new Set(d.bullets).size !== d.bullets.length) missing.push("day " + d.day + " duplicate bullets");
  });
  check("every roadmap bullet has a lesson note (" + total + " notes, none empty)", missing.length === 0, missing.slice(0, 5).join("; "));
  const weak = L.filter(l => !(l.intro && l.internals && l.mistakes && l.mistakes.length >= 1 && l.interview && l.interview.length >= 1 && l.revise && l.revise.length >= 2 && l.example && l.example.sql));
  check("every lesson has intro, example, internals, mistakes, interview questions and revision points", weak.length === 0, weak.map(l => l.day).join(","));

  // runnable examples must execute
  const J = ctx.SQLJudge; let exFail = [];
  L.forEach(l => { if (l.example.noRun) return; const r = J.run(l.example.ds, l.example.sql); if (r.error) exFail.push("day " + l.day + ": " + r.error); r.db.close(); });
  check("every runnable lesson example executes", exFail.length === 0, exFail.join("; "));
  check("examples that cannot run in SQLite are marked", L.filter(l => l.example.noRun).length >= 2);

  // hands-on coverage
  const P = ctx.SQL_PROBLEMS, mods = new Set(P.map(p => p.mod));
  check("every practice module has problems", ctx.SQL_MODULES.every(m => mods.has(m.id)), ctx.SQL_MODULES.filter(m => !mods.has(m.id)).map(m => m.id).join(","));
  check("every lesson links to modules that exist", L.every(l => (l.mods || []).every(m => mods.has(m))));
  check("there are at least 400 problems", P.length >= 400);
  check("the interview set has 50 problems", P.filter(p => p.mod === "sql50").length === 50);
  check("three projects exist", ["pj1", "pj2", "pj3"].every(m => P.filter(p => p.mod === m).length >= 10));
  check("there are at least 60 theory questions", P.filter(p => p.kind === "mcq").length >= 60);
  const kinds = {}; P.forEach(p => { if (p.kind === "mcq") (kinds[p.answer] = kinds[p.answer] || 0) + 1; });
  check("quiz answers are spread over all positions", Object.keys(kinds).length === 4 && Math.max(...Object.values(kinds)) <= 0.4 * P.filter(p => p.kind === "mcq").length);
  check("ids are unique", new Set(P.map(p => p.id)).size === P.length);
  check("datasets used by problems exist", P.every(p => p.kind === "mcq" || ctx.SQL_DATASETS[p.ds]));
  const text = JSON.stringify(P) + JSON.stringify(L);
  ["SAVEPOINT", "EXPLAIN", "RECURSIVE", "NTILE", "LAST_VALUE", "INTERSECT", "ON DELETE CASCADE", "ON DUPLICATE KEY", "TIMESTAMPDIFF", "TRIGGER", "CREATE VIEW", "FULL OUTER JOIN", "CROSS JOIN", "NATURAL JOIN", "COALESCE", "NULLIF", "CONCAT_WS", "LOCATE"].forEach(k => check("content covers " + k, text.toUpperCase().includes(k)));

  // interview bank
  const Q = ctx.SQL_INTERVIEW; let qn = 0, qbad = [];
  Q.forEach(m => { if (!m.id || !m.name || !m.topics || !m.topics.length) qbad.push(m.id); m.topics.forEach(t => t.qa.forEach(i => { qn++; if (!i.q || !i.a || i.a.length < 60 || !Array.isArray(i.f) || !i.f.length || !i.probe || !i.lv) qbad.push(m.id + ": " + (i.q || "?")); })); });
  check("the interview bank has " + qn + " well-formed questions", qn >= 40 && qbad.length === 0, qbad.slice(0, 3).join("; "));

  // pages
  const pages = ["index", "learn", "practice", "interview", "lab", "coverage"]; let bad = [];
  pages.forEach(p => { const f = dir + "sql/" + p + ".html"; if (!fs.existsSync(f)) { bad.push(p + " missing"); return; }
    (fs.readFileSync(f, "utf8").match(/(?:src|href)="(?!https?:|#|\.\.\/manifest|data:)([^"]+)"/g) || []).forEach(m => { const u = /="([^"]+)"/.exec(m)[1].split("#")[0]; if (u && !u.endsWith("/") && !fs.existsSync(path.resolve(dir + "sql", u))) bad.push(p + " -> " + u); }); });
  check("all SQL pages exist and every local file they reference exists", bad.length === 0, bad.slice(0, 5).join("; "));
  console.log(pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
})();

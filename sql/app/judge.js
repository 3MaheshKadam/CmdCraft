/**
 * SQL judge: builds a fresh in-memory SQLite database per attempt and compares result sets.
 * SQLJudge.setEngine(SQL) once (the sql.js module), then SQLJudge.judge(problem, userSql).
 */
(function (root) {
  let SQL = null;
  const norm = v => (typeof v === "number" ? Math.round(v * 1e6) / 1e6 : v);
  const key = r => JSON.stringify(r);

  const compat = () => root.SQLCompat || null;
  const fix = sql => (compat() ? compat().rewrite(sql) : sql);
  function openDb(ds) {
    const db = new SQL.Database();
    if (compat()) compat().install(db);
    db.exec(root.SQL_DATASETS[ds].sql);
    db.exec("PRAGMA foreign_keys = ON");
    return db;
  }
  function last(results) { return results && results.length ? results[results.length - 1] : null; }
  function table(res) { return res ? { cols: res.columns, rows: res.values.map(r => r.map(norm)) } : { cols: [], rows: [] }; }

  // Compare two tables. Column names are ignored (positions matter); row order only when `ordered`.
  function compare(got, want, ordered) {
    if (got.cols.length !== want.cols.length) return { ok: false, why: `Expected ${want.cols.length} column${want.cols.length === 1 ? "" : "s"} but your query returns ${got.cols.length}.` };
    if (got.rows.length !== want.rows.length) return { ok: false, why: `Expected ${want.rows.length} row${want.rows.length === 1 ? "" : "s"} but your query returns ${got.rows.length}.` };
    const g = ordered ? got.rows.map(key) : got.rows.map(key).sort(), w = ordered ? want.rows.map(key) : want.rows.map(key).sort();
    for (let i = 0; i < g.length; i++) if (g[i] !== w[i]) {
      if (ordered && got.rows.map(key).sort().join("|") === want.rows.map(key).sort().join("|")) return { ok: false, why: "You have the right rows, but in the wrong order. This question needs a specific ORDER BY." };
      return { ok: false, why: `The values differ${ordered ? ` at row ${i + 1}` : ""}. Expected ${w[i]} but found ${g[i]}.` };
    }
    return { ok: true };
  }

  function run(ds, sql) {
    const db = openDb(ds);
    try { return { db, results: db.exec(fix(sql)) }; } catch (e) { return { db, error: e.message || String(e) }; }
  }

  function judge(p, userSql) {
    if (!SQL) throw new Error("SQL engine not loaded");
    if (p.kind === "mcq") { const ok = Number(userSql) === p.answer; return { ok, why: ok ? "" : "Not quite. Read the explanation below." }; }
    // expected result from the reference solution
    const ref = run(p.ds, p.solution);
    if (ref.error) throw new Error("Reference solution failed for " + p.id + ": " + ref.error);
    const want = table(p.kind === "dml" ? last(ref.db.exec(fix(p.check))) : last(ref.results));
    ref.db.close();
    const mine = run(p.ds, userSql);
    if (mine.error) { mine.db.close(); return { ok: false, error: mine.error, why: "Your SQL raised an error." }; }
    let shown, got;
    if (p.kind === "dml") {
      try { shown = last(mine.db.exec(fix(p.check))); } catch (e) { mine.db.close(); return { ok: false, error: e.message, why: "The check query could not run, so your change is not in the expected shape." }; }
      got = table(shown);
    } else {
      shown = last(mine.results);
      if (!shown) { mine.db.close(); return { ok: false, why: "Your SQL ran but returned no result set. Write a SELECT." }; }
      got = table(shown);
    }
    mine.db.close();
    const c = compare(got, want, !!p.ordered);
    return Object.assign({ shown: got, expectedRows: want.rows.length }, c);
  }

  // helper for the UI: schema (tables, columns, sample rows) for a dataset
  function schema(ds) {
    const db = openDb(ds);
    const names = db.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY rowid")[0].values.map(r => r[0]);
    const out = names.map(n => {
      const cols = db.exec(`SELECT name, type, "notnull", pk FROM pragma_table_info('${n}')`)[0].values.map(r => ({ name: r[0], type: r[1], notnull: !!r[2], pk: !!r[3] }));
      const sample = db.exec(`SELECT * FROM "${n}" LIMIT 3`)[0];
      const count = db.exec(`SELECT COUNT(*) FROM "${n}"`)[0].values[0][0];
      return { table: n, cols, sample: sample ? sample.values : [], count };
    });
    db.close(); return out;
  }

  root.SQLJudge = { setEngine(e) { SQL = e; }, judge, schema, run, openDb, table };
  if (typeof module !== "undefined") module.exports = root.SQLJudge;
})(typeof window !== "undefined" ? window : globalThis);

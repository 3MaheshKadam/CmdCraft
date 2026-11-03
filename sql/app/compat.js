/**
 * MySQL compatibility layer for the in-browser SQLite engine.
 * The roadmap is taught with MySQL 8 syntax; the engine is SQLite. This layer makes the common MySQL forms run:
 *   - SQL text rewrites: TRUNCATE, RENAME TABLE, MINUS, SHOW TABLES, DESCRIBE, CREATE/USE DATABASE (no-op),
 *     AUTO_INCREMENT, ENGINE=..., backtick identifiers, START TRANSACTION, EXPLAIN, DROP INDEX ... ON, INSERT IGNORE,
 *     LEFT()/RIGHT(), POSITION(x IN y), DATE_ADD/DATE_SUB(... INTERVAL n unit), x +/- INTERVAL n unit,
 *     TIMESTAMPDIFF(unit, a, b), > ANY (subquery), < ALL (subquery) and friends.
 *   - SQL functions: CONCAT, CONCAT_WS, IF, YEAR, MONTH, DAY, DATEDIFF, CURDATE, NOW, DATE_FORMAT, LOCATE, CHAR_LENGTH,
 *     SUBSTRING, LPAD, RPAD, REVERSE, REPEAT, FLOOR, CEIL, POWER, SQRT, REGEXP and more.
 * What cannot run in a browser database (stored procedures, user-defined SQL functions, isolation levels, materialized views,
 * MODIFY COLUMN) is taught as concepts, quizzes and the concurrency lab instead.
 */
(function (root) {
  // ---------- protect string literals / identifiers while rewriting ----------
  function protect(sql) {
    const saved = [];
    const text = sql.replace(/'(?:[^']|'')*'|"(?:[^"]|"")*"|`[^`]*`/g, m => { saved.push(m[0] === "`" ? '"' + m.slice(1, -1) + '"' : m); return "\u0001" + (saved.length - 1) + "\u0002"; });
    return { text, restore: t => t.replace(/\u0001(\d+)\u0002/g, (_, i) => saved[+i]) };
  }
  function balancedEnd(text, openIdx) {          // index of the ")" matching the "(" at openIdx
    let d = 0;
    for (let i = openIdx; i < text.length; i++) { if (text[i] === "(") d++; else if (text[i] === ")") { d--; if (d === 0) return i; } }
    return -1;
  }
  // > ANY (S)  ->  > (S ORDER BY 1 ASC LIMIT 1) ... see table below
  function rewriteAnyAll(text) {
    const re = /(<>|!=|>=|<=|=|>|<)\s*(ANY|SOME|ALL)\s*\(\s*(?=SELECT\b)/gi;
    let m, out = "", last = 0;
    while ((m = re.exec(text))) {
      const open = text.indexOf("(", m.index + m[1].length);
      const close = balancedEnd(text, open);
      if (close < 0) break;
      const op = m[1], kind = m[2].toUpperCase() === "ALL" ? "ALL" : "ANY", sub = text.slice(open + 1, close);
      let repl;
      if (kind === "ANY" && (op === "=")) repl = "IN (" + sub + ")";
      else if (kind === "ALL" && (op === "<>" || op === "!=")) repl = "NOT IN (" + sub + ")";
      else if (kind === "ALL" && op === "=") repl = "= (SELECT CASE WHEN COUNT(DISTINCT __v) = 1 THEN MIN(__v) END FROM (SELECT " + "1 AS __k, * FROM (" + sub + ")) , (SELECT 0 AS __v) )";   // rare; not supported precisely
      else {
        // pick the extreme row of the subquery: ANY with > / >= wants the smallest value, ANY with < / <= the largest; ALL is the opposite
        const wantMin = (kind === "ANY") === (op === ">" || op === ">=");
        repl = op + " (" + sub.replace(/\s*;?\s*$/, "") + " ORDER BY 1 " + (wantMin ? "ASC" : "DESC") + " LIMIT 1)";
      }
      out += text.slice(last, m.index) + repl; last = close + 1; re.lastIndex = close + 1;
    }
    return out + text.slice(last);
  }
  const UNIT = { YEAR: "years", MONTH: "months", WEEK: "weeks", DAY: "days", HOUR: "hours", MINUTE: "minutes", SECOND: "seconds" };

  function rewriteStatement(st) {
    let s = st.trim().replace(/;+\s*$/, "");
    if (!s) return "";
    if (/^(CREATE|DROP)\s+(DATABASE|SCHEMA)\b/i.test(s) || /^USE\s+\w+$/i.test(s)) return "SELECT 'OK' AS result";
    if (/^SHOW\s+TABLES$/i.test(s)) return "SELECT name AS Tables_in_db FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name";
    let m = /^(?:DESCRIBE|DESC)\s+(\w+)$/i.exec(s);
    if (m) return `SELECT name AS Field, type AS Type, CASE WHEN "notnull" = 0 THEN 'YES' ELSE 'NO' END AS "Null", CASE WHEN pk > 0 THEN 'PRI' ELSE '' END AS "Key", dflt_value AS "Default" FROM pragma_table_info('${m[1]}')`;
    if ((m = /^TRUNCATE\s+(?:TABLE\s+)?(\w+)$/i.exec(s))) return "DELETE FROM " + m[1];
    if ((m = /^RENAME\s+TABLE\s+(\w+)\s+TO\s+(\w+)$/i.exec(s))) return `ALTER TABLE ${m[1]} RENAME TO ${m[2]}`;
    if (/^START\s+TRANSACTION$/i.test(s)) return "BEGIN";
    if ((m = /^DROP\s+INDEX\s+(\w+)\s+ON\s+\w+$/i.exec(s))) return "DROP INDEX " + m[1];
    if ((m = /^CREATE\s+OR\s+REPLACE\s+VIEW\s+(\w+)\s+([\s\S]*)$/i.exec(s))) return "DROP VIEW IF EXISTS " + m[1] + ";\nCREATE VIEW " + m[1] + " " + m[2];
    s = s.replace(/\bSIGNAL\s+SQLSTATE\s+\S+\s+SET\s+MESSAGE_TEXT\s*=\s*(\u0001\d+\u0002)/gi, "SELECT RAISE(ABORT, $1)");
    if ((m = /^ALTER\s+TABLE\s+(\w+)\s+ADD\s+(?:CONSTRAINT\s+(\w+)\s+)?UNIQUE(?:\s+(?:KEY|INDEX)\s+\w+)?\s*\(([^)]*)\)$/i.exec(s))) return "CREATE UNIQUE INDEX " + (m[2] || "uq_" + m[1] + "_" + m[3].replace(/\W+/g, "_")) + " ON " + m[1] + "(" + m[3] + ")";
    if (/\bON\s+DUPLICATE\s+KEY\s+UPDATE\b/i.test(s)) {
      const i = s.search(/\bON\s+DUPLICATE\s+KEY\s+UPDATE\b/i);
      s = s.slice(0, i) + "ON CONFLICT DO UPDATE SET" + s.slice(i).replace(/^ON\s+DUPLICATE\s+KEY\s+UPDATE/i, "").replace(/\bVALUES\s*\(\s*(\w+)\s*\)/gi, "excluded.$1");
    }
    if (/^EXPLAIN\s+ANALYZE\s+/i.test(s)) s = s.replace(/^EXPLAIN\s+ANALYZE\s+/i, "EXPLAIN QUERY PLAN ");
    else if (/^EXPLAIN\s+(?!QUERY)/i.test(s)) s = s.replace(/^EXPLAIN\s+/i, "EXPLAIN QUERY PLAN ");
    s = s.replace(/^INSERT\s+IGNORE\b/i, "INSERT OR IGNORE");
    s = s.replace(/\bMINUS\b/gi, "EXCEPT");
    s = s.replace(/\bENGINE\s*=\s*\w+/gi, "").replace(/\bDEFAULT\s+CHARSET\s*=\s*\w+/gi, "").replace(/\bCHARSET\s*=\s*\w+/gi, "").replace(/\bCOLLATE\s*=\s*\w+/gi, "").replace(/\bAUTO_INCREMENT\s*=\s*\d+/gi, "");
    if (/\bAUTO_INCREMENT\b/i.test(s)) {
      s = s.replace(/(\w+)\s+(?:BIGINT|SMALLINT|TINYINT|INTEGER|INT)(?:\(\d+\))?(?:\s+UNSIGNED)?(?:\s+NOT\s+NULL)?(?:\s+PRIMARY\s+KEY)?\s+AUTO_INCREMENT(?:\s+PRIMARY\s+KEY)?/gi, "$1 INTEGER PRIMARY KEY AUTOINCREMENT");
      s = s.replace(/\bAUTO_INCREMENT\b/gi, "AUTOINCREMENT");
    }
    s = s.replace(/\bLEFT\s*\(/gi, "__left(").replace(/\bRIGHT\s*\(/gi, "__right(");
    s = s.replace(/\bPOSITION\s*\(\s*([^()]+?)\s+IN\s+([^()]+?)\s*\)/gi, "instr($2, $1)");
    s = s.replace(/\bTIMESTAMPDIFF\s*\(\s*(YEAR|MONTH|WEEK|DAY|HOUR|MINUTE|SECOND)\s*,/gi, (_, u) => "__tsdiff('" + u.toLowerCase() + "',");
    s = s.replace(/\bDATE_(ADD|SUB)\s*\(\s*([^(),]+(?:\([^()]*\))?)\s*,\s*INTERVAL\s+(-?\d+)\s+(YEAR|MONTH|WEEK|DAY|HOUR|MINUTE|SECOND)S?\s*\)/gi, (_, k, x, n, u) => `__dateadd(${x}, ${k.toUpperCase() === "SUB" ? -Number(n) : Number(n)}, '${u.toLowerCase()}')`);
    s = s.replace(/((?:\w+\([^()]*\))|[\w.]+|\u0001\d+\u0002)\s*([+-])\s*INTERVAL\s+(\d+)\s+(YEAR|MONTH|WEEK|DAY|HOUR|MINUTE|SECOND)S?\b/gi, (_, x, sign, n, u) => `__dateadd(${x}, ${sign === "-" ? -Number(n) : Number(n)}, '${u.toLowerCase()}')`);
    s = rewriteAnyAll(s);
    return s;
  }

  // CREATE TRIGGER ... BEGIN a; b; END keeps its inner semicolons in ONE statement
  function mergeTriggers(pieces) {
    const out = []; let acc = null;
    for (const piece of pieces) {
      if (acc !== null) { acc += ";" + piece; if (/\bEND\s*$/i.test(piece.trim())) { out.push(acc); acc = null; } continue; }
      if (/^\s*CREATE\s+(?:TEMP(?:ORARY)?\s+)?TRIGGER\b/i.test(piece) && /\bBEGIN\b/i.test(piece) && !/\bEND\s*$/i.test(piece.trim())) { acc = piece; continue; }
      out.push(piece);
    }
    if (acc !== null) out.push(acc);
    return out;
  }
  // MySQL clients: DELIMITER // ... // DELIMITER ; lets a body contain semicolons
  function splitStatements(text) {
    if (!/^\s*DELIMITER\s+\S+/im.test(text)) return mergeTriggers(text.split(";"));
    const out = []; let d = ";", buf = "";
    const flush = () => {
      if (!buf.trim()) { buf = ""; return; }
      if (d === ";") out.push(...mergeTriggers(buf.split(";"))); else buf.split(d).forEach(x => { if (x.trim()) out.push(x); });
      buf = "";
    };
    text.split("\n").forEach(line => {
      const m = /^\s*DELIMITER\s+(\S+)\s*$/i.exec(line);
      if (m) { flush(); d = m[1]; } else buf += line + "\n";
    });
    flush();
    return out;
  }
  function rewrite(sql) {
    const p = protect(String(sql));
    const parts = splitStatements(p.text).map(rewriteStatement).filter(Boolean);
    return p.restore(parts.join(";\n"));
  }

  // ---------- date helpers (UTC, MySQL-like month clamping) ----------
  const pad = (n, w) => String(n).padStart(w || 2, "0");
  function parseDate(x) {
    if (x === null || x === undefined) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(String(x));
    if (!m) return null;
    return { y: +m[1], mo: +m[2], d: +m[3], h: +(m[4] || 0), mi: +(m[5] || 0), s: +(m[6] || 0), hasTime: m[4] !== undefined };
  }
  const days = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
  function fmt(o, withTime) { return o.y + "-" + pad(o.mo) + "-" + pad(o.d) + (withTime ? " " + pad(o.h) + ":" + pad(o.mi) + ":" + pad(o.s) : ""); }
  function dateAdd(x, n, unit) {
    const p = parseDate(x); if (!p) return null;
    let t = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s);
    if (unit === "month" || unit === "year") {
      const months = unit === "year" ? n * 12 : n; const total = p.y * 12 + (p.mo - 1) + months;
      const y = Math.floor(total / 12), mo = total % 12 + 1, d = Math.min(p.d, days(y, mo));
      return fmt({ y, mo, d, h: p.h, mi: p.mi, s: p.s }, p.hasTime);
    }
    const ms = { week: 7 * 864e5, day: 864e5, hour: 36e5, minute: 6e4, second: 1e3 }[unit];
    const nd = new Date(t + n * ms);
    const withTime = p.hasTime || unit === "hour" || unit === "minute" || unit === "second";
    return fmt({ y: nd.getUTCFullYear(), mo: nd.getUTCMonth() + 1, d: nd.getUTCDate(), h: nd.getUTCHours(), mi: nd.getUTCMinutes(), s: nd.getUTCSeconds() }, withTime);
  }
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"], WDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  function dateFormat(x, f) {
    const p = parseDate(x); if (!p) return null;
    const dt = new Date(Date.UTC(p.y, p.mo - 1, p.d)), wd = dt.getUTCDay();
    const doy = Math.round((dt - Date.UTC(p.y, 0, 1)) / 864e5) + 1;
    const map = { Y: p.y, y: pad(p.y % 100), m: pad(p.mo), c: p.mo, d: pad(p.d), e: p.d, H: pad(p.h), h: pad(p.h % 12 || 12), I: pad(p.h % 12 || 12), i: pad(p.mi), s: pad(p.s), S: pad(p.s), M: MONTHS[p.mo - 1], b: MONTHS[p.mo - 1].slice(0, 3), W: WDAYS[wd], a: WDAYS[wd].slice(0, 3), j: pad(doy, 3), p: p.h >= 12 ? "PM" : "AM", w: wd, "%": "%" };
    return String(f).replace(/%(.)/g, (_, c) => (c in map ? map[c] : _));
  }
  function diffDays(a, b) { const x = parseDate(a), y = parseDate(b); if (!x || !y) return null; return Math.round((Date.UTC(x.y, x.mo - 1, x.d) - Date.UTC(y.y, y.mo - 1, y.d)) / 864e5); }
  function tsDiff(unit, a, b) {
    const x = parseDate(a), y = parseDate(b); if (!x || !y) return null;
    if (unit === "month" || unit === "year") {
      let months = (y.y - x.y) * 12 + (y.mo - x.mo); const dayStart = x.d * 1e6 + (x.h * 3600 + x.mi * 60 + x.s), dayEnd = y.d * 1e6 + (y.h * 3600 + y.mi * 60 + y.s);
      if (months > 0 && dayEnd < dayStart) months--; else if (months < 0 && dayEnd > dayStart) months++;
      return unit === "year" ? Math.trunc(months / 12) : months;
    }
    const secs = (Date.UTC(y.y, y.mo - 1, y.d, y.h, y.mi, y.s) - Date.UTC(x.y, x.mo - 1, x.d, x.h, x.mi, x.s)) / 1000;
    return Math.trunc(secs / { week: 604800, day: 86400, hour: 3600, minute: 60, second: 1 }[unit]);
  }

  // ---------- install SQL functions on a sql.js Database ----------
  function install(db) {
    const reg = (name, n, fn) => { const f = function () { return fn.apply(null, arguments); }; Object.defineProperty(f, "length", { value: n }); db.create_function(name, f); };
    const regVar = (name, fn) => reg(name, -1, fn);   // variadic
    const nul = (...a) => a.some(v => v === null || v === undefined);
    regVar("CONCAT", (...a) => (nul(...a) ? null : a.join("")));
    regVar("CONCAT_WS", (sep, ...a) => (sep === null ? null : a.filter(v => v !== null && v !== undefined).join(sep)));
    reg("IF", 3, (c, a, b) => (c && c !== "0" ? a : b));
    reg("YEAR", 1, x => { const p = parseDate(x); return p ? p.y : null; });
    reg("MONTH", 1, x => { const p = parseDate(x); return p ? p.mo : null; });
    reg("DAY", 1, x => { const p = parseDate(x); return p ? p.d : null; });
    reg("DAYOFMONTH", 1, x => { const p = parseDate(x); return p ? p.d : null; });
    reg("DAYOFWEEK", 1, x => { const p = parseDate(x); return p ? new Date(Date.UTC(p.y, p.mo - 1, p.d)).getUTCDay() + 1 : null; });
    reg("DAYNAME", 1, x => { const p = parseDate(x); return p ? WDAYS[new Date(Date.UTC(p.y, p.mo - 1, p.d)).getUTCDay()] : null; });
    reg("MONTHNAME", 1, x => { const p = parseDate(x); return p ? MONTHS[p.mo - 1] : null; });
    reg("HOUR", 1, x => { const p = parseDate(x); return p ? p.h : null; });
    reg("DATEDIFF", 2, diffDays);
    reg("CURDATE", 0, () => new Date().toISOString().slice(0, 10));
    reg("NOW", 0, () => new Date().toISOString().slice(0, 19).replace("T", " "));
    reg("DATE_FORMAT", 2, dateFormat);
    reg("__dateadd", 3, dateAdd);
    reg("__tsdiff", 3, tsDiff);
    reg("__left", 2, (s, n) => (nul(s, n) ? null : String(s).slice(0, Math.max(0, n))));
    reg("__right", 2, (s, n) => (nul(s, n) ? null : n <= 0 ? "" : String(s).slice(-n)));
    regVar("LOCATE", (sub, s, pos) => (nul(sub, s) ? null : (String(s).indexOf(sub, pos === undefined ? 0 : Math.max(0, pos - 1)) + 1)));
    reg("CHAR_LENGTH", 1, s => (s === null ? null : String(s).length));
    regVar("SUBSTRING", (s, a, n) => { if (nul(s, a)) return null; s = String(s); const from = a > 0 ? a - 1 : Math.max(0, s.length + a); return n === undefined ? s.slice(from) : s.substr(from, Math.max(0, n)); });
    reg("LPAD", 3, (s, n, p) => (nul(s, n, p) ? null : String(s).length >= n ? String(s).slice(0, n) : (String(p).repeat(n) + s).slice(-n)));
    reg("RPAD", 3, (s, n, p) => (nul(s, n, p) ? null : String(s).length >= n ? String(s).slice(0, n) : (s + String(p).repeat(n)).slice(0, n)));
    reg("REVERSE", 1, s => (s === null ? null : String(s).split("").reverse().join("")));
    reg("REPEAT", 2, (s, n) => (nul(s, n) ? null : String(s).repeat(Math.max(0, n))));
    reg("LCASE", 1, s => (s === null ? null : String(s).toLowerCase()));
    reg("UCASE", 1, s => (s === null ? null : String(s).toUpperCase()));
    reg("FLOOR", 1, x => (x === null ? null : Math.floor(x)));
    reg("CEIL", 1, x => (x === null ? null : Math.ceil(x)));
    reg("CEILING", 1, x => (x === null ? null : Math.ceil(x)));
    reg("POWER", 2, (a, b) => (nul(a, b) ? null : Math.pow(a, b)));
    reg("POW", 2, (a, b) => (nul(a, b) ? null : Math.pow(a, b)));
    reg("SQRT", 1, x => (x === null || x < 0 ? null : Math.sqrt(x)));
    reg("MOD", 2, (a, b) => (nul(a, b) || b === 0 ? null : a % b));
    reg("REGEXP", 2, (pat, s) => { if (nul(pat, s)) return null; try { return new RegExp(pat, "i").test(String(s)) ? 1 : 0; } catch (e) { return 0; } });
    reg("REGEXP_LIKE", 2, (s, pat) => { if (nul(pat, s)) return null; try { return new RegExp(pat, "i").test(String(s)) ? 1 : 0; } catch (e) { return 0; } });
  }

  root.SQLCompat = { rewrite, install };
  if (typeof module !== "undefined") module.exports = root.SQLCompat;
})(typeof window !== "undefined" ? window : globalThis);

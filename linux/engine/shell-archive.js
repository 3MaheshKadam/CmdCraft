/**
 * CmdCraft shell, part 4: zip/unzip and checksums (sha256sum with a real SHA-256, so verification drills are genuine).
 */
(function (root) {
  const VS = root.VirtualShell;
  if (!VS) return;
  const { normalize, dirname, basename, nowStamp } = VS.internals;
  const P = VS.prototype;
  ["zip", "unzip", "sha256sum", "md5sum", "sha1sum"].forEach(n => VS.KNOWN.add(n));
  const lines = t => (t === "" ? [] : t.replace(/\n$/, "").split("\n"));

  // ---------- SHA-256 (pure JS, synchronous) ----------
  const K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
  function sha256(text) {
    const bytes = [];
    for (const ch of unescape(encodeURIComponent(text))) bytes.push(ch.charCodeAt(0));
    const bitLen = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    for (let i = 7; i >= 0; i--) bytes.push(i >= 4 ? 0 : (bitLen >>> (i * 8)) & 0xff);
    let h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const rotr = (x, n) => (x >>> n) | (x << (32 - n));
    for (let off = 0; off < bytes.length; off += 64) {
      const w = new Array(64);
      for (let i = 0; i < 16; i++) w[i] = (bytes[off + i * 4] << 24) | (bytes[off + i * 4 + 1] << 16) | (bytes[off + i * 4 + 2] << 8) | bytes[off + i * 4 + 3];
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      let [a, b, c, d, e, f, g, hh] = h;
      for (let i = 0; i < 64; i++) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25), ch = (e & f) ^ (~e & g);
        const t1 = (hh + S1 + ch + K[i] + w[i]) | 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22), maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + maj) | 0;
        hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      h = [h[0] + a, h[1] + b, h[2] + c, h[3] + d, h[4] + e, h[5] + f, h[6] + g, h[7] + hh].map(x => x | 0);
    }
    return h.map(x => (x >>> 0).toString(16).padStart(8, "0")).join("");
  }
  VS.sha256 = sha256;
  // md5/sha1 are not implemented for real; a stable fake digest keeps those commands usable
  const fakeDigest = (text, len) => { let s = sha256("x" + text); while (s.length < len) s += sha256(s); return s.slice(0, len); };

  P.digestCmd = function (name, args, flags, stdin) {
    const hashOf = t => (name === "sha256sum" ? sha256(t) : name === "sha1sum" ? fakeDigest(t, 40) : fakeDigest(t, 32));
    const files = args.filter(a => !a.startsWith("-"));
    if (flags.has("c")) {
      const listFile = files[0];
      const r = this.readForTool(listFile, name);
      if (r.err) return { err: r.err, code: 1 };
      let out = "", bad = 0, missing = 0;
      lines(r.text).forEach(l => {
        const m = /^([0-9a-f]+)\s+\*?(.+)$/.exec(l);
        if (!m) return;
        const f = this.readForTool(m[2], name);
        if (f.err) { out += m[2] + ": FAILED open or read\n"; missing++; return; }
        if (hashOf(f.text) === m[1]) out += m[2] + ": OK\n"; else { out += m[2] + ": FAILED\n"; bad++; }
      });
      const err = bad ? `${name}: WARNING: ${bad} computed checksum${bad > 1 ? "s" : ""} did NOT match\n` : "";
      return { out, err, code: bad || missing ? 1 : 0 };
    }
    if (!files.length) return { out: hashOf(stdin) + "  -\n" };
    let out = "", err = "";
    files.forEach(f => { const r = this.readForTool(f, name); if (r.err) err += r.err; else out += hashOf(r.text) + "  " + f + "\n"; });
    return { out, err, code: err ? 1 : 0 };
  };
  P.cmd_sha256sum = function (a, f, s) { return this.digestCmd("sha256sum", a, f, s); };
  P.cmd_sha1sum = function (a, f, s) { return this.digestCmd("sha1sum", a, f, s); };
  P.cmd_md5sum = function (a, f, s) { return this.digestCmd("md5sum", a, f, s); };

  // ---------- zip / unzip ----------
  P.cmd_zip = function (args, flags) {
    const rest = args.filter(a => !a.startsWith("-"));
    if (rest.length < 2) return { err: "zip error: Nothing to do! (try: zip -r archive.zip folder)\n", code: 12 };
    let name = rest[0]; if (!/\.zip$/i.test(name)) name += ".zip";
    const entries = []; let err = "";
    rest.slice(1).forEach(src => {
      const n = this.lookup(this.abs(src), true);
      if (!n) { err += "\tzip warning: name not matched: " + src + "\n"; return; }
      if (n.type === "dir" && !flags.has("r")) { entries.push({ path: src.replace(/\/$/, "") + "/", isDir: true, node: null }); return; }
      this.collectEntries(n, src.replace(/\/$/, ""), entries);
    });
    if (!entries.length) return { err: err + "\nzip error: Nothing to do! (" + name + ")\n", code: 12 };
    const raw = entries.reduce((s, e) => s + (e.node ? e.node.size : 0), 0);
    const parent = this.lookup(dirname(this.abs(name)), true);
    if (!parent) return { err: "zip error: Could not create output file (" + name + ")\n", code: 15 };
    const node = { name: basename(this.abs(name)), type: "file", mode: 0o644, owner: "ubuntu", group: "ubuntu", content: null, size: Math.max(120, Math.round(raw * 0.45) + 22 * entries.length), mtime: nowStamp(), age: 0, archive: { z: true, zip: true, entries } };
    parent.children.set(node.name, node);
    this.lastArchive = { op: "create", file: name, entries: entries.map(e => e.path), size: node.size, raw: Math.max(raw, node.size) };
    return { out: entries.map(e => "  adding: " + e.path + (e.isDir ? " (stored 0%)" : " (deflated " + (raw ? 55 : 0) + "%)")).join("\n") + "\n", err };
  };
  P.cmd_unzip = function (args, flags) {
    const di = args.indexOf("-d");
    const dest = di !== -1 ? args[di + 1] : null;
    const file = args.filter((a, i) => !a.startsWith("-") && args[i - 1] !== "-d")[0];
    if (!file) return { err: "UnZip 6.00 of 20 April 2009, by Debian.\nUsage: unzip [-Z] [-opts[modifiers]] file[.zip] [list] [-x xlist] [-d exdir]\n", code: 10 };
    const n = this.lookup(this.abs(file), true) || this.lookup(this.abs(file + ".zip"), true);
    if (!n) return { err: "unzip:  cannot find or open " + file + ", " + file + ".zip or " + file + ".ZIP.\n", code: 9 };
    if (!n.archive || !n.archive.zip) return { err: "unzip: cannot find zipfile directory in one of " + file + " or\n        " + file + ".zip, and cannot find " + file + ".ZIP, period.\n", code: 9 };
    const ents = n.archive.entries;
    if (flags.has("l")) {
      const total = ents.reduce((s, e) => s + (e.node ? e.node.size : 0), 0);
      return { out: "Archive:  " + file + "\n  Length      Date    Time    Name\n---------  ---------- -----   ----\n" + ents.map(e => String(e.node ? e.node.size : 0).padStart(9) + "  2026-10-29 14:00   " + e.path).join("\n") + "\n---------                     -------\n" + String(total).padStart(9) + "                     " + ents.length + " file" + (ents.length === 1 ? "" : "s") + "\n" };
    }
    const base = dest ? this.abs(dest) : this.cwd;
    this.mkdirp(base);
    let out = "Archive:  " + file + "\n";
    ents.forEach(e => {
      const target = normalize(base + "/" + e.path);
      if (e.isDir) { this.mkdirp(target); out += "   creating: " + e.path + "\n"; return; }
      this.mkdirp(dirname(target));
      const f = this.createFile(target, e.node.content === null ? "" : e.node.content);
      f.content = e.node.content; f.size = e.node.size; f.mode = e.node.mode; f.sizeDeclared = true;
      out += "  inflating: " + e.path + "\n";
    });
    this.lastArchive = { op: "extract", file, entries: ents.map(e => e.path), size: n.size, into: base };
    return { out };
  };
})(typeof window !== "undefined" ? window : globalThis);

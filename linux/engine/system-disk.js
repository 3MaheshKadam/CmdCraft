/**
 * CmdCraft simulated system, part 5: disk administration (Module 17, Part B).
 * Partition (fdisk/parted), format (mkfs), mount/umount, /etc/fstab + mount -a, swap, fsck, resize.
 * State lives in sys.disks (devices, mounts, filesystems, swaps), so lsblk, df, findmnt, free and blkid all agree.
 */
(function (root) {
  if (!root.SystemState) return;
  const pad = (s, n) => String(s).padEnd(n);
  const lp = (s, n) => String(s).padStart(n);
  const MIB = s => { const m = /^([\d.]+)\s*([KMGT]?)i?B?$/i.exec(String(s || "").trim()); if (!m) return 0; const v = parseFloat(m[1]); return { "": v / 1048576, K: v / 1024, M: v, G: v * 1024, T: v * 1048576 }[m[2].toUpperCase()]; };
  const HUMAN = mib => (mib >= 1024 * 1024 ? +(mib / 1048576).toFixed(1) + "T" : mib >= 1024 ? +(mib / 1024).toFixed(1) + "G" : Math.round(mib) + "M");
  const GIB = mib => (mib >= 1024 ? +(mib / 1024).toFixed(2) + " GiB" : Math.round(mib) + " MiB");
  let uuidSeq = 0;
  const newUuid = () => { uuidSeq++; const h = n => ("00000000" + ((n * 2654435761) >>> 0).toString(16)).slice(-8); return h(uuidSeq) + "-" + h(uuidSeq + 7).slice(0, 4) + "-4" + h(uuidSeq + 3).slice(0, 3) + "-9" + h(uuidSeq + 5).slice(0, 3) + "-" + h(uuidSeq + 11) + h(uuidSeq + 13).slice(0, 4); };

  root.SystemState.extensions.push(function (sys, seed) {
    if (!seed.disks) return;
    const D = sys.disks = JSON.parse(JSON.stringify(seed.disks));   // own copy: a retried scenario must start from the seed again
    D.swaps = D.swaps || [];
    D.filesystems = D.filesystems || [];
    const reg = (name, fn, supported) => { sys.ext[name] = { has: () => !!sys.disks, fn, supported: supported || (() => true) }; };
    const prevExtra = sys.extraState;
    sys.extraState = () => [prevExtra ? prevExtra() : null, D.devices, D.mounts, D.swaps];
    const isRoot = sh => !!(sh && sh.asRoot);
    const allDevs = () => { const r = []; D.devices.forEach(d => { r.push(d); (d.children || []).forEach(c => r.push(c)); }); return r; };
    const findDev = p => { const n = String(p || "").replace(/^\/dev\//, ""); return allDevs().find(d => d.name === n) || null; };
    const diskOf = part => D.devices.find(d => (d.children || []).includes(part)) || null;
    const mountOf = dev => D.mounts.find(m => m.source === "/dev/" + dev.name);
    const parentName = (disk, i) => disk.name + (/\d$/.test(disk.name) ? "p" : "") + i;
    const resolve = spec => {
      if (/^UUID=/.test(spec)) return allDevs().find(d => d.uuid === spec.slice(5)) || null;
      if (/^LABEL=/.test(spec)) return allDevs().find(d => d.label === spec.slice(6)) || null;
      return findDev(spec);
    };
    const readFile = (sh, p) => { const n = sh.lookup(p, true); return n && n.type === "file" ? n.content || "" : null; };
    const fstabRows = sh => {
      const t = readFile(sh, "/etc/fstab"); if (t === null) return [];
      return t.split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#")).map(l => { const c = l.split(/\s+/); return { spec: c[0], target: c[1], fstype: c[2], options: c[3] || "defaults" }; });
    };
    const addFsRow = (dev, target) => {
      const mib = MIB(dev.size);
      D.filesystems = D.filesystems.filter(f => f.mount !== target);
      D.filesystems.push({ fs: "/dev/" + dev.name, size: HUMAN(mib * 0.98), used: "24K", avail: HUMAN(mib * 0.93), pct: 1, mount: target, inodes: [Math.round(mib * 64), 11] });
    };
    const doMount = (dev, target, fstype, options) => {
      D.mounts.push({ target, source: "/dev/" + dev.name, fstype: fstype || dev.fstype, options: options || "rw,relatime" });
      dev.mount = target; addFsRow(dev, target);
    };
    const syncSwap = () => {
      const total = D.swaps.reduce((s, x) => s + x.mib, 0);
      if (sys.perfData) { const cur = sys.perfData(); sys.perf = Object.assign({}, sys.perf || {}, { mem: Object.assign({}, cur.mem, { swapTotal: total, swapUsed: total ? cur.mem.swapUsed || 0 : 0 }) }); }
    };
    const needRoot = (sh, text, code) => (isRoot(sh) ? null : { err: text, code: code || 1 });

    // ---------- fdisk / parted / sfdisk-lite ----------
    const sectors = mib => Math.round(mib * 2048);
    const listDisk = d => {
      const mib = MIB(d.size);
      let o = `Disk /dev/${d.name}: ${GIB(mib)}, ${Math.round(mib * 1048576)} bytes, ${sectors(mib)} sectors\nUnits: sectors of 1 * 512 = 512 bytes\nSector size (logical/physical): 512 bytes / 512 bytes\nI/O size (minimum/optimal): 512 bytes / 512 bytes\nDisklabel type: ${d.label || (d.children && d.children.length ? "gpt" : "none")}\n`;
      if (d.children && d.children.length) {
        let start = 2048;
        o += "\nDevice" + " ".repeat(9) + "Start      End  Sectors  Size Type\n";
        d.children.forEach(c => { const sec = sectors(MIB(c.size)); o += pad("/dev/" + c.name, 15) + lp(start, 9) + lp(start + sec - 1, 10) + lp(sec, 9) + lp(HUMAN(MIB(c.size)), 6) + " " + (c.fstype === "vfat" ? "EFI System" : "Linux filesystem") + "\n"; start += sec; });
      }
      return o;
    };
    reg("fdisk", function (args, flags, stdin, sh) {
      const devArg = args.filter(a => !a.startsWith("-"))[0];
      if (flags.has("l")) {
        if (!isRoot(sh)) return { err: "fdisk: cannot open /dev/" + (D.devices[0] || {}).name + ": Permission denied\n", code: 1 };
        sys.lastDisk = { op: "list" };
        const ds = devArg ? [findDev(devArg)].filter(Boolean) : D.devices;
        if (devArg && !ds.length) return { err: "fdisk: cannot open " + devArg + ": No such file or directory\n", code: 1 };
        return { out: ds.map(listDisk).join("\n") };
      }
      if (!devArg) return { err: "Usage:\n fdisk [options] <disk>    change partition table\n fdisk [options] -l [<disk>] list partition table(s)\n", code: 1 };
      const disk = findDev(devArg);
      if (!disk || disk.type !== "disk") return { err: "fdisk: cannot open " + devArg + ": No such file or directory\n", code: 1 };
      if (!isRoot(sh)) return { err: "fdisk: cannot open " + devArg + ": Permission denied\n", code: 1 };
      const cmds = String(stdin || "").split("\n").map(s => s.trim().toLowerCase());
      if (!cmds.some(c => c === "w" || c === "q")) return { out: "Welcome to fdisk (util-linux 2.37.2).\nChanges will remain in memory only, until you decide to write them.\n\n[sandbox: fdisk is interactive. Script it with: printf 'n\\n\\n\\n\\n\\nw\\n' | sudo fdisk " + devArg + "   or use parted -s.]\n" };
      if (disk.children && disk.children.length && disk.fstype) return { err: "fdisk: disk already holds a filesystem\n", code: 1 };
      let out = "Welcome to fdisk (util-linux 2.37.2).\n\nDevice does not contain a recognized partition table.\nCreated a new DOS disklabel.\n\n";
      let wrote = false;
      if (cmds.includes("g")) { disk.label = "gpt"; out += "Created a new GPT disklabel.\n"; } else disk.label = disk.label || "dos";
      const used = (disk.children || []).reduce((s, c) => s + MIB(c.size), 0);
      if (cmds.includes("n")) {
        const free = MIB(disk.size) - used - 1;
        if (free <= 1) return { err: "No free sectors available.\n", code: 1 };
        const num = (disk.children || []).length + 1;
        const sizeArg = cmds.find(c => /^\+\d+[kmgt]$/i.test(c));
        const mib = sizeArg ? Math.min(free, MIB(sizeArg.slice(1))) : free;
        disk.children = disk.children || [];
        disk.children.push({ name: parentName(disk, num), size: HUMAN(mib), type: "part", majmin: "", fstype: null, uuid: "", mount: null });
        out += `Created a new partition ${num} of type 'Linux filesystem' and of size ${GIB(mib)}.\n`;
      }
      if (cmds.includes("w")) { wrote = true; out += "The partition table has been altered.\nCalling ioctl() to re-read partition table.\nSyncing disks.\n"; }
      sys.lastDisk = { op: "partition", disk: disk.name, wrote };
      return { out };
    }, () => true);

    reg("parted", function (args, flags, stdin, sh) {
      const rest = args.filter(a => a !== "-s" && a !== "--script");
      const devArg = rest[0]; const script = args.includes("-s") || args.includes("--script");
      if (rest[0] === "-l" || (rest[0] === "--list")) { if (!isRoot(sh)) return { err: "Error: Could not stat device /dev/" + D.devices[0].name + " - Permission denied.\n", code: 1 }; sys.lastDisk = { op: "list" }; return { out: D.devices.map(d => `Model: Virtual Disk (virtblk)\nDisk /dev/${d.name}: ${HUMAN(MIB(d.size))}B\nPartition Table: ${d.label || "unknown"}\n\nNumber  Start   End     Size    File system  Name     Flags\n` + (d.children || []).map((c, i) => ` ${i + 1}      1049kB  ${HUMAN(MIB(c.size))}B  ${HUMAN(MIB(c.size))}B  ${c.fstype || ""}`).join("\n")).join("\n\n") + "\n" }; }
      const disk = findDev(devArg);
      if (!devArg || !disk || disk.type !== "disk") return { err: "Error: Could not stat device " + (devArg || "") + " - No such file or directory.\n", code: 1 };
      if (!isRoot(sh)) return { err: "Error: Could not stat device " + devArg + " - Permission denied.\n", code: 1 };
      let i = 1, out = "";
      while (i < rest.length) {
        const c = rest[i];
        if (c === "mklabel") { disk.label = rest[i + 1]; disk.children = []; i += 2; }
        else if (c === "mkpart") {
          if (!disk.label) return { err: "Error: " + devArg + ": unrecognised disk label\n", code: 1 };
          const parts = rest.slice(i + 1); let take = 3;
          const pct = x => /%$/.test(x) ? parseFloat(x) / 100 * MIB(disk.size) : MIB(x);
          const startV = parts[parts.length >= 4 ? 2 : 1], endV = parts[parts.length >= 4 ? 3 : 2];
          const tokens = rest.slice(i + 1, i + 5);
          const nums = tokens.filter(t => /^[\d.]+(%|[kmgt]b?|MiB|GiB)?$/i.test(t));
          const sz = nums.length >= 2 ? pct(nums[1]) - pct(nums[0]) : MIB(disk.size) - 1;
          disk.children = disk.children || [];
          disk.children.push({ name: parentName(disk, disk.children.length + 1), size: HUMAN(Math.max(1, sz)), type: "part", majmin: "", fstype: null, uuid: "", mount: null });
          i += 1 + Math.min(4, tokens.length);
        } else if (c === "print") { out += listDisk(disk); i++; }
        else i++;
      }
      sys.lastDisk = { op: "partition", disk: disk.name, wrote: true };
      return { out: out + (script ? "" : "Information: You may need to update /etc/fstab.\n") };
    }, () => true);

    reg("partprobe", function (args, flags, stdin, sh) { return isRoot(sh) ? { out: "" } : { err: "Error: Could not stat device - Permission denied.\n", code: 1 }; });

    // ---------- blkid ----------
    reg("blkid", function (args, flags, stdin, sh) {
      if (!isRoot(sh) && !args.length) return { out: "", code: 2 };
      const target = args.filter(a => !a.startsWith("-"))[0];
      const list = target ? [findDev(target)].filter(Boolean) : allDevs().filter(d => d.fstype);
      if (target && !list.length) return { out: "", code: 2 };
      const withFs = list.filter(d => d.fstype);
      if (target && !withFs.length) return { out: "", code: 2 };
      sys.lastDisk = { op: "blkid" };
      return { out: withFs.map(d => "/dev/" + d.name + ":" + (d.label ? ' LABEL="' + d.label + '"' : "") + ' UUID="' + d.uuid + '" TYPE="' + d.fstype + '"').join("\n") + "\n" };
    });

    // ---------- mkfs ----------
    function mkfs(type, args, sh) {
      const name = "mkfs." + type;
      if (!isRoot(sh)) return { err: name + ": Permission denied while trying to determine filesystem size\n", code: 1 };
      const li = args.indexOf("-L"); const label = li !== -1 ? args[li + 1] : "";
      const devArg = args.filter((a, i) => !a.startsWith("-") && args[i - 1] !== "-L")[0];
      const dev = findDev(devArg);
      if (!devArg || !dev) return { err: name + ": cannot open " + (devArg || "") + ": No such file or directory\n", code: 1 };
      if (dev.type === "disk" && dev.children && dev.children.length) return { err: name + ": " + devArg + " contains a partition table; use a partition such as " + "/dev/" + dev.children[0].name + "\n", code: 1 };
      if (mountOf(dev)) return { err: name + ": " + devArg + " is mounted; will not make a filesystem here!\n", code: 1 };
      dev.fstype = type; dev.uuid = newUuid(); dev.label = label; dev.fsver = type === "ext4" ? "1.0" : "";
      sys.lastDisk = { op: "mkfs", dev: dev.name, type };
      const mib = MIB(dev.size);
      return { out: type === "xfs"
        ? `meta-data=/dev/${dev.name}  isize=512  agcount=4, agsize=${Math.round(mib * 64)} blks\n         =  sectsz=512  attr=2, projid32bit=1\ndata     =  bsize=4096  blocks=${Math.round(mib * 256)}, imaxpct=25\nnaming   =version 2  bsize=4096  ascii-ci=0, ftype=1\nlog      =internal log  bsize=4096  blocks=2560, version=2\nrealtime =none  extsz=4096  blocks=0, rtextents=0\n`
        : `mke2fs 1.46.5 (30-Dec-2021)\nCreating filesystem with ${Math.round(mib * 256)} 4k blocks and ${Math.round(mib * 64)} inodes\nFilesystem UUID: ${dev.uuid}\nSuperblock backups stored on blocks: \n\nAllocating group tables: done                            \nWriting inode tables: done                            \nCreating journal (16384 blocks): done\nWriting superblocks and filesystem accounting information: done\n\n` };
    }
    reg("mkfs.ext4", (a, f, s, sh) => mkfs("ext4", a, sh));
    reg("mkfs.xfs", (a, f, s, sh) => mkfs("xfs", a, sh));
    reg("mke2fs", (a, f, s, sh) => mkfs("ext4", a.filter(x => x !== "-t" && x !== "ext4"), sh));
    reg("mkfs", function (args, flags, stdin, sh) {
      const ti = args.indexOf("-t");
      if (ti === -1) return mkfs("ext2", args, sh);
      const type = args[ti + 1]; return mkfs(type, args.filter((a, i) => i !== ti && i !== ti + 1), sh);
    });

    // ---------- mount / umount ----------
    const prevMount = sys.ext.mount;
    reg("mount", function (args, flags, stdin, sh) {
      const ops = []; let fstype = null, opts = null;
      for (let i = 0; i < args.length; i++) {
        if (args[i] === "-t") fstype = args[++i]; else if (args[i] === "-o") opts = args[++i]; else if (!args[i].startsWith("-")) ops.push(args[i]);
      }
      if (flags.has("a") || args.includes("-a")) {
        if (!isRoot(sh)) return { err: "mount: only root can do that\n", code: 32 };
        let err = "", mounted = false;
        fstabRows(sh).forEach(r => {
          if (r.fstype === "swap" || r.target === "none" || D.mounts.some(m => m.target === r.target)) return;
          const e = tryMount(sh, r.spec, r.target, r.fstype, r.options);
          if (e) err += e; else mounted = true;
        });
        sys.lastDisk = { op: "mount-a" };
        return { out: "", err, code: err ? 32 : 0 };
      }
      if (!ops.length) return prevMount.fn.call(this, args, flags, stdin, sh);
      if (opts && /(^|,)remount(,|$)/.test(opts)) {
        if (!isRoot(sh)) return { err: "mount: " + (ops[0] || "") + ": must be superuser to use mount.\n", code: 32 };
        const key = ops[ops.length - 1];
        const m = D.mounts.find(x => x.target === sh.abs(key) || x.source === key);
        if (!m) return { err: "mount: " + key + ": not mounted.\n", code: 32 };
        const want = opts.split(",").filter(o => o !== "remount");
        const flagsNow = m.options.split(",").filter(o => o !== "ro" && o !== "rw");
        m.options = [want.includes("ro") ? "ro" : "rw", ...flagsNow, ...want.filter(o => o !== "ro" && o !== "rw")].join(",");
        sys.lastDisk = { op: "remount", target: m.target };
        return { out: "" };
      }
      if (!isRoot(sh)) return { err: "mount: " + (ops[1] || ops[0]) + ": must be superuser to use mount.\n", code: 32 };
      let spec = ops[0], target = ops[1];
      if (!target) { const row = fstabRows(sh).find(r => r.target === spec || r.spec === spec); if (!row) return { err: "mount: " + spec + ": can't find in /etc/fstab.\n", code: 32 }; spec = row.spec; target = row.target; fstype = fstype || row.fstype; opts = opts || row.options; }
      const e = tryMount(sh, spec, target, fstype, opts);
      sys.lastDisk = { op: "mount", target };
      return e ? { err: e, code: 32 } : { out: "" };
    }, () => true);
    function tryMount(sh, spec, target, fstype, options) {
      const dev = resolve(spec);
      if (!dev) return "mount: " + target + ": can't find " + spec + ".\n";
      const dir = sh.lookup(sh.abs(target), true);
      if (!dir || dir.type !== "dir") return "mount: " + target + ": mount point does not exist.\n";
      if (mountOf(dev)) return "mount: " + target + ": " + "/dev/" + dev.name + " already mounted on " + mountOf(dev).target + ".\n";
      if (D.mounts.some(m => m.target === sh.abs(target))) return "mount: " + target + ": /dev/" + dev.name + " already mounted or mount point busy.\n";
      if (!dev.fstype || (fstype && fstype !== "auto" && fstype !== "defaults" && fstype !== dev.fstype)) return "mount: " + target + ": wrong fs type, bad option, bad superblock on /dev/" + dev.name + ", missing codepage or helper program, or other error.\n";
      doMount(dev, sh.abs(target), dev.fstype, /^(defaults|)$/.test(options || "") ? "rw,relatime" : (options || "").replace(/^defaults,?/, "rw,relatime,") || "rw,relatime");
      return "";
    }
    reg("umount", function (args, flags, stdin, sh) {
      const t = args.filter(a => !a.startsWith("-"))[0];
      if (!t) return { err: "umount: no mount point specified.\n", code: 1 };
      if (!isRoot(sh)) return { err: "umount: " + t + ": must be superuser to unmount.\n", code: 32 };
      const abs = t.startsWith("/dev/") ? t : sh.abs(t);
      const m = D.mounts.find(x => x.target === abs || x.source === abs);
      if (!m) return { err: "umount: " + t + ": not mounted.\n", code: 32 };
      if (m.target === "/") return { err: "umount: /: target is busy.\n", code: 32 };
      if (sh.cwd === m.target || sh.cwd.startsWith(m.target + "/")) return { err: "umount: " + m.target + ": target is busy.\n        (In some cases useful info about processes that use\n         the device is found by lsof(8) or fuser(1))\n", code: 32 };
      D.mounts = D.mounts.filter(x => x !== m);
      D.filesystems = D.filesystems.filter(f => f.mount !== m.target);
      const dev = findDev(m.source); if (dev) dev.mount = null;
      sys.lastDisk = { op: "umount", target: m.target };
      return { out: "" };
    });

    // ---------- fsck / resize ----------
    const fsck = (args, sh) => {
      const dev = findDev(args.filter(a => !a.startsWith("-")).pop());
      if (!isRoot(sh)) return { err: "fsck: Permission denied\n", code: 8 };
      if (!dev) return { err: "fsck.ext4: No such file or directory while trying to open " + args.filter(a => !a.startsWith("-")).pop() + "\n", code: 8 };
      if (!dev.fstype) return { err: "fsck: fsck." + "(none)" + ": not found\n", code: 8 };
      if (mountOf(dev)) return { err: "e2fsck 1.46.5 (30-Dec-2021)\n/dev/" + dev.name + " is mounted.\ne2fsck: Cannot continue, aborting.\n", code: 8 };
      const wasDirty = !!dev.dirty; dev.dirty = false;
      sys.lastDisk = { op: "fsck", dev: dev.name };
      return { out: "fsck from util-linux 2.37.2\ne2fsck 1.46.5 (30-Dec-2021)\n" + (wasDirty ? "Pass 1: Checking inodes, blocks, and sizes\nPass 2: Checking directory structure\nPass 3: Checking directory connectivity\nPass 4: Checking reference counts\nPass 5: Checking group summary information\n/dev/" + dev.name + ": ***** FILE SYSTEM WAS MODIFIED *****\n" : "/dev/" + dev.name + ": clean, 11/" + Math.round(MIB(dev.size) * 64) + " files, 1/" + Math.round(MIB(dev.size) * 256) + " blocks\n") };
    };
    reg("fsck", (a, f, s, sh) => fsck(a, sh)); reg("e2fsck", (a, f, s, sh) => fsck(a, sh)); reg("fsck.ext4", (a, f, s, sh) => fsck(a, sh));
    reg("growpart", function (args, flags, stdin, sh) {
      if (!isRoot(sh)) return { err: "FAILED: need root\n", code: 1 };
      const disk = findDev(args[0]); const n = parseInt(args[1], 10);
      if (!disk || !disk.children || !disk.children[n - 1]) return { err: "FAILED: " + args[0] + ": no such partition " + args[1] + "\n", code: 2 };
      const c = disk.children[n - 1]; const others = disk.children.filter(x => x !== c).reduce((s, x) => s + MIB(x.size), 0);
      const before = c.size; c.size = HUMAN(MIB(disk.size) - others - 1);
      return { out: before === c.size ? "NOCHANGE: partition " + n + " is size " + before + ". it cannot be grown\n" : "CHANGED: partition=" + n + " start=2048 old: size=" + before + " end=- new: size=" + c.size + "\n" };
    });
    reg("resize2fs", function (args, flags, stdin, sh) {
      if (!isRoot(sh)) return { err: "resize2fs: Permission denied while trying to open " + args[0] + "\n", code: 1 };
      const dev = findDev(args.filter(a => !a.startsWith("-"))[0]);
      if (!dev || !dev.fstype) return { err: "resize2fs: Bad magic number in super-block while trying to open " + args[0] + "\n", code: 1 };
      const m = mountOf(dev); if (m) addFsRow(dev, m.target);
      sys.lastDisk = { op: "resize", dev: dev.name };
      return { out: "resize2fs 1.46.5 (30-Dec-2021)\n" + (m ? "Filesystem at /dev/" + dev.name + " is mounted on " + m.target + "; on-line resizing required\nOn-line resizing finished.\n" : "Resizing the filesystem on /dev/" + dev.name + " done.\n") };
    });
    reg("e2label", function (args, flags, stdin, sh) {
      const dev = findDev(args[0]); if (!dev) return { err: "e2label: No such file or directory while trying to open " + args[0] + "\n", code: 1 };
      if (args[1]) { if (!isRoot(sh)) return { err: "e2label: Permission denied\n", code: 1 }; dev.label = args[1]; return { out: "" }; }
      return { out: (dev.label || "") + "\n" };
    });

    // ---------- swap ----------
    reg("fallocate", function (args, flags, stdin, sh) {
      const li = args.indexOf("-l"); const size = li !== -1 ? args[li + 1] : null; const path = args.filter((a, i) => !a.startsWith("-") && args[i - 1] !== "-l")[0];
      if (!size || !path) return { err: "fallocate: no length argument specified\n", code: 1 };
      if (!isRoot(sh) && /^\/(swapfile|[^/]+)$/.test(sh.abs(path)) && sh.abs(path).split("/").length === 2) return { err: "fallocate: cannot open " + path + ": Permission denied\n", code: 1 };
      const abs = sh.abs(path); let n = sh.lookup(abs, true);
      if (!n) { sh.mkdirp(abs.slice(0, abs.lastIndexOf("/")) || "/"); n = sh.createFile(abs, ""); }
      n.size = MIB(size) * 1048576; n.sizeDeclared = true; n.owner = isRoot(sh) ? "root" : n.owner; n.group = isRoot(sh) ? "root" : n.group; n.mode = 0o644; n.swapReady = false;
      return { out: "" };
    });
    reg("mkswap", function (args, flags, stdin, sh) {
      const t = args.filter(a => !a.startsWith("-"))[0];
      if (!isRoot(sh)) return { err: "mkswap: cannot open " + t + ": Permission denied\n", code: 1 };
      const node = t && t.startsWith("/dev/") ? findDev(t) : sh.lookup(sh.abs(t || ""), true);
      if (!node) return { err: "mkswap: cannot open " + t + ": No such file or directory\n", code: 1 };
      if (t.startsWith("/dev/") && mountOf(node)) return { err: "mkswap: " + t + " is mounted; will not make swapspace\n", code: 1 };
      const mib = t.startsWith("/dev/") ? MIB(node.size) : node.size / 1048576;
      node.swapReady = true; if (t.startsWith("/dev/")) node.fstype = "swap"; if (!node.uuid) node.uuid = newUuid();
      const warn = !t.startsWith("/dev/") && (node.mode & 0o077) ? "mkswap: " + t + ": insecure permissions " + ("0" + (node.mode & 0o777).toString(8)) + ", fix with: chmod 0600 " + t + "\n" : "";
      sys.lastDisk = { op: "mkswap", target: t };
      return { out: `Setting up swapspace version 1, size = ${GIB(mib)} (${Math.round(mib * 1048576)} bytes)\nno label, UUID=${node.uuid}\n`, err: warn };
    });
    const swapOn = (spec, sh) => {
      const isDev = spec.startsWith("/dev/");
      const node = isDev ? findDev(spec) : sh.lookup(sh.abs(spec), true);
      if (!node) return "swapon: cannot open " + spec + ": No such file or directory\n";
      if (!node.swapReady) return "swapon: " + spec + ": read swap header failed\n";
      if (!isDev && (node.mode & 0o077)) return "swapon: " + spec + ": insecure permissions " + ("0" + (node.mode & 0o777).toString(8)) + ", 0600 suggested.\n";
      const name = isDev ? spec : sh.abs(spec);
      if (D.swaps.some(s => s.name === name)) return "swapon: " + spec + ": swapon failed: Device or resource busy\n";
      const mib = isDev ? MIB(node.size) : node.size / 1048576;
      D.swaps.push({ name, type: isDev ? "partition" : "file", mib, size: HUMAN(mib) });
      if (isDev) node.mount = "[SWAP]";
      syncSwap(); return "";
    };
    reg("swapon", function (args, flags, stdin, sh) {
      if (args.includes("--show") || flags.has("s")) {
        sys.lastDisk = { op: "swap" };
        if (!D.swaps.length) return { out: "" };
        return { out: "NAME       TYPE      SIZE USED PRIO\n" + D.swaps.map(s => pad(s.name, 10) + " " + pad(s.type, 9) + lp(s.size, 5) + lp("0B", 5) + lp("-2", 5)).join("\n") + "\n" };
      }
      if (!isRoot(sh)) return { err: "swapon: " + (args.filter(a => !a.startsWith("-"))[0] || "") + ": swapon failed: Operation not permitted\n", code: 255 };
      if (flags.has("a") || args.includes("-a")) {
        let err = "";
        fstabRows(sh).filter(r => r.fstype === "swap").forEach(r => { const dev = resolve(r.spec); err += swapOn(dev ? "/dev/" + dev.name : r.spec, sh); });
        sys.lastDisk = { op: "swap" }; return { out: "", err, code: err ? 255 : 0 };
      }
      const t = args.filter(a => !a.startsWith("-"))[0];
      if (!t) return { err: "swapon: missing argument\n", code: 1 };
      const e = swapOn(t, sh); sys.lastDisk = { op: "swap" };
      return e ? { err: e, code: 255 } : { out: "" };
    });
    reg("swapoff", function (args, flags, stdin, sh) {
      if (!isRoot(sh)) return { err: "swapoff: " + (args[0] || "") + ": swapoff failed: Operation not permitted\n", code: 255 };
      const all = flags.has("a") || args.includes("-a");
      const t = args.filter(a => !a.startsWith("-"))[0];
      const name = t && !t.startsWith("/dev/") ? sh.abs(t) : t;
      const hit = all ? D.swaps.slice() : D.swaps.filter(s => s.name === name);
      if (!hit.length) return { err: "swapoff: " + (t || "") + ": swapoff failed: Invalid argument\n", code: 255 };
      hit.forEach(h => { D.swaps = D.swaps.filter(s => s !== h); const dv = findDev(h.name); if (dv) dv.mount = null; });
      syncSwap(); sys.lastDisk = { op: "swap" }; return { out: "" };
    });
  });
})(typeof window !== "undefined" ? window : globalThis);

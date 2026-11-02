/**
 * CmdCraft command explainer. When a command doesn't solve the mission, this tells the learner:
 *   1. what the command they typed actually is and does (token by token),
 *   2. what it returned in the sandbox,
 *   3. why that is not what the mission asked for,
 *   4. what is missing, without giving the answer away (the solution sits behind a "show" toggle).
 *
 * `analyze()` builds a plain model and `render()` draws it, so the logic is testable without a page.
 */
(function (root) {
  // ---------- knowledge base: what each command is for, and what its common options mean ----------
  const KB = {
    ls: { does: "lists the files and folders in a directory", returns: "one name per entry; with -l each entry also shows permissions, owner, size and date", flags: { l: "long format: permissions, owner, size, date", a: "include hidden entries (names that start with a dot)", h: "human-readable sizes (KB, MB)", R: "recurse into sub-folders", t: "sort by modification time", r: "reverse the sort order", d: "list the directory itself, not what is inside", "1": "one entry per line", all: "include hidden entries" } },
    cd: { does: "changes your current directory", returns: "nothing on success; it only moves you (cd - prints the directory you return to)", flags: {} },
    pwd: { does: "prints the absolute path of your current directory", returns: "one line, such as /home/ubuntu", flags: { P: "resolve symlinks to the real path" } },
    cat: { does: "prints the contents of one or more files", returns: "the file's text, unchanged", flags: { n: "number every output line" } },
    less: { does: "shows a file one screen at a time", returns: "an interactive pager (not simulated here)", flags: {} },
    head: { does: "prints the first lines of a file or of piped input", returns: "the first 10 lines (change with -n)", flags: { n: "how many lines to print" } },
    tail: { does: "prints the last lines of a file or of piped input", returns: "the last 10 lines; with -f it keeps printing new lines as they are written", flags: { n: "how many lines to print", f: "follow the file and print new lines live", F: "follow, and reopen the file if it is rotated" } },
    grep: { does: "searches text for lines that match a pattern", returns: "only the matching lines (or non-matching with -v)", flags: { i: "ignore upper/lower case", r: "search folders recursively", R: "search folders recursively, following symlinks", n: "show line numbers", v: "invert: show lines that do NOT match", c: "print only a count of matching lines", l: "print only the names of files that match", w: "match whole words only", E: "extended regular expressions", "invert-match": "show lines that do not match", "ignore-case": "ignore upper/lower case" } },
    find: { does: "walks a folder tree and lists files that match your conditions", returns: "one path per match", flags: { name: "match the file name (use quotes around wildcards)", type: "f = files, d = directories", size: "match by size, e.g. +100M means larger than 100 MB", maxdepth: "do not go deeper than N levels" } },
    awk: { does: "processes text line by line, splitting each line into fields ($1, $2...)", returns: "whatever your print statement outputs for each line", flags: { F: "set the field separator" } },
    sed: { does: "edits a stream of text; s/old/new/ substitutes text", returns: "the edited text (the file is unchanged unless you use -i)", flags: { i: "edit the file in place", n: "print only lines you explicitly ask for", e: "add an expression" } },
    cut: { does: "extracts columns (fields) from each line", returns: "only the selected fields", flags: { d: "the delimiter that separates fields", f: "which field numbers to keep", c: "which character positions to keep" } },
    sort: { does: "sorts lines of text", returns: "the same lines, in order", flags: { n: "numeric order", r: "reverse order", h: "sort human-readable sizes (K, M, G)", u: "drop duplicates" } },
    uniq: { does: "collapses repeated adjacent lines (so sort first)", returns: "the lines without adjacent duplicates; -c prefixes each with its count", flags: { c: "prefix each line with how many times it occurred", d: "show only duplicated lines" } },
    wc: { does: "counts lines, words and bytes", returns: "numbers (lines words bytes), or just one with -l/-w/-c", flags: { l: "count lines", w: "count words", c: "count bytes" } },
    tee: { does: "copies its input to the screen and to a file at the same time", returns: "the same text it receives, and also writes it to the file", flags: { a: "append to the file instead of overwriting" } },
    echo: { does: "prints the text you give it", returns: "that text (with > or >> it goes into a file instead)", flags: { n: "do not add a trailing newline" } },
    touch: { does: "creates an empty file, or updates a file's timestamp", returns: "nothing; the file now exists", flags: {} },
    mkdir: { does: "creates a directory", returns: "nothing on success", flags: { p: "create missing parent folders too, and do not complain if it already exists" } },
    rmdir: { does: "removes an empty directory", returns: "nothing on success", flags: {} },
    rm: { does: "deletes files (there is no recycle bin)", returns: "nothing on success", flags: { r: "delete folders and everything in them", f: "force: no prompts, ignore missing files", R: "delete folders recursively" } },
    cp: { does: "copies files or folders", returns: "nothing on success", flags: { r: "copy folders and their contents", R: "copy folders and their contents", a: "archive: copy recursively and preserve permissions and times", v: "print each file as it is copied" } },
    mv: { does: "moves or renames files and folders", returns: "nothing on success", flags: { i: "ask before overwriting", n: "never overwrite" } },
    ln: { does: "creates links between files", returns: "nothing on success", flags: { s: "make a symbolic (soft) link instead of a hard link", f: "replace an existing link", n: "treat an existing link to a folder as a file" } },
    chmod: { does: "changes the permission bits of files and folders", returns: "nothing on success", flags: { R: "apply to a folder and everything inside it" } },
    chown: { does: "changes the owner (and group) of files", returns: "nothing on success", flags: { R: "apply to a folder and everything inside it" } },
    stat: { does: "shows a file's metadata from its inode", returns: "size, permissions, owner, inode number and three timestamps", flags: {} },
    namei: { does: "follows a path one component at a time", returns: "each folder on the way, with its owner and permissions (-l)", flags: { l: "long listing: permissions, owner and group for every component" } },
    ps: { does: "lists running processes", returns: "a table of processes (PID, CPU, memory, command)", flags: { a: "include processes of other users", u: "user-oriented format with %CPU and %MEM", x: "include processes with no terminal", e: "every process", f: "full format", sort: "sort the table by a column; a leading - means descending" } },
    top: { does: "shows live process activity", returns: "an interactive, refreshing view (not simulated here)", flags: {} },
    pgrep: { does: "finds process IDs by name or pattern", returns: "matching PIDs", flags: { l: "also print the process name", f: "match the whole command line, not just the name", a: "print the full command line" } },
    kill: { does: "sends a signal to a process by PID", returns: "nothing on success", flags: { "9": "SIGKILL: cannot be caught or ignored", "15": "SIGTERM: ask the process to shut down cleanly", s: "choose the signal by name" } },
    pkill: { does: "sends a signal to processes matched by name", returns: "nothing on success", flags: { f: "match the whole command line, not just the process name", "9": "SIGKILL", "15": "SIGTERM" } },
    systemctl: { does: "controls systemd services", returns: "status text, or nothing after an action", flags: { now: "start or stop immediately as well" } },
    journalctl: { does: "reads the systemd journal (logs)", returns: "log lines, oldest first", flags: { u: "only this unit/service", n: "how many recent lines", f: "follow new entries live", r: "newest first", since: "only entries after this time", "no-pager": "print everything instead of opening a pager" } },
    dmesg: { does: "prints the kernel's message buffer", returns: "kernel messages such as hardware events and out-of-memory kills", flags: { T: "human-readable timestamps" } },
    crontab: { does: "manages a user's scheduled jobs", returns: "-l prints the schedule; -e opens an editor", flags: { l: "list the current jobs", e: "edit the jobs" } },
    useradd: { does: "creates a user account", returns: "nothing on success", flags: { m: "also create the home directory", s: "set the login shell", G: "add to supplementary groups" } },
    usermod: { does: "modifies an existing user account", returns: "nothing on success", flags: { a: "append to groups instead of replacing them (use with -G)", G: "set supplementary groups" } },
    groupadd: { does: "creates a group", returns: "nothing on success", flags: {} },
    groups: { does: "prints the groups a user belongs to", returns: "a line of group names", flags: {} },
    id: { does: "prints your user ID, group ID and group memberships", returns: "uid=... gid=... groups=... (or just names with -Gn)", flags: { G: "print all group IDs", n: "print names instead of numbers", u: "print only the user ID", g: "print only the group ID" } },
    whoami: { does: "prints your current username", returns: "one word, such as ubuntu", flags: {} },
    getent: { does: "queries system databases such as passwd and group", returns: "the matching entry", flags: {} },
    uname: { does: "prints system information", returns: "the kernel name; -a adds hostname, kernel version and architecture", flags: { a: "everything: kernel, host, release, version, architecture", r: "kernel release", m: "machine architecture", s: "kernel name", n: "hostname" } },
    hostname: { does: "prints the machine's name", returns: "one line", flags: {} },
    ip: { does: "shows and configures network interfaces", returns: "with 'addr' it lists each interface and its IP addresses", flags: {} },
    ss: { does: "lists network sockets (open ports and connections)", returns: "one row per socket", flags: { t: "TCP sockets", u: "UDP sockets", l: "only listening sockets", p: "show the owning process", n: "numeric ports instead of service names", a: "all sockets" } },
    curl: { does: "makes an HTTP request from the command line", returns: "the response body; -v also shows the request and response headers", flags: { v: "verbose: show the full exchange", s: "silent: hide progress", I: "headers only", L: "follow redirects" } },
    dig: { does: "queries DNS servers", returns: "the DNS answer; +short prints only the address", flags: {} },
    ping: { does: "sends ICMP echo requests to test reachability", returns: "one reply line per packet, then loss and timing statistics", flags: { c: "stop after this many packets" } },
    df: { does: "shows free and used space on filesystems", returns: "a table per filesystem (-h makes sizes readable, -i shows inodes)", flags: { h: "human-readable sizes", i: "inodes instead of blocks", T: "show filesystem type" } },
    du: { does: "measures how much space files and folders use", returns: "a size next to each folder", flags: { h: "human-readable sizes", s: "only a total", x: "stay on one filesystem", d: "how many levels deep to report" } },
    lsblk: { does: "lists block devices (disks and partitions)", returns: "a device tree; -f adds filesystem type, label and mount point", flags: { f: "show filesystem information" } },
    findmnt: { does: "shows mounted filesystems", returns: "the mount entry for a path, or nothing if it is not a mount point", flags: {} },
    mount: { does: "attaches a filesystem to a directory", returns: "nothing on success", flags: {} },
    ssh: { does: "opens a secure shell on a remote machine", returns: "a remote session; -v prints each handshake step", flags: { v: "verbose: show every handshake step", p: "remote port", i: "identity (private key) file" } },
    scp: { does: "copies files to or from a remote machine over SSH", returns: "a progress line per file", flags: { r: "copy folders recursively", P: "remote port" } },
    "ssh-keygen": { does: "creates an SSH key pair", returns: "the saved key paths and the key fingerprint", flags: { t: "key type, e.g. ed25519", f: "output file", C: "comment" } },
    tar: { does: "bundles files into one archive, or unpacks one", returns: "with v it lists each file processed", flags: { c: "create an archive", x: "extract an archive", z: "compress with gzip", v: "verbose: list files", f: "the archive file name (must come right before it)", t: "list contents", C: "extract into this directory" } },
    gzip: { does: "compresses a file (it replaces the original with a .gz file)", returns: "nothing on success", flags: { d: "decompress", k: "keep the original file" } },
    apt: { does: "installs, updates and removes software on Debian/Ubuntu (subcommands: update, upgrade, install, remove, purge, autoremove, search, show, list)", returns: "a progress report of the packages it reads, downloads and sets up", flags: { y: "answer yes to prompts automatically", s: "simulate only, change nothing" } },
    "apt-get": { does: "the scriptable older form of apt for installing and removing Debian/Ubuntu packages", returns: "a progress report of packages processed", flags: { y: "answer yes to prompts automatically" } },
    dpkg: { does: "inspects or unpacks Debian packages at the low level (never downloads)", returns: "a package table or file list", flags: { l: "list installed packages", L: "list the files a package installed", S: "find which package owns a file", s: "show the status of a package" } },
    dnf: { does: "installs, updates and removes software on Fedora/RHEL/Rocky/Alma (subcommands: install, remove, update, search, info, list)", returns: "a dependency summary then Complete!", flags: { y: "answer yes to prompts automatically" } },
    yum: { does: "the older name of dnf on RHEL-family systems", returns: "a dependency summary then Complete!", flags: { y: "answer yes to prompts automatically" } },
    rpm: { does: "queries or installs RPM packages at the low level", returns: "package names or file lists", flags: { q: "query the package database", a: "all packages", l: "list the package's files", i: "show package information" } },
    apk: { does: "installs, removes and searches packages on Alpine Linux (subcommands: update, add, del, info, search)", returns: "a line per package installed and a summary", flags: {} },
    ufw: { does: "manages the Ubuntu firewall (subcommands: status, enable, disable, allow, deny, delete, default)", returns: "Rule added / Rule deleted, or a table of rules for status", flags: {} },
    "firewall-cmd": { does: "manages firewalld, the RHEL-family firewall", returns: "success, or the zone configuration for --list-all", flags: {} },
    zip: { does: "packs files into a .zip archive that Windows and macOS can open", returns: "an 'adding:' line per file", flags: { r: "recurse into folders" } },
    unzip: { does: "unpacks a .zip archive", returns: "an 'inflating:' line per file, or a listing with -l", flags: { l: "list contents without extracting", d: "extract into this directory" } },
    sha256sum: { does: "computes (or with -c verifies) the SHA-256 checksum of files", returns: "a 64-character digest followed by the file name, or OK/FAILED per file with -c", flags: { c: "check files against a list of expected digests" } },
    md5sum: { does: "computes or verifies MD5 checksums (fast but not secure against tampering)", returns: "a 32-character digest and the file name", flags: { c: "check against a list of digests" } },
    sha1sum: { does: "computes or verifies SHA-1 checksums", returns: "a 40-character digest and the file name", flags: { c: "check against a list of digests" } },
    source: { does: "runs a file's commands inside the current shell so its variables and functions stay", returns: "nothing unless the file prints", flags: {} },
    export: { does: "marks a shell variable for inheritance by every program you start", returns: "nothing on success", flags: { p: "print all exported variables" } },
    unset: { does: "removes a variable from the shell", returns: "nothing on success", flags: {} },
    printenv: { does: "prints environment variables (one value when you give a name)", returns: "NAME=value lines, or just the value", flags: {} },
    env: { does: "prints the environment, or runs a command with a modified one", returns: "NAME=value lines", flags: { i: "start with an empty environment" } },
    set: { does: "changes shell options (like -e stop on error, -u error on unset variables, -a auto-export)", returns: "nothing on success", flags: { a: "auto-export every variable assigned", e: "exit on the first error", u: "treat unset variables as errors" } },
    bash: { does: "starts a new shell, or with -c runs one command string in it", returns: "whatever the command prints", flags: { c: "run the following string as a command" } },
    htop: { does: "an interactive, colourful process viewer", returns: "a live screen of CPU, memory and processes", flags: {} },
    vmstat: { does: "reports memory, swap, IO and CPU activity over time", returns: "a table with one row per sample (r, b, swpd, free, si, so, bi, bo, us, sy, id, wa)", flags: {} },
    iostat: { does: "reports CPU and per-disk IO statistics", returns: "a CPU line and a device table", flags: { x: "extended statistics (await, %util)", d: "devices only" } },
    mpstat: { does: "reports CPU use per processor core", returns: "a row per core with %usr, %sys, %iowait, %idle", flags: { P: "which CPU (or ALL)" } },
    sar: { does: "records and reports system activity history (CPU, memory, load)", returns: "timestamped rows and an Average line", flags: { u: "CPU usage", r: "memory usage", q: "run queue and load average" } },
    pidstat: { does: "reports CPU use per process", returns: "a row per process with %usr, %system, %CPU", flags: { d: "disk IO per process", r: "memory per process" } },
    sshd: { does: "the SSH server daemon; with -t it only tests its configuration file", returns: "nothing when the config is valid, or the first error", flags: { t: "test the configuration and exit", T: "print the effective configuration" } },
    vim: { does: "opens a file in the Vim editor (modal: normal mode for commands, i for insert mode, :wq to save and quit)", returns: "a full-screen editor; nothing is saved until you write the file", flags: {} },
    vi: { does: "opens a file in Vi/Vim (same as vim on most systems)", returns: "a full-screen editor", flags: {} },
    view: { does: "opens a file in Vim in read-only mode", returns: "a full-screen viewer", flags: {} },
    nano: { does: "opens a file in the beginner-friendly Nano editor (shortcuts are listed at the bottom; ^ means Ctrl)", returns: "a full-screen editor; Ctrl-O saves, Ctrl-X exits", flags: {} },
    visudo: { does: "edits /etc/sudoers safely: it locks the file and checks the syntax before saving", returns: "an editor on the sudoers file", flags: {} },
    fdisk: { does: "lists or edits a disk's partition table (-l lists, no option edits interactively)", returns: "a description of each disk and its partitions", flags: { l: "list partition tables" } },
    parted: { does: "creates and inspects partition tables; -s runs its commands without questions", returns: "nothing in script mode, or a table with print", flags: { s: "script mode (no prompts)", l: "list all disks" } },
    blkid: { does: "prints the UUID, label and filesystem type of block devices", returns: "one line per device: /dev/xvdc1: UUID=\"...\" TYPE=\"ext4\"", flags: {} },
    "mkfs.ext4": { does: "formats a partition with an ext4 filesystem (destroys what was there)", returns: "a progress report ending in 'Writing superblocks ... done'", flags: { L: "set a label" } },
    "mkfs.xfs": { does: "formats a partition with an XFS filesystem (destroys what was there)", returns: "the filesystem geometry it created", flags: {} },
    mkfs: { does: "formats a partition; -t chooses the filesystem type", returns: "a progress report", flags: { t: "filesystem type", L: "set a label" } },
    umount: { does: "detaches a mounted filesystem (note: no n in the name)", returns: "nothing on success; 'target is busy' if something is using it", flags: {} },
    fsck: { does: "checks a filesystem for errors (never on a mounted one)", returns: "'clean' or a list of repaired problems", flags: { y: "answer yes to every repair question" } },
    e2label: { does: "shows or sets the label of an ext2/3/4 filesystem", returns: "the label, or nothing when setting", flags: {} },
    growpart: { does: "stretches a partition to fill the free space after it", returns: "CHANGED with the new size, or NOCHANGE", flags: {} },
    resize2fs: { does: "grows (or shrinks, offline) an ext4 filesystem to fit its partition", returns: "'Resizing the filesystem ... done'", flags: {} },
    fallocate: { does: "instantly reserves a file of the given size", returns: "nothing on success", flags: { l: "the length, e.g. 1G" } },
    mkswap: { does: "formats a file or partition as swap space", returns: "'Setting up swapspace version 1' and the UUID", flags: {} },
    swapon: { does: "activates swap space (with --show it lists what is active)", returns: "nothing, or a table with --show", flags: { a: "activate everything in /etc/fstab" } },
    swapoff: { does: "deactivates swap space", returns: "nothing on success", flags: { a: "all swap" } },
    seq: { does: "prints a sequence of numbers", returns: "one number per line", flags: {} },
    trap: { does: "runs a command when the shell gets a signal or a script ends (EXIT)", returns: "nothing until the event happens", flags: {} },
    local: { does: "declares a variable that exists only inside the current function", returns: "nothing", flags: {} },
    return: { does: "ends a function and sets its exit status", returns: "nothing", flags: {} },
    gunzip: { does: "decompresses a .gz file", returns: "nothing on success", flags: { k: "keep the .gz file" } },
    sudo: { does: "runs a command with administrator (root) rights", returns: "whatever the command prints", flags: {} },
    man: { does: "opens the manual page for a command", returns: "an interactive manual (not simulated here)", flags: {} },
    clear: { does: "clears the terminal screen", returns: "nothing", flags: {} },
    history: { does: "shows commands you ran before", returns: "a numbered list", flags: {} },
    date: { does: "prints the current date and time", returns: "one line", flags: {} },
    which: { does: "shows where an executable lives", returns: "a path", flags: {} },
    free: { does: "shows memory usage", returns: "a table of total, used and free memory", flags: { h: "human-readable sizes" } },
    uptime: { does: "shows how long the system has been running and its load", returns: "one line", flags: {} }
  };

  const OPERATORS = {
    "|": "pipe: sends the output of the command on the left into the command on the right",
    ">": "redirect: writes output to a file, replacing its contents",
    ">>": "redirect: appends output to the end of a file",
    "2>": "redirect error messages (stderr) to a file",
    "2>&1": "send error messages to the same place as normal output",
    "&&": "run the next command only if the previous one succeeded",
    ";": "run the next command regardless",
    "<": "feed a file into the command's input"
  };

  // ---------- parsing ----------
  function splitSegments(line) {
    const segs = []; let cur = "", q = null;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) { cur += c; if (c === q) q = null; continue; }
      if (c === "'" || c === '"') { q = c; cur += c; continue; }
      if (c === "|" || c === ";" || (c === "&" && line[i + 1] === "&")) {
        const op = c === "&" ? "&&" : c; if (op === "&&") i++;
        segs.push({ text: cur.trim(), op }); cur = ""; continue;
      }
      cur += c;
    }
    segs.push({ text: cur.trim(), op: null });
    return segs.filter(s => s.text);
  }

  function tokenize(text) {
    const out = []; const re = /"([^"]*)"|'([^']*)'|(\S+)/g; let m;
    while ((m = re.exec(text))) out.push({ raw: m[0], value: m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3], quoted: m[3] === undefined });
    return out;
  }

  function parseSegment(text) {
    let toks = tokenize(text);
    let sudo = false;
    if (toks[0] && toks[0].value === "sudo" && toks.length > 1 && !toks[1].value.startsWith("-")) { sudo = true; toks = toks.slice(1); }
    const name = toks[0] ? toks[0].value : "";
    const flags = [], operands = [], long = [];
    toks.slice(1).forEach(t => {
      const v = t.value;
      if (!t.quoted && /^--[A-Za-z][\w-]*(=.*)?$/.test(v)) long.push(v.slice(2).split("=")[0]);
      else if (!t.quoted && /^-[A-Za-z0-9]+$/.test(v)) v.slice(1).split("").forEach(l => flags.push(l));
      else operands.push(t);
    });
    return { text, name, sudo, tokens: toks, flags, long, operands };
  }

  function editDistance(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }
  function suggest(name) {
    let best = null, bestD = 99;
    Object.keys(KB).forEach(k => { const d = editDistance(name, k); if (d < bestD) { bestD = d; best = k; } });
    return bestD <= 2 && best !== name ? best : null;
  }

  const looksLikePath = v => /^[~./]/.test(v) || v.includes("/");
  const operandKind = t => (t.quoted ? "a search pattern or text" : looksLikePath(t.value) ? "a file or folder path" : /^\d+$/.test(t.value) ? "a number" : "an argument");

  // ---------- explaining one token ----------
  function explainTokens(seg) {
    const kb = KB[seg.name];
    const rows = [];
    if (seg.sudo) rows.push({ token: "sudo", meaning: KB.sudo.does });
    rows.push({ token: seg.name, meaning: kb ? kb.does : "not a command this sandbox knows" });
    seg.tokens.slice(1).forEach(t => {
      const v = t.value;
      if (!t.quoted && /^--[A-Za-z][\w-]*(=.*)?$/.test(v)) {
        const key = v.slice(2).split("=")[0];
        rows.push({ token: v, meaning: (kb && kb.flags[key]) || `long option "${key}" (no description in this sandbox)` });
      } else if (!t.quoted && /^-[A-Za-z0-9]+$/.test(v)) {
        v.slice(1).split("").forEach(l => rows.push({ token: "-" + l, meaning: (kb && kb.flags[l]) || `option -${l}${kb ? ` is not a common option of ${seg.name}` : ""}`, odd: !(kb && kb.flags[l]) && !!kb }));
      } else if (!t.quoted && /^-/.test(v) && !/^-\d+$/.test(v)) {
        rows.push({ token: v, meaning: `starts with a dash, so ${seg.name} reads it as an option, not as a name. Option letters follow the dash; a file or pattern must be written without it`, bad: true });
      } else if (OPERATORS[v]) {
        rows.push({ token: v, meaning: OPERATORS[v] });
      } else {
        rows.push({ token: t.raw, meaning: operandKind(t) });
      }
    });
    return rows;
  }

  function explainError(text) {
    if (/invalid option|unrecognized option|illegal option/i.test(text)) return "The command rejected an option it doesn't recognise.";
    if (/Usage:|missing operand|missing destination|missing file operand/i.test(text)) return "A required argument is missing, so the command printed its usage help.";
    if (/No such file or directory/i.test(text)) return "That path does not exist from where you are. Check the spelling, or run ls to see what is here.";
    if (/Permission denied/i.test(text)) return "You do not have permission on that file or folder.";
    if (/Is a directory/i.test(text)) return "You gave a folder where a file was expected.";
    if (/Not a directory/i.test(text)) return "A part of that path is a file, not a folder.";
    if (/File exists/i.test(text)) return "Something with that name already exists.";
    if (/No such process/i.test(text)) return "There is no process with that PID.";
    if (/could not be found/i.test(text)) return "systemd has no unit with that name.";
    if (/does not exist/i.test(text)) return "That user or group does not exist.";
    if (/Connection refused|timed out/i.test(text)) return "The other end did not accept the connection.";
    return "The command reported an error.";
  }

  // ---------- analysis ----------
  function analyze(typed, scenario, shell, result) {
    const segs = splitSegments(typed).map(s => Object.assign(parseSegment(s.text), { op: s.op }));
    const exp = (scenario && scenario.explanation && scenario.explanation.command) || "";
    const expLine = exp.split(" (or")[0].trim();
    const expSegs = splitSegments(expLine).map(s => parseSegment(s.text));
    const breakdown = (scenario && scenario.explanation && scenario.explanation.breakdown) || [];
    const model = { typed, segments: [], output: null, reasons: [], next: [], suggestion: null, solution: expLine, solutionParts: breakdown, objective: scenario ? scenario.objective : "" };

    segs.forEach(seg => {
      const kb = KB[seg.name];
      model.segments.push({ name: seg.name, known: !!kb, does: kb ? kb.does : null, returns: kb ? kb.returns : null, tokens: explainTokens(seg), op: seg.op });
    });

    // what it returned
    const known = segs.length && KB[segs[0].name];
    if (result && result.handled) {
      const out = (result.out || "").replace(/\n$/, ""), err = (result.err || "").replace(/\n$/, "");
      model.output = { kind: err ? "error" : out ? "output" : "silent", text: (err || out), lines: (err || out) ? (err || out).split("\n") : [], explain: err ? explainError(err) : null };
      if (out && err) model.output.extra = out;
    } else if (segs.length) {
      const first = segs[0];
      if (!KB[first.name]) {
        model.output = { kind: "unknown", text: `${first.name}: command not found` };
        const s = suggest(first.name);
        if (s) model.suggestion = s;
      } else {
        model.output = { kind: "unsupported", text: `This sandbox does not simulate that form of ${first.name}. In a real terminal it ${KB[first.name].returns}.` };
      }
    }

    // why it does not answer the mission
    const typedNames = segs.map(s => s.name);
    // compare against the part of the solution the learner actually used (so `uniq` without `sort` is judged as uniq)
    const expMain = expSegs.find(e => typedNames.includes(e.name)) || expSegs[0];
    if (expMain) {
      const typedMain = segs.find(s => s.name === expMain.name);
      if (!typedMain) {
        const t = segs[0];
        const tdoes = t && KB[t.name] ? KB[t.name].does : null;
        model.reasons.push(tdoes
          ? `${t.name} ${tdoes}. This mission needs a different tool: ${expMain.name} ${KB[expMain.name] ? KB[expMain.name].does : ""}.`.replace(/\.\./g, ".")
          : `This mission needs ${expMain.name}${KB[expMain.name] ? ", which " + KB[expMain.name].does : ""}.`);
        model.next.push(`Think about which command ${KB[expMain.name] ? "(" + KB[expMain.name].does + ")" : ""} matches the goal: ${model.objective}`);
      } else {
        const typedFlags = new Set(typedMain.flags), typedLong = new Set(typedMain.long);
        const missing = [...new Set(expMain.flags)].filter(f => !typedFlags.has(f));
        const missingLong = [...new Set(expMain.long)].filter(f => !typedLong.has(f));
        const extra = [...new Set(typedMain.flags)].filter(f => !expMain.flags.includes(f));
        const helpFor = (l) => {
          const part = breakdown.find(b => String(b.part).split(/[\s,]+/).some(p => p.startsWith("-") && !p.startsWith("--") && (p === "-" + l || p.slice(1).includes(l))));
          return part ? part.desc : (KB[expMain.name] && KB[expMain.name].flags[l]) || null;
        };
        missing.forEach(l => model.reasons.push(`An option is missing: ${helpFor(l) ? helpFor(l) : "one more option is needed"}.`));
        missingLong.forEach(l => model.reasons.push(`The option "${l}" is needed: ${(KB[expMain.name] && KB[expMain.name].flags[l]) || "see the hint"}.`));
        extra.forEach(l => { const d = KB[typedMain.name] && KB[typedMain.name].flags[l]; model.reasons.push(`-${l}${d ? " (" + d + ")" : ""} is not what this mission asks for.`); });
        // operands
        const typedOps = typedMain.operands.map(o => o.value), expOps = expMain.operands.map(o => o.value);
        const lackOps = expOps.filter(o => !typedOps.includes(o));
        if (typedOps.length < expOps.length) model.reasons.push(`A required argument is missing: the mission also needs ${expOps.length - typedOps.length} more (${[...new Set(lackOps.map(o => operandKind({ quoted: /^['"]/.test(o), value: o })))].join(", ")}).`);
        else if (lackOps.length && typedOps.length) {
          const wrong = typedOps.filter(o => !expOps.includes(o));
          model.reasons.push(wrong.length
            ? `${wrong.length > 1 ? "These arguments are" : "This argument is"} different from what the mission needs: ${wrong.join(", ")}. Re-read the question for the exact value, name or path.`
            : "The arguments are in a different order or form than the mission expects.");
        }
        if (typedOps.length > expOps.length && expOps.length) model.reasons.push("You gave more arguments than this mission needs.");
        if (!missing.length && !missingLong.length && !extra.length && !lackOps.length && typedOps.length === expOps.length) model.reasons.push("The command and options look right, but the result isn't what the mission checks for. Compare your output with the objective.");
      }
      // pipeline pieces
      expSegs.filter(es => es !== expMain).forEach(es => {
        if (!typedNames.includes(es.name)) model.reasons.push(`The solution also uses ${es.name} (${KB[es.name] ? KB[es.name].does : "see the breakdown"}), connected with a pipe.`);
      });
    }
    // syntax problems worth calling out
    segs.forEach(seg => seg.tokens.slice(1).forEach(t => {
      if (!t.quoted && /^-[^A-Za-z0-9-]/.test(t.value)) model.reasons.unshift(`${t.value} starts with a dash, so it is read as an option. A file name or pattern should not start with "-".`);
    }));
    const quotes = (typed.match(/['"]/g) || []).length;
    if (quotes % 2) model.reasons.unshift("A quote is not closed: every ' or \" needs a matching one.");
    if (!model.reasons.length) model.reasons.push("This does not produce the result the mission is checking for.");
    return model;
  }

  // ---------- rendering ----------
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

  function render(host, model, mode) {
    const explore = mode === "explore";
    host.replaceChildren();
    const wrap = el("div", "rounded-lg border text-xs space-y-3 p-3 " + (explore ? "bg-amber-500/5 border-amber-500/25" : "bg-red-500/10 border-red-500/20"));
    const head = el("div", "flex items-center gap-2 font-semibold " + (explore ? "text-amber-400" : "text-red-400"));
    head.appendChild(el("i", "fa-solid " + (explore ? "fa-circle-info" : "fa-triangle-exclamation")));
    head.appendChild(el("span", "", explore ? "That ran fine, but it isn't the answer yet" : "Not quite. Here is what your command did"));
    wrap.appendChild(head);

    const ran = el("div", "");
    ran.appendChild(el("div", "text-[10px] uppercase tracking-wide text-neutral-500 mb-1", "You ran"));
    ran.appendChild(el("code", "block font-mono text-neutral-100 bg-black/40 rounded px-2 py-1 break-all", model.typed));
    wrap.appendChild(ran);

    // what each part is
    const what = el("div", "");
    what.appendChild(el("div", "text-[10px] uppercase tracking-wide text-neutral-500 mb-1", "What it is"));
    model.segments.forEach(seg => {
      const box = el("div", "mb-1.5");
      if (!seg.known) box.appendChild(el("div", "text-neutral-300", `"${seg.name}" is not a command this sandbox recognises.`));
      else box.appendChild(el("div", "text-neutral-300", `${seg.name} ${seg.does}.`));
      const list = el("div", "mt-1 space-y-0.5");
      seg.tokens.slice(1).forEach(t => {
        const row = el("div", "flex gap-2");
        row.appendChild(el("code", "shrink-0 font-mono px-1 rounded border " + (t.bad ? "border-red-500/40 text-red-300 bg-red-500/10" : t.odd ? "border-amber-500/40 text-amber-300" : "border-neutral-700 text-emerald-300"), t.token));
        row.appendChild(el("span", "text-neutral-400", t.meaning));
        list.appendChild(row);
      });
      if (seg.tokens.length > 1) box.appendChild(list);
      what.appendChild(box);
      if (seg.op) what.appendChild(el("div", "text-[11px] text-neutral-500 mb-1.5", `then ${seg.op === "|" ? "its output goes through a pipe into" : seg.op === "&&" ? "if that succeeds," : "next:"}`));
    });
    wrap.appendChild(what);

    // what it returned
    if (model.output) {
      const o = model.output;
      const box = el("div", "");
      box.appendChild(el("div", "text-[10px] uppercase tracking-wide text-neutral-500 mb-1", "What it returned"));
      if (o.kind === "output" || o.kind === "error") {
        const pre = el("pre", "font-mono whitespace-pre-wrap break-all rounded bg-black/40 px-2 py-1.5 max-h-32 overflow-y-auto " + (o.kind === "error" ? "text-red-300" : "text-emerald-300"), o.lines.slice(0, 8).join("\n") + (o.lines.length > 8 ? `\n… ${o.lines.length - 8} more lines` : ""));
        box.appendChild(pre);
        if (o.explain) box.appendChild(el("div", "mt-1 text-neutral-400", o.explain));
      } else if (o.kind === "silent") box.appendChild(el("div", "text-neutral-400", "Nothing was printed. Many commands stay quiet on success; check whether anything changed."));
      else if (o.kind === "unknown") {
        box.appendChild(el("pre", "font-mono rounded bg-black/40 px-2 py-1.5 text-red-300", o.text));
        if (model.suggestion) box.appendChild(el("div", "mt-1 text-neutral-300", `Did you mean "${model.suggestion}"?`));
      } else box.appendChild(el("div", "text-neutral-400", o.text));
      wrap.appendChild(box);
    }

    // why it doesn't solve the mission
    const why = el("div", "");
    why.appendChild(el("div", "text-[10px] uppercase tracking-wide text-neutral-500 mb-1", "Why it doesn't complete this mission"));
    const ul = el("ul", "space-y-1 list-disc pl-4 text-neutral-300");
    model.reasons.slice(0, 5).forEach(r => ul.appendChild(el("li", "", r)));
    why.appendChild(ul);
    if (model.objective) why.appendChild(el("div", "mt-1.5 text-neutral-500", "The mission: " + model.objective));
    wrap.appendChild(why);

    // the answer stays hidden until asked for
    if (model.solution) {
      const det = el("details", "rounded border border-neutral-800 px-2 py-1.5");
      det.appendChild(el("summary", "cursor-pointer text-neutral-400 hover:text-neutral-200", "Show the solution"));
      det.appendChild(el("code", "block mt-1.5 font-mono text-emerald-300 bg-black/40 rounded px-2 py-1 break-all", model.solution));
      const parts = el("div", "mt-1.5 space-y-0.5");
      (model.solutionParts || []).forEach(p => { const row = el("div", "flex gap-2"); row.appendChild(el("code", "shrink-0 font-mono text-emerald-300", p.part)); row.appendChild(el("span", "text-neutral-400", p.desc)); parts.appendChild(row); });
      det.appendChild(parts);
      wrap.appendChild(det);
    }
    host.appendChild(wrap);
  }

  root.CmdFeedback = { analyze, render, KB, splitSegments, parseSegment };
  if (typeof module !== "undefined" && module.exports) module.exports = root.CmdFeedback;
})(typeof window !== "undefined" ? window : globalThis);

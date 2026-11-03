/** Linux reference part 2: text tools, processes, services, logs, cron. */
window.LINUX_REF.push(
  {
    id: "search_grep", name: "grep: searching text", topic: "search_grep",
    summary: "Finding lines that match a pattern, in files or in a pipeline.",
    k: [
      ["What grep does", "Prints the lines of its input that match a pattern (a regular expression)."],
      ["Basic vs extended regex", "Plain grep uses basic regex where + ? | ( ) need a backslash. grep -E (extended) treats them as operators."],
      ["Anchors and classes", "^ start of line, $ end, . any character, [0-9] a class, * zero or more of the previous item."],
      ["Exit status", "0 if something matched, 1 if nothing matched, 2 on error. if grep -q works in scripts."],
      ["Quote your pattern", "Unquoted *, $ and | are interpreted by the shell first."]
    ],
    cmds: [
      { c: "grep", d: "Prints lines matching a pattern.", i: "safe", o: [["-i", "ignore case"], ["-v", "invert: lines that do NOT match"], ["-n", "show line numbers"], ["-c", "count matching lines"], ["-r", "recurse through a directory"], ["-l", "only file names"], ["-w", "whole word"], ["-o", "only the matching part"], ["-A2 -B2 -C2", "lines of context"]], ex: [["grep -rn 'ERROR' /var/log/myapp/", "path:line:text for every match"]], g: "grep matches itself in ps aux | grep nginx; use pgrep, or grep '[n]ginx'.", rel: ["egrep", "rg", "awk"] },
      { c: "grep -E (egrep)", d: "Extended regular expressions: alternation, +, ?, groups.", i: "safe", o: [["'a|b'", "either"], ["'^[0-9]+$'", "lines that are only digits"], ["'(err|fail)ed?'", "grouping"]], ex: [["grep -E 'WARN|ERROR' app.log", "lines with either word"]], g: "-E is not the same as -P (Perl regex with lookaheads), which GNU grep supports separately.", rel: ["grep -P"] },
      { c: "grep -F (fgrep)", d: "Treats the pattern as a fixed string, not a regex.", i: "safe", o: [["-f patterns.txt", "many patterns from a file"]], ex: [["grep -F 'a.b*c' file", "matches that literal text, dots and star included"]], g: "Faster and safer when searching for text with special characters.", rel: ["grep"] },
      { c: "zgrep", d: "grep inside gzip-compressed files without unpacking.", i: "safe", o: [["same as grep", ""]], ex: [["zgrep ERROR /var/log/syslog.2.gz", "matching lines from the rotated log"]], g: "Rotated logs are compressed; plain grep finds nothing in them.", rel: ["zcat", "zless"] },
      { c: "grep -r with filters", d: "Search a tree but only certain files.", i: "safe", o: [["--include='*.py'", "only these files"], ["--exclude-dir=.git", "skip folders"], ["-I", "skip binary files"]], ex: [["grep -rn --include='*.js' 'TODO' src/", "all TODOs in JavaScript files"]], g: "Without --include, -r also scans binaries and node_modules, slow and noisy.", rel: ["find", "rg"] },
      { c: "grep -q / exit code", d: "Silent match test for scripts.", i: "safe", o: [["-q", "no output, just the exit status"]], ex: [["if grep -q 'PermitRootLogin yes' /etc/ssh/sshd_config; then echo risky; fi", "prints risky when found"]], g: "Combine with && and || for guard clauses in scripts.", rel: ["test"] },
      { c: "rg (ripgrep)", d: "A fast recursive search that respects .gitignore.", i: "safe", o: [["-i", "ignore case"], ["-t py", "limit to a file type"], ["-n", "line numbers (default)"]], ex: [["rg 'connection refused' .", "fast search through the repository"]], g: "Not installed by default; often the best tool for big code trees.", rel: ["grep"] }
    ]
  },
  {
    id: "search_find", name: "find: locating files", topic: "search_find",
    summary: "Searching the filesystem by name, type, size, age, owner and permissions.",
    k: [
      ["find walks the tree live", "It reads the directory structure at run time, so results are current but large trees are slow. locate uses a database and is fast but can be stale."],
      ["Tests combine with AND", "find . -type f -name '*.log' -size +10M means all three. Use -o for OR and parentheses (escaped) to group."],
      ["Numeric arguments", "+n means more than n, -n means less than n, n means exactly n. -mtime +7 is older than 7 days."],
      ["Actions", "-print (default), -delete, -exec COMMAND {} \\; or + to batch. -delete is irreversible: test with -print first."]
    ],
    cmds: [
      { c: "find", d: "Searches a directory tree for files matching tests.", i: "safe", o: [["-name 'x*'", "by name (case-sensitive)"], ["-iname", "case-insensitive name"], ["-type f|d|l", "file, directory, symlink"], ["-size +100M", "bigger than 100 MB"], ["-mtime -7", "modified within 7 days"], ["-mmin -30", "within 30 minutes"], ["-user bob", "owned by bob"], ["-perm -4000", "setuid bit set"], ["-maxdepth 2", "limit depth"]], ex: [["find /var/log -type f -size +100M", "the big log files"]], g: "Quote patterns: -name *.log lets the shell expand the star first. Redirect 2>/dev/null to hide permission noise.", rel: ["locate", "fd"] },
      { c: "find -exec", d: "Runs a command on every match.", i: "changes", o: [["-exec cmd {} \\;", "once per file"], ["-exec cmd {} +", "batch many files per call (faster)"], ["-ok", "ask before each"]], ex: [["find . -name '*.tmp' -exec rm {} +", "removes all temporary files"]], g: "Run it with -print first to see exactly what will be touched.", rel: ["xargs"] },
      { c: "find -delete", d: "Deletes the matched files.", i: "danger", o: [["-type f", "restrict to files"]], ex: [["find /tmp -type f -mtime +7 -delete", "removes week-old temp files"]], g: "Put -delete last: placed before the other tests it deletes everything.", rel: ["rm"] },
      { c: "locate / updatedb", d: "Fast filename search from a prebuilt database.", i: "safe", o: [["-i", "ignore case"], ["-c", "count"], ["sudo updatedb", "refresh the database"]], ex: [["locate nginx.conf", "all paths containing that name"]], g: "Results lag behind reality until updatedb runs (usually daily via cron).", rel: ["find"] },
      { c: "whereis", d: "Finds a command's binary, source and man page.", i: "safe", o: [["-b", "binaries only"]], ex: [["whereis python3", "python3: /usr/bin/python3 /usr/lib/python3 ..."]], g: "Looks only in standard places.", rel: ["which", "type"] },
      { c: "du with find", d: "Find what uses disk space.", i: "safe", o: [["find / -xdev -type f -size +500M", "huge files on this filesystem only"], ["-xdev", "do not cross into other mounts"]], ex: [["find / -xdev -type f -size +500M 2>/dev/null", "candidates for cleanup"]], g: "A deleted file still held open by a process keeps its space; check lsof +L1.", rel: ["du", "df"] },
      { c: "find -newer / -ctime", d: "Find files changed after a reference file or within a change window.", i: "safe", o: [["-newer ref", "modified after ref"], ["-ctime -1", "metadata changed in the last day"]], ex: [["find /etc -newer /tmp/stamp", "config files changed since the stamp"]], g: "Useful after an incident: what changed since the last known good time?", rel: ["stat"] }
    ]
  },
  {
    id: "awk_text", name: "awk: column processing", topic: "awk_text",
    summary: "Splitting lines into fields and computing on them.",
    k: [
      ["The model", "awk reads each line, splits it into fields ($1, $2 ... $NF; $0 is the whole line) on whitespace (or -F), and runs your actions on lines that match a pattern."],
      ["Built-in variables", "NR line number, NF field count, FS/OFS input/output separators, FILENAME."],
      ["Program shape", "pattern { action }. BEGIN { } runs before reading, END { } after the last line."],
      ["Arrays", "Associative arrays make counting and grouping one-liners: count[$1]++."]
    ],
    cmds: [
      { c: "awk '{print $1}'", d: "Prints chosen columns.", i: "safe", o: [["$1, $NF", "first and last field"], ["-F:", "separator (here a colon)"], ["OFS=\",\"", "output separator"]], ex: [["awk -F: '{print $1, $3}' /etc/passwd", "username and UID"]], g: "Always single-quote the program so the shell does not eat $1.", rel: ["cut"] },
      { c: "awk with a condition", d: "Acts only on matching lines.", i: "safe", o: [["$3 > 100", "numeric test"], ["/error/", "regex match"], ["NR > 1", "skip the header"], ["$1 == \"root\"", "string compare"]], ex: [["awk '$9 >= 500 {print $7}' access.log", "URLs of server errors"]], g: "== compares exactly; ~ is the regex match operator.", rel: ["grep"] },
      { c: "awk sum / average", d: "Aggregates a column.", i: "safe", o: [["END { }", "run after all lines"], ["NR", "line count"]], ex: [["awk '{s+=$5} END {print s, s/NR}' sizes.txt", "total and average"]], g: "Uninitialised variables start at 0, so no setup is needed.", rel: ["bc"] },
      { c: "awk count by key", d: "Group and count with an array.", i: "safe", o: [["count[$1]++", "increment a counter per key"], ["for (k in count)", "loop over keys"]], ex: [["awk '{c[$1]++} END {for (k in c) print c[k], k}' access.log | sort -rn", "requests per IP, busiest first"]], g: "Array order is arbitrary, so sort the result.", rel: ["sort", "uniq -c"] },
      { c: "awk printf", d: "Formatted output.", i: "safe", o: [["%s %d %.2f", "string, integer, decimal"], ["%-10s", "left-align in 10 columns"]], ex: [["awk '{printf \"%-15s %5d\\n\", $1, $2}' data.txt", "aligned columns"]], g: "printf needs explicit \\n, unlike print.", rel: ["column"] },
      { c: "awk field edit", d: "Modify a field and print the line.", i: "safe", o: [["$2 = \"X\"", "assign"], ["1", "a true pattern: print the line"]], ex: [["awk -F, 'BEGIN{OFS=\",\"} {$3=toupper($3)} 1' in.csv", "third column upper-cased"]], g: "Assigning to a field rebuilds $0 with OFS.", rel: ["sed"] }
    ]
  },
  {
    id: "sed_edit", name: "sed: stream editing", topic: "sed_edit",
    summary: "Substituting, deleting and inserting lines in a stream or a file.",
    k: [
      ["What sed is", "A non-interactive editor that applies commands to each line of its input and prints the result."],
      ["Most used command", "s/pattern/replacement/flags. Flag g replaces every match on the line, i ignores case, p prints."],
      ["In-place editing", "-i changes the file itself. -i.bak keeps a backup copy. Test without -i first."],
      ["Addresses", "A line number, a range (2,5), or a /regex/ can select which lines a command applies to."]
    ],
    cmds: [
      { c: "sed 's/a/b/g'", d: "Replaces text.", i: "safe", o: [["s/old/new/", "first match per line"], ["s/old/new/g", "all matches"], ["s|/a|/b|", "any delimiter, handy for paths"], ["-E", "extended regex"], ["&", "the matched text in the replacement"]], ex: [["echo 'a-a' | sed 's/a/X/g'", "X-X"]], g: "Special characters in the replacement (/ & \\) need escaping, or use a different delimiter.", rel: ["tr", "awk"] },
      { c: "sed -i", d: "Edits a file in place.", i: "changes", o: [["-i.bak", "keep file.bak"], ["-i -e ... -e ...", "several edits"]], ex: [["sed -i.bak 's/^PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config", "setting changed, backup kept"]], g: "A wrong pattern silently rewrites the file. Run without -i first and diff the result.", rel: ["diff", "patch"] },
      { c: "sed -n 'Np'", d: "Prints selected lines only.", i: "safe", o: [["-n", "suppress automatic printing"], ["5p", "line 5"], ["5,10p", "lines 5 to 10"], ["/start/,/end/p", "between two patterns"]], ex: [["sed -n '5,10p' app.log", "lines 5 through 10"]], g: "Without -n you also get every line printed once more.", rel: ["head", "awk"] },
      { c: "sed '/x/d'", d: "Deletes matching or numbered lines.", i: "safe", o: [["3d", "delete line 3"], ["/^#/d", "delete comment lines"], ["/^$/d", "delete blank lines"]], ex: [["sed '/^#/d;/^$/d' file.conf", "config without comments or blank lines"]], g: "Use -i only when you really want the file changed.", rel: ["grep -v"] },
      { c: "sed a / i / c", d: "Append, insert or change whole lines.", i: "safe", o: [["2i\\text", "insert before line 2"], ["$a\\text", "append at the end"], ["3c\\text", "replace line 3"]], ex: [["sed '1i\\# managed by ansible' file", "header line added"]], g: "Behaviour of one-line a/i/c differs slightly between GNU and BSD sed.", rel: ["ed"] },
      { c: "sed y/abc/xyz/", d: "Transliterates characters.", i: "safe", o: [], ex: [["echo hello | sed 'y/el/ip/'", "hippo"]], g: "Works character by character, like tr.", rel: ["tr"] }
    ]
  },
  {
    id: "head_tail", name: "head, tail and follow", topic: "head_tail",
    summary: "Looking at the start or end of files and watching logs live.",
    k: [
      ["Why tail matters", "Logs append at the end, so tail shows the newest events and tail -f shows them as they happen."],
      ["Combine with other tools", "tail -n 1000 app.log | grep ERROR keeps the search small and fast."],
      ["Rotation", "tail -f follows the file you opened; after logrotate it keeps watching the old file. tail -F re-opens by name."]
    ],
    cmds: [
      { c: "head", d: "Prints the first lines of a file.", i: "safe", o: [["-n 5", "five lines"], ["-n -3", "all but the last three"], ["-c 100", "first 100 bytes"]], ex: [["head -n 3 data.csv", "the header and two rows"]], g: "head -n 0 prints nothing; head -1 is shorthand for -n 1.", rel: ["tail"] },
      { c: "tail", d: "Prints the last lines of a file.", i: "safe", o: [["-n 20", "last 20 lines"], ["-n +2", "everything from line 2 (skip a header)"], ["-c 1K", "last kilobyte"]], ex: [["tail -n 50 /var/log/syslog", "the 50 newest lines"]], g: "tail -n +N starts AT line N, not after it.", rel: ["head", "less"] },
      { c: "tail -f / -F", d: "Follows a file as it grows.", i: "safe", o: [["-f", "follow the open file"], ["-F", "follow by name, survives rotation"], ["--pid=PID", "stop when the process exits"]], ex: [["tail -F /var/log/nginx/error.log", "new lines appear live; Ctrl-C to stop"]], g: "Use -F for logs that get rotated.", rel: ["journalctl -f", "less +F"] },
      { c: "nl / tac / rev", d: "Number lines, print in reverse line order, reverse characters.", i: "safe", o: [["nl -ba", "number all lines"], ["tac file", "last line first"], ["rev", "reverse each line"]], ex: [["tac app.log | head", "newest entries first"]], g: "tac reads the whole file, fine for logs but not endless streams.", rel: ["sort -r"] },
      { c: "paste / column", d: "Join files side by side; align output into columns.", i: "safe", o: [["paste a b", "tab-joined columns"], ["column -t", "pretty table"], ["column -s, -t", "CSV into aligned columns"]], ex: [["mount | column -t", "aligned mount table"]], g: "column -t needs consistent separators.", rel: ["awk"] },
      { c: "watch", d: "Re-runs a command every N seconds and shows the output.", i: "safe", o: [["-n 2", "interval"], ["-d", "highlight differences"]], ex: [["watch -n 2 'ss -tn | wc -l'", "live connection count"]], g: "Quote the whole command; Ctrl-C exits.", rel: ["tail -f"] }
    ]
  },
  {
    id: "processes", name: "Processes and jobs", topic: "processes",
    summary: "Seeing what is running, stopping it and controlling background work.",
    k: [
      ["PID and PPID", "Every process has an ID (PID) and a parent (PPID). PID 1 is the init system (systemd)."],
      ["Signals", "SIGTERM (15) politely asks a process to exit and is the default of kill. SIGKILL (9) cannot be caught and skips cleanup. SIGHUP (1) often means 'reload config'. SIGSTOP/SIGCONT pause and resume."],
      ["States", "R running, S sleeping, D uninterruptible sleep (usually waiting on disk, cannot be killed), Z zombie (finished, parent has not collected it), T stopped."],
      ["Foreground and background", "cmd & runs in the background; Ctrl-Z stops the foreground job, bg resumes it in the background, fg brings it back."],
      ["Survive logout", "nohup, disown, tmux/screen or (better) a systemd service."]
    ],
    cmds: [
      { c: "ps", d: "Snapshot of processes.", i: "safe", o: [["aux", "all processes, with user, CPU and memory"], ["-ef", "full format with parent PID"], ["-eo pid,ppid,%cpu,%mem,cmd --sort=-%cpu", "custom columns sorted"], ["-p PID", "one process"], ["--forest", "tree view"]], ex: [["ps aux --sort=-%mem | head -n 5", "the five biggest memory users"]], g: "ps aux | grep x also shows the grep itself; use pgrep.", rel: ["top", "pgrep"] },
      { c: "top / htop", d: "Live, sorted view of processes and system load.", i: "safe", o: [["P / M", "sort by CPU / memory (top)"], ["k", "kill a process"], ["1", "per-CPU view"], ["-b -n 1", "one batch snapshot for scripts"], ["F9 (htop)", "kill menu"]], ex: [["top -b -n 1 | head -15", "summary and the busiest processes"]], g: "The load-average line is for the whole machine, not one process.", rel: ["ps", "uptime"] },
      { c: "pgrep / pkill", d: "Find or signal processes by name or attribute.", i: "system", o: [["-l", "show names"], ["-f", "match the full command line"], ["-u user", "limit to a user"], ["pkill -TERM name", "signal by name"]], ex: [["pgrep -af server.js", "PID and full command"]], g: "pkill java kills every Java process. Check with pgrep -a first.", rel: ["kill", "killall"] },
      { c: "kill", d: "Sends a signal to a process by ID.", i: "danger", o: [["kill PID", "SIGTERM (graceful)"], ["kill -9 PID", "SIGKILL (immediate)"], ["kill -HUP PID", "reload config"], ["-l", "list signals"]], ex: [["kill 4512", "process shuts down cleanly"]], g: "Try plain kill first: -9 gives no cleanup and can leave locks and corrupt data.", rel: ["pkill", "killall"] },
      { c: "killall", d: "Signals every process with a given name.", i: "danger", o: [["-9", "force"], ["-u user", "only that user's"]], ex: [["killall -HUP nginx", "reload all nginx processes"]], g: "On Solaris killall means 'kill everything'. Linux killall is by name, but check habits.", rel: ["pkill"] },
      { c: "nice / renice", d: "Starts or changes a process's CPU priority.", i: "changes", o: [["nice -n 10 cmd", "start with lower priority"], ["renice -n 5 -p PID", "change a running one"]], ex: [["nice -n 19 tar czf backup.tgz data/", "backup yields to other work"]], g: "Higher nice value means lower priority (-20 is highest and needs root).", rel: ["ionice"] },
      { c: "jobs / bg / fg", d: "Manage jobs started from this shell.", i: "safe", o: [["Ctrl-Z", "stop the foreground job"], ["bg %1", "resume job 1 in the background"], ["fg %1", "bring it back"], ["jobs -l", "list with PIDs"]], ex: [["sleep 300 &", "[1] 3101"]], g: "Jobs belong to the shell session and die with it unless nohup/disown is used.", rel: ["nohup", "tmux"] },
      { c: "nohup / disown", d: "Keep a command running after you log out.", i: "changes", o: [["nohup cmd &", "ignore hang-up; output to nohup.out"], ["disown -h %1", "detach an existing job"]], ex: [["nohup ./long.sh > out.log 2>&1 &", "keeps running after logout"]], g: "For anything permanent create a systemd service instead.", rel: ["systemctl", "tmux"] },
      { c: "lsof", d: "Lists open files (including sockets) and who has them.", i: "safe", o: [["-i :8080", "who uses port 8080"], ["-p PID", "files of a process"], ["+L1", "deleted files still held open"], ["-u user", "per user"]], ex: [["sudo lsof -i :3000", "COMMAND PID USER ... TCP *:3000 (LISTEN)"]], g: "A deleted-but-open file keeps using disk space until the process closes it.", rel: ["ss", "fuser"] },
      { c: "pstree", d: "Shows processes as a parent-child tree.", i: "safe", o: [["-p", "with PIDs"], ["-u", "show user changes"]], ex: [["pstree -p", "systemd(1)─┬─sshd(801)─┬─ ..."]], g: "Great for seeing which service spawned a stray process.", rel: ["ps --forest"] },
      { c: "timeout", d: "Runs a command with a time limit.", i: "changes", o: [["timeout 30 cmd", "kill after 30 s"], ["-s KILL", "choose the signal"]], ex: [["timeout 10 curl -s https://example.com", "gives up after 10 seconds"]], g: "Exit status 124 means it timed out.", rel: ["sleep"] }
    ]
  },
  {
    id: "services_systemd", name: "systemd services", topic: "services_systemd",
    summary: "Starting, stopping and managing background services.",
    k: [
      ["Units", "systemd manages units: services (.service), timers (.timer), sockets, mounts and targets. Unit files live in /lib/systemd/system (packages) and /etc/systemd/system (yours, which override)."],
      ["start vs enable", "start runs it now; enable makes it start at boot. enable --now does both."],
      ["reload vs restart", "reload asks the service to re-read its config without dropping connections; restart stops and starts it."],
      ["After editing a unit file", "Run systemctl daemon-reload so systemd re-reads it, then restart the service."],
      ["Status exit codes", "systemctl is-active returns 0 if active, which scripts can test."]
    ],
    cmds: [
      { c: "systemctl status", d: "Shows whether a service is running, with recent log lines.", i: "safe", o: [["-l", "do not truncate lines"], ["--no-pager", "plain output"]], ex: [["systemctl status nginx", "Active: active (running) since ... Main PID: 1024"]], g: "'Active: failed' plus the last log lines usually tell you why it died.", rel: ["journalctl -u"] },
      { c: "systemctl start / stop / restart / reload", d: "Control a service right now.", i: "system", r: true, o: [["start", "run it"], ["stop", "stop it"], ["restart", "stop then start"], ["reload", "re-read config without dropping connections"], ["try-restart", "only if running"]], ex: [["sudo systemctl restart nginx", "no output; check status"]], g: "restart drops active connections. Validate config first (nginx -t, sshd -t) and prefer reload.", rel: ["service"] },
      { c: "systemctl enable / disable", d: "Control start at boot.", i: "system", r: true, o: [["enable --now", "enable and start together"], ["disable --now", "disable and stop"], ["is-enabled", "check"]], ex: [["sudo systemctl enable --now myapp", "Created symlink /etc/systemd/system/multi-user.target.wants/myapp.service"]], g: "Enabling does not start; starting does not enable.", rel: ["mask"] },
      { c: "systemctl mask / unmask", d: "Make a service impossible to start, even by dependency.", i: "system", r: true, o: [["mask", "link the unit to /dev/null"]], ex: [["sudo systemctl mask telnet.socket", "cannot be started until unmasked"]], g: "A stronger 'off' than disable.", rel: ["disable"] },
      { c: "systemctl list-units / list-unit-files", d: "Lists units.", i: "safe", o: [["--type=service", "services only"], ["--failed", "failed units"], ["--state=running", "only running"], ["list-timers", "scheduled timers"]], ex: [["systemctl --failed", "units that failed to start"]], g: "First command to run after a bad boot.", rel: ["systemctl status"] },
      { c: "systemctl daemon-reload", d: "Reloads unit files after you edit them.", i: "system", r: true, o: [], ex: [["sudo systemctl daemon-reload", "no output"]], g: "Forgetting it means systemd still runs the OLD definition.", rel: ["systemctl restart"] },
      { c: "systemctl cat / edit", d: "Show a unit's effective file or create an override.", i: "changes", o: [["cat NAME", "show unit file and drop-ins"], ["edit NAME", "opens a drop-in override"], ["edit --full NAME", "edit the whole file"]], ex: [["sudo systemctl edit nginx", "creates /etc/systemd/system/nginx.service.d/override.conf"]], g: "Drop-ins survive package upgrades; editing the packaged file does not.", rel: ["systemd-analyze verify"] },
      { c: "unit file sections", d: "[Unit] description and dependencies, [Service] how to run it, [Install] when to enable it.", i: "safe", o: [["ExecStart=", "the command"], ["Restart=on-failure", "auto-restart"], ["User=", "run as this user"], ["After= / Requires=", "ordering and dependencies"], ["WantedBy=multi-user.target", "enable target"]], ex: [["systemctl cat myapp", "shows the three sections"]], g: "ExecStart must use absolute paths and not rely on shell features.", rel: ["systemctl edit"] },
      { c: "systemd-analyze", d: "Shows boot time and slow units.", i: "safe", o: [["blame", "units by startup time"], ["critical-chain", "what delayed boot"], ["verify FILE", "check a unit file"]], ex: [["systemd-analyze blame | head", "slowest units first"]], g: "verify catches typos before you restart.", rel: ["journalctl -b"] },
      { c: "service (legacy)", d: "Old-style wrapper over systemctl.", i: "system", r: true, o: [["service nginx status", "same as systemctl status"]], ex: [["sudo service ssh restart", "restarts the SSH service"]], g: "On systemd machines it just calls systemctl.", rel: ["systemctl"] }
    ]
  },
  {
    id: "logs_journal", name: "Logs and journalctl", topic: "logs_journal",
    summary: "Finding out what happened and when.",
    k: [
      ["Two systems", "systemd's journal (binary, queried with journalctl) and classic text files in /var/log (syslog, auth.log, nginx/error.log). Many hosts have both."],
      ["Where things go", "Debian: /var/log/syslog, auth.log. RHEL: /var/log/messages, secure. Kernel: dmesg or journalctl -k. Services: journalctl -u NAME."],
      ["Log levels", "emerg, alert, crit, err, warning, notice, info, debug (0-7). journalctl -p err shows err and worse."],
      ["Rotation", "logrotate renames and compresses old logs (syslog.1, syslog.2.gz) so they do not fill the disk."],
      ["Timestamps", "Compare logs with the right time zone; the journal shows local time by default, -u/--utc for UTC."]
    ],
    cmds: [
      { c: "journalctl", d: "Reads the systemd journal.", i: "safe", o: [["-u NAME", "one service"], ["-f", "follow live"], ["-n 50", "last 50 entries"], ["--since '1 hour ago'", "time filter"], ["-p err", "errors and worse"], ["-b", "this boot (-b -1 previous)"], ["-k", "kernel messages"], ["-o json", "machine-readable"]], ex: [["journalctl -u nginx --since '1 hour ago' -p warning", "recent nginx warnings and errors"]], g: "Without -u and a time range the output is huge. The journal may need privileges: add yourself to systemd-journal or use sudo.", rel: ["dmesg", "tail -f"] },
      { c: "journalctl maintenance", d: "Check or trim the journal's disk usage.", i: "changes", r: true, o: [["--disk-usage", "how much space"], ["--vacuum-size=200M", "shrink to a size"], ["--vacuum-time=2weeks", "drop older entries"]], ex: [["sudo journalctl --vacuum-time=2weeks", "old entries deleted"]], g: "Vacuuming is irreversible; investigate before an incident is closed.", rel: ["journald.conf"] },
      { c: "dmesg", d: "Prints the kernel ring buffer (hardware, drivers, OOM kills).", i: "safe", o: [["-T", "human timestamps"], ["-l err,warn", "levels"], ["-w", "follow"]], ex: [["dmesg -T | grep -i 'out of memory'", "OOM-killer events"]], g: "Often restricted to root on hardened systems.", rel: ["journalctl -k"] },
      { c: "tail -f on log files", d: "Watch a text log live.", i: "safe", o: [["tail -F file", "survive rotation"], ["tail -f a b", "follow several files"]], ex: [["sudo tail -F /var/log/auth.log", "login attempts as they happen"]], g: "Combine with grep --line-buffered to filter live.", rel: ["less +F"] },
      { c: "zcat / zless / zgrep", d: "Read rotated, compressed logs.", i: "safe", o: [["zcat f.gz | less", "view"]], ex: [["zgrep 'Failed password' /var/log/auth.log.2.gz", "search an old log"]], g: "Remember the .1 files are plain text, .2.gz and older are compressed.", rel: ["grep"] },
      { c: "logger", d: "Writes a message into the system log.", i: "changes", o: [["-t tag", "label it"], ["-p user.err", "priority"]], ex: [["logger -t deploy 'release v2.4 started'", "appears in journalctl -t deploy"]], g: "Great for marking events from scripts so they are searchable later.", rel: ["journalctl"] },
      { c: "logrotate", d: "Rotates, compresses and removes old log files by rule.", i: "system", r: true, o: [["-d", "dry run"], ["-f", "force now"], ["/etc/logrotate.d/", "per-app rules"]], ex: [["sudo logrotate -d /etc/logrotate.conf", "shows what would rotate"]], g: "A missing rule is a classic cause of a full disk. Use copytruncate for apps that cannot reopen logs.", rel: ["cron"] },
      { c: "last / lastb / lastlog", d: "Login history, failed logins and last login per user.", i: "safe", r: true, o: [["lastb", "failed attempts (root)"], ["last -x", "reboots and shutdowns"]], ex: [["sudo lastb | head", "recent failed logins with source IPs"]], g: "A burst of failures from one IP is a brute-force sign.", rel: ["fail2ban"] },
      { c: "grep + awk pipeline", d: "The classic log-analysis pattern.", i: "safe", o: [["grep 'Failed password' | awk '{print $11}' | sort | uniq -c | sort -rn | head", "top attackers"]], ex: [["grep 'Failed password' /var/log/auth.log | awk '{print $11}' | sort | uniq -c | sort -rn | head -3", "count   IP"]], g: "Field positions differ between log formats: check one line first.", rel: ["awk", "uniq"] }
    ]
  },
  {
    id: "cron_jobs", name: "Cron and scheduling", topic: "cron_jobs",
    summary: "Running jobs at set times.",
    k: [
      ["The five fields", "minute (0-59) hour (0-23) day-of-month (1-31) month (1-12) day-of-week (0-7, Sunday is 0 or 7), then the command."],
      ["Special characters", "* every, */15 every 15, 1,15 a list, 9-17 a range. @reboot, @daily, @hourly are shortcuts."],
      ["Minimal environment", "Cron runs with a tiny PATH and no profile. Use absolute paths, set PATH at the top, and redirect output to a log."],
      ["Where jobs live", "Per user: crontab -e. System: /etc/crontab and /etc/cron.d (with a user column), /etc/cron.daily etc. Modern alternative: systemd timers."],
      ["Day-of-month AND day-of-week", "If both are restricted, the job runs when EITHER matches."]
    ],
    cmds: [
      { c: "crontab", d: "Edits, lists or removes your scheduled jobs.", i: "changes", o: [["-l", "list"], ["-e", "edit (opens an editor)"], ["-r", "remove ALL jobs, no confirmation"], ["-u user", "another user (root)"]], ex: [["crontab -l", "0 2 * * * /home/ubuntu/backup.sh >> /home/ubuntu/backup.log 2>&1"]], g: "-r sits next to -e on the keyboard; back up with crontab -l > cron.bak first.", rel: ["at", "systemd timers"] },
      { c: "cron expressions", d: "Reading and writing schedules.", i: "safe", o: [["*/15 * * * *", "every 15 minutes"], ["0 2 * * *", "02:00 daily"], ["0 2 * * 1", "02:00 every Monday"], ["30 3 1 * *", "03:30 on the 1st"], ["@reboot", "at boot"]], ex: [["0 9-17 * * 1-5 /opt/check.sh", "hourly 09:00-17:00 on weekdays"]], g: "Times use the server's time zone; check timedatectl.", rel: ["crontab"] },
      { c: "cron job hygiene", d: "Make jobs debuggable.", i: "safe", o: [[">> log 2>&1", "capture output and errors"], ["flock -n /tmp/x.lock cmd", "prevent overlapping runs"], ["PATH=... at the top", "set the path"], ["MAILTO=\"\"", "silence mail"]], ex: [["*/5 * * * * flock -n /tmp/sync.lock /opt/sync.sh >> /var/log/sync.log 2>&1", "no overlaps, with a log"]], g: "A job that runs longer than its interval will pile up without a lock.", rel: ["flock"] },
      { c: "at / atq / atrm", d: "Run a command once at a later time.", i: "changes", o: [["at 14:30", "then type the command, Ctrl-D"], ["atq", "list pending"], ["atrm N", "cancel"]], ex: [["echo 'sudo reboot' | at 02:00", "job 3 at Thu Oct 30 02:00:00 2026"]], g: "Needs the atd service running.", rel: ["cron"] },
      { c: "systemctl list-timers", d: "Lists systemd timer units and when they next fire.", i: "safe", o: [["--all", "include inactive"]], ex: [["systemctl list-timers", "NEXT LEFT LAST PASSED UNIT ACTIVATES"]], g: "Timers log to the journal and can run missed jobs (Persistent=true).", rel: ["cron"] },
      { c: "/etc/cron.d and cron.daily", d: "System-wide job locations.", i: "safe", o: [["/etc/cron.d/NAME", "schedule with a user column"], ["/etc/cron.daily/", "scripts run once a day"]], ex: [["ls /etc/cron.daily", "logrotate apt-compat ..."]], g: "Scripts in cron.daily must be executable and have no dot in their names.", rel: ["crontab"] },
      { c: "anacron", d: "Runs missed periodic jobs on machines that are not always on.", i: "safe", o: [["/etc/anacrontab", "its config"]], ex: [["cat /etc/anacrontab", "period delay job-id command"]], g: "Laptops use it so daily jobs run when the machine wakes.", rel: ["cron"] }
    ]
  }
);

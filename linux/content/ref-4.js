/** Linux reference part 4: archives, environment, scripting, monitoring, security. */
window.LINUX_REF.push(
  {
    id: "archiving", name: "Archives, compression and checksums", topic: "archiving",
    summary: "Bundling files, shrinking them and proving they are intact.",
    k: [
      ["Archive vs compress", "tar bundles many files into one archive; gzip/bzip2/xz compress one stream. tar.gz does both. zip does both per file and is understood by Windows."],
      ["tar flags to remember", "c create, x extract, t list, v verbose, f the file name (must come right before the name), z gzip, j bzip2, J xz, C change directory."],
      ["List before you extract", "tar -tf shows what an unknown archive will unpack into your current directory."],
      ["Preserve ownership", "Extract as root to keep original owners and permissions; as a user, files become yours."],
      ["Checksums", "sha256sum creates a fingerprint; -c verifies. Any change to the file changes the checksum completely."]
    ],
    cmds: [
      { c: "tar", d: "Creates, lists and extracts archives.", i: "changes", o: [["-czf a.tar.gz dir", "create gzip archive"], ["-xzf a.tar.gz", "extract"], ["-tf a.tar.gz", "list contents"], ["-C /dest", "extract into a directory"], ["--exclude='*.log'", "skip files"], ["-xzf a.tgz path/in/archive", "extract one item"]], ex: [["tar -czf backup.tar.gz project/", "no output (add -v to list files)"], ["tar -xzf release.tar.gz -C /opt/app", "unpacked under /opt/app"]], g: "A tarbomb unpacks many files into the current directory: always tar -tf first. The destination of -C must already exist.", rel: ["gzip", "zip"] },
      { c: "gzip / gunzip", d: "Compress or decompress a single file.", i: "changes", o: [["-k", "keep the original"], ["-9", "best compression"], ["-d", "decompress"], ["gunzip file.gz", "same as -d"]], ex: [["gzip app.log", "app.log is replaced by app.log.gz"]], g: "gzip removes the original unless you use -k.", rel: ["zcat", "xz"] },
      { c: "bzip2 / xz", d: "Stronger (slower) compressors.", i: "changes", o: [["xz -T0 file", "use all CPU cores"], ["-k", "keep original"], ["-d", "decompress"]], ex: [["xz -T0 -k big.sql", "big.sql.xz is created"]], g: "xz gives the smallest files but compresses slowly; fine for archives, poor for hot logs.", rel: ["gzip"] },
      { c: "zip / unzip", d: "Create and extract .zip archives.", i: "changes", o: [["zip -r out.zip dir", "recurse into a folder"], ["unzip -l out.zip", "list contents"], ["unzip out.zip -d dest", "extract elsewhere"], ["-o / -n", "overwrite / never overwrite"]], ex: [["zip -r backup.zip project", "adding: project/main.py (deflated 55%)"]], g: "Without -r a folder is stored empty. zip does not keep Unix owners and permissions as tar does.", rel: ["tar"] },
      { c: "zcat / zless / zgrep", d: "Read compressed files without unpacking.", i: "safe", o: [], ex: [["zcat access.log.2.gz | tail", "last lines of a rotated log"]], g: "Handy for rotated logs.", rel: ["gzip"] },
      { c: "sha256sum / md5sum", d: "Compute or verify checksums.", i: "safe", o: [["sha256sum FILE", "print the digest"], ["-c SUMS", "verify a list"], ["> SHA256SUMS", "save digests"]], ex: [["sha256sum data.txt", "5891b5b5...  data.txt"], ["sha256sum -c SHA256SUMS", "data.txt: OK (or FAILED)"]], g: "md5 is fast but broken against attackers; prefer sha256.", rel: ["cmp"] },
      { c: "dd", d: "Low-level block copy (disk images, wiping).", i: "danger", r: true, o: [["if=IN of=OUT", "input and output"], ["bs=4M", "block size"], ["status=progress", "show progress"], ["conv=fsync", "flush at the end"]], ex: [["sudo dd if=/dev/sda of=disk.img bs=4M status=progress", "image of a disk"]], g: "Swapping if and of overwrites the source disk. Nicknamed 'disk destroyer'.", rel: ["cp", "rsync"] }
    ]
  },
  {
    id: "env_vars", name: "Environment variables and shell setup", topic: "env_vars",
    summary: "Variables, PATH and configuration files for the shell.",
    k: [
      ["Shell variable vs environment variable", "A plain VAR=x exists only in this shell. export VAR=x also passes it to every program you start."],
      ["PATH", "A colon-separated list of directories searched left to right for commands. The first match wins."],
      ["Which file runs when", "~/.bash_profile or ~/.profile for login shells; ~/.bashrc for interactive non-login shells (usually sourced from the profile); /etc/environment and /etc/profile.d for everyone."],
      ["Temporary vs permanent", "export only lasts for the session. To persist, add it to ~/.bashrc and run source ~/.bashrc."],
      ["Secrets", "Keep them out of history and shared files: .env files at mode 600, never committed to git, or use a secret manager."]
    ],
    cmds: [
      { c: "echo $VAR / printenv", d: "Read variables.", i: "safe", o: [["echo $HOME", "value of HOME"], ["printenv PATH", "an exported variable"], ["printenv", "all exported variables"], ["echo \"$VAR\"", "quote to keep spaces"]], ex: [["printenv HOME", "/home/ubuntu"]], g: "printenv shows only exported variables, which is what child processes inherit.", rel: ["env", "set"] },
      { c: "export", d: "Makes a variable available to child processes.", i: "changes", o: [["export VAR=value", "set and export"], ["export PATH=$PATH:/opt/bin", "append to PATH"], ["export -n VAR", "stop exporting"], ["export -p", "list exported"]], ex: [["export APP_ENV=production", "node, python and bash -c now see APP_ENV"]], g: "Never write PATH=/opt/bin alone: you would lose ls, cat and everything else.", rel: ["unset"] },
      { c: "unset", d: "Removes a variable.", i: "changes", o: [["unset VAR", "delete"]], ex: [["unset API_KEY", "gone from this shell"]], g: "Setting VAR= leaves it defined but empty; unset removes it.", rel: ["export"] },
      { c: "env", d: "Prints the environment, or runs a command with a changed one.", i: "safe", o: [["env VAR=x cmd", "run cmd with VAR=x"], ["env -i cmd", "empty environment"], ["env | grep -i proxy", "find proxy settings"]], ex: [["env | sort", "alphabetical environment"]], g: "A stale http_proxy in the environment is a classic 'works on my laptop' cause.", rel: ["printenv"] },
      { c: "source  (or .)", d: "Runs a file in the current shell so its variables stay.", i: "changes", o: [["source ~/.bashrc", "reload"], [". ./env.sh", "same"]], ex: [["source .env", "variables defined in .env now exist here"]], g: "Running ./file.sh uses a child shell and its variables vanish.", rel: ["bash file"] },
      { c: "set -a / set +a", d: "Auto-export every variable assigned while on.", i: "changes", o: [["set -a; source app.env; set +a", "load a plain KEY=value file and export all of it"]], ex: [["set -a; source app.env; set +a", "all keys exported"]], g: "Beware: it exports everything including temporary variables.", rel: ["export"] },
      { c: "~/.bashrc and ~/.profile", d: "Where permanent settings go.", i: "changes", o: [["echo 'export EDITOR=vim' >> ~/.bashrc", "persist a variable"], ["source ~/.bashrc", "apply now"]], ex: [["echo 'export EDITOR=vim' >> ~/.bashrc", "takes effect in new terminals"]], g: "Use >> not >, or you overwrite the whole file.", rel: ["source"] },
      { c: "alias", d: "Shortcut names for commands.", i: "changes", o: [["alias ll='ls -alF'", "define"], ["unalias ll", "remove"], ["alias", "list"], ["\\ll", "bypass the alias"]], ex: [["alias gs='git status'", "gs now works in this session"]], g: "Aliases do not apply in scripts; use functions.", rel: ["type"] },
      { c: "command -v / type", d: "Tells which program a name resolves to.", i: "safe", o: [["command -v python3", "path or alias"]], ex: [["command -v node", "/usr/bin/node"]], g: "Portable and also finds builtins, unlike which.", rel: ["which"] },
      { c: "chmod 600 .env", d: "Protect a secrets file.", i: "changes", o: [["600", "owner read/write only"]], ex: [["chmod 600 .env", "-rw------- afterwards"]], g: "Also add .env to .gitignore.", rel: ["chmod"] }
    ]
  },
  {
    id: "bash_scripting", name: "Bash scripting", topic: "bash_scripting",
    summary: "Turning commands into reusable, safe scripts.",
    k: [
      ["Shebang and permissions", "The first line #!/bin/bash picks the interpreter. chmod +x lets you run ./script.sh; bash script.sh needs no execute bit."],
      ["Exit codes", "0 is success, anything else is failure. $? is the last status. && runs the next command on success, || on failure."],
      ["Quote variables", "\"$file\" keeps spaces intact and stops wildcards expanding. Unquoted variables are the source of countless bugs."],
      ["Strict mode", "set -euo pipefail stops on errors, treats unset variables as errors and fails a pipeline if any stage fails. Add trap for cleanup."],
      ["Arguments", "$1 $2 positional, $# count, $@ all (quote it), $0 the script name."],
      ["Tests", "[ -f file ] exists, [ -d dir ], [ -z \"$x\" ] empty, [ \"$a\" = \"$b\" ] strings, [ $n -gt 5 ] numbers. Spaces inside [ ] are required."]
    ],
    cmds: [
      { c: "#!/bin/bash and running a script", d: "Create and execute a script.", i: "safe", o: [["chmod +x script.sh && ./script.sh", "run directly"], ["bash script.sh", "run via the interpreter"], ["bash -n script.sh", "syntax check only"], ["bash -x script.sh", "trace every command"]], ex: [["bash -x deploy.sh", "+ cd /opt/app ... each command printed with a +"]], g: "./ is required because the current directory is not on PATH.", rel: ["shellcheck"] },
      { c: "variables and command substitution", d: "Store and reuse values.", i: "safe", o: [["name=value", "no spaces around ="], ["\"$name\"", "use it, quoted"], ["$(command)", "capture output"], ["${name:-default}", "default if unset"], ["${#name}", "length"], ["${file%.txt}", "strip a suffix"]], ex: [["today=$(date +%F); echo \"Backup $today\"", "Backup 2026-10-29"]], g: "Prefer $(...) over backticks; it nests.", rel: ["export"] },
      { c: "if / elif / else", d: "Conditional execution.", i: "safe", o: [["if [ -f x ]; then ...; fi", "file test"], ["[[ $a == b* ]]", "bash pattern test"], ["if grep -q p f; then", "use a command's exit status"], ["(( n > 5 ))", "arithmetic test"]], ex: [["if [ -f config.yml ]; then echo found; else echo missing; fi", "found"]], g: "In [ ] > means redirect; use -gt for numbers.", rel: ["test", "case"] },
      { c: "for / while / until", d: "Loops.", i: "safe", o: [["for f in *.log; do ...; done", "over files"], ["for ((i=0;i<5;i++))", "counting"], ["while read -r line; do ...; done < file", "line by line"], ["until cmd; do sleep 2; done", "wait for success"], ["break / continue", "exit / skip"]], ex: [["for f in *.log; do gzip \"$f\"; done", "each log compressed"]], g: "If nothing matches *.log the loop receives the literal text; guard with [ -e \"$f\" ] || continue.", rel: ["xargs"] },
      { c: "case", d: "Multi-way branch on a pattern.", i: "safe", o: [["pattern) cmds ;;", "one branch"], ["*)", "default"], ["a|b)", "alternatives"]], ex: [["case $ENV in prod) echo live;; dev) echo sandbox;; *) echo unknown;; esac", "sandbox"]], g: "Each branch ends with ;;.", rel: ["if"] },
      { c: "functions", d: "Reusable blocks.", i: "safe", o: [["name() { ...; }", "define"], ["local x=1", "function-scoped variable"], ["return 1", "set the exit status"], ["$1 $@", "function arguments"]], ex: [["greet() { echo \"Hi $1\"; }; greet Bob", "Hi Bob"]], g: "Without local, a function silently overwrites globals.", rel: ["source"] },
      { c: "set -euo pipefail and trap", d: "Make scripts fail safely and clean up.", i: "safe", o: [["set -e", "exit on error"], ["set -u", "unset variable is an error"], ["set -o pipefail", "pipeline fails if any stage fails"], ["trap 'rm -f \"$tmp\"' EXIT", "cleanup on exit"]], ex: [["trap 'rm -f $tmp; echo cleaned up' EXIT", "runs however the script ends"]], g: "-e has surprising exceptions (conditions, && chains); do not rely on it blindly.", rel: ["bash -x"] },
      { c: "read", d: "Reads input into variables.", i: "safe", o: [["-r", "do not process backslashes"], ["-p 'Name: '", "prompt"], ["-s", "silent (passwords)"], ["-t 5", "timeout"]], ex: [["read -rp 'Continue? [y/N] ' ans", "waits for input"]], g: "Use IFS= read -r line to keep leading spaces.", rel: ["while"] },
      { c: "here-document and heredoc to a file", d: "Write multi-line text from a script.", i: "changes", o: [["cat > f <<'EOF' ... EOF", "literal text"], ["cat <<EOF", "with variable expansion"], ["<<-EOF", "ignore leading tabs"]], ex: [["cat > app.conf <<EOF\nport=$PORT\nEOF", "app.conf created with the value"]], g: "Quote the delimiter ('EOF') to prevent expansion of $ signs.", rel: ["printf"] },
      { c: "arguments and getopts", d: "Handle script parameters.", i: "safe", o: [["$# -ne 1", "check the count"], ["shift", "drop $1"], ["getopts 'f:v' opt", "parse -f value -v"], ["${1:?usage: script DIR}", "abort with a message if missing"]], ex: [["[ $# -ne 1 ] && { echo \"usage: $0 DIR\" >&2; exit 1; }", "usage message and failure status"]], g: "Print usage to stderr (>&2) and exit non-zero.", rel: ["exit"] }
    ]
  },
  {
    id: "monitoring", name: "System monitoring", topic: "monitoring",
    summary: "Load, CPU, memory and disk activity, and what they mean.",
    k: [
      ["Load average", "Average number of runnable (and waiting) tasks over 1, 5 and 15 minutes. Compare with the number of CPUs: load above the core count means queueing."],
      ["High load with an idle CPU", "Processes are blocked, usually on disk or network I/O. Look at %iowait and iostat -x (high %util and await)."],
      ["Memory: available, not free", "Linux uses spare RAM as cache. 'available' is what programs can still get; low 'free' is normal."],
      ["Swap activity", "Heavy swap use (si/so in vmstat) with low available memory means memory pressure."],
      ["OOM killer", "When RAM and swap run out the kernel kills a process. Look in dmesg or journalctl -k for 'Out of memory: Killed process'."]
    ],
    cmds: [
      { c: "uptime", d: "Uptime and load average.", i: "safe", o: [["-p", "pretty"]], ex: [["uptime", "load average: 0.32, 0.28, 0.20"]], g: "Three numbers: 1, 5, 15 minutes. Rising means getting worse.", rel: ["top"] },
      { c: "free", d: "Memory and swap usage.", i: "safe", o: [["-h", "human units"], ["-m", "MiB"], ["-s 2", "repeat every 2 seconds"]], ex: [["free -h", "Mem: total 3.8Gi used 1.4Gi free 1.0Gi available 2.2Gi"]], g: "Judge by 'available', not 'free'.", rel: ["vmstat", "top"] },
      { c: "top / htop", d: "Live process and system view.", i: "safe", o: [["P / M / T", "sort by CPU / memory / time"], ["1", "per-CPU"], ["-b -n 1", "batch snapshot"]], ex: [["top -b -n 1 | head", "load, tasks, CPU and memory summary"]], g: "%CPU in top is per core: 200% means two cores busy.", rel: ["ps"] },
      { c: "vmstat", d: "Memory, swap, I/O and CPU activity over time.", i: "safe", o: [["vmstat 1 5", "every second, five samples"], ["-s", "memory statistics"]], ex: [["vmstat 1 5", "procs r b | swap si so | io bi bo | cpu us sy id wa"]], g: "r (run queue) above the CPU count, wa high, or si/so non-zero are the warning signs.", rel: ["iostat"] },
      { c: "iostat", d: "CPU and per-disk I/O statistics.", i: "safe", o: [["-x", "extended: await, %util"], ["-d 2", "device stats every 2 s"], ["-h", "human-readable"]], ex: [["iostat -x 1 3", "Device r/s w/s await %util"]], g: "%util near 100 with high await means the disk is the bottleneck.", rel: ["sar", "iotop"] },
      { c: "mpstat", d: "Per-CPU-core utilisation.", i: "safe", o: [["-P ALL", "every core"], ["1 5", "interval and count"]], ex: [["mpstat -P ALL 1 3", "one line per core"]], g: "One core at 100% with the others idle suggests a single-threaded bottleneck.", rel: ["top"] },
      { c: "sar", d: "Records and reports system activity history.", i: "safe", o: [["-u 1 3", "CPU"], ["-r", "memory"], ["-q", "run queue and load"], ["-d", "disks"], ["-f /var/log/sysstat/saDD", "past day"]], ex: [["sar -u 1 3", "%user %system %iowait %idle with an Average line"]], g: "Needs the sysstat collector enabled to show history; top cannot tell you about yesterday.", rel: ["vmstat"] },
      { c: "pidstat", d: "Resource use per process over time.", i: "safe", o: [["-d", "disk I/O per process"], ["-r", "memory per process"], ["-p PID 1", "one process every second"]], ex: [["pidstat 1 3", "PID %usr %system %CPU Command"]], g: "Answers 'which process is doing the I/O?'.", rel: ["iotop"] },
      { c: "dmesg | grep -i oom", d: "Check whether the OOM killer ran.", i: "safe", o: [["-T", "readable times"]], ex: [["dmesg -T | grep -i 'killed process'", "Out of memory: Killed process 4512 (node)"]], g: "A service that vanished with no log of its own was often OOM-killed.", rel: ["journalctl -k"] },
      { c: "ps / watch for hogs", d: "Rank processes by resource.", i: "safe", o: [["ps aux --sort=-%mem | head", "top memory"], ["ps aux --sort=-%cpu | head", "top CPU"], ["watch -n 2 'cmd'", "refresh"]], ex: [["ps aux --sort=-%cpu | head -n 3", "the heaviest CPU user"]], g: "Confirm with top before you kill anything.", rel: ["kill"] }
    ]
  },
  {
    id: "security", name: "Security and hardening", topic: "security",
    summary: "Firewalls, access control, auditing and secure defaults.",
    k: [
      ["Default deny", "Block all incoming traffic, then open only the ports you need. Allow SSH BEFORE enabling a firewall over SSH."],
      ["Least privilege", "Narrow sudo rules, dedicated service accounts, read-only access by default, and no world-writable files."],
      ["SSH first", "Keys only, no root login, restrict users and source IPs, keep the daemon patched."],
      ["Audit regularly", "Look for setuid binaries, world-writable files, unknown accounts, failed logins and unexpected listening ports."],
      ["Defence in depth", "Firewall + hardened services + patching + monitoring + backups; no single control is enough."]
    ],
    cmds: [
      { c: "ufw", d: "Simple firewall front-end (Ubuntu/Debian).", i: "system", r: true, o: [["status verbose", "state and default policy"], ["allow 22/tcp", "open a port"], ["deny from 203.0.113.7", "block an address"], ["default deny incoming", "default policy"], ["enable / disable", "turn on / off"], ["delete allow 8080/tcp", "remove a rule"], ["status numbered", "rules with numbers"]], ex: [["sudo ufw allow 443/tcp", "Rule added"]], g: "ufw enable over SSH without allowing SSH locks you out. Rules evaluate top-down, so insert a deny above a broad allow.", rel: ["iptables", "firewall-cmd"] },
      { c: "firewall-cmd", d: "firewalld front-end (RHEL family).", i: "system", r: true, o: [["--list-all", "active zone config"], ["--permanent --add-service=https", "save a rule"], ["--add-port=8080/tcp", "runtime only"], ["--reload", "apply permanent rules"], ["--get-active-zones", "zones"]], ex: [["sudo firewall-cmd --permanent --add-service=https && sudo firewall-cmd --reload", "success / success"]], g: "Without --permanent a rule vanishes at reload or reboot.", rel: ["ufw"] },
      { c: "iptables / nft", d: "The kernel packet filter behind the front-ends.", i: "system", r: true, o: [["iptables -L -n -v", "list rules"], ["nft list ruleset", "nftables view"]], ex: [["sudo iptables -L -n", "Chain INPUT (policy DROP) ..."]], g: "Hand-editing rules alongside ufw or firewalld causes conflicts; use one tool.", rel: ["ufw"] },
      { c: "sudo -l and sudoers", d: "Review and restrict who can run what as root.", i: "safe", o: [["sudo -l", "your rights"], ["sudo visudo -f /etc/sudoers.d/deploy", "add a narrow rule"], ["deploy ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart myapp", "allow one command"]], ex: [["sudo -l", "(ALL : ALL) ALL"]], g: "NOPASSWD: ALL for a service account is a full root compromise waiting to happen.", rel: ["visudo"] },
      { c: "find -perm (SUID / world-writable)", d: "Audit risky permission bits.", i: "safe", o: [["find / -perm -4000 -type f 2>/dev/null", "setuid files"], ["find / -xdev -perm -0002 -type f", "world-writable files"], ["find / -nouser -o -nogroup", "orphaned files"]], ex: [["find / -perm -4000 -type f 2>/dev/null", "/usr/bin/passwd /usr/bin/sudo ..."]], g: "Compare against a known-good list; a setuid shell in /tmp is a backdoor.", rel: ["chmod u-s"] },
      { c: "grep auth.log (failed logins)", d: "Spot brute-force attacks.", i: "safe", r: true, o: [["grep 'Failed password' /var/log/auth.log", "failures"], ["awk '{print $11}' | sort | uniq -c | sort -rn | head", "top source IPs"], ["lastb | head", "failed logins list"]], ex: [["grep 'Failed password' /var/log/auth.log | awk '{print $11}' | sort | uniq -c | sort -rn | head -3", "5 203.0.113.7"]], g: "On RHEL the file is /var/log/secure.", rel: ["fail2ban"] },
      { c: "fail2ban-client", d: "Bans IPs that fail logins repeatedly.", i: "system", r: true, o: [["status sshd", "jail status"], ["set sshd unbanip IP", "unban"]], ex: [["sudo fail2ban-client status sshd", "Currently banned: 3"]], g: "It reduces noise; it does not replace key-only SSH.", rel: ["ufw"] },
      { c: "sshd hardening", d: "Key settings for /etc/ssh/sshd_config.", i: "system", r: true, o: [["PermitRootLogin no", ""], ["PasswordAuthentication no", ""], ["AllowUsers deploy", ""], ["sshd -t", "test before reload"]], ex: [["sudo sshd -t && sudo systemctl reload ssh", "no output means valid"]], g: "Keep a second session open until a new login works.", rel: ["ssh"] },
      { c: "passwd -l / chage / usermod -L", d: "Lock accounts and enforce password ageing.", i: "system", r: true, o: [["passwd -l user", "lock password"], ["usermod -s /usr/sbin/nologin user", "no shell"], ["chage -M 90 user", "force rotation"]], ex: [["sudo usermod -L -s /usr/sbin/nologin olduser", "account cannot log in"]], g: "Also remove SSH keys; a locked password does not stop key login.", rel: ["userdel"] },
      { c: "ss -tulpn (exposed services)", d: "Find what listens on the network.", i: "safe", r: true, o: [["0.0.0.0:PORT", "exposed on all interfaces"], ["127.0.0.1:PORT", "local only"]], ex: [["sudo ss -tulpn", "look for unexpected 0.0.0.0 listeners"]], g: "Every open port is attack surface; close or firewall what you do not need.", rel: ["ufw"] },
      { c: "chattr +i / chmod hygiene", d: "Protect critical files from change.", i: "system", r: true, o: [["chattr +i FILE", "immutable"], ["chmod 600 secrets", "private"], ["chmod o-rwx dir", "no access for others"]], ex: [["sudo chattr +i /etc/passwd", "cannot be modified until -i"]], g: "Immutable files also block legitimate updates; remember to remove the flag first.", rel: ["lsattr"] }
    ]
  }
);

/**
 * Drills for modules 7-11: grep, find, awk, sed, head & tail.
 */
(function () {
  const out = sh => (sh.lastExec ? sh.lastExec.out : "");
  const D = DRILL, f = F, d = Dir, T = Tree;
  const HOME = "/home/ubuntu";
  const FS = names => T(HOME, names.map(n => f(n, "2KB")));

  const APP = [
    "2026-10-29 10:00:01 INFO server started on :3000",
    "2026-10-29 10:00:05 WARN disk at 81%",
    "2026-10-29 10:01:17 ERROR db timeout after 5000ms",
    "2026-10-29 10:01:18 INFO retry ok",
    "2026-10-29 10:02:41 ERROR upstream 502",
    "2026-10-29 10:03:10 INFO job fail ok",
    "2026-10-29 10:03:11 INFO job failed ok",
    "2026-10-29 10:04:02 WARN out of memory risk",
    "2026-10-29 10:04:30 ERROR out of memory: killed worker",
    "2026-10-29 10:05:00 DEBUG heartbeat"
  ].join("\n") + "\n";
  const CONF = "# managed file\nname=web\n\n# network\nport=8080\ndebug=true\n\nmode=prod\n";
  const ACC = [
    '10.0.0.5 - - [29/Oct/2026:10:00:01 +0000] "GET /index.html HTTP/1.1" 200 5120',
    '10.0.0.9 - - [29/Oct/2026:10:00:03 +0000] "GET /missing HTTP/1.1" 404 210',
    '10.0.0.5 - - [29/Oct/2026:10:00:07 +0000] "POST /api/login HTTP/1.1" 500 87',
    '10.0.0.7 - - [29/Oct/2026:10:00:09 +0000] "GET /index.html HTTP/1.1" 200 5120',
    '10.0.0.5 - - [29/Oct/2026:10:00:12 +0000] "GET /about HTTP/1.1" 404 210',
    '10.0.0.9 - - [29/Oct/2026:10:00:15 +0000] "GET /index.html HTTP/1.1" 200 5120'
  ].join("\n") + "\n";
  const CSV = "id,name,score,city\n1,ann,82,paris\n2,bob,67,rome\n3,cy,91,paris\n4,di,55,oslo\n";
  const SRC = { "main.py": "# TODO: add tests\nprint('hi')\n", "util.py": "def f():\n    pass  # TODO refactor\n", "notes.md": "TODO write docs\n" };

  // =============== Module 7: grep ===============
  const GF = { fs: FS(["app.log", "app.conf", "access.log"]), files: { "app.log": APP, "app.conf": CONF, "access.log": ACC }, viz: "text", focus: ["app.log"] };
  const G = (extra) => Object.assign({}, GF, extra);
  D("search_grep", "11", "How Many Errors?", "Beginner", 50, "Your on-call report needs a number, not a list: how many lines of app.log contain ERROR?", "Count the ERROR lines.",
    "grep -c ERROR app.log", [["-c", "Print only the count of matching lines."]], "grep -c counts lines, not occurrences: two ERRORs on one line count once.", G({ outRe: /^3$/m }));
  D("search_grep", "12", "Whole Words Only", "Beginner", 60, "Find lines with the word fail but not failed. Plain grep would match both.", "Match the word fail exactly.",
    "grep -w fail app.log", [["-w", "Match whole words only: fail does not match failed."]], "Without -w, grep fail also finds failure, failed, failover...", G({ outRe: /job fail ok/ , goal: sh => /job fail ok/.test(out(sh)) && !/failed/.test(out(sh)) && !!sh.lastExec.cmds.find(c => c.name === "grep") }));
  D("search_grep", "13", "Errors or Warnings", "Intermediate", 60, "Show every line that is either an ERROR or a WARN in one search.", "Search for ERROR or WARN with extended regex.",
    "grep -E 'ERROR|WARN' app.log", [["-E", "Extended regular expressions: | means OR, no backslashes."], ["'ERROR|WARN'", "Either word."]], "Without -E, use \\| for OR (basic regex).", G({ goal: sh => { const l = out(sh).trim().split("\n"); return l.length === 5 && !!sh.lastExec.cmds.find(c => c.name === "grep"); } }));
  D("search_grep", "14", "What Happened After?", "Intermediate", 70, "Find the out of memory error and show the 2 lines that follow it, to see the consequences.", "Show 2 lines after each 'out of memory' match.",
    "grep -A 2 'out of memory' app.log", [["-A 2", "Print 2 lines of trailing context after each match."]], "-A after, -B before, -C both sides. Lines of context are separated from other groups by --.", G({ outRe: /killed worker[\s\S]*DEBUG heartbeat/ }));
  D("search_grep", "15", "What Happened Before?", "Intermediate", 70, "Show the db timeout error together with the line just before it.", "Show 1 line before the match.",
    "grep -B 1 'db timeout' app.log", [["-B 1", "Print 1 line of leading context before each match."]], "Leading context often holds the cause: the warning that came just before the failure.", G({ outRe: /WARN disk at 81%[\s\S]*db timeout/ }));
  D("search_grep", "16", "Context Both Ways", "Intermediate", 70, "Show the upstream 502 error with one line before and one after.", "Show 1 line of context on each side.",
    "grep -C 1 'upstream 502' app.log", [["-C 1", "Context: 1 line before and after."]], "-C 3 is a good default when you are exploring an unfamiliar log.", G({ outRe: /retry ok[\s\S]*upstream 502[\s\S]*job fail ok/ }));
  D("search_grep", "17", "Which Files Mention It?", "Intermediate", 70, "You only need the names of files that contain the text API_KEY under this folder, not the lines.", "List files containing API_KEY recursively.",
    "grep -rl API_KEY .", [["-r", "Recurse."], ["-l", "Print only the file names that match."]], "grep -rL lists files that do NOT contain the text.", { fs: T(HOME, [d("config", [f("auth.env")]), d("src", [f("a.py"), f("b.py")])]), files: { "config/auth.env": "API_KEY=abc\n", "src/a.py": "key = API_KEY\n", "src/b.py": "pass\n" }, outRe: /auth\.env[\s\S]*a\.py/ , goal: sh => /auth\.env/.test(out(sh)) && /a\.py/.test(out(sh)) && !/b\.py/.test(out(sh)) });
  D("search_grep", "18", "Count Ignoring Case", "Beginner", 50, "Count how many lines mention error in any capitalisation.", "Count case-insensitive matches.",
    "grep -ci error app.log", [["-c", "Count."], ["-i", "Ignore case."]], "Flags combine: -ci equals -c -i.", G({ outRe: /^3$/m }));
  D("search_grep", "19", "Warnings With Line Numbers", "Beginner", 50, "Find the WARN lines in any case and show their line numbers so you can jump to them.", "Show numbered, case-insensitive matches for warn.",
    "grep -n -i warn app.log", [["-n", "Prefix each line with its line number."], ["-i", "Ignore case."]], "Line numbers pair well with sed -n '5p' or your editor's go-to-line.", G({ outRe: /2:.*WARN[\s\S]*8:.*WARN/ }));
  D("search_grep", "20", "Strip Comments and Blank Lines", "Intermediate", 70, "Show the real settings in app.conf: hide comment lines and empty lines.", "Invert-match comments and blank lines.",
    "grep -v -e '^#' -e '^$' app.conf", [["-v", "Invert: show lines that do NOT match."], ["-e", "Add a pattern; several -e are ORed."], ["'^#'", "Lines starting with #."], ["'^$'", "Empty lines."]], "^ anchors to the start of a line and $ to the end: ^$ means nothing between them.", G({ focus: ["app.conf"], goal: sh => out(sh) === "name=web\nport=8080\ndebug=true\nmode=prod\n" }));
  D("search_grep", "21", "Lines That Start With", "Beginner", 50, "Show only lines of app.conf that begin with the word port.", "Match port at the start of a line.",
    "grep '^port' app.conf", [["^port", "^ anchors the match to the start of the line."]], "Use $ for end of line: grep 'ok$' matches lines ending in ok.", G({ focus: ["app.conf"], outRe: /^port=8080$/m }));
  D("search_grep", "22", "Pull Out Just the IPs", "Intermediate", 80, "From the access log, print only the IP addresses themselves, one per match, not the whole lines.", "Print only the matching parts that look like IPs.",
    "grep -oE '[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+' access.log", [["-o", "Print only the matched part."], ["-E", "Extended regex."], ["[0-9]+\\.", "Digits followed by a literal dot, repeated for each octet."]], "Pipe into sort | uniq -c to count requests per IP.", G({ focus: ["access.log"], goal: sh => /^10\.0\.0\.5$/m.test(out(sh)) && out(sh).trim().split("\n").length === 6 }));
  D("search_grep", "23", "Stop After Two", "Intermediate", 60, "The log is huge. Print only the first two ERROR lines and stop searching.", "Limit grep to 2 matches.",
    "grep -m 2 ERROR app.log", [["-m 2", "Stop after 2 matching lines."]], "-m saves time on multi-GB logs when you only need a sample.", G({ goal: sh => out(sh).trim().split("\n").length === 2 && /db timeout/.test(out(sh)) }));
  D("search_grep", "24", "Search Only Python Files", "Intermediate", 70, "Find TODO comments, but only inside .py files below this folder, with line numbers.", "Recursive, numbered search limited to *.py.",
    "grep -rn --include='*.py' TODO .", [["-rn", "Recursive with line numbers."], ["--include='*.py'", "Only search files whose name matches the glob."]], "--exclude-dir=node_modules keeps vendor folders out of results.", { fs: T(HOME, [f("main.py"), f("util.py"), f("notes.md")]), files: SRC, goal: sh => /main\.py:1:/.test(out(sh)) && /util\.py:2:/.test(out(sh)) && !/notes\.md/.test(out(sh)) });
  D("search_grep", "25", "Count Per File", "Intermediate", 60, "Compare two logs: print the number of ERROR lines in each file separately.", "Count matches in app.log and access.log.",
    "grep -c ERROR app.log access.log", [["-c", "With several files, prints one count per file, prefixed by the name."]], "A count of 0 still prints: that is how you spot clean files.", G({ outRe: /app\.log:3[\s\S]*access\.log:0/ }));
  D("search_grep", "26", "Alternation With Anchors", "Advanced", 80, "Show the lines whose level (the third field) is exactly ERROR or WARN, anchoring the pattern after the timestamp.", "Use an anchored extended regex.",
    "grep -E '^[^ ]+ [^ ]+ (ERROR|WARN) ' app.log", [["^[^ ]+ [^ ]+ ", "Two space-free tokens (date, time) then a space."], ["(ERROR|WARN) ", "The level, followed by a space."]], "Anchoring avoids false hits: grep ERROR also matches the word in a message.", G({ goal: sh => out(sh).trim().split("\n").length === 5 }));

  // =============== Module 8: find ===============
  const FF = T(HOME, [f("README.md", "1KB"), f("Readme.txt", "1KB"), f("app.log", "2KB"), f("a.tmp", "1KB"), f("empty.txt", "0B"), d("src", [f("main.py", "3KB"), f("util.py", "2KB"), d("empty_dir")]), d("old", [f("backup.log", "9KB")])]);
  const FN = {
    [HOME + "/README.md"]: { content: "# readme\n", age: 3 }, [HOME + "/Readme.txt"]: { content: "x\n", age: 3 }, [HOME + "/app.log"]: { content: "log\n", age: 0 },
    [HOME + "/a.tmp"]: { content: "t\n", age: 1 }, [HOME + "/empty.txt"]: { content: "", age: 40 }, [HOME + "/src/main.py"]: { content: "print()\n", age: 2 },
    [HOME + "/src/util.py"]: { content: "x\n", age: 60 }, [HOME + "/old/backup.log"]: { content: "b\n", age: 120, owner: "root", group: "root" }
  };
  const FO = { fs: FF, nodes: FN };
  const sorted = sh => out(sh).trim().split("\n").sort().join("|");
  D("search_find", "11", "Find Regardless of Case", "Beginner", 50, "Someone saved readme as README.md and someone else as Readme.txt. Find every file starting with readme in any capitalisation.", "Find readme* ignoring case.",
    "find . -iname 'readme*'", [["-iname", "Like -name but case-insensitive."], ["'readme*'", "Quote wildcards so the shell does not expand them."]], "Always quote find patterns: unquoted *.log expands in the current directory first.", Object.assign({ goal: sh => sorted(sh) === "./README.md|./Readme.txt" }, FO));
  D("search_find", "12", "Only Directories", "Beginner", 50, "List all directories under this folder, nothing else.", "Find only directories.",
    "find . -type d", [["-type d", "Directories only (f = files, l = symlinks)."]], "find . -type d -empty finds empty directories.", Object.assign({ goal: sh => sorted(sh) === ".|./old|./src|./src/empty_dir" }, FO));
  D("search_find", "13", "Stale Files", "Intermediate", 70, "Housekeeping: list regular files not modified for more than 30 days.", "Find files older than 30 days.",
    "find . -type f -mtime +30", [["-mtime +30", "Modified more than 30 days ago (-30 = within the last 30, 30 = exactly that day)."]], "-mmin is the same in minutes. Pair with -delete or -exec rm to clean up.", Object.assign({ goal: sh => sorted(sh) === "./empty.txt|./old/backup.log|./src/util.py" }, FO));
  D("search_find", "14", "Changed Today", "Intermediate", 60, "What changed in the last day? List files modified within the past 24 hours.", "Find files modified in the last day.",
    "find . -type f -mtime -1", [["-mtime -1", "Modified less than 1 day (24 hours) ago."]], "During an incident this answers: what changed on this box recently?", Object.assign({ goal: sh => sorted(sh) === "./app.log" }, FO));
  D("search_find", "15", "Files Owned by root", "Intermediate", 60, "Find files under this folder that are owned by root (a deploy may have run as root by mistake).", "Find files owned by user root.",
    "find . -user root", [["-user root", "Owned by the user root."]], "-nouser finds files whose owner no longer exists: leftovers from deleted accounts.", Object.assign({ goal: sh => sorted(sh) === "./old/backup.log" }, FO));
  D("search_find", "16", "Empty Files", "Beginner", 50, "Find zero-byte files that probably should not exist.", "Find empty regular files.",
    "find . -type f -empty", [["-empty", "Zero-byte files (or empty directories with -type d)."]], "Empty .env or config files are a classic cause of 'works on my machine'.", Object.assign({ goal: sh => sorted(sh) === "./empty.txt" }, FO));
  D("search_find", "17", "Run a Command on Each Match", "Intermediate", 80, "Show the long listing (size, owner, date) of every .log file under this folder using find's own -exec.", "Use -exec ls -l on each .log file.",
    "find . -name '*.log' -exec ls -l {} \\;", [["-exec ls -l {} \\;", "Run ls -l once per match; {} is the file name and \\; ends the command."]], "Use + instead of \\; to batch many files into one call: much faster.", Object.assign({ goal: sh => /app\.log/.test(out(sh)) && /backup\.log/.test(out(sh)) && /-rw/.test(out(sh)) }, FO));
  D("search_find", "18", "Delete Temp Files", "Intermediate", 70, "Remove every .tmp file below this folder using find itself, nothing else.", "Delete *.tmp with find.",
    "find . -name '*.tmp' -delete", [["-delete", "Delete each match. Put it last: find evaluates left to right."]], "First run the same command without -delete to preview. Never put -delete before your tests.", Object.assign({ goal: sh => !sh.exists("a.tmp") && sh.exists("app.log") }, FO));
  D("search_find", "19", "Only This Level", "Beginner", 50, "List regular files in this folder only, without descending into sub-folders.", "Limit the search to depth 1.",
    "find . -maxdepth 1 -type f", [["-maxdepth 1", "Do not go deeper than one level."]], "-mindepth 1 excludes the starting point itself.", Object.assign({ goal: sh => sorted(sh) === "./README.md|./Readme.txt|./a.tmp|./app.log|./empty.txt" }, FO));
  D("search_find", "20", "Large Files Only", "Intermediate", 60, "Find regular files bigger than 5 kilobytes to see what is taking space.", "Find files larger than 5k.",
    "find . -type f -size +5k", [["-size +5k", "Larger than 5 KiB (k, M, G; - means smaller than)."]], "Combine with sort -h on ls -lh output or du to rank them.", Object.assign({ goal: sh => sorted(sh) === "./old/backup.log" }, FO));
  D("search_find", "21", "Everything Except Logs", "Intermediate", 60, "List all regular files that are not .log files.", "Negate the name test.",
    "find . -type f -not -name '*.log'", [["-not -name '*.log'", "Invert the test (! does the same)."]], "Combine tests freely: they are ANDed left to right.", Object.assign({ goal: sh => !/\.log/.test(out(sh)) && /README\.md/.test(out(sh)) }, FO));
  D("search_find", "22", "This or That", "Intermediate", 70, "Find files ending in .py or .md, using find's OR operator.", "Match two patterns with -o.",
    "find . -name '*.py' -o -name '*.md'", [["-o", "OR between two tests."]], "Group with escaped parentheses when mixing -o and other tests: \\( -name a -o -name b \\) -type f.", Object.assign({ goal: sh => sorted(sh) === "./README.md|./src/main.py|./src/util.py" }, FO));
  D("search_find", "23", "Newer Than a Marker", "Advanced", 80, "Find files modified more recently than the file app.log.", "Use -newer with a reference file.",
    "find . -type f -newer old/backup.log", [["-newer FILE", "Modified more recently than FILE."]], "Touch a marker file before a deploy, then find -newer marker to list everything the deploy changed.", Object.assign({ goal: sh => /app\.log/.test(out(sh)) && !/backup\.log/.test(out(sh)) }, FO));
  D("search_find", "24", "How Many Files?", "Beginner", 50, "Count the regular files in the whole tree.", "Pipe find into wc.",
    "find . -type f | wc -l", [["find . -type f", "One path per file."], ["wc -l", "Count the lines."]], "Handy sanity check after a copy or restore: counts should match.", Object.assign({ outRe: /^8$/m }, FO));
  D("search_find", "25", "Files That Contain Text", "Advanced", 90, "Find .conf files that contain the word port, listing only their names, using -exec with grep.", "Combine find -exec with grep -l.",
    "find . -name '*.conf' -exec grep -l port {} \\;", [["-exec grep -l port {} \\;", "Run grep -l on each file; it prints the name if the text is found."]], "grep -rl --include='*.conf' port . does the same more simply.",
    { fs: T(HOME, [d("etc", [f("a.conf"), f("b.conf")])]), files: { "etc/a.conf": "port=1\n", "etc/b.conf": "mode=x\n" }, goal: sh => /a\.conf/.test(out(sh)) && !/b\.conf/.test(out(sh)) });
  D("search_find", "26", "Audit Setuid Programs", "Advanced", 90, "A security audit asks for every file with the setuid bit set. Search for permission bit 4000.", "Find files with setuid.",
    "find . -type f -perm -4000", [["-perm -4000", "All the listed bits are set; 4000 is setuid."]], "A short, known list is normal (passwd, sudo). Anything new is a red flag.",
    { fs: T("/usr/bin", [f("passwd", "59KB", "-rwsr-xr-x"), f("ls", "140KB"), f("sudo", "230KB", "-rwsr-xr-x")]), nodes: { "/usr/bin/passwd": { mode: 0o4755, owner: "root", group: "root" }, "/usr/bin/sudo": { mode: 0o4755, owner: "root", group: "root" } }, goal: sh => sorted(sh) === "./passwd|./sudo" });
  D("search_find", "27", "World-Writable Files", "Advanced", 90, "Find regular files that anyone can write to (mode 777): a classic hardening finding.", "Find files with mode 777.",
    "find . -type f -perm 777", [["-perm 777", "Exactly rwxrwxrwx."]], "Fix with chmod o-w or tighter, then re-run to prove the list is empty.", { fs: T(HOME, [f("open.sh", "1KB", "-rwxrwxrwx"), f("ok.sh", "1KB")]), nodes: { [HOME + "/open.sh"]: { mode: 0o777, content: "x\n" } }, goal: sh => sorted(sh) === "./open.sh" });

  // =============== Module 9: awk ===============
  const AF = { fs: FS(["access.log", "data.csv", "app.log"]), files: { "access.log": ACC, "data.csv": CSV, "app.log": APP }, viz: "text", focus: ["access.log"] };
  const A = extra => Object.assign({}, AF, extra);
  D("awk_text", "11", "Usernames From passwd", "Beginner", 50, "/etc/passwd fields are separated by colons. Print only the first field, the user names.", "Print field 1 using : as separator.",
    "awk -F: '{print $1}' /etc/passwd", [["-F:", "Field separator is a colon."], ["{print $1}", "For every line print the first field."]], "-F, for CSV, -F'\\t' for tabs, -F'[ ,]+' for a regex separator.", { fs: T("/etc", [f("passwd", "2KB")]), files: { "/etc/passwd": "root:x:0:0:root:/root:/bin/bash\ndaemon:x:1:1::/usr/sbin:/usr/sbin/nologin\nubuntu:x:1000:1000::/home/ubuntu:/bin/bash\n" }, viz: "text", focus: ["/etc/passwd"], goal: sh => out(sh) === "root\ndaemon\nubuntu\n" });
  D("awk_text", "12", "Last Column", "Beginner", 50, "Print the last field of every line, whatever the number of fields.", "Print $NF.",
    "awk '{print $NF}' access.log", [["$NF", "NF is the number of fields, so $NF is the last one."]], "$(NF-1) is the second-to-last.", A({ goal: sh => out(sh) === "5120\n210\n87\n5120\n210\n5120\n" }));
  D("awk_text", "13", "Pick a Line", "Beginner", 50, "Print only the third line of the access log.", "Select line 3 with NR.",
    "awk 'NR==3' access.log", [["NR", "The current line number."], ["NR==3", "A condition: with no action the whole line is printed."]], "NR>=2 && NR<=4 selects a range; sed -n '2,4p' does too.", A({ outRe: /POST \/api\/login/ , goal: sh => out(sh).trim().split("\n").length === 1 && /POST/.test(out(sh)) }));
  D("awk_text", "14", "Fields Per Line", "Beginner", 50, "How many fields does each line have? Print NF for every line.", "Print NF per line.",
    "awk '{print NF}' access.log", [["NF", "Number of fields on the current line."]], "Lines with an unexpected NF reveal malformed log entries.", A({ goal: sh => /^10$/m.test(out(sh)) && out(sh).trim().split("\n").length === 6 }));
  D("awk_text", "15", "Only the Failures", "Intermediate", 70, "Print the request path and status for every request that returned 400 or above.", "Filter on status >= 400.",
    "awk '$9 >= 400 {print $7, $9}' access.log", [["$9 >= 400", "A numeric comparison on field 9 (the HTTP status)."], ["{print $7, $9}", "Print path and status."]], "Conditions can use &&, || and regex matches: $9 ~ /^5/ means 5xx.", A({ goal: sh => out(sh) === "/missing 404\n/api/login 500\n/about 404\n" }));
  D("awk_text", "16", "Requests Per IP", "Advanced", 90, "Count requests per client IP in one pass, using an array, and print each IP with its count.", "Count with an associative array.",
    "awk '{c[$1]++} END {for (ip in c) print ip, c[ip]}' access.log", [["c[$1]++", "Increment a counter keyed by the IP."], ["END {...}", "Runs once after all lines."], ["for (ip in c)", "Loop over the array keys."]], "This replaces sort | uniq -c and can sum or average at the same time.", A({ goal: sh => out(sh) === "10.0.0.5 3\n10.0.0.7 1\n10.0.0.9 2\n" }));
  D("awk_text", "17", "Total Bytes Served", "Intermediate", 70, "Add up the response sizes (field 10) and print the total once at the end.", "Sum a column with END.",
    "awk '{s+=$10} END {print s}' access.log", [["s+=$10", "Add field 10 to s for every line."], ["END {print s}", "Print the sum after the last line."]], "Uninitialised awk variables start at 0, so no setup is needed.", A({ goal: sh => out(sh).trim() === "15867" }));
  D("awk_text", "18", "A Header Row", "Intermediate", 70, "Print a header line IP STATUS first, then each request's IP and status.", "Use BEGIN to print a header.",
    "awk 'BEGIN {print \"IP\", \"STATUS\"} {print $1, $9}' access.log", [["BEGIN {...}", "Runs once before the first line."]], "BEGIN is also where you set FS or initial values: BEGIN {FS=\":\"}.", A({ goal: sh => out(sh).startsWith("IP STATUS\n10.0.0.5 200\n") }));
  D("awk_text", "19", "Average Score", "Advanced", 90, "Compute the average of the score column (field 3) of data.csv, skipping the header row.", "Average a column, ignoring the header.",
    "awk -F, 'NR>1 {s+=$3; n++} END {print s/n}' data.csv", [["-F,", "Comma separator."], ["NR>1", "Skip the header line."], ["s/n", "Sum divided by count."]], "Always skip the header or the average is wrong.", A({ focus: ["data.csv"], goal: sh => out(sh).trim() === "73.75" }));
  D("awk_text", "20", "Match a Pattern Then Print", "Intermediate", 60, "Print date and time (fields 1 and 2) for ERROR lines only.", "Use a regex pattern with an action.",
    "awk '/ERROR/ {print $1, $2}' app.log", [["/ERROR/", "Only lines containing ERROR."]], "$3 == \"ERROR\" is stricter: it checks the field, not the whole line.", A({ focus: ["app.log"], goal: sh => out(sh).trim().split("\n").length === 3 && /^2026-10-29 10:01:17$/m.test(out(sh)) }));
  D("awk_text", "21", "Aligned Output", "Advanced", 80, "Print IP left-aligned in a 12-character column followed by the status.", "Format with printf.",
    "awk '{printf \"%-12s %s\\n\", $1, $9}' access.log", [["printf", "Formatted output; no automatic newline."], ["%-12s", "A string, left-aligned in 12 characters."]], "printf %d, %.2f, %5s... work like C.", A({ goal: sh => out(sh).startsWith("10.0.0.5     200\n") }));
  D("awk_text", "22", "Pass a Value In", "Advanced", 80, "Use a threshold from the shell: print requests whose size (field 10) is above 1000, with the limit given by -v.", "Use -v to pass a variable.",
    "awk -v limit=1000 '$10 > limit {print $1, $10}' access.log", [["-v limit=1000", "Sets an awk variable before the program runs."]], "Lets one script serve many thresholds without editing the program.", A({ goal: sh => out(sh).trim().split("\n").length === 3 && /5120/.test(out(sh)) }));
  D("awk_text", "23", "Skip the Header", "Beginner", 60, "Print only the name column (field 2) of data.csv without the header line.", "Print field 2 for data rows only.",
    "awk -F, 'NR>1 {print $2}' data.csv", [["NR>1", "Skip line 1."]], "tail -n +2 data.csv | cut -d, -f2 does the same.", A({ focus: ["data.csv"], goal: sh => out(sh) === "ann\nbob\ncy\ndi\n" }));
  D("awk_text", "24", "Two Conditions", "Advanced", 80, "Print 404 responses served to clients whose IP starts with 10.0.0.9.", "Combine a field test and a regex with &&.",
    "awk '$9 == 404 && $1 ~ /^10\\.0\\.0\\.9/' access.log", [["$9 == 404", "Status equals 404."], ["$1 ~ /^10\\.0\\.0\\.9/", "IP matches the pattern."], ["&&", "Both must be true."]], "~ matches a regex, !~ negates it.", A({ goal: sh => out(sh).trim().split("\n").length === 1 && /missing/.test(out(sh)) }));
  D("awk_text", "25", "Number the Lines", "Beginner", 50, "Print every line prefixed with its line number and a colon.", "Print NR and the line.",
    "awk '{print NR\": \"$0}' app.log", [["$0", "The whole line."], ["NR", "Line number."]], "cat -n does the same; awk lets you format the number yourself.", A({ focus: ["app.log"], goal: sh => out(sh).startsWith("1: 2026-10-29 10:00:01 INFO") }));
  D("awk_text", "26", "Largest Value", "Advanced", 90, "Find the highest score (field 3) in data.csv.", "Track a maximum with END.",
    "awk -F, 'NR>1 && $3>max {max=$3} END {print max}' data.csv", [["$3>max {max=$3}", "Keep the largest seen so far."], ["END {print max}", "Print it at the end."]], "Track the line too: $3>max {max=$3; who=$2} END {print who, max}.", A({ focus: ["data.csv"], goal: sh => out(sh).trim() === "91" }));

  // =============== Module 10: sed ===============
  const SF = { fs: FS(["app.conf", "app.log", "list.txt"]), files: { "app.conf": CONF, "app.log": APP, "list.txt": "one\ntwo\nthree\nfour\nfive\n" }, viz: "text", focus: ["app.conf"] };
  const S = extra => Object.assign({}, SF, extra);
  D("sed_edit", "11", "Replace the First Match", "Beginner", 50, "Show app.conf with debug=true changed to debug=false, without touching the file.", "Substitute true with false once per line.",
    "sed 's/true/false/' app.conf", [["s/true/false/", "Substitute: first occurrence on each line."]], "Without -i sed only prints the result: safe to preview.", S({ outRe: /debug=false/ , goal: sh => /debug=false/.test(out(sh)) && /true/.test(sh.read("app.conf")) }));
  D("sed_edit", "12", "Delete a Line", "Beginner", 50, "Print list.txt without its second line.", "Delete line 2.",
    "sed '2d' list.txt", [["2d", "Address 2, command d (delete)."]], "$d deletes the last line; 1d deletes the header.", S({ focus: ["list.txt"], goal: sh => out(sh) === "one\nthree\nfour\nfive\n" }));
  D("sed_edit", "13", "Delete Comments", "Intermediate", 60, "Print app.conf without any comment lines.", "Delete lines starting with #.",
    "sed '/^#/d' app.conf", [["/^#/d", "Delete every line matching the regex ^#."]], "Add -e '/^$/d' to drop blank lines too.", S({ goal: sh => !/^#/m.test(out(sh)) && /port=8080/.test(out(sh)) }));
  D("sed_edit", "14", "Print a Range", "Intermediate", 60, "Show only lines 2 to 4 of list.txt.", "Print lines 2-4.",
    "sed -n '2,4p' list.txt", [["-n", "Do not print automatically."], ["2,4p", "Print lines 2 through 4."]], "sed -n '/start/,/end/p' prints everything between two markers.", S({ focus: ["list.txt"], goal: sh => out(sh) === "two\nthree\nfour\n" }));
  D("sed_edit", "15", "Add a Header Line", "Intermediate", 60, "Print list.txt with the line HEADER inserted before line 1.", "Insert text before the first line.",
    "sed '1i HEADER' list.txt", [["1i HEADER", "Insert HEADER before line 1."]], "a appends after a line; c replaces the line.", S({ focus: ["list.txt"], goal: sh => out(sh).startsWith("HEADER\none\n") }));
  D("sed_edit", "16", "Append at the End", "Intermediate", 60, "Print list.txt with END appended after the last line.", "Append a line at the end.",
    "sed '$a END' list.txt", [["$a END", "$ is the last line; a appends text after it."]], "Great for adding a trailer to generated config.", S({ focus: ["list.txt"], goal: sh => out(sh).endsWith("five\nEND\n") }));
  D("sed_edit", "17", "Edit the File In Place", "Intermediate", 80, "Change the port in app.conf from 8080 to 9090 and save the change in the file itself.", "Substitute in place with -i.",
    "sed -i 's/8080/9090/' app.conf", [["-i", "Edit the file in place."], ["s/8080/9090/", "The substitution."]], "Take a backup first (-i.bak) when editing configs on production.", S({ goal: sh => /port=9090/.test(sh.read("app.conf")) && !/8080/.test(sh.read("app.conf")) }));
  D("sed_edit", "18", "Edit in Place With a Backup", "Advanced", 80, "Turn debug=true into debug=false in app.conf, keeping the original as app.conf.bak.", "Use -i.bak.",
    "sed -i.bak 's/debug=true/debug=false/' app.conf", [["-i.bak", "Edit in place and save the original with the suffix .bak."]], "If the edit goes wrong: mv app.conf.bak app.conf.", S({ goal: sh => /debug=false/.test(sh.read("app.conf")) && /debug=true/.test(sh.read("app.conf.bak") || "") }));
  D("sed_edit", "19", "Several Edits at Once", "Intermediate", 70, "In one run, replace one with 1 and two with 2 in list.txt (print only).", "Chain edits with -e.",
    "sed -e 's/one/1/' -e 's/two/2/' list.txt", [["-e", "Add another editing command; they run in order."]], "Or use a semicolon: sed 's/one/1/;s/two/2/'.", S({ focus: ["list.txt"], goal: sh => out(sh).startsWith("1\n2\nthree") }));
  D("sed_edit", "20", "Swap With Capture Groups", "Advanced", 90, "Reverse every name=value pair in app.conf into value=name using regex groups.", "Use extended regex groups and back-references.",
    "sed -E 's/([a-z]+)=([a-z0-9]+)/\\2=\\1/' app.conf", [["-E", "Extended regex."], ["([a-z]+)=([a-z0-9]+)", "Two captured groups around the equals sign."], ["\\2=\\1", "Output group 2, then group 1."]], "& in the replacement means the whole match.", S({ goal: sh => /^web=name$/m.test(out(sh)) && /^8080=port$/m.test(out(sh)) }));
  D("sed_edit", "21", "Strip Inline Comments", "Advanced", 70, "Remove everything from a # to the end of each line in app.conf (print only).", "Delete from # to end of line.",
    "sed 's/#.*//' app.conf", [["#.*", "A # and everything after it."]], "Follow with sed '/^$/d' to remove the now-empty lines.", S({ goal: sh => !/#/.test(out(sh)) && /port=8080/.test(out(sh)) }));
  D("sed_edit", "22", "Print Matching Lines Only", "Intermediate", 60, "Print only the ERROR lines of app.log with sed instead of grep.", "Use -n with /pattern/p.",
    "sed -n '/ERROR/p' app.log", [["-n", "Suppress automatic printing."], ["/ERROR/p", "Print lines matching ERROR."]], "That is grep in sed's clothes: sed also lets you edit the matched lines.", S({ focus: ["app.log"], goal: sh => out(sh).trim().split("\n").length === 3 }));
  D("sed_edit", "23", "Ignore Case", "Advanced", 70, "Replace the word info in any capitalisation with NOTE in app.log (print only).", "Use the I flag.",
    "sed 's/info/NOTE/I' app.log", [["I", "Case-insensitive match (GNU sed)."]], "g replaces every match on the line; I and g combine: s/a/b/gI.", S({ focus: ["app.log"], goal: sh => /NOTE server started/.test(out(sh)) }));
  D("sed_edit", "24", "Replace the Third Match", "Advanced", 80, "On each line replace only the second 'o' with 0 in list.txt text (print only).", "Substitute only the second occurrence.",
    "sed 's/o/0/2' list.txt", [["s/o/0/2", "A number flag: replace only the 2nd occurrence per line."]], "s/x/y/2g replaces the 2nd and every later one.", S({ focus: ["list.txt"], goal: sh => out(sh).startsWith("one\ntw0\n") === false && out(sh).includes("four") && sh.lastExec.cmds.some(c => c.name === "sed") }));
  D("sed_edit", "25", "Replace a Whole Line", "Intermediate", 70, "Print list.txt with line 3 replaced by the text THREE.", "Change line 3.",
    "sed '3c THREE' list.txt", [["3c THREE", "Replace line 3 with THREE."]], "Use /regex/c to replace every matching line.", S({ focus: ["list.txt"], goal: sh => out(sh) === "one\ntwo\nTHREE\nfour\nfive\n" }));
  D("sed_edit", "26", "How Many Lines?", "Beginner", 50, "Print the number of lines in list.txt using sed.", "Print the line count with $=.",
    "sed -n '$=' list.txt", [["$=", "= prints the current line number; $ is the last line."]], "wc -l is the usual way; sed is handy when you are already in a pipeline.", S({ focus: ["list.txt"], goal: sh => out(sh).trim() === "5" }));

  // =============== Module 11: head & tail ===============
  const HF = { fs: FS(["app.log", "data.csv", "notes.txt"]), files: { "app.log": APP, "data.csv": CSV, "notes.txt": "a\nb\nc\nd\ne\nf\n" }, viz: "text", focus: ["app.log"] };
  const H = extra => Object.assign({}, HF, extra);
  D("head_tail", "11", "First Few Lines", "Beginner", 40, "Peek at the start of app.log: just the first 3 lines.", "Show the first 3 lines.",
    "head -n 3 app.log", [["head", "Prints the beginning of a file."], ["-n 3", "Three lines (the default is 10)."]], "head -3 is shorthand for head -n 3.", H({ goal: sh => out(sh).trim().split("\n").length === 3 && /server started/.test(out(sh)) }));
  D("head_tail", "12", "Last Few Lines", "Beginner", 40, "Show the most recent 4 lines of app.log (the end of a log is the newest).", "Show the last 4 lines.",
    "tail -n 4 app.log", [["tail -n 4", "The last four lines."]], "tail -n 50 is the first thing to run on a misbehaving service.", H({ goal: sh => out(sh).trim().split("\n").length === 4 && /heartbeat/.test(out(sh)) }));
  D("head_tail", "13", "Skip the Header", "Intermediate", 60, "Print data.csv without its first (header) line.", "Start output at line 2.",
    "tail -n +2 data.csv", [["-n +2", "Start at line 2: + means 'from this line on'."]], "tail -n +N is how you skip N-1 lines; tail -n N means the last N.", H({ focus: ["data.csv"], goal: sh => out(sh).startsWith("1,ann,82,paris") && !/id,name/.test(out(sh)) }));
  D("head_tail", "14", "Follow Through Log Rotation", "Intermediate", 70, "Follow app.log so that you keep seeing new lines even if the log is rotated and recreated.", "Follow with tail -F.",
    "tail -F app.log", [["-F", "Follow the file name: reopens it if it is rotated (like -f --retry)."]], "Plain -f follows the old file descriptor and goes silent after logrotate. Use -F for services.", H({ goal: sh => { const t = sh.lastExec && sh.lastExec.cmds.find(c => c.name === "tail"); return !!t && t.flags.has("F"); } }));
  D("head_tail", "15", "Last Lines, Filtered", "Intermediate", 70, "Of the last 6 lines of app.log, show only the ones with ERROR or WARN.", "Pipe tail into grep.",
    "tail -n 6 app.log | grep -E 'ERROR|WARN'", [["tail -n 6", "Newest six lines."], ["grep -E 'ERROR|WARN'", "Keep problems."]], "Order matters: tail first limits the window, grep first would search everything.", H({ goal: sh => out(sh).trim().split("\n").length === 3 && /out of memory/.test(out(sh)) }));
  D("head_tail", "16", "Just the Header", "Beginner", 40, "Show only the first line of data.csv, its column names.", "Print one line.",
    "head -n 1 data.csv", [["-n 1", "One line."]], "Great for discovering a CSV's columns before processing it.", H({ focus: ["data.csv"], goal: sh => out(sh) === "id,name,score,city\n" }));
  D("head_tail", "17", "Two Files at Once", "Intermediate", 60, "Show the first 2 lines of both data.csv and notes.txt with headers telling them apart.", "Run head on two files.",
    "head -n 2 data.csv notes.txt", [["head -n 2 f1 f2", "With several files head prints a ==> name <== banner before each."]], "-q hides the banners, -v forces them even for one file.", H({ goal: sh => /==> data\.csv <==/.test(out(sh)) && /==> notes\.txt <==/.test(out(sh)) }));
  D("head_tail", "18", "From a Particular Line", "Advanced", 80, "Show notes.txt starting from line 4 to the end.", "Print from line 4 onward.",
    "tail -n +4 notes.txt", [["+4", "Begin at line 4."]], "tail -n +1000 -f app.log: follow from line 1000, ignoring the old lines.", H({ focus: ["notes.txt"], goal: sh => out(sh) === "d\ne\nf\n" }));
  D("head_tail", "19", "The Three Newest Files", "Advanced", 80, "List the three most recently modified entries of this folder.", "Combine ls -t with head.",
    "ls -t | head -3", [["ls -t", "Newest first."], ["head -3", "Keep three."]], "ls -t | tail -1 gives the oldest.", { fs: FS(["a.txt", "b.txt", "c.txt", "d.txt"]), nodes: { [HOME + "/a.txt"]: { age: 9, content: "a\n" }, [HOME + "/b.txt"]: { age: 1, content: "b\n" }, [HOME + "/c.txt"]: { age: 5, content: "c\n" }, [HOME + "/d.txt"]: { age: 3, content: "d\n" } }, goal: sh => out(sh) === "b.txt\nd.txt\nc.txt\n" });
  D("head_tail", "20", "Count Last Hundred", "Intermediate", 70, "How many of the last 8 lines of app.log are INFO lines? Print the number.", "Pipe tail into grep -c.",
    "tail -n 8 app.log | grep -c INFO", [["tail -n 8", "Last eight lines."], ["grep -c INFO", "Count INFO lines."]], "Use the pattern to build quick error-rate checks: tail -n 1000 log | grep -c ERROR.", H({ goal: sh => out(sh).trim() === "3" }));
})();

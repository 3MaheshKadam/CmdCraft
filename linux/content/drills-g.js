/**
 * Drills for Modules 20 and 21: Vim and Nano.
 * Type the command in the terminal; the editor opens over it and you edit with the real keys. The mission is judged by
 * what is saved in the file when you leave. Each drill also carries `keys`, the reference keystrokes the test-suite replays.
 */
(function () {
  const D = DRILL, f = F, T = Tree;
  const HOME = "/home/ubuntu";
  const sess = sh => sh.editorSession || {};
  const txt = (sh, p) => { const n = sh.lookup(sh.abs(p), true); return n ? n.content : null; };
  const file = (name, content, perm) => f(name, content.length + "B", perm || "-rw-r--r--", { content });
  const FS = (name, content) => T(HOME, [file(name, content)]);
  const base = { viz: "text" };

  // =============== Module 20: Vim ===============
  const V = (num, title, level, xp, desc, obj, cmd, parts, tip, o) => D("vim_editor", num, title, level, xp, desc, obj, cmd, parts, tip, Object.assign({}, base, o));

  V("01", "Open Vim and Get Out", "Beginner", 50, "Open notes.txt in Vim, look around, and quit without changing anything. (Vim starts in NORMAL mode: typing letters runs commands, it does not type text.)", "Open the file, then quit with :q.",
    "vim notes.txt", [["vim notes.txt", "Opens the file in Vim."], [":q", "Type a colon, then q, then Enter: quit. Works only if nothing changed."]], "If you ever feel stuck: press Esc a couple of times, then :q! Enter.",
    { fs: FS("notes.txt", "line one\nline two\nline three\n"), focus: ["notes.txt"], keys: ":q<CR>", goal: sh => sess(sh).kind === "vim" && sess(sh).exitedBy === ":q" });
  V("02", "Type Something and Save", "Beginner", 80, "Create greeting.txt with a single line: Hello, Vim (no file exists yet). Remember: press i to start typing, Esc to stop, :wq to save and quit.", "Open greeting.txt, insert the text, save and quit.",
    "vim greeting.txt", [["i", "Insert mode: now typing writes text."], ["Esc", "Back to normal mode."], [":wq", "Write (save) and quit."]], "Normal mode is for commands, insert mode is for text. The bottom-left says -- INSERT -- when you are typing.",
    { focus: ["greeting.txt"], keys: "iHello, Vim<Esc>:wq<CR>", goal: sh => txt(sh, "greeting.txt") === "Hello, Vim\n" });
  V("03", "Quit Without Saving", "Beginner", 70, "You opened notes.txt and accidentally deleted a line. Throw the change away and quit, leaving the file exactly as it was.", "Quit with :q! (force, discard).",
    "vim notes.txt", [[":q", "Vim refuses: 'No write since last change'."], [":q!", "The ! means force: quit and discard."]], "ZQ is the two-key shortcut for :q!, ZZ for :wq.",
    { fs: FS("notes.txt", "line one\nline two\nline three\n"), focus: ["notes.txt"], keys: "dd:q!<CR>", goal: sh => sess(sh).kind === "vim" && sess(sh).exitedBy === ":q!" && txt(sh, "notes.txt") === "line one\nline two\nline three\n" });
  V("04", "Delete a Line", "Beginner", 70, "Remove the second line (TODO: delete me) from todo.txt and save.", "Move down with j, delete with dd, save with :wq.",
    "vim todo.txt", [["j", "Down one line."], ["dd", "Delete the current line."], [":wq", "Save and quit."]], "dd really cuts the line: p pastes it back somewhere else.",
    { fs: FS("todo.txt", "buy milk\nTODO: delete me\ncall mum\n"), focus: ["todo.txt"], keys: "jdd:wq<CR>", goal: sh => txt(sh, "todo.txt") === "buy milk\ncall mum\n" });
  V("05", "Delete Many Lines with a Count", "Intermediate", 80, "log.txt has three junk lines at the top. Delete exactly those three with a single command and save.", "Use a count before dd.",
    "vim log.txt", [["3dd", "A number before a command repeats it: delete 3 lines."]], "Counts work with most commands: 5j moves down 5, 2yy copies 2 lines, 10x deletes 10 characters.",
    { fs: FS("log.txt", "junk 1\njunk 2\njunk 3\nreal data\nmore data\n"), focus: ["log.txt"], keys: "3dd:wq<CR>", goal: sh => txt(sh, "log.txt") === "real data\nmore data\n" });
  V("06", "Copy and Paste a Line", "Intermediate", 90, "Duplicate the line `server=web1` so it appears twice in a row, then save.", "yy copies the line, p pastes it below.",
    "vim hosts.txt", [["yy", "Yank (copy) the current line."], ["p", "Paste after the cursor line."]], "P (capital) pastes above. dd followed by p moves a line.",
    { fs: FS("hosts.txt", "server=web1\nserver=db1\n"), focus: ["hosts.txt"], keys: "yyp:wq<CR>", goal: sh => txt(sh, "hosts.txt") === "server=web1\nserver=web1\nserver=db1\n" });
  V("07", "Undo a Mistake", "Intermediate", 90, "Delete the wrong line (the first one) by mistake, undo it, then delete the line that says remove-me and save. Only remove-me must be gone.", "dd, u, then move and dd again.",
    "vim list.txt", [["u", "Undo the last change. Ctrl-R redoes it."]], "Vim keeps a full undo tree: you can undo a whole editing session one step at a time.",
    { fs: FS("list.txt", "keep-a\nremove-me\nkeep-b\n"), focus: ["list.txt"], keys: "ddujdd:wq<CR>", goal: sh => txt(sh, "list.txt") === "keep-a\nkeep-b\n" });
  V("08", "Append at the End of a Line", "Intermediate", 80, "Add ;nologin to the end of the first line of users.txt (so it reads alice:x:1001;nologin) and save.", "Use A to append at end of line.",
    "vim users.txt", [["A", "Jump to the end of the line and start inserting."], ["Esc :wq", "Leave insert mode, save, quit."]], "I inserts at the start of the line, a/i insert after/before the cursor.",
    { fs: FS("users.txt", "alice:x:1001\nbob:x:1002\n"), focus: ["users.txt"], keys: "A;nologin<Esc>:wq<CR>", goal: sh => txt(sh, "users.txt") === "alice:x:1001;nologin\nbob:x:1002\n" });
  V("09", "Open a New Line", "Intermediate", 80, "Add a new last line `# end of file` below the existing text and save.", "G goes to the last line, o opens a line below.",
    "vim app.conf", [["G", "Jump to the last line."], ["o", "Open a new line below and enter insert mode."]], "O (capital) opens a line above.",
    { fs: FS("app.conf", "port=80\nmode=prod\n"), focus: ["app.conf"], keys: "Go# end of file<Esc>:wq<CR>", goal: sh => txt(sh, "app.conf") === "port=80\nmode=prod\n# end of file\n" });
  V("10", "Jump to a Line Number", "Intermediate", 80, "Go straight to line 4 of data.txt, delete it, and save.", "Use :4 (or 4G), then dd.",
    "vim data.txt", [[":4", "Jump to line 4."], ["dd", "Delete it."]], "Compilers and logs quote line numbers: :N gets you there instantly. vim +4 data.txt opens at line 4.",
    { fs: FS("data.txt", "a\nb\nc\nbad\ne\n"), focus: ["data.txt"], keys: ":4<CR>dd:wq<CR>", goal: sh => txt(sh, "data.txt") === "a\nb\nc\ne\n" });
  V("11", "Find and Replace on One Line", "Intermediate", 90, "Change the first line from `listen 80;` to `listen 8080;` using a substitute command, then save.", "Substitute on the current line: :s/old/new/.",
    "vim site.conf", [[":s/80/8080/", "Replace the first match on the current line."]], "Without a range, :s works on the current line only.",
    { fs: FS("site.conf", "listen 80;\nserver_name example.com;\n"), focus: ["site.conf"], keys: ":s/80/8080/<CR>:wq<CR>", goal: sh => txt(sh, "site.conf") === "listen 8080;\nserver_name example.com;\n" });
  V("12", "Replace Everywhere", "Advanced", 110, "Replace every occurrence of staging with production in deploy.cfg and save.", "Use :%s/old/new/g.",
    "vim deploy.cfg", [[":%s/staging/production/g", "% = every line, g = every match on a line."]], "Add c for confirm: :%s/a/b/gc asks y/n for each.",
    { fs: FS("deploy.cfg", "env=staging\nurl=https://staging.example.com\nname=staging-api\n"), focus: ["deploy.cfg"], keys: ":%s/staging/production/g<CR>:wq<CR>", goal: sh => txt(sh, "deploy.cfg") === "env=production\nurl=https://production.example.com\nname=production-api\n" });
  V("13", "Change a Word", "Intermediate", 90, "In the line `mode=debug`, change the word debug into release. Put the cursor on it and use the change-word command.", "Search for it, cw, type, Esc, save.",
    "vim run.conf", [["/debug", "Search; the cursor lands on the match."], ["cw", "Change word: deletes it and enters insert mode."]], "cw, cc (whole line) and C (to end of line) are the 'change' family.",
    { fs: FS("run.conf", "name=app\nmode=debug\n"), focus: ["run.conf"], keys: "/debug<CR>cwrelease<Esc>:wq<CR>", goal: sh => txt(sh, "run.conf") === "name=app\nmode=release\n" });
  V("14", "Delete to End of Line", "Intermediate", 80, "Everything after the semicolon on line 1 is a stray comment. Remove it from the cursor onwards, keeping `cmd=run;`, and save.", "Move to the end of the ';' then D.",
    "vim cmd.txt", [["f; l D", "Hmm: simpler: /;<CR> finds the semicolon, l steps past it, D deletes the rest."]], "d$ is the long form of D.",
    { fs: FS("cmd.txt", "cmd=run; trailing junk\nnext=1\n"), focus: ["cmd.txt"], keys: "/;<CR>lD:wq<CR>", goal: sh => txt(sh, "cmd.txt") === "cmd=run;\nnext=1\n" });
  V("15", "Search Forward", "Intermediate", 90, "Find the second ERROR in app.log (search, then n for the next match) and delete just that line. Save.", "/ERROR Enter, n, dd.",
    "vim app.log", [["/ERROR", "Search forward."], ["n", "Next match (N goes back)."]], "* searches for the word under the cursor.",
    { fs: FS("app.log", "ok 1\nERROR first\nok 2\nERROR second\nok 3\n"), focus: ["app.log"], keys: "/ERROR<CR>ndd:wq<CR>", goal: sh => txt(sh, "app.log") === "ok 1\nERROR first\nok 2\nok 3\n" });
  V("16", "Delete All Comment Lines", "Advanced", 110, "Remove every line starting with # from settings.ini in one command and save.", "Use :g/pattern/d.",
    "vim settings.ini", [[":g/^#/d", "Global: run d on every line matching ^# (starts with #)."]], ":v/pat/d does the opposite: deletes every line that does NOT match.",
    { fs: FS("settings.ini", "# header\nkey1=a\n# note\nkey2=b\n"), focus: ["settings.ini"], keys: ":g/^#/d<CR>:wq<CR>", goal: sh => txt(sh, "settings.ini") === "key1=a\nkey2=b\n" });
  V("17", "Select Lines Visually", "Advanced", 100, "Remove the first three lines using visual line mode (V), moving down, then d. Save.", "V j j d.",
    "vim chunk.txt", [["V", "Start selecting whole lines."], ["j j", "Extend the selection."], ["d", "Delete the selection."]], "v selects characters, Ctrl-v selects a rectangular block.",
    { fs: FS("chunk.txt", "x1\nx2\nx3\nkeep\n"), focus: ["chunk.txt"], keys: "Vjjd:wq<CR>", goal: sh => txt(sh, "chunk.txt") === "keep\n" });
  V("18", "Join Two Lines", "Advanced", 80, "A command got split across two lines. Join `docker run` and `-d nginx` into one line and save.", "J joins the next line onto this one.",
    "vim cmd.sh", [["J", "Join lines with a single space."]], "gJ joins without adding the space.",
    { fs: FS("cmd.sh", "docker run\n-d nginx\n"), focus: ["cmd.sh"], keys: "J:wq<CR>", goal: sh => txt(sh, "cmd.sh") === "docker run -d nginx\n" });
  V("19", "Replace One Character", "Advanced", 80, "The word `cat` should be `bat`. Fix the first letter with the replace command and save.", "r replaces the character under the cursor.",
    "vim word.txt", [["r b", "Replace one character, stay in normal mode."]], "~ toggles the case of a character.",
    { fs: FS("word.txt", "cat\n"), focus: ["word.txt"], keys: "rb:wq<CR>", goal: sh => txt(sh, "word.txt") === "bat\n" });
  V("20", "Edit a Root-Owned File", "Advanced", 130, "You opened /etc/app.conf as ubuntu and writing fails (E212: Can't open file for writing). Open it with the privileges needed and change `debug=on` to `debug=off`.", "Re-open with sudo vim.",
    "sudo vim /etc/app.conf", [["sudo vim", "Runs the editor as root so it may write the file."]], "sudoedit (or sudo -e) is safer: it edits a temp copy as YOU and copies it back as root.",
    { enforce: true, nodes: { "/etc/app.conf": { content: "name=demo\ndebug=on\n", owner: "root", group: "root", mode: 0o644 } }, focus: ["/etc/app.conf"], keys: "/on<CR>cwoff<Esc>:wq<CR>", goal: sh => txt(sh, "/etc/app.conf") === "name=demo\ndebug=off\n" });
  V("21", "Turn on Line Numbers", "Intermediate", 70, "Open any file and turn line numbers on (the setting only lasts for this session), then quit.", "Use :set nu.",
    "vim notes.txt", [[":set nu", "Show line numbers (:set nonu hides them)."]], "Put set number in ~/.vimrc to make it permanent.",
    { fs: FS("notes.txt", "a\nb\n"), focus: ["notes.txt"], keys: ":set nu<CR>:q<CR>", goal: sh => sess(sh).kind === "vim" && sess(sh).nu === true });
  V("22", "Fix a Config in Place", "Advanced", 130, "In /etc/ssh/sshd_config change `PermitRootLogin yes` to `PermitRootLogin no`. Search for the line, change the word, save. (Use sudo.)", "Search, cw, save.",
    "sudo vim /etc/ssh/sshd_config", [["/PermitRootLogin", "Jump to the setting."], ["$ then change the value", "Or search for 'yes' and cw it."]], "Validate with sudo sshd -t before restarting the service.",
    { enforce: true, nodes: { "/etc/ssh/sshd_config": { content: "Port 22\nPermitRootLogin yes\nPasswordAuthentication yes\n", owner: "root", group: "root", mode: 0o644 } }, focus: ["/etc/ssh/sshd_config"], keys: "/yes<CR>cwno<Esc>:wq<CR>", goal: sh => /^PermitRootLogin no$/m.test(txt(sh, "/etc/ssh/sshd_config") || "") && /^Port 22$/m.test(txt(sh, "/etc/ssh/sshd_config") || "") });
  V("23", "Indent a Line", "Advanced", 80, "Indent the second line one level (4 spaces) using the shift command, then save.", "Move down and use >>.",
    "vim yaml.txt", [[">>", "Shift the line right. << shifts left."]], "In visual mode, select lines and press > to indent the block.",
    { fs: FS("yaml.txt", "items:\nname: x\n"), focus: ["yaml.txt"], keys: "j>>:wq<CR>", goal: sh => txt(sh, "yaml.txt") === "items:\n    name: x\n" });

  // =============== Module 21: Nano ===============
  const N = (num, title, level, xp, desc, obj, cmd, parts, tip, o) => D("nano_editor", num, title, level, xp, desc, obj, cmd, parts, tip, Object.assign({}, base, o));

  N("01", "Open Nano and Exit", "Beginner", 50, "Open notes.txt in nano and leave again without changing anything. The shortcuts are printed at the bottom: ^ means Ctrl.", "Open, then Ctrl-X.",
    "nano notes.txt", [["nano notes.txt", "Opens the file."], ["Ctrl-X", "Exit. With no changes it just closes."]], "Unlike Vim, nano is modeless: whatever you type goes into the file.",
    { fs: FS("notes.txt", "one\ntwo\n"), focus: ["notes.txt"], keys: "<C-x>", goal: sh => sess(sh).kind === "nano" && sess(sh).exitedBy === "Ctrl-X" });
  N("02", "Type and Save", "Beginner", 80, "Create hello.txt containing the line Hello, Nano and save it (Ctrl-O, confirm the name with Enter) then exit with Ctrl-X.", "Type, Ctrl-O, Enter, Ctrl-X.",
    "nano hello.txt", [["Ctrl-O", "Write Out: save. It asks for the file name."], ["Enter", "Accept the name."], ["Ctrl-X", "Exit."]], "Ctrl-X on a modified file offers to save for you: Y then Enter does both steps.",
    { focus: ["hello.txt"], keys: "Hello, Nano<C-o><CR><C-x>", goal: sh => txt(sh, "hello.txt") === "Hello, Nano\n" });
  N("03", "Exit and Save in One Go", "Beginner", 80, "Add the line done at the end of notes.txt. Save by pressing Ctrl-X, answering Y and confirming the name.", "Ctrl-X, Y, Enter.",
    "nano notes.txt", [["Ctrl-X", "Asks 'Save modified buffer?'"], ["Y", "Yes."], ["Enter", "Keep the file name."]], "N would discard your changes. Ctrl-C cancels and returns to editing.",
    { fs: FS("notes.txt", "one\ntwo\n"), focus: ["notes.txt"], keys: "<Down><C-e><CR>done<C-x>y<CR>", goal: sh => txt(sh, "notes.txt") === "one\ntwo\ndone\n" });
  N("04", "Throw Changes Away", "Beginner", 70, "You typed junk into notes.txt by accident. Exit, answer N, and leave the file untouched.", "Ctrl-X then N.",
    "nano notes.txt", [["Ctrl-X", "Exit."], ["N", "No: do not save."]], "Nothing is written until you confirm, so a wrong keypress is recoverable.",
    { fs: FS("notes.txt", "one\ntwo\n"), focus: ["notes.txt"], keys: "junk<C-x>n", goal: sh => sess(sh).kind === "nano" && sess(sh).exitedBy === "Ctrl-X n" && txt(sh, "notes.txt") === "one\ntwo\n" });
  N("05", "Cut a Line", "Intermediate", 80, "Delete the line `remove me` (line 2) with the cut command, then save and exit.", "Down, Ctrl-K, then save.",
    "nano list.txt", [["Ctrl-K", "Cut the current line (it goes to the clipboard)."]], "Several Ctrl-K in a row collect several lines.",
    { fs: FS("list.txt", "keep\nremove me\nkeep too\n"), focus: ["list.txt"], keys: "<Down><C-k><C-x>y<CR>", goal: sh => txt(sh, "list.txt") === "keep\nkeep too\n" });
  N("06", "Move a Line (Cut and Paste)", "Intermediate", 100, "Move the first line `header` to the end of the file: cut it, go to the last line, paste, save.", "Ctrl-K, move down, Ctrl-U.",
    "nano rows.txt", [["Ctrl-K", "Cut."], ["Ctrl-U", "Paste (uncut) above the cursor line."]], "Ctrl-U pastes ABOVE the cursor, so move to a blank line or past the end first.",
    { fs: FS("rows.txt", "header\nrow 1\nrow 2\n"), focus: ["rows.txt"], keys: "<C-k><Down><Down><C-u><C-x>y<CR>", goal: sh => { const t = txt(sh, "rows.txt"); return t !== null && t.split("\n").filter(Boolean).sort().join() === "header,row 1,row 2" && !/^header/.test(t); } });
  N("07", "Search with Where Is", "Intermediate", 90, "port=80 should read port=8080. Search for `port=`, jump to the end of the line and append 80. Save and exit.", "Ctrl-W port= Enter, Ctrl-E, type.",
    "nano site.conf", [["Ctrl-W", "Where Is: search."], ["Ctrl-E", "End of line."]], "In nano, Alt-W repeats the last search.",
    { fs: FS("site.conf", "name=web\nport=80\n"), focus: ["site.conf"], keys: "<C-w>port=<CR><C-e>80<C-x>y<CR>", goal: sh => txt(sh, "site.conf") === "name=web\nport=8080\n" });
  N("08", "Go to a Line", "Intermediate", 90, "Jump to line 3 of data.txt and type FIXED at the start of that line. Save and exit.", "Ctrl-_ 3 Enter, then type.",
    "nano data.txt", [["Ctrl-_", "Go To Line (also shown as ^/ at the bottom)."]], "nano +3 data.txt opens at line 3.",
    { fs: FS("data.txt", "a\nb\nc\nd\n"), focus: ["data.txt"], keys: "<C-_>3<CR>FIXED<C-x>y<CR>", goal: sh => txt(sh, "data.txt") === "a\nb\nFIXEDc\nd\n" });
  N("09", "Edit a Protected File", "Advanced", 120, "nano says 'Permission denied' when saving /etc/motd.conf. Open it with sudo and add the line `maintenance tonight`. Save.", "sudo nano, edit, save.",
    "sudo nano /etc/motd.conf", [["sudo nano", "Needs root to write under /etc."]], "Never run a graphical editor with sudo; nano/vim are fine.",
    { enforce: true, nodes: { "/etc/motd.conf": { content: "Welcome\n", owner: "root", group: "root", mode: 0o644 } }, focus: ["/etc/motd.conf"], keys: "<Down>maintenance tonight<C-x>y<CR>", goal: sh => /maintenance tonight/.test(txt(sh, "/etc/motd.conf") || "") });
  N("10", "Edit Your Crontab", "Advanced", 130, "Open your crontab in the default editor and schedule /opt/check.sh every 5 minutes (*/5 * * * *). Save and exit.", "crontab -e, add the line at the bottom.",
    "crontab -e", [["crontab -e", "Opens your crontab in nano; cron installs it when you save and quit."]], "A syntax error is refused when you save: read the line number it reports.",
    { viz: "cron", system: { cron: [] }, focus: [], keys: "<Down><Down><Down><C-e><CR>*/5 * * * * /opt/check.sh<C-x>y<CR>", goal: sh => sh.sys.cron.some(l => /^\*\/5 \* \* \* \* \/opt\/check\.sh$/.test(l.trim())) });
  N("11", "Edit sudoers Safely", "Advanced", 140, "Give the deploy user passwordless sudo for systemctl only: add `deploy ALL=(ALL) NOPASSWD: /usr/bin/systemctl` using visudo (it checks the syntax before saving).", "sudo visudo, add the line, save.",
    "sudo visudo", [["visudo", "The only safe way to edit /etc/sudoers: it locks the file and refuses to save a broken one."]], "A broken sudoers file can lock everyone out of sudo.",
    { focus: ["/etc/sudoers"], keys: "<Down><C-e><CR>deploy ALL=(ALL) NOPASSWD: /usr/bin/systemctl<C-x>y<CR>", goal: sh => /^deploy ALL=\(ALL\) NOPASSWD: \/usr\/bin\/systemctl$/m.test(txt(sh, "/etc/sudoers") || "") });
  N("12", "Fix a Typo in a Config", "Intermediate", 90, "The hostname file has a typo: `web-sever`. Fix it to `web-server` by moving to the right spot and typing the missing r, then save.", "Search, Right arrows, type.",
    "nano hostname.txt", [["Ctrl-W sev", "Land on the typo."], ["type r after 'se'", "Move two characters right and type."]], "Ctrl-A / Ctrl-E jump to line start / end.",
    { fs: FS("hostname.txt", "web-sever\n"), focus: ["hostname.txt"], keys: "<C-w>sev<CR><Right><Right>r<C-x>y<CR>", goal: sh => txt(sh, "hostname.txt") === "web-server\n" });
})();

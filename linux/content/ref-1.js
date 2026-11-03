/**
 * Linux reference (theory). Module: { id, name, topic (practice topic id), summary, k:[[point, text]], cmds:[...] }
 * Command card: { c, d (what it is for), i (impact: safe | changes | system | danger), r (needs root, optional),
 *                 o:[[option, meaning]], ex:[[command, what you see]], g (gotcha), rel:[related commands] }
 * Impact: safe = only reads; changes = modifies your files/state (usually reversible); system = affects users, services,
 * network or boot (often needs root); danger = can destroy data or lock you out.
 */
window.LINUX_REF = window.LINUX_REF || [];
window.LINUX_REF.push(
  {
    id: "architecture", name: "Fundamentals and the system", topic: "architecture",
    summary: "What Linux is made of and how to ask a machine about itself.",
    k: [
      ["Kernel vs shell vs userland", "The kernel talks to hardware and manages processes and memory. The shell (bash, zsh) is a program that reads your commands and starts other programs. Everything else (ls, grep, nginx) is userland software."],
      ["Everything is a file", "Devices live in /dev, process and kernel information in /proc and /sys, so the same read/write tools work on them."],
      ["Where things live", "/etc configuration · /var changing data (logs, spool) · /home user files · /usr programs and libraries · /bin, /sbin core commands · /tmp temporary (cleared on reboot) · /opt third-party software · /boot kernel and bootloader · /dev devices · /proc kernel and processes · /mnt, /media mounts."],
      ["Boot sequence", "Firmware (BIOS/UEFI) → bootloader (GRUB) → kernel → initramfs → init (systemd, PID 1) → targets and services → login."],
      ["Prompt symbols", "$ means a normal user, # means root. Commands that change the system usually need sudo."],
      ["Distribution families", "Debian/Ubuntu use apt and dpkg; RHEL/Rocky/Fedora use dnf and rpm; Alpine uses apk and musl; Arch uses pacman."]
    ],
    cmds: [
      { c: "uname", d: "Prints kernel and system information.", i: "safe", o: [["-a", "everything on one line"], ["-r", "kernel release"], ["-m", "hardware architecture"], ["-s", "kernel name"]], ex: [["uname -r", "5.15.0-1052-aws"], ["uname -a", "Linux host 5.15.0 ... x86_64 GNU/Linux"]], g: "uname shows the kernel, not the distribution. Use /etc/os-release for the distro.", rel: ["hostnamectl", "lscpu"] },
      { c: "cat /etc/os-release", d: "Shows which distribution and version this is.", i: "safe", o: [["NAME, VERSION_ID", "distro and release"], ["ID_LIKE", "parent family, e.g. debian"]], ex: [["cat /etc/os-release", "PRETTY_NAME=\"Ubuntu 22.04.4 LTS\" ..."]], g: "lsb_release -a may not be installed, /etc/os-release always exists on modern distros.", rel: ["uname", "hostnamectl"] },
      { c: "hostnamectl", d: "Shows (or sets) the hostname, OS, kernel and virtualisation.", i: "safe", o: [["set-hostname NAME", "change hostname (root)"], ["status", "default view"]], ex: [["hostnamectl", "Static hostname, Operating System, Kernel, Architecture"]], g: "Setting a hostname changes how the machine identifies itself in logs and prompts; services may need a restart.", rel: ["hostname", "uname"] },
      { c: "whoami", d: "Prints the user you are currently running as.", i: "safe", o: [], ex: [["whoami", "ubuntu"], ["sudo whoami", "root"]], g: "Inside sudo or su the answer changes, which is how you confirm a privilege switch.", rel: ["id", "who"] },
      { c: "id", d: "Shows your user ID, primary group and all groups.", i: "safe", o: [["-u / -g", "only the user or group ID"], ["-Gn", "group names"], ["USER", "inspect another user"]], ex: [["id", "uid=1000(ubuntu) gid=1000(ubuntu) groups=1000(ubuntu),27(sudo)"]], g: "Group changes apply to new logins only; log out and back in after adding yourself to a group.", rel: ["groups", "whoami"] },
      { c: "uptime", d: "Shows how long the machine has been up and the load average.", i: "safe", o: [["-p", "pretty form: up 6 hours, 30 minutes"], ["-s", "boot time"]], ex: [["uptime", "14:30:00 up 6:30, 1 user, load average: 0.08, 0.03, 0.01"]], g: "Compare load average to the number of CPUs: 4.0 on a 4-core machine is full, not broken.", rel: ["free", "top"] },
      { c: "lscpu", d: "Describes the CPU: model, cores, threads, caches.", i: "safe", o: [["-e", "per-CPU table"]], ex: [["lscpu | grep -E 'Model name|^CPU\\(s\\)'", "model and core count"]], g: "On VMs the count is virtual CPUs, not physical cores.", rel: ["nproc", "free"] },
      { c: "date", d: "Shows or formats the current date and time.", i: "safe", o: [["+%F", "2026-10-29"], ["+%s", "Unix timestamp"], ["-u", "UTC"], ["-d 'yesterday'", "parse a relative date"]], ex: [["date +%F", "2026-10-29"]], g: "Setting the time by hand (date -s) fights NTP; use timedatectl instead.", rel: ["timedatectl"] },
      { c: "man", d: "Opens the manual page for a command.", i: "safe", o: [["man -k WORD", "search page titles"], ["man 5 passwd", "choose a section (5 = file formats)"], ["/text", "search inside the page, n for next, q to quit"]], ex: [["man chmod", "NAME, SYNOPSIS, DESCRIPTION, OPTIONS"]], g: "Short help is often quicker: command --help.", rel: ["--help", "info"] },
      { c: "history", d: "Lists the commands you typed earlier.", i: "safe", o: [["!!", "repeat the last command"], ["!N", "run history entry N"], ["Ctrl-R", "search history interactively"], ["-c", "clear this session's history"]], ex: [["history | tail -5", "the five most recent commands"]], g: "Passwords typed on the command line end up in history; avoid putting secrets in arguments.", rel: ["fc"] }
    ]
  },
  {
    id: "navigation", name: "Filesystem navigation", topic: "navigation",
    summary: "Moving around and looking at what is there.",
    k: [
      ["Absolute vs relative paths", "An absolute path starts at / and always means the same place. A relative path starts at your current directory."],
      ["Shortcuts", ". is here, .. is the parent, ~ is your home, - (in cd) is the previous directory."],
      ["Hidden files", "Names starting with a dot are hidden from plain ls; ls -a shows them."],
      ["Globbing", "The shell expands * (any text), ? (one character) and [abc] before the command runs, so rm *.log is expanded by the shell, not by rm."]
    ],
    cmds: [
      { c: "pwd", d: "Prints the directory you are in.", i: "safe", o: [["-P", "resolve symlinks to the real path"]], ex: [["pwd", "/home/ubuntu/project"]], g: "A symlinked directory shows the link path by default; -P shows where you really are.", rel: ["cd", "realpath"] },
      { c: "cd", d: "Changes the current directory.", i: "safe", o: [["cd", "go to home"], ["cd -", "go back to the previous directory"], ["cd ..", "go up one level"], ["cd ~user", "another user's home"]], ex: [["cd /var/log", "prompt changes; pwd prints /var/log"]], g: "cd is a shell builtin: it only affects your own shell, never a script's parent shell.", rel: ["pwd", "pushd"] },
      { c: "ls", d: "Lists directory contents.", i: "safe", o: [["-l", "long: permissions, owner, size, date"], ["-a", "include hidden files"], ["-h", "human-readable sizes"], ["-t", "newest first"], ["-R", "recurse"], ["-d", "the directory itself, not its contents"]], ex: [["ls -lah", "total ... drwxr-xr-x 4 ubuntu ubuntu 4.0K Oct 29 14:00 ."]], g: "ls * with a directory in the glob lists inside it; use ls -d */ to list only directories.", rel: ["tree", "stat"] },
      { c: "tree", d: "Draws a directory tree.", i: "safe", o: [["-L 2", "limit depth"], ["-a", "include hidden"], ["-d", "directories only"], ["-I PATTERN", "ignore matches"]], ex: [["tree -L 2", "an indented tree of folders and files"]], g: "Not installed everywhere (apt install tree).", rel: ["ls", "find"] },
      { c: "stat", d: "Shows all metadata of a file: size, permissions, owner, timestamps, inode.", i: "safe", o: [["-c '%a %U'", "custom format (octal mode, owner)"], ["-f", "filesystem info"]], ex: [["stat -c '%a %U %s' file", "644 ubuntu 1024"]], g: "Three timestamps: Access, Modify (content), Change (metadata such as chmod).", rel: ["ls -l", "file"] },
      { c: "file", d: "Guesses what kind of data a file contains by looking at it.", i: "safe", o: [["-i", "MIME type"], ["-b", "brief output"]], ex: [["file script.sh", "script.sh: Bourne-Again shell script, ASCII text"]], g: "Extensions mean nothing to Linux; file looks at content.", rel: ["stat", "strings"] },
      { c: "realpath", d: "Resolves a path to its absolute, symlink-free form.", i: "safe", o: [["-s", "do not resolve symlinks"], ["-m", "allow nonexistent parts"]], ex: [["realpath ../data/./x", "/home/ubuntu/data/x"]], g: "Handy inside scripts to avoid relative-path surprises.", rel: ["readlink -f", "pwd -P"] },
      { c: "which", d: "Shows which executable a command name would run (searches PATH).", i: "safe", o: [["-a", "show all matches"]], ex: [["which python3", "/usr/bin/python3"]], g: "Does not know about aliases and functions; use type for the full answer.", rel: ["type", "command -v"] },
      { c: "type", d: "Tells you whether a name is a builtin, alias, function or file.", i: "safe", o: [["-a", "every definition in order"], ["-t", "just the kind"]], ex: [["type ll", "ll is aliased to `ls -alF'"]], g: "Explains why a command behaves unexpectedly (an alias may be shadowing it).", rel: ["which", "alias"] },
      { c: "basename / dirname", d: "Split a path into its file name or its directory part.", i: "safe", o: [["basename file .txt", "strip a suffix too"]], ex: [["basename /var/log/syslog", "syslog"], ["dirname /var/log/syslog", "/var/log"]], g: "Both work on the text only; they do not check that the path exists.", rel: ["realpath"] }
    ]
  },
  {
    id: "files", name: "Files and directories", topic: "files",
    summary: "Creating, copying, moving, deleting and viewing files.",
    k: [
      ["There is no recycle bin", "rm removes the directory entry immediately. Recovery usually needs backups, so check the path (and any variables in it) before pressing Enter."],
      ["mv is a rename", "Within one filesystem mv only rewrites a directory entry, so it is instant even for huge files; across filesystems it copies then deletes."],
      ["Links", "A hard link is another name for the same data; a symbolic link is a small file holding a path and breaks if the target moves."],
      ["Viewing large files", "Use less (scrollable, searchable) instead of cat so you do not flood the terminal."]
    ],
    cmds: [
      { c: "touch", d: "Creates an empty file or updates the timestamp of an existing one.", i: "changes", o: [["-c", "do not create"], ["-d 'DATE'", "set a specific time"], ["-r REF", "copy another file's timestamp"]], ex: [["touch notes.txt", "creates notes.txt (no output)"]], g: "On an existing file it only changes timestamps, never content.", rel: ["mkdir", "truncate"] },
      { c: "mkdir", d: "Creates directories.", i: "changes", o: [["-p", "create parents, no error if it exists"], ["-m 700", "set mode at creation"], ["-v", "say what was created"]], ex: [["mkdir -p app/config/env", "creates all three levels"]], g: "Without -p, a missing parent is an error: 'No such file or directory'.", rel: ["rmdir", "install -d"] },
      { c: "cp", d: "Copies files and directories.", i: "changes", o: [["-r", "copy directories recursively"], ["-a", "archive: recursive plus permissions, owner and times"], ["-i", "ask before overwriting"], ["-u", "only newer files"], ["-v", "verbose"]], ex: [["cp -a site site.bak", "an exact copy of the folder"]], g: "cp silently overwrites the destination unless you use -i or -n.", rel: ["mv", "rsync"] },
      { c: "mv", d: "Moves or renames files and directories.", i: "changes", o: [["-i", "ask before overwriting"], ["-n", "never overwrite"], ["-v", "verbose"], ["-t DIR", "target directory first (works with xargs)"]], ex: [["mv old.txt new.txt", "renames"], ["mv *.log archive/", "moves all logs"]], g: "Moving onto an existing file replaces it without a warning.", rel: ["cp", "rename"] },
      { c: "rm", d: "Deletes files (and with -r, directories).", i: "danger", o: [["-r", "recurse into directories"], ["-f", "no prompts, ignore missing"], ["-i", "ask for each file"], ["-I", "ask once for more than 3 files"], ["-v", "verbose"]], ex: [["rm -i old.txt", "rm: remove regular file 'old.txt'?"]], g: "rm -rf with an empty variable (rm -rf $DIR/*) can wipe /. Quote variables and use ${DIR:?}.", rel: ["rmdir", "trash-cli"] },
      { c: "rmdir", d: "Removes empty directories only.", i: "changes", o: [["-p", "remove empty parents too"]], ex: [["rmdir build", "fails with 'Directory not empty' if it has files"]], g: "That failure is a feature: it cannot delete data by accident.", rel: ["rm -r"] },
      { c: "ln", d: "Creates links between files.", i: "changes", o: [["-s", "symbolic link (a path pointer)"], ["-f", "replace an existing link"], ["-n", "treat a link to a directory as a file"]], ex: [["ln -sfn /opt/app/releases/v2 /opt/app/current", "current now points to v2"]], g: "Symlink targets are relative to the link's location unless absolute. ln -sfn is the safe release switch.", rel: ["readlink", "stat"] },
      { c: "cat", d: "Prints files, or joins them.", i: "safe", o: [["-n", "number lines"], ["-A", "show hidden characters"], ["> file", "with no input file, creates from the keyboard (Ctrl-D ends)"]], ex: [["cat a.txt b.txt > all.txt", "concatenates into all.txt"]], g: "cat on a binary file or huge log scrolls forever and may garble the terminal (type reset).", rel: ["less", "tac"] },
      { c: "less", d: "Scrollable viewer for large files.", i: "safe", o: [["/text", "search forward, n next, N previous"], ["G / g", "end / start"], ["F", "follow like tail -f (Ctrl-C to stop)"], ["-S", "do not wrap long lines"], ["q", "quit"]], ex: [["less /var/log/syslog", "interactive pager"]], g: "less does not load the whole file, so it is safe on multi-gigabyte logs.", rel: ["more", "tail"] },
      { c: "wc", d: "Counts lines, words and bytes.", i: "safe", o: [["-l", "lines"], ["-w", "words"], ["-c", "bytes"], ["-m", "characters"]], ex: [["ls | wc -l", "number of entries"]], g: "A file without a trailing newline reports one line fewer than you expect.", rel: ["sort", "uniq"] },
      { c: "diff", d: "Compares two files line by line.", i: "safe", o: [["-u", "unified format (patch style)"], ["-r", "compare directories"], ["-y", "side by side"], ["-q", "only say whether they differ"]], ex: [["diff -u old.conf new.conf", "- removed lines / + added lines"]], g: "Exit status: 0 same, 1 different, 2 error, which scripts can use.", rel: ["cmp", "patch"] },
      { c: "truncate", d: "Sets a file's size, e.g. to empty it without deleting it.", i: "danger", o: [["-s 0", "empty the file"], ["-s 1G", "create a sparse 1 GB file"]], ex: [["truncate -s 0 app.log", "log emptied, running process keeps writing"]], g: "Safer than rm for a live log: the process keeps its open file handle and disk space is freed.", rel: ["> file", "fallocate"] }
    ]
  },
  {
    id: "permissions", name: "Permissions and ownership", topic: "permissions",
    summary: "Who may read, write and execute, and how to change that safely.",
    k: [
      ["Reading rwxr-xr--", "Three groups of three: owner, group, others. r read (4), w write (2), x execute (1). rwxr-xr-- is 754."],
      ["Directories are different", "r lists names, w creates and deletes entries, x lets you enter and reach items by name. Without x on every parent directory a file is unreachable."],
      ["Special bits", "setuid (4000): run with the owner's rights · setgid (2000): run with the group's rights, or new files inherit the directory's group · sticky (1000): in a shared directory only the owner may delete their files (/tmp)."],
      ["umask", "Subtracted from 666 (files) and 777 (directories) at creation. umask 022 gives 644 and 755."],
      ["Who can change what", "Only the owner (and root) can chmod; only root can chown to another user."],
      ["Debugging 'Permission denied'", "Check the file mode, the owner, every directory on the path (namei -l), and whether the caller is the owner or in the group."]
    ],
    cmds: [
      { c: "chmod", d: "Changes permission bits.", i: "changes", o: [["755 / 644 / 600", "numeric mode"], ["u+x, g-w, a=r", "symbolic mode"], ["-R", "recurse"], ["--reference=FILE", "copy another file's mode"]], ex: [["chmod 600 id_rsa", "no output; ls -l shows -rw-------"], ["chmod -R u=rwX,go=rX site/", "capital X: execute only on directories and already-executable files"]], g: "chmod -R 777 is almost never the right fix and opens files to everyone. Find the real owner/permission problem.", rel: ["chown", "umask"] },
      { c: "chown", d: "Changes a file's owner and/or group.", i: "system", r: true, o: [["user:group", "set both"], ["-R", "recurse"], [":group", "group only"], ["--reference=FILE", "copy ownership"]], ex: [["sudo chown -R www-data:www-data /var/www", "ownership of the whole tree changes"]], g: "A recursive chown on / or a wrong path breaks the system (setuid programs lose their owner meaning).", rel: ["chgrp", "chmod"] },
      { c: "chgrp", d: "Changes the group of a file.", i: "changes", o: [["-R", "recurse"]], ex: [["chgrp developers shared/", "group changes, owner stays"]], g: "You can only give a file to a group you belong to (unless root).", rel: ["chown", "usermod"] },
      { c: "umask", d: "Shows or sets the default permission mask for new files.", i: "changes", o: [["umask", "print current (e.g. 0022)"], ["umask 077", "private by default"], ["-S", "symbolic form"]], ex: [["umask 027", "new files 640, new directories 750"]], g: "Applies to the current shell and its children only; put it in ~/.bashrc to persist.", rel: ["chmod"] },
      { c: "ls -l", d: "Shows permissions, owner, group and size.", i: "safe", o: [["-ld DIR", "the directory itself"], ["-n", "numeric IDs"]], ex: [["ls -l deploy.sh", "-rwxr-xr-x 1 ubuntu ubuntu 120 Oct 29 14:00 deploy.sh"]], g: "A trailing + means an ACL exists; a dot means an SELinux context.", rel: ["stat", "namei"] },
      { c: "namei -l", d: "Shows permissions of every directory on the way to a file.", i: "safe", o: [["-m", "modes only"], ["-o", "owners"]], ex: [["namei -l /var/www/html/index.html", "one line per path component with its mode and owner"]], g: "The quickest way to find the directory that blocks access.", rel: ["ls -ld"] },
      { c: "getfacl / setfacl", d: "Reads or sets extra per-user and per-group permissions (ACLs).", i: "changes", o: [["setfacl -m u:alice:rw file", "grant alice read-write"], ["setfacl -x u:alice file", "remove an entry"], ["-R", "recurse"], ["getfacl file", "show ACLs"]], ex: [["setfacl -m u:alice:r report.txt", "ls -l then shows a trailing +"]], g: "ACLs are invisible in plain ls -l apart from the + sign; they override the group bits for the named user.", rel: ["chmod"] },
      { c: "chattr / lsattr", d: "Sets or lists low-level file attributes such as immutable.", i: "system", r: true, o: [["+i", "immutable: nobody (even root) can modify or delete"], ["-i", "remove the flag"], ["+a", "append-only"]], ex: [["sudo chattr +i /etc/resolv.conf", "file can no longer change or be deleted"]], g: "Explains the mystery 'Operation not permitted' even as root: check lsattr.", rel: ["chmod"] },
      { c: "setuid / setgid / sticky", d: "Special permission bits set through chmod.", i: "system", o: [["chmod u+s FILE", "run as the file's owner"], ["chmod g+s DIR", "new files inherit the directory's group"], ["chmod +t DIR", "only owners delete their files"], ["find / -perm -4000", "audit setuid files"]], ex: [["ls -ld /tmp", "drwxrwxrwt: the t is the sticky bit"]], g: "A setuid root program with a flaw is a privilege-escalation route; audit them regularly.", rel: ["find"] }
    ]
  },
  {
    id: "users_privileges", name: "Users, groups and sudo", topic: "users_privileges",
    summary: "Accounts, group membership and controlled administrator access.",
    k: [
      ["Where accounts live", "/etc/passwd (name, UID, GID, home, shell; world-readable), /etc/shadow (password hashes; root only), /etc/group (groups and members)."],
      ["UID ranges", "0 is root. Below 1000 are system accounts. 1000 and up are normal users."],
      ["sudo vs su", "sudo runs one command with elevated rights using your own password and logs it. su switches to another user's shell and needs that user's password."],
      ["Least privilege", "Give a user or service only the access it needs: dedicated service accounts, specific sudo commands, no shared root logins."],
      ["Group changes apply at next login", "usermod -aG adds a group, but already-running sessions keep the old list."]
    ],
    cmds: [
      { c: "useradd", d: "Creates a user account.", i: "system", r: true, o: [["-m", "create the home directory"], ["-s /bin/bash", "login shell"], ["-G g1,g2", "extra groups"], ["-u UID", "choose the ID"], ["-r", "system account"]], ex: [["sudo useradd -m -s /bin/bash deploy", "no output; /home/deploy exists"]], g: "Without -m there is no home directory. adduser (Debian) is the friendlier interactive wrapper.", rel: ["adduser", "passwd"] },
      { c: "usermod", d: "Modifies an existing account.", i: "system", r: true, o: [["-aG group", "append to a group (keep the others)"], ["-s SHELL", "change shell"], ["-L / -U", "lock / unlock the account"], ["-d DIR -m", "move the home directory"]], ex: [["sudo usermod -aG docker alice", "alice is added to docker"]], g: "-G without -a replaces all supplementary groups and can remove a user from sudo.", rel: ["gpasswd", "id"] },
      { c: "userdel", d: "Deletes an account.", i: "danger", r: true, o: [["-r", "also remove home directory and mail"]], ex: [["sudo userdel -r olduser", "account and files gone"]], g: "Files owned by the deleted UID stay on disk as numbers and may be reassigned to a future user.", rel: ["usermod -L"] },
      { c: "passwd", d: "Sets or changes a password, or locks/expires an account.", i: "system", r: true, o: [["-l / -u", "lock / unlock"], ["-e", "force change at next login"], ["-S", "status"]], ex: [["sudo passwd -l olduser", "password login disabled"]], g: "Locking the password does not stop SSH key logins; also lock the shell or remove keys.", rel: ["chage"] },
      { c: "groupadd / groupdel", d: "Creates or removes a group.", i: "system", r: true, o: [["-g GID", "set the ID"]], ex: [["sudo groupadd developers", "creates the group"]], g: "Deleting a group that is some user's primary group is refused.", rel: ["usermod", "getent"] },
      { c: "groups", d: "Lists the groups a user belongs to.", i: "safe", o: [["groups USER", "another user"]], ex: [["groups", "ubuntu sudo docker"]], g: "id shows the same plus the numeric IDs.", rel: ["id"] },
      { c: "sudo", d: "Runs a command as another user (root by default).", i: "system", o: [["-l", "list what you may run"], ["-u USER cmd", "run as another user"], ["-i", "root login shell"], ["-k", "forget cached credentials"], ["-e FILE", "safe edit (sudoedit)"]], ex: [["sudo -l", "User ubuntu may run the following commands: (ALL : ALL) ALL"]], g: "Redirection happens in YOUR shell: sudo echo x > /etc/f fails. Use echo x | sudo tee /etc/f.", rel: ["su", "visudo"] },
      { c: "su", d: "Switches to another user's shell.", i: "system", o: [["-", "login shell with that user's environment"], ["-c 'cmd' USER", "run one command"]], ex: [["su - deploy", "prompt changes to deploy"]], g: "Plain su keeps your environment, which causes odd PATH problems; use su - for a clean login.", rel: ["sudo"] },
      { c: "visudo", d: "Edits /etc/sudoers safely, checking syntax before saving.", i: "system", r: true, o: [["-c", "check the file only"]], ex: [["sudo visudo", "opens sudoers in an editor; refuses to save a broken file"]], g: "A syntax error in sudoers can lock everyone out of sudo. Never edit it with a plain editor.", rel: ["sudo -l"] },
      { c: "who / w / last", d: "Show who is logged in now (who, w) and past logins (last).", i: "safe", o: [["w", "also shows what each user runs"], ["last -n 10", "last ten logins"], ["lastb", "failed logins (root)"]], ex: [["last -n 3", "user pts/0 192.0.2.44 Thu Oct 29 09:15 still logged in"]], g: "Compare with unfamiliar IPs when you suspect a compromise.", rel: ["lastlog", "journalctl"] },
      { c: "chage", d: "Shows or sets password ageing rules.", i: "system", r: true, o: [["-l USER", "list the policy"], ["-M 90", "maximum days"], ["-E DATE", "account expiry"]], ex: [["sudo chage -l alice", "Last password change, Password expires ..."]], g: "Expiring a service account's password can break scheduled jobs; set accounts that must never expire accordingly.", rel: ["passwd"] },
      { c: "getent", d: "Looks up users and groups from all sources (files, LDAP, SSO).", i: "safe", o: [["getent passwd alice", "one user"], ["getent group docker", "one group"]], ex: [["getent passwd alice", "alice:x:1001:1001::/home/alice:/bin/bash"]], g: "grep on /etc/passwd misses directory-service users; getent sees them.", rel: ["id"] }
    ]
  },
  {
    id: "redirection", name: "Pipes and streams", topic: "redirection",
    summary: "Standard input, output and error, and connecting commands together.",
    k: [
      ["The three streams", "Every program has stdin (0), stdout (1) and stderr (2). Redirection and pipes rewire them."],
      ["Pipe vs redirect", "A pipe connects one program's stdout to the next program's stdin. A redirect connects a stream to a file."],
      ["Order matters", "cmd > out.txt 2>&1 sends both to the file. cmd 2>&1 > out.txt sends errors to the terminal and only stdout to the file."],
      ["Overwrite vs append", "> truncates the file first (an accidental > destroys content); >> appends."],
      ["/dev/null", "A black hole: writes vanish, reads give end-of-file. cmd >/dev/null 2>&1 silences everything."]
    ],
    cmds: [
      { c: "|  (pipe)", d: "Feeds the output of one command into the next.", i: "safe", o: [["a | b | c", "chain as many as you like"], ["set -o pipefail", "make the pipeline fail if any stage fails"]], ex: [["ps aux | grep nginx | wc -l", "how many nginx lines"]], g: "The exit status of a pipeline is the last command's, unless pipefail is set. grep may match itself in ps output.", rel: ["tee", "xargs"] },
      { c: ">  and  >>", d: "Send stdout to a file (overwrite or append).", i: "danger", o: [["> file", "create or truncate"], [">> file", "append"], ["set -o noclobber", "refuse to overwrite with >"], [">| file", "force overwrite under noclobber"]], ex: [["echo hi > a.txt", "a.txt now contains only 'hi'"]], g: "cat file > file empties the file before cat reads it.", rel: ["tee"] },
      { c: "2>  and  2>&1", d: "Redirect error output.", i: "changes", o: [["2> err.log", "errors to a file"], ["2>&1", "stderr to wherever stdout goes"], ["&> file", "both streams (bash)"], ["2>/dev/null", "hide errors"]], ex: [["find / -name x 2>/dev/null", "no 'Permission denied' noise"]], g: "Hiding errors can hide real problems; use it for known noise only.", rel: ["/dev/null"] },
      { c: "<  and  <<", d: "Feed a file or inline text to a command's input.", i: "safe", o: [["< file", "stdin from a file"], ["<<EOF ... EOF", "here-document: inline multi-line input"], ["<<< 'text'", "here-string"]], ex: [["sort < names.txt", "sorted contents"]], g: "Unquoted <<EOF expands $variables; <<'EOF' keeps the text literal.", rel: ["cat"] },
      { c: "tee", d: "Copies stdin to a file and to stdout.", i: "changes", o: [["-a", "append instead of overwrite"], ["-i", "ignore Ctrl-C"]], ex: [["echo 'nameserver 8.8.8.8' | sudo tee /etc/resolv.conf", "writes the root-owned file and prints the line"]], g: "The standard way to write a root-owned file from a pipeline (sudo applies to tee).", rel: ["sudo", ">"] },
      { c: "xargs", d: "Builds command lines from piped input.", i: "changes", o: [["-n 1", "one argument per call"], ["-I{}", "placeholder for each item"], ["-0", "NUL-separated input (pair with find -print0)"], ["-P 4", "run 4 in parallel"]], ex: [["find . -name '*.tmp' -print0 | xargs -0 rm", "deletes the matches safely"]], g: "Without -0, file names with spaces break into several arguments.", rel: ["find -exec"] },
      { c: "sort", d: "Sorts lines.", i: "safe", o: [["-n", "numeric"], ["-r", "reverse"], ["-k2", "by field 2"], ["-t, ", "field separator"], ["-u", "unique"], ["-h", "human sizes (10K, 2G)"]], ex: [["du -sh * | sort -h", "smallest to largest"]], g: "Default order is alphabetical: 10 sorts before 2 unless you use -n.", rel: ["uniq", "du"] },
      { c: "uniq", d: "Collapses adjacent duplicate lines.", i: "safe", o: [["-c", "prefix with counts"], ["-d", "only duplicates"], ["-u", "only unique lines"]], ex: [["sort access.log | uniq -c | sort -rn | head", "most frequent lines"]], g: "Only adjacent duplicates are merged, so sort first.", rel: ["sort"] },
      { c: "cut", d: "Extracts columns or character ranges.", i: "safe", o: [["-d, -f1,3", "fields 1 and 3 split on commas"], ["-c1-10", "characters 1 to 10"]], ex: [["cut -d: -f1 /etc/passwd", "all usernames"]], g: "cut cannot treat runs of spaces as one separator; use awk for that.", rel: ["awk"] },
      { c: "tr", d: "Translates or deletes characters in a stream.", i: "safe", o: [["tr a-z A-Z", "upper-case"], ["-d '\\r'", "delete characters"], ["-s ' '", "squeeze repeats"]], ex: [["echo hello | tr a-z A-Z", "HELLO"]], g: "tr reads only stdin; it does not take file names.", rel: ["sed"] }
    ]
  }
);

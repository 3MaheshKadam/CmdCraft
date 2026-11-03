/** Linux reference part 3: networking, disks, SSH, file transfer, Vim, Nano, packages. */
window.LINUX_REF.push(
  {
    id: "networking", name: "Networking", topic: "networking",
    summary: "Addresses, routes, ports, DNS and testing connectivity.",
    k: [
      ["Layers to debug in order", "Link (is the interface up?) → address (does it have an IP?) → route (is there a gateway?) → DNS (does the name resolve?) → port (is something listening, is a firewall in the way?) → application."],
      ["Listening address matters", "127.0.0.1 accepts only local connections. 0.0.0.0 (or ::) accepts from any interface. A service bound to localhost is unreachable from other machines."],
      ["Common ports", "22 SSH · 25 SMTP · 53 DNS · 80 HTTP · 443 HTTPS · 3306 MySQL · 5432 PostgreSQL · 6379 Redis · 27017 MongoDB."],
      ["Config files", "/etc/hosts (static names), /etc/resolv.conf (DNS servers), /etc/hostname, netplan or NetworkManager for persistent settings."],
      ["ping vs curl", "ping tests ICMP reachability; curl tests the actual TCP/HTTP service. One can work while the other fails."]
    ],
    cmds: [
      { c: "ip addr / ip a", d: "Shows interfaces and their IP addresses.", i: "safe", o: [["ip -br a", "brief table"], ["ip a show eth0", "one interface"], ["ip addr add 10.0.0.5/24 dev eth0", "add an address (root, not persistent)"]], ex: [["ip -br a", "lo UNKNOWN 127.0.0.1/8 · eth0 UP 172.31.42.12/20"]], g: "ifconfig is deprecated; ip is the current tool. Changes via ip vanish at reboot.", rel: ["ip route", "ip link"] },
      { c: "ip route", d: "Shows or edits the routing table.", i: "system", o: [["ip route", "list routes"], ["ip route get 8.8.8.8", "which route a destination would use"], ["ip route add default via GW", "set a gateway (root)"]], ex: [["ip route", "default via 172.31.32.1 dev eth0"]], g: "No default route means no internet even with a valid address.", rel: ["traceroute"] },
      { c: "ss", d: "Lists sockets: listening ports, connections and the processes owning them.", i: "safe", o: [["-t / -u", "TCP / UDP"], ["-l", "listening only"], ["-n", "numeric (no name lookups)"], ["-p", "show process (needs root for others')"], ["-s", "summary"]], ex: [["sudo ss -tulpn", "LISTEN 0.0.0.0:22 users:((\"sshd\",pid=801))"]], g: "Check the local address column: 127.0.0.1:3000 is not reachable from outside.", rel: ["netstat", "lsof -i"] },
      { c: "ping", d: "Tests reachability and round-trip time with ICMP.", i: "safe", o: [["-c 4", "stop after 4"], ["-i 0.2", "interval"], ["-s 1400", "packet size"]], ex: [["ping -c 3 8.8.8.8", "3 packets transmitted, 3 received, 0% packet loss"]], g: "Many networks block ICMP, so no reply does not always mean down.", rel: ["traceroute", "curl"] },
      { c: "curl", d: "Makes HTTP(S) requests and prints or saves the response.", i: "safe", o: [["-I", "headers only"], ["-v", "verbose (TLS, headers)"], ["-s -o /dev/null -w '%{http_code}'", "just the status"], ["-L", "follow redirects"], ["-X POST -d @file", "send data"], ["-H 'Authorization: ...'", "add a header"], ["-k", "skip TLS verification (insecure)"]], ex: [["curl -sI https://example.com", "HTTP/2 200 plus headers"]], g: "-k hides certificate problems; use it only to diagnose, never in production scripts.", rel: ["wget", "httpie"] },
      { c: "dig / nslookup / host", d: "Queries DNS.", i: "safe", o: [["dig +short example.com", "just the answer"], ["dig @8.8.8.8 example.com", "ask a specific server"], ["dig MX example.com", "record type"], ["dig -x 1.2.3.4", "reverse lookup"]], ex: [["dig +short api.example.com", "203.0.113.195"]], g: "Compare answers from your resolver and a public one to spot stale or poisoned DNS.", rel: ["resolvectl"] },
      { c: "wget", d: "Downloads files.", i: "changes", o: [["-O name", "output file"], ["-c", "resume"], ["-q", "quiet"], ["--spider", "check a URL exists"]], ex: [["wget -c https://host/file.iso", "resumable download"]], g: "Always verify downloads with a checksum.", rel: ["curl", "sha256sum"] },
      { c: "traceroute / mtr", d: "Shows the path packets take and where they slow or stop.", i: "safe", o: [["-n", "no name lookups"], ["mtr -rwc 10 host", "report mode"]], ex: [["traceroute -n 8.8.8.8", "hop-by-hop list"]], g: "Stars (*) can be filtered routers, not necessarily failures.", rel: ["ping"] },
      { c: "nc (netcat)", d: "Opens raw TCP/UDP connections; tests ports.", i: "safe", o: [["-zv host 443", "is the port open"], ["-l -p 9000", "listen on a port"]], ex: [["nc -zv db.internal 5432", "Connection to db.internal 5432 port [tcp/postgresql] succeeded!"]], g: "Quickest way to prove whether a firewall blocks a port.", rel: ["telnet", "ss"] },
      { c: "tcpdump", d: "Captures and prints network packets.", i: "system", r: true, o: [["-i eth0", "interface"], ["port 443", "filter"], ["host 1.2.3.4", "filter by host"], ["-w file.pcap", "save for Wireshark"], ["-nn", "no name/port resolution"]], ex: [["sudo tcpdump -i eth0 -nn port 53", "live DNS traffic"]], g: "Captures can contain sensitive data; handle files carefully and filter narrowly.", rel: ["wireshark"] },
      { c: "hostname / /etc/hosts / resolv.conf", d: "Local name resolution files.", i: "changes", r: true, o: [["/etc/hosts", "static name → IP"], ["/etc/resolv.conf", "DNS servers (often managed)"], ["resolvectl status", "systemd-resolved view"]], ex: [["cat /etc/hosts", "127.0.0.1 localhost"]], g: "A stale /etc/hosts entry beats DNS and produces baffling 'wrong server' bugs.", rel: ["dig"] }
    ]
  },
  {
    id: "storage_disks", name: "Disks, filesystems and swap", topic: "storage_disks",
    summary: "Seeing space, partitioning, formatting, mounting and swap.",
    k: [
      ["Order of operations for a new disk", "Partition → make a filesystem → create a mount point → mount → add to /etc/fstab. Check with lsblk first: formatting the wrong device is unrecoverable."],
      ["Two ways to run out", "Free bytes (df -h) and free inodes (df -i). Millions of tiny files exhaust inodes while space looks fine."],
      ["fstab", "Lists what mounts at boot: device (prefer UUID=), mount point, type, options, dump, fsck order. A typo can stop boot: test with mount -a."],
      ["Deleted but open", "Removing a big file that a process still holds open does not free space until the process closes it (lsof +L1)."],
      ["Never fsck a mounted filesystem", "Unmount it first (or boot into rescue mode)."]
    ],
    cmds: [
      { c: "df", d: "Shows free and used space per mounted filesystem.", i: "safe", o: [["-h", "human-readable"], ["-i", "inodes"], ["-T", "filesystem type"], ["-x tmpfs", "exclude a type"]], ex: [["df -h /", "/dev/root 29G 28G 1.2G 96% /"]], g: "Above ~90% many things slow down or fail; check inodes too.", rel: ["du", "lsblk"] },
      { c: "du", d: "Shows how much space files and directories use.", i: "safe", o: [["-sh DIR", "total of one directory"], ["-h --max-depth=1", "one level down"], ["-x", "stay on one filesystem"], ["| sort -h", "sorted by size"]], ex: [["sudo du -xh --max-depth=1 /var | sort -h | tail", "biggest folders under /var"]], g: "du counts files; df counts the filesystem. They differ when deleted files are held open.", rel: ["ncdu", "find -size"] },
      { c: "lsblk", d: "Lists block devices: disks, partitions, sizes, mount points.", i: "safe", o: [["-f", "filesystem, label, UUID"], ["-o NAME,SIZE,TYPE,MOUNTPOINT", "choose columns"]], ex: [["lsblk -f", "xvdb ext4 data 7b3f... (mounted at /data)"]], g: "An empty FSTYPE column means no filesystem yet.", rel: ["blkid", "fdisk -l"] },
      { c: "blkid", d: "Prints the UUID, label and filesystem type of block devices.", i: "safe", r: true, o: [["/dev/sdb1", "one device"]], ex: [["sudo blkid /dev/xvdc1", "/dev/xvdc1: UUID=\"3f2c...\" TYPE=\"ext4\""]], g: "Use UUIDs in fstab because device names can change between boots.", rel: ["lsblk -f"] },
      { c: "fdisk / parted", d: "Create and inspect partition tables.", i: "danger", r: true, o: [["fdisk -l", "list partition tables"], ["parted -s /dev/X mklabel gpt", "new GPT table (wipes!)"], ["mkpart primary ext4 0% 100%", "one partition using the whole disk"]], ex: [["sudo parted -s /dev/xvdc mklabel gpt mkpart primary ext4 0% 100%", "partition /dev/xvdc1 appears"]], g: "mklabel erases the existing partition table. Double-check the device name.", rel: ["lsblk", "partprobe"] },
      { c: "mkfs", d: "Creates a filesystem on a partition.", i: "danger", r: true, o: [["mkfs.ext4 DEV", "ext4"], ["mkfs.xfs DEV", "XFS"], ["-L name", "label"]], ex: [["sudo mkfs.ext4 /dev/xvdc1", "Creating filesystem ... Writing superblocks ... done"]], g: "Everything on the device is lost. It refuses on a mounted device, so unmount first.", rel: ["blkid"] },
      { c: "mount / umount", d: "Attach or detach a filesystem.", i: "system", r: true, o: [["mount DEV DIR", "attach"], ["mount -a", "everything in fstab"], ["-o remount,rw /", "change options of a mounted fs"], ["umount DIR", "detach (note: umount, not unmount)"], ["mount", "list mounts"]], ex: [["sudo mount /dev/xvdc1 /mnt/data", "no output; df shows it"]], g: "umount fails with 'target is busy' if your shell or a process is inside it (cd away, check lsof).", rel: ["findmnt", "fstab"] },
      { c: "findmnt", d: "Shows mounts as a tree and checks whether a path is a mount point.", i: "safe", o: [["findmnt /data", "is /data mounted"], ["--verify", "check fstab"]], ex: [["findmnt /data", "TARGET SOURCE FSTYPE OPTIONS"]], g: "No output means /data is just a folder on the root filesystem.", rel: ["mount"] },
      { c: "/etc/fstab", d: "The boot-time mount table.", i: "system", r: true, o: [["UUID=... /data ext4 defaults,nofail 0 2", "typical line"], ["nofail", "do not block boot if missing"]], ex: [["echo 'UUID=... /data ext4 defaults 0 2' | sudo tee -a /etc/fstab", "persistent mount"]], g: "Always run sudo mount -a before rebooting to catch typos.", rel: ["mount -a"] },
      { c: "fsck", d: "Checks and repairs a filesystem.", i: "danger", r: true, o: [["-n", "check only"], ["-y", "answer yes to every repair"], ["-f", "force"]], ex: [["sudo fsck -n /dev/xvdc1", "clean, 11/3276800 files"]], g: "Never on a mounted filesystem; back up first for important data.", rel: ["e2fsck"] },
      { c: "swap: fallocate, mkswap, swapon", d: "Create and enable a swap file.", i: "system", r: true, o: [["fallocate -l 1G /swapfile", "reserve space"], ["chmod 600 /swapfile", "protect it"], ["mkswap /swapfile", "format"], ["swapon /swapfile", "enable"], ["swapon --show", "active swap"], ["swapoff", "disable"]], ex: [["swapon --show", "NAME /swapfile TYPE file SIZE 1G"]], g: "Add '/swapfile none swap sw 0 0' to fstab to keep it after reboot. Swap buys time; it does not fix a leak.", rel: ["free"] },
      { c: "growpart / resize2fs", d: "Grow a partition and its filesystem after a bigger disk is attached.", i: "system", r: true, o: [["growpart /dev/xvda 1", "extend partition 1"], ["resize2fs /dev/xvda1", "grow ext4 online"], ["xfs_growfs /", "grow XFS"]], ex: [["sudo growpart /dev/xvda 1 && sudo resize2fs /dev/xvda1", "root filesystem now uses the whole disk"]], g: "Partition first, filesystem second.", rel: ["lsblk"] }
    ]
  },
  {
    id: "ssh_remote", name: "SSH", topic: "ssh_remote",
    summary: "Secure remote shells, keys and tunnels.",
    k: [
      ["Key pairs", "The private key stays on your machine (permission 600). The public key goes into ~/.ssh/authorized_keys on the server."],
      ["Host keys and known_hosts", "The first connection stores the server's fingerprint in ~/.ssh/known_hosts. A changed key triggers a warning because it may mean a different (or malicious) server."],
      ["Permissions are enforced", "~/.ssh must be 700 and authorized_keys 600, or the server ignores the keys."],
      ["Debug with -v", "ssh -vvv shows each stage: connect, key exchange, host key, authentication, session."],
      ["Hardening", "Disable root login and password authentication, restrict users, and test the config (sshd -t) before reloading. Keep one session open."]
    ],
    cmds: [
      { c: "ssh", d: "Opens a secure shell on another machine, or runs one command there.", i: "safe", o: [["ssh user@host", "log in"], ["-p 2222", "custom port"], ["-i KEY", "choose a key"], ["-v", "debug"], ["ssh host 'cmd'", "run one command"], ["-J jump", "via a bastion"]], ex: [["ssh -i ~/.ssh/id_ed25519 ubuntu@192.168.1.50", "logs in; prompt changes"]], g: "'Permission denied (publickey)' usually means the wrong key, user, or permissions on ~/.ssh.", rel: ["ssh-keygen", "scp"] },
      { c: "ssh-keygen", d: "Creates (or manages) key pairs.", i: "changes", o: [["-t ed25519", "modern key type"], ["-C 'comment'", "label"], ["-f FILE", "output path"], ["-R host", "remove a host from known_hosts"], ["-lf FILE", "show a fingerprint"]], ex: [["ssh-keygen -t ed25519 -C 'me@laptop'", "creates ~/.ssh/id_ed25519 and .pub"]], g: "Set a passphrase; an unprotected private key is a skeleton key.", rel: ["ssh-copy-id", "ssh-agent"] },
      { c: "ssh-copy-id", d: "Installs your public key on a server.", i: "changes", o: [["-i key.pub", "which key"], ["-p port", "port"]], ex: [["ssh-copy-id ubuntu@192.168.1.50", "Number of key(s) added: 1"]], g: "Never copy the private key. Afterwards test the key login in a new terminal.", rel: ["authorized_keys"] },
      { c: "ssh-agent / ssh-add", d: "Holds decrypted keys in memory so you type the passphrase once.", i: "safe", o: [["eval \"$(ssh-agent)\"", "start the agent"], ["ssh-add KEY", "load a key"], ["ssh-add -l", "list loaded keys"], ["ssh -A", "forward the agent (risky)"]], ex: [["ssh-add -l", "256 SHA256:... me@laptop (ED25519)"]], g: "Agent forwarding to untrusted hosts lets them use your keys while you are connected.", rel: ["ssh-keygen"] },
      { c: "~/.ssh/config", d: "Per-host shortcuts and defaults.", i: "changes", o: [["Host web", "alias"], ["HostName / User / Port / IdentityFile", "connection details"], ["ProxyJump bastion", "go through a jump host"]], ex: [["ssh web", "uses the matching Host block"]], g: "Keep it at 600 permissions.", rel: ["ssh"] },
      { c: "ssh tunnels (-L / -R / -D)", d: "Forward ports over SSH.", i: "system", o: [["-L 8080:localhost:80 host", "local port 8080 reaches the server's port 80"], ["-R 9000:localhost:3000 host", "expose your local port on the server"], ["-D 1080 host", "SOCKS proxy"], ["-N", "no shell, tunnel only"]], ex: [["ssh -N -L 5433:db.internal:5432 bastion", "psql -p 5433 now reaches the private database"]], g: "Tunnels bypass firewalls on purpose; know who has them.", rel: ["autossh"] },
      { c: "sshd_config", d: "The server's configuration (/etc/ssh/sshd_config).", i: "system", r: true, o: [["PermitRootLogin no", "block root"], ["PasswordAuthentication no", "keys only"], ["AllowUsers alice bob", "restrict users"], ["Port 2222", "change port"], ["sshd -t", "test the config"], ["systemctl reload ssh", "apply"]], ex: [["sudo sshd -t && sudo systemctl reload ssh", "only reloads if the syntax is valid"]], g: "Test and keep a second session open; a mistake can lock you out.", rel: ["ufw"] },
      { c: "known_hosts warning", d: "'REMOTE HOST IDENTIFICATION HAS CHANGED'.", i: "safe", o: [["ssh-keygen -R host", "remove the old entry after verifying"]], ex: [["ssh-keygen -R 192.168.1.50", "Host 192.168.1.50 found: line 3 ... updated"]], g: "Verify why it changed (rebuild or attack) before removing the entry.", rel: ["ssh"] }
    ]
  },
  {
    id: "file_transfer", name: "Copying files between machines", topic: "file_transfer",
    summary: "scp, rsync, sftp and friends.",
    k: [
      ["Pick by need", "scp for a quick copy; rsync for repeated or large syncs (only differences, resumable); sftp for interactive sessions."],
      ["Trailing slash in rsync", "rsync -a src/ dest/ copies the contents of src; rsync -a src dest/ copies the folder itself into dest."],
      ["Verify", "Compare checksums (sha256sum) for important transfers."]
    ],
    cmds: [
      { c: "scp", d: "Copies files over SSH.", i: "changes", o: [["-r", "directories"], ["-P 2222", "port (capital P)"], ["-i KEY", "key"], ["-C", "compress"]], ex: [["scp -r build/ ubuntu@host:/var/www/", "copies the folder to the server"], ["scp ubuntu@host:/var/log/app.log .", "downloads a file"]], g: "scp uses -P for the port but ssh uses -p. It overwrites silently.", rel: ["rsync", "sftp"] },
      { c: "rsync", d: "Efficient synchronisation of files and directories.", i: "changes", o: [["-a", "archive: recursive, keep permissions, times, links"], ["-v", "verbose"], ["-z", "compress in transit"], ["--delete", "remove files missing at the source"], ["-n", "dry run"], ["--partial --progress", "resume with progress"], ["-e 'ssh -p 2222'", "custom SSH"]], ex: [["rsync -avz --partial -e ssh ./site/ user@host:/var/www/site/", "only changed files are sent"]], g: "--delete can remove data at the destination: always dry-run (-n) first.", rel: ["scp"] },
      { c: "sftp", d: "Interactive secure file transfer.", i: "changes", o: [["get / put", "download / upload"], ["ls / cd / lcd", "remote and local navigation"], ["bye", "quit"]], ex: [["sftp user@host", "sftp> prompt"]], g: "Handy for browsing; scripts usually prefer rsync or scp.", rel: ["scp"] },
      { c: "curl -O / wget", d: "Download from URLs.", i: "changes", o: [["curl -O URL", "keep the remote name"], ["curl -o name URL", "choose a name"], ["wget URL", "download"]], ex: [["curl -fLO https://host/file.tgz", "-f fail on HTTP errors, -L follow redirects"]], g: "Pipe-to-shell installers (curl | sh) run unreviewed code; download and read first.", rel: ["sha256sum"] },
      { c: "tar over ssh", d: "Stream a directory through SSH without a temp archive.", i: "changes", o: [["tar czf - dir | ssh host 'tar xzf - -C /dest'", "pack, send and unpack in one go"]], ex: [["tar czf - project | ssh host 'tar xzf - -C /backup'", "project copied"]], g: "Good when rsync is not installed on the other side.", rel: ["rsync"] },
      { c: "sha256sum", d: "Checksum to verify a transfer.", i: "safe", o: [["-c FILE", "verify against a list"]], ex: [["sha256sum -c SHA256SUMS", "file.tgz: OK"]], g: "FAILED means the content changed or was corrupted.", rel: ["md5sum"] }
    ]
  },
  {
    id: "vim_editor", name: "Vim", topic: "vim_editor",
    summary: "Modal editing: normal mode for commands, insert mode for typing.",
    k: [
      ["Modes", "Normal (commands; the default), Insert (typing), Visual (selecting), Command-line (: commands). Esc returns to normal mode."],
      ["Grammar", "Verb + object: d (delete) + w (word) = dw. Counts multiply: 3dd deletes three lines."],
      ["Escape hatch", "Esc Esc then :q! quits without saving."],
      ["Settings", "Put options like set number in ~/.vimrc to keep them."]
    ],
    cmds: [
      { c: "vim FILE", d: "Opens a file.", i: "safe", o: [["+N", "open at line N"], ["-R / view", "read-only"], ["-O a b", "two files side by side"]], ex: [["vim +42 app.py", "opens at line 42"]], g: "Opening a root-owned file as a normal user shows E212 on save; reopen with sudo or use sudoedit.", rel: ["nano", "vimtutor"] },
      { c: "i, a, o, I, A, O", d: "Enter insert mode in different places.", i: "changes", o: [["i", "before the cursor"], ["a", "after the cursor"], ["I / A", "line start / end"], ["o / O", "new line below / above"], ["Esc", "back to normal"]], ex: [["Go# end<Esc>", "go to last line, open a line, type, leave"]], g: "Letters do nothing like typing until you enter insert mode.", rel: ["r", "s"] },
      { c: "h j k l, w b, 0 $, gg G", d: "Moving in normal mode.", i: "safe", o: [["h j k l", "left, down, up, right"], ["w / b", "next / previous word"], ["0 / $", "line start / end"], ["gg / G", "first / last line"], ["5G or :5", "go to line 5"], ["Ctrl-F / Ctrl-B", "page down / up"]], ex: [[":120", "jump to line 120"]], g: "Arrow keys work but the home-row keys are faster.", rel: ["/"] },
      { c: "x, dd, dw, D, cw, r, J, u", d: "Editing commands.", i: "changes", o: [["x", "delete character"], ["dd", "delete (cut) line"], ["dw / D", "delete word / to end of line"], ["cw / cc", "change word / line"], ["r", "replace one character"], ["J", "join lines"], ["u / Ctrl-R", "undo / redo"], ["~", "toggle case"]], ex: [["3dd", "delete three lines"]], g: "dd also copies the line to a register, so p pastes it.", rel: ["yy", "p"] },
      { c: "yy, p, P, V", d: "Copy, paste and visual selection.", i: "changes", o: [["yy / 3yy", "copy lines"], ["p / P", "paste after / before"], ["V", "select whole lines"], ["v", "select characters"], ["d / y / > in visual", "act on the selection"]], ex: [["Vjjd", "select three lines and delete them"]], g: "Everything you delete or copy goes to the same register unless you name another.", rel: ["dd"] },
      { c: "/ ? n N", d: "Search.", i: "safe", o: [["/text", "search forward"], ["?text", "search backward"], ["n / N", "next / previous"], ["*", "search the word under the cursor"], [":noh", "clear highlighting"]], ex: [["/PermitRoot<Enter>", "jumps to the first match"]], g: "Search is a regex; escape special characters.", rel: [":s"] },
      { c: ":%s/old/new/g", d: "Find and replace.", i: "changes", o: [[":s/a/b/", "current line, first match"], [":%s/a/b/g", "whole file, all matches"], [":%s/a/b/gc", "ask for each"], [":5,10s/a/b/g", "line range"], [":g/^#/d", "delete all matching lines"]], ex: [[":%s/staging/production/g", "N substitutions on M lines"]], g: "Use a different delimiter for paths: :%s#/old#/new#g.", rel: ["sed"] },
      { c: ":w :q :wq :q! ZZ", d: "Save and quit.", i: "changes", o: [[":w", "save"], [":q", "quit (refuses if unsaved)"], [":wq or ZZ", "save and quit"], [":q! or ZQ", "quit without saving"], [":w newname", "save as"], [":x", "save only if changed, then quit"]], ex: [[":wq", "\"app.conf\" 12L, 230B written"]], g: "E37: No write since last change means you need ! to force or :w first.", rel: [":e!"] },
      { c: ":set options", d: "Change settings for this session.", i: "safe", o: [[":set number", "line numbers"], [":set ignorecase", "case-insensitive search"], [":set paste", "paste without auto-indent"], [":set tabstop=4", "tab width"]], ex: [[":set nu", "line numbers appear"]], g: "Put them in ~/.vimrc to make them permanent.", rel: ["~/.vimrc"] }
    ]
  },
  {
    id: "nano_editor", name: "Nano", topic: "nano_editor",
    summary: "A modeless editor: just type, and use Ctrl shortcuts for actions.",
    k: [
      ["Shortcuts are on screen", "^ means Ctrl. The bottom two lines always list the main commands (^O Write Out, ^X Exit, ^K Cut, ^U Paste, ^W Where Is)."],
      ["Exiting with changes", "Ctrl-X asks 'Save modified buffer?': Y saves (then confirm the name), N discards, Ctrl-C cancels."],
      ["Terminal conflicts", "Some terminals use Ctrl-S and Ctrl-Q for flow control; if the screen seems frozen, press Ctrl-Q."]
    ],
    cmds: [
      { c: "nano FILE", d: "Opens (or creates) a file.", i: "safe", o: [["+N", "open at line N"], ["-l", "show line numbers"], ["-B", "make a backup (~)"]], ex: [["sudo nano /etc/hosts", "opens a root-owned file for editing"]], g: "Use sudo for root files; nano warns 'Error writing' otherwise.", rel: ["vim"] },
      { c: "Ctrl-O  (Write Out)", d: "Saves the file.", i: "changes", o: [["Enter", "confirm the file name"], ["Ctrl-C", "cancel"]], ex: [["Ctrl-O then Enter", "[ Wrote 12 lines ]"]], g: "Ctrl-O only saves; it does not exit.", rel: ["Ctrl-X"] },
      { c: "Ctrl-X  (Exit)", d: "Leaves nano.", i: "changes", o: [["Y", "save and exit (then Enter)"], ["N", "discard and exit"], ["Ctrl-C", "stay"]], ex: [["Ctrl-X, Y, Enter", "saves and exits in three keys"]], g: "With unsaved changes you will be asked; pressing N loses them.", rel: ["Ctrl-O"] },
      { c: "Ctrl-K / Ctrl-U", d: "Cut the current line and paste it.", i: "changes", o: [["Ctrl-K", "cut line (repeat to cut more)"], ["Ctrl-U", "paste above the cursor"], ["Alt-6", "copy a line"]], ex: [["Ctrl-K, move, Ctrl-U", "moves a line"]], g: "Ctrl-U pastes ABOVE the cursor line.", rel: ["Ctrl-K"] },
      { c: "Ctrl-W / Alt-W", d: "Search and repeat the search.", i: "safe", o: [["Ctrl-W text Enter", "find"], ["Alt-W", "find next"], ["Ctrl-\\", "search and replace"]], ex: [["Ctrl-W port= Enter", "cursor jumps to the match"]], g: "Some terminals reserve Ctrl-W; use the on-screen button where needed.", rel: ["Ctrl-_"] },
      { c: "Ctrl-_  /  Alt-G", d: "Go to a line number.", i: "safe", o: [["Ctrl-_ then 12 Enter", "line 12"], ["Ctrl-C", "show the current position"]], ex: [["Ctrl-_ 3 Enter", "cursor on line 3"]], g: "Shown as ^/ at the bottom on some versions.", rel: ["Ctrl-W"] },
      { c: "crontab -e / visudo", d: "Editors that open nano or vim by default.", i: "system", o: [["EDITOR=nano", "choose the editor"], ["sudo select-editor", "pick a default (Debian)"]], ex: [["EDITOR=nano crontab -e", "edit your crontab in nano"]], g: "visudo checks syntax before saving; a plain editor on sudoers does not.", rel: ["crontab", "visudo"] }
    ]
  },
  {
    id: "packages", name: "Package management", topic: "packages",
    summary: "Installing, updating and removing software.",
    k: [
      ["Refresh the index first", "apt update only downloads the list of available packages; apt upgrade installs newer versions. 'Unable to locate package' usually means a stale index."],
      ["remove vs purge", "remove keeps configuration files so a reinstall restores settings; purge deletes them too. autoremove deletes dependencies nothing needs."],
      ["Families", "Debian/Ubuntu: apt, dpkg (.deb). RHEL/Rocky/Fedora: dnf/yum, rpm (.rpm). Alpine: apk. Arch: pacman."],
      ["Needs root", "Installing changes the system, so use sudo; 'Permission denied' on the dpkg lock means 'use sudo', not 'chmod the lock'."],
      ["Trust", "Prefer official repositories; verify third-party keys and avoid curl | sudo sh."]
    ],
    cmds: [
      { c: "apt update", d: "Refreshes the list of available packages.", i: "system", r: true, o: [["apt update", "refresh"], ["apt list --upgradable", "what has a newer version"]], ex: [["sudo apt update", "Fetched 1,236 kB ... 12 packages can be upgraded"]], g: "It installs nothing. Run it before install, especially on fresh servers.", rel: ["apt upgrade"] },
      { c: "apt install", d: "Installs packages and their dependencies.", i: "system", r: true, o: [["-y", "assume yes"], ["--no-install-recommends", "skip optional packages"], ["pkg=version", "pin a version"], ["-s", "simulate"]], ex: [["sudo apt install -y nginx", "The following NEW packages will be installed: nginx nginx-common"]], g: "On Debian/Ubuntu a service package often starts and enables itself right away.", rel: ["dpkg -l"] },
      { c: "apt upgrade / full-upgrade", d: "Installs newer versions of installed packages.", i: "system", r: true, o: [["upgrade", "never removes packages"], ["full-upgrade", "may remove/replace to complete"]], ex: [["sudo apt upgrade -y", "N upgraded, 0 newly installed"]], g: "Kernel and libc upgrades may need a reboot (check /var/run/reboot-required).", rel: ["apt update"] },
      { c: "apt remove / purge / autoremove", d: "Uninstall software.", i: "danger", r: true, o: [["remove", "keep config files"], ["purge", "delete config too"], ["autoremove", "drop unused dependencies"]], ex: [["sudo apt purge -y nginx", "Purging configuration files for nginx"]], g: "Purge deletes /etc settings; it never touches your data directories.", rel: ["dpkg -L"] },
      { c: "apt search / show / list", d: "Find and inspect packages.", i: "safe", o: [["search term", "match names and descriptions"], ["show pkg", "version, dependencies, description"], ["list --installed", "what is installed"], ["apt-cache policy pkg", "which version would install"]], ex: [["apt show nginx", "Package: nginx · Version: 1.18.0 · Depends: nginx-common"]], g: "apt is for people; apt-get/apt-cache are the stable script interfaces.", rel: ["apt-cache"] },
      { c: "dpkg", d: "Low-level Debian package tool (no downloading).", i: "system", o: [["-l", "list installed"], ["-L pkg", "files a package installed"], ["-S /path", "which package owns a file"], ["-i file.deb", "install a local .deb"], ["-s pkg", "status"]], ex: [["dpkg -S /usr/sbin/nginx", "nginx: /usr/sbin/nginx"]], g: "dpkg -i does not fetch dependencies; use apt install ./file.deb instead.", rel: ["apt"] },
      { c: "dnf / yum", d: "Package manager for the Red Hat family.", i: "system", r: true, o: [["install -y", "install"], ["remove", "uninstall"], ["update", "upgrade"], ["search / info", "inspect"], ["makecache", "refresh metadata"], ["autoremove", "clean dependencies"]], ex: [["sudo dnf install -y httpd", "Installed: httpd ... Complete!"]], g: "dnf refreshes metadata by itself; yum is now an alias for dnf.", rel: ["rpm"] },
      { c: "rpm", d: "Low-level RPM tool.", i: "safe", o: [["-q pkg", "is it installed"], ["-qa", "list all"], ["-ql pkg", "files of a package"], ["-qf /path", "owner of a file"], ["-qi pkg", "details"]], ex: [["rpm -q httpd", "httpd-2.4.57-1.el9.x86_64"]], g: "Querying is safe; -i/-e install and erase bypass dependency solving.", rel: ["dnf"] },
      { c: "apk", d: "Alpine's package manager (containers).", i: "system", o: [["apk update", "refresh index"], ["apk add pkg", "install"], ["apk del pkg", "remove"], ["add --no-cache pkg", "no index kept (Dockerfiles)"], ["apk info", "list installed"]], ex: [["apk add --no-cache curl", "(1/1) Installing curl"]], g: "Alpine uses musl libc, so some glibc binaries will not run.", rel: ["apt"] }
    ]
  }
);

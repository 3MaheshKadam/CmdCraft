/**
 * Troubleshooting playbooks: what to run, in order, and what the output means.
 * Playbook: { id, title, symptom, steps:[{ do, cmd, see }], fix:[...], pitfalls:[...] }
 */
window.LINUX_PLAYBOOKS = [
  {
    id: "disk-full", title: "Disk is full", symptom: "'No space left on device', services crash, writes fail.",
    steps: [
      { do: "Confirm which filesystem is full", cmd: "df -h", see: "A filesystem at 100% (or the one holding /var or /)." },
      { do: "Check inodes too", cmd: "df -i", see: "IUse% at 100% means millions of tiny files, not big ones." },
      { do: "Find the big directories", cmd: "sudo du -xh --max-depth=1 / | sort -h | tail", see: "Repeat inside the largest directory (/var, /home, /opt)." },
      { do: "Find the big files", cmd: "sudo find / -xdev -type f -size +500M 2>/dev/null", see: "Runaway logs, core dumps, old backups." },
      { do: "Check for deleted-but-open files", cmd: "sudo lsof +L1", see: "A process holding a deleted log keeps its space until restarted." },
      { do: "Look at the journal and package cache", cmd: "journalctl --disk-usage; sudo apt clean", see: "Journal size and apt's cached .deb files." }
    ],
    fix: ["Empty a live log without deleting it: truncate -s 0 /var/log/app.log", "Compress or remove old archives after confirming backups", "Restart the process holding a deleted file", "Add a logrotate rule so it cannot recur", "Grow the volume if the data is legitimate (growpart, resize2fs)"],
    pitfalls: ["rm on a file a process has open does not free space", "du and df disagree when deleted files are held open", "Do not delete inside /var/lib/dpkg or database directories"]
  },
  {
    id: "service-down", title: "A service will not start or keeps failing", symptom: "systemctl shows failed, the site is down.",
    steps: [
      { do: "See the state and the last lines", cmd: "systemctl status myapp -l", see: "Active: failed plus the final error lines." },
      { do: "Read the full log", cmd: "journalctl -u myapp -n 100 --no-pager", see: "The first error is usually the cause, not the last." },
      { do: "Validate the config before restarting", cmd: "nginx -t   (or sshd -t, apachectl configtest)", see: "A syntax error with file and line number." },
      { do: "Check the port is free", cmd: "sudo ss -tulpn | grep :3000", see: "Another process already bound to the port." },
      { do: "Check the unit file", cmd: "systemctl cat myapp; systemd-analyze verify myapp.service", see: "Wrong ExecStart path, missing User, bad syntax." },
      { do: "Check permissions and resources", cmd: "ls -l /path/to/app; df -h; free -h", see: "Not executable, disk full, out of memory." }
    ],
    fix: ["Fix the config and run the validator again", "After editing a unit: systemctl daemon-reload then restart", "Free the port or change the listen port", "Fix ownership/permissions for the service user"],
    pitfalls: ["Forgetting daemon-reload after changing a unit file", "Restarting repeatedly hides the first error", "Environment variables from your shell are NOT available to a service"]
  },
  {
    id: "ssh-fail", title: "Cannot SSH into a server", symptom: "Connection refused, timed out, or Permission denied.",
    steps: [
      { do: "Is the host reachable?", cmd: "ping -c 3 HOST", see: "Replies, or none (ICMP may be blocked)." },
      { do: "Is port 22 open?", cmd: "nc -zv HOST 22", see: "succeeded = open; refused = nothing listening; timeout = firewall." },
      { do: "Run SSH verbosely", cmd: "ssh -vvv user@HOST", see: "Which stage fails: connect, key exchange, host key, authentication." },
      { do: "Check the key and its permissions", cmd: "ls -l ~/.ssh; chmod 600 ~/.ssh/id_ed25519", see: "A private key readable by others is ignored." },
      { do: "On the server (console): daemon and config", cmd: "systemctl status ssh; sudo sshd -t; sudo tail /var/log/auth.log", see: "Service down, config error, or the reason a login was rejected." },
      { do: "Check the firewall / security group", cmd: "sudo ufw status; (cloud console) inbound rules", see: "22/tcp must be allowed from your IP." }
    ],
    fix: ["Start sshd or fix the config error (sshd -t)", "Allow 22/tcp in ufw and the cloud security group", "Fix ~/.ssh (700) and authorized_keys (600) ownership and modes", "Use the correct user and key (-i)"],
    pitfalls: ["Changing sshd_config without keeping a second session open", "'Host key changed' needs verification before ssh-keygen -R", "Home directory writable by group/others breaks key auth"]
  },
  {
    id: "slow-server", title: "Server is slow or load is high", symptom: "Timeouts, laggy commands, load average above the CPU count.",
    steps: [
      { do: "Look at load vs CPU count", cmd: "uptime; nproc", see: "Load above the core count means queueing." },
      { do: "Find out what is busy", cmd: "top -b -n 1 | head -15", see: "A hot process, or CPU idle with high wa (I/O wait)." },
      { do: "If iowait is high, check the disks", cmd: "iostat -x 1 3", see: "A device near 100 %util with high await." },
      { do: "Check memory and swap", cmd: "free -h; vmstat 1 5", see: "Low available memory and si/so activity = memory pressure." },
      { do: "Find the heaviest processes", cmd: "ps aux --sort=-%cpu | head; ps aux --sort=-%mem | head", see: "The process to investigate." },
      { do: "Check for kills and errors", cmd: "dmesg -T | tail -30; journalctl -p err -n 50", see: "OOM kills, disk or hardware errors." }
    ],
    fix: ["Restart or fix the runaway process (kill PID after checking what it is)", "Add memory/swap or fix a leak", "Move heavy I/O off the busy disk, add caching", "Scale out if the load is legitimate"],
    pitfalls: ["High load with idle CPU is I/O, not CPU", "%CPU in top is per core", "Killing before understanding often brings it right back"]
  },
  {
    id: "oom", title: "A process disappeared (out of memory)", symptom: "A service vanished with no error of its own.",
    steps: [
      { do: "Search the kernel log", cmd: "dmesg -T | grep -i 'killed process'", see: "'Out of memory: Killed process PID (name)'." },
      { do: "Check memory and swap now", cmd: "free -h; swapon --show", see: "No swap and little available memory." },
      { do: "Find the biggest consumers", cmd: "ps aux --sort=-%mem | head", see: "A leaking or oversized process." },
      { do: "Check cgroup/service limits", cmd: "systemctl show myapp -p MemoryMax", see: "A configured limit that is too low." }
    ],
    fix: ["Fix the leak or reduce the process's memory use", "Add swap as a stopgap (fallocate, chmod 600, mkswap, swapon)", "Set MemoryMax so one service cannot take the machine down", "Add RAM or move the workload"],
    pitfalls: ["Swap hides a leak; it does not fix it", "The OOM killer picks the biggest memory user, not the culprit"]
  },
  {
    id: "site-unreachable", title: "Site works locally but not from outside", symptom: "curl localhost works, external users time out or get refused.",
    steps: [
      { do: "Is it listening, and on which address?", cmd: "sudo ss -tulpn | grep -E ':80|:443'", see: "127.0.0.1 only = not reachable externally; 0.0.0.0 or :: = all interfaces." },
      { do: "Test from the server itself via its public/private IP", cmd: "curl -sI http://SERVER_IP", see: "Works locally by IP means the app is fine." },
      { do: "Check the host firewall", cmd: "sudo ufw status verbose  /  sudo firewall-cmd --list-all", see: "Missing allow for 80/443." },
      { do: "Check the cloud firewall", cmd: "(cloud console) security group / network ACL", see: "Inbound rule for the port from the right source." },
      { do: "Check DNS", cmd: "dig +short example.com", see: "Does the name point at this server?" },
      { do: "Trace from outside", cmd: "curl -v https://example.com; traceroute -n SERVER_IP", see: "Where it stops: DNS, TCP connect, TLS, HTTP." }
    ],
    fix: ["Bind to 0.0.0.0 (or the public interface)", "Allow the port in ufw/firewalld and the cloud security group", "Fix the DNS record or wait for TTL"],
    pitfalls: ["Testing only with localhost proves nothing about the firewall", "ping working does not mean the TCP port is open"]
  },
  {
    id: "permission-denied", title: "Permission denied", symptom: "A command or service cannot read, write or run a file.",
    steps: [
      { do: "Look at the file", cmd: "ls -l /path/file", see: "Owner, group and mode versus who is running the command." },
      { do: "Look at every directory on the path", cmd: "namei -l /path/to/file", see: "A directory missing x for your user blocks everything below." },
      { do: "Who is the caller?", cmd: "id; ps -o user,cmd -p PID", see: "The service may run as a different user (www-data, postgres)." },
      { do: "Check for ACLs and attributes", cmd: "getfacl file; lsattr file", see: "An ACL or an immutable flag (+i)." },
      { do: "Check SELinux/AppArmor", cmd: "getenforce; sudo ausearch -m avc -ts recent", see: "A denial even when the Unix permissions look right (RHEL)." },
      { do: "Is the filesystem read-only?", cmd: "findmnt -no OPTIONS /path", see: "'ro' in the options." }
    ],
    fix: ["chown to the right owner/group, chmod the minimum needed", "Add x to the directories on the path", "Run the service as the intended user", "Remount rw only after you know why it went read-only"],
    pitfalls: ["chmod -R 777 'fixes' it and creates a security hole", "Group changes need a new login to take effect"]
  },
  {
    id: "cron-silent", title: "A cron job did not run (or fails silently)", symptom: "Nothing happened at the scheduled time.",
    steps: [
      { do: "Is cron running?", cmd: "systemctl status cron   (crond on RHEL)", see: "Active (running)." },
      { do: "Is the job installed under the right user?", cmd: "crontab -l; sudo crontab -u root -l; ls /etc/cron.d", see: "The line exists with five valid time fields." },
      { do: "Did cron try to run it?", cmd: "journalctl -u cron --since today | grep CMD", see: "A CMD line at the expected time." },
      { do: "Run the exact command as cron would", cmd: "env -i /bin/sh -c '/path/to/job.sh'", see: "Fails because of a minimal PATH or missing environment." },
      { do: "Capture output", cmd: "append >> /var/log/job.log 2>&1 to the line", see: "The real error message." }
    ],
    fix: ["Use absolute paths and set PATH in the crontab", "Make the script executable and fix its shebang", "Redirect output to a log", "Use flock to prevent overlapping runs"],
    pitfalls: ["% must be escaped as \\% in a crontab command", "Cron uses the server's time zone", "A cron.daily script with a dot in its name is skipped"]
  },
  {
    id: "dns-fail", title: "Names do not resolve", symptom: "ping IP works but ping name fails; curl cannot resolve host.",
    steps: [
      { do: "Does a raw IP work?", cmd: "ping -c 2 8.8.8.8", see: "Yes = network fine, DNS is the problem." },
      { do: "Ask DNS directly", cmd: "dig example.com; dig @8.8.8.8 example.com", see: "Compare your resolver with a public one." },
      { do: "Check resolver config", cmd: "cat /etc/resolv.conf; resolvectl status", see: "Empty or wrong nameserver." },
      { do: "Check the hosts file", cmd: "grep example.com /etc/hosts", see: "A stale static entry overriding DNS." },
      { do: "Check the name service order", cmd: "grep hosts /etc/nsswitch.conf", see: "files dns order." }
    ],
    fix: ["Fix the nameserver (netplan/NetworkManager, not by hand if managed)", "Remove stale /etc/hosts entries", "Restart systemd-resolved if it is wedged"],
    pitfalls: ["/etc/resolv.conf is often auto-generated: manual edits are overwritten", "Cached answers survive until TTL"]
  },
  {
    id: "port-in-use", title: "Port already in use", symptom: "'Address already in use' when starting a service.",
    steps: [
      { do: "Find the owner of the port", cmd: "sudo ss -tulpn | grep :8080", see: "Process name and PID listening." },
      { do: "Alternative", cmd: "sudo lsof -i :8080", see: "Same information with the command line." },
      { do: "Inspect the process", cmd: "ps -p PID -o pid,user,etime,cmd", see: "Is it a stale copy of your own app?" },
      { do: "Stop it cleanly", cmd: "sudo systemctl stop NAME   or   kill PID", see: "Port frees up." }
    ],
    fix: ["Stop the old instance, or change one service's port", "Check for a duplicate unit or a leftover manual run"],
    pitfalls: ["kill -9 should be a last resort", "TIME_WAIT sockets are normal and expire on their own"]
  },
  {
    id: "readonly-fs", title: "Filesystem became read-only", symptom: "'Read-only file system' errors, services crash writing files.",
    steps: [
      { do: "Confirm the mount options", cmd: "findmnt -no OPTIONS /", see: "ro,... instead of rw,..." },
      { do: "Find out why", cmd: "dmesg -T | grep -iE 'remount|I/O error|ext4'", see: "Disk errors or 'Remounting filesystem read-only'." },
      { do: "Check disk health", cmd: "sudo smartctl -H /dev/sda   (or cloud console)", see: "Failing disk or storage hiccup." },
      { do: "Remount read-write once the cause is handled", cmd: "sudo mount -o remount,rw /", see: "Options show rw again." },
      { do: "Schedule a filesystem check", cmd: "boot into rescue mode and run fsck on the unmounted device", see: "Repairs applied." }
    ],
    fix: ["Fix the underlying storage problem first", "Remount rw, then plan fsck", "Restore from backup if corruption is severe"],
    pitfalls: ["Remounting rw over failing hardware risks more corruption", "Never fsck a mounted filesystem"]
  },
  {
    id: "brute-force", title: "Under SSH brute-force attack", symptom: "Many failed logins in auth.log, high CPU from sshd.",
    steps: [
      { do: "Quantify and identify", cmd: "grep 'Failed password' /var/log/auth.log | awk '{print $11}' | sort | uniq -c | sort -rn | head", see: "Top source IPs and counts." },
      { do: "Check for successful logins from them", cmd: "grep 'Accepted' /var/log/auth.log | tail", see: "Any compromise indicators." },
      { do: "Block the worst offenders", cmd: "sudo ufw deny from IP", see: "Rule added." },
      { do: "Harden SSH", cmd: "sudo sed -i 's/^#\\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config && sudo sshd -t", see: "No output = valid; reload afterwards." },
      { do: "Automate banning", cmd: "sudo apt install fail2ban", see: "Repeated failures are banned automatically." }
    ],
    fix: ["Keys only, no root login, AllowUsers", "Restrict SSH to known IPs or a VPN", "Rotate any credential that might have leaked"],
    pitfalls: ["Blocking IPs one by one is endless without key-only auth", "Test the new SSH config in a second session before closing the first"]
  },
  {
    id: "package-fail", title: "Package install fails", symptom: "'Unable to locate package', lock errors, broken dependencies.",
    steps: [
      { do: "Refresh the index", cmd: "sudo apt update", see: "Hit/Get lines without errors." },
      { do: "Are you root?", cmd: "sudo apt install PKG", see: "'Permission denied' on the lock means missing sudo." },
      { do: "Check another process holds the lock", cmd: "ps aux | grep -E 'apt|dpkg'", see: "Unattended-upgrades running; wait for it." },
      { do: "Fix half-configured packages", cmd: "sudo dpkg --configure -a; sudo apt -f install", see: "Dependencies completed." },
      { do: "Check the repository is enabled", cmd: "apt-cache policy PKG; grep -r universe /etc/apt/", see: "A candidate version exists." }
    ],
    fix: ["Run apt update then install", "Use sudo", "Wait for or stop the competing apt process", "Enable the needed repository"],
    pitfalls: ["Never delete the dpkg lock files as a 'fix'", "Do not mix repositories from different releases"]
  }
];

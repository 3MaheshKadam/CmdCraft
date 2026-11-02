/**
 * More production-incident simulations (Module 28). Same engine as the drills, but framed as an outage: read the
 * symptoms, find the cause, apply the fix. Each is judged by the resulting system state.
 */
(function () {
  const out = sh => (sh.lastExec ? sh.lastExec.out : "");
  const f = F, T = Tree;
  const HOME = "/home/ubuntu";
  const file = (sh, p) => sh.lookup(sh.abs(p), true);
  const text = (sh, p) => { const n = file(sh, p); return n ? n.content : null; };
  let n = SYLLABUS_INCIDENTS.length;

  function INC(sev, title, desc, objective, cmd, parts, tip, opts) {
    opts = opts || {};
    const id = "INCIDENT-" + String(++n).padStart(2, "0");
    const main = cmd.split(" (or")[0].trim();
    const rx = new RegExp("^(sudo\\s+)?" + main.replace(/^sudo\s+/, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+") + "$");
    SYLLABUS_INCIDENTS.push({
      id, topic: "Full Syllabus: Incident Response", title: "🚨 " + title, difficulty: "Advanced (SEV-" + sev + ")", xp: sev === 1 ? 150 : 120,
      desc, objective, validCommands: [rx], hint: opts.hint || "Start from the symptom: which tool shows it?",
      explanation: { command: main, breakdown: parts.map(([part, d]) => ({ part, desc: d })), proTip: tip },
      simulatedOutput: "", initialFs: opts.fs || T(HOME)
    });
    const setup = {};
    ["viz", "focus", "files", "nodes", "system", "cwd", "enforce", "env", "keys"].forEach(k => { if (opts[k] !== undefined) setup[k] = opts[k]; });
    setup.goal = opts.goal;
    SCENARIO_SETUP[id] = setup;
  }

  const PF = (perf, extra) => Object.assign({ processes: [P(1, "root", 0.0, 0.4, "/sbin/init", "systemd"), P(801, "root", 0.0, 0.5, "/usr/sbin/sshd -D", "sshd"), P(4512, "ubuntu", 62.0, 18.5, "node /opt/app/server.js", "node"), P(4890, "postgres", 8.0, 12.2, "postgres: writer", "postgres")], perf }, extra || {});
  const DISKS = o => {
    o = o || {};
    const root = { name: "xvda", size: "30G", type: "disk", majmin: "202:0", label: "gpt", children: [{ name: "xvda1", size: "29.9G", type: "part", majmin: "202:1", fstype: "ext4", fsver: "1.0", label: "root", uuid: "e81c0022-d78e-4a64-9b24-f7253457e512", avail: "1.2G", use: "96%", mount: "/" }] };
    return { disks: { devices: [root], mounts: [{ target: "/", source: "/dev/xvda1", fstype: "ext4", options: o.rootOpts || "rw,relatime" }], filesystems: [{ fs: "/dev/root", size: "29G", used: "28G", avail: "1.2G", pct: 96, mount: "/", inodes: [1933312, o.inodesUsed || 410233] }], du: {}, swaps: [] } };
  };
  const AUTH = ["5", "6", "7", "8", "9"].map((p, i) => `Oct 29 03:12:0${i} srv sshd[22${i}]: Failed password for root from 203.0.113.7 port 5112${p} ssh2`).concat(["Oct 29 04:40:22 srv sshd[2410]: Failed password for admin from 198.51.100.9 port 40001 ssh2", "Oct 29 09:15:44 srv sshd[2900]: Accepted publickey for ubuntu from 192.0.2.44 port 52100 ssh2"]).join("\n") + "\n";
  const OOM = [{ ago: 7200, msg: "Out of memory: Killed process 4512 (node) total-vm:2145312kB, anon-rss:1503204kB" }, { ago: 7199, msg: "oom_reaper: reaped process 4512 (node), now anon-rss:0kB" }];

  INC(1, "SEV-1: The API Vanished Overnight", "The Node.js API process disappeared at 02:14 with no error in its own log. The server is up and nobody restarted it. Suspect the kernel: search the kernel log for out-of-memory kills.", "Find the OOM-killer entry in the kernel log.",
    "dmesg | grep -i 'out of memory'", [["dmesg", "Kernel ring buffer."], ["grep -i 'out of memory'", "The OOM killer logs 'Out of memory: Killed process <pid> (<name>)'."]], "Fix the cause, not just the symptom: find the leak, set memory limits (systemd MemoryMax=) or add RAM/swap.",
    { viz: "monitor", system: PF({ load: [1.2, 1.1, 0.9], mem: { total: 3941, free: 80, used: 3600, shared: 12, cache: 261, avail: 140, swapTotal: 0, swapUsed: 0 } }, { kernel: OOM }), goal: sh => /Killed process 4512 \(node\)/.test(out(sh)) });
  INC(2, "SEV-2: Everything Is Slow, CPU Looks Idle", "Customers report timeouts. Load average is 6.8 on a 2-CPU box, yet top shows the CPUs mostly idle. Something is blocking on a resource. Show per-disk extended statistics to find it.", "Identify the saturated disk.",
    "iostat -x", [["iostat -x", "Extended per-device stats: look for ~100 %util and a high await."]], "High load + idle CPU + high iowait = the bottleneck is storage (or network storage), not compute.",
    { viz: "monitor", system: PF({ load: [6.8, 5.9, 3.1], cpu: { us: 4, sy: 3, ni: 0, id: 18, wa: 75, hi: 0, si: 0, st: 0 }, disks: [{ dev: "xvda", tps: 410.5, r: 52000.0, w: 61000.0, util: 98.7, await: 85.3 }] }), goal: sh => /xvda[\s\S]*98\.7/.test(out(sh)) });
  INC(2, "SEV-2: Site Works Locally, Not From Outside", "curl localhost works on the server but external users get timeouts on HTTPS. The web server is listening on 443. The firewall allows only SSH and HTTP. Open HTTPS.", "Allow 443/tcp through the firewall.",
    "sudo ufw allow 443/tcp", [["ufw allow 443/tcp", "Adds the missing ALLOW rule."]], "Test from outside afterwards: a service reachable on localhost proves nothing about the firewall in front of it.",
    { viz: "firewall", system: { firewall: { kind: "ufw", active: true, defaultIn: "deny", rules: [{ port: "22/tcp", to: "22/tcp", action: "ALLOW", from: "Anywhere" }, { port: "80/tcp", to: "80/tcp", action: "ALLOW", from: "Anywhere" }] } }, goal: sh => sh.sys.fw.rules.some(r => r.port === "443/tcp" && r.action === "ALLOW") });
  INC(2, "SEV-2: 'No Space Left' But df Shows Free Space", "Writes fail with 'No space left on device', yet df -h shows gigabytes free. Check the other resource a filesystem can run out of.", "Show inode usage for all filesystems.",
    "df -i", [["df -i", "Inodes (file count slots) per filesystem. IUse% at 100% means no new files, whatever the free bytes."]], "Millions of tiny files (sessions, mail queues, cache) are the usual cause. Find the directory with find / -xdev -type f | cut -d/ -f2-3 | sort | uniq -c | sort -rn.",
    { viz: "disk-usage", system: DISKS({ inodesUsed: 1933312 }), goal: sh => /IUse%/.test(out(sh)) && /100%/.test(out(sh)) });
  INC(1, "SEV-1: Brute-Force Attack in Progress", "The security team sees a spike in failed SSH logins. Identify the single address with the most failed password attempts: show only the top offender with its count.", "Rank source IPs by failed attempts.",
    "grep 'Failed password' /var/log/auth.log | awk '{print $11}' | sort | uniq -c | sort -rn | head -n 1", [["grep ...", "Only failures."], ["awk '{print $11}'", "The source IP column."], ["sort | uniq -c | sort -rn | head -n 1", "Count duplicates, biggest first, keep one."]], "Then block it, and consider fail2ban and key-only SSH.",
    { viz: "text", nodes: { "/var/log/auth.log": { content: AUTH } }, focus: ["/var/log/auth.log"], goal: sh => /^\s*5 203\.0\.113\.7$/m.test(out(sh)) && out(sh).trim().split("\n").length === 1 });
  INC(1, "SEV-1: Block the Attacker", "The attacker is 203.0.113.7. Block all traffic from that address at the firewall right now.", "Add a deny rule for 203.0.113.7.",
    "sudo ufw deny from 203.0.113.7", [["ufw deny from 203.0.113.7", "Drops everything from that source. Rules are evaluated top-down, so insert it above any allow."]], "ufw insert 1 deny from <ip> puts the rule first so a broad allow cannot override it.",
    { viz: "firewall", system: { firewall: { kind: "ufw", active: true, defaultIn: "deny", rules: [{ port: "22/tcp", to: "22/tcp", action: "ALLOW", from: "Anywhere" }] } }, goal: sh => sh.sys.fw.rules.some(r => r.action === "DENY" && r.from === "203.0.113.7") });
  const BADSSHD = "Port 22\nPermitRootLogin yes\nPasswordAuthentication no\nPermitEmptyPasswrds no\n";
  INC(1, "SEV-1: SSH Won't Restart After a Config Change", "After editing sshd_config the SSH service refuses to restart and you can only reach the box on this open session. Test the configuration file to see exactly what is wrong.", "Run the sshd config test.",
    "sudo sshd -t", [["sshd -t", "Parses the config and prints the first error, without touching the running daemon."]], "Never close your current session until a NEW login works; always sshd -t before restart.",
    { viz: "text", nodes: { "/etc/ssh/sshd_config": { content: BADSSHD, owner: "root", group: "root" } }, focus: ["/etc/ssh/sshd_config"], system: { ssh: { hosts: {} } }, goal: sh => /Bad configuration option|PermitEmptyPasswrds/.test((sh.lastExec ? sh.lastExec.err : "") + out(sh)) });
  INC(1, "SEV-1: Fix the sshd Typo and Verify", "sshd_config contains the typo PermitEmptyPasswrds. Correct it in place (to PermitEmptyPasswords) and confirm the file now passes the syntax check, in one line.", "Fix with sed, then test with sshd -t.",
    "sudo sed -i 's/PermitEmptyPasswrds/PermitEmptyPasswords/' /etc/ssh/sshd_config && sudo sshd -t", [["sed -i 's/.../.../'", "Correct the keyword."], ["&& sudo sshd -t", "Only a clean test (no output) means it is safe to reload."]], "sudo systemctl reload sshd (not restart) keeps existing sessions alive.",
    { viz: "text", nodes: { "/etc/ssh/sshd_config": { content: BADSSHD, owner: "root", group: "root" } }, focus: ["/etc/ssh/sshd_config"], system: { ssh: { hosts: {} } }, goal: sh => /PermitEmptyPasswords no/.test(text(sh, "/etc/ssh/sshd_config")) && !(sh.lastExec ? sh.lastExec.err : "").trim() });
  INC(2, "SEV-2: Deploy Fails: Permission Denied on the Web Root", "The CI pipeline cannot write to /var/www/html: the folder tree is owned by root. The web server and deploys run as www-data. Give www-data ownership of the whole tree.", "Recursively change owner and group to www-data.",
    "sudo chown -R www-data:www-data /var/www/html", [["chown -R", "Recursive ownership change."], ["www-data:www-data", "user:group."]], "Prefer group-write plus a deploy group over handing the tree to the web server user: a compromised site could then rewrite its own code.",
    { viz: "stat", fs: T(HOME), nodes: { "/var/www/html": { dir: true, owner: "root", group: "root" }, "/var/www/html/index.html": { content: "<h1>hi</h1>\n", owner: "root", group: "root" }, "/var/www/html/app.js": { content: "x\n", owner: "root", group: "root" } }, focus: ["/var/www/html"], goal: sh => ["/var/www/html", "/var/www/html/index.html", "/var/www/html/app.js"].every(p => { const x = file(sh, p); return x && x.owner === "www-data" && x.group === "www-data"; }) });
  INC(2, "SEV-2: Which Process Is Eating the Memory?", "Memory is nearly exhausted and the box is swapping. List processes by memory use (biggest first) and show only the top three lines.", "Rank processes by %MEM.",
    "ps aux --sort=-%mem | head -n 3", [["ps aux --sort=-%mem", "Memory hogs first."], ["head -n 3", "Header plus the top two."]], "Compare RSS growth over time (ps -o rss= -p PID every minute): steady growth means a leak.",
    { viz: "monitor", system: PF({ mem: { total: 3941, free: 80, used: 3600, shared: 12, cache: 261, avail: 140, swapTotal: 2048, swapUsed: 1900 } }), goal: sh => /node/.test(out(sh)) && /USER/.test(out(sh)) });
  INC(2, "SEV-2: Filesystem Went Read-Only", "After a storage hiccup the kernel remounted / read-only (rw became ro): nothing can write, services crash. After the underlying problem is dealt with, put the root filesystem back to read-write without rebooting.", "Remount / as read-write.",
    "sudo mount -o remount,rw /", [["mount -o remount,rw /", "Changes the options of an already-mounted filesystem in place."]], "Find out WHY first (dmesg | grep -i 'remount-ro\\|I/O error'); remounting rw over failing hardware risks corruption: run fsck at the next chance.",
    { viz: "disk-mount", focus: ["/"], system: DISKS({ rootOpts: "ro,relatime" }), goal: sh => sh.sys.disks.mounts.find(m => m.target === "/").options.startsWith("rw") });
  INC(2, "SEV-2: The Box Needs Emergency Swap", "A memory spike is killing processes and the server has no swap at all. You cannot add RAM right now: create and enable a 1G swap file at /swapfile in one line.", "Allocate, secure, format and enable /swapfile.",
    "sudo fallocate -l 1G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile", [["fallocate -l 1G", "Reserve the space."], ["chmod 600", "Only root may read it."], ["mkswap", "Format as swap."], ["swapon", "Start using it."]], "Swap buys time, it does not fix a leak. Add the fstab line afterwards to survive a reboot.",
    { viz: "monitor", system: Object.assign(DISKS(), { processes: PF({}).processes }), goal: sh => sh.sys.disks.swaps.some(s => s.name === "/swapfile") });
  INC(2, "SEV-2: Kill the Runaway Process", "PID 4512 (node) is pinned at 98% CPU and blocking everything else. Ask it to terminate gracefully first.", "Send SIGTERM to PID 4512.",
    "kill 4512", [["kill 4512", "Sends SIGTERM (15): the process can clean up. Use kill -9 only if it ignores that."]], "Check what it is (ps -p 4512 -o pid,cmd) before killing, and find out why it spun, or it will come back.",
    { viz: "processes", system: PF({ load: [3.9, 3.2, 1.4], cpu: { us: 91, sy: 6, ni: 0, id: 2, wa: 1, hi: 0, si: 0, st: 0 } }), goal: sh => !sh.sys.processes.some(p => p.pid === 4512) });
})();

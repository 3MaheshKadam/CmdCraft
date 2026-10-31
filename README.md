# CmdCraft // Interactive Terminal & Command Mastery Arena

A gamified, visual, scenario-driven command practice platform built for hands-on Linux & DevOps engineering mastery.

---

## 🚀 Key Highlights & Architecture

### 1. Curriculum Coverage (25 Modules Mapped from `linux chat`)
The curriculum directly aligns with the Linux for DevOps Engineering syllabus:
- **Module 1**: Linux Fundamentals & Architecture (`whoami`, `id`, `uname -a`, `cat /etc/os-release`)
- **Module 2**: Terminal Navigation & Filesystem Hierarchy (`pwd`, `ls -la`, `cd ..`, `cd -`, `stat`)
- **Module 3**: File and Directory Operations (`touch`, `mkdir -p`, `cp -r`, `mv`, `ln -s`)
- **Module 4**: Permissions, Ownership & Access Control (`chmod`, `chown`, `chgrp`, `namei -l`)
- **Module 5**: Users, Groups & Privilege Management (`useradd -m`, `usermod -aG`, `getent passwd`, `groups`)
- **Module 6**: Pipes, Redirection & Streams (`|`, `>`, `>>`, `2>`, `2>&1`, `tee`, `xargs`)
- **Module 7**: Searching Files & Text with `grep` & `find` (`grep -rn`, `grep -i`, `find /var/log -size +100M`)
- **Module 8**: Text Processing & Log Analysis (`awk`, `sed`, `head`, `tail -f`, `sort | uniq -c`, `cut`)
- **Module 9**: Process Management & Signals (`ps aux`, `top`, `kill -15`, `kill -9`, `pkill`)
- **Module 10**: Services & systemd Management (`systemctl status`, `restart`, `enable`, `daemon-reload`)
- **Module 11**: Logs & Journal Management (`journalctl -u myapp -n 100 --no-pager`, `dmesg -T`)
- **Module 12**: Scheduled Jobs & Cron (`crontab -l`, `systemctl status cron`, `journalctl -u cron`)
- **Module 13**: Linux Networking (`ip addr`, `ss -tulpn`, `curl -v`, `dig +short`, `ping -c 4`)
- **Module 14**: Storage, Disks & Inodes (`df -h`, `df -i`, `du -xhd1`, `lsblk -f`, `findmnt`)
- **Module 15 & 16**: SSH & Secure File Transfers (`ssh -v`, `ssh-keygen -t ed25519`, `chmod 600`, `scp`)
- **Module 19**: Archiving & Compression (`tar -czvf`, `tar -xzvf`, `gzip`)

---

### 2. The 2 Play Modes

1. **Mode 1: Topic-Wise Progressive Drills**
   - 16 targeted modules with 70+ interactive scenarios.
   - Real-time command syntax breakdowns (`part` and `desc`).
   - "Pro-Tips" explaining production gotchas and best practices.

2. **Mode 2: Full Syllabus / Production Incident Simulator**
   - 10 high-stakes production emergencies directly derived from the incident catalog:
     - 🚨 **SEV-1**: Root Filesystem Is 100% Full (`No space left on device`)
     - ⚙️ **SEV-2**: Application Service Fails to Start After Deploy (`systemd / journalctl`)
     - 🌐 **SEV-2**: Port 3000 Is Not Reachable (`ss -tulpn / localhost bind issue`)
     - 🌍 **SEV-3**: DNS Resolves to Old Deprecated Server (`dig +short`)
     - 🔒 **SEV-2**: Permission Denied During CI/CD Deployment Script (`chmod u+x / namei`)
     - 🔥 **SEV-1**: High CPU Spike Crashing Production Node (`ps aux --sort=-%cpu | head -n 10`)
     - ⏰ **SEV-3**: Nightly Cron Backup Is Not Running at 02:00 AM (`crontab -l`)
     - 🔑 **SEV-2**: Production SSH Connection Fails (`ssh -v / port 22`)
     - 📈 **SEV-2**: Application Log Growing Rapidly / Infinite Error Loop (`tail -f`)
     - 💾 **SEV-2**: Attached EBS Storage Volume Attached but Not Accessible (`lsblk -f / mount`)

---

### 3. Visual & Gamification Engine
- **Live Dynamic Filesystem Visualizer**: Watch directories, files, sizes, owners, and permissions (`drwxr-xr-x`, `-rw-r--r--`) mutate in real time.
- **Authentic Terminal Feel**: Realistic command execution, shell history (`↑`/`↓`), prompt tracking (`Ctrl+L` to clear).
- **Web Audio API Sound Engine**: Custom synthesized chords for success, low buzzes for errors, and tactile keystrokes.
- **XP, Streaks & Ranks**: Progress from *Terminal Novice* to *Sysadmin Apprentice*, *DevOps Operator*, and *Kernel Architect ⚡*.
- **Zero-Dependency & 100% Offline**: Completely client-side in the browser. Zero API keys, zero backend servers, zero cost.
- **Smart Session Persistence & Resume**:
  - Automatically saves active mode (Topic Drill vs Incident Simulator).
  - Remembers your exact topic and scenario index across browser restarts and reloads.
  - Topic pills show real-time progress indicators (e.g., `(2/4)` or `✔`).
  - Added **`Prev`** and **`Skip`** controls to navigate between scenarios easily, plus a **`Reset Progress`** option.

---

## 📂 Launch
No build step or server needed. To launch:
- Double click [index.html](index.html) in File Explorer, or
- Run in PowerShell from the project folder:
  ```powershell
  Start-Process .\index.html
  ```

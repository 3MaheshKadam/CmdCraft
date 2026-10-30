# End Goal: CmdCraft Interactive Command & Query Mastery Arena

## 1. Vision & Core Philosophy
Transform dry terminal command practice into an addictive, visual, game-like simulation. Instead of memorizing static cheat-sheets, learners solve realistic operational incidents in simulated environments where commands trigger instant, visible mutations in the virtual system.

---

## 2. Environments Architecture (Multi-Domain Arena)

The platform is designed with a pluggable environment engine:

### 🟢 Environment 1: Linux CLI Mastery (Current Focus)
- **Objective**: Complete mastery over Linux commands, navigation, permissions, streams, pipes, processes, systemd, logs, networking, disks, and troubleshooting.
- **Visual Anchor**: Real-time interactive Filesystem Tree (`/home`, `/var`, `/etc`, `/dev`, etc.) that mutates instantly when folders are created, files are moved, permissions change, or files are deleted.
- **Terminal Simulator**: Realistic shell input with history (`↑`/`↓`), tab completion cues, auto-scroll, clear (`Ctrl+L`), and simulated stdout/stderr.

### 🔵 Environment 2: SQL Studio (Phase 2)
- **Objective**: Relational database querying, filtering, table joins, aggregations, schema design, and query optimization.
- **Visual Anchor**: Interactive Relational Schema Visualizer (tables, entity-relationship diagrams, foreign keys) and live tabular data preview showing before/after query states.
- **Engine**: Client-side SQLite / in-memory SQL runner with real-time row diff highlighting.

### 🟣 Environment 3: Git & DevOps (Phase 3)
- **Objective**: Git branching, staging, rebasing, merge conflict resolution, CI/CD pipelines, Docker fundamentals.
- **Visual Anchor**: Dynamic Git Commit Directed Acyclic Graph (DAG) that animates commits, branch pointers (`HEAD -> main`), and stash states.

---

## 3. The Two Core Play Modes

```
                    ┌─────────────────────────┐
                    │    CmdCraft Arena       │
                    └────────────┬────────────┘
                                 │
             ┌───────────────────┴───────────────────┐
             ▼                                       ▼
  [ Mode 1: Topic-Wise Drills ]            [ Mode 2: Full Syllabus ]
  • 16 Focused Curriculum Domains         • 10 Production Incident Scenarios
  • 70+ Progressive Hands-on Drills       • High-Stakes SEV-1 to SEV-3 Drills
  • Instant Syntax Breakdowns             • Root-Cause Analysis & Recovery
```

### Mode 1: Topic-Wise Drills (Mapped to 25 DevOps Modules)
1. **Architecture & System Telemetry**: `whoami`, `id`, `uname -a`, `cat /etc/os-release`
2. **Navigation & Filesystem Hierarchy**: `pwd`, `ls -la`, `cd ..`, `cd -`, `stat`
3. **File & Directory Management**: `touch`, `mkdir -p`, `cp -r`, `mv`, `ln -s`
4. **Permissions & Ownership**: `chmod +x`, `chmod 644`, `chmod 755`, `chown`, `namei -l`
5. **Users, Groups & Privilege Management**: `useradd -m`, `usermod -aG`, `getent passwd`, `groups`
6. **Pipes, Redirection & Streams**: `>`, `>>`, `2>/dev/null`, `|`, `tee`
7. **Searching & Filtering with Grep & Find**: `grep -i`, `grep -rn`, `grep -v`, `find -size +100M`
8. **Text Processing & Log Analysis**: `tail -f`, `awk '{print $1}'`, `sed`, `sort | uniq -c`, `cut`
9. **Process Management & Signals**: `ps aux`, `ps aux --sort=-%cpu`, `kill -15`, `kill -9`, `pkill`
10. **Services & systemd**: `systemctl status`, `systemctl restart`, `systemctl enable`, `daemon-reload`
11. **Logs & Journal Management**: `journalctl -u myapp -n 100 --no-pager`, `journalctl -f`, `dmesg -T`
12. **Scheduled Jobs & Cron**: `crontab -l`, `systemctl status cron`, `journalctl -u cron`
13. **Linux Networking**: `ip addr`, `ss -tulpn`, `curl -v`, `dig +short`, `ping -c 4`
14. **Disk, Storage & Filesystems**: `df -h`, `df -i`, `du -xhd1`, `lsblk -f`, `findmnt`
15. **SSH & Remote Access**: `ssh -v`, `ssh-keygen -t ed25519`, `chmod 600`, `scp`
16. **Archiving & Compression**: `tar -czvf`, `tar -xzvf`, `gzip`

### Mode 2: Full Syllabus / Incident Simulator (Section 3 of Syllabus)
1. **INCIDENT-01 (SEV-1)**: Root Filesystem Is 100% Full (`df -h`, `find /var/log -type f -size +100M`)
2. **INCIDENT-02 (SEV-2)**: Application Service Fails to Start (`systemctl status`, `journalctl -u myapp -n 100`)
3. **INCIDENT-03 (SEV-2)**: Port 3000 Is Not Reachable (`ss -tulpn | grep ':3000'`, binding issue)
4. **INCIDENT-04 (SEV-3)**: DNS Resolves to Wrong Server (`dig +short api.example.com`)
5. **INCIDENT-05 (SEV-2)**: Permission Denied During Deployment (`chmod u+x /opt/myapp/deploy.sh`)
6. **INCIDENT-06 (SEV-1)**: High CPU Spike on Production Node (`ps aux --sort=-%cpu | head -n 10`)
7. **INCIDENT-07 (SEV-3)**: Nightly Cron Backup Is Not Running (`crontab -l`, missing absolute paths)
8. **INCIDENT-08 (SEV-2)**: Production SSH Connection Fails (`ssh -v ubuntu@SERVER_IP`)
9. **INCIDENT-09 (SEV-2)**: Application Log Growing Rapidly (`tail -f /var/log/myapp.log`)
10. **INCIDENT-10 (SEV-2)**: Attached Storage Volume Attached but Not Accessible (`lsblk -f`, `mount`)

---

## 4. Visual & Gamification Mechanics

1. **Live State Visualizer**:
   - For Linux: Folder hierarchy tree updates in real-time (new files pop into existence, permissions badges turn green `rwxr-xr-x`, deleted files fade out).
   - For SQL: Visual tables update instantly, highlighting matched rows in gold.
2. **Dopamine Feedback Loop (Synthesizer Audio)**:
   - Web Audio API custom sounds:
     - Ascending arpeggio chord for correct solution 🎶
     - Low dampening buzz for command syntax error
     - Tactile keyboard clicks on each keystroke
3. **Streak Multiplier 🔥**:
   - Consecutive correct commands build streaks (`3x`, `5x`, `10x`).
   - Breaking streak by skipping or failing resets the counter, encouraging accuracy.
4. **XP & Rank Progression**:
   - `0 - 100 XP`: Terminal Novice
   - `100 - 300 XP`: Script Kiddie
   - `300 - 600 XP`: Sysadmin Apprentice
   - `600 - 1200 XP`: DevOps Operator
   - `1200 - 2000 XP`: Linux Engineer
   - `2000+ XP`: Kernel Architect ⚡
5. **Zero-Friction Local Persistence**:
   - Automatic save of XP, unlocked badges, and completed scenarios in `localStorage`.

---

## 5. Progress Tracker (Aligned with `linux chat`)

- [x] Module 1: Linux Fundamentals & Architecture
- [x] Module 2: Terminal Navigation & Filesystem
- [x] Module 3: File & Directory Management
- [x] Module 4: Permissions, Ownership & Access Control
- [x] Module 5: Users, Groups & Privilege Management
- [x] Module 6: Pipes, Redirection & Streams
- [x] Module 7: Searching & Filtering Text (`grep`, `find`)
- [x] Module 8: Text Processing & Log Analysis (`awk`, `sed`, `head`, `tail`)
- [x] Module 9: Process Management & Signals (`ps`, `top`, `kill`, `pkill`)
- [x] Module 10: Services & systemd Management
- [x] Module 11: Logs & Journal Management (`journalctl`, `dmesg`)
- [x] Module 12: Scheduled Jobs & Cron
- [x] Module 13: Linux Networking (`ip`, `ss`, `curl`, `dig`, `ping`)
- [x] Module 14: Disk, Filesystems & Storage Management (`df`, `du`, `lsblk`, `mount`)
- [x] Module 15 & 16: SSH & Remote Transfers (`ssh -v`, `scp`, `keygen`)
- [x] Module 19: Archives, Compression & Backup (`tar`, `gzip`)
- [x] Module 24 & Section 3: 10 Real-World Production Incident Drills

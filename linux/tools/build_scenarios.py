# -*- coding: utf-8 -*-
"""
Builds scenarios.js for CmdCraft based on the 25-module DevOps curriculum
and 10 Incident Drills in docs/'linux chat'. Writes ../content/scenarios.js.
"""

def generate_scenarios_js():
    return r"""/**
 * CmdCraft Scenario Database — DevOps Engineering Curriculum
 * Aligned with the 25-Module Linux for DevOps Syllabus & 10 Production Incident Simulations
 *
 * Mode 1: Topic-Wise Progressive Drills (16 Core Curriculum Domains, 70+ Scenarios)
 * Mode 2: Full Syllabus / Production Incident Simulator (10 SEV Production Incidents)
 */

const LINUX_TOPICS = [
  { id: "architecture", name: "1. Arch & Info", icon: "fa-server", count: 4 },
  { id: "navigation", name: "2. Navigation", icon: "fa-compass", count: 5 },
  { id: "files", name: "3. File Ops", icon: "fa-folder-plus", count: 5 },
  { id: "permissions", name: "4. Permissions", icon: "fa-shield-halved", count: 5 },
  { id: "users_privileges", name: "5. Users & Sudo", icon: "fa-users-gear", count: 4 },
  { id: "redirection", name: "6. Pipes & Streams", icon: "fa-arrows-split-up-and-left", count: 4 },
  { id: "search_grep", name: "7. Grep & Find", icon: "fa-magnifying-glass", count: 5 },
  { id: "text_processing", name: "8. Text & Logs", icon: "fa-file-lines", count: 5 },
  { id: "processes", name: "9. Processes", icon: "fa-microchip", count: 5 },
  { id: "services_systemd", name: "10. Systemd", icon: "fa-gears", count: 4 },
  { id: "logs_journal", name: "11. Journalctl", icon: "fa-book-open", count: 4 },
  { id: "cron_jobs", name: "12. Cron", icon: "fa-clock", count: 3 },
  { id: "networking", name: "13. Networking", icon: "fa-network-wired", count: 5 },
  { id: "storage_disks", name: "14. Storage & Disks", icon: "fa-hard-drive", count: 5 },
  { id: "ssh_remote", name: "15. SSH & Remote", icon: "fa-key", count: 4 },
  { id: "archiving", name: "16. Tar & Backup", icon: "fa-file-zipper", count: 3 }
];

const SCENARIOS = [
  // ==========================================
  // TOPIC 1: ARCHITECTURE & SYSTEM INFO (Module 1)
  // ==========================================
  {
    id: "LNX-ARCH-01",
    topic: "architecture",
    title: "Who Am I in the Shell?",
    difficulty: "Beginner",
    xp: 50,
    desc: "You just landed in an unknown terminal session. Before typing any commands, verify your current active username.",
    objective: "Print your current username.",
    validCommands: [
      /^whoami$/,
      /^\/usr\/bin\/whoami$/
    ],
    hint: "The command asks the literal question: 'who am i'.",
    explanation: {
      command: "whoami",
      breakdown: [
        { part: "whoami", desc: "Displays the effective username of the currently logged-in shell user." }
      ],
      proTip: "In scripts, you can also inspect the `$USER` or `$LOGNAME` environment variables."
    },
    simulatedOutput: "ubuntu",
    initialFs: {
      name: "/home/ubuntu",
      type: "dir",
      isCurrent: true,
      children: [
        { name: ".bashrc", type: "file", size: "3.7KB", perm: "-rw-r--r--" },
        { name: "projects", type: "dir", perm: "drwxr-xr-x", children: [] }
      ]
    }
  },
  {
    id: "LNX-ARCH-02",
    topic: "architecture",
    title: "Inspecting User IDs & Groups",
    difficulty: "Beginner",
    xp: 60,
    desc: "A deployment fails with privilege errors. Check your numeric user ID (UID), primary group ID (GID), and all supplementary group memberships.",
    objective: "Display user and group IDs for the current user.",
    validCommands: [
      /^id$/,
      /^id\s+ubuntu$/,
      /^\/usr\/bin\/id$/
    ],
    hint: "Use the short two-letter command 'id'.",
    explanation: {
      command: "id",
      breakdown: [
        { part: "id", desc: "Prints effective UID, GID, and list of supplementary groups (e.g. sudo, docker, adm)." }
      ],
      proTip: "Check `id -u` for just the UID (0 signifies root)."
    },
    simulatedOutput: "uid=1000(ubuntu) gid=1000(ubuntu) groups=1000(ubuntu),4(adm),27(sudo),999(docker)",
    initialFs: {
      name: "/home/ubuntu",
      type: "dir",
      isCurrent: true,
      children: [
        { name: ".bashrc", type: "file", size: "3.7KB", perm: "-rw-r--r--" }
      ]
    }
  },
  {
    id: "LNX-ARCH-03",
    topic: "architecture",
    title: "Kernel & Hardware Architecture Check",
    difficulty: "Beginner",
    xp: 60,
    desc: "Before compiling or installing kernel-specific binaries, inspect the system kernel release, hostname, and machine architecture.",
    objective: "Print all system information including kernel version and architecture.",
    validCommands: [
      /^uname\s+-a$/,
      /^uname\s+--all$/
    ],
    hint: "Use 'uname' with the flag for 'all'.",
    explanation: {
      command: "uname -a",
      breakdown: [
        { part: "uname", desc: "Prints system information." },
        { part: "-a", desc: "Prints all information: kernel name, hostname, kernel release, version, machine architecture (e.g., x86_64 or aarch64)." }
      ],
      proTip: "Use `uname -r` to fetch only the kernel release string for module installation."
    },
    simulatedOutput: "Linux ip-172-31-42-12 5.15.0-1031-aws #35-Ubuntu SMP Fri Feb 10 14:00:00 UTC 2026 x86_64 x86_64 x86_64 GNU/Linux",
    initialFs: {
      name: "/proc",
      type: "dir",
      children: [
        { name: "version", type: "file", size: "0B", perm: "-r--r--r--" },
        { name: "cpuinfo", type: "file", size: "0B", perm: "-r--r--r--" }
      ]
    }
  },
  {
    id: "LNX-ARCH-04",
    topic: "architecture",
    title: "Distribution & OS Release Telemetry",
    difficulty: "Beginner",
    xp: 70,
    desc: "Verify whether the target host is running Ubuntu, Debian, RHEL, or Alpine Linux by reading the standard OS release file.",
    objective: "Display the contents of /etc/os-release.",
    validCommands: [
      /^cat\s+\/etc\/os-release$/,
      /^cat\s+\/etc\/issue$/
    ],
    hint: "Read the file at /etc/os-release using 'cat'.",
    explanation: {
      command: "cat /etc/os-release",
      breakdown: [
        { part: "cat", desc: "Concatenate and display file content." },
        { part: "/etc/os-release", desc: "Standard systemd file containing distribution ID, version, and codename." }
      ],
      proTip: "In modern Linux systems, `/etc/os-release` is the universal, cross-distro standard."
    },
    simulatedOutput: "NAME=\"Ubuntu\"\nVERSION=\"24.04 LTS (Noble Numbat)\"\nID=ubuntu\nID_LIKE=debian\nPRETTY_NAME=\"Ubuntu 24.04 LTS\"\nVERSION_ID=\"24.04\"",
    initialFs: {
      name: "/etc",
      type: "dir",
      children: [
        { name: "os-release", type: "file", size: "380B", perm: "-rw-r--r--" },
        { name: "hosts", type: "file", size: "220B", perm: "-rw-r--r--" }
      ]
    }
  },

  // ==========================================
  // TOPIC 2: TERMINAL NAVIGATION & FILESYSTEM (Module 2)
  // ==========================================
  {
    id: "LNX-NAV-01",
    topic: "navigation",
    title: "Where In The Filesystem Am I?",
    difficulty: "Beginner",
    xp: 50,
    desc: "You just SSH-ed into a production server after an unexpected alert. Before running any maintenance scripts, verify your exact absolute working directory.",
    objective: "Print the present working directory.",
    validCommands: [
      /^pwd$/,
      /^\/bin\/pwd$/
    ],
    hint: "Think about 'print working directory' acronym.",
    explanation: {
      command: "pwd",
      breakdown: [
        { part: "pwd", desc: "Stands for 'Print Working Directory'. Outputs the full absolute path from the root directory (/) to your current location." }
      ],
      proTip: "Use `pwd -P` if you want to resolve physical symlinks to their actual canonical path."
    },
    simulatedOutput: "/home/ubuntu",
    initialFs: {
      name: "/",
      type: "dir",
      children: [
        {
          name: "home",
          type: "dir",
          children: [
            {
              name: "ubuntu",
              type: "dir",
              isCurrent: true,
              children: [
                { name: "notes.txt", type: "file", size: "1.2KB", perm: "-rw-r--r--" },
                { name: "projects", type: "dir", perm: "drwxr-xr-x", children: [] }
              ]
            }
          ]
        },
        {
          name: "var",
          type: "dir",
          children: [
            { name: "log", type: "dir", children: [] }
          ]
        }
      ]
    }
  },
  {
    id: "LNX-NAV-02",
    topic: "navigation",
    title: "Uncovering Hidden Dotfiles",
    difficulty: "Beginner",
    xp: 60,
    desc: "A developer claims their environment configuration is missing. Inspect everything in the current directory, including hidden dotfiles like `.bashrc` or `.env` in long format.",
    objective: "List all files including hidden ones in long format.",
    validCommands: [
      /^ls\s+(-la|-al|-l\s+-a|-a\s+-l)$/,
      /^ls\s+--all\s+-l$/,
      /^ls\s+-l\s+--all$/
    ],
    hint: "Combine the long listing flag '-l' with the all flag '-a'.",
    explanation: {
      command: "ls -la (or ls -al)",
      breakdown: [
        { part: "ls", desc: "List directory contents." },
        { part: "-l", desc: "Use long listing format showing permissions, owner, size, and modification date." },
        { part: "-a", desc: "Include directory entries whose names begin with a dot (hidden files)." }
      ],
      proTip: "Files starting with a dot `.` are hidden by default to prevent cluttering standard directory listings."
    },
    simulatedOutput: "total 28\ndrwxr-xr-x 4 ubuntu ubuntu 4096 Oct 29 14:00 .\ndrwxr-xr-x 3 root   root   4096 Oct 29 13:50 ..\n-rw-r--r-- 1 ubuntu ubuntu  220 Oct 29 13:50 .bashrc\n-rw------- 1 ubuntu ubuntu  145 Oct 29 14:02 .env.production\n-rw-r--r-- 1 ubuntu ubuntu 1240 Oct 29 14:01 notes.txt\ndrwxr-xr-x 2 ubuntu ubuntu 4096 Oct 29 14:00 projects",
    initialFs: {
      name: "/home/ubuntu",
      type: "dir",
      isCurrent: true,
      children: [
        { name: ".bashrc", type: "file", size: "220B", perm: "-rw-r--r--" },
        { name: ".env.production", type: "file", size: "145B", perm: "-rw-------" },
        { name: "notes.txt", type: "file", size: "1.2KB", perm: "-rw-r--r--" },
        { name: "projects", type: "dir", perm: "drwxr-xr-x", children: [] }
      ]
    }
  },
  {
    id: "LNX-NAV-03",
    topic: "navigation",
    title: "Climbing Up to the Parent Directory",
    difficulty: "Beginner",
    xp: 50,
    desc: "You are currently deep inside `/home/ubuntu/projects/backend/api`. Change your working directory one level up into its parent directory.",
    objective: "Navigate to the parent directory.",
    validCommands: [
      /^cd\s+\.\.$/,
      /^cd\s+\.\.\/$/
    ],
    hint: "Use 'cd' with the special two-dot symbol representing the parent directory.",
    explanation: {
      command: "cd ..",
      breakdown: [
        { part: "cd", desc: "Change Directory." },
        { part: "..", desc: "A relative path reference pointing to the immediate parent directory." }
      ],
      proTip: "`.` refers to current directory, `..` refers to parent, and `~` refers to your user home."
    },
    simulatedOutput: "[Navigated to /home/ubuntu/projects/backend]",
    initialFs: {
      name: "/home/ubuntu/projects/backend",
      type: "dir",
      children: [
        { name: "api", type: "dir", isCurrent: true, children: [] },
        { name: "config.json", type: "file", size: "400B", perm: "-rw-r--r--" }
      ]
    }
  },
  {
    id: "LNX-NAV-04",
    topic: "navigation",
    title: "Instant Return to Previous Directory",
    difficulty: "Beginner",
    xp: 60,
    desc: "You were editing files in `/etc/nginx/sites-available` and just jumped to `/var/log` to check access errors. Switch immediately back to the previous directory without typing its full path.",
    objective: "Change to the previous working directory using the dash shortcut.",
    validCommands: [
      /^cd\s+-$/
    ],
    hint: "Use 'cd -' to toggle back to the previous directory.",
    explanation: {
      command: "cd -",
      breakdown: [
        { part: "cd", desc: "Change directory." },
        { part: "-", desc: "Switches to `$OLDPWD` (the previous working directory) and prints its path." }
      ],
      proTip: "Use `cd -` for rapid toggling between two related paths like `/var/log` and `/etc/nginx`."
    },
    simulatedOutput: "/etc/nginx/sites-available\n[Current working directory restored]",
    initialFs: {
      name: "/etc/nginx/sites-available",
      type: "dir",
      isCurrent: true,
      children: [
        { name: "default", type: "file", size: "2.4KB", perm: "-rw-r--r--" },
        { name: "api.conf", type: "file", size: "1.1KB", perm: "-rw-r--r--" }
      ]
    }
  },
  {
    id: "LNX-NAV-05",
    topic: "navigation",
    title: "Inode & Metadata Deep Inspection",
    difficulty: "Beginner",
    xp: 70,
    desc: "Inspect the exact inode number, timestamps (Access, Modify, Change), and file size of `/etc/hosts`.",
    objective: "Display detailed file status and metadata for /etc/hosts.",
    validCommands: [
      /^stat\s+\/etc\/hosts$/
    ],
    hint: "Use the 'stat' command followed by the target file path.",
    explanation: {
      command: "stat /etc/hosts",
      breakdown: [
        { part: "stat", desc: "Displays complete file status, inode number, block allocations, and exact timestamp metadata." }
      ],
      proTip: "Comparing 'Modify' (content change) vs 'Change' (permission/inode change) is critical during security audits."
    },
    simulatedOutput: "  File: /etc/hosts\n  Size: 221        Blocks: 8          IO Block: 4096   regular file\nDevice: 10301h/66305d Inode: 131075     Links: 1\nAccess: (0644/-rw-r--r--)  Uid: (    0/    root)   Gid: (    0/    root)\nAccess: 2026-10-29 10:15:00.000000000 +0000\nModify: 2026-10-25 08:30:12.000000000 +0000\nChange: 2026-10-25 08:30:12.000000000 +0000",
    initialFs: {
      name: "/etc",
      type: "dir",
      children: [
        { name: "hosts", type: "file", size: "221B", perm: "-rw-r--r--" }
      ]
    }
  },

  // ==========================================
  // TOPIC 3: FILE & DIRECTORY MANAGEMENT (Module 3)
  // ==========================================
  {
    id: "LNX-FILE-01",
    topic: "files",
    title: "Creating Empty Log Files",
    difficulty: "Beginner",
    xp: 50,
    desc: "The logging framework expects an empty `app.log` file in the current working directory. Create it instantly.",
    objective: "Create an empty file named app.log.",
    validCommands: [
      /^touch\s+app\.log$/
    ],
    hint: "Use the 'touch' command.",
    explanation: {
      command: "touch app.log",
      breakdown: [
        { part: "touch", desc: "Creates an empty file if it doesn't exist, or updates its access/modification timestamp if it already exists." }
      ],
      proTip: "Touching existing files is often used to trigger file-watcher daemons or hot-reloaders."
    },
    simulatedOutput: "[Created app.log]",
    initialFs: {
      name: "/var/log/myapp",
      type: "dir",
      isCurrent: true,
      children: []
    },
    updatedFs: {
      name: "/var/log/myapp",
      type: "dir",
      isCurrent: true,
      children: [
        { name: "app.log", type: "file", size: "0B", perm: "-rw-r--r--" }
      ]
    }
  },
  {
    id: "LNX-FILE-02",
    topic: "files",
    title: "Nested Directory Blueprint",
    difficulty: "Beginner",
    xp: 60,
    desc: "Create a deeply nested directory path `project/config/env` in a single command, automatically generating all missing parent folders.",
    objective: "Create the directory tree project/config/env with parent creation.",
    validCommands: [
      /^mkdir\s+-p\s+project\/config\/env$/,
      /^mkdir\s+--parents\s+project\/config\/env$/
    ],
    hint: "Use 'mkdir' with the flag that creates parents (-p).",
    explanation: {
      command: "mkdir -p project/config/env",
      breakdown: [
        { part: "mkdir", desc: "Make directory." },
        { part: "-p", desc: "Creates parent directories as needed without throwing errors if they already exist." }
      ],
      proTip: "Always use `-p` in automation scripts to ensure idempotent directory setup."
    },
    simulatedOutput: "[Directory structure project/config/env created]",
    initialFs: {
      name: "/home/ubuntu",
      type: "dir",
      isCurrent: true,
      children: []
    },
    updatedFs: {
      name: "/home/ubuntu",
      type: "dir",
      isCurrent: true,
      children: [
        {
          name: "project",
          type: "dir",
          children: [
            {
              name: "config",
              type: "dir",
              children: [
                { name: "env", type: "dir", children: [] }
              ]
            }
          ]
        }
      ]
    }
  },
  {
    id: "LNX-FILE-03",
    topic: "files",
    title: "Recursive Directory Backup",
    difficulty: "Beginner",
    xp: 60,
    desc: "Before editing configuration, make a safe backup copy of the `config` folder and all its contents to `config-backup`.",
    objective: "Recursively copy config/ to config-backup/.",
    validCommands: [
      /^cp\s+(-r|-R)\s+config\/?\s+config-backup\/?$/,
      /^cp\s+-a\s+config\/?\s+config-backup\/?$/
    ],
    hint: "Use 'cp' with the recursive flag (-r).",
    explanation: {
      command: "cp -r config config-backup",
      breakdown: [
        { part: "cp", desc: "Copy files and directories." },
        { part: "-r", desc: "Copies directories recursively including all nested files and subfolders." }
      ],
      proTip: "In production, prefer `cp -a` (archive mode) to preserve timestamps, ownership, and symbolic links."
    },
    simulatedOutput: "[Recursively copied config/ to config-backup/]",
    initialFs: {
      name: "/opt/app",
      type: "dir",
      isCurrent: true,
      children: [
        {
          name: "config",
          type: "dir",
          children: [
            { name: "database.yml", type: "file", size: "1.2KB", perm: "-rw-r--r--" },
            { name: "server.json", type: "file", size: "850B", perm: "-rw-r--r--" }
          ]
        }
      ]
    },
    updatedFs: {
      name: "/opt/app",
      type: "dir",
      isCurrent: true,
      children: [
        {
          name: "config",
          type: "dir",
          children: [
            { name: "database.yml", type: "file", size: "1.2KB", perm: "-rw-r--r--" },
            { name: "server.json", type: "file", size: "850B", perm: "-rw-r--r--" }
          ]
        },
        {
          name: "config-backup",
          type: "dir",
          children: [
            { name: "database.yml", type: "file", size: "1.2KB", perm: "-rw-r--r--" },
            { name: "server.json", type: "file", size: "850B", perm: "-rw-r--r--" }
          ]
        }
      ]
    }
  },
  {
    id: "LNX-FILE-04",
    topic: "files",
    title: "Atomic Rename & Relocation",
    difficulty: "Beginner",
    xp: 50,
    desc: "Rename legacy config file `app.conf.old` to the active production name `app.conf` in place.",
    objective: "Rename app.conf.old to app.conf.",
    validCommands: [
      /^mv\s+app\.conf\.old\s+app\.conf$/,
      /^mv\s+-i\s+app\.conf\.old\s+app\.conf$/
    ],
    hint: "Use 'mv' for renaming files.",
    explanation: {
      command: "mv app.conf.old app.conf",
      breakdown: [
        { part: "mv", desc: "Move or rename files and directories." }
      ],
      proTip: "On the same filesystem, `mv` is an atomic inode pointer update."
    },
    simulatedOutput: "[Renamed app.conf.old -> app.conf]",
    initialFs: {
      name: "/etc/myapp",
      type: "dir",
      isCurrent: true,
      children: [
        { name: "app.conf.old", type: "file", size: "2.1KB", perm: "-rw-r--r--" }
      ]
    },
    updatedFs: {
      name: "/etc/myapp",
      type: "dir",
      isCurrent: true,
      children: [
        { name: "app.conf", type: "file", size: "2.1KB", perm: "-rw-r--r--" }
      ]
    }
  },
  {
    id: "LNX-FILE-05",
    topic: "files",
    title: "Zero-Downtime Symbolic Link Creation",
    difficulty: "Beginner",
    xp: 70,
    desc: "In modern CI/CD release architectures, create a symbolic link named `current` pointing to the release folder `/opt/myapp/releases/v2.4`.",
    objective: "Create a symbolic link named current pointing to /opt/myapp/releases/v2.4.",
    validCommands: [
      /^ln\s+-s\s+\/opt\/myapp\/releases\/v2\.4\s+current$/,
      /^ln\s+-s\s+releases\/v2\.4\s+current$/
    ],
    hint: "Use 'ln -s TARGET LINK_NAME'.",
    explanation: {
      command: "ln -s /opt/myapp/releases/v2.4 current",
      breakdown: [
        { part: "ln", desc: "Make links between files." },
        { part: "-s", desc: "Create a soft (symbolic) link rather than a hard link." }
      ],
      proTip: "Atomic symlink swapping (`ln -sfn new_release current`) enables instant zero-downtime rollouts and rollbacks."
    },
    simulatedOutput: "[Created symlink current -> /opt/myapp/releases/v2.4]",
    initialFs: {
      name: "/opt/myapp",
      type: "dir",
      isCurrent: true,
      children: [
        {
          name: "releases",
          type: "dir",
          children: [
            { name: "v2.4", type: "dir", children: [] }
          ]
        }
      ]
    },
    updatedFs: {
      name: "/opt/myapp",
      type: "dir",
      isCurrent: true,
      children: [
        {
          name: "releases",
          type: "dir",
          children: [
            { name: "v2.4", type: "dir", children: [] }
          ]
        },
        { name: "current -> releases/v2.4", type: "file", size: "12B", perm: "lrwxrwxrwx" }
      ]
    }
  },

  // ==========================================
  // TOPIC 4: PERMISSIONS & ACCESS CONTROL (Module 4)
  // ==========================================
  {
    id: "LNX-PERM-01",
    topic: "permissions",
    title: "Making Deployment Scripts Executable",
    difficulty: "Beginner",
    xp: 50,
    desc: "You just downloaded `deploy.sh`, but running `./deploy.sh` returns 'Permission denied' because the execute bit is not set. Add execute permissions for the user.",
    objective: "Make deploy.sh executable.",
    validCommands: [
      /^chmod\s+(\+x|u\+x)\s+deploy\.sh$/,
      /^chmod\s+755\s+deploy\.sh$/,
      /^chmod\s+700\s+deploy\.sh$/
    ],
    hint: "Use 'chmod +x deploy.sh' or 'chmod u+x deploy.sh'.",
    explanation: {
      command: "chmod +x deploy.sh",
      breakdown: [
        { part: "chmod", desc: "Change file mode bits (permissions)." },
        { part: "+x", desc: "Adds the executable bit for the file." }
      ],
      proTip: "Prefer `chmod u+x` if you only want the file owner to have execution rights."
    },
    simulatedOutput: "[Permissions changed: -rwxr-xr-x deploy.sh]",
    initialFs: {
      name: "/home/ubuntu/app",
      type: "dir",
      isCurrent: true,
      children: [
        { name: "deploy.sh", type: "file", size: "1.4KB", perm: "-rw-r--r--" }
      ]
    },
    updatedFs: {
      name: "/home/ubuntu/app",
      type: "dir",
      isCurrent: true,
      children: [
        { name: "deploy.sh", type: "file", size: "1.4KB", perm: "-rwxr-xr-x" }
      ]
    }
  },
  {
    id: "LNX-PERM-02",
    topic: "permissions",
    title: "Standard Web File Permissions (644)",
    difficulty: "Beginner",
    xp: 60,
    desc: "Production security standard: web assets and configuration files must be readable by all users, writable only by the owner, and executable by none (rw-r--r--).",
    objective: "Set permissions of app.conf to 644.",
    validCommands: [
      /^chmod\s+644\s+app\.conf$/,
      /^chmod\s+u=rw,go=r\s+app\.conf$/
    ],
    hint: "Use numeric octal mode 644 ('chmod 644 app.conf').",
    explanation: {
      command: "chmod 644 app.conf",
      breakdown: [
        { part: "6", desc: "Owner: Read (4) + Write (2) = 6." },
        { part: "4", desc: "Group: Read (4)." },
        { part: "4", desc: "Others: Read (4)." }
      ],
      proTip: "Never leave configuration files as 777. 644 is the universal standard for non-executable assets."
    },
    simulatedOutput: "[Permissions updated to -rw-r--r-- for app.conf]",
    initialFs: {
      name: "/etc/myapp",
      type: "dir",
      isCurrent: true,
      children: [
        { name: "app.conf", type: "file", size: "3.2KB", perm: "-rwxrwxrwx" }
      ]
    },
    updatedFs: {
      name: "/etc/myapp",
      type: "dir",
      isCurrent: true,
      children: [
        { name: "app.conf", type: "file", size: "3.2KB", perm: "-rw-r--r--" }
      ]
    }
  },
  {
    id: "LNX-PERM-03",
    topic: "permissions",
    title: "Standard Web Directory Permissions (755)",
    difficulty: "Beginner",
    xp: 60,
    desc: "Web servers like Nginx or Apache require execute bits on directories to traverse into them. Set `/var/www/html` to standard 755 permissions (rwxr-xr-x).",
    objective: "Set permissions of /var/www/html to 755.",
    validCommands: [
      /^(sudo\s+)?chmod\s+755\s+\/var\/www\/html$/,
      /^(sudo\s+)?chmod\s+u=rwx,go=rx\s+\/var\/www\/html$/
    ],
    hint: "Use 'chmod 755 /var/www/html'.",
    explanation: {
      command: "chmod 755 /var/www/html",
      breakdown: [
        { part: "7", desc: "Owner: Read (4) + Write (2) + Execute/Traverse (1) = 7." },
        { part: "5", desc: "Group: Read (4) + Execute/Traverse (1) = 5." },
        { part: "5", desc: "Others: Read (4) + Execute/Traverse (1) = 5." }
      ],
      proTip: "Remember: without the execute `x` bit on a directory, no user can `cd` into it or access its files!"
    },
    simulatedOutput: "[Permissions updated to drwxr-xr-x /var/www/html]",
    initialFs: {
      name: "/var/www",
      type: "dir",
      children: [
        { name: "html", type: "dir", perm: "drwx------", children: [] }
      ]
    },
    updatedFs: {
      name: "/var/www",
      type: "dir",
      children: [
        { name: "html", type: "dir", perm: "drwxr-xr-x", children: [] }
      ]
    }
  },
  {
    id: "LNX-PERM-04",
    topic: "permissions",
    title: "Transferring File Ownership & Group",
    difficulty: "Intermediate",
    xp: 70,
    desc: "A log file was created as root by mistake. Change the owner to `ubuntu` and the group to `developers` so the application can append to it.",
    objective: "Change owner to ubuntu and group to developers on app.log.",
    validCommands: [
      /^(sudo\s+)?chown\s+ubuntu:developers\s+app\.log$/,
      /^(sudo\s+)?chown\s+ubuntu\.developers\s+app\.log$/
    ],
    hint: "Use 'chown USER:GROUP app.log'.",
    explanation: {
      command: "sudo chown ubuntu:developers app.log",
      breakdown: [
        { part: "chown", desc: "Change file owner and group." },
        { part: "ubuntu:developers", desc: "Sets the owning user to 'ubuntu' and the owning group to 'developers'." }
      ],
      proTip: "Use `chown -R` to change ownership recursively across an entire directory tree."
    },
    simulatedOutput: "[Ownership changed: app.log -> ubuntu:developers]",
    initialFs: {
      name: "/var/log/myapp",
      type: "dir",
      isCurrent: true,
      children: [
        { name: "app.log", type: "file", size: "120KB", owner: "root:root", perm: "-rw-r--r--" }
      ]
    },
    updatedFs: {
      name: "/var/log/myapp",
      type: "dir",
      isCurrent: true,
      children: [
        { name: "app.log", type: "file", size: "120KB", owner: "ubuntu:developers", perm: "-rw-r--r--" }
      ]
    }
  },
  {
    id: "LNX-PERM-05",
    topic: "permissions",
    title: "Deep Path Permission Audit with Namei",
    difficulty: "Intermediate",
    xp: 80,
    desc: "A service reports 'Permission denied' accessing `/opt/myapp/current/deploy.sh` even though `deploy.sh` is 777! Inspect permissions across every ancestor directory in the path.",
    objective: "Run namei with long listing format on /opt/myapp/current/deploy.sh.",
    validCommands: [
      /^namei\s+-l\s+\/opt\/myapp\/current\/deploy\.sh$/
    ],
    hint: "Use 'namei -l' followed by the target path.",
    explanation: {
      command: "namei -l /opt/myapp/current/deploy.sh",
      breakdown: [
        { part: "namei", desc: "Follows a path until a terminal point is found, inspecting permissions at each level." },
        { part: "-l", desc: "Prints permissions, owners, and symlink targets in long format." }
      ],
      proTip: "`namei -l` is the fastest way to detect if a parent directory (like `/opt` or `/root`) is missing execute/read bits."
    },
    simulatedOutput: "f: /opt/myapp/current/deploy.sh\ndrwxr-xr-x root root /\ndrwxr-xr-x root root opt\ndrwx------ root root myapp  <-- ROOT CAUSE: missing traversal permissions for others!\nlrwxrwxrwx root root current -> releases/v2.4\n-rwxr-xr-x root root deploy.sh",
    initialFs: {
      name: "/opt",
      type: "dir",
      children: [
        { name: "myapp", type: "dir", perm: "drwx------", children: [] }
      ]
    }
  },

  // ==========================================
  // TOPIC 5: USERS, GROUPS & PRIVILEGE MANAGEMENT (Module 5)
  // ==========================================
  {
    id: "LNX-USER-01",
    topic: "users_privileges",
    title: "Creating a System User with Home Directory",
    difficulty: "Beginner",
    xp: 60,
    desc: "Provision a new system user named `developer` complete with their standard home directory (`/home/developer`).",
    objective: "Create user developer with a home directory using sudo useradd.",
    validCommands: [
      /^sudo\s+useradd\s+-m\s+developer$/,
      /^sudo\s+useradd\s+--create-home\s+developer$/
    ],
    hint: "Use 'sudo useradd -m developer'.",
    explanation: {
      command: "sudo useradd -m developer",
      breakdown: [
        { part: "useradd", desc: "Low-level Linux utility to create a new user account." },
        { part: "-m", desc: "Creates the user's home directory if it does not exist." }
      ],
      proTip: "Always use `-m` so skeleton configuration files (`/etc/skel/.bashrc`) are copied automatically."
    },
    simulatedOutput: "[User developer created with home /home/developer]",
    initialFs: {
      name: "/home",
      type: "dir",
      children: [
        { name: "ubuntu", type: "dir", children: [] }
      ]
    },
    updatedFs: {
      name: "/home",
      type: "dir",
      children: [
        { name: "ubuntu", type: "dir", children: [] },
        { name: "developer", type: "dir", children: [] }
      ]
    }
  },
  {
    id: "LNX-USER-02",
    topic: "users_privileges",
    title: "Appending Supplementary Group Membership",
    difficulty: "Intermediate",
    xp: 70,
    desc: "Add user `developer` to the supplementary `developers` group without overwriting their existing group memberships.",
    objective: "Append supplementary group developers to user developer.",
    validCommands: [
      /^sudo\s+usermod\s+(-aG|-a\s+-G|-Ga)\s+developers\s+developer$/
    ],
    hint: "Use 'sudo usermod -aG GROUP USER'. Make sure to include '-a' for append!",
    explanation: {
      command: "sudo usermod -aG developers developer",
      breakdown: [
        { part: "usermod", desc: "Modify system user account." },
        { part: "-a", desc: "Append user to supplementary groups." },
        { part: "-G", desc: "Specifies the list of supplementary groups." }
      ],
      proTip: "CRITICAL: Leaving out `-a` when using `-G` removes the user from all other groups (e.g. losing sudo or docker access)!"
    },
    simulatedOutput: "[User developer added to group developers]",
    initialFs: {
      name: "/etc",
      type: "dir",
      children: [
        { name: "group", type: "file", size: "900B", perm: "-rw-r--r--" }
      ]
    }
  },
  {
    id: "LNX-USER-03",
    topic: "users_privileges",
    title: "Querying System User Database",
    difficulty: "Intermediate",
    xp: 60,
    desc: "Verify user `ubuntu` details directly from the system user database (NSS / passwd) using the standard administrative lookup tool.",
    objective: "Query user ubuntu with getent passwd.",
    validCommands: [
      /^getent\s+passwd\s+ubuntu$/,
      /^grep\s+\^ubuntu:\s+\/etc\/passwd$/
    ],
    hint: "Use 'getent passwd ubuntu'.",
    explanation: {
      command: "getent passwd ubuntu",
      breakdown: [
        { part: "getent", desc: "Get entries from Name Service Switch (NSS) databases." },
        { part: "passwd", desc: "Specifies the user password database." },
        { part: "ubuntu", desc: "Key to filter." }
      ],
      proTip: "`getent` is superior to `cat /etc/passwd` because it queries LDAP/Active Directory if integrated."
    },
    simulatedOutput: "ubuntu:x:1000:1000:Ubuntu:/home/ubuntu:/bin/bash",
    initialFs: {
      name: "/etc",
      type: "dir",
      children: [
        { name: "passwd", type: "file", size: "2.4KB", perm: "-rw-r--r--" }
      ]
    }
  },
  {
    id: "LNX-USER-04",
    topic: "users_privileges",
    title: "Auditing Effective Group Memberships",
    difficulty: "Beginner",
    xp: 50,
    desc: "Check which groups your current session belongs to.",
    objective: "Print group memberships with groups command.",
    validCommands: [
      /^groups$/,
      /^id\s+-Gn$/
    ],
    hint: "Type 'groups'.",
    explanation: {
      command: "groups",
      breakdown: [
        { part: "groups", desc: "Displays the group names the current user belongs to." }
      ],
      proTip: "If you just added yourself to a group, run `newgrp <group>` or re-login to apply changes."
    },
    simulatedOutput: "ubuntu adm cdrom sudo dip plugdev lxd docker",
    initialFs: {
      name: "/etc",
      type: "dir",
      children: [
        { name: "group", type: "file", size: "900B", perm: "-rw-r--r--" }
      ]
    }
  },

  // ==========================================
  // TOPIC 6: PIPES, REDIRECTION & STREAMS (Module 6)
  // ==========================================
  {
    id: "LNX-REDIR-01",
    topic: "redirection",
    title: "Redirecting Standard Output to Overwrite a File",
    difficulty: "Beginner",
    xp: 60,
    desc: "Generate a new configuration file `.env` containing `DATABASE_URL=postgres://localhost:5432/prod` using echo and output redirection.",
    objective: "Redirect echo output to create or overwrite .env.",
    validCommands: [
      /^echo\s+['"]DATABASE_URL=postgres:\/\/localhost:5432\/prod['"]\s+>\s+\.env$/
    ],
    hint: "Use `echo \"...\" > .env`.",
    explanation: {
      command: "echo 'DATABASE_URL=postgres://localhost:5432/prod' > .env",
      breakdown: [
        { part: "echo", desc: "Prints text to standard output." },
        { part: ">", desc: "Redirects standard output, overwriting the target file if it exists." }
      ],
      proTip: "Be careful: a single `>` truncates any existing data in the destination file instantly!"
    },
    simulatedOutput: "[Wrote to .env]",
    initialFs: {
      name: "/home/ubuntu/app",
      type: "dir",
      isCurrent: true,
      children: []
    },
    updatedFs: {
      name: "/home/ubuntu/app",
      type: "dir",
      isCurrent: true,
      children: [
        { name: ".env", type: "file", size: "52B", perm: "-rw-r--r--" }
      ]
    }
  },
  {
    id: "LNX-REDIR-02",
    topic: "redirection",
    title: "Appending Deployment Audit Logs",
    difficulty: "Beginner",
    xp: 60,
    desc: "Append the text `DEPLOY_STATUS=SUCCESS` to the end of `deploy.log` without overwriting the previous history.",
    objective: "Append text to deploy.log using >> redirection operator.",
    validCommands: [
      /^echo\s+['"]DEPLOY_STATUS=SUCCESS['"]\s+>>\s+deploy\.log$/
    ],
    hint: "Use double chevron '>>' to append.",
    explanation: {
      command: "echo 'DEPLOY_STATUS=SUCCESS' >> deploy.log",
      breakdown: [
        { part: ">>", desc: "Redirects standard output in append mode, preserving existing content." }
      ],
      proTip: "Use `>>` for all logging and audit trails to prevent accidental data loss."
    },
    simulatedOutput: "[Appended to deploy.log]",
    initialFs: {
      name: "/home/ubuntu/app",
      type: "dir",
      isCurrent: true,
      children: [
        { name: "deploy.log", type: "file", size: "12KB", perm: "-rw-r--r--" }
      ]
    }
  },
  {
    id: "LNX-REDIR-03",
    topic: "redirection",
    title: "Silencing Standard Error to /dev/null",
    difficulty: "Intermediate",
    xp: 70,
    desc: "Search for all `.conf` files across `/etc`, but discard all 'Permission denied' error messages into the Linux null device.",
    objective: "Find .conf files in /etc with 2>/dev/null.",
    validCommands: [
      /^find\s+\/etc\s+-name\s+['"]\*\.conf['"]\s+2>\s*\/dev\/null$/,
      /^find\s+\/etc\s+-name\s+\*\.conf\s+2>\s*\/dev\/null$/
    ],
    hint: "Use 'find /etc -name \"*.conf\" 2>/dev/null'.",
    explanation: {
      command: "find /etc -name '*.conf' 2>/dev/null",
      breakdown: [
        { part: "2>", desc: "Redirects File Descriptor 2 (Standard Error)." },
        { part: "/dev/null", desc: "The black-hole virtual device that discards all data written to it." }
      ],
      proTip: "To redirect both stdout and stderr together, use `&> output.log` or `> output.log 2>&1`."
    },
    simulatedOutput: "/etc/nginx/nginx.conf\n/etc/sysctl.conf\n/etc/resolv.conf",
    initialFs: {
      name: "/etc",
      type: "dir",
      children: [
        { name: "nginx", type: "dir", children: [] }
      ]
    }
  },
  {
    id: "LNX-REDIR-04",
    topic: "redirection",
    title: "Duplicating Streams with Tee",
    difficulty: "Intermediate",
    xp: 70,
    desc: "Run `df -h` to see disk capacity on your screen while simultaneously saving that exact output into `disk-report.txt`.",
    objective: "Pipe df -h output into tee disk-report.txt.",
    validCommands: [
      /^df\s+-h\s+\|\s+tee\s+disk-report\.txt$/,
      /^df\s+-h\s+\|\s+tee\s+-a\s+disk-report\.txt$/
    ],
    hint: "Use 'df -h | tee disk-report.txt'.",
    explanation: {
      command: "df -h | tee disk-report.txt",
      breakdown: [
        { part: "|", desc: "Pipe: routes stdout of `df -h` into `tee`'s stdin." },
        { part: "tee", desc: "Splits input stream: writes to specified file AND prints to terminal screen." }
      ],
      proTip: "Use `sudo tee` when you need to write redirected output to a file owned by root (e.g. `echo 'nameserver 8.8.8.8' | sudo tee /etc/resolv.conf`)."
    },
    simulatedOutput: "Filesystem      Size  Used Avail Use% Mounted on\n/dev/root        29G  8.2G   21G  29% /\n[Written to disk-report.txt & displayed on terminal]",
    initialFs: {
      name: "/home/ubuntu",
      type: "dir",
      isCurrent: true,
      children: []
    },
    updatedFs: {
      name: "/home/ubuntu",
      type: "dir",
      isCurrent: true,
      children: [
        { name: "disk-report.txt", type: "file", size: "240B", perm: "-rw-r--r--" }
      ]
    }
  },

  // ==========================================
  // TOPIC 7: SEARCHING & FILTERING WITH GREP & FIND (Module 7)
  // ==========================================
  {
    id: "LNX-GREP-01",
    topic: "search_grep",
    title: "Case-Insensitive Error Scan",
    difficulty: "Beginner",
    xp: 60,
    desc: "Scan `/var/log/syslog` for any occurrences of 'error', catching both uppercase 'ERROR', lowercase 'error', and mixed case 'Error'.",
    objective: "Search case-insensitively for error in /var/log/syslog.",
    validCommands: [
      /^(sudo\s+)?grep\s+-i\s+['"]?error['"]?\s+\/var\/log\/syslog$/,
      /^(sudo\s+)?grep\s+--ignore-case\s+['"]?error['"]?\s+\/var\/log\/syslog$/
    ],
    hint: "Use 'grep -i error /var/log/syslog'.",
    explanation: {
      command: "grep -i 'error' /var/log/syslog",
      breakdown: [
        { part: "grep", desc: "Global Regular Expression Print." },
        { part: "-i", desc: "Ignore case distinctions in patterns and input data." }
      ],
      proTip: "Add `-c` to get just the count of matching error lines without printing them all."
    },
    simulatedOutput: "Oct 29 14:02:11 kernel: [Hardware Error]: CPU 0: Machine Check Exception\nOct 29 14:05:00 myapp[1042]: ERROR: Connection pool exhausted\nOct 29 14:06:12 systemd[1]: Failed to start nginx.service: Unit entered failed state.",
    initialFs: {
      name: "/var/log",
      type: "dir",
      children: [
        { name: "syslog", type: "file", size: "1.4MB", perm: "-rw-r-----" }
      ]
    }
  },
  {
    id: "LNX-GREP-02",
    topic: "search_grep",
    title: "Recursive Secret & Token Hunting",
    difficulty: "Intermediate",
    xp: 70,
    desc: "A developer accidentally committed secrets. Search recursively through the current directory for any occurrence of 'API_KEY' with line numbers.",
    objective: "Recursively search with line numbers for API_KEY.",
    validCommands: [
      /^grep\s+(-rn|-nr)\s+['"]?API_KEY['"]?\s+\.?$/,
      /^grep\s+-r\s+-n\s+['"]?API_KEY['"]?\s+\.?$/,
      /^grep\s+-rn\s+['"]?API_KEY['"]?$/
    ],
    hint: "Use 'grep -rn API_KEY .' (-r for recursive, -n for line numbers).",
    explanation: {
      command: "grep -rn 'API_KEY' .",
      breakdown: [
        { part: "grep", desc: "Search pattern." },
        { part: "-r", desc: "Recursively read all files under each directory." },
        { part: "-n", desc: "Prefix each line of output with the 1-based line number within its file." }
      ],
      proTip: "Combine with `--exclude-dir={node_modules,.git}` to avoid scanning massive dependency trees."
    },
    simulatedOutput: "config/auth.env:14: AWS_API_KEY=AKIAIOSFODNN7EXAMPLE\nscripts/test.py:42: API_KEY = 'sk-live-992348123'",
    initialFs: {
      name: "/app",
      type: "dir",
      isCurrent: true,
      children: [
        {
          name: "config",
          type: "dir",
          children: [
            { name: "auth.env", type: "file", size: "1.2KB", perm: "-rw-------" }
          ]
        },
        {
          name: "scripts",
          type: "dir",
          children: [
            { name: "test.py", type: "file", size: "3.5KB", perm: "-rw-r--r--" }
          ]
        }
      ]
    }
  },
  {
    id: "LNX-GREP-03",
    topic: "search_grep",
    title: "Inverted Grep Filter (Noise Reduction)",
    difficulty: "Intermediate",
    xp: 60,
    desc: "The application log `app.log` is flooded with routine DEBUG lines. Inspect `app.log` filtering OUT all lines that contain `DEBUG`.",
    objective: "Filter out lines containing DEBUG from app.log using inverted match.",
    validCommands: [
      /^grep\s+-v\s+['"]?DEBUG['"]?\s+app\.log$/,
      /^grep\s+--invert-match\s+['"]?DEBUG['"]?\s+app\.log$/
    ],
    hint: "Use 'grep -v DEBUG app.log'.",
    explanation: {
      command: "grep -v 'DEBUG' app.log",
      breakdown: [
        { part: "-v", desc: "Invert match: select non-matching lines only." }
      ],
      proTip: "Use `grep -v '^#' /etc/nginx/nginx.conf | grep -v '^$'` to strip both comments and blank lines from configs!"
    },
    simulatedOutput: "2026-10-29 14:00:01 INFO Server started on port 3000\n2026-10-29 14:02:11 WARN High memory usage detected: 84%\n2026-10-29 14:03:00 ERROR Database query timed out after 5000ms",
    initialFs: {
      name: "/var/log/myapp",
      type: "dir",
      isCurrent: true,
      children: [
        { name: "app.log", type: "file", size: "85KB", perm: "-rw-r--r--" }
      ]
    }
  },
  {
    id: "LNX-GREP-04",
    topic: "search_grep",
    title: "Locating Giant Runaway Log Files",
    difficulty: "Intermediate",
    xp: 80,
    desc: "Disk space alert: Find all regular files in `/var/log` that are larger than 100 Megabytes.",
    objective: "Find files in /var/log with size greater than 100M.",
    validCommands: [
      /^(sudo\s+)?find\s+\/var\/log\s+(-type\s+f\s+)?-size\s+\+100M(\s+-print)?$/,
      /^(sudo\s+)?find\s+\/var\/log\s+-size\s+\+100M\s+-type\s+f(\s+-print)?$/
    ],
    hint: "Use 'find /var/log -type f -size +100M'.",
    explanation: {
      command: "find /var/log -type f -size +100M",
      breakdown: [
        { part: "find /var/log", desc: "Search root path." },
        { part: "-type f", desc: "Restricts results to regular files (ignoring directories)." },
        { part: "-size +100M", desc: "Matches files strictly larger than 100 Megabytes." }
      ],
      proTip: "Append `-exec ls -lh {} +` to see exact sizes directly from find!"
    },
    simulatedOutput: "/var/log/journal/runaway_system.log (1.4GB)\n/var/log/nginx/access_huge.log (450MB)",
    initialFs: {
      name: "/var/log",
      type: "dir",
      children: [
        { name: "access_huge.log", type: "file", size: "450MB", perm: "-rw-r--r--" },
        { name: "syslog", type: "file", size: "2.1MB", perm: "-rw-r--r--" }
      ]
    }
  },
  {
    id: "LNX-GREP-05",
    topic: "search_grep",
    title: "Finding Configuration Files by Name",
    difficulty: "Beginner",
    xp: 60,
    desc: "Search the `/etc` directory for any file ending with the `.conf` extension.",
    objective: "Find all .conf files under /etc.",
    validCommands: [
      /^(sudo\s+)?find\s+\/etc\s+-name\s+['"]\*\.conf['"]$/,
      /^(sudo\s+)?find\s+\/etc\s+-type\s+f\s+-name\s+['"]\*\.conf['"]$/
    ],
    hint: "Use 'find /etc -name \"*.conf\"'. Always quote glob patterns!",
    explanation: {
      command: "find /etc -name '*.conf'",
      breakdown: [
        { part: "-name '*.conf'", desc: "Matches file names ending with .conf." }
      ],
      proTip: "Always put quotes around `*.conf` so the current shell does not expand the asterisk before find receives it."
    },
    simulatedOutput: "/etc/nginx/nginx.conf\n/etc/resolv.conf\n/etc/security/limits.conf\n/etc/sysctl.conf",
    initialFs: {
      name: "/etc",
      type: "dir",
      children: [
        { name: "resolv.conf", type: "file", size: "120B", perm: "-rw-r--r--" },
        { name: "sysctl.conf", type: "file", size: "2.4KB", perm: "-rw-r--r--" }
      ]
    }
  },

  // ==========================================
  // TOPIC 8: TEXT PROCESSING & LOG ANALYSIS (Module 8)
  // ==========================================
  {
    id: "LNX-TEXT-01",
    topic: "text_processing",
    title: "Streaming Real-Time Log Tails",
    difficulty: "Beginner",
    xp: 60,
    desc: "You just triggered a test payment. Follow and stream incoming entries appended to `/var/log/myapp.log` in real time as they arrive.",
    objective: "Stream live logs from /var/log/myapp.log using tail -f.",
    validCommands: [
      /^(sudo\s+)?tail\s+-f\s+\/var\/log\/myapp\.log$/,
      /^(sudo\s+)?tail\s+-F\s+\/var\/log\/myapp\.log$/
    ],
    hint: "Use 'tail -f /var/log/myapp.log'.",
    explanation: {
      command: "tail -f /var/log/myapp.log",
      breakdown: [
        { part: "tail", desc: "Output the last part of files." },
        { part: "-f", desc: "Follow: output appended data as the file grows." }
      ],
      proTip: "Use `tail -F` (capital F) if the log undergoes logrotate so tail reopens the file by name when rotated!"
    },
    simulatedOutput: "[Streaming /var/log/myapp.log live... Press Ctrl+C to stop]\n2026-10-29 14:10:01 POST /api/v1/checkout 200 OK (45ms)\n2026-10-29 14:10:02 POST /api/v1/checkout 200 OK (38ms)",
    initialFs: {
      name: "/var/log",
      type: "dir",
      children: [
        { name: "myapp.log", type: "file", size: "48KB", perm: "-rw-r--r--" }
      ]
    }
  },
  {
    id: "LNX-TEXT-02",
    topic: "text_processing",
    title: "Column Extraction with AWK",
    difficulty: "Intermediate",
    xp: 70,
    desc: "Given web server `access.log`, extract only the first column (the client IP addresses) using awk.",
    objective: "Print the first column of access.log using awk.",
    validCommands: [
      /^awk\s+['"]\{print\s+\$1\}['"]\s+access\.log$/
    ],
    hint: "Use `awk '{print $1}' access.log`.",
    explanation: {
      command: "awk '{print $1}' access.log",
      breakdown: [
        { part: "awk", desc: "Pattern scanning and text processing language." },
        { part: "'{print $1}'", desc: "Prints field #1 (space-delimited by default)." }
      ],
      proTip: "Use `awk -F: '{print $1}' /etc/passwd` to change the field separator to a colon."
    },
    simulatedOutput: "192.168.1.50\n10.0.0.12\n172.16.0.4\n192.168.1.50",
    initialFs: {
      name: "/var/log/nginx",
      type: "dir",
      isCurrent: true,
      children: [
        { name: "access.log", type: "file", size: "14KB", perm: "-rw-r--r--" }
      ]
    }
  },
  {
    id: "LNX-TEXT-03",
    topic: "text_processing",
    title: "Stream Text Replacement with SED",
    difficulty: "Intermediate",
    xp: 70,
    desc: "Replace all occurrences of `localhost` with `127.0.0.1` in `config.env` using stream editor sed.",
    objective: "Substitute localhost with 127.0.0.1 globally in config.env.",
    validCommands: [
      /^sed\s+['"]s\/localhost\/127\.0\.0\.1\/g['"]\s+config\.env$/,
      /^sed\s+-i\s+['"]s\/localhost\/127\.0\.0\.1\/g['"]\s+config\.env$/
    ],
    hint: "Use `sed 's/localhost/127.0.0.1/g' config.env`.",
    explanation: {
      command: "sed 's/localhost/127.0.0.1/g' config.env",
      breakdown: [
        { part: "sed", desc: "Stream editor." },
        { part: "s/old/new/g", desc: "Substitute 'old' with 'new' globally across every line." }
      ],
      proTip: "Add `-i` (e.g. `sed -i.bak ...`) to apply edits directly in-place while saving a backup copy."
    },
    simulatedOutput: "HOST=127.0.0.1\nDB_HOST=127.0.0.1\nREDIS_URL=redis://127.0.0.1:6379",
    initialFs: {
      name: "/app",
      type: "dir",
      isCurrent: true,
      children: [
        { name: "config.env", type: "file", size: "120B", perm: "-rw-r--r--" }
      ]
    }
  },
  {
    id: "LNX-TEXT-04",
    topic: "text_processing",
    title: "Counting Unique Occurrences (Sort | Uniq)",
    difficulty: "Intermediate",
    xp: 80,
    desc: "From `access.log`, identify the most frequent visitors by counting occurrences of each sorted IP.",
    objective: "Sort access.log and count occurrences with uniq -c.",
    validCommands: [
      /^sort\s+access\.log\s+\|\s+uniq\s+-c$/,
      /^sort\s+access\.log\s+\|\s+uniq\s+-c\s+\|\s+sort\s+-nr$/
    ],
    hint: "Pipe sort into uniq with the count flag: 'sort access.log | uniq -c'.",
    explanation: {
      command: "sort access.log | uniq -c",
      breakdown: [
        { part: "sort", desc: "Orders text lines so duplicate values become adjacent." },
        { part: "uniq -c", desc: "Prefixes each unique line with its number of occurrences." }
      ],
      proTip: "Remember: `uniq` ONLY detects adjacent duplicates. You MUST always run `sort` before `uniq`!"
    },
    simulatedOutput: "   42 192.168.1.50\n   18 10.0.0.12\n    3 172.16.0.4",
    initialFs: {
      name: "/var/log/nginx",
      type: "dir",
      isCurrent: true,
      children: [
        { name: "access.log", type: "file", size: "14KB", perm: "-rw-r--r--" }
      ]
    }
  },
  {
    id: "LNX-TEXT-05",
    topic: "text_processing",
    title: "Extracting Delimited Fields with Cut",
    difficulty: "Beginner",
    xp: 60,
    desc: "Extract the list of all usernames from `/etc/passwd` by extracting field 1 delimited by a colon `:`. ",
    objective: "Extract field 1 from /etc/passwd with cut using colon delimiter.",
    validCommands: [
      /^cut\s+-d:\s+-f1\s+\/etc\/passwd$/,
      /^cut\s+-d\s*['"]?:['"]?\s+-f\s*1\s+\/etc\/passwd$/
    ],
    hint: "Use 'cut -d: -f1 /etc/passwd'.",
    explanation: {
      command: "cut -d: -f1 /etc/passwd",
      breakdown: [
        { part: "cut", desc: "Remove sections from each line of files." },
        { part: "-d:", desc: "Use colon ':' as the field delimiter." },
        { part: "-f1", desc: "Select and output field number 1." }
      ],
      proTip: "`cut` is lightweight and ultra-fast for structured CSV, TSV, or passwd files."
    },
    simulatedOutput: "root\ndaemon\nbin\nsys\nsync\nubuntu\ndeveloper",
    initialFs: {
      name: "/etc",
      type: "dir",
      children: [
        { name: "passwd", type: "file", size: "2.4KB", perm: "-rw-r--r--" }
      ]
    }
  },

  // ==========================================
  // TOPIC 9: PROCESS MANAGEMENT & SIGNALS (Module 9)
  // ==========================================
  {
    id: "LNX-PROC-01",
    topic: "processes",
    title: "Filtering Running Processes",
    difficulty: "Beginner",
    xp: 60,
    desc: "Verify whether the Nginx web server process is actively running in the process table.",
    objective: "Filter running processes for nginx with ps aux | grep nginx.",
    validCommands: [
      /^ps\s+aux\s+\|\s+grep\s+['"]?nginx['"]?$/,
      /^pgrep\s+(-l\s+)?nginx$/
    ],
    hint: "Use 'ps aux | grep nginx'.",
    explanation: {
      command: "ps aux | grep nginx",
      breakdown: [
        { part: "ps aux", desc: "Lists all running processes across all users with full command lines." },
        { part: "| grep nginx", desc: "Filters the output for lines containing 'nginx'." }
      ],
      proTip: "Use `grep '[n]ginx'` trick to avoid matching the grep process itself in the ps output!"
    },
    simulatedOutput: "root      1024  0.0  0.2  14232  4200 ?  Ss   12:00   0:00 nginx: master process /usr/sbin/nginx\nwww-data  1025  0.1  0.4  14890  8120 ?  S    12:00   0:02 nginx: worker process",
    initialFs: {
      name: "/proc",
      type: "dir",
      children: [
        { name: "1024", type: "dir", children: [] },
        { name: "1025", type: "dir", children: [] }
      ]
    }
  },
  {
    id: "LNX-PROC-02",
    topic: "processes",
    title: "Hunting CPU-Intensive Processes",
    difficulty: "Intermediate",
    xp: 70,
    desc: "The node is experiencing sudden CPU spikes. List the top 10 processes consuming the most CPU percentage.",
    objective: "Sort processes by %cpu descending and show the top 10.",
    validCommands: [
      /^ps\s+aux\s+--sort=-%cpu\s+\|\s+head(\s+-n\s+10)?$/,
      /^ps\s+aux\s+--sort\s+-%cpu\s+\|\s+head(\s+-n\s+10)?$/
    ],
    hint: "Use 'ps aux --sort=-%cpu | head -n 10'.",
    explanation: {
      command: "ps aux --sort=-%cpu | head -n 10",
      breakdown: [
        { part: "--sort=-%cpu", desc: "Sorts processes in descending order of CPU consumption." },
        { part: "head -n 10", desc: "Limits the output to the top 10 offending lines." }
      ],
      proTip: "To sort by memory instead, use `ps aux --sort=-%mem | head -n 10`."
    },
    simulatedOutput: "USER       PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND\nnode      4512 98.4  6.2 892340 128400 ?       R    13:45  15:20 node server.js\nroot      1024  1.2  0.2  14232   4200 ?       Ss   12:00   0:00 nginx: master",
    initialFs: {
      name: "/proc",
      type: "dir",
      children: [
        { name: "4512", type: "dir", children: [] }
      ]
    }
  },
  {
    id: "LNX-PROC-03",
    topic: "processes",
    title: "Graceful Process Termination (SIGTERM)",
    difficulty: "Intermediate",
    xp: 60,
    desc: "A background batch worker with PID 1042 needs to shut down cleanly, finishing open transactions and closing socket handles. Send the standard graceful termination signal.",
    objective: "Terminate PID 1042 gracefully using SIGTERM (signal 15).",
    validCommands: [
      /^kill\s+(-15|-SIGTERM)\s+1042$/,
      /^kill\s+1042$/
    ],
    hint: "Use 'kill 1042' or 'kill -15 1042'.",
    explanation: {
      command: "kill -15 1042",
      breakdown: [
        { part: "kill", desc: "Sends a signal to a process." },
        { part: "-15 (SIGTERM)", desc: "Requests graceful termination, allowing application cleanup handlers to run." }
      ],
      proTip: "Always try `SIGTERM (15)` first. Only resort to `SIGKILL (9)` if the process is completely hung."
    },
    simulatedOutput: "[Signal 15 (SIGTERM) sent to PID 1042. Process completed graceful shutdown.]",
    initialFs: {
      name: "/proc",
      type: "dir",
      children: [
        { name: "1042", type: "dir", children: [] }
      ]
    },
    updatedFs: {
      name: "/proc",
      type: "dir",
      children: []
    }
  },
  {
    id: "LNX-PROC-04",
    topic: "processes",
    title: "Forceful Termination (SIGKILL)",
    difficulty: "Intermediate",
    xp: 60,
    desc: "A rogue cryptominer with PID 9999 is ignoring SIGTERM and consuming 100% CPU. Send the uncatchable forceful kill signal to terminate it immediately.",
    objective: "Force kill PID 9999 with SIGKILL (-9).",
    validCommands: [
      /^(sudo\s+)?kill\s+(-9|-SIGKILL)\s+9999$/
    ],
    hint: "Use 'kill -9 9999'.",
    explanation: {
      command: "kill -9 9999",
      breakdown: [
        { part: "-9 (SIGKILL)", desc: "Immediately terminates the process at the kernel level without giving it a chance to handle or ignore the signal." }
      ],
      proTip: "SIGKILL cannot be caught, blocked, or ignored. Use with caution as it can leave unclosed database locks or temporary files."
    },
    simulatedOutput: "[Signal 9 (SIGKILL) sent to PID 9999. Terminated by kernel.]",
    initialFs: {
      name: "/proc",
      type: "dir",
      children: [
        { name: "9999", type: "dir", children: [] }
      ]
    },
    updatedFs: {
      name: "/proc",
      type: "dir",
      children: []
    }
  },
  {
    id: "LNX-PROC-05",
    topic: "processes",
    title: "Pattern-Based Process Termination (pkill)",
    difficulty: "Intermediate",
    xp: 70,
    desc: "Multiple orphaned worker processes running `celery_worker.py` are stuck. Terminate all of them matching the process command line pattern.",
    objective: "Terminate processes matching celery_worker.py using pkill.",
    validCommands: [
      /^(sudo\s+)?pkill\s+-f\s+celery_worker\.py$/,
      /^(sudo\s+)?pkill\s+celery_worker/
    ],
    hint: "Use 'pkill -f celery_worker.py'.",
    explanation: {
      command: "pkill -f celery_worker.py",
      breakdown: [
        { part: "pkill", desc: "Signal processes based on name and other attributes." },
        { part: "-f", desc: "Matches against the full command line argument string instead of just the process executable name." }
      ],
      proTip: "Run `pgrep -fl <pattern>` first to verify which processes will be hit before running `pkill`."
    },
    simulatedOutput: "[Terminated 4 processes matching pattern 'celery_worker.py']",
    initialFs: {
      name: "/proc",
      type: "dir",
      children: [
        { name: "201", type: "dir", children: [] },
        { name: "202", type: "dir", children: [] }
      ]
    }
  },

  // ==========================================
  // TOPIC 10: SERVICES & SYSTEMD (Module 10)
  // ==========================================
  {
    id: "LNX-SVC-01",
    topic: "services_systemd",
    title: "Checking Service Health & Status",
    difficulty: "Beginner",
    xp: 60,
    desc: "An alert fired indicating the `nginx` web server is unreachable. Check its current systemd service status and active state.",
    objective: "Check nginx service status with systemctl.",
    validCommands: [
      /^(sudo\s+)?systemctl\s+status\s+nginx(\.service)?$/
    ],
    hint: "Use 'systemctl status nginx'.",
    explanation: {
      command: "systemctl status nginx",
      breakdown: [
        { part: "systemctl", desc: "Control the systemd system and service manager." },
        { part: "status", desc: "Shows whether the unit is active, loaded, memory/CPU usage, and recent log snippets." }
      ],
      proTip: "Use `systemctl is-active <unit>` in automated shell scripts to get a clean 'active' or 'inactive' exit code."
    },
    simulatedOutput: "● nginx.service - A high performance web server and a reverse proxy server\n     Loaded: loaded (/lib/systemd/system/nginx.service; enabled; vendor preset: enabled)\n     Active: active (running) since Wed 2026-10-29 12:00:15 UTC; 2h ago\n   Main PID: 1024 (nginx)",
    initialFs: {
      name: "/etc/systemd/system",
      type: "dir",
      children: [
        { name: "nginx.service", type: "file", size: "1.1KB", perm: "-rw-r--r--" }
      ]
    }
  },
  {
    id: "LNX-SVC-02",
    topic: "services_systemd",
    title: "Restarting an Application Service",
    difficulty: "Beginner",
    xp: 60,
    desc: "You updated `myapp.conf`. Restart the `myapp` systemd service to reload the updated configuration into memory.",
    objective: "Restart myapp service using systemctl.",
    validCommands: [
      /^(sudo\s+)?systemctl\s+restart\s+myapp(\.service)?$/
    ],
    hint: "Use 'sudo systemctl restart myapp'.",
    explanation: {
      command: "sudo systemctl restart myapp",
      breakdown: [
        { part: "restart", desc: "Stops and immediately starts the specified service unit." }
      ],
      proTip: "If the service supports graceful reloads without dropping client connections, use `systemctl reload` instead."
    },
    simulatedOutput: "[myapp.service restarted successfully]",
    initialFs: {
      name: "/etc/systemd/system",
      type: "dir",
      children: [
        { name: "myapp.service", type: "file", size: "850B", perm: "-rw-r--r--" }
      ]
    }
  },
  {
    id: "LNX-SVC-03",
    topic: "services_systemd",
    title: "Enabling Service Auto-Start on Boot",
    difficulty: "Beginner",
    xp: 60,
    desc: "Ensure that `myapp.service` automatically starts whenever the Linux server reboots.",
    objective: "Enable myapp service to auto-start on boot.",
    validCommands: [
      /^(sudo\s+)?systemctl\s+enable\s+myapp(\.service)?$/
    ],
    hint: "Use 'sudo systemctl enable myapp'.",
    explanation: {
      command: "sudo systemctl enable myapp",
      breakdown: [
        { part: "enable", desc: "Creates symlinks in target directories (e.g. `/etc/systemd/system/multi-user.target.wants/`) so systemd boots the service automatically." }
      ],
      proTip: "Use `systemctl enable --now <service>` to enable auto-start AND start it immediately in one command."
    },
    simulatedOutput: "Created symlink /etc/systemd/system/multi-user.target.wants/myapp.service → /etc/systemd/system/myapp.service.",
    initialFs: {
      name: "/etc/systemd/system",
      type: "dir",
      children: [
        { name: "myapp.service", type: "file", size: "850B", perm: "-rw-r--r--" }
      ]
    }
  },
  {
    id: "LNX-SVC-04",
    topic: "services_systemd",
    title: "Reloading Systemd Daemon After Unit Edits",
    difficulty: "Intermediate",
    xp: 70,
    desc: "You modified `/etc/systemd/system/myapp.service` with a new environment variable. Tell systemd to re-scan unit files from disk.",
    objective: "Reload systemd manager configuration.",
    validCommands: [
      /^(sudo\s+)?systemctl\s+daemon-reload$/
    ],
    hint: "Use 'sudo systemctl daemon-reload'.",
    explanation: {
      command: "sudo systemctl daemon-reload",
      breakdown: [
        { part: "daemon-reload", desc: "Reload the systemd manager configuration, re-running all generators and reloading all unit files." }
      ],
      proTip: "If you change a `.service` file without running `daemon-reload`, systemd will warn you that the unit file on disk was modified."
    },
    simulatedOutput: "[Systemd daemon configuration reloaded]",
    initialFs: {
      name: "/etc/systemd/system",
      type: "dir",
      children: [
        { name: "myapp.service", type: "file", size: "900B", perm: "-rw-r--r--" }
      ]
    }
  },

  // ==========================================
  // TOPIC 11: LOGS & JOURNAL MANAGEMENT (Module 11)
  // ==========================================
  {
    id: "LNX-LOG-01",
    topic: "logs_journal",
    title: "Inspecting Recent Unit Logs Without Pager",
    difficulty: "Beginner",
    xp: 60,
    desc: "Inspect the last 100 log lines of `myapp` using journalctl without opening an interactive pager.",
    objective: "View last 100 lines of myapp logs with journalctl --no-pager.",
    validCommands: [
      /^(sudo\s+)?journalctl\s+-u\s+myapp(\.service)?\s+-n\s+100\s+--no-pager$/,
      /^(sudo\s+)?journalctl\s+-u\s+myapp(\.service)?\s+--no-pager\s+-n\s+100$/
    ],
    hint: "Use 'journalctl -u myapp -n 100 --no-pager'.",
    explanation: {
      command: "journalctl -u myapp -n 100 --no-pager",
      breakdown: [
        { part: "journalctl", desc: "Query the systemd journal database." },
        { part: "-u myapp", desc: "Filter by systemd unit name." },
        { part: "-n 100", desc: "Limit output to the last 100 entries." },
        { part: "--no-pager", desc: "Print directly to stdout instead of piping into less." }
      ],
      proTip: "--no-pager is vital when running troubleshooting commands through SSH or CI/CD pipelines."
    },
    simulatedOutput: "Oct 29 14:15:00 ip-172-31-42-12 myapp[1042]: [INFO] Worker cluster booted\nOct 29 14:15:02 ip-172-31-42-12 myapp[1042]: [ERROR] Redis connection refused on 127.0.0.1:6379",
    initialFs: {
      name: "/var/log/journal",
      type: "dir",
      children: [
        { name: "system.journal", type: "file", size: "32MB", perm: "-rw-r-----" }
      ]
    }
  },
  {
    id: "LNX-LOG-02",
    topic: "logs_journal",
    title: "Filtering Journal by Time Window",
    difficulty: "Intermediate",
    xp: 70,
    desc: "A deployment occurred 30 minutes ago and customers reported failures. Query journalctl for `myapp` logs strictly since 30 minutes ago.",
    objective: "Filter myapp journal logs since 30 minutes ago.",
    validCommands: [
      /^(sudo\s+)?journalctl\s+-u\s+myapp(\.service)?\s+--since\s+['"]30\s+minutes\s+ago['"]$/,
      /^(sudo\s+)?journalctl\s+-u\s+myapp(\.service)?\s+--since\s+['"]-30m['"]$/
    ],
    hint: "Use `journalctl -u myapp --since \"30 minutes ago\"`.",
    explanation: {
      command: "journalctl -u myapp --since '30 minutes ago'",
      breakdown: [
        { part: "--since", desc: "Shows entries not older than the specified relative or absolute date/time." }
      ],
      proTip: "You can also specify timestamps like `--since \"2026-10-29 14:00:00\" --until \"2026-10-29 14:30:00\"`."
    },
    simulatedOutput: "Oct 29 14:00:10 ip-172-31-42-12 myapp[1042]: Deployment v2.4 initialized\nOct 29 14:01:22 ip-172-31-42-12 myapp[1042]: TypeError: Cannot read property 'port' of undefined",
    initialFs: {
      name: "/var/log/journal",
      type: "dir",
      children: [
        { name: "system.journal", type: "file", size: "32MB", perm: "-rw-r-----" }
      ]
    }
  },
  {
    id: "LNX-LOG-03",
    topic: "logs_journal",
    title: "Live Following of Service Journal",
    difficulty: "Beginner",
    xp: 60,
    desc: "Stream and follow the systemd logs of `myapp` in real time as new entries are generated.",
    objective: "Follow myapp journal logs live with journalctl -f.",
    validCommands: [
      /^(sudo\s+)?journalctl\s+-u\s+myapp(\.service)?\s+-f$/,
      /^(sudo\s+)?journalctl\s+-f\s+-u\s+myapp(\.service)?$/
    ],
    hint: "Use 'journalctl -u myapp -f'.",
    explanation: {
      command: "journalctl -u myapp -f",
      breakdown: [
        { part: "-f", desc: "Follow: continuously print new log entries as they are added to the journal." }
      ],
      proTip: "Combine `-f` with `-e` (`journalctl -u myapp -fe`) to jump straight to the end of the pager and follow."
    },
    simulatedOutput: "[Following myapp journal... Press Ctrl+C to exit]\nOct 29 14:20:00 ip-172-31-42-12 myapp[1042]: Health check ping 200 OK",
    initialFs: {
      name: "/var/log/journal",
      type: "dir",
      children: [
        { name: "system.journal", type: "file", size: "32MB", perm: "-rw-r-----" }
      ]
    }
  },
  {
    id: "LNX-LOG-04",
    topic: "logs_journal",
    title: "Kernel Ring Buffer Diagnostics (dmesg)",
    difficulty: "Intermediate",
    xp: 70,
    desc: "A process was suddenly terminated with no error in its log. Check kernel ring buffer messages with human-readable timestamps to see if the Linux OOM (Out Of Memory) killer struck.",
    objective: "Print kernel ring buffer with human timestamps using dmesg -T.",
    validCommands: [
      /^(sudo\s+)?dmesg\s+-T(\s+\|\s+grep\s+-i\s+['"]?(oom|error|killed)['"]?)?$/,
      /^(sudo\s+)?dmesg\s+--ctime$/
    ],
    hint: "Use 'dmesg -T' (or 'dmesg -T | grep -i oom').",
    explanation: {
      command: "dmesg -T",
      breakdown: [
        { part: "dmesg", desc: "Display or control the kernel ring buffer." },
        { part: "-T", desc: "Print human-readable timestamps instead of seconds since system boot." }
      ],
      proTip: "If a Java or Node process mysteriously vanishes with exit code 137, check `dmesg -T | grep -i oom` immediately."
    },
    simulatedOutput: "[Wed Oct 29 14:12:00 2026] Out of memory: Killed process 4512 (node) total-vm:428900kB, anon-rss:398000kB",
    initialFs: {
      name: "/var/log",
      type: "dir",
      children: [
        { name: "dmesg", type: "file", size: "120KB", perm: "-rw-r-----" }
      ]
    }
  },

  // ==========================================
  // TOPIC 12: SCHEDULED JOBS & CRON (Module 12)
  // ==========================================
  {
    id: "LNX-CRON-01",
    topic: "cron_jobs",
    title: "Auditing User Cron Table",
    difficulty: "Beginner",
    xp: 50,
    desc: "Before scheduling new automation, list all existing scheduled cron jobs for your current user.",
    objective: "List current crontab entries.",
    validCommands: [
      /^crontab\s+-l$/
    ],
    hint: "Use 'crontab -l' (l for list).",
    explanation: {
      command: "crontab -l",
      breakdown: [
        { part: "crontab", desc: "Maintain crontab files for individual users." },
        { part: "-l", desc: "Displays the current user's crontab on standard output." }
      ],
      proTip: "Avoid running `crontab -r` by mistake! It deletes your entire crontab without confirmation!"
    },
    simulatedOutput: "# m h  dom mon dow   command\n0 2 * * * /home/ubuntu/backup.sh >> /home/ubuntu/backup.log 2>&1\n*/15 * * * * /opt/scripts/healthcheck.sh > /dev/null 2>&1",
    initialFs: {
      name: "/var/spool/cron/crontabs",
      type: "dir",
      children: [
        { name: "ubuntu", type: "file", size: "140B", perm: "-rw-------" }
      ]
    }
  },
  {
    id: "LNX-CRON-02",
    topic: "cron_jobs",
    title: "Verifying Cron Daemon Health",
    difficulty: "Beginner",
    xp: 60,
    desc: "Backups are not executing. Verify whether the `cron` service daemon is actively running on the system.",
    objective: "Check cron service status with systemctl.",
    validCommands: [
      /^(sudo\s+)?systemctl\s+status\s+cron(\.service)?$/,
      /^(sudo\s+)?systemctl\s+status\s+crond(\.service)?$/
    ],
    hint: "Use 'systemctl status cron' (or crond on RHEL).",
    explanation: {
      command: "systemctl status cron",
      breakdown: [
        { part: "systemctl status cron", desc: "Checks if the background cron daemon is alive and listening for schedules." }
      ],
      proTip: "On Debian/Ubuntu it is named `cron`, whereas on RedHat/CentOS/Amazon Linux it is named `crond`."
    },
    simulatedOutput: "● cron.service - Regular background program processing daemon\n     Active: active (running) since Wed 2026-10-29 08:00:00 UTC; 6h ago\n   Main PID: 620 (cron)",
    initialFs: {
      name: "/etc/systemd/system",
      type: "dir",
      children: [
        { name: "cron.service", type: "file", size: "820B", perm: "-rw-r--r--" }
      ]
    }
  },
  {
    id: "LNX-CRON-03",
    topic: "cron_jobs",
    title: "Auditing Cron Execution Logs Today",
    difficulty: "Intermediate",
    xp: 70,
    desc: "Inspect journal logs to see if cron executed the 02:00 AM job today.",
    objective: "Query cron logs since today in journalctl.",
    validCommands: [
      /^(sudo\s+)?journalctl\s+-u\s+cron\s+--since\s+today$/,
      /^(sudo\s+)?journalctl\s+-u\s+crond\s+--since\s+today$/
    ],
    hint: "Use 'sudo journalctl -u cron --since today'.",
    explanation: {
      command: "sudo journalctl -u cron --since today",
      breakdown: [
        { part: "journalctl -u cron", desc: "Filters for cron daemon actions." },
        { part: "--since today", desc: "Limits entries to today since midnight 00:00:00." }
      ],
      proTip: "Cron jobs run with a stripped PATH (`/usr/bin:/bin`). Always use absolute paths for binaries inside cron scripts!"
    },
    simulatedOutput: "Oct 29 02:00:01 ip-172-31-42-12 CRON[8920]: (ubuntu) CMD (/home/ubuntu/backup.sh >> /home/ubuntu/backup.log 2>&1)",
    initialFs: {
      name: "/var/log/journal",
      type: "dir",
      children: [
        { name: "system.journal", type: "file", size: "32MB", perm: "-rw-r-----" }
      ]
    }
  },

  // ==========================================
  // TOPIC 13: LINUX NETWORKING (Module 13)
  // ==========================================
  {
    id: "LNX-NET-01",
    topic: "networking",
    title: "Inspecting Network Interfaces & IP Addresses",
    difficulty: "Beginner",
    xp: 50,
    desc: "Find the primary internal IP address assigned to this Linux server using the modern `ip` tool.",
    objective: "Display network interfaces and addresses with ip addr.",
    validCommands: [
      /^ip\s+(addr|a|address)(\s+show)?$/
    ],
    hint: "Use 'ip addr' or 'ip a'.",
    explanation: {
      command: "ip addr",
      breakdown: [
        { part: "ip addr", desc: "Modern replacement for deprecated `ifconfig`. Displays IPv4 (`inet`) and IPv6 (`inet6`) addresses for each interface." }
      ],
      proTip: "Look for `eth0` or `ens5` to find your primary network interface."
    },
    simulatedOutput: "1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN\n    inet 127.0.0.1/8 scope host lo\n2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 9001 qdisc fq_codel state UP\n    inet 172.31.42.12/20 brd 172.31.47.255 scope global dynamic eth0",
    initialFs: {
      name: "/sys/class/net",
      type: "dir",
      children: [
        { name: "lo", type: "dir", children: [] },
        { name: "eth0", type: "dir", children: [] }
      ]
    }
  },
  {
    id: "LNX-NET-02",
    topic: "networking",
    title: "Checking Listening Sockets & Ports",
    difficulty: "Intermediate",
    xp: 70,
    desc: "A web application was started on port 3000. Inspect all listening TCP sockets and associated process PIDs to verify if port 3000 is open.",
    objective: "Inspect listening TCP sockets with ss filtered for port 3000.",
    validCommands: [
      /^(sudo\s+)?ss\s+-tulpn\s+\|\s+grep\s+['"]?:3000['"]?$/,
      /^(sudo\s+)?ss\s+-tlpn\s+\|\s+grep\s+['"]?:3000['"]?$/,
      /^(sudo\s+)?ss\s+-tulpn$/
    ],
    hint: "Use 'sudo ss -tulpn | grep \":3000\"'.",
    explanation: {
      command: "sudo ss -tulpn | grep ':3000'",
      breakdown: [
        { part: "ss", desc: "Socket Statistics: modern, high-performance replacement for `netstat`." },
        { part: "-t", desc: "TCP sockets." },
        { part: "-u", desc: "UDP sockets." },
        { part: "-l", desc: "Listening sockets only." },
        { part: "-p", desc: "Show process using socket (requires sudo)." },
        { part: "-n", desc: "Numeric ports (e.g. 3000 instead of service name)." }
      ],
      proTip: "If the local address shows `127.0.0.1:3000`, the server is bound only to localhost and will NOT accept external incoming traffic!"
    },
    simulatedOutput: "tcp   LISTEN 0      511          0.0.0.0:3000       0.0.0.0:*    users:((\"node\",pid=4512,fd=19))",
    initialFs: {
      name: "/proc/net",
      type: "dir",
      children: [
        { name: "tcp", type: "file", size: "0B", perm: "-r--r--r--" }
      ]
    }
  },
  {
    id: "LNX-NET-03",
    topic: "networking",
    title: "Testing HTTP Communication with Verbose Curl",
    difficulty: "Beginner",
    xp: 60,
    desc: "Test whether the local application responds to HTTP requests on port 3000, displaying request and response headers.",
    objective: "Perform a verbose curl request against http://localhost:3000/.",
    validCommands: [
      /^curl\s+-v\s+http:\/\/localhost:3000\/?$/,
      /^curl\s+--verbose\s+http:\/\/localhost:3000\/?$/,
      /^curl\s+-I\s+http:\/\/localhost:3000\/?$/
    ],
    hint: "Use 'curl -v http://localhost:3000/'.",
    explanation: {
      command: "curl -v http://localhost:3000/",
      breakdown: [
        { part: "curl", desc: "Command line tool for transferring data with URLs." },
        { part: "-v", desc: "Verbose: shows DNS resolution, TCP handshake, request headers, and response status." }
      ],
      proTip: "Use `curl -s -o /dev/null -w \"%{http_code}\" URL` in healthcheck scripts to extract only the numeric HTTP status code."
    },
    simulatedOutput: "*   Trying 127.0.0.1:3000...\n* Connected to localhost (127.0.0.1) port 3000\n> GET / HTTP/1.1\n> Host: localhost:3000\n> User-Agent: curl/7.81.0\n< HTTP/1.1 200 OK\n< Content-Type: application/json\n< Content-Length: 26\n{\"status\":\"healthy\",\"ok\":true}",
    initialFs: {
      name: "/etc",
      type: "dir",
      children: [
        { name: "hosts", type: "file", size: "220B", perm: "-rw-r--r--" }
      ]
    }
  },
  {
    id: "LNX-NET-04",
    topic: "networking",
    title: "Fast DNS A-Record Lookup with Dig",
    difficulty: "Intermediate",
    xp: 60,
    desc: "Verify what IPv4 IP address `api.example.com` resolves to using dig in short format.",
    objective: "Query DNS A record in short format with dig +short api.example.com.",
    validCommands: [
      /^dig\s+\+short\s+api\.example\.com$/,
      /^dig\s+api\.example\.com\s+\+short$/,
      /^nslookup\s+api\.example\.com$/
    ],
    hint: "Use 'dig +short api.example.com'.",
    explanation: {
      command: "dig +short api.example.com",
      breakdown: [
        { part: "dig", desc: "Domain Information Groper: flexible DNS lookup utility." },
        { part: "+short", desc: "Prints only the answer IP address, stripping all verbose headers and metadata." }
      ],
      proTip: "To bypass local DNS caching and test Google DNS directly, run `dig @8.8.8.8 api.example.com`."
    },
    simulatedOutput: "203.0.113.195",
    initialFs: {
      name: "/etc",
      type: "dir",
      children: [
        { name: "resolv.conf", type: "file", size: "120B", perm: "-rw-r--r--" }
      ]
    }
  },
  {
    id: "LNX-NET-05",
    topic: "networking",
    title: "Testing ICMP Network Reachability",
    difficulty: "Beginner",
    xp: 50,
    desc: "Send exactly 4 ICMP ping packets to gateway `8.8.8.8` to test basic internet connectivity and packet loss.",
    objective: "Ping 8.8.8.8 with a count of 4 packets.",
    validCommands: [
      /^ping\s+-c\s+4\s+8\.8\.8\.8$/,
      /^ping\s+-c4\s+8\.8\.8\.8$/
    ],
    hint: "Use 'ping -c 4 8.8.8.8'.",
    explanation: {
      command: "ping -c 4 8.8.8.8",
      breakdown: [
        { part: "ping", desc: "Sends ICMP ECHO_REQUEST packets to network hosts." },
        { part: "-c 4", desc: "Stop after sending 4 packets (preventing infinite ping loop on Linux)." }
      ],
      proTip: "Many cloud environments (like AWS security groups) block ICMP by default. A failed ping does not necessarily mean an HTTP port is down!"
    },
    simulatedOutput: "PING 8.8.8.8 (8.8.8.8) 56(84) bytes of data.\n64 bytes from 8.8.8.8: icmp_seq=1 ttl=116 time=12.4 ms\n64 bytes from 8.8.8.8: icmp_seq=2 ttl=116 time=11.9 ms\n64 bytes from 8.8.8.8: icmp_seq=3 ttl=116 time=12.1 ms\n64 bytes from 8.8.8.8: icmp_seq=4 ttl=116 time=12.0 ms\n--- 8.8.8.8 ping statistics ---\n4 packets transmitted, 4 received, 0% packet loss, time 3004ms",
    initialFs: {
      name: "/etc",
      type: "dir",
      children: [
        { name: "hosts", type: "file", size: "220B", perm: "-rw-r--r--" }
      ]
    }
  },

  // ==========================================
  // TOPIC 14: DISK, FILESYSTEMS & STORAGE (Module 14)
  // ==========================================
  {
    id: "LNX-DISK-01",
    topic: "storage_disks",
    title: "Checking Human-Readable Disk Space",
    difficulty: "Beginner",
    xp: 50,
    desc: "Check available disk space across all mounted filesystems in human-readable gigabyte/megabyte format.",
    objective: "Display filesystem disk space with df -h.",
    validCommands: [
      /^df\s+-h$/,
      /^df\s+-h\s+\/$/
    ],
    hint: "Use 'df -h' (df stands for disk free).",
    explanation: {
      command: "df -h",
      breakdown: [
        { part: "df", desc: "Reports filesystem disk space usage." },
        { part: "-h", desc: "Human-readable format (displays sizes in GB, MB rather than raw 1K blocks)." }
      ],
      proTip: "Check the `Use%` column. Any partition over 90% requires immediate investigation."
    },
    simulatedOutput: "Filesystem      Size  Used Avail Use% Mounted on\n/dev/root        29G   28G  1.2G  96% /\n/dev/xvda15     124M   11M  114M   9% /boot/efi\ntmpfs           1.9G     0  1.9G   0% /run",
    initialFs: {
      name: "/",
      type: "dir",
      children: [
        { name: "var", type: "dir", children: [] },
        { name: "etc", type: "dir", children: [] }
      ]
    }
  },
  {
    id: "LNX-DISK-02",
    topic: "storage_disks",
    title: "Checking Inode Capacity Exhaustion",
    difficulty: "Intermediate",
    xp: 70,
    desc: "A developer cannot create new files and receives 'No space left on device', yet `df -h` shows 20GB free! Check inode allocation across filesystems.",
    objective: "Display filesystem inode statistics with df -i.",
    validCommands: [
      /^df\s+-i$/,
      /^df\s+-i\s+\/$/
    ],
    hint: "Use 'df -i' (i for inodes).",
    explanation: {
      command: "df -i",
      breakdown: [
        { part: "-i", desc: "Lists inode information instead of block usage." }
      ],
      proTip: "Millions of tiny session or cache files can exhaust 100% of available inodes even when disk space is 90% empty!"
    },
    simulatedOutput: "Filesystem       Inodes   IUsed   IFree IUse% Mounted on\n/dev/root       1933312 1933312       0  100% /   <-- 100% INODES EXHAUSTED!\ntmpfs            489240       1  489239    1% /run",
    initialFs: {
      name: "/var",
      type: "dir",
      children: [
        { name: "spool", type: "dir", children: [] }
      ]
    }
  },
  {
    id: "LNX-DISK-03",
    topic: "storage_disks",
    title: "Directory Space Consumption Breakdown",
    difficulty: "Intermediate",
    xp: 80,
    desc: "The root partition is filling up. Summarize the disk usage of each top-level directory in `/var` at depth 1 without crossing into other filesystems.",
    objective: "Summarize directory space in /var at depth 1.",
    validCommands: [
      /^(sudo\s+)?du\s+-xhd1\s+\/var(\s+\|\s+sort\s+-h)?$/,
      /^(sudo\s+)?du\s+-sh\s+\/var\/\*(\s+\|\s+sort\s+-h)?$/,
      /^(sudo\s+)?du\s+-h\s+--max-depth=1\s+\/var(\s+\|\s+sort\s+-h)?$/
    ],
    hint: "Use 'sudo du -xhd1 /var | sort -h'.",
    explanation: {
      command: "sudo du -xhd1 /var | sort -h",
      breakdown: [
        { part: "du", desc: "Disk Usage: estimates file space usage." },
        { part: "-x", desc: "Stay on one filesystem (skips mounted network or virtual filesystems)." },
        { part: "-h", desc: "Human readable (MB/GB)." },
        { part: "-d1", desc: "Max depth 1: shows only the direct subdirectories." },
        { part: "sort -h", desc: "Sorts lines by human numerical value (1K < 10M < 2G)." }
      ],
      proTip: "This is the #1 command used by DevOps on-call engineers during disk capacity emergencies."
    },
    simulatedOutput: "12M     /var/backups\n48M     /var/cache\n180M    /var/lib\n24G     /var/log  <-- Offending directory!\n24G     /var",
    initialFs: {
      name: "/var",
      type: "dir",
      children: [
        { name: "log", type: "dir", size: "24GB", children: [] },
        { name: "lib", type: "dir", size: "180MB", children: [] }
      ]
    }
  },
  {
    id: "LNX-DISK-04",
    topic: "storage_disks",
    title: "Inspecting Block Devices & Filesystems",
    difficulty: "Beginner",
    xp: 60,
    desc: "A new EBS block storage disk was attached to this Linux VM. Inspect all block devices and their filesystem types (`FSTYPE`).",
    objective: "List block devices with filesystem information using lsblk -f.",
    validCommands: [
      /^lsblk\s+-f$/,
      /^lsblk$/
    ],
    hint: "Use 'lsblk -f'.",
    explanation: {
      command: "lsblk -f",
      breakdown: [
        { part: "lsblk", desc: "List block devices." },
        { part: "-f", desc: "Output filesystem information including FSTYPE (ext4, xfs), UUID, and current MOUNTPOINT." }
      ],
      proTip: "If `FSTYPE` is completely empty, the disk volume is raw and unformatted."
    },
    simulatedOutput: "NAME    FSTYPE   FSVER LABEL UUID                                 FSAVAIL FSUSE% MOUNTPOINTS\nxvda                                                                                \n├─xvda1 ext4     1.0   root  e81c0022-d78e-4a64-9b24-f7253457e512   1.2G    96% /\n└─xvda15 vfat    FAT32       9A24-F65B                              114M     9% /boot/efi\nxvdb    ext4     1.0   data  4a1e9882-77b1-4f81-8902-b2512a8019ab                   <-- Attached but unmounted!",
    initialFs: {
      name: "/dev",
      type: "dir",
      children: [
        { name: "xvda", type: "file", perm: "brw-rw----" },
        { name: "xvdb", type: "file", perm: "brw-rw----" }
      ]
    }
  },
  {
    id: "LNX-DISK-05",
    topic: "storage_disks",
    title: "Verifying Active Mount Points",
    difficulty: "Intermediate",
    xp: 60,
    desc: "Verify whether the `/data` directory is an active mount point and inspect which physical partition is bound to it.",
    objective: "Inspect mount status of /data with findmnt.",
    validCommands: [
      /^findmnt\s+\/data$/,
      /^findmnt$/
    ],
    hint: "Use 'findmnt /data'.",
    explanation: {
      command: "findmnt /data",
      breakdown: [
        { part: "findmnt", desc: "Finds and lists mounted filesystems in a clean tree format." }
      ],
      proTip: "`findmnt` is much cleaner and less error-prone than parsing `/proc/mounts` or raw `mount` command output."
    },
    simulatedOutput: "TARGET SOURCE    FSTYPE OPTIONS\n/data  /dev/xvdb ext4   rw,relatime",
    initialFs: {
      name: "/",
      type: "dir",
      children: [
        { name: "data", type: "dir", children: [] }
      ]
    }
  },

  // ==========================================
  // TOPIC 15: SSH & REMOTE ACCESS / TRANSFERS (Modules 15 & 16)
  // ==========================================
  {
    id: "LNX-SSH-01",
    topic: "ssh_remote",
    title: "Verbose SSH Connection Diagnostics",
    difficulty: "Beginner",
    xp: 60,
    desc: "You are unable to connect to production server `192.168.1.50` with user `ubuntu`. Run SSH in verbose mode to diagnose which handshake or authentication step is hanging.",
    objective: "Connect with verbose SSH to ubuntu@192.168.1.50.",
    validCommands: [
      /^ssh\s+-v\s+ubuntu@192\.168\.1\.50$/,
      /^ssh\s+-vv\s+ubuntu@192\.168\.1\.50$/,
      /^ssh\s+-v\s+ubuntu@SERVER_IP$/
    ],
    hint: "Use 'ssh -v ubuntu@192.168.1.50'.",
    explanation: {
      command: "ssh -v ubuntu@192.168.1.50",
      breakdown: [
        { part: "ssh", desc: "OpenSSH remote login client." },
        { part: "-v", desc: "Verbose mode: prints debug messages about identity files tried, cipher negotiation, and server banner." }
      ],
      proTip: "Use `-vvv` for maximum debugging output when troubleshooting complex SSH agent or Bastion host proxy hops."
    },
    simulatedOutput: "OpenSSH_8.9p1 Ubuntu-3ubuntu0.4, OpenSSL 3.0.2 15 Mar 2022\ndebug1: Connecting to 192.168.1.50 [192.168.1.50] port 22.\ndebug1: Connection established.\ndebug1: Authenticating to 192.168.1.50:22 as 'ubuntu'\ndebug1: Offering public key: /home/ubuntu/.ssh/id_ed25519 ED25519\ndebug1: Server accepts key: Authenticated to 192.168.1.50.",
    initialFs: {
      name: "/home/ubuntu/.ssh",
      type: "dir",
      isCurrent: true,
      children: [
        { name: "id_ed25519", type: "file", size: "411B", perm: "-rw-------" },
        { name: "id_ed25519.pub", type: "file", size: "98B", perm: "-rw-r--r--" }
      ]
    }
  },
  {
    id: "LNX-SSH-02",
    topic: "ssh_remote",
    title: "Generating Modern ED25519 SSH Keys",
    difficulty: "Intermediate",
    xp: 70,
    desc: "Generate a state-of-the-art elliptic curve ED25519 SSH key pair for server authentication.",
    objective: "Generate an ED25519 key pair with ssh-keygen.",
    validCommands: [
      /^ssh-keygen\s+-t\s+ed25519$/,
      /^ssh-keygen\s+-t\s+ed25519\s+-C\s+['"][^'"]+['"]$/
    ],
    hint: "Use 'ssh-keygen -t ed25519'.",
    explanation: {
      command: "ssh-keygen -t ed25519",
      breakdown: [
        { part: "ssh-keygen", desc: "Authentication key generation utility." },
        { part: "-t ed25519", desc: "Specifies the Ed25519 public-key algorithm (modern, faster, and more secure than legacy RSA)." }
      ],
      proTip: "Never generate keys without a passphrase on personal laptops. Use SSH agent to avoid typing it repeatedly."
    },
    simulatedOutput: "Generating public/private ed25519 key pair.\nYour identification has been saved in /home/ubuntu/.ssh/id_ed25519\nYour public key has been saved in /home/ubuntu/.ssh/id_ed25519.pub",
    initialFs: {
      name: "/home/ubuntu/.ssh",
      type: "dir",
      isCurrent: true,
      children: []
    },
    updatedFs: {
      name: "/home/ubuntu/.ssh",
      type: "dir",
      isCurrent: true,
      children: [
        { name: "id_ed25519", type: "file", size: "411B", perm: "-rw-------" },
        { name: "id_ed25519.pub", type: "file", size: "98B", perm: "-rw-r--r--" }
      ]
    }
  },
  {
    id: "LNX-SSH-03",
    topic: "ssh_remote",
    title: "Private Key Security Hardening (chmod 600)",
    difficulty: "Beginner",
    xp: 60,
    desc: "SSH refused your connection with: 'WARNING: UNPROTECTED PRIVATE KEY FILE! Permissions 0644 are too open'. Fix permissions on `~/.ssh/id_ed25519` so only the owner can read/write it.",
    objective: "Set permissions of ~/.ssh/id_ed25519 to 600.",
    validCommands: [
      /^chmod\s+600\s+(~\/\.ssh\/id_ed25519|\.ssh\/id_ed25519|id_ed25519)$/,
      /^chmod\s+u=rw,go=\s+(~\/\.ssh\/id_ed25519|\.ssh\/id_ed25519|id_ed25519)$/
    ],
    hint: "Use 'chmod 600 ~/.ssh/id_ed25519'.",
    explanation: {
      command: "chmod 600 ~/.ssh/id_ed25519",
      breakdown: [
        { part: "600", desc: "Owner has Read (4) + Write (2) = 6. Group and Others have ZERO permissions (0)." }
      ],
      proTip: "OpenSSH client strictly refuses to use any private key file that is accessible by other users on the system."
    },
    simulatedOutput: "[Permissions updated to -rw------- ~/.ssh/id_ed25519]",
    initialFs: {
      name: "/home/ubuntu/.ssh",
      type: "dir",
      isCurrent: true,
      children: [
        { name: "id_ed25519", type: "file", size: "411B", perm: "-rw-r--r--" }
      ]
    },
    updatedFs: {
      name: "/home/ubuntu/.ssh",
      type: "dir",
      isCurrent: true,
      children: [
        { name: "id_ed25519", type: "file", size: "411B", perm: "-rw-------" }
      ]
    }
  },
  {
    id: "LNX-SSH-04",
    topic: "ssh_remote",
    title: "Secure Remote File Transfer with SCP",
    difficulty: "Intermediate",
    xp: 70,
    desc: "Copy the deployment archive `app.tar.gz` to the remote server `192.168.1.50` into directory `/opt/myapp/` as user `ubuntu`.",
    objective: "Copy app.tar.gz to remote server using scp.",
    validCommands: [
      /^scp\s+app\.tar\.gz\s+ubuntu@192\.168\.1\.50:\/opt\/myapp\/?$/
    ],
    hint: "Use 'scp app.tar.gz ubuntu@192.168.1.50:/opt/myapp/'.",
    explanation: {
      command: "scp app.tar.gz ubuntu@192.168.1.50:/opt/myapp/",
      breakdown: [
        { part: "scp", desc: "Secure Copy Protocol: transfers files over an encrypted SSH connection." },
        { part: "ubuntu@192.168.1.50:/path", desc: "Specifies remote user, target host, and destination path." }
      ],
      proTip: "For large transfers or syncing directory deltas, use `rsync -avzP` for restartable transfers and compression."
    },
    simulatedOutput: "app.tar.gz                        100%   14MB  28.2MB/s   00:00\n[Transferred app.tar.gz to ubuntu@192.168.1.50:/opt/myapp/]",
    initialFs: {
      name: "/home/ubuntu",
      type: "dir",
      isCurrent: true,
      children: [
        { name: "app.tar.gz", type: "file", size: "14MB", perm: "-rw-r--r--" }
      ]
    }
  },

  // ==========================================
  // TOPIC 16: ARCHIVES, COMPRESSION & BACKUP (Module 19)
  // ==========================================
  {
    id: "LNX-TAR-01",
    topic: "archiving",
    title: "Creating a Compressed Tarball",
    difficulty: "Beginner",
    xp: 60,
    desc: "Archive and gzip-compress the entire `site_assets` directory into a single backup archive named `backup.tar.gz`.",
    objective: "Create a gzipped tar archive backup.tar.gz of site_assets.",
    validCommands: [
      /^tar\s+(-czvf|czvf|-cvzf|cvzf)\s+backup\.tar\.gz\s+site_assets\/?$/,
      /^tar\s+-c\s+-z\s+-v\s+-f\s+backup\.tar\.gz\s+site_assets\/?$/
    ],
    hint: "Use 'tar -czvf backup.tar.gz site_assets'.",
    explanation: {
      command: "tar -czvf backup.tar.gz site_assets",
      breakdown: [
        { part: "-c", desc: "Create a new archive." },
        { part: "-z", desc: "Filter archive through gzip for compression." },
        { part: "-v", desc: "Verbosely list files processed." },
        { part: "-f", desc: "Use archive file specified next." }
      ],
      proTip: "Remember the mnemonic: Create = `-czvf`, Extract = `-xzvf`."
    },
    simulatedOutput: "site_assets/\nsite_assets/logo.png\nsite_assets/style.css\n[Archive backup.tar.gz created]",
    initialFs: {
      name: "/var/www",
      type: "dir",
      isCurrent: true,
      children: [
        {
          name: "site_assets",
          type: "dir",
          children: [
            { name: "logo.png", type: "file", size: "140KB", perm: "-rw-r--r--" },
            { name: "style.css", type: "file", size: "12KB", perm: "-rw-r--r--" }
          ]
        }
      ]
    },
    updatedFs: {
      name: "/var/www",
      type: "dir",
      isCurrent: true,
      children: [
        {
          name: "site_assets",
          type: "dir",
          children: [
            { name: "logo.png", type: "file", size: "140KB", perm: "-rw-r--r--" },
            { name: "style.css", type: "file", size: "12KB", perm: "-rw-r--r--" }
          ]
        },
        { name: "backup.tar.gz", type: "file", size: "98KB", perm: "-rw-r--r--" }
      ]
    }
  },
  {
    id: "LNX-TAR-02",
    topic: "archiving",
    title: "Extracting a Gzipped Tar Archive",
    difficulty: "Beginner",
    xp: 60,
    desc: "A deployment package `release.tar.gz` was uploaded to your current folder. Extract its contents.",
    objective: "Extract release.tar.gz using tar -xzvf.",
    validCommands: [
      /^tar\s+(-xzvf|xzvf|-xvzf|xvzf|-xf|xf)\s+release\.tar\.gz$/
    ],
    hint: "Use 'tar -xzvf release.tar.gz'.",
    explanation: {
      command: "tar -xzvf release.tar.gz",
      breakdown: [
        { part: "-x", desc: "Extract files from an archive." },
        { part: "-z", desc: "Decompress using gzip." },
        { part: "-v", desc: "Verbose progress." },
        { part: "-f", desc: "Specifies archive filename." }
      ],
      proTip: "Use `tar -tf release.tar.gz` to list contents and verify paths WITHOUT extracting files to disk."
    },
    simulatedOutput: "app/\napp/server.js\napp/package.json\n[Extraction complete]",
    initialFs: {
      name: "/opt/myapp",
      type: "dir",
      isCurrent: true,
      children: [
        { name: "release.tar.gz", type: "file", size: "8.5MB", perm: "-rw-r--r--" }
      ]
    },
    updatedFs: {
      name: "/opt/myapp",
      type: "dir",
      isCurrent: true,
      children: [
        { name: "release.tar.gz", type: "file", size: "8.5MB", perm: "-rw-r--r--" },
        {
          name: "app",
          type: "dir",
          children: [
            { name: "server.js", type: "file", size: "24KB", perm: "-rw-r--r--" },
            { name: "package.json", type: "file", size: "1.2KB", perm: "-rw-r--r--" }
          ]
        }
      ]
    }
  },
  {
    id: "LNX-TAR-03",
    topic: "archiving",
    title: "Single File Direct Compression with Gzip",
    difficulty: "Beginner",
    xp: 50,
    desc: "Compress a large historical log file `old_access.log` in place using gzip.",
    objective: "Compress old_access.log with gzip.",
    validCommands: [
      /^gzip\s+old_access\.log$/,
      /^gzip\s+-9\s+old_access\.log$/
    ],
    hint: "Use 'gzip old_access.log'.",
    explanation: {
      command: "gzip old_access.log",
      breakdown: [
        { part: "gzip", desc: "Compresses file and renames it to `.gz`, removing the original uncompressed file." }
      ],
      proTip: "Use `gzip -k old_access.log` (`-k` for keep) if you want to keep the original uncompressed file."
    },
    simulatedOutput: "[old_access.log -> old_access.log.gz (Compressed 82%)]",
    initialFs: {
      name: "/var/log",
      type: "dir",
      isCurrent: true,
      children: [
        { name: "old_access.log", type: "file", size: "120MB", perm: "-rw-r--r--" }
      ]
    },
    updatedFs: {
      name: "/var/log",
      type: "dir",
      isCurrent: true,
      children: [
        { name: "old_access.log.gz", type: "file", size: "22MB", perm: "-rw-r--r--" }
      ]
    }
  }
];

// ==========================================
// MODE 2: FULL SYLLABUS / INCIDENT SIMULATOR (Section 3 of DevOps Syllabus)
// ==========================================
const SYLLABUS_INCIDENTS = [
  {
    id: "INCIDENT-01",
    topic: "Full Syllabus: Incident Response",
    title: "🚨 SEV-1: Root Filesystem Is 100% Full (No Space Left on Device)",
    difficulty: "Advanced (SEV-1)",
    xp: 150,
    desc: "CRITICAL ALERT: Production Node.js API server stopped writing session tokens and crashed. Logs show 'No space left on device'. The root filesystem is at 100%. Hunt for the runaway files in `/var/log` larger than 100MB so the team can remediate safely.",
    objective: "Find files in /var/log with size strictly greater than 100M.",
    validCommands: [
      /^(sudo\s+)?find\s+\/var\/log\s+(-type\s+f\s+)?-size\s+\+100M(\s+-print)?$/,
      /^(sudo\s+)?find\s+\/var\/log\s+-size\s+\+100M\s+-type\s+f(\s+-print)?$/,
      /^(sudo\s+)?du\s+-xhd1\s+\/var\/log(\s+\|\s+sort\s+-h)?$/
    ],
    hint: "Use 'find /var/log -type f -size +100M'.",
    explanation: {
      command: "find /var/log -type f -size +100M",
      breakdown: [
        { part: "find /var/log", desc: "Searches the log partition." },
        { part: "-type f", desc: "Restricts matching strictly to regular files." },
        { part: "-size +100M", desc: "Filters for runaway log files larger than 100 Megabytes." }
      ],
      proTip: "After identifying the file, safely truncate active logs using `: > file.log` without killing running processes that hold open file descriptors!"
    },
    simulatedOutput: "/var/log/audit/runaway_audit.log (18.4GB)\n/var/log/nginx/error_flood.log (4.2GB)",
    initialFs: {
      name: "/var/log",
      type: "dir",
      isCurrent: true,
      children: [
        {
          name: "audit",
          type: "dir",
          children: [
            { name: "runaway_audit.log", type: "file", size: "18.4GB", perm: "-rw-r--r--" }
          ]
        },
        { name: "syslog", type: "file", size: "45MB", perm: "-rw-r--r--" }
      ]
    }
  },
  {
    id: "INCIDENT-02",
    topic: "Full Syllabus: Service Recovery",
    title: "⚙️ SEV-2: Application Service Fails to Start After Deploy",
    difficulty: "Advanced (SEV-2)",
    xp: 140,
    desc: "Deployment completed, but `myapp.service` is in an inactive/failed state. The team cannot tell whether it is a syntax error, bad database credentials, or a missing port. Inspect the last 100 lines of systemd journal logs for `myapp` without a pager to identify the crash cause.",
    objective: "Inspect last 100 lines of myapp logs with journalctl --no-pager.",
    validCommands: [
      /^(sudo\s+)?journalctl\s+-u\s+myapp(\.service)?\s+-n\s+100\s+--no-pager$/,
      /^(sudo\s+)?journalctl\s+-u\s+myapp(\.service)?\s+--no-pager\s+-n\s+100$/,
      /^(sudo\s+)?systemctl\s+status\s+myapp(\.service)?$/
    ],
    hint: "Use 'journalctl -u myapp -n 100 --no-pager'.",
    explanation: {
      command: "journalctl -u myapp -n 100 --no-pager",
      breakdown: [
        { part: "journalctl -u myapp", desc: "Retrieves logs for the failed systemd service." },
        { part: "-n 100", desc: "Fetches recent lines leading up to the crash." },
        { part: "--no-pager", desc: "Ensures the complete log is dumped cleanly to stdout." }
      ],
      proTip: "Never repeatedly restart a failed systemd service without checking its logs; you risk triggering systemd restart rate-limiting (StartLimitIntervalSec)!"
    },
    simulatedOutput: "Oct 29 14:30:12 ip-172-31-42-12 myapp[2104]: [FATAL] Database connection failed: ECONNREFUSED 127.0.0.1:5432\nOct 29 14:30:12 ip-172-31-42-12 systemd[1]: myapp.service: Main process exited, code=exited, status=1/FAILURE",
    initialFs: {
      name: "/etc/systemd/system",
      type: "dir",
      children: [
        { name: "myapp.service", type: "file", size: "850B", perm: "-rw-r--r--" }
      ]
    }
  },
  {
    id: "INCIDENT-03",
    topic: "Full Syllabus: Networking & Sockets",
    title: "🌐 SEV-2: Port 3000 Is Unreachable by Clients",
    difficulty: "Advanced (SEV-2)",
    xp: 130,
    desc: "Customers report connection timeouts on port 3000. Before checking AWS Security Groups or Firewalls, inspect the host's listening TCP sockets to verify whether the application is listening on all interfaces (0.0.0.0) or mistakenly bound only to localhost (127.0.0.1).",
    objective: "Check listening TCP sockets filtered for port 3000 using ss.",
    validCommands: [
      /^(sudo\s+)?ss\s+-tulpn\s+\|\s+grep\s+['"]?:3000['"]?$/,
      /^(sudo\s+)?ss\s+-tlpn\s+\|\s+grep\s+['"]?:3000['"]?$/,
      /^(sudo\s+)?ss\s+-tulpn$/
    ],
    hint: "Use 'sudo ss -tulpn | grep \":3000\"'.",
    explanation: {
      command: "sudo ss -tulpn | grep ':3000'",
      breakdown: [
        { part: "ss -tulpn", desc: "Displays all listening TCP/UDP sockets with numeric ports and owning process PIDs." },
        { part: "| grep ':3000'", desc: "Isolates the target application port." }
      ],
      proTip: "If you see `127.0.0.1:3000`, external requests are rejected at the network stack. Change server bind configuration to `0.0.0.0:3000`!"
    },
    simulatedOutput: "tcp   LISTEN 0      128        127.0.0.1:3000       0.0.0.0:*    users:((\"node\",pid=4512,fd=19))  <-- ROOT CAUSE: Bound only to localhost loopback!",
    initialFs: {
      name: "/proc/net",
      type: "dir",
      children: [
        { name: "tcp", type: "file", size: "0B", perm: "-r--r--r--" }
      ]
    }
  },
  {
    id: "INCIDENT-04",
    topic: "Full Syllabus: DNS & Routing",
    title: "🌍 SEV-3: DNS Resolves to Old Deprecated Server",
    difficulty: "Intermediate",
    xp: 120,
    desc: "A blue-green deployment switched DNS traffic for `api.example.com`, but some users still hit the old IP address. Query DNS directly in short format to inspect the live authoritative answer.",
    objective: "Query DNS resolution for api.example.com with dig +short.",
    validCommands: [
      /^dig\s+\+short\s+api\.example\.com$/,
      /^dig\s+api\.example\.com\s+\+short$/,
      /^nslookup\s+api\.example\.com$/
    ],
    hint: "Use 'dig +short api.example.com'.",
    explanation: {
      command: "dig +short api.example.com",
      breakdown: [
        { part: "dig", desc: "Domain Information Groper." },
        { part: "+short", desc: "Displays only the resolved IP address answer." }
      ],
      proTip: "Query a specific public resolver (`dig @8.8.8.8 api.example.com`) to determine whether the delay is propagation latency or an incorrect TTL setting."
    },
    simulatedOutput: "198.51.100.24  <-- Still resolving to deprecated old cluster IP!",
    initialFs: {
      name: "/etc",
      type: "dir",
      children: [
        { name: "resolv.conf", type: "file", size: "120B", perm: "-rw-r--r--" }
      ]
    }
  },
  {
    id: "INCIDENT-05",
    topic: "Full Syllabus: Permissions & Deployment",
    title: "🔒 SEV-2: Permission Denied During CI/CD Deployment Script Execution",
    difficulty: "Advanced",
    xp: 130,
    desc: "An automated deployment runner stopped because executing `/opt/myapp/deploy.sh` throws 'Permission denied'. Inspect file permissions and grant execute permissions to the file owner.",
    objective: "Make /opt/myapp/deploy.sh executable for the owner.",
    validCommands: [
      /^(sudo\s+)?chmod\s+(u\+x|\+x)\s+\/opt\/myapp\/deploy\.sh$/,
      /^(sudo\s+)?chmod\s+755\s+\/opt\/myapp\/deploy\.sh$/,
      /^(sudo\s+)?chmod\s+700\s+\/opt\/myapp\/deploy\.sh$/
    ],
    hint: "Use 'chmod u+x /opt/myapp/deploy.sh'.",
    explanation: {
      command: "chmod u+x /opt/myapp/deploy.sh",
      breakdown: [
        { part: "chmod", desc: "Change file mode bits." },
        { part: "u+x", desc: "Adds execute permissions specifically for the user owner." }
      ],
      proTip: "Also verify parent directory permissions with `namei -l /opt/myapp/deploy.sh` to ensure traversal is permitted."
    },
    simulatedOutput: "[Permissions updated to -rwxr--r-- for /opt/myapp/deploy.sh. CI/CD pipeline resumed!]",
    initialFs: {
      name: "/opt/myapp",
      type: "dir",
      children: [
        { name: "deploy.sh", type: "file", size: "2.4KB", perm: "-rw-r--r--" }
      ]
    },
    updatedFs: {
      name: "/opt/myapp",
      type: "dir",
      children: [
        { name: "deploy.sh", type: "file", size: "2.4KB", perm: "-rwxr--r--" }
      ]
    }
  },
  {
    id: "INCIDENT-06",
    topic: "Full Syllabus: Performance Triage",
    title: "🔥 SEV-1: High CPU Spike Crashing Production Node",
    difficulty: "Advanced (SEV-1)",
    xp: 150,
    desc: "Server load average spiked to 24.0 on an 8-core machine. Identify the top CPU-consuming processes immediately by sorting processes by %CPU descending.",
    objective: "List top CPU-consuming processes sorted by %cpu.",
    validCommands: [
      /^ps\s+aux\s+--sort=-%cpu\s+\|\s+head(\s+-n\s+10)?$/,
      /^ps\s+aux\s+--sort\s+-%cpu\s+\|\s+head(\s+-n\s+10)?$/,
      /^top$/
    ],
    hint: "Use 'ps aux --sort=-%cpu | head -n 10'.",
    explanation: {
      command: "ps aux --sort=-%cpu | head -n 10",
      breakdown: [
        { part: "ps aux", desc: "Lists all running processes." },
        { part: "--sort=-%cpu", desc: "Sorts by CPU percentage in descending order." },
        { part: "head -n 10", desc: "Shows top 10 offenders." }
      ],
      proTip: "Check whether high load average is CPU-bound (high %user/%system) or I/O-bound (high %wa / uninterruptible D-state processes)."
    },
    simulatedOutput: "USER       PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND\nubuntu    8921 99.8 12.4 1290324 256000 ?      R    14:10  25:40 /usr/bin/python3 rogue_worker.py",
    initialFs: {
      name: "/proc",
      type: "dir",
      children: [
        { name: "8921", type: "dir", children: [] }
      ]
    }
  },
  {
    id: "INCIDENT-07",
    topic: "Full Syllabus: Automation & Cron",
    title: "⏰ SEV-3: Nightly Cron Backup Is Not Running at 02:00 AM",
    difficulty: "Intermediate",
    xp: 120,
    desc: "The database team noticed yesterday's backup was missing. Inspect the user's crontab entries to verify if the backup script is configured and whether absolute paths were used.",
    objective: "Inspect scheduled crontab configuration with crontab -l.",
    validCommands: [
      /^crontab\s+-l$/,
      /^(sudo\s+)?journalctl\s+-u\s+cron\s+--since\s+today$/
    ],
    hint: "Use 'crontab -l'.",
    explanation: {
      command: "crontab -l",
      breakdown: [
        { part: "crontab -l", desc: "Lists all current cron jobs scheduled for the user." }
      ],
      proTip: "Cron runs with a minimal environment. Relative paths like `backup.sh` will fail; always specify full absolute paths like `/home/ubuntu/scripts/backup.sh`!"
    },
    simulatedOutput: "# Missing absolute path causes silent failure:\n0 2 * * * backup.sh  <-- ROOT CAUSE: missing /absolute/path and output redirection!",
    initialFs: {
      name: "/var/spool/cron/crontabs",
      type: "dir",
      children: [
        { name: "ubuntu", type: "file", size: "65B", perm: "-rw-------" }
      ]
    }
  },
  {
    id: "INCIDENT-08",
    topic: "Full Syllabus: Security & Access",
    title: "🔑 SEV-2: Production SSH Connection Fails for Remote Engineer",
    difficulty: "Advanced",
    xp: 140,
    desc: "An on-call engineer cannot SSH into `ubuntu@192.168.1.50` during an emergency. Run SSH in verbose mode to diagnose which authentication handshake step fails.",
    objective: "Diagnose SSH connection in verbose mode.",
    validCommands: [
      /^ssh\s+-v\s+ubuntu@192\.168\.1\.50$/,
      /^ssh\s+-vv\s+ubuntu@192\.168\.1\.50$/,
      /^(sudo\s+)?systemctl\s+status\s+ssh(\.service)?$/
    ],
    hint: "Use 'ssh -v ubuntu@192.168.1.50'.",
    explanation: {
      command: "ssh -v ubuntu@192.168.1.50",
      breakdown: [
        { part: "ssh -v", desc: "Displays step-by-step diagnostic handshake info." }
      ],
      proTip: "Common causes: port 22 blocked by security group, wrong user name, key permissions too open (0644), or host key verification failure."
    },
    simulatedOutput: "debug1: Connecting to 192.168.1.50 [192.168.1.50] port 22.\ndebug1: connect to address 192.168.1.50 port 22: Connection refused  <-- ROOT CAUSE: SSH daemon is stopped or listening on custom port!",
    initialFs: {
      name: "/home/ubuntu/.ssh",
      type: "dir",
      isCurrent: true,
      children: [
        { name: "id_ed25519", type: "file", size: "411B", perm: "-rw-------" }
      ]
    }
  },
  {
    id: "INCIDENT-09",
    topic: "Full Syllabus: Log Analysis",
    title: "📈 SEV-2: Application Log Growing Rapidly (Disk Thrashing)",
    difficulty: "Advanced",
    xp: 130,
    desc: "Disk I/O is at 100% and disk space is dropping by 100MB every minute. Stream live logs from `/var/log/myapp.log` to catch the infinite error loop as it happens.",
    objective: "Follow /var/log/myapp.log in real time with tail -f.",
    validCommands: [
      /^(sudo\s+)?tail\s+-f\s+\/var\/log\/myapp\.log$/,
      /^(sudo\s+)?tail\s+-n\s+100\s+\/var\/log\/myapp\.log$/,
      /^(sudo\s+)?tail\s+-F\s+\/var\/log\/myapp\.log$/
    ],
    hint: "Use 'tail -f /var/log/myapp.log'.",
    explanation: {
      command: "tail -f /var/log/myapp.log",
      breakdown: [
        { part: "tail -f", desc: "Follows and displays incoming log lines live as written by the process." }
      ],
      proTip: "Once you observe the error loop, configure `logrotate` with `copytruncate` or fix the unhandled exception in code."
    },
    simulatedOutput: "2026-10-29 14:40:01 [CRITICAL] PaymentGatewayRetry: Network unreachable, retrying immediately (attempt 49102)...\n2026-10-29 14:40:01 [CRITICAL] PaymentGatewayRetry: Network unreachable, retrying immediately (attempt 49103)...",
    initialFs: {
      name: "/var/log",
      type: "dir",
      children: [
        { name: "myapp.log", type: "file", size: "8.2GB", perm: "-rw-r--r--" }
      ]
    }
  },
  {
    id: "INCIDENT-10",
    topic: "Full Syllabus: Storage & Block Devices",
    title: "💾 SEV-2: Attached Storage Volume Attached but Not Accessible",
    difficulty: "Advanced",
    xp: 140,
    desc: "A new database storage partition `/dev/xvdb` was attached to this Linux server, but `/data` is empty. Inspect all block devices and their filesystem types (`FSTYPE`) to verify whether it has a partition and filesystem ready to mount.",
    objective: "Inspect block devices and filesystems with lsblk -f.",
    validCommands: [
      /^lsblk\s+-f$/,
      /^lsblk$/,
      /^(sudo\s+)?blkid$/
    ],
    hint: "Use 'lsblk -f' (or 'lsblk').",
    explanation: {
      command: "lsblk -f",
      breakdown: [
        { part: "lsblk", desc: "Lists block devices in tree format." },
        { part: "-f", desc: "Displays filesystem format (ext4/xfs), UUID, and active mount point." }
      ],
      proTip: "Never blindly run `mkfs` without checking `lsblk -f` or `blkid` first! If the disk already contains data, `mkfs` will destroy it!"
    },
    simulatedOutput: "NAME    FSTYPE FSVER LABEL UUID                                 MOUNTPOINTS\nxvda                                                            \n└─xvda1 ext4   1.0   root  e81c0022-d78e-4a64-9b24-f7253457e512 /\nxvdb    ext4   1.0   data  7b3f1104-42ea-4a11-b890-4100918ef002   <-- ext4 ready! Just needs: sudo mount /dev/xvdb /data",
    initialFs: {
      name: "/dev",
      type: "dir",
      children: [
        { name: "xvda", type: "file", perm: "brw-rw----" },
        { name: "xvdb", type: "file", perm: "brw-rw----" }
      ]
    }
  }
];
"""

import os
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "content", "scenarios.js")
with open(OUT, "w", encoding="utf-8") as f:
    f.write(generate_scenarios_js())

print("scenarios.js generated successfully!")

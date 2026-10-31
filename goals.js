/**
 * Scenario setup & goals for the Virtual Shell (shell.js).
 *
 * A scenario listed here is judged by the resulting filesystem state, not by the exact text typed,
 * and its terminal output comes from the virtual shell. Scenarios not listed here keep the original
 * regex check and canned output from scenarios.js.
 *
 * Keys:
 *   cwd, oldpwd  starting directory / previous directory (defaults come from the scenario's initialFs)
 *   files        { path: content } seeded file contents
 *   goal(sh)     returns true when the filesystem is in the solved state (sh = VirtualShell)
 *   ran          { cmd, flags } solved once that command ran with all of those single-letter flags
 *
 * Any other command that satisfies the goal also counts, so `ls -l -a` and `ls -al` both work.
 */
window.SCENARIO_SETUP = {
  // ---- Topic 2: Navigation ----
  "LNX-NAV-01": { ran: { cmd: "pwd" } },
  "LNX-NAV-02": {
    ran: { cmd: "ls", flags: "la" },
    files: { "/home/ubuntu/.bashrc": "# ~/.bashrc\nexport PATH=$PATH:~/bin\n", "/home/ubuntu/.env.production": "NODE_ENV=production\n" }
  },
  "LNX-NAV-03": { goal: sh => sh.cwd === "/home/ubuntu/projects/backend" },
  "LNX-NAV-04": {
    cwd: "/var/log",
    oldpwd: "/etc/nginx/sites-available",
    goal: sh => sh.cwd === "/etc/nginx/sites-available"
  },

  // ---- Topic 3: Files & directories ----
  "LNX-FILE-01": { goal: sh => sh.isFile("app.log") },
  "LNX-FILE-02": { goal: sh => sh.isDir("project/config/env") },
  "LNX-FILE-03": {
    files: { "config/database.yml": "host: db.internal\nport: 5432\n", "config/server.json": "{\"port\": 8080}\n" },
    goal: sh => sh.isDir("config") && sh.isFile("config/database.yml") && sh.isFile("config/server.json")
      && sh.isFile("config-backup/database.yml") && sh.isFile("config-backup/server.json")
  },
  "LNX-FILE-04": { goal: sh => sh.isFile("app.conf") && !sh.exists("app.conf.old") },
  "LNX-FILE-05": {
    goal: sh => sh.isLink("current") && sh.resolveLink("current") === "/opt/myapp/releases/v2.4"
  },

  // ---- Topic 4: Permissions ----
  "LNX-PERM-01": {
    files: { "deploy.sh": "#!/bin/bash\necho deploying...\n" },
    goal: sh => (sh.mode("deploy.sh") & 0o100) !== 0
  },
  "LNX-PERM-02": { goal: sh => sh.mode("app.conf") === 0o644 },
  "LNX-PERM-03": { goal: sh => sh.mode("/var/www/html") === 0o755 },
  "LNX-PERM-04": {
    goal: sh => { const o = sh.owner("app.log"); return !!o && o.user === "ubuntu" && o.group === "developers"; }
  },

  // ---- Topic 6: Pipes, redirection & streams ----
  "LNX-REDIR-01": {
    goal: sh => (sh.read(".env") || "").trim() === "DATABASE_URL=postgres://localhost:5432/prod"
  },
  "LNX-REDIR-02": {
    files: { "deploy.log": "DEPLOY_STATUS=STARTED\nBUILD=ok\n" },
    goal: sh => { const t = sh.read("deploy.log") || ""; return t.includes("DEPLOY_STATUS=STARTED") && t.trim().endsWith("DEPLOY_STATUS=SUCCESS"); }
  },
  "LNX-REDIR-04": {
    goal: sh => (sh.read("disk-report.txt") || "").includes("Filesystem")
  }
};

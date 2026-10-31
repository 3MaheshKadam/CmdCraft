/**
 * CmdCraft - Interactive Terminal & Command Arena Engine
 */

class SoundEngine {
  constructor() {
    this.enabled = true;
    this.ctx = null;
  }

  init() {
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) this.ctx = new AudioCtx();
      }
    } catch (e) {
      // AudioContext blocked or unsupported - fail silently
    }
  }

  playSuccess() {
    try {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'triangle';
      osc2.type = 'sine';

      osc1.frequency.setValueAtTime(523.25, now); // C5
      osc1.frequency.exponentialRampToValueAtTime(659.25, now + 0.1); // E5
      osc1.frequency.exponentialRampToValueAtTime(783.99, now + 0.2); // G5
      osc1.frequency.exponentialRampToValueAtTime(1046.50, now + 0.35); // C6

      osc2.frequency.setValueAtTime(261.63, now); // C4
      osc2.frequency.exponentialRampToValueAtTime(523.25, now + 0.35);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.45);
      osc2.stop(now + 0.45);
    } catch (e) {}
  }

  playError() {
    try {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(90, now + 0.25);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.25);
    } catch (e) {}
  }

  playKey() {
    try {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320 + Math.random() * 80, now);

      gain.gain.setValueAtTime(0.02, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.04);
    } catch (e) {}
  }
}

class CmdCraftApp {
  constructor() {
    this.sound = new SoundEngine();
    
    // State & Session Restoration
    const savedMode = localStorage.getItem("cmdcraft_mode");
    this.currentMode = (savedMode === "syllabus") ? "syllabus" : "topic";

    const savedTopic = localStorage.getItem("cmdcraft_topic");
    const validTopic = LINUX_TOPICS.some(t => t.id === savedTopic);
    this.selectedTopic = validTopic ? savedTopic : "architecture";

    this.topicIndices = JSON.parse(localStorage.getItem("cmdcraft_topic_indices") || "{}");
    this.syllabusIndex = parseInt(localStorage.getItem("cmdcraft_syllabus_index") || "0", 10);
    if (isNaN(this.syllabusIndex)) this.syllabusIndex = 0;

    this.scenarioList = [];
    this.currentIndex = 0;
    this.currentScenario = null;
    this.isSolved = false;

    // Gamification state
    this.xp = parseInt(localStorage.getItem("cmdcraft_xp") || "0", 10);
    this.streak = parseInt(localStorage.getItem("cmdcraft_streak") || "0", 10);
    this.completedScenarios = JSON.parse(localStorage.getItem("cmdcraft_completed") || "[]");

    // Terminal History
    this.history = [];
    this.historyIndex = -1;

    // DOM Elements
    this.dom = {
      // Stats
      streak: document.getElementById("stat-streak"),
      xp: document.getElementById("stat-xp"),
      rank: document.getElementById("stat-rank"),
      soundToggle: document.getElementById("sound-toggle"),
      soundIcon: document.getElementById("sound-icon"),
      btnReset: document.getElementById("btn-reset-progress"),
      
      // Modes & Navigation
      modeTopicBtn: document.getElementById("mode-topic"),
      modeSyllabusBtn: document.getElementById("mode-syllabus"),
      topicContainer: document.getElementById("topic-selector-container"),
      
      // Scenario Info
      topicBadge: document.getElementById("scenario-topic-badge"),
      difficulty: document.getElementById("scenario-difficulty"),
      scenarioId: document.getElementById("scenario-id"),
      xpReward: document.getElementById("scenario-xp-reward"),
      title: document.getElementById("scenario-title"),
      desc: document.getElementById("scenario-desc"),
      objective: document.getElementById("scenario-objective"),
      hintDisplay: document.getElementById("hint-display"),
      btnHint: document.getElementById("btn-hint"),
      btnPrev: document.getElementById("btn-prev"),
      btnSkip: document.getElementById("btn-skip"),
      
      // Terminal
      termOutput: document.getElementById("terminal-output"),
      termForm: document.getElementById("terminal-form"),
      termInput: document.getElementById("terminal-input"),
      termHost: document.getElementById("term-host"),
      btnClearTerm: document.getElementById("btn-clear-term"),
      promptLabel: document.getElementById("prompt-label"),
      
      // Visualizer & Solution
      visualFs: document.getElementById("visual-fs-container"),
      explanation: document.getElementById("explanation-container"),
      evalStatusPill: document.getElementById("eval-status-pill"),
      scenarioCounter: document.getElementById("scenario-counter"),
      btnNextScenario: document.getElementById("btn-next-scenario"),
      
      // Modal
      modalCongrats: document.getElementById("modal-congrats"),
      modalXpEarned: document.getElementById("modal-xp-earned"),
      modalBreakdown: document.getElementById("modal-breakdown"),
      modalBtnContinue: document.getElementById("modal-btn-continue"),

      // Environments
      envLinux: document.getElementById("env-linux"),
      envSql: document.getElementById("env-sql"),
      envGit: document.getElementById("env-git")
    };

    this.init();
  }

  init() {
    this.updateStatsUI();
    this.updateModeUI();
    this.renderTopicPills();
    this.bindEvents();
    this.loadScenarioQueue();
    this.renderCurrentScenario();
    this.booted = true;
    setTimeout(() => {
      if (this.dom.termInput) this.dom.termInput.focus();
    }, 150);
  }

  updateModeUI() {
    if (this.currentMode === "topic") {
      this.dom.modeTopicBtn.className = "px-4 py-1.5 text-xs font-semibold rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center space-x-2 transition";
      this.dom.modeSyllabusBtn.className = "px-4 py-1.5 text-xs font-semibold rounded-md text-gray-400 hover:text-gray-200 flex items-center space-x-2 transition";
      this.dom.topicContainer.classList.remove("opacity-30", "pointer-events-none");
    } else {
      this.dom.modeSyllabusBtn.className = "px-4 py-1.5 text-xs font-semibold rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center space-x-2 transition";
      this.dom.modeTopicBtn.className = "px-4 py-1.5 text-xs font-semibold rounded-md text-gray-400 hover:text-gray-200 flex items-center space-x-2 transition";
      this.dom.topicContainer.classList.add("opacity-30", "pointer-events-none");
    }
  }

  getRankTitle(xp) {
    if (xp < 100) return "Terminal Novice";
    if (xp < 300) return "Script Kiddie";
    if (xp < 600) return "Sysadmin Apprentice";
    if (xp < 1200) return "DevOps Operator";
    if (xp < 2000) return "Linux Engineer";
    return "Kernel Architect ⚡";
  }

  updateStatsUI() {
    this.dom.streak.textContent = this.streak;
    this.dom.xp.textContent = this.xp;
    this.dom.rank.textContent = this.getRankTitle(this.xp);

    localStorage.setItem("cmdcraft_xp", this.xp.toString());
    localStorage.setItem("cmdcraft_streak", this.streak.toString());
    localStorage.setItem("cmdcraft_completed", JSON.stringify(this.completedScenarios));
    this.markChanged();
  }

  // Tell the cloud layer progress changed; ignored while booting so a fresh device doesn't overwrite the cloud save.
  markChanged() {
    if (this.booted && window.CmdCloud) window.CmdCloud.touch();
  }

  bindEvents() {
    // Mode toggles
    this.dom.modeTopicBtn.addEventListener("click", () => this.switchMode("topic"));
    this.dom.modeSyllabusBtn.addEventListener("click", () => this.switchMode("syllabus"));

    // Audio toggle
    this.dom.soundToggle.addEventListener("click", () => {
      this.sound.enabled = !this.sound.enabled;
      this.dom.soundIcon.className = this.sound.enabled ? "fa-solid fa-volume-high text-emerald-400" : "fa-solid fa-volume-xmark text-gray-500";
    });

    // Terminal form submit
    this.dom.termForm.addEventListener("submit", (e) => {
      e.preventDefault();
      this.handleCommandSubmit();
    });

    // Clicking anywhere in the terminal output area focuses the input prompt
    this.dom.termOutput.addEventListener("click", () => {
      this.dom.termInput.focus();
    });

    const termContainer = this.dom.termOutput.parentElement;
    if (termContainer) {
      termContainer.addEventListener("click", () => {
        this.dom.termInput.focus();
      });
    }

    // Global typing redirect: whenever user presses any key while looking at the app, focus the terminal input
    window.addEventListener("keydown", (e) => {
      if (this.dom.modalCongrats && !this.dom.modalCongrats.classList.contains("hidden")) return;
      if (document.activeElement === this.dom.termInput) return;
      if (["Shift", "Control", "Alt", "Meta", "Escape", "Tab", "CapsLock"].includes(e.key)) return;
      this.dom.termInput.focus();
    });

    // Terminal typing sound & History navigation
    this.dom.termInput.addEventListener("keydown", (e) => {
      this.sound.playKey();
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (this.history.length > 0 && this.historyIndex < this.history.length - 1) {
          this.historyIndex++;
          this.dom.termInput.value = this.history[this.history.length - 1 - this.historyIndex];
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (this.historyIndex > 0) {
          this.historyIndex--;
          this.dom.termInput.value = this.history[this.history.length - 1 - this.historyIndex];
        } else if (this.historyIndex === 0) {
          this.historyIndex = -1;
          this.dom.termInput.value = "";
        }
      } else if (e.ctrlKey && e.key === "l") {
        e.preventDefault();
        this.clearTerminal();
      }
    });

    // Clear terminal button
    this.dom.btnClearTerm.addEventListener("click", () => this.clearTerminal());

    // Hint button
    this.dom.btnHint.addEventListener("click", () => {
      if (this.currentScenario && this.currentScenario.hint) {
        this.dom.hintDisplay.textContent = "💡 " + this.currentScenario.hint;
        this.dom.hintDisplay.classList.remove("hidden");
      }
    });

    // Previous button
    if (this.dom.btnPrev) {
      this.dom.btnPrev.addEventListener("click", () => {
        this.previousScenario();
      });
    }

    // Skip button
    this.dom.btnSkip.addEventListener("click", () => {
      this.streak = 0; // Skipping resets streak
      this.updateStatsUI();
      this.advanceScenario(false);
    });

    // Reset Progress button
    if (this.dom.btnReset) {
      this.dom.btnReset.addEventListener("click", async () => {
        if (confirm("Reset all saved progress (XP, streaks, and completed scenarios) and restart from Scenario 1?")) {
          localStorage.removeItem("cmdcraft_xp");
          localStorage.removeItem("cmdcraft_streak");
          localStorage.removeItem("cmdcraft_completed");
          localStorage.removeItem("cmdcraft_mode");
          localStorage.removeItem("cmdcraft_topic");
          localStorage.removeItem("cmdcraft_topic_indices");
          localStorage.removeItem("cmdcraft_syllabus_index");
          localStorage.removeItem("cmdcraft_last_scenario_id");
          if (window.CmdCloud) await window.CmdCloud.reset();
          location.reload();
        }
      });
    }

    // Next Scenario Button
    this.dom.btnNextScenario.addEventListener("click", () => {
      this.advanceScenario(true);
    });

    // Modal Continue Button
    this.dom.modalBtnContinue.addEventListener("click", () => {
      this.dom.modalCongrats.classList.add("hidden");
      this.advanceScenario(true);
    });

    // SQL Tab Preview
    this.dom.envSql.addEventListener("click", () => {
      alert("🚀 SQL Studio is in active staging for Phase 2! We'll practice interactive SELECTs, JOINs, aggregations, and query optimization right after Linux commands.");
    });
    this.dom.envGit.addEventListener("click", () => {
      alert("📦 Git & DevOps Playground is scheduled right after SQL!");
    });
  }

  renderTopicPills() {
    this.dom.topicContainer.innerHTML = "";
    LINUX_TOPICS.forEach(t => {
      const topicScenarios = SCENARIOS.filter(s => s.topic === t.id);
      const solvedInTopic = topicScenarios.filter(s => this.completedScenarios.includes(s.id)).length;
      const isAllSolved = topicScenarios.length > 0 && solvedInTopic === topicScenarios.length;

      const btn = document.createElement("button");
      btn.className = `px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition flex items-center space-x-1.5 ${
        this.selectedTopic === t.id && this.currentMode === "topic"
          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
          : "bg-gray-800/60 hover:bg-gray-800 text-gray-400 border border-gray-700/60"
      }`;

      let badgeHtml = "";
      if (isAllSolved) {
        badgeHtml = `<span class="text-[9px] bg-emerald-500/30 text-emerald-300 px-1 py-0.2 rounded font-bold">✔</span>`;
      } else if (solvedInTopic > 0) {
        badgeHtml = `<span class="text-[9px] bg-gray-700/70 text-gray-300 px-1 py-0.2 rounded">${solvedInTopic}/${topicScenarios.length}</span>`;
      }

      btn.innerHTML = `<i class="fa-solid ${t.icon} text-[10px]"></i><span>${t.name}</span>${badgeHtml}`;
      btn.addEventListener("click", () => {
        this.selectedTopic = t.id;
        this.switchMode("topic");
      });
      this.dom.topicContainer.appendChild(btn);
    });
  }

  switchMode(mode, targetIndex = null) {
    this.currentMode = mode;
    this.updateModeUI();
    this.renderTopicPills();
    this.loadScenarioQueue(targetIndex);
    this.renderCurrentScenario();
    setTimeout(() => {
      if (this.dom.termInput) this.dom.termInput.focus();
    }, 150);
  }

  loadScenarioQueue(targetIndex = null) {
    if (this.currentMode === "topic") {
      this.scenarioList = SCENARIOS.filter(s => s.topic === this.selectedTopic);
      if (this.scenarioList.length === 0) {
        this.scenarioList = SCENARIOS.slice(0, 3);
      }
      
      if (targetIndex !== null && targetIndex >= 0 && targetIndex < this.scenarioList.length) {
        this.currentIndex = targetIndex;
      } else if (this.topicIndices[this.selectedTopic] !== undefined && this.topicIndices[this.selectedTopic] < this.scenarioList.length) {
        this.currentIndex = this.topicIndices[this.selectedTopic];
      } else {
        // Find first uncompleted scenario in this topic
        const firstUnsolved = this.scenarioList.findIndex(s => !this.completedScenarios.includes(s.id));
        this.currentIndex = firstUnsolved !== -1 ? firstUnsolved : 0;
      }
    } else {
      // Entire syllabus incidents
      this.scenarioList = SYLLABUS_INCIDENTS;
      if (targetIndex !== null && targetIndex >= 0 && targetIndex < this.scenarioList.length) {
        this.currentIndex = targetIndex;
      } else if (this.syllabusIndex !== undefined && this.syllabusIndex < this.scenarioList.length) {
        this.currentIndex = this.syllabusIndex;
      } else {
        const firstUnsolved = this.scenarioList.findIndex(s => !this.completedScenarios.includes(s.id));
        this.currentIndex = firstUnsolved !== -1 ? firstUnsolved : 0;
      }
    }
  }

  renderCurrentScenario() {
    this.currentScenario = this.scenarioList[this.currentIndex];
    if (!this.currentScenario) return;

    // Save active session state so browser reloads resume right here!
    this.saveSessionState();

    // Badges & Meta
    const topicObj = LINUX_TOPICS.find(t => t.id === this.currentScenario.topic);
    this.dom.topicBadge.textContent = this.currentMode === "topic" 
      ? `TOPIC: ${(topicObj ? topicObj.name : this.currentScenario.topic).toUpperCase()}`
      : "MODE: FULL SYLLABUS INCIDENT";
    
    this.dom.topicBadge.className = this.currentMode === "topic"
      ? "px-2.5 py-1 rounded-md text-xs font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
      : "px-2.5 py-1 rounded-md text-xs font-mono font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20";

    this.dom.difficulty.textContent = this.currentScenario.difficulty.toUpperCase();
    this.dom.scenarioId.textContent = `#${this.currentScenario.id}`;
    this.dom.xpReward.textContent = `+${this.currentScenario.xp} XP`;

    // Title & Objective
    this.dom.title.innerHTML = `<span>${this.currentScenario.title}</span>`;
    this.dom.desc.textContent = this.currentScenario.desc;
    this.dom.objective.textContent = this.currentScenario.objective;

    // Reset status & hints
    this.dom.hintDisplay.classList.add("hidden");
    this.dom.hintDisplay.textContent = "";

    // Count solved in current list
    const solvedInList = this.scenarioList.filter(s => this.completedScenarios.includes(s.id)).length;
    this.dom.scenarioCounter.textContent = `Scenario ${this.currentIndex + 1} of ${this.scenarioList.length} (${solvedInList} mastered)`;

    // Check if this scenario was already solved previously
    const wasAlreadySolved = this.completedScenarios.includes(this.currentScenario.id);
    this.isSolved = wasAlreadySolved;

    if (wasAlreadySolved) {
      this.dom.evalStatusPill.textContent = "MASTERED ✔";
      this.dom.evalStatusPill.className = "text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
      this.dom.btnNextScenario.disabled = false;
      this.renderSolvedExplanation();
      if (this.currentScenario.updatedFs) {
        this.renderFilesystem(this.currentScenario.updatedFs);
      } else {
        this.renderFilesystem(this.currentScenario.initialFs);
      }
      this.appendTerminalLine(`\n<span class="text-emerald-400 font-bold">=== Loaded Scenario: ${this.currentScenario.title} ===</span>\n<span class="text-emerald-300/80 text-xs font-mono">✔ Mastered! Press Enter or 'Next Scenario ➔' to advance, or re-run to practice.</span>\n<span class="text-gray-400">${this.currentScenario.desc}</span>`);
    } else {
      this.dom.evalStatusPill.textContent = "Awaiting command...";
      this.dom.evalStatusPill.className = "text-[11px] font-mono px-2 py-0.5 rounded bg-gray-800 text-gray-400";
      this.dom.btnNextScenario.disabled = true;
      this.renderFilesystem(this.currentScenario.initialFs);
      this.renderInitialExplanation();
      this.appendTerminalLine(`\n<span class="text-emerald-400 font-bold">=== Loaded Scenario: ${this.currentScenario.title} ===</span>\n<span class="text-gray-400">${this.currentScenario.desc}</span>`);
    }

    this.dom.termInput.value = "";
    this.dom.termInput.focus();
  }

  saveSessionState() {
    try {
      localStorage.setItem("cmdcraft_mode", this.currentMode);
      if (this.currentMode === "topic") {
        localStorage.setItem("cmdcraft_topic", this.selectedTopic);
        this.topicIndices[this.selectedTopic] = this.currentIndex;
        localStorage.setItem("cmdcraft_topic_indices", JSON.stringify(this.topicIndices));
      } else {
        this.syllabusIndex = this.currentIndex;
        localStorage.setItem("cmdcraft_syllabus_index", this.syllabusIndex.toString());
      }
      if (this.currentScenario) {
        localStorage.setItem("cmdcraft_last_scenario_id", this.currentScenario.id);
      }
      this.markChanged();
    } catch (e) {
      console.warn("LocalStorage save error:", e);
    }
  }

  renderInitialExplanation() {
    this.dom.explanation.innerHTML = `
      <div class="p-3 rounded-lg bg-gray-900/60 border border-gray-800 text-gray-400 space-y-2">
        <div class="flex items-center space-x-2 text-gray-300 font-medium">
          <i class="fa-solid fa-crosshairs text-emerald-400"></i>
          <span>Scenario Objective</span>
        </div>
        <p class="font-mono text-emerald-300 text-xs">${this.currentScenario.objective}</p>
        <p class="text-gray-400 text-[11px] pt-1">
          Type the solution into the terminal. Once entered, detailed flags and syntax explanations will unlock here!
        </p>
      </div>
    `;
  }

  renderFilesystem(node, level = 0) {
    if (!node) {
      this.dom.visualFs.innerHTML = `<div class="text-gray-500 italic p-2">[Filesystem visualizer ready]</div>`;
      return;
    }

    if (level === 0) {
      this.dom.visualFs.innerHTML = "";
    }

    const itemEl = document.createElement("div");
    const isDir = node.type === "dir";
    const indent = level * 16;

    itemEl.style.paddingLeft = `${indent}px`;
    itemEl.className = `fs-item py-1 px-2 rounded flex items-center justify-between group cursor-pointer ${node.isCurrent ? 'fs-highlight' : ''}`;

    // Left: Icon + Name
    const leftDiv = document.createElement("div");
    leftDiv.className = "flex items-center space-x-2 overflow-hidden";
    
    let iconHtml = "";
    if (isDir) {
      iconHtml = `<i class="fa-solid fa-folder text-amber-400 text-xs"></i>`;
    } else if (node.perm && node.perm.includes("x")) {
      iconHtml = `<i class="fa-solid fa-bolt text-emerald-400 text-xs"></i>`;
    } else {
      iconHtml = `<i class="fa-regular fa-file-code text-blue-400 text-xs"></i>`;
    }

    leftDiv.innerHTML = `
      ${iconHtml}
      <span class="font-mono ${isDir ? 'font-bold text-gray-200' : 'text-gray-300'} truncate">
        ${node.name}
      </span>
      ${node.isCurrent ? '<span class="text-[9px] bg-emerald-500/20 text-emerald-400 px-1 rounded font-bold">CWD</span>' : ''}
    `;

    // Right: Metadata (Permissions, Size, Owner)
    const rightDiv = document.createElement("div");
    rightDiv.className = "flex items-center space-x-2 text-[10px] text-gray-500 font-mono";
    if (node.perm) {
      rightDiv.innerHTML += `<span class="bg-gray-900 px-1.5 py-0.5 rounded text-emerald-400/90 border border-gray-800">${node.perm}</span>`;
    }
    if (node.owner) {
      rightDiv.innerHTML += `<span class="text-gray-400 hidden sm:inline">${node.owner}</span>`;
    }
    if (node.size) {
      rightDiv.innerHTML += `<span class="text-gray-400">${node.size}</span>`;
    }

    itemEl.appendChild(leftDiv);
    itemEl.appendChild(rightDiv);
    this.dom.visualFs.appendChild(itemEl);

    if (isDir && node.children && node.children.length > 0) {
      node.children.forEach(child => this.renderFilesystem(child, level + 1));
    }
  }

  handleCommandSubmit() {
    const rawCmd = this.dom.termInput.value.trim();
    if (!rawCmd) {
      if (this.isSolved) {
        this.advanceScenario(true);
      }
      return;
    }

    if (this.isSolved && (rawCmd.toLowerCase() === "next" || rawCmd.toLowerCase() === "n")) {
      this.dom.termInput.value = "";
      this.advanceScenario(true);
      return;
    }

    // Add to history
    this.history.push(rawCmd);
    this.historyIndex = -1;

    // Display user command in terminal
    this.appendTerminalLine(`<span class="text-emerald-400 font-bold">student@sys:~$</span> <span class="text-white">${this.escapeHtml(rawCmd)}</span>`);
    this.dom.termInput.value = "";

    // Evaluate
    this.evaluateCommand(rawCmd);
  }

  evaluateCommand(cmd) {
    if (!this.currentScenario) return;

    const normalized = cmd.trim().replace(/\s+/g, ' ');
    const isMatch = this.currentScenario.validCommands.some(regex => regex.test(normalized));

    const firstSolve = isMatch && !this.completedScenarios.includes(this.currentScenario.id);
    if (window.CmdCloud) {
      window.CmdCloud.log(isMatch ? "solved" : "failed", {
        scenarioId: this.currentScenario.id,
        title: this.currentScenario.title,
        command: normalized,
        mode: this.currentMode,
        firstSolve
      });
    }

    if (isMatch) {
      this.sound.playSuccess();
      this.isSolved = true;

      // Update streak and XP
      if (!this.completedScenarios.includes(this.currentScenario.id)) {
        this.xp += this.currentScenario.xp;
        this.completedScenarios.push(this.currentScenario.id);
      }
      this.streak++;
      this.updateStatsUI();
      this.renderTopicPills();
      this.saveSessionState();

      // Terminal Output
      if (this.currentScenario.simulatedOutput) {
        this.appendTerminalLine(`<span class="text-gray-300 font-mono">${this.escapeHtml(this.currentScenario.simulatedOutput)}</span>`);
      }
      this.appendTerminalLine(`<span class="text-emerald-400 font-bold">✔ SUCCESS: Scenario Challenge Mastered! (+${this.currentScenario.xp} XP)</span>\n<span class="text-teal-300 text-xs">👉 Press <kbd class="px-1.5 py-0.5 bg-gray-800 rounded border border-gray-700 font-mono">Enter</kbd> or click <strong>'Next Scenario ➔'</strong> to continue.</span>`);

      // Update Visual Filesystem if scenario has updated state
      if (this.currentScenario.updatedFs) {
        this.renderFilesystem(this.currentScenario.updatedFs);
      }

      // Update UI Status
      this.dom.evalStatusPill.textContent = "SOLVED! ✔";
      this.dom.evalStatusPill.className = "text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
      this.dom.btnNextScenario.disabled = false;

      // Render Deep Explanation Card
      this.renderSolvedExplanation();

      // Show celebratory modal for big milestones or incidents
      if (this.currentMode === "syllabus" || this.streak % 3 === 0) {
        this.showCongratsModal();
      }

    } else {
      this.sound.playError();
      this.streak = 0; // Reset streak on incorrect answer
      this.updateStatsUI();

      this.appendTerminalLine(`<span class="text-red-400 font-bold">✖ Command did not satisfy mission requirements.</span>`);
      this.dom.evalStatusPill.textContent = "INCORRECT ✖";
      this.dom.evalStatusPill.className = "text-[11px] font-mono px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30";
      
      // Provide immediate smart feedback
      this.renderErrorFeedback(cmd);
    }
  }

  renderSolvedExplanation() {
    const exp = this.currentScenario.explanation;
    let partsHtml = "";
    if (exp && exp.breakdown) {
      partsHtml = exp.breakdown.map(b => `
        <li class="flex items-start space-x-2">
          <code class="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold font-mono text-xs border border-emerald-500/20">${b.part}</code>
          <span class="text-gray-300 text-xs">${b.desc}</span>
        </li>
      `).join("");
    }

    this.dom.explanation.innerHTML = `
      <div class="space-y-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
        <div class="flex items-center justify-between">
          <span class="font-mono text-xs font-bold text-emerald-300">COMMAND BREAKDOWN:</span>
          <span class="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">Verified Solution</span>
        </div>
        <ul class="space-y-2">${partsHtml}</ul>
        ${exp && exp.proTip ? `
          <div class="mt-2 pt-2 border-t border-emerald-500/10 text-xs text-cyan-300 flex items-start space-x-2">
            <span class="text-amber-400">⚡</span>
            <span><strong>Pro-Tip:</strong> ${exp.proTip}</span>
          </div>
        ` : ''}
      </div>
    `;
  }

  renderErrorFeedback(attempted) {
    this.dom.explanation.innerHTML = `
      <div class="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs space-y-2">
        <div class="flex items-center space-x-2 text-red-400 font-semibold">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <span>Not Quite! Let's Analyze:</span>
        </div>
        <p class="text-gray-300">
          You attempted: <code class="text-red-300 font-mono bg-black/40 px-1 py-0.5 rounded">${this.escapeHtml(attempted)}</code>
        </p>
        <p class="text-gray-400">
          Review the objective: <strong class="text-gray-200">${this.currentScenario.objective}</strong>. 
          Check flag combinations or path specifications. Need a push? Click the <strong>Hint</strong> button above!
        </p>
      </div>
    `;
  }

  showCongratsModal() {
    this.dom.modalXpEarned.textContent = this.currentScenario.xp;
    this.dom.modalBreakdown.innerHTML = `
      <div><strong>Mission:</strong> ${this.currentScenario.title}</div>
      <div><strong>Command:</strong> <span class="text-emerald-400">${this.currentScenario.explanation.command}</span></div>
      <div><strong>Current Streak:</strong> <span class="text-amber-400">${this.streak} in a row 🔥</span></div>
    `;
    this.dom.modalCongrats.classList.remove("hidden");
  }

  advanceScenario(fromSuccess = true) {
    if (this.currentIndex < this.scenarioList.length - 1) {
      this.currentIndex++;
      this.renderCurrentScenario();
    } else {
      // Finished all scenarios in this topic -> Automatically advance to the next module in the syllabus!
      if (this.currentMode === "topic") {
        const currentTopicIdx = LINUX_TOPICS.findIndex(t => t.id === this.selectedTopic);
        if (currentTopicIdx !== -1 && currentTopicIdx < LINUX_TOPICS.length - 1) {
          const nextTopic = LINUX_TOPICS[currentTopicIdx + 1];
          alert(`🎉 Outstanding! You mastered "${LINUX_TOPICS[currentTopicIdx].name}"!\n\nAdvancing to next module: "${nextTopic.name}"! 🚀`);
          this.selectedTopic = nextTopic.id;
          this.renderTopicPills();
          this.loadScenarioQueue(0);
          this.renderCurrentScenario();
          return;
        }
      }
      alert(`🏆 Epic Achievement! You have conquered all scenarios in this drill!`);
      this.currentIndex = 0;
      this.renderCurrentScenario();
    }
  }

  previousScenario() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.renderCurrentScenario();
    } else if (this.currentMode === "topic") {
      const currentTopicIdx = LINUX_TOPICS.findIndex(t => t.id === this.selectedTopic);
      if (currentTopicIdx > 0) {
        const prevTopic = LINUX_TOPICS[currentTopicIdx - 1];
        this.selectedTopic = prevTopic.id;
        this.renderTopicPills();
        this.loadScenarioQueue();
        this.currentIndex = this.scenarioList.length - 1; // go to last scenario of previous topic
        this.renderCurrentScenario();
      }
    }
  }

  appendTerminalLine(html) {
    const div = document.createElement("div");
    div.className = "cmd-line-enter whitespace-pre-wrap leading-relaxed";
    div.innerHTML = html;
    this.dom.termOutput.appendChild(div);
    this.dom.termOutput.scrollTop = this.dom.termOutput.scrollHeight;
  }

  clearTerminal() {
    this.dom.termOutput.innerHTML = "";
    this.appendTerminalLine(`<span class="text-gray-500 italic">[Terminal Cleared - Ready for ${this.currentScenario ? this.currentScenario.title : 'Commands'}]</span>`);
  }

  escapeHtml(str) {
    return str.replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }
}

// Boot on load
window.addEventListener("DOMContentLoaded", () => {
  window.cmdCraft = new CmdCraftApp();
});


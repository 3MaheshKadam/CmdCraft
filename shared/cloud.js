/**
 * CmdCraft Cloud — optional Google sign-in + progress sync (Firebase) and session recording (Clarity).
 * Progress stays in localStorage; when signed in, the same keys are mirrored to Firestore users/{uid}.
 * Newest write wins, decided by the `cmdcraft_updated` timestamp.
 */
(function () {
  const cfg = window.CMDCRAFT_CONFIG || {};
  const fb = cfg.firebase || {};
  const KEYS = [
    "cmdcraft_mode", "cmdcraft_topic", "cmdcraft_topic_indices", "cmdcraft_syllabus_index",
    "cmdcraft_xp", "cmdcraft_streak", "cmdcraft_completed", "cmdcraft_last_scenario_id", "cmdcraft_stats"
  ];
  const STAMP = "cmdcraft_updated";
  const FIREBASE_VERSION = "10.12.2";

  const cloud = {
    user: null,
    db: null,
    pushTimer: null,

    touch() {
      try { localStorage.setItem(STAMP, Date.now().toString()); } catch (e) { /* storage blocked */ }
      if (!this.user) return;
      clearTimeout(this.pushTimer);
      this.pushTimer = setTimeout(() => this.push(), 800);
    },

    snapshot() {
      const data = {};
      KEYS.forEach(k => {
        const v = localStorage.getItem(k);
        if (v !== null) data[k] = v;
      });
      return data;
    },

    // Activity log: one document per attempt/solve under users/{uid}/events (signed-in users only).
    log(type, detail) {
      if (window.clarity) window.clarity("event", type);
      if (!this.user || !this.db) return;
      const event = Object.assign({ type, ts: Date.now() }, detail || {});
      if (typeof event.command === "string") event.command = event.command.slice(0, 200);
      this.db.collection("users").doc(this.user.uid).collection("events").add(event)
        .catch(e => console.warn("CmdCraft event log failed:", e));
    },

    async push() {
      if (!this.user || !this.db) return;
      const updatedAt = Number(localStorage.getItem(STAMP) || Date.now());
      try {
        await this.db.collection("users").doc(this.user.uid).set({
          data: this.snapshot(),
          updatedAt,
          name: this.user.displayName || "",
          email: this.user.email || ""
        });
      } catch (e) {
        console.warn("CmdCraft cloud save failed:", e);
      }
    },

    // Called after Reset Progress: wipe the cloud copy too, otherwise the old cloud save would restore it.
    async reset() {
      localStorage.setItem(STAMP, Date.now().toString());
      await this.push();
    },

    async sync() {
      if (!this.user || !this.db) return;
      try {
        const snap = await this.db.collection("users").doc(this.user.uid).get();
        const localStamp = Number(localStorage.getItem(STAMP) || 0);
        if (snap.exists && Number(snap.data().updatedAt) > localStamp) {
          const remote = snap.data();
          KEYS.forEach(k => localStorage.removeItem(k));
          Object.entries(remote.data || {}).forEach(([k, v]) => {
            if (KEYS.includes(k)) localStorage.setItem(k, v);
          });
          localStorage.setItem(STAMP, String(remote.updatedAt));
          location.reload();
          return;
        }
        if (!snap.exists) localStorage.setItem(STAMP, Date.now().toString());
        await this.push();
      } catch (e) {
        console.warn("CmdCraft cloud sync failed:", e);
      }
    }
  };
  window.CmdCloud = cloud;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function initClarity(id) {
    (function (c, l, a, r, i, t, y) {
      c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
      t = l.createElement(r); t.async = 1; t.src = "https://www.clarity.ms/tag/" + i;
      y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
    })(window, document, "clarity", "script", id);
  }

  function renderAuthUI(btn, label, user) {
    const activity = document.getElementById("btn-activity");
    if (activity) activity.classList.toggle("hidden", !user);
    if (user) {
      label.textContent = (user.displayName || "Signed in").split(" ")[0];
      btn.title = "Signed in as " + (user.email || user.displayName) + " — click to sign out";
    } else {
      label.textContent = "Sign in";
      btn.title = "Sign in with Google to save progress across devices";
    }
  }

  async function initFirebase() {
    const btn = document.getElementById("btn-auth");
    const label = document.getElementById("btn-auth-label");
    if (!btn || !label) return;
    btn.classList.remove("hidden");

    const base = "https://www.gstatic.com/firebasejs/" + FIREBASE_VERSION;
    try {
      await loadScript(base + "/firebase-app-compat.js");
      await Promise.all([loadScript(base + "/firebase-auth-compat.js"), loadScript(base + "/firebase-firestore-compat.js")]);
    } catch (e) {
      console.warn("CmdCraft: Firebase failed to load, continuing offline.", e);
      btn.classList.add("hidden");
      return;
    }

    firebase.initializeApp(fb);
    const auth = firebase.auth();
    cloud.db = firebase.firestore();
    renderAuthUI(btn, label, null);

    btn.addEventListener("click", async () => {
      if (cloud.user) {
        await cloud.push();
        await auth.signOut();
      } else {
        try {
          await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
        } catch (e) {
          console.warn("CmdCraft sign-in cancelled or failed:", e);
        }
      }
    });

    auth.onAuthStateChanged(user => {
      cloud.user = user;
      renderAuthUI(btn, label, user);
      if (user) {
        cloud.sync();
        if (window.clarity) window.clarity("identify", user.uid);
      }
    });
  }

  if (cfg.clarityId) initClarity(cfg.clarityId);
  if (fb.apiKey && fb.projectId) initFirebase();
})();

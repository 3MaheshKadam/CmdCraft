/**
 * CmdCraft subject registry.
 *
 * Every scenario belongs to a subject. The activity page uses this to keep a separate heatmap and
 * stats per subject, plus one combined view.
 *
 * To add a new subject (say SQL): give its scenario ids a shared prefix (e.g. "SQL-JOIN-01"), flip
 * `planned` to false, and/or set `subject: "sql"` on the scenarios themselves (that wins over the prefix).
 * Past events are matched by scenario id prefix, so nothing needs migrating.
 */
window.SUBJECTS = [
  { id: "linux", name: "Linux", icon: "fa-brands fa-linux", prefixes: ["LNX-", "INCIDENT-"], planned: false },
  { id: "sql",   name: "SQL",   icon: "fa-solid fa-database", prefixes: ["SQL-"],  planned: true },
  { id: "dsa",   name: "DSA",   icon: "fa-solid fa-diagram-project", prefixes: ["DSA-"],  planned: true },
  { id: "ai",    name: "AI / ML", icon: "fa-solid fa-brain", prefixes: ["AI-", "ML-"], planned: true }
];

// Subject id for a scenario id (or scenario object). Unknown ids fall back to Linux, the original subject.
window.subjectOf = function (scenario) {
  if (scenario && typeof scenario === "object" && scenario.subject) return scenario.subject;
  const id = typeof scenario === "object" && scenario ? scenario.id : scenario;
  const hit = window.SUBJECTS.find(s => s.prefixes.some(p => String(id || "").startsWith(p)));
  return hit ? hit.id : "linux";
};

/**
 * Runs after every drills-*.js file: rebuilds the topic list in syllabus order, keeping only modules that have drills.
 */
(function (root) {
  if (root.CURRICULUM) root.CURRICULUM.finalize();
})(typeof window !== "undefined" ? window : globalThis);

/** Lessons, days 31-37: interview problem patterns, the 50-problem set, mock interviews and the three projects. */
window.SQL_LESSONS.push(
  {
    day: 31, mods: ["int1"],
    intro: "These twelve questions appear in nearly every SQL interview. For each, learn two or three ways to answer and the edge cases (ties, NULLs, empty results).",
    notes: [
      "Highest salary: WHERE salary = (SELECT MAX(salary) ...) keeps ties; ORDER BY salary DESC LIMIT 1 returns one row.",
      "Second-highest salary: a MAX below the MAX, LIMIT 1 OFFSET 1 over DISTINCT salaries, or DENSE_RANK() = 2; wrap in a scalar subquery to return NULL when it does not exist.",
      "Nth-highest salary: DENSE_RANK() = N, or MIN of the top N distinct salaries; handle N larger than the number of distinct values.",
      "Top N employees: ORDER BY ... LIMIT N with a tie-break column; state how ties are treated (RANK/DENSE_RANK keep them).",
      "Top N per department: ROW_NUMBER() or DENSE_RANK() OVER (PARTITION BY dept ORDER BY salary DESC) <= N in an outer query.",
      "Duplicate records: GROUP BY the columns that define a duplicate with HAVING COUNT(*) > 1; remove extras by keeping MIN(id).",
      "Employees without departments: WHERE dept_id IS NULL, or LEFT JOIN departments ... WHERE d.id IS NULL when the key may dangle.",
      "Departments without employees: LEFT JOIN employees and keep NULLs, or NOT EXISTS.",
      "Employees earning above average: WHERE salary > (SELECT AVG(salary) FROM employees).",
      "Employees earning above their department average: a correlated subquery, a join to a per-department average, or a window AVG() OVER (PARTITION BY dept).",
      "Finding managers: employees whose id appears in manager_id (IN or EXISTS), or a self join.",
      "Employees without managers: manager_id IS NULL (top of the hierarchy); employees who manage nobody are found with NOT EXISTS."
    ],
    example: { ds: "company", caption: "Second-highest distinct salary, NULL-safe.", sql: "SELECT (SELECT DISTINCT salary FROM employees ORDER BY salary DESC LIMIT 1 OFFSET 1) AS second_highest;" },
    internals: "Interviewers listen for edge cases more than syntax: ties, NULLs, empty groups, duplicates. Say them out loud: 'if two people tie, do we return both?'",
    mistakes: ["LIMIT 1 when ties matter.", "NOT IN with NULLs.", "Forgetting DISTINCT for 'Nth distinct'."],
    interview: [["Write the second highest salary without LIMIT.", "SELECT MAX(salary) FROM employees WHERE salary < (SELECT MAX(salary) FROM employees);"], ["Find duplicate emails.", "SELECT email, COUNT(*) FROM users GROUP BY email HAVING COUNT(*) > 1;"]],
    revise: ["Ask about ties and NULLs.", "Know the window and non-window answer.", "Anti-join = NOT EXISTS."]
  },
  {
    day: 32, mods: ["int2", "winx"],
    intro: "Harder questions test windows, self joins and date arithmetic. Most reduce to one of a handful of patterns.",
    notes: [
      "Running totals: SUM(x) OVER (ORDER BY date, id) (partition for per-group totals).",
      "Ranking problems: choose ROW_NUMBER, RANK or DENSE_RANK according to how ties must be treated.",
      "Consecutive numbers: compare each row with LAG/LEAD (or self join on id + 1, id + 2).",
      "Gaps and islands: id minus ROW_NUMBER() is constant inside a run, so group by it to get each island; LEAD finds the gaps.",
      "Median: number rows and pick the middle one or two (rn IN ((c+1)/2, (c+2)/2)); PostgreSQL has PERCENTILE_CONT.",
      "Percentage contribution: 100.0 * part / SUM(part) OVER ().",
      "Moving average: AVG(x) OVER (ORDER BY d ROWS BETWEEN n PRECEDING AND CURRENT ROW).",
      "Monthly revenue: group by a truncated date; join a calendar to include empty months.",
      "Year-over-year growth: compare each month with the same month a year before (LAG(x, 12)) and compute (this - last) / last.",
      "Duplicate removal: keep MIN(id) or the latest row per key with ROW_NUMBER() = 1, delete the rest.",
      "First and last transaction: MIN/MAX of the timestamp, or FIRST_VALUE/LAST_VALUE with a full frame, or ROW_NUMBER ascending and descending.",
      "Customer retention: users active in period N+1 divided by users active in period N (or signup cohorts versus later activity).",
      "User activity analysis: daily/weekly/monthly active users with COUNT(DISTINCT user), streaks via gaps and islands, funnels with conditional aggregation."
    ],
    example: { ds: "metrics", caption: "Gaps and islands: runs of consecutive ids.", sql: "SELECT MIN(id) AS start_id, MAX(id) AS end_id FROM (SELECT id, id - ROW_NUMBER() OVER (ORDER BY id) AS grp FROM seq) GROUP BY grp;" },
    internals: "Almost every advanced problem is: (1) pre-compute with a window function in a CTE, (2) filter or aggregate in the outer query. Practise writing the CTE first.",
    mistakes: ["No tie-breaker in window ORDER BY.", "Forgetting to de-duplicate before the row-number trick.", "Integer division in percentages."],
    interview: [["How do you find consecutive login days?", "Distinct dates per user, subtract ROW_NUMBER() from the date: equal differences are one streak; group and count."], ["How do you compute a median in MySQL?", "Row numbers and counts per group, average the middle one or two."]],
    revise: ["Window in a CTE, filter outside.", "Island key = value - row_number.", "Growth = (new - old) / old."]
  },
  {
    day: 33, mods: ["sql50"],
    intro: "Day 33 is volume practice. This site has an original 50-problem interview set in the same style; the actual LeetCode 'SQL 50' study plan must be done on LeetCode itself.",
    notes: [
      "Complete all 50 problems in the Interview set (plus the LeetCode SQL 50 plan on leetcode.com if you want the official list).",
      "Attempt each one independently first: set a timer, read the schema, write the query before looking at the hint.",
      "Test edge cases: empty groups, ties, NULLs, duplicate rows, the first and last day of a period.",
      "Review the reference solution after you solve it: compare readability and performance, and note a different technique.",
      "Reattempt the difficult questions a few days later without notes; spaced repetition beats a single pass."
    ],
    example: { ds: "lc", caption: "One problem from the set: employees earning more than their manager.", sql: "SELECT e.name FROM lc_employees e JOIN lc_employees m ON m.id = e.manager_id WHERE e.salary > m.salary;" },
    internals: "Track which problems you needed hints for; the Progress page shows solved and attempted counts. Aim for correct on first run, not only eventually.",
    mistakes: ["Copying solutions without understanding them.", "Skipping the edge-case check.", "Never revisiting failures."],
    interview: [["How do you practise SQL efficiently?", "Solve independently, test edge cases, read an alternative solution, revisit the hard ones after a few days."]],
    revise: ["Independent first.", "Edge cases second.", "Reattempt failures."]
  },
  {
    day: 34, mods: ["theory", "int1", "int2"], interview: true,
    intro: "Mock interviews: the SQL Interview page has a bank of theory and scenario questions with model answers, a study mode, and a timed mock.",
    notes: [
      "SQL theory questions: keys, joins, ACID, indexes, normalization, isolation; answer in two or three sentences with an example.",
      "Query-writing questions: restate the requirement, ask about ties and NULLs, write the query in steps, then test it on a small example.",
      "JOIN problems: identify the grain of each table, choose inner or outer joins on purpose, and watch for row multiplication.",
      "Subquery problems: decide whether a scalar, IN/EXISTS or derived table fits, and mention the join alternative.",
      "Window function problems: define partition and order, choose the ranking function, filter in an outer query.",
      "Database design questions: entities, relationships, keys, constraints, one example query that the design must support.",
      "Optimization questions: read the plan, name the bottleneck, propose an index or rewrite, and explain the trade-off for writes.",
      "Explain your query verbally: walk through FROM, joins, filters, grouping and the output; interviewers grade your reasoning as much as the result.",
      "Timed practice: 20 minutes per medium problem; if stuck at 10 minutes, state your approach and write the part you know."
    ],
    example: { ds: "company", caption: "Say it as you write it: 'first the average per department, then compare each employee with it'.", sql: "WITH dept_avg AS (SELECT dept_id, AVG(salary) AS avg_salary FROM employees GROUP BY dept_id) SELECT e.name, e.salary, ROUND(d.avg_salary) AS dept_avg FROM employees e JOIN dept_avg d ON d.dept_id = e.dept_id WHERE e.salary > d.avg_salary;" },
    internals: "A good answer has four parts: clarify, outline, write, test. Practise saying the outline aloud.",
    mistakes: ["Writing silently.", "Not asking about ties/NULLs.", "Not testing on sample data."],
    interview: [["Talk me through how you would find the top earner in each department.", "Partition by department, rank by salary descending, keep rank 1 in an outer query; mention ties and the correlated-subquery alternative."]],
    revise: ["Clarify, outline, write, test.", "Name trade-offs.", "Time-box."]
  },
  {
    day: 35, mods: ["pj1"],
    intro: "Project 1: an Employee Management System. Twelve guided steps on one schema: departments, employees, salary history and attendance.",
    notes: [
      "Employees: the people, with manager, hire date and status; self-referencing for the org chart.",
      "Departments: the units and their budgets; headcount and payroll reports group by them.",
      "Salaries: a history table with from/to dates; the open row is the current salary and raises close one row and open another.",
      "Attendance: daily present/absent/leave records; summaries use conditional aggregation and rates.",
      "JOINs and aggregation tie it together: payroll against budget, top earner per department, tenure and attendance reports, and a reporting view."
    ],
    example: { ds: "hrm", caption: "Payroll against budget.", sql: "SELECT d.name, SUM(s.amount) AS payroll, d.budget FROM departments d JOIN employees e ON e.dept_id = d.id JOIN salaries s ON s.emp_id = e.id AND s.to_date IS NULL GROUP BY d.id, d.name, d.budget;" },
    internals: "Salary history is a slowly changing dimension: never update the amount, close the old row and insert a new one inside one transaction.",
    mistakes: ["Overwriting salary history.", "Counting resigned employees in current payroll."],
    interview: [["How would you model salary changes?", "A history table with employee, amount, from_date and to_date; the current salary has a NULL to_date."]],
    revise: ["History rows, not overwrites.", "Join + group for reports.", "Ship reports as views."]
  },
  {
    day: 36, mods: ["pj2"],
    intro: "Project 2: E-commerce Analytics. Twelve steps from order totals to customer segmentation.",
    notes: [
      "Customers: who buys, where they live and when they joined; the base of lifetime-value and segmentation.",
      "Products: price and cost, which separate revenue from profit.",
      "Orders: header rows with status and date; filter on delivered orders for revenue.",
      "Payments: reconcile with order totals to find delivered orders that were never paid.",
      "Revenue analysis: totals per month with growth, per category, per country and per product, from order_items joined to orders and products.",
      "Customer segmentation: compute lifetime value per customer, band it with CASE into Gold, Silver and Bronze, and look at repeat purchase rates."
    ],
    example: { ds: "ecom", caption: "Revenue and profit per product (delivered orders).", sql: "SELECT p.name, SUM(oi.qty * oi.unit_price) AS revenue, SUM((oi.unit_price - p.cost) * oi.qty) AS profit FROM orders o JOIN order_items oi ON oi.order_id = o.id JOIN products p ON p.id = oi.product_id WHERE o.status = 'delivered' GROUP BY p.id, p.name ORDER BY profit DESC;" },
    internals: "State your definitions first: 'revenue = delivered orders only'. Most disagreements between reports are different definitions, not different SQL.",
    mistakes: ["Counting cancelled orders as revenue.", "Double counting through join multiplication."],
    interview: [["How would you find customers worth targeting?", "Compute lifetime value and order frequency per customer, then segment with CASE and look at recency."]],
    revise: ["Define metrics first.", "Delivered only.", "CTE for the aggregate, then segment."]
  },
  {
    day: 37, mods: ["pj3", "tx"],
    intro: "Project 3: a Banking database. Eleven steps covering balances, ledger reports, atomic transfers, auditing triggers and constraints.",
    notes: [
      "Accounts: owner, type and balance with CHECK constraints (no negative balance, valid type).",
      "Transactions: an append-only ledger with kind, amount and timestamp; every balance change should have a ledger row.",
      "Transfers: a transfer is two ledger rows and two balance updates that must succeed or fail together.",
      "ACID transactions: wrap each transfer in BEGIN ... COMMIT, use savepoints for partial undo, and let constraints reject overdrafts.",
      "Balances: per customer totals, reconciliation of stored balance against the ledger, interest on savings.",
      "Transaction history: statements with running balances, monthly inflow and outflow, accounts with no activity."
    ],
    example: { ds: "bank", caption: "Atomic transfer: either both balance updates and both ledger rows happen or none.", sql: "BEGIN; UPDATE accounts SET balance = balance - 500 WHERE id = 104; UPDATE accounts SET balance = balance + 500 WHERE id = 105; INSERT INTO txns VALUES (12, 104, 'transfer_out', 500, '2024-03-05 09:00'), (13, 105, 'transfer_in', 500, '2024-03-05 09:00'); COMMIT; SELECT id, balance FROM accounts WHERE id IN (104, 105);" },
    internals: "Reconciliation compares two independent records: stored balance versus ledger net. A mismatch (account 101 in the sample data) is a data-quality finding to investigate, not a bug in the query.",
    mistakes: ["Updating balances without ledger rows.", "No transaction around the transfer.", "Floating point for money (use DECIMAL)."],
    interview: [["How do you make a money transfer safe?", "One transaction with both updates and ledger rows, constraints against negative balances, consistent lock order and retry on deadlock."]],
    revise: ["Transfer = one transaction.", "Ledger + balance must reconcile.", "DECIMAL for money."]
  }
);

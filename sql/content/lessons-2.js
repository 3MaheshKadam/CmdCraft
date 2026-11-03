/** Lessons, days 8-15: aggregates, GROUP BY, HAVING, joins, subqueries, set operators, CASE and NULL handling. */
window.SQL_LESSONS.push(
  {
    day: 8, mods: ["aggx"],
    intro: "Aggregate functions collapse many rows into one value: counts, totals, averages and extremes.",
    notes: [
      "COUNT() counts rows or non-NULL values.",
      "SUM() adds numeric values and ignores NULLs; over zero rows it returns NULL.",
      "AVG() is the mean of the non-NULL values (sum divided by the count of non-NULLs).",
      "MIN() returns the smallest value (also works on text and dates).",
      "MAX() returns the largest value.",
      "COUNT(*) counts all rows including those with NULLs; COUNT(col) counts only rows where col is not NULL; COUNT(DISTINCT col) counts distinct non-NULL values.",
      "Aggregates skip NULL inputs, so AVG(grade) differs from AVG(COALESCE(grade, 0)): decide whether missing means ignore or zero.",
      "Conditional aggregation puts a CASE inside the aggregate (SUM(CASE WHEN ... THEN 1 ELSE 0 END)) or uses a WHERE to restrict the rows aggregated."
    ],
    example: { ds: "lab", caption: "COUNT(*) vs COUNT(col) and AVG with NULLs.", sql: "SELECT COUNT(*) AS total, COUNT(city) AS with_city, COUNT(DISTINCT city) AS cities FROM students;" },
    internals: "An aggregate without GROUP BY makes the whole table one group. The engine keeps a running state (count, sum) while scanning; COUNT(*) on InnoDB must still scan an index because row counts depend on transaction visibility.",
    mistakes: ["Assuming SUM of nothing is 0 (it is NULL).", "Using COUNT(col) when you meant COUNT(*).", "Averaging averages instead of weighting."],
    interview: [["COUNT(*) vs COUNT(column)?", "COUNT(*) counts rows; COUNT(column) skips NULLs."], ["What does AVG do with NULLs?", "Ignores them: the denominator is the number of non-NULL values."]],
    revise: ["Aggregates ignore NULL (COUNT(*) excepted).", "SUM of empty set is NULL.", "CASE inside SUM = conditional count."]
  },
  {
    day: 9, mods: ["aggx"],
    intro: "GROUP BY splits rows into groups so aggregates are computed per group.",
    notes: [
      "Grouping partitions rows that share the same value(s) and returns one output row per group.",
      "GROUP BY one column gives one row per distinct value of that column.",
      "GROUP BY several columns gives one row per distinct combination.",
      "Aggregates (COUNT, SUM, AVG...) are computed inside each group; every selected column must be grouped or aggregated.",
      "Department-wise aggregation (headcount, payroll, average salary per department) is the classic example.",
      "Join first, then group: GROUP BY the key (and displayed name) of the table you are summarising.",
      "Common errors: selecting a non-grouped column, using an alias in GROUP BY on strict engines, using WHERE for an aggregate, and counting duplicated rows after a join."
    ],
    example: { ds: "company", caption: "Headcount and average salary per department name.", sql: "SELECT d.name, COUNT(*) AS n, ROUND(AVG(e.salary)) AS avg_salary FROM departments d JOIN employees e ON e.dept_id = d.id GROUP BY d.id, d.name;" },
    internals: "The engine groups either by sorting on the grouping key or by building a hash table of groups. An index on the grouping column lets it read rows already in order and avoid the sort.",
    mistakes: ["Grouping by name when two rows can share the name; group by the key.", "Putting a non-aggregated column in SELECT under ONLY_FULL_GROUP_BY.", "Forgetting LEFT JOIN when empty groups must appear."],
    interview: [["Why does SELECT dept, name, COUNT(*) GROUP BY dept fail?", "name is neither grouped nor aggregated, so it is ambiguous."], ["How do you include groups with zero rows?", "LEFT JOIN from the group table and COUNT a column of the optional side."]],
    revise: ["One row per group.", "Select = grouped columns + aggregates.", "LEFT JOIN + COUNT(col) to keep zero groups."]
  },
  {
    day: 10, mods: ["aggx"],
    intro: "HAVING filters groups after aggregation, the way WHERE filters rows before it.",
    notes: [
      "HAVING is a filter applied to groups after GROUP BY and aggregation.",
      "WHERE filters individual rows before grouping and cannot use aggregates; HAVING filters groups and can.",
      "Use HAVING to keep or drop whole groups, for example departments with more than five people.",
      "Conditions on COUNT, SUM, AVG, MIN and MAX belong in HAVING.",
      "HAVING can combine several aggregate conditions with AND and OR.",
      "The full pipeline: WHERE (rows), GROUP BY, HAVING (groups), SELECT, ORDER BY, LIMIT."
    ],
    example: { ds: "company", caption: "Row filter first (WHERE), then group filter (HAVING), then sort.", sql: "SELECT dept_id, COUNT(*) AS n, ROUND(AVG(salary)) AS avg_salary FROM employees WHERE hire_date < '2021-01-01' GROUP BY dept_id HAVING COUNT(*) >= 2 ORDER BY avg_salary DESC;" },
    internals: "Push every condition you can into WHERE: it reduces the rows before the expensive grouping step and can use indexes. HAVING runs only after the groups are built.",
    mistakes: ["Filtering a plain column in HAVING (works, but is slower than WHERE).", "Using an aggregate in WHERE (error)."],
    interview: [["WHERE vs HAVING?", "WHERE filters rows before grouping; HAVING filters groups after aggregation."]],
    revise: ["WHERE = rows, HAVING = groups.", "Aggregate conditions go in HAVING."]
  },
  {
    day: 11, mods: ["joinx"],
    intro: "A JOIN combines rows from two tables on a condition. Choosing the right join type decides which unmatched rows survive.",
    notes: [
      "A JOIN combines columns from two tables by matching rows with a condition, normally a foreign key equal to a primary key.",
      "INNER JOIN returns only rows with a match on both sides.",
      "LEFT JOIN returns all rows of the left table, with NULLs for the right columns when there is no match.",
      "RIGHT JOIN returns all rows of the right table; it is a LEFT JOIN with the tables swapped.",
      "FULL OUTER JOIN returns all rows of both tables, matched where possible; MySQL lacks it, so emulate with LEFT JOIN UNION RIGHT JOIN.",
      "CROSS JOIN returns every combination (Cartesian product): m rows times n rows.",
      "A SELF JOIN joins a table to itself under two aliases, for example employee and manager.",
      "NATURAL JOIN joins on all columns with the same name; avoid it, because adding a column can silently change the result.",
      "A JOIN can be replaced by a subquery (and vice versa); joins are clearer when you need columns from both tables.",
      "Table aliases (employees e) shorten queries and are required for self joins.",
      "Unmatched records appear with NULLs in an outer join; filter on IS NULL to find them (anti-join).",
      "NULL never equals NULL, so rows with NULL join keys do not match in any join; use an outer join to keep them."
    ],
    example: { ds: "company", caption: "INNER vs LEFT: projects whose department is NULL vanish from the inner join.", sql: "SELECT p.name AS project, d.name AS department FROM projects p LEFT JOIN departments d ON d.id = p.dept_id;" },
    internals: "The optimizer picks a join algorithm: nested loop (best with an index on the inner table), hash join (large unsorted inputs, MySQL 8.0.18+), or merge join (both inputs sorted). The join order is chosen by estimated cost, not by the order you wrote.",
    mistakes: ["Forgetting the ON condition, producing a cross join.", "WHERE on the optional table turning a LEFT JOIN into an INNER JOIN.", "Joining on non-indexed columns of big tables."],
    interview: [["INNER vs LEFT JOIN?", "INNER keeps matches only; LEFT keeps all left rows and NULL-fills missing right columns."], ["How do you emulate FULL OUTER JOIN in MySQL?", "LEFT JOIN UNION RIGHT JOIN."], ["What is a self join?", "A table joined to itself, such as employee to manager."]],
    revise: ["INNER = both, LEFT = all left, FULL = all.", "Anti-join: LEFT JOIN ... WHERE right.key IS NULL.", "Always write the ON condition."]
  },
  {
    day: 12, mods: ["joinx"],
    intro: "Real queries join many tables and mix joins with aggregation. The traps are duplicated rows and misplaced filters.",
    notes: [
      "Join three or more tables by chaining JOIN ... ON; each new table must link to one already joined.",
      "A JOIN can have multiple conditions combined with AND (composite keys, date ranges, status flags).",
      "In a one-to-many join the parent row repeats once per child row.",
      "In a many-to-many join you pass through the junction table: students, enrolments, courses.",
      "Join first, then aggregate: SUM, COUNT or AVG over the joined rows.",
      "GROUP BY after a JOIN summarises per key of the parent table.",
      "HAVING after a JOIN and GROUP BY filters the summarised groups.",
      "To find unmatched records use a LEFT JOIN with IS NULL on the right key (or NOT EXISTS).",
      "Joins on a one-to-many relationship multiply parent rows; use COUNT(DISTINCT id) or aggregate the child table first to avoid double counting.",
      "An anti-join returns left rows with no match on the right (customers without orders).",
      "A semi-join returns left rows that have at least one match, each once, typically via EXISTS."
    ],
    example: { ds: "shop", caption: "Order count per customer through order_items needs DISTINCT, otherwise multi-item orders are counted repeatedly.", sql: "SELECT c.name, COUNT(DISTINCT o.id) AS orders, SUM(oi.qty * oi.unit_price) AS spent FROM customers c JOIN orders o ON o.customer_id = c.id JOIN order_items oi ON oi.order_id = o.id GROUP BY c.id, c.name;" },
    internals: "Row multiplication is the biggest source of wrong reports: an order with 3 items becomes 3 rows, so SUM(order.total) is tripled. Keep track of the grain (what one row means) after every join.",
    mistakes: ["SUM of a parent column after a one-to-many join.", "Putting an optional-table filter in WHERE instead of ON.", "Joining on the wrong key."],
    interview: [["Why did my SUM double after adding a join?", "The join repeated parent rows for each child; aggregate at the right grain or use DISTINCT/subqueries."], ["Anti-join vs semi-join?", "Anti = rows with no match; semi = rows with at least one match, without duplicates."]],
    revise: ["Track the grain after each join.", "ON vs WHERE for outer joins.", "Anti-join NOT EXISTS, semi-join EXISTS."]
  },
  {
    day: 13, mods: ["subx", "ops"],
    intro: "A subquery is a query inside another query. It answers a question in steps: first compute, then use the result.",
    notes: [
      "A subquery is a SELECT nested inside another statement, in parentheses.",
      "Nested queries can be several levels deep, each feeding the next; readability drops quickly, so use CTEs for deep nesting.",
      "A single-row subquery returns one row, usable with =, <, > and so on.",
      "A multiple-row subquery returns many rows and needs IN, ANY, ALL or EXISTS.",
      "A scalar subquery returns exactly one value (one row, one column) and can appear wherever an expression can.",
      "A non-correlated subquery does not refer to the outer query and can be evaluated once.",
      "A correlated subquery refers to the outer row, so its result depends on the row being tested.",
      "A subquery in SELECT supplies a per-row computed value and must return one value.",
      "A subquery in FROM (derived table) acts as a temporary table you can filter and join; it needs an alias in MySQL.",
      "A subquery in WHERE filters rows based on another query's result.",
      "IN compares with a set; EXISTS asks whether any row exists and stops at the first; for NULL-containing sets EXISTS is safer.",
      "NOT IN returns nothing if the subquery yields a NULL; NOT EXISTS has no such trap.",
      "x > ANY (set) means greater than at least one (the minimum); x > ALL (set) means greater than every value (the maximum).",
      "Conceptually a correlated subquery runs once per outer row; real optimizers decorrelate it into a join or semi-join where possible.",
      "Many subqueries can be written as joins and vice versa; choose by clarity, and check the plan when performance matters."
    ],
    example: { ds: "company", caption: "Correlated subquery: employees earning above their own department's average.", sql: "SELECT name, dept_id, salary FROM employees e WHERE salary > (SELECT AVG(salary) FROM employees WHERE dept_id = e.dept_id);" },
    internals: "MySQL 8 and PostgreSQL turn IN/EXISTS subqueries into semi-joins and NOT EXISTS into anti-joins; a correlated scalar subquery in SELECT may truly run per row, which is slow on large tables. A window function or join with a pre-aggregated derived table is the usual fix.",
    mistakes: ["Scalar subquery that returns more than one row (error).", "NOT IN with a NULL-able column.", "Correlated subquery on a big table without an index on the correlation column."],
    interview: [["Correlated vs non-correlated?", "Correlated references the outer query and depends on each outer row; non-correlated is independent."], ["IN vs EXISTS?", "Same answer for non-NULL data; EXISTS short-circuits and is NULL-safe."], ["Subquery or join?", "Equivalent for filtering; joins when you need the other table's columns."]],
    revise: ["Scalar = one value.", "Correlated = uses outer row.", "Prefer NOT EXISTS over NOT IN."]
  },
  {
    day: 14, mods: ["setop"],
    intro: "Set operators combine whole result sets vertically, unlike joins which combine them horizontally.",
    notes: [
      "UNION stacks two result sets and removes duplicate rows.",
      "UNION ALL stacks two result sets and keeps every row, including duplicates.",
      "UNION ALL is faster because it skips the de-duplication; use UNION only when you need distinct rows.",
      "INTERSECT returns rows that appear in both result sets (MySQL supports it from 8.0.31).",
      "EXCEPT returns rows of the first result that do not appear in the second; order matters.",
      "MINUS is Oracle's name for EXCEPT.",
      "Rules: same number of columns, compatible types by position, column names come from the first query, one final ORDER BY."
    ],
    example: { ds: "company", caption: "Which employee cities are not department locations?", sql: "SELECT city FROM employees EXCEPT SELECT location FROM departments;" },
    internals: "UNION, INTERSECT and EXCEPT need duplicate elimination, which means sorting or hashing the whole result; UNION ALL just streams rows. Combining queries over different tables with an OR condition can sometimes be faster as a UNION ALL when each branch uses its own index.",
    mistakes: ["Using UNION where UNION ALL would do.", "Mismatched column order between the two queries.", "ORDER BY inside each branch instead of once at the end."],
    interview: [["UNION vs UNION ALL?", "UNION removes duplicates and is slower; UNION ALL keeps all rows."], ["EXCEPT in MySQL?", "Available from 8.0.31; earlier use NOT EXISTS or LEFT JOIN."]],
    revise: ["UNION distinct, UNION ALL all.", "INTERSECT = in both, EXCEPT = in first only.", "Columns matched by position."]
  },
  {
    day: 15, mods: ["casex"],
    intro: "CASE adds conditional logic to a query; COALESCE and friends handle missing values.",
    notes: [
      "CASE WHEN returns a value depending on conditions, like if/else inside SQL.",
      "Simple CASE compares one expression with values: CASE col WHEN 1 THEN 'a' WHEN 2 THEN 'b' END.",
      "Searched CASE evaluates arbitrary conditions: CASE WHEN salary > 100 THEN 'high' ELSE 'low' END.",
      "CASE expressions can be nested; keep them shallow and test NULL first.",
      "Conditional aggregation places a CASE inside SUM/COUNT/AVG to compute several filtered totals in one pass (pivots, rates).",
      "IF(condition, a, b) is MySQL's compact two-way CASE.",
      "IFNULL(x, y) returns y when x is NULL (MySQL/SQLite; NVL in Oracle, ISNULL in SQL Server).",
      "COALESCE(a, b, c, ...) returns the first non-NULL argument and is standard SQL.",
      "NULLIF(a, b) returns NULL when a equals b, typically to avoid division by zero.",
      "Handling missing values: decide per column whether to ignore, default, or flag them; never silently turn unknown into zero in a report.",
      "NULL means unknown, 0 is a number and '' is a known empty text; they behave differently in comparisons, joins, COUNT and AVG."
    ],
    example: { ds: "lab", caption: "CASE with NULL first, then ranges.", sql: "SELECT student_id, course_id, CASE WHEN grade IS NULL THEN 'Pending' WHEN grade >= 85 THEN 'A' WHEN grade >= 70 THEN 'B' ELSE 'C' END AS result FROM enrolments;" },
    internals: "CASE evaluates WHEN branches in order and stops at the first true one; types of all THEN branches must be compatible. An expression in the SELECT list is computed after filtering and grouping.",
    mistakes: ["Testing a range before IS NULL.", "Using = NULL in a WHEN.", "Treating NULL and '' as the same value."],
    interview: [["COALESCE vs IFNULL?", "COALESCE takes any number of arguments and is standard; IFNULL takes two and is MySQL-specific."], ["How do you avoid division by zero?", "Divide by NULLIF(denominator, 0)."]],
    revise: ["CASE order matters.", "COALESCE = first non-NULL.", "NULLIF(x, 0) avoids divide-by-zero."]
  }
);

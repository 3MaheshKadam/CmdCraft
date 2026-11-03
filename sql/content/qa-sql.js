/**
 * SQL interview Q&A (roadmap Day 34 mock interviews). Same shape as the Linux and AI banks:
 * { q, a, f:[[q,a]], probe, trap?, lv: "core" | "pro" | "tricky" }.
 */
window.SQL_INTERVIEW = [
  {
    id: "basics", name: "Fundamentals and keys", icon: "fa-database",
    summary: "Databases, keys, data types, constraints: the vocabulary an interviewer expects you to use without hesitation.",
    topics: [{ id: "basics-q", t: "Questions", qa: [
      { lv: "core", q: "What is the difference between a primary key, a unique key and a foreign key?", probe: "Clear definitions with NULL behaviour and a use for each.",
        a: "- **Primary key:** uniquely identifies a row, never NULL, one per table; in InnoDB it is also the clustered index.\n- **Unique key:** also unique, but a table can have many and (in most engines) they allow NULLs.\n- **Foreign key:** a column that must match a key in another table (or be NULL); it enforces referential integrity and defines relationships.",
        f: [["Can a foreign key be NULL?", "Yes; NULL means the optional relationship is absent."], ["Can a table have two primary keys?", "No, but the primary key can be composite."]] },
      { lv: "core", q: "DELETE vs TRUNCATE vs DROP?", probe: "Scope, rollback, speed, side effects.",
        a: "- **DELETE** removes selected rows (WHERE), fires triggers, is logged per row and can be rolled back.\n- **TRUNCATE** removes all rows quickly, resets AUTO_INCREMENT, no WHERE; in MySQL it is DDL and auto-commits.\n- **DROP** removes the table with its data, indexes and constraints.",
        f: [["Which one would you use to empty a 100-million-row staging table?", "TRUNCATE; DELETE would take long and bloat the log."]] },
      { lv: "core", q: "How do you store money, and why not FLOAT?", probe: "Binary floating point error.",
        a: "Use **DECIMAL(p, s)** (or integer cents). FLOAT/DOUBLE are binary approximations, so 0.1 + 0.2 is not exactly 0.3 and sums drift; DECIMAL is exact.",
        f: [["What precision would you pick?", "Enough for the currency and the largest total, for example DECIMAL(14, 2); use more decimals when rates are involved."]] },
      { lv: "core", q: "What does NULL mean and how does it behave?", probe: "Three-valued logic.",
        a: "NULL means unknown or missing. Any comparison with NULL is unknown (not true), so use IS NULL. Aggregates skip NULLs (COUNT(*) aside). UNIQUE columns allow several NULLs in most engines. In ORDER BY, NULLs sort first in MySQL ascending.",
        trap: "Saying NULL equals zero or an empty string.",
        f: [["Why does NOT IN return nothing when the list contains NULL?", "x <> NULL is unknown for every row; use NOT EXISTS or filter NULLs."]] },
      { lv: "pro", q: "Surrogate key or natural key as the primary key?", probe: "A reasoned trade-off.",
        a: "Prefer a **surrogate** key (auto-increment or UUID): it is stable, small and meaningless, so updates never cascade and secondary indexes stay compact in InnoDB. Keep the natural key as a **UNIQUE** constraint to enforce the business rule. Natural keys can change (email), can be long, and may leak information.",
        f: [["UUID or auto-increment?", "Auto-increment is compact and ordered (good locality); random UUIDv4 fragments the clustered index. UUIDv7 or ordered UUIDs give uniqueness across systems with better locality."]] }
    ] }]
  },
  {
    id: "querying", name: "Querying, grouping and NULLs", icon: "fa-magnifying-glass",
    summary: "SELECT order of execution, WHERE vs HAVING, DISTINCT, aggregates and conditional logic.",
    topics: [{ id: "querying-q", t: "Questions", qa: [
      { lv: "core", q: "In what order does the database logically evaluate a SELECT statement?", probe: "FROM first, SELECT late, and consequences.",
        a: "**FROM/JOIN, WHERE, GROUP BY, HAVING, window functions, SELECT, DISTINCT, ORDER BY, LIMIT.** Consequences: WHERE cannot see SELECT aliases or aggregates; ORDER BY can use aliases; window functions cannot be filtered in the same SELECT's WHERE.",
        f: [["How do you filter on a window function?", "Put the query in a subquery or CTE and filter in the outer query."]] },
      { lv: "core", q: "WHERE vs HAVING?", probe: "Rows vs groups.",
        a: "WHERE filters rows **before** grouping (and can use indexes). HAVING filters **groups after** aggregation, so it can use aggregates. Put everything you can in WHERE.",
        f: [["Write: departments with more than 3 employees hired after 2020.", "SELECT dept_id, COUNT(*) FROM employees WHERE hire_date > '2020-12-31' GROUP BY dept_id HAVING COUNT(*) > 3;"]] },
      { lv: "core", q: "COUNT(*), COUNT(column) and COUNT(DISTINCT column)?", probe: "NULL handling.",
        a: "COUNT(*) counts rows; COUNT(col) counts rows where col is not NULL; COUNT(DISTINCT col) counts distinct non-NULL values.",
        f: [["What does SUM return over zero rows?", "NULL, so wrap it with COALESCE when the report needs 0."]] },
      { lv: "pro", q: "Why does SELECT dept, name, COUNT(*) FROM e GROUP BY dept fail on MySQL 8?", probe: "ONLY_FULL_GROUP_BY and functional dependence.",
        a: "name is neither grouped nor aggregated, so the value is ambiguous (ONLY_FULL_GROUP_BY, on by default). Fix it by grouping by name too, aggregating it (MAX/ANY_VALUE), or restructuring with a window function if you need per-row detail beside the group count.",
        f: [["When is selecting a non-grouped column allowed?", "When it is functionally dependent on the group key, for example grouping by the primary key."]] },
      { lv: "pro", q: "How do you build a pivot table in SQL?", probe: "Conditional aggregation.",
        a: "One conditional aggregate per output column: `SELECT student, MAX(CASE WHEN subject = 'Math' THEN score END) AS math, MAX(CASE WHEN subject = 'Physics' THEN score END) AS physics FROM scores GROUP BY student;`. The column list is fixed at parse time, so a dynamic pivot builds the SQL text in code and runs it as a prepared statement.",
        f: [["How do you unpivot?", "UNION ALL of one SELECT per column (or LATERAL/UNPIVOT in other engines)."]] }
    ] }]
  },
  {
    id: "joins", name: "Joins and subqueries", icon: "fa-diagram-project",
    summary: "Join types, anti and semi joins, duplicated rows, correlated subqueries and set operators.",
    topics: [{ id: "joins-q", t: "Questions", qa: [
      { lv: "core", q: "Explain INNER, LEFT, RIGHT, FULL and CROSS joins.", probe: "What survives from each side.",
        a: "- **INNER:** only matching rows.\n- **LEFT:** all left rows, NULLs for non-matching right columns.\n- **RIGHT:** the mirror image.\n- **FULL OUTER:** all rows from both sides (MySQL: LEFT UNION RIGHT).\n- **CROSS:** every combination, m x n rows.",
        f: [["Which join finds customers who never ordered?", "LEFT JOIN orders and keep rows where the order key IS NULL (or NOT EXISTS)."]] },
      { lv: "pro", q: "My SUM doubled after I added a join. Why?", probe: "Row multiplication and grain.",
        a: "A one-to-many join repeats each parent row once per child row, so summing a parent column counts it several times. Fix by aggregating at the right grain: pre-aggregate the child table in a derived table/CTE, use COUNT(DISTINCT id), or sum the child column instead.",
        trap: "Adding DISTINCT to the SUM, which removes legitimate equal values.",
        f: [["How can you detect it?", "Compare row counts before and after the join; check the grain of the result."]] },
      { lv: "pro", q: "Why does a WHERE on the right table turn my LEFT JOIN into an INNER JOIN?", probe: "NULL-extended rows fail the filter.",
        a: "Unmatched rows have NULL in the right table's columns; `WHERE r.status = 'paid'` is not true for NULL so those rows are removed. Move the condition into the ON clause to filter the right table before the join and keep the left rows.",
        f: [["How do you filter for 'no match' then?", "WHERE r.key IS NULL, which intentionally keeps only the unmatched rows."]] },
      { lv: "core", q: "IN vs EXISTS, and NOT IN vs NOT EXISTS?", probe: "NULL trap.",
        a: "For non-NULL data they return the same results and modern optimizers often plan them identically. EXISTS short-circuits and ignores NULLs. **NOT IN returns nothing if the subquery produces a NULL**, so prefer NOT EXISTS (or filter NULLs).",
        f: [["Rewrite NOT IN as an anti-join.", "LEFT JOIN ... WHERE right.key IS NULL, or NOT EXISTS (SELECT 1 ...)."]] },
      { lv: "core", q: "UNION vs UNION ALL?", probe: "Duplicates and cost.",
        a: "UNION removes duplicates (sort or hash, slower); UNION ALL keeps everything and is cheaper. Use UNION ALL unless duplicates must be removed. Both need the same number of compatible columns.",
        f: [["How do you get rows in A but not in B?", "EXCEPT/MINUS (MySQL 8.0.31+) or NOT EXISTS / LEFT JOIN anti-join."]] },
      { lv: "pro", q: "What is a correlated subquery and when is it a problem?", probe: "Per-row execution and the alternatives.",
        a: "A subquery that references the outer row, so conceptually it runs once per outer row. The optimizer may decorrelate it into a join; if not, cost grows with the outer row count. Alternatives: a join to a pre-aggregated derived table, or a window function (AVG(salary) OVER (PARTITION BY dept)).",
        f: [["Employees earning above their department average, three ways?", "Correlated subquery; join to a per-dept average CTE; window AVG() OVER (PARTITION BY dept) filtered in an outer query."]] }
    ] }]
  },
  {
    id: "analytics", name: "Window functions, CTEs, dates", icon: "fa-chart-line",
    summary: "Ranking, running totals, gaps and islands, recursive queries and date arithmetic.",
    topics: [{ id: "analytics-q", t: "Questions", qa: [
      { lv: "core", q: "ROW_NUMBER vs RANK vs DENSE_RANK?", probe: "Tie behaviour with an example.",
        a: "For scores 90, 90, 80: ROW_NUMBER = 1, 2, 3 (unique); RANK = 1, 1, 3 (ties share a rank, then skip); DENSE_RANK = 1, 1, 2 (no gaps). 'Top N salaries' usually means DENSE_RANK; 'exactly one row per group' means ROW_NUMBER.",
        f: [["Write the 3rd highest salary.", "SELECT DISTINCT salary FROM (SELECT salary, DENSE_RANK() OVER (ORDER BY salary DESC) r FROM emp) t WHERE r = 3;"]] },
      { lv: "pro", q: "Top 3 earners in each department.", probe: "Partitioned ranking in an outer query.",
        a: "```sql\nSELECT dept_id, name, salary FROM (\n  SELECT dept_id, name, salary,\n         DENSE_RANK() OVER (PARTITION BY dept_id ORDER BY salary DESC) AS r\n  FROM employees) t\nWHERE r <= 3;\n```\nClarify ties first: DENSE_RANK keeps everyone tied inside the top 3 salary levels; ROW_NUMBER returns exactly three rows.",
        f: [["Without window functions?", "A correlated subquery counting how many distinct higher salaries exist in the same department (< 3)."]] },
      { lv: "pro", q: "Find users who logged in on 3 or more consecutive days.", probe: "Gaps-and-islands technique.",
        a: "De-duplicate to one row per user and day, subtract the row number (in days) from the date: it is constant within a streak. Group by user and that value, `HAVING COUNT(*) >= 3`.\n\n`SELECT user_id, MIN(d), COUNT(*) FROM (SELECT user_id, d, julianday(d) - ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY d) g FROM (SELECT DISTINCT user_id, login_date d FROM logins)) GROUP BY user_id, g HAVING COUNT(*) >= 3;`",
        trap: "Forgetting to de-duplicate: two logins on one day break the arithmetic.",
        f: [["Alternative approach?", "Self join on date + 1 and date + 2, or LAG(date, 2) = date - 2."]] },
      { lv: "pro", q: "Why can't I use a window function in WHERE, and what do I do?", probe: "Logical order.",
        a: "Windows are evaluated after WHERE, GROUP BY and HAVING. Compute them in a subquery or CTE and filter in the outer query (QUALIFY exists in Snowflake/BigQuery but not in MySQL).",
        f: [["What is the default frame with ORDER BY?", "RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW, which is why LAST_VALUE returns the current row."]] },
      { lv: "core", q: "CTE vs subquery vs temporary table?", probe: "Scope, reuse, indexing.",
        a: "A **CTE** names a subquery for readability and recursion inside one statement. A derived **subquery** is the unnamed equivalent. A **temporary table** is stored for the session, can be indexed and reused across statements; choose it when an intermediate result is reused or large.",
        f: [["Is a CTE always materialised?", "No; engines may inline it. MySQL 8 materialises when referenced several times."]] },
      { lv: "pro", q: "How do you query a hierarchy such as employees and managers?", probe: "Recursive CTE.",
        a: "A recursive CTE: the anchor selects the root (manager_id IS NULL, level 1); the recursive member joins employees to the CTE on manager_id = cte.id and adds 1 to the level. Add a path or depth limit to detect cycles. Use UNION ALL.",
        f: [["How would you list all reports of a manager?", "Anchor on that manager's direct reports, recurse downward."], ["Other models for trees?", "Nested sets, materialized paths, closure tables for heavy read workloads."]] },
      { lv: "core", q: "Why is WHERE YEAR(order_date) = 2024 a bad filter, and how do you fix it?", probe: "SARGability.",
        a: "Wrapping the column in a function prevents index use, forcing a scan. Use a half-open range: `order_date >= '2024-01-01' AND order_date < '2025-01-01'`, which also works for timestamps.",
        f: [["Does BETWEEN work for datetimes?", "It includes the end value only at midnight, missing most of the last day: prefer half-open ranges."]] }
    ] }]
  },
  {
    id: "design", name: "Design and normalization", icon: "fa-sitemap",
    summary: "Normal forms, anomalies, relationships, denormalization trade-offs and designing real schemas.",
    topics: [{ id: "design-q", t: "Questions", qa: [
      { lv: "core", q: "Explain 1NF, 2NF and 3NF with an example.", probe: "Partial and transitive dependencies.",
        a: "- **1NF:** atomic values, no repeating groups (no '1,2,3' in a cell).\n- **2NF:** 1NF and no *partial* dependency: every non-key column depends on the **whole** composite key (in order_items(order_id, product_id, product_name), product_name depends only on product_id).\n- **3NF:** 2NF and no *transitive* dependency: non-key columns depend only on the key (employee.dept_id -> dept_name belongs in departments).\n\nMemory aid: the key, the whole key and nothing but the key.",
        f: [["What is BCNF?", "A stricter 3NF: every determinant must be a candidate key."]] },
      { lv: "core", q: "What anomalies does normalization prevent?", probe: "Insertion, update, deletion.",
        a: "**Insertion:** cannot store a fact without another (a product that nobody ordered). **Update:** one fact stored many times must change everywhere or becomes inconsistent. **Deletion:** removing one fact destroys another (deleting a customer's last order loses the customer).",
        f: [["Show an update anomaly.", "A customer's email repeated on every order row; updating only some rows leaves two emails for one customer."]] },
      { lv: "pro", q: "When would you denormalize?", probe: "Measured need and how to keep it consistent.",
        a: "When measured read performance or reporting needs justify it: precomputed totals, summary tables, copying a name to avoid a join in a hot query. The price is redundancy: keep copies in sync with triggers, jobs or application logic, and document the source of truth. Start normalized, denormalize with evidence.",
        f: [["How do you keep a summary table fresh?", "Triggers, scheduled refresh, or compute on read with caching; choose by staleness tolerance."]] },
      { lv: "pro", q: "Design a schema for an e-commerce store.", probe: "Entities, keys, history, constraints.",
        a: "customers, addresses, products, categories, orders (customer_id, status, placed_at), order_items (order_id, product_id, qty, **unit_price at purchase time**), payments, inventory, reviews. Many-to-many via junction tables; surrogate keys; foreign keys with sensible ON DELETE actions; CHECK(qty > 0); indexes on foreign keys and common filters (customer_id, placed_at). Store prices on the line because product prices change.",
        f: [["How do you model product variants?", "A products table plus a variants (SKU) table, with attributes either as columns or a controlled attribute table; avoid free-form EAV unless truly needed."], ["Soft delete?", "A deleted_at column with partial/filtered indexes; or archive tables."]] },
      { lv: "pro", q: "Model a bank so balances can always be trusted.", probe: "Ledger, atomicity, constraints.",
        a: "accounts (CHECK balance >= 0 or computed), an **append-only ledger** of signed entries, transfers as **two ledger rows plus two balance updates in one transaction**, consistent lock order (lower account id first) to avoid deadlocks, audit triggers, and periodic reconciliation of stored balance against the ledger sum. DECIMAL, never FLOAT.",
        f: [["Why an append-only ledger?", "History is never lost, balances are reproducible, and corrections are new entries."]] }
    ] }]
  },
  {
    id: "transactions", name: "Transactions and concurrency", icon: "fa-lock",
    summary: "ACID, isolation levels and anomalies, locking, deadlocks and how to avoid lost updates.",
    topics: [{ id: "transactions-q", t: "Questions", qa: [
      { lv: "core", q: "Explain ACID with a bank transfer.", probe: "Each property tied to the example.",
        a: "- **Atomicity:** debit and credit both happen or neither does.\n- **Consistency:** constraints hold (no negative balance) and total money is unchanged.\n- **Isolation:** other sessions never see money 'in flight'.\n- **Durability:** once COMMIT returns, a crash cannot lose it (write-ahead log).",
        f: [["How does the database implement atomicity and durability?", "Undo logs for rollback and a redo/write-ahead log flushed at commit."]] },
      { lv: "pro", q: "Name the isolation levels and the anomalies they permit.", probe: "A complete table.",
        a: "| Level | Dirty read | Non-repeatable | Phantom |\n|---|---|---|---|\n| READ UNCOMMITTED | yes | yes | yes |\n| READ COMMITTED | no | yes | yes |\n| REPEATABLE READ | no | no | possible (InnoDB mostly prevents with gap locks) |\n| SERIALIZABLE | no | no | no |\n\nInnoDB defaults to REPEATABLE READ; PostgreSQL, Oracle and SQL Server default to READ COMMITTED.",
        f: [["What is a lost update and how do you prevent it?", "Two transactions read the same value and overwrite each other. Use an atomic UPDATE (x = x - 1), SELECT ... FOR UPDATE, or optimistic versioning."]] },
      { lv: "pro", q: "What is a deadlock and how do you handle it?", probe: "Detection, retry, prevention.",
        a: "Two transactions each hold a lock the other needs. The engine detects the cycle and aborts one (the victim). The application must **catch the error and retry**. Prevent them with a consistent lock order, short transactions, indexes that narrow the locked rows, and avoiding user interaction inside a transaction.",
        f: [["How do you investigate one in MySQL?", "SHOW ENGINE INNODB STATUS (latest detected deadlock), innodb_print_all_deadlocks, and the performance_schema data_locks tables."]] },
      { lv: "tricky", q: "Pessimistic vs optimistic locking?", probe: "When conflicts are frequent or rare.",
        a: "**Pessimistic:** lock first (`SELECT ... FOR UPDATE`); safe when conflicts are likely or the work is critical, but blocks others. **Optimistic:** read a version, then `UPDATE ... WHERE id = ? AND version = ?` and retry if zero rows were affected; best when conflicts are rare and transactions would otherwise be long.",
        f: [["What does SKIP LOCKED do?", "Skips rows locked by others: the building block for work queues."]] },
      { lv: "core", q: "What does autocommit do, and what happens to DDL inside a transaction in MySQL?", probe: "Implicit commits.",
        a: "With autocommit on, each statement is its own transaction. START TRANSACTION suspends it until COMMIT/ROLLBACK. In MySQL, DDL (CREATE, ALTER, DROP, TRUNCATE) causes an implicit commit and cannot be rolled back; PostgreSQL has transactional DDL.",
        f: [["What is a savepoint?", "A marker allowing ROLLBACK TO name inside a transaction without abandoning earlier work."]] }
    ] }]
  },
  {
    id: "performance", name: "Indexing and performance", icon: "fa-gauge-high",
    summary: "How indexes work, reading plans, SARGable queries and fixing slow queries.",
    topics: [{ id: "performance-q", t: "Questions", qa: [
      { lv: "core", q: "How does an index work and what is the trade-off?", probe: "B+ tree, read vs write.",
        a: "An index is a separate sorted structure (usually a **B+ tree**) mapping key values to rows. The engine descends 3-4 levels instead of scanning the table, and range scans follow linked leaves. Cost: disk/memory, and every INSERT/UPDATE/DELETE must maintain each index. Index columns used in WHERE, JOIN and ORDER BY on read-heavy tables.",
        f: [["Clustered vs non-clustered?", "A clustered index defines the physical row order (InnoDB primary key; rows live in the leaves). Non-clustered indexes are separate and, in InnoDB, store the primary key to find the row."]] },
      { lv: "pro", q: "Explain the leftmost-prefix rule and how you choose composite index column order.", probe: "Equality first, then range, then sort.",
        a: "An index on (a, b, c) is sorted by a, then b, then c, so it serves filters on a, (a, b) and (a, b, c), but not b or c alone. Order columns: **equality predicates first, then one range column, then ORDER BY columns**; put the most selective equality column first when order is otherwise free. A matching ORDER BY lets the index return rows already sorted (no filesort).",
        f: [["Is an index on (a) redundant if (a, b) exists?", "Usually yes for lookups on a; the longer index covers it."]] },
      { lv: "pro", q: "A query is slow. How do you find out why and fix it?", probe: "A repeatable method.",
        a: "1. Reproduce with realistic data. 2. **EXPLAIN (ANALYZE)**: look for full scans, filesort, temporary tables, large estimated-vs-actual gaps. 3. Check predicates are SARGable and types match. 4. Add or adjust an index (composite, covering), or rewrite (EXISTS, pre-aggregate, keyset pagination). 5. Update statistics. 6. Re-run EXPLAIN and measure; watch the write cost of the new index.",
        f: [["What if EXPLAIN shows an index but it is still slow?", "It may return too many rows (low selectivity), do many random lookups (use a covering index), or the estimates are wrong (stale statistics)."]] },
      { lv: "pro", q: "What is a covering index?", probe: "No table access.",
        a: "An index that contains every column the query reads, so the engine answers from the index alone (EXPLAIN: Using index). Example: `CREATE INDEX i ON orders(customer_id, order_date, total)` covers `SELECT order_date, total FROM orders WHERE customer_id = ?`.",
        f: [["Downside?", "Wider indexes use more space and slow writes."]] },
      { lv: "tricky", q: "Why is OFFSET pagination slow and what is the alternative?", probe: "Keyset pagination.",
        a: "OFFSET n reads and discards n rows, so deep pages cost O(n). **Keyset (seek) pagination** remembers the last key and queries `WHERE (created_at, id) < (:last_created, :last_id) ORDER BY created_at DESC, id DESC LIMIT 20`, using an index to jump straight there. Downside: no random page jump.",
        f: [["How do you handle ties in the sort column?", "Add the unique id as a tie-breaker in both ORDER BY and the seek condition."]] },
      { lv: "tricky", q: "Compare nested loop, hash and merge joins.", probe: "When each is chosen.",
        a: "**Nested loop:** for each outer row probe the inner side; great with an index on the inner join key and a small outer input. **Hash join:** build a hash table on the smaller input, probe with the other; good for large unindexed equality joins, needs memory. **Merge join:** walk two inputs sorted on the key; efficient when both are already sorted. The cost-based optimizer picks using statistics.",
        f: [["Which does MySQL support?", "Nested loop for years; hash join from 8.0.18; no merge join."]] }
    ] }]
  },
  {
    id: "scenarios", name: "Scenarios: explain your approach", icon: "fa-user-tie",
    summary: "Open-ended questions: how you would investigate, migrate or fix production SQL problems.",
    topics: [{ id: "scenarios-q", t: "Questions", qa: [
      { lv: "pro", q: "Someone ran UPDATE users SET plan = 'free' without a WHERE in production. What do you do?", probe: "Calm, ordered recovery.",
        a: "1. **Stop the bleeding:** tell people, block further writes if needed. 2. Assess scope: when it happened, rows affected. 3. **Recover**: if it ran in a transaction, ROLLBACK; otherwise restore the table from the latest backup to a side table and apply binlog/point-in-time recovery up to just before the statement, then merge the correct values back with an UPDATE ... JOIN. 4. Verify counts against the backup. 5. Post-mortem: safe-updates mode, review process, least-privilege accounts, run risky changes in a transaction after a SELECT.",
        f: [["How do you prevent it?", "sql_safe_updates, peer review, read-only default roles, migrations through tooling."]] },
      { lv: "pro", q: "How would you add a NOT NULL column with a default to a 500-million-row table with no downtime?", probe: "Online schema change.",
        a: "Check if the engine can do it instantly (MySQL 8 ALGORITHM=INSTANT for adding a column). Otherwise use an online schema change tool (gh-ost, pt-online-schema-change, pg: add nullable column, backfill in batches, add the constraint NOT VALID then VALIDATE). Steps: add the column nullable with a default, backfill in small batches, deploy code that writes it, then enforce NOT NULL. Test on a copy and watch replication lag.",
        f: [["Why backfill in batches?", "To avoid long locks, huge undo logs and replication lag."]] },
      { lv: "pro", q: "The monthly revenue report shows the wrong total after a developer added a join. How do you debug it?", probe: "Grain and duplicates.",
        a: "Compare row counts before and after the join, find the table that multiplies rows (one-to-many), and check the grain. Fix by aggregating the many side first in a CTE/derived table, or by joining at the correct level. Add a reconciliation check (sum from the base table equals the report).",
        f: [["How do you stop it regressing?", "A test comparing the report total with the source-of-truth total."]] },
      { lv: "tricky", q: "Two services transfer money between the same pair of accounts and you see deadlocks. Fix it.", probe: "Lock ordering.",
        a: "Each transaction locks the source row then the destination row, so A->B and B->A deadlock. Lock in a **canonical order** (lowest id first) regardless of direction, keep the transaction short, and retry on deadlock errors. A single atomic statement per row (`UPDATE ... SET balance = balance - ? WHERE id = ? AND balance >= ?`) avoids read-modify-write races.",
        f: [["How do you verify the fix?", "Load-test with opposite-direction transfers and check the deadlock counters."]] },
      { lv: "tricky", q: "Explain your query verbally: top 3 customers by revenue per country.", probe: "Structured explanation, not code recital.",
        a: "'First I compute revenue per customer by joining customers, orders and order items and summing quantity times price for delivered orders, grouping by customer and country. Then, in an outer query, I rank customers inside each country with DENSE_RANK ordered by revenue descending and keep ranks up to three. I use a CTE for the first step so each part is readable. I would ask whether ties should all be included and whether cancelled orders count.'",
        f: [["How would you test it?", "A tiny dataset with a tie, a customer with no delivered orders and a country with only two customers."]] }
    ] }]
  }
];

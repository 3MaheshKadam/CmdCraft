/**
 * Extra practice datasets for the full roadmap (loaded after problems.js, which defines SQL_DATASETS / SQL_MODULES / SQL_PROBLEMS).
 */
Object.assign(window.SQL_DATASETS, {
  lab: {
    name: "Student lab",
    blurb: "A tiny school schema for DDL, constraints and DML practice: students, courses, enrolments.",
    sql: `
CREATE TABLE students(id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT, age INTEGER, city TEXT);
INSERT INTO students VALUES (1,'Asha Rao','asha@uni.edu',20,'Pune'),(2,'Bilal Khan','bilal@uni.edu',22,'Delhi'),(3,'Carla Gomez','carla@uni.edu',21,'Pune'),(4,'Deepak Nair','deepak@uni.edu',19,NULL),(5,'Esha Iyer','esha@uni.edu',23,'Mumbai');
CREATE TABLE courses(id INTEGER PRIMARY KEY, title TEXT NOT NULL, credits INTEGER);
INSERT INTO courses VALUES (1,'Databases',4),(2,'Algorithms',4),(3,'Statistics',3),(4,'Ethics',2);
CREATE TABLE enrolments(student_id INTEGER REFERENCES students(id), course_id INTEGER REFERENCES courses(id), grade INTEGER, PRIMARY KEY(student_id, course_id));
INSERT INTO enrolments VALUES (1,1,88),(1,2,76),(2,1,91),(3,1,67),(3,3,72),(4,2,NULL),(5,1,95),(5,3,81);
`
  },
  bank: {
    name: "Bank",
    blurb: "Customers, accounts and a transaction ledger, with CHECK and FOREIGN KEY constraints.",
    sql: `
CREATE TABLE bank_customers(id INTEGER PRIMARY KEY, name TEXT NOT NULL, city TEXT, joined TEXT);
INSERT INTO bank_customers VALUES (1,'Mira Shah','Mumbai','2020-01-10'),(2,'Omar Ali','Dubai','2021-05-22'),(3,'Lena Fox','Berlin','2019-11-03'),(4,'Raj Mehta','Mumbai','2022-08-15'),(5,'Sara Kim','Seoul','2023-02-01'),(6,'Tom Reed','London','2023-09-30');
CREATE TABLE accounts(id INTEGER PRIMARY KEY, customer_id INTEGER NOT NULL REFERENCES bank_customers(id), type TEXT NOT NULL CHECK(type IN ('savings','current')), balance REAL NOT NULL CHECK(balance >= 0), opened TEXT);
INSERT INTO accounts VALUES (101,1,'savings',5000,'2020-01-10'),(102,1,'current',1200,'2020-02-01'),(103,2,'savings',800,'2021-05-22'),(104,3,'current',15000,'2019-11-03'),(105,4,'savings',0,'2022-08-15'),(106,5,'current',300,'2023-02-01');
CREATE TABLE txns(id INTEGER PRIMARY KEY, account_id INTEGER NOT NULL REFERENCES accounts(id), kind TEXT NOT NULL CHECK(kind IN ('deposit','withdraw','transfer_in','transfer_out')), amount REAL NOT NULL CHECK(amount > 0), ts TEXT NOT NULL);
INSERT INTO txns VALUES (1,101,'deposit',5000,'2024-01-02 09:00'),(2,102,'deposit',1500,'2024-01-03 10:30'),(3,102,'withdraw',300,'2024-01-09 14:00'),(4,103,'deposit',800,'2024-01-11 11:15'),(5,104,'deposit',16000,'2024-01-15 08:45'),(6,104,'withdraw',1000,'2024-02-01 16:20'),(7,101,'transfer_out',500,'2024-02-05 12:00'),(8,106,'transfer_in',500,'2024-02-05 12:00'),(9,106,'withdraw',200,'2024-02-12 13:10'),(10,103,'deposit',200,'2024-02-20 09:30'),(11,103,'withdraw',200,'2024-03-01 10:00');
`
  },
  metrics: {
    name: "Metrics",
    blurb: "Logins, signups, a numbers table, monthly revenue, scores, duplicate emails and a ledger: the classic interview shapes.",
    sql: `
CREATE TABLE signups(user_id INTEGER PRIMARY KEY, signup_date TEXT);
INSERT INTO signups VALUES (1,'2024-01-01'),(2,'2024-01-01'),(3,'2024-01-02'),(4,'2024-01-05'),(5,'2024-01-05');
CREATE TABLE logins(user_id INTEGER, login_date TEXT);
INSERT INTO logins VALUES (1,'2024-01-01'),(1,'2024-01-02'),(1,'2024-01-03'),(1,'2024-01-07'),(1,'2024-01-08'),(2,'2024-01-01'),(2,'2024-01-02'),(2,'2024-01-09'),(3,'2024-01-02'),(3,'2024-01-04'),(3,'2024-01-05'),(3,'2024-01-06'),(4,'2024-01-05'),(5,'2024-01-05'),(5,'2024-01-06');
CREATE TABLE numbers(id INTEGER PRIMARY KEY, num INTEGER);
INSERT INTO numbers VALUES (1,1),(2,1),(3,1),(4,2),(5,1),(6,2),(7,2),(8,2),(9,3);
CREATE TABLE monthly_revenue(month TEXT PRIMARY KEY, revenue INTEGER);
INSERT INTO monthly_revenue VALUES ('2023-01',100),('2023-02',120),('2023-03',90),('2023-04',150),('2023-05',160),('2023-06',130),('2023-07',170),('2023-08',180),('2023-09',140),('2023-10',200),('2023-11',210),('2023-12',250),('2024-01',130),('2024-02',150),('2024-03',120),('2024-04',190),('2024-05',210),('2024-06',160);
CREATE TABLE scores(student TEXT, subject TEXT, score INTEGER);
INSERT INTO scores VALUES ('Asha','Math',92),('Asha','Physics',85),('Bilal','Math',92),('Bilal','Physics',70),('Carla','Math',78),('Carla','Physics',88),('Dev','Math',65),('Dev','Physics',90),('Esha','Math',92),('Esha','Physics',60);
CREATE TABLE dup_users(id INTEGER PRIMARY KEY, email TEXT, name TEXT);
INSERT INTO dup_users VALUES (1,'a@x.com','Ann'),(2,'b@x.com','Bob'),(3,'a@x.com','Ann B'),(4,'c@x.com','Cy'),(5,'b@x.com','Bobby'),(6,'a@x.com','Ann C');
CREATE TABLE seq(id INTEGER PRIMARY KEY);
INSERT INTO seq VALUES (1),(2),(3),(7),(8),(10),(11),(12);
CREATE TABLE ledger(id INTEGER PRIMARY KEY, acct TEXT, delta INTEGER, ts TEXT);
INSERT INTO ledger VALUES (1,'A',100,'2024-01-01'),(2,'A',-30,'2024-01-02'),(3,'B',50,'2024-01-02'),(4,'A',20,'2024-01-04'),(5,'B',-10,'2024-01-05'),(6,'B',40,'2024-01-07'),(7,'A',-50,'2024-01-09');
CREATE TABLE salaries_flat(id INTEGER PRIMARY KEY, name TEXT, dept TEXT, salary INTEGER);
INSERT INTO salaries_flat VALUES (1,'A','X',50),(2,'B','X',60),(3,'C','X',70),(4,'D','X',80),(5,'E','Y',10),(6,'F','Y',20),(7,'G','Y',30);
`
  },
  hrm: {
    name: "HR management (Project 1)",
    blurb: "Employees, departments, salary history and daily attendance for the Employee Management project.",
    sql: `
CREATE TABLE departments(id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, budget INTEGER);
INSERT INTO departments VALUES (1,'Engineering',900000),(2,'Sales',400000),(3,'HR',150000),(4,'Finance',250000);
CREATE TABLE employees(id INTEGER PRIMARY KEY, name TEXT NOT NULL, dept_id INTEGER REFERENCES departments(id), manager_id INTEGER REFERENCES employees(id), hire_date TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active');
INSERT INTO employees VALUES (1,'Priya Nair',1,NULL,'2018-04-02','active'),(2,'Sam Ortiz',1,1,'2019-07-15','active'),(3,'Tara Bose',1,2,'2021-01-11','active'),(4,'Uma Joshi',2,1,'2020-03-09','active'),(5,'Vik Rao',2,4,'2022-06-20','active'),(6,'Wes Hall',2,4,'2023-02-13','resigned'),(7,'Xena Lim',3,1,'2019-10-01','active'),(8,'Yash Pal',4,1,'2021-09-27','active'),(9,'Zoya Dar',4,8,'2023-08-01','active');
CREATE TABLE salaries(emp_id INTEGER REFERENCES employees(id), amount INTEGER NOT NULL, from_date TEXT NOT NULL, to_date TEXT, PRIMARY KEY(emp_id, from_date));
INSERT INTO salaries VALUES (1,150000,'2018-04-02','2021-12-31'),(1,175000,'2022-01-01',NULL),(2,110000,'2019-07-15','2022-06-30'),(2,125000,'2022-07-01',NULL),(3,90000,'2021-01-11',NULL),(4,100000,'2020-03-09',NULL),(5,70000,'2022-06-20',NULL),(6,68000,'2023-02-13','2023-11-30'),(7,80000,'2019-10-01',NULL),(8,95000,'2021-09-27',NULL),(9,72000,'2023-08-01',NULL);
CREATE TABLE attendance(emp_id INTEGER REFERENCES employees(id), day TEXT, status TEXT CHECK(status IN ('present','absent','leave')), PRIMARY KEY(emp_id, day));
INSERT INTO attendance VALUES (1,'2024-03-04','present'),(1,'2024-03-05','present'),(1,'2024-03-06','leave'),(2,'2024-03-04','present'),(2,'2024-03-05','absent'),(2,'2024-03-06','present'),(3,'2024-03-04','present'),(3,'2024-03-05','present'),(3,'2024-03-06','present'),(4,'2024-03-04','absent'),(4,'2024-03-05','absent'),(4,'2024-03-06','present'),(5,'2024-03-04','present'),(5,'2024-03-05','leave'),(5,'2024-03-06','present'),(7,'2024-03-04','present'),(7,'2024-03-05','present'),(7,'2024-03-06','absent'),(8,'2024-03-04','present'),(8,'2024-03-05','present'),(8,'2024-03-06','present'),(9,'2024-03-04','present'),(9,'2024-03-05','absent'),(9,'2024-03-06','absent');
`
  },
  ecom: {
    name: "E-commerce analytics (Project 2)",
    blurb: "Customers, products, orders, order lines and payments for the revenue-analysis project.",
    sql: `
CREATE TABLE customers(id INTEGER PRIMARY KEY, name TEXT NOT NULL, country TEXT, signup_date TEXT);
INSERT INTO customers VALUES (1,'Ana','PT','2023-01-05'),(2,'Ben','UK','2023-02-14'),(3,'Chen','CN','2023-03-20'),(4,'Dara','NG','2023-05-01'),(5,'Eli','IL','2023-06-11'),(6,'Fay','VN','2023-07-30'),(7,'Gus','FR','2023-09-09'),(8,'Hana','JP','2023-10-21');
CREATE TABLE products(id INTEGER PRIMARY KEY, name TEXT, category TEXT, price REAL, cost REAL);
INSERT INTO products VALUES (1,'Laptop','Electronics',1000,700),(2,'Phone','Electronics',700,450),(3,'Headset','Electronics',150,60),(4,'Desk','Furniture',320,190),(5,'Chair','Furniture',180,95),(6,'Notebook','Stationery',5,2),(7,'Pen Set','Stationery',12,5);
CREATE TABLE orders(id INTEGER PRIMARY KEY, customer_id INTEGER REFERENCES customers(id), order_date TEXT, status TEXT);
INSERT INTO orders VALUES (1,1,'2023-11-03','delivered'),(2,1,'2023-12-11','delivered'),(3,2,'2023-11-15','delivered'),(4,3,'2023-12-02','cancelled'),(5,3,'2024-01-20','delivered'),(6,4,'2024-01-05','delivered'),(7,5,'2024-01-08','delivered'),(8,2,'2024-02-12','delivered'),(9,6,'2024-02-18','pending'),(10,1,'2024-02-25','delivered'),(11,5,'2024-03-09','delivered'),(12,3,'2024-03-22','delivered'),(13,1,'2024-03-28','delivered'),(14,7,'2024-03-30','delivered');
CREATE TABLE order_items(order_id INTEGER REFERENCES orders(id), product_id INTEGER REFERENCES products(id), qty INTEGER, unit_price REAL, PRIMARY KEY(order_id, product_id));
INSERT INTO order_items VALUES (1,1,1,1000),(1,3,1,150),(2,6,10,5),(2,7,2,12),(3,2,1,700),(4,4,1,320),(5,5,2,180),(6,3,2,150),(7,1,1,1000),(8,2,1,700),(9,6,5,5),(10,3,1,150),(10,2,1,700),(11,5,1,180),(12,7,3,12),(12,6,4,5),(13,1,1,1000),(14,4,1,320),(14,5,1,180);
CREATE TABLE payments(id INTEGER PRIMARY KEY, order_id INTEGER REFERENCES orders(id), method TEXT, amount REAL, paid_on TEXT);
INSERT INTO payments VALUES (1,1,'card',1150,'2023-11-03'),(2,2,'upi',74,'2023-12-11'),(3,3,'card',700,'2023-11-15'),(4,5,'card',360,'2024-01-20'),(5,6,'wallet',300,'2024-01-05'),(6,7,'card',1000,'2024-01-08'),(7,8,'upi',700,'2024-02-12'),(8,10,'card',850,'2024-02-25'),(9,11,'wallet',180,'2024-03-09'),(10,12,'upi',56,'2024-03-22'),(11,13,'card',1000,'2024-03-28');
`
  },
  flat: {
    name: "Flat orders (normalization)",
    blurb: "One wide table mixing customers, products and orders: the starting point for normalization exercises.",
    sql: `
CREATE TABLE orders_flat(order_id INTEGER, customer_name TEXT, customer_email TEXT, product TEXT, price REAL, qty INTEGER);
INSERT INTO orders_flat VALUES (1,'Ana','ana@x.com','Pen',2,10),(1,'Ana','ana@x.com','Book',12,1),(2,'Ben','ben@x.com','Pen',2,5),(3,'Ana','ana@y.com','Lamp',30,1),(4,'Cy','cy@x.com','Book',12,2);
`
  },
  lc: {
    name: "Interview set",
    blurb: "A dozen small tables used by the 50 interview-style problems (products, views, tweets, bonuses, visits, sales, courses, players, signups, queries, trips).",
    sql: `
CREATE TABLE catalog(product_id INTEGER PRIMARY KEY, low_fat TEXT, recyclable TEXT);
INSERT INTO catalog VALUES (0,'Y','N'),(1,'Y','Y'),(2,'N','Y'),(3,'Y','Y'),(4,'N','N');
CREATE TABLE ref_customers(id INTEGER PRIMARY KEY, name TEXT, referee_id INTEGER);
INSERT INTO ref_customers VALUES (1,'Will',NULL),(2,'Jane',NULL),(3,'Alex',2),(4,'Bill',NULL),(5,'Zack',1),(6,'Mark',2);
CREATE TABLE countries(name TEXT, continent TEXT, area INTEGER, population INTEGER, gdp INTEGER);
INSERT INTO countries VALUES ('Afghanistan','Asia',652230,25500100,20343000000),('Albania','Europe',28748,2831741,12960000000),('Algeria','Africa',2381741,37100000,188681000000),('Andorra','Europe',468,78115,3712000000),('Angola','Africa',1246700,20609294,100990000000);
CREATE TABLE article_views(article_id INTEGER, author_id INTEGER, viewer_id INTEGER, view_date TEXT);
INSERT INTO article_views VALUES (1,3,5,'2019-08-01'),(1,3,6,'2019-08-02'),(2,7,7,'2019-08-01'),(2,7,6,'2019-08-02'),(4,7,1,'2019-07-22'),(3,4,4,'2019-07-21'),(3,4,4,'2019-07-21');
CREATE TABLE tweets(tweet_id INTEGER PRIMARY KEY, content TEXT);
INSERT INTO tweets VALUES (1,'Vote for Biden'),(2,'Let us make America great again!');
CREATE TABLE emp_bonus(emp_id INTEGER PRIMARY KEY, name TEXT, supervisor INTEGER, salary INTEGER);
INSERT INTO emp_bonus VALUES (3,'Brad',NULL,4000),(1,'John',3,1000),(2,'Dan',3,2000),(4,'Thomas',3,4000);
CREATE TABLE bonus(emp_id INTEGER, bonus INTEGER);
INSERT INTO bonus VALUES (2,500),(4,2000);
CREATE TABLE emp_uni(id INTEGER, unique_id INTEGER);
INSERT INTO emp_uni VALUES (3,1),(11,2),(90,3);
CREATE TABLE emp_names(id INTEGER PRIMARY KEY, name TEXT);
INSERT INTO emp_names VALUES (1,'Alice'),(7,'Bob'),(11,'Meir'),(90,'Winston'),(3,'Jonathan');
CREATE TABLE visits(visit_id INTEGER PRIMARY KEY, customer_id INTEGER);
INSERT INTO visits VALUES (1,23),(2,9),(4,30),(5,54),(6,96),(7,54),(8,54);
CREATE TABLE visit_txns(transaction_id INTEGER PRIMARY KEY, visit_id INTEGER, amount INTEGER);
INSERT INTO visit_txns VALUES (2,5,310),(3,5,300),(9,5,200),(12,1,910),(13,2,970);
CREATE TABLE weather(id INTEGER PRIMARY KEY, record_date TEXT, temperature INTEGER);
INSERT INTO weather VALUES (1,'2015-01-01',10),(2,'2015-01-02',25),(3,'2015-01-03',20),(4,'2015-01-04',30);
CREATE TABLE machine_activity(machine_id INTEGER, process_id INTEGER, activity_type TEXT, ts REAL);
INSERT INTO machine_activity VALUES (0,0,'start',0.712),(0,0,'end',1.520),(0,1,'start',3.140),(0,1,'end',4.120),(1,0,'start',0.550),(1,0,'end',1.550),(1,1,'start',0.430),(1,1,'end',1.420),(2,0,'start',4.100),(2,0,'end',4.512),(2,1,'start',2.500),(2,1,'end',5.000);
CREATE TABLE lc_employees(id INTEGER PRIMARY KEY, name TEXT, manager_id INTEGER, salary INTEGER, dept_id INTEGER);
INSERT INTO lc_employees VALUES (1,'Joe',3,70000,1),(2,'Henry',4,80000,2),(3,'Sam',NULL,60000,2),(4,'Max',NULL,90000,1),(5,'Janet',1,69000,1),(6,'Randy',1,85000,1),(7,'Will',1,70000,1);
CREATE TABLE lc_depts(id INTEGER PRIMARY KEY, name TEXT);
INSERT INTO lc_depts VALUES (1,'IT'),(2,'Sales');
CREATE TABLE students2(student_id INTEGER PRIMARY KEY, student_name TEXT);
INSERT INTO students2 VALUES (1,'Alice'),(2,'Bob'),(13,'John'),(6,'Alex');
CREATE TABLE subjects2(subject_name TEXT PRIMARY KEY);
INSERT INTO subjects2 VALUES ('Math'),('Physics'),('Programming');
CREATE TABLE exams2(student_id INTEGER, subject_name TEXT);
INSERT INTO exams2 VALUES (1,'Math'),(1,'Physics'),(1,'Programming'),(2,'Programming'),(1,'Physics'),(1,'Math'),(13,'Math'),(13,'Programming'),(13,'Physics'),(2,'Math'),(1,'Math');
CREATE TABLE friend_requests(sender_id INTEGER, send_to_id INTEGER, request_date TEXT);
INSERT INTO friend_requests VALUES (1,2,'2016-06-01'),(1,3,'2016-06-01'),(1,4,'2016-06-01'),(2,3,'2016-06-02'),(3,4,'2016-06-09');
CREATE TABLE accepted_requests(requester_id INTEGER, accepter_id INTEGER, accept_date TEXT);
INSERT INTO accepted_requests VALUES (1,2,'2016-06-03'),(1,3,'2016-06-08'),(2,3,'2016-06-08'),(3,4,'2016-06-09'),(3,4,'2016-06-10');
CREATE TABLE sales_lc(sale_id INTEGER, product_id INTEGER, year INTEGER, quantity INTEGER, price INTEGER);
INSERT INTO sales_lc VALUES (1,100,2008,10,5000),(2,100,2009,12,5000),(7,200,2011,15,9000);
CREATE TABLE product_lc(product_id INTEGER PRIMARY KEY, product_name TEXT);
INSERT INTO product_lc VALUES (100,'Nokia'),(200,'Apple'),(300,'Samsung');
CREATE TABLE courses_lc(student TEXT, class TEXT);
INSERT INTO courses_lc VALUES ('A','Math'),('B','English'),('C','Math'),('D','Biology'),('E','Math'),('F','Computer'),('G','Math'),('H','Math'),('I','Math');
CREATE TABLE follows(user_id INTEGER, follower_id INTEGER);
INSERT INTO follows VALUES (0,1),(1,0),(2,0),(2,1);
CREATE TABLE players_act(player_id INTEGER, device_id INTEGER, event_date TEXT, games_played INTEGER);
INSERT INTO players_act VALUES (1,2,'2016-03-01',5),(1,2,'2016-03-02',6),(2,3,'2017-06-25',1),(3,1,'2016-03-02',0),(3,4,'2018-07-03',5);
CREATE TABLE sign_ups(user_id INTEGER PRIMARY KEY, time_stamp TEXT);
INSERT INTO sign_ups VALUES (3,'2020-03-21 10:16:13'),(7,'2020-01-04 13:57:59'),(2,'2020-07-29 23:09:44'),(6,'2020-12-09 10:39:37');
CREATE TABLE confirmations(user_id INTEGER, time_stamp TEXT, action TEXT);
INSERT INTO confirmations VALUES (3,'2021-01-06 03:30:46','timeout'),(3,'2021-07-14 14:00:00','timeout'),(7,'2021-06-12 11:57:29','confirmed'),(7,'2021-06-13 12:58:28','confirmed'),(7,'2021-06-14 13:59:27','confirmed'),(2,'2021-01-22 00:00:00','confirmed'),(2,'2021-02-28 23:59:59','timeout');
CREATE TABLE cinema(id INTEGER PRIMARY KEY, movie TEXT, description TEXT, rating REAL);
INSERT INTO cinema VALUES (1,'War','great 3D',8.9),(2,'Science','fiction',8.5),(3,'irish','boring',6.2),(4,'Ice song','Fantacy',8.6),(5,'House card','Interesting',9.1);
CREATE TABLE unit_prices(product_id INTEGER, start_date TEXT, end_date TEXT, price INTEGER);
INSERT INTO unit_prices VALUES (1,'2019-02-17','2019-02-28',5),(1,'2019-03-01','2019-03-22',20),(2,'2019-02-01','2019-02-20',15),(2,'2019-02-21','2019-03-31',30);
CREATE TABLE units_sold(product_id INTEGER, purchase_date TEXT, units INTEGER);
INSERT INTO units_sold VALUES (1,'2019-02-25',100),(1,'2019-03-01',15),(2,'2019-02-10',200),(2,'2019-03-22',30);
CREATE TABLE movie_rating(user_id INTEGER, movie TEXT, rating INTEGER, created TEXT);
INSERT INTO movie_rating VALUES (1,'Avengers',3,'2020-01-12'),(1,'Frozen 2',4,'2020-02-11'),(1,'Joker',2,'2020-02-12'),(2,'Avengers',4,'2020-02-17'),(2,'Frozen 2',2,'2020-02-01'),(3,'Joker',3,'2020-02-22'),(3,'Avengers',5,'2020-02-25');
CREATE TABLE trips(id INTEGER PRIMARY KEY, client_id INTEGER, driver_id INTEGER, city TEXT, status TEXT, request_at TEXT);
INSERT INTO trips VALUES (1,1,10,'A','completed','2013-10-01'),(2,2,11,'A','cancelled_by_driver','2013-10-01'),(3,3,12,'A','completed','2013-10-01'),(4,4,13,'A','cancelled_by_client','2013-10-01'),(5,1,10,'A','completed','2013-10-02'),(6,2,11,'A','completed','2013-10-02'),(7,3,12,'A','completed','2013-10-02'),(8,2,12,'A','completed','2013-10-03'),(9,3,10,'A','completed','2013-10-03'),(10,4,13,'A','cancelled_by_driver','2013-10-03');
CREATE TABLE trip_users(users_id INTEGER PRIMARY KEY, banned TEXT, role TEXT);
INSERT INTO trip_users VALUES (1,'No','client'),(2,'Yes','client'),(3,'No','client'),(4,'No','client'),(10,'No','driver'),(11,'No','driver'),(12,'No','driver'),(13,'No','driver');
CREATE TABLE queries_lc(id INTEGER, query_name TEXT, result TEXT, position INTEGER, rating INTEGER);
INSERT INTO queries_lc VALUES (1,'Dog','Golden Retriever',1,5),(1,'Dog','German Shepherd',2,5),(1,'Dog','Mule',200,1),(2,'Cat','Shirazi',5,2),(2,'Cat','Siamese',3,3),(2,'Cat','Sphynx',7,4);
CREATE TABLE monthly_tx(id INTEGER PRIMARY KEY, country TEXT, state TEXT, amount INTEGER, trans_date TEXT);
INSERT INTO monthly_tx VALUES (121,'US','approved',1000,'2018-12-18'),(122,'US','declined',2000,'2018-12-19'),(123,'US','approved',2000,'2019-01-01'),(124,'DE','approved',2000,'2019-01-07');
CREATE TABLE ads_activity(spend_id INTEGER, activity_date TEXT);
INSERT INTO ads_activity VALUES (1,'2020-01-01'),(2,'2020-01-02');
CREATE TABLE teachers(teacher_id INTEGER, subject_id INTEGER, dept_id INTEGER);
INSERT INTO teachers VALUES (1,2,3),(1,2,4),(1,3,3),(2,1,1),(2,2,1),(2,3,1),(2,4,1);
CREATE TABLE salesperson(sales_id INTEGER PRIMARY KEY, name TEXT);
INSERT INTO salesperson VALUES (1,'John'),(2,'Amy'),(3,'Mark'),(4,'Pam'),(5,'Alex');
CREATE TABLE company_lc(com_id INTEGER PRIMARY KEY, name TEXT);
INSERT INTO company_lc VALUES (1,'RED'),(2,'ORANGE'),(3,'YELLOW'),(4,'GREEN');
CREATE TABLE sales_orders(order_id INTEGER, order_date TEXT, com_id INTEGER, sales_id INTEGER, amount INTEGER);
INSERT INTO sales_orders VALUES (1,'2014-01-01',3,4,10000),(2,'2014-02-01',4,5,5000),(3,'2014-03-01',1,1,50000),(4,'2014-04-01',1,4,25000);
CREATE TABLE tri(x INTEGER, y INTEGER, z INTEGER);
INSERT INTO tri VALUES (13,15,30),(10,20,15);
CREATE TABLE points(x INTEGER PRIMARY KEY);
INSERT INTO points VALUES (-4),(0),(2);
CREATE TABLE orders_lc(order_id INTEGER, customer_id INTEGER, order_date TEXT, price REAL);
INSERT INTO orders_lc VALUES (1,1,'2021-01-01',30),(2,1,'2021-02-01',45),(3,2,'2021-02-02',20),(4,3,'2021-03-03',60),(5,3,'2021-03-05',10),(6,3,'2021-04-01',70);
`
  }
});

window.SQL_MODULES.push(
  { id: "ddl", name: "9. DDL: define tables" },
  { id: "cons", name: "10. Constraints and integrity" },
  { id: "dml2", name: "11. DML in depth" },
  { id: "ops", name: "12. Operators and filtering" },
  { id: "aggx", name: "13. Aggregates, GROUP BY, HAVING" },
  { id: "joinx", name: "14. Joins in depth" },
  { id: "subx", name: "15. Subqueries" },
  { id: "setop", name: "16. Set operators" },
  { id: "casex", name: "17. CASE and NULL handling" },
  { id: "winx", name: "18. Window functions in depth" },
  { id: "cte", name: "19. CTEs and recursion" },
  { id: "datex", name: "20. Dates and times" },
  { id: "strx", name: "21. Strings" },
  { id: "rep", name: "22. Reporting and pivots" },
  { id: "view", name: "23. Views" },
  { id: "trig", name: "24. Triggers" },
  { id: "tx", name: "25. Transactions" },
  { id: "idx", name: "26. Indexes and EXPLAIN" },
  { id: "design", name: "27. Normalization and design" },
  { id: "int1", name: "28. Interview classics" },
  { id: "int2", name: "29. Advanced interview problems" },
  { id: "sql50", name: "30. Interview set (50)" },
  { id: "pj1", name: "31. Project 1: Employees" },
  { id: "pj2", name: "32. Project 2: E-commerce" },
  { id: "pj3", name: "33. Project 3: Banking" },
  { id: "theory", name: "34. Theory quiz" }
);

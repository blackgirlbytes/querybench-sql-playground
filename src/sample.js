export const starterSql = `PRAGMA foreign_keys = ON;

CREATE TABLE customers (
  id INTEGER PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  city TEXT NOT NULL,
  signup_date TEXT NOT NULL
);

CREATE TABLE products (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price REAL NOT NULL
);

CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  order_date TEXT NOT NULL,
  status TEXT NOT NULL,
  total_amount REAL NOT NULL
);

CREATE TABLE order_items (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL,
  unit_price REAL NOT NULL
);

INSERT INTO customers VALUES
  (1, 'Maya', 'Chen', 'maya.chen@example.com', 'New York', '2024-01-12'),
  (2, 'Noah', 'Williams', 'noah.williams@example.com', 'Chicago', '2024-02-03'),
  (3, 'Ava', 'Patel', 'ava.patel@example.com', 'Austin', '2024-02-21'),
  (4, 'Leo', 'Garcia', 'leo.garcia@example.com', 'Seattle', '2024-03-18'),
  (5, 'Zoe', 'Martin', 'zoe.martin@example.com', 'Boston', '2024-04-08'),
  (6, 'Eli', 'Johnson', 'eli.johnson@example.com', 'New York', '2024-05-14');

INSERT INTO products VALUES
  (1, 'Canvas tote', 'Accessories', 24.00),
  (2, 'Desk lamp', 'Home', 78.00),
  (3, 'Notebook set', 'Stationery', 18.50),
  (4, 'Travel mug', 'Home', 32.00),
  (5, 'Wireless mouse', 'Electronics', 45.00);

INSERT INTO orders VALUES
  (1, 1, '2024-06-02', 'delivered', 96.50),
  (2, 2, '2024-06-05', 'delivered', 78.00),
  (3, 1, '2024-06-17', 'delivered', 32.00),
  (4, 3, '2024-07-01', 'shipped', 45.00),
  (5, 4, '2024-07-09', 'delivered', 48.00),
  (6, 2, '2024-07-21', 'pending', 18.50),
  (7, 5, '2024-08-04', 'shipped', 78.00),
  (8, 1, '2024-08-12', 'pending', 45.00);

INSERT INTO order_items VALUES
  (1, 1, 1, 1, 24.00), (2, 1, 3, 2, 18.50),
  (3, 2, 2, 1, 78.00), (4, 3, 4, 1, 32.00),
  (5, 4, 5, 1, 45.00), (6, 5, 1, 2, 24.00),
  (7, 6, 3, 1, 18.50), (8, 7, 2, 1, 78.00),
  (9, 8, 5, 1, 45.00);`

export const examples = [
  {
    title: 'First look',
    subtitle: 'Explore a table',
    sql: 'SELECT *\nFROM customers\nLIMIT 10;',
  },
  {
    title: 'Join tables',
    subtitle: 'Orders with customer names',
    sql: `SELECT c.first_name || ' ' || c.last_name AS customer,
       o.order_date, o.status, o.total_amount
FROM orders o
JOIN customers c ON c.id = o.customer_id
ORDER BY o.order_date DESC;`,
  },
  {
    title: 'Group & aggregate',
    subtitle: 'Revenue by city',
    sql: `SELECT c.city, COUNT(o.id) AS orders,
       ROUND(SUM(o.total_amount), 2) AS revenue
FROM customers c
JOIN orders o ON o.customer_id = c.id
GROUP BY c.city
ORDER BY revenue DESC;`,
  },
  {
    title: 'Find missing data',
    subtitle: 'Customers with no orders',
    sql: `SELECT c.first_name, c.last_name, c.email
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
WHERE o.id IS NULL;`,
  },
]

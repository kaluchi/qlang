const fs = require('fs');
const w = (f, d) => fs.writeFileSync(f, typeof d === 'string' ? d : JSON.stringify(d, null, 2));
const r2 = x => Math.round(x * 100) / 100;

// ---------- inputs ----------
const users = [
  { id: 1, name: "Alice", email: "alice@x.com", age: 31, active: true, address: { city: "Berlin", country: "DE" } },
  { id: 2, name: "Bob", email: "bob@x.com", age: 25, active: false, address: { city: "Paris", country: "FR" } },
  { id: 3, name: "Carol", email: "carol@x.com", age: 42, active: true, address: null },
  { id: 4, name: "Dan", email: "dan@x.com", age: 37, active: true, address: { city: "Munich", country: "DE" } },
  { id: 5, name: "Eve", email: "eve@x.com", age: 29, active: true, address: { city: "Lyon", country: "FR" } },
  { id: 6, name: "Frank", email: "frank@x.com", age: 52, active: true, address: { city: "Rome" } },
  { id: 7, name: "Grace", email: "grace@x.com", age: 23, active: true, address: { city: "Hamburg", country: "DE" } },
  { id: 8, name: "Heidi", email: "heidi@x.com", age: 45, active: false, address: { city: "Nice", country: "FR" } },
  { id: 9, name: "Ivan", email: "ivan@x.com", age: 33, active: true, address: { city: "Madrid", country: "ES" } },
  { id: 10, name: "Judy", email: "judy@x.com", age: 28, active: true }
];
w('users.json', users);

const orders = [
  { id: "o1", customer: "alice", status: "paid", items: [{ sku: "A", qty: 2, price: 9.99 }, { sku: "B", qty: 1, price: 5.5 }] },
  { id: "o2", customer: "bob", status: "Shipped", items: [{ sku: "C", qty: 3, price: 4.25 }] },
  { id: "o3", customer: "carol", status: "cancelled", items: [{ sku: "A", qty: 5, price: 9.99 }] },
  { id: "o4", customer: "dan", status: "PAID", items: [] },
  { id: "o5", customer: "eve", status: "pending", items: [{ sku: "D", qty: 1, price: 100 }] },
  { id: "o6", customer: "alice", status: "paid", items: [{ sku: "B", qty: 4, price: 5.5 }, { sku: "E", qty: 1, price: 0.99 }] },
  { id: "o7", customer: "frank", status: "shipped" }
];
w('orders.json', orders);

const packages = [
  { name: "web-ui", version: "1.2.0", license: "MIT", dependencies: { react: "^18.2.0", lodash: "4.17.21", axios: "^1.6.0" } },
  { name: "core", version: "0.9.1", dependencies: { lodash: "4.17.21" } },
  { name: "cli", version: "2.0.0", license: "Apache-2.0", dependencies: { commander: "^11.0.0", chalk: "^5.3.0", ora: "7.0.1", lodash: "4.17.21" } },
  { name: "docs", version: "1.0.0", license: "MIT" },
  { name: "server", version: "3.1.4", license: null, dependencies: { express: "^4.18.2", cors: "2.8.5", pino: "^8.0.0" } },
  { name: "utils", version: "0.1.0", dependencies: {} }
];
w('packages.json', packages);

const issues = [
  { number: 101, title: "Crash on start", state: "open", assignee: { login: "amy" }, comments: 12, labels: ["bug"] },
  { number: 102, title: "Add dark mode", state: "open", assignee: null, comments: 5, labels: ["feature"] },
  { number: 103, title: "Typo in README", state: "closed", assignee: { login: "bo" }, comments: 1, labels: [] },
  { number: 104, title: "Slow query", state: "open", assignee: { login: "amy" }, comments: 12, labels: ["bug", "perf"] },
  { number: 105, title: "Upgrade deps", state: "open", assignee: { login: "cy" }, comments: 3, labels: ["chore"] },
  { number: 106, title: "Memory leak", state: "closed", assignee: { login: "amy" }, comments: 20, labels: ["bug"] },
  { number: 107, title: "Support SSO", state: "open", comments: 8, labels: ["feature"] },
  { number: 108, title: "Broken link", state: "open", assignee: { login: "bo" }, comments: 0, labels: ["docs"] },
  { number: 109, title: "Flaky test", state: "open", assignee: { login: "bo" }, comments: 8, labels: ["bug"] }
];
w('issues.json', issues);

const response = {
  status: "ok",
  data: {
    items: [
      { id: 1, name: "Pen", category: "office", price: 1.5, stock: 100 },
      { id: 2, name: "Desk", category: "furniture", price: 250, stock: 5 },
      { id: 3, name: "Chair", category: "furniture", price: 120.5, stock: 0 },
      { id: 4, name: "Paper", category: "office", price: 4.25, stock: 40 },
      { id: 5, name: "Lamp", category: "furniture", price: null, stock: 12 },
      { id: 6, name: "Stapler", category: "office", price: 7, stock: 8 },
      { id: 7, name: "Mug", category: "kitchen", price: 6.1, stock: 30 },
      { id: 8, name: "Kettle", category: "kitchen", price: 24.9, stock: 3 }
    ]
  },
  meta: { page: 1, total: 8 }
};
w('response.json', response);

const events = [
  { type: "login", user: "u1", ts: "2026-02-01T08:00:00Z" },
  { type: "purchase", user: "u2", ts: "2026-02-01T09:00:00Z", payload: { amount: 30.5 } },
  { type: "purchase", user: "u1", ts: "2026-02-01T09:30:00Z", payload: { amount: 12 } },
  { type: "purchase", user: "u3", ts: "2026-02-02T10:00:00Z", payload: { amount: null } },
  { type: "Purchase", user: "u2", ts: "2026-02-02T11:00:00Z", payload: { amount: 19.5 } },
  { type: "purchase", user: "u1", ts: "2026-02-03T12:00:00Z" },
  { type: "refund", user: "u2", ts: "2026-02-03T13:00:00Z", payload: { amount: 10 } },
  { type: "purchase", user: "u4", ts: "2026-02-04T14:00:00Z", payload: { amount: 50 } },
  { type: "purchase", user: "u1", ts: "2026-02-04T15:00:00Z", payload: { amount: 38 } },
  { type: "logout", user: "u4", ts: "2026-02-04T16:00:00Z" }
];
w('events.json', events);

const inventory = [
  { sku: "S-1", stock: { main: 5, backup: 2 } },
  { sku: "S-2", stock: { main: 20, backup: null } },
  { sku: "S-3", stock: { main: 0, backup: 0 } },
  { sku: "S-4", stock: { main: null, backup: 9 } },
  { sku: "S-5", stock: { main: 3 } },
  { sku: "S-6", stock: { main: 7, backup: 4 } },
  { sku: "S-7" }
];
w('inventory.json', inventory);

const log = `2026-03-01T10:00:00Z ERROR payments user=Bob msg="card declined"
2026-03-01T10:00:05Z INFO auth user=alice msg="login ok"
2026-03-01T10:01:00Z error auth user=bob msg="bad password"
2026-03-01T10:02:00Z WARN payments msg="slow gateway"
2026-03-01T10:03:00Z ERROR search msg="index missing"
2026-03-01T10:04:00Z ERROR payments user=carol msg="timeout"
2026-03-01T10:05:00Z INFO search user=dave msg="query ok"
2026-03-01T10:06:00Z Error auth user=ALICE msg="locked"
2026-03-01T10:07:00Z DEBUG auth user=erin msg="token refresh"
2026-03-01T10:08:00Z INFO payments user=carol msg="refund ok"
`;
w('app.log', log);

const csv = `name,dept,salary,start
Anna,eng,5000,2021-03-15
Boris,eng,6000,2023-01-10
Cleo,ops,4000,2022-07-01
Dmitri,ops,,2023-05-20
Elena,sales,3500,2020-11-30
Farid,eng,5500,2024-02-01
Gina,sales,4500,2023-09-09
Hugo,ops,4200,2019-06-17
`;
w('employees.csv', csv);

const env = `# database
DB_HOST=localhost
DB_PORT=5432
DB_USER=admin

# app
APP_NAME=demo
db_password=s3cret
DB_NAME=main # not a comment, part of value?
DEBUG=true
DB_SSL=
`;
w('config.env', env);

// ---------- expected ----------
const T = [];
const add = (input, text, expected) => T.push({ id: 'P' + (T.length + 1), input, text, expected });

// P1
{
  const o = {};
  for (const u of users) if (u.active === true && u.address && u.address.country) o[u.address.country] = (o[u.address.country] || 0) + 1;
  add('users.json', 'Count the active users (active is true) per country (address.country). Skip users whose address is null/missing or has no country. Return an object mapping country code to the count.', o);
}
// P2
{
  let s = 0;
  for (const o of orders) if (['paid', 'shipped'].includes(o.status.toLowerCase())) for (const i of (o.items || [])) s += i.qty * i.price;
  add('orders.json', 'Compute total revenue: the sum of qty*price over all items of orders whose status is "paid" or "shipped" (compare case-insensitively). Orders with missing or empty items contribute 0. Return a number rounded to 2 decimals.', r2(s));
}
// P3
add('packages.json', 'Return the names of packages that have more than 2 entries in their "dependencies" object (a missing dependencies field counts as 0), as an array of strings sorted alphabetically ascending.',
  packages.filter(p => Object.keys(p.dependencies || {}).length > 2).map(p => p.name).sort());
// P4
{
  const o = {};
  for (const i of issues) if (i.state === 'open') { const k = i.assignee ? i.assignee.login : 'unassigned'; o[k] = (o[k] || 0) + 1; }
  add('issues.json', 'Count open issues (state "open") per assignee login. Issues with a null or missing assignee are counted under the key "unassigned". Return an object mapping login to count.', o);
}
// P5
add('issues.json', 'Return the "number" values of the 3 issues (of any state) with the most comments, as an array of numbers ordered by comments descending; break ties by number ascending.',
  [...issues].sort((a, b) => b.comments - a.comments || a.number - b.number).slice(0, 3).map(i => i.number));
// P6
{
  const g = {};
  for (const p of response.data.items) if (p.price != null) (g[p.category] ||= []).push(p.price);
  const o = {};
  for (const k in g) o[k] = r2(g[k].reduce((a, b) => a + b, 0) / g[k].length);
  add('response.json', 'From data.items compute the average price per category, ignoring items whose price is null. Round each average to 2 decimals. Return an object mapping category to average price.', o);
}
// P7
{
  const s = new Set();
  for (const l of log.split('\n')) {
    const m = l.match(/^(\S+) (\S+) (\S+)(?: user=(\S+))? /);
    if (m && m[2].toLowerCase() === 'error' && m[4]) s.add(m[4].toLowerCase());
  }
  add('app.log', 'Each line is: timestamp LEVEL service [user=NAME] msg="...". Return the distinct user names (lowercased) appearing on lines whose LEVEL is ERROR (case-insensitive), as an array of strings sorted alphabetically. Lines without a user= field are ignored.', [...s].sort());
}
// rows for csv
const rows = csv.trim().split('\n').slice(1).map(l => { const [name, dept, salary, start] = l.split(','); return { name, dept, salary: salary === '' ? null : Number(salary), start }; });
// P8
{
  const g = {};
  for (const r of rows) if (r.salary != null) (g[r.dept] ||= []).push(r.salary);
  const o = {};
  for (const k in g) o[k] = Math.round(g[k].reduce((a, b) => a + b, 0) / g[k].length * 10) / 10;
  add('employees.csv', 'The file is CSV with a header row (name,dept,salary,start). Compute the average salary per dept, ignoring rows with an empty salary. Round each average to 1 decimal. Return an object mapping dept to average salary.', o);
}
// P9
add('employees.csv', 'Among employees with a non-empty salary whose start date year is 2022 or later, return the names of the 2 highest paid as an array of strings, highest salary first.',
  rows.filter(r => r.salary != null && Number(r.start.split('-')[0]) >= 2022).sort((a, b) => b.salary - a.salary).slice(0, 2).map(r => r.name));
// P10
{
  const o = {};
  for (const l of env.split('\n')) {
    if (!l.trim() || l.startsWith('#')) continue;
    const i = l.indexOf('=');
    const k = l.slice(0, i), v = l.slice(i + 1);
    if (k.startsWith('DB_')) o[k.slice(3).toLowerCase()] = v;
  }
  add('config.env', 'Each non-blank line not starting with "#" is KEY=VALUE (split at the first "="; the value is the rest of the line verbatim, possibly empty). Keep only entries whose KEY starts with the exact, case-sensitive prefix "DB_". Return an object whose keys are the KEY with the prefix removed and lowercased, and whose values are the value strings (no type conversion).', o);
}
// P11
{
  const o = {};
  for (const e of events) if (e.type.toLowerCase() === 'purchase' && e.payload && e.payload.amount != null) o[e.user] = (o[e.user] || 0) + e.payload.amount;
  const a = Object.entries(o).map(([user, t]) => ({ user, total: r2(t) })).sort((a, b) => b.total - a.total || a.user.localeCompare(b.user));
  add('events.json', 'Consider events whose type is "purchase" (case-insensitive) and that have a non-null payload.amount; others are ignored. Sum the amounts per user. Return an array of objects {"user": string, "total": number} (total rounded to 2 decimals), sorted by total descending, ties by user ascending.', a);
}
// P12
{
  const words = ["Apple", "banana", "apple", "Cherry", "BANANA", "date", "cherry", "Elder", "fig", "FIG", "apple"];
  const c = {};
  for (const x of words) c[x.toLowerCase()] = (c[x.toLowerCase()] || 0) + 1;
  const e = Object.entries(c).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k, n]) => `${k}:${n}`).join(',');
  add(null, `Given the list of words ${JSON.stringify(words)}: count occurrences case-insensitively (lowercase the words), keep only words occurring at least 2 times, order them by count descending then word ascending, and return a single string of "word:count" items joined by commas with no spaces.`, e);
}
// P13
{
  const vs = "1.10.2, 1.2.10, 1.9.0, 0.99.99, 1.10.10, 1.10.9";
  const best = vs.split(', ').sort((a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return y[i] - x[i]; return 0; })[0];
  add(null, `Given the comma+space separated version string "${vs}": split it, compare versions numerically per dotted component (major, minor, patch), and return the highest version as a string.`, best);
}
// P14
add('inventory.json', 'For each item, total = (stock.main or 0) + (stock.backup or 0), treating null or missing values (including a missing stock object) as 0. Return the skus of items with total strictly less than 10 as an array of strings sorted alphabetically descending.',
  inventory.filter(i => ((i.stock && i.stock.main) || 0) + ((i.stock && i.stock.backup) || 0) < 10).map(i => i.sku).sort().reverse());

w('tasks.json', T);
console.log(JSON.stringify(T.map(t => [t.id, t.expected])));

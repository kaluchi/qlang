const fs = require('fs');
const w = (f, d) => fs.writeFileSync(f, typeof d === 'string' ? d : JSON.stringify(d, null, 2));
const r2 = x => Math.round(x * 100) / 100;
const asc = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// ---------- inputs ----------
const users = [
  { id: 1, name: "Anna", email: "anna@example.com", age: 31, active: true, address: { city: "Berlin", country: "DE" }, tags: ["admin", "dev"] },
  { id: 2, name: "Boris", email: "boris@example.com", age: 45, active: true, address: { city: "berlin", country: "DE" }, tags: ["dev"] },
  { id: 3, name: "Chen", email: "chen@example.com", age: null, active: true, address: { city: "Beijing", country: "CN" }, tags: [] },
  { id: 4, name: "Dmitri", email: "dmitri@example.com", active: false, address: { city: "BERLIN", country: "DE" }, tags: ["ops"] },
  { id: 5, name: "Elena", email: "elena@example.com", age: 28, active: true, address: null, tags: ["dev", "ops"] },
  { id: 6, name: "Farid", email: "farid@example.com", age: 39, active: true, address: { city: "Baku", country: "AZ" }, tags: ["Admin"] },
  { id: 7, name: "Greta", email: "greta@example.org", age: 22, active: true, address: { country: "DE" }, tags: ["dev"] },
  { id: 8, name: "Hugo", email: "hugo@example.com", age: 50, active: true, address: { city: "Berlin", country: "DE" }, tags: ["ops", "dev"] },
];
w('users.json', users);

const orders = [
  { id: "o1", customer: "acme", status: "paid", items: [{ sku: "A1", qty: 2, price: 9.99 }, { sku: "B2", qty: 1, price: 24.5 }] },
  { id: "o2", customer: "globex", status: "paid", items: [{ sku: "A1", qty: 5, price: 9.99 }] },
  { id: "o3", customer: "acme", status: "cancelled", items: [{ sku: "C3", qty: 10, price: 3 }] },
  { id: "o4", customer: "initech", status: "pending", items: [{ sku: "B2", qty: 1, price: 24.5 }] },
  { id: "o5", customer: "acme", status: "paid", items: [{ sku: "C3", qty: 3, price: 3 }, { sku: "D4", qty: 1, price: 100 }] },
  { id: "o6", customer: "globex", status: "paid", items: [] },
  { id: "o7", customer: "umbrella", status: "paid", items: [{ sku: "D4", qty: 2, price: 99.95 }] },
];
w('orders.json', orders);

const issues = [
  { number: 101, title: "Crash on start", state: "open", comments: 12, assignee: { login: "kim" }, labels: ["bug", "p1"] },
  { number: 102, title: "Add dark mode", state: "open", comments: 5, assignee: null, labels: ["feature"] },
  { number: 103, title: "Typo in README", state: "closed", comments: 1, assignee: { login: "lee" }, labels: ["docs"] },
  { number: 104, title: "Slow query", state: "open", comments: 12, assignee: { login: "lee" }, labels: ["bug", "perf"] },
  { number: 105, title: "Upgrade deps", state: "open", comments: 0, assignee: { login: "kim" }, labels: [] },
  { number: 106, title: "Memory leak", state: "closed", comments: 20, assignee: { login: "kim" }, labels: ["bug"] },
  { number: 107, title: "Support SSO", state: "open", comments: 8, labels: ["feature", "p1"] },
  { number: 108, title: "Flaky test", state: "open", comments: 3, assignee: { login: "lee" }, labels: ["bug", "Test"] },
  { number: 109, title: "Docs for API", state: "open", comments: 8, assignee: null, labels: ["docs"] },
];
w('issues.json', issues);

const manifest = {
  name: "demo-app", version: "1.4.2", private: true,
  scripts: { build: "tsc -p .", test: "jest", lint: "eslint ." },
  dependencies: { express: "^4.18.2", lodash: "~4.17.21", axios: "^1.6.0", chalk: "5.3.0" },
  devDependencies: { jest: "^29.7.0", eslint: "^8.56.0", typescript: "~5.3.3", axios: "^1.5.0" },
};
w('manifest.json', manifest);

const config = {
  env: "staging",
  services: {
    api: { enabled: true, protocol: "https", host: "api.example.com", port: 8443 },
    web: { enabled: true, protocol: "http", host: "www.example.com" },
    cache: { enabled: false, protocol: "redis", host: "cache.local", port: 6379 },
    auth: { enabled: true, protocol: "https", host: "auth.example.com", port: 443 },
    legacy: { protocol: "http", host: "old.example.com", port: 8080 },
  },
};
w('config.json', config);

const events = [
  { user: "u1", type: "login", ts: "2026-05-01T08:00:00Z" },
  { user: "u1", type: "purchase", ts: "2026-05-01T08:10:00Z", meta: { amount: 20.5 } },
  { user: "u2", type: "purchase", ts: "2026-05-01T09:00:00Z", meta: { amount: 15 } },
  { user: "u3", type: "purchase", ts: "2026-05-02T09:00:00Z", meta: {} },
  { user: "u2", type: "purchase", ts: "2026-05-02T10:00:00Z", meta: { amount: 4.25 } },
  { user: "u1", type: "Refund", ts: "2026-05-03T11:00:00Z", meta: { amount: 20.5 } },
  { user: "u4", type: "purchase", ts: "2026-05-03T12:00:00Z", meta: { amount: null } },
  { user: "u1", type: "purchase", ts: "2026-05-04T12:00:00Z", meta: { amount: 10 } },
];
w('events.json', events);

const accessLog = `2026-03-01T10:00:00Z GET /api/users 200 120ms
2026-03-01T10:00:05Z POST /api/users 201 300ms
2026-03-01T10:00:09Z GET /api/orders 500 450ms
2026-03-01T10:01:00Z GET /api/users 200 80ms
2026-03-01T10:02:00Z GET /health 200 5ms
2026-03-01T10:02:30Z DELETE /api/orders 503 900ms
2026-03-01T10:03:00Z GET /api/orders 404 40ms
2026-03-01T10:03:30Z GET /api/orders 502 600ms
2026-03-01T10:04:00Z POST /api/login 401 70ms
2026-03-01T10:05:00Z GET /api/users 200 101ms
`;
w('access.log', accessLog);

const csv = `name,dept,salary,skills
Alice,eng,120000,Go;Rust;SQL
Bob,eng,100000,go;Python
Carol,sales,70000,
Dave,sales,,Excel;sql
Eve,eng,110000,Rust
Frank,hr,65000,Excel
Grace,sales,80000,Negotiation;Python
Heidi,hr,,
`;
w('employees.csv', csv);

const env = `# database
DB_HOST=localhost
DB_PORT=5432
DB_NAME = appdb

# app
APP_MODE=production
db_ignored=1
DB_PASSWORD=p=ss=word
LOG_LEVEL=info
`;
w('settings.env', env);

// ---------- tasks ----------
const T = [];
const add = (input, text, expected) => T.push({ id: 'R' + (T.length + 1), input, text, expected });

add('users.json', 'Return an array of the names of users whose "active" is true and whose address exists (is not null) and has a city that equals "berlin" ignoring case. Users without a city do not match. Sort the names ascending (plain string comparison).',
  users.filter(u => u.active && u.address && u.address.city && u.address.city.toLowerCase() === 'berlin').map(u => u.name).sort(asc));

{ const a = users.filter(u => typeof u.age === 'number').map(u => u.age);
  add('users.json', 'Return the average "age" over users that have a numeric age (skip users whose age is null or missing), as a number rounded to 2 decimal places.', r2(a.reduce((x, y) => x + y, 0) / a.length)); }

{ const o = {}; orders.filter(x => x.status === 'paid').forEach(x => { o[x.customer] = (o[x.customer] || 0) + x.items.reduce((s, i) => s + i.qty * i.price, 0); });
  Object.keys(o).forEach(k => o[k] = r2(o[k]));
  add('orders.json', 'Consider only orders with status "paid". For each customer having at least one such order, compute the total of qty*price over all items of those orders (an order with no items contributes 0). Return an object mapping customer to total, each total rounded to 2 decimal places.', o); }

{ const o = {}; issues.filter(i => i.state === 'open').forEach(i => { const k = i.assignee ? i.assignee.login : 'unassigned'; o[k] = (o[k] || 0) + 1; });
  add('issues.json', 'Count issues with state "open" by assignee login. An issue whose assignee is null or missing is counted under the key "unassigned". Return an object mapping key to count.', o); }

add('issues.json', 'Among issues with state "open", return the "number" values of the top 3 by "comments" descending; ties are broken by "number" ascending. Return an array of 3 numbers.',
  issues.filter(i => i.state === 'open').sort((a, b) => b.comments - a.comments || a.number - b.number).slice(0, 3).map(i => i.number));

{ const names = new Set(); [manifest.dependencies, manifest.devDependencies].forEach(d => Object.entries(d).forEach(([k, v]) => { if (v.startsWith('^')) names.add(k); }));
  add('manifest.json', 'Look at both "dependencies" and "devDependencies". Return the distinct package names whose version string starts with "^" (in either section), as an array sorted ascending.', [...names].sort(asc)); }

{ const rows = accessLog.trim().split('\n').map(l => l.split(' ')); const s = new Set(rows.filter(p => +p[3] >= 500).map(p => p[2]));
  add('access.log', 'Each line of the log is "<timestamp> <METHOD> <path> <status> <duration>ms". Return the distinct paths that had at least one response with status 500 or higher, as an array sorted ascending.', [...s].sort(asc)); }

{ const d = accessLog.trim().split('\n').map(l => l.split(' ')).filter(p => p[1] === 'GET').map(p => parseInt(p[4]));
  add('access.log', 'Each line of the log is "<timestamp> <METHOD> <path> <status> <duration>ms". Consider only GET requests and compute the average duration in milliseconds (strip the "ms" suffix), rounded to the nearest integer. Return a number.', Math.round(d.reduce((a, b) => a + b, 0) / d.length)); }

{ const rows = csv.trim().split('\n').slice(1).map(l => l.split(',')); const g = {};
  rows.filter(r => r[2] !== '').forEach(r => { (g[r[1]] = g[r[1]] || []).push(+r[2]); });
  const o = {}; Object.keys(g).forEach(k => { o[k] = Math.round(g[k].reduce((a, b) => a + b, 0) / g[k].length * 10) / 10; });
  add('employees.csv', 'The file is CSV with a header line (name,dept,salary,skills). Ignore rows with an empty salary. Return an object mapping each dept to the average salary of its remaining rows, rounded to 1 decimal place.', o); }

{ const rows = csv.trim().split('\n').slice(1).map(l => l.split(',')); const s = new Set();
  rows.forEach(r => r[3].split(';').filter(x => x !== '').forEach(x => s.add(x.toLowerCase())));
  add('employees.csv', 'The file is CSV with a header line (name,dept,salary,skills). The skills column holds skills separated by ";" and may be empty. Return the distinct skills across all rows, lowercased, as an array sorted ascending.', [...s].sort(asc)); }

{ const o = {}; env.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#')).forEach(l => { const i = l.indexOf('='); const k = l.slice(0, i).trim(), v = l.slice(i + 1).trim(); if (k.startsWith('DB_')) o[k.slice(3).toLowerCase()] = v; });
  add('settings.env', 'The file has KEY=VALUE lines; blank lines and lines starting with "#" are ignored. Split each line at the first "=" only, and trim whitespace around key and value. Keep only keys starting with the exact, case-sensitive prefix "DB_". Return an object whose keys are those keys with the "DB_" prefix removed and lowercased, and whose values are the value strings (not converted to numbers).', o); }

{ const a = Object.entries(config.services).filter(([, s]) => s.enabled === true).map(([n, s]) => ({ name: n, url: `${s.protocol}://${s.host}:${s.port === undefined ? 80 : s.port}` })).sort((a, b) => asc(a.name, b.name));
  add('config.json', 'From "services", take only entries whose "enabled" is true (missing counts as not enabled). Return an array of objects {"name": <service key>, "url": "<protocol>://<host>:<port>"}; if port is missing use 80. Sort by name ascending.', a); }

{ const p = events.filter(e => e.type === 'purchase');
  add('events.json', 'Consider events with type exactly "purchase" for total and users. Return an object with keys: "total" = sum of meta.amount over those events (null or missing meta.amount counts as 0), rounded to 2 decimals; "users" = number of distinct users among those events; "hasRefund" = true if any event in the file has a type equal to "refund" ignoring case, else false.',
    { total: r2(p.reduce((s, e) => s + ((e.meta && e.meta.amount) || 0), 0)), users: new Set(p.map(e => e.user)).size, hasRefund: events.some(e => e.type.toLowerCase() === 'refund') }); }

{ const words = ["Apple", "banana", "apple", "Cherry", "BANANA", "date", "Elder", "cherry", "fig", "Apple"];
  const c = {}; words.forEach(x => { const k = x.toLowerCase(); c[k] = (c[k] || 0) + 1; });
  add(null, 'Given this list of strings: ' + JSON.stringify(words) + ' — return the strings that occur more than once when compared ignoring case, each lowercased and listed once, as an array sorted ascending.', Object.keys(c).filter(k => c[k] > 1).sort(asc)); }

w('tasks.json', T);
console.log(T.length); T.forEach(t => console.log(t.id, JSON.stringify(t.expected)));

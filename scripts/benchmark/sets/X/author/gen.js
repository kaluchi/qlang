const fs = require('fs');
const path = require('path');
const dir = __dirname;
const W = (name, content) => fs.writeFileSync(path.join(dir, name), typeof content === 'string' ? content : JSON.stringify(content, null, 2) + '\n');
const R = (name) => fs.readFileSync(path.join(dir, name), 'utf8');
const RJ = (name) => JSON.parse(R(name));
const r1 = (x) => Math.round(x * 10) / 10;
const r2 = (x) => Math.round(x * 100) / 100;
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// ---------- data files ----------
W('users.json', {
  status: 'ok', page: 1, total: 10,
  data: { users: [
    { id: 1, name: 'Ana Ruiz', email: 'ana@example.com', active: true, address: { city: 'Madrid', country: 'es' }, roles: ['admin', 'dev'] },
    { id: 2, name: 'Bob Stone', email: 'bob@example.com', active: true, address: { city: 'Berlin', country: 'DE' }, roles: ['dev'] },
    { id: 3, name: 'Cleo Park', email: 'cleo@example.com', active: false, address: { city: 'Seoul', country: 'KR' }, roles: [] },
    { id: 4, name: 'Dmitri Ivanov', email: 'dmitri@example.com', active: true, address: null, roles: ['ops'] },
    { id: 5, name: 'Eve Larsen', email: 'eve@example.com', active: true, address: { city: 'Oslo', country: 'NO' }, roles: ['dev', 'ops'] },
    { id: 6, name: 'Farid Aziz', email: 'farid@example.com', active: true, address: { city: 'Berlin', country: 'de' }, roles: ['dev'] },
    { id: 7, name: 'Gina Rossi', email: 'gina@example.com', active: true, address: { city: 'Rome' }, roles: ['qa'] },
    { id: 8, name: 'Hiro Tanaka', email: 'hiro@example.com', active: true, address: { city: 'Tokyo', country: 'jp' }, roles: ['admin'] },
    { id: 9, name: 'Ivy Chen', email: 'ivy@example.com', active: false, roles: ['qa'] },
    { id: 10, name: 'Jon Doe', email: 'jon@example.com', active: true, address: { city: 'Madrid', country: 'ES' }, roles: [] },
  ] },
});

W('orders.json', [
  { id: 1001, customer: 'alice', status: 'paid', items: [{ sku: 'A1', qty: 2, price: 9.99 }, { sku: 'B2', qty: 1, price: 24.5 }], discount: 5, created: '2026-02-01' },
  { id: 1002, customer: 'bob', status: 'Paid', items: [{ sku: 'C3', qty: 3, price: 4.25 }], discount: null, created: '2026-02-02' },
  { id: 1003, customer: 'alice', status: 'pending', items: [{ sku: 'A1', qty: 1, price: 9.99 }], discount: null, created: '2026-02-03' },
  { id: 1004, customer: 'carol', status: 'PAID', items: [{ sku: 'B2', qty: 2, price: 24.5 }, { sku: 'D4', qty: 1, price: 100 }], discount: 10.5, created: '2026-02-04' },
  { id: 1005, customer: 'bob', status: 'refunded', items: [{ sku: 'C3', qty: 1, price: 4.25 }], discount: 0, created: '2026-02-05' },
  { id: 1006, customer: 'dave', status: 'paid', items: [], discount: null, created: '2026-02-06' },
  { id: 1007, customer: 'carol', status: 'paid', items: [{ sku: 'A1', qty: 5, price: 9.99 }], created: '2026-02-07' },
  { id: 1008, customer: 'alice', status: 'paid', items: [{ sku: 'D4', qty: 1, price: 100 }], discount: 0, created: '2026-02-08' },
  { id: 1009, customer: 'erin', status: 'cancelled', items: [{ sku: 'A1', qty: 1, price: 9.99 }], discount: null, created: '2026-02-09' },
  { id: 1010, customer: 'bob', status: 'paid', items: [{ sku: 'B2', qty: 1, price: 24.5 }, { sku: 'C3', qty: 2, price: 4.25 }], discount: 2.5, created: '2026-02-10' },
]);

W('pkg.json', {
  name: 'webshop-api', version: '2.3.1', private: true,
  scripts: { start: 'node server.js', test: 'jest --coverage', lint: 'eslint src' },
  dependencies: { express: '^4.18.2', lodash: '~4.17.21', axios: '^1.6.0', dotenv: '16.3.1', zod: '^3.22.4' },
  devDependencies: { jest: '^29.7.0', typescript: '^5.3.3', eslint: '8.56.0', '@types/node': '^20.10.0', lodash: '^4.17.21' },
  peerDependencies: { react: '>=18' },
});

W('issues.json', [
  { number: 1, title: 'Crash on login', state: 'open', labels: [{ name: 'bug' }, { name: 'P1' }], assignee: { login: 'Mara' }, comments: 7, milestone: { title: 'v1.0' } },
  { number: 2, title: 'Add dark mode', state: 'open', labels: [{ name: 'Feature' }], assignee: { login: 'mara' }, comments: 3, milestone: null },
  { number: 3, title: 'Typo in docs', state: 'closed', labels: [{ name: 'docs' }], assignee: { login: 'Tom' }, comments: 0, milestone: null },
  { number: 4, title: 'Slow search', state: 'open', labels: [{ name: 'Bug' }, { name: 'performance' }], assignee: { login: 'tom' }, comments: 12, milestone: { title: 'v1.0' } },
  { number: 5, title: 'Upgrade deps', state: 'open', labels: [], assignee: null, comments: 1, milestone: null },
  { number: 6, title: 'Memory leak', state: 'open', labels: [{ name: 'BUG' }], assignee: { login: 'Lena' }, comments: 7, milestone: { title: 'v1.1' } },
  { number: 7, title: 'Export to CSV', state: 'open', labels: [{ name: 'feature' }], assignee: null, comments: 5, milestone: null },
  { number: 8, title: 'Null pointer in parser', state: 'closed', labels: [{ name: 'bug' }], assignee: { login: 'Lena' }, comments: 9, milestone: { title: 'v1.0' } },
  { number: 9, title: 'Flaky tests', state: 'open', labels: [{ name: 'testing' }], assignee: { login: 'Tom' }, comments: 2, milestone: null },
  { number: 10, title: 'Broken link', state: 'open', labels: [{ name: 'bug' }, { name: 'docs' }], assignee: null, comments: 12, milestone: null },
  { number: 11, title: 'Refactor auth', state: 'open', labels: [{ name: 'refactor' }], assignee: { login: 'LENA' }, comments: 4, milestone: { title: 'v1.1' } },
  { number: 12, title: 'Bug in billing totals', state: 'open', labels: [{ name: 'billing' }], assignee: { login: 'Mara' }, comments: 8, milestone: null },
]);

W('access.log', [
  '2026-03-01T10:15:32Z INFO GET /api/users 200 123ms',
  '2026-03-01T10:15:40Z INFO POST /api/orders 201 250ms',
  '2026-03-01T10:16:02Z WARN GET /api/search?q=shoes 200 980ms',
  '2026-03-01T10:16:10Z ERROR GET /api/orders/42 500 45ms',
  '2026-03-01T10:17:01Z INFO GET /api/users 304 8ms',
  '',
  '2026-03-01T10:17:30Z ERROR POST /api/orders 503 1500ms',
  '2026-03-01T10:18:12Z INFO DELETE /api/orders/42 204 60ms',
  '2026-03-01T10:18:45Z WARN GET /api/search?q=hats 404 30ms',
  '2026-03-01T10:19:03Z ERROR GET /api/search?q=socks 502 2200ms',
  '2026-03-01T10:19:59Z INFO GET /api/users 200 101ms',
  '2026-03-01T10:20:15Z ERROR POST /api/orders 500 800ms',
  '',
].join('\n'));

W('metrics.csv', [
  'host,region,cpu,mem,status',
  'web-1,eu-west,45,60,up',
  'web-2,EU-West,,55,up',
  'web-3,us-east,70,80,up',
  'web-4,us-east,30,40,down',
  'db-1,US-East,56,90,up',
  'db-2,eu-west,25,70,up',
  'cache-1,ap-south,,30,down',
  'cache-2,ap-south,10,20,up',
  '',
].join('\n'));

W('config.json', {
  app: 'shop',
  defaults: { features: { search: true, checkout: true, beta_ui: false, chat: false }, db: { port: 5432 } },
  environments: {
    dev: { features: { beta_ui: true, chat: true } },
    staging: { features: { beta_ui: true, checkout: null, chat: false } },
    prod: { features: { chat: true, search: false, audit: true } },
    test: {},
  },
});

W('employees.json', [
  { id: 1, name: 'Ann', dept: 'Engineering', salary: 120000, manager: null, skills: ['go', 'sql'] },
  { id: 2, name: 'Ben', dept: 'Engineering', salary: 100000, manager: 1, skills: ['js'] },
  { id: 3, name: 'Cat', dept: 'Engineering', salary: 90000, manager: 1, skills: [] },
  { id: 4, name: 'Joe', dept: 'Engineering', salary: null, manager: 1, skills: ['js', 'css'] },
  { id: 5, name: 'Dan', dept: 'Sales', salary: 70000, manager: null, skills: [] },
  { id: 6, name: 'Eli', dept: 'Sales', salary: 80000, manager: 5, skills: ['negotiation'] },
  { id: 7, name: 'Fay', dept: 'Sales', manager: 5, skills: [] },
  { id: 8, name: 'Gus', dept: 'Support', salary: 50000, manager: null, skills: ['english'] },
  { id: 9, name: 'Hal', dept: 'HR', salary: 65000, manager: null, skills: [] },
  { id: 10, name: 'Ivy', dept: 'HR', salary: 66000, manager: 9, skills: ['law'] },
  { id: 11, name: 'Kim', dept: 'Legal', salary: null, manager: null, skills: ['law'] },
]);

W('deploy.env', [
  '# Deployment settings',
  'APP_NAME="shop-api"',
  'APP_DEBUG=Yes',
  'DB_HOST=db.internal',
  'DB_PORT=5432',
  "DB_NAME='shop'",
  'db_user=ignored',
  '',
  'DB_PASSWORD="s3cr=t"',
  '# DB_OLD=legacy',
  'CACHE_TTL=300',
  '',
].join('\n'));

// ---------- tasks ----------
const tasks = [];
const add = (data, text, expected) => tasks.push({ id: 'X' + (tasks.length + 1), data, text, expected });

// X1: inline data
{
  const words = ['Apple', 'banana', 'apple', 'Cherry', 'BANANA', 'date', 'cherry', 'apple'];
  const c = {};
  for (const w of words) { const k = w.toLowerCase(); c[k] = (c[k] || 0) + 1; }
  const exp = {};
  for (const k of Object.keys(c)) if (c[k] > 1) exp[k] = c[k];
  add(null,
    'Given the list of words ["Apple","banana","apple","Cherry","BANANA","date","cherry","apple"], count the occurrences of each word, comparing case-insensitively. Return an object whose keys are the lowercase words and whose values are the counts (integers), including only words that occur more than once. Key order does not matter.',
    exp);
}

// X2
{
  const d = RJ('users.json');
  const s = new Set();
  for (const u of d.data.users) {
    if (u.active === true && u.address && u.address.country) s.add(u.address.country.toUpperCase());
  }
  add('users.json',
    'The file is an API response; the users are in data.users. Consider only users with active equal to true whose address is present (not null, not missing) and has a country. Return the distinct country codes of those users, converted to uppercase, as an array of strings sorted ascending in plain character-code order.',
    [...s].sort(cmp));
}

const paid = (o) => String(o.status).toLowerCase() === 'paid';
const itemsSum = (o) => o.items.reduce((a, i) => a + i.qty * i.price, 0);

// X3
{
  const d = RJ('orders.json');
  let t = 0;
  for (const o of d) if (paid(o)) t += itemsSum(o) - (o.discount == null ? 0 : o.discount);
  add('orders.json',
    'The file is an array of orders. Consider only orders whose status equals "paid", compared case-insensitively. The value of an order is the sum of qty*price over its items minus its discount (an absolute amount; a null or missing discount counts as 0; an empty items list sums to 0). Return the total value of all such orders as a number rounded to 2 decimal places.',
    r2(t));
}

// X4
{
  const d = RJ('orders.json');
  const m = {};
  for (const o of d) if (paid(o)) m[o.customer] = (m[o.customer] || 0) + itemsSum(o);
  const arr = Object.entries(m).map(([customer, t]) => ({ customer, total: r2(t) }));
  arr.sort((a, b) => b.total - a.total || cmp(a.customer, b.customer));
  add('orders.json',
    'The file is an array of orders. Consider only orders whose status equals "paid", compared case-insensitively. For each customer, total = the sum of qty*price over all items of that customer\'s paid orders (ignore the discount field). Return the top 3 customers by total, as an array of objects {"customer": <string>, "total": <number rounded to 2 decimal places>}, ordered by total descending, ties broken by customer name ascending. A customer with a paid order with no items has total 0 and is still a candidate.',
    arr.slice(0, 3));
}

// X5
{
  const d = RJ('pkg.json');
  const s = new Set();
  for (const sec of ['dependencies', 'devDependencies'])
    for (const [n, v] of Object.entries(d[sec] || {})) if (v.startsWith('^')) s.add(n);
  add('pkg.json',
    'The file is a package manifest. Look at the "dependencies" and "devDependencies" sections. Return the names of all packages whose version specifier starts with the character "^" in at least one of these two sections, each name once, as an array of strings sorted ascending in plain character-code order.',
    [...s].sort(cmp));
}

// X6
{
  const d = RJ('pkg.json');
  const exp = {};
  for (const sec of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'])
    exp[sec] = Object.keys(d[sec] || {}).length;
  add('pkg.json',
    'The file is a package manifest. Return an object with exactly the four keys "dependencies", "devDependencies", "peerDependencies", "optionalDependencies", where each value is the number of packages listed in that section of the manifest (0 if the section is absent).',
    exp);
}

// X7
{
  const d = RJ('issues.json');
  const exp = {};
  for (const i of d) if (i.state === 'open') {
    const k = i.assignee ? i.assignee.login.toLowerCase() : 'unassigned';
    exp[k] = (exp[k] || 0) + 1;
  }
  add('issues.json',
    'The file is an array of issues. Consider only issues whose state is "open". Count them per assignee, using the lowercase form of assignee.login as the key (so "Mara" and "mara" are the same person); issues whose assignee is null are counted under the key "unassigned". Return an object mapping key to count (integer). Key order does not matter.',
    exp);
}

// X8
{
  const d = RJ('issues.json');
  const f = d.filter((i) => i.state === 'open' && i.labels.some((l) => l.name.toLowerCase() === 'bug'));
  f.sort((a, b) => b.comments - a.comments || a.number - b.number);
  add('issues.json',
    'The file is an array of issues. Select issues whose state is "open" and that have a label whose name equals "bug" (case-insensitive; only the labels count, not the title). Sort them by comments descending, ties broken by number ascending. Take the first 3 and return their number values joined with "," (no spaces) as a single string.',
    f.slice(0, 3).map((i) => i.number).join(','));
}

const logLines = () => R('access.log').split('\n').filter((l) => l.trim() !== '').map((l) => {
  const p = l.trim().split(/\s+/);
  return { ts: p[0], level: p[1], method: p[2], url: p[3], status: Number(p[4]), ms: Number(p[5].replace('ms', '')) };
});

// X9
{
  const g = {};
  for (const l of logLines()) (g[l.method] = g[l.method] || []).push(l.ms);
  const exp = {};
  for (const [m, a] of Object.entries(g)) exp[m] = r1(a.reduce((x, y) => x + y, 0) / a.length);
  add('access.log',
    'The file is a plain-text access log; blank lines must be ignored. Each other line has space-separated fields: timestamp, level, HTTP method, URL, status code, duration written as an integer followed by "ms" (for example "123ms"). For each HTTP method that appears in the log, compute the average duration in milliseconds over all its lines. Return an object mapping method to the average, each rounded to 1 decimal place. Key order does not matter.',
    exp);
}

// X10
{
  const s = new Set();
  for (const l of logLines()) if (l.status >= 500) s.add(l.url.split('?')[0]);
  add('access.log',
    'The file is a plain-text access log; blank lines must be ignored. Each other line has space-separated fields: timestamp, level, HTTP method, URL, status code, duration (like "123ms"). Take the lines whose status code is 500 or greater. For each, strip the query string from the URL (everything from the first "?" onward, if any). Return the distinct resulting paths as an array of strings sorted ascending in plain character-code order.',
    [...s].sort(cmp));
}

// X11
{
  const lines = R('metrics.csv').split('\n').filter((l) => l.trim() !== '');
  const head = lines[0].split(',');
  const rows = lines.slice(1).map((l) => { const p = l.split(','); const o = {}; head.forEach((h, i) => (o[h] = p[i])); return o; });
  const g = {};
  for (const r of rows) {
    if (r.status !== 'up' || r.cpu === '') continue;
    const k = r.region.toLowerCase();
    (g[k] = g[k] || []).push(Number(r.cpu));
  }
  const exp = {};
  for (const [k, a] of Object.entries(g)) exp[k] = r1(a.reduce((x, y) => x + y, 0) / a.length);
  add('metrics.csv',
    'The file is CSV text with a header row (host,region,cpu,mem,status). Ignore rows whose status is not exactly "up", and ignore rows whose cpu field is empty. Group the remaining rows by region, comparing region names case-insensitively, and use the lowercase region name as the key. Return an object mapping region to the average cpu (a number) rounded to 1 decimal place. Key order does not matter.',
    exp);
}

// X12
{
  const d = RJ('config.json');
  const exp = {};
  for (const [env, cfg] of Object.entries(d.environments)) {
    const eff = { ...d.defaults.features };
    for (const [k, v] of Object.entries((cfg && cfg.features) || {})) if (v !== null) eff[k] = v;
    exp[env] = Object.keys(eff).filter((k) => eff[k] === true).sort(cmp);
  }
  add('config.json',
    'The file is a configuration with defaults.features (name -> boolean) and environments (name -> settings). For each environment, compute the effective features: start from defaults.features, then for every feature listed in that environment\'s own "features" object, override the default with the environment value unless that value is null (null means keep the default); features that exist only in the environment are added. An environment may have no "features" key at all. Return an object mapping each environment name to the array of names of its effective features that are true, sorted ascending in plain character-code order. Key order does not matter.',
    exp);
}

// X13
{
  const d = RJ('employees.json');
  const g = {};
  for (const e of d) if (e.salary != null) (g[e.dept] = g[e.dept] || []).push(e.salary);
  const arr = Object.entries(g).map(([dept, a]) => ({ dept, avg: Math.round(a.reduce((x, y) => x + y, 0) / a.length), count: a.length }));
  arr.sort((a, b) => b.avg - a.avg || cmp(a.dept, b.dept));
  add('employees.json',
    'The file is an array of employees. Ignore employees whose salary is null or missing. Group the rest by dept. Return an array of objects {"dept": <string>, "avg": <average salary rounded to the nearest integer>, "count": <number of employees with a salary in that dept>}, ordered by avg descending, ties broken by dept ascending. Departments with no employee that has a salary are omitted.',
    arr);
}

// X14
{
  const lines = R('deploy.env').split('\n').map((l) => l.trim()).filter((l) => l !== '' && !l.startsWith('#'));
  const kv = {};
  const strip = (v) => (v.length >= 2 && (v[0] === '"' || v[0] === "'") && v[v.length - 1] === v[0] ? v.slice(1, -1) : v);
  for (const l of lines) { const i = l.indexOf('='); kv[l.slice(0, i)] = strip(l.slice(i + 1)); }
  const db = {};
  for (const [k, v] of Object.entries(kv)) if (k.startsWith('DB_')) db[k.slice(3).toLowerCase()] = v;
  const dbg = kv.APP_DEBUG !== undefined && ['true', '1', 'yes'].includes(kv.APP_DEBUG.toLowerCase());
  add('deploy.env',
    'The file is a plain-text env file with KEY=VALUE lines. Lines that are blank or start with "#" are ignored. Split each line at the first "=" only; if a value is wrapped in a matching pair of single or double quotes, remove those quotes. Return an object with two keys: "db" - an object built from the keys that start with the exact, case-sensitive prefix "DB_" (the key in the result is the rest of the name after the prefix, in lowercase; every value is a string, e.g. "5432"); and "debug" - a boolean that is true if the value of APP_DEBUG, compared case-insensitively, is one of "true", "1", "yes", and false otherwise (including when APP_DEBUG is absent).',
    { db, debug: dbg });
}

W('tasks.json', tasks);
console.log(JSON.stringify(tasks.map((t) => [t.id, t.data, t.expected]), null, 0));

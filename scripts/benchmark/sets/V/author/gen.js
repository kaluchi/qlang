const fs = require('fs');
const w = (n, s) => fs.writeFileSync(n, typeof s === 'string' ? s : JSON.stringify(s, null, 2) + '\n');
const r2 = x => Math.round(x * 100) / 100;

// ---------- inputs ----------
const orders = { status: 'ok', data: { orders: [
  { id: 1, status: 'paid', customer: { name: 'Ann', country: 'DE' }, discount: null, items: [{ sku: 'A1', qty: 2, price: 10.5 }, { sku: 'B2', qty: 1, price: 3.25 }] },
  { id: 2, status: 'PAID', customer: { name: 'Bob', country: 'US' }, discount: 5, items: [{ sku: 'A1', qty: 1, price: 10.5 }] },
  { id: 3, status: 'cancelled', customer: { name: 'Cy', country: 'US' }, discount: null, items: [{ sku: 'C3', qty: 4, price: 2 }] },
  { id: 4, status: 'paid', customer: { name: 'Di' }, discount: null, items: [{ sku: 'B2', qty: 3, price: 3.25 }, { sku: 'D4', qty: 1, price: 99.99 }] },
  { id: 5, status: 'pending', customer: { name: 'Ed', country: 'FR' }, discount: 10, items: [] },
  { id: 6, status: 'Paid', customer: null, discount: null, items: [{ sku: 'C3', qty: 10, price: 2 }] },
  { id: 7, status: 'paid', customer: { name: 'Flo', country: 'DE' }, discount: null, items: [{ sku: 'E5', qty: 1, price: 0.99 }] },
  { id: 8, status: 'refunded', customer: { name: 'Gus', country: 'FR' }, discount: 0, items: [{ sku: 'A1', qty: 1, price: 10.5 }] }
] } };
w('orders.json', orders);

const users = [
  { id: 1, name: 'zoe', email: 'zoe@example.com', age: 31, active: true, roles: ['Admin', 'dev'], address: { city: 'Berlin' } },
  { id: 2, name: 'Adam', email: 'adam@test.org', age: null, active: true, roles: ['dev'], address: { city: 'paris' } },
  { id: 3, name: 'bella', email: 'bella@example.com', age: 25, active: false, roles: ['admin'], address: null },
  { id: 4, name: 'Carl', email: 'carl@test.org', age: 40, active: true, roles: ['ADMIN', 'ops'], address: { city: 'Berlin' } },
  { id: 5, name: 'dina', email: 'dina@example.com', active: true, roles: [], address: { city: 'PARIS' } },
  { id: 6, name: 'Egor', email: 'egor@mail.net', age: 28, active: true, roles: ['admin'], address: { city: null } },
  { id: 7, name: 'Fay', email: 'fay@mail.net', age: 52, active: false, roles: ['ops'], address: { city: 'Rome' } }
];
w('users.json', users);

w('logs.txt', [
  '2026-03-01T10:00:01Z INFO api request served req=r1 duration=120ms',
  '2026-03-01T10:00:02Z ERROR db connection lost retrying',
  '2026-03-01T10:00:03Z INFO api request served req=r2 duration=45ms',
  '2026-03-01T10:00:04Z ERROR api upstream error code=502',
  '2026-03-01T10:00:05Z WARN db slow query error rate rising',
  '2026-03-01T10:00:06Z INFO web page rendered req=r3 duration=980ms',
  '2026-03-01T10:00:07Z ERROR db deadlock detected',
  '2026-03-01T10:00:08Z INFO api request served req=r4 duration=300ms',
  '2026-03-01T10:00:09Z ERROR web template missing',
  '2026-03-01T10:00:10Z INFO web page rendered req=r5 duration=75ms',
  '2026-03-01T10:00:11Z INFO db query ok req=r6 duration=610ms',
  '2026-03-01T10:00:12Z ERROR db disk full',
  ''
].join('\n'));

const pkg = {
  name: 'demo-app', version: '1.2.0', private: true,
  scripts: { build: 'tsc', test: 'jest' },
  dependencies: { express: '^4.18.2', lodash: '~4.17.21', zod: '^3.22.0', chalk: '5.3.0', axios: '^1.6.0', 'left-pad': '*' },
  devDependencies: { jest: '^29.7.0', typescript: '~5.3.3', eslint: '^8.56.0', prettier: '3.2.4' }
};
w('package.json', pkg);

const issues = [
  { number: 101, title: 'Crash on start', state: 'open', labels: [{ name: 'Bug' }, { name: 'p1' }], assignee: { login: 'mia' }, comments: 4 },
  { number: 102, title: 'Add dark mode', state: 'open', labels: [{ name: 'feature' }], assignee: null, comments: 0 },
  { number: 103, title: 'Typo in docs', state: 'closed', labels: [{ name: 'docs' }], assignee: { login: 'leo' }, comments: 1 },
  { number: 104, title: 'Memory leak', state: 'open', labels: [{ name: 'bug' }], assignee: { login: 'leo' }, comments: 9 },
  { number: 105, title: 'Slow search', state: 'closed', labels: [{ name: 'BUG' }, { name: 'perf' }], assignee: null, comments: 3 },
  { number: 106, title: 'Update deps', state: 'open', labels: [], assignee: { login: 'mia' }, comments: 2 },
  { number: 107, title: 'Refactor auth', state: 'open', labels: [{ name: 'tech-debt' }], assignee: null, comments: 5 },
  { number: 108, title: 'Broken link', state: 'closed', labels: [{ name: 'docs' }, { name: 'bug' }], assignee: { login: 'mia' }, comments: 0 }
];
w('issues.json', issues);

const config = {
  defaults: { timeout: 30, retries: 3 },
  services: {
    auth: { host: 'auth.local', port: 8001, timeout: 10 },
    billing: { host: 'bill.local', port: 8002, enabled: false, timeout: 60 },
    search: { host: 'search.local', port: 8003, timeout: null },
    mail: { host: 'mail.local', port: 8004, enabled: true },
    cache: { host: 'cache.local', port: 8005, enabled: null, timeout: 5 },
    legacy: { host: 'old.local', port: 8006, enabled: false }
  }
};
w('config.json', config);

const salesText = [
  'region,rep,product,units,price',
  'north,amy,widget,10,2.50',
  'south,ben,gadget,3,19.99',
  'north,cat,gadget,,19.99',
  'east,dan,widget,20,2.50',
  'south,eve,widget,7,2.50',
  'east,fil,gizmo,2,45.00',
  'west,gus,gizmo,1,45.00',
  'north,amy,gizmo,1,45.00',
  ''
].join('\n');
w('sales.csv', salesText);

const tagsText = [
  'a.js: Util, core, Parser',
  'b.js: core,  io',
  'c.js: parser, UTIL',
  'd.js: ',
  'e.js: io, Net, core',
  'f.js: net',
  ''
].join('\n');
w('tags.txt', tagsText);

// ---------- tasks ----------
const T = [];
const add = (input, text, expected) => T.push({ id: 'V' + (T.length + 1), input, text, expected });

// V1
{
  const o = JSON.parse(fs.readFileSync('orders.json')).data.orders;
  const v = o.filter(x => x.status.toLowerCase() === 'paid').flatMap(x => x.items).reduce((s, i) => s + i.qty * i.price, 0);
  add('orders.json', 'The orders are in data.orders. Consider only orders whose status equals "paid", compared case-insensitively. Sum qty*price over all items of those orders (ignore the discount field). Return the total as a number rounded to 2 decimal places.', r2(v));
}
// V2
{
  const o = JSON.parse(fs.readFileSync('orders.json')).data.orders;
  const c = {};
  for (const x of o) { const k = x.customer && x.customer.country ? x.customer.country : 'unknown'; c[k] = (c[k] || 0) + 1; }
  add('orders.json', 'Count all orders (any status) per customer country (customer.country). Orders whose customer is null or has no country are counted under the key "unknown". Return an object mapping country to order count.', c);
}
// V3
{
  const v = users.filter(u => u.active && u.roles.some(r => r.toLowerCase() === 'admin')).map(u => u.name).sort((a, b) => a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : 0);
  add('users.json', 'The file is an array of users. Select users with active equal to true that have the role "admin" (case-insensitive) in their roles array. Return an array of their name values (original case), sorted ascending by lowercase name.', v);
}
// V4
{
  const a = users.filter(u => typeof u.age === 'number').map(u => u.age);
  add('users.json', 'Compute the average age over users whose age is present and not null (users with missing or null age are ignored, inactive users are included). Return a number rounded to 1 decimal place.', Math.round(a.reduce((s, x) => s + x, 0) / a.length * 10) / 10);
}
// V5
{
  const v = [...new Set(users.map(u => u.address && u.address.city).filter(c => c).map(c => c.toLowerCase()))].sort();
  add('users.json', 'Collect address.city of every user, skipping users whose address is null or whose city is null. Lowercase each city, remove duplicates, and return an array of strings sorted ascending.', v);
}
// V6
{
  const cnt = {};
  tagsText.split('\n').filter(l => l.trim()).forEach(l => {
    const t = new Set(l.slice(l.indexOf(':') + 1).split(',').map(s => s.trim().toLowerCase()).filter(s => s));
    t.forEach(x => cnt[x] = (cnt[x] || 0) + 1);
  });
  const v = Object.keys(cnt).filter(k => cnt[k] >= 2).sort();
  add('tags.txt', 'Each non-empty line has the form "<file>: <tag>, <tag>, ...". Split tags on commas, trim whitespace, lowercase them, and ignore empty tags (a line may have no tags). Return an array, sorted ascending, of the tags that occur on at least 2 different lines.', v);
}
// V7
{
  const c = {};
  fs.readFileSync('logs.txt', 'utf8').split('\n').filter(l => l).forEach(l => {
    const p = l.split(' ');
    if (p[1] === 'ERROR') c[p[2]] = (c[p[2]] || 0) + 1;
  });
  add('logs.txt', 'Each non-empty line is space-separated: timestamp, level (second token), service (third token), then free-form message. Count lines whose level is exactly ERROR per service (only the level token counts, not the word "error" inside messages). Return an object mapping service to count, including only services with at least one ERROR.', c);
}
// V8
{
  const rows = [];
  fs.readFileSync('logs.txt', 'utf8').split('\n').filter(l => l).forEach(l => {
    const d = l.match(/duration=(\d+)ms/), r = l.match(/req=(\S+)/);
    if (d && r) rows.push({ r: r[1], d: +d[1] });
  });
  rows.sort((a, b) => b.d - a.d);
  add('logs.txt', 'Some lines contain "req=<id>" and "duration=<n>ms". Among those lines, return the req ids of the 3 largest durations, as an array of strings ordered by duration descending.', rows.slice(0, 3).map(x => x.r));
}
// V9
{
  const all = Object.assign({}, pkg.dependencies, pkg.devDependencies);
  const v = Object.keys(all).filter(k => all[k].startsWith('^')).sort().join(',');
  add('package.json', 'Combine the packages from "dependencies" and "devDependencies" (either section might be absent in other manifests, but names are unique across both here). Keep packages whose version string starts with "^". Return one string: the package names sorted ascending, joined with a comma and no spaces.', v);
}
// V10
{
  const g = {};
  issues.filter(i => i.state === 'open').forEach(i => {
    const k = i.assignee ? i.assignee.login : 'unassigned';
    (g[k] = g[k] || []).push(i.number);
  });
  Object.values(g).forEach(a => a.sort((x, y) => x - y));
  add('issues.json', 'Take issues whose state is "open". Group their number values by assignee.login; issues with a null assignee go under the key "unassigned". Return an object mapping each key to an array of issue numbers sorted ascending.', g);
}
// V11
{
  const v = issues.some(i => i.state === 'closed' && i.assignee === null && i.labels.some(l => l.name.toLowerCase() === 'bug'));
  add('issues.json', 'Return a boolean: true if at least one issue is closed, has a null assignee, and has a label named "bug" (case-insensitive); otherwise false.', v);
}
// V12
{
  const o = {};
  for (const [k, s] of Object.entries(config.services)) {
    if (s.enabled === false) continue;
    o[k] = s.timeout != null ? s.timeout : config.defaults.timeout;
  }
  add('config.json', 'For each entry of "services", skip it if its enabled field is exactly false (missing or null enabled means enabled). For the rest, the effective timeout is the service\'s own timeout if present and not null, otherwise defaults.timeout. Return an object mapping service name to effective timeout.', o);
}
// V13
{
  const lines = salesText.split('\n').filter(l => l).slice(1);
  const rev = {};
  for (const l of lines) {
    const [region, , , u, p] = l.split(',');
    rev[region] = (rev[region] || 0) + (u === '' ? 0 : +u) * +p;
  }
  const v = Object.entries(rev).map(([region, r]) => ({ region, revenue: r2(r) })).sort((a, b) => b.revenue - a.revenue || (a.region < b.region ? -1 : 1)).slice(0, 2);
  add('sales.csv', 'CSV with a header row: region,rep,product,units,price. Revenue of a row is units*price; an empty units field counts as 0. Sum revenue per region, round each region total to 2 decimals, and return the top 2 regions as an array of objects {"region": string, "revenue": number}, ordered by revenue descending.', v);
}
// V14
{
  const s = 'id:name:score records: 1:ann:82;2:Bob:69;3:cy:70;4:dora:91;5:Ed:55;6:fred:70';
  const v = s.split(': ')[1].split(';').map(r => r.split(':')).filter(p => +p[2] >= 70).map(p => p[1].toUpperCase()).sort().join('|');
  add(null, 'Given this semicolon-separated list of records in the form id:name:score — "1:ann:82;2:Bob:69;3:cy:70;4:dora:91;5:Ed:55;6:fred:70" — keep records with score >= 70, uppercase their names, sort the names ascending, and return them as one string joined with "|".', v);
}

w('tasks.json', T);
console.log(T.map(t => t.id + ' ' + JSON.stringify(t.expected)).join('\n'));

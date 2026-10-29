const fs = require('fs');
const w = (f, o) => fs.writeFileSync(f, typeof o === 'string' ? o : JSON.stringify(o, null, 2));
const rd = f => fs.readFileSync(f, 'utf8');
const rj = f => JSON.parse(rd(f));
const r = (x, d) => Math.round(x * 10 ** d) / 10 ** d;

w('users.json', {page: 1, users: [
 {id: 1, name: 'Ann', active: true, age: 31, address: {city: 'Berlin', country: 'DE'}},
 {id: 2, name: 'Bob', active: true, age: null, address: {city: 'paris', country: 'FR'}},
 {id: 3, name: 'Cid', active: false, age: 45, address: {city: 'Rome', country: 'IT'}},
 {id: 4, name: 'Dee', active: true, age: 28},
 {id: 5, name: 'Eve', active: true, age: 40, address: {city: 'BERLIN', country: 'DE'}},
 {id: 6, name: 'Fay', active: true, age: 22, address: {city: null, country: 'ES'}},
 {id: 7, name: 'Gus', active: false, age: null, address: {city: 'Oslo', country: 'NO'}},
 {id: 8, name: 'Hal', active: true, age: 35, address: {city: 'Madrid', country: 'ES'}}
]});

w('orders.json', [
 {id: 'o1', customer: 'Alice', status: 'paid', items: [{sku: 'A', qty: 2, price: 9.99}, {sku: 'B', qty: 1, price: 5}]},
 {id: 'o2', customer: 'bob', status: 'Paid', items: [{sku: 'C', qty: 3, price: 4.5}], coupon: 'X1'},
 {id: 'o3', customer: 'alice', status: 'PENDING', items: [{sku: 'A', qty: 1, price: 9.99}], coupon: null},
 {id: 'o4', customer: 'Carol', status: 'cancelled', items: [{sku: 'D', qty: 10, price: 100}]},
 {id: 'o5', customer: 'Bob', status: 'PAID', items: [{sku: 'B', qty: 4, price: 5}, {sku: 'E', qty: 1, price: 19.5}]},
 {id: 'o6', customer: 'Dave', status: 'Paid'},
 {id: 'o7', customer: 'Carol', status: 'paid', items: [{sku: 'F', qty: 1, price: 60}]},
 {id: 'o8', customer: 'dave', status: 'Cancelled', items: []},
 {id: 'o9', customer: 'Erin', status: 'pending', items: [{sku: 'A', qty: 5, price: 9.99}]},
 {id: 'o10', customer: 'ALICE', status: 'paid', items: [{sku: 'G', qty: 2, price: 12.25}]}
]);

w('issues.json', [
 {number: 101, title: 'Crash on start', state: 'open', labels: ['bug', 'p1'], assignee: null, comments: 7},
 {number: 102, title: 'Add dark mode', state: 'open', labels: ['feature'], assignee: {login: 'zed'}, comments: 3},
 {number: 103, title: 'Typo in docs', state: 'closed', labels: ['docs'], assignee: {login: 'amy'}, comments: 0},
 {number: 104, title: 'Memory leak', state: 'open', labels: ['Bug'], assignee: null, comments: 12},
 {number: 105, title: 'Slow query', state: 'open', labels: ['bug', 'perf'], assignee: {login: 'amy'}, comments: 7},
 {number: 106, title: 'Update deps', state: 'closed', labels: [], assignee: null, comments: 1},
 {number: 107, title: 'Login fails', state: 'open', labels: ['BUG'], assignee: null, comments: 4},
 {number: 108, title: 'Refactor auth', state: 'open', labels: ['tech-debt'], assignee: {login: 'zed'}, comments: 9},
 {number: 109, title: 'Flaky test', state: 'closed', labels: ['bug'], assignee: {login: 'zed'}, comments: 2},
 {number: 110, title: 'Add CSV export', state: 'open', labels: ['feature', 'p2'], assignee: {login: 'bo'}, comments: 7},
 {number: 111, title: 'Broken link', state: 'open', labels: ['docs', 'bug'], assignee: null, comments: 0}
]);

w('manifest.json', {
 name: 'demo-app', version: '1.4.2',
 scripts: {build: 'tsc', test: 'jest', lint: 'eslint .'},
 dependencies: {express: '^4.18.2', lodash: '~4.17.21', zod: '^3.22.0', chalk: '5.3.0', ws: '>=8.0.0'},
 devDependencies: {jest: '^29.7.0', typescript: '^5.2.2', eslint: '~8.50.0', prettier: '^3.0.3', Mocha: '^10.2.0'}
});

w('config.json', {env: 'prod', services: [
 {name: 'web', port: 8080, enabled: true, replicas: 3},
 {name: 'api', port: 9000, enabled: true},
 {name: 'worker', port: null, enabled: false, replicas: 5},
 {name: 'cache', port: 6379, enabled: true, replicas: 2},
 {name: 'cron', enabled: true, replicas: null},
 {name: 'admin', port: 8443, enabled: false}
]});

w('access.log', [
 '2026-10-01T10:00:00Z GET /api/users 200 120ms',
 '2026-10-01T10:00:05Z POST /api/users 201 250ms',
 '2026-10-01T10:01:00Z GET /api/orders 500 900ms',
 '2026-10-01T10:02:10Z GET /api/users 404 15ms',
 '2026-10-01T10:03:00Z GET /health 200 5ms',
 '2026-10-01T10:03:30Z DELETE /api/orders 503 400ms',
 '2026-10-01T10:04:00Z GET /api/orders 200 180ms',
 '2026-10-01T10:05:00Z GET /api/items 200 95ms',
 '2026-10-01T10:05:20Z POST /api/orders 400 30ms',
 '2026-10-01T10:06:00Z GET /api/orders 502 700ms',
 '2026-10-01T10:07:00Z GET /health 200 7ms'
].join('\n') + '\n');

w('inventory.csv', [
 'sku,name,category,qty,price',
 'T1,Hammer,Tools,10,12.5',
 'T2,Saw,tools,,20',
 'T3,Drill,TOOLS,3,89.99',
 'G1,Rake,Garden,7,15',
 'G2,Hose,Garden,4,22.4',
 'T4,Wrench,Tools,6,8.75',
 'K1,Pan,Kitchen,12,19.9',
 'K2,Knife,Kitchen,,35',
 'T5,Level,Tools,2,14'
].join('\n') + '\n');

const tasks = [];
const add = (data, text, fn) => tasks.push({id: 'Z' + (tasks.length + 1), data, text, expected: fn()});
const lines = f => rd(f).split('\n').filter(l => l.trim());
const orderValue = o => (o.items || []).reduce((s, i) => s + i.qty * i.price, 0);

add('users.json', 'The file has a "users" array. Take users whose "active" is true and whose address exists and has a non-null "city". Return an array of the distinct city names converted to lower case, sorted ascending alphabetically.', () => {
 const s = new Set(rj('users.json').users.filter(u => u.active === true && u.address && u.address.city != null).map(u => u.address.city.toLowerCase()));
 return [...s].sort();
});
add('users.json', 'Among users (the "users" array) whose "active" is true and whose "age" is not null, compute the average age. Return a number rounded to 1 decimal place.', () => {
 const a = rj('users.json').users.filter(u => u.active === true && u.age != null).map(u => u.age);
 return r(a.reduce((x, y) => x + y, 0) / a.length, 1);
});
add('orders.json', 'Each order has "items" (an array of {sku, qty, price}; it may be missing or empty, which means a value of 0). The order value is the sum of qty*price over its items. Considering only orders whose status equals "paid" ignoring case, return the sum of their order values as a number rounded to 2 decimal places.', () =>
 r(rj('orders.json').filter(o => o.status.toLowerCase() === 'paid').reduce((s, o) => s + orderValue(o), 0), 2));
add('orders.json', 'Ignore orders whose status equals "cancelled" ignoring case. For the remaining orders, count orders per customer, with customer names converted to lower case. Return an object mapping each lower-case customer name to its order count (key order does not matter).', () => {
 const m = {};
 rj('orders.json').filter(o => o.status.toLowerCase() !== 'cancelled').forEach(o => { const k = o.customer.toLowerCase(); m[k] = (m[k] || 0) + 1; });
 return m;
});
add('orders.json', 'The order value is the sum of qty*price over its "items" (missing or empty items mean 0). Ignore orders whose status equals "cancelled" ignoring case. Group the remaining orders by customer name converted to lower case and sum their order values. Return an array of the 3 lower-case customer names with the highest totals, highest first (ties, if any, broken by name ascending).', () => {
 const m = {};
 rj('orders.json').filter(o => o.status.toLowerCase() !== 'cancelled').forEach(o => { const k = o.customer.toLowerCase(); m[k] = (m[k] || 0) + orderValue(o); });
 return Object.entries(m).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 3).map(e => e[0]);
});
add('issues.json', 'Count the issues whose state is "open", whose assignee is null, and whose labels include "bug" compared ignoring case. Return a number.', () =>
 rj('issues.json').filter(i => i.state === 'open' && i.assignee === null && i.labels.some(l => l.toLowerCase() === 'bug')).length);
add('issues.json', 'Take issues whose state is "open". Sort them by "comments" descending, ties broken by "number" ascending. Return the first 3 as an array of objects with exactly the keys "number" and "title".', () =>
 rj('issues.json').filter(i => i.state === 'open').sort((a, b) => b.comments - a.comments || a.number - b.number).slice(0, 3).map(i => ({number: i.number, title: i.title})));
add('issues.json', 'Count all issues (any state) per assignee login. Issues with a null assignee are counted under the key "unassigned". Return an object mapping each key to its count (key order does not matter).', () => {
 const m = {};
 rj('issues.json').forEach(i => { const k = i.assignee ? i.assignee.login : 'unassigned'; m[k] = (m[k] || 0) + 1; });
 return m;
});
add('manifest.json', 'Combine the packages from "dependencies" and "devDependencies". Keep those whose version string starts with "^". Return a single string: their names converted to lower case, sorted ascending alphabetically, joined with a comma and no spaces.', () => {
 const m = rj('manifest.json');
 return Object.entries(Object.assign({}, m.dependencies, m.devDependencies)).filter(e => e[1].startsWith('^')).map(e => e[0].toLowerCase()).sort().join(',');
});
add('config.json', 'Among entries of "services" whose "enabled" is true, sum their "replicas". A missing or null "replicas" counts as 1. Return a number.', () =>
 rj('config.json').services.filter(s => s.enabled === true).reduce((s, x) => s + (x.replicas == null ? 1 : x.replicas), 0));
add('access.log', 'Each line of the log is "<timestamp> <METHOD> <path> <status> <duration>ms". Group the requests by status class: "2xx", "4xx", "5xx" (by the first digit of the status). Return an object with exactly those three keys mapping to the number of requests in each class.', () => {
 const m = {'2xx': 0, '4xx': 0, '5xx': 0};
 lines('access.log').forEach(l => { m[l.split(' ')[3][0] + 'xx']++; });
 return m;
});
add('access.log', 'Each line of the log is "<timestamp> <METHOD> <path> <status> <duration>ms". Take requests with method GET. Return the average duration in milliseconds as a number rounded to 1 decimal place.', () => {
 const d = lines('access.log').map(l => l.split(' ')).filter(p => p[1] === 'GET').map(p => parseInt(p[4], 10));
 return r(d.reduce((a, b) => a + b, 0) / d.length, 1);
});
add('inventory.csv', 'The file is CSV with a header row (sku,name,category,qty,price). Take rows whose category equals "Tools" ignoring case. The value of a row is qty*price, where an empty qty counts as 0. Return the sum of the values as a number rounded to 2 decimal places.', () => {
 const rows = lines('inventory.csv').slice(1).map(l => l.split(','));
 return r(rows.filter(c => c[2].toLowerCase() === 'tools').reduce((s, c) => s + (c[3] === '' ? 0 : Number(c[3])) * Number(c[4]), 0), 2);
});
const text14 = 'alice@Example.com, bob@example.org; carol@EXAMPLE.COM, dave@mail.test, erin@Example.org, frank@mail.test';
add(null, 'Given this string of e-mail addresses separated by commas or semicolons (with optional spaces): "' + text14 + '". Return an array of the distinct domains (the part after "@") converted to lower case, sorted ascending alphabetically.', () => {
 const s = new Set(text14.split(/[,;]\s*/).map(e => e.split('@')[1].toLowerCase()));
 return [...s].sort();
});
w('tasks.json', tasks);
console.log(JSON.stringify(tasks.map(t => [t.id, t.expected])));

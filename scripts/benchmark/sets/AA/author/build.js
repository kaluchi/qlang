const fs = require('fs');
const w = (f, v) => fs.writeFileSync(f, typeof v === 'string' ? v : JSON.stringify(v, null, 2));

const users = {status:"ok", data:{users:[
 {id:1,name:"Alice",email:"alice@x.com",active:true,role:"Admin",profile:{country:"DE",age:34}},
 {id:2,name:"Bob",email:null,active:true,role:"editor",profile:{country:"de",age:28}},
 {id:3,name:"Carol",email:"c@x.com",active:false,role:"ADMIN",profile:{country:"FR",age:41}},
 {id:4,name:"Dan",email:"d@x.com",active:true,role:"viewer"},
 {id:5,name:"Eve",email:"e@x.com",active:true,role:"Editor",profile:{country:null,age:23}},
 {id:6,name:"Frank",email:"f@x.com",active:true,role:"viewer",profile:{country:"us",age:null}},
 {id:7,name:"Grace",email:"g@x.com",active:false,role:"editor",profile:{country:"US",age:30}},
 {id:8,name:"Heidi",email:"h@x.com",active:true,role:"admin",profile:{country:"Fr",age:52}},
 {id:9,name:"Ivan",email:null,active:false,role:"viewer",profile:{country:"PL"}},
 {id:10,name:"Judy",email:"j@x.com",active:true,role:"Viewer",profile:{country:"pl",age:37}}
]}};
w('users.json', users);

const orders = [
 {id:"o1",customer:"acme",status:"Paid",items:[{sku:"A",qty:2,price:10.5},{sku:"B",qty:1,price:3.25}],coupon:null},
 {id:"o2",customer:"globex",status:"paid",items:[{sku:"C",qty:5,price:2.2}],coupon:"X1"},
 {id:"o3",customer:"acme",status:"cancelled",items:[{sku:"A",qty:10,price:10.5}],coupon:null},
 {id:"o4",customer:"initech",status:"PAID",items:[{sku:"D",qty:1,price:99.99},{sku:"A",qty:1,price:10.5}],coupon:null},
 {id:"o5",customer:"globex",status:"shipped",items:[{sku:"B",qty:4,price:3.25}],coupon:null},
 {id:"o6",customer:"umbrella",status:"Cancelled",items:[],coupon:null},
 {id:"o7",customer:"initech",status:"shipped",items:[{sku:"C",qty:3,price:2.2}]},
 {id:"o8",customer:"acme",status:"paid",items:[{sku:"E",qty:2,price:40}],coupon:"Y2"}
];
w('orders.json', orders);

const pkg = {name:"demo-app",version:"1.4.2",scripts:{build:"tsc",test:"jest"},
 dependencies:{express:"^4.18.2",lodash:"~4.17.21",axios:"^1.6.0",debug:"4.3.4",chalk:"^5.3.0"},
 devDependencies:{jest:"^29.7.0",typescript:"~5.3.2",eslint:"^8.56.0",prettier:"3.1.0"}};
w('package.json', pkg);

const issues = [
 {number:101,title:"Crash on start",state:"open",labels:["bug","P1"],assignee:{login:"ann"},comments:12},
 {number:102,title:"Add dark mode",state:"open",labels:["feature"],assignee:null,comments:5},
 {number:103,title:"Typo in docs",state:"closed",labels:["docs"],assignee:{login:"bo"},comments:1},
 {number:104,title:"Memory leak",state:"open",labels:["Bug"],assignee:{login:"bo"},comments:20},
 {number:105,title:"Upgrade deps",state:"open",labels:[],assignee:{login:"ann"},comments:0},
 {number:106,title:"Slow search",state:"closed",labels:["bug","perf"],assignee:null,comments:8},
 {number:107,title:"Export CSV",state:"open",labels:["feature","P2"],assignee:{login:"cy"},comments:7},
 {number:108,title:"Login fails",state:"open",labels:["BUG"],assignee:null,comments:3}
];
w('issues.json', issues);

const config = {app:"shop",services:{
 web:{port:8080,replicas:3},
 api:{port:3000,replicas:2,enabled:true},
 worker:{replicas:4},
 cache:{port:6379,enabled:false},
 db:{port:5432,replicas:1,enabled:null},
 admin:{port:9000,enabled:false,replicas:1},
 metrics:{port:9100}
}};
w('config.json', config);

const log = `2026-10-01T10:00:01Z GET /api/users 200 120ms
2026-10-01T10:00:02Z GET /api/orders 200 340ms
2026-10-01T10:00:05Z POST /api/orders 201 410ms
2026-10-01T10:01:10Z GET /api/users 200 95ms
2026-10-01T10:01:12Z GET /missing 404 5ms
2026-10-01T10:02:00Z GET /api/orders 500 1200ms
2026-10-01T10:02:30Z GET /api/users 304 12ms
2026-10-01T10:03:00Z GET /health 200 3ms
2026-10-01T10:03:01Z GET /api/orders 200 310ms
2026-10-01T10:03:20Z DELETE /api/users 403 8ms
2026-10-01T10:04:00Z GET /health 200 2ms
`;
w('access.log', log);

const csv = `region,product,units,price
North,Widget,10,2.50
south ,Widget,5,2.50
North,Gadget,0,9.99
East,Gadget,3,
 south,Gizmo,2,19.90
East,Widget,4,2.50
north,Gizmo,1,19.90
West,Gadget,,9.99
`;
w('sales.csv', csv);

// ---- expected computations
const r2 = x => Math.round(x*100)/100;
const U = users.data.users;
const T = [];
const add = (data, text, expected) => T.push({id:"AA"+(T.length+1), data, text, expected});

add('users.json', 'In users.json, count the users in data.users who are active (active is true) and whose role equals "admin" or "editor", compared case-insensitively. Return a single number.',
  U.filter(u=>u.active && ['admin','editor'].includes(u.role.toLowerCase())).length);

add('users.json', 'In users.json, take profile.country of every user in data.users. Skip users with no profile or a null country. Lowercase the values, remove duplicates and return an array of strings sorted alphabetically (ascending).',
  [...new Set(U.map(u=>u.profile&&u.profile.country).filter(c=>c!=null).map(c=>c.toLowerCase()))].sort());

{ const a = U.filter(u=>u.active && u.profile && typeof u.profile.age==='number').map(u=>u.profile.age);
  add('users.json', 'In users.json, compute the average of profile.age over users in data.users that are active (active is true) and have a numeric profile.age (ignore users with missing profile, missing age or null age). Round to 1 decimal place. Return a single number.',
  Math.round(a.reduce((x,y)=>x+y,0)/a.length*10)/10); }

const tot = o => o.items.reduce((s,i)=>s+i.qty*i.price,0);
add('orders.json', 'In orders.json, for orders whose status equals "paid" (case-insensitive), sum qty * price over all their items. Orders with an empty items list contribute 0. Round the total to 2 decimal places. Return a single number.',
  r2(orders.filter(o=>o.status.toLowerCase()==='paid').reduce((s,o)=>s+tot(o),0)));

{ const m={}; orders.filter(o=>o.status.toLowerCase()!=='cancelled').forEach(o=>m[o.customer]=(m[o.customer]||0)+1);
  add('orders.json', 'In orders.json, ignore orders whose status is "cancelled" (case-insensitive). Count the remaining orders per customer. Return an object whose keys are customer values exactly as given and whose values are the order counts.', m); }

{ const m={}; orders.filter(o=>o.status.toLowerCase()!=='cancelled').forEach(o=>m[o.customer]=(m[o.customer]||0)+tot(o));
  const arr = Object.entries(m).map(([customer,t])=>({customer,total:r2(t)})).sort((a,b)=>b.total-a.total||a.customer.localeCompare(b.customer)).slice(0,2);
  add('orders.json', 'In orders.json, ignore orders whose status is "cancelled" (case-insensitive). For each customer sum qty * price over all items of their remaining orders, rounded to 2 decimal places. Return the top 2 customers as an array of objects {"customer": string, "total": number}, sorted by total descending.', arr); }

{ const all = {...pkg.dependencies, ...pkg.devDependencies};
  add('package.json', 'In package.json, consider both "dependencies" and "devDependencies" together. Return the names of the packages whose version string starts with "^", as an array of strings sorted alphabetically (ascending).',
  Object.keys(all).filter(k=>all[k].startsWith('^')).sort()); }

{ const seen=[]; 'Red, green ,BLUE,green, red ,yellow, Blue'.split(',').map(s=>s.trim().toLowerCase()).forEach(s=>{if(!seen.includes(s))seen.push(s)});
  add(null, 'Given the string "Red, green ,BLUE,green, red ,yellow, Blue": split it on commas, trim whitespace from each part, lowercase each part, remove duplicates keeping the first occurrence order, and join the result with "|". Return a single string.', seen.join('|')); }

{ const m={}; issues.filter(i=>i.state==='open').forEach(i=>{const k=i.assignee?i.assignee.login:'unassigned'; m[k]=(m[k]||0)+1});
  add('issues.json', 'In issues.json, consider only issues with state "open". Count them by assignee.login; issues whose assignee is null go under the key "unassigned". Return an object mapping each key to its count.', m); }

add('issues.json', 'In issues.json, consider only issues with state "open". Return the titles of the 3 issues with the most comments, as an array of strings ordered by comments descending.',
  issues.filter(i=>i.state==='open').sort((a,b)=>b.comments-a.comments).slice(0,3).map(i=>i.title));

add('issues.json', 'In issues.json, return true if every open issue that has the label "bug" (case-insensitive match against the strings in labels) has a non-null assignee, otherwise false. Return a single boolean.',
  issues.filter(i=>i.state==='open'&&i.labels.some(l=>l.toLowerCase()==='bug')).every(i=>i.assignee!=null));

{ const s=config.services;
  add('config.json', 'In config.json, look at the entries of "services". A service is enabled unless its "enabled" field is exactly false (a missing or null "enabled" counts as enabled). Skip services that have no "port". Return an array of strings of the form "name:port" for the enabled services, sorted by port ascending.',
  Object.entries(s).filter(([k,v])=>v.enabled!==false && v.port!=null).sort((a,b)=>a[1].port-b[1].port).map(([k,v])=>k+':'+v.port)); }

{ const lines = log.trim().split('\n').map(l=>{const [ts,method,path,status,ms]=l.split(' ');return {method,path,status:+status,ms:parseInt(ms)}});
  const m={}; lines.forEach(l=>m[l.path]=(m[l.path]||0)+1);
  const arr=Object.entries(m).map(([path,count])=>({path,count})).sort((a,b)=>b.count-a.count||a.path.localeCompare(b.path)).slice(0,2);
  add('access.log', 'access.log has one request per line: timestamp, method, path, status, duration (e.g. "120ms"), separated by single spaces. Count requests per path (all methods and statuses). Return the top 2 paths as an array of objects {"path": string, "count": number}, sorted by count descending, ties broken by path ascending.', arr); }

{ const rows = csv.trim().split('\n').slice(1).map(l=>l.split(','));
  const m={}; rows.forEach(([reg,prod,u,p])=>{ if(u.trim()===''||p.trim()==='') return; const n=+u; if(n<=0) return; const k=reg.trim().toLowerCase(); m[k]=(m[k]||0)+n*+p;});
  Object.keys(m).forEach(k=>m[k]=r2(m[k]));
  add('sales.csv', 'sales.csv is comma-separated text with a header row (region,product,units,price). Skip rows where units or price is empty or units is 0. For the remaining rows, trim the region and lowercase it, and sum units * price per region. Return an object mapping region to its total rounded to 2 decimal places.', m); }

w('tasks.json', T);
console.log(JSON.stringify(T.map(t=>[t.id,t.expected])));

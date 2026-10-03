const fs=require('fs');
const w=(f,d)=>fs.writeFileSync(f,typeof d==='string'?d:JSON.stringify(d,null,2));
const users=[
{id:1,name:"Anna",email:"anna@x.io",active:true,address:{city:"Berlin",zip:"10115"},tags:["Admin","dev"]},
{id:2,name:"Boris",email:"boris@x.io",active:true,address:{city:"berlin"},tags:["dev","ops"]},
{id:3,name:"Clara",email:"clara@x.io",active:false,address:{city:"BERLIN"},tags:[]},
{id:4,name:"Dmitri",email:"dmitri@x.io",active:true,address:null,tags:["OPS"]},
{id:5,name:"Elena",email:"elena@x.io",active:true,tags:["QA","dev"]},
{id:6,name:"Farid",email:"farid@x.io",active:true,address:{city:"Paris",zip:null},tags:null},
{id:7,name:"Gina",email:"gina@x.io",active:true,address:{city:" Berlin"},tags:["admin"]},
{id:8,name:"Hugo",email:"hugo@x.io",active:true,address:{city:"Berlin"},tags:["qa"]}];
w('users.json',users);
const orders=[
{id:"o1",customer:{name:"Anna",email:"anna@x.io"},status:"paid",items:[{sku:"A",price:10.5,qty:2},{sku:"B",price:3.25,qty:4}],total:34,shipped_at:"2026-01-03"},
{id:"o2",customer:{name:"Boris",email:null},status:"pending",items:[{sku:"A",price:10.5,qty:1}],total:10.5,shipped_at:null},
{id:"o3",customer:{name:"Clara",email:"clara@x.io"},status:"paid",items:[{sku:"C",price:99.99,qty:1},{sku:"B",price:3.25,qty:1}],total:103.24,shipped_at:"2026-01-05"},
{id:"o4",customer:null,status:"paid",items:[],total:0,shipped_at:null},
{id:"o5",customer:{name:"Dmitri",email:"d@x.io"},status:"cancelled",items:[{sku:"D",price:150,qty:1}],total:150,shipped_at:null},
{id:"o6",customer:{name:"Elena",email:"e@x.io"},status:"paid",items:[{sku:"E",price:19.99,qty:3}],total:59.97,shipped_at:null},
{id:"o7",customer:{name:"Farid",email:"f@x.io"},status:"Paid",items:[{sku:"A",price:10.5,qty:10}],total:105,shipped_at:"2026-02-01"}];
w('orders.json',orders);
const issues=[
{id:101,title:"Crash on start",state:"open",assignee:"anna",labels:["bug","p1"],comments:7},
{id:102,title:"Add dark mode",state:"open",assignee:null,labels:["feature"],comments:3},
{id:103,title:"Typo in docs",state:"closed",assignee:"boris",labels:["docs"],comments:1},
{id:104,title:"Slow query",state:"open",assignee:"boris",labels:["bug","perf"],comments:7},
{id:105,title:"Upgrade deps",state:"open",assignee:"anna",labels:[],comments:0},
{id:106,title:"Memory leak",state:"closed",assignee:"anna",labels:["bug"],comments:12},
{id:107,title:"Support SSO",state:"open",assignee:"clara",labels:["feature","p1"],comments:5},
{id:108,title:"Flaky test",state:"open",assignee:null,labels:["bug"]}];
w('issues.json',issues);
const pkg={name:"demo",version:"1.2.0",dependencies:{express:"^4.18.2",lodash:"~4.17.21",axios:"^1.6.0",chalk:"5.3.0"},devDependencies:{jest:"^29.7.0",eslint:"^8.56.0",typescript:"~5.3.3"},scripts:{test:"jest"}};
w('package.json',pkg);
const config={env:"prod",services:[
{name:"api",enabled:true,net:{port:8080}},
{name:"db",enabled:true,net:{port:5432}},
{name:"cache",enabled:false,net:{port:6379}},
{name:"web",enabled:true,net:{}},
{name:"queue",enabled:true},
{name:"mail",enabled:true,net:{port:25}}]};
w('config.json',config);
const ev=[];
const evs=[["zed","login"],["amy","login"],["zed","click"],["bob","click"],["amy","click"],["bob","login"],["zed","logout"],["cat","login"],["amy","logout"],["bob","click"],["cat","click"],["zed","click"]];
evs.forEach((e,i)=>ev.push({seq:i+1,user:e[0],type:e[1]}));
w('events.json',ev);
const logs=[
{endpoint:"/users",status:200,latency_ms:120},
{endpoint:"/users",status:200,latency_ms:80},
{endpoint:"/orders",status:500,latency_ms:900},
{endpoint:"/orders",status:200,latency_ms:null},
{endpoint:"/orders",status:200,latency_ms:301},
{endpoint:"/health",status:200,latency_ms:5},
{endpoint:"/users",status:404,latency_ms:40},
{endpoint:"/login",status:401},
{endpoint:"/login",status:200,latency_ms:61}];
w('logs.json',logs);
w('access.log',`2026-03-01T10:00:01Z GET /api/users 200 45
2026-03-01T10:00:02Z POST /api/orders 500 310
2026-03-01T10:00:05Z GET /api/users 200 52
2026-03-01T10:01:00Z GET /api/items 503 1200
2026-03-01T10:01:30Z POST /api/orders 502 20
2026-03-01T10:02:00Z GET /api/orders 500 15
2026-03-01T10:02:10Z GET /api/health 200 3
2026-03-01T10:03:00Z DELETE /api/items 404 12
2026-03-01T10:03:20Z POST /api/orders 500 99
`);
w('employees.csv',`name,dept,salary,city
Ann,Eng,5000,Oslo
Bob,Eng,6001,Rome
Cy,Ops,4000,Oslo
Di,Ops,,Rome
Ed,Eng,5500,Oslo
Flo,HR,3900,Rome
Gus,Ops,4500,Oslo
Hal,HR,4100,Oslo
`);
w('app.env',`# database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=my=app

APP_DEBUG=true
  # indented comment
DB_USER=admin
db_ignored=1
CACHE_URL=redis://x
`);
const T=[];const add=(input,text,expected)=>T.push({id:"Q"+(T.length+1),input,text,expected});
// Q1
add('users.json','users.json is an array of users. Return the emails of users with active equal to true whose address.city equals "berlin" when compared case-insensitively (no trimming of whitespace). Users with a missing or null address do not match. Return an array of strings sorted ascending (plain string comparison).',
 users.filter(u=>u.active===true&&u.address&&typeof u.address.city==='string'&&u.address.city.toLowerCase()==='berlin').map(u=>u.email).sort());
// Q2
add('orders.json','orders.json is an array of orders, each with an items array of {sku, price, qty}. Consider only orders whose status is exactly "paid" (case-sensitive). Return the sum of price*qty over all items of those orders, rounded to 2 decimal places, as a number.',
 +orders.filter(o=>o.status==='paid').flatMap(o=>o.items).reduce((s,i)=>s+i.price*i.qty,0).toFixed(2));
// Q3
{const r={};issues.filter(i=>i.state==='open').forEach(i=>{const k=i.assignee??"unassigned";r[k]=(r[k]||0)+1});
add('issues.json','issues.json is an array of issues. Count issues whose state is "open" per assignee; a null assignee is counted under the key "unassigned". Return an object mapping assignee to count.',r);}
// Q4
add('package.json','package.json is an npm manifest. Take the package names from both dependencies and devDependencies whose version string starts with "^". Return an array of those names sorted ascending.',
 Object.entries({...pkg.dependencies,...pkg.devDependencies}).filter(([k,v])=>v.startsWith('^')).map(e=>e[0]).sort());
// Q5
{const rows=fs.readFileSync('access.log','utf8').trim().split('\n').map(l=>l.split(' '));
add('access.log','access.log has one request per line: "<timestamp> <METHOD> <path> <status> <duration_ms>" separated by single spaces. Return the distinct paths that had at least one response with status >= 500, as an array of strings sorted ascending.',
 [...new Set(rows.filter(r=>+r[3]>=500).map(r=>r[2]))].sort());}
// Q6
{const rows=fs.readFileSync('employees.csv','utf8').trim().split('\n').slice(1).map(l=>l.split(','));
const g={};rows.forEach(r=>{if(r[2]==='')return;(g[r[1]]=g[r[1]]||[]).push(+r[2])});
const o={};Object.keys(g).sort().forEach(k=>o[k]=+(g[k].reduce((a,b)=>a+b,0)/g[k].length).toFixed(1));
add('employees.csv','employees.csv is CSV text with a header line (name,dept,salary,city). Compute the average salary per dept, ignoring rows whose salary is empty. Round each average to 1 decimal place. Return an object mapping dept to the average (number).',o);}
// Q7
{const l=["Apple","banana","apple","Cherry","BANANA","date","Date ","cherry"];
add(null,'Given the list ["Apple","banana","apple","Cherry","BANANA","date","Date ","cherry"], count the distinct values when compared case-insensitively, without trimming whitespace (so "date" and "Date " are different). Return a number.',new Set(l.map(s=>s.toLowerCase())).size);}
// Q8
add('config.json','config.json has a services array. For each service with enabled equal to true, build the string "<name>:<port>" where port is net.port, or 80 if net or net.port is missing. Return an array of these strings sorted by port descending, ties broken by name ascending.',
 config.services.filter(s=>s.enabled===true).map(s=>({n:s.name,p:s.net?.port??80})).sort((a,b)=>b.p-a.p||(a.n<b.n?-1:1)).map(x=>x.n+':'+x.p));
// Q9
{const c={};ev.forEach(e=>c[e.user]=(c[e.user]||0)+1);
add('events.json','events.json is an array of events with a user field. Count events per user and return the top 3 users as an array of objects {"user": string, "count": number}, sorted by count descending, ties broken by user ascending.',
 Object.entries(c).map(([user,count])=>({user,count})).sort((a,b)=>b.count-a.count||(a.user<b.user?-1:1)).slice(0,3));}
// Q10
add('issues.json','Return the titles of the 3 issues with the highest comments value (a missing comments field counts as 0), regardless of state. Sort by comments descending, ties broken by id ascending. Return an array of title strings.',
 [...issues].sort((a,b)=>(b.comments??0)-(a.comments??0)||a.id-b.id).slice(0,3).map(i=>i.title));
// Q11
{const o={};fs.readFileSync('app.env','utf8').split('\n').forEach(l=>{const t=l.trim();if(!t||t.startsWith('#'))return;const i=t.indexOf('=');const k=t.slice(0,i),v=t.slice(i+1);if(k.startsWith('DB_'))o[k.slice(3).toLowerCase()]=v});
add('app.env','app.env is a dotenv-style text file: KEY=VALUE per line; blank lines and lines whose first non-space character is "#" are ignored; split each line at the first "=" only. Keep only keys that start with the exact, case-sensitive prefix "DB_". Return an object whose keys are the remaining key part lowercased (prefix removed) and whose values are the value strings.',o);}
// Q12
add('orders.json','Consider orders whose total is greater than 100 (any status). Return true if every one of them has a non-null shipped_at, otherwise false. Return a boolean.',
 orders.filter(o=>o.total>100).every(o=>o.shipped_at!=null));
// Q13
add('users.json','Collect all tags of all users (a null or missing tags field counts as no tags), lowercase them, and return the distinct values as an array of strings sorted ascending.',
 [...new Set(users.flatMap(u=>u.tags||[]).map(t=>t.toLowerCase()))].sort());
// Q14
{const g={};logs.forEach(l=>(g[l.endpoint]=g[l.endpoint]||[]).push(l));
const r=Object.keys(g).sort().filter(k=>g[k].length>=2).map(k=>{const v=g[k].map(x=>x.latency_ms).filter(x=>x!=null);return{endpoint:k,count:g[k].length,avgMs:Math.round(v.reduce((a,b)=>a+b,0)/v.length)}});
add('logs.json','logs.json is an array of API call records. Group by endpoint. For endpoints with at least 2 records, return an object {"endpoint": string, "count": number of all records, "avgMs": average of latency_ms over records where it is present and non-null, rounded to the nearest integer}. Return an array of these objects sorted by endpoint ascending.',r);}
w('tasks.json',T);
console.log(T.map(t=>t.id+' '+JSON.stringify(t.expected)).join('\n'));

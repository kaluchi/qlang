const fs=require('fs');
const w=(f,d)=>fs.writeFileSync(f,typeof d==='string'?d:JSON.stringify(d,null,2));
const orders=[
{id:"o1",customer:"alice",status:"paid",total:120.5,items:[{sku:"A",qty:2},{sku:"B",qty:1}]},
{id:"o2",customer:"bob",status:"paid",total:80,items:[{sku:"A",qty:5}]},
{id:"o3",customer:"alice",status:"refunded",total:60,items:[{sku:"C",qty:1}]},
{id:"o4",customer:"carol",status:"paid",total:null,items:[{sku:"B",qty:3},{sku:"C",qty:2}]},
{id:"o5",customer:"bob",status:"paid",total:45.25},
{id:"o6",customer:"alice",status:"paid",total:30,items:[]},
{id:"o7",customer:"dave",status:"pending",total:99,items:[{sku:"A",qty:1}]},
{id:"o8",customer:"carol",status:"paid",total:210,items:[{sku:"D",qty:4},{sku:"A",qty:1}]}];
w('orders.json',orders);
const lv=["INFO","WARN","ERROR","INFO","DEBUG","ERROR","INFO","WARN","ERROR","INFO"];
const sv=["api","db","api","auth","api","db","auth","api","db","auth"];
const logs=lv.map((l,i)=>`2026-03-01T10:0${i}:00Z ${l} ${sv[i]} message number ${i}`).join('\n')+'\n';
w('app.log',logs);
const pkg={name:"demo",version:"1.2.0",dependencies:{express:"^4.18.2",lodash:"~4.17.21",zod:"^3.22.0",chalk:"5.3.0"},devDependencies:{jest:"^29.7.0",eslint:"^8.50.0",typescript:"~5.2.2",nodemon:"^3.0.1"}};
w('package.json',pkg);
const issues=[
{id:12,title:"Crash on start",state:"open",comments:7,labels:["bug","P1"]},
{id:7,title:"Docs typo",state:"closed",comments:20,labels:["docs"]},
{id:19,title:"Slow query",state:"open",comments:7,labels:["perf","bug"]},
{id:3,title:"Add dark mode",state:"open",comments:12,labels:["feature"]},
{id:25,title:"Flaky test",state:"open",comments:2,labels:[]},
{id:31,title:"Memory leak",state:"open",comments:12,labels:["bug","perf"]},
{id:8,title:"Old idea",state:"closed",comments:9,labels:["feature"]},
{id:40,title:"No comment count",state:"open",labels:["bug"]}];
w('issues.json',issues);
const csv=`name,age,country
Anna,34,DE
Ben,,de
Chen,28,CN
Dirk,41,De
Eva,23,FR
Fritz,29,DE
Gao,52,cn
`;
w('users.csv',csv);
const cfg={services:{web:{port:8080,enabled:true,opts:{tls:true}},api:{port:3000,enabled:true},worker:{enabled:true},cron:{port:9000,enabled:false},db:{port:5432,enabled:true,opts:null}}};
w('config.json',cfg);
const api={status:"ok",results:[
{user:{name:{first:"Ada",last:"Lovelace"}},email:"ada@Example.com"},
{user:{name:{first:"Alan",last:"Turing"}},email:"alan@other.org"},
{user:{name:{first:"Grace",last:"Hopper"}},email:"grace@EXAMPLE.COM"},
{user:{name:{first:"Linus",last:null}},email:"linus@example.com"},
{user:{name:{first:"Ken",last:"Thompson"}},email:null},
{user:{name:{first:"Dennis",last:"Ritchie"}}},
{user:{name:{first:"Barbara",last:"Liskov"}},email:"b@example.com"}]};
w('people.json',api);
const events=[
{user:"u1",action:"login",ts:1},{user:"u2",action:"login",ts:2},{user:"u1",action:"login",ts:3},
{user:"u3",action:"logout",ts:4},{user:"U2",action:"Login",ts:5},{user:"u4",action:"purchase",ts:6},
{user:null,action:"login",ts:7},{user:"u5",action:"login",ts:8},{user:"u3",action:"LOGIN",ts:9}];
w('events.json',events);
const emp=[
{name:"A",dept:"eng",salary:100},{name:"B",dept:"eng",salary:130},{name:"C",dept:"ops",salary:70},
{name:"D",dept:"ops",salary:null},{name:"E",dept:"eng"},{name:"F",dept:"hr",salary:65.5},
{name:"G",dept:"ops",salary:75},{name:"H",dept:"hr",salary:60},{name:"I",dept:"eng",salary:111}];
w('employees.json',emp);
const posts=[
{id:1,tags:"js, Node,api"},{id:2,tags:"node,db"},{id:3,tags:"API, js"},{id:4,tags:null},
{id:5,tags:"db,node, API"},{id:6,tags:""},{id:7,tags:"rust,js"}];
w('posts.json',posts);
const inv=`# sku|qty|price
widget|10|2.50
gadget|3|19.99

# discontinued
gizmo|0|99.00
doohickey|7|1.25
thing|12|0.80
`;
w('inventory.txt',inv);
const rel={services:[
{name:"web",env:"prod",replicas:3},{name:"api",env:"prod",replicas:2},{name:"batch",env:"prod"},
{name:"web-stg",env:"stage",replicas:1},{name:"db",env:"PROD",replicas:2}]};
w('release.json',rel);

const T=[],add=(input,text,expected)=>T.push({id:'K'+(T.length+1),input,text,expected});
const words=["Apple","banana","APPLE","Cherry","banana","date","Date","elderberry"];
add(null,`Given the list of words ${JSON.stringify(words)}, compare words case-insensitively and return the number of distinct words (a number).`,new Set(words.map(x=>x.toLowerCase())).size);
{const o={};orders.filter(x=>x.status==='paid').forEach(x=>o[x.customer]=(o[x.customer]||0)+(x.total??0));
add('orders.json','Input is an array of orders. Consider only orders whose status is "paid". For each customer, sum the "total" values of those orders (null or missing total counts as 0). Return an object mapping customer name to the sum (a number). Customers with no paid orders are omitted.',o);}
{const o={};logs.trim().split('\n').forEach(l=>{const k=l.split(' ')[1];o[k]=(o[k]||0)+1});
add('app.log','Each line of the text file is "<timestamp> <LEVEL> <service> <message...>" separated by single spaces. Count the lines per LEVEL (the second field). Return an object mapping level to count.',o);}
add('package.json','Take the union of the keys of "dependencies" and "devDependencies". Keep those whose version string starts with "^". Return an array of the package names sorted alphabetically (ascending, plain string comparison).',[...Object.entries({...pkg.dependencies,...pkg.devDependencies})].filter(([k,v])=>v.startsWith('^')).map(x=>x[0]).sort());
add('issues.json','Input is an array of issues. Keep issues with state "open". Sort by "comments" descending (missing comments counts as 0), ties broken by "id" ascending. Return an array of the "id" numbers of the first 3.',issues.filter(i=>i.state==='open').sort((a,b)=>(b.comments??0)-(a.comments??0)||a.id-b.id).slice(0,3).map(i=>i.id));
{const r=csv.trim().split('\n').slice(1).map(l=>l.split(',')).filter(c=>c[2].toLowerCase()==='de'&&c[1]!=='');const a=r.reduce((s,c)=>s+ +c[1],0)/r.length;
add('users.csv','The text file is CSV with a header line (name,age,country). Select rows whose country equals "de" case-insensitively and whose age is not empty. Return the average age of these rows rounded to 1 decimal place (a number).',Math.round(a*10)/10);}
add('config.json','"services" is an object keyed by service name. Keep services with enabled === true that have a numeric "port". Sort them by port ascending. Return an array of strings of the form "<name>:<port>".',Object.entries(cfg.services).filter(([k,v])=>v.enabled===true&&typeof v.port==='number').sort((a,b)=>a[1].port-b[1].port).map(([k,v])=>`${k}:${v.port}`));
add('people.json','Input has a "results" array. Keep entries that have a non-null email whose domain (the part after "@") equals "example.com" case-insensitively AND a non-null user.name.last. Return an array of strings "<last>, <first>" in the original order.',api.results.filter(r=>r.email&&r.email.split('@')[1].toLowerCase()==='example.com'&&r.user.name.last).map(r=>`${r.user.name.last}, ${r.user.name.first}`));
{const s=new Set(events.filter(e=>e.user&&e.action.toLowerCase()==='login').map(e=>e.user.toLowerCase()));
add('events.json','Input is an array of events. Keep events with a non-null "user" whose action equals "login" case-insensitively. Return the array of distinct user ids, lowercased, sorted ascending alphabetically.',[...s].sort());}
{const g={};emp.filter(e=>e.salary!=null).forEach(e=>(g[e.dept]??=[]).push(e.salary));const o={};for(const k of Object.keys(g).sort())o[k]=Math.round(g[k].reduce((a,b)=>a+b,0)/g[k].length*100)/100;
add('employees.json','Group employees by "dept", ignoring employees whose salary is null or missing. For each department return the average salary rounded to 2 decimals. Return an object mapping dept to that average.',o);}
{const c={};posts.filter(p=>p.tags).forEach(p=>p.tags.split(',').map(t=>t.trim().toLowerCase()).filter(Boolean).forEach(t=>c[t]=(c[t]||0)+1));
add('posts.json','Each post has a "tags" string of comma-separated tags (may be null or empty). Split on commas, trim whitespace, lowercase, drop empty tags. Count occurrences across all posts. Return an array of the 3 most frequent tags (strings), ordered by count descending, ties broken alphabetically ascending.',Object.entries(c).sort((a,b)=>b[1]-a[1]||(a[0]<b[0]?-1:1)).slice(0,3).map(x=>x[0]));}
{let s=0;inv.split('\n').filter(l=>l.trim()&&!l.startsWith('#')).forEach(l=>{const[,q,p]=l.split('|');s+=q*p});
add('inventory.txt','Lines starting with "#" and blank lines are to be ignored. Other lines have the form "sku|qty|price". Return the total stock value, the sum of qty*price over all such lines, rounded to 2 decimals (a number).',Math.round(s*100)/100);}
add('release.json','Input has a "services" array. Consider services whose "env" equals "prod" case-insensitively. A missing "replicas" counts as 1. Return a boolean: true if every such service has at least 2 replicas, otherwise false.',rel.services.filter(s=>s.env.toLowerCase()==='prod').every(s=>(s.replicas??1)>=2));
add('orders.json','Input is an array of orders. For each order compute itemCount = sum of "qty" over its "items" (missing items counts as an empty list). Keep orders with itemCount > 0. Sort by itemCount descending, ties by id ascending (string comparison). Return an array of the first 3 as objects {"id": <order id>, "itemCount": <number>}.',orders.map(o=>({id:o.id,itemCount:(o.items||[]).reduce((a,i)=>a+i.qty,0)})).filter(o=>o.itemCount>0).sort((a,b)=>b.itemCount-a.itemCount||(a.id<b.id?-1:1)).slice(0,3));
w('tasks.json',T);
console.log(T.map(t=>t.id+' '+JSON.stringify(t.expected)).join('\n'));

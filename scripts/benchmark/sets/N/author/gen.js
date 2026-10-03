const fs=require('fs');
const W=(f,v)=>fs.writeFileSync(f,typeof v==='string'?v:JSON.stringify(v,null,2));
const R=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const T=f=>fs.readFileSync(f,'utf8');
const r=(x,d)=>Math.round(x*10**d)/10**d;
const cmp=(a,b)=>a<b?-1:a>b?1:0;

W('users.json',{status:"ok",data:{users:[
{id:1,name:"Ann",email:"ann@Example.com",active:true,age:31},
{id:2,name:"Bob",email:null,active:true,age:25},
{id:3,name:"Cid",email:"cid@mail.org",active:false},
{id:4,name:"Dee",email:"dee@EXAMPLE.com",active:true},
{id:5,name:"Eve",email:"eve@zeta.io",active:true,age:40},
{id:6,name:"Fay",active:true,age:22},
{id:7,name:"Gus",email:"gus@mail.org",active:true,age:35},
{id:8,name:"Hal",email:"hal@alpha.net",active:false,age:29},
{id:9,name:"Ivy",email:"ivy@Mail.org",active:true,age:null}]},meta:{page:1}});

W('orders.json',[
{id:"o1",customer:{name:"Acme"},status:"paid",discount:null,lines:[{sku:"a",qty:2,unit_price:10.5},{sku:"b",qty:1,unit_price:99.99}]},
{id:"o2",customer:{name:"Globex"},status:"PAID",discount:5,lines:[{sku:"a",qty:10,unit_price:10.5}]},
{id:"o3",customer:{name:"Acme"},status:"refunded",lines:[{sku:"c",qty:1,unit_price:500}]},
{id:"o4",customer:{name:"Initech"},status:"Paid",discount:0,lines:[{sku:"b",qty:3,unit_price:99.99}]},
{id:"o5",customer:{name:"Globex"},status:"pending",lines:[{sku:"a",qty:1,unit_price:10.5}]},
{id:"o6",customer:{name:"Acme"},status:"paid",discount:2.5,lines:[{sku:"d",qty:4,unit_price:7.25}]},
{id:"o7",customer:{name:"Umbrella"},status:"paid",lines:[]},
{id:"o8",customer:{name:"Initech"},status:"paid",discount:10,lines:[{sku:"d",qty:2,unit_price:7.25},{sku:"a",qty:1,unit_price:10.5}]}]);

W('issues.json',[
{number:101,title:"Crash on start",state:"open",assignee:{login:"mia"},labels:["bug","p1"]},
{number:102,title:"Docs typo",state:"closed",assignee:{login:"leo"},labels:["docs"]},
{number:103,title:"Add dark mode",state:"open",assignee:null,labels:["feature"]},
{number:104,title:"Slow query",state:"open",assignee:{login:"mia"},labels:["bug","perf"]},
{number:105,title:"Update deps",state:"open",labels:[]},
{number:106,title:"Memory leak",state:"open",assignee:{login:"leo"},labels:["Bug"]},
{number:107,title:"Flaky test",state:"closed",assignee:null,labels:["bug"]},
{number:108,title:"Export CSV",state:"open",assignee:{login:"leo"},labels:["feature","p2"]}]);

W('package.json',{name:"demo-app",version:"2.3.1",scripts:{build:"tsc",test:"jest"},
dependencies:{express:"^4.18.2",lodash:"~4.17.21",axios:"^1.6.0",chalk:"5.3.0"},
devDependencies:{jest:"^29.7.0",typescript:"^5.3.3",eslint:"~8.56.0",prettier:"^3.1.0"}});

W('config.json',{env:"prod",services:{
api:{enabled:true,port:8080,replicas:3},
web:{enabled:true,port:80,replicas:2},
worker:{enabled:true,replicas:5},
cron:{enabled:false,port:9000},
cache:{enabled:true,port:6379,replicas:null},
admin:{enabled:true,port:8080,replicas:1},
legacy:{port:7000}}});

W('app.log',`2026-03-01T10:00:01Z INFO [api] started
2026-03-01T10:00:05Z ERROR [db] connection refused
2026-03-01T10:00:07Z WARN [api] slow response 1200ms
2026-03-01T10:01:10Z ERROR [api] timeout calling db
2026-03-01T10:01:12Z ERROR [db] connection refused
2026-03-01T10:02:00Z INFO [worker] job 17 done
2026-03-01T10:02:30Z ERROR [worker] job 18 failed
2026-03-01T10:03:00Z ERROR [db] disk full
2026-03-01T10:03:44Z ERROR [api] bad gateway
2026-03-01T10:04:00Z DEBUG [api] cache hit
2026-03-01T10:04:20Z ERROR [auth] invalid token
2026-03-01T10:05:00Z INFO [db] recovered
`);

W('sales.csv',`region,product,qty,price
North,widget,10,2.50
south,widget,5,2.50
NORTH,gadget,2,19.99
East,widget,,2.50
south,gadget,3,19.99
East,gizmo,4,7.25
north,gizmo,1,
West,widget,6,2.50
East,gadget,1,19.99
`);

W('events.json',[
{user:"u1",type:"login",ts:1},{user:"u2",type:"login",ts:2},{user:"u1",type:"view",ts:3},
{user:"u3",type:"login",ts:4},{user:"u2",type:"LOGOUT",ts:5},{user:"u4",type:"view",ts:6},
{user:"u3",type:"view",ts:7},{user:"u5",type:"Login",ts:8},{user:"u5",type:"logout",ts:9},
{user:"u1",type:"login",ts:10},{user:"u6",type:"login",ts:11}]);

W('employees.json',[
{name:"Ana",dept:"Eng",salary:120000},{name:"Ben",dept:"Eng",salary:100000},
{name:"Cal",dept:"Eng",salary:null},{name:"Dot",dept:"Ops",salary:70000},
{name:"Eli",dept:"Ops",salary:65000},{name:"Fox",dept:"Sales",salary:90000},
{name:"Gia",dept:"Sales"},{name:"Hub",dept:"Sales",salary:81000},
{name:"Ira",dept:"Ops",salary:72500},{name:"Jon",dept:"Eng",salary:110000}]);

W('articles.txt',`Intro to Rust: Systems, rust , Beginner
Web basics: HTML, css,Beginner
Async patterns: rust, Async,systems
Styling tips: CSS, Design

Advanced SQL: sql, Databases, advanced
Indexes: SQL, databases
`);

W('releases.json',{releases:[
{tag_name:"v1.0.0",draft:false,prerelease:false,assets:[{name:"a.zip",download_count:120},{name:"b.zip",download_count:30}]},
{tag_name:"v1.1.0-rc1",draft:false,prerelease:true,assets:[{name:"a.zip",download_count:500}]},
{tag_name:"v1.1.0",draft:false,prerelease:false,assets:[{name:"a.zip",download_count:200},{name:"b.zip",download_count:null},{name:"c.zip",download_count:90}]},
{tag_name:"v1.2.0",draft:true,prerelease:false,assets:[{name:"a.zip",download_count:9}]},
{tag_name:"v1.3.0",draft:false,prerelease:false,assets:[]},
{tag_name:"v2.0.0",draft:false,prerelease:false,assets:[{name:"a.zip",download_count:410}]},
{tag_name:"v0.9.0",draft:false,prerelease:false,assets:[{name:"a.zip",download_count:75}]}]});

W('products.json',[
{sku:"T1",name:"Hammer",category:"Tools",price:12.5,stock:4},
{sku:"T2",name:"Saw",category:"tools",price:18,stock:0},
{sku:"G1",name:"Seeds",category:"Garden",price:null,stock:50},
{sku:"T3",name:"Drill",category:"TOOLS",price:89.9,stock:2},
{sku:"K1",name:"Pan",category:"Kitchen",stock:7}]);

W('requirements.txt',`# base deps
Flask==2.3.2
requests>=2.28

numpy==1.26.0   # pinned
Django==4.2.7
-r dev.txt
PyYAML==6.0.1
pytest>=7.0
`);

const tasks=[];
const add=(input,text,expected)=>tasks.push({id:"N"+(tasks.length+1),input,text,expected});

// N1
add('users.json',"The file has data.users (array). Keep users whose active is true and whose email is a non-null string (missing email counts as null). Take the part of each email after the '@' and lowercase it. Return the distinct domains as an array of strings sorted ascending (plain string order).",
[...new Set(R('users.json').data.users.filter(u=>u.active===true&&typeof u.email==='string').map(u=>u.email.split('@')[1].toLowerCase()))].sort(cmp));

// N2
{const t={};for(const o of R('orders.json')){if(o.status.toLowerCase()!=='paid')continue;
const s=o.lines.reduce((a,l)=>a+l.qty*l.unit_price,0)-(o.discount??0);t[o.customer.name]=(t[o.customer.name]||0)+s;}
const arr=Object.entries(t).map(([customer,v])=>({customer,total:r(v,2)})).sort((a,b)=>b.total-a.total).slice(0,2);
add('orders.json',"Array of orders. Consider only orders whose status equals 'paid' ignoring case. An order's amount is the sum of qty*unit_price over its lines, minus its discount (a flat amount; null or missing means 0). Sum the amounts per customer.name. Return the top 2 customers by total, highest first, as an array of objects {\"customer\": string, \"total\": number} with total rounded to 2 decimals.",arr);}

// N3
{const o={};for(const i of R('issues.json')){if(i.state!=='open')continue;const k=i.assignee?.login??'unassigned';o[k]=(o[k]||0)+1;}
add('issues.json',"Array of issues. Keep issues whose state is 'open'. Count them by assignee.login; issues with a null or missing assignee are counted under the key \"unassigned\". Return an object mapping assignee name to count.",o);}

// N4
{const p=R('package.json');const all={...(p.dependencies||{}),...(p.devDependencies||{})};
add('package.json',"A package manifest. Combine dependencies and devDependencies (a section may be missing). Keep packages whose version string starts with '^'. Return their names as an array of strings sorted ascending.",Object.keys(all).filter(k=>all[k].startsWith('^')).sort(cmp));}

// N5
{const s=Object.values(R('config.json').services);const en=s.filter(x=>x.enabled===true);
add('config.json',"The file has services (object of name -> settings). A service is enabled only if its enabled field is exactly true (missing means not enabled). Return an object {\"enabledCount\": number of enabled services, \"ports\": distinct port numbers of enabled services that have a port, sorted ascending numerically, \"totalReplicas\": sum of replicas over enabled services, treating missing or null replicas as 1}.",
{enabledCount:en.length,ports:[...new Set(en.filter(x=>x.port!=null).map(x=>x.port))].sort((a,b)=>a-b),totalReplicas:en.reduce((a,x)=>a+(x.replicas??1),0)});}

// N6
{const c={};for(const l of T('app.log').split('\n')){const m=l.match(/^\S+ (\w+) \[(\w+)\]/);if(m&&m[1]==='ERROR')c[m[2]]=(c[m[2]]||0)+1;}
add('app.log',"Plain-text log, one entry per line, format: '<timestamp> <LEVEL> [<service>] <message>'. Count the entries with level ERROR per service. Return the top 2 services as an array of objects {\"service\": string, \"count\": number}, sorted by count descending, ties broken by service name ascending.",
Object.entries(c).map(([service,count])=>({service,count})).sort((a,b)=>b.count-a.count||cmp(a.service,b.service)).slice(0,2));}

// N7
{const rows=T('sales.csv').trim().split('\n').slice(1).map(l=>l.split(','));const o={};
for(const [reg,,q,p] of rows){if(q===''||p==='')continue;const k=reg.toLowerCase();o[k]=(o[k]||0)+Number(q)*Number(p);}
for(const k in o)o[k]=r(o[k],2);
add('sales.csv',"CSV text with header 'region,product,qty,price'. Skip rows where qty or price is empty. Revenue of a row is qty*price. Group by region compared case-insensitively, using the lowercase region as the key. Return an object region -> total revenue rounded to 2 decimals.",o);}

// N8
{const ev=R('events.json');const lo=new Set(),out=new Set();for(const e of ev){const t=e.type.toLowerCase();if(t==='login')lo.add(e.user);if(t==='logout')out.add(e.user);}
add('events.json',"Array of events {user,type,ts}. Event types are compared case-insensitively. Return the distinct users who have at least one 'login' event but no 'logout' event, as an array of strings sorted ascending.",[...lo].filter(u=>!out.has(u)).sort(cmp));}

// N9
{const g={};for(const e of R('employees.json')){if(e.salary==null)continue;(g[e.dept]??=[]).push(e.salary);}
const o={};for(const k of Object.keys(g).sort(cmp))o[k]=r(g[k].reduce((a,b)=>a+b,0)/g[k].length,1);
add('employees.json',"Array of employees {name,dept,salary}. Ignore employees whose salary is null or missing. Return an object mapping each department to the average salary of its remaining employees, rounded to 1 decimal.",o);}

// N10
{const s=new Set();for(const l of T('articles.txt').split('\n')){if(!l.trim())continue;l.slice(l.indexOf(':')+1).split(',').map(x=>x.trim().toLowerCase()).filter(Boolean).forEach(x=>s.add(x));}
add('articles.txt',"Plain text, one article per line, format '<title>: <tag>, <tag>, ...' (tags may have stray spaces and mixed case; blank lines should be ignored). Return the distinct tags, trimmed and lowercased, as an array of strings sorted ascending.",[...s].sort(cmp));}

// N11
{const w=["Apple","banana","apple","Cherry","BANANA","apple","date"];const c={};w.forEach(x=>{const k=x.toLowerCase();c[k]=(c[k]||0)+1;});
add(null,"Given the word list [\"Apple\",\"banana\",\"apple\",\"Cherry\",\"BANANA\",\"apple\",\"date\"], count occurrences case-insensitively. Return an array of the words that occur more than once, lowercased, as objects {\"word\": string, \"count\": number}, sorted by count descending, ties by word ascending.",
Object.entries(c).filter(([,n])=>n>1).map(([word,count])=>({word,count})).sort((a,b)=>b.count-a.count||cmp(a.word,b.word)));}

// N12
{const arr=R('releases.json').releases.filter(x=>!x.draft&&!x.prerelease).map(x=>({tag:x.tag_name,downloads:x.assets.reduce((a,b)=>a+(b.download_count??0),0)})).sort((a,b)=>b.downloads-a.downloads).slice(0,3);
add('releases.json',"The file has releases (array). Ignore releases that are drafts or prereleases. A release's downloads is the sum of download_count over its assets (null counts as 0, no assets gives 0). Return the top 3 releases by downloads, highest first, as an array of {\"tag\": tag_name, \"downloads\": number}.",arr);}

// N13
{const t=R('products.json').filter(p=>p.category.toLowerCase()==='tools');
add('products.json',"Array of products. Consider products whose category equals 'tools' ignoring case. Return an object {\"count\": number of such products, \"allPriced\": true if every such product has a non-null price greater than 0 (else false), \"inStockNames\": names of such products with stock > 0, sorted ascending}.",
{count:t.length,allPriced:t.every(p=>p.price!=null&&p.price>0),inStockNames:t.filter(p=>p.stock>0).map(p=>p.name).sort(cmp)});}

// N14
{const o={};for(let l of T('requirements.txt').split('\n')){l=l.replace(/#.*/,'').trim();if(!l||l.startsWith('-'))continue;const i=l.indexOf('==');if(i<0)continue;o[l.slice(0,i).trim().toLowerCase()]=l.slice(i+2).trim();}
add('requirements.txt',"Plain-text pip requirements. Ignore blank lines, comment text (from '#' to end of line), option lines starting with '-', and any requirement that is not pinned with '=='. For the pinned ones return an object mapping the package name lowercased to its version string.",o);}

W('tasks.json',tasks);
console.log(tasks.map(t=>t.id+' '+JSON.stringify(t.expected)).join('\n'));

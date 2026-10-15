const fs=require('fs');
const J=(f,o)=>fs.writeFileSync(f,JSON.stringify(o,null,2));
J('users.json',{status:"ok",data:{users:[
{id:1,name:"Anna Weber",email:"anna@x.io",active:true,roles:["admin","dev"],address:{city:"Berlin"}},
{id:2,name:"Boris Klein",email:"boris@x.io",active:true,roles:["dev"],address:{city:"berlin"}},
{id:3,name:"Clara Voss",email:"clara@x.io",active:false,roles:[],address:{city:"Berlin"}},
{id:4,name:"Dmitri Orlov",email:null,active:true,roles:["ops"],address:null},
{id:5,name:"Elena Rossi",email:"elena@x.io",active:true,roles:["dev","ops"],address:{city:"BERLIN"}},
{id:6,name:"Farid Aziz",email:"farid@x.io",active:true,roles:["dev"],address:{}},
{id:7,name:"Greta Lund",active:true,roles:["qa"],address:{city:"Oslo"}},
{id:8,name:"Hugo Baas",email:"hugo@x.io",active:true,roles:["qa"],address:{city:"Berlin"}}]}});
J('orders.json',[
{id:"o1",customer:"acme",status:"paid",items:[{sku:"A",qty:2,price:9.99},{sku:"B",qty:1,price:5}]},
{id:"o2",customer:"globex",status:"cancelled",items:[{sku:"A",qty:10,price:9.99}]},
{id:"o3",customer:"acme",status:"paid",items:[{sku:"C",qty:3,price:2.5}]},
{id:"o4",customer:"initech",status:"pending",items:[{sku:"B",qty:4,price:5}]},
{id:"o5",customer:"globex",status:"paid",items:[{sku:"D",qty:1,price:100},{sku:"A",qty:1,price:9.99}]},
{id:"o6",customer:"acme",status:"pending",items:[]},
{id:"o7",customer:"umbrella",status:"paid",items:[{sku:"C",qty:7,price:2.5}]},
{id:"o8",customer:"initech",status:"paid",items:[{sku:"E",qty:2,price:19.95}]}]);
J('package.json',{name:"demo-app",version:"1.4.0",dependencies:{express:"^4.18.2",lodash:"~4.17.21",axios:"^1.6.0",chalk:"5.3.0",zod:"^3.22.4"},devDependencies:{jest:"^29.7.0",eslint:"^8.56.0",typescript:"~5.3.3",axios:"^1.6.0"},scripts:{test:"jest"}});
J('issues.json',[
{id:101,title:"Crash on start",state:"open",labels:["bug","P1"],assignee:{login:"maria"}},
{id:102,title:"Add dark mode",state:"open",labels:["Feature","ui"],assignee:null},
{id:103,title:"Typo in docs",state:"closed",labels:["docs"],assignee:{login:"ivan"}},
{id:104,title:"Slow query",state:"open",labels:["BUG","perf"],assignee:{login:"maria"}},
{id:105,title:"Upgrade deps",state:"open",labels:[],assignee:{login:"ivan"}},
{id:106,title:"Flaky test",state:"open",labels:["bug","ci"]},
{id:107,title:"Logo update",state:"closed",labels:["ui","design"],assignee:null},
{id:108,title:"Memory leak",state:"open",labels:["perf","P1"],assignee:{login:"maria"}}]);
fs.writeFileSync('server.log',`2026-03-01T10:00:00Z INFO api GET /users 200 took=120ms
2026-03-01T10:00:02Z ERROR db connection reset took=0ms
2026-03-01T10:00:05Z INFO api GET /orders 200 took=80ms
2026-03-01T10:01:10Z ERROR api GET /orders 500 took=450ms
2026-03-01T10:01:30Z WARN auth token near expiry took=5ms
2026-03-01T10:02:00Z ERROR api POST /users 500 took=300ms
2026-03-01T10:02:20Z INFO auth login ok took=35ms
2026-03-01T10:03:00Z ERROR db deadlock detected took=900ms
2026-03-01T10:03:30Z INFO api GET /health 200 took=10ms
2026-03-01T10:04:00Z ERROR auth bad password took=40ms
2026-03-01T10:04:10Z INFO db vacuum done took=1500ms
`);
fs.writeFileSync('employees.csv',`name,dept,salary,start_date
Alice,eng,5200,2020-01-15
Bob,eng,4800,2021-06-01
Carol,sales,3900,2019-03-20
Dave,sales,,2022-09-12
Erin,eng,5200,2018-11-30
Frank,ops,3500,2023-02-01
Grace,ops,4100,2020-07-07
Heidi,sales,4500,2021-01-25
Ivan,hr,,2022-05-05
`);
fs.writeFileSync('app.conf',`# application config
app.name=Demo
app.debug=true

db.host=localhost
db.port=5432
# db.password=old
db.name=main_db
cache.ttl=60
db.pool.size=10
`);
J('events.json',[
{id:1,type:"click",payload:{user:{id:"u1"},target:"btn"}},
{id:2,type:"view",payload:{user:{id:"u2"}}},
{id:3,type:"click",payload:{user:{id:"u2"},target:"link"}},
{id:4,type:"click",payload:{target:"btn"}},
{id:5,type:"click",payload:{user:{id:"u1"},target:"link"}},
{id:6,type:"click",payload:null},
{id:7,type:"click",payload:{user:{id:null}}},
{id:8,type:"click",payload:{user:{id:"u3"}}},
{id:9,type:"view",payload:{user:{id:"u4"}}}]);
J('products.json',[
{sku:"P1",name:"Pen",price:1.5,stock:100},
{sku:"P2",name:"Notebook",price:4.25,stock:40},
{sku:"P3",name:"Lamp",price:25,stock:0},
{sku:"P4",name:"Chair",price:80,stock:3},
{sku:"P5",name:"Desk",price:150,stock:2},
{sku:"P6",name:"Mug",price:7.9,stock:30},
{sku:"P7",name:"Bag",price:35,stock:null},
{sku:"P8",name:"Cable",price:3.2,stock:55}]);
const r2=x=>Math.round(x*100)/100;
const rd=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const lines=f=>fs.readFileSync(f,'utf8').split('\n').filter(l=>l.trim()!=='');
const T=[];
const add=(input,text,expected)=>T.push({id:'W'+(T.length+1),input,text,expected});
add('users.json',"The file has data.users. Take users with active equal to true whose address.city equals \"berlin\" ignoring case (users with address null or without city do not match). Return an array of their name values sorted ascending alphabetically.",
 rd('users.json').data.users.filter(u=>u.active===true&&u.address&&typeof u.address.city==='string'&&u.address.city.toLowerCase()==='berlin').map(u=>u.name).sort());
add('orders.json',"Each order has items with qty and price. For orders with status exactly \"paid\", sum qty*price over all their items. Return that total as a number rounded to 2 decimal places.",
 r2(rd('orders.json').filter(o=>o.status==='paid').reduce((s,o)=>s+o.items.reduce((a,i)=>a+i.qty*i.price,0),0)));
(()=>{const c={};rd('orders.json').filter(o=>o.status!=='cancelled').forEach(o=>c[o.customer]=(c[o.customer]||0)+1);
add('orders.json',"Ignore orders with status \"cancelled\". Count the remaining orders per customer. Return an object mapping customer to the number of orders.",c);})();
(()=>{const p=rd('package.json');const s=new Set();for(const d of [p.dependencies,p.devDependencies])for(const [k,v] of Object.entries(d||{}))if(v.startsWith('^'))s.add(k);
add('package.json',"Consider both dependencies and devDependencies together. Return the distinct package names whose version string starts with \"^\", as an array sorted ascending alphabetically.",[...s].sort());})();
(()=>{const c={};rd('issues.json').filter(i=>i.state==='open').forEach(i=>{const k=i.assignee?i.assignee.login:'unassigned';c[k]=(c[k]||0)+1});
add('issues.json',"For issues with state \"open\", count issues per assignee login. An issue whose assignee is null or missing is counted under the key \"unassigned\". Return an object mapping key to count.",c);})();
(()=>{const s=new Set();rd('issues.json').filter(i=>i.state==='open').forEach(i=>i.labels.forEach(l=>s.add(l.toLowerCase())));
add('issues.json',"Collect labels of issues with state \"open\", convert each label to lower case, and remove duplicates. Return an array sorted ascending alphabetically.",[...s].sort());})();
(()=>{const c={};lines('server.log').forEach(l=>{const p=l.split(' ');if(p[1]==='ERROR')c[p[2]]=(c[p[2]]||0)+1});
add('server.log',"Each line is: timestamp, level, service, message... The second token is the level and the third token is the service. Count lines with level ERROR per service. Return an object mapping service to count (only services having at least one ERROR).",c);})();
(()=>{const d=lines('server.log').map(l=>l.split(' ')).filter(p=>p[2]==='api').map(p=>+p[p.length-1].match(/took=(\d+)ms/)[1]);
add('server.log',"Lines end with a token took=<N>ms. For lines whose service (third token) is \"api\", at any level, compute the average of N. Return a number rounded to 1 decimal place.",Math.round(d.reduce((a,b)=>a+b,0)/d.length*10)/10);})();
const emp=lines('employees.csv').slice(1).map(l=>{const [name,dept,salary,start]=l.split(',');return {name,dept,salary:salary===''?null:+salary,start}});
(()=>{const g={};emp.filter(e=>e.salary!==null).forEach(e=>(g[e.dept]=g[e.dept]||[]).push(e.salary));
const o={};for(const k in g)o[k]=Math.round(g[k].reduce((a,b)=>a+b,0)/g[k].length);
add('employees.csv',"CSV with a header row (name,dept,salary,start_date). Rows with an empty salary are ignored entirely. Compute the average salary per dept, rounded to the nearest integer. Return an object mapping dept to that integer (depts with no salaries are omitted).",o);})();
add('employees.csv',"CSV with a header row. Ignoring rows with an empty salary, sort by salary descending, ties broken by name ascending, and return the names of the first 3 as an array.",
 emp.filter(e=>e.salary!==null).sort((a,b)=>b.salary-a.salary||(a.name<b.name?-1:1)).slice(0,3).map(e=>e.name));
(()=>{const o={};lines('app.conf').filter(l=>!l.startsWith('#')).forEach(l=>{const i=l.indexOf('=');const k=l.slice(0,i);if(k.startsWith('db.'))o[k.slice(3)]=l.slice(i+1)});
add('app.conf',"Plain key=value lines; lines starting with # and blank lines are ignored. Take keys that start with \"db.\", remove that \"db.\" prefix, and return an object of the remaining key to its value; all values stay strings.",o);})();
(()=>{const s=new Set();rd('events.json').filter(e=>e.type==='click').forEach(e=>{const id=e.payload&&e.payload.user&&e.payload.user.id;if(id!=null)s.add(id)});
add('events.json',"For events with type \"click\", read payload.user.id. Skip events where payload, user or id is null or missing. Return the number of distinct ids.",s.size);})();
add('products.json',"Consider products whose stock is a number greater than 0 (null stock does not count). For each build an object {\"sku\": sku, \"value\": price*stock rounded to 2 decimals}. Sort by value descending and return the first 3 objects as an array.",
 rd('products.json').filter(p=>typeof p.stock==='number'&&p.stock>0).map(p=>({sku:p.sku,value:r2(p.price*p.stock)})).sort((a,b)=>b.value-a.value).slice(0,3));
(()=>{const txt="alice@Example.com, Bob@example.com, carol@test.org, ALICE@example.com, dave@test.org, erin@Test.org, bob@EXAMPLE.com, frank@demo.net";
const m={};const seen=new Set();txt.split(',').map(s=>s.trim().toLowerCase()).forEach(e=>{if(seen.has(e))return;seen.add(e);const d=e.split('@')[1];m[d]=(m[d]||0)+1});
add(null,"Given this comma-separated list of email addresses: \""+txt+"\". Trim spaces and compare case-insensitively, so addresses differing only in case are the same. Return an object mapping the lower-cased domain (part after @) to the number of distinct addresses with that domain.",m);})();
fs.writeFileSync('tasks.json',JSON.stringify(T,null,2));
console.log(T.length);

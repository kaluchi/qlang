const fs=require('fs');
const J=(f,o)=>fs.writeFileSync(f,JSON.stringify(o,null,2));
const orders=[
{id:1,customer:"alice",status:"paid",tracking:null,items:[{sku:"A1",qty:2,price:9.99},{sku:"B2",qty:1,price:20}]},
{id:2,customer:"bob",status:"PAID",tracking:"T-1",items:[{sku:"A1",qty:1,price:9.99}]},
{id:3,customer:"alice",status:"refunded",tracking:null,items:[{sku:"C3",qty:5,price:3.5}]},
{id:4,customer:"carol",status:"shipped",tracking:"T-9",items:[{sku:"B2",qty:3,price:20},{sku:"D4",qty:1}]},
{id:5,customer:"bob",status:"Paid",tracking:null,items:[]},
{id:6,customer:"dave",status:"shipped",tracking:"T-7",items:[{sku:"C3",qty:2,price:3.5}]},
{id:7,customer:"carol",status:"pending",items:[{sku:"A1",qty:4,price:9.99}]},
{id:8,customer:"alice",status:"paid",tracking:null,items:[{sku:"E5",qty:1,price:100.25}]}];
J('orders.json',orders);
const issues=[
{number:101,title:"Crash on start",state:"open",labels:["bug","p1"],assignee:{login:"ann"},comments:5},
{number:102,title:"Add dark mode",state:"open",labels:["feature"],assignee:null,comments:12},
{number:103,title:"Typo in docs",state:"closed",labels:["docs"],assignee:{login:"bo"},comments:0},
{number:104,title:"Memory leak",state:"open",labels:["bug","p1","perf"],assignee:null,comments:7},
{number:105,title:"Upgrade deps",state:"open",labels:[],comments:2},
{number:106,title:"Slow query",state:"open",labels:["perf","bug"],assignee:{login:"cy"},comments:3},
{number:107,title:"Refactor auth",state:"closed",labels:["bug"],assignee:null,comments:9},
{number:108,title:"Add export",state:"open",labels:null,assignee:null,comments:7},
{number:109,title:"Broken link",state:"open",labels:["docs","bug"],assignee:null,comments:1}];
J('issues.json',issues);
const pkg={name:"demo",version:"1.0.0",dependencies:{express:"^4.18.2",lodash:"^0.5.1",chalk:"^0.4.0",zod:"3.22.0"},devDependencies:{jest:"^29.0.0",eslint:"^0.9.2",lodash:"^0.5.1",nodemon:"~0.19.0"}};
J('package.json',pkg);
const users={data:{users:[
{id:1,name:"Ann",email:"Ann@Example.com",active:true,address:{country:"US"}},
{id:2,name:"Bo",email:null,active:true,address:{country:"DE"}},
{id:3,name:"Cy",email:"cy@example.com",active:false,address:{country:"US"}},
{id:4,name:"Di",email:"ann@example.com",active:true,address:null},
{id:5,name:"Ed",email:"ED@example.com",active:true,address:{country:"DE"}},
{id:6,name:"Flo",active:true,address:{country:"FR"}},
{id:7,name:"Gus",email:"gus@example.com",active:true,address:{}},
{id:8,name:"Hal",email:"hal@example.com",active:true,address:{country:"US"}}]},meta:{page:1}};
J('users.json',users);
const config={services:{
web:{port:8080,enabled:true,env:{LOG:"info"}},
db:{port:5432},
cache:{port:6379,enabled:false},
queue:{port:5672,enabled:true},
admin:{port:null,enabled:true},
auth:{port:3000,enabled:true}}};
J('config.json',config);
const events=[
{id:1,user:"zed",type:"push",payload:{repo:{name:"api"}}},
{id:2,user:"amy",type:"push",payload:{repo:{name:"web"}}},
{id:3,user:"zed",type:"issue",payload:{repo:{name:"api"}}},
{id:4,user:"amy",type:"push",payload:{repo:{name:"api"}}},
{id:5,user:"bob",type:"push"},
{id:6,user:"bob",type:"push",payload:{repo:null}},
{id:7,user:"zed",type:"push",payload:{repo:{name:"docs"}}},
{id:8,user:"bob",type:"star",payload:{repo:{name:"web"}}},
{id:9,user:"cat",type:"push",payload:{repo:{name:"web"}}},
{id:10,user:"cat",type:"fork",payload:{repo:{name:"zzz"}}}];
J('events.json',events);
fs.writeFileSync('access.log',`2026-09-01T10:00:01Z GET /api/users 200 120ms
2026-09-01T10:00:02Z POST /api/users 201 300ms
2026-09-01T10:00:03Z GET /api/items 200 80ms
2026-09-01T10:00:04Z GET /api/items 500 15ms
2026-09-01T10:00:05Z GET /api/users 200 100ms
2026-09-01T10:00:06Z GET /health 200 5ms
2026-09-01T10:00:07Z GET /api/orders 503 900ms
2026-09-01T10:00:08Z DELETE /api/users 404 20ms
2026-09-01T10:00:09Z GET /api/orders 502 450ms
`);
fs.writeFileSync('employees.csv',`name,dept,salary,city
Ann,Eng,5000,Berlin
Bo,Eng,6000,Paris
Cy,Ops,,Berlin
Di,Ops,4001,Rome
Ed,Eng,,Paris
Flo,HR,3500,Berlin
Gus,hr,3700,Rome
Hal,Ops,4500,Paris
`);
fs.writeFileSync('requirements.txt',`# base deps
Requests==2.31.0
flask>=2.0

numpy==1.26.4
  # indented comment
Django==4.2.1
pytest>=7.0,<8
PyYAML==6.0.1
`);
const T=[];const add=(input,text,expected)=>T.push({id:'L'+(T.length+1),input,text,expected});
const r2=x=>Math.round(x*100)/100;
// L1
add('orders.json',"Compute total revenue: for orders whose status equals 'paid' compared case-insensitively, sum qty*price over all their items; an item with a missing price counts as 0. Return a number rounded to 2 decimal places.",
 r2(orders.filter(o=>o.status.toLowerCase()==='paid').flatMap(o=>o.items).reduce((s,i)=>s+i.qty*(i.price??0),0)));
// L2
{const c={};issues.filter(i=>i.state==='open').forEach(i=>(i.labels||[]).forEach(l=>c[l]=(c[l]||0)+1));
add('issues.json',"Count open issues (state 'open') per label. Issues whose labels is null or empty contribute nothing. Return an object mapping label to count.",c);}
// L3
{const n=new Set();for(const k of ['dependencies','devDependencies'])for(const[a,v]of Object.entries(pkg[k]))if(v.startsWith('^0.'))n.add(a);
add('package.json',"Collect package names from both 'dependencies' and 'devDependencies' whose version string starts with '^0.'. Return distinct names as an array of strings sorted alphabetically ascending.",[...n].sort());}
// L4
{const u=users.data.users;const e=[...new Set(u.filter(x=>x.active&&x.email).map(x=>x.email.toLowerCase()))].sort();
add('users.json',"Take users from data.users with active equal to true and a non-null, present email. Lowercase the emails, remove duplicates, and return an array of strings sorted alphabetically ascending.",e);}
// L5
{const s=Object.entries(config.services).filter(([k,v])=>(v.enabled??true)&&v.port!=null).map(([k,v])=>({name:k,port:v.port})).sort((a,b)=>a.port-b.port);
add('config.json',"From the services object, take services that are enabled (a missing 'enabled' counts as true) and have a non-null port. Return an array of objects {\"name\": <service key>, \"port\": <port>} sorted by port ascending.",s);}
// L6
{const L=fs.readFileSync('access.log','utf8').trim().split('\n').map(l=>l.split(' '));
const a=L.filter(p=>p[1]==='GET'&&p[3]==='200').map(p=>parseInt(p[4]));
add('access.log',"Each line is: timestamp METHOD path status duration (duration like '120ms'). For lines with method GET and status 200, compute the average duration in milliseconds. Return a number rounded to 1 decimal place.",Math.round(a.reduce((x,y)=>x+y,0)/a.length*10)/10);}
// L7
{const rows=fs.readFileSync('employees.csv','utf8').trim().split('\n').slice(1).map(l=>l.split(','));
const g={};rows.filter(r=>r[2]!=='').forEach(r=>{const d=r[1].toLowerCase();(g[d]??=[]).push(+r[2])});
const o={};for(const d in g)o[d]=Math.round(g[d].reduce((a,b)=>a+b,0)/g[d].length);
add('employees.csv',"The CSV has a header row (name,dept,salary,city). Ignoring rows with an empty salary, group by dept lowercased and compute the average salary per group rounded to the nearest integer (halves round up). Return an object mapping lowercase dept to the rounded average.",o);}
// L8
{const c={};events.forEach(e=>c[e.user]=(c[e.user]||0)+1);
const t=Object.entries(c).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,3).map(([k,v])=>k+':'+v);
add('events.json',"Count events per user. Return the top 3 users as an array of strings 'user:count', ordered by count descending, ties broken by user name ascending.",t);}
// L9
{const s="Apple, banana, apple , Cherry, banana, apple, date";
const r=[...new Set(s.split(',').map(x=>x.trim().toLowerCase()))].sort().join('|');
add(null,"Given the comma-separated string \""+s+"\": split on commas, trim whitespace, lowercase, remove duplicates, sort alphabetically ascending and join with '|'. Return the resulting string.",r);}
// L10
{const o={};fs.readFileSync('requirements.txt','utf8').split('\n').map(l=>l.trim()).filter(l=>l&&!l.startsWith('#')).forEach(l=>{const m=l.split('==');if(m.length===2)o[m[0].toLowerCase()]=m[1]});
add('requirements.txt',"Ignore blank lines and lines starting with '#' (after trimming). Among the remaining lines keep only those pinned with '=='. Return an object mapping the package name lowercased to its pinned version string.",o);}
// L11
{const r=issues.filter(i=>i.state==='open'&&!i.assignee).sort((a,b)=>b.comments-a.comments||a.number-b.number).slice(0,2).map(i=>i.number);
add('issues.json',"Take open issues (state 'open') that have no assignee (assignee is null or missing). Sort by comments descending, ties by number ascending, and return the numbers of the first 2 as an array of numbers.",r);}
// L12
{const c={};orders.forEach(o=>c[o.customer]=(c[o.customer]||0)+1);
add('orders.json',"Return an array of customers (strings) that have at least 2 orders in total (any status), sorted alphabetically ascending.",Object.keys(c).filter(k=>c[k]>=2).sort());}
// L13
{const g={};users.data.users.forEach(u=>{const c=u.address?.country??'unknown';(g[c]??=[]).push(u.name)});for(const k in g)g[k].sort();
add('users.json',"Group all users in data.users (active or not) by address.country; users whose address is null or has no country go under the key 'unknown'. Return an object mapping country to an array of user names sorted alphabetically ascending.",g);}
// L14
{const r=[...new Set(events.filter(e=>e.type==='push'&&e.payload?.repo?.name).map(e=>e.payload.repo.name))].sort();
add('events.json',"Take events with type 'push' that have payload.repo.name present and non-null. Return the distinct repo names as an array of strings sorted alphabetically ascending.",r);}
J('tasks.json',T);console.log(JSON.stringify(T.map(t=>[t.id,t.expected])));

const fs=require('fs');
const W=(f,o)=>fs.writeFileSync(f,typeof o==='string'?o:JSON.stringify(o,null,2));
const cmp=(a,b)=>a<b?-1:a>b?1:0;
const r=(x,d)=>Math.round(x*10**d)/10**d;
const T=[];
const add=(input,text,fn,data)=>{T.push({id:'J'+(T.length+1),input,text,expected:fn(data)})};

// J1
const users={status:"ok",data:[
{id:1,name:"Zoe Adams",email:"zoe@x.io",active:true,address:{city:"Berlin"}},
{id:2,name:"bob Stone",email:"bob@x.io",active:true,address:null},
{id:3,name:"Carla Diaz",email:"carla@x.io",active:false,address:{city:"Madrid"}},
{id:4,name:"alan Wu",email:"alan@x.io",active:true,address:{city:"Taipei"}},
{id:5,name:"Dmitri Ivanov",email:"dm@x.io",active:true},
{id:6,name:"Emma Li",email:"emma@x.io",active:true,address:{city:null}},
{id:7,name:"Frank Moore",email:"frank@x.io",active:true,address:{city:"Austin"}},
{id:8,name:"Greta Berg",email:"greta@x.io",active:false,address:null}]};
W('users.json',users);
add('users.json','The file has a "data" array of users. Take users where active is true and address.city is a non-null string (address may be null or missing, city may be null; skip those). Return an array of their "name" strings sorted ascending by name compared case-insensitively (lowercase comparison).',
 d=>d.data.filter(u=>u.active===true&&u.address&&typeof u.address.city==='string').map(u=>u.name).sort((a,b)=>cmp(a.toLowerCase(),b.toLowerCase())),users);

// J2
const orders=[
{id:"o1",customer:"ann",status:"paid",items:[{sku:"a",qty:2,price:9.99},{sku:"b",qty:1,price:5}]},
{id:"o2",customer:"bo",status:"PAID",items:[{sku:"c",qty:3,price:2.5}]},
{id:"o3",customer:"cy",status:"cancelled",items:[{sku:"a",qty:10,price:9.99}]},
{id:"o4",customer:"ann",status:"Paid",items:[]},
{id:"o5",customer:"di",status:"pending",items:[{sku:"d",qty:1,price:100}]},
{id:"o6",customer:"ed",status:"paid",items:[{sku:"b",qty:4,price:5.25},{sku:"e",qty:1,price:0.1}]},
{id:"o7",customer:"fy",status:null,items:[{sku:"a",qty:1,price:9.99}]}];
W('orders.json',orders);
add('orders.json','The file is an array of orders. Consider only orders whose status equals "paid" ignoring case (null status does not match). Each order has items with qty and price; the line total is qty*price. Return a single number: the sum of all line totals over those orders, rounded to 2 decimal places.',
 d=>r(d.filter(o=>typeof o.status==='string'&&o.status.toLowerCase()==='paid').flatMap(o=>o.items).reduce((s,i)=>s+i.qty*i.price,0),2),orders);

// J3
const pkg={name:"demo-app",version:"1.4.0",dependencies:{express:"^4.18.2",lodash:"~4.17.21",axios:"^1.6.0",chalk:"5.3.0"},devDependencies:{jest:"^29.7.0",eslint:"^8.56.0",typescript:"~5.3.3"}};
W('package.json',pkg);
add('package.json','The file is a package manifest with "dependencies" and "devDependencies" objects (name -> version range). Combine both objects and keep entries whose version string starts with "^". Return an array of strings of the form "name@version" (e.g. "foo@^1.0.0"), sorted ascending by package name.',
 d=>Object.entries({...d.dependencies,...d.devDependencies}).filter(([k,v])=>v.startsWith('^')).sort((a,b)=>cmp(a[0],b[0])).map(([k,v])=>k+'@'+v),pkg);

// J4
const issues=[
{id:1,title:"Crash on start",state:"open",assignee:{login:"mia"},labels:["bug"]},
{id:2,title:"Add dark mode",state:"open",assignee:null,labels:["feature"]},
{id:3,title:"Typo in docs",state:"closed",assignee:{login:"mia"},labels:["docs"]},
{id:4,title:"Memory leak",state:"open",assignee:{login:"joe"},labels:["bug","perf"]},
{id:5,title:"Slow query",state:"open",assignee:{login:"mia"},labels:["perf"]},
{id:6,title:"Update deps",state:"open",labels:[]},
{id:7,title:"Login fails",state:"closed",assignee:{login:"joe"},labels:["bug"]},
{id:8,title:"Refactor auth",state:"open",assignee:{login:"joe"},labels:["tech-debt"]},
{id:9,title:"CI flaky",state:"open",assignee:{login:"sam"},labels:["bug"]}];
W('issues.json',issues);
add('issues.json','The file is an array of issues. Keep issues with state "open". Count them per assignee login; issues whose assignee is null or missing are counted under the key "unassigned". Return an object mapping login (or "unassigned") to count.',
 d=>{const o={};d.filter(i=>i.state==='open').forEach(i=>{const k=i.assignee?i.assignee.login:'unassigned';o[k]=(o[k]||0)+1});return o},issues);

// J5
const config={defaults:{timeout:30,retries:3},services:[
{name:"search",timeout:10,retries:5},
{name:"auth",enabled:true},
{name:"billing",enabled:false,timeout:60},
{name:"mailer",retries:0},
{name:"cache",enabled:true,timeout:null},
{name:"api",timeout:45,enabled:true}]};
W('config.json',config);
add('config.json','The file has "defaults" (timeout, retries) and a "services" array. Keep services that are enabled; a missing "enabled" field counts as enabled, only false disables. For each kept service return an object {"name","timeout","retries"} where a missing or null timeout/retries is replaced by the value from defaults (a value of 0 is a real value and is kept). Sort the array ascending by name.',
 d=>d.services.filter(s=>s.enabled!==false).map(s=>({name:s.name,timeout:s.timeout??d.defaults.timeout,retries:s.retries??d.defaults.retries})).sort((a,b)=>cmp(a.name,b.name)),config);

// J6
const events=[
{ts:"2026-03-01T10:00:00Z",level:"info",service:"api",msg:"req",durationMs:120},
{ts:"2026-03-01T10:00:01Z",level:"error",service:"api",msg:"fail",durationMs:300},
{ts:"2026-03-01T10:00:02Z",level:"info",service:"db",msg:"query",durationMs:40},
{ts:"2026-03-01T10:00:03Z",level:"info",service:"db",msg:"query",durationMs:null},
{ts:"2026-03-01T10:00:04Z",level:"warn",service:"db",msg:"slow",durationMs:95},
{ts:"2026-03-01T10:00:05Z",level:"info",service:"web",msg:"start"},
{ts:"2026-03-01T10:00:06Z",level:"info",service:"api",msg:"req",durationMs:81},
{ts:"2026-03-01T10:00:07Z",level:"error",service:"web",msg:"boom",durationMs:10},
{ts:"2026-03-01T10:00:08Z",level:"info",service:"cron",msg:"tick"}];
W('events.json',events);
add('events.json','The file is an array of log events. Ignore events whose durationMs is null or missing. For the rest, compute the average durationMs per service, rounded to 1 decimal place. Return an object mapping service to average (services with no usable events are omitted).',
 d=>{const g={};d.filter(e=>e.durationMs!=null).forEach(e=>(g[e.service]??=[]).push(e.durationMs));const o={};for(const k in g)o[k]=r(g[k].reduce((a,b)=>a+b,0)/g[k].length,1);return o},events);

// J7
const products=[
{sku:"p1",name:"Keyboard",price:49.5,stock:12},
{sku:"p2",name:"Monitor",price:219,stock:0},
{sku:"p3",name:"Mouse",price:19.9,stock:40},
{sku:"p4",name:"Webcam",price:79,stock:3},
{sku:"p5",name:"Dock",price:149,stock:5},
{sku:"p6",name:"Cable",price:5,stock:null},
{sku:"p7",name:"Headset",price:99,stock:7},
{sku:"p8",name:"Laptop",price:999}];
W('products.json',products);
add('products.json','The file is an array of products. Keep products whose stock is a number greater than 0 (null or missing stock means not in stock). Return the "name" values of the 3 most expensive of them as an array, ordered by price descending.',
 d=>d.filter(p=>typeof p.stock==='number'&&p.stock>0).sort((a,b)=>b.price-a.price).slice(0,3).map(p=>p.name),products);

// J8
const emps=[
{name:"A",dept:"eng",skills:["Go","SQL","Docker"]},
{name:"B",dept:"eng",skills:["go","Rust"]},
{name:"C",dept:"ops",skills:["Docker","Bash"]},
{name:"D",dept:"ops",skills:null},
{name:"E",dept:"hr",skills:[]},
{name:"F",dept:"ops",skills:["bash","Terraform"]},
{name:"G",dept:"eng"},
{name:"H",dept:"hr",skills:["Excel"]}];
W('employees.json',emps);
add('employees.json','The file is an array of employees with dept and skills (skills may be null, missing or empty). For each dept, return the distinct skills, lowercased, sorted ascending. Return an object mapping dept to that array; departments with no skills get an empty array.',
 d=>{const o={};d.forEach(e=>{o[e.dept]??=new Set();(e.skills||[]).forEach(s=>o[e.dept].add(s.toLowerCase()))});for(const k in o)o[k]=[...o[k]].sort(cmp);return o},emps);

// J9
const servers=[
{host:"h1",role:"web",region:"eu-west",cpu:{cores:4}},
{host:"h2",role:"DB",region:"eu-west",cpu:{cores:16}},
{host:"h3",role:"db",region:"eu-west",cpu:{cores:8}},
{host:"h4",role:"Web",region:"us-east",cpu:null},
{host:"h5",role:"cache",region:"us-east"},
{host:"h6",role:"Db",region:"eu-west",cpu:{cores:12}}];
W('servers.json',servers);
add('servers.json','The file is an array of servers. Return a boolean: true if every server whose role equals "db" (case-insensitive) has region "eu-west" and cpu.cores of at least 8; otherwise false.',
 d=>d.filter(s=>s.role.toLowerCase()==='db').every(s=>s.region==='eu-west'&&s.cpu&&s.cpu.cores>=8),servers);

// J10 inline
const emails="Alice@Example.com, bob@test.org; carol@EXAMPLE.com, dave@mail.net; erin@Test.org, frank@example.com";
add(null,'Input (no file): the string "'+emails+'". Entries are separated by a comma or semicolon (each possibly followed by a space). Return the distinct email domains (the part after "@"), lowercased, as an array sorted ascending.',
 ()=>[...new Set(emails.split(/[,;]\s*/).map(e=>e.split('@')[1].toLowerCase()))].sort(cmp));

// J11 access.log
const log=`2026-03-01T10:00:01Z GET /api/users 200 123ms
2026-03-01T10:00:02Z GET /api/orders 500 450ms
2026-03-01T10:00:03Z POST /api/orders 502 30ms
2026-03-01T10:00:04Z GET /api/users 503 800ms
2026-03-01T10:00:05Z GET /health 200 2ms
2026-03-01T10:00:06Z GET /api/orders 404 12ms
2026-03-01T10:00:07Z GET /api/users 500 640ms
2026-03-01T10:00:08Z GET /api/orders 504 900ms
2026-03-01T10:00:09Z GET /api/items 500 70ms
2026-03-01T10:00:10Z GET /api/items 200 15ms
2026-03-01T10:00:11Z GET /api/billing 500 55ms
`;
W('access.log',log);
add('access.log','Each line of the text file is: timestamp, HTTP method, path, status code, duration, separated by single spaces. Consider lines with status code 500 or higher. Count them per path. Return the top 2 paths as an array of {"path","count"} objects, sorted by count descending, ties broken by path ascending.',
 d=>{const c={};d.trim().split('\n').map(l=>l.split(' ')).filter(p=>+p[3]>=500).forEach(p=>c[p[2]]=(c[p[2]]||0)+1);return Object.entries(c).map(([path,count])=>({path,count})).sort((a,b)=>b.count-a.count||cmp(a.path,b.path)).slice(0,2)},log);

// J12 csv
const csv=`name,team,score
ann,red,80
bob,blue,70
cy,red,
di,blue,95
ed,green,60
fy,red,91
gus,green,
hal,blue,85
`;
W('data.csv',csv);
add('data.csv','The text file is CSV with header "name,team,score". Rows with an empty score are ignored. Compute the average score per team, rounded to 2 decimal places. Return an object mapping team to average.',
 d=>{const g={};d.trim().split('\n').slice(1).map(l=>l.split(',')).filter(p=>p[2]!=='').forEach(p=>(g[p[1]]??=[]).push(+p[2]));const o={};for(const k in g)o[k]=r(g[k].reduce((a,b)=>a+b,0)/g[k].length,2);return o},csv);

// J13 requirements
const req=`# runtime deps
Flask==2.3.2
requests>=2.31

numpy==1.26.4
# dev
PyYAML==6.0.1
Django>=4.2
pytest==7.4.0
`;
W('requirements.txt',req);
add('requirements.txt','Each non-blank line of the text file is either a comment (starts with "#") or a requirement. Ignore comments and blank lines, and ignore requirements that do not use "==". For the rest, split at "==" into name and version. Return an object mapping the lowercased name to the version string.',
 d=>{const o={};d.split('\n').filter(l=>l.trim()&&!l.startsWith('#')&&l.includes('==')).forEach(l=>{const [n,v]=l.split('==');o[n.toLowerCase()]=v});return o},req);

// J14
const posts=[
{id:1,title:"Intro",comments:[{author:"a",likes:3},{author:"b",likes:null},{author:"c"}]},
{id:2,title:"Deep dive",comments:[{author:"a",likes:5},{author:"d",likes:4}]},
{id:3,title:"Q&A",comments:[]},
{id:4,title:"Release notes",comments:[{author:"e",likes:2},{author:"f",likes:6}]},
{id:5,title:"Empty",comments:null}];
W('posts.json',posts);
add('posts.json','The file is an array of posts, each with a "comments" array (may be null) whose items have an optional numeric "likes" (null or missing counts as 0). Return the "title" string of the post with the highest total likes (no ties exist).',
 d=>d.map(p=>({t:p.title,s:(p.comments||[]).reduce((a,c)=>a+(c.likes||0),0)})).sort((a,b)=>b.s-a.s)[0].t,posts);

W('tasks.json',T);
console.log(T.map(t=>t.id+' '+JSON.stringify(t.expected)).join('\n'));

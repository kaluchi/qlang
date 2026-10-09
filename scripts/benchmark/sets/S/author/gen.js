const fs=require('fs');
const w=(f,d)=>fs.writeFileSync(f,typeof d==='string'?d:JSON.stringify(d,null,2));
const issues=[
{id:1,title:"Crash on start",state:"open",assignee:"ana",labels:["Bug","urgent"],priority:3},
{id:2,title:"Add dark mode",state:"open",assignee:null,labels:["feature"],priority:1},
{id:3,title:"Typo in docs",state:"closed",assignee:"bob",labels:["docs"],priority:0},
{id:4,title:"Memory leak",state:"open",assignee:"ana",labels:["BUG"],priority:5},
{id:5,title:"Slow query",state:"open",assignee:"cy",labels:["bug","perf"]},
{id:6,title:"Update deps",state:"closed",assignee:"ana",labels:["chore","bug"],priority:2},
{id:7,title:"Login redirect",state:"open",assignee:"bob",labels:[],priority:3},
{id:8,title:"Export CSV",state:"open",assignee:"cy",labels:["feature","Bug"],priority:3},
{id:9,title:"Refactor auth",state:"open",assignee:null,labels:["chore"],priority:5}];
w('issues.json',issues);
const pkg={name:"demo",version:"1.2.0",dependencies:{express:"^4.18.0",lodash:"~4.17.21",axios:"^1.6.0",chalk:"5.3.0",zod:"^3.22.0"},devDependencies:{jest:"^29.7.0",eslint:"^8.50.0",axios:"^1.6.0",prettier:"3.0.3",typescript:"~5.2.2"}};
w('package.json',pkg);
const orders=[
{id:"o1",customer:"Acme",items:[{sku:"a",qty:2,price:10.5},{sku:"b",qty:1,price:3.25}]},
{id:"o2",customer:"Globex",items:[{sku:"c",qty:5,price:4}]},
{id:"o3",customer:"Acme",items:[{sku:"d",qty:1,price:99.99}]},
{id:"o4",customer:"Initech",items:[]},
{id:"o5",customer:"Globex",items:[{sku:"a",qty:3,price:10.5},{sku:"e",qty:2,price:7.125}]},
{id:"o6",customer:"Umbrella",items:[{sku:"f",qty:10,price:2.2}]},
{id:"o7",customer:"Initech",items:[{sku:"b",qty:4,price:3.25}]}];
w('orders.json',orders);
const users={status:"ok",data:{users:[
{id:1,email:"Anna@Example.com",profile:{city:"Berlin"}},
{id:2,email:"bob@example.com",profile:null},
{id:3,email:"CARL@example.com",profile:{city:"berlin"}},
{id:4,email:"dina@example.com",profile:{}},
{id:5,email:"Eve@Example.com",profile:{city:"Paris"}},
{id:6,email:"abe@example.com",profile:{city:"BERLIN"}},
{id:7,email:"fay@example.com"}]}};
w('users.json',users);
const config={env:"prod",services:{api:{enabled:true,port:8080},db:{enabled:false,port:5432},cache:{port:6379},worker:{enabled:true},web:{enabled:true,port:80},mail:{enabled:null,port:25}}};
w('config.json',config);
const products=[
{name:"Pen",category:"Office",stock:10},{name:"Desk",category:"furniture",stock:0},
{name:"Chair",category:"Furniture",stock:3},{name:"Ink",category:"office",stock:5},
{name:"Lamp",category:"Lighting",stock:null},{name:"Bulb",category:"LIGHTING",stock:40},
{name:"Pad",category:"Office"},{name:"Sofa",category:"Furniture",stock:2}];
w('products.json',products);
const events=[
{user:"u2",type:"click",ts:"2026-01-05T10:00:00Z"},
{user:"u1",type:"view",ts:"2026-01-03T09:00:00Z"},
{user:"u2",type:"view",ts:"2026-01-02T08:30:00Z"},
{user:"u3",type:"click",ts:"2026-01-07T12:00:00Z"},
{user:"u1",type:"click",ts:"2026-01-01T07:00:00Z"},
{user:"u1",type:"view",ts:"2026-01-09T07:00:00Z"},
{user:"u3",type:"view",ts:"2026-01-04T12:00:00Z"}];
w('events.json',events);
const articles=[
{id:1,published:true,tags:["JS","web"]},{id:2,published:true,tags:["js","node"]},
{id:3,published:false,tags:["js","web","css"]},{id:4,published:true,tags:["Web","css"]},
{id:5,published:true,tags:["Node","JS"]},{id:6,published:true,tags:null},
{id:7,published:true,tags:["css","go"]},{id:8,published:true}];
w('articles.json',articles);
w('logs.txt',`2026-03-01T10:00:00Z ERROR api Connection refused
2026-03-01T10:00:05Z INFO api Retrying
2026-03-01T10:01:00Z ERROR db Timeout after 30s
2026-03-01T10:02:00Z WARN web Slow response
2026-03-01T10:03:00Z ERROR api Connection refused
2026-03-01T10:04:00Z INFO db Recovered
2026-03-01T10:05:00Z ERROR web 500 on /home
2026-03-01T10:06:00Z error api lowercase level line
2026-03-01T10:07:00Z INFO web Request ok
`);
w('employees.csv',`name,dept,salary
Ann,Eng,100
Bob,Ops,70
Cy,Eng,120
Dee,Sales,
Eli,ops,80
Fay,Sales,90
Gus,Eng,95
Hal,Sales,60
`);
w('servers.txt',`# name|region|status|uptime_days
web1|eu-west|up|120
web2|eu-east|down|0
db1|us-east|up|300
db2|eu-west|up|45
cache1|EU-north|degraded|200
job1|ap-south|up|10

api1|eu-west|up|200
`);
const inlineWords="The cat and the Hat and THE bat sat on a mat with the cat";
const T=[];const add=(input,text,f)=>T.push({id:'S'+(T.length+1),input,text,expected:f()});
add('issues.json',"Count the issues whose state is \"open\" and whose labels array contains \"bug\" (compare case-insensitively). Output a single number.",
 ()=>issues.filter(i=>i.state==='open'&&i.labels.some(l=>l.toLowerCase()==='bug')).length);
add('issues.json',"Among issues with state \"open\", count issues per assignee, skipping issues whose assignee is null. Output an object whose keys are assignee names and whose values are the counts.",
 ()=>{const o={};issues.filter(i=>i.state==='open'&&i.assignee!=null).forEach(i=>o[i.assignee]=(o[i.assignee]||0)+1);return o});
add('issues.json',"Among issues with state \"open\", take the 3 with the highest priority (a missing priority counts as 0); break ties by smaller id first. Output an array of their id numbers in that order (best first).",
 ()=>issues.filter(i=>i.state==='open').map(i=>({id:i.id,p:i.priority??0})).sort((a,b)=>b.p-a.p||a.id-b.id).slice(0,3).map(x=>x.id));
add('package.json',"Collect the package names from both \"dependencies\" and \"devDependencies\" whose version string starts with \"^\". Remove duplicates and output an array of names sorted alphabetically (ascending).",
 ()=>[...new Set([...Object.entries(pkg.dependencies),...Object.entries(pkg.devDependencies)].filter(([k,v])=>v.startsWith('^')).map(e=>e[0]))].sort());
add('orders.json',"The total of an order is the sum of qty*price over its items (0 if no items). For each customer sum the totals of all their orders. Output the top 2 customers by this sum, descending, as an array of objects {\"customer\": name, \"total\": sum rounded to 2 decimal places as a number}.",
 ()=>{const m={};orders.forEach(o=>m[o.customer]=(m[o.customer]||0)+o.items.reduce((s,i)=>s+i.qty*i.price,0));return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,2).map(([c,t])=>({customer:c,total:Math.round(t*100)/100}))});
add('users.json',"The users are in data.users. Select users whose profile.city equals \"berlin\" case-insensitively (users whose profile is null, missing, or has no city do not match). Output an array of their emails converted to lowercase, sorted alphabetically ascending.",
 ()=>users.data.users.filter(u=>(u.profile?.city??'').toLowerCase()==='berlin').map(u=>u.email.toLowerCase()).sort());
add('logs.txt',"Each line has the form \"<timestamp> <LEVEL> <service> <message...>\" separated by single spaces. Count lines whose level is ERROR (case-insensitive) per service. Output an object mapping service name to count (only services with at least one error).",
 ()=>{const o={};fs.readFileSync('logs.txt','utf8').split('\n').filter(Boolean).forEach(l=>{const p=l.split(' ');if(p[1].toUpperCase()==='ERROR')o[p[2]]=(o[p[2]]||0)+1});return o});
add('employees.csv',"The file is CSV with a header row (name,dept,salary). Group by dept compared case-insensitively and report the dept in lowercase. Ignore rows with an empty salary. Output an object mapping lowercase dept to the average salary, rounded to 1 decimal place.",
 ()=>{const m={};fs.readFileSync('employees.csv','utf8').split('\n').slice(1).filter(Boolean).forEach(l=>{const [n,d,s]=l.split(',');if(s==='')return;(m[d.toLowerCase()]??=[]).push(+s)});const o={};for(const k in m)o[k]=Math.round(m[k].reduce((a,b)=>a+b)/m[k].length*10)/10;return o});
add('articles.json',"Consider only articles with published true. Count, per tag (case-insensitive, report tags in lowercase), how many articles carry it; a null or missing tags field means no tags, and a tag repeated within one article counts once. Output the top 3 tags as an array of {\"tag\": ..., \"count\": ...}, sorted by count descending and by tag ascending on ties.",
 ()=>{const m={};articles.filter(a=>a.published).forEach(a=>new Set((a.tags||[]).map(t=>t.toLowerCase())).forEach(t=>m[t]=(m[t]||0)+1));return Object.entries(m).map(([tag,count])=>({tag,count})).sort((a,b)=>b.count-a.count||(a.tag<b.tag?-1:1)).slice(0,3)});
add('config.json',"In the services object, a service is active when its enabled is true (false, null or missing means not active). Output an object mapping each active service's name to its port, using null when the port is missing.",
 ()=>{const o={};for(const [k,v] of Object.entries(config.services))if(v.enabled===true)o[k]=v.port??null;return o});
add('products.json',"Keep products whose stock is a number greater than 0 (null or missing stock does not qualify). Output the distinct categories of these products, lowercased, as an array sorted alphabetically ascending.",
 ()=>[...new Set(products.filter(p=>typeof p.stock==='number'&&p.stock>0).map(p=>p.category.toLowerCase()))].sort());
add(null,`Take the sentence: "${inlineWords}". Split it on spaces and compare words case-insensitively (lowercase them). Output the 3 most frequent words as an array of {"word": ..., "count": ...}, sorted by count descending and by word ascending on ties.`,
 ()=>{const m={};inlineWords.split(' ').forEach(x=>{x=x.toLowerCase();m[x]=(m[x]||0)+1});return Object.entries(m).map(([word,count])=>({word,count})).sort((a,b)=>b.count-a.count||(a.word<b.word?-1:1)).slice(0,3)});
add('events.json',"Group events by user. For each user output {\"user\": id, \"count\": number of events, \"first\": the earliest ts string}. Output an array of these objects sorted by user ascending. (ts strings are ISO UTC, so string order equals time order.)",
 ()=>{const m={};events.forEach(e=>{const g=m[e.user]??={user:e.user,count:0,first:e.ts};g.count++;if(e.ts<g.first)g.first=e.ts});return Object.values(m).sort((a,b)=>a.user<b.user?-1:1)});
add('servers.txt',"Lines starting with \"#\" and blank lines are to be ignored; other lines are \"name|region|status|uptime_days\". Keep servers whose region starts with \"eu-\" (case-insensitive) and whose status is not \"down\". Sort them by uptime_days descending (numeric) and output their names joined with a comma and no spaces as a single string.",
 ()=>fs.readFileSync('servers.txt','utf8').split('\n').filter(l=>l&&!l.startsWith('#')).map(l=>l.split('|')).filter(p=>p[1].toLowerCase().startsWith('eu-')&&p[2]!=='down').sort((a,b)=>b[3]-a[3]).map(p=>p[0]).join(','));
w('tasks.json',T);
console.log(JSON.stringify(T.map(t=>t.expected)));

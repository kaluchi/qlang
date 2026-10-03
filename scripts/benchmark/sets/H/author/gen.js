const fs=require('fs');
const W=(f,o)=>fs.writeFileSync(f,typeof o==='string'?o:JSON.stringify(o,null,2));
const cmp=(a,b)=>a<b?-1:a>b?1:0;
const users=[
{id:1,name:"Alice",email:"alice@x.io",active:true,age:34,country:"DE",roles:["admin","dev"]},
{id:2,name:"Bruno",email:"bruno@x.io",active:true,age:29,country:"de",roles:["dev"]},
{id:3,name:"Chen",email:"chen@x.io",active:false,age:41,country:"DE",roles:[]},
{id:4,name:"Dora",email:null,active:true,age:null,country:"De",roles:["ops"]},
{id:5,name:"Emil",email:"emil@x.io",active:true,country:"DE",roles:["dev"]},
{id:6,name:"Farah",email:"farah@x.io",active:true,age:30,country:"FR",roles:["dev"]},
{id:7,name:"Zed",email:"zed@x.io",active:true,age:52,country:"dE",roles:["admin"]},
{id:8,name:"Gita",email:"gita@x.io",active:true,age:30,country:"DE"}];
W('users.json',users);
const orders=[
{id:"o1",customer:"Acme",status:"paid",coupon:null,items:[{sku:"a",qty:2,price:9.99},{sku:"b",qty:1,price:5}]},
{id:"o2",customer:"acme",status:"PAID",coupon:"X1",items:[{sku:"c",qty:3,price:1.25}]},
{id:"o3",customer:"Globex",status:"refunded",coupon:null,items:[{sku:"a",qty:1,price:9.99}]},
{id:"o4",customer:"Initech",status:"pending",items:[]},
{id:"o5",customer:"GLOBEX",status:"Paid",coupon:null,items:[{sku:"d",qty:10,price:0.1},{sku:"e",qty:1,price:19.5}]},
{id:"o6",customer:"Initech",status:"paid",coupon:null,items:[{sku:"b",qty:4,price:5}]},
{id:"o7",customer:"Acme",status:"cancelled",coupon:"Y",items:[{sku:"b",qty:1,price:5}]}];
W('orders.json',orders);
const pkg={name:"demo-app",version:"1.4.2",scripts:{build:"tsc",test:"jest",lint:"eslint .",start:"node dist"},
dependencies:{express:"^4.18.2",lodash:"^4.17.21",zod:"^3.22.0"},devDependencies:{jest:"^29.7.0",typescript:"^5.3.3"},
peerDependencies:{react:">=18"}};
W('package.json',pkg);
const issues=[
{id:101,title:"Crash on start",state:"open",assignee:{login:"mia"},labels:["Bug","P1"],comments:7},
{id:102,title:"Add dark mode",state:"open",assignee:null,labels:["feature"],comments:12},
{id:103,title:"Typo in docs",state:"closed",assignee:{login:"leo"},labels:["docs"],comments:1},
{id:104,title:"Slow query",state:"open",assignee:{login:"mia"},labels:["bug","perf"],comments:12},
{id:105,title:"Upgrade deps",state:"open",labels:[],comments:3},
{id:106,title:"Memory leak",state:"open",assignee:{login:"leo"},comments:9},
{id:107,title:"Flaky test",state:"closed",assignee:{login:"mia"},labels:["BUG","tests"],comments:20},
{id:108,title:"Login redirect",state:"open",assignee:{login:"noa"},labels:["Docs","bug"],comments:0}];
W('issues.json',issues);
W('access.log',`2026-03-01T10:00:01Z INFO auth user=bob login ok
2026-03-01T10:00:05Z ERROR auth user=carol invalid password
2026-03-01T10:01:10Z WARN billing user=bob card expiring
2026-03-01T10:02:00Z ERROR billing gateway timeout

2026-03-01T10:02:30Z ERROR billing user=dave charge failed
2026-03-01T10:03:00Z INFO search query served
2026-03-01T10:03:44Z ERROR auth user=carol account locked
2026-03-01T10:04:00Z WARN search user=erin slow response
2026-03-01T10:05:00Z DEBUG auth user=frank token refresh
2026-03-01T10:06:00Z ERROR search index missing
`);
W('servers.csv',`host,region,cpu,mem_gb,status
web1,eu,55.5,16,up
web2,eu,70,16,up
web3,eu,,32,up
db1,us,40,64,up
db2,us,90,64,down
web4,us,61,16,UP
cache1,ap,20,8,up
cache2,ap,35,8,down
`);
W('settings.env',`# database
DB_HOST=localhost
DB_PORT=5432
db_name=main

# app
APP_DEBUG=TRUE
APP_NAME=demo = app
DB_SSL=false
`);
const config={defaults:{timeout:30},services:[
{name:"web",enabled:true,timeout:10,owner:{team:"front"}},
{name:"api",enabled:true,owner:{team:"core"}},
{name:"worker",enabled:false,timeout:5,owner:null},
{name:"cron",enabled:true,timeout:null,owner:null},
{name:"auth",enabled:true,timeout:0,owner:{}},
{name:"legacy",enabled:false}]};
W('config.json',config);
const api={page:1,total:6,results:[
{id:"u1",profile:{first:"Ann",last:"Lee"},tags:["a","b"],score:80},
{id:"u2",profile:{first:"Bo",last:"Ng"},tags:[],score:50},
{id:"u3",profile:{first:"Cy",last:"Roy"},score:95},
{id:"u4",profile:{first:"Di",last:"Fox"},tags:["z"],score:null},
{id:"u5",profile:{first:"Ed",last:"Kim"},tags:["x","y","z"]},
{id:"u6",profile:{first:"Flo",last:"Day"},tags:["q"],score:65}]};
W('api_response.json',api);

const T=[];const add=(input,text,expected)=>T.push({id:'H'+(T.length+1),input,text,expected});
add('users.json',"The file holds an array of user records. Return an array of the names (strings) of users who are active (active is true), whose country equals \"DE\" ignoring case, and whose age is a number >= 30 (missing or null age excludes the user). Sort names ascending (plain string order).",
 users.filter(u=>u.active&&u.country.toLowerCase()==='de'&&typeof u.age==='number'&&u.age>=30).map(u=>u.name).sort(cmp));
const r2=x=>Math.round(x*100)/100;
add('orders.json',"The file holds an array of orders, each with items (array of {sku, qty, price}). Consider only orders whose status equals \"paid\" ignoring case. Return a number: the sum of qty*price over all items of those orders, rounded to 2 decimal places.",
 r2(orders.filter(o=>o.status.toLowerCase()==='paid').flatMap(o=>o.items).reduce((s,i)=>s+i.qty*i.price,0)));
const cnt={};orders.forEach(o=>{const k=o.customer.toLowerCase();cnt[k]=(cnt[k]||0)+1});
add('orders.json',"Return an object mapping each customer name, lowercased, to the number of orders (of any status) placed by that customer.",cnt);
add('package.json',"Return an object with keys: \"name\" (the package name), \"depCount\" (number of entries in dependencies), \"devDepCount\" (number of entries in devDependencies), \"scripts\" (array of script names sorted ascending).",
 {name:pkg.name,depCount:Object.keys(pkg.dependencies).length,devDepCount:Object.keys(pkg.devDependencies).length,scripts:Object.keys(pkg.scripts).sort(cmp)});
add('issues.json',"The file holds an array of issues. Consider only issues whose state is \"open\". Return an array of the ids (numbers) of the 3 issues with the highest comments value, ordered by comments descending, ties broken by id ascending.",
 issues.filter(i=>i.state==='open').sort((a,b)=>b.comments-a.comments||a.id-b.id).slice(0,3).map(i=>i.id));
add('issues.json',"Return an array of the distinct label names across all issues, lowercased, sorted ascending. Issues with a missing labels field count as having no labels.",
 [...new Set(issues.flatMap(i=>i.labels||[]).map(l=>l.toLowerCase()))].sort(cmp));
const as={};issues.filter(i=>i.state==='open').forEach(i=>{const k=i.assignee?i.assignee.login:'unassigned';as[k]=(as[k]||0)+1});
add('issues.json',"Consider only open issues. Return an object mapping assignee login to the number of open issues assigned to that person; issues whose assignee is null or missing are counted under the key \"unassigned\".",as);
const lines=fs.readFileSync('access.log','utf8').split('\n').filter(l=>l.trim()).map(l=>{const p=l.split(' ');return{level:p[1],service:p[2],rest:p.slice(3).join(' ')}});
const ec={};lines.filter(l=>l.level==='ERROR').forEach(l=>ec[l.service]=(ec[l.service]||0)+1);
add('access.log',"Each non-blank line has the form \"<timestamp> <LEVEL> <service> <message>\". Return an object mapping service name to the number of lines with level ERROR; omit services with no ERROR lines.",ec);
const us=new Set();lines.filter(l=>l.level==='ERROR'||l.level==='WARN').forEach(l=>{const m=l.rest.match(/(?:^|\s)user=(\S+)/);if(m)us.add(m[1])});
add('access.log',"Return a sorted (ascending) array of the distinct user names, taken from the \"user=<name>\" token in the message, found on lines with level ERROR or WARN. Lines without a user= token are ignored.",[...us].sort(cmp));
const rows=fs.readFileSync('servers.csv','utf8').trim().split('\n').slice(1).map(l=>l.split(','));
const g={};rows.filter(r=>r[4].toLowerCase()==='up'&&r[2]!=='').forEach(r=>(g[r[1]]=g[r[1]]||[]).push(Number(r[2])));
const av={};for(const k in g)av[k]=Math.round(g[k].reduce((a,b)=>a+b,0)/g[k].length*10)/10;
add('servers.csv',"The first line is a header (host,region,cpu,mem_gb,status). Consider only rows whose status equals \"up\" ignoring case and whose cpu is not empty. Return an object mapping region to the average cpu of those rows, rounded to 1 decimal place. Regions with no such rows are omitted.",av);
const env={};fs.readFileSync('settings.env','utf8').split('\n').forEach(l=>{if(!l.trim()||l.startsWith('#'))return;const i=l.indexOf('=');const k=l.slice(0,i),v=l.slice(i+1);if(k.toUpperCase().startsWith('DB_'))env[k.slice(3).toLowerCase()]=v});
add('settings.env',"Lines are KEY=value (split at the first \"=\"); blank lines and lines starting with # are ignored. Return an object of the entries whose key starts with \"DB_\" ignoring case, with the prefix removed and the remaining key lowercased; values stay strings exactly as written.",env);
add('config.json',"Return an array of objects {name, timeout, team} for services whose enabled is true, sorted by name ascending. timeout is the service's timeout, or defaults.timeout if the service's timeout is missing or null (0 is a valid value and is kept). team is owner.team, or the string \"none\" if owner is null, missing, or has no team.",
 config.services.filter(s=>s.enabled===true).map(s=>({name:s.name,timeout:s.timeout==null?config.defaults.timeout:s.timeout,team:(s.owner&&s.owner.team)||'none'})).sort((a,b)=>cmp(a.name,b.name)));
add('api_response.json',"From results, keep entries whose score is a number >= 50 (missing or null excluded). Sort by score descending. Return an array of strings of the form \"<first> <last>: <tags joined with |>\" using profile.first and profile.last; a missing tags field is treated as an empty list (so the string ends with \": \").",
 api.results.filter(r=>typeof r.score==='number'&&r.score>=50).sort((a,b)=>b.score-a.score).map(r=>`${r.profile.first} ${r.profile.last}: ${(r.tags||[]).join('|')}`));
const words="The cat saw the dog; a Dog saw THE cat and a bird. Bird, dog!";
const wc={};words.toLowerCase().match(/[a-z]+/g).forEach(w=>wc[w]=(wc[w]||0)+1);
add(null,`Given the text: "${words}" — split into words made of letters only (ignore punctuation), lowercase them, and count occurrences. Return an array of the 3 most frequent words as objects {"word": string, "count": number}, ordered by count descending, ties broken by word ascending.`,
 Object.entries(wc).sort((a,b)=>b[1]-a[1]||cmp(a[0],b[0])).slice(0,3).map(([word,count])=>({word,count})));
W('tasks.json',T);
console.log(JSON.stringify(T.map(t=>[t.id,t.expected])));

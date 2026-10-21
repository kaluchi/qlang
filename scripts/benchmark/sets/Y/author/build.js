const fs=require('fs');
const w=(f,d)=>fs.writeFileSync(f,typeof d==='string'?d:JSON.stringify(d,null,2));
const users={page:1,data:{users:[
{id:1,name:"Alice",email:"alice@Example.com",active:true,profile:{country:"DE",age:34},roles:["admin","dev"]},
{id:2,name:"bob",email:null,active:true,profile:{country:"us",age:28},roles:["dev"]},
{id:3,name:"Carla",email:"carla@mail.org",active:false,profile:{country:"de",age:null},roles:[]},
{id:4,name:"Dmitri",email:"dmitri@example.com",active:true,profile:null,roles:["ops"]},
{id:5,name:"Eve",email:"eve@MAIL.org",active:true,profile:{country:"De",age:41},roles:["dev","ops"]},
{id:6,name:"Frank",active:false,profile:{age:52},roles:["dev"]},
{id:7,name:"Grace",email:"grace@corp.io",active:true,profile:{country:"FR",age:23},roles:["admin"]},
{id:8,name:"Heidi",email:"heidi@corp.io",active:true,profile:{country:"fr"},roles:["dev"]}]}};
w('users.json',users);
const issues=[
{id:101,title:"Crash on start",status:"open",assignee:"ann",labels:["bug","p1"],comments:[1,2,3,4]},
{id:102,title:"Add dark mode",status:"open",assignee:null,labels:["feature"],comments:[1]},
{id:103,title:"Typo in docs",status:"closed",assignee:"bob",labels:["docs"],comments:[]},
{id:104,title:"Slow query",status:"open",assignee:"bob",labels:["bug","perf"],comments:[1,2,3,4]},
{id:105,title:"Upgrade deps",status:"open",assignee:"ann",labels:[],comments:[1,2]},
{id:106,title:"Memory leak",status:"closed",assignee:"ann",labels:["bug"],comments:[1,2,3,4,5,6]},
{id:107,title:"Login fails",status:"open",assignee:"cy",labels:["bug"]},
{id:108,title:"Refactor auth",status:"open",assignee:null,labels:["tech-debt"],comments:[1,2,3]}];
w('issues.json',issues);
const manifest={name:"demo-app",version:"2.3.1",scripts:{build:"tsc",test:"jest",lint:"eslint ."},
dependencies:{express:"^4.18.2",lodash:"~4.17.21",zod:"^3.22.0",chalk:"5.3.0"},
devDependencies:{jest:"^29.7.0",typescript:"^5.3.3",eslint:"~8.56.0",zod:"^3.22.0"}};
w('manifest.json',manifest);
const logs=`2026-03-01T10:00:01Z INFO auth user login ok
2026-03-01T10:00:05Z ERROR db connection timeout
2026-03-01T10:01:10Z WARN auth token near expiry
2026-03-01T10:02:00Z ERROR api upstream 502
2026-03-01T10:02:30Z INFO api request served
2026-03-01T10:03:44Z ERROR db deadlock detected
2026-03-01T10:04:00Z ERROR db connection timeout
2026-03-01T10:05:12Z WARN cache eviction rate high
2026-03-01T10:06:00Z INFO cache warmed
2026-03-01T10:07:00Z ERROR auth invalid signature
`;
w('logs.txt',logs);
const orders=`id,customer,item,qty,price,status
1,Acme,widget,10,2.50,paid
2,Beta,gadget,3,19.99,PAID
3,Acme,gizmo,1,100.00,cancelled
4,Cyan,widget,7,2.50,pending
5,Beta,widget,20,2.45,Paid
6,Cyan,gizmo,2,99.90,paid
7,Acme,gadget,5,19.99,pending
8,Dune,widget,4,2.50,cancelled
`;
w('orders.csv',orders);
const config={app:{name:"hub",debug:false},services:{
web:{port:3000,enabled:true},api:{enabled:true},worker:{port:9100,enabled:false},
cache:{port:6379},metrics:{port:null,enabled:true}}};
w('config.json',config);
const env=`# database
DB_HOST=localhost
DB_PORT=5432
db_name=ignored

APP_ENV=prod
DB_USER = admin
# DB_PASS=secret
DB_SSL=true
`;
w('env.txt',env);

const T=[];const add=(data,text,expected)=>T.push({id:'Y'+(T.length+1),data,text,expected});
const U=users.data.users;
add('users.json',"The file is an API response; the user records are in data.users. Return a number: how many users have profile.country equal to \"de\", compared case-insensitively. A null profile or a missing country does not match.",
 U.filter(u=>u.profile&&typeof u.profile.country==='string'&&u.profile.country.toLowerCase()==='de').length);
add('users.json',"In data.users, take users whose email is not null and not missing. Extract the domain (the part after '@'), lowercase it, and return an array of the distinct domains sorted alphabetically ascending.",
 [...new Set(U.filter(u=>u.email).map(u=>u.email.split('@')[1].toLowerCase()))].sort());
{const a=U.filter(u=>u.active&&u.profile&&typeof u.profile.age==='number').map(u=>u.profile.age);
add('users.json',"Return a number: the average of profile.age over users in data.users that have active equal to true and a numeric profile.age (ignore null/missing profile or age). Round to 1 decimal place.",
 Math.round(a.reduce((x,y)=>x+y,0)/a.length*10)/10);}
{const o={};issues.filter(i=>i.status==='open').forEach(i=>{const k=i.assignee??'unassigned';o[k]=(o[k]||0)+1});
add('issues.json',"The file is an array of issues. Considering only issues with status \"open\", return an object mapping assignee to the number of such issues. Issues whose assignee is null are counted under the key \"unassigned\".",o);}
add('issues.json',"Each issue may have a comments array (missing means 0 comments). Return an array of the ids of the 3 issues with the most comments, ordered by comment count descending, ties broken by id ascending.",
 [...issues].sort((a,b)=>(b.comments||[]).length-(a.comments||[]).length||a.id-b.id).slice(0,3).map(i=>i.id));
{const s=new Set();['dependencies','devDependencies'].forEach(k=>Object.entries(manifest[k]||{}).forEach(([n,v])=>{if(v.startsWith('^'))s.add(n)}));
add('manifest.json',"Look at both dependencies and devDependencies of this package manifest. Return an array of distinct package names whose version string starts with \"^\", sorted alphabetically ascending.",[...s].sort());}
{const names=new Set([...Object.keys(manifest.dependencies),...Object.keys(manifest.devDependencies)]);
add('manifest.json',"Return an object with keys: \"name\" (the package name), \"major\" (the major part of the package version as a number), \"depCount\" (the number of distinct package names across dependencies and devDependencies combined), \"hasTest\" (boolean: whether scripts contains a key \"test\").",
 {name:manifest.name,major:+manifest.version.split('.')[0],depCount:names.size,hasTest:'test' in manifest.scripts});}
{const o={};logs.trim().split('\n').forEach(l=>{const p=l.split(' ');if(p[1]==='ERROR')o[p[2]]=(o[p[2]]||0)+1});
add('logs.txt',"Each line of this plain-text log has the form \"<timestamp> <LEVEL> <service> <message...>\", separated by single spaces. Return an object mapping service to the number of ERROR lines for that service; omit services with no errors.",o);}
{const s=new Set();logs.trim().split('\n').forEach(l=>{const p=l.split(' ');if(p[1]==='ERROR'||p[1]==='WARN')s.add(p[2])});
add('logs.txt',"Each line has the form \"<timestamp> <LEVEL> <service> <message...>\". Return an array of distinct services that have at least one WARN or ERROR line, sorted alphabetically ascending.",[...s].sort());}
const rows=orders.trim().split('\n').slice(1).map(l=>{const c=l.split(',');return{id:+c[0],customer:c[1],item:c[2],qty:+c[3],price:+c[4],status:c[5]}});
add('orders.csv',"This is CSV text with a header row (id,customer,item,qty,price,status). Return a number: the sum of qty*price over rows whose status is \"paid\" compared case-insensitively, rounded to 2 decimal places.",
 Math.round(rows.filter(r=>r.status.toLowerCase()==='paid').reduce((s,r)=>s+r.qty*r.price,0)*100)/100);
{const o={};rows.filter(r=>r.status.toLowerCase()!=='cancelled').forEach(r=>o[r.customer]=(o[r.customer]||0)+r.qty);
add('orders.csv',"CSV text with a header row. Ignoring rows whose status is \"cancelled\" (case-insensitive), sum qty per customer and return the top 2 customers as an array of objects {\"customer\": string, \"total\": number}, ordered by total descending, ties by customer name ascending.",
 Object.entries(o).map(([customer,total])=>({customer,total})).sort((a,b)=>b.total-a.total||a.customer.localeCompare(b.customer)).slice(0,2));}
{const o={};Object.entries(config.services).forEach(([n,s])=>{if(s.enabled!==false)o[n]=s.port??8080});
add('config.json',"For each entry in services, skip those whose enabled is exactly false (a missing enabled counts as enabled). Return an object mapping service name to its port; if port is missing or null use 8080.",o);}
{const o={};env.split('\n').forEach(l=>{l=l.trim();if(!l||l.startsWith('#'))return;const i=l.indexOf('=');const k=l.slice(0,i).trim(),v=l.slice(i+1).trim();if(k.startsWith('DB_'))o[k.slice(3).toLowerCase()]=v});
add('env.txt',"This is a dotenv-style text file: KEY=value lines, blank lines, and comment lines starting with '#'. Keys are case-sensitive. Take only keys that start with the exact prefix \"DB_\" (uppercase), strip the prefix, lowercase the rest, and trim whitespace around keys and values. Return an object of these keys to their string values.",o);}
{const words="the Quick brown fox jumps over the quick Dog and the lazy dog Fox";const c={};words.split(' ').forEach(x=>{x=x.toLowerCase();c[x]=(c[x]||0)+1});
add(null,"Given the text \""+words+"\", split it on single spaces, lowercase each word, and count occurrences. Return the top 3 words as an array of objects {\"word\": string, \"count\": number}, ordered by count descending, ties by word ascending.",
 Object.entries(c).map(([word,count])=>({word,count})).sort((a,b)=>b.count-a.count||a.word.localeCompare(b.word)).slice(0,3));}
w('tasks.json',T);
console.log(JSON.stringify(T.map(t=>t.expected)));

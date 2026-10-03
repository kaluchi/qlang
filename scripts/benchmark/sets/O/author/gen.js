const fs=require('fs');
const w=(f,o)=>fs.writeFileSync(f,typeof o==='string'?o:JSON.stringify(o,null,2));
const orders=[
{id:1,customer:"Ann",status:"paid",total:120.5,region:"EU",items:[{sku:"A1",qty:2},{sku:"B2",qty:1}]},
{id:2,customer:"Bob",status:"Paid",total:80,region:"US",items:[{sku:"A1",qty:1}]},
{id:3,customer:"Cid",status:"cancelled",total:50,region:"EU",items:[{sku:"C3",qty:4}]},
{id:4,customer:"Dee",status:"PAID",total:null,region:"APAC",items:[{sku:"B2",qty:3},{sku:"C3",qty:1}]},
{id:5,customer:"Eve",status:"pending",total:35.25,region:"US",items:[]},
{id:6,customer:"Fay",status:"paid",region:"EU",items:[{sku:"D4",qty:5}]},
{id:7,customer:"Gus",status:"Cancelled",total:10,region:"US",items:[{sku:"A1",qty:3}]},
{id:8,customer:"Hal",status:"paid",total:200,region:"US",items:[{sku:"D4",qty:2},{sku:"A1",qty:1}]},
{id:9,customer:"Ivy",status:"pending",total:15,region:"EU",items:[{sku:"E5",qty:1}]},
{id:10,customer:"Jon",status:"shipped",total:60,region:"APAC",items:[{sku:"B2",qty:2}]}];
const issues=[
{number:1,title:"Crash on start",state:"open",labels:["bug","P1"],assignee:{login:"Alice"},comments:5},
{number:2,title:"Add dark mode",state:"open",labels:["feature"],assignee:null,comments:2},
{number:3,title:"Memory leak",state:"open",labels:["Bug"],assignee:{login:"bob"},comments:9},
{number:4,title:"Typo in docs",state:"closed",labels:["docs"],assignee:{login:"carol"},comments:0},
{number:5,title:"Slow query",state:"open",labels:["BUG","perf"],assignee:{login:"ALICE"},comments:5},
{number:6,title:"Login fails",state:"closed",labels:["bug"],assignee:{login:"Bob"},comments:7},
{number:7,title:"Refactor auth",state:"open",labels:[],assignee:null,comments:1},
{number:8,title:"Null pointer",state:"open",labels:["bug"],comments:3},
{number:9,title:"Upgrade deps",state:"closed",labels:["chore"],assignee:{login:"dave"},comments:4},
{number:10,title:"Race condition",state:"open",labels:["bug","P1"],assignee:{login:"carol"},comments:5}];
const pkg={name:"demo",version:"1.2.0",scripts:{build:"tsc",test:"jest"},dependencies:{express:"^4.18.2",lodash:"~4.17.21",zod:"^3.22.0",axios:"1.6.0"},devDependencies:{jest:"^29.7.0",typescript:"^5.3.3",eslint:"~8.56.0",prettier:"3.1.0"}};
const users=[
{id:1,name:"Ann",email:"ann@x.io",address:{city:"Berlin"}},
{id:2,name:"Bob",address:{city:"berlin"}},
{id:3,name:"Cy",email:null,address:null},
{id:4,name:"Di",email:"di@x.io",address:{city:"Paris"}},
{id:5,name:"Ed",email:"ed@x.io",address:{city:"BERLIN"}},
{id:6,name:"Flo",email:"flo@x.io"},
{id:7,name:"Gil",email:"gil@x.io",address:{city:null}}];
const config={env:"prod",services:[
{name:"api",port:8080,enabled:true},{name:"db",port:5432},{name:"cache",port:6379,enabled:false},
{name:"queue",port:5672,enabled:true},{name:"cron",enabled:true},{name:"web",port:80,enabled:false}]};
const events={status:"ok",data:{items:[
{id:"e1",type:"click",duration_ms:120},{id:"e2",type:"view",duration_ms:300},{id:"e3",type:"click",duration_ms:null},
{id:"e4",type:"click",duration_ms:85},{id:"e5",type:"Click",duration_ms:40},{id:"e6",type:"click"},{id:"e7",type:"scroll",duration_ms:10},{id:"e8",type:"click",duration_ms:201}]},paging:{next:null}};
const log=`2026-03-01T10:00:00Z GET /api/users 200 12ms
2026-03-01T10:00:01Z GET /api/orders 500 80ms
2026-03-01T10:00:02Z POST /api/orders 201 45ms
2026-03-01T10:00:03Z GET /api/users 200 10ms
2026-03-01T10:00:04Z GET /health 200 2ms
2026-03-01T10:00:05Z GET /api/orders 200 33ms
2026-03-01T10:00:06Z GET /health 503 1ms
2026-03-01T10:00:07Z GET /api/items 404 5ms
2026-03-01T10:00:08Z GET /health 200 2ms
2026-03-01T10:00:09Z DELETE /api/users 204 9ms
`;
const csv=`name,dept,salary,start
Ann,Eng,100,2020-01-10
Bob,Eng,120,2019-05-01
Cy,Ops,80,2021-03-15
Di,Ops,,2022-07-01
Ed,Sales,70,2018-11-30
Flo,Eng,95,2023-02-20
Gil,Sales,90,2020-09-09
Hu,Ops,86,2017-04-04
`;
const req=`# deps
Flask==2.3.1
requests>=2.28

numpy==1.26.0
Django==4.2.7
pytest>=7.0
# end
PyYAML==6.0.1
`;
w('orders.json',orders);w('issues.json',issues);w('package.json',pkg);w('users.json',users);w('config.json',config);w('events.json',events);w('access.log',log);w('staff.csv',csv);w('requirements.txt',req);
const T=[];const add=(input,text,expected)=>T.push({id:'O'+(T.length+1),input,text,expected});
const lc=s=>String(s).toLowerCase();
const cmp=(a,b)=>a<b?-1:a>b?1:0;
add('orders.json','Sum the "total" of all orders whose "status" equals "paid" ignoring case. Orders with a null or missing total count as 0. Return a single number.',
 orders.filter(o=>lc(o.status)==='paid').reduce((a,o)=>a+(o.total??0),0));
{const r={};orders.filter(o=>lc(o.status)!=='cancelled').forEach(o=>r[o.region]=(r[o.region]||0)+1);
add('orders.json','Count orders per "region", excluding orders whose status is "cancelled" (case-insensitive). Return an object mapping region to count.',r);}
add('issues.json','Among issues with state "open" that have a label equal to "bug" (case-insensitive), sort by "comments" descending, ties by "number" ascending, and return the "number" values of the first 3 as an array of numbers.',
 issues.filter(i=>i.state==='open'&&i.labels.some(l=>lc(l)==='bug')).sort((a,b)=>b.comments-a.comments||a.number-b.number).slice(0,3).map(i=>i.number));
add('issues.json','Collect the distinct assignee logins ("assignee.login") of all issues, skipping issues whose assignee is null or missing. Lowercase each login before deduplicating. Return an array of strings sorted alphabetically ascending.',
 [...new Set(issues.filter(i=>i.assignee).map(i=>lc(i.assignee.login)))].sort());
add('package.json','List the names of all packages in "dependencies" and "devDependencies" combined whose version string starts with "^". Return an array of strings sorted alphabetically ascending.',
 Object.entries({...pkg.dependencies,...pkg.devDependencies}).filter(([k,v])=>v.startsWith('^')).map(e=>e[0]).sort());
add('users.json','For users whose "address.city" equals "berlin" ignoring case (users with a missing or null address or city are excluded), return an array of objects {"id", "name", "email"} in the original order. If email is missing or null, use null.',
 users.filter(u=>u.address&&u.address.city&&lc(u.address.city)==='berlin').map(u=>({id:u.id,name:u.name,email:u.email??null})));
{const r={};config.services.filter(s=>s.enabled!==false&&s.port!=null).forEach(s=>r[s.name]=s.port);
add('config.json','From "services", take those that are enabled ("enabled" is true, or missing which means enabled; false means disabled) and that have a "port". Return an object mapping service name to port.',r);}
{const d=events.data.items.filter(e=>e.type==='click'&&e.duration_ms!=null).map(e=>e.duration_ms);
add('events.json','Among "data.items" with "type" exactly "click" (case-sensitive), compute the average of "duration_ms", ignoring items where it is null or missing. Round to 2 decimal places. Return a number.',Math.round(d.reduce((a,b)=>a+b)/d.length*100)/100);}
{const c={};log.trim().split('\n').forEach(l=>{const p=l.split(' ')[2];c[p]=(c[p]||0)+1});
add('access.log','Each line is "timestamp METHOD path status duration". Count requests per path (all methods, all statuses) and return the top 2 paths as an array of objects {"path", "count"}, sorted by count descending, ties by path ascending.',
 Object.entries(c).sort((a,b)=>b[1]-a[1]||cmp(a[0],b[0])).slice(0,2).map(([path,count])=>({path,count})));}
{const g={};csv.trim().split('\n').slice(1).map(l=>l.split(',')).forEach(([n,d,s])=>{if(s!=='')(g[d]??=[]).push(+s)});
const r={};for(const k in g)r[k]=Math.round(g[k].reduce((a,b)=>a+b)/g[k].length*10)/10;
add('staff.csv','The file is CSV with a header row. Compute the average "salary" per "dept", ignoring rows with an empty salary. Round each average to 1 decimal place. Return an object mapping dept to average.',r);}
add('requirements.txt','Ignore blank lines and lines starting with "#". Take the lines that pin an exact version with "==". Lowercase the package names (the part before "=="), sort them alphabetically ascending, and return them joined with "," (no spaces) as one string.',
 req.split('\n').filter(l=>l.trim()&&!l.startsWith('#')&&l.includes('==')).map(l=>lc(l.split('==')[0])).sort().join(','));
{const s="Alpha:3, beta:5, ALPHA:4, gamma:1, Beta:2";const r={};s.split(',').forEach(p=>{const [k,v]=p.trim().split(':');r[lc(k)]=(r[lc(k)]||0)+ +v});
add(null,'The input string is "'+s+'". It is a comma-separated list of name:number pairs (spaces around pairs should be trimmed). Sum the numbers per name, treating names case-insensitively and using the lowercase name as the key. Return an object mapping name to sum.',r);}
{const c={};orders.forEach(o=>o.items.forEach(i=>c[i.sku]=(c[i.sku]||0)+i.qty));
add('orders.json','Across all orders (any status), sum "qty" per item "sku". Return the top 3 as an array of objects {"sku", "qty"}, sorted by qty descending, ties by sku ascending.',
 Object.entries(c).sort((a,b)=>b[1]-a[1]||cmp(a[0],b[0])).slice(0,3).map(([sku,qty])=>({sku,qty})));}
add('issues.json','Return a boolean: true if every issue with state "closed" has a non-null assignee, false otherwise.',
 issues.filter(i=>i.state==='closed').every(i=>i.assignee!=null));
w('tasks.json',T);console.log(JSON.stringify(T.map(t=>t.expected)));

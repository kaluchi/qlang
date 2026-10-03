const fs=require('fs');
const w=(n,d)=>fs.writeFileSync(n,typeof d==='string'?d:JSON.stringify(d,null,2));
const users=[
{id:1,name:"Alice",email:"Alice@Example.com",active:true,profile:{country:"de",age:34}},
{id:2,name:"bob",email:null,active:true,profile:{country:"US",age:28}},
{id:3,name:"Carol",email:"carol@example.com",active:false,profile:{country:"DE",age:41}},
{id:4,name:"dave",email:"DAVE@example.com",active:true,profile:{country:"fr"}},
{id:5,name:"Eve",active:true,profile:{country:null,age:null}},
{id:6,name:"Frank",email:"frank@example.com",active:true,profile:{country:"us",age:52}},
{id:7,name:"Grace",email:"grace@example.com",active:true},
{id:8,name:"Heidi",email:"heidi@example.com",active:false,profile:{country:"De",age:23}}];
w('users.json',users);
const issues=[
{id:101,title:"Crash on start",state:"open",labels:["Bug","urgent"],assignee:"ann",priority:3},
{id:102,title:"Add dark mode",state:"open",labels:["feature"],assignee:null,priority:1},
{id:103,title:"Memory leak",state:"closed",labels:["bug"],assignee:"bo",priority:3},
{id:104,title:"Typo in docs",state:"open",labels:["docs","Bug"],assignee:"ann",priority:1},
{id:105,title:"Slow query",state:"open",labels:["BUG","performance"],priority:2},
{id:106,title:"Upgrade deps",state:"open",labels:[],assignee:"bo",priority:2},
{id:107,title:"Login fails",state:"open",labels:["bug","urgent"],assignee:"cy",priority:3},
{id:108,title:"Refactor auth",state:"closed",labels:["Feature","tech-debt"],assignee:"ann",priority:2},
{id:109,title:"Broken link",state:"open",labels:["docs"],assignee:"bo",priority:1}];
w('issues.json',issues);
const pkg={name:"demo",version:"1.2.0",scripts:{test:"jest",build:"tsc"},
dependencies:{express:"^4.18.2",lodash:"~4.17.21",zod:"3.22.0",axios:"^1.6.0"},
devDependencies:{jest:"^29.7.0",typescript:"5.3.3",eslint:"^8.56.0"}};
w('package.json',pkg);
const orders=[
{id:"o1",customer:"acme",status:"paid",coupon:null,items:[{sku:"A",qty:2,price:10.5},{sku:"B",qty:1,price:3.25}]},
{id:"o2",customer:"globex",status:"cancelled",items:[{sku:"A",qty:5,price:10.5}]},
{id:"o3",customer:"acme",status:"shipped",coupon:"X1",items:[{sku:"C",qty:3,price:7.99}]},
{id:"o4",customer:"initech",status:"paid",coupon:null,items:[{sku:"B",qty:10,price:3.25},{sku:"D",qty:1,price:99.99}]},
{id:"o5",customer:"globex",status:"pending",items:[{sku:"C",qty:1,price:7.99}]},
{id:"o6",customer:"umbrella",status:"shipped",items:[]},
{id:"o7",customer:"initech",status:"paid",coupon:null,items:[{sku:"A",qty:1,price:10.5}]}];
w('orders.json',orders);
const config={env:"prod",services:{api:{host:"api.local",port:8443,tls:{enabled:true}},web:{host:"web.local",tls:{enabled:true}},db:{host:"db.local",port:5432},cache:{host:"cache.local",port:6379,tls:{enabled:false}},auth:{host:"auth.local",port:9000,tls:{}},queue:{host:"q.local",port:5672,tls:{enabled:true},replicas:null}}};
w('config.json',config);
const logs=`2026-03-01T10:00:01Z INFO api request ok
2026-03-01T10:00:05Z ERROR db Connection Timeout after 30s
2026-03-01T10:00:09Z WARN api slow response
2026-03-01T10:01:00Z ERROR api upstream failed
2026-03-01T10:01:30Z WARN cache TIMEOUT on get
2026-03-01T10:02:00Z INFO db reconnected
2026-03-01T10:02:10Z ERROR api bad gateway
2026-03-01T10:03:00Z INFO web timeout setting loaded
2026-03-01T10:03:30Z ERROR auth token invalid
2026-03-01T10:04:00Z ERROR db deadlock detected
`;
w('logs.txt',logs);
const csv=`name,dept,salary,start
Ann,eng,100000,2020-01-15
Bob,eng,90000,2019-06-01
Cy,ops,,2021-03-10
Di,ops,70000,2018-11-20
Ed,sales,65000,2022-07-04
Flo,eng,,2023-02-01
Gus,sales,72001,2017-09-09
Hal,hr,,2016-05-05
`;
w('people.csv',csv);

const lines=logs.trim().split('\n').map(l=>{const [ts,level,service,...r]=l.split(' ');return{ts,level,service,msg:r.join(' ')}});
const rows=csv.trim().split('\n').slice(1).map(l=>l.split(',')).map(([name,dept,salary,start])=>({name,dept,salary,start}));
const r2=x=>Math.round(x*100)/100;
const open=issues.filter(i=>i.state==='open');
const hasBug=i=>i.labels.some(l=>l.toLowerCase()==='bug');
const T=[];
const add=(input,text,expected)=>T.push({id:'M'+(T.length+1),input,text,expected});
add('users.json','Input is an array of users. Take users with active === true and a non-null, present email. Return an array of their emails converted to lowercase, sorted ascending by plain string comparison.',
 users.filter(u=>u.active===true&&u.email).map(u=>u.email.toLowerCase()).sort());
const ages=users.map(u=>u.profile&&u.profile.age).filter(a=>typeof a==='number');
add('users.json','Compute the average of profile.age over users that have a numeric profile.age (skip users with missing profile, missing age, or null age). Return a number rounded to 1 decimal place.',
 Math.round(ages.reduce((a,b)=>a+b,0)/ages.length*10)/10);
const cc={};users.forEach(u=>{const c=u.profile&&u.profile.country;if(c)cc[c.toUpperCase()]=(cc[c.toUpperCase()]||0)+1});
add('users.json','Count users per country using profile.country, compared case-insensitively. Skip users whose country is missing or null. Return an object whose keys are the uppercase country codes and whose values are the counts.',cc);
add('issues.json','Take issues with state "open" that have a label equal to "bug" (case-insensitive). Sort them by priority descending, ties by id ascending. Return an array of the ids of the first 2 issues in this order.',
 open.filter(hasBug).sort((a,b)=>b.priority-a.priority||a.id-b.id).slice(0,2).map(i=>i.id));
const ac={};open.forEach(i=>{const k=i.assignee||'unassigned';ac[k]=(ac[k]||0)+1});
add('issues.json','Count issues with state "open" per assignee. An issue whose assignee is null or missing is counted under the key "unassigned". Return an object mapping assignee to count.',ac);
add('issues.json','Collect all labels from all issues (any state), lowercase them, remove duplicates, and return an array sorted ascending by plain string comparison.',
 [...new Set(issues.flatMap(i=>i.labels.map(l=>l.toLowerCase())))].sort());
const all={...pkg.dependencies,...pkg.devDependencies};
add('package.json','Consider only "dependencies". Return an array of objects {"name","version"} where version is the version string with a single leading "^" or "~" removed (if present). Sort by name ascending.',
 Object.keys(pkg.dependencies).sort().map(n=>({name:n,version:pkg.dependencies[n].replace(/^[\^~]/,'')})));
const tot=o=>o.items.reduce((s,i)=>s+i.qty*i.price,0);
add('orders.json','Sum qty*price over all items of all orders whose status is "paid" or "shipped". Return the sum as a number rounded to 2 decimals.',
 r2(orders.filter(o=>['paid','shipped'].includes(o.status)).reduce((s,o)=>s+tot(o),0)));
const sp={};orders.filter(o=>o.status!=='cancelled').forEach(o=>sp[o.customer]=(sp[o.customer]||0)+tot(o));
add('orders.json','For orders whose status is not "cancelled", compute each customer\'s total spend (sum of qty*price over items; orders with no items add 0). Return the top 2 customers as an array of objects {"customer","total"} sorted by total descending (ties by customer name ascending), with total rounded to 2 decimals.',
 Object.entries(sp).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,2).map(([c,t])=>({customer:c,total:r2(t)})));
add('config.json','Look at config.services (an object keyed by service name). Keep services where tls.enabled is exactly true (a missing tls or missing enabled counts as false). Return an array of "host:port" strings, in ascending order of service name; if port is missing use 80.',
 Object.keys(config.services).sort().filter(k=>{const t=config.services[k].tls;return t&&t.enabled===true}).map(k=>config.services[k].host+':'+(config.services[k].port??80)));
const ec={};lines.filter(l=>l.level==='ERROR').forEach(l=>ec[l.service]=(ec[l.service]||0)+1);
add('logs.txt','Each line is "<timestamp> <LEVEL> <service> <message...>" separated by single spaces. Count lines with level ERROR per service. Return an object mapping service to count, including only services with at least one ERROR.',ec);
add('logs.txt','Find lines with level WARN or ERROR whose message contains the word "timeout" (case-insensitive substring). Return the distinct service names of those lines as an array sorted ascending.',
 [...new Set(lines.filter(l=>['WARN','ERROR'].includes(l.level)&&l.msg.toLowerCase().includes('timeout')).map(l=>l.service))].sort());
const ds={};rows.filter(r=>r.salary!=='').forEach(r=>{(ds[r.dept]??=[]).push(+r.salary)});
const avg={};Object.keys(ds).forEach(d=>avg[d]=Math.round(ds[d].reduce((a,b)=>a+b,0)/ds[d].length));
add('people.csv','The file is CSV with a header row (name,dept,salary,start). Compute the average salary per dept, ignoring rows with an empty salary; omit departments with no salaries. Return an object mapping dept to the average rounded to the nearest integer (Math.round semantics).',avg);
const sentence="The quick brown fox jumps over the lazy dog. The dog sleeps; the fox runs. A fox is quick.";
const wc={};sentence.toLowerCase().match(/[a-z]+/g).forEach(x=>wc[x]=(wc[x]||0)+1);
add(null,'Given this text: "'+sentence+'" — split it into words (maximal runs of letters A-Z/a-z), lowercase them, and count occurrences. Return the top 3 words as an array of objects {"word","count"}, sorted by count descending, ties by word ascending.',
 Object.entries(wc).sort((a,b)=>b[1]-a[1]||(a[0]<b[0]?-1:1)).slice(0,3).map(([word,count])=>({word,count})));
w('tasks.json',T);
console.log(JSON.stringify(T.map(t=>[t.id,t.expected])));

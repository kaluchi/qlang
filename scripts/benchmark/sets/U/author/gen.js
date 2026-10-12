const fs=require('fs');
const W=(f,o)=>fs.writeFileSync(f,typeof o==='string'?o:JSON.stringify(o,null,2));
W('users.json',{status:"ok",data:{users:[
{id:1,name:"Zoe",active:true,address:{city:"Berlin"}},
{id:2,name:"adam",active:true,address:{city:"berlin"}},
{id:3,name:"Max",active:false,address:{city:"Berlin"}},
{id:4,name:"Lena",active:true,address:null},
{id:5,name:"Ivan",active:true},
{id:6,name:"Bob",active:true,address:{city:"BERLIN"}},
{id:7,name:"Chen",active:true,address:{city:"Paris"}},
{id:8,name:"Eva",active:true,address:{}}]}});
W('orders.json',[
{id:"o1",customer:"ann",status:"paid",items:[{sku:"a",qty:2,price:9.99},{sku:"b",qty:1,price:5}]},
{id:"o2",customer:"bob",status:"pending",items:[{sku:"a",qty:1,price:9.99}]},
{id:"o3",customer:"ann",status:"paid",items:[]},
{id:"o4",customer:"cy",status:"paid"},
{id:"o5",customer:"dee",status:"cancelled",items:[{sku:"c",qty:3,price:2.5}]},
{id:"o6",customer:"bob",status:"paid",items:[{sku:"c",qty:4,price:2.5},{sku:"d",qty:1,price:19.95}]},
{id:"o7",customer:"eve",status:"pending",items:null},
{id:"o8",customer:"ann",status:"paid",items:[{sku:"b",qty:3,price:5}]}]);
W('manifest.json',{name:"demo",version:"1.2.0",dependencies:{express:"^4.18.0",lodash:"~4.17.21",axios:"^1.6.0",chalk:"5.3.0"},devDependencies:{jest:"^29.0.0",eslint:"^8.50.0",axios:"^1.6.0",typescript:"~5.2.2"}});
W('issues.json',[
{id:1,title:"Crash",state:"open",assignee:{login:"kim"},labels:["Bug","urgent"]},
{id:2,title:"Docs",state:"closed",assignee:{login:"kim"},labels:["docs"]},
{id:3,title:"Slow",state:"open",assignee:{login:"lee"},labels:["bug","perf"]},
{id:4,title:"UI",state:"open",assignee:null,labels:["UI"]},
{id:5,title:"API",state:"open",assignee:{login:"abe"},labels:null},
{id:6,title:"Auth",state:"open",assignee:{login:"lee"}},
{id:7,title:"Cache",state:"open",assignee:{login:"abe"},labels:["Perf"]},
{id:8,title:"Typo",state:"closed",assignee:{login:"zed"},labels:["docs","Typo"]},
{id:9,title:"Build",state:"open",assignee:{login:"kim"},labels:[]},
{id:10,title:"Lint",state:"open",assignee:{login:"zed"},labels:["chore"]}]);
W('access.log',`2026-03-01T10:00:01Z GET /api/users 200 120ms
2026-03-01T10:00:02Z POST /api/users 201 250ms
2026-03-01T10:00:05Z GET /api/items 200 80ms
2026-03-01T10:01:00Z GET /api/users 500 300ms
2026-03-01T10:01:30Z GET /api/items 404 15ms
2026-03-01T10:02:00Z DELETE /api/items 204 40ms
2026-03-01T10:02:10Z GET /health 200 5ms
2026-03-01T10:03:00Z GET /api/items 200 95ms
2026-03-01T10:03:30Z POST /api/orders 502 410ms
2026-03-01T10:04:00Z GET /health 200 7ms
2026-03-01T10:04:10Z GET /api/orders 200 130ms
`);
W('products.csv',`name,category,price,stock
Widget,Tools,12.50,5
Gadget,tools,20.00,0
Gizmo,Toys,7.25,12
Doohickey,Toys,,8
Thing,TOYS,9.00,3
Sprocket,Tools,15.75,20
Bauble,Decor,3.10,40
Vase,decor,22.40,2
Lamp,Decor,18.00,0
`);
W('config.json',{defaults:{port:8080,enabled:true},services:{web:{port:80},api:{},cache:{port:6379,enabled:false},db:{port:null},auth:{enabled:true,port:9000},mail:{enabled:null}}});
W('events.json',[
{user:"u1",type:"login",ts:"2026-04-01T08:00:00Z"},
{user:"u2",type:"login",ts:"2026-04-01T09:00:00Z"},
{user:"u1",type:"view",ts:"2026-04-01T08:05:00Z",meta:{page:"/a"}},
{user:"u3",type:"signup",ts:"2026-04-02T07:00:00Z"},
{user:"u2",type:"purchase",ts:"2026-04-01T09:30:00Z",meta:null},
{user:"u1",type:"logout",ts:"2026-04-01T08:45:00Z"},
{user:"u3",type:"login",ts:"2026-04-02T07:01:00Z"},
{user:"u2",type:"logout",ts:"2026-04-01T09:10:00Z"}]);
W('hosts.txt',`# inventory
web-01 | web | prod,eu
web-02 | web | Prod,us

db-01 | db | prod,EU
db-02 | db | staging,eu
cache-01 | cache | PROD
# retired
ci-01 | ci | internal
`);
const R=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const L=f=>fs.readFileSync(f,'utf8').split('\n').filter(x=>x.trim());
const r2=(x,d=2)=>Math.round(x*10**d)/10**d;
const cmp=(a,b)=>a<b?-1:a>b?1:0;
const T=[];const add=(input,text,expected)=>T.push({id:'U'+(T.length+1),input,text,expected});

add('users.json',"The file has data.users. Return an array of the names (as given) of users with active equal to true whose address.city equals \"berlin\" ignoring case. Users with a missing or null address, or without a city, are excluded. Sort the names ascending by plain string comparison of the lowercased name.",
 R('users.json').data.users.filter(u=>u.active===true&&(u.address?.city||'').toLowerCase()==='berlin').map(u=>u.name).sort((a,b)=>cmp(a.toLowerCase(),b.toLowerCase())));

const orders=R('orders.json');
const tot=o=>(o.items||[]).reduce((s,i)=>s+i.qty*i.price,0);
add('orders.json',"Return a number: the total revenue of orders whose status is \"paid\", where an order's revenue is the sum of qty*price over its items. An order with missing or null items contributes 0. Round the final sum to 2 decimal places.",
 r2(orders.filter(o=>o.status==='paid').reduce((s,o)=>s+tot(o),0)));
add('orders.json',"Return an object mapping each customer to the number of their orders that have at least one item (missing, null or empty items means no items). Include only customers with a count of at least 1. Keys are customer values as given.",
 orders.reduce((m,o)=>{if((o.items||[]).length)m[o.customer]=(m[o.customer]||0)+1;return m},{}));

const mf=R('manifest.json');
add('manifest.json',"Consider both dependencies and devDependencies. Return an array of distinct package names whose version string starts with \"^\", sorted ascending (plain string comparison).",
 [...new Set(Object.entries({...mf.dependencies,...mf.devDependencies}).filter(([k,v])=>v.startsWith('^')).map(([k])=>k))].sort(cmp));

const is=R('issues.json');
const cnt={};is.filter(i=>i.state==='open'&&i.assignee).forEach(i=>cnt[i.assignee.login]=(cnt[i.assignee.login]||0)+1);
add('issues.json',"Count issues with state \"open\" per assignee.login (issues with null assignee are ignored). Return the top 3 as an array of objects {\"assignee\": <login>, \"count\": <number>}, ordered by count descending, ties broken by login ascending.",
 Object.entries(cnt).map(([assignee,count])=>({assignee,count})).sort((a,b)=>b.count-a.count||cmp(a.assignee,b.assignee)).slice(0,3));
add('issues.json',"Return the distinct labels used across all issues (a missing or null labels field means none), converted to lower case, as an array sorted ascending.",
 [...new Set(is.flatMap(i=>i.labels||[]).map(s=>s.toLowerCase()))].sort(cmp));

const log=L('access.log').map(l=>{const p=l.split(' ');return{method:p[1],path:p[2],status:+p[3],ms:parseInt(p[4])}});
const g=log.filter(l=>l.method==='GET');
add('access.log',"Each line is: timestamp METHOD path status duration (e.g. \"120ms\"). Return a number: the average duration in milliseconds over lines whose method is GET, rounded to 1 decimal place.",
 r2(g.reduce((s,l)=>s+l.ms,0)/g.length,1));
const pc={};log.forEach(l=>pc[l.path]=(pc[l.path]||0)+1);
add('access.log',"Each line is: timestamp METHOD path status duration. Return the 2 most requested paths (all methods counted) as an array of strings, ordered by request count descending, ties broken by path ascending.",
 Object.entries(pc).sort((a,b)=>b[1]-a[1]||cmp(a[0],b[0])).slice(0,2).map(e=>e[0]));

const rows=L('products.csv').slice(1).map(l=>{const [name,category,price,stock]=l.split(',');return{name,category:category.toLowerCase(),price:price===''?null:+price,stock:+stock}}).filter(r=>r.price!==null);
const cg={};rows.forEach(r=>(cg[r.category]??=[]).push(r.price));
add('products.csv',"CSV with a header row (name,category,price,stock). Ignore rows with an empty price. Return an object mapping each category (lower-cased) to the average price of its remaining rows, rounded to 2 decimal places.",
 Object.fromEntries(Object.entries(cg).map(([k,v])=>[k,r2(v.reduce((a,b)=>a+b,0)/v.length)])));
add('products.csv',"CSV with a header row (name,category,price,stock). Ignore rows with an empty price and rows with stock equal to 0. Return the names of the 3 most expensive remaining products as an array, ordered by price descending, ties by name ascending.",
 rows.filter(r=>r.stock>0).sort((a,b)=>b.price-a.price||cmp(a.name,b.name)).slice(0,3).map(r=>r.name));

const c=R('config.json');
add('config.json',"Each entry of services is a service keyed by name. A service is enabled unless its enabled value is false (missing or null means use defaults.enabled). Its port is its own port, or defaults.port when the port is missing or null. Return an array of {\"name\", \"port\"} objects for enabled services, sorted by name ascending.",
 Object.entries(c.services).filter(([k,s])=>(s.enabled??c.defaults.enabled)!==false).map(([name,s])=>({name,port:s.port??c.defaults.port})).sort((a,b)=>cmp(a.name,b.name)));

const ev=R('events.json');const last={};
ev.forEach(e=>{if(!last[e.user]||e.ts>last[e.user].ts)last[e.user]=e});
add('events.json',"Return an object mapping each user to the type of that user's latest event (greatest ts; ts values are ISO strings of equal format). The input array is not sorted.",
 Object.fromEntries(Object.entries(last).map(([u,e])=>[u,e.type])));

const hs=L('hosts.txt').filter(l=>!l.startsWith('#')).map(l=>{const p=l.split('|').map(s=>s.trim());return{name:p[0],tags:p[2].split(',').map(t=>t.toLowerCase())}});
add('hosts.txt',"Lines have the form \"name | role | tag1,tag2\". Ignore blank lines and lines starting with \"#\". Take hosts having the tag \"prod\" (case-insensitive), upper-case their names, sort ascending, and return them as one string joined with \",\" (no spaces).",
 hs.filter(h=>h.tags.includes('prod')).map(h=>h.name.toUpperCase()).sort(cmp).join(','));

const words=["Apple","banana","apple","Cherry","BANANA","date","fig","Elderberry","cherry","Fig"];
const dw=[...new Set(words.map(w=>w.toLowerCase()))];
add(null,"Given the word list [\"Apple\",\"banana\",\"apple\",\"Cherry\",\"BANANA\",\"date\",\"fig\",\"Elderberry\",\"cherry\",\"Fig\"], lower-case all words and remove duplicates. Return an object {\"count\": <number of distinct words>, \"longest\": <array of the 2 longest distinct words, ordered by length descending, ties alphabetical ascending>}.",
 {count:dw.length,longest:[...dw].sort((a,b)=>b.length-a.length||cmp(a,b)).slice(0,2)});
W('tasks.json',T);
console.log(JSON.stringify(T.map(t=>[t.id,t.expected])));

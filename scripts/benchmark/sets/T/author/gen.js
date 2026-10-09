const fs=require('fs');
const w=(f,d)=>fs.writeFileSync(f,typeof d==='string'?d:JSON.stringify(d,null,2));
const r2=(x,n=2)=>Math.round(x*10**n)/10**n;
const cmp=(a,b)=>a<b?-1:a>b?1:0;

const users={status:"ok",data:{users:[
{id:1,name:"alice",email:"Alice@Example.com",active:true,roles:["admin","dev"],profile:{country:"US",age:34}},
{id:2,name:"Bob",email:null,active:true,roles:["dev"],profile:{country:"DE",age:28}},
{id:3,name:"carol",email:"carol@corp.org",active:false,roles:["Admin"],profile:{country:"US",age:null}},
{id:4,name:"Dave",email:"dave@example.com",active:true,roles:[],profile:{country:null,age:45}},
{id:5,name:"erin",email:"erin@EXAMPLE.COM",active:true,roles:["ADMIN","ops"],profile:{country:"DE",age:31}},
{id:6,name:"Frank",active:false,roles:["ops"]},
{id:7,name:"grace",email:"grace@example.com",active:false,roles:["dev"],profile:{country:"FR",age:22}},
{id:8,name:"Heidi",email:"heidi@example.com.au",active:true,roles:["dev","ops"],profile:{country:"US"}},
{id:9,name:"ivan",email:"ivan@example.com",active:true,roles:["admin"],profile:{country:"FR",age:39}}]}};
w('users.json',users);
const U=users.data.users;

const L=(n)=>({name:n});
const issues=[
{number:101,title:"Crash on start",state:"open",labels:[L("bug"),L("Urgent")],assignee:{login:"alice"},comments:7},
{number:102,title:"Add dark mode",state:"open",labels:[L("feature")],assignee:null,comments:12},
{number:103,title:"Docs typo",state:"closed",labels:[L("docs")],assignee:{login:"bob"},comments:1},
{number:104,title:"Slow query",state:"open",labels:[L("bug"),L("performance")],assignee:{login:"bob"},comments:7},
{number:105,title:"Upgrade deps",state:"open",labels:[],assignee:{login:"alice"},comments:0},
{number:106,title:"Memory leak",state:"closed",labels:[L("BUG")],assignee:{login:"carol"},comments:20},
{number:107,title:"Refactor auth",state:"open",labels:[L("Feature"),L("urgent")],assignee:{login:"alice"},comments:3},
{number:108,title:"Add CSV export",state:"open",labels:[L("feature")],comments:9},
{number:109,title:"Flaky test",state:"open",labels:[L("bug"),L("tests")],assignee:null,comments:7}];
w('issues.json',issues);

const pkg={name:"demo-app",version:"1.2.0",scripts:{build:"tsc -p .",test:"Jest --coverage",lint:"eslint src",
"test:watch":"jest --watch",start:"node dist/index.js"},
dependencies:{express:"^4.18.2",lodash:"~4.17.21",zod:"^3.22.0",chalk:"5.3.0"},
devDependencies:{jest:"^29.7.0",typescript:"^5.3.3",eslint:"^8.56.0","@types/node":"~20.11.0"}};
w('package.json',pkg);

const config={app:"gateway",services:[
{name:"auth",port:8443,enabled:true,env:{region:"eu"}},
{name:"billing",port:9000,enabled:false},
{name:"search",port:8080,enabled:true,env:{region:"us"}},
{name:"Mailer",port:2525,enabled:true},
{name:"admin",port:9090,env:{region:"eu"}},
{name:"cache",port:8000,enabled:true},
{name:"reports",port:9500,enabled:true,env:{}}]};
w('config.json',config);

const logLines=[
"2026-03-01T10:00:01Z INFO api request path=/users ms=120",
"2026-03-01T10:00:05Z ERROR db connection lost retry=1",
"2026-03-01T10:00:07Z INFO api request path=/orders ms=80",
"2026-03-01T10:01:11Z WARN api slow request path=/search ms=950",
"2026-03-01T10:02:30Z ERROR api upstream timeout path=/pay",
"2026-03-01T10:02:31Z ERROR db deadlock detected retry=2",
"2026-03-01T10:03:00Z INFO worker job done ms=401",
"2026-03-01T10:03:44Z ERROR worker job failed id=17",
"2026-03-01T10:04:02Z INFO api request path=/users ms=100",
"2026-03-01T10:05:09Z ERROR db connection lost retry=3"];
w('logs.txt',logLines.join('\n')+'\n');

const csv=`id,customer,product,qty,price,status
1,Acme,widget,10,2.50,shipped
2,Birch,gadget,3,19.99,Shipped
3,Acme,gizmo,1,100.00,cancelled
4,Cobalt,widget,5,,shipped
5,Birch,widget,20,2.50,pending
6,Cobalt,gadget,2,19.99,shipped
7,Acme,gadget,4,19.99,SHIPPED
8,Delta,gizmo,1,100.00,pending
`;
w('orders.csv',csv);
const rows=csv.trim().split('\n').slice(1).map(l=>{const c=l.split(',');return {id:+c[0],customer:c[1],product:c[2],qty:+c[3],price:c[4]===''?null:+c[4],status:c[5]};});

const words=["Banana","apple","Cherry","banana","fig","APPLE","date","kiwi","Fig","elderberry"];
const T=[];
const add=(input,text,expected)=>T.push({id:"T"+(T.length+1),input,text,expected});

add("users.json","The file has data.users. Count the users that are active (active is true) and whose email is not null/missing and ends with \"@example.com\", compared case-insensitively. Return a number.",
 U.filter(u=>u.active&&u.email&&u.email.toLowerCase().endsWith("@example.com")).length);
add("users.json","Take users in data.users having a role equal to \"admin\" (case-insensitive) in their roles array. Return an array of their name strings, exactly as stored, sorted ascending by lowercase name.",
 U.filter(u=>u.roles.some(r=>r.toLowerCase()==="admin")).sort((a,b)=>cmp(a.name.toLowerCase(),b.name.toLowerCase())).map(u=>u.name));
add("users.json","Count users in data.users per profile.country. Users with no profile, or a null/missing country, are counted under the key \"unknown\". Return an object mapping country to count.",
 U.reduce((o,u)=>{const c=(u.profile&&u.profile.country)||"unknown";o[c]=(o[c]||0)+1;return o;},{}));
{const a=U.map(u=>u.profile&&u.profile.age).filter(x=>x!=null);
add("users.json","Compute the average of profile.age over users in data.users that have a non-null age (ignore users with missing profile or null/missing age). Round to 2 decimal places. Return a number.",r2(a.reduce((s,x)=>s+x,0)/a.length));}
add("issues.json","Considering only issues with state \"open\", collect all label names, lowercase them, remove duplicates, and sort ascending alphabetically. Return an array of strings.",
 [...new Set(issues.filter(i=>i.state==="open").flatMap(i=>i.labels.map(l=>l.name.toLowerCase())))].sort());
add("issues.json","Among all issues (any state), take the top 3 by comments descending; ties are broken by number ascending. Return an array of objects {\"number\": <number>, \"assignee\": <assignee login string, or null if assignee is null or missing>} in that order.",
 [...issues].sort((a,b)=>b.comments-a.comments||a.number-b.number).slice(0,3).map(i=>({number:i.number,assignee:i.assignee?i.assignee.login:null})));
add("issues.json","Count open issues per assignee login. Issues with null or missing assignee are excluded. Return an object mapping login to count.",
 issues.filter(i=>i.state==="open"&&i.assignee).reduce((o,i)=>{o[i.assignee.login]=(o[i.assignee.login]||0)+1;return o;},{}));
add("package.json","Merge the dependencies and devDependencies objects. Select entries whose version string starts with \"^\". Return an array of strings of the form \"name@version\" (version including the caret), sorted ascending by name.",
 Object.entries({...pkg.dependencies,...pkg.devDependencies}).filter(([n,v])=>v.startsWith("^")).sort((a,b)=>cmp(a[0],b[0])).map(([n,v])=>n+"@"+v));
add("config.json","Take the services array. Keep services where enabled is true (missing enabled counts as false) and port is greater than 8000 (strictly). Return a single string: their names lowercased, sorted ascending, joined with a comma and no spaces.",
 config.services.filter(s=>s.enabled===true&&s.port>8000).map(s=>s.name.toLowerCase()).sort().join(","));
add("logs.txt","Each line is: timestamp, level, service, free text. Count lines with level ERROR per service (the third whitespace-separated token). Return an object mapping service to count, only for services with at least one ERROR.",
 logLines.map(l=>l.split(' ')).filter(p=>p[1]==="ERROR").reduce((o,p)=>{o[p[2]]=(o[p[2]]||0)+1;return o;},{}));
{const ms=logLines.map(l=>{const m=l.match(/ ms=(\d+)/);return m?+m[1]:null;}).filter(x=>x!=null);
add("logs.txt","Some lines contain a token \"ms=<integer>\". Compute the average of those integers over lines that have the token (lines without it are ignored). Round to 1 decimal place. Return a number.",r2(ms.reduce((a,b)=>a+b,0)/ms.length,1));}
add("orders.csv","CSV with a header row; columns id,customer,product,qty,price,status. Compute total revenue = sum of qty*price over rows whose status equals \"shipped\" case-insensitively. Rows with an empty price are skipped. Round to 2 decimal places. Return a number.",
 r2(rows.filter(r=>r.status.toLowerCase()==="shipped"&&r.price!=null).reduce((s,r)=>s+r.qty*r.price,0)));
{const o={};rows.filter(r=>r.status.toLowerCase()!=="cancelled"&&r.price!=null).forEach(r=>{o[r.customer]=(o[r.customer]||0)+r.qty*r.price;});
add("orders.csv","Ignoring rows with status \"cancelled\" (case-insensitive) and rows with an empty price, compute total spend (qty*price) per customer. Return the top 2 customers as an array of {\"customer\": <name>, \"total\": <total rounded to 2 decimals>}, sorted by total descending.",
 Object.entries(o).sort((a,b)=>b[1]-a[1]).slice(0,2).map(([c,t])=>({customer:c,total:r2(t)})));}
add(null,"Given the word list "+JSON.stringify(words)+": lowercase every word, remove duplicates, sort by length descending then alphabetically ascending for equal lengths, and join them with \"-\". Return a single string.",
 [...new Set(words.map(x=>x.toLowerCase()))].sort((a,b)=>b.length-a.length||cmp(a,b)).join("-"));
w('tasks.json',T);
console.log(JSON.stringify(T.map(t=>t.expected)));

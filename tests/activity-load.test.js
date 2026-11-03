const fs=require("fs"),vm=require("vm");const dir = require("path").join(__dirname, "..") + "/";
const html=fs.readFileSync(dir+"activity.html","utf8");
const srcs=[...html.matchAll(/<script src="([a-z0-9/.-]+\.js)"><\/script>/g)].map(m=>m[1]).filter(f=>!/(^|\/)(cloud|cloud-config|theme)\.js$/.test(f));
console.log(srcs.join(" "));
const ctx={console,document:{},localStorage:{getItem(){return null},setItem(){}}};ctx.window=ctx;vm.createContext(ctx);
try{for(const f of srcs)vm.runInContext(fs.readFileSync(dir+f,"utf8").replace(/^const (\w+) =/gm,"var $1 ="),ctx,{filename:f});
console.log("OK scenarios:",ctx.SCENARIOS.length,"incidents:",ctx.SYLLABUS_INCIDENTS.length);}catch(e){console.log("LOAD ERR",e.message);}

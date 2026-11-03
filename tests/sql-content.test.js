const fs=require("fs"),vm=require("vm");const dir = require("path").join(__dirname, "..") + "/";
const initSqlJs=require("sql.js");
(async()=>{
  const SQL=await initSqlJs();
  const ctx={console};ctx.window=ctx;vm.createContext(ctx);
  const files=["sql/content/problems.js","sql/content/datasets-extra.js","sql/app/compat.js","sql/app/judge.js"];
  for(let i=2;i<=9;i++){const f="sql/content/problems-"+i+".js";if(fs.existsSync(dir+f))files.splice(files.length-2,0,f);}
  for(const f of files)vm.runInContext(fs.readFileSync(dir+f,"utf8"),ctx);
  const J=ctx.SQLJudge;J.setEngine(SQL);
  let fail=0,n=0;
  const ids=new Set();
  for(const p of ctx.SQL_PROBLEMS){
    n++; if(ids.has(p.id)){console.log("DUP",p.id);fail++;} ids.add(p.id);
    if(!ctx.SQL_MODULES.some(m=>m.id===p.mod)){console.log("BAD MODULE",p.id);fail++;}
    if(p.kind==="mcq"){
      if(!Array.isArray(p.options)||p.options.length<3||!(p.answer>=0&&p.answer<p.options.length)){console.log("BAD MCQ",p.id);fail++;continue;}
      if(!J.judge(p,p.answer).ok){console.log("MCQ right rejected",p.id);fail++;}
      if(J.judge(p,(p.answer+1)%p.options.length).ok){console.log("MCQ wrong accepted",p.id);fail++;}
      continue;
    }
    try{
      const r=J.judge(p,p.solution);
      if(!r.ok){console.log("FAIL solution rejected",p.id,r.why||r.error);fail++;continue;}
      // result must be meaningful: query problems return rows
      if(p.kind!=="dml" && r.expectedRows===0 && !p.allowEmpty){console.log("EMPTY expected",p.id);fail++;}
      // a wrong answer must NOT pass
      const wrong=p.kind==="dml"?"SELECT 1":"SELECT 1";
      const w=J.judge(p,wrong); if(w.ok){console.log("WRONG ACCEPTED",p.id);fail++;}
      // dml: doing nothing must not pass (state must change vs initial)
      if(p.kind==="dml"){const noop=J.judge(p,"SELECT 1");if(noop.ok){console.log("NOOP ACCEPTED",p.id);fail++;}}
      console.log("OK  ",p.id,p.kind==="dml"?"(dml)":"rows="+r.expectedRows);
    }catch(e){console.log("ERR ",p.id,e.message);fail++;}
  }
  // judge feedback sanity
  const p=ctx.SQL_PROBLEMS.find(x=>x.id==="SEL-05");
  console.log("order msg:",J.judge(p,"SELECT name, salary FROM employees ORDER BY salary LIMIT 3").why);
  console.log("cols msg:",J.judge(p,"SELECT name FROM employees ORDER BY salary DESC LIMIT 3").why);
  console.log("err msg:",J.judge(p,"SELEC *").error);
  console.log("schema:",JSON.stringify(J.schema("shop").map(t=>t.table+":"+t.count)));
  console.log(n,"problems,",fail,"failures");process.exit(fail?1:0);
})();

const fs=require("fs"),vm=require("vm");const dir = require("path").join(__dirname, "..") + "/";
const __M = { shared: "theme cloud cloud-config subjects".split(" "), "linux/app": "app editor-ui feedback viz viz-more viz-sys".split(" "), "linux/content": "scenarios goals curriculum curriculum-end drills-a drills-b drills-c drills-d drills-e drills-f drills-g incidents-more interview-data".split(" ") };
const R = f => { const b = f.replace(/\\.js$/, ""); for (const [d, l] of Object.entries(__M)) if (l.includes(b)) return d + "/" + f; return /^(editors|shell|system)/.test(f) ? "linux/engine/" + f : f; };

const ctx={console};ctx.window=ctx;vm.createContext(ctx);
["system.js","system-more.js","system-more2.js","system-pkg.js","system-disk.js","shell.js","shell-text.js","shell-more.js","shell-archive.js","shell-script.js", "shell-edit.js"].forEach(f=>vm.runInContext(fs.readFileSync(dir+R(f),"utf8").replace(/^const (\w+) =/gm,"var $1 ="),ctx,{filename:f}));
let fail=0;
function t(name, lines, expect){
  const sh=new ctx.VirtualShell(null,{});
  let o="";
  for(const l of lines){const r=sh.exec(l);o+=(r.out||"")+(r.err?"[E]"+r.err:"");}
  const ok=typeof expect==="string"?o===expect:expect.test(o);
  if(!ok)fail++;
  console.log(ok?"OK  ":"FAIL",name,ok?"":"\n  got: "+JSON.stringify(o)+"\n  want: "+expect);
}
t("for list",["for i in 1 2 3; do echo n$i; done"],"n1\nn2\nn3\n");
t("for cstyle",["for ((i=0;i<3;i++)); do echo $i; done"],"0\n1\n2\n");
t("while",["i=0; while [ $i -lt 3 ]; do echo $i; i=$((i+1)); done"],"0\n1\n2\n");
t("if else",["x=5; if [ $x -gt 3 ]; then echo big; else echo small; fi"],"big\n");
t("elif",["x=2; if [ $x -gt 3 ]; then echo a; elif [ $x -eq 2 ]; then echo b; else echo c; fi"],"b\n");
t("case",["f=a.txt; case $f in *.txt) echo text;; *.sh) echo sh;; *) echo other;; esac"],"text\n");
t("function",["greet() { echo hello $1; }; greet bob; greet amy"],"hello bob\nhello amy\n");
t("func return",["is_even() { [ $(( $1 % 2 )) -eq 0 ] && return 0; return 1; }; is_even 4 && echo yes; is_even 3 || echo no"],"yes\nno\n");
t("local",["x=1; f() { local x=2; echo $x; }; f; echo $x"],"2\n1\n");
t("multiline script",['cat > s.sh <<\'EOF\'\n#!/bin/bash\nname=$1\nif [ -z "$name" ]; then\n  echo usage\n  exit 1\nfi\necho "hi $name"\nEOF\nchmod +x s.sh', './s.sh', './s.sh bob','echo rc=$?'],/usage\nhi bob\nrc=0/);
t("heredoc",['cat <<EOF\nhello $HOME\nEOF'],"hello /home/ubuntu\n");
t("heredoc quoted",["cat <<'EOF'\nhello $HOME\nEOF"],"hello $HOME\n");
t("set -e",["bash -c 'set -e; false; echo after'; echo rc=$?"],"rc=1\n");
t("set -u",["bash -c 'set -u; echo $NOPE; echo after'; echo rc=$?"],/rc=1/);
t("trap exit",["bash -c 'trap \"echo cleanup\" EXIT; echo work'"],"work\ncleanup\n");
t("break/continue",["for i in 1 2 3 4; do [ $i -eq 2 ] && continue; [ $i -eq 4 ] && break; echo $i; done"],"1\n3\n");
t("while read",["printf 'a\nb\n' > f.txt; while read l; do echo got $l; done < f.txt"],"got a\ngot b\n");
t("pipe while",["printf 'a\nb\n' | while read l; do echo got $l; done"],"got a\ngot b\n");
t("args",["bash -c 'echo $# $1 $2' x one two"],"2 one two\n");
t("for args",["f() { for a in \"$@\"; do echo [$a]; done; }; f x y"],"[x]\n[y]\n");
t("arith stmt",["n=0; ((n++)); ((n+=5)); echo $n"],"6\n");
t("infinite",["while true; do :; done"],/exceeded/);
t("pipefail",["bash -c 'set -o pipefail; false | true; echo rc=$?'"],"rc=1\n");
t("source fn",["echo 'hi() { echo from-lib; }' > lib.sh","source lib.sh","hi"],"from-lib\n");
t("nested",["for i in 1 2; do for j in a b; do echo $i$j; done; done"],"1a\n1b\n2a\n2b\n");
t("seq subst",["for i in $(seq 1 3); do echo $i; done"],"1\n2\n3\n");
t("default val",["echo ${NOPE:-dflt}"],"dflt\n");
process.exit(fail?1:0);

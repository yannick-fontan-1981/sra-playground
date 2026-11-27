import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createInterface} from 'node:readline';

export async function dialogue(args,cwd,consume,executable=process.execPath){
  const child=spawn(executable,args,{cwd,stdio:['pipe','pipe','pipe'],windowsHide:true,env:process.env});
  const done=once(child,'close'),lines=createInterface({input:child.stdout})[Symbol.asyncIterator]();
  let error='';
  child.stderr.on('data',chunk=>{error=(error+chunk).slice(-2000);});
  const timeout=setTimeout(()=>child.kill(),180000);
  const receive=async()=>{const row=await lines.next();if(row.done)throw Error('Fin avant réponse. '+error);return JSON.parse(row.value);};
  const send=async m=>{child.stdin.write(JSON.stringify(m)+'\n');return receive();};
  try{return await consume({send,receive});}
  finally{child.stdin.end();const [code]=await done;clearTimeout(timeout);if(code!==0)throw Error('Processus '+code+' '+error);}
}

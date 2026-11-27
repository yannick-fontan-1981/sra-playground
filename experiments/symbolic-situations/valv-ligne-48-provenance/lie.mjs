import assert from 'node:assert/strict';
import {FieldServiceMemory} from './src/logos-engine/v6-field-service-access.ts';

// Le même événement construit alimente le journal et la mémoire réhydratée.
const original=FieldServiceMemory.prototype.transferEvent;
let modified=false,proof=null;
FieldServiceMemory.prototype.transferEvent=function(model,context,stop,refs){
  if(!modified && model?.official_boundary_witness && context && model.receiver){
    const old=model.receiver.area;
    assert.ok(Number.isInteger(old) && old>1);
    proof={avant:old,après:old+1,phase:context.phase,paire:model.official_boundary_witness,refs};
    model=structuredClone(model);model.receiver.area=old+1;modified=true;
  }
  return original.call(this,model,context,stop,refs);
};
const log=console.log;
console.log=line=>{log(JSON.stringify({...JSON.parse(line),récepteur:proof}));proof=null;};
await import('./moteur.mjs');

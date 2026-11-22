import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {transientSubjectAudit} from './study-transient-subjects.mjs';

const [root,output,...paths]=process.argv.slice(2);
// Optional post-run measurement. Import the recognizer from the solver that produced the tape.
const frozenDeliveryRoot = process.env.SIC_AUDIT_COLD_DELIVERY;
const delivery = frozenDeliveryRoot
  ? await import(pathToFileURL(resolve(frozenDeliveryRoot, 'src/logos-engine/v6-oriented-coupling.ts')).href)
  : null;
const receptionRoot = process.env.SIC_AUDIT_OBSERVED_RECEPTION;
const reception = receptionRoot
  ? await import(pathToFileURL(resolve(receptionRoot,'src/logos-engine/v6-exposed-reception-observation.ts')).href)
  : null;
const {createGameDispatcher}=await import(pathToFileURL(resolve(root,'src/runtime/native-game-dispatcher.ts')).href);
const hash=f=>createHash('sha256').update(JSON.stringify(f)).digest('hex');
const games=new Map(),unavailable=[];
const load=async p=>JSON.parse(await readFile(p,'utf8'));
for(const path of paths) for(const line of (await readFile(path,'utf8')).trim().split(/\r?\n/)) {
  const r=JSON.parse(line);
  if(r.error) {unavailable.push(r.code);continue;}
  const key=[r.code,r.start,r.finish,r.observedPriorLevelActions??0,r.parallelWorkers??'unspecified'].join('/');
  if (r.parallelWorkers !== undefined) assert.ok(Number.isSafeInteger(r.parallelWorkers) && r.parallelWorkers >= 1,key);
  const engine=createGameDispatcher(()=>{throw Error('Unexpected engine')});
  const transient = process.env.SIC_AUDIT_TRANSIENT_SUBJECTS ? await transientSubjectAudit(process.env.SIC_AUDIT_TRANSIENT_SUBJECTS) : null;
  const act=c=>engine.dispatch({type:'action',actionId:c.id,...(c.id===6?{data:c.data}:{})});
  let b=await engine.dispatch({type:'load',code:r.code,level:r.observedPriorLevelActions?1:r.start});
  if(r.observedPriorLevelActions) {
    const lesson=await load(process.env.SIC_STUDY_OBSERVED_LESSON);
    assert.equal(lesson.code,r.code);
    assert.equal(lesson.commands.length,r.observedPriorLevelActions);
    for(const c of lesson.commands) {
      assert.equal(hash(b.frame).slice(0,16),c.from);
      b=await act(c);
      assert.equal(hash(b.frame).slice(0,16),c.to);
    }
  } else if(b.level!==r.start && b.canSelectLevel) b=await engine.dispatch({type:'selectLevel',level:r.start});
  assert.equal(b.level,r.start);assert.equal(b.levelsCompleted,r.initialCompleted);assert.equal(hash(b.frame),r.initial);
  assert.equal(r.replayCommands.length,r.issued);assert.equal(r.sic,r.issued);
  const visits=new Map(),resets=[],tape=[],levelSelections=[];
  const receptions = { decisions: 0, recognized: 0, recognizedWithClick: 0 };
  const entry = { decisions: 0, allowedCommands: 0, ordinaryGeometry: 0, inputsAndDirectionalGeometry: 0 };
  let previousDirectionalGeometry = false;
  if (delivery) assert.ok(!r.observedPriorLevelActions && r.start === r.finish, 'Cold single-level audit required');
  for(const [i,c] of r.replayCommands.entries()) {
    if(hash(b.frame).slice(0,16)!==c.from) {
      assert.ok(resets.length<r.resets,'Unexpected discontinuity at '+key+'/'+i);
      const score=b.levelsCompleted,level=b.level;
      b=await engine.dispatch({type:'reset'});
      assert.equal(b.levelsCompleted,score);assert.equal(b.level,level);
      resets.push(i);
      previousDirectionalGeometry = false;
    }
    assert.equal(hash(b.frame).slice(0,16),c.from);
    if (reception) {
      receptions.decisions++;
      if (reception.measureExposedReception(b.frame)) {
        receptions.recognized++;
        if (b.availableActionIds.includes(6)) receptions.recognizedWithClick++;
      }
    }
    if (delivery) {
      const allowed = [1, 2, 3, 4, 5].every(id => b.availableActionIds.includes(id)) && !b.availableActionIds.includes(6);
      const geometry = delivery.orientedCouplingInitial(b.frame);
      entry.decisions++;
      entry.allowedCommands += Number(allowed);
      entry.ordinaryGeometry += Number(Boolean(geometry));
      entry.inputsAndDirectionalGeometry += Number(allowed && previousDirectionalGeometry);
      previousDirectionalGeometry = Boolean(geometry) && c.id >= 1 && c.id <= 4;
    }
    const {level,levelsCompleted}=b, before=b;
    b=await act(c);
    transient?.observe(before,b,c.id);
    assert.equal(hash(b.frame).slice(0,16),c.to);
    const record=visits.get(level)??{level,actions:0,won:false};
    record.actions++;record.won ||= b.levelsCompleted>levelsCompleted || b.state==='WIN';
    visits.set(level,record);
    if (c.nextLevelEntry) {
      assert.ok(r.start > 1 && level < r.finish && b.level < r.start && b.canSelectLevel && b.state !== 'WIN');
      assert.equal(b.levelsCompleted, levelsCompleted + 1);
      assert.equal(c.nextLevelEntry.level, level + 1);
      const credit = b.levelsCompleted;
      b = await engine.dispatch({ type: 'selectLevel', level: level + 1 });
      assert.equal(b.level, level + 1);
      assert.equal(b.levelsCompleted, credit);
      assert.equal(hash(b.frame), c.nextLevelEntry.frame);
      levelSelections.push({ afterAction: i + 1, ...c.nextLevelEntry });
    }
    tape.push(c.id===6?[c.id,c.data.x,c.data.y]:c.id);
  }
  assert.equal(resets.length,r.resets,'Unlocated reset: '+key);
  const levels=r.levels.map(l=>visits.get(l.level)??{level:l.level,actions:0,won:false});
  assert.deepEqual(levels,r.levels.map(({level,actions,won})=>({level,actions,won})));
  assert.equal(b.levelsCompleted-r.initialCompleted,levels.filter(l=>l.won).length);
  const result={code:r.code,start:r.start,finish:r.finish,lesson:r.observedPriorLevelActions??0,initial:r.initial,
    ...(r.parallelWorkers === undefined ? {} : {parallelWorkers:r.parallelWorkers}),
    cap:r.cap,levels,resets,tapeDigest:hash(tape),final:hash(b.frame)};
  if (delivery) result.coldDeliveryEntry = entry;
  if (levelSelections.length) result.scoredLevelSelections = levelSelections;
  if (reception) result.observedReceptions = receptions;
  if (transient) result.transientSubjects = transient.tally;
  if(games.has(key)) assert.deepEqual(games.get(key),result);
  games.set(key,result);
}
const entries=[...games.values()];
const recovered=unavailable.filter(code=>entries.some(e=>e.code===code));
const missing=unavailable.filter(code=>!recovered.includes(code));
await writeFile(output,JSON.stringify({entries,recovered,missing},null,2)+'\n');
console.log(JSON.stringify({verified:entries.length,recovered,missing,won:entries.filter(e=>e.levels.some(l=>l.level===2&&l.won)).map(e=>[e.code,e.lesson])}));

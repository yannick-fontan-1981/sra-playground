import { createHash } from 'node:crypto';
export const hash = (board) => createHash('sha256').update(JSON.stringify(board.frame)).digest('hex');
export const op = (cmd) => 'ACTION' + cmd.a + (cmd.a === 6 ? ':' + cmd.data.x + ',' + cmd.data.y : '');
export function sourceReplay(engine, programs, run) {
  function act(key) {
    const [name, coordinates] = key.split(':');
    const [x, y] = coordinates?.split(',').map(Number) ?? [];
    return engine.dispatch({
      type: 'action',
      actionId: Number(name.slice(6)),
      ...(coordinates ? { data: { x, y } } : {}),
    });
  }
  function openEntry() {
    const lessonEnd=run.lessonEndLevel??run.start;
    let b = engine.dispatch({ type: 'load', code: run.code, level: run.publicLesson ? lessonEnd - 1 : run.sourcePrefixActions ? 1 : run.start });
    let entry = 0;
    if (run.observedPriorLevelActions) {
      if (!run.publicLesson || run.publicLesson.length !== run.observedPriorLevelActions || run.sourcePrefixActions) throw Error('Missing authenticated public lesson');
      for (const c of run.publicLesson) {
        if (b.level !== lessonEnd - 1 || hash(b).slice(0,16) !== c.from) throw Error('Divergent lesson origin');
        b = act(op({a:c.id,data:c.data}));
        if (hash(b).slice(0,16) !== c.to) throw Error('Divergent lesson transition');
      }
      if(b.level!==lessonEnd)throw Error('Lesson did not reach its authenticated boundary');
      if(lessonEnd!==run.start)b=engine.dispatch({type:'selectLevel',level:run.start});
    } else if (run.sourcePrefixActions) {
      for (let level = 1; level < run.start; level++) {
        const path =
          level === 1
            ? programs.niveau_1[run.code].suite_gagnante
            : programs.niveaux_supérieurs.find((r) => r.code === run.code && r.l === level).seq;
        if (b.level !== level) throw Error('Divergent entry program');
        for (const key of path) {
          b = act('ACTION' + key.replace('@', ':'));
          entry++;
        }
      }
    } else if (b.level !== run.start && b.canSelectLevel) {
      b = engine.dispatch({ type: 'selectLevel', level: run.start });
    }
    return { b, entry };
  }
  function restore(length) {
    let { b, entry } = openEntry();
    if (
      entry !== (run.sourcePrefixActions ?? 0) ||
      b.level !== run.start ||
      b.levelsCompleted !== run.initialCompleted ||
      hash(b) !== run.initial
    )
      throw Error('Divergent initial state');
    let previous = run.initial.slice(0, 16);
    for (const cmd of run.steps.slice(0, length)) {
      if (previous !== cmd.from) throw Error('Divergent source observation');
      b = act(op(cmd));
      previous = hash(b).slice(0, 16);
      if (previous !== cmd.to) throw Error('Divergent public prefix');
    }
    return b;
  }
  const win = (b) => b.level > run.start || b.levelsCompleted > run.initialCompleted || b.state === 'WIN';
  return { act, openEntry, restore, win };
}

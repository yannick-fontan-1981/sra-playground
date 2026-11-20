import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const hash = (rows) => createHash('sha256').update(JSON.stringify(rows)).digest('hex').slice(0, 16);
export async function publicLesson(games, code, start, file, solver) {
  const packed = JSON.parse(await readFile(file, 'utf8'));
  const record = packed.lesson ?? packed;
  const adjacent=record.endLevel===start;
  if (record.code !== code || start<2 || record.endLevel<2 || (!adjacent && !(record.endLevel<start && record.transferTo===start))) throw Error('Wrong public lesson');
  const history = [];
  let board = await games.dispatch({ type: 'load', code, level: record.endLevel - 1 });
  for (const c of record.commands) {
    if (board.level !== record.endLevel - 1 || c.from !== hash(board.frame))
      throw Error('Unauthenticated lesson origin');
    const next = await games.dispatch({
      type: 'action',
      actionId: c.id,
      ...(c.data ? { data: c.data } : {}),
    });
    if (c.to !== hash(next.frame)) throw Error('Unauthenticated lesson outcome');
    history.push({ b: board, n: next, c });
    board = next;
  }
  if (board.level !== record.endLevel || !history.length || board.levelsCompleted !== history[0].b.levelsCompleted + 1)
    throw Error('Lesson did not reach the official boundary');
  const boundary=board;
  if(!adjacent) {
    board=await games.dispatch({type:'selectLevel',level:start});
    if(board.level!==start)throw Error('Public level selection failed');
  }
  const { measureNativeObservation } = await import(
    pathToFileURL(join(resolve(solver), 'src/logos-engine/v6-native-observer.ts')).href
  );
  async function initFamily(backend, scope) {
    const learner = backend.families.find((f) => f.id === 'sic_test_prepared_effects');
    if (!learner?.observePublicOutcome) return;
    const snapshot = (x, n) =>
      measureNativeObservation(
        {
          frame_rows: x.frame,
          frame_hash: hash(x.frame),
          level: x.level - record.endLevel + 1,
          levels_completed: x.levelsCompleted - boundary.levelsCompleted,
          state: x.state,
          available_action_refs: x.availableActionIds.map((n) => 'ACTION' + n),
        },
        n,
        scope
      );
    let o = await snapshot(history[0].b, 1);
    for (const [i, { b, n, c }] of history.entries()) {
      const a = await snapshot(n, i + 2);
      await learner.observePublicOutcome(
        o,
        a,
        { action_ref: 'ACTION' + c.id, data: c.data ?? {} },
        b.frame,
        n.frame
      );
      o = a;
    }
    await learner.proposeInGroup('test_compositions_after_recurrent_returns', o, boundary.frame, [], 0);
  }
  return {
    board,
    length: history.length,
    initial: hash(board.frame),
    wrap(backend) {
      const initialize = backend.initialize.bind(backend);
      backend.initialize = async (input, ...args) => {
        await initFamily(backend, input.sessionId);
        return initialize(input, ...args);
      };
      return backend;
    },
  };
}

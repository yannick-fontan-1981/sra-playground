import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { GAME_CATALOG } from '../src/games/catalog.ts';
import { sourceBackend } from './sic-study-source-games.mjs';
import { sourceReplay, hash } from './sic-study-source-replay.mjs';
import { publicParts } from './source-transfer-demonstration.mjs';

const [environment, out, ...files] = process.argv.slice(2);
const allowed = new Set(GAME_CATALOG.map((g) => g.code)),
  engine = await sourceBackend(resolve(environment));
const programs = JSON.parse(
  await readFile(new URL('../docs/architecture/sic-source-seven-programs.json', import.meta.url), 'utf8')
);
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const reports = [];
for (const file of files)
  for (const line of (await readFile(file, 'utf8')).trim().split('\n')) {
    const r = JSON.parse(line);
    if (!allowed.has(r.code)) throw Error('Expected a source game');
    const end = r.preparation.find((e) => e.exchange && e.result === 'placed_use_verified');
    if (!end) continue;
    const v = end.exchange,
      first = end.actionIndex - v.steps.length,
      rep = sourceReplay(engine, programs, r);
    const setup = v.steps.slice(0, -2),
      trigger = v.steps.at(-2),
      use = v.steps.at(-1);
    const root = rep.restore(first);
    if (!root.availableActionIds.includes(Number(trigger.op.split(':')[0].slice(6))))
      throw Error('Unknown trigger');
    const read = publicParts(),
      witness = v.roles,
      active = (b) =>
        b.state !== 'WIN' &&
        b.state !== 'GAME_OVER' &&
        b.level === root.level &&
        b.levelsCompleted === root.levelsCompleted;
    const win = (b) => b.state === 'WIN' || b.level > root.level || b.levelsCompleted > root.levelsCompleted;
    async function pose(b) {
      if (!active(b)) return null;
      const { parts } = await read(b);
      const points = witness.map((role) => {
        const group = parts.filter((e) => e.signature === role.signature).map((e) => e.position.join());
        const remaining = group.filter((p) => !role.fixed.includes(p));
        if (
          group.length !== role.fixed.length + 1 ||
          !role.fixed.every((p) => group.includes(p)) ||
          remaining.length !== 1
        )
          return null;
        return remaining[0].split(',').map(Number);
      });
      return points.every(Boolean) ? points : null;
    }
    const traveler = eq(setup[0].before[0], trigger.before[0]) ? 0 : 1;
    const used = eq(use.before[0], use.after[0]) ? 1 : 0;
    const goal = trigger.after[traveler],
      final = use.after[used],
      rootHash = hash(root);
    const words = [],
      restore = () => {
        const b = rep.restore(first);
        if (hash(b) !== rootHash) throw Error('Changed experimental origin');
        return b;
      };
    const execute = (word) => {
      let b = restore();
      for (const op of word) {
        if (!active(b)) break;
        if (!b.availableActionIds.includes(Number(op.split(':')[0].slice(6))))
          throw Error('Unavailable control');
        b = rep.act(op);
      }
      return b;
    };
    const planned = execute(v.steps.map((s) => s.op));
    if (!eq(await pose(planned), use.after)) throw Error('Complete experiment differs from frozen episode');
    const omitTrigger = await pose(execute([...setup.map((s) => s.op), use.op]));
    const omitSetup = await pose(execute([trigger.op, use.op]));
    let offeredNewControl = false,
      unknown = 0,
      landingShape = 0,
      useShape = 0,
      bothShapes = 0,
      firstLanding = null,
      firstUse = null,
      firstPair = null,
      firstWin = null;
    // Even equal public images may have different futures. Expand each word separately.
    async function visit(word) {
      const b = execute(word);
      if (win(b) && !firstWin) firstWin = word;
      const p = await pose(b);
      if (active(b)) {
        if (!p) unknown++;
        const { parts } = await read(b);
        const present = (i, q) =>
          parts.some((e) => e.signature === witness[i].signature && eq(e.position, q));
        landingShape += Number(present(traveler, goal));
        useShape += Number(present(used, final));
        bothShapes += Number(present(0, use.after[0]) && present(1, use.after[1]));
      }
      if (p) {
        if (eq(p[traveler], goal) && (!firstLanding || word.length < firstLanding.length))
          firstLanding = word;
        if (eq(p[used], final) && (!firstUse || word.length < firstUse.length)) firstUse = word;
        if (eq(p, use.after) && (!firstPair || word.length < firstPair.length)) firstPair = word;
      }
      if (!active(b) || word.length === v.steps.length) return;
      if (b.availableActionIds.includes(6)) offeredNewControl = true;
      for (const id of b.availableActionIds) {
        const op = 'ACTION' + id;
        if (id !== 6 && op !== trigger.op) words.push([...word, op]);
      }
    }
    words.push([]);
    for (let i = 0; i < words.length; i++) await visit(words[i]);
    reports.push({
      code: r.code,
      level: r.start,
      status: 'complete',
      domain: offeredNewControl ? 'all unaddressed controls except trigger' : 'all controls except trigger',
      start: first,
      trigger: trigger.op,
      depth: v.steps.length,
      words: words.length,
      unresolved: unknown,
      landingShape,
      useShape,
      bothShapes,
      traveler,
      used,
      goal,
      final,
      initial: setup[0].before,
      setup: setup.map((s) => s.op),
      arrival: trigger.after,
      follow: use.op,
      after: use.after,
      omitTrigger,
      omitSetup,
      firstLanding,
      firstUse,
      firstPair,
      firstWin,
      root: rootHash,
    });
  }
await writeFile(out, JSON.stringify(reports));

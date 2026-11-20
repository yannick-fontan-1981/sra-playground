import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { GAME_CATALOG } from '../src/games/catalog.ts';
import { sourceBackend } from './sic-study-source-games.mjs';
import { sourceReplay, hash } from './sic-study-source-replay.mjs';
import { publicParts } from './source-transfer-demonstration.mjs';

const [environment, out, ...files] = process.argv.slice(2),
  engine = await sourceBackend(resolve(environment));
const allowed = new Set(GAME_CATALOG.map((g) => g.code)),
  reports = [];
const programs = JSON.parse(
  await readFile(new URL('../docs/architecture/sic-source-seven-programs.json', import.meta.url), 'utf8')
);
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b),
  digest = (p) => createHash('sha256').update(JSON.stringify(p)).digest('hex');
for (const file of files)
  for (const row of JSON.parse(await readFile(file, 'utf8'))) {
    if (
      !allowed.has(row.code) ||
      digest(row.conjugates) !== row.conjugateSeal ||
      digest(row.programs) !== row.jointSeal
    )
      throw Error('Invalid source predictions');
    const rep = sourceReplay(engine, programs, {
        code: row.code,
        start: row.level,
        sourcePrefixActions: row.sourcePrefixActions,
      }),
      read = publicParts();
    const open = () => {
      let b = rep.openEntry().b;
      for (const k of row.prefix) b = rep.act(k);
      if (hash(b) !== row.root) throw Error('Source origin mismatch');
      return b;
    };
    const first = open(),
      wins = (b) =>
        b && (b.level > row.level || b.levelsCompleted > first.levelsCompleted || b.state === 'WIN');
    const active = (b) => b && !wins(b) && b.state !== 'GAME_OVER';
    const apply = (b, k) =>
      active(b) && b.availableActionIds.includes(Number(k.split(':')[0].slice(6))) ? rep.act(k) : null;
    function execute(word) {
      let b = open();
      for (const k of word) {
        b = apply(b, k);
        if (!active(b)) break;
      }
      return b;
    }
    async function pose(b, roles) {
      if (!active(b)) return null;
      const s = await read(b);
      const pair = roles.map((role) => {
        const all = s.parts.filter((e) => e.signature === role.signature).map((e) => e.position);
        if (all.length !== role.fixed.length + 1 || !role.fixed.every((p) => all.some((q) => q.join() === p)))
          return null;
        const rest = all.filter((q) => !role.fixed.includes(q.join()));
        return rest.length === 1 ? rest[0] : null;
      });
      return pair.every(Boolean) ? pair : null;
    }
    let verified = 0,
      middle = 0,
      terminal = 0,
      joint = 0,
      won = 0,
      novelAmongButtons = 0,
      soleRestored = 0;
    const direct = new Map(),
      endpoints = new Set(),
      jointEndpoints = new Set(),
      configurations = [];
    for (const h of row.conjugates) {
      const origin = await pose(first, h.roles),
        actualDirect = await pose(execute([h.d]), h.roles);
      const exchanged = await pose(execute([h.t]), h.roles);
      if (!eq(origin, h.p) || !eq(actualDirect, h.direct) || !eq(exchanged, [h.p[1], h.p[0]]))
        throw Error('Unwitnessed generator');
      if (h.inverseWitness && !eq(await pose(execute([h.t, ...h.undo]), h.roles), origin))
        throw Error('Unwitnessed inverse');
      const a = h.activeMember,
        b = h.passive;
      if (
        !eq(h.prediction[a], h.p[a]) ||
        !eq(actualDirect[b], h.p[b]) ||
        !eq(
          h.prediction[b].map((x, j) => x - h.p[b][j]),
          actualDirect[a].map((x, j) => x - h.p[a][j])
        ) ||
        eq(h.prediction[b], h.p[b]) ||
        !eq(h.word, [h.t, h.d, ...h.undo])
      )
        throw Error('Invalid capacity equation');
      const intermediate = await pose(execute(h.word.slice(0, 2)), h.roles),
        last = execute(h.word);
      const correctMiddle = eq(intermediate, h.middle);
      middle += Number(correctMiddle);
      terminal += Number(!!wins(last));
      if (!correctMiddle || !eq(await pose(last, h.roles), h.prediction)) continue;
      verified++;
      endpoints.add(JSON.stringify([h.roles, h.prediction]));
      const key = JSON.stringify(h.roles);
      if (!direct.has(key)) {
        const possibilities = [];
        for (const n of first.availableActionIds.filter((n) => n !== 6))
          possibilities.push(await pose(execute(['ACTION' + n]), h.roles));
        direct.set(key, possibilities);
      }
      if (!direct.get(key).some((x) => eq(x, h.prediction))) novelAmongButtons++;
      if (eq(await pose(execute(h.word.slice(0, -h.undo.length)), h.roles), h.prediction)) continue;
      soleRestored++;
    }
    for (const plan of row.programs) {
      if (
        plan.path.length !== plan.word.length ||
        !eq(plan.path.at(-1), plan.p) ||
        eq(plan.origin[0], plan.p[0]) ||
        eq(plan.origin[1], plan.p[1])
      )
        throw Error('Invalid joint goal');
      let b = open(),
        ok = true;
      for (const [i, k] of plan.word.entries()) {
        b = apply(b, k);
        if (wins(b)) break;
        if (!active(b) || (plan.path[i] && !eq(await pose(b, plan.roles), plan.path[i]))) {
          ok = false;
          break;
        }
      }
      configurations.push({
        positions: plan.p,
        writes: plan.writes.length,
        commands: plan.word.length,
        result: wins(b) ? 'official_completion' : ok ? 'exact' : 'refuted',
      });
      if (wins(b)) won++;
      else if (ok) {
        joint++;
        jointEndpoints.add(JSON.stringify([plan.roles, plan.p]));
      }
    }
    if (
      verified !== row.correct ||
      middle !== row.middle ||
      terminal !== row.terminal ||
      joint !== row.jointExact ||
      won !== row.jointWins
    )
      throw Error('Independent verification differs');
    reports.push({
      code: row.code,
      level: row.level,
      root: row.root,
      hypotheses: row.hypotheses,
      verified,
      distinct: endpoints.size,
      novelAmongButtons,
      requiresReturn: soleRestored,
      proposedJoint: row.joint,
      joint,
      distinctJoint: jointEndpoints.size,
      wins: won,
      terminal,
      calibratedReturnLengths: [
        ...new Set(row.conjugates.filter((h) => h.inverseWitness).map((h) => h.undo.length)),
      ],
      conjugateSeal: row.conjugateSeal,
      jointSeal: row.jointSeal,
      ...(row.uniqueGoals ? { configurations } : {}),
    });
  }
await writeFile(out, JSON.stringify(reports));

import assert from 'node:assert/strict';
import test from 'node:test';
import { wordGlyphs } from '../src/logos-engine/v6-word-interface.ts';
import { readRuleSynthesis, synthesizeRuleAssignments, type RuleSynthesis } from '../src/sic/rule-synthesis.ts';
import { acquireRuleEdit, chooseRuleEdits, projectRuleEdit, type RuleEditor } from '../src/sic/rule-editing-plan.ts';

const side = (arity: number, type: number): RuleSynthesis['sides'][number] =>
  ({ arity, type, size: 3, box: [0, 0, arity * 3 - 1, 2] });
const bracket: RuleSynthesis['bracket'] = {
  left: 1, right: 1, above: 2, height: 1, ink: 9, first: [true], middle: [true], last: [true],
};
const layout: RuleSynthesis = {
  sides: [1, 1, 1, 2, 2, 1, 1, 1].map((arity, i) => side(arity, 1 + i % 2)),
  examples: [side(5, 1), side(5, 2)], words: [['A', 'C', 'D', 'D', 'B'], ['x', 'y', 'y', 'z', 'v']], ink: 5, bracket,
};
const initial = ['B', 'z', 'B', 'w', 'C', 'x', 'A', 'v'];

test('synthesize both rule orders from fixed examples and shared repeated sides', () => {
  const goals = synthesizeRuleAssignments(layout, initial);
  assert.equal(goals.length, 2);
  assert.ok(goals.some(goal => goal.join('') === 'AxCyDzBv'));
  assert.ok(goals.some(goal => goal.join('') === 'BvCyDzAx'));
  const impossible: RuleSynthesis = { ...layout, words: [layout.words[0], ['x', 'y', 't', 'z', 'v']] };
  assert.deepEqual(synthesizeRuleAssignments(impossible, initial), []);
});

test('reuse typed edits and keep a double side out of a series until measured', () => {
  const editor: RuleEditor = { epoch: 1, layout, goals: [['B', 'z', 'B', 'w', 'D', 'x', 'A', 'v']],
    directions: { L: -1, R: 1 }, edits: { '1': { U: [['C', 'D']] }, '2': { U: [['C', 'E']] } },
    mutations: ['U'], attempted: [], groups: [JSON.stringify([1, 1])], evidence: [], count: 0 };
  const before = [initial, 4] as const;
  assert.deepEqual(chooseRuleEdits(editor, before, ['U', 'L', 'R'])?.actions, ['U']);
  assert.equal(projectRuleEdit(editor, before, 'U'), null);
  const final = [editor.goals[0]!, 4] as const;
  const verified = acquireRuleEdit(editor, before, final, 'U', 'confirmed-whole-side');
  assert.deepEqual(projectRuleEdit(verified, before, 'U'), final);
  assert.equal(projectRuleEdit(verified, [initial.map((glyph, i) => i === 3 ? 'C' : glyph), 3], 'U'), null);
});

test('reject a change to either fixed example or an edit splitting the double side', async () => {
  const rows = Array.from({ length: 18 }, () => Array<number>(18).fill(0));
  const sides = [{ ...side(2, 1), box: [2, 3, 7, 5] as const }, { ...side(1, 2), box: [10, 3, 12, 5] as const }];
  const examples = [{ ...side(1, 1), box: [2, 9, 4, 11] as const },
    { ...side(1, 2), box: [2, 13, 4, 15] as const }] as const;
  rows[1]!.fill(9, 3, 7);
  rows[7]!.fill(9, 3, 7);
  for (const [x, y] of [[3, 4], [6, 4], [11, 4], [3, 10], [3, 14]]) rows[y!]![x!] = 5;
  const words = await Promise.all(examples.map(example => wordGlyphs(rows, example, 5))) as RuleSynthesis['words'];
  const held: RuleSynthesis = { sides, examples: [...examples], words, bracket, ink: 5 };
  assert.equal((await readRuleSynthesis(rows, held))?.[1], 0);
  rows[4]![6] = 0;
  assert.equal(await readRuleSynthesis(rows, held), null);
  rows[4]![6] = 5;
  rows[14]![3] = 0;
  assert.equal(await readRuleSynthesis(rows, held), null);
});

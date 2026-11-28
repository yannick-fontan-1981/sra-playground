// Appended to the pinned SERI service test by the catalogue runner.
test('93 counts distinct questions and exposes the witnesses', async t => {
  const original = VisualSequences.prototype.proposeContinuation;
  let condition = 'nominal';
  const inputs: Array<{ distinct: number; refs: number[] }> = [];
  t.mock.method(VisualSequences.prototype, 'proposeContinuation', async function (this: VisualOwner, ...args: Parameters<typeof original>) {
    if (args[0].level_epoch !== 2 || args[0].revision !== 5) return original.apply(this, args);
    const saved = this.state(), events = saved.events as Row[];
    const valid = events.filter(event => event.status === 'observed_row_completion');
    const retained = condition === 'nominal' ? valid : condition === 'copy' ? [valid[0], valid[1], valid[1]] : [valid[1], valid[1]];
    const remainder = events.filter(event => event.status !== 'observed_row_completion');
    inputs.push({ distinct: new Set(retained.map(event => event.question)).size,
      refs: retained.map(event => revision(event.evidence)) });
    assert.equal(args[4], 2);
    this.restore({ ...saved, events: [...retained, ...remainder] });
    try {
      return await original.apply(this, args);
    } finally {
      this.restore(saved);
    }
  });
  const arms = [];
  for (const variant of ['nominal', 'copy', 'single-question']) {
    condition = variant;
    const game = await start();
    for (let i = 0; i < 4; i++) {
      await game.decision();
      await game.advance();
    }
    const before = structuredClone(game.observation.frame);
    const choice = await game.decision();
    const p = choice.proposal, plan = p.sequence_plan;
    assert.deepEqual([choice.family, choice.command.actionRef, choice.command.data],
      ['visual_sequences', 'ACTION6', { x: 46, y: 54 }]);
    const exposed = (plan.continuation_witnesses ?? []).map(revision);
    const bundle = p.bundle_template.evidence.slice(-exposed.length);
    if (exposed.length) assert.deepEqual(bundle.map(revision), exposed);
    const outcome = await game.advance();
    assert.equal(outcome.matched, null);
    arms.push({ before, after: structuredClone(game.observation.frame), shown: exposed,
      recalled: p.facts.visual_answer_method_recalled === true });
  }
  assert.deepEqual(inputs, [{ distinct: 3, refs: [2,3,4] }, { distinct: 2, refs: [2,3,3] }, { distinct: 1, refs: [3,3] }]);
  const duplicateWitnesses = process.env.SIC_SERI_CORRECTED_DUPLICATES === '1' ? [2,3,5] : [3,3,5];
  assert.deepEqual(arms.map(arm => arm.shown), [[3,4,5], duplicateWitnesses, []]);
  assert.deepEqual(arms.map(arm => arm.recalled), [true, true, false]);
  for (const arm of arms.slice(1)) {
    assert.deepEqual(arm.before, arms[0].before);
    assert.deepEqual(arm.after, arms[0].after);
  }
  console.log(JSON.stringify({ inputs, witnesses: arms.map(arm => arm.shown), recall: arms.map(arm => arm.recalled),
    sameOfficialClick: true, sameOfficialReturn: true }));
});

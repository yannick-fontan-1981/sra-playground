// Appended to the pinned KLOT integration fixture by test-sic-catalogue-lines.py.
test('82 rejects the plan and detects a receipt attributed to the wrong body', async t => {
  const records = observeRecords(t);
  const game = await start();
  for (let turn = 1; turn < 7; turn++) {
    await game.decision();
    await game.advance();
  }
  const choice = await game.decision();
  const plan = choice.proposal.selected_rigid_plan;
  const scene = selectedRigidScene(game.observation.frame, plan.scene);
  assert.ok(scene && choice.command.actionRef === 'ACTION1');
  assert.equal(scene.bodies[plan.active].key, '6');
  const poses = selectedRigidPoses(scene);
  const peer = scene.bodies.findIndex(body => body.key === '11');
  assert.notEqual(peer, -1);
  const { q, origin } = scene.geometry;
  const body = scene.bodies[peer];
  const [x, y] = body.position.map((v, i) => origin[i] + q * (v + body.mask[0][i]) + q / 2);
  // The real backend executes an extra selection withheld from the service, then its T7 ACTION1.
  const result = await game.advance({ x, y });
  const receipt = records.get(7);
  assert.ok(receipt && result.matched === false && result.seal_prefix === true);
  const observed = selectedRigidPoses(receipt.state.scene);
  assert.deepEqual(observed[plan.active], poses[plan.active]);
  assert.deepEqual(observed[peer], [poses[peer][0], poses[peer][1] - 1]);
  assert.deepEqual(observed.map((v, i) => JSON.stringify(v) === JSON.stringify(poses[i])), poses.map((_, i) => i !== peer));
  assert.equal(receipt.state.scene.bodies[receipt.state.active!].key, '6');
  assert.equal(receipt.detail.role_status, 'observed_exclusive_receiver');
  assert.equal(receipt.detail.compatible_model_count, 0);
  const next = await game.stateAfterAdvance();
  assert.equal(next.kind, 'stopped');
  assert.ok(!next.next);
  console.log(JSON.stringify({ selected: '6', moved: '11', wrongSelect: { x, y }, matched: result.matched,
    sealed: result.seal_prefix, attributed: receipt.detail.role_status, models: receipt.detail.compatible_model_count,
    next, officialLevels: game.observation.levelsCompleted }));
});

import assert from 'node:assert/strict';
import { enumerateFinite } from '../../finite-policies.mjs';
import { device, situations } from './situations.mjs';

export function verifyCases() {
  const rows = situations();
  for (const c of rows) {
    const page = c.message;
    const fields = [page.goal,...page.observations,...page.commands,...page.rules];
    assert.deepEqual(new Set(fields.flatMap(f=>f.source)),new Set(Object.keys(page.sources).map(Number)));
    const command = page.commands.find(o=>o.command.join(' ') === c.action);
    const line = command.source.map(n=>page.sources[n]).join(' ');
    assert.ok(line.includes(c.action) && line.includes('« ' + c.ack + ' »'));
    const hasQ = page.commands.some(o=>o.command.join(' ')==='indexer Q');
    assert.equal(hasQ,Boolean(c.other));
    const result = enumerateFinite([c],device);
    if (c.down) assert.equal(result.policies.length,0);
    else assert.deepEqual(result.optimal,[{départ:[c.action,'valider']}]);
    const initial = device.initialState(c);
    const first = device.step(c,initial,c.action);
    const after = first?.next ?? initial;
    assert.equal(after.P,!c.down);
    assert.equal(after.Q,false);
    assert.equal(device.step(c,after,'valider').feedback,c.down?'échec':'succès');
    if (c.other) {
      assert.equal(device.step(c,initial,'indexer Q').feedback,c.other);
      assert.equal(device.step(c,device.step(c,initial,'indexer Q').next,'valider').feedback,'échec');
    }
    if (c.id==='N2') assert.notEqual(c.substitution,c.ack);
  }
  const by = id=>rows.find(c=>c.id===id);
  for (const id of ['B5','B6']) {
    const altered=structuredClone(by(id).message);
    altered.sources[6]=altered.sources[6].replace('« '+by(id).other+' »','« Q prêt »');
    assert.deepEqual(altered,by('B4').message);
  }
  const [executed,refused] = rows.filter(c=>c.id==='N3');
  assert.deepEqual(executed.message,refused.message);
  assert.equal(executed.action,refused.action);
  assert.equal(executed.substitution,refused.substitution);
  assert.notEqual(executed.down,refused.down);
  return rows;
}

import { readFile } from 'node:fs/promises';
import { createV7Runtime } from '../src/logos-engine/create-runtime.ts';
import type { V7Bundle } from '../src/logos-engine/bundle.ts';

const bundle = JSON.parse(await readFile(new URL('../reference/v7/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/bundle.json', import.meta.url), 'utf8')) as V7Bundle;
const selected = process.argv[2] ?? 'discovery';
const scenario = bundle.scenarios.find(item => item.id === selected);
if (!scenario) throw new Error(`Unknown scenario ${selected}. Choose: ${bundle.scenarios.map(item => item.id).join(', ')}`);
const runtime = await createV7Runtime(bundle);
console.log(`Logos Engine — ${scenario.title}`);
for (const item of scenario.events) {
  const receipt = await runtime.advance(item.event);
  const counts: Record<string, number> = {};
  for (const node of Object.values(runtime.memory.nodes)) {
    const key = `${node.kind}:${node.status}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  console.log(JSON.stringify({ observation: item.label, cycle: receipt.sequence, changes: receipt.deltaCount, instructions: receipt.instructions, nodes: counts }));
}

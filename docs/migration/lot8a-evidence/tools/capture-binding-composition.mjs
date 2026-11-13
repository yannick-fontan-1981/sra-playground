import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { runBindingCommon, saveBindingEvidence } from '../../../../scripts/native-object-binding-common-loop.ts';
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const [mode, target] = process.argv.slice(2);
assert.ok(['positive', 'refutation', 'ambiguity', 'boundary'].includes(mode), 'Undeclared Binding scenario');
assert.ok(target && resolve(root, target).startsWith(resolve(root, 'docs/migration/lot8a-evidence/qualification-provisional-01') + '/'), 'Choose a declared new8A summary path');
const sink = process.env.LOGOS_LOT5C_COMMON_EVIDENCE_DIR;
assert.ok(sink && resolve(root, sink).startsWith(resolve(root, 'docs/migration/lot5c-evidence/recovery/common/lot8a-936fa2bf-')), 'Choose the dedicated8A Binding sink');
const report = await runBindingCommon(mode);
await saveBindingEvidence(mode, report);
const fingerprint = async path => { const data = await readFile(path); return { path: relative(root, path), bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') }; };
const summary = { schema: 'logos-engine.lot8a.binding-common-capture.v1', status: report.status, mode, synthetic: report.synthetic,
  returned: report.returned, ownReturns: report.ownReturns, sourceStages: report.sourceStages, declaredStages: report.declaredStages,
  sourceDeclarationsModified: report.sourceDeclarationsModified, executionInputsUnchangedDuringRun: report.executionInputsUnchangedDuringRun,
  checks: report.checks, actualJournal: await fingerprint(resolve(root, sink, mode, 'actual-operations.json')),
  fullReport: await fingerprint(resolve(root, sink, mode, 'common-loop.json.gz')),
  qualification: 'Fresh synthetic Binding common capture on the unchanged prepared5C/6B/Motif composition. Original comparison is a separate declared stage. No live game, official cost or publication.' };
await writeFile(resolve(root, target), JSON.stringify(summary, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({status: summary.status, mode, returned: summary.returned, sourceStages: summary.sourceStages, checks: summary.checks.passed}));
if (report.status !== 'passed' || report.executionInputsUnchangedDuringRun !== true || report.checks.failures.length) process.exitCode = 1;

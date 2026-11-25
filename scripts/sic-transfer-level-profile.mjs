import { readFileSync, writeFileSync } from 'node:fs';
import { installCycleProfile } from './sic-transfer-profiles.mjs';

const report = JSON.parse(readFileSync(process.env.SIC_TRANSFER_RULE_REPORT, 'utf8'));
const rule = report.probe.rule;
if (!report.configuration.induction || !rule || !Array.isArray(rule.conditions)) throw new Error('Missing induced rule');
const usage = { considered: 0, inferred: 0, first: null };
const save = () => writeFileSync(process.env.SIC_TRANSFER_RULE_USAGE, JSON.stringify(usage) + '\n');
save();
installCycleProfile({ mode: 'induced', rule }, undefined, evidence => {
  usage.considered++;
  if (!evidence) return;
  usage.inferred++;
  usage.first ??= { onset: evidence.start, witnesses: evidence.witnesses };
  save();
});
process.once('exit', save);

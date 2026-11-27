import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { Page } from './language.mjs';
import { dial } from './dial.mjs';
import { resource } from './resource.mjs';

export function exportCard(text) {
  const page = new Page(text);
  if (/^- `valider` /m.test(text)) return dial(page);
  if (/^- `sceller \w+` /m.test(text)) return resource(page);
  throw new Error('Commande terminale publique non reconnue');
}

// One assertion per line, so a reader can compare the JSON with the cited text.
export function serialize(m) {
  const entries = Object.entries({ format: m.format, goal: m.goal, observations: m.observations, domains: m.domains,
    commands: m.commands, rules: m.rules, sources: m.sources }).map(([key, value]) => {
    let rendered = JSON.stringify(value);
    if (Array.isArray(value) && value.length) rendered = '[\n    ' + value.map(v => JSON.stringify(v)).join(',\n    ') + '\n  ]';
    if (key === 'sources') rendered = JSON.stringify(value, null, 2).replaceAll('\n', '\n  ');
    return '  ' + JSON.stringify(key) + ': ' + rendered;
  });
  return '{\n' + entries.join(',\n') + '\n}\n';
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { out: { type: 'string' } } });
  if (positionals.length !== 1) throw new Error('Usage : node export.mjs FICHE.md [--out message.json]');
  const message = serialize(exportCard(readFileSync(positionals[0] === '-' ? 0 : positionals[0], 'utf8')));
  if (values.out) writeFileSync(values.out, message);
  else process.stdout.write(message);
}

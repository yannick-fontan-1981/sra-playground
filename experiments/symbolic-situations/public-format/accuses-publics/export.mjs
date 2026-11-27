import { readFileSync } from 'node:fs';
import { publish, toV1 } from './contrat.mjs';

const [file, ledger, ...rest] = process.argv.slice(2);
if (!file || rest.length) throw new Error('node export.mjs FICHE.json [DECLARATIONS.json | --v1]');
const read = path=>JSON.parse(readFileSync(path,'utf8'));
const page=read(file);
const result=ledger==='--v1' ? toV1(page) : publish(page,ledger ? read(ledger) : undefined);
console.log(JSON.stringify(result,null,2));

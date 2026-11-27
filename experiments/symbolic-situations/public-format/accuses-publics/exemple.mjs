import { examples } from './developpement.mjs';

const [name,part='card'] = process.argv.slice(2);
const entry=examples()[name];
if (!entry || !['base','declarations','card'].includes(part))
  throw new Error('Usage : node exemple.mjs B|B3|A|retours|ressource [base|declarations|card]');
console.log(JSON.stringify(entry[part],null,2));

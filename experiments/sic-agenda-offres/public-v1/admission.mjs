import { readFileSync } from 'node:fs';

const schema = JSON.parse(readFileSync(new URL('./schema.json', import.meta.url), 'utf8'));
export const key = value => JSON.stringify(value);
const own = (object, name) => Object.hasOwn(object, name);

// Interprète uniquement les mots-clés du schéma 2020-12 figé à côté de ce module.
function matches(value, s) {
  if (s === false) return false;
  if (s.$ref) return matches(value, schema.$defs[s.$ref.slice('#/$defs/'.length)]);
  if (s.oneOf) return s.oneOf.filter(sub => matches(value, sub)).length === 1;
  if (own(s, 'const')) return value === s.const;
  if (s.enum) return s.enum.includes(value);
  const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
  const types = Array.isArray(s.type) ? s.type : [s.type];
  if (!types.includes(type) && !(types.includes('integer') && Number.isSafeInteger(value))) return false;
  if (type === 'array') {
    if (value.length < (s.minItems ?? 0) || (s.uniqueItems && new Set(value.map(key)).size !== value.length)) return false;
    return value.every((item, i) => matches(item, s.prefixItems?.[i] ?? s.items));
  }
  if (type === 'string') return [...value].length >= (s.minLength ?? 0);
  if (type === 'number') return value >= (s.minimum ?? -Infinity);
  if (type !== 'object') return true;
  if (!s.properties && !s.patternProperties) return true;
  if (s.required && !s.required.every(k => own(value, k))) return false;
  const patterns = Object.entries(s.patternProperties ?? {}).map(([p, sub]) => [new RegExp(p), sub]);
  return Object.entries(value).every(([k, v]) => {
    if (s.properties && own(s.properties, k)) return matches(v, s.properties[k]);
    const found = patterns.filter(([pattern]) => pattern.test(k));
    return found.length ? found.every(([, sub]) => matches(v, sub)) : s.additionalProperties !== false;
  });
}

// Convention publique pour un accusé littéral. La ligne doit être citée par
// la commande et la nommer intégralement. Les effets restent dans les règles.
function declaredAck(command, sources) {
  const words = command.command, name = words.join(' '), args = words.slice(1).join(' ');
  const labels = new Set(), lines = [];
  for (const n of command.source) {
    const line = sources[n];
    if (!line.startsWith(name + ' ')) continue;
    const clause = line.slice(name.length + 1);
    if (!clause.includes('renvoie exactement')) continue;
    const direct = /^renvoie exactement « ([^«»\r\n]+) »\.$/u.exec(clause);
    const linked = /^est disponible si [^.!?«»\r\n]+\. La commande ([\p{L}\p{M}’'-]+)(.*?) et renvoie exactement « ([^«»\r\n]+) »\.$/u.exec(clause);
    const label = direct?.[1] ?? (linked && linked[2] === (args ? ' ' + args : '') ? linked[3] : null);
    if (!label || label.trim() !== label) return { ambiguous: true };
    labels.add(label);
    lines.push(n);
  }
  if (!labels.size) return null;
  return labels.size === 1 ? { text: [...labels][0], source: lines } : { ambiguous: true };
}

export function admit(input) {
  if (!matches(input, schema)) throw new Error('Fiche hors schéma sra.public/1');
  const cited = [input.goal, ...input.observations, ...input.domains, ...input.commands, ...input.rules];
  if (cited.some(record => record.source.some(n => !own(input.sources, n)))) throw new Error('Ligne publique absente');
  const index = (records, field) => {
    const map = new Map(records.map(record => [key(record[field]), record]));
    if (map.size !== records.length) throw new Error('Référence publique dupliquée : ' + field);
    return map;
  };
  const observations = index(input.observations, 'ref'), domains = index(input.domains, 'ref');
  const commands = index(input.commands, 'command');
  if (!commands.has(key(input.goal.command))) throw new Error('Commande terminale non déclarée');
  const rules = new Map([...commands.keys()].map(id => [id, []]));
  for (const rule of input.rules) {
    const id = key(rule.command);
    if (!rules.has(id)) throw new Error('Règle sans commande déclarée');
    rules.get(id).push(rule);
  }
  for (const [ref, domain] of domains) {
    const obs = observations.get(ref);
    if (obs?.status === 'known' && !domain.values.includes(obs.value)) throw new Error('Observation hors domaine');
  }
  const receipts = new Map();
  for (const [id, command] of commands) {
    const ack = declaredAck(command, input.sources);
    if (ack) receipts.set(id, ack);
  }
  return { goal: input.goal, commands, rules, domains, observations, receipts,
    lines: [...new Set(cited.flatMap(record => record.source))].sort((a, b) => a - b) };
}

import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(import.meta.url);
const DEFAULT_ROOT = resolve(dirname(SCRIPT), '..');
const MANIFEST = 'docs/migration/v6-current-entry-registry.json';
const MARKDOWN = 'docs/migration/v6-current-entry-registry.md';
const CAPS = ['product-active', 'qualified-library'];
const STATUSES = new Set([...CAPS, 'qualified-harness', 'historical-only', 'open']);
const IDENTITIES = new Set(['resolved', 'unresolved', 'not-applicable']);
const PATHS = ['implementationPaths', 'consumerPaths', 'functionalProofPaths', 'performanceProofPaths'];

function text(value, label) {
  assert.equal(typeof value, 'string', `${label} must be a string`);
  assert.ok(value.length, `${label} must be non-empty`);
}
function strings(value, label) {
  assert.ok(Array.isArray(value), `${label} must be an array`);
  const seen = new Set();
  value.forEach((item, index) => {
    text(item, `${label}[${index}]`);
    assert.ok(!seen.has(item), `${label} contains duplicate ${item}`);
    seen.add(item);
  });
}
function repoFile(root, path, label) {
  assert.ok(!path.startsWith('/') && !path.split('/').includes('..'), `${label} must be repository-relative`);
  const absolute = resolve(root, path);
  const rel = relative(root, absolute);
  assert.ok(rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel)), `${label} escapes repository root`);
  assert.ok(existsSync(absolute), `${label} missing path: ${path}`);
  assert.ok(statSync(absolute).isFile(), `${label} is not a file: ${path}`);
}

export function deriveSummary(entries) {
  return {
    totalEntries: entries.length,
    currentCapabilityEntries: entries.filter(entry => CAPS.includes(entry.status)).length,
    productActiveEntries: entries.filter(entry => entry.status === 'product-active').length,
    qualifiedLibraryEntries: entries.filter(entry => entry.status === 'qualified-library').length,
    qualificationHarnessEntries: entries.filter(entry => entry.status === 'qualified-harness').length,
    performanceQualifiedEntries: entries.filter(entry => entry.current.performanceQualified).length,
    historicalOnlyEntries: entries.filter(entry => entry.status === 'historical-only').length,
    openEntries: entries.filter(entry => entry.status === 'open').length,
    historicalIdentityResolvedEntries: entries.filter(entry => entry.historicalIdentity === 'resolved').length,
  };
}

function validateEntry(entry, index, root, checkPaths) {
  assert.ok(entry && typeof entry === 'object' && !Array.isArray(entry), `entries[${index}] must be an object`);
  text(entry.id, `entries[${index}].id`);
  assert.match(entry.id, /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/, `${entry.id} has an invalid identifier`);
  text(entry.title, `${entry.id}.title`);
  text(entry.domain, `${entry.id}.domain`);
  text(entry.contract, `${entry.id}.contract`);
  assert.ok(STATUSES.has(entry.status), `${entry.id} has invalid status ${entry.status}`);
  assert.ok(IDENTITIES.has(entry.historicalIdentity), `${entry.id} has invalid historicalIdentity ${entry.historicalIdentity}`);
  assert.ok(entry.current && typeof entry.current === 'object' && !Array.isArray(entry.current), `${entry.id}.current must be an object`);
  for (const key of ['implemented', 'consumed', 'functionallyQualified', 'performanceQualified', 'productActive']) {
    assert.equal(typeof entry.current[key], 'boolean', `${entry.id}.current.${key} must be boolean`);
  }
  PATHS.forEach(field => strings(entry[field], `${entry.id}.${field}`));
  strings(entry.limitations, `${entry.id}.limitations`);
  const qualified = CAPS.includes(entry.status) || entry.status === 'qualified-harness';
  if (qualified) {
    assert.equal(entry.current.implemented, true, `${entry.id} must be implemented`);
    assert.equal(entry.current.consumed, true, `${entry.id} must be consumed`);
    assert.equal(entry.current.functionallyQualified, true, `${entry.id} must be functionally qualified`);
    assert.ok(entry.implementationPaths.length, `${entry.id} qualified entry requires implementation paths`);
    assert.ok(entry.consumerPaths.length, `${entry.id} qualified entry requires consumer paths`);
    assert.ok(entry.functionalProofPaths.length, `${entry.id} qualified entry requires functional proofs`);
  }
  assert.equal(entry.current.productActive, entry.status === 'product-active', `${entry.id} productActive flag and status differ`);
  if (['historical-only', 'open'].includes(entry.status)) {
    assert.equal(entry.current.functionallyQualified, false, `${entry.id} open/historical entry cannot be qualified`);
    assert.equal(entry.current.performanceQualified, false, `${entry.id} open/historical entry cannot pass performance`);
  }
  if (entry.current.performanceQualified) {
    assert.ok(entry.performanceProofPaths.length, `${entry.id} performance qualification requires performance proofs`);
  }
  assert.notEqual(entry.historicalIdentity, 'resolved', `${entry.id} claims resolved historical identity without an identity-proof schema`);
  if (checkPaths) PATHS.forEach(field => entry[field].forEach((path, i) => repoFile(root, path, `${entry.id}.${field}[${i}]`)));
}

function validateManifest(registry, root, checkPaths) {
  assert.equal(registry.version, 1);
  assert.equal(registry.kind, 'v6-current-reconstruction-entry-registry');
  text(registry.generatedOn, 'generatedOn');
  text(registry.repository, 'repository');
  text(registry.canonicalBranch, 'canonicalBranch');
  assert.match(registry.auditedBaseCommit, /^[0-9a-f]{40}$/);
  assert.equal(registry.legacyRegistry.presentInAuditedBase, false);
  assert.equal(registry.legacyRegistry.recreatedAsHistoricalEquivalent, false);
  assert.equal(registry.historicalReference.publishedQualifiedCount, 70);
  assert.equal(registry.historicalReference.publishedTotalCount, 76);
  assert.equal(registry.historicalReference.formerCandidateQualifiedCount, 71);
  assert.equal(registry.historicalReference.mappingStatus, 'unresolved');
  assert.equal(registry.historicalReference.comparableToCurrentRegistry, false,
    'current registry may not be compared to the historical denominator');
  assert.deepEqual(registry.countPolicy.currentCapabilityStatuses, CAPS);
  assert.equal(registry.countPolicy.qualificationHarnessStatus, 'qualified-harness');
  assert.deepEqual(registry.countPolicy.excludedStatuses, ['historical-only', 'open']);
  assert.equal(registry.countPolicy.historicalComparisonAllowed, false);
  strings(registry.entryFiles, 'entryFiles');
  assert.deepEqual(registry.entryFiles, [...registry.entryFiles].sort(), 'entryFiles must be sorted');
  if (checkPaths) registry.entryFiles.forEach((path, i) => repoFile(root, path, `entryFiles[${i}]`));
}

export function loadRegistry(root = DEFAULT_ROOT) {
  const resolvedRoot = resolve(root);
  const manifest = JSON.parse(readFileSync(resolve(resolvedRoot, MANIFEST), 'utf8'));
  const entries = [];
  for (const path of manifest.entryFiles) {
    const fragment = JSON.parse(readFileSync(resolve(resolvedRoot, path), 'utf8'));
    assert.equal(fragment.version, 1, `${path} version must be 1`);
    assert.equal(fragment.kind, 'v6-current-reconstruction-entry-fragment', `${path} has wrong kind`);
    strings(fragment.domains, `${path}.domains`);
    assert.ok(Array.isArray(fragment.entries), `${path}.entries must be an array`);
    const ids = fragment.entries.map(entry => entry.id);
    assert.deepEqual(ids, [...ids].sort(), `${path}.entries must be sorted`);
    fragment.entries.forEach(entry => {
      assert.ok(fragment.domains.includes(entry.domain), `${entry.id} domain is outside ${path}`);
      entries.push(entry);
    });
  }
  entries.sort((left, right) => left.id.localeCompare(right.id));
  return { ...manifest, entries };
}

export function validateRegistry(registry, { root = DEFAULT_ROOT, checkPaths = true } = {}) {
  const resolvedRoot = resolve(root);
  validateManifest(registry, resolvedRoot, checkPaths);
  assert.ok(Array.isArray(registry.entries) && registry.entries.length, 'entries must not be empty');
  const ids = registry.entries.map(entry => entry.id);
  assert.deepEqual(ids, [...ids].sort(), 'entries must be globally sorted by id');
  assert.equal(new Set(ids).size, ids.length, 'entry ids must be unique');
  registry.entries.forEach((entry, index) => validateEntry(entry, index, resolvedRoot, checkPaths));
  const derived = deriveSummary(registry.entries);
  assert.deepEqual(registry.summary, derived, 'manifest summary must be derived exactly from entries');
  assert.equal(derived.currentCapabilityEntries + derived.qualificationHarnessEntries
    + derived.historicalOnlyEntries + derived.openEntries, derived.totalEntries,
  'status totals do not cover all entries');
  assert.equal(derived.historicalIdentityResolvedEntries, 0, 'no historical identity is currently resolved');
  return derived;
}

const yesNo = value => value ? 'oui' : 'non';

export function renderMarkdown(registry) {
  const s = deriveSummary(registry.entries);
  const lines = [
    '# Registre courant des frontières V6 reconstruites', '',
    '> Source de vérité machine : le manifeste `docs/migration/v6-current-entry-registry.json`',
    '> et ses fragments `docs/migration/v6-current-entry-registry/*.json`.',
    '> Cette vue est générée et vérifiée par `scripts/verify-v6-current-entry-registry.mjs`.', '',
    '## Référence auditée', '',
    `- dépôt : \`${registry.repository}\` ;`,
    `- branche canonique : \`${registry.canonicalBranch}\` ;`,
    `- commit de base audité : \`${registry.auditedBaseCommit}\` ;`,
    `- date : \`${registry.generatedOn}\` ;`,
    `- ancien chemin de registre : \`${registry.legacyRegistry.path}\` ;`,
    '- ancien registre présent dans la base auditée : **non** ;',
    '- équivalent historique recréé : **non**.', '',
    '## Verdict', '',
    `Le registre courant contient **${s.currentCapabilityEntries} frontières de capacité actuelles** :`, '',
    `- **${s.productActiveEntries}** actives dans le produit navigateur ;`,
    `- **${s.qualifiedLibraryEntries}** qualifiées comme bibliothèques ou seams non actifs dans le produit ;`,
    `- **${s.qualificationHarnessEntries}** frontières de qualification suivies séparément ;`,
    `- **${s.performanceQualifiedEntries}** qualifications officielles de performance ;`,
    `- **${s.historicalOnlyEntries}** entrée historique sans implémentation courante ;`,
    `- **${s.openEntries}** dettes ouvertes ;`,
    `- **${s.historicalIdentityResolvedEntries}** identité historique résolue.`, '',
    '**Ce résultat n’est pas `32/76`.** Le dénominateur historique, son découpage et',
    'la correspondance avec les frontières actuelles ne sont pas récupérés. Le',
    'compte courant utilise une granularité différente et non comparable.', '',
    '## Politique de comptage', '',
    `Unité : **${registry.countPolicy.unit}**.`, '',
    ...registry.countPolicy.notes.map(note => `- ${note}`), '',
    '## Totaux dérivés', '',
    '| Mesure | Valeur |', '| --- | ---: |',
    `| Entrées totales | ${s.totalEntries} |`,
    `| Capacités actuelles comptées | ${s.currentCapabilityEntries} |`,
    `| Actives produit | ${s.productActiveEntries} |`,
    `| Bibliothèques / seams qualifiés | ${s.qualifiedLibraryEntries} |`,
    `| Harnesses de qualification | ${s.qualificationHarnessEntries} |`,
    `| Qualifications performance | ${s.performanceQualifiedEntries} |`,
    `| Historiques seulement | ${s.historicalOnlyEntries} |`,
    `| Ouvertes | ${s.openEntries} |`,
    `| Identités historiques résolues | ${s.historicalIdentityResolvedEntries} |`, '',
    '## Entrées', '',
    '| Identifiant | Domaine | Statut | Produit | Fonctionnel | Performance | Identité historique |',
    '| --- | --- | --- | --- | ---: | ---: | --- |',
    ...registry.entries.map(entry => `| \`${entry.id}\` | ${entry.domain} | \`${entry.status}\` | `
      + `${yesNo(entry.current.productActive)} | ${yesNo(entry.current.functionallyQualified)} | `
      + `${yesNo(entry.current.performanceQualified)} | \`${entry.historicalIdentity}\` |`), '',
    'Les chemins d’implémentation, consommateurs, preuves et limites sont conservés',
    'dans les fragments JSON.', '', '## Frontières ouvertes', '',
  ];
  registry.entries.filter(entry => ['open', 'historical-only'].includes(entry.status)).forEach(entry => {
    lines.push(`### \`${entry.id}\``, '', entry.contract, '', ...entry.limitations.map(limit => `- ${limit}`), '');
  });
  lines.push(
    '## Invariants vérifiés', '',
    '- identifiants et fragments uniques et triés ;',
    '- implémentation, consommateur et preuve fonctionnelle pour chaque capacité comptée ;',
    '- preuve dédiée pour chaque qualification de performance ;',
    '- existence de tous les chemins référencés ;',
    '- totaux recalculés depuis les fragments ;',
    '- vue Markdown régénérée et comparée octet par octet ;',
    '- comparaison avec le dénominateur historique 76 interdite ;',
    '- entrées ouvertes et historiques exclues du compte courant.', '',
    '```bash', 'node scripts/verify-v6-current-entry-registry.mjs', '```', '',
    '## Étape suivante', '',
    'Les priorités deviennent la continuité de session de la campagne commune, un',
    'propriétaire physique d’objectif OP31, puis la mesure officielle de la',
    'composition produit active. La correspondance historique 70/76 et la parité',
    'Site 109 restent des chantiers séparés.', '',
  );
  return lines.join('\n');
}

export function verifyRepository(root = DEFAULT_ROOT) {
  const resolvedRoot = resolve(root);
  const registry = loadRegistry(resolvedRoot);
  const summary = validateRegistry(registry, { root: resolvedRoot, checkPaths: true });
  const actual = readFileSync(resolve(resolvedRoot, MARKDOWN), 'utf8');
  assert.equal(actual, `${renderMarkdown(registry)}\n`, `${MARKDOWN} is not the deterministic registry rendering`);
  return { registry, summary };
}

if (process.argv[1] && resolve(process.argv[1]) === SCRIPT) {
  try {
    const { summary } = verifyRepository();
    process.stdout.write(`${JSON.stringify({ status: 'verified', manifest: MANIFEST, markdown: MARKDOWN, summary }, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error?.stack ?? error}\n`);
    process.exitCode = 1;
  }
}

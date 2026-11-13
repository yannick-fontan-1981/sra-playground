import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const V6_CURRENT_REGISTRY_PATH = 'docs/migration/v6-entry-point-progress.json';
export const V6_CURRENT_REGISTRY_KIND = 'current-v6-reconstruction-capability-registry';

const REPOSITORY_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const ENTRY_FRAGMENT_KIND = 'current-v6-reconstruction-entry-fragment';
const EVIDENCE_GATES_KIND = 'current-v6-reconstruction-evidence-gates';
const OPEN_GAPS_KIND = 'current-v6-reconstruction-open-gaps';

const ENTRY_CATEGORIES = [
  'symbolic-engine',
  'addressed-learning',
  'public-perception',
  'region',
  'runtime-product',
];
const ENTRY_ACTIVATIONS = new Set([
  'shared-runtime',
  'worker-runtime',
  'product-runtime',
  'specialized-runtime',
]);
const ENTRY_STATUSES = new Set(['qualified', 'partial', 'unresolved']);
const PERFORMANCE_STATUSES = new Set([
  'qualified',
  'open',
  'not-required-for-current-claim',
]);

function invalid(message) {
  throw new Error(`V6 current reconstruction registry invalid: ${message}`);
}

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    invalid(`${label} must be an object`);
  }
  return value;
}

function array(value, label) {
  if (!Array.isArray(value)) invalid(`${label} must be an array`);
  return value;
}

function nonEmptyString(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    invalid(`${label} must be a non-empty string`);
  }
  return value;
}

function expectedSequentialId(prefix, index) {
  return `${prefix}${String(index + 1).padStart(3, '0')}`;
}

function validatePath(path, label, options) {
  nonEmptyString(path, label);
  if (path.startsWith('/') || path.split('/').includes('..')) {
    invalid(`${label} must be repository-relative`);
  }
  if (!options.exists(resolve(options.rootDir, path))) {
    invalid(`${label} does not exist: ${path}`);
  }
  return path;
}

function validatePaths(paths, label, options, { required = true } = {}) {
  const values = array(paths, label);
  if (required && values.length === 0) invalid(`${label} must not be empty`);
  const unique = new Set();
  for (const [index, path] of values.entries()) {
    validatePath(path, `${label}[${index}]`, options);
    if (unique.has(path)) invalid(`${label} contains duplicate path ${path}`);
    unique.add(path);
  }
  return values;
}

function readJson(rootDir, path) {
  return JSON.parse(readFileSync(resolve(rootDir, path), 'utf8'));
}

function mergeEntryDefaults(defaults, entry) {
  return {
    ...structuredClone(defaults),
    ...structuredClone(entry),
    performanceProofPaths: structuredClone(
      entry.performanceProofPaths ?? defaults.performanceProofPaths,
    ),
    historicalMapping: {
      ...structuredClone(defaults.historicalMapping),
      ...structuredClone(entry.historicalMapping ?? {}),
    },
    limitations: structuredClone(entry.limitations ?? defaults.limitations),
  };
}

function mergeSimpleDefaults(defaults, value) {
  return { ...structuredClone(defaults), ...structuredClone(value) };
}

export function loadV6CurrentRegistry(
  path = V6_CURRENT_REGISTRY_PATH,
  options = {},
) {
  const rootDir = options.rootDir ?? REPOSITORY_ROOT;
  const index = readJson(rootDir, path);
  const entryFiles = array(index.entryFiles, 'entryFiles');
  const entryDocuments = entryFiles.map(file => readJson(rootDir, file));
  const evidenceDocument = readJson(rootDir, index.evidenceGatesFile);
  const gapDocument = readJson(rootDir, index.openGapsFile);

  const defaults = object(index.entryDefaults, 'entryDefaults');
  const evidenceDefaults = object(index.evidenceGateDefaults, 'evidenceGateDefaults');
  const gapDefaults = object(index.openGapDefaults, 'openGapDefaults');

  const entries = [];
  for (const [fragmentIndex, document] of entryDocuments.entries()) {
    if (document.version !== 1 || document.kind !== ENTRY_FRAGMENT_KIND) {
      invalid(`entry fragment ${entryFiles[fragmentIndex]} has an unsupported contract`);
    }
    const expectedCategory = ENTRY_CATEGORIES[fragmentIndex];
    if (document.category !== expectedCategory) {
      invalid(
        `entry fragment ${entryFiles[fragmentIndex]} must declare category ${expectedCategory}`,
      );
    }
    for (const entry of array(document.entries, `${entryFiles[fragmentIndex]}.entries`)) {
      if (entry.category !== expectedCategory) {
        invalid(`${entry.id ?? 'unknown entry'} is stored in the wrong category fragment`);
      }
      entries.push(mergeEntryDefaults(defaults, entry));
    }
  }

  if (evidenceDocument.version !== 1 || evidenceDocument.kind !== EVIDENCE_GATES_KIND) {
    invalid('evidence gate document has an unsupported contract');
  }
  if (gapDocument.version !== 1 || gapDocument.kind !== OPEN_GAPS_KIND) {
    invalid('open gap document has an unsupported contract');
  }

  return {
    ...index,
    entries,
    evidenceGates: array(evidenceDocument.gates, 'evidence gates').map(
      gate => mergeSimpleDefaults(evidenceDefaults, gate),
    ),
    openGaps: array(gapDocument.gaps, 'open gaps').map(
      gap => mergeSimpleDefaults(gapDefaults, gap),
    ),
    registrySourceFiles: [
      path,
      ...entryFiles,
      index.evidenceGatesFile,
      index.openGapsFile,
    ],
  };
}

function validateEntry(entry, index, options) {
  const value = object(entry, `entries[${index}]`);
  const expectedId = expectedSequentialId('RC', index);
  if (value.id !== expectedId) invalid(`entries[${index}].id must be ${expectedId}`);
  nonEmptyString(value.name, `${value.id}.name`);

  if (!ENTRY_CATEGORIES.includes(value.category)) {
    invalid(`${value.id}.category is unsupported: ${value.category}`);
  }
  if (!ENTRY_ACTIVATIONS.has(value.activation)) {
    invalid(`${value.id}.activation is unsupported: ${value.activation}`);
  }
  if (!ENTRY_STATUSES.has(value.status)) {
    invalid(`${value.id}.status is unsupported: ${value.status}`);
  }
  if (!PERFORMANCE_STATUSES.has(value.performanceStatus)) {
    invalid(`${value.id}.performanceStatus is unsupported: ${value.performanceStatus}`);
  }

  if (typeof value.counted !== 'boolean') invalid(`${value.id}.counted must be boolean`);
  const shouldCount = value.status === 'qualified';
  if (value.counted !== shouldCount) {
    invalid(`${value.id}.counted must equal qualification status`);
  }
  const expectedQualification = value.performanceStatus === 'qualified'
    ? 'functional-and-performance'
    : 'functional';
  if (value.qualification !== expectedQualification) {
    invalid(`${value.id}.qualification must be ${expectedQualification}`);
  }

  validatePaths(value.implementationPaths, `${value.id}.implementationPaths`, options);
  validatePaths(value.functionalProofPaths, `${value.id}.functionalProofPaths`, options);
  validatePaths(
    value.performanceProofPaths,
    `${value.id}.performanceProofPaths`,
    options,
    { required: value.performanceStatus === 'qualified' },
  );
  if (value.performanceStatus !== 'qualified' && value.performanceProofPaths.length !== 0) {
    invalid(`${value.id} has performance proofs without a qualified performance status`);
  }

  const mapping = object(value.historicalMapping, `${value.id}.historicalMapping`);
  if (mapping.status !== 'unresolved') {
    invalid(`${value.id} must remain historically unresolved until a per-slot mapping is proved`);
  }
  if (!Array.isArray(mapping.historicalEntryIds) || mapping.historicalEntryIds.length !== 0) {
    invalid(`${value.id} must not claim historical entry ids`);
  }

  const limitations = array(value.limitations, `${value.id}.limitations`);
  for (const [limitIndex, limitation] of limitations.entries()) {
    nonEmptyString(limitation, `${value.id}.limitations[${limitIndex}]`);
  }
  return value;
}

function validateEvidenceGate(gate, index, options) {
  const value = object(gate, `evidenceGates[${index}]`);
  const expectedId = expectedSequentialId('EG', index);
  if (value.id !== expectedId) invalid(`evidenceGates[${index}].id must be ${expectedId}`);
  nonEmptyString(value.name, `${value.id}.name`);
  if (value.status !== 'qualified') invalid(`${value.id}.status must be qualified`);
  if (value.counted !== false) invalid(`${value.id} must not be counted as a capability`);
  validatePaths(value.implementationPaths, `${value.id}.implementationPaths`, options);
  validatePaths(value.proofPaths, `${value.id}.proofPaths`, options);
  return value;
}

function validateOpenGap(gap, index, options) {
  const value = object(gap, `openGaps[${index}]`);
  const expectedId = expectedSequentialId('G', index);
  if (value.id !== expectedId) invalid(`openGaps[${index}].id must be ${expectedId}`);
  nonEmptyString(value.name, `${value.id}.name`);
  nonEmptyString(value.reason, `${value.id}.reason`);
  if (value.status !== 'open') invalid(`${value.id}.status must be open`);
  if (value.counted !== false) invalid(`${value.id} must not be counted as a capability`);
  validatePaths(value.evidencePaths, `${value.id}.evidencePaths`, options);
  return value;
}

export function validateV6CurrentRegistry(registry, options = {}) {
  const value = object(registry, 'registry');
  const validationOptions = {
    rootDir: options.rootDir ?? REPOSITORY_ROOT,
    exists: options.exists ?? existsSync,
  };

  if (value.version !== 1) invalid('version must be 1');
  if (value.kind !== V6_CURRENT_REGISTRY_KIND) {
    invalid(`kind must be ${V6_CURRENT_REGISTRY_KIND}`);
  }
  nonEmptyString(value.inventoryDate, 'inventoryDate');

  validatePaths(
    value.registrySourceFiles,
    'registrySourceFiles',
    validationOptions,
  );

  const baseline = object(value.inventoryBaseline, 'inventoryBaseline');
  if (baseline.repository !== 'yannick-fontan-1981/sra-playground') {
    invalid('inventoryBaseline.repository is not canonical');
  }
  if (baseline.branch !== 'recovery/site109-reconstruction-20261112') {
    invalid('inventoryBaseline.branch is not canonical');
  }
  if (!/^[0-9a-f]{40}$/.test(baseline.commit)) {
    invalid('inventoryBaseline.commit must be a full Git commit SHA');
  }

  const historical = object(value.historicalReference, 'historicalReference');
  if (historical.siteRevision !== 109 || historical.nativeVersion !== '0.68') {
    invalid('historical reference must remain Site 109 / native 0.68');
  }
  if (historical.reportedImplemented !== 70 || historical.reportedTotal !== 76) {
    invalid('historical reference must preserve the reported 70/76 evidence');
  }
  if (historical.unresolvedSourceSha !== 'd90ce5b64fffa53cca201e2a6a49450fd123f299') {
    invalid('historical unresolved source SHA changed');
  }
  if (
    historical.sourceIdentityResolved !== false
    || historical.mappingStatus !== 'unresolved'
    || historical.comparableToCurrentRegistry !== false
  ) {
    invalid('historical identity and mapping must remain explicitly unresolved');
  }

  const policy = object(value.countingPolicy, 'countingPolicy');
  nonEmptyString(policy.unit, 'countingPolicy.unit');
  if (
    policy.qualifiedEntryCounted !== true
    || policy.partialEntryCounted !== false
    || policy.benchmarkAndTestInfrastructureCounted !== false
    || policy.operationsCatalogueCountedAsOneAggregate !== true
    || policy.historicalDenominatorAppliedToCurrentCount !== false
  ) {
    invalid('counting policy changed in a way that can inflate or historicize the current count');
  }
  if (array(policy.exclusions, 'countingPolicy.exclusions').length < 5) {
    invalid('countingPolicy.exclusions is incomplete');
  }

  const entries = array(value.entries, 'entries').map(
    (entry, index) => validateEntry(entry, index, validationOptions),
  );
  const evidenceGates = array(value.evidenceGates, 'evidenceGates').map(
    (gate, index) => validateEvidenceGate(gate, index, validationOptions),
  );
  const openGaps = array(value.openGaps, 'openGaps').map(
    (gap, index) => validateOpenGap(gap, index, validationOptions),
  );

  const allIds = [...entries, ...evidenceGates, ...openGaps].map(item => item.id);
  if (new Set(allIds).size !== allIds.length) invalid('registry ids must be globally unique');

  const opAggregates = entries.filter(entry => entry.aggregation?.key === 'op01-op31-catalogue');
  if (opAggregates.length !== 1 || opAggregates[0].aggregation.operationsRepresented !== 31) {
    invalid('OP01-OP31 must be represented by exactly one 31-operation aggregate entry');
  }
  if (entries.some(entry => /^OP\d{2}$/i.test(entry.id))) {
    invalid('individual operation ids cannot inflate the current V6 capability count');
  }

  const computed = {
    inventoriedCapabilities: entries.length,
    qualifiedCapabilities: entries.filter(entry => entry.status === 'qualified').length,
    partialCapabilities: entries.filter(entry => entry.status === 'partial').length,
    countedCurrentCapabilities: entries.filter(entry => entry.counted).length,
    performanceQualifiedCapabilities: entries.filter(
      entry => entry.performanceStatus === 'qualified',
    ).length,
    historicallyMappedCapabilities: entries.filter(
      entry => entry.historicalMapping.status === 'mapped',
    ).length,
    evidenceGateCount: evidenceGates.length,
    openGapCount: openGaps.length,
    currentCountDenominator: null,
  };

  const summary = object(value.summary, 'summary');
  for (const [key, expected] of Object.entries(computed)) {
    if (summary[key] !== expected) {
      invalid(`summary.${key}=${summary[key]} does not match computed value ${expected}`);
    }
  }
  if (summary.currentCountDenominator !== null) {
    invalid('the current reconstruction count must not use the historical denominator 76');
  }
  if (summary.historicallyMappedCapabilities !== 0) {
    invalid('no current capability may be counted as historically mapped yet');
  }

  return {
    kind: value.kind,
    baseline,
    historical,
    summary: computed,
    categoryCounts: Object.fromEntries(
      ENTRY_CATEGORIES.map(category => [
        category,
        entries.filter(entry => entry.category === category).length,
      ]),
    ),
    openGapIds: openGaps.map(gap => gap.id),
    registrySourceFiles: value.registrySourceFiles,
  };
}

export function loadAndValidateV6CurrentRegistry(
  path = V6_CURRENT_REGISTRY_PATH,
  options = {},
) {
  const registry = loadV6CurrentRegistry(path, options);
  return validateV6CurrentRegistry(registry, options);
}

const modulePath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === modulePath) {
  const result = loadAndValidateV6CurrentRegistry();
  console.log(JSON.stringify({
    status: 'current-v6-reconstruction-registry-verified',
    baseline: result.baseline,
    summary: result.summary,
    categoryCounts: result.categoryCounts,
    historicalComparisonAllowed: false,
    sourceFiles: result.registrySourceFiles,
  }, null, 2));
}

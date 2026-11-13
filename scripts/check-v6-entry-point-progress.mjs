import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_REGISTRY_PATH = 'docs/migration/v6-entry-point-progress.json';

const EXPECTED_OPERATION_IDS = Array.from(
  { length: 31 },
  (_, index) => `OP${String(index + 1).padStart(2, '0')}`,
);

const REQUIRED_CAPABILITY_IDS = [
  'logos.operation-catalog',
  'logos.composition-authority',
  'logos.operation-observability',
  'campaign.common-owner',
  'campaign.field-stock-op18',
  'campaign.public-simple-op28',
  'campaign.joint-channels-op28',
  'learning.addressed-field-stock',
  'learning.region-intervention',
  'runtime.public-observation',
  'runtime.browser-campaign-host',
  'runtime.browser-agent-controller',
  'runtime.worker-campaign',
  'runtime.product-dispatch-presentation',
  'qualification.native-abba-harness',
];

const REQUIRED_OPEN_GATES = [
  'historical-slot-schema',
  'site109-source-identity',
  'campaign-snapshot-restoration',
  'op31-objective-owner',
  'region-product-owner',
  'full-product-composition-performance',
  'site-publication',
];

const OFFICIAL_PERFORMANCE_CAPABILITIES = [
  'campaign.joint-channels-op28',
  'learning.region-intervention',
];

function sorted(values) {
  return [...values].sort((left, right) => left.localeCompare(right, 'en'));
}

function sameStringSet(actual, expected) {
  return JSON.stringify(sorted(actual)) === JSON.stringify(sorted(expected));
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function push(errors, condition, message) {
  if (!condition) errors.push(message);
}

function uniqueIds(records, label, errors) {
  const ids = records.map(record => record?.id);
  push(errors, ids.every(id => typeof id === 'string' && id.length > 0), `${label}: every record must have a non-empty string id`);
  push(errors, new Set(ids).size === ids.length, `${label}: duplicate ids are forbidden`);
  return ids;
}

function recordPaths(record) {
  return ['implementation', 'tests', 'proofs'].flatMap(key =>
    Array.isArray(record?.[key]) ? record[key] : [],
  );
}

function safeRepositoryPath(value) {
  return typeof value === 'string'
    && value.length > 0
    && !path.isAbsolute(value)
    && !value.split(/[\\/]+/u).includes('..');
}

export function deriveSummary(registry) {
  const operations = Array.isArray(registry?.operations) ? registry.operations : [];
  const capabilities = Array.isArray(registry?.capabilities) ? registry.capabilities : [];
  const historical = isObject(registry?.historical76) ? registry.historical76 : {};

  return {
    operationRecords: operations.length,
    capabilityRecords: capabilities.length,
    inventoryRecords: operations.length + capabilities.length,
    operationsCalculationQualified: operations.filter(record => record.calculationStatus === 'qualified').length,
    operationsProductActive: operations.filter(record => record.productActive === true).length,
    capabilitiesFunctionalQualified: capabilities.filter(record =>
      typeof record.functionalStatus === 'string'
      && record.functionalStatus.startsWith('qualified'),
    ).length,
    capabilitiesProductActive: capabilities.filter(record => record.productStatus === 'active').length,
    capabilitiesSupportingActive: capabilities.filter(record => record.productStatus === 'supporting-active').length,
    capabilitiesOfficialPerformanceQualified: capabilities.filter(record => record.performanceStatus === 'official-qualified').length,
    historicalMappedSlots: Number.isInteger(historical.mappedSlots) ? historical.mappedSlots : null,
    historicalCount: historical.currentCount ?? null,
    historicalParityClaimed: historical.parityClaimed === true,
  };
}

export async function loadRegistry(registryPath = DEFAULT_REGISTRY_PATH) {
  const content = await readFile(registryPath, 'utf8');
  return JSON.parse(content);
}

export async function validateRegistry(registry, options = {}) {
  const errors = [];
  const root = path.resolve(options.root ?? process.cwd());
  const checkPaths = options.checkPaths !== false;

  push(errors, isObject(registry), 'registry must be an object');
  if (!isObject(registry)) throw new Error(errors.join('\n'));

  push(errors, registry.schemaVersion === 1, 'schemaVersion must be 1');
  push(errors, registry.registryKind === 'reconstructed-capability-evidence', 'registryKind must be reconstructed-capability-evidence');
  push(errors, Number.isFinite(Date.parse(registry.generatedAt)), 'generatedAt must be an ISO date');

  push(errors, isObject(registry.baseline), 'baseline must be an object');
  push(errors, registry.baseline?.repository === 'yannick-fontan-1981/sra-playground', 'baseline.repository must identify the canonical repository');
  push(errors, registry.baseline?.canonicalBranch === 'recovery/site109-reconstruction-20261112', 'baseline.canonicalBranch must identify the reconstruction branch');
  push(errors, /^[0-9a-f]{40}$/u.test(registry.baseline?.canonicalCommit ?? ''), 'baseline.canonicalCommit must be a full Git SHA');

  push(errors, Array.isArray(registry.qualificationLevels), 'qualificationLevels must be an array');
  push(errors, new Set(registry.qualificationLevels ?? []).size === (registry.qualificationLevels ?? []).length, 'qualificationLevels must be unique');

  const historical = registry.historical76;
  push(errors, isObject(historical), 'historical76 must be an object');
  push(errors, historical?.targetSlots === 76, 'historical76.targetSlots must remain 76');
  push(errors, Array.isArray(historical?.historicalClaimsObserved), 'historical claims must be an array');
  push(errors, sameStringSet((historical?.historicalClaimsObserved ?? []).map(String), ['70', '71']), 'historical claims must preserve 70 and 71 as evidence only');
  push(errors, historical?.slotSchemaRecovered === false, 'historical slot schema must remain unresolved');
  push(errors, historical?.mappedSlots === 0, 'historical mapped slots must remain zero until slot identities are recovered');
  push(errors, historical?.currentCount === null, 'historical current count must remain null');
  push(errors, historical?.parityClaimed === false, 'historical parity must not be claimed');
  push(errors, historical?.site109ParityClaimed === false, 'Site 109 parity must not be claimed');
  push(errors, /^[0-9a-f]{40}$/u.test(historical?.unresolvedSiteSourceSha ?? ''), 'unresolved Site source SHA must be retained as a full SHA');

  const operations = Array.isArray(registry.operations) ? registry.operations : [];
  const operationIds = uniqueIds(operations, 'operations', errors);
  push(errors, operations.length === 31, 'operations must contain exactly 31 records');
  push(errors, sameStringSet(operationIds, EXPECTED_OPERATION_IDS), 'operations must contain OP01 through OP31 exactly once');

  for (const operation of operations) {
    const label = operation?.id ?? '<unknown operation>';
    push(errors, operation?.calculationStatus === 'qualified', `${label}: calculationStatus must be qualified`);
    push(errors, typeof operation?.runtimeUse === 'string' && operation.runtimeUse.length > 0, `${label}: runtimeUse is required`);
    push(errors, typeof operation?.productActive === 'boolean', `${label}: productActive must be boolean`);
    push(errors, typeof operation?.decisionEffect === 'string' && operation.decisionEffect.length > 0, `${label}: decisionEffect is required`);
    push(errors, Array.isArray(operation?.producers), `${label}: producers must be an array`);
    push(errors, Array.isArray(operation?.consumers), `${label}: consumers must be an array`);
    push(errors, Array.isArray(operation?.implementation) && operation.implementation.length > 0, `${label}: implementation evidence is required`);
    push(errors, Array.isArray(operation?.tests) && operation.tests.length > 0, `${label}: test evidence is required`);
    push(errors, Array.isArray(operation?.proofs) && operation.proofs.length > 0, `${label}: proof evidence is required`);
    push(errors, operation?.historicalMapping === null, `${label}: historicalMapping must remain null`);
    push(errors, operation?.historicalCountDisposition === 'unmapped', `${label}: historicalCountDisposition must remain unmapped`);
  }

  const activeOperations = operations.filter(record => record.productActive).map(record => record.id);
  push(errors, sameStringSet(activeOperations, ['OP18', 'OP28']), 'only OP18 and OP28 may be marked product-active in the current evidence');
  push(errors, operations.find(record => record.id === 'OP31')?.runtimeUse === 'generic-call-no-objective-owner', 'OP31 must remain unowned by an objective producer');

  const capabilities = Array.isArray(registry.capabilities) ? registry.capabilities : [];
  const capabilityIds = uniqueIds(capabilities, 'capabilities', errors);
  push(errors, sameStringSet(capabilityIds, REQUIRED_CAPABILITY_IDS), 'capabilities must contain the exact first reconstructed capability set');

  for (const capability of capabilities) {
    const label = capability?.id ?? '<unknown capability>';
    push(errors, typeof capability?.title === 'string' && capability.title.length > 0, `${label}: title is required`);
    push(errors, typeof capability?.kind === 'string' && capability.kind.length > 0, `${label}: kind is required`);
    push(errors, typeof capability?.functionalStatus === 'string' && capability.functionalStatus.startsWith('qualified'), `${label}: functionalStatus must be qualified`);
    push(errors, typeof capability?.productStatus === 'string' && capability.productStatus.length > 0, `${label}: productStatus is required`);
    push(errors, typeof capability?.performanceStatus === 'string' && capability.performanceStatus.length > 0, `${label}: performanceStatus is required`);
    push(errors, Array.isArray(capability?.producers), `${label}: producers must be an array`);
    push(errors, Array.isArray(capability?.consumers), `${label}: consumers must be an array`);
    push(errors, Array.isArray(capability?.implementation) && capability.implementation.length > 0, `${label}: implementation evidence is required`);
    push(errors, Array.isArray(capability?.tests) && capability.tests.length > 0, `${label}: test evidence is required`);
    push(errors, Array.isArray(capability?.proofs) && capability.proofs.length > 0, `${label}: proof evidence is required`);
    push(errors, Array.isArray(capability?.limits), `${label}: limits must be an array`);
    push(errors, capability?.historicalMapping === null, `${label}: historicalMapping must remain null`);
    push(errors, capability?.historicalCountDisposition === 'unmapped', `${label}: historicalCountDisposition must remain unmapped`);
  }

  const officialPerformance = capabilities
    .filter(record => record.performanceStatus === 'official-qualified')
    .map(record => record.id);
  push(errors, sameStringSet(officialPerformance, OFFICIAL_PERFORMANCE_CAPABILITIES), 'official performance qualification must remain limited to Region and joint channels');

  const openGates = Array.isArray(registry.openGates) ? registry.openGates : [];
  const gateIds = uniqueIds(openGates, 'openGates', errors);
  push(errors, sameStringSet(gateIds, REQUIRED_OPEN_GATES), 'openGates must preserve all unresolved reconstruction gates');
  push(errors, openGates.find(gate => gate.id === 'site-publication')?.status === 'blocked', 'Site publication must remain blocked');

  const derivedSummary = deriveSummary(registry);
  push(errors, JSON.stringify(registry.summary) === JSON.stringify(derivedSummary), 'summary must exactly match values derived from records');

  push(errors, registry.disposition?.registryReconstructed === true, 'registry disposition must mark the reconstructed inventory complete');
  push(errors, registry.disposition?.historicalRegistryRecovered === false, 'historical registry must remain unresolved');
  push(errors, registry.disposition?.historicalCountClaimed === false, 'historical count must not be claimed');
  push(errors, registry.disposition?.sitePublished === false, 'Site publication must remain false');

  const referencedPaths = sorted(new Set([
    ...operations.flatMap(recordPaths),
    ...capabilities.flatMap(recordPaths),
  ]));
  for (const reference of referencedPaths) {
    push(errors, safeRepositoryPath(reference), `unsafe or invalid repository path: ${reference}`);
  }

  const missingPaths = [];
  if (checkPaths) {
    await Promise.all(referencedPaths.filter(safeRepositoryPath).map(async reference => {
      try {
        await access(path.join(root, reference));
      } catch {
        missingPaths.push(reference);
      }
    }));
    if (missingPaths.length > 0) {
      errors.push(`missing evidence paths:\n${sorted(missingPaths).map(value => `  - ${value}`).join('\n')}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid V6 entry-point registry:\n${errors.map(error => `- ${error}`).join('\n')}`);
  }

  return {
    valid: true,
    summary: derivedSummary,
    referencedPaths,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const checkPaths = !args.includes('--no-check-paths');
  const explicitPath = args.find(argument => !argument.startsWith('--'));
  const registryPath = explicitPath ?? DEFAULT_REGISTRY_PATH;
  const registry = await loadRegistry(registryPath);
  const result = await validateRegistry(registry, {
    root: process.cwd(),
    checkPaths,
  });
  console.log(JSON.stringify({
    registryPath,
    valid: result.valid,
    referencedPathCount: result.referencedPaths.length,
    summary: result.summary,
  }, null, 2));
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
const modulePath = fileURLToPath(import.meta.url);
if (invokedPath === modulePath) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

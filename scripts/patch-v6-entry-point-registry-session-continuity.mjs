import { readFileSync, writeFileSync } from 'node:fs';

const registryPath = 'docs/migration/v6-entry-point-progress.json';
const checkerPath = 'scripts/check-v6-entry-point-progress.mjs';
const testPath = 'tests/v6-entry-point-progress.test.ts';
const reportPath = 'docs/recovery/v6-entry-point-registry-reconstruction-20261113.md';

function addUnique(values, additions) {
  for (const value of additions) {
    if (!values.includes(value)) values.push(value);
  }
}

function replaceRequired(content, before, after, label) {
  if (content.includes(after)) return content;
  if (!content.includes(before)) throw new Error(`Missing ${label}`);
  return content.replace(before, after);
}

const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
registry.baseline.canonicalCommit = '9e04bbd5569f6755178fa1b5276a112ca47d646b';

const commonOwner = registry.capabilities.find(({ id }) => id === 'campaign.common-owner');
if (!commonOwner) throw new Error('Missing campaign.common-owner');
addUnique(commonOwner.implementation, ['src/logos-engine/v6-common-campaign-checkpoint.ts']);
addUnique(commonOwner.tests, ['tests/v6-common-campaign-session-continuity.test.ts']);
addUnique(commonOwner.proofs, [
  'docs/recovery/op01-op31-session-continuity-core-20261113.md',
  'docs/recovery/op01-op31-session-continuity-core-qualified.json',
]);
commonOwner.limits = [
  'Aucune priorité implicite entre propriétaires indépendants.',
  'Le checkpoint commun est qualifié au niveau noyau, mais pas encore possédé par le host/contrôleur navigateur.',
];

if (!registry.capabilities.some(({ id }) => id === 'runtime.campaign-checkpoint-core')) {
  const insertionIndex = registry.capabilities.findIndex(({ id }) => id === 'campaign.common-owner') + 1;
  registry.capabilities.splice(insertionIndex, 0, {
    id: 'runtime.campaign-checkpoint-core',
    title: 'Noyau atomique de checkpoint de campagne',
    kind: 'runtime-continuity',
    functionalStatus: 'qualified-bounded',
    productStatus: 'available-not-main',
    performanceStatus: 'not-measured-separately',
    producers: [
      'CommonCampaignOwner snapshot',
      'ObservedAddressedMaterialCheckpointParticipant snapshot',
    ],
    consumers: [
      'CommonCampaignCheckpointCoordinator restore',
      'fresh CommonCampaignOwner and FieldStock runtime',
    ],
    decisionEffect: 'Préserve atomiquement l’ordre des propriétaires, le needId, l’action en attente, la déduplication et l’état FieldStock, avec rollback intégral en cas d’échec.',
    implementation: [
      'src/logos-engine/v6-common-campaign-checkpoint.ts',
      'src/logos-engine/field-stock-snapshot.ts',
      'src/logos-engine/v6-common-campaign-owner.ts',
      'src/runtime/observed-addressed-material-checkpoint.ts',
    ],
    tests: [
      'tests/v6-common-campaign-session-continuity.test.ts',
      'tests/v6-common-campaign-owner.test.ts',
      'tests/v6-neutral-common-caller.test.ts',
    ],
    proofs: [
      'docs/recovery/op01-op31-session-continuity-core-20261113.md',
      'docs/recovery/op01-op31-session-continuity-core-qualified.json',
      'docs/migration/op01-op31-progress.md',
    ],
    limits: [
      'Pas encore exposé par BrowserCommonCampaignHost.',
      'Pas encore possédé par BrowserAgentController.',
      'Aucune preuve de désactivation/réactivation Agent dans le navigateur réel.',
      'Aucun coût de persistance produit qualifié, car le snapshot n’est pas appelé dans la boucle active.',
    ],
    historicalMapping: null,
    historicalCountDisposition: 'unmapped',
  });
}

const browserHost = registry.capabilities.find(({ id }) => id === 'runtime.browser-campaign-host');
if (!browserHost) throw new Error('Missing runtime.browser-campaign-host');
browserHost.limits = [
  'Le noyau de checkpoint existe, mais le host ne l’expose et ne le possède pas encore à une frontière navigateur sûre.',
];

const browserController = registry.capabilities.find(({ id }) => id === 'runtime.browser-agent-controller');
if (!browserController) throw new Error('Missing runtime.browser-agent-controller');
browserController.limits = [
  'Le noyau de checkpoint est qualifié hors boucle active; la désactivation puis réactivation Agent réelle n’est pas encore raccordée.',
];

const oldGateIndex = registry.openGates.findIndex(({ id }) => id === 'campaign-snapshot-restoration');
const newGate = {
  id: 'browser-session-reactivation',
  status: 'open',
  blocks: ['cross-activation-product-continuity'],
  reason: 'Le noyau atomique campagne + FieldStock est qualifié, mais le host et le contrôleur navigateur ne possèdent pas encore le checkpoint et aucune reprise Agent réelle n’est démontrée.',
};
if (oldGateIndex >= 0) registry.openGates.splice(oldGateIndex, 1, newGate);
else if (!registry.openGates.some(({ id }) => id === newGate.id)) registry.openGates.push(newGate);

registry.disposition.nextStep = 'connect the qualified campaign checkpoint core to BrowserCommonCampaignHost and BrowserAgentController, prove real Agent reactivation, and continue searching durable evidence for the historical 76-slot schema';
registry.summary = {
  operationRecords: registry.operations.length,
  capabilityRecords: registry.capabilities.length,
  inventoryRecords: registry.operations.length + registry.capabilities.length,
  operationsCalculationQualified: registry.operations.filter(({ calculationStatus }) => calculationStatus === 'qualified').length,
  operationsProductActive: registry.operations.filter(({ productActive }) => productActive === true).length,
  capabilitiesFunctionalQualified: registry.capabilities.filter(({ functionalStatus }) => typeof functionalStatus === 'string' && functionalStatus.startsWith('qualified')).length,
  capabilitiesProductActive: registry.capabilities.filter(({ productStatus }) => productStatus === 'active').length,
  capabilitiesSupportingActive: registry.capabilities.filter(({ productStatus }) => productStatus === 'supporting-active').length,
  capabilitiesOfficialPerformanceQualified: registry.capabilities.filter(({ performanceStatus }) => performanceStatus === 'official-qualified').length,
  historicalMappedSlots: registry.historical76.mappedSlots,
  historicalCount: registry.historical76.currentCount,
  historicalParityClaimed: registry.historical76.parityClaimed === true,
};
writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`);

let checker = readFileSync(checkerPath, 'utf8');
checker = replaceRequired(
  checker,
  "  'campaign.common-owner',\n  'campaign.field-stock-op18',",
  "  'campaign.common-owner',\n  'runtime.campaign-checkpoint-core',\n  'campaign.field-stock-op18',",
  'checkpoint capability id insertion',
);
checker = replaceRequired(
  checker,
  "  'campaign-snapshot-restoration',",
  "  'browser-session-reactivation',",
  'browser gate replacement',
);
checker = replaceRequired(
  checker,
  "  const openGates = Array.isArray(registry.openGates) ? registry.openGates : [];",
  "  const checkpointCore = capabilities.find(record => record.id === 'runtime.campaign-checkpoint-core');\n  push(errors, checkpointCore?.functionalStatus === 'qualified-bounded', 'campaign checkpoint core must remain functionally qualified');\n  push(errors, checkpointCore?.productStatus === 'available-not-main', 'campaign checkpoint core must remain outside the active browser loop until reactivation is qualified');\n  push(errors, checkpointCore?.performanceStatus === 'not-measured-separately', 'campaign checkpoint core must not claim a performance qualification');\n\n  const openGates = Array.isArray(registry.openGates) ? registry.openGates : [];",
  'checkpoint assertions insertion',
);
checker = replaceRequired(
  checker,
  "  push(errors, sameStringSet(gateIds, REQUIRED_OPEN_GATES), 'openGates must preserve all unresolved reconstruction gates');\n  push(errors, openGates.find(gate => gate.id === 'site-publication')?.status === 'blocked', 'Site publication must remain blocked');",
  "  push(errors, sameStringSet(gateIds, REQUIRED_OPEN_GATES), 'openGates must preserve all unresolved reconstruction gates');\n  push(errors, openGates.find(gate => gate.id === 'browser-session-reactivation')?.status === 'open', 'browser session reactivation must remain open');\n  push(errors, openGates.find(gate => gate.id === 'site-publication')?.status === 'blocked', 'Site publication must remain blocked');",
  'browser gate assertion insertion',
);
writeFileSync(checkerPath, checker);

let tests = readFileSync(testPath, 'utf8');
const checkpointTest = `test('qualified checkpoint core is recorded without claiming browser reactivation', async () => {\n  const registry = await loadRegistry(registryPath);\n  const checkpoint = registry.capabilities.find(\n    (capability: { id: string }) => capability.id === 'runtime.campaign-checkpoint-core',\n  );\n  assert.equal(checkpoint.functionalStatus, 'qualified-bounded');\n  assert.equal(checkpoint.productStatus, 'available-not-main');\n  assert.equal(checkpoint.performanceStatus, 'not-measured-separately');\n  assert.equal(\n    registry.openGates.find((gate: { id: string }) => gate.id === 'browser-session-reactivation').status,\n    'open',\n  );\n  assert.equal(\n    registry.openGates.some((gate: { id: string }) => gate.id === 'campaign-snapshot-restoration'),\n    false,\n  );\n});\n\n`;
if (!tests.includes("test('qualified checkpoint core is recorded without claiming browser reactivation'")) {
  tests = replaceRequired(
    tests,
    "test('derived summary cannot be replaced by an inflated declared count'",
    `${checkpointTest}test('derived summary cannot be replaced by an inflated declared count'`,
    'checkpoint test insertion',
  );
}
writeFileSync(testPath, tests);

let report = readFileSync(reportPath, 'utf8');
const replacements = [
  ['Commit de départ : `fa76f1223d9d732a1f37a7f3bf1a8934b383e5c6`', 'Commit canonique audité : `9e04bbd5569f6755178fa1b5276a112ca47d646b`'],
  ['| `capabilityRecords` | 15 |', '| `capabilityRecords` | 16 |'],
  ['| `inventoryRecords` | 46 |', '| `inventoryRecords` | 47 |'],
  ['| `capabilitiesFunctionalQualified` | 15 |', '| `capabilitiesFunctionalQualified` | 16 |'],
  ['Le total de 46 est un **inventaire de preuves** composé de 31 opérations et 15 capacités de haut niveau. Il ne doit jamais être présenté comme `46/76`.', 'Le total de 47 est un **inventaire de preuves** composé de 31 opérations et 16 capacités de haut niveau. Il ne doit jamais être présenté comme `47/76`.'],
  ['| `campaign.common-owner` | `qualified` | `active` | `covered-by-qualified-scopes` |', '| `campaign.common-owner` | `qualified` | `active` | `covered-by-qualified-scopes` |\n| `runtime.campaign-checkpoint-core` | `qualified-bounded` | `available-not-main` | `not-measured-separately` |'],
  ['Les autres statuts `covered-by-qualified-scopes` signifient que le composant a été traversé dans un périmètre qualifié. Ils ne constituent pas une mesure isolée de son coût.', 'Les autres statuts `covered-by-qualified-scopes` signifient que le composant a été traversé dans un périmètre qualifié. Ils ne constituent pas une mesure isolée de son coût.\n\nLe noyau `runtime.campaign-checkpoint-core` conserve désormais atomiquement la campagne commune, le `needId`, l’action en attente, la déduplication et l’état exact de FieldStock, avec rollback intégral. Il reste toutefois hors de la boucle navigateur active : le host et le contrôleur Agent ne possèdent pas encore le checkpoint et aucune réactivation Agent réelle n’est revendiquée.'],
  ["| `campaign-snapshot-restoration` | `open` | La campagne, les propriétaires, le needId et le retour en attente ne sont pas restaurés atomiquement. |", "| `browser-session-reactivation` | `open` | Le noyau atomique campagne + FieldStock est qualifié, mais le host et le contrôleur navigateur ne possèdent pas encore le checkpoint et aucune reprise Agent réelle n’est démontrée. |"],
  ['- les 15 capacités de cette première reconstruction ;', '- les 16 capacités de cette reconstruction, y compris le noyau atomique de checkpoint ;'],
  ['La priorité fonctionnelle suivante est la continuité atomique de campagne : snapshot et restauration du contrôleur, des propriétaires, des modèles retenus, du `needId` et du retour physique en attente. En parallèle, toute preuve durable permettant de reconstruire l’identité des 76 emplacements pourra être ajoutée sans modifier rétroactivement les statuts actuels.', 'La priorité fonctionnelle suivante est le raccord navigateur du noyau de continuité déjà qualifié : ownership du checkpoint par le host et le contrôleur, restauration avant toute nouvelle décision, vérification de l’observation courante et reprise d’un retour en attente sans rejouer l’action. En parallèle, toute preuve durable permettant de reconstruire l’identité des 76 emplacements pourra être ajoutée sans modifier rétroactivement les statuts actuels.'],
];
for (const [before, after] of replacements) report = replaceRequired(report, before, after, `report replacement: ${before.slice(0, 40)}`);
writeFileSync(reportPath, report);

console.log(JSON.stringify({
  canonicalCommit: registry.baseline.canonicalCommit,
  capabilityRecords: registry.summary.capabilityRecords,
  inventoryRecords: registry.summary.inventoryRecords,
  checkpointCore: registry.capabilities.some(({ id }) => id === 'runtime.campaign-checkpoint-core'),
  browserSessionReactivationOpen: registry.openGates.some(({ id, status }) => id === 'browser-session-reactivation' && status === 'open'),
}, null, 2));

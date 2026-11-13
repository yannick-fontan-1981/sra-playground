import { readFile, writeFile } from 'node:fs/promises';

const path = 'docs/migration/op01-op31-progress.md';
let source = await readFile(path, 'utf8');

function replaceOnce(needle, replacement, label) {
  const index = source.indexOf(needle);
  if (index < 0) throw new Error(`missing progress anchor: ${label}`);
  if (source.indexOf(needle, index + needle.length) >= 0) {
    throw new Error(`ambiguous progress anchor: ${label}`);
  }
  source = source.slice(0, index) + replacement + source.slice(index + needle.length);
}

replaceOnce(
  `- Propriétaires ACTION6 publics produit :\n  \`docs/recovery/op01-op31-browser-public-action6-owner-20261113.md\`\n- Lot 9C2 public conjoint :`,
  `- Propriétaires ACTION6 publics produit :\n  \`docs/recovery/op01-op31-browser-public-action6-owner-20261113.md\`\n- Campagne SMLP réelle sous Pyodide :\n  \`docs/recovery/op01-op31-live-smlp-product-campaign-20261113.md\`\n- Noyau de continuité de session :\n  \`docs/recovery/op01-op31-session-continuity-core-20261113.md\`\n- Lot 9C2 public conjoint :`,
  'references',
);

replaceOnce(
  `- une qualification fonctionnelle produit des propriétaires ACTION6 SMLP/STCK ;\n- une qualification C7 officielle du hook Region natif sur STCK et SMLP.`,
  `- une qualification fonctionnelle produit des propriétaires ACTION6 SMLP/STCK ;\n- une campagne SMLP réelle qualifiée sur Chrome, Pyodide et la même archive que\n  la référence CPython ;\n- un noyau de checkpoint versionné pour la campagne, son \`needId\` en attente,\n  sa déduplication et l'état complet FieldStock ;\n- une restauration atomique avec rollback en cas de refus d'un participant ;\n- une qualification C7 officielle du hook Region natif sur STCK et SMLP.`,
  'global capabilities',
);

replaceOnce(
  `propriétaire puis l’observation passive FieldStock ; C7 reste clos pour le\nprotocole Region STCK/SMLP. La continuité entre activations, une campagne produit\nréelle complète, le coût ciblé de la nouvelle composition et OP31 restent\nouverts.**`,
  `propriétaire puis l’observation passive FieldStock ; C7 reste clos pour le\nprotocole Region STCK/SMLP. Le noyau de continuité sait maintenant restaurer le\n\`needId\`, l'action en attente, la déduplication et FieldStock sans double\nacquisition. Son raccord au host et au contrôleur navigateur, une campagne de\nrésolution produit complète, le coût ciblé de la nouvelle composition et OP31\nrestent ouverts.**`,
  'global status',
);

replaceOnce(
  `- \`src/runtime/observed-addressed-material-runtime.ts\` : acquisition locale,\n  calibration, rétention et revalidation FieldStock.`,
  `- \`src/runtime/observed-addressed-material-runtime.ts\` : acquisition locale,\n  calibration, rétention et revalidation FieldStock ;\n- \`src/logos-engine/field-stock-snapshot.ts\` : codec exact du modèle, prior,\n  stock, \`Map\`, \`Set\` et preuves ;\n- \`src/logos-engine/v6-common-campaign-checkpoint.ts\` : checkpoint atomique de\n  campagne et participants avec rollback ;\n- \`src/runtime/observed-addressed-material-checkpoint.ts\` : participant\n  explicite du runtime FieldStock.`,
  'runtime architecture',
);

replaceOnce(
  `| C1 | **contrôleur produit actif et qualifié** | campagne unique, même \`needId\`, acquisition sélectionnée avant observation passive, transfert Manual gracieux | snapshot/restauration de la campagne, des propriétaires et du retour en attente |\n| C2 | **OP18 et OP28 actives ; premières ACTION6 produit qualifiées** | SMLP joint consomme deux contributions ; STCK produit une coordonnée avec une carte unique ; retour acquis avant observation passive | campagne produit réelle complète, continuité et propriétaire OP31 |`,
  `| C1 | **contrôleur produit actif ; noyau de checkpoint qualifié** | campagne unique, même \`needId\`, acquisition sélectionnée avant observation passive ; snapshot/restauration de la campagne, du retour en attente, de la déduplication et de FieldStock ; rollback atomique | raccorder le checkpoint au host et au contrôleur, puis qualifier une désactivation/réactivation navigateur réelle |\n| C2 | **OP18 et OP28 actives ; premières ACTION6 produit qualifiées** | SMLP joint consomme deux contributions et traverse Pyodide sur trois retours réels ; STCK produit une coordonnée bornée ; retour acquis avant observation passive | campagne de résolution produit complète, raccord STCK conjoint et propriétaire OP31 |`,
  'C1 C2 status',
);

replaceOnce(
  `| C5 | **retours spécialisés préservés** | FieldStock et Region couvrent notamment OP06/29/30 avec effet futur | propriétaire physique Region et seconde contribution STCK réellement indépendante |`,
  `| C5 | **retours spécialisés préservés** | FieldStock et Region couvrent notamment OP06/29/30 avec effet futur ; le Lot 9C3 établit deux contributions STCK causales | propriétaire physique Region et raccord du propriétaire conjoint STCK au host produit |`,
  'C5 status',
);

replaceOnce(
  `Elle ne constitue pas encore une campagne navigateur complète contre Pyodide ni\nune qualification native complète du producteur STCK.`,
  `La campagne SMLP réelle contre Pyodide est désormais qualifiée sur trois cycles\nconsécutifs avec parité CPython. Elle ne constitue pas une résolution complète du\nniveau. Le propriétaire conjoint STCK est qualifié par le Lot 9C3, mais son\nraccord au host produit reste séparé.`,
  'product qualification boundary',
);

replaceOnce(
  `## Limites ouvertes\n\n- aucune campagne navigateur produit complète SMLP/STCK qualifiée contre le\n  transport Pyodide réel ;\n- STCK ne possède pas encore deux contributions causales indépendantes ;\n- aucune persistance du modèle, du prior ou du stock entre activations Agent ;\n- snapshot/restauration de la campagne, des propriétaires, du \`needId\` et de\n  l’action en attente non raccordés au produit ;`,
  `## Limites ouvertes\n\n- aucune campagne de résolution complète SMLP/STCK qualifiée dans le produit ;\n- le propriétaire conjoint STCK qualifié n'est pas encore le propriétaire actif\n  du host produit ;\n- le noyau de persistance du modèle, du prior et du stock n'est pas encore appelé\n  entre deux activations Agent ;\n- snapshot/restauration de la campagne, des propriétaires, du \`needId\` et de\n  l’action en attente non raccordés au host et au contrôleur produit ;`,
  'open limits',
);

replaceOnce(
  `### Étape immédiate : campagne produit réelle\n\n1. exécuter une campagne navigateur bornée sur SMLP avec le propriétaire conjoint\n   réellement actif contre le transport Pyodide ;\n2. vérifier le même \`needId\` du besoin jusqu’aux deux acquisitions de canal ;\n3. confirmer l’ordre acquisition sélectionnée → observation passive →\n   présentation sur les observations réelles ;\n4. conserver \`none\` lorsque plusieurs portes publiques subsistent ;\n5. publier la provenance et les résultats sans transformer cette campagne en\n   preuve de performance.\n\n### Étape suivante : STCK et continuité\n\n1. qualifier le producteur STCK sur son corpus natif ;\n2. rechercher une seconde contribution réellement indépendante avant toute\n   généralisation conjointe STCK ;\n3. ajouter snapshot/restauration atomiques de la campagne, des propriétaires, du\n   modèle, du prior, du stock et du retour en attente ;\n4. vérifier une réactivation Agent sans perte ni double consommation.`,
  `### Étape immédiate : raccorder la continuité au navigateur\n\n1. faire posséder le coordinateur de checkpoint par le host produit ;\n2. exposer snapshot et restauration sans dupliquer la politique de campagne ;\n3. recréer un host et un runtime FieldStock frais lors de la réactivation Agent ;\n4. restaurer avant toute nouvelle décision et vérifier l'observation courante ;\n5. reprendre un retour en attente sans rejouer l'action ;\n6. prouver dans une fixture navigateur réelle l'absence de perte de \`needId\`,\n   de double acquisition et de double ACTION6.\n\n### Étape suivante : STCK conjoint produit\n\n1. remplacer le propriétaire STCK autonome par le propriétaire conjoint qualifié ;\n2. conserver les deux contributions causales et leurs preuves d'ablation ;\n3. empêcher deux propriétaires concurrents de proposer la même ACTION6 ;\n4. qualifier le chemin complet sur le corpus natif et sous Pyodide.`,
  'roadmap',
);

replaceOnce(
  `## Requalification C7 du contrat de configuration canonique`,
  `## Qualification du noyau de continuité C1\n\nLe candidat \`0bb35cd44c9ebfa86a94345cb5167d5861d1e52f\` a été qualifié par le run\n\`43426558286\`, job \`131889275186\`.\n\nRésultats :\n\n- tests ciblés campagne/caller/checkpoint : **20/20** ;\n- régression TypeScript complète : **385/385** ;\n- build de production : réussi ;\n- modules transformés : \`62\` ;\n- galerie : \`100\` jeux, \`636\` prévisualisations, \`4\` atlas ;\n- même \`needId\` restauré avant acquisition ;\n- première acquisition routée, répétition classée \`duplicate\` ;\n- déduplication conservée après une seconde restauration ;\n- rollback complet lorsqu'un participant refuse son état.\n\nLa preuve durable est\n\`docs/recovery/op01-op31-session-continuity-core-20261113.md\`.\n\nCette qualification porte sur le noyau. Le host et le contrôleur navigateur ne\nl'appellent pas encore, et aucune surcharge produit n'est revendiquée.\n\n## Requalification C7 du contrat de configuration canonique`,
  'continuity qualification section',
);

await writeFile(path, source);
console.log(`patched ${path}`);

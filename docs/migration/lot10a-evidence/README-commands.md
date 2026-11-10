# Lot 10A : préparation du contrôle de coût

Ces outils adaptent les cinq sources correspondantes de `lot7a-evidence` à
**AxialQuestion**. Leur présence ne constitue ni une mesure ni une acceptation
du coût. Aucun contrat, gel, résultat de capture, créneau exclusif ou publication
n'est déduit de cette préparation.

Le propriétaire de livraison doit d'abord intégrer les prédécesseurs réellement
publiés, choisir une référence distincte, figer les deux sources et réserver la
fenêtre commune. Les outils historiques sous `scripts/` restent inchangés.

## Contrat conservé

- Deux jeux : STCK, 10 actions ; SMLP, 15 actions ; chauffe de 3 actions chacun.
- Fenêtre officielle A1/B1/B2/A2 : 32 sessions mesurées et 400 actions.
- Huit chauffes, 24 actions, sont les seules exclusions annoncées.
- Pour chaque jeu, la médiane groupée des huit sessions candidates doit être
  strictement inférieure à 1,1 fois la médiane des huit sessions de référence.
- Phases, p95 disponibles, pauses, inspections et mémoire restent publiés.
- Aucun coût de nouveau propriétaire n'est soustrait. Un jeu ne compense pas
  l'autre ; les phases imbriquées ne sont pas additionnées.

Les seules additions de propriétaires/programmes admises sont
`public_axial_question` et `v6.axial_question.choose`. Le captureur observe
**`recordObserved`**, utilisé par les acquisitions actives et passives réelles.
La qualification lie `axial_question_event:<revision>`, `axial_question_state`,
le prédicat de conservation `selection || rotations || portable` et l'adaptation
de frontière `current_epoch_axial_packet_attribution`.

L'attribution des fragments reste stricte. Une origine de fragment commun ou un
ordre de delta commun différent produit un refus. Aucun assouplissement pour une
création anticipée par le nouveau propriétaire n'est présumé. Les quatre formes
fonctionnelles sont figées avant mesure et chaque essai doit reproduire la forme
exacte de sa propre version. Cela ne prouve pas les feuilles privées non capturées
des essais chronométrés.

## 1. Paramètres à renseigner après le gel

Depuis la racine du checkout candidat, remplacer les chemins de référence par
ceux du gel effectif. Ces exemples ne désignent aucune référence déjà validée.

```bash
AXIAL_BASELINE_CHECKOUT=/absolute/path/to/frozen-baseline
AXIAL_EVIDENCE=docs/migration/lot10a-evidence
AXIAL_COST=docs/migration/lot10a-evidence/performance-integrated
AXIAL_BASELINE_MANIFEST=docs/migration/lot10a-evidence/integrated-baseline/source-manifest.json
AXIAL_CANDIDATE_MANIFEST=docs/migration/lot10a-evidence/integrated-final/source-manifest.json
```

Préparer `cases.json`, les deux politiques et `protocol.md` dans `AXIAL_COST`.
Les traces publiques doivent être présentes, vérifiées et identiques dans les
deux checkouts. Les sorties des commandes suivantes doivent être absentes.

## 2. Inventaire réel et captures fonctionnelles avant mesure

L'inventaire installe seulement les programmes des familles dans un store séparé.
Il n'initialise aucune session et n'exécute aucun workflow.

```bash
node "$AXIAL_EVIDENCE/record-owner-source-inventory.mjs" \
  "$AXIAL_BASELINE_CHECKOUT" "$AXIAL_COST/owner-source-inventory.json"

node "$AXIAL_EVIDENCE/capture-cost-owner-graphs.mjs" \
  baseline "$AXIAL_BASELINE_CHECKOUT" "$AXIAL_COST/cases.json" \
  "$AXIAL_BASELINE_MANIFEST" "$AXIAL_COST/owner-graphs-baseline.json.gz"

node "$AXIAL_EVIDENCE/capture-cost-owner-graphs.mjs" \
  candidate . "$AXIAL_COST/cases.json" \
  "$AXIAL_CANDIDATE_MANIFEST" "$AXIAL_COST/owner-graphs-candidate.json.gz"

node "$AXIAL_EVIDENCE/qualify-cost-owner-graphs.mjs" \
  "$AXIAL_BASELINE_CHECKOUT" \
  "$AXIAL_COST/owner-graphs-baseline.json.gz" "$AXIAL_COST/owner-graphs-baseline.receipt.json" \
  "$AXIAL_COST/owner-graphs-candidate.json.gz" "$AXIAL_COST/owner-graphs-candidate.receipt.json" \
  "$AXIAL_COST/owner-structural-attribution.json" "$AXIAL_COST/owner-structural-fixture.json"
```

Les quatre sessions par capture parcourent les formes chauffe/mesurée de chaque
jeu, soit 31 actions au total. Ce sont des captures fonctionnelles non utilisées
comme durées officielles. Elles contrôlent chaque commande avant de fournir son
retour archivé. Trois inspections terminales réelles complètent chaque forme
mesurée. Un échec d'attribution est conservé et ne crée pas de fixture qualifiée.

## 3. Déclaration, contrat et readiness

Après qualification réussie, finaliser et committer, dans cet ordre : déclaration
historique v2, contrat Axial v2, précontrôle statique, readiness. Toutes les
empreintes doivent porter sur les octets définitifs. Les captures, attribution,
fixture et inventaire doivent précéder le contrat ; la readiness doit précéder
strictement le début de la fenêtre.

Le contrat utilise le schéma `logos-engine.lot10a-owner-cost-contract.v2`,
`lot: "10A"`, et les mêmes champs de liaison que le contrat 7A v2 :
`declaration`, `tools`, `structuralExpectation`, `sourceEvidence`,
`ownerInventory`, `structuralFixture`, `strictFailureReceipt`,
`strictFailureLog`, `historicalAggregateOutput`. Les outils du contrat sont les
copies 10A, et `sourceEvidence` contient exactement :

- `src/logos-engine/v6-native-runtime.ts`
- `src/logos-engine/v6-axial-question.ts`
- `src/logos-engine/v6-knowledge-store.ts`

Les nœuds d'installation attendus sont `family_state:public_axial_question`,
`family_activation:public_axial_question` et `program:v6.axial_question.choose`.
Ils ne fixent pas un delta de taille constant. Les chemins structurels autorisés
restent seulement `observations[*].nodeCount`, `inspection[*].graphNodes`,
`final.nodeCount` et `final.graphRevision`, avec `mode:
"predeclared_functional_fixture"` et `qualification:
"functional_structure_frozen_before_measurement"`.

La déclaration contient `ownerCostQualification` de schéma
`logos-engine.lot10a-owner-cost-qualification.v1`, le chemin du contrat et les
empreintes des deux outils de consolidation/revue. Le protocole surveillé cite
ces liens. Le contrat lie la déclaration par son empreinte ; ne pas créer de
cycle d'empreintes en réintroduisant son hash dans la déclaration.

La référence est un argument CLI explicite. Les empreintes externes de capture
et d'attribution ne sont acceptées que si leur chemin réel reste sous ce checkout
de référence et si leurs octets sont inchangés. Les reçus de capture, l'inventaire
et la fenêtre doivent tous désigner cette même référence.

## 4. Fenêtre officielle et analyse

Exécuter seulement après readiness complète et coordination exclusive. Le
propriétaire de livraison conserve le verrou pour toute la fenêtre :

```bash
flock -x /workspace/shared/sra-coordination/performance.lock \
  python -B scripts/run-native-cost-window.py "$AXIAL_BASELINE_CHECKOUT" \
  "$AXIAL_COST" "$AXIAL_BASELINE_MANIFEST" "$AXIAL_CANDIDATE_MANIFEST"
```

Exécuter ensuite l'agrégateur historique inchangé et conserver son véritable
journal et code de sortie. Le contrat complémentaire exige son reçu de refus
strict ; il ne le fabrique pas et n'annonce jamais une réussite stricte.

```bash
node scripts/compare-native-cost-cohorts.mjs "$AXIAL_COST/comparison-policy.json" \
  "$AXIAL_COST/cohort1/baseline.json" "$AXIAL_COST/cohort1/after.json" "$AXIAL_COST/cohort1/comparison.json" \
  "$AXIAL_COST/cohort2/baseline.json" "$AXIAL_COST/cohort2/after.json" "$AXIAL_COST/cohort2/comparison.json" \
  "$AXIAL_COST/combined-comparison.json"

node "$AXIAL_EVIDENCE/consolidate-owner-costs.mjs" "$AXIAL_BASELINE_CHECKOUT" \
  "$AXIAL_COST/owner-growth-contract.json" "$AXIAL_COST/owner-growth-comparison.json"

python -B "$AXIAL_EVIDENCE/review-owner-costs.py" "$AXIAL_BASELINE_CHECKOUT" \
  "$AXIAL_COST/owner-growth-contract.json" "$AXIAL_COST/owner-growth-comparison.json" \
  "$AXIAL_COST/owner-growth-review.json"
```

Un échec du contrôle structurel ou numérique reste un échec. Les règles et les
formes ne sont pas élargies après lecture des durées. Les scripts d'analyse
recalculent les métriques sans lancer de moteur, de jeu ou de mesure.

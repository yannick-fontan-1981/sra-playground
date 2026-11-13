# Registre courant des frontières V6 reconstruites

> Source de vérité machine : le manifeste `docs/migration/v6-current-entry-registry.json`
> et ses fragments `docs/migration/v6-current-entry-registry/*.json`.
> Cette vue est générée et vérifiée par `scripts/verify-v6-current-entry-registry.mjs`.

## Référence auditée

- dépôt : `yannick-fontan-1981/sra-playground` ;
- branche canonique : `recovery/site109-reconstruction-20261112` ;
- commit de base audité : `fa76f1223d9d732a1f37a7f3bf1a8934b383e5c6` ;
- date : `2026-11-13` ;
- ancien chemin de registre : `docs/migration/v6-entry-point-progress.json` ;
- ancien registre présent dans la base auditée : **non** ;
- équivalent historique recréé : **non**.

## Verdict

Le registre courant contient **32 frontières de capacité actuelles** :

- **24** actives dans le produit navigateur ;
- **8** qualifiées comme bibliothèques ou seams non actifs dans le produit ;
- **6** frontières de qualification suivies séparément ;
- **2** qualifications officielles de performance ;
- **1** entrée historique sans implémentation courante ;
- **5** dettes ouvertes ;
- **0** identité historique résolue.

**Ce résultat n’est pas `32/76`.** Le dénominateur historique, son découpage et
la correspondance avec les frontières actuelles ne sont pas récupérés. Le
compte courant utilise une granularité différente et non comparable.

## Politique de comptage

Unité : **independently consumed current capability boundary**.

- OP01 to OP31 are counted once as a calculation family; individual calculations are not promoted to entry points without independent consumers.
- Qualification harnesses are tracked separately from current capabilities.
- Historical identity is independent from current functional qualification.
- The current capability count must never be presented as a numerator over the historical denominator 76.

## Totaux dérivés

| Mesure | Valeur |
| --- | ---: |
| Entrées totales | 44 |
| Capacités actuelles comptées | 32 |
| Actives produit | 24 |
| Bibliothèques / seams qualifiés | 8 |
| Harnesses de qualification | 6 |
| Qualifications performance | 2 |
| Historiques seulement | 1 |
| Ouvertes | 5 |
| Identités historiques résolues | 0 |

## Entrées

| Identifiant | Domaine | Statut | Produit | Fonctionnel | Performance | Identité historique |
| --- | --- | --- | --- | ---: | ---: | --- |
| `delivery.site-publication-from-canonical` | recovery | `open` | non | non | non | `not-applicable` |
| `fieldstock.addressed-material-chain` | field-stock | `product-active` | oui | oui | non | `unresolved` |
| `fieldstock.browser-transport` | field-stock | `product-active` | oui | oui | non | `unresolved` |
| `fieldstock.observed-runtime` | field-stock | `product-active` | oui | oui | non | `unresolved` |
| `fieldstock.op18-owner` | field-stock | `product-active` | oui | oui | non | `unresolved` |
| `fieldstock.public-addressed-learning` | field-stock | `product-active` | oui | oui | non | `unresolved` |
| `historical.chart-navigation` | historical | `historical-only` | non | non | non | `unresolved` |
| `joint.bounded-owner-and-action` | joint-channels | `product-active` | oui | oui | non | `unresolved` |
| `joint.return-routing-and-detachment` | joint-channels | `product-active` | oui | oui | non | `unresolved` |
| `joint.smlp-public-producer-pair` | joint-channels | `product-active` | oui | oui | non | `unresolved` |
| `joint.stck-public-producer-pair` | joint-channels | `qualified-library` | non | oui | non | `unresolved` |
| `logos.common-campaign-owner` | logos-core | `product-active` | oui | oui | non | `unresolved` |
| `logos.composition-engine` | logos-core | `qualified-library` | non | oui | non | `unresolved` |
| `logos.native-authority` | logos-core | `product-active` | oui | oui | non | `unresolved` |
| `logos.neutral-common-caller` | logos-core | `product-active` | oui | oui | non | `unresolved` |
| `logos.op01-op31-family` | logos-core | `qualified-library` | non | oui | non | `unresolved` |
| `logos.operation-cache-cycle-trace` | logos-core | `qualified-library` | non | oui | non | `unresolved` |
| `logos.selected-return-correlation` | logos-core | `product-active` | oui | oui | non | `unresolved` |
| `logos.target-binding` | logos-core | `qualified-library` | non | oui | non | `unresolved` |
| `op28.public-single-action` | op28-product | `product-active` | oui | oui | non | `unresolved` |
| `op28.smlp-joint-action6` | op28-product | `product-active` | oui | oui | non | `unresolved` |
| `op28.stck-unique-action6` | op28-product | `product-active` | oui | oui | non | `unresolved` |
| `product.four-peer-owner-composition` | op28-product | `product-active` | oui | oui | non | `unresolved` |
| `qualification.joint-official-abba` | qualification | `qualified-harness` | non | oui | oui | `not-applicable` |
| `qualification.joint-real-corpora` | qualification | `qualified-harness` | non | oui | non | `not-applicable` |
| `qualification.live-smlp-product-pyodide` | qualification | `qualified-harness` | non | oui | non | `not-applicable` |
| `qualification.native-source-identities-and-runners` | qualification | `qualified-harness` | non | oui | non | `not-applicable` |
| `qualification.region-official-abba` | qualification | `qualified-harness` | non | oui | oui | `not-applicable` |
| `qualification.region-real-corpora-parity` | qualification | `qualified-harness` | non | oui | non | `not-applicable` |
| `recovery.historical-entry-point-mapping` | recovery | `open` | non | non | non | `unresolved` |
| `recovery.op31-goal-owner` | recovery | `open` | non | non | non | `not-applicable` |
| `recovery.session-continuity` | recovery | `open` | non | non | non | `not-applicable` |
| `recovery.site109-parity` | recovery | `open` | non | non | non | `unresolved` |
| `region.bounded-owner` | region | `qualified-library` | non | oui | non | `unresolved` |
| `region.public-evidence-binding` | region | `qualified-library` | non | oui | non | `unresolved` |
| `runtime.browser-agent-controller` | runtime | `product-active` | oui | oui | non | `unresolved` |
| `runtime.browser-common-campaign-host` | runtime | `product-active` | oui | oui | non | `unresolved` |
| `runtime.browser-worker-pyodide-transport` | runtime | `product-active` | oui | oui | non | `unresolved` |
| `runtime.manual-agent-mode-separation` | runtime | `product-active` | oui | oui | non | `unresolved` |
| `runtime.product-dispatch` | runtime | `product-active` | oui | oui | non | `unresolved` |
| `runtime.product-presentation` | runtime | `product-active` | oui | oui | non | `unresolved` |
| `runtime.public-observation-conversion` | runtime | `product-active` | oui | oui | non | `unresolved` |
| `runtime.public-observation-measurement` | runtime | `product-active` | oui | oui | non | `unresolved` |
| `runtime.worker-common-campaign` | runtime | `qualified-library` | non | oui | non | `unresolved` |

Les chemins d’implémentation, consommateurs, preuves et limites sont conservés
dans les fragments JSON.

## Frontières ouvertes

### `delivery.site-publication-from-canonical`

Publish only after a qualified canonical GitHub commit exists, then verify the deployed Site revision against that exact commit.

- No Site publication is included in this registry tranche.

### `historical.chart-navigation`

Preserve durable evidence that chart_navigation existed historically without claiming a recovered current implementation.

- Exact source and current implementation remain unresolved.

### `recovery.historical-entry-point-mapping`

Recover or reevaluate the historical denominator and map historical entry identities to current capabilities without automatic equivalence.

- The current capability count is deliberately incomparable with 70/76 and 71/76.

### `recovery.op31-goal-owner`

Provide a real runtime owner that consumes OP31 information and changes goal selection.

- The OP31 calculation is available, but no physical goal owner is demonstrated.

### `recovery.session-continuity`

Persist and restore owner order, pending need, acquisition deduplication, FieldStock state, and joint-channel state across Agent activations.

- Region has its own bounded snapshot, but the active common browser campaign does not yet expose a qualified cross-owner snapshot.

### `recovery.site109-parity`

Establish exact published capability and source parity with the unresolved historical Site 109/native 0.68 target.

- Historical source SHA d90ce5b64fffa53cca201e2a6a49450fd123f299 remains unresolved.

## Invariants vérifiés

- identifiants et fragments uniques et triés ;
- implémentation, consommateur et preuve fonctionnelle pour chaque capacité comptée ;
- preuve dédiée pour chaque qualification de performance ;
- existence de tous les chemins référencés ;
- totaux recalculés depuis les fragments ;
- vue Markdown régénérée et comparée octet par octet ;
- comparaison avec le dénominateur historique 76 interdite ;
- entrées ouvertes et historiques exclues du compte courant.

```bash
node scripts/verify-v6-current-entry-registry.mjs
```

## Étape suivante

Les priorités deviennent la continuité de session de la campagne commune, un
propriétaire physique d’objectif OP31, puis la mesure officielle de la
composition produit active. La correspondance historique 70/76 et la parité
Site 109 restent des chantiers séparés.


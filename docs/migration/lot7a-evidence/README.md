# Index des preuves du lot 7A

Le [bilan du lot](../lot7a-ranked-workshop.md) décrit le comportement et les
réserves ; la [filiation](../lot7a-ranked-workshop-lineage.md) précise les
originaux consommés. Les pièces ci-dessous gardent leurs identités distinctes.
Une preuve du port isolé n'est pas réattribuée au candidat intégré.

## Port isolé et résultats conservés

| Pièce | Portée |
| --- | --- |
| [Campagne initiale](attempt1/execution-lkey.json) | Partie LKEY froide : 25 actions, deux niveaux officiels, cible de trois niveaux non atteinte |
| [Parité indépendante](diagnostic/attempt1-public-parity.json) | 49 appels du propriétaire Python froid, 147 comparaisons exactes, aucun état natif injecté |
| [Ablations](diagnostic/contribution.json.gz) | Contribution des couches apprises à la décision du composant ; résultats négatifs conservés |
| [Validation élargie initiale](final/validation/delta-tests-run.json) | 2 960/2 961 tests ; l'échec d'une attente d'adjacence Inventory reste conservé |
| [Correction Inventory](diagnostic/inventory-order-expectation-correction.json) | Vérification de l'ordre déclaré, sans modification native |
| [Correction du test de registre](diagnostic/radial-alias-correction.json) | Alias Workshop et contrôle de l'entrée explicite ajoutés |
| [Régressions initiales](final/regressions/regression-summary.json) | CATR, RSWP, FOGW et VOIS : 68/68 contrôles, 159 actions et 88 préfixes |
| [Navigateur isolé](final/browser/browser-qa.json) | Pause, pas unique et reprise ; arrêt à 25 actions, deux niveaux et 25 plans |
| [Horloge LKEY](lkey-case-checkpoint.json) | Budget cumulé de 40 minutes, tentatives et intervalles conservés sans remise à zéro |
| [Ancienne déclaration de coût](performance/superseded-before-measurement.json) | Préparation isolée remplacée avant mesure : zéro session exécutée |

## Préparation de l'intégration

L'ordre coordonné de publication est **3I → 4A → 7A**. La préparation source
préserve les propriétaires, les positions DRM et les retours actifs/passifs de
chaque lot. Le gel final exige les commits effectivement publiés.

- [Revue des points de fusion](coordination/integration-review-plan.md).
- [Intégration du commit publié 3I](coordination/published-3i-integration.json).
- [Préparation additive de 4A](coordination/prepared-4a-integration.json).
- [Périmètre formel déclaré](coordination/integrated-test-scope-plan.json) : union
  de 97 fichiers, sans retrait des contrats précédents.
- [Choix du runner final](coordination/final-validation-runner-plan.json) : outil
  officiel existant, avec son schéma vérifié par le contrôle d'intégrité.

Les preuves finales, le verdict de coût et l'identité de publication seront
ajoutés après leur exécution effective. **7B n'est pas inclus dans ce lot.**

## Conservation des octets

Les gros rapports compressés restent disponibles sous forme de parties exactes
accompagnées de leur manifeste et de leurs empreintes. Depuis la racine du
checkout, `python -B scripts/evidence-byte-parts.py restore
docs/migration/lot7a-evidence` reconstitue les originaux manquants sans remplacer
les fichiers existants. Les archives source utilisent leur manifeste séparé.
Les rapports complets, les refus et les résultats défavorables ne sont pas
filtrés pour produire les tableaux du bilan.

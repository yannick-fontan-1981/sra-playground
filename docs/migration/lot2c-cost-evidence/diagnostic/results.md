# Lot 2C : diagnostic de coût et contrôle sémantique

## Profils originaux conservés

Les deux profils instrumentés utilisent une session froide STCK de dix actions, via le service direct. Le script et le protocole sont identiques ; leurs sources natives respectives restent gelées. La référence a brièvement chevauché le typecheck jusqu’à environ 21:07:49 UTC, comme le consigne `baseline-environment-qualification.json`. Aucun profil n’a été relancé pour sélectionner un meilleur temps.

La [comparaison stricte](comparison.json) conserve **44 différences finales**, dont **42 hors des deux qualifications initiales implementation/activeSeconds**. Les dix commandes et les quatre états de propriétaires sont identiques. Sur 344 nœuds, 320 empreintes de valeurs concordent et 24 empreintes de traces diffèrent. Leurs corps manquent dans ces profils : cette limite n’est pas transformée rétroactivement en preuve d’identité.

## Travail localisé, sans validation de budget

| Méthode | Appels avant / après | Total diagnostic avant | Total diagnostic après |
| --- | ---: | ---: | ---: |
| runtime.snapshot | 26 / 16 | 8,000 ms | 3,467 ms |
| runtime.authorizationIdentity | 0 / 10 | 0,000 ms | 0,139 ms |
| runtime.persistFamilies | 13 / 13 | 2546,056 ms | 2491,289 ms |
| runtime.restoreFamilies | 12 / 12 | 263,898 ms | 230,451 ms |
| knowledge.commit | 103 / 103 | 4841,148 ms | 4398,395 ms |
| knowledge.stateValue | 1082 / 1082 | 800,587 ms | 756,521 ms |
| caller.checkpointWrites | 13 / 13 | 48,906 ms | 39,263 ms |

Sur les quatre continuations, la médiane du service direct passe de **20,414 à 10,488 ms** dans ces diagnostics. La lecture d’identité évite dix snapshots complets. Les snapshots seuls représentaient moins d’une milliseconde par lecture ; le diagnostic distinct de l’observateur a donc guidé une correction supplémentaire des signatures géométriques.

**Ces durées sont imbriquées et non additives.** Une seule session, les wrappers et le service direct ne remplacent pas le protocole officiel, ses répétitions, le contrôleur, le transport et le budget de +10 %. Les valeurs brutes et le chevauchement initial restent disponibles.

## Contrôle sémantique distinct

Une collecte supplémentaire déclarée dans [semantic-control-protocol.md](semantic-control-protocol.md) a exécuté une fois V63 puis une fois 0.36, sans instrumentation de performance. Elle conserve les graphes, les valeurs de nœuds, les deltas et les 24 traces décodées intégralement. Elle corrige une lacune de collecte concrète ; elle ne remplace aucun résultat de coût.

La [comparaison intégrale](semantic-comparison.json.gz) conserve **3834 différences de feuilles**. La [qualification séparée](semantic-qualification.json) établit :

- Dix commandes et quatre états de propriétaires identiques ; 344 nœuds, leurs types et révisions identiques, 842 deltas dans chaque graphe.
- Les 24 traces décodées diffèrent uniquement sur leur feuille `created`. Leurs corps métier restent identiques ; leurs bits Float64 encodés correspondent exactement aux horloges observées.
- Le `sourceDigest` de chaque version est reconstruit exactement depuis le manifeste. Seule la version d’implémentation change dans ce manifeste.
- Chaque digest de delta, son lien précédent et les nœuds finaux reconstruits sont vérifiés. L’identité d’exécution est également recalculée avec la provenance de sa version.
- **0 différence métier non qualifiée.** Les différences de chaîne, provenance, horloges et temps du snapshot sont conservées avec leurs chemins et valeurs ; aucune identité binaire des graphes n’est revendiquée.

La portée reste ce replay public de dix actions. Ce contrôle ne démontre ni la migration complète V5/V6 ni un budget de performance respecté. La clôture du coût dépend des mesures officielles séparées.

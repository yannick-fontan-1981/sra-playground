# Lot 3A — attribution du coût de l’entrée Panel sur STCK

## Résultat

Dans cet unique diagnostic froid, `observedPropose` est appelé **une fois par décision**, soit **6 appels**. Son coût médian est **6,283 ms**, son coût total **53,429 ms sur les six décisions**, et son maximum **24,480 ms sur la première décision froide**. Il n’y a pas de multiplication cachée de la nouvelle entrée.

Ces durées n’expliquent pas directement l’augmentation de **50,466 ms** de la médiane `new_decision` dans la [première comparaison de coût](../performance/comparison.json). Cette observation ne transforme pas les dépassements de cette comparaison en résultats acceptés et ne démontre pas leur origine globale.

## Périmètre et méthode

Le profileur existant a exécuté une seule session STCK froide, limitée à **10 retours publics enregistrés**. L’agent a recalculé chaque commande ; le replay a vérifié les commandes avant de fournir leurs retours. Les **10 actions**, **2 niveaux franchis** et acquisitions correspondantes sont conformes au reçu. Aucun hôte de jeu, solution, oracle, checkpoint appris ou plan préparé n’a été injecté.

L’instrumentation observe les prototypes de `runtime.plan`, `SharedSeriesConstraint.observedPropose`, `sourceGraphProposal`, `restoreNative`, `nativeState`, `workingStamp`, `unchanged`, `PanelServiceMemory.propose` et `CoupledPairEvidenceMemory.currentState`. Elle conserve les arguments, les résultats et l’ordre d’acquisition. Le profileur a vérifié l’inventaire natif avant et après l’exécution, sous le digest inchangé :

`f3f795a3c813b72803e3f26bd207eed032853ae03d60582a33392f52a1bf8e7d`

Les durées sont **inclusives, imbriquées et affectées par l’instrumentation**. Elles ne doivent pas être additionnées comme des coûts indépendants. Ce diagnostic direct du service exclut le transport worker et le rendu navigateur ; il ne remplace pas la mesure comparative officielle.

## Mesures par position

| Décision | Actions déjà acquises | Décision complète | Entrée observed | Dont proposition Panel | Restauration SharedSeries dans la décision |
|---|---:|---:|---:|---:|---:|
| 1 | 0 | 350,347 ms | 24,480 ms | 13,461 ms | 0,828 ms |
| 2 | 1 | 384,038 ms | 8,471 ms | 6,635 ms | 0,088 ms |
| 3 | 2 | 243,276 ms | 4,095 ms | 1,871 ms | 0,103 ms |
| 4 | 3 | 267,681 ms | 3,537 ms | 1,655 ms | 0,118 ms |
| 5 | 4 | 289,423 ms | 9,201 ms | 6,328 ms | 0,124 ms |
| 6 | 9 | 384,129 ms | 3,646 ms | 1,864 ms | 0,118 ms |

Le coût cumulé des décisions est de **1 918,893 ms**. L’entrée observed représente environ **2,8 %** de ce cumul dans cette session. Ce pourcentage décrit une répartition interne au diagnostic ; il ne mesure pas un écart avant/après.

## Autres chemins vérifiés

| Chemin | Appels dans la session | Coût cumulé | Qualification |
|---|---:|---:|---|
| `PanelServiceMemory.propose` | 18 | 31,822 ms | Six appels avec configuration Panel ; douze délégations avec configuration Panel absente. |
| `CoupledPairEvidenceMemory.currentState` | 28 | 0,256 ms | Les copies de la mémoire Pair sont trop courtes pour expliquer directement les dizaines de millisecondes recherchées. |
| `SharedSeriesConstraint.workingStamp` | 29 | 3,412 ms | Comprend les stamps de toutes les couches du propriétaire, pas seulement Panel. |
| `SharedSeriesConstraint.unchanged` | 81 | 5,321 ms | Comprend les vérifications de toutes les couches ; médiane 0,064 ms. |
| `SharedSeriesConstraint.restoreNative` | 22 | 47,122 ms | Médiane 0,127 ms ; les restaurations dans les six décisions restent entre 0,088 et 0,828 ms. |

La mémoire Panel demeure sans événement sur ce contrôle. Les comptes ne désignent ni son témoin de mutation, ni les copies de Pair, ni la restauration SharedSeries dans les décisions comme source directe du surcoût de 50,466 ms.

## Limites et décision de suivi

Une session instrumentée permet d’identifier les appels et leur travail direct. Elle ne permet pas d’exclure les effets indirects des allocations, notamment une pause GC payée ultérieurement dans une autre méthode, ni les effets d’ordonnancement. Aucun intervalle de confiance, p95 ou résultat de respect du budget n’est déduit de ce profil.

Les dépassements de la première comparaison restent conservés. Le suivi comparatif borné utilise cinq sessions fraîches par version, les mêmes **16 contrôles** et le même seuil strict de **+10 %**. Ses résultats constituent une preuve distincte ; ce document ne préjuge pas de leur conclusion. Aucune optimisation du code natif n’a été appliquée à partir de ce diagnostic.

## Conservation et provenance

- [Reçu original du replay et des états](panel-entry-stck-receipt.json.gz).
- [Appels, configurations et durées par décision](panel-entry-stck-calls.json.gz).
- [Instrumentation exécutée, conservée à l’identique](../../../../scripts/diagnose-panel-entry-cost.mjs).
- [Reçu de conservation et empreintes SHA-256](panel-entry-stck-relocation.json).

Le script conservé est une copie exacte du wrapper exécuté en scratch : **7 097 octets**, SHA-256 `f58e78f04cf6a6fc03206472d665284221e5bc53160854c610b44987e00d384e`. Les deux reçus gzip d’origine conservent leurs octets et leurs empreintes ; leur chemin d’instrumentation historique reste inchangé. La copie et la rédaction de ce bilan n’ont entraîné aucune nouvelle exécution du profil, de tests ou d’exports, ni aucune modification de production.

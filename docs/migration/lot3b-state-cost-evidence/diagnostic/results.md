# Diagnostic des coûts communs d’état : 0.41 → 0.42

**STCK10 et SMLP15 réussissent chacun les six contrôles comportementaux déclarés. Les durées ci-dessous restent strictement diagnostiques : l’isolation de la série avant n’est pas établie et elles ne peuvent justifier ni un gain causal ni la clôture du budget.**

## Écart au protocole : isolation non établie

Le [reçu d’écart](isolation-deviation.json) conserve le statut **`diagnostic_isolation_not_established`**. Des tests unitaires courts ont été autorisés pendant la préparation des profils de référence, contrairement à la condition d’absence de travaux simultanés du [protocole préalable](protocol.md). Leurs heures exactes de début et de fin n’ont pas été enregistrées. Les bornes tirées des modifications de fichiers ne permettent ni d’établir ni d’exclure un chevauchement avec SMLP ; aucun chevauchement avec STCK n’est attesté. **L’isolation stricte de l’ensemble des mesures diagnostiques n’est donc pas prouvée.**

Les deux rapports avant restent intacts, avec leurs valeurs favorables et défavorables. Aucun profil de remplacement n’a été sélectionné. Les six comparaisons comportementales restent applicables ; les conclusions de vitesse appartiennent à la fenêtre officielle distincte, avec ses propres exigences d’isolation et sa référence 0.38 remesurée.

## Sources et portée comportementale

Le [protocole](protocol.md), sa [déclaration](declaration.json) et les [cas](cases.json) fixent quatre sessions froides instrumentées, sans chauffe, dans l’ordre 0.41/STCK10, 0.41/SMLP15, 0.42/STCK10, 0.42/SMLP15 : **50 actions au total**. Le profileur conserve les projections source et les restaurateurs des huit familles natives. Chaque source reste inchangée pendant son exécution.

- **Avant :** Site 69 / native 0.41.0, digest `3edffde9b21f4fc8af9dda9a1dbd40707c015d9f7cba8a41460021e39acb7605`, 249 fichiers natifs.
- **Après :** native 0.42.0, [gel source](../final/source-manifest.json) `2de70025ae08845efd491929416e091e9dc9e8e4b473440b9c6a86838e0b3d19`, 249 fichiers natifs.

Les comparaisons [STCK](comparison-stck.json) et [SMLP](comparison-smlp.json) concluent toutes deux **`scoped_behavior_identical`, 6/6** : même générateur, mêmes entrées, même cas, commandes exactes, quatre états propriétaires retenus exacts et onze champs de requête exacts. L’environnement déclaré est identique : Node v24.22.1, Linux 6.18.57, AMD EPYC 9V74, neuf processeurs logiques.

| Cas | Actions par côté | Requêtes par côté | Échantillons de méthodes par côté | Résultat borné | Égalité finale stricte |
| --- | ---: | ---: | ---: | --- | --- |
| STCK | 10 | 16 | 2059 | 6/6 | `false` |
| SMLP | 15 | 24 | 3128 | 6/6 | `false` |

Les quatre états comparés sont `public_occurrence_recall`, `morphology`, `caller:counters` et `caller:lifecycle`. Les champs de requête retenus sont `operation`, `sequence`, `resultKind`, `actions`, `levelsCompleted`, `cycles`, `nodeCount`, `graphRevision`, `acquiredTransitions`, `family` et `proposalKind`. **`strictFinalEquality: false` demeure conservé pour les deux paires** : ces contrôles ne démontrent pas l’égalité du graphe complet ou de tous les propriétaires. STCK atteint deux niveaux terminés à son plafond diagnostique de dix actions ; SMLP termine trois niveaux et atteint le niveau 4. Ce sont des rejeux publics bornés, sans nouvelle capacité de jeu revendiquée.

Les comptes d’invocation agrégés et par méthode sont exacts dans les deux comparaisons : `countDifferences: []`, `methodCountDifferences: []`. Les résultats des témoins sont également identiques, sans différence retirée :

| Cas | Témoin | Appels par côté | Réutilisations par côté | Refus par côté |
| --- | --- | ---: | ---: | ---: |
| STCK | `inventory.unchangedCheckpointWorkingState` | 18 | 6 | 12 |
| STCK | `shared.unchanged` | 59 | 49 | 10 |
| SMLP | `inventory.unchangedCheckpointWorkingState` | 27 | 9 | 18 |
| SMLP | `shared.unchanged` | 42 | 17 | 25 |

## Durées de méthodes : totalité des quatorze phases

Les valeurs sont en **millisecondes**, arrondies à six décimales dans ces tableaux ; les rapports conservent les valeurs complètes, les échantillons et les minima/maxima. Chaque effectif est identique avant et après. Ces méthodes peuvent être imbriquées : leurs totaux ne s’additionnent pas en temps exclusif. L’écart d’isolation décrit plus haut s’applique à chaque lecture comparative de ces durées.

### STCK

| Phase | Appels par côté | Total 0.41 → 0.42 | Médiane 0.41 → 0.42 | Écart de médiane |
| --- | ---: | ---: | ---: | ---: |
| `caller.checkpointWrites` | 13 | 45.608414 → 48.096133 | 2.584137 → 3.260436 | +26.171 % |
| `family.nativeState` | 122 | 103.267772 → 88.651710 | 0.044360 → 0.041127 | -7.290 % |
| `family.restore` | 475 | 11.040525 → 10.762812 | 0.009525 → 0.009484 | -0.430 % |
| `family.restoreNative` | 106 | 135.045445 → 111.142998 | 0.049398 → 0.048842 | -1.126 % |
| `inventory.captureCheckpointWitness` | 13 | 13.683560 → 23.145825 | 0.920720 → 1.005305 | +9.187 % |
| `inventory.unchangedCheckpointWorkingState` | 18 | 5.504812 → 5.532823 | 0.032718 → 0.036354 | +11.110 % |
| `knowledge.commit` | 103 | 4685.346673 → 4057.852021 | 4.844796 → 3.536103 | -27.012 % |
| `knowledge.stateValue` | 1088 | 580.262835 → 727.892364 | 0.004396 → 0.004557 | +3.651 % |
| `runtime.creation` | 1 | 123.803119 → 87.412070 | 123.803119 → 87.412070 | -29.394 % |
| `runtime.persistFamilies` | 13 | 2611.047436 → 2132.090614 | 218.929590 → 156.015858 | -28.737 % |
| `runtime.restoreFamilies` | 12 | 223.522516 → 196.180917 | 12.045432 → 12.582559 | +4.459 % |
| `shared.restoreOwned` | 7 | 18.652863 → 19.520980 | 2.900274 → 2.964689 | +2.221 % |
| `shared.unchanged` | 59 | 3.330661 → 5.583208 | 0.049052 → 0.043304 | -11.718 % |
| `shared.workingStamp` | 29 | 4.064744 → 3.763451 | 0.090934 → 0.102181 | +12.368 % |

Le rejeu instrumenté complet mesure **12029.857177 → 10803.547859 ms** (-10.194 % descriptifs).

### SMLP

| Phase | Appels par côté | Total 0.41 → 0.42 | Médiane 0.41 → 0.42 | Écart de médiane |
| --- | ---: | ---: | ---: | ---: |
| `caller.checkpointWrites` | 19 | 58.584747 → 56.873974 | 2.641491 → 2.857009 | +8.159 % |
| `family.nativeState` | 163 | 121.476535 → 94.944822 | 0.030856 → 0.030445 | -1.332 % |
| `family.restore` | 702 | 17.057496 → 16.047419 | 0.008277 → 0.008277 | -0.006 % |
| `family.restoreNative` | 147 | 88.876013 → 85.668775 | 0.038256 → 0.037605 | -1.702 % |
| `inventory.captureCheckpointWitness` | 19 | 17.174126 → 26.913592 | 0.846400 → 0.892458 | +5.442 % |
| `inventory.unchangedCheckpointWorkingState` | 27 | 7.442472 → 7.478504 | 0.031587 → 0.032798 | +3.834 % |
| `knowledge.commit` | 142 | 6086.210745 → 5150.526895 | 4.666758 → 4.023081 | -13.793 % |
| `knowledge.stateValue` | 1785 | 840.835945 → 787.931532 | 0.004167 → 0.004066 | -2.424 % |
| `runtime.creation` | 1 | 137.109363 → 96.326340 | 137.109363 → 96.326340 | -29.745 % |
| `runtime.persistFamilies` | 19 | 3045.828322 → 2615.177063 | 165.666150 → 129.884533 | -21.599 % |
| `runtime.restoreFamilies` | 18 | 140.764838 → 148.099198 | 6.262080 → 7.909417 | +26.307 % |
| `shared.restoreOwned` | 12 | 18.350465 → 16.653747 | 0.791719 → 0.755531 | -4.571 % |
| `shared.unchanged` | 42 | 1.593326 → 1.491152 | 0.009425 → 0.008893 | -5.640 % |
| `shared.workingStamp` | 32 | 3.274265 → 2.930218 | 0.063108 → 0.059258 | -6.101 % |

Le rejeu instrumenté complet mesure **17555.500512 → 15245.361761 ms** (-13.159 % descriptifs).

Les résultats restent mixtes. Les médianes diagnostiques de persistance diminuent dans les deux cas, tandis que celles de restauration commune augmentent : **12,045432 → 12,582559 ms pour STCK** et **6,262080 → 7,909417 ms pour SMLP**. Les hausses du coût de capture des témoins et des écritures de checkpoint restent visibles. Une diminution du temps total peut coexister avec une augmentation de médiane ; aucune des deux ne remplace l’autre.

## Profils CPU conservés

Les résumés [STCK](cpu-stck.json) et [SMLP](cpu-smlp.json) donnent les empreintes des quatre profils bruts et de leurs archives gzip, qui permettent une reconstruction exacte. L’échantillonnage demandé est de 1 000 µs. Il couvre tout le processus Node, préparation et export diagnostique compris, et ne porte donc pas uniquement sur la durée du rejeu.

| Cas | Échantillons CPU 0.41 → 0.42 | Temps échantillonné signé 0.41 → 0.42 (ms) | `jsonEntries` (ms CPU propre) | `structuredClone` interne Node (ms CPU propre) | Ramasse-miettes (ms CPU propre) |
| --- | ---: | ---: | ---: | ---: | ---: |
| STCK | 13070 → 12305 | 13032.371 → 11911.188 | 2889.555 → 1627.740 | 307.723 → 336.187 | 836.609 → 877.784 |
| SMLP | 17070 → 15601 | 18754.943 → 16379.194 | 4280.015 → 2517.050 | 586.293 → 593.057 | 1128.130 → 1083.039 |

Les profils comportent cinq intervalles bruts négatifs, tous conservés sans exclusion : STCK avant **−1 µs**, STCK après **−3 et −1 µs**, SMLP avant **−2 µs**, SMLP après **−1 µs**. Les valeurs ci-dessus sont des estimations échantillonnées signées, pas des mesures d’allocation, une attribution causale ou des percentiles. La baisse observée de `jsonEntries` ne mesure pas à elle seule l’effet de la modification ; le coût de `structuredClone` et du ramasse-miettes conserve ses variations défavorables.

## Conclusion limitée à ce diagnostic

Les commandes et le périmètre comportemental déclaré restent exacts pour les deux cas ; les comptes de travail et les résultats des témoins ne présentent aucune différence. Les objets finaux complets restent strictement différents. Ces quatre sessions instrumentées, avec isolation diagnostique non établie, ne fournissent ni p95, ni intervalle de confiance, ni preuve de stabilité mémoire, ni décision sur le seuil officiel de **+10 %**. **Le statut de 3B dépend du contrôle fonctionnel final et du bilan de la fenêtre officielle distincte.**

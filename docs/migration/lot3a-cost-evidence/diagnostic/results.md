# Correction 3A : travail retiré et portée du diagnostic

Deux replays instrumentés froids SMLP15 encadrent la correction 0.37 → 0.38. Chaque version recalcule ses commandes avant que le dispositif retourne les observations publiques correspondantes. Le profil initial a localisé la reconstruction et la sérialisation répétées des cellules périodiques. La source V5 possédait déjà l'encodage exact de fragments horizontaux repris par cette correction ; sa [filiation](../../lot3a-cost-lineage.md) et ses attentes source restent séparées des mesures.

## Résultats observés

| Mesure diagnostique | Avant 0.37 | Après 0.38 | Portée |
| --- | ---: | ---: | --- |
| Rejeu instrumenté complet | 27 252,458 ms | 18 306,239 ms | Une session par version ; hors benchmark officiel |
| Temps propre CPU du fichier périodique | 7 482,330 ms | 329,787 ms | Échantillonnage du processus entier, démarrage et export compris |
| Médiane `runtime.plan` | 543,634 ms | 419,407 ms | Neuf appels par version |
| Médiane `service.snapshot` | 1,001 ms | 0,717 ms | Vingt-quatre appels par version |
| Médiane `runtime.persistFamilies` | 171,665 ms | 131,479 ms | Dix-neuf appels par version ; effet indirect non attribué |
| Médiane `runtime.restoreFamilies` | 7,388 ms | 7,772 ms | Dix-huit appels par version ; hausse conservée |

Les phases sont imbriquées et ne s'additionnent pas. Les variations ne constituent pas une attribution causale indépendante à chacune des trois optimisations. Le profil CPU ne compte pas les allocations et ne démontre pas la stabilité mémoire sur une longue session. Les quelques intervalles CPU négatifs bruts sont conservés dans le [résumé](cpu-summary.json).

## Identités comportementales vérifiées

Le [contrôle de comportement limité](scoped-behavior.json) établit l'identité exacte des **15 commandes**, des **quatre états de propriétaires conservés**, des champs annoncés des **24 requêtes** et des effectifs d'appels. Les deux sources sont restées gelées. L'égalité stricte du résultat final complet demeure **fausse**, notamment avec les horloges et les identités de version et de graphe présentes ; aucune identité globale n'est revendiquée.

Les rapports complets [avant](smlp-before.json.gz) et [après](smlp-after.json.gz), les profils CPU compressés, le protocole et les générateurs sont conservés. Le budget dépend exclusivement de la fenêtre officielle STCK10/SMLP15 définie dans le [protocole de performance](../performance/protocol.md).

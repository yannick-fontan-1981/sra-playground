# Résultats du transfert de compositions vers Custom 4

Les deux tags ont été publiés avant la première exécution des cibles. Le témoin est `76142bf4`, le candidat `bacd5c7f` et les moteurs communs `f4d28aee`. Le L2 de SS09 reste en réserve. SS01 est un essai complémentaire dont le comportement avait été signalé avant le gel.

## Résultats officiels

| Jeu | Témoin depuis L1 | Candidat depuis L1 | Témoin sur L2 seul | Candidat sur L2 seul |
|---|---|---|---|---|
| SS06 | L1 arrêté en 40 actions | L1 arrêté en 600 actions | L2 arrêté en 40 actions | L2 arrêté en 104 actions |
| SS07 | L1 arrêté en 40 actions | L1 arrêté en 600 actions | L2 arrêté en 5 actions | L2 arrêté en 5 actions |
| SS08 | L1 arrêté en 40 actions | L1 arrêté en 70 actions | L2 arrêté en 79 actions | L2 arrêté en 600 actions |
| SS01 | L1 arrêté en 40 actions | L1 arrêté en 531 actions | L2 arrêté en 40 actions | L2 arrêté en 600 actions |

Sur les trois cibles principales, les deux solveurs s’arrêtent au L1. En donnant directement accès au L2, chacun gagne 0 niveau sur 3. L’essai complémentaire sur SS01 donne le même verdict.

## Ce que le candidat a effectivement essayé

Les quatre lignes ci-dessous décrivent le départ direct au L2. Un retour est une action qui change l’image pour revenir à une image déjà vue. Le retour de position compte les actions où une composante de forme et de couleur identifiables revient à une position connue. Une telle composante peut être un curseur ou un autre élément. Les paires sont les paires ordonnées de types de commandes consécutifs, toutes coordonnées confondues.

| Jeu | Paires A → B | Images distinctes A → B | Retours à une image A → B | Retours de position A → B | Essais de composition B | Dont rapprochements | Images nouvelles obtenues par ces essais |
|---|---:|---:|---:|---:|---:|---:|---:|
| SS06 | 14 → 35 | 12 → 45 | 3 → 17 | 0 → 6 | 64 | 26 | 33 |
| SS07 | 4 → 4 | 5 → 5 | 1 → 1 | 0 → 0 | 0 | 0 | 0 |
| SS08 | 31 → 35 | 17 → 140 | 23 → 208 | 0 → 24 | 519 | 327 | 110 |
| SS01 | 17 → 25 | 31 → 125 | 10 → 411 | 0 → 60 | 560 | 179 | 92 |

## Contrôles et sources

Le témoin et le candidat gagnent les mêmes 66 niveaux sur les 100 L1 sources. Les 343 essais de composition couvrent 19 jeux. Parmi eux, 136 testent le rapprochement de deux composantes. Ensemble, les essais produisent 207 changements visibles et 108 images encore inédites dans le niveau.

Une lecture complémentaire des traces sources compare les deux solveurs au même nombre d’actions pour chaque jeu, en coupant les deux traces à la longueur de la plus courte. B couvre davantage de paires ordonnées de commandes sur neuf jeux et autant sur les 91 autres. Il visite davantage d’images sur six jeux, autant sur 93 et une de moins sur REWI. Sur KEYD, le gain est de dix images distinctes et huit paires à longueur égale. Sur SWCH, il est de quatre images et trois paires. Aucune de ces différences ne change le résultat officiel.

Les huit paires de départ ont chacune la même empreinte initiale pour A et B. Toutes les commandes émises dans les seize parties portent l’autorité SIC. Chaque départ direct utilise le moteur au L2 et une mémoire vierge. Les résultats sont bornés par le budget de la campagne et correspondent à une exécution par version et par départ. Les plafonds communs sont de 600 actions et environ 514 secondes de temps actif par niveau. Le nombre d’actions effectivement exécutées figure dans les résultats.

[Protocole et reproduction](sic-source100-blind.md) · [Résultats individuels sur les 100 sources](sic-source100-sources.json) · [Mesures et raisons d’arrêt des parties Custom 4](sic-source100-custom4.json)

# LS20 — contrôle ordonné des phases observées

Le 27 novembre 2026, le banc strict obtient les **sept scores officiels en 393 commandes**, dans une seule session SIC depuis le niveau 1, sans reset ni undo. La source propre `af3e957f512a43548102992f9ac812c38fca33cc` reste identique avant et après le passage. Les 393 retours sont acquis.

## Qualification chronométrique

| Niveau | Commandes/plafond | Score/plafond (s) | Réconciliation après score (s) |
|---|---:|---:|---:|
| 1 | 15/20 | 3.857/12 | 0.086 |
| 2 | 45/54 | 8.700/20 | 0.163 |
| 3 | 41/50 | 11.299/26 | 0.256 |
| 4 | 43/52 | 11.777/23 | 0.194 |
| 5 | 48/58 | 15.455/27 | 0.267 |
| 6 | 94/113 | 48.956/50 | 0.524 |
| 7 | 107/129 | 58.454/67 | 0.402 |

Les plafonds proviennent des mêmes archives et n'ont pas changé. Le niveau 6 marque à **48,956 secondes sous 50 secondes**, puis sa réconciliation prend 0,524 seconde. Le niveau 7 marque à **58,454 secondes sous 67 secondes**, puis sa réconciliation prend 0,402 seconde. Le score public est distingué de sa réconciliation.

Les cinq empreintes de commandes et retours L1–5 sont strictement identiques au bilan `4a546a139f9064422c078ef5f40b8c22133c39a8`. Ce témoin gagnait cinq niveaux, puis s'arrêtait à 72 commandes au niveau 6 sous son plafond de 50 secondes. Le nouveau parcours complet porte l'empreinte `6541166c4d64796d06e108954750d594316b53e70ce94d0f11001fadce5d2eb7`. Aucune parité complète des graphes n'est déduite de ces empreintes publiques.

## Première perte publique et correction

La capture depuis le niveau 1, sur `4b611313f0e445c2a9c6d7c1e1ce02c3224db1f5`, reproduit les 192 gestes des cinq premiers niveaux. Au vingtième geste du niveau 6, le deuxième retour d'une série de cinq est rejeté avec `station_phase_changed`. Les deux retours physiques, relus dans leur ordre réel, correspondent pourtant à la période apprise. Le garde utilisait encore la phase précédant toute la série, car l'acquisition native reste différée jusqu'à sa clôture.

La correction conserve les états observés successifs dans une WeakMap liée à la proposition. Chaque continuation exige le retour précédent confirmé, sa référence exacte et son époque. Les gardes ne publient aucun nouvel état de famille. À la clôture, `record` applique une seule fois les retours exécutés, dans l'ordre, avec les mêmes preuves et les mêmes règles de révision de phase. Le plan, les plafonds et l'arbitrage restent inchangés.

La capture est arrêtée explicitement après le retour natif du premier refus : sa sortie SIGTERM est un arrêt de diagnostic, pas un verdict du jeu. Elle contient un surcoût d'instrumentation ; elle ne sert pas à annoncer un pourcentage d'accélération.

## Variantes, contradictions et réévaluation

Les **dix tests ciblés passent**, ainsi que le typecheck. Les deux nouveaux scénarios natifs changent les formes, la palette, le pas, les positions et le sens des commandes. Ils déclarent leur géométrie initiale, sans fournir de cycle, puis exécutent les dix déplacements nécessaires à deux répétitions physiques avant la première série. Les gardes continuent cette série, sa clôture acquiert chaque retour une fois, le contact suivant conserve une décision séparée et le scénario atteint son score.

Quatre contre-épreuves décalent la phase, changent la position atteinte ou rendent l'acteur ambigu ou absent. Elles clôturent seulement les deux commandes réellement exécutées et conservent les autres connaissances. La phase contredite est retirée, tandis que les preuves de transfert précédentes restent présentes.

La réévaluation hors jeu utilise les **deux mêmes retours publics** qui ont interrompu le témoin. Tous deux sont confirmés en ordre, avec un état de famille inchangé jusqu'à `record`. Répéter un garde ne décale pas deux fois le cycle ; un prédécesseur absent ou étranger est refusé. L'état finalement acquis égale l'application séquentielle des observations effectives.

## Preuves conservées et intégration

L'archive contient le diagnostic public complet, ses manifestes, le probe initial et la réévaluation du candidat, le strict complet et ses empreintes, les journaux de tests/typecheck, le témoin extrait du bilan, le diff de production et les outils reproductibles. Le manifeste interne donne la taille et le SHA-256 de chaque membre. Le probe a été exécuté avant commit sur le même contenu ensuite poussé ; le strict fixe explicitement le SHA ci-dessus.

Le collecteur détaillé des tickets, le contrat de continuité physique des phases, le gate complet de l'intégration et le rejeu dans le Site livré restent des étapes distinctes. Cette archive constate le résultat du banc strict, sans annoncer leur achèvement.

Archive : `public-evidence.tar.gz`, **1,839,179 octets**, SHA-256 `4466961d14ea639091c5c2148a51bc77ccad16134d2bb2b6ca4c908af2f82158`.

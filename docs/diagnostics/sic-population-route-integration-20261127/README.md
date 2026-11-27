# Intégration des routes, placements et passages acquis

Le rejeu strict du commit local `7443033e17f166777a811ea7de05524407ec5330`, sauvegardé sur GitHub sous `feebe6632e229dd3b544948749e12b72b23b6119` avec le même arbre, gagne **ESCT, VOIS et PORT depuis L1**, une session SIC par jeu, un seul worker et les plafonds archivés inchangés. Les 430 commandes sont autorisées et acquises par SIC ; aucun reset ni undo.

| Jeu | Commandes par niveau | Total | Score du dernier niveau | Plafond L6 |
|---|---|---:|---:|---:|
| ESCT | 16, 17, 21, 22, 17, 25 | 118 | 16,245 s | 18 s |
| VOIS | 14, 18, 34, 23, 36, 71 | 196 | 17,816 s | 27 s |
| PORT | 16, 18, 26, 19, 19, 18 | 116 | 9,040 s | 12 s |

Chaque niveau marque avant son plafond. Le temps de clôture est conservé séparément dans les bruts et le manifeste. Les empreintes complètes des trois parcours sont identiques à celles des candidats qualifiés séparément.

## Preuves physiques et factorisation

ESCT reprend un rôle de route compatible avant une nouvelle preview et conserve une approche connue jusqu'au premier contact d'ouverture. Le collecteur vérifie les positions réellement mesurées du curseur et du porteur, le mur présent puis ouvert, les retours de chaque geste et l'acquisition unique à la clôture.

VOIS transmet la preuve d'un effet de voisinage réellement acquis. Une sélection connue peut précéder les déplacements de la pièce dans la même préparation, tant que le marqueur unique, les populations et les cases libres restent compatibles. Le collecteur distingue les prédictions des positions observées, vérifie les 29 sélections préparées et leurs 116 mouvements suivants, et exige une preuve antérieure effective avant de réutiliser une relation sur un motif de support encore inconnu.

PORT conserve le préfixe de marche connu avant la première interaction avec un interrupteur ou un passage. Le collecteur mesure l'acteur et le contexte public à chaque retour ; les contacts restent unitaires. Les 116 commandes comprennent 19 séries et 65 continuations après leur premier geste.

Les contrôles d'identité des tickets, d'ordre des retours, de portée et de clôture sont partagés dans `scripts/sic-continuity-contract.mjs`. Les trois observateurs physiques restent spécialisés par rôle, sans code de jeu, numéro de niveau, couleur absolue ni trajectoire de référence dans les décisions de production.

## Provenance et limites

`strict-results.jsonl.gz` et `strict-levels.jsonl.gz` sont les bruts chronométrés du passage combiné. Les collecteurs VOIS et PORT proviennent du commit local `4034654d236a5f177cd108e9890003a99200093f`, sauvegardé sous `4b611313f0e445c2a9c6d7c1e1ce02c3224db1f5` ; aucun fichier de production ne diffère du strict. Le collecteur ESCT, ses contre-épreuves et les diagnostics précédents sont conservés dans l'archive `sic-observed-route-transfer-20261127`.

Le manifeste donne les budgets par niveau, les empreintes des parcours et les sommes SHA-256 des fichiers compressés et décompressés. Le contrôle complet de continuité, la fusion, la publication et le viewer sont des étapes distinctes. Ces trois victoires ne constituent pas un nouveau bilan global des 107 jeux.

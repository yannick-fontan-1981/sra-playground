# Reprise SNAR du 27 novembre 2026

Le checkpoint `1ea742ce` gagne 5 niveaux sur 6. Les deux échecs de `8fa6ad2b` et les hypothèses déjà réfutées restent documentés dans `HANDOFF.md`.

## Frontière des marqueurs

La lecture de la silhouette du joueur dans les animations publiques confirme la trajectoire **136 → 121 → 106** après entrée sur le premier marqueur de direction, au geste global 136. Les cellules 121 et 106 sont inconnues avant le geste. Au geste 141, l'autre marqueur produit **110 → 111 → 112 → 113**. Le rail visible avant départ occupe 112 et la trajectoire le traverse. La cellule suivante 114 reste inconnue avant départ. Les indices désignent les cellules du raster mesuré, et les gestes désignent les commandes chronologiques.

Les deux effets exécutés ont des longueurs différentes et n'établissent ni un arrêt au rail ni une distance fixe par marqueur. Le geste 160 reste une expérience sur cellules inconnues. Les commandes de jeu, l'acquisition du rôle, les gardes et le découpage des préfixes restent inchangés dans le candidat de performance.

## Mesure sur les retours archivés

`node docs/diagnostics/sic-timed-grid-continuity-20261127/profile-snar-observed-returns.mjs <nouveau-fichier.cpuprofile>` reconstitue une session SIC à partir des 161 retours publics conservés. Il vérifie chaque ticket avant de fournir le retour correspondant et ne lance aucun moteur de jeu. Les plafonds de commandes sont conservés. Le temps d'exécution du jeu est nul et le plafond de temps ne s'applique pas à ce diagnostic avec profileur.

Node 24.22.3 sous Windows a reproduit les 161 commandes sur les deux versions mesurées, avec les victoires cumulées à 16, 40, 63, 99 et 134 commandes.

| Version mesurée | Durée profilée L6 | Rétention JSON, échantillonnée | Encodage du graphe, échantillonné | Ramasse-miettes, échantillonné |
| --- | ---: | ---: | ---: | ---: |
| `1ea742ce` | 23 499 ms | 4 259 ms | 4 917 ms | 2 863 ms |
| Rétention numérique, avant optimisation de l'encodage | 18 817 ms | 2 635 ms | 4 187 ms | 2 082 ms |

La comparaison utilise une seule exécution de chaque version. Les durées échantillonnées peuvent se chevaucher. Le candidat ajoute aussi un chemin direct pour les lignes d'entiers portables lors de l'encodage du graphe. Les descripteurs, la profondeur, l'identité des fragments, l'ordre des valeurs et le traitement des nombres signés ou fractionnaires restent contrôlés. Les tests ciblés couvrent les tableaux numériques, la stabilité des fragments, les états persistés et les parcours natifs de navigation.

La qualification doit rejouer SNAR depuis L1 sur un seul worker, en mode SIC, sans reset ni undo, avec les six couples commandes et délais d'origine. Ce diagnostic ne change ni le score de qualification ni le périmètre des protections.

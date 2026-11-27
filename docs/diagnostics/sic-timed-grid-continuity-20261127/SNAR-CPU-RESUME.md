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

## Premier rejeu strict avec l'optimisation

Le rejeu GitHub **46024779478** a vérifié le candidat `817cd8c7b620097b802c3affca60afa55d0f7b2f` et l'arbre `59f0ffee56ca3c4ac2ddb9249aa95554e0a52151` sur Ubuntu24 et Node24. Les cinq premiers parcours conservent leurs commandes et empreintes. Le niveau 6 atteint **28 commandes et 17 000 ms**, pour un total de 162 commandes et un résultat **5/6**.

Le dossier `ci-817cd8c7-46024779478/` contient le manifeste, l'échec brut, le journal, les reçus par niveau et les empreintes. Le reçu d'échec du watchdog ne renseigne pas le champ `mode`, ce qui déclenche la première assertion du contrôle après l'écriture de `result.json`. Le motif opérationnel reste `level_wall_time_budget`. Le mode SIC et le worker unique sont fixés dans la commande archivée.

## Deuxième candidat

La sérialisation canonique de lignes entières déjà validées réutilise un rendu décimal direct et conserve le décompte de tous les nœuds. L'encodage des fragments évite les entrées de cache pour les enveloppes scalaires courtes. Pour 16 000 lignes inédites de 64 valeurs, quatre comparaisons locales alternant l'ordre des versions ont produit **115/78/93/79 ms** avec l'ancien encodeur et **61/57/67/65 ms** avec le nouveau. L'empreinte du texte encodé est identique dans les huit mesures, `aa2ad316acbfae68c7294f6d8fad6b05d4a5d4529453b90ba61725df34678039`. Ce cas synthétique mesure la sérialisation de lignes seule.

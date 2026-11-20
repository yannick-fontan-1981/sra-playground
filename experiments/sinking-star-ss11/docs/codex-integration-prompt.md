# Préparation de l’intégration SS11

Intègre SS11 — La Forge des Reflets, Guerrier/Magicien, comme onzième jeu de Custom4 dans SRA Playground.

Lis `AGENTS.md`, `docs/migration/git-site-sync-policy.md`, puis le README et la spécification de `experiments/sinking-star-ss11/`. Utilise le laboratoire sauvegardé sur GitHub comme référence, en préservant ses cartes, règles et animations.

1. Crée `src/games/sinking-star-ss11.ts` sur le modèle de SS10, avec `DuoPuzzleSession` et `SS11_LEVELS`. Valide le chargement avant de remplacer une session valide. ACTION6 reçoit des coordonnées pixel entières0–63.
2. Enregistre le jeu `ss11-c4000001`, groupe `custom_4`, famille `sinking_star_duo`, huit niveaux, avec un chargement différé dans le dispatcher natif.
3. Étends les contrôles duo pour Guerrier(1)/Magicien(2). Utilise `src/tutorial.ts` au niveau1 et les métadonnées source propres à chaque niveau.
4. Respecte frames/durées, blocage des actions ordinaires, interruptions Undo/Reset/niveau/jeu/mode et affichage terminal après la dernière image.
5. Ajoute huit aperçus réels après SS10 dans la galerie et les liens `/?game=SS11&level=N#playground`.
6. Vérifie la parité native utile, le tutoriel, les contrôles et les interruptions. Aucun parcours d’auteur, solveur ou état privé ne doit entrer dans le bundle.
7. Construis, committe et pousse sur GitHub, puis intègre sur la branche canonique. La publication demandée doit conserver l’audience du Site et être reliée au commit GitHub durable.

Le rapport distingue les contrôles effectués et leurs limites. Les cartes sont des adaptations documentées, pas des copies exactes revendiquées des captures.

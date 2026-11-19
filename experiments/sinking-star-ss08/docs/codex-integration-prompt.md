Intègre SS08 — « La Double Transposition » comme huitième jeu de Custom 4 · Sinking Star dans SRA-Playground.

Dépôt : https://github.com/yannick-fontan-1981/sra-playground
Sources : experiments/sinking-star-ss08/
Version validée : 0.3.0 / HTML v4 ; référence 722330e93f0f972fe9918534eede44bb8f7d0d02.

Pars du main actuel dans ton propre checkout et ta propre branche. Lis AGENTS.md, docs/migration/git-site-sync-policy.md, puis README.md, docs/specification.md, docs/level-design.md et les rapports validation/ du laboratoire. Préserve les travaux récents et pousse régulièrement.

1. Intégration native

Crée src/games/sinking-star-ss08.ts à partir du contrat de src/games/sinking-star-ss07.ts. Importe DuoPuzzleSession et SS08_LEVELS du laboratoire. Raccorde le backend dans src/runtime/native-game-dispatcher.ts. Conserve observe, action(id,data), undo, reset, restart et selectLevel ; valide une nouvelle session avant de remplacer l’ancienne. Aucun chargement Python/Pyodide.

Dans src/games/catalog.ts, ajoute SS08, id ss08-c4000001, nom La Double Transposition, groupe custom_4, famille sinking_star_duo, 8 niveaux, disponibilité playable, sourcePath experiments/sinking-star-ss08/src/levels.ts. Place-le après SS07 sans doublon ni jeu fictif pour remplir les 25 places.

2. Fidélité au laboratoire

Conserve les huit cartes dans leur ordre actuel, le démarrage au niveau 1 et le tutoriel riche au niveau 4, déplié au chargement de cette salle. Chaque niveau garde un Marchand orange (12), un Magicien violet (15) et deux destinations.

Le Marchand pousse une pièce. Les flèches du Magicien échangent automatiquement avec la première cible visée ; les faces blanches relaient le rayon et les dos noirs le bloquent. Sans cible ni boucle, il marche.

Espace/X active ACTION5, le reflet géométrique global. Choisir le plus proche avant de valider les arrivées : une destination bloquée du plus éloigné ne bloque pas le proche ; conserver l’échange à égalité. Prévisualisations : + gris clair pour les héros, contour carré gris clair pour les caisses. Dessiner les miroirs au-dessus des boutons.

Au niveau 8, Haut/Bas font parcourir les quatre miroirs dans les deux sens, puis clignoter deux fois le Magicien sur place : 9 images, 740 ms. Répéter relance l’effet sans doublon d’annulation ; aucune progression des circuits ou combats. Le refus d’eau reste immédiat, sans croix cyan/rouge.

3. Interface et observations

Dans src/main.ts, étends isDuoNativeGame, les commandes, les aides et le suivi pédagogique. Adapte les branches actuellement Marchand/Guerrier ou Marchand/Voleur au duo Marchand/Magicien. Extrais au besoin les helpers purs de experiments/sinking-star-ss08/src/browser.ts vers experiments/sinking-star-ss08/src/tutorial.ts, sur le modèle de experiments/sinking-star-ss07/src/tutorial.ts ; conserve les dix acquis au niveau 4.

Garde les six actions : flèches, Espace/X, clic sur héros, Tab et 1/2. ACTION6 transmet des pixels entiers 0–63 et sélectionne sans avancer le monde. Conserve Z/Undo, R/Reset, Restart et choix des huit niveaux.

Rendu 64 × 64, cellules 3 × 3 sans lissage. Préserve toutes les frames et frameDurationsMs, y compris les cascades. Bloque les nouvelles actions manuelles et agent pendant leur lecture. Les panneaux terminaux attendent la dernière image. Annuler, réinitialiser ou changer de niveau interrompt les animations manuelles et agent sans rappel périmé. L’agent et le tutoriel utilisent les observations publiques ; témoins, solutions et données d’auteur restent hors de l’observation et du bundle agent.

4. Galerie, validation et publication

Ajoute SS08 à scripts/native-game-gallery.mjs puis régénère via scripts/generate-game-gallery.mjs. Conserve les crédits, SOURCE_COMMIT et les collections historiques. Vérifie les huit vraies vignettes et /?game=SS08&level=N#playground.

Étends tests/custom4-native.test.ts et scripts/native-browser-checks.mjs ; crée scripts/verify-ss08-browser.mjs sur le modèle SS07. Compare laboratoire, adaptateur et routeur sur les huit témoins : 324 actions, 29 sélections, 970 images. Vérifie tutoriel, boucle, répétition, miroir/bouton, eau, défaites, annulation pendant animation, galerie, mobile et non-régression SS01–SS07.

Exécute les tests du laboratoire, sa validation, les tests natifs, le typage, le build et les vérifications navigateur pertinentes.

Mène jusqu’au jeu publié : tests → commit → push GitHub → intégration main → publication Site → vérification GitHub/Site. Termine avec branche, commits poussé/intégré, validations, version Site, SHA source publié, état de synchronisation et lien SS08. Si la publication est indisponible, indique le blocage précis.

Intègre SS07 — « La Distance Dérobée » comme septième jeu de Custom 4 · Sinking Star dans SRA-Playground.

Dépôt : https://github.com/yannick-fontan-1981/sra-playground
Sources validées : experiments/sinking-star-ss07/
Version : 0.1.2 / HTML v3.
Référence du jeu : 6e83c45e90e42f5483ca0b3d488778b7e940452e, livré sur main par la PR nº 103.

Pars du main actuel, dans ton propre checkout et ta propre branche. Préserve les travaux récents du dépôt et pousse régulièrement tes commits.

Lis d’abord :
- AGENTS.md
- docs/migration/git-site-sync-policy.md
- experiments/sinking-star-ss07/README.md
- experiments/sinking-star-ss07/docs/integration.md
- experiments/sinking-star-ss07/docs/specification.md
- experiments/sinking-star-ss07/docs/level-design.md
- experiments/sinking-star-ss07/validation/tests-summary.json

1. Raccordement natif

Crée src/games/sinking-star-ss07.ts sur le modèle de src/games/sinking-star-ss06.ts, en important le DuoPuzzleSession et les SS07_LEVELS du laboratoire SS07.

Raccorde-le dans src/runtime/native-game-dispatcher.ts et ajoute l’entrée à src/games/catalog.ts :
- code SS07 ; id ss07-c4000001 ;
- nom La Distance Dérobée ;
- groupe custom_4, après SS06 ;
- 8 niveaux, disponibilité playable ;
- sourcePath experiments/sinking-star-ss07/src/levels.ts.

Conserve observe, action(id,data), undo, reset, restart et selectLevel. ACTION6 sélectionne un personnage avec des coordonnées de pixels entières entre 0 et 63. Le chargement doit valider la nouvelle session avant de remplacer l’ancienne. SS07 fonctionne en TypeScript natif et ne doit pas déclencher le chargement de Python/Pyodide.

2. Préserver le jeu validé

Réutilise les huit cartes et les règles du laboratoire :
- Marchand orange : pousse une pièce.
- Voleur vert : tire une pièce immédiatement derrière lui quand il avance librement ; un reflet ou une presse ne déclenche pas de traction supplémentaire.
- Un Marchand, un Voleur et deux cibles dans chacun des huit niveaux.
- Par miroir, choisir l’élément le plus proche avant de vérifier les destinations. L’élément éloigné reste immobile et son arrivée bloquée ne peut pas empêcher le proche de se téléporter. À distances égales, conserver l’échange.
- Niveau 6 : îlot de sortie réduit à une ligne horizontale, mur empêchant le contournement et ouverture de la porte verte nécessaire.
- Niveau 8 : trois plateformes provisoires à transformer en trois appuis permanents ; conserver aussi les deux appuis initiaux.

3. Commandes, tutoriel et animations

Dans src/main.ts, ajoute SS07 à usesNativeManualControls et usesReflectionShortcut et raccorde ses aides, son tutoriel et ses contrôles de rôles.

Utilise les règles et lecteurs de pixels du src/browser.ts de SS07. Extrais les helpers purs dans un module réutilisable si nécessaire. Le module experiments/sinking-star-ss06/src/tutorial.ts fournit un modèle d’organisation, mais SS07 utilise merchant/thief, les couleurs 12/14 et neuf acquis. Il conserve toujours deux personnages, y compris au niveau 8.

Charger le niveau 1 avec son tutoriel déplié. Conserver :
- flèches : déplacement, poussée ou traction ;
- Espace / X / bouton Reflet : ACTION5 ;
- clic sur un héros, Tab, 1/2 et boutons Marchand/Voleur : ACTION6 ;
- Maj+Tab : quitter la grille ; Z : Undo ; R : Reset ;
- choix manuel des huit niveaux et retour au niveau 1.

Le rendu reste en 64 × 64 pixels, avec des cellules de 3 × 3 pixels agrandies sans lissage. Le reflet d’un personnage est un + gris clair ; celui d’une caisse est un contour carré gris clair.

Préserve toutes les frames et frameDurationsMs : trois images pour les mouvements/transferts, cinq pour les combats. Attends la fin de l’animation avant d’afficher victoire ou défaite. Bloque les nouvelles actions pendant la lecture ; Undo, Reset, Restart et changement de niveau doivent annuler les callbacks précédents, après une action manuelle comme après une action agent. Adapte aussi la condition interruptibleAnimation actuellement spécifique à SS06.

Le tutoriel et le SRA utilisent les observations publiques. Les solutions, témoins, solveurs et données internes d’auteur restent hors du bundle agent.

4. Galerie et catalogue

Ajoute la session SS07 à scripts/native-game-gallery.mjs, avec un alias pour distinguer son DuoPuzzleSession de celui de SS06. Régénère la galerie via scripts/generate-game-gallery.mjs et le build normal.

Les vignettes doivent provenir des vrais pixels initiaux des huit niveaux. Conserve les crédits Sinking Star. Le groupe Custom 4 est déjà ajouté dynamiquement : utilise cette génération et conserve SOURCE_COMMIT, qui référence les collections historiques.

Avec SS01 à SS07, le catalogue compte 107 jeux et l’atlas Custom 4 mesure 512 × 448 pixels ; ajuste les assertions à l’état réel du main si d’autres jeux ont été ajoutés entre-temps. Vérifie les liens /?game=SS07&level=N#playground.

5. Validation

Étends tests/custom4-native.test.ts et crée une vérification navigateur SS07 à partir de scripts/verify-ss06-browser.mjs.

Rejoue les huit témoins à travers l’adaptateur ET le routeur de production : 593 actions, 39 sélections, 1 745 frames. Compare exactement pixels, durées, états et progression avec la session du laboratoire.

Vérifie les neuf acquis, la sélection ACTION6, la priorité des reflets, la porte verte de L6, les plateformes de L8, les défaites L6/L7/L8 et Undo, y compris pendant les animations. Vérifie aussi les commandes réelles, la galerie, le rendu mobile et l’absence de régression de SS01 à SS06.

Exécute les vérifications pertinentes, notamment :
- npm --prefix experiments/sinking-star-ss07 test
- npm --prefix experiments/sinking-star-ss07 run validate
- node --test tests/custom4-native.test.ts
- npm run typecheck
- npm run build

6. Sauvegarde et publication

Mène l’intégration jusqu’au résultat jouable :
tests → commit → push GitHub → intégration sur main → publication Site → vérification GitHub/Site.

Publie uniquement depuis le code intégré et vérifie SS07 sur le Site déployé. Si une capacité de publication manque, indique précisément ce blocage sans annoncer le jeu comme publié.

Termine avec : fichiers modifiés, validations, branche, commit poussé, commit intégré, version Site, SHA source publié, état de synchronisation et lien direct vers SS07.

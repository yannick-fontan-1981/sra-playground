Intègre SS03 — La ruse verte dans SRA-Playground, puis publie la version intégrée.

Dépôt : https://github.com/yannick-fontan-1981/sra-playground

## Source et préparation

Travaille depuis le main actuel, dans ton propre checkout et ta propre branche, en conservant les changements des autres travaux. GitHub est la source canonique.

La version demandée est SS03 v0.4.0, présente dans experiments/sinking-star-ss03/. Son commit de code est 74ccafef164f6c3ce006b5b6fe8598ff9d11d8e3, intégré par 1242dadee571c30bd4ffc55e999bb8552eefdc56. Ces SHA identifient la référence ; pars du main actuel.

Lis AGENTS.md, les consignes locales applicables, puis :

- experiments/sinking-star-ss03/README.md
- experiments/sinking-star-ss03/docs/integration.md
- experiments/sinking-star-ss03/docs/specification.md
- experiments/sinking-star-ss03/src/core.ts
- experiments/sinking-star-ss03/src/levels.ts
- experiments/sinking-star-ss03/src/level-info.ts
- experiments/sinking-star-ss03/src/browser.ts
- experiments/sinking-star-ss03/index.template.html

## Intégration native

Ajoute SS03 comme troisième jeu de Custom 4, après SS01 et SS02, avec le titre « La ruse verte » et ses huit niveaux. S’il est déjà partiellement intégré, complète l’existant.

Réutilise directement les modules TypeScript validés du laboratoire, comme le fait SS02. Crée l’adaptateur SS03 sur le modèle de src/games/sinking-star-ss02.ts, avec PullPuzzleSession et les opérations load, action, undo, reset, restart et selectLevel.

Raccorde le jeu dans :

- src/runtime/native-game-dispatcher.ts ;
- src/games/catalog.ts ;
- src/main.ts et les styles nécessaires ;
- scripts/native-game-gallery.mjs et la génération de galerie existante.

Le jeu doit fonctionner via le backend natif en mode manuel comme en mode agent, sans chargement du moteur Python pour SS03. Garde SS01, SS02 et les autres collections fonctionnels.

## Comportement à conserver

- Les huit cartes restent celles de v0.4.0 : tutoriel complet au niveau 1 ; niveau 2 « La presse latérale » ; niveau 7 avec la nouvelle plaque de maintien ; niveau 8 reproduisant Heroes and Light, énigme 2.
- Le Voleur tire une seule caisse derrière lui. Les portes peuvent pousser des files et déclencher des cascades. Un déplacement imposé par une porte ne tire pas une caisse supplémentaire.
- Au niveau 7, la presse nord exige simultanément les boutons (9,2) et (10,5), coordonnées avant centrage. Un seul bouton occupé ne doit pas déclencher la poussée.
- Rendu 64 × 64, grille de cellules 3 × 3 pixels, palette et sprites exacts du laboratoire. Aucune prévisualisation de destination.
- Quatre actions directionnelles seulement : ni touche/bouton Espace actif, ni sélection de Marchand pour SS03.
- Transporte toutes les frames et frameDurationsMs. Une traction suivie d’un piston donne six images ; une cascade peut en donner davantage. Affiche toujours frame comme image finale.
- Undo, Reset, Restart et changement de niveau restent utilisables pendant l’animation et invalident les images encore programmées.
- Préserve GAME_OVER et la récupération par Undo/Reset. Bloque les directions dans un état terminal.
- Après réussite, charge le premier niveau non terminé. WIN signifie que les huit niveaux sont terminés, même si le dernier niveau résolu manuellement porte un autre numéro que 8. Affiche alors VICTORY.

Dans src/main.ts, plusieurs comportements sont actuellement réservés à SS02 : entrée en mode manuel, masquage d’Espace, annulation pendant l’animation et victoire. Étends proprement ces comportements à SS03.

## Présentation humaine et galerie

À l’entrée normale dans SS03, charge le niveau 1 en mode manuel avec son tutoriel ouvert. Respecte les liens explicites vers un autre niveau et la navigation manuelle.

Reprends les explications et la progression du tutoriel SS03 depuis les pixels publics. Affiche l’aide aux pistons aux niveaux 2, 7 et 8, avec l’explication des boutons d’un même circuit. Conserve les références des salles et le crédit Sinking Star.

Génère les huit aperçus de galerie à partir des véritables observations initiales. Vérifie les liens de lancement et les compteurs du catalogue.

Les états internes, circuits sémantiques, phases détaillées, témoins et solveurs restent hors des observations et entrées de l’agent. Cette intégration ne doit introduire aucune stratégie spécifique à SS03 dans SRA, SIC ou Logos Engine.

## Validation

Exécute les contrôles du laboratoire : npm test et npm run validate dans experiments/sinking-star-ss03/.

Étends les tests du backend de production, notamment tests/custom4-native.test.ts. Rejoue les huit témoins de tests/witnesses.json via le véritable dispatcher et compare les observations avec PullPuzzleSession : pixels, animations, durées, progression, actions et annulations. La référence v0.4.0 compte 484 directions, 154 tractions et dix phases de piston ; le niveau 7 compte 54 directions.

Vérifie les changements de jeu, les erreurs de chargement, Undo/Reset/Restart, la sélection directe et les états terminaux. Fais passer le build et les contrôles de non-régression applicables, notamment SS01/SS02. Si le chemin commun est modifié, respecte le budget global de performance du projet.

Teste dans un vrai navigateur le tutoriel, la galerie, une traction suivie d’une poussée, une cascade du niveau 8, et l’annulation pendant l’animation. Distingue clairement ce qui est testé dans le navigateur des simulations DOM.

## Livraison

Va jusqu’à la publication vérifiée du Site existant, en conservant son niveau d’accès et en réutilisant .openai/hosting.json.

Suis cette chaîne : travail → tests → commit → push GitHub → intégration sur main → publication Site → vérification du SHA source publié. Pousse régulièrement ta branche ; ne laisse aucun changement utile uniquement dans le checkout.

Termine avec le lien permettant de lancer SS03, les tests réellement passés, la branche, le commit poussé, le commit intégré sur main, la version Site, son SHA source, l’état de synchronisation GitHub/Site et la prochaine étape. Signale précisément tout blocage réel de publication.

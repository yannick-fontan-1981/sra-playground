# Intégrer SS14 dans SRA Playground et publier le Site

Travaille dans `yannick-fontan-1981/sra-playground` depuis le `main` distant à jour. Lis `AGENTS.md`, `docs/migration/git-site-sync-policy.md` et les instructions applicables. Crée une branche ou un worktree dédié et préserve les travaux concurrents.

Intègre nativement **SS14 — La Traction Harmonique**, duo **Voleur vert 14 + Barde magenta 6**, dans **Custom 4**, puis publie le **Site SRA Playground existant** depuis le code testé, poussé et intégré sur `main`. Conserve ses paramètres d’accès actuels.

## Sources et portée

Le laboratoire est `experiments/sinking-star-ss14/`. Lis son `README.md`, `docs/specification.md`, `docs/level-design.md`, `docs/source-audit.md`, `docs/validation.md` et `docs/roadmap.md`.

Réutilise le moteur `src/core.ts`, les huit cartes `src/levels.ts`, leurs métadonnées `src/level-info.ts` et le tutoriel `src/tutorial.ts`. Inspecte le raccordement natif actuel des autres jeux SS. Adapte le catalogue, le dispatcher, l’interface et les tests Custom 4 selon la structure présente dans `main`.

Prendre au minimum la révision 0.1.1 : préserver le bouton violet de L8 sur fond gris avec son plus rose, et la séparation entre le bouton bleu en (8,3) et la presse violette en (13,8) de L6. Le centre de cette presse est noir fermé et gris ouvert ; aucun bleu ne doit apparaître dans son glyphe.

## Travail à réaliser

1. Ajouter l’adaptateur natif, l’entrée de catalogue Custom 4, la vignette, la sélection et le lien direct SS14. Garder les huit niveaux dans leur ordre, tutoriel en premier, puis les deux finales de conservation et de réemploi des ressources.
2. Préserver ACTION1–6, les images 64 × 64, les couleurs 14/6, toutes les images d’animation et leurs durées, les deux héros et les deux destinations simultanées. ACTION6 reçoit des coordonnées pixel entières 0–63 et ne déclenche aucun tour.
3. Conserver exactement la traction d’un seul occupant arrière, le chant carré de 5 × 5 avant le pas, les membres bloqués qui restent en place, les appuis immergés mobiles et leur ancrage sous les héros. Un déplacement forcé ne déclenche aucune capacité. Les miroirs ne suivent jamais le chant.
4. Préserver les reflets prioritaires au plus proche et les échanges à distance égale, les presses latérales, les circuits, la stabilisation hydraulique et le combat simultané. Valider les arrivées volontaires et les pertes d’appui selon le contrat du laboratoire.
5. Raccorder clavier, boutons, clic, Tab/1/2, reflets, Annuler, Recommencer et Repartir. Garder l’interruption des animations, la préférence de réduction des animations et les écrans terminaux différés.
6. Conserver les **dix-sept découvertes** déduites des pixels, les aides contextuelles et les références des salles, y compris les liens secondaires. Aucun témoin, solveur, état privé ou conseil issu d’un oracle ne doit entrer dans les observations ou décisions de SRA.
7. Rejouer les huit témoins dans l’adaptateur et vérifier leur parité avec le moteur du laboratoire. Puis contrôler le jeu intégré dans un navigateur autorisé : contrôles, huit niveaux, annulation, interruptions, écran de victoire et formats ordinateur/mobile. La vérification Happy DOM du laboratoire ne remplace pas ce contrôle visuel.
8. Exécuter TypeScript, tests et build requis ainsi que les non-régressions Custom 4 pertinentes. Si un chemin partagé du runtime est modifié, comparer le coût global avant/après dans des conditions identiques avec la tolérance globale de +10 % convenue.
9. Commiter et pousser les changements testés ; les intégrer au `main` actuel sans écraser les avancées concurrentes. Vérifier le commit distant, publier depuis cet état, puis contrôler SS14, son lien direct et ses commandes sur le Site déployé.

Commandes du laboratoire : `npm test`, `npm run validate`, `node scripts/verify-design-constraints.mjs`, `node scripts/verify-ui-dom.mjs`. Happy DOM est requis pour le dernier script (`HAPPY_DOM_MODULE` optionnel).

Les témoins prouvent la solvabilité, pas l’optimalité ni une réussite autonome de SRA. Toute évaluation de l’agent doit utiliser exclusivement les observations publiques. Un épuisement de limite de recherche ne constitue pas une preuve d’impossibilité.

## Publication et compte rendu

Respecter : **tests → commit → push GitHub → intégration main → publication Site → vérification GitHub/Site**.

Relever la version publiée et son SHA source lorsqu’il est exposé, puis vérifier leur correspondance avec le commit GitHub durable. En cas de divergence, préserver les deux états et les réconcilier. Si le SHA source n’est pas exposé, préciser cette limite et consigner le commit utilisé pour publier.

Mettre à jour la documentation et donner : résultat fonctionnel, tests, contrôle navigateur, branche, SHA local/poussé/intégré, URL du Site et lien SS14, version Site, SHA source disponible, état de synchronisation et éventuelles limites. Si une capacité manque réellement, conserver le travail sur GitHub et nommer le blocage exact.

## Intégration vérifiée

Le raccordement sur `codex/ss14-custom4` utilise la révision `421fbe54636d9d16d93fb34fc45d605a799f0b46` du laboratoire 0.1.1. Le moteur et les cartes restent identiques à cette révision. L’adaptateur valide le chargement avant de remplacer la session et contrôle les coordonnées entières de l’ACTION6.

SS14 suit SS13 dans le catalogue Custom 4. Les huit cartes, les 17 découvertes, les aides contextuelles et les sources secondaires sont disponibles dans le Playground. La galerie comprend huit vignettes de SS14 issues du moteur. Le worker de SRA reçoit les observations publiques et les outils d’auteur restent dans le laboratoire et les tests.

Le rejeu via le dispatcher et l’adaptateur vérifie les 1 028 entrées, dont 63 sélections, les 3 039 images et leurs durées. Les huit fins de niveau sont annulées puis rejouées. La suite Custom 4 compte 58 tests réussis, le laboratoire 33 tests moteur et 24 contrôles de conception. Le typage et le build de production réussissent.

Chromium a rejoué la campagne dans le Playground et confirmé le tutoriel, les commandes, les interruptions, les panneaux terminaux, les liens directs et le format mobile. Le test lit les pixels du canvas sur le bouton bleu de L6, la presse de L6 fermée puis ouverte, et le bouton exposé de L8. Les régressions SS13, SS01, CASC et LS20 ont réussi.

La feuille de route consigne la mesure de coût. Le compte rendu de livraison relève la version du Site, le SHA source et leur vérification avec `main`.

[Jouer à SS14](https://sra-playground.yannick-fontan.chatgpt.site/?game=SS14#playground)

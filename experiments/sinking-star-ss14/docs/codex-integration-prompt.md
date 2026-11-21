# Intégrer SS14 dans SRA Playground et publier le Site

Travaille dans `yannick-fontan-1981/sra-playground` depuis le `main` distant à jour. Lis `AGENTS.md`, `docs/migration/git-site-sync-policy.md` et les instructions applicables. Crée une branche ou un worktree dédié et préserve les travaux concurrents.

Intègre nativement **SS14 — La Traction Harmonique**, duo **Voleur vert 14 + Barde magenta 6**, dans **Custom 4**, puis publie le **Site SRA Playground existant** depuis le code testé, poussé et intégré sur `main`. Conserve ses paramètres d’accès actuels.

## Sources et portée

Le laboratoire est `experiments/sinking-star-ss14/`. Lis son `README.md`, `docs/specification.md`, `docs/level-design.md`, `docs/source-audit.md`, `docs/validation.md` et `docs/roadmap.md`.

Réutilise le moteur `src/core.ts`, les huit cartes `src/levels.ts`, leurs métadonnées `src/level-info.ts` et le tutoriel `src/tutorial.ts`. Inspecte le raccordement natif actuel des autres jeux SS. Adapte le catalogue, le dispatcher, l’interface et les tests Custom 4 selon la structure présente dans `main`.

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

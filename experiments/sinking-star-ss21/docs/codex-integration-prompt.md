# SS21 — consignes de reprise et de qualification native

Travaille dans `yannick-fontan-1981/sra-playground` depuis le `main` courant. Lis `AGENTS.md`, `docs/migration/git-site-sync-policy.md`, puis les documents de `experiments/sinking-star-ss21/docs/`. Le code GitHub est canonique ; le Site est son déploiement.

## Contrat de la livraison

Conserve **SS21 — Les Quatre Destinations**, version 0.1.0, huit salles et le quatuor **Marchand / Guerrier / Voleur / Magicien**. Le Marchand est sélectionné au départ. Le tutoriel de **31 découvertes** est au niveau 1. Les trois autres héros sont sélectionnés par 2, 3 et 4 ; Tab et le clic dans les pixels publics doivent aussi fonctionner. Les destinations sont au nombre de quatre et doivent être occupées simultanément par les quatre héros vivants.

Le Marchand pousse une seule pièce, le Guerrier toute la file contiguë, le Voleur tire seulement la pièce immédiatement derrière lui, et le Magicien échange avec la première cible de sa visée, éventuellement déviée par un miroir. Un partenaire déplacé par un mécanisme n’active pas sa capacité. Les appuis immergés restent fixes, non échangeables et non utilisables comme poids. Les monstres sont immobiles hors transport explicite. Les contacts orthogonaux et les dispositifs sont résolus avec leurs effets en cascade.

Préserve les presses latérales, les commandes à plusieurs boutons, les plateformes hydrauliques et le maintien d’un appui sous une plateforme réactivée. Le reflet global ACTION5 et la visée du Magicien sont deux mécanismes distincts. Conserve les refus atomiques des conflits optiques, les avertissements animés, les durées et Undo. Aucune condition cachée ne doit imposer l’emploi d’un rôle, un nombre d’actions ou un ensemble de découvertes.

## Intégration

Raccorde `QuartetPuzzleSession` par le même adaptateur public que les jeux précédents. Expose uniquement images 64 × 64, actions, état de session et progression, palette, images d’animation et durées. Les données d’auteur, témoins et solveur ne doivent pas être accessibles à SRA ni embarqués dans le bundle de production.

SS21 suit SS20 dans Custom 4. Conserve les jeux précédents. Raccorde le lien `/?game=SS21#playground`, les huit sélections de niveau, les vignettes de galerie, les quatre boutons de personnage, le tutoriel, les règles contextuelles et les crédits. La navigation entre salles, la transition de victoire et son annulation doivent conserver la bonne aide. Les panneaux finaux attendent la dernière image de l’animation. Sur mobile, les quatre sélections et les commandes doivent rester visibles et utilisables sans débordement.

## Qualification attendue

Dans le laboratoire : `npm ci`, `npm test`, `npm run validate`, `npm run validate:ui`, `npm run validate:design`, puis `node scripts/package-delivery.mjs` après génération du rapport de tests unitaires.

Rejoue ensuite les huit témoins à travers l’adaptateur et le dispatcher natifs, en comparant les observations publiques complètes au laboratoire. La référence compte **1 486 entrées**, dont **208 sélections** et **1 278 actions physiques**, sur **4 128 images**. Les entrées par salle sont **260, 143, 103, 182, 224, 202, 153 et 219**. Ces compteurs décrivent les témoins et ne sont pas des minima.

Contrôle aussi les données invalides, Undo, Reset, Restart, la transition N1–N2, le retour au tutoriel, la sélection du quatrième héros et la victoire finale. Exécute le typage, le build, les tests d’intégration pertinents et le contrôle obligatoire `npm run test:sic-continuity`. Ne modifie pas l’apprentissage ou l’arbitrage SIC pour imposer une solution propre à SS21. Toute évolution de SIC doit respecter la généricité et les scénarios de transfert imposés par `AGENTS.md`.

Effectue une revue dans le navigateur autorisé. Distingue explicitement les tests DOM, les rejeux par dispatcher et les contrôles réellement exécutés dans l’interface. Une victoire par témoin ne prouve pas une résolution autonome par SRA.

## Sauvegarde et publication

Suivre **tests → commit → push GitHub → intégration sur main → vérification distante → publication du Site existant → vérification GitHub/Site**. Préserver les changements parallèles.

Site : `https://sra-playground.yannick-fontan.chatgpt.site`, projet `appgprj_6adbc388d79081918581b93b919d7258`. Conserver ses accès. Vérifier le SHA source courant avant de publier. Le rapport final donne branche, SHA local, SHA poussé et intégré, version Site, SHA source du Site, lien direct et prochaine étape.

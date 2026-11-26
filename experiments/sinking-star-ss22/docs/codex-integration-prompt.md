# SS22 — consignes de reprise, de qualification native et de publication

Travaille dans `yannick-fontan-1981/sra-playground`. Lis `AGENTS.md`, `docs/migration/git-site-sync-policy.md`, puis les documents de `experiments/sinking-star-ss22/docs/`, en particulier la spécification, l’audit des sources, la validation et la feuille de route. GitHub est la source canonique ; le Site est son déploiement.

## Commencer par l’état existant

**L’intégration native de SS22 est déjà codée. Cette consigne sert à reprendre et à vérifier la livraison de façon idempotente.** Inspecte le `main` courant, la branche de travail et leurs changements avant toute intégration. Préserve les travaux parallèles et les éventuels correctifs plus récents.

Les repères de reprise sont les suivants :

| Repère | Valeur |
| --- | --- |
| Baseline GitHub / Site | `3d75e7bb72a2669eaa8511473721f7eb952f21bb`, Site version 194. |
| Branche de travail | `feat/sinking-star-ss22-20261125`. |
| Checkpoint local | `65ef876f90bec248aa79053c75ab0edf7c0e1f89`. |
| Checkpoint distant | `b48114dad0b1955199eb65fc9a34bd5768574f92`. |
| Arbre commun de ces checkpoints | `b9ebc4398351931c26fc40f1bb24bf45874eb789`. |

Ces repères ne remplacent pas l’inspection de l’état courant et ne sont pas une instruction de retour arrière. Si la branche a déjà été intégrée, repars de cet état et n’applique que les éléments encore manquants. Si GitHub et le Site ont divergé, préserve les deux états, réconcilie les sources, puis reprends la chaîne de publication.

## Contrat à conserver

Conserve **SS22 — Les Cortèges Mécaniques**, version 0.1.0, huit salles, **Marchand / Guerrier / Voleur / Barde**, sans Magicien. Le Marchand est sélectionné au départ. Le niveau 1, **L’école des cortèges**, porte les **33 découvertes** du tutoriel. Quatre héros vivants doivent occuper simultanément quatre destinations non attribuées. Une capacité, un nombre d’actions ou un compteur de découvertes ne doit jamais devenir une condition cachée de victoire.

Le Marchand pousse un occupant, le Guerrier pousse la file contiguë et le Voleur tire seulement son voisin arrière. Un pas volontaire du Barde entraîne les occupants admissibles dans un carré de **5 × 5 mesuré avant le pas**, y compris en diagonale et derrière une cloison. Les butées peuvent retenir une partie du groupe. Les miroirs ne suivent pas le chant. Un Barde bloqué annule le mouvement complet.

Tout déplacement imposé d’un partenaire reste sans capacité secondaire. Pousser ou tirer le Barde le replace sans chant ; déplacer le Voleur ne déclenche aucune traction. Préserve ces distinctions dans les phases, les animations et les détecteurs de leçons.

Une caisse dans l’eau nue devient un appui. Le chant peut déplacer cet appui **d’eau en eau** ; un héros présent l’ancre, et le prochain appui d’arrivée du Barde est également protégé. Les appuis ne se poussent, ne se tirent et ne se reflètent pas, ne font pas poids sur les boutons et ne transportent pas de passager. Un appui créé par retrait de plateforme persiste lors de la réactivation. Préserve les contrôles des soutiens de tous les partenaires chantés, les circuits à plusieurs boutons, les presses latérales et leurs cascades.

Les monstres sont immobiles hors transport explicite. Résous les contacts orthogonaux simultanés, l’eau et les changements de commandes avant la victoire. Conserve le reflet global `ACTION5`, ses conflits atomiques, les avertissements visibles, les durées et Undo. Aucune règle d’échange du Magicien ne doit être introduite dans SS22.

## Vérifier les raccordements déjà présents

Commence par `src/games/sinking-star-ss22.ts`, `src/games/sinking-star-ss22-help.ts`, le catalogue, le dispatcher natif, l’interface et `tests/ss22-native.test.ts`. Réutilise `QuartetPuzzleSession` et les niveaux du laboratoire ; n’en crée pas une copie divergente.

L’entrée attendue est unique : code **`SS22`**, identifiant **`ss22-c4000001`**, groupe **`custom_4`**, famille **`sinking_star_quartet`**, huit niveaux, disponibilité `playable`. SS22 suit SS21 dans Custom 4. Préserve SS01–SS21 et les autres jeux. Vérifie les enregistrements avant de les ajouter : aucune duplication dans le catalogue, la galerie, les imports, les routes, les aides ou les gestionnaires de commandes.

L’adaptateur expose les observations publiques : images 64 × 64, palette, actions, état officiel, progression, images d’animation et durées. Les témoins, le solveur et les données sémantiques d’auteur ne sont ni une entrée de SRA ni des données à embarquer dans le bundle de production.

Vérifie le lien `/?game=SS22#playground`, les huit sélections de niveau, les vignettes, les crédits, les quatre boutons de personnage, le tutoriel et les aides contextuelles. Les touches **1 / 2 / 3 / 4** correspondent à Marchand / Guerrier / Voleur / Barde ; Tab et le clic utilisent la sélection publique `ACTION6`. Espace ou X déclenche les miroirs. Undo et les commandes de réinitialisation doivent interrompre proprement une animation.

La transition N1–N2 et son annulation doivent restaurer la bonne aide. Les panneaux de fin attendent la dernière image. Sur mobile, les quatre sélections, les commandes et les textes doivent rester accessibles sans débordement. Conserve le réglage de réduction des animations.

## Qualification et preuves

Les résultats connus à la rédaction sont **104 tests de laboratoire** et **90 tests natifs couvrant SS01–SS22**, tous réussis. La campagne manuelle Chrome N1→N8 a atteint la victoire officielle avec les 33 découvertes ; Undo et rejeu des fins N1/N8 ont été vérifiés. Le typage, le build et le contrôle de continuité SIC ont réussi ; les preuves se trouvent dans `docs/migration/ss22-evidence/`. Des modifications ultérieures imposent de vérifier les contrôles affectés et de consigner le SHA effectivement qualifié.

Dans `experiments/sinking-star-ss22`, installe les dépendances avec `npm ci` si nécessaire, puis exécute :

```sh
npm test
npm run validate
npm run validate:ui
npm run validate:design
```

Conserve le résultat réel des tests unitaires dans `validation/unit-tests.json`, puis exécute `node scripts/package-delivery.mjs`. Le manifeste doit correspondre aux octets du HTML et aux rapports courants. Il qualifie le laboratoire autonome ; il ne remplace pas un essai du Playground ou une vérification de publication. Les scripts de revue présents dans `reference/author/` et leurs rapports documentent les variantes sans prétendre à une recherche exhaustive de toutes les solutions.

Rejoue les témoins par l’adaptateur et le dispatcher natifs en comparant les observations publiques complètes au laboratoire, y compris toutes les images et leurs durées. La référence compte **1 414 entrées**, **173 sélections**, **1 241 actions physiques** et **3 932 images**. Les nombres d’entrées par salle sont **321, 185, 106, 203, 198, 136, 149 et 116**. Aucun témoin ne contient de refus ni de perte de héros. Ces valeurs sont des mesures de qualification, pas des minima ni des quotas imposés au joueur.

À la racine du dépôt, vérifie le typage, le build et les suites natives pertinentes :

```sh
npm run typecheck
node --test tests/ss*-native.test.ts
npm run build
npm run test:sic-continuity
```

Le test SS22 doit préserver les comparaisons d’observations, les 33 découvertes, les données invalides, Undo, Reset, Restart, la sélection de niveau, les transitions et le quatrième héros. Ne réduis pas les contrôles des jeux précédents pour obtenir une qualification SS22.

Le contrôle `test:sic-continuity` est obligatoire avant intégration d’une modification de moteur ou de pack. Il vérifie les commandes réellement exécutées et les clôtures natives ; une victoire ou une série annoncée ne le remplace pas. N’ajoute aucune solution, coordonnée ou reconnaissance propre à SS22 à l’apprentissage ou à l’arbitrage SIC. Toute modification de SIC doit satisfaire les règles de généricité, les cas de transfert, le cas ambigu et le cas contradictoire imposés par `AGENTS.md`.

Effectue ou termine le parcours dans le navigateur autorisé **depuis N1 jusqu’à N8** avec les commandes de l’interface livrée. Consigne l’état officiel final et les coups par salle. Distingue clairement cette preuve d’interface des tests DOM et des rejeux par dispatcher. Une victoire obtenue par témoin ou par commandes manuelles n’est pas une résolution autonome par SRA ; celle-ci exige un essai et un compte rendu séparés.

## Sauvegarde, intégration et publication du Site existant

Suis la chaîne **tests → commit → push GitHub → intégration sur main → vérification distante → publication du Site existant → vérification GitHub/Site**. Sauvegarde les changements cohérents sur GitHub sans attendre la fin des essais d’autres lots. Ne considère pas un checkout local ou une version Site comme l’unique archive du travail.

Le Site à mettre à jour est [SRA Playground](https://sra-playground.yannick-fontan.chatgpt.site), projet **`appgprj_6adbc388d79081918581b93b919d7258`**. **Conserve ses accès owner-only et publie dans ce projet existant.** Vérifie son SHA source courant avant publication, puis le SHA de la version publiée. Réutilise la livraison déjà intégrée lorsqu’elle correspond au résultat attendu ; ne crée ni un deuxième Site ni un deuxième jeu SS22.

Le compte rendu final indique la branche de travail, le dernier SHA local, le SHA poussé, le commit intégré à `main`, la version Site, son SHA source vérifié et toute divergence éventuelle. Ajoute le lien direct [SS22](https://sra-playground.yannick-fontan.chatgpt.site/?game=SS22#playground), les résultats exacts de laboratoire, de navigateur et de continuité, ainsi que leurs limites.

L’avancement de création est **22/25 campagnes, soit 88 % et 176/200 salles**. La suite confirmée est **SS23 Marchand / Guerrier / Magicien / Barde**, puis **SS24 Marchand / Voleur / Magicien / Barde**, puis **SS25 Guerrier / Voleur / Magicien / Barde**. Ces indications ne remplacent pas la clôture complète de livraison de SS22.

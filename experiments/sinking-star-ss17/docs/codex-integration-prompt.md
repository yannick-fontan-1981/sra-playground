# Intégrer SS17 dans SRA Playground et publier le Site

Travaille dans **`yannick-fontan-1981/sra-playground`**, depuis le `main` distant à jour. Lis `AGENTS.md`, `docs/migration/git-site-sync-policy.md` et les instructions applicables. Crée une branche ou un worktree dédié et préserve les travaux concurrents.

Intègre nativement **SS17 — La Forteresse Rose**, trio **Guerrier rouge 8 + Voleur vert 14 + Magicien violet 15**, dans **Custom 4**, après SS16. Publie ensuite le **Site SRA Playground existant** depuis le code testé, poussé et intégré sur `main`, en conservant ses paramètres d’accès actuels.

## Source canonique

Le laboratoire de référence est `experiments/sinking-star-ss17/`, version **0.1.0**. Prends la révision qualifiée courante de `main`, avec les cartes et les audits qualifiés ; ne récupère pas un ancien point de sauvegarde de la branche. Lis le README, `docs/specification.md`, `docs/level-design.md`, `docs/source-audit.md`, `docs/validation.md` et `docs/roadmap.md`.

Réutilise `src/core.ts`, les huit cartes de `src/levels.ts`, les crédits de `src/level-info.ts` et le tutoriel de `src/tutorial.ts`. Inspecte le raccordement natif des SS précédents, le catalogue, le dispatcher et Custom 4 pour adapter le branchement à la structure réelle du dépôt. Les outils de `reference/`, les témoins et le solveur sont réservés à l’auteur et aux tests.

SS17 conserve les corrections visuelles et les alertes rouges de SS16, mais remplace le Marchand par le Magicien. Le tutoriel comporte 23 découvertes et la campagne huit cartes originales inspirées de références précises. Les audits conservent des solutions alternatives élaborées ; ne les interdire ni par un compteur caché ni par une condition de victoire différente des trois destinations.

## Résultat attendu

1. Ajouter l’adaptateur, l’entrée Custom 4, la vignette et les éléments de galerie, le sélecteur et le lien direct selon les conventions actuelles. Conserver les huit salles dans leur ordre et l’atelier de vingt-trois découvertes au niveau 1. Le Guerrier est sélectionné au début de chaque salle.
2. Raccorder **`TrioPuzzleSession`** sans hypothèse de duo : trois héros présents, trois identités, cycle à trois, trois destinations simultanées, trois personnages exposés aux pertes. Un héros arrivé reste sélectionnable.
3. Conserver ACTION1–6, les images 64 × 64 à seize couleurs, toutes les images d’animation et leurs durées. ACTION6 reçoit des coordonnées pixel entières 0–63, change la sélection sans faire avancer le monde et participe à Undo lorsqu’elle change réellement le héros actif. Une campagne invalide ou une sélection erronée ne doit pas muter la session existante.
4. Guerrier : toute la file, avec refus atomique si son extrémité bloque. Voleur : une seule entité arrière tirée lors d’un pas vers une case libre, aucune poussée. Magicien : une flèche échange sa place avec la première caisse, le premier monstre ou le premier autre héros atteint par sa visée ; sans cible, tentative de marche. Les faces blanches dévient le rayon, les dos noirs le bloquent, plusieurs miroirs peuvent le relayer. Les appuis et miroirs ne sont pas des cibles. Conserver les boucles animées et leurs temporisations, sans déplacement ni combat. Aucun déplacement forcé ne déclenche récursivement une capacité.
5. Conserver les **appuis fixes** : caisse dans l’eau sans soutien → appui permanent ; aucune récupération, traction, poussée ou réflexion de cet appui. Une caisse sur un appui reste mobile. Les appuis ne sont pas détruits par la réactivation d’une plateforme hydraulique. Distinguer les déplacements volontaires refusés et les pertes provoquées par un déplacement forcé ou le retrait d’une plateforme.
6. Conserver les reflets globaux : candidat le plus proche, échange à distance égale, conflits atomiques, prévisions grises sous les occupants. Une réflexion refusée par un mur, une porte, une presse, un occupant ou un conflit fait clignoter deux fois en rouge les dos des miroirs concernés, dans toutes les salles ; préserver les quatre images et durées 110/70/110/0 ms, la diagonale blanche, les miroirs non concernés et la réduction des animations. Un refus ne déplace aucune pièce et n’ajoute pas d’Undo. Préserver presses latérales, portes à plusieurs boutons, plateformes, stabilisation des cascades et combat orthogonal simultané.
7. Respecter les corrections visuelles : **bouton opaque gris avec plus rose et pixel de circuit au centre** ; **presse pure au centre noir fermé / gris ouvert**. Les presses des cartes ne sont pas aussi des boutons. Aucun pixel bleu parasite ne doit traverser leur fond. La diagonale blanche et le dos noir d’un miroir restent au-dessus des marques de bouton.
8. Raccorder clavier, clic, boutons tactiles, **1 / 2 / 3 et Tab**, reflets, Annuler, Recommencer et Repartir. Garder le blocage des commandes pendant l’animation, l’invalidation des callbacks après interruption, la réduction des animations et les panneaux terminaux après la dernière image. Sur mobile, placer les commandes de rôle et de mouvement près du plateau.
9. Conserver les **23 découvertes déduites uniquement des pixels publics**, les aides détaillées et les références principales et secondaires de chaque salle. Aucune coche ne participe à la victoire. Ne transmettre à SRA ni état privé, ni route, ni plan de réflexion, ni résultat du solveur ; ne créer aucun traitement spécifique qui résout SS17 à sa place.

## Qualification

Depuis le laboratoire :

```sh
npm ci
npm test
npm run validate
npm run validate:ui
npm run validate:design
```

Les rapports courants de `validation/` et `docs/validation.md` donnent les comptes exacts. Rejouer les huit témoins à travers l’adaptateur et le dispatcher natifs. Comparer chaque observation, chaque image et chaque durée au laboratoire. Vérifier Undo après chaque fin de salle, Reset/Restart, ordre arbitraire de visite, sélection des trois héros, erreurs atomiques, défaite et victoire finale.

Les parcours prouvent la solvabilité ; ils ne prouvent ni minimum de coups, ni solution unique, ni réussite autonome par SRA. Conserver les géométries qualifiées et les variantes gagnantes archivées. L’utilisation d’un pont ou d’un sort dans le témoin n’est pas une preuve de nécessité globale ; aucune découverte pédagogique ne verrouille la victoire.

Contrôler le jeu intégré dans un navigateur autorisé : commandes, huit salles, tutoriel, interruptions, liens directs, formats ordinateur et mobile. Inspecter particulièrement les boutons et presses colorés, les miroirs sur boutons, la construction des appuis et les trois sélections. La qualification Happy DOM du laboratoire ne remplace pas ce contrôle natif ; le rendu CSS dans un navigateur natif reste à contrôler dans l’environnement autorisé d’intégration.

Exécuter les tests, le typage et le build requis par le dépôt, ainsi que les non-régressions Custom 4 pertinentes. Si un chemin partagé du runtime change, mesurer son coût avant/après dans des conditions identiques et respecter la tolérance globale de **+10 %** appliquée à la série.

## Publication et compte rendu

Respecter **tests → commit → push GitHub → intégration main → publication Site → vérification GitHub/Site**. Intégrer sans écraser les avancées concurrentes et vérifier le commit distant avant publication.

Publier sur le Site SRA Playground existant, puis vérifier le jeu, son lien direct et ses commandes dans la version déployée. Relever la version Site et le SHA source lorsqu’il est exposé ; vérifier leur correspondance avec le commit GitHub durable. Si le SHA source n’est pas exposé, consigner le commit utilisé et cette limite. Préserver et réconcilier les états en cas de divergence.

Mettre à jour la feuille de route et livrer : résultat fonctionnel, tests, revue navigateur, branche, SHA local/poussé/intégré, URL du Site, lien direct SS17, version Site, SHA source disponible et limites restantes. Si une capacité manque, sauvegarder le travail sur GitHub et nommer le blocage exact.

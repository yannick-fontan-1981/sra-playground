# Intégrer SS15 dans SRA Playground et publier le Site

Travaille dans **`yannick-fontan-1981/sra-playground`**, depuis le `main` distant à jour. Prendre la révision 0.2.0 au minimum : l’ordre des salles et l’atelier ont été corrigés après la première livraison. Lis `AGENTS.md`, `docs/migration/git-site-sync-policy.md` et les instructions applicables. Crée une branche ou un worktree dédié et préserve les travaux concurrents.

Intègre nativement **SS15 — Les Accords Transposés**, duo **Magicien violet 15 + Barde magenta 6**, dans **Custom 4**, puis publie le **Site SRA Playground existant** depuis le code testé, poussé et intégré sur `main`. Conserve les paramètres d’accès actuels du Site.

## Source à intégrer

Le laboratoire de référence est `experiments/sinking-star-ss15/`, version **0.2.0**. Lis son README et les dossiers `docs/specification.md`, `docs/level-design.md`, `docs/source-audit.md`, `docs/validation.md` et `docs/roadmap.md`.

Réutilise le moteur `src/core.ts`, les huit cartes `src/levels.ts`, les crédits `src/level-info.ts` et le tutoriel `src/tutorial.ts`. Inspecte le raccordement natif actuel de SS13 et SS14 ainsi que le catalogue, le dispatcher et l’interface Custom 4. Adapte le branchement à la structure réelle du dépôt. Les outils de `reference/`, les témoins et les solveurs sont réservés à l’auteur et aux tests.

## Résultat fonctionnel attendu

1. Ajouter l’adaptateur SS15, son entrée Custom 4 après SS14, la vignette et les éléments de galerie habituels, le sélecteur et le lien direct. Conserver les huit salles dans leur ordre, avec « L’appui des deux traversées » en premier et l’atelier renforcé de vingt découvertes en quatrième position. Le Magicien est sélectionné au début de chaque salle.
2. Préserver le contrat ACTION1–6, les images 64 × 64 à seize couleurs, les deux destinations simultanées, toutes les images d’animation et leurs durées. ACTION6 prend des coordonnées pixel entières 0–63 et ne fait pas avancer le monde. Valider toute campagne et toutes ses positions initiales avant de remplacer une session existante.
3. Conserver l’échange avec la première cible du rayon : caisse, monstre ou Barde. L’eau ne bloque pas la visée, les faces blanches dévient le rayon, les dos noirs et portes fermées l’arrêtent. Les appuis et miroirs ne sont pas des cibles. Un rayon bouclé montre son trajet et le clignotement sans changer les positions. Sans cible, le Magicien essaie de marcher.
4. Conserver le chant carré de 5 × 5 mesuré avant le pas, diagonales et portée à travers les murs comprises. Résoudre simultanément les dépendances entre membres ; un membre bloqué reste, tandis que les autres peuvent bouger. Le Barde doit avancer pour chanter. Un déplacement forcé ne déclenche aucun pouvoir ; les miroirs ne suivent jamais le chant.
5. Préserver les appuis immergés : déplacement d’eau en eau, ancrage sous les deux héros et sur la case d’arrivée du Barde, possibilité de transporter une caisse au-dessus d’appuis mobiles, conversion de caisse sèche en appui. Conserver la distinction entre une arrivée volontaire refusée et la noyade consécutive au retrait d’une plateforme hydraulique.
6. Préserver les reflets globaux : priorité au plus proche, échange à distance égale, traitement simultané, prévisions grises, conflits et dos rouges. Préserver les presses latérales, les changements de position des miroirs, les stabilisations de circuits et le combat simultané. Ne pas ajouter de poussée ou de traction volontaire aux héros.
7. Respecter la lisibilité des dispositifs : **bouton opaque gris avec plus rose et centre coloré**, presse simple au **centre noir fermé / gris ouvert**. Le fond masque l’eau et le périmètre du chant ; les prévisions grises se dessinent ensuite, sous les vrais occupants et les miroirs. Les cartes SS15 gardent boutons et presses sur des cases distinctes ; conserver ces positions. Les diagonales et dos des miroirs restent au-dessus des marques d’occupation.
8. Raccorder les commandes clavier, les boutons, le clic, Tab/1/2, les reflets, Annuler, Recommencer et Repartir. Garder l’interruption d’animation, l’absence de repeinture tardive, la réduction des animations et les panneaux terminaux affichés après la dernière image.
9. Conserver les **20 découvertes déduites des images publiques**, leurs textes, les aides contextuelles et les liens de sources principaux et secondaires. Le niveau 8 possède aussi une troisième référence documentée dans son audit. Aucun témoin, état sémantique privé, plan de solution ou résultat de solveur ne doit entrer dans les observations ni les décisions de SRA.

## Vérification

Depuis le laboratoire :

```sh
npm ci
npm test
npm run validate
npm run validate:ui
npm run validate:design
npm run validate:workshop
```

La référence qualifiée comporte **38 tests moteur**, **8 routes gagnantes**, **732 entrées dont 56 sélections**, **2 153 images**, **20 découvertes acquises** et aucun refus ni décès sur ces routes. Les vérifications Happy DOM portent sur le HTML compilé, ses événements, les pixels du canvas et les durées. Les dix contrôles de conception indépendants concernent les deux finales. Un contrôle distinct vérifie le nouvel atelier L4 : chambre murée, six contre-branches et recherches directes restreintes. Les vingt découvertes sont acquises au niveau 4 en 142 entrées. Ces recherches restent locales.

Rejouer les huit témoins à travers l’adaptateur natif et le dispatcher. Comparer chaque observation, chaque image et chaque durée au laboratoire. Vérifier l’annulation de chaque fin de salle, les erreurs de chargement et d’ACTION6 sans mutation, la reprise et la victoire finale. Les témoins prouvent la solvabilité ; ils ne prouvent ni minimum de coups, ni solution unique, ni réussite autonome de SRA.

Contrôler ensuite le jeu intégré dans un navigateur autorisé : commandes, huit salles, tutoriel, animations et interruptions, panneaux terminaux, liens directs, formats ordinateur et mobile. Regarder spécifiquement les boutons, presses et miroirs des salles 6 à 8. Le contrôle Happy DOM du laboratoire ne remplace pas cette vérification visuelle native.

Exécuter le typage, les tests et le build requis par le dépôt, ainsi que les non-régressions Custom 4 pertinentes. Si un chemin partagé du runtime est modifié, mesurer son coût global avant/après dans des conditions identiques et respecter la tolérance globale de +10 % déjà appliquée à cette série.

## GitHub, publication et compte rendu

Respecter la chaîne **tests → commit → push GitHub → intégration main → publication Site → vérification GitHub/Site**. Intégrer au `main` actuel sans écraser les avancées concurrentes. Vérifier le commit distant avant de publier depuis cet état.

Publier sur le Site SRA Playground existant, puis vérifier SS15, son lien direct et ses commandes dans la version déployée. Relever la version publiée et son SHA source lorsqu’il est exposé ; vérifier leur correspondance avec le commit GitHub durable. Si le SHA source n’est pas exposé, consigner le commit utilisé et préciser cette limite. Une divergence exige de préserver et réconcilier les deux états avant d’annoncer leur correspondance.

Mettre à jour la feuille de route et livrer : résultat fonctionnel, tests, contrôle navigateur, branche, SHA local/poussé/intégré, URL du Site et lien SS15, version Site, SHA source disponible, état de synchronisation et limites restantes. Si une capacité manque, préserver le travail sur GitHub et nommer le blocage exact.

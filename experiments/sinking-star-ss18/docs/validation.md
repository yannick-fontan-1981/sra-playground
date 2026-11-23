# Qualification de SS18 0.1.2

La qualification porte sur le laboratoire autonome et son HTML compilé. Elle utilise les parcours d’auteur, les observations publiques, les interactions DOM et des contre-branches locales. Elle ne certifie ni une solution minimale, ni l’unicité, ni une réussite autonome de SRA.

## Résultats

| Contrôle | Résultat |
| --- | --- |
| Compilation TypeScript et HTML autonome | Réussie |
| Tests du moteur et de la session | 50 réussis |
| Régressions du suivi pédagogique public | 6 réussies |
| Campagne | 8 témoins gagnants, aucun refus, aucune mort |
| Tutoriel N3 | 27 découvertes sur 27, démontrées dans les images publiques |
| Interface livrée | Huit témoins rejoués dans le HTML compilé par clavier et commandes |
| Images et temps | 2 096 images de campagne, comparaison exacte des pixels et durées |
| Undo | Fin de chacune des huit salles annulée puis rejouée |
| Revues de conception | Cinq scripts reproductibles, avec contre-branches et variantes |
| Répétitions exactes | Aucun doublon de terrain parmi les huit cartes ni avec les 32 terrains SS14–17, sous les huit symétries et après recadrage |
| Navigateur natif et Site | Non exécutés pour SS18 ; à qualifier lors de l’intégration autorisée |

Empreinte SHA-256 du HTML qualifié :

`6fa0427f4d0a3eb71e9d258552bc6924156dbbae3ce9fd91d265c3364a2c0ed3`

Le rapport `validation/delivery.json` associe cette empreinte au fichier livré. `dist/` est un résultat de construction ignoré par Git ; le code nécessaire à sa reproduction est conservé dans le dépôt.

## Parcours de campagne

Le départ est le niveau 1, mode trio Marchand / Magicien / Barde. Les entrées comprennent ACTION1–6 ; la colonne « coups » retire les sélections. Les images incluent les transitions vers la salle suivante. Le dernier résultat public est **`WIN`**, avec huit salles terminées.

| Niveau | Entrées | Sélections | Coups | Images |
| --- | ---: | ---: | ---: | ---: |
| 1 | 66 | 10 | 56 | 179 |
| 2 | 87 | 5 | 82 | 259 |
| 3 | 111 | 17 | 94 | 315 |
| 4 | 86 | 8 | 78 | 247 |
| 5 | 93 | 10 | 83 | 266 |
| 6 | 58 | 12 | 46 | 161 |
| 7 | 54 | 11 | 43 | 142 |
| 8 | 184 | 16 | 168 | 527 |
| **Total** | **739** | **89** | **650** | **2 096** |

Les parcours réalisent notamment 30 poussées du Marchand, 46 pas de chant, 12 échanges dont 3 coudés, 19 déplacements d’appui, 17 mouvements de miroir et 12 actions de reflet. Ils couvrent quatre poussées de presse, une vague de combat et un changement hydraulique. Ces comptes décrivent les témoins, sans imposer ces événements à toutes les solutions.

## Ce que vérifie chaque couche

### Moteur et pédagogie

`npm test` compile puis exécute les 56 tests. Les cas du moteur couvrent poussée unique, refus de file, partenaires sans activation passive, groupe du Barde, diagonales et cloisons, ancrages des appuis, visées coudées et boucles, première cible, conflits atomiques, commandes à plusieurs poids, hydraulique, presses, combat et sélection des trois identités.

Les six régressions pédagogiques vérifient notamment qu’un échange du Marchand ne compte pas comme extraction du Barde, qu’un appui glissant n’est pas considéré comme nouvellement créé, qu’un Barde bloqué n’enseigne pas un chant, qu’une poussée du Barde n’invente pas une capacité passive et qu’aucune découverte n’est accordée hors du niveau 3.

### Campagne et contrat public

`scripts/validate-levels.mjs` compare les cartes et crédits livrés aux références, rejoue les actions pixel des huit témoins, vérifie leurs étapes enregistrées et contrôle toutes les observations. Chaque image doit faire 64 × 64 avec des indices de palette 0–15. La dernière image d’une séquence est le résultat public stable ; chaque durée intermédiaire est vérifiée.

Les sélections ne modifient pas le monde. Les données malformées ne mutent pas la session. Les supports restent présents à leur position déplacée ou ancrée. La campagne termine avec les huit salles réussies, et l’annulation de chaque fin de salle est déterministe. Le HTML ne contient ni solveur, ni témoins, ni outils d’auteur, ni script distant requis pour jouer.

### Interface compilée

`scripts/verify-ui-dom.mjs` exécute le vrai HTML compilé dans **Happy DOM**, avec tampon RGBA du canvas et temporisateurs contrôlés. Il compare les pixels et les délais au moteur de référence. Ses cas ciblés couvrent 26 situations des rôles, trois situations de reflet, une boucle de visée, deux configurations de dessins de dispositifs et les avertissements de miroir.

Les contrôles de sélection, Tab, 1/2/3, clic, boutons, interruptions par Undo/Reset/Restart, changement de niveau, réduction des animations et panneaux de défaite/victoire sont exercés. Les huit routes sont ensuite jouées par l’interface. Les 27 découvertes du tutoriel sont également lues dans le DOM.

Sur la **vraie carte N8**, après un préfixe de 38 entrées, un reflet bloqué fait clignoter le dos du miroir concerné : quatre images, trois pixels noirs devenant rouges, diagonale intacte. Le test vérifie les durées 110/70/110/0 ms, l’absence d’Undo supplémentaire pour les avertissements répétés et la remise à zéro par Reset.

La presse placée sur la destination basse de N8 est également contrôlée dans le HTML : quatre coins jaunes et centre noir lorsqu’elle est fermée, cadre jaune et centre gris lorsqu’elle s’ouvre, aucun bleu parasite. Son ouverture par quatre poids, puis Annuler et le rejeu, conservent les pixels et les durées attendus.

Cette qualification ne calcule pas la mise en page CSS comme un navigateur natif. Les grilles initiales et des résultats sont en outre inspectées sous forme d’images raster exactes du moteur. La revue ordinateur/mobile dans un navigateur natif et la vérification du site déployé restent à faire dans l’environnement autorisé d’intégration.

### Conception et raccourcis

`scripts/verify-design-constraints.mjs` vérifie les trois héros et trois destinations, l’absence de départ sur une destination, la séparation boutons/presses, les graphes de marche dans la géométrie initiale figée et les empreintes de terrain. Il autorise qu’une destination serve d’escale ; il refuse que les trois destinations soient déjà assignables par simple marche dans ce modèle.

Il exécute les cinq scripts :

- `review-level3.mjs` : couverture des 27 découvertes et six expériences locales.
- `review-levels1-2-4.mjs` : sept vérifications des commandes, du tri et des départs croisés.
- `review-final-levels.mjs` : seize contre-branches de N5–N8 et variante N7 conservée.
- `audit-early-levels.mjs` : relecture indépendante de N1, N2 et N4, géométrie et autre victoire de N4.
- `audit-final-levels.mjs` : relecture indépendante de N5–N8, ressources, risques de raccourcis et variété ; pour N8, certificat des quatre poids, conservation du bilan, anciens contournements et fermeture de la presse de destination.

Les variantes N4 en 72 entrées et N7 en 43 entrées restent gagnantes. Les anciens contournements de N8 sont documentés sur la baseline 0.1.1 : victoire avec le miroir en poids de remplacement, et victoire par deux appuis au sud sans jamais activer l’accord ; dans les deux cas, la réserve nord-est reste immobile. Leur rejeu sur 0.1.2 complète les contrôles de la nouvelle carte.

La nécessité de la réserve ne repose pas sur l’échec d’une recherche bornée. Quatre boutons hors des buts doivent rester occupés pour ouvrir la presse d’une destination. À la victoire, les trois héros sont sur leurs trois buts et ne peuvent fournir aucun de ces poids. Les trois caisses et le miroir constituent exactement les quatre objets disponibles ; l’appui initial n’est pas un poids. Une réserve laissée en place, une caisse convertie en appui ou un poids détruit empêche donc de satisfaire cet accord final. La revue contrôle également une fermeture réelle après retrait d’un poids : le héros quitte le but par l’effet de la presse, et les repères visuels du but restent lisibles.

Aucun verrou invisible n’a été ajouté pour forcer un témoin. Cette preuve de conservation ne certifie ni une solution unique, ni un minimum de coups, ni l’emploi obligatoire de chaque capacité. Les graphes de marche figent les ressources et les circuits ; ils ne constituent pas une recherche exhaustive de toutes les actions conjointes. Les autres contre-branches prouvent leurs effets dans les positions indiquées.

## Reproduction et intégration

```sh
npm ci
npm test
npm run validate
npm run validate:ui
npm run validate:design
```

Les environnements utilisés sont Node 24.22.3, TypeScript 5.9.3 et Happy DOM 21.0.4 ; le projet demande Node ≥ 22. Les scripts de construction n’ont pas besoin d’un service distant une fois les dépendances installées.

L’intégration native doit comparer les huit parcours à travers son adaptateur et le dispatcher, puis exécuter les tests du dépôt, le build et la revue navigateur. La publication du Site vient après sauvegarde GitHub et intégration sur `main`. La livraison du laboratoire ne prétend pas avoir accompli ces étapes natives.

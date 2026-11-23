# Qualification de SS19 0.1.0

La qualification porte sur le laboratoire autonome **La Chasse Noire**, son moteur, ses huit cartes et son HTML compilé. Les parcours d’auteur sont rejoués par les commandes de l’interface livrée. Les résultats décrivent ces parcours et les contre-branches indiquées ; ils ne certifient ni une solution minimale, ni l’unicité, ni une résolution autonome par SRA.

## Résultats

| Contrôle | Résultat |
| --- | --- |
| Compilation TypeScript et HTML autonome | Réussie |
| Tests du moteur et de la session | 50 réussis |
| Tests de la poursuite | 14 réussis |
| Régressions du suivi pédagogique public | 11 réussies |
| Campagne | 8 témoins gagnants, aucun refus, aucune perte de héros |
| Tutoriel N1 | 31 découvertes sur 31, démontrées dans les images publiques |
| Interface livrée | Les huit témoins rejoués dans le HTML compilé par clavier et commandes DOM |
| Images et temps | 2 749 images de campagne, comparaison exacte des pixels et durées |
| Undo | Fin de chacune des huit salles annulée puis rejouée |
| Revues de conception | Quatre scripts reproductibles, avec contre-branches et variantes |
| Répétitions exactes | Aucun doublon de terrain parmi les huit cartes ni avec les 40 terrains SS14–SS18, sous les huit symétries et après recadrage |
| Navigateur natif et Site | À qualifier lors de l’intégration native ; aucune exécution revendiquée ici |

Empreinte SHA-256 du HTML qualifié :

`7636d82f48aa154fe1da46adc5c29306739194698b4681c673b62ae463014825`

Le rapport [delivery.json](../validation/delivery.json) associe cette empreinte au fichier livré et aux rapports de qualification. `dist/` est un résultat de construction ignoré par Git ; le code nécessaire à sa reproduction est conservé dans le dépôt.

## Parcours de campagne

Le départ est le **niveau 1**, avec le trio **Guerrier / Magicien / Barde**. Les entrées comprennent ACTION1–6 ; les actions hors sélection retirent les changements de héros. Les images incluent les transitions vers la salle suivante. Le dernier résultat public est **`WIN`**, avec les huit salles terminées.

| Niveau | Entrées | Sélections | Actions hors sélection | Images |
| --- | ---: | ---: | ---: | ---: |
| 1 | 201 | 17 | 184 | 591 |
| 2 | 56 | 8 | 48 | 166 |
| 3 | 150 | 18 | 132 | 423 |
| 4 | 143 | 9 | 134 | 425 |
| 5 | 143 | 15 | 128 | 434 |
| 6 | 74 | 10 | 64 | 204 |
| 7 | 52 | 9 | 43 | 142 |
| 8 | 115 | 12 | 103 | 364 |
| **Total** | **934** | **98** | **836** | **2 749** |

Les témoins réalisent notamment 82 actions de poussée du Guerrier, dont 10 poussées en file ; 24 chants ; 13 échanges, dont 3 visées coudées ; 11 actions de reflet ; 4 poussées de presse ; et 3 déplacements d’appui. La chasse produit 24 phases comportant au moins un déplacement, pour 30 déplacements individuels de monstre. Les tentatives de chasse totalement bloquées ne sont pas comptées comme déplacements. Ces valeurs décrivent les témoins ; elles n’imposent pas ces événements à toutes les solutions.

## Moteur et pédagogie

`npm test` compile puis exécute **75 tests**. Les 50 cas du moteur et de la session couvrent les poussées de files, les partenaires déplacés sans activation passive, le chant sélectif du Barde, les diagonales et cloisons, les appuis libres et ancrés, les échanges sur la première cible, les visées coudées et les boucles, les conflits atomiques, les commandes à plusieurs poids, les plateformes, les presses, le combat et la sélection des trois identités.

Les 14 tests de chasse vérifient le ciblage du héros sélectionné après l’action, l’axe dominant avec priorité verticale en cas d’égalité, l’absence de détour, les propositions simultanées et les conflits de destination. Ils couvrent aussi les obstacles, le contact avant et après la chasse, l’interaction avec les dispositifs, les animations et la restauration par Undo. Une sélection, un refus ou un reflet sans effet ne fait pas avancer les monstres.

Les 11 régressions pédagogiques vérifient le suivi depuis les pixels publics : une poussée de file se distingue d’une poussée simple ; un monstre rouge n’est pas un Guerrier ; un changement de cible n’est pas une avance de chasse ; un appui déplacé n’est pas une création d’appui ; un Barde bloqué ne valide pas un chant. Une presse qui déplace un monstre ensuite noyé est reconnue à partir des images intermédiaires. Aucune découverte n’est accordée hors du niveau 1.

Le rapport [unit-report.json](../validation/unit-report.json) conserve les empreintes des sources du moteur, du tutoriel et des tests qualifiés.

## Campagne et contrat public

`scripts/validate-levels.mjs` compare les cartes et crédits livrés aux références, rejoue les actions pixel des huit témoins et contrôle les étapes enregistrées. Chaque observation respecte le contrat public ; chaque image mesure 64 × 64 avec des indices de palette 0–15. La dernière image est le résultat stable et les durées intermédiaires sont contrôlées.

Les sélections ne modifient pas le monde. Les actions malformées restent atomiques. Les supports conservent leur état immergé et les actions annulées restaurent aussi la chasse et ses cascades. Le HTML ne contient ni solveur, ni témoins, ni outils d’auteur, ni script distant requis pour jouer.

Rapport : [levels-report.json](../validation/levels-report.json).

## Interface compilée

`scripts/verify-ui-dom.mjs` exécute le vrai HTML compilé dans **Happy DOM**, avec tampon RGBA du canvas et temporisateurs contrôlés. Il compare les pixels et les délais au moteur de référence. Ses **28 cas de mécanismes** couvrent les trois rôles, les poussées en file, la chasse, les appuis, les presses, l’hydraulique et le combat. Des cas supplémentaires couvrent les reflets, la boucle de visée et les dessins des dispositifs.

Les contrôles de sélection, Tab, 1/2/3, clic, boutons, interruptions par Undo/Reset/Restart, changement de niveau, réduction des animations et panneaux de défaite/victoire sont exercés. Les huit routes sont ensuite jouées par l’interface et les 31 découvertes du tutoriel sont lues dans le DOM.

Sur la **vraie carte N7**, après un préfixe de **15 entrées**, un reflet bloqué fait clignoter le dos du miroir concerné : quatre images, trois pixels noirs devenant rouges, diagonale intacte. Les durées sont 110/70/110/0 ms ; des avertissements répétés n’ajoutent pas d’Undo et Reset efface l’avertissement.

Une presse placée sur une destination de **N2** est également contrôlée dans le HTML : coins jaunes et centre noir lorsqu’elle est fermée, cadre jaune et centre gris lorsqu’elle s’ouvre, aucun bleu parasite. Son ouverture exige les deux poids de la salle. Annuler puis rejouer conserve les pixels et les durées attendus. Les boutons rose-violet sont dessinés sur un fond gris opaque.

Cette qualification ne calcule pas la mise en page CSS comme un navigateur natif. Les huit grilles initiales ont également été inspectées sous forme d’images raster exactes du moteur. La revue ordinateur/mobile et la vérification du Site déployé restent à faire dans l’environnement d’intégration.

Rapports : [ui-dom-report.json](../validation/ui-dom-report.json) et [browser-review-status.json](../validation/browser-review-status.json).

## Conception et raccourcis

`scripts/verify-design-constraints.mjs` vérifie les trois héros et les trois destinations, l’absence de départ sur une destination, la séparation boutons/presses, les graphes de marche dans la géométrie initiale figée et les empreintes de terrain. Les trois destinations ne doivent pas être assignables par simple marche dans ce modèle. Au N1, aucune destination n’est immédiatement accessible dans ces graphes.

Il exécute les quatre scripts suivants :

- `review-level2-ss19.mjs` : gardien maintenu sur sa commande, seconde charge, changement de cible et fermeture des destinations.
- `review-ss19-middle.mjs` : verrous optiques, réserve hydraulique, appuis et atelier à deux presses ; refus des raccourcis dans les positions indiquées.
- `review-final-ss19.mjs` : mécanismes des trois dernières salles, variantes gagnantes et nécessité des ressources finales.
- `independent-review-ss19.mjs` : seconde lecture des cartes, essais de contournement et autres solutions conservées.

La revue a conduit à fermer le raccourci de quatre chants qui remplaçait les deux presses de N5. Une variante plus élaborée conserve la première presse et remplace la seconde par un déverrouillage temporaire, une extraction par le Magicien et un reverrouillage ; elle réussit en 181 entrées, dont 22 sélections. Les deux presses du témoin ne sont donc pas présentées comme obligatoires dans toute solution.

N4 possède plusieurs solutions : noyade retardée, passage chanté du Barde sur le pont complet, ou traversée en déplaçant ensemble un appui et la seconde caisse puis en utilisant un échange. Dans cette dernière route, une seule caisse est immergée et les deux réserves restent employées. Le pont complet du témoin est un enseignement, pas une condition cachée de victoire. N6 autorise la préparation différée de sa charge ; N7 peut conserver son monstre vivant ; N8 admet un départ par reflet direct. Ces variantes sont consignées dans les revues et dans [la conception des niveaux](level-design.md).

### Ressources obligatoires du niveau 8

La nécessité de la caisse ne repose pas sur l’échec d’une recherche bornée. La troisième destination est sur une île vide : son seul accès utilisable est la cellule d’eau `(13,17)`, hors des axes du miroir fixe. Le Magicien ne peut pas transférer un premier occupant sur une île sans cible ; le chant ne permet pas d’entrer sur l’eau nue. La caisse unique doit donc fournir l’appui d’entrée.

Les deux autres destinations sont des presses commandées par deux boutons hors des buts. À la victoire, les trois héros sont sur leurs buts ; la caisse est immergée et n’est plus un poids ; le miroir est bloqué par la géométrie. Les deux chasseurs vivants sont les seuls poids restants pour maintenir les deux commandes. La revue vérifie également la fermeture effective après libération d’une commande et l’échec d’une immersion de la caisse dans un autre bassin.

Aucun historique de solution n’est imposé. Les graphes de marche figent les ressources et les circuits ; ils ne constituent pas une recherche exhaustive de toutes les actions conjointes. La comparaison des terrains détecte les copies exactes, y compris tournées ou déplacées, sans prétendre mesurer à elle seule la diversité des raisonnements.

Rapport : [design-report.json](../validation/design-report.json).

## Reproduction et intégration

```sh
npm ci
npm test
npm run validate
npm run validate:ui
npm run validate:design
```

Environnements utilisés : Node 24.22.3, TypeScript 5.9.3 et Happy DOM 21.0.4 ; le projet demande Node ≥ 22. Une fois les dépendances installées, la construction et les validations ne dépendent pas d’un service distant.

L’intégration native doit comparer les huit parcours à travers son adaptateur et le dispatcher, puis exécuter les tests du dépôt, `npm run test:sic-continuity`, le build et la revue navigateur. La publication du Site vient après sauvegarde GitHub et intégration sur `main`. Le laboratoire autonome est prêt pour cette phase ; il ne prétend pas l’avoir déjà accomplie.

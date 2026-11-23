# Qualification de SS19 0.2.0

La qualification porte sur le laboratoire autonome **Les Gardiens Noirs**, son moteur, ses huit cartes et son HTML compilé. Les huit parcours d’auteur sont rejoués par les commandes de l’interface livrée, depuis le niveau 1 jusqu’au résultat public **`WIN`**. Les monstres restent immobiles tant qu’un pouvoir ou une presse ne les transporte pas. Aucun déplacement autonome ni comportement dépendant du héros sélectionné ne subsiste.

Les résultats établissent la validité des parcours et des contre-branches indiqués. Ils ne certifient ni une solution minimale, ni l’unicité, ni une résolution autonome par SRA.

## Résultats

| Contrôle | Résultat |
| --- | --- |
| Compilation TypeScript et HTML autonome | Réussie |
| Tests du moteur et de la session | 50 réussis |
| Tests des monstres et de leurs transports physiques | 17 réussis |
| Régressions du suivi pédagogique public | 11 réussies |
| **Total des tests** | **78 réussis, aucun échec** |
| Campagne | 8 témoins gagnants, aucun refus, aucune perte de héros |
| Tutoriel N1 | 31 découvertes sur 31, démontrées dans les images publiques |
| Interface livrée | 29 cas de mécanismes, contrôles complémentaires et huit parcours complets dans le HTML compilé |
| Images et temps | 2 615 images de campagne, comparaison exacte des pixels et durées |
| Undo | Fin de chacune des huit salles annulée puis rejouée |
| Revues de conception | 88 contrôles réussis dans quatre scripts reproductibles |
| Répétitions exactes | Aucun doublon de terrain parmi les huit cartes ni avec les 40 terrains SS14–SS18, sous les huit symétries et après recadrage |
| Cartes conservées | Géométrie et commandes des N3, N6 et N7 identiques à la base 0.1.0 |
| Navigateur natif et Site | À qualifier lors de l’intégration native ; aucune exécution revendiquée ici |

Empreinte SHA-256 du HTML qualifié :

`11c3ad41fa297d12e668bdfac3870921ff1fb7340a551173b548272854ec06e6`

Les rapports [levels-report.json](../validation/levels-report.json) et [ui-dom-report.json](../validation/ui-dom-report.json) portent cette même empreinte. Le manifeste [delivery.json](../validation/delivery.json) rassemble les références de livraison. `dist/` est un résultat de construction ignoré par Git ; le code nécessaire à sa reproduction est conservé dans le dépôt.

## Parcours de campagne

Le départ est le **niveau 1**, avec le trio **Guerrier / Magicien / Barde**. Les entrées comprennent ACTION1–6 ; les actions hors sélection retirent les changements de héros. Les images comprennent les transitions vers la salle suivante. Le dernier résultat public est **`WIN`**, avec les huit salles terminées.

| Niveau | Entrées | Sélections | Actions hors sélection | Images |
| --- | ---: | ---: | ---: | ---: |
| 1 | 208 | 20 | 188 | 600 |
| 2 | 62 | 8 | 54 | 184 |
| 3 | 150 | 18 | 132 | 423 |
| 4 | 135 | 12 | 123 | 392 |
| 5 | 134 | 13 | 121 | 400 |
| 6 | 74 | 10 | 64 | 204 |
| 7 | 52 | 9 | 43 | 142 |
| 8 | 97 | 15 | 82 | 270 |
| **Total** | **912** | **105** | **807** | **2 615** |

Les témoins réalisent 75 actions de poussée du Guerrier, dont 11 poussées en file ; 41 chants ; 16 échanges, dont 3 visées coudées ; 12 actions de reflet ; 8 poussées de presse ; et 3 déplacements d’appui. Les chants déplacent individuellement des monstres à 12 reprises. Ces valeurs décrivent les parcours enseignés, sans imposer les mêmes événements à toutes les solutions. Le moteur n’ajoute aucun pas de monstre après leur transport physique. Les métriques complètes figurent dans [levels-report.json](../validation/levels-report.json).

Le contrôle [preserved-levels.json](../validation/preserved-levels.json) compare les géométries et commandes des N3, N6 et N7 à la base Git `edc8db52c4891d85c14b5ef484d0fdf7a9c94a42` et confirme leur conservation.

## Moteur et pédagogie

`npm test` compile puis exécute **78 tests**. Les 50 cas du moteur et de la session couvrent les poussées de files, les partenaires déplacés sans activation passive, le chant sélectif du Barde, les diagonales et cloisons, les appuis libres et ancrés, les échanges sur la première cible, les visées coudées et les boucles, les conflits atomiques, les commandes à plusieurs poids, les plateformes, les presses, le combat et la sélection des trois identités.

Les 17 tests de `tests/monsters.test.mjs` vérifient l’immobilité après marche ou sélection, la stabilité d’un monstre posé sur un bouton sans mur pour le retenir, et les transports par poussée, chant, échange, reflet et presse. Chaque transport conserve ses images visibles et ne déclenche aucun mouvement supplémentaire. Ouvrir une porte ou fermer une presse vide ne déplace pas un monstre voisin : la presse agit sur l’occupant de sa propre case lors de sa fermeture. Les tests couvrent également la noyade, le combat simultané, les contacts avant la validation des destinations et la restauration du tour entier par Undo.

Les 11 régressions pédagogiques vérifient le suivi depuis les pixels publics : une poussée de file se distingue d’une poussée simple ; un monstre rouge reste distinct du Guerrier ; un chant qui transporte un monstre est reconnu comme tel ; une sélection seule ne démontre ni marche ni transport ; un appui déplacé n’est pas déclaré nouvellement créé ; un Barde bloqué ne valide pas de chant. Une presse qui déplace un monstre ensuite noyé est reconnue à partir des images intermédiaires. Aucune découverte n’est accordée hors du niveau 1.

Le rapport [unit-report.json](../validation/unit-report.json) conserve la répartition des tests et les empreintes des sources du moteur, du tutoriel et des tests qualifiés.

## Campagne et contrat public

`scripts/validate-levels.mjs` compare les cartes et crédits livrés aux références, rejoue les actions pixel des huit témoins et contrôle les étapes enregistrées. Chaque observation respecte le contrat public ; chaque image mesure 64 × 64 avec des indices de palette 0–15. La dernière image est le résultat stable et les durées intermédiaires sont contrôlées.

Les sélections ne changent aucune position ni aucun circuit. Les actions malformées restent atomiques. Les appuis conservent leur état immergé ; Undo restaure les déplacements, les dispositifs et leurs conséquences physiques. Après l’action du joueur, les circuits, l’eau et les contacts sont résolus avant les destinations. Le HTML ne contient ni solveur, ni témoins, ni outils d’auteur, ni script distant requis pour jouer.

Rapport : [levels-report.json](../validation/levels-report.json).

## Interface compilée

`scripts/verify-ui-dom.mjs` exécute le vrai HTML compilé dans **Happy DOM**, avec tampon RGBA du canvas et temporisateurs contrôlés. Il compare les pixels et les délais au moteur de référence. Ses **29 cas de mécanismes** couvrent les trois rôles, les poussées en file, les gardiens immobiles et leurs transports explicites, les appuis, les presses, l’hydraulique et le combat. Des contrôles complémentaires couvrent les reflets, la boucle de visée et les dessins des dispositifs.

Les touches 1/2/3, Tab, les clics et boutons de rôle, les commandes de direction, les interruptions par Undo/Reset/Restart, le changement de niveau, la réduction des animations et les panneaux de défaite/victoire sont exercés. Les huit routes sont ensuite jouées par l’interface et les 31 découvertes du tutoriel sont lues dans le DOM. La comparaison porte sur toutes les images et durées de ces parcours, y compris l’annulation et le rejeu de chaque fin de salle.

Sur la **vraie carte N8**, après un préfixe de **7 entrées**, un reflet bloqué fait clignoter le dos du miroir concerné : quatre images, trois pixels noirs devenant rouges, diagonale intacte. Les durées sont 110/70/110/0 ms ; des avertissements répétés n’ajoutent pas d’Undo et Reset efface l’avertissement. Le rapport enregistre ce cas sous `actual campaign blocked mirrors`, avec `level: 8` et `prefixActions: 7`.

Une presse placée sur une destination de **N2** est également contrôlée dans le HTML : coins jaunes et centre noir lorsqu’elle est fermée, cadre jaune et centre gris lorsqu’elle s’ouvre, aucun bleu parasite. Son ouverture exige les deux poids de la salle. Annuler puis rejouer conserve les pixels et durées attendus. Les boutons rose-violet sont dessinés sur un fond gris opaque.

**Limite de cette qualification :** Happy DOM exécute les commandes et le code du canvas, mais ne calcule pas la mise en page CSS comme un navigateur natif. Ces résultats ne constituent donc pas une revue visuelle ordinateur/mobile, une mesure de fluidité sur un appareil réel ou une vérification du Site publié. Ces contrôles restent à effectuer dans l’environnement d’intégration.

Rapports : [ui-dom-report.json](../validation/ui-dom-report.json) et [browser-review-status.json](../validation/browser-review-status.json).

## Conception et raccourcis

`scripts/verify-design-constraints.mjs` vérifie les trois héros et les trois destinations, l’absence de départ sur une destination, la séparation boutons/presses, les graphes de marche dans la géométrie initiale figée et les empreintes de terrain. Les trois destinations ne doivent pas être assignables par simple marche dans ce modèle. Au N1, aucune destination n’est immédiatement accessible dans ces graphes.

Les quatre revues reproductibles totalisent **88 contrôles réussis** :

| Script | Contrôles | Objet principal |
| --- | ---: | --- |
| `review-level2-ss19.mjs` | 10 | Rail à trois presses, deux poids, remplacement du Magicien et fermeture des destinations |
| `review-ss19-middle.mjs` | 20 | Contrôleur optique, réserve hydraulique, appuis, collision chantée et moulin à deux presses |
| `review-final-ss19.mjs` | 21 | Reflets, relais, deux gardiens, ressources nécessaires et variantes des N6–N8 |
| `independent-review-ss19.mjs` | 37 | Causes physiques, contre-parcours, géométrie, ressources et variantes des huit salles |
| **Total** | **88** | |

La provenance de la relecture de N2 est explicitée dans le rapport indépendant : son nouveau rail a été écrit par un autre auteur, sur une géométrie héritée d’une version conçue par le relecteur. Les contrôles sont ciblés et leurs limites sont déclarées.

Au N2, une fermeture vide ne termine pas le trajet du gardien. Au N4, déplacer le gardien avant d’extraire les réserves ferme leur accès ; la trappe active ne donne pas de traversée directe du bassin. Au N5, deux poids restent enfermés dans leur chambre. La caisse haute est la seule réserve extérieure compatible avec la commande cyan finale : un contre-parcours place réellement un monstre sur ce bouton, puis constate le contact mortel lorsqu’un héros entre sur la destination voisine. Fermer la première presse contre la seconde déjà fermée écrase également cette caisse.

### Variantes gagnantes requalifiées

Le tableau présente des routes entièrement rejouées sur les cartes **0.2.0**, sans refus ni perte de héros. Les nombres sont des observations, sans revendication de minimum.

| Niveau | Variante | Entrées | Sélections | Portée de la conclusion |
| --- | --- | ---: | ---: | --- |
| N4 | Retirer la trappe avant le chant ; le gardien tombe alors directement dans l’eau nue | 135 | 12 | L’ordre « chant puis retrait » du témoin est pédagogique |
| N4 | Faire traverser le duo par cinq pas chantés sur la chaîne d’appuis | 138 | 15 | Pousser la Barde sur le pont est une possibilité, pas une obligation |
| N6 | Préparer la charge après les deux premiers reflets | 95 | 10 | La préparation préalable de la charge n’est pas universelle |
| N7 | Garder le monstre vivant derrière la caisse écran | 50 | 9 | L’élimination du monstre n’est pas nécessaire |
| N8 | Extraire la réserve par un second reflet, sans transposition | 75 | 9 | La visée coudée du témoin est facultative |
| N8 | Livrer le gardien est par le chant depuis `(11,9)`, puis dégager la Barde latéralement | 93 | 15 | La presse verte de livraison peut être remplacée par ce chant |

Les deux variantes N8 conservent les deux gardiens comme poids et la caisse comme appui d’entrée. Les variantes N4 décrites ici conservent le chantier à trois appuis ; cela ne démontre pas qu’un pont continu ou deux immersions seraient nécessaires à toutes les solutions.

Les commandes, métriques et observations sont consignées dans [ss19-middle-review.json](../reference/ss19-middle-review.json), [final-ss19-review.json](../reference/final-ss19-review.json) et [independent-review-ss19.json](../reference/independent-review-ss19.json).

### Ressources nécessaires du niveau 8

La nécessité de la caisse repose sur la géométrie. La troisième destination est sur une île vide : son seul accès utilisable est la cellule d’eau `(13,17)`, hors des axes du miroir fixe. Le Magicien ne peut pas transférer un premier occupant sur une île sans cible ; le chant ne permet pas à un héros d’entrer sur l’eau nue. La caisse unique doit donc fournir l’appui d’entrée.

Les deux autres destinations sont des presses commandées par deux boutons hors des buts. À la victoire, les trois héros sont sur leurs buts ; la caisse est immergée et n’est plus un poids ; le miroir est immobilisé par les murs de son socle. Les deux monstres vivants sont les seuls poids restants pour maintenir les deux commandes. La revue vérifie aussi qu’une immersion erronée de la caisse dans la cellule isolée `(12,11)` ne permet pas de récupérer un appui pour `(13,17)`.

Aucun historique de solution n’est imposé. Les graphes de marche figent les ressources et les circuits ; ils ne constituent pas une recherche exhaustive de toutes les actions conjointes. La comparaison des terrains détecte les copies exactes, y compris tournées ou déplacées, sans mesurer à elle seule la diversité des raisonnements. La réussite d’un témoin et l’emploi d’un pouvoir dans ce témoin ne prouvent pas que ce pouvoir serait obligatoire partout.

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

L’intégration native doit comparer les huit parcours à travers son adaptateur et le dispatcher, puis exécuter les tests du dépôt, `npm run test:sic-continuity`, le build et la revue navigateur. La publication du Site vient après sauvegarde GitHub et intégration sur `main`. Cette qualification couvre le laboratoire autonome ; elle ne revendique ni l’intégration native, ni la résolution autonome par SRA, ni la publication du Site.

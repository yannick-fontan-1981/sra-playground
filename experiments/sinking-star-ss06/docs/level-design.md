# Conception et validation des huit salles — HTML v5

Les niveaux 1 à 7 conservent le duo Marchand + Guerrier et leurs deux destinations à occuper ensemble. Le Marchand pousse une seule pièce ; le Guerrier pousse une file. Les deux peuvent activer les miroirs. Le changement de personnage ne fait pas avancer le monde. Le niveau 8 se joue avec le seul Guerrier rouge, une seule cible et aucun personnage caché.

| Niveau | Actions du témoin | Décision centrale |
|---|---:|---|
| 1 | 35 | Maintenir le circuit avec une caisse, déplacer le miroir par une presse distante et construire deux appuis avec la force du Guerrier. |
| 2 | 35 | Préparer les boutons croisés et faire partir les deux héros ensemble. |
| 3 | 119 | Construire puis réutiliser un interrupteur à distance pour franchir deux rideaux de polarités opposées. |
| 4 | 35 | Pousser une longue file et refléter les caisses de tête pour construire le ponton. |
| 5 | 43 | Ancien niveau 8 : préparer deux ateliers, actionner deux presses et réunir caisse et héros sur trois boutons. |
| 6 | 37 | Régler deux alignements de monstres puis construire le passage final avec deux caisses. |
| 7 | 68 | Construire un contournement pour pousser le miroir par son dos, puis utiliser la presse et le combat. |
| 8 | 61 | Verrouiller le circuit vert avec le second miroir de droite, puis alterner les plateformes violettes depuis les appuis verts. |

Les témoins prouvent la solvabilité. Ils ne sont pas annoncés minimaux ; leur longueur ne mesure pas directement la difficulté. Les niveaux 1 à 7 sont inchangés par rapport à l’HTML v4.

## Nouveau niveau 8 : Le verrou vert

Le niveau adapte le principe de Heroes and Mirrors 20 (`mirror_clocks`) avec un Guerrier, une cible, deux caisses et trois miroirs, dont deux dans la salle de droite. La traversée comporte sept portes-plateformes : quatre vertes servant d’appuis stables et trois violettes de polarités alternées. Il n’y a aucune porte-presse, aucun dédoublement ni délai imposé au premier reflet.

Le miroir de gauche pilote la caisse violette. Le Guerrier commence par remonter ce miroir d’une case pour aligner la caisse et le bouton. Dans la salle de droite, il pousse la seconde caisse dans le rayon du miroir principal. Le premier reflet active alors les deux circuits.

La préparation décisive intervient **après ce premier reflet** : le Guerrier pousse le second miroir de droite devant le rayon de retour de la caisse verte. La caisse reste ainsi sur son bouton pendant les reflets suivants, tandis que la caisse violette continue son va-et-vient. Il s’agit de la règle générale « un autre miroir arrête le rayon » ; le moteur ne contient aucune exception propre à cette salle.

Les coordonnées suivantes sont celles de la carte source, avant centrage dans la grille logique :

| Élément | Position et rôle |
|---|---|
| Miroir gauche NE | Départ `(4,7)`, poussé vers `(4,6)` pour aligner le violet. |
| Miroir principal droit NE | `(12,7)`, avec murs à l’ouest et au sud ; ces murs empêchent d’accéder aux positions nécessaires pour le pousser hors de son axe. |
| Second miroir droit SE | Départ `(15,4)`, poussé vers `(12,4)` après le premier reflet pour couper le rayon nord du miroir principal. |
| Bouton vert | `(12,2)`, maintenu par la caisse isolée du rayon. |
| Bouton violet | `(4,2)`, occupé puis libéré à chaque reflet utile. |
| Traversée | Ligne `y=13` : plateformes vertes en `x=4,6,8,10`, violettes en `x=5,7,9`. |

Les trois reflets du témoin produisent :

| Reflet | Action du témoin | Vert | Violet | Conséquence |
|---|---:|---|---|---|
| 1 | 18 | Actif | Actif | Les deux caisses atteignent leurs boutons ; le bloqueur peut ensuite être placé. |
| 2 | 53 | Actif | Inactif | Le Guerrier reste sur un appui vert et ouvre le passage violet central. |
| 3 | 56 | Actif | Actif | Le dernier passage violet apparaît ; le Guerrier rejoint la cible. |

Le témoin se termine à l’action 61 sans refus ni mort et n’utilise aucune sélection. Le vert suit donc `1 → 1 → 1`, le violet `1 → 0 → 1`. Le héros n’est pas téléporté dans ce parcours : les reflets commandent les caisses à distance.

### Portée des vérifications

Le témoin complet établit la solvabilité de cette carte avec les règles SS06. La revue indépendante est conservée dans `reference/level8-clock-review.json`. Le contrefactuel retire le miroir bloqueur de l’état atteint après l’action 52, puis active le deuxième reflet : le vert se désactive et le Guerrier tombe lorsque son appui se rétracte. Ce résultat vérifie l’effet du verrou dans cet état précis. Il ne prouve pas que toutes les stratégies alternatives sont impossibles. Aucune preuve globale d’unicité de solution, de nécessité de chaque objet ou d’absence de raccourci n’est revendiquée pour L8.

Les constats de la précédente carte « Les deux horloges » ne sont pas transposables à cette nouvelle géométrie. En particulier, les nombres de plateformes, les délais de bascule, les déplacements de miroirs par presse et les trajets des deux héros de l’HTML v4 ne décrivent plus L8.

## Tutoriel et nécessité

Le niveau 1 conserve ses huit acquis mesurés depuis les pixels : marcher, sélectionner, pousser avec chaque rôle, créer un appui, refléter, changer une porte et atteindre les deux cibles. Les explorations exhaustives établissent que la poussée en file, la presse, les appuis, le reflet et chacune des quatre caisses sont nécessaires dans cette carte. La revue par immobilisation de chaque caisse et le contre-exemple de la première version restent dans `reference/level1-independent-review.json`.

Les autres vérifications exhaustives conservées concernent le déplacement du miroir et la sélection dans L2, puis les appuis et la poussée en file dans L7. Le script `validate-levels.mjs --mechanisms` recalcule ces recherches et les suppressions des quatre caisses de L1. Les recherches limitées ne constituent pas des preuves d’impossibilité.

## Couverture effective

Les huit parcours totalisent **433 actions, 17 sélections et 1 338 images** : 22 poussées en file, 37 mouvements de miroir, 29 activations de reflet, 15 appuis immergés permanents créés, 5 poussées de presse et 8 monstres éliminés. Le niveau 8 contient sept plateformes hydrauliques contrôlées par deux circuits et aucune porte-presse ; son témoin utilise 61 actions et 192 images.

Les **55 tests du moteur** couvrent notamment les polarités et circuits AND, le retrait d’un support, la transformation d’une caisse en appui, l’activation simultanée d’un pont d’arrivée, les cascades et Undo. Les quatre tests ajoutés pour v5 couvrent le contrat solo explicite, la poussée de file et la victoire du seul Guerrier, la sélection sans tour ni historique, ainsi que la progression duo → solo et son annulation. Les empreintes complètes d’observations des huit anciennes cartes sont identiques sous le nouveau moteur, ce qui vérifie la conservation des comportements duo.

Les **15 contrôles de l’HTML** vérifient les pixels, durées, transitions et routes de défaite. Les terminaux apparaissent après la dernière image et Undo interrompt correctement l’animation. La validation visuelle exécutable est réalisée sous Happy DOM avec un buffer canvas. Le navigateur Chromium natif de cet exécuteur n’a pas pu démarrer ; aucun essai navigateur natif n’est revendiqué.

## Historique de la réorganisation

En v4, l’ancien niveau 8 est devenu le niveau 5 : seul son identifiant ordinal a changé, avec l’image de transition automatique propre à sa nouvelle place. L’ancien niveau 5 a été retiré de la campagne ; sa dernière carte et les vérifications v3 sont conservées dans `reference/history/`.

La révision v5 remplace uniquement le niveau 8. Les niveaux 1 à 7, leurs règles et leurs témoins restent inchangés. Le nouveau mode solo est explicite dans la spécification de L8 ; le mode duo reste la valeur par défaut du moteur.

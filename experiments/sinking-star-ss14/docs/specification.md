# SS14 — Contrat 0.1.1

## Identité et observation

Code **SS14**, titre **La Traction Harmonique**. Deux héros : `thief`, Voleur vert, palette **14** ; `bard`, Barde magenta, palette **6**. Le Voleur commence sélectionné. Les deux destinations doivent être occupées simultanément, dans n’importe quel ordre.

Ce duo et ce titre prolongent la feuille de route de la série conservée dans l’historique Git : `experiments/sinking-star/docs/roadmap.md`, commit `31d21ce532006f64f45c4b66119d56ca635b2d9c`. L’ancien document n’est pas rétabli dans le projet courant.

Les cartes rectangulaires de 20 × 20 cases au maximum sont centrées dans une image de 64 × 64. Chaque cellule occupe 3 × 3 pixels à partir de (2,2). La palette contient seize couleurs. L’observation publique comprend l’image, les images d’animation et leurs durées, les actions disponibles, les contrôles d’annulation/sélection et la progression. Aucun état sémantique privé, plan de miroir, chemin d’auteur ou résultat de recherche n’est exposé.

## Actions

| Action | Effet |
| --- | --- |
| ACTION1 | Pas vers le nord. |
| ACTION2 | Pas vers le sud. |
| ACTION3 | Pas vers l’ouest. |
| ACTION4 | Pas vers l’est. |
| ACTION5 | Activation simultanée des miroirs. |
| ACTION6 | Sélection d’un héros aux coordonnées pixel entières 0–63 ; aucun tour du monde. |

### Voleur

Le Voleur avance vers une case libre et soutenue. Un occupant adjacent exactement derrière lui entre dans la case qu’il quitte : caisse, miroir, monstre ou Barde. Il tire **un seul occupant**, jamais une file entière. Il ne pousse pas un occupant placé devant lui. Un pas perpendiculaire à la traction précédente laisse la prise en place.

Un miroir tracté conserve son orientation. Un appui immergé n’est plus une caisse et ne peut pas être tiré. Un Barde tiré ne chante pas. Les arrivées volontaires doivent préserver les deux héros et les miroirs : une arrivée sans appui refuse l’action entière.

### Barde

Avant chaque pas volontaire, les caisses, monstres, appuis et Voleur situés à deux cases au plus horizontalement **et** verticalement tentent le même déplacement. La portée est un carré **5 × 5** incluant ses diagonales. Les murs ne coupent pas la portée. Les miroirs n’appartiennent jamais au groupe.

Les dépendances sont résolues ensemble. Un membre bloqué par un mur, une porte ou un occupant immobile reste sur place et peut retenir les membres derrière lui. Le Barde doit pouvoir avancer ; sinon toute l’action est refusée. Si le résultat ferait perdre un héros ou le support d’un miroir, le pas volontaire est également refusé : un héros entraîné vers une eau sans appui ne reste pas automatiquement à sa place.

Le Voleur déplacé par le chant n’exécute aucune traction. Le Barde tiré, reflété ou déplacé par une presse ne chante pas. Les pouvoirs s’appliquent uniquement au déplacement volontaire du héros sélectionné.

### Appuis et eau

Une caisse envoyée dans une eau sans appui devient un support marron marqué d’un X cyan. Les héros peuvent marcher dessus. Une autre caisse peut rester mobile sur un support déjà présent.

Le chant peut déplacer un appui d’une case d’eau vers une autre. Il ne le fait pas remonter sur le sol. Un appui sous l’un des héros, ou celui sur lequel le Barde va poser le pied, reste **ancré pendant ce pas**. Un support sous un miroir n’est pas un ancrage de héros : le chant qui le retirerait sans soutien de remplacement est refusé.

Les plateformes hydrauliques déployées soutiennent les acteurs. Leur retrait révèle à nouveau l’eau. Les supports créés par immersion persistent lors de la réactivation d’une plateforme ; ils restent déplaçables par le chant.

### Miroirs

Les faces blanches relient deux axes orthogonaux. Le candidat le plus proche passe à la même distance sur l’autre axe. À distance égale, les deux candidats échangent leur position. La priorité est déterminée avant de vérifier les arrivées. Les héros, caisses et monstres sont des candidats ; les appuis immergés ne le sont pas.

Les murs, portes fermées et miroirs bloquent les axes. ACTION5 traite tous les miroirs ensemble ; les conflits sont refusés. Le dos noir des miroirs responsables clignote en rouge, tandis que leur diagonale reste blanche. Les marques gris clair montrent les arrivées prévues : plus pour un héros, contour carré pour une caisse.

Le reflet ne déclenche ni chant ni traction. Il peut ainsi éloigner un héros d’un poids sans déplacer celui-ci.

## Commandes, presses et combat

Tous les boutons d’un circuit doivent être occupés. Héros, caisse, monstre, miroir ou porte fermée peuvent fournir un poids. Chaque porte/presse déclare si elle se ferme à l’appui ou au relâchement de sa commande. À la fermeture, elle pousse les occupants dans la direction indiquée. Une file bloquée peut provoquer l’écrasement de l’occupant sur la presse.

Un bouton libre occupe une cellule opaque : fond gris 3, plus rose 7, centre de la couleur du circuit. Lorsqu’une presse ouverte partage sa case, le bouton reste seul visible ; la presse fermée le recouvre. Une presse sans bouton conserve ses marques directionnelles et un centre noir 5 à la fermeture, gris 3 à l’ouverture. Les occupants et les aperçus de reflet gardent leur priorité d’affichage habituelle.

Les circuits et plateformes se stabilisent avant la résolution des arrivées forcées dans l’eau. Une arrivée volontaire sur une plateforme actuellement inactive reste interdite. Quitter une commande peut retirer une plateforme sous le partenaire : cette conséquence est dangereuse et annulable.

Après une action effective, les monstres frappent simultanément leurs voisins orthogonaux, y compris les autres monstres. Les diagonales ne constituent pas un contact. Un monstre tué dans la même vague frappe encore. Un monstre immergé sans appui disparaît. Une sélection ou une action refusée ne déclenche ni combat ni évolution des circuits.

## Animation, interruption et progression

Marche, traction, chant, reflet, déplacement par presse et changement de plateforme utilisent trois images d’avancement. Le combat utilise cinq images : préparation, avancée, impact, désagrégation, résultat. Les cascades conservent leur ordre et leurs durées. Les changements de porte sans déplacement utilisent une image.

Les commandes ordinaires attendent la fin de l’animation. Annuler, Recommencer, Repartir et changer de salle interrompent les images restantes. Annuler restaure toute l’action, y compris la progression entre les salles. Les panneaux de défaite et **VICTORY** attendent la dernière image. La préférence système de réduction des animations est respectée.

## Tutoriel : dix-sept découvertes

1. Sélectionner un héros.
2. Marcher avec le héros sélectionné.
3. Tirer un occupant adjacent.
4. Tirer le Barde sans chant.
5. Relâcher une prise par un départ perpendiculaire.
6. Entraîner une pièce par le chant.
7. Entraîner le Voleur sans traction.
8. Déplacer un groupe de façon sélective grâce aux obstacles.
9. Immerger une caisse pour créer un appui.
10. Faire glisser un appui dans l’eau.
11. Conserver un appui ancré sous un héros.
12. Tracter un miroir sans le faire tourner.
13. Utiliser un reflet.
14. Actionner un circuit.
15. Observer une presse déplacer un occupant.
16. Éliminer des monstres.
17. Occuper les deux destinations.

`src/tutorial.ts` détecte ces découvertes depuis les pixels publics et les compteurs de la session. La route de référence du premier atelier les démontre toutes, sans devenir une route imposée. Annuler conserve l’apprentissage ; recommencer le remet à zéro. Les autres salles conservent les aides de règles et les crédits de leurs références.

## Portée des adaptations

Les contraintes provenant de North et Crossovers sont réagencées pour ce contrat. Le chant en ligne du jeu original, les piles, les déplacements doubles, le Druide, le Clerc, les dragons et la duplication par miroirs n’appartiennent pas à SS14. `docs/source-audit.md` et les références de chaque salle expliquent les reprises et les différences.

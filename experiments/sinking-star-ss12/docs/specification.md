# SS12 — Contrat 0.1.0

## Identité et observation

Code **SS12**, titre **La Colonne en Marche**. Deux héros : `warrior` rouge, palette 8 ; `bard` magenta, palette 6. Deux destinations à occuper simultanément, dans n’importe quel ordre. Le Guerrier commence sélectionné.

Cartes rectangulaires de 20 × 20 cases au maximum, centrées dans une image de 64 × 64. Chaque cellule occupe 3 × 3 pixels, origine (2,2), seize couleurs. L’image publique, les images d’animation, leurs durées, les actions disponibles et les compteurs forment le contrat d’observation. Aucun état sémantique privé, route de solution ou résultat de solveur n’est exposé.

## Actions et capacités

| Action | Effet |
| --- | --- |
| ACTION1–4 | Nord, sud, ouest, est selon le héros sélectionné. |
| ACTION5 | Activation simultanée des miroirs. |
| ACTION6 | Sélection d’un héros aux coordonnées pixel entières 0–63. Aucun tour du monde. |

### Guerrier

Un pas libre fait marcher le Guerrier. Devant une file contiguë de caisses, miroirs, monstres ou Barde, il pousse toute la file d’une case. Une arrivée bloquée ou sans appui pour un héros/miroir refuse la poussée complète. Une caisse envoyée dans l’eau devient un appui ; une caisse peut rester mobile sur un appui déjà présent.

### Barde

Chaque pas volontaire fait tenter le même déplacement aux caisses, monstres, appuis et Guerrier situés à deux cases au plus horizontalement et verticalement avant le pas. La portée est donc un carré 5 × 5 incluant ses diagonales. Les murs ne coupent pas la portée. Les miroirs ne chantent pas.

Les dépendances sont résolues ensemble : un membre bloqué reste sur place et peut retenir ceux qui arrivent sur lui. Le Barde doit pouvoir avancer ; sinon toute l’action est refusée. Le Guerrier entraîné ne déclenche pas une autre poussée. Le Barde poussé par le Guerrier, déplacé par une presse ou reflété ne déclenche pas un nouveau chant.

Un appui immergé peut glisser vers une autre case d’eau mais ne remonte pas sur le sol. L’appui sous un héros et celui sur lequel le Barde va marcher sont ancrés pendant ce pas. Les arrivées volontaires des héros et miroirs sont vérifiées avec leurs appuis courants, y compris sur une cellule hydraulique inactive.

### Miroirs

La face blanche relie deux axes orthogonaux. Le candidat le plus proche passe à la même distance sur l’autre axe ; deux candidats à distance égale échangent leur place. Le candidat prioritaire est choisi avant de vérifier la destination de l’autre. Un héros, une caisse ou un monstre peut être reflété ; un appui immergé ne le peut pas.

Les murs, portes fermées et miroirs bloquent les axes. Les reflets incompatibles sont refusés. Le dos noir des miroirs responsables clignote en rouge, la diagonale restant blanche. Le Guerrier peut déplacer un miroir sans en changer l’orientation.

## Eau, commandes et monstres

Les caisses immergées deviennent des appuis marron à X cyan. Les plateformes hydrauliques déployées soutiennent héros et objets ; leur retrait laisse de nouveau l’eau. Les appuis permanents sont conservés lorsque les plateformes se réactivent.

Tous les boutons d’un circuit doivent être occupés. Personnage, caisse, monstre ou miroir peuvent servir de poids. Une porte/presse peut se fermer à l’appui ou au relâchement, selon la déclaration du circuit. À la fermeture elle pousse dans la direction indiquée. Une file bloquée peut être écrasée. Les arrivées forcées sont résolues après stabilisation hydraulique. Quitter une commande peut retirer une plateforme jusque-là active sous un partenaire : cette conséquence reste dangereuse et annulable.

Après une action effective, les monstres frappent simultanément leurs voisins orthogonaux, y compris les autres monstres. Les diagonales ne sont pas des contacts. Un monstre qui meurt dans la vague frappe encore pendant cette vague. La sélection d’un héros ne déclenche ni combat ni circuits. Une action refusée ne fait pas avancer le monde.

## Animation et contrôles

Déplacements, poussées, chants et reflets : trois images d’avancement. Combat : préparation, avancée, impact, désagrégation, résultat. Les cascades conservent leur ordre et leurs durées. Aucun aperçu de poussée ; les arrivées par miroir restent visibles en gris clair, plus pour un héros et contour carré pour une caisse.

Les commandes ordinaires attendent la fin de l’animation. Annuler, Recommencer, Repartir et le changement de salle interrompent les images restantes. Les panneaux de défaite et **VICTORY** n’apparaissent qu’après l’animation finale. La préférence système de réduction des animations est respectée.

## Tutoriel

Niveau 1, **La répétition des deux rives**, treize découvertes : sélection, marche, poussée d’une file, chant d’une pièce, partenaire entraîné, mouvement sélectif, Barde forcé sans chant, caisse immergée, appui glissant, miroir déplacé, reflet, circuit, deux destinations.

`src/tutorial.ts` détecte les découvertes et les retours d’action uniquement à partir des pixels publics et des compteurs de la session. Le parcours d’auteur illustre toutes les découvertes, mais aucune séquence n’est imposée au joueur. Annuler conserve l’apprentissage ; recommencer le remet à zéro.

## Limites des adaptations

Les contraintes des sources North/Crossovers sont réagencées pour ces règles. Le chant en ligne du jeu original, les piles et déplacements doubles, le Druide, le Clerc, les dragons et la duplication par miroirs ne font pas partie du contrat SS12. Leur absence ne doit pas être interprétée comme une règle du jeu commercial.

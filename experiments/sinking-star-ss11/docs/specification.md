# SS11 — Contrat 0.1.2

## Duo et actions

Deux héros : `warrior` (rouge,8), puis `wizard` (violet,15). Les cartes utilisent `W` et `Z`. Deux destinations doivent être occupées simultanément. Le Guerrier commence sélectionné.

ACTION1–4 indiquent nord, sud, ouest, est. Le Guerrier pousse toute la file consécutive. Le Magicien échange sa place avec la première caisse, créature ou autre héros dans cette direction. Les faces blanches dévient sa visée ; les dos noirs la bloquent. Sans cible il marche. Déplacer le Magicien de force ne déclenche aucun sort.

ACTION5, Espace/X, active les reflets géométriques. Un candidat plus proche est choisi avant la validation de sa destination ; le refus d’une cible lointaine ne l’annule pas. À distance égale les occupants échangent leurs places. Les conflits réels entre miroirs refusent l’action.

ACTION6 sélectionne aux coordonnées pixel entières0–63. La sélection ne fait avancer ni combat ni circuits. Tab/1/2 et les boutons héros utilisent cette action.

## Terrain et circuits

Sol gris, murs gris foncé, eau bleue. Caisses marron; appuis immergés marron/Xcyan, fixes et conservés lors de la réactivation des plateformes. Boutons en plus rose avec accent de circuit, portes en carré rose. Tous les boutons d’un circuit doivent être occupés.

Les presses poussent à leur fermeture. Une chaîne bloquée peut être écrasée selon les règles de la série. La résolution de l’eau attend la stabilisation des dispositifs hydrauliques. Les monstres noirs/Xrouge frappent simultanément leurs voisins orthogonaux, y compris d’autres monstres. Les miroirs passent au-dessus des boutons.

## Affichage et animation

Image64×64, grille20×20, cellules3×3, origine(2,2), palette16couleurs, agrandissement sans lissage. Aucun aperçu de poussée. L’arrivée d’un héros reflété est un plus gris clair, celle d’une caisse un contour carré gris clair.

Poussée en trois images. Transposition avec parcours du rayon. Une boucle de visée montre le trajet puis fait clignoter le Magicien sur place. Un reflet impossible fait clignoter le dos noir des miroirs responsables en rouge; leur diagonale reste blanche. Combat avec anticipation, frappe et disparition.

Les actions ordinaires attendent la fin de l’animation. Undo/Reset/Restart/changement de niveau interrompent la séquence. Les écrans terminaux attendent la dernière image. La préférence de réduction des animations est respectée.

## Pédagogie et interface publique

La session commence au niveau 1, **La relève du gardien**. Le tutoriel **La cour aux deux sorties** occupe le niveau 7.

Douze leçons au niveau 7 : marche, sélection, poussée simple, chaîne, échange d’objet, échange entre héros, rayon dévié, miroir déplacé, appui construit, reflet, circuit et destinations. Elles sont détectées uniquement dans les pixels publics.

Le bundle contient seulement `core`, `levels`, `level-info`, `tutorial`, `browser`. Il expose les observations, frames/durées, actions disponibles, compteurs et états terminaux. Aucun solveur, parcours d’auteur ni état sémantique privé n’y est inclus.

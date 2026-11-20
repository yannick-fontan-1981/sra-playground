# SS10 — Règles du duo Guerrier / Voleur

Version 0.3.0. Huit salles, deux héros et deux destinations par salle. La grille logique
utilise au maximum 20 × 20 cellules de 3 × 3 pixels, centrées dans une image de 64 × 64.
La palette à seize couleurs est celle de la série Sinking Star.

## Personnages et commandes

- Guerrier rouge (indice 8) : une direction déplace le héros et toute la file consécutive
  devant lui. Si la dernière case bloque la file, toute la poussée est refusée.
- Voleur vert (indice 14) : une direction vers une case libre tire seulement l’occupant
  adjacent derrière le héros. Un pas de côté laisse cette pièce en place. Il ne pousse
  pas et ne tire pas une chaîne.
- Le déplacement forcé d’un héros par poussée, presse ou reflet n’active pas sa capacité.
- Flèches : déplacement et capacité directionnelle. Espace / X : réflexion globale.
- Clic sur un héros, Tab dans la grille, touches 1 / 2 ou boutons : sélection. Elle
  correspond à ACTION6 avec des coordonnées de pixels et ne fait pas avancer le monde.
- Z / Annuler : annule une action et toute sa cascade, y compris une victoire ou défaite.
  R restaure la salle ; Retour au tutoriel recommence la campagne.

## Objets et milieux

Une caisse mobile est marron à centre noir. Dans l’eau bleue, elle devient un appui fixe,
marron marqué d’un X cyan. Un appui n’est plus un objet à pousser ou tirer. Un personnage
ne marche pas volontairement dans l’eau nue ; une réflexion ou une presse peut le noyer.
Les miroirs et monstres qui tombent dans l’eau disparaissent.

Les boutons en + rose réagissent aux héros, caisses, monstres ou miroirs. Une porte
ordinaire s’ouvre tant que tous ses boutons sont occupés. Les circuits colorés associent
des boutons à des portes-presses et à des plateformes dans l’eau. Plusieurs boutons d’un
même circuit doivent être occupés ensemble.

Une porte-presse pousse dans la direction de son repère lorsqu’elle se ferme. Elle peut
déplacer une file ou écraser son premier occupant si cette file est bloquée. Une plateforme
hydraulique déployée soutient les occupants ; son retrait fait tomber ce qui n’a pas d’autre
appui. Contrairement à la référence Heroes and Water 6, redéployer une plateforme ne détruit
pas un appui permanent déjà créé : SS10 conserve cette règle de la série SS.

## Miroirs

Le miroir est une diagonale blanche avec un dos noir. Sa face ouvre deux axes. Sur chaque
axe, seul le premier occupant est candidat. Le candidat le plus proche est reflété ; à
distance égale, les deux candidats échangent leurs places. Une arrivée bloquée pour un
candidat plus éloigné ne bloque pas le plus proche.

Espace active tous les miroirs simultanément. Les trajectoires et arrivées doivent être
compatibles. Le reflet d’un héros est annoncé par un + gris clair et celui d’une caisse
par un contour carré gris clair. Il n’y a pas de prévisualisation de poussée.
Le socle noir d'un miroir qui empêche une réflexion clignote deux fois en rouge,
en conservant sa diagonale blanche ; ce signal peut être
rejoué sans consommer de tour ni créer d’entrée Annuler.
Les miroirs restent visibles au-dessus des boutons et repères.

## Monstres et victoire

Après une action réussie, les monstres attaquent leurs voisins orthogonaux. Deux monstres
adjacents s’éliminent mutuellement et attaquent encore les héros voisins pendant cette
même action. La diagonale ne constitue pas un contact. Ils peuvent être déplacés par
les mécanismes du puzzle.

Les deux contours jaunes doivent être occupés simultanément par les deux héros.
Un héros arrivé reste dans la salle et reste sélectionnable.

## Animation et contrat public

Les déplacements, poussées, tractions et reflets utilisent trois images ; les déplacements
ordinaires avancent de 1, 2 puis 3 pixels. Le combat comporte cinq phases visuelles.
Les cascades sont concaténées, avec une durée explicite par image et une dernière durée
nulle. Annuler, Recommencer et le changement de niveau interrompent l’animation précédente.
La préférence de réduction des animations est respectée.

Le runtime autonome utilise ACTION1–ACTION6 et expose uniquement les images et les
métadonnées publiques de progression. Les solveurs, états d’auteur, témoins, ablations
et étapes détaillées sont exclus du HTML jouable. La sélection pédagogique et le suivi
des découvertes dans l’interface se fondent sur les images publiques.


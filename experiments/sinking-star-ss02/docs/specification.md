# SS02 — spécification 0.4.0

## Présentation

Image 64×64, plateau logique 20×20, origine (2,2), cellule 3×3 pixels. Les cartes
plus petites sont centrées sans mise à l'échelle. Palette commune : Guerrier rouge
8, sol gris 3, mur gris foncé 4, eau bleue 9, pierre marron 13, support immergé
marron avec X cyan 10, bouton + rose 7, porte carrée rose 7, destination contour
jaune 11, direction blanche 0. Aucune prévisualisation de poussée n’est affichée.

## Règles

ACTION1–4 : déplacement d'une cellule dans la direction choisie. Une flèche vers
une pierre pousse directement toute sa file contiguë d'une cellule ; le Guerrier
prend la place de la première pierre. Un obstacle arrête la marche, mais pas le
changement d'orientation. Une extrémité bloquée annule toute la poussée.
Il n'existe aucune commande de poussée séparée et Espace ne déclenche aucune
action. La poussée de files est nécessaire pour conserver la carte heroes1_2_v2.
Il n'y a ni traction, ni téléportation, ni monstres dans SS02.

La dernière pierre d'une file poussée dans de l'eau non comblée devient un support
immobile. Elle est praticable mais n'est plus poussable. Une pierre mobile peut
être poussée sur ce support sans couler à nouveau.

Toutes les portes roses s'ouvrent si tous les boutons sont simultanément occupés
par une pierre ou le Guerrier. La fermeture sur une entité est interdite : la
transition correspondante est rejetée atomiquement, sans écrasement ni perte.
Le Guerrier doit atteindre la destination ; les pierres ne gagnent pas à sa place.

## Tutoriel initial

Un seul niveau combine les notions : 44 cellules initialement accessibles à pied,
une file de deux pierres à dégager, une traversée d'eau, trois pierres au total,
deux boutons et une porte. Une pierre doit servir de pont ; les deux autres
restent nécessaires aux deux boutons. L'aide est ouverte par défaut et montre
les apprentissages constatés dans les pixels publics. Elle ne bloque aucune
commande et n'exécute aucune solution à la place du joueur.

## Observation et animation

Le moteur renvoie uniquement les images et les métadonnées publiques : code,
état, actions disponibles, progression, navigation et palette. Les données de
carte, états internes, solveur et parcours témoins ne sont jamais ajoutés à
l'observation fournie à un agent.

Le plateau stable ne montre que l'état courant, sans contours de destination
ni indication anticipée des poussées possibles. Après une poussée réussie, les
pierres et le Guerrier avancent de 1, puis 2, puis 3 pixels dans la direction
choisie : une cellule de 3×3 pixels est parcourue en trois images. Les sprites
gardent leurs couleurs, sans clignotement. Les délais sont de 60 et 80 ms avant
l'image stable finale ; une pierre coulée devient un support avec X cyan sur
cette dernière image. Les images intermédiaires n'ajoutent aucun tour logique.

Undo restaure aussi les chaînes, supports immergés, portes et changements de
niveau. Undo, Reset, Restart et changement manuel de niveau invalident une
animation en cours, empêchant un ancien callback de repeindre l'ancien état.

## Compatibilité Playground

Le contrat `Observation` est structurellement compatible avec `GameObservation`.
Le raccordement prévu est un backend natif SS02 indépendant du solveur, puis
l'enregistrement après SS01 dans Custom 4 et l'ajout de huit aperçus à la galerie.
Cette livraison reste autonome : aucun changement du SIC ou du Logos Engine.

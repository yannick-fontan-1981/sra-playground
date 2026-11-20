# Chercher une capacité depuis une limite spatiale, série v18

## Hypothèse et origine

Dans les traces des 100 jeux sources, un déplacement peut changer ce qu'une autre commande rend accessible. Pour qu'une expérience démarre avant le premier franchissement, SIC doit pouvoir choisir une destination que ses déplacements connus ne relient pas à sa position actuelle. La nouvelle hypothèse prend la forme « si je place ce repère ici, cette commande pourrait me faire entrer dans cette région ». La position de départ, la région voulue et les éléments susceptibles de réfuter l'hypothèse sont déterminés sur les observations publiques de la partie.

Deux observations sources motivent des choix distincts.

- Sur PORT L1, une partie autonome a déclenché une expérience de contact depuis une limite déjà éprouvée. La commande de franchissement a amené le voyageur de (27, 15) à (43, 15) dans la zone désirée. Une autre commande a ensuite produit un déplacement prévu à l'intérieur. En omettant la préparation, le voyageur a terminé en (23, 11), hors de cette zone. Son point de départ au moment de la commande différait entre les deux branches.
- Sur 92 situations sélectionnées dans le corpus initial, un ajustement affine alimenté par des préparations successives a pu émettre 95 prévisions sur des positions de repère encore inédites. Il en a réussi 89. Dix anticipaient une position d'arrivée jamais vue dans la situation. Les dix viennent de VOIS. Une translation fondée sur la dernière mesure suffit à les expliquer. Sur les 18 niveaux supérieurs des sept jeux indiqués et huit niveaux complémentaires, les prévisions émises portaient toutes sur des réponses constantes. Les résultats détaillés sont dans [le relevé des réponses spatiales](sic-source-response-field.json).

## Décision native

1. Observer plusieurs positions d'un voyageur et les déplacements reproductibles des commandes. Estimer le support au sol à partir de pixels découverts lors des mouvements. Sur la grille de pas apprise, calculer les régions, la position initialement observée et les zones déjà visitées.
2. Proposer une zone inexplorée si une discontinuité du support la sépare du voyageur, ou si des commandes déjà essayées échouent sur la frontière d'une zone visuellement continue. Le modèle distingue le bord prédit du bord effectivement testé. Dans la première situation SIC peut commencer par essayer de marcher.
3. Énumérer des compositions dont la conséquence proposée est une entrée dans la région. SIC peut s'approcher d'un site, y agir, tenter de le déplacer, sélectionner puis déplacer une pièce, ou diriger un repère déjà mobile vers un point d'entrée, un bord accessible ou un alignement avec la destination. Les séquences de manipulation d'un repère indépendant utilisent des déplacements déjà observés pendant que le voyageur restait immobile. Le lien supposé entre cette disposition et un accès peut encore être entièrement inédit.
4. Choisir une composition, enregistrer les alternatives et la prédiction avant le geste. Vérifier les positions après chaque commande. Un déplacement imprévu invalide la suite prévue. Si une manipulation locale place réellement la pièce, SIC peut retourner à un bord précédemment bloqué pour y reproduire le même essai.
5. Une entrée réelle déclenche un essai d'utilisation dans la zone. Une arrivée observée avec un repère placé peut également fournir une relation spatiale à éprouver lors d'une autre configuration.

## Comparaison annoncée avant Custom 4

Témoin historique `sic-projected-affordances-source100-control-v1`, candidat `sic-projected-affordances-source100-candidate-v18`. Chaque export est obtenu du commit distant avec Git et vérifié fichier par fichier avant toute partie Custom 4 de la série. Le moteur et le budget de 1 200 commandes sont identiques. La victoire officielle sur SS01 L2 est le critère principal. SS01 a déjà servi lors des séries précédentes. SS09 L2 reste réservé.

Le vérificateur refait la partie, vérifie la prédiction scellée avant action, la continuité du programme et les mouvements sources. Il compte séparément les bords testés, les placements effectués, les entrées dans une région annoncée, les déplacements suivants à l'intérieur et la progression officielle. Lorsqu'un programme fait entrer le voyageur, le vérificateur peut rejouer la commande d'entrée avant la préparation. Il indique si le voyageur partait des mêmes coordonnées. Une seconde mesure indépendante du trajet complet recherche les franchissements géométriques en dehors du seul programme expérimental.

La comparaison sur les sources reprend les 100 niveaux initiaux à 60 commandes et 18 niveaux supérieurs à 120 commandes. Les parties des deux cohortes démarrent avec une mémoire neuve, après le préfixe d'entrée public lorsqu'un niveau source le nécessite.


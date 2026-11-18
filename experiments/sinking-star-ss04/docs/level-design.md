# Conception des huit niveaux SS04

Les huit salles utilisent le même Magicien et les mêmes quatre actions. Leur variété vient des contraintes de circulation, du rôle des objets et de l’ordre des opérations, plutôt que d’un agrandissement répété de la même salle.

## 1 — L’atelier des échanges

Tutoriel original, ouvert dès le chargement. Le joueur apprend à déposer une caisse sur une presse, à déclencher un appui dans l’eau, puis à traverser cet appui pour viser une caisse lointaine par un miroir. Le dernier échange laisse un poids sur le bouton de sortie. Les six leçons sont reconnues sur les pixels affichés. Les recherches exhaustives sans réflexion, sans presse ou sans création d’appui échouent : ces mécanismes sont réellement nécessaires au tutoriel.

## 2 — Le convoyeur des trois salles

Hauling 10, `heroes1_8_v2`. Une seule caisse doit être transportée à travers les passages décalés jusqu’au bouton du bas. Les murs empêchent de traiter le trajet comme une unique ligne ; il faut choisir les emplacements depuis lesquels relancer l’échange. Grille et parcours original conservés.

## 3 — L’échiquier des neuf blocs

Hauling 11, `heroes1_10_inv_v4_b`. Neuf blocs constituent un réseau de points d’arrivée. La première cible rencontrée coupe la visée, ce qui oblige à raisonner sur la bonne séquence d’échanges. Le témoin est court, mais la structure diffère du transport d’une seule caisse du niveau précédent.

## 4 — La galerie des sentinelles

Monsters 4, `heroes2_3_v2`. Un corridor serpente entre blocs et monstres. Les échanges permettent de franchir les files mais une arrivée ou une nouvelle position de monstre adjacente au Magicien est fatale. Le témoin source comporte cinq échanges avec des monstres, sans aucune perte.

## 5 — Le long détour des îlots

`a_wiz_out_of_water`. Une seule caisse fait office de point d’arrivée à travers de longues coupures d’eau. Le parcours nécessite de la déplacer entre des lignes de visée éloignées avant de la laisser sur la plaque commandant les quatre portes finales. Il ne faut pas confondre eau présente et création d’appui : ce niveau se résout par échanges, sans combler l’eau.

## 6 — Les deux relais

Adaptation de Heroes and Mirrors 30, `wizard_mirror_intro`. Les trois îlots et 55 cases de sol sont conservés ; trois blocs relais et une seconde plaque permettent de résoudre la salle avec des miroirs fixes et sans commande X. Les deux échanges réfléchis sont nécessaires : deux suppressions individuelles des miroirs produisent chacune une recherche exhaustive insoluble. Le second bouton oblige à organiser les poids avant l’échange vers l’îlot final.

## 7 — Les deux digues

Création originale : deux ailes hautes initialement vides, un atelier inférieur, une bande d’eau de 14 cases, trois caisses, un monstre et un miroir. Il faut construire les deux traversées avec des presses indépendantes, importer une caisse sur la plaque de l’aile ouest, puis utiliser le monstre comme poids supplémentaire avant de gagner l’aile est.

Les échanges ne créent pas de nouveaux emplacements occupés dans une aile initialement vide. L’accès à chaque aile nécessite donc un appui. Les deux appuis consomment deux des trois caisses ; les deux plaques de sortie, situées hors de la destination, requièrent ensuite la caisse restante et le monstre. Le miroir offre un échange réfléchi utile dans le témoin ; sa nécessité indépendante n’est pas affirmée. Les recherches supplémentaires ayant atteint leur limite sont conservées comme telles dans la référence.

## 8 — La citadelle des deux presses

Création originale de 19 × 17 cellules, avec quatre blocs, deux monstres, deux miroirs et quatre circuits. Le départ, la salle des machines et le parcours de sortie sont séparés par l’eau. Deux miroirs successifs permettent un échange entre les îlots.

La première presse pousse une file de deux caisses. La caisse de tête arrive sur un bouton qui déclenche la seconde presse, laquelle envoie un bloc dans l’eau pour créer le passage vers la sortie en zigzag. Dans le témoin, cette cascade se produit à l’action 11 : marche, poussée de la file, puis poussée vers l’eau, soit **sept images** de présentation pour une action. Un monstre protège l’accès direct au bouton de la seconde presse ; l’occuper avec le héros provoque une attaque.

Les deux poids du départ et la plaque éloignée de la salle des machines doivent être organisés pour ouvrir les deux portes finales. Les monstres sont à la fois des cibles d’échange et des contraintes de placement. Les deux miroirs sont nécessaires selon leurs suppressions individuelles exhaustives. Le témoin utilise les deux presses en cascade ; aucune preuve exhaustive indépendante de minimalité ou de nécessité de chaque presse n’est inventée.

## Méthode de validation

Les parcours sont rejoués dans le moteur final puis à travers le clavier de l’interface compilée. Les images intermédiaires, durées, états terminaux, transitions et progrès sont comparés. Les rapports incluent les empreintes des cartes, des témoins et des observations publiques.

Les propriétés annoncées nécessaires reposent soit sur une recherche exhaustive achevée, soit sur un argument explicite de géométrie et de ressources. Une limite d’exploration n’est jamais interprétée comme une impossibilité. Les longueurs des témoins ne sont pas des scores du SRA : aucun résultat autonome de l’agent n’est revendiqué pour cette livraison.

# SS01 · Une arrivée annoncée par SIC en campagne autonome

Le candidat v24 acquiert la relation entre la marque, le marchand actif et l’activation pendant sa propre campagne. La première annonce dont les trois éléments sont vérifiés se produit à la commande **485 du L1**. Le marchand passe de (6,9) à (9,6), l’autre reste en (6,11). Quatre activations en tout ont une prévision exacte du sujet et de la marque. Le moteur enregistre 28 transferts au total.

| Moment | Observation physique et décision de SIC |
|---|---|
| L1 historique, activation 210 | Depuis (6,9), l’activation envoie le marchand sur la marque en (9,6). Le marchand en (6,13) reste en place. Depuis le même état, les quatre directions aboutissent ailleurs. |
| L1 v24 autonome, commande 363 | Les 362 premières commandes coïncident avec v23. Une marque valide apparaît en (9,6). V24 ouvre une expérience, choisit le nord et mesure la bonne marque en suivant le mauvais sujet. V23 avait choisi un clic. |
| L1 v24, commande 483 | Première téléportation physique du marchand. La prévision à l’origine de cette commande ne satisfait pas le contrôle conjoint du sujet et de la marque. |
| L1 v24, commande 485 | Première réutilisation exacte du savoir morphologique. SIC choisit l’activation, nomme le bon marchand et annonce la bonne case avant la commande. |
| Fin du L1 autonome | 574 commandes, 58 occasions de transfert, 28 transferts et 32 cases visitées. Aucune des deux destinations jaunes n’a été occupée. Sur les 574 premières commandes des deux versions, v23 réalise zéro transfert et v24 en réalise 28. Le second contrôle v23 a exécuté 799 commandes au total. |
| L2 autonome avec mémoire vide | Les commandes 49 et 50 poussent le miroir vers la droite, de (8,3) à (10,3). En 658 commandes, SIC visite 18 cases et ne rencontre aucune marque valide pour le marchand actif. |
| L2 après démonstration du L1 et trois pas publics | La famille choisit d’abord l’activation, annonce (8,4) → (9,3) et la réalise. Livrée ensuite à ses choix, elle effectue 31 téléportations et parcourt huit cases du même îlot en 69 commandes, puis s’abstient. |
| L2 sur le parcours de référence | La règle isolée désigne 16 arrivées sur 16 à 15 emplacements différents, dont les deux traversées. Le trajet qui prépare ces lectures est fourni. |

La mécanique et les placements possibles ont été vérifiés ligne par ligne à partir du même moteur. Le premier îlot a quatre emplacements de miroir qui permettent de rejoindre le deuxième. Avec le miroir en (5,3) et le marchand en (10,3), l’activation atteint (5,8). Depuis le deuxième îlot, un miroir en (4,9) et un marchand en (4,14) donnent une arrivée en (9,9), à trois pas de la destination. [Carte et validation de chaque déduction](https://github.com/yannick-fontan-1981/sra-playground/blob/7eef7c3f0bc4fcf7a52532bc9e3b06cc7eef464d/docs/diagnostics/ss01-l2-v19/README.md)

## Comparaison figée

| Niveau en départ direct | Témoin, commandes | Candidat v24, commandes | Victoires officielles |
|---|---:|---:|---|
| SS01 L2 | 579 | 658 | 0 sur 2 |
| SS06 L2 | 751 | 617 | 0 sur 2 |
| SS07 L2 | 5 | 25 | 0 sur 2 |
| SS08 L2 | 791 | 853 | 0 sur 2 |

Le témoin d’origine et son rejeu ont été repris à l’identique. Les images d’entrée et les paramètres des deux versions coïncident. Les trois arrêts de SS01, SS06 et SS08 pour chaque version sont dus au temps actif, celui de SS07 à la fin de partie. Le nombre de commandes dépend aussi du coût de chaque décision. SS09 L2 reste en réserve. Les hypothèses ajoutées à v24 proviennent des traces sources. SS01 était connu de l’expérimentateur lors du gel. [Mesures et références des deux archives](./mesures.json)

Sur VOIS L1, 28 préparations choisies par SIC redirigent effectivement l’arrivée suivante vers une autre position, vérifiée par comparaison avec la commande directe et une préparation concurrente de même longueur. Aucune utilisation ultérieure n’est validée dans cette campagne. Sur SS01 L2, le mécanisme doit être déplacé pour faire apparaître une destination qui agrandit l’espace accessible. Ce changement de priorité n’est pas démontré par les 31 téléportations sur le premier îlot. [Expériences sources et protocole](../../architecture/sic-prepared-arrivals-source100.md)

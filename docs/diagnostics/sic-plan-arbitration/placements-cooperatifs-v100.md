# SS09 L2 gagné à froid en 54 actions autonomes

SIC v100 choisit les 54 commandes depuis l’image d’entrée du L2. Le moteur officiel crédite le niveau après quatre clics et cinquante commandes directionnelles, sans préparation au L1, remise à zéro ni recherche par restauration. Un vérificateur indépendant a rejoué les commandes et contrôlé les empreintes des images. SS09 a servi au diagnostic de cette capacité.

## Les quatre étapes dans la partie gagnante

| Étape | Décision ou observation vérifiable |
| --- | --- |
| Formuler la capacité à acquérir | Après la sélection et la vérification du second sujet, au coup 4, SIC observe également qu’une pièce se décale. La géométrie visible suggère une sortie coupée par une porte et deux repères à occuper. SIC pose comme hypothèse que deux pièces maintenues sur ces repères rendront le passage accessible aux deux sujets. |
| Comparer les préparations | Dès le coup 5, il distingue une poussée par contact et un entraînement à distance. Il apprend la portée à partir des déplacements observés, calibre les directions encore inconnues et simule les positions des deux sujets et des pièces. Sa recherche symbolique est bornée à 1 000 états. |
| Expérimenter et réviser | Au coup 38, les deux pièces arrivent sur leurs repères et la porte change d’aspect. Au coup 47, le déplacement désiré est barré par le sujet stationné. Le reçu annonce l’hypothèse `contact_can_displace_the_parked_subject`. La commande vers la droite fait avancer les deux sujets. |
| Réutiliser le résultat | Dès le coup 48, la poussée du partenaire figure dans les faits observés du reçu. SIC la réemploie pendant la traversée, tout en conservant les deux pièces sur les repères. Le moteur valide la dernière commande au coup 54. |

Le banc précédent avait trouvé une branche gagnante de 26 gestes en restaurant la partie pour comparer les suites. Les deux premiers clics de la partie autonome ont lieu aux coups 1 et 21. Les deux suivants ont lieu aux coups 31 et 33. La politique reçoit les observations publiques après chaque commande et peut recalculer son plan.

## La décision que change le pack

L’auteur déclare si le planificateur peut tester sur le partenaire l’effet de contact d’abord proposé pour une pièce. Les couleurs, la portée, les cibles du clic, les emplacements à occuper et la commande restent à inférer dans la partie. Deux réglages du même binaire v100 disposent chacun d’un plafond de **70 commandes** dans la comparaison courte.

| Réglage | Première divergence | Score autonome à froid |
| --- | --- | --- |
| `maintain_access_by_composing_piece_effects` | Même trajectoire jusqu’au coup 46. Au coup 47, l’exploration générale joue vers le haut. | Échec au plafond de 70 commandes. Le candidat v99 séparément figé échoue également au budget complet de temps actif en 264 commandes. |
| `test_contact_on_another_subject` | Devant la même image, le plan propose la poussée vers la droite. Le retour correspond aux deux positions prédites. Le reçu du coup suivant ajoute une référence au déplacement observé. | Victoire en 54 commandes, reproduite au budget complet et au plafond de 70. |

La portée reste une hypothèse révisable sur les configurations encore inconnues. La découverte vérifiée est que SIC a appris un effet à distance dans sa propre partie et l’a composé avec le maintien de l’ouverture et une poussée de partenaire. La topologie reconnue par ce candidat comprend deux sujets, deux pièces, deux repères et une porte. Les configurations ayant d’autres cardinalités demandent une qualification séparée.

Le contrôle physique indépendant confirme 28 des 29 prédictions de position qu’il peut tester. Le coup 17 est réfuté et SIC poursuit l’apprentissage. Après le coup 47, le retrait expérimental des sept commandes prévues entraîne un nouveau calcul qui gagne en sept coups. Les 100 trajectoires sources au plafond de 60 actions sont identiques à v98. Les huit victoires Custom 4 précédentes sont conservées, ainsi que CWSE L2 en 59 coups et KLOT L4 en 37.

[Mesures et empreintes des parties](mesures-placements-cooperatifs-v100.json) · [Expériences comparées sur SS09](selection-et-pose-ss09-v98.md)

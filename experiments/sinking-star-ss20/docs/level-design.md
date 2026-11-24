# SS20 — conception des huit salles

**Le Relais des Îles, 0.1.0**, réunit le Marchand orange, le Voleur vert et le Barde magenta. Chaque salle compose un problème différent à partir des mêmes gestes déterministes. Les pouvoirs ne se déclenchent que lorsque leur personnage agit volontairement ; les monstres attendent un transport physique visible.

Les cartes, parcours, étapes et crédits détaillés se trouvent dans `reference/levelN-design.json`. Les guides numérotés sont reliés dans [l’audit des sources](source-audit.md). Les comptes suivants incluent les sélections et décrivent les témoins d’auteur, sans revendication d’optimalité.

| Niveau | Géométrie et contrainte | Entrées | Sélections | Hors sélection |
| --- | --- | ---: | ---: | ---: |
| 1 · L’atelier des marées | Trois cours décalées et un balcon final ; démonstrations puis synthèse | 256 | 37 | 219 |
| 2 · Le chargement à rebours | Route extérieure asymétrique et jardin intérieur ; accès de manutention | 223 | 24 | 199 |
| 3 · Le poids qui reste | Îlots optiques isolés et passerelles de polarités opposées | 85 | 5 | 80 |
| 4 · Les quais en décalage | Deux quais séparés, escale centrale et réception à préparer | 102 | 16 | 86 |
| 5 · Le pas qui manque | Rails de monstres et coude de fret étroit | 128 | 11 | 117 |
| 6 · Les pierres voyageuses | Trois quais et un canal de réemploi de l’appui | 93 | 16 | 77 |
| 7 · La relève du passeur | Sas, poste de passeur et réserve à deux axes de traction | 92 | 13 | 79 |
| 8 · Le chantier à démonter | Chantier temporaire, cour de réception et deux coupures d’eau | 365 | 43 | 322 |
| **Total** | | **1 344** | **165** | **1 179** |

La durée du tutoriel inclut des démonstrations facultatives. Le transport d’une caisse sur une longue route produit plusieurs gestes mais ne suffit pas à mesurer la difficulté. Les contraintes analysées ci-dessous portent sur la géométrie, les ressources et l’ordre des opérations.

## 1 · L’atelier des marées

Le tutoriel se joue dès le début de la campagne. La porte du balcon final dépend de deux poids et empêche d’atteindre les sorties par une marche directe. Trois cours réunissent des apprentissages qui sont ensuite réemployés ensemble.

Le début compare la traction d’un seul voisin et la relève d’un personnage sur une commande. Le chant entraîne plusieurs pièces, puis les murs et les butées retiennent une partie du groupe. Le Barde place un gardien sur une presse ouverte ; une commande distincte ferme la presse latérale et provoque sa rencontre avec le second gardien. Aucun monstre ne se met en marche de lui-même.

Un miroir déplacé transfère ensuite une caisse sur un quai isolé. Le Voleur extrait cette caisse arrivée contre un mur, le Marchand la transforme en appui et le Barde déplace puis ancre cet appui. La dernière livraison complète le circuit du balcon. Le témoin montre **30 découvertes sur 30**, uniquement par l’observation des pixels publics.

Les apprentissages couvrent aussi les partenaires déplacés sans leur capacité, les effets diagonaux et à travers une cloison, les reflets de héros et de caisses, l’immobilité des monstres, l’appui traversé et les destinations. Une salle peut être gagnée sans toutes les coches : les démonstrations ne sont pas des conditions cachées.

## 2 · Le chargement à rebours

Cette salle retire volontairement l’eau, les monstres et les miroirs. La difficulté vient d’une route de fret asymétrique, de la position nécessaire à chaque opérateur et du changement de fonction des caisses.

La première caisse est extraite contre un mur et sert d’abord à libérer le Barde. Elle doit ensuite contourner un grand obstacle. Les angles où le Marchand ne peut pas se placer derrière elle demandent des tractions dans deux axes. Le pilier du couloir ouest oblige encore à changer de côté avant de remonter la charge sur la commande violette.

Cette commande ouvre la coursive. Depuis l’extérieur du jardin, le Barde place la seconde caisse sur son bouton à travers la cloison. Marcher ensuite librement dans ce passage risquerait de reprendre cette caisse dans le chant : le Marchand engage le Barde par poussée, puis le Voleur le tire depuis le jardin. Les deux poids restent utiles lorsque les trois héros rejoignent les destinations.

Le niveau transpose les problèmes de traction et de maintien d’un accès de Hauling 5, 7 et 17, avec un départ du Barde inspiré de Heroes 3, 14. Le grand détour et les deux relais sont recomposés pour le trio SS20.

## 3 · Le poids qui reste

Deux miroirs desservent des boutons sur des îlots hors de la circulation normale. Le passage final demande **vert actif et violet relâché**. Si les miroirs déplacent seulement leurs deux caisses initiales, les boutons s’allument et s’éteignent ensemble : répéter le reflet ne donne pas la bonne combinaison.

La troisième caisse doit être extraite de sa niche puis chargée sur une presse encore ouverte. Le premier reflet active les deux boutons ; le vert ferme la presse et installe cette troisième caisse près du miroir gauche. Au reflet suivant, l’écran proche devient prioritaire et laisse le poids vert en place. Le miroir droit continue d’alterner le violet.

La revue rejoue six alternances avec et sans la caisse-écran. Elle contrôle cette branche optique précisément, sans prétendre explorer tous les déplacements possibles des héros. Le verrou reprend Mirrors 20 avec une presse et trois caisses finies ; aucune duplication n’est utilisée.

## 4 · Les quais en décalage

Les deux rives ne partagent pas de chemin de marche. Le premier miroir envoie le voyageur sur une escale ; le second le dépose sur le quai opposé. Le bouton de l’escale ferme le bras gauche pendant cette deuxième étape. Cette commande rend le U compatible avec les reflets atomiques : deux miroirs ne peuvent pas réclamer le même acteur vers deux destinations différentes.

Le témoin envoie d’abord le Barde comme réceptionnaire. Le Voleur extrait la caisse de sa niche et le Marchand la charge au départ. À la réception, le Barde la décale d’un pas pour libérer le débarcadère. La livraison définitive de la caisse active la passerelle des sorties mais retire le quai de départ : il faut attendre les autres passagers.

Les branches de revue montrent deux erreurs concrètes. Sans presse d’escale, le deuxième trajet est refusé. Si la caisse arrive sans réceptionnaire, le prochain premier trajet entre en conflit avec son retour vers l’escale. Une livraison trop tôt retire l’embarquement encore utile ; elle reste corrigeable depuis le quai droit. Une variante complète effectue cette correction puis gagne.

Le U et la préparation des départs viennent de Mirrors 22–23. Les quais, l’escale et les deux polarités de livraison sont propres à SS20.

## 5 · Le pas qui manque

Deux monstres occupent des rails visibles. Au départ, leurs positions appartiennent à la même parité de grille. Répéter le reflet fait alterner l’un d’eux sans permettre un voisinage orthogonal : les images seules ne corrigent pas l’écart nécessaire à la rencontre.

Un pas sélectif du Barde décale le gardien du haut d’une case. Le reflet peut alors déposer le second à côté de lui. L’ordre inverse — reflet d’abord, puis pas du Barde — fonctionne aussi et possède un témoin gagnant complet. Dans les deux cas, la rencontre libère réellement le passage vers la réserve.

La seconde moitié est une manutention de couloir. Le Marchand attend au-delà de la caisse pendant que le Voleur la tire depuis le fond. La caisse ferme la voie arrière en arrivant au coude ; le Marchand ne peut plus simplement contourner pour la pousser vers le bas. Le Barde décale la caisse dans cette branche tandis que le mur retient le Marchand. La caisse reste sèche jusqu’à l’unique coupure d’eau finale.

La revue vérifie le coude et les deux ordres de rencontre. La recherche sans aucun chant épuise **7 920 états** et ne trouve aucune victoire : cette nécessité est démontrée sous la restriction annoncée. Les autres mécanismes employés par le témoin ne sont pas déclarés universellement obligatoires sans contrôle supplémentaire.

## 6 · Les pierres voyageuses

Un appui immergé dessert successivement les passages entre trois quais. Le Marchand et le Voleur transportent la caisse sèche ; le Barde circule au-dessus du canal pour reprendre l’appui une fois le passage libéré.

Les murs et les butées changent l’écart entre le Barde et son appui. Celui-ci contourne le quai central, dessert le second bras d’eau puis devient une passerelle verticale permettant au Barde de rejoindre les autres. La caisse reste sèche pour tenir le bouton d’arrivée, que les trois héros doivent pouvoir quitter. Une variante qualifiée extrait la caisse initiale par chant et gagne en 97 entrées : la traction du début est un choix du témoin, pas une obligation universelle.

Water 27 fournit le recalage par butées. Water 32 est une référence complémentaire au maintien des conditions de traversée ; ses empilements et déplacements de deux cases ne sont pas repris. La salle SS20 utilise un seul appui mobile et des pas unitaires.

## 7 · La relève du passeur

Le Voleur tient une commande de passage. Le Barde se trouve dans une zone où son chant rapprocherait un gardien du passeur ; le Marchand doit donc l’engager dans le sas par un transport imposé, sans chant.

Le Marchand peut alors préparer la première caisse sur une presse ouverte. Le Voleur quitte son bouton en tirant cette caisse à sa place : la relève conserve les accès. Une presse orientée vers le bas empêche de contourner ce travail en remontant trop tôt depuis le poste de passeur. Le bouton se trouve en `(7,8)` et la presse en `(7,7)` : le gardien ne peut pas remplacer prématurément le passeur en traversant une presse fermée. L’ancien contre-parcours de 73 entrées a été rejoué et est désormais refusé.

Depuis un autre angle, le Barde pousse le gardien du couloir vers l’eau par son chant. Le passage libéré permet ensuite d’extraire la réserve haute : une traction horizontale la décolle de sa niche, puis une autre traction change l’axe de livraison. Le Marchand finit la mise en place sur la commande d’arrivée, tandis que la première caisse reste au relais.

L’adaptation réunit le départ forcé de Water 28 et la réserve à extraire de Water 29. Les presses et la relève sont recomposées ; il n’y a ni dragon ni échange magique.

## 8 · Le chantier à démonter

La finale demande de préparer le réemploi d’un dispositif avant de le retirer. Un miroir fixe d’angle dessert deux compartiments. Le Barde manipule à distance la caisse de commande du chantier : son retrait modifie la plateforme et expulse le gardien par une presse. Le réglage utile doit ensuite être rétabli pendant l’extraction de la réserve haute. Ce retour de commande remonte le Marchand par chant ; le sas se referme vide, sans seconde poussée de presse.

La réserve traverse le chantier encore opérationnel et rejoint la cour de réception par le miroir. Une fois ce travail achevé et le nord évacué, le Barde peut retirer définitivement la commande. La caisse du chantier est récupérée, transportée et convertie en premier pont permanent. Une seconde caisse forme un autre pont, séparé du premier par un quai sec.

La troisième caisse reste sèche sur la commande finale. Le dernier départ du Voleur demande une autre précaution : partir à pied tirerait ce poids hors du bouton. Le Barde l’entraîne depuis l’autre rive alors que la caisse est hors de son carré de chant. Le verrou reste actif jusqu’aux trois arrivées.

La revue démontre deux coupures d’eau indépendantes, en `(7,11)` et `(4,12)`, même dans un modèle qui ouvre toutes les portes et autorise le port optique. Ces trous ne sont pas voisins d’une autre case d’eau : un même appui ne peut pas voyager de l’un à l’autre. Le miroir est immobilisé par son socle. **Après élimination du gardien, trois caisses sont donc nécessaires pour deux appuis et un poids sec.** Démanteler pendant que la réserve haute se trouve encore sur la plateforme `(14,13)` la transforme en un appui perdu pour cette répartition.

Un gardien déjà posé sur le bouton final empêche la dernière traversée par son contact. C’est un contre-exemple local ; la revue n’établit pas l’impossibilité de toute installation tardive imaginable après tous les passages. Aucune ablation exhaustive des ressources ni unicité de solution n’est revendiquée. Mirrors 4 et 6 motivent le départ sans traction et la planification des dépôts ; Light 39 fournit l’idée de différer un démontage tant qu’un dispositif sert encore.

## Portée de la conception

La campagne varie la topologie et le raisonnement : atelier pédagogique, route de fret, mémoire optique, transport entre quais, correction géométrique, réemploi d’un appui, relève d’un passeur et démantèlement final. Elle ne repose pas huit fois sur des monstres laissés sur des boutons ou sur trois presses alignées.

Les comparaisons automatiques de terrains cherchent les copies exactes sous translations, rotations et réflexions. Les graphes de marche figent les ressources et les circuits. Ni l’un ni l’autre ne remplace une exploration complète du jeu ou une appréciation de la difficulté par les joueurs. Les rapports distinguent les faits rejoués, les variantes gagnantes, les preuves de recherche exhaustive sous restriction et les limites de recherche.

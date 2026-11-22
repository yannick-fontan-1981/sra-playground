# SS15 — conception des huit salles

## Question centrale du duo

Le Magicien change les positions sans entraîner les voisins. Le Barde transporte les ressources mais doit préparer son départ pour les conserver.

Les huit cartes ajoutent des dépendances, sans allongement systématique. Voir [l’audit des sources](source-audit.md).

| Niveau | Salle | Problème travaillé | Entrées du témoin, sélections incluses |
| --- | --- | --- | ---: |
| 1 | L’appui des deux traversées | Immerger une caisse puis réemployer son appui devant une autre rive. | 56 |
| 2 | Le départ qui garde le poids | Poser une caisse, sortir du chant, conserver le passage. | 49 |
| 3 | Le remplaçant derrière le reflet | Libérer une cellule par visée déviée et remplacer les héros par deux poids. | 56 |
| 4 | L’atelier des passages croisés | Préparer les ressources et les passages d’un atelier de vingt découvertes. | 142 |
| 5 | Les gardiens qu’il faut garder | Recaler deux monstres, les conserver vivants et compléter le troisième poids. | 39 |
| 6 | La visée et le dernier appui | Ordonner déplacement de miroir, échange, relais hydraulique et dépôt latéral. | 47 |
| 7 | Le relais des trois rives | Réemployer un appui et une caisse tout en préparant le sauvetage du Magicien. | 162 |
| 8 | Le compte des deux rives | Créer un passage durable, transférer la caisse et changer le service des gardiens. | 181 |

Ces nombres décrivent les parcours exécutés. Ils ne mesurent pas la difficulté et ne constituent pas des bornes minimales.

## L1, L2, L3 et L5 — conserver ce que l’on prépare

L2 isole le départ sans chant : caisse sur commande, extraction du Barde par échange, détour hors de portée. Un départ volontaire testé retire le poids.

L3 libère une cellule par visée déviée : le Magicien remplace le Barde, puis une caisse remplace le Magicien. Le Barde prépare un deuxième poids avant son extraction. Les deux caisses maintiennent les passages.

L1 transforme la caisse en appui, utilisé pour une traversée puis déplacé vers la rive inférieure. Sous le Barde, il reste ancré : le pas vers l’eau vide est refusé. Une traversée trop haute bute contre le mur opposé.

L5 conserve deux monstres vivants. Une butée recale leur écart ; ils ouvrent l’accès à la caisse et restent nécessaires à une porte finale. Deux échanges libèrent successivement le Barde des gardiens puis de la caisse.

## L4 — un atelier dense à passages conditionnés

Cet atelier remplace la première salle ouverte de la version 0.1.0. Il passe en quatrième position, après « L’appui des deux traversées », « Le départ qui garde le poids » et « Le remplaçant derrière le reflet ». Ses vingt découvertes restent observées dans les images publiques ; elles ne constituent jamais une condition artificielle de victoire.

Les deux sorties sont réunies dans une chambre vide fermée par un seuil. Son circuit exige trois poids conservés : une caisse de l’atelier, une caisse préparée près du miroir et un miroir poussé vers son poste par une presse. Aucun héros, monstre ou objet ne commence dans la chambre finale pour servir de cible d’échange. Un bras d’eau devant l’entrée demande également un appui.

La préparation du chant, l’extraction du Barde, le déplacement de l’appui et le dépôt par presse font désormais partie d’une route qui ouvre effectivement la sortie. Les monstres doivent être traités avant l’approche finale. La route et ses branches locales sont enregistrées dans `reference/level4-design.json` ; la revue indépendante se trouve dans `validation/workshop-constraints-report.json`.

## L6 — préparer un accès puis le retirer

La première presse déplace un miroir. Sa réouverture rend la visée utilisable et l’échange récupère la caisse en laissant le Magicien sur une île. Le Barde écarte cette caisse du rayon et tient les plateformes du retour. Il les retire seulement après l’arrivée du Magicien sur le sol : cette désactivation ouvre également l’accès final. La caisse est ensuite chargée sur une seconde presse, qui crée l’appui permanent du Barde.

Les essais confirment trois conséquences : presse fermée coupant le rayon, reflet prématuré immergeant la caisse au mauvais endroit, retrait du relais noyant le Magicien. Boutons et presses sont distincts.

## L7 — la même ressource change de fonction

Le seul appui mobile dessert successivement trois bras. La caisse sèche est d’abord une cible d’échange ; sa récupération enferme le Magicien sur son îlot. Le Barde transporte alors cette caisse vers une commande qui ouvre le rayon de secours. Deux reflets exécutés ensemble déposent la caisse sur son île finale et libèrent le Magicien. L’arrivée de ce dernier déclenche une presse qui installe le miroir sur l’autre commande finale.

Après le sauvetage, l’appui dessert le dernier bras ; les partenaires traversent sans retirer leur sol. Les essais documentent notamment reflet trop tôt, déplacement prématuré du miroir et immersion accidentelle de la caisse.

## L8 — transférer et préserver le retour

Les deux gardiens assurent d’abord le pont provisoire. Le Barde charge la caisse orientale sur une presse maintenue ouverte par la caisse occidentale. Un échange coudé le retire du chargement. En reprenant le poids occidental, il déclenche le dépôt de l’autre caisse et obtient le second appui du passage durable.

Le Barde transporte ensuite réellement la caisse sèche entre les rives. Celle-ci devient le troisième poids final. Les appuis doivent rester disponibles pour le retour : une livraison directe testée place la caisse mais emporte l’un des appuis trop loin. Un rayon à deux coudes replace le Barde entre les gardiens sans déplacer les poids voisins. Les gardiens rejoignent leurs commandes finales, le pont provisoire disparaît, puis le Barde est extrait une dernière fois. Le dernier héros utilise le passage durable conservé.

L’échange redistribue les occupants ; le transport change leur répartition. ACTION5 ne remplace pas la visée déviée : ses propres conditions peuvent refuser l’activation globale au même emplacement.

## Variantes et preuves

Une presse fermée trop tôt peut être rechargée ; le partenaire déplacé hors de sa destination par le Barde reste jouable. Ces variantes légales ne sont pas des défaites. Les témoins prouvent la solvabilité, sans imposer une stratégie ni démontrer optimalité, unicité ou réussite autonome de SRA. Voir [la validation](validation.md).

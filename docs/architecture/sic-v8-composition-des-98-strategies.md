# Quinze primitives pour composer les 98 démarches observées

Cette proposition décrit comment remplacer la sélection et l’orchestration des démarches de l’[inventaire du moteur](sic-v8-strategies-observees.md). Les 98 lignes reprennent l’ordre exact de cet inventaire, qui fournit les identifiants techniques et les témoins. La composition définit une trajectoire nominale. Une incertitude, une absence d’accès ou une contradiction ouvre une branche de repli.

## Contrat commun

Chaque primitive reçoit un besoin, la situation à l’observation courante, les preuves de cette situation et l’objectif parent. Elle peut publier un objectif intermédiaire, proposer un plan, ou expliciter l’information qui manque. Son résultat inclut la portée de la preuve et la condition de reprise. Une primitive s’applique quand son besoin et ses conditions sont établis. Le nom du jeu, le numéro de ligne et l’identité du fournisseur restent des repères de preuve. Les faits sont liés à des objets et des relations observés, puis revalidés quand le contexte change.

Les **détecteurs** produisent les faits observables comme une région contient un objet, une commande déplace un sujet ou deux affichages évoluent ensemble. Les **opérateurs** appliquent ou simulent des transformations typées comme une translation, une réflexion, un passage dans un graphe ou une réécriture. Les **primitives** choisissent quoi apprendre, préparer, vérifier et faire avec ces faits et ces opérateurs. Les codes OP01–OP31 désignent des opérations du moteur actuel. Par exemple, la reprise après contradiction en SK48 combine OP03, OP12 et OP08 pour mettre à jour l’explication, OP26 pour rechercher un accès et OP18 pour engager le prochain pas.

Les parties attestent les démarches d’origine. Les compositions ci-dessous sont des hypothèses d’architecture à vérifier. Un remplacement complet demande que chaque mesure et chaque opérateur de la dernière colonne soit fourni par un contrat typé et que la composition reproduise la commande, la preuve d’admission et le résultat de référence. Une valeur inconnue appelle une expérience ou un arrêt documenté.

Exemple de situation générique. Une commande est disponible, son effet sur le sujet courant est indéterminé, l’objectif dépend de cet effet et un essai préserve les acquis. P05 s’applique en fonction de ces faits. Une couleur, une forme ou une position peut servir à retrouver le sujet et à mesurer le retour. Ces détails n’interviennent dans la décision que s’ils prouvent une relation nécessaire à l’objectif.

## Liste des primitives

| Code | Primitive | Déclencheur générique | Résultat |
| --- | --- | --- | --- |
| P01 | Ancrer le sujet et la cible | Un objectif manque de références dans l’état courant. | Références observables, alternatives en cas d’ambiguïté et durée de validité. |
| P02 | Réutiliser puis revalider une connaissance | Un cas ou un effet acquis pourrait s’appliquer ici. | Correspondance justifiée et hypothèse applicable, ou besoin de remesure. |
| P03 | Formuler et confronter des hypothèses | Une relation, un rôle ou un effet reste indéterminé. | Hypothèses rivales, prédictions distinctes et observations qui les départageraient. |
| P04 | Sélectionner une expérience | Une observation peut réduire une incertitude. | Choix admissible, critère de classement, prédictions et mesure à collecter. Le critère peut être la discrimination, l’effet manquant ou la richesse observable. |
| P05 | Acquérir ou revérifier un contrôle | Une action nécessaire à l’objectif a un effet inconnu ou insuffisamment attesté ici. | Lien commande–effet contextualisé, ou inconnu conservé. |
| P06 | Créer un objectif préalable | La voie envisagée exige une vue, une ressource, un contrôle ou une condition encore absente. | Objectif intermédiaire, lien au parent, condition de réussite et point de reprise. |
| P07 | Gagner l’accès à un sujet ou à une vue | Le sujet est identifié mais l’interaction ou la mesure est inaccessible. | Trajet conditionnel, nouvel accès vérifié et maintien éventuel du sujet ou des candidats. |
| P08 | Chercher un état satisfaisant des contraintes | On peut décrire l’état visé et générer des transitions ou transformations candidates. | Solution conditionnelle, raisons de refus, ou absence de solution dans le budget. |
| P09 | Composer et ordonner des effets | Plusieurs effets vérifiables permettent ensemble d’atteindre l’objectif. | Plan partiellement ou totalement ordonné, états intermédiaires et préconditions. |
| P10 | Préserver les acquis et réserver la reprise | Une action pourrait défaire un acquis, consommer la réserve ou fermer une voie de retour. | Invariants, limites, éventuel plan de restauration et refus si la marge est insuffisante. |
| P11 | Engager et contrôler le prochain pas | Une commande du plan est encore admissible dans l’état courant. | Commande autorisée, retour comparé à la prédiction et décision de continuer, de suspendre ou de fermer. |
| P12 | Acquérir le retour et mettre à jour le modèle | Une observation nouvelle confirme, contredit ou laisse indéterminée une hypothèse. | Mise à jour de la connaissance, preuve du retour et portée de la mise à jour. |
| P13 | Réviser et reprendre après un écart | Une attente a été contredite ou un engagement a perdu sa validité. | Contre-exemple, objectif conservé ou expiré, hypothèse modifiée et reprise ciblée. |
| P14 | Suivre une évolution temporelle | Une animation, une phase, une file ou une séquence influence la commande ou son retour. | États intermédiaires liés au sujet, phase ou transition mesurée et incertitudes de synchronisation. |
| P15 | Comparer les offres et arbitrer | Des plans ou expériences répondent au même besoin. | Classement justifié par priorité, coût, progrès ou information, et règle de repli si une offre est refusée. |

## Décomposition de chaque démarche

P10 peut entourer toute suite qui doit conserver une condition. P11 boucle pour les étapes successives d’un plan. P12 traite aussi les images intermédiaires quand P14 est requis. Après une contradiction, P13 revient au premier besoin encore ouvert. P15 intervient quand plusieurs offres admissibles subsistent.

| N° | Démarche observée | Composition proposée | Faits et opérateurs à fournir |
| ---: | --- | --- | --- |
| 1 | Identifier la commande qui agit sur la cible | P01 → P03 → P05 → P11 → P12 | Effets directionnels mesurables sur les éléments liés à la cible. |
| 2 | Tester un contact visible au cours d’une animation | P01 → P03 → P04 → P11 → P14 → P12 | Détection du contact dans les images successives et distinction entre déplacement et contact. |
| 3 | Transférer des bandes en conservant leur alignement | P01 → P02 → P08 → P09 → P10 → P11 → P12 | Relations entre bandes, déplacement admissible, alignement à conserver. |
| 4 | Préparer les branches avant de tester la propagation | P01 → P03 → P08 → P09 → P10 → P11 → P12 | Connexions, sorties et récepteurs. Séparer préparation des branches et test de propagation. |
| 5 | Exécuter un programme dont le codage a été appris | P02 → P01 → P05 → P09 → P11 → P12 | Alphabet et encodage acquis, opérateurs et retour de l’exécution. |
| 6 | Composer les trajets selon leurs premières arrivées observées | P01 → P03 → P14 → P08 → P09 → P11 → P12 | Horodatage relatif des arrivées et contraintes sur leurs relations. |
| 7 | Déplacer des supports pour couvrir une constellation de repères | P01 → P05 → P08 → P09 → P10 → P11 → P12 | Correspondances entre repères et supports, déplacements indépendants et couverture. |
| 8 | Mesurer les déplacements et les contacts entre contenant et contenu | P01 → P03 → P05 → P04 → P11 → P12 | Inclusion, contact, corps mobiles et mesure du déplacement. |
| 9 | Tester le rôle de la séparation entre compartiments | P01 → P03 → P04 → P11 → P12 | Appartenance aux compartiments et effets de leurs frontières. |
| 10 | Déduire une transformation des facettes qui servent d’exemples | P01 → P02 → P03 → P08 → P04 → P11 → P12 | Paires d’exemples, correspondances de facettes et transformations candidates. |
| 11 | Isoler un effet matériel parmi plusieurs changements | P01 → P03 → P04 → P11 → P12 | Trajectoires simultanées, chaîne d’effets et changements indépendants. |
| 12 | Choisir la suite d’une séquence à partir de son retour | P01 → P14 → P03 → P04 → P11 → P12 | État de la séquence, lecture du retour et candidats de prolongement. |
| 13 | Vérifier le prérequis d’un programme à origine fixe | P02 → P01 → P06 → P04 → P11 → P12 | Repère d’origine du programme et condition dont il dépend. |
| 14 | Rendre accessible le point d’origine d’un programme | P02 → P01 → P06 → P07 → P10 → P11 → P12 | Origine liée au plateau courant, accès et preuve de disponibilité. |
| 15 | Mesurer quels affichages répondent ensemble | P01 → P03 → P04 → P10 → P11 → P12 | Observations distinctes des affichages et prédictions sur leur réponse conjointe. |
| 16 | Départager les explications possibles d’un clic | P01 → P03 → P04 → P10 → P11 → P12 | Occurrence visée, caractéristiques rivales et différence locale mesurable. |
| 17 | Réduire un ensemble en suivant les contacts proposés | P01 → P03 → P08 → P09 → P11 → P12 | Contact proposé, effet de réduction et maintien du critère de sélection suivant. |
| 18 | Mesurer une commande nécessaire à une préparation de contact | P01 → P06 → P05 → P07 → P14 → P10 → P11 → P12 | Accès vers un contact, réponse de la région distante et évolution observée. |
| 19 | Accéder à une configuration qui satisfait des relations de distance | P01 → P03 → P08 → P07 → P11 → P12 | Distances et relations métriques qui décrivent la configuration cible. |
| 20 | Comparer les formes pour tester un trajet | P01 → P02 → P03 → P05 → P07 → P11 → P12 | Correspondance des formes, orientations, trajectoire et effets mesurés. |
| 21 | Utiliser un motif observé pour déterminer un accès | P01 → P02 → P03 → P06 → P07 → P11 → P12 | Correspondance entre motif observé et accès géométrique conditionnel. |
| 22 | Rejoindre un état connu où reste une commande à essayer | P01 → P06 → P07 → P10 → P11 → P05 → P11 → P12 | Transitions connues vers un état où une commande reste à caractériser. |
| 23 | Essayer une commande inédite sur le plateau courant | P01 → P04 → P05 → P11 → P12 | Commandes admissibles, historique local et éventuel ordre de priorité. |
| 24 | Déduire le déplacement des pièces en suivant leurs emplacements | P01 → P03 → P08 → P04 → P11 → P12 | Emplacements homologues et permutation mesurée entre états. |
| 25 | Transférer les pièces entre supports dans l’ordre requis | P01 → P02 → P08 → P09 → P10 → P11 → P12 | Ordre de transfert, contraintes de support et mouvements valides. |
| 26 | Tester le contact entre deux contours orientés | P01 → P03 → P04 → P10 → P11 → P12 | Contours orientés, contact attendu et distinction entre contact et attachement. |
| 27 | Vérifier quel canal contribue à une somme périodique | P01 → P14 → P03 → P04 → P11 → P12 | Canaux observables et contribution conditionnelle à une somme périodique. |
| 28 | Identifier la commande d’une phase périodique | P01 → P14 → P05 → P11 → P12 | Phase observable et commandes susceptibles de modifier son évolution. |
| 29 | Aligner les phases pour atteindre la somme recherchée | P01 → P02 → P14 → P08 → P09 → P11 → P12 | Modèles de phase par canal, contrainte sur la somme et états intermédiaires. |
| 30 | Assembler les pièces rigides par leurs ports compatibles | P01 → P03 → P08 → P09 → P10 → P11 → P12 | Ports compatibles, poses rigides et correspondances d’assemblage. |
| 31 | Rendre accessible un contact pour en observer le retour | P01 → P03 → P06 → P07 → P04 → P11 → P12 | Relation de contact visible, trajet jusqu’au contact et retour qui la vérifierait. |
| 32 | Préparer le placement d’une pièce annoncée en aperçu | P01 → P02 → P08 → P10 → P11 → P12 | Pièce annoncée, placements compatibles et emprise disponible. |
| 33 | Tester une relation géométrique le long d’un axe | P01 → P03 → P04 → P11 → P12 | Axe, alignement et modifications candidates mesurées. |
| 34 | Déterminer un trajet à partir de repères cartographiques | P01 → P02 → P07 → P08 → P11 → P12 | Repères cartographiques, conventions de correspondance et transitions observées. |
| 35 | Transférer une configuration dans un cadre observé | P01 → P02 → P03 → P08 → P09 → P11 → P12 | Repères des deux cadres, transformation et correspondances contrôlables. |
| 36 | Réutiliser une analogie de disposition entre cadres | P02 → P01 → P03 → P08 → P04 → P11 → P12 | Analogie acquise, correspondances entre rôles et observation qui la revalide. |
| 37 | Réutiliser la liaison observée entre une commande et un objet | P02 → P01 → P05 → P04 → P11 → P12 | Lien commande–objet déjà acquis et moyens de le revérifier ici. |
| 38 | Composer une action à partir des ressources de l’inventaire | P01 → P02 → P06 → P08 → P09 → P10 → P11 → P12 | Inventaire, disponibilité et consommation des ressources, opérations compatibles. |
| 39 | Rejoindre une configuration par des transitions alternées | P01 → P02 → P08 → P09 → P10 → P11 → P12 | Transitions du graphe et contrainte d’alternance. |
| 40 | Changer de vue pour accéder à un catalogue masqué | P01 → P06 → P07 → P04 → P11 → P12 | Éléments du catalogue partiellement visibles et changement de fenêtre mesurable. |
| 41 | Placer un motif de cellules à partir d’une occurrence repérée | P01 → P02 → P03 → P08 → P04 → P11 → P12 | Correspondance entre cellules du motif et sites candidats, effet et datation du placement. |
| 42 | Accéder à la cible en exploitant les relations entre chambres | P01 → P02 → P03 → P06 → P07 → P11 → P12 | Passages et relations visibles entre compartiments. |
| 43 | Reprendre un préfixe d’actions dont les effets sont couplés | P02 → P01 → P09 → P10 → P11 → P12 | Préfixe acquis, effets couplés et ordre des commandes qui les produit. |
| 44 | Tester le remplissage d’une enveloppe visible | P01 → P03 → P04 → P11 → P12 | Contour, points candidats et état mesurable des surfaces remplies. |
| 45 | Atteindre une zone de réception rendue visible | P01 → P03 → P06 → P07 → P10 → P11 → P12 | Récepteur exposé, trajet disponible et maintien des accès. |
| 46 | Tester comment les facteurs se combinent dans un panneau | P01 → P03 → P04 → P11 → P12 | Valeurs des facteurs, groupes mesurables et résultats possibles de leur combinaison. |
| 47 | Tester une commande qui agit sur un champ visible | P01 → P03 → P05 → P04 → P11 → P12 | Champ visible, commande candidate et mesure locale ou distante de la réponse. |
| 48 | Tester le transfert d’un effet entre régions | P02 → P01 → P03 → P09 → P04 → P11 → P12 | Régions homologues, réponse de référence et prédictions d’un éventuel transfert. |
| 49 | Tester la relation entre une fenêtre et son cadre | P01 → P02 → P03 → P04 → P11 → P12 | Cadre, fenêtre et correspondances de contenu. |
| 50 | Tester la prochaine étape d’une séquence repérée | P01 → P02 → P14 → P03 → P04 → P11 → P12 | Étiquettes, position dans la séquence et réponse attendue au prochain choix. |
| 51 | Suivre les réponses liées de plusieurs éléments | P01 → P03 → P04 → P11 → P14 → P12 | Éléments liés, états intermédiaires et distinction des retours individuels. |
| 52 | Modifier une collection repérée avant d’en tester l’effet | P01 → P03 → P04 → P10 → P11 → P12 | Collection, membres marqués, commande d’édition et contenu après édition. |
| 53 | Tester la commande associée à un motif imbriqué | P01 → P03 → P05 → P04 → P11 → P12 | Occurrence imbriquée, désignation et observation de la réponse. |
| 54 | Interroger une occurrence visible dans un catalogue partiellement masqué | P01 → P02 → P03 → P07 → P04 → P11 → P12 | Occurrence observable malgré l’occultation, hypothèse de rôle et retour du clic. |
| 55 | Exploiter une relation mesurée entre panneau et zone de jeu | P01 → P03 → P06 → P08 → P09 → P11 → P12 | Relation entre le panneau et ce qu’il pilote, preuves d’application et de progrès. |
| 56 | Retrouver une occurrence observable à partir d’un exemple acquis | P02 → P01 → P03 → P04 → P11 → P12 | Descripteurs d’occurrences, ambiguïté et preuve réactualisée. |
| 57 | Exécuter la composition de commandes apprise | P02 → P01 → P08 → P09 → P10 → P11 → P12 | Alphabet d’opérateurs, préfixe conservé, états d’édition et exécution. |
| 58 | Identifier les éléments affectés par un programme | P01 → P03 → P09 → P10 → P04 → P11 → P12 | Paire d’effets opposés, retour du sujet et retours des autres éléments. |
| 59 | Mesurer comment une commande agit sur une file d’éléments | P01 → P14 → P03 → P05 → P04 → P11 → P12 | Ordre observable des éléments, transition de la file et réponse à la commande. |
| 60 | Raccorder des ports disposés autour d’un centre | P01 → P03 → P08 → P09 → P10 → P11 → P12 | Ports, centre de référence, compatibilités et état d’assemblage. |
| 61 | Préparer un récepteur pour obtenir le contact attendu | P01 → P03 → P06 → P07 → P09 → P11 → P12 | Configuration du récepteur, accessibilité et retour de contact. |
| 62 | Composer progressivement la population d’éléments de référence | P02 → P01 → P08 → P09 → P10 → P11 → P12 | Population visée, écarts mesurés et mouvements ou ajouts admissibles. |
| 63 | Prolonger ou compléter une ligne répétée | P02 → P01 → P08 → P09 → P11 → P12 | Motif de répétition, ligne attendue et positions à compléter. |
| 64 | Rechercher un accès qui ordonne les pièces autour d’un point d’appui | P01 → P02 → P05 → P08 → P09 → P10 → P11 → P12 | Point d’appui, relation d’ordre des pièces et effets de translation ou d’extension. |
| 65 | Tester la quantité requise autour d’un point d’appui | P01 → P03 → P04 → P11 → P12 | Point d’appui, unités à compter et quantités candidates. |
| 66 | Préparer un appui pour compléter une ligne | P01 → P03 → P06 → P07 → P08 → P09 → P11 → P12 | Ligne visée, critère d’appui et possibilités de le rendre disponible. |
| 67 | Vérifier la relation entre la trace laissée et le champ visible | P01 → P03 → P04 → P11 → P14 → P12 | Trace observable, champ associé et variantes de trajectoire ou de retour. |
| 68 | Tester l’effet d’une commande sur un porteur repéré | P01 → P03 → P04 → P05 → P11 → P12 | Porteur marqué et preuve de l’effet de la commande sur lui. |
| 69 | Suivre puis sélectionner les éléments produits par un transfert | P01 → P02 → P14 → P09 → P11 → P12 | Relations entre porteur, transfert et éléments produits. |
| 70 | Recruter des éléments dans l’ordre observé | P01 → P03 → P08 → P09 → P10 → P11 → P12 | Ordre de recrutement, transitions et préservation des éléments acquis. |
| 71 | Utiliser un contour mesuré pour préparer un accès | P01 → P02 → P03 → P07 → P08 → P11 → P12 | Contour mesuré et contraintes géométriques du passage. |
| 72 | Choisir un élément de l’atelier selon l’ordre observé | P01 → P02 → P15 → P04 → P11 → P12 | Ordre des choix mis en évidence par les retours et effets associés. |
| 73 | Tester une conversion entre symboles | P01 → P03 → P04 → P11 → P12 | Symboles, quantités et prédictions sur la conversion. |
| 74 | Recolorer une région à partir de ses relations de voisinage | P01 → P02 → P03 → P08 → P11 → P12 | Régions, voisinages topologiques et palette admissible. |
| 75 | Tester une relation de fenêtre dans le plateau courant | P01 → P03 → P04 → P11 → P12 | Fenêtre observée, relations locales et retour qui les départage. |
| 76 | Réduire une composition de trois éléments en gardant l’appui requis | P01 → P03 → P08 → P09 → P10 → P11 → P12 | Composition de trois éléments, transformation de réduction et support à garder. |
| 77 | Compléter une couverture par réflexion en conservant les parties acquises | P01 → P02 → P08 → P09 → P10 → P11 → P12 | Transformations de réflexion, zones à couvrir et parties à conserver. |
| 78 | Réparer une cellule par correspondance géométrique ou répétition | P01 → P02 → P03 → P08 → P04 → P11 → P12 | Symétries ou répétitions, valeurs concordantes et cellule en désaccord. |
| 79 | Comparer les positions relatives pour déterminer l’intervention | P01 → P02 → P03 → P08 → P04 → P11 → P12 | Repères entre objets, transformations relatives et intervention testable. |
| 80 | Comparer le retour d’une branche aux alternatives accessibles | P12 → P01 → P03 → P06 → P07 → P04 → P11 → P12 | Retour antérieur de la branche et accès aux alternatives qui le distinguent. |
| 81 | Revalider une transformation locale qui a fait progresser le jeu | P02 → P01 → P03 → P04 → P10 → P11 → P12 | Transformation antérieurement associée à un progrès et conditions de sa revalidation. |
| 82 | Déplacer la pièce rigide dont la sélection a été confirmée | P01 → P05 → P06 → P08 → P10 → P11 → P12 | Sélection effective de l’objet et mouvements rigides admissibles. |
| 83 | Tester la direction qui donne accès à une cavité | P02 → P01 → P06 → P05 → P11 → P12 | Cavité et corps remis en correspondance, direction inconnue dans la situation présente. |
| 84 | Faire glisser une pièce pour atteindre une cavité | P01 → P02 → P08 → P09 → P10 → P11 → P12 | Effet d’arrêt, appuis, cavité et simulation conditionnelle du glissement. |
| 85 | Substituer les pièces dans les emplacements selon l’ordre mesuré | P01 → P02 → P08 → P09 → P10 → P11 → P12 | Emplacements, substitutions admissibles et contrainte d’ordre. |
| 86 | Naviguer jusqu’au sous-ensemble à inspecter | P01 → P03 → P06 → P07 → P10 → P11 → P12 | Sous-ensembles accessibles par commande et conservation des candidats dans la nouvelle vue. |
| 87 | Tester le sous-ensemble courant pour le discriminer | P01 → P03 → P04 → P11 → P12 | Prédictions pour le sous-ensemble, coût du pire cas et retour transitoire interprétable. |
| 88 | Reconfigurer un support pour accéder à la cible | P01 → P03 → P06 → P08 → P09 → P10 → P11 → P12 | Configuration du support, transformations admises et trajet rendu accessible. |
| 89 | Composer les transformations locales d’une surface | P01 → P02 → P08 → P09 → P10 → P11 → P12 | Règles de réécriture apprises, zones transformables et dépendances entre les effets. |
| 90 | Atteindre un bord susceptible de révéler une autre partie du plateau | P01 → P03 → P06 → P07 → P15 → P11 → P12 | Bords atteignables, trajectoires et gain attendu en nouvelle zone visible. |
| 91 | Répéter le mouvement pour vérifier qu’un passage est bloqué | P01 → P03 → P04 → P10 → P11 → P12 | Obstruction déjà observée, répétition admissible et critère de blocage. |
| 92 | Tester une commande pour reprendre l’exploration quand la vue est indéterminée | P01 → P06 → P05 → P04 → P11 → P12 | Vue incomplète, commande disponible et retour utile pour reprendre. |
| 93 | Utiliser les retours visuels pour poursuivre une séquence | P01 → P02 → P14 → P03 → P04 → P11 → P12 | États visuels de la séquence et observation qui distingue les suites. |
| 94 | Tester une contrainte qui se répète dans des fenêtres du plateau | P01 → P02 → P03 → P08 → P04 → P11 → P12 | Fenêtres à différentes échelles, correspondances et contrainte commune. |
| 95 | Tester les correspondances entre objets de types distincts | P01 → P03 → P04 → P11 → P12 | Types et occurrences visibles, correspondance à tester par une commande. |
| 96 | Réviser la projection de contact après un retour contraire | P12 → P13 → P01 → P03 → P08 → P10 → P11 → P12 | Écart mesuré sur le contact, poussée attestée, ordre cible et recherche bornée. |
| 97 | Rejoindre une cavité au bon moment de son cycle | P01 → P02 → P14 → P08 → P09 → P10 → P11 → P12 | Phases observées et effets de glissement. Comparaison du plateau aux états prévus. |
| 98 | Tester d’abord la composition observable la plus riche | P01 → P03 → P04 → P15 → P11 → P12 | Relations observables entre cible et voisins. Classement par richesse dans les offres admissibles. |

## Passage de l’inventaire au moteur

Une famille peut migrer quand chaque valeur particulière est une mesure ou un paramètre d’opérateur, quand le graphe justifie son choix à partir de la situation, et quand ses retours et refus sont reproductibles. Le test de généralisation réutilise une composition avec les observations d’un autre jeu et change les détails qui ne portent aucune relation pertinente. Le test de régression rejoue aussi les situations où une offre prioritaire doit conserver la main. Les premières compositions à extraire sont le contrôle manquant (1, 18, 83), l’expérience discriminante (15, 16, 87) et le contrôle d’une exécution composée (57, 84, 97).

Le premier contrat de P05 suit maintenant les essais observés sur AS66 N2 aux actions 6 et 7, G50T N1 aux actions 3, 4, 5 et 9, et DC22 N1 à l’action 1. Le test rejette une proposition dont le type ressemble à un essai connu si aucun fait courant ne l’établit. Il accepte le même besoin sur des types de plans différents quand les conditions sont prouvées. Sur ce lot, LKEY conserve trois niveaux en 44 actions et CASC conserve son arrêt après une commande. Les commandes et les retours publics concordent en natif, shadow et actif.

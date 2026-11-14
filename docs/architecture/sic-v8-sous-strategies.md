# Décomposer les stratégies observées en sous-stratégies réutilisables

La décomposition part de l’[inventaire des stratégies exécutées](sic-v8-strategies-observees.md). Une sous-stratégie répond à un besoin qui peut apparaître dans plusieurs jeux. Elle a un déclencheur, un résultat observable et une condition d’arrêt. Les opérations OP peuvent soutenir plusieurs sous-stratégies.

## Premières sous-stratégies à isoler

| Sous-stratégie | Situation qui la déclenche | Résultat observable attendu | Témoins |
| --- | --- | --- | --- |
| Vérifier un contrôle manquant pour une méthode retenue | La cible et la méthode sont liées au plateau courant, et une commande reste sans effet mesuré. | Un essai permet de relier la commande à un effet ou de conserver l’inconnue. | AS66 N2 action 6, G50T N1 action 3. |
| Choisir une expérience discriminante | Plusieurs explications compatibles prédisent des retours distincts et une commande les départage. | Le retour permet de trancher au moins une prédiction ou laisse la question ouverte. | DICO N1 action 4, LOGI N1 action 1, UPST N1 action 4. |
| Changer le champ d’observation en préservant le sujet | La question est connue, et le sujet ou son retour est hors de la vue utile. | La nouvelle vue conserve le sujet recherché et rend l’essai possible. | DICO N1 action 2, GRIL N1 action 4. |
| Chercher un accès avec une règle de mouvement attestée | La cible est visible et des retours justifient une projection conditionnelle du mouvement. | Le plan prévoit où doit arriver le sujet et quels éléments doivent rester stables. | SK48 N1 action 13, AS66 N1 action 5. |
| Composer des effets appris et contrôler les étapes | Des effets attestés peuvent s’enchaîner et les commandes sont encore disponibles. | Les états intermédiaires répondent aux prédictions, sinon le plan s’interrompt. | STCK N2 action 4, AS66 N3 action 14. |
| Isoler l’effet sur un autre élément | Plusieurs éléments peuvent réagir à la même commande et le retour global ne permet pas de les distinguer. | On mesure les retours séparément et on conserve les effets non attribués comme inconnus. | STCK N3 action 12, LOGI N1 action 1. |
| Réviser la projection après une contradiction | Un retour invalide une prédiction et l’objectif parent reste pertinent. | La prochaine projection cite le contre-exemple, change l’hypothèse concernée et teste un trajet. | SK48 N1 action 13. AS66 N3 fournit le contrôle d’arrêt sur écart. La reprise après cet arrêt reste à attester. |
| Classer les compositions par richesse en ouverture | Plusieurs essais admissibles visent des compositions observables et l’ouverture laisse le choix. | Le classement expose le nombre de relations, puis le retour montre ce que la commande a produit. | DICO N1 action 1 en mode actif. La réutilisation sur un autre jeu reste à attester. |

## Décomposition de 12 démarches observées

| Démarche du moteur | Enchaînement de décisions | Connaissance locale à la mécanique |
| --- | --- | --- |
| SK48 · Réviser le contact après l’action 12 | Préserver l’objectif → comparer les positions prévues et rendues → retenir le contre-exemple → réviser la projection → chercher un accès borné → vérifier le prochain retour. | Le contact d’une cellule propage la poussée dans l’ordre des pièces. OP03, OP12 et OP08 soutiennent la révision, OP26 recherche l’accès et OP18 engage le plan. |
| AS66 · Tester la direction manquante | Rattacher la méthode à la situation actuelle → identifier le contrôle manquant → l’essayer une fois → conserver le retour avant de planifier. | L’ajustement entre corps, cavité et surface délimite le contexte de l’essai. |
| AS66 · Glisser jusqu’à une cavité | Relier le sujet et la cible → chercher un accès avec un effet appris → préserver les appuis → comparer la position d’arrêt prévue et le retour. | La loi de glissement et le rôle des parois viennent des retours du jeu. |
| AS66 · Atteindre la cavité au bon moment | Composer une route avec une évolution anticipée → vérifier l’état avant chaque commande → contrôler l’état rendu → arrêter au premier écart. | La phase de mouvement du plateau et la loi d’arrêt sont deux prédictions liées. |
| STCK · Modifier la collection repérée | Relier l’objet sélectionné à une commande → essayer une modification localisée → comparer la collection avant et après. | La surbrillance et l’ordre des cartes donnent les repères de l’éditeur. |
| STCK · Exécuter une composition apprise | Revalider les commandes → composer leurs effets → contrôler les états intermédiaires → vérifier l’effet de l’exécution. | Les opérateurs du programme et l’état d’édition alimentent le planificateur natif. |
| STCK · Identifier les éléments qui répondent au programme | Préserver la configuration qui donne accès aux commandes → préparer deux effets opposés → vérifier l’édition → distinguer le retour du sujet et les changements des autres éléments. | Les cartes et les tours servent de repères. La restitution complète reste une hypothèse jusqu’au retour. |
| DICO · Naviguer vers un sous-ensemble | Repérer les candidats possibles → choisir une vue plus étroite qui les conserve → vérifier la vue obtenue. | Les groupes affichés et leurs commandes définissent les sous-ensembles accessibles. |
| DICO · Tester un sous-ensemble | Former des prédictions qui séparent les candidats → choisir un test qui réduit l’incertitude dans le pire cas → lire le retour → mettre à jour les candidats quand le retour est interprétable. | Le moteur lit le retour transitoire pour reconnaître le résultat du test. |
| DICO · Curiosité à l’ouverture | Mesurer les relations des cibles → classer les essais admissibles → essayer la composition la plus riche → observer le résultat. | Les formes, couleurs et positions fournissent la mesure actuelle de richesse. Le clic (25, 36) ouvre le niveau 2. |
| LOGI et REWI · Comparer des affichages couplés | Repérer les retours possibles → préserver les obligations en cours → sélectionner une expérience discriminante → mesurer les affichages ensemble. | Les valeurs et les zones des affichages sont mesurées sur le plateau. |
| GLOB, EVAS et UPST · Départager les effets d’un clic | Lier le clic à une occurrence visible → recenser les caractéristiques qui pourraient expliquer l’effet → choisir un clic discriminant → mesurer le changement local. | Les occurrences et les caractéristiques comparées viennent des observations. |

Sources d’implémentation [révision du contact](../../src/logos-engine/v6-rooted-line-access.ts), [accès à une cavité](../../src/logos-engine/v6-sliding-cavity.ts), [programmes observés](../../src/logos-engine/v6-program-composition-access.ts), [diagnostic par sous-ensembles](../../src/logos-engine/v6-subset-diagnosis.ts) et [comparaison des expériences](../../src/logos-engine/v6-information-goals.ts).

## Ordre de migration

Commencer par **vérifier un contrôle manquant**, **choisir une expérience discriminante** et **contrôler un plan étape par étape**. Ces décisions ont des témoins dans plusieurs jeux. Elles peuvent partager une définition du besoin, du retour attendu et de la condition d’arrêt. Chaque famille fournit ses mesures et ses opérateurs. Le premier essai compare les commandes et les retours avec l’exécution native sur les jeux sources, puis vérifie un jeu supplémentaire sans règle spécifique.

Pour le contrôle manquant, AS66 mémorise l’essai par niveau, géométrie de la cavité, corps et direction. G50T le mémorise par position et commande, puis utilise le déplacement observé. La sous-stratégie commune peut recevoir la commande candidate, une clé de contexte fournie par la famille et les observations à comparer. Le résultat distingue un effet mesuré, un retour encore indéterminé et la sortie du contexte courant. La famille reste responsable de la mesure de l’effet et de son périmètre de validité.

La généralisation de la curiosité et de la reprise complète après contradiction demande un second témoin. Les autres entrées de l’inventaire restent à décomposer avec leurs modules source et leurs retours.

## Réglage d’une expérience discriminante

Dans **Stratégies → Active SIC settings → Information experiment priority**, une préférence enregistre le type d’expérience et le nombre minimal de retours distincts qu’elle doit prédire. Elle compare les offres déjà admises dans le même groupe de préservation. Une obligation de retour en cours et un manque de réserve continuent de limiter les choix. La frise montre la commande de l’ordre usuel et la candidate privilégiée, si elle existe. Le mode shadow conserve la commande de l’ordre usuel. Le mode actif essaie l’offre préférée puis les autres offres si son plan est refusé. Le réglage se sauvegarde et se transfère dans le schéma 6 des packs SIC.

Les tests de sélection vérifient un changement d’ordre quand deux offres admissibles sont présentes, la conservation du choix en shadow et le refus des offres périmées, incompatibles avec la préservation ou hors budget. Dans le navigateur, le premier épisode de LOGI montre qu’aucun clic concurrent ne satisfait la préférence pour le contraste de point. Le banc `/tests/sic-qualification.html?information-priority` compare les commandes et les empreintes des retours dans les trois modes.

Sur `56361c59`, LOGI, REWI, ONDE, GLOB, EVAS et UPST donnent les mêmes 91 commandes, retours publics et résultats dans les trois modes avec la préférence pour le contraste de point et un minimum de deux retours distincts. GLOB, EVAS et UPST fournissent respectivement une, deux et une offres préférées déjà en tête. Un essai de trois actions par jeu sur LOGI, REWI, GLOB et EVAS vérifie aussi la préférence pour les affichages couplés. LOGI et REWI fournissent trois offres préférées chacun, déjà en tête. La qualification de la concurrence entre stratégies en partie réelle reste ouverte.

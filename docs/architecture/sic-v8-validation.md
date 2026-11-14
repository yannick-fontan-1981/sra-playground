# Critères de validation de SIC V8

Le plan V8 de référence est conservé dans `docs/architecture/v8-human-configurable-intelligence.md` au commit `b23381aaddc65e152be68315fdecf662f74f34d0`. Le tableau suit les conditions de déclaration de sa phase V8-12. Les observations historiques figurent dans le [journal SIC](sic-v8-control-effect-shadow.md) et les démarches à migrer dans la [matrice des 98 démarches](sic-v8-composition-des-98-strategies.md).

| Condition de déclaration | État du lot `83474c04` | Preuve de clôture attendue |
| --- | --- | --- |
| L’agenda est l’autorité principale | Actif par défaut dans le Playground. Les workflows SRC édités peuvent reprendre la sélection. | Rejeu des voies restantes, avec auteur du choix enregistré à chaque libération. |
| Les stratégies émettent les objectifs | Le plan libéré conserve la stratégie et le but qu’elle a déclaré. Des propositions natives fournissent encore le but global ou leur question sous l’ancien contrat. | Vérifier l’émission et la filiation des objectifs sur toutes les voies actives. |
| Les plans portent toutes les actions | Une commande libérée a un reçu de plan. La boucle commune contrôle les retours, la garde et la clôture. | Audit des traces de toutes les voies, y compris reprises et changements de niveau. |
| Les besoins sont canoniques et persistants | Le registre persiste les besoins migrés et leurs dépendances. | Vérifier révision, restauration, expiration et déduplication pour chaque besoin de la liste finale. |
| Les situations sont révisables et fondées sur des preuves | Les stratégies migrées utilisent des faits liés aux observations. Les anciens fournisseurs gardent leurs conditions locales. | Vérifier qu’une observation nouvelle révise les faits concernés sans recréer le besoin et que l’explication conserve le témoin. |
| Chaque besoin polymorphe a un graphe qualifié | La récupération, l’exploration et la vue ont des graphes. La composition des autres démarches est proposée. | Identifier chaque besoin polymorphe et rejouer ses conditions, replis et refus. |
| Les chevauchements et trous sont contrôlés | La couverture des graphes actuels et les règles toujours devancées sont visibles. | Auditer tous les graphes actifs et examiner les trous, recouvrements et dépendances avec des retours réels. |
| L’interface expose les cinq perspectives | Perceptions, Informations, Stratégies, Objectifs et Plans d’action sont présentes. | Vérifier les cinq perspectives sur les familles migrées, y compris après une contradiction. |
| L’atelier produit une capacité utile sans code spécifique | Une règle d’exploration locale peut être créée, sauvegardée et rejouée. Les packs de réglages sont vérifiables par signature. | Conserver un exemple complet et mesurer ses effets sur les jeux témoins après la migration. |
| Les principales familles ont migré | La matrice relie les choix observés à des primitives génériques. P04, P05 et P11 ont des éléments communs intégrés. | Faire porter les choix des familles principales par des graphes SIC et comparer chaque voie à sa référence. |
| Les performances restent conformes | La fenêtre précédente qualifie `90d002a4` face à 0.65. Le code actuel demande une mesure propre. | Qualifier séparément STCK et SMLP sous +10 %, sur le commit à déclarer, avec commandes et résultats identiques. |
| Les anciennes voies directes sont inventoriées | Les familles enregistrées et les épisodes exécutés sont inspectables. | Lister chaque voie directe conservée, sa condition d’entrée, son autorité et le cas qui l’exerce. |

## Qualification des modes adaptatifs

Sur `33f0fb3b`, SK48, AS66, SYME et CASC reproduisent 48 commandes et les mêmes retours publics, ainsi que les mêmes résultats. SK48 ouvre le niveau 2 à l’action 19. AS66 termine trois niveaux en 19 actions, SYME un en neuf, et CASC conserve son arrêt `frontier_unknown` après une commande. LOGI conserve 16 commandes et deux niveaux. Le navigateur montre deux cartes P05 exploratoires au niveau 2 d’AS66, aux actions 6 et 7. Sur DC22, l’action 1 est un test qui relève de l’exploration pendant que l’agenda assimile l’entrée du niveau. Les tests de contrat vérifient les cartes d’assimilation et de résolution avec des preuves appropriées. Leur déclenchement en partie réelle reste à attester.

LKEY termine également le rejeu de `33f0fb3b` avec les mêmes 44 commandes, retours et trois niveaux. DC22 reproduit les 50 commandes et le niveau acquis jusqu’à la limite fixée pour l’essai. La première fenêtre de coût du même runtime, avec quatre sessions par jeu et agenda actif, reproduit les commandes attendues. STCK a une médiane de 12,343 s et SMLP de 17,505 s. La comparaison indicative à l’ancienne fenêtre de référence donne +12,83 % et −2,08 %. La mesure STCK dépasse le seuil, et une référence de la même période reste nécessaire pour isoler la variation.

## Mesurer le remplacement effectif

Le commit `fe9bd63f` porte le compteur à **2 jeux gagnés sur les 100 du catalogue (2 %)** et **12 niveaux gagnés**. La [référence par jeu](sic-v8-reference-levels.md) retient les maxima attestés pour le natif, V5, V6 et V7. Le score à dépasser se calcule sur les parcours partis du niveau 1, dans une partie continue.

| Jeu | Maximum historique retrouvé | SIC seul | Seuil dépassé à l’action | Fin des niveaux |
| --- | ---: | ---: | ---: | --- |
| SYME | 3 | 6 sur 6 · WIN | 44 | 9, 21, 36, 44, 58, 78 |
| DNOI | 3 | 6 sur 6 · WIN | 29 | 3, 9, 17, 29, 47, 59 |
| CASC | 1 | 0 sur 6 · aucun plan applicable | — | — |

Le rejeu charge la partie neuve et le pack `solver: 'sic'` dans le worker normal. Le seul fournisseur de plans enregistré est `sic_field_repair`. Le navigateur vérifie avant chaque clic le fournisseur, l’autorité `sicOnly`, le sous-objectif et la stratégie. L’observation, l’exécution et le garde WHY/ACT restent communs. La réparation combine des correspondances mesurées et, lorsque plusieurs observations indépendantes concordent, des votes dans les groupes formés par les symétries ou les répétitions. Elle teste un clic avec **OP18** et vérifie la cellule cible, la conservation du reste du champ et le nombre de pixels modifiés en périphérie. Les changements de niveau et la victoire proviennent du retour du jeu.

Empreintes SHA-256 de la suite des commandes et des retours publics agrégés. SYME `e6d71fdf0471b4c27f1f8d0baad16a7d44dc2f9a2d8220105d66d10ad515a603`. DNOI `82425afb37b8c38d0d348cd2744f8595b38ad294914fecbb0b96c077f50c5182`.

La campagne complète de 100 jeux a retrouvé les deux victoires. TRIA a reçu un clic SIC et s’est arrêté sans gagner de niveau. Les 97 autres jeux se sont arrêtés avant la première action. La campagne s’est terminée sans erreur de chargement ou d’attribution de plan. Sur SK48, un essai de la composition déplacement, contact et ordre de référence sur le vrai jeu a retrouvé la contradiction à l’action 12 et a ouvert le niveau 2 à l’action 19. Cet essai direct des opérateurs reste hors du compteur SIC seul. La projection courante du niveau 2 demande de distinguer une poussée, une entrée et un maintien durant la rétraction.

Le rejeu de non-régression compare les commandes et tous les retours publics entre le parcours de référence, le mode shadow et l’agenda actif. Aucun écart sur SK48 (19 actions, 1 niveau), AS66 (19, 3), SYME (9, 1), LKEY (44, 3) et CASC (1, 0, arrêt `frontier_unknown`). Ces parcours utilisent le mode habituel du Playground.

La référence 0.65 relancée sur la même machine donne 11,173 s pour STCK et 22,456 s pour SMLP. Comparée à la première fenêtre du candidat, elle donne +10,47 % et −22,05 %. Les commandes et les niveaux attendus concordent. L’écart STCK reste au-dessus du seuil dans cette comparaison indicative. La qualification finale demande des séries alternées sans campagnes concurrentes.

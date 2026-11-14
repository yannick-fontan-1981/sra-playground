# Généraliser SIC seul après les niveaux 1

Le commit `d322509d` couvre les 100 premiers niveaux, attestés par les qualifications successives. Le chantier prend ces 100 entrées et les parcours complets de DICO, DNOI, HANO et SYME comme référence. Le rejeu intégral lancé au départ vérifie que les résultats coexistent sur le même moteur.

[Inventaire observé des 100 jeux et des familles de remplacement](sic-v8-family-inventory.md).

## Mesurer les dépendances

- Pour chaque partie, relever les familles et les primitives qui ont effectivement choisi une commande, les conditions qui les ont départagées et le résultat de la vérification au retour. Consigner une seule durée de résolution par niveau.
- Retirer une famille du registre et de l’agenda avant une partie neuve. Rejouer sous SIC seul et relever le nombre de niveaux, le premier choix qui diverge et la première relation que SIC ne sait plus établir. Le premier lot couvre les huit derniers niveaux 1 ajoutés et le niveau d’entrée des quatre jeux terminés.
- Distinguer les victoires obtenues par une autre famille de la reconstruction effective. Pour compter une reconstruction, la trace doit montrer la relation formulée après une observation, confirmée par un retour distinct et réutilisée pour motiver une action. La victoire reste un résultat mesuré séparément.

## Décomposer et transférer

- Partir d’une dépendance observée et isoler le fait manquant. Une première piste est le déplacement d’un sprite vers une cible avec contrôle du retour. KLOT, KA59 et SNAR offrent trois situations distinctes pour tester la même primitive.
- Exposer cette capacité en terme de besoin, de faits observables et de conséquence vérifiable. Par exemple, P05 mesure un effet directionnel encore ambigu. P07 devient applicable lorsque le retour confirme un déplacement utilisable et qu’un trajet reste à parcourir. Après une contradiction, SIC met à jour les faits et l’agenda choisit de nouveau la primitive. Chaque primitive a ses propres conditions et priorités configurables.
- Décliner les cartes selon le mode global. En exploration, privilégier les essais qui départagent des hypothèses. En assimilation, rechercher une confirmation indépendante et réutiliser les acquis applicables. En résolution, préférer un plan qui exploite les effets confirmés et rouvrir une question si le plan est contredit. Le mode s’appuie sur les acquis et les contradictions observés à l’échelle du jeu et des niveaux.
- Tester le transfert sur des jeux tenus hors de la mise au point. Les noms de jeu servent au choix des parties d’évaluation. Les déclencheurs consomment des faits observés pendant la partie. Une permutation de la palette mesure la dépendance aux couleurs. Un essai sur un autre jeu mesure le transfert de la capacité.

Un échec de repli conduit d’abord à retrouver la première preuve qui manque, en comparant le rejeu avec et sans retrait. Si la décision existe déjà, on réutilise sa primitive et on complète soit le fait observable qu’elle consomme, soit le test qui peut l’établir. Une nouvelle primitive sert à une décision récurrente encore absente du catalogue. Une nouvelle famille est utile quand plusieurs situations exigent de conserver et de vérifier les mêmes faits entre commandes. Le résultat prioritaire est la victoire avec retrait sur des niveaux réels. Les permutations de couleurs et de commandes vérifient ensuite les hypothèses du repli.

## Vérifier chaque remplacement

Le passage au composant commun demande un rejeu avec retrait de la famille ciblée, les 100 niveaux 1 et les quatre parcours intégraux sous SIC seul. Comparer les gains, les commandes, les contradictions, l’autorité de décision et la durée par niveau. Une modification des commandes est acceptable lorsque les preuves et les résultats restent vérifiables. Garder la première divergence et le nombre de jeux où la primitive contribue réellement.

Les niveaux 1 restent prioritaires. La campagne systématique des niveaux 2 reprend quand les 100 niveaux 1 sont gagnés sous SIC seul après retrait de la famille habituelle, avec preuves du repli par des familles et primitives réutilisables. La référence de retrait est figée sur le rejeu normal du runtime `07e5e687` pour suivre les gains sans faire changer la famille retirée au fil des mises à jour. La campagne des niveaux 3 suit celle des niveaux 2.

## Premiers retours

Sur le moteur de référence, le navigateur confirme les quatre victoires intégrales sous SIC seul. HANO gagne 4 niveaux en 60 commandes, DNOI 6 en 59, DICO 6 en 71 et SYME 6 en 78. La réparation du champ est la seule famille commune à deux de ces parcours, DNOI et SYME.

Le premier lot de retraits, sur les niveaux d’entrée, conserve deux gains sur douze. DNOI et SYME gagnent encore en 3 et 9 commandes après retrait de la réparation du champ. L’apprentissage de correspondances fournit toutes ces commandes. La provenance de cette réutilisation est détaillée ci-dessous. MOTO et DICO s’arrêtent en 35 commandes. SNAR, SC25, PRTL, KLOT, TEQU, KA59, GIGO et HANO restent à zéro à la borne de 40 commandes. Toutes les commandes restent sous SIC. Le rejeu intégral confirme les 100 niveaux 1 sur le même moteur, en 1 250 commandes. Sur ces parties, 82 familles choisissent au moins une commande et cinq sont utilisées dans plusieurs jeux. Ce comptage inclut le fournisseur d’exploration des commandes publiques, utilisé dans 17 jeux.

## Correspondances acquises au cours de la partie

Une qualification avec retrait de la réparation du champ confirme que DNOI et SYME réutilisent une prédiction à la troisième commande, après deux retours concordants à des cellules distinctes. Sur SYME, une symétrie reste admissible. Sur DNOI, une symétrie et quatre périodicités prédisent la même valeur dans cette situation. Le compteur du panneau indique les relations compatibles avec la prédiction courante. La vérification de l’indépendance des sites et des retours est commune à la réparation du champ et à l’apprentissage de correspondances.

Sur la partie prolongée sans réparation du champ, l’apprentissage gagne deux niveaux sur six pour DNOI et un sur six pour SYME, avant que l’exploration locale atteigne sa borne. Les entrées de niveau 3 de DNOI et de niveau 2 de SYME servent à chercher le premier fait que l’apprentissage ne sait plus établir.

Le rejeu navigateur après extraction du contrôle commun conserve les 100 victoires de niveau 1 et les quatre parties complètes. Les 104 empreintes des commandes et retours publics correspondent à la référence. TRIA gagne encore son niveau 1 après retrait de la réparation du champ, en 20 commandes au lieu de 8. Ce gain utilise le mouvement couplé, l’accès par cavité et l’exploration, sans réutilisation de correspondance.

Le diagnostic des entrées de DNOI niveau 3 et SYME niveau 2 trouve une limite commune au modèle à une valeur exceptionnelle. Les observations soutiennent deux valeurs exceptionnelles. Hors agent, les prédictions issues de ces observations franchissent ces niveaux en 8 et 12 commandes. Ces trajectoires isolent l’extension à intégrer dans l’apprentissage et ne changent pas le nombre de niveaux attestés sous SIC seul.

## Plusieurs valeurs exceptionnelles

L’apprentissage évalue les désaccords appuyés par les symétries et répétitions visibles quand un seul marqueur ne suffit pas. Pour cette voie, la case et la valeur proposée doivent faire consensus entre les relations admissibles. La commande vise la valeur effectivement observée à cette case et chaque retour confirme ou écarte les relations candidates.

Sur des parties continues avec la réparation du champ retirée, DNOI gagne trois niveaux, contre deux au lot précédent. SYME en gagne trois, contre un. L’apprentissage fournit les 17 et 36 commandes respectives des niveaux gagnés. Au niveau 4 des deux jeux, l’exploration prend le relais et s’arrête après 40 commandes sans franchir le niveau. Les premières mesures en niveau 4 n’isolent aucun modèle admissible de symétrie simple ou de périodicité avec deux valeurs omises.

Le rejeu intégral conserve les empreintes des 100 niveaux 1 et des quatre parties complètes. Un diagnostic hors agent complète les niveaux 4 à 6 des deux jeux en s’appuyant sur la majorité au sein des groupes définis par les répétitions ou les combinaisons de symétries. Ce résultat reste à vérifier en parties continues sous SIC seul, avec la réparation du champ retirée.

## Majorité entre cases liées

La réparation du champ et l’apprentissage partagent le calcul des groupes de cases liés par une répétition ou deux symétries. Une proposition exige une majorité stricte avec au moins deux cases concordantes dans chaque groupe. L’apprentissage ne retient au départ que les relations qui demandent le moins de corrections. Il applique le contrôle de cohérence avec le dernier retour et exige deux confirmations indépendantes avant de déclarer une réutilisation.

Avec retrait vérifié de la famille de réparation, les parties continues de DNOI et SYME terminent leurs six niveaux en **59** et **78** commandes. L’apprentissage de correspondances fournit toutes les commandes. La réutilisation après deux retours indépendants en fournit respectivement **47** et **66**. Les 100 niveaux 1 et les quatre parties de référence terminées repassent dans le navigateur, avec les mêmes commandes et retours publics. HANO et DICO restent les témoins de généralisation pour les transferts ordonnés et les essais de sous-ensembles.

## Sélection et dépôt des pièces

Avec retrait vérifié du transfert ordonné, HANO termine ses quatre niveaux en **60 commandes**, toutes choisies par l’apprentissage des transferts. P05 fournit 16 commandes, P07 et P02 en fournissent 22 chacun. La sélection et le dépôt sont décidés séparément. La surbrillance recouvre parfois des pixels nécessaires à la mesure du support. SIC lie la dernière mesure complète à l’empreinte du retour qui confirme la sélection, puis vérifie les piles et les supports après le dépôt. Deux dépôts confirmés sur le niveau donnent accès aux primitives de réutilisation. La mesure des supports, la contrainte d’empilement et l’objectif indiqué par le réceptacle restent des hypothèses de domaine.

Le retrait est contrôlé par le banc de qualification avant la création de la partie. En résolution normale, le transfert ordonné garde la priorité. La voie d’apprentissage réutilise les mesures géométriques des supports et vérifie les retours de sélection et de dépôt avec ses propres propositions. Son agenda choisit P05, P07 ou P02 au moment de chaque commande.

| HANO · niveau | Transfert ordonné | Apprentissage après retrait |
| ---: | ---: | ---: |
| 1 | 2,80 s | 2,87 s |
| 2 | 3,74 s | 5,23 s |
| 3 | 9,47 s | 14,04 s |
| 4 | 32,40 s | 48,55 s |

Un passage par voie sous Node et Pyodide, avec le rejeu du catalogue sur la même machine. Les commandes et les retours publics sont identiques dans les quatre niveaux. La suppression de la famille demanderait de retrouver un coût comparable sur les parcours couverts.

Les 100 niveaux 1 et les quatre parties complètes reproduisent les commandes et les retours publics de la référence dans la configuration normale.

## Distinguer un changement de vue d’un test

Sur DICO niveau 1, la première commande change le groupe visible et conserve les huit candidats. Les retours d’animation des commandes suivantes réduisent les candidats de 8 à 6, puis à 2 et à 1. Le dernier test confirme le candidat restant et déclenche la progression. La voie de remplacement devra distinguer l’accès au groupe de la mesure d’un effet avant d’écarter des hypothèses.

Avec retrait vérifié de la famille d’essais de sous-ensembles, DICO termine ses six niveaux en **71 commandes**. La voie d’apprentissage choisit toutes les commandes avec P05 (46), P07 (9) et P02 (16). Elle réutilise la mesure géométrique des groupes et leur animation, puis sépare les retours de navigation, qui préservent les hypothèses, des retours locaux ou globaux, qui les filtrent. Une réponse incompatible avec l’hypothèse d’un seul candidat influent ferme cette voie pour la situation courante.

Dans un essai de transfert sur LF52, le niveau 1 passe en 31 commandes avec la même famille retirée. L’apprentissage choisit trois commandes et l’exploration publique en choisit 28. La voie garde la priorité existante pour les parties normales en attendant une comparaison de coût.

## Campagne de retrait sur le catalogue des niveaux 1

Les quatre jeux de référence disposent d’une voie de résolution vérifiée avec leur famille habituelle retirée. Les 100 niveaux 1 et les quatre parties complètes repassent avec les mêmes commandes, retours et attributions dans la configuration normale du commit `07e5e687`.

Le retrait systématique donne **6/100 niveaux 1 gagnés**. Ce chiffre mesure les victoires après retrait. La reconstruction par apprentissage se vérifie dans les retours et se compte séparément. L’[inventaire](sic-v8-family-inventory.md#retrait-de-la-famille-principale-sur-les-100-niveaux-1) rapporte les familles qui émettent des commandes et la diversité des familles retirées auxquelles elles succèdent.

Les niveaux 2 déjà attestés restent dans le référentiel. La campagne suivante se concentre sur les arrêts sans proposition et sur les essais où l’exploration produit des retours mais ne trouve pas de plan. Les premiers lots doivent isoler le fait qui manque pour passer d’un retour d’exploration à une décision de résolution, faire porter chaque décision par une carte de primitive réévaluée après le retour, puis vérifier la même carte sur des jeux tenus à l’écart de sa mise au point. Chaque gain est ensuite rejoué avec retrait et en configuration normale.

### Premier écart sur les déplacements

Le rejeu du runtime de référence gagne KLOT, KA59 et SNAR en 14, 15 et 16 commandes. Avec retrait, les trois parties atteignent 40 commandes sans gain. Sur KLOT, les quatre premières commandes directionnelles modifient seulement deux pixels chacune. La référence sélectionne d’abord une pièce. Sur KA59, les directions déplacent déjà des éléments pendant le repli, mais les premiers clics modifient au plus un pixel. La référence identifie d’abord la pièce contrôlée, puis constate un contact couplé dans une animation. Sur SNAR, le repli diffuse bien une commande de révélation. Les cellules découvertes doivent rester accessibles au planificateur après la disparition de l’écho.

Les premiers faits à publier sont donc la sélection effective d’un mobile, l’effet directionnel lié à cette sélection et les cellules praticables confirmées. Une carte d’exploration doit pouvoir produire ces faits avec P05. Une carte d’accès P07 doit les reprendre dans la même partie et vérifier son prochain déplacement. Le SRC peut choisir entre les offres admissibles à partir de ces preuves. Un [test SIC seul](../../tests/v6-native-runtime.test.ts#L129) vérifie déjà le chemin d’exécution d’un SRC de sélection remplacé en cours de session.

### Apprendre un trajet sur des cases révélées

SNAR gagne son niveau 1 en 17 commandes et 14,66 s lors du rejeu ciblé avec `sic_navigate_revealed_grid` retirée. Les 17 reçus sont exclusivement SIC et attribués à `sic_learn_grid_access`. P05 propose neuf commandes pour découvrir des cases, mesurer un déplacement ou observer si un obstacle libère le passage. P07 propose huit déplacements à partir d’un retour qui a montré la direction et d’une observation qui a montré la case praticable. La carte expose les deux références et les positions du mobile, de la prochaine case et de la cible. Empreinte du rejeu `fa3033b33140dfefd5e97473583108db0926775dada74ebcbb6316df0bc3050d`.

La même famille gagne SNAR sous une permutation de palette en présentant le jeu sous un nom neutre. Elle perd encore l’accès après permutation des commandes directionnelles. EVAS, CAVA et GMAP n’atteignent pas la victoire avec leurs familles habituelles retirées lors du premier essai de transfert. Le niveau 1 de SNAR normal garde sa trajectoire de 16 commandes. L’apprentissage de ce lot réutilise les cartes P05 et P07 du runtime SIC. Le transfert à une nouvelle géométrie et l’arbitrage local via SRC restent à vérifier.

Le rejeu normal des 100 niveaux 1 et des quatre parcours complets conserve les gains, le nombre de commandes et leur attribution par famille. Les quatre parcours complets repassent aussi avec retrait, pour un total de 22 niveaux gagnés avec les familles d’apprentissage déjà qualifiées.

Le lot suivant corrige une hypothèse du repli existant. Avec les commandes permutées, une commande mesurée pouvait être associée à la direction qu’une autre commande devait encore découvrir. Le repli revenait alors d’une case à l’autre ou s’arrêtait. P05 compare désormais les directions encore possibles pour la commande à mesurer. P07 utilise uniquement une direction observée. Le cas qui bloquait gagne en 19 commandes, avec retrait, et le rejeu avec les commandes d’origine garde les mêmes 17 commandes. Les 23 permutations non identiques gagnent aussi après retrait, avec la même famille d’apprentissage seule, en 17 à 40 commandes. Les 100 niveaux 1 en configuration normale repassent avec les mêmes nombres de commandes et les mêmes attributions qu’au rejeu de référence.

Sur KLOT, après retrait, le repli clique plusieurs pièces dont le contour réagit, puis enchaîne d’autres clics. Un essai isolé confirme qu’une direction testée juste après le clic déplace la pièce sélectionnée. Sur KA59, le clic de la référence modifie des indicateurs de sélection de seulement trois pixels. Une mesure du nombre total de pixels changés ne suffit donc pas pour faire le diagnostic. Les deux cas peuvent réutiliser P05 pour vérifier un contrôle lié à une sélection courante. P07 aura ensuite besoin d’un modèle des obstacles et de la cible. Sur KA59, le modèle doit aussi apprendre les déplacements couplés qui se produisent au contact.

Sur KLOT avec retrait, P05 est maintenant proposé par `sic_public_input_exploration`. Il essaie les directions déjà testées sans mouvement de pièce après un clic qui change la région visible. Sur le retour de la commande 16, le composant associé au clic à la commande 14 se translate de huit pixels vers la gauche. La preuve associe les deux retours à la même hypothèse de sélection. Cette preuve est disponible dans la famille d’exploration. P07 ne la consomme pas encore pour choisir un trajet. Sur KA59 avec retrait, `sic_coupled_motion` et `sic_public_input_exploration` restent les fournisseurs observés. Le nouveau test P05 vise le cas où les directions ne déplaçaient aucune pièce avant le clic. KA59 déplace déjà une pièce dans ce cas, et demande donc de comparer quel mobile répond avant et après la sélection. Les deux retraits restent sans victoire au budget de 40 commandes.

### Transmettre la preuve de sélection à un planificateur

KLOT gagne maintenant son niveau 1 en 30 commandes et 25,01 s sous SIC seul avec `sic_move_masked_pieces` retirée. Le runtime transmet la preuve de déplacement issue de la famille d’exploration à `sic_learn_selected_access`, uniquement pour l’observation qui l’a établie. Cette famille réutilise le planificateur de masques. Elle vérifie que la trace se rattache à une seule pièce et réduit les commandes possibles à celles compatibles avec le déplacement. Sur la commande 17, le retour contredit le modèle du mobile. Le repli révise cette association et reprend la mesure au lieu de conserver le préfixe. P07 choisit six déplacements vérifiés à partir de la commande 22. Les 30 reçus sont exclusivement SIC. Empreinte `5a2f20e21f5f1254102872d5ca30d278252701bb4eb8aec5a442f82f22dcea8f`.

Cette voie a un autre déclencheur et dépend du même calcul de trajectoire de corps rigides que la famille retirée. La généralisation attestée porte sur l’acquisition, la transmission et la révision des preuves. Le rejeu avec un nom neutre et une permutation de palette remporte aussi le niveau en 30 commandes sous la même autorité. Il reste à vérifier que le déclencheur et le planificateur se transfèrent à d’autres géométries.

Sur KA59, deux essais partent du même écran. La même direction déplace de trois pixels la pièce de gauche avant sélection, puis la pièce de droite après un clic sur son centre. Plus loin, un contact de la pièce de gauche projette l’autre de quinze pixels à travers la séparation. Le premier effet fournit un contrôle de sélection vérifiable. Le dernier exige encore d’apprendre une transition de contact distincte du déplacement ordinaire.

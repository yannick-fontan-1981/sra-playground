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

Les niveaux 1 restent prioritaires. Sur `341b6cb1`, le rejeu gagne les 100 niveaux 1 sous SIC seul après retrait de leur famille habituelle. Ce résultat ouvre le chantier de généralisation avec les niveaux 1 et les quatre jeux terminés. La référence du premier retrait reste figée sur le rejeu normal du runtime `07e5e687`. La campagne systématique des niveaux 2 reprend après le chantier de généralisation, puis la campagne des niveaux 3.

## Mesurer la généralité

Le retrait d’une famille mesure la redondance disponible dans le runtime. Le transfert sur un jeu tenu à l’écart de la mise au point mesure la réutilisation. Retirer à la fois la famille et son modèle de scène ou son planificateur mesure la dépendance à cette connaissance. Les trois résultats sont utiles. Un gain avec la famille retirée et le même planificateur compte parmi les replis vérifiés. La preuve de généralité doit préciser quelle connaissance a été retrouvée pendant la partie et quelle connaissance était déjà fournie.

Le test de transfert conserve le même code, les mêmes cartes et les mêmes paramètres sur plusieurs jeux. Il relève le fait qui déclenche la primitive, le retour qui l’établit, la commande qui le réutilise et les cas où le repli s’abstient. Les permutations de palette et de commandes complètent le test. Un motif visuel sert à produire une hypothèse. Un retour distinct doit pouvoir la confirmer ou la réfuter.

Le [rejeu des dépendances de planification](../../scripts/check-sic-planner-dependency.mjs) exécute trois configurations sur une partie neuve. `original` conserve le registre complet. `family` retire le fournisseur habituel du registre et de l’agenda. `planner` retire aussi le fournisseur de repli qui partage les mesures ou le calcul de trajet. Dans ce dernier mode, le rejeu neutralise les fonctions identifiées dans le module partagé et relève les appels interceptés. Un appel intercepté retourne le résultat vide prévu par la fonction. Les compteurs identifient ainsi les tentatives d’accès au modèle même quand un autre fournisseur termine le niveau.

Le lot couvre d'abord les niveaux 1 de KLOT et LS20 pour les déplacements, puis les niveaux 1 et les parties complètes de DICO, DNOI, HANO et SYME. Les noms servent à charger les parties et à déterminer le retrait. Le moteur reçoit les retours publics et les mêmes commandes disponibles dans les trois configurations. Le rejeu contrôle l’autorité de chaque commande et enregistre une durée par niveau, les fournisseurs réellement choisis et l’empreinte des commandes et retours.

```powershell
node scripts/check-sic-planner-dependency.mjs DICO planner first 60
node scripts/check-sic-planner-dependency.mjs DICO planner complete 80
```

Chaque conclusion porte sur les fonctions explicitement neutralisées. Pour qualifier une reconstruction, le parcours doit aussi montrer quelle nouvelle preuve a été acquise et réutilisée. Le premier lot sert de base à l’extension du retrait aux autres niveaux 1.

Le premier essai sur `341b6cb1` retrouve le niveau 1 de **DICO** en cinq commandes dans les modes `original` et `family`, avec la même empreinte des commandes et retours. Le mode `planner` laisse le niveau ouvert après 60 commandes. L'exploration publique en fournit 40 et les essais de contrôles linéaires 20. Le niveau 1 de **DNOI** reste également ouvert après 40 commandes, toutes fournies par l'exploration publique. Les fonctions prévues sont neutralisées dans les deux essais. Aucun fournisseur actif n'a tenté de les appeler. Ces deux parcours donnent les premières situations de comparaison pour l'apprentissage des groupes de candidats et des correspondances spatiales.

Sans le modèle de supports ordonnés, **HANO** reste ouvert après 40 commandes. Un fournisseur de réception encadrée en choisit trois et l'exploration publique 37. Ce cas permet de vérifier si une première mesure de sélection donne ensuite un transfert réutilisable dans un autre contexte.

### Acquérir des correspondances par les retours publics

SIC mesure les espacements répétés entre des composants visibles. Une grille candidate doit être cohérente sur les deux axes. Cette lecture des pixels fonctionne sans les trois fonctions de mesure et d'inférence neutralisées dans l'essai. Les correspondances spatiales prédisent une valeur à partir de cellules sources visibles. La carte SRC `sic.verify_observed_interaction.choose` choisit P05 pour obtenir une confirmation indépendante. Après deux retours concordants à des adresses distinctes, elle peut choisir P02 pour réutiliser la relation. Un retour contradictoire retire les hypothèses qu'il infirme.

Avec les deux fournisseurs initiaux retirés et leurs trois fonctions neutralisées, **DNOI** gagne son niveau 1 en trois commandes et **SYME** en neuf. Le fournisseur de cellules répétées décide de toutes les commandes. Chaque partie commence par deux P05. DNOI réutilise la relation une fois et SYME sept fois. Les fonctions bloquées n'ont reçu aucun appel. Les deux jeux conservent les mêmes commandes avec un nom neutre et une palette permutée.

Sur `f20e48b0`, **DNOI termine ses six niveaux en 59 commandes** après le double retrait. Les 59 commandes et retours reproduisent le rejeu avec le seul retrait de la famille habituelle. Le SRC choisit douze P05 et 47 P02 après confirmations distinctes. Désactiver la règle P02 après les deux premiers essais change la suite. L'exploration publique reprend la main et le niveau 1 reste ouvert après 25 commandes.

Sur **TRIA**, qui n'a pas servi à mettre au point cette mesure, la carte de correspondance ne propose aucune commande. Avec le même modèle neutralisé, les autres fournisseurs gagnent en 20 commandes. Le parcours normal de référence en prend huit.

Au niveau 2 de **SYME**, la mesure retrouve toutes les cellules de la grille. Le premier modèle s'abstient parce que deux cellules en miroir portent des valeurs différentes. La variante suivante autorise une prédiction quand une seule des valeurs est déjà attestée par au moins deux autres paires concordantes. Lorsque les deux valeurs sont soutenues, la paire reste ouverte. Dans les deux cas, la réutilisation de la relation continue à dépendre des retours des commandes.

Sur `476b5e42`, **SYME termine ses six niveaux en 78 commandes** dans les deux projections, avec les mêmes commandes. Le SRC choisit douze P05 et 66 P02 soutenus par des retours distincts. La projection d'origine reproduit la trajectoire du premier retrait. DNOI reproduit ses 59 commandes et retours dans la même version, toujours avec les deux fournisseurs retirés et les trois fonctions neutralisées.

### Apprendre ce qu'un contrôle change pendant l'animation

Sur **DICO**, les premiers retours montrent deux effets. Le changement de groupe préserve les huit candidats. Un retour animé touche d'abord deux cases, puis reste local ou s'étend aux huit. SIC peut comparer les cadres successifs, distinguer les deux effets et réduire les candidats à partir du groupe effectivement touché. La nouvelle mesure part de sites régulièrement espacés et cherche des marques visibles associées à un contrôle extérieur au groupe. Cette association reste une hypothèse jusqu'au retour.

Avec les deux fournisseurs habituels retirés et les deux anciennes fonctions neutralisées, **DICO** gagne son niveau 1 en cinq commandes, avec quatre P05 et un P02. Le même trajet gagne avec un nom neutre et une palette permutée. La règle de réutilisation s'appuie sur la réponse du premier essai comparable.

Sur **LF52**, qui n'a pas servi à mettre cette mesure au point, le fournisseur s'abstient après le même retrait. L'exploration publique gagne en 28 commandes.

`sic_public_input_exploration` conserve le choix final d’une expérience disponible, le budget et la mémoire des tentatives. Les mesures et producteurs d’offres ont vocation à être réutilisables indépendamment. Le graphe des commandes observées est déjà un module commun. La reconnaissance de marqueurs répétés et la recherche de mouvement après un clic sont encore dans la famille d’exploration. La présence de carrés de marqueurs, l’ordre initial des commandes et l’absence de changement avant un clic portent chacun une hypothèse qui doit être testée sur plusieurs jeux. Une famille distincte est utile lorsqu’elle conserve un modèle vérifiable entre plusieurs décisions, comme des cases découvertes ou une relation entre une commande et un mobile.

La factorisation commence par les contrats récurrents effectivement observés, notamment mesurer un déplacement, vérifier l’objet contrôlé, apprendre un effet de contact, chercher un accès ou distinguer des candidats par un test. Les familles fournissent les observations et les opérations adaptées à leur scène. Les cartes choisissent une primitive selon le besoin, la situation et le mode de réflexion. Une preuve commune doit pouvoir être publiée par plusieurs familles et consommée dans le même format. Le runtime peut ensuite réévaluer la prochaine carte dans l’agenda ou via un workflow SRC. La première extraction utile porte sur la mesure du mouvement avant et après une commande et sa publication sous un format commun, à vérifier sur les retraits KLOT, KA59, LS19 et LS20.

L’exploration après un clic et l’accès à un motif utilisent maintenant la même [mesure des translations](../../src/sic/observed-translation.ts). Elle associe deux composants uniquement si leur masque et leur valeur correspondent de façon unique, puis renvoie les deux positions et le déplacement. Les familles choisissent la zone à observer et interprètent le résultat selon la situation. Le premier lot factorise la mesure. La publication d’une preuve de mouvement indépendante du fournisseur et son utilisation par un autre planificateur restent à mettre en œuvre pour LS19 et LS20.

Sur les retours directionnels hors changement de niveau du rejeu normal, la mesure retrouve des translations dans 4 retours sur 4 sur LS19, 14 sur 14 sur LS20 et 5 sur 9 sur KLOT. Sur KA59, elle s’abstient sur les 11 retours directionnels lorsque les deux pièces de même masque et de même valeur restent indiscernables dans la mesure globale. L’association doit alors être contrainte par la sélection, la position ou la relation de contact. KLOT et KA59 continuent à gagner avec retrait. LS19 et LS20 gagnent en configuration normale avec les mêmes commandes et retours que la référence, mais s’arrêtent à 40 commandes après retrait.

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

### Mesurer le déplacement du mobile et l’effet de contact

Avec `sic_translate_coupled_pieces` retirée, KA59 gagne son niveau 1 en 15 commandes et 12,30 s. La famille `sic_learn_contact_access` reprend la mesure de géométrie et le calcul de trajet de la famille retirée. P05 teste la sélection, une direction sans effet encore vérifié et le contact. P07 réutilise une direction dès qu’un retour a confirmé le mouvement attendu du mobile et la stabilité de l’autre pièce. Les 15 reçus relèvent exclusivement de SIC seul, avec huit P05 et sept P07. Empreinte `69617fabeca88d0e43c7e143e2470084e66fd2b0f31139262983666b393f98c7`.

Le retour de la septième commande montre l’autre pièce passer du rectangle `[30,30,32,32]` au rectangle `[45,30,47,32]`. La famille mémorise l’effet et le reçu du retour. Les cartes suivantes montrent la zone d’arrivée du contact. Le planificateur peut préférer ce déplacement lors d’un nouveau contact compatible. La victoire du niveau 1 vérifie l’acquisition de cet effet et la réutilisation des directions ordinaires. Une autre situation doit encore vérifier la réutilisation du contact. Le repli consomme ses propres preuves de sélection dans cette partie.

Les commandes et les retours publics de KA59 sont identiques au rejeu normal de référence. Le rejeu avec un nom neutre et une palette permutée gagne également en 15 commandes. LS19 garde son blocage après retrait au bout de 40 commandes. Ses observations demandent un modèle de contact avec un cadre.

### Réutiliser un déplacement observé par une autre famille

Le runtime rend disponible, à la demande, un reçu compact du dernier retour directionnel SIC. Il contient la commande, la famille qui l’a proposée, les références avant et après, la portée du niveau et les translations mesurées. La mesure ne s’exécute que lorsqu’une famille demande le reçu. Le reçu cesse d’être recevable après une autre observation ou un changement de niveau.

Avec `sic_framed_contact` retirée, `sic_learn_pattern_access` reprend la translation mesurée après la première commande. Sur LS19, cette commande provient de `sic_coupled_motion`. Sur LS20, elle provient de `sic_public_input_exploration`. Le planificateur rattache les composants qui bougent ensemble à un mobile sur la grille du motif. P07 propose les pas d’approche et P05 vérifie le passage sur le motif. Le calcul de trajet et les mesures de motif sont partagés avec la famille retirée. Le transfert mesuré porte sur la preuve du contrôle du mobile et son utilisation par un autre fournisseur.

LS19 gagne en 5 commandes et 1,93 s, dont deux P07 et deux P05 émis par le repli. Empreinte `873ad01cc34d5b61e4b7435c6da535142bb5a7c785a4a97d88d548b252313c6c`. LS20 gagne en 18 commandes et 6,59 s, dont onze P07 et trois P05 émis par le repli. Empreinte `28755dc6ddc8ba6922dcd8899d2d3970033e38e916f6df6ab7c4aecf6f471a74`. Les 23 commandes sont exclusivement SIC.

Les deux gains sont conservés sous permutation de palette avec un nom neutre. Après retrait sur FOGW, DC22 et SKBN, le repli de trajet vers un motif s’abstient et les parties atteignent le budget sans gain. Ces résultats bornent le transfert au besoin d’accès à un motif dont la grille et le mobile peuvent être liés au déplacement observé.

### Vérifier la réception et préserver les corps avant une poussée

FOGW remporte le niveau 1 en 18 commandes et 6,02 s après retrait de `sic_reception_access`. Le repli `sic_learn_reception_access` reprend la géométrie et le calcul d’accès existants. P05 teste la commande, retrouve le porteur après sa disparition et mesure les directions. P07 suit les déplacements confirmés vers le support et P02 teste la réception. Le reçu commun peut amorcer l’accès si sa translation correspond au porteur actuellement visible. Le rejeu gagnant mesure ses premiers effets dans la famille de repli. Empreinte `4711a8652d6ce194b1d75befd4d2a1bd814000e0ffabe9a2540c9452257e9e8e`.

SKBN remporte le niveau 1 en 22 commandes et 6,21 s après retrait de `sic_transport_contact`. Le repli `sic_learn_transport_access` reprend le calcul de transport. Sa première commande P05 est un déplacement qui doit laisser les corps en place. La famille vérifie ensuite chaque déplacement du contrôleur et chaque poussée. La première version attendait un déplacement déjà observé. La sonde concurrente poussait alors un corps avant que le repli puisse vérifier le trajet, et le planificateur classait sa nouvelle position comme une impasse. Empreinte `a1324d7a36761a108de431167b117c4134826347377f447efcdbfef65dafedc0`. Toutes les commandes des deux gains sont exclusivement SIC.

DC22 fournit déjà une translation de deux pixels dans les premiers retours de `sic_cavity_access`. Cette preuve peut aider à rattacher le mobile à la scène. La partie reste bloquée après retrait car il faut mesurer les effets des commandes distantes sur les passages et les composer avec les déplacements.

### Réutiliser les changements de passage observés

Après retrait de `sic_remote_support_route`, DC22 gagne en 24 commandes et 13,03 s. `sic_cavity_access` fournit les deux premières commandes. `sic_learn_remote_access` lie au mobile le reçu du retour directionnel puis reprend les 22 commandes suivantes. P05 teste deux commandes distantes et conserve pour chacune les pixels modifiés et la référence du retour. P07 fournit 17 déplacements et P02 réutilise trois fois une modification connue du passage. Toutes les commandes sont exclusivement SIC. Empreinte `6997cca01a66d05e3db7b9ed9179db941b751ee958dee6a44d4759e42a3c0af8`.

Le repli vérifie après chaque clic que le mobile et la cible restent en place. Lors d’une réutilisation, il compare le retour à la modification attendue ou à son inverse. La mesure de scène et le planificateur des passages sont partagés avec la famille retirée. Le transfert attesté porte sur l’identification du mobile à partir du retour d’une autre famille et sur la réutilisation des effets mesurés pendant la partie.

Le niveau passe également en 24 commandes sous une permutation de palette et un nom neutre. Les essais sur SWCH, VALV et CN04 restent à zéro après 40 commandes avec leur famille principale retirée. Le prochain test de transfert concerne les situations où une commande distante a déjà produit son effet sous une autre famille. La preuve du clic doit alors garder la zone ciblée et les régions qui changent, afin de distinguer ouverture de passage, changement de vue et modification isolée d’un champ.

### Transmettre les champs modifiés par un clic

Le runtime fournit à la demande un reçu du dernier clic qui modifie les champs visibles. Il contient le point cliqué, la famille qui a proposé le clic, les références des observations, la portée du niveau et les états des champs avant et après. Il expire au retour suivant. Le repli vérifie que le point correspond au contrôle visible et que les apparences sont encore celles du reçu avant de reprendre l’expérience.

VALV gagne le niveau 1 en 25 commandes et 17,80 s avec `sic_field_isolation` retirée. À la commande 16, `sic_public_input_exploration` modifie les champs en cliquant sur le bord du contrôle compact. `sic_learn_field_isolation` reprend ce retour, répète l’effet, vérifie le contrôle inverse, puis isole le champ non contributif. Les 16 premières commandes et les neuf suivantes relèvent exclusivement de SIC. Les deux familles d’isolation partagent les mesures de champ et les vérifications de réversibilité. Empreinte `ae953580daeb85198af62abb5833f0d6288d757913fbf7ea1b8fd045e5bd3ece`.

Le rejeu avec permutation de palette et nom neutre conserve le gain en 25 commandes. DC22 conserve son gain après retrait. STCK et SC25 restent bloqués au budget de 40 commandes. Sur SC25, une démonstration transitoire peut disparaître de l’image finale du clic. Le test suivant doit vérifier si la même transmission entre familles peut porter sur les images intermédiaires de l’animation.

### Transmettre les changements temporaires d’une animation

Un comparateur commun mesure les cellules qui changent dans les images intermédiaires puis retrouvent leur valeur de départ. Il exige qu’une image montre l’ensemble des cellules vues en train de changer. La famille consommatrice choisit les points à examiner. Le reçu indique la commande, sa famille et les observations qui l’encadrent. Il expire au retour suivant et ne traverse pas les niveaux.

SC25 gagne le niveau 1 en 17 commandes et 7,94 s avec `sic_reproduce_cue` retirée. La flèche initiale de `sic_cavity_access` déclenche une animation de 22 images. Quatre cellules s’allument puis retrouvent leur couleur de départ. `sic_learn_animated_cue` reprend ce retour, utilise P02 pour reproduire les quatre cellules, puis P05 et P07 pour mesurer et exploiter le déplacement du mobile. Les 17 commandes relèvent de SIC seul. Empreinte `b6f368973d4616b4cf6ddb47406d4ccfc6804c44b96c8ec7d6a01eb911206d69`.

Les 17 commandes suffisent également sous une palette permutée avec un nom de jeu neutre. La détection du panneau et le planificateur de préparation et d’accès restent partagés avec la famille retirée. L’essai atteste le passage de la preuve d’animation entre familles sur SC25.

Les 100 niveaux 1 repassent en configuration normale avec les mêmes 1 250 commandes et les mêmes retours. Les 16 victoires avec retrait sont vérifiées sur ce runtime. DICO, DNOI, HANO et SYME terminent avec et sans retrait. Avec retrait, leurs commandes et retours sont identiques à la référence correspondante.

Sur STCK, le rejeu avec `sic_marked_collection` retirée reste à zéro après 40 commandes. Un contre-essai hors agent vérifie que les deux éditions observées dans le rejeu normal suivies de Space gagnent depuis le plateau initial ou après un premier Space. Après le premier clic d’exploration qui retire une carte non marquée, la même suite ne gagne plus. Le prochain repli doit donc mieux choisir l’expérience d’édition avant de modifier la collection.

### Tester une édition indiquée par le plateau

La famille habituelle et l’exploration publique partagent la mesure d’une collection et la vérification d’une édition. Deux marques concordantes permettent de proposer un retrait à vérifier. L’ajout devient candidat après confirmation du retrait. Quand le dernier ajout est confirmé et que les marques ont disparu, le lancement du programme devient un essai distinct. Les cartes sont réévaluées après chaque commande et un retour stationnaire contredit l’édition attendue.

STCK gagne le niveau 1 après retrait de `sic_marked_collection` en trois commandes et 2,55 s. `sic_public_input_exploration` choisit les deux clics puis Space, qui obtient le progrès officiel après 21 images. Le rejeu avec palette permutée et nom neutre conserve la victoire en trois commandes. Le repli réutilise le détecteur de collection existant. Empreinte `f9726f143394f14c8e9b761ac54f0a956db11222209e899d938afcdb117e6b97`.

Le rejeu confirme les 17 victoires après retrait. Les 100 niveaux 1 en configuration normale et les quatre parcours complets de référence avec et sans retrait conservent leurs commandes et retours.

Les essais de retrait sur GLOB, CLRS et COMB ne gagnent pas leur niveau 1. Sur GLOB, les 31 commandes de repli ne modifient pas le plateau. Aucun des 34 nœuds du programme ne figure dans les 30 cibles de clic classées par surface. Un contre-essai place le mobile sur un nœud puis lance le programme. Les 66 images fournissent des observations pour les deux types d’instruction affichés. Le premier écart se situe dans le choix des cibles à essayer.

### Donner une chance aux petites cibles répétées

Quand l’unique commande sans point et quatre clics laissent le même plateau visible, l’exploration ménage des essais pour les groupes de rectangles de même taille entièrement absents des cibles habituelles. Elle prend d’abord un représentant central par groupe, conserve ses autres candidats et continue à écarter les commandes déjà testées sur ce plateau. La répétition suggère une expérience. Le clic doit produire un retour mesurable pour qu’une autre famille puisse en tirer parti. La première version faisait échouer TRIA après retrait et faisait passer CONN de 24 à 30 commandes.

Sur GLOB, avec `sic_program_origin` retirée, le premier candidat ainsi proposé change un seul des 34 nœuds. `sic_learn_program_origin` vérifie que ce nœud contient le point cliqué et que les autres nœuds gardent leur état. Il lance le programme et mesure les déplacements pendant l’animation, puis teste l’origine compatible avec l’arrivée recherchée. Les six premières commandes sont choisies par l’exploration et les trois suivantes par le repli. **GLOB gagne en 9 commandes et 8,12 s**. Le gain est reproduit en neuf commandes avec palette permutée et nom neutre. La mesure du programme et le calcul de l’origine restent partagés avec la famille retirée. Empreinte `4b061a7f529ccbf63ceb927261b20f84899b1fe284bf4db6da4ce4e30a6eb398`.

CLRS, ISOS et AR25 restent à zéro après 40 commandes avec leur famille principale retirée. Sur CLRS, le repli clique déjà sur le bon calque à la commande 10. Un seul pixel apparaît à côté du point cliqué. Hors agent, les quatre directions déplacent ce repère de cinq cases chacune et leur commande inverse restaure exactement le plateau avec le calque toujours sélectionné. Le comparateur de composants rigides ne retrouve aucune de ces quatre translations, car l’apparence du calque est découpée par le bord. Le prochain transfert doit rattacher le repère au clic puis s’en servir pour mesurer le déplacement.

La règle resserrée conserve le rejeu normal de CONN en 24 commandes et le repli de TRIA en 39. Les 100 niveaux 1 et les quatre parcours de référence avec et sans retrait conservent leurs commandes et retours. Le rejeu confirme les 18 victoires après retrait.

### Suivre le repère d’une pièce partiellement masquée

Après un clic, SIC peut transmettre l’unique pixel modifié avec le point cliqué, sa nouvelle valeur, la famille et les observations qui l’encadrent. Le reçu vaut pour le retour courant et le niveau courant. Une mesure commune suit ce repère dans la direction essayée quand sa valeur disparaît de son ancienne case et apparaît en un seul point compatible. La carte SIC montre le repère avec le calque et la référence.

CLRS gagne le niveau 1 sans `sic_layered_fit` en **17 commandes et 9,25 s**. Après quatre commandes de `sic_cavity_access` et six commandes de l’exploration publique, `sic_learn_layered_fit` reprend le repère apparu au clic. Il mesure une translation de cinq cases avec P05, puis exploite les transformations vérifiées avec P07. Le niveau passe également en 17 commandes avec palette permutée et nom neutre. La mesure des calques, la référence et le calcul de l’alignement restent partagés avec la famille retirée. Empreinte `b6b05608caf1b51cd3f01efc851ad0ede52e638115fc0d7caeba10a95f270e42`.

Le rejeu confirme les 19 victoires après retrait. Les 100 niveaux 1 et les quatre parcours de référence avec et sans retrait conservent leurs commandes et retours.

Les retraits testés sur ISOS, AR25, BP35 et GORI n’ajoutent aucune victoire. Sur GORI, l’exploration produit 22 animations en 40 commandes après retrait de `sic_animation_contact`. Le comparateur de trajectoires donne une expérience de clarification à la commande 13 et un point de contact à la commande 19. Un contre-essai hors agent reprend les 19 premières commandes et applique le clic calculé à partir du dernier retour. Ce clic gagne après 30 images. Ce résultat isole la preuve à transmettre entre familles.

### Transmettre une trajectoire avant le prochain clic

SIC mesure à la demande la trajectoire dans les images intermédiaires d’un clic. Le reçu contient les observations avant et après, le point testé, la famille et les régions qui motivent une proposition. Le repli l’admet sur le retour courant. Il compare un point de contact projeté et un point susceptible de préciser la trajectoire, en écartant les points déjà essayés dans ce contexte.

Sans `sic_animation_contact`, **GORI gagne en 15 commandes et 10,82 s**. L’animation de la commande 13 suggère un clic de clarification. Les 26 images de ce clic donnent ensuite le point de contact. Les 13 premières commandes viennent de l’exploration publique, les deux dernières de `sic_learn_animation_contact`. La même victoire tient en 15 commandes avec palette permutée et nom neutre. Le comparateur de trajectoires et la projection du contact restent partagés avec la famille retirée. Empreinte `df11bb6c94d9325a9a689a254ef621916f1c5277cb0dd7ad598e96437bf31242`.

Les 20 victoires après retrait sont confirmées. Les 100 niveaux 1 et les quatre parcours complets, avec et sans retrait pour ces derniers, conservent leurs commandes et retours. Le transfert ne débloque pas le niveau 1 de MEMO. FOGW conserve son gain après retrait avec son repli existant.

Sur ISOS, un contre-essai distingue la zone de travail de l’exemple affiché. Le clic dans la zone de travail modifie 76 pixels à l’intérieur et préserve l’exemple. La première modification de l’exploration touche 60 pixels dans l’exemple et aucun dans la zone de travail. La séquence qui gagne depuis l’état initial échoue après ce clic. Deux autres clics testés dans la rangée du bas préservent l’exemple et la séquence reste gagnante. La prochaine expérience doit donc privilégier une cible qui agit dans la zone de travail tout en vérifiant que l’exemple reste disponible.

### Vérifier une modification dans la zone de travail

Quand une zone vierge bornée contient une cible de même forme qu’une partie de l’exemple, l’exploration peut la tester. La carte montre la cible, la zone de travail et l’exemple. Le retour est accepté si des pixels changent à l’intérieur seulement. Cette mesure est accessible à la famille qui examine ensuite la forme apparue.

Sans `sic_facet_growth`, **ISOS gagne en 3 commandes et 2,61 s**. L’exploration produit le premier retour, qui change 76 pixels dans la zone de travail. `sic_learn_facet_growth` vérifie l’effet à la commande suivante, puis réapplique l’extension et atteint le prochain niveau. Le trajet et les retours correspondent au rejeu normal. Le rejeu avec palette permutée et nom neutre conserve la victoire en trois commandes. La détection de la géométrie de l’exemple et le calcul de la cible restent partagés avec la famille retirée. Empreinte `cfa123ebda88519e2a5678023784a2449be6381ccec41e40b4ade48ef515d39a`.

Les 21 victoires après retrait sont confirmées. Les 100 niveaux 1 et les quatre jeux complets avec et sans retrait conservent leurs commandes et retours. En configuration normale, sur 1 250 commandes, l’exploration publique en fournit 257 et 426 portent P02, P05 ou P07. Sur les 311 commandes des 21 victoires après retrait, l’exploration publique en fournit 114, les familles `sic_learn_*` en fournissent 188 et les autres familles en fournissent neuf. 166 portent P02, P05 ou P07. Ces deux types de comptage se recoupent.

Le rejeu avec retrait reste à zéro sur AR25, LOGI et HOLE au budget de 40 commandes. Sur LOGI, le clic de l’exploration à la commande 15 change l’état du bouton de gauche et de deux indicateurs distants. Hors agent, les deux boutons latéraux gagnent dans les deux ordres. Le bouton du milieu modifie un indicateur et aucune des trois suites testées après lui ne gagne en deux clics. Les trois boutons restaurent leurs valeurs et celles des indicateurs quand on les actionne de nouveau. Le prochain transfert pourra s’appuyer sur les deux rangées observées avant et après le clic.

### Comparer deux contrôles avec une carte SRC

Une nouvelle carte SRC reçoit plusieurs cibles admissibles et choisit celle qui donnera le plus de contraste spatial avec le contrôle déjà essayé. TypeScript fournit les mesures des deux rangées, la comparaison avant/après et la liste des cibles. Le SRC choisit parmi elles. Le garde SIC lie le clic à l’observation courante et le moteur mesure ensuite l’effet sur les indicateurs ou le progrès officiel.

Sans `sic_display_coupling`, **LOGI gagne en 16 commandes et 11,13 s**. L’exploration choisit les 15 premières commandes. À la limite entre deux commandes, le workflow `sic.contrast_controls.choose` choisit le bouton droit, qui gagne. Avec le même préfixe et le même code de mesure, remplacer dans le graphe l’ordre du plus éloigné par celui du plus proche sélectionne le bouton du milieu et le niveau reste en cours après la 16ᵉ commande. Les deux reçus identifient le workflow et sa version exécutée. La victoire d’origine tient aussi en 16 commandes avec palette permutée et nom neutre. Empreinte `3797729448d2e3d6d720ba051f04ca60f7f6edd592a791f45461226058f1bc4f`.

La carte est modifiable par l’API d’édition du graphe à une frontière scellée. Il reste à connecter l’atelier Stratégies et à démontrer le transfert de la carte sur un autre jeu. La résolution dépend encore de l’observation des rangées et des preuves produites pendant l’exploration.

Les 100 niveaux 1 et les quatre parcours complets avec et sans retrait conservent leurs commandes et retours. Les 22 victoires après retrait totalisent 327 commandes, dont une choisie par la carte SRC. La carte ne déclenche aucune commande lors de 12 essais de retrait supplémentaires sur VALV, SWCH, SEQN, MEMO, LKEY, HOLE, CLRS, ISOS, GLOB, STCK, SC25 et GORI.

La carte dispose de deux workflows locaux. `choose` vérifie le besoin de comparer les effets distants, admet les modes exploration et assimilation, et vérifie qu’un seul bouton a changé et qu’au moins deux indicateurs ont réagi. Elle choisit la primitive et la cible, puis demande de vérifier si au moins un indicateur change. Le runtime mesure ce nombre après le clic. Si le niveau continue, `check_return` compare la mesure au seuil choisi et renvoie confirmé, contredit ou indéterminé. Un passage de niveau établi par le jeu clôt la décision. L’agenda consulte à nouveau ses familles au retour suivant.

Les deux workflows sont stockés dans le graphe et utilisent l’interpréteur SRC existant. Le fournisseur TypeScript mesure les rangées, récupère le reçu du dernier clic et lie la cible à l’observation courante avant exécution. Le rejeu conserve le clic gagnant à droite après retrait de `sic_display_coupling`. Une édition de l’ordre dans `choose` sélectionne le bouton central. Le reçu de `check_return` indique alors un indicateur changé et le jeu reste au même niveau. Confirmer un effet local satisfait cette expérience, tandis que la victoire dépend du progrès officiel.

Le rejeu des deux workflows confirme les 100 niveaux 1 et les 22 victoires après retrait. Les quatre jeux terminés conservent aussi leurs commandes et retours, avec et sans retrait. Parmi les jeux présentant des rangées comparables, TICT fournit un deuxième cas à tester. Un clic rompt l’uniformité d’une case dans sa rangée et d’une case distante. Deux clics sur les autres cases de la rangée font progresser le jeu. Les cases modifiées ne sont plus reconnues comme des aplats. La mesure doit donc garder les régions délimitées avant le clic et comparer leur contenu même s’il devient non uniforme. La carte actuelle exige deux changements distants et n’a pas encore choisi de commande sur TICT.

### Suivre les mêmes régions quand leur apparence change

Le reçu du clic permet de comparer les régions délimitées avant le retour. Il garde le changement de chaque région même si ses pixels deviennent non uniformes. Le fournisseur retient les rangées utiles et les cibles essayées pendant le niveau. La même carte SRC peut lancer un premier essai sur une grille homogène, puis choisir une cible distincte après chaque effet distant confirmé. Un seul indicateur distant modifié suffit à justifier une comparaison. Les deux workflows restent les mêmes pour LOGI et TICT.

Avec `sic_public_input_exploration` retirée, **TICT gagne en 3 commandes et 2,57 s**. `choose` décide les trois clics. `check_return` confirme un changement distant après chacun des deux premiers, puis le jeu valide la victoire. Le rejeu avec palette permutée et nom neutre gagne également en trois clics. Dans un autre rejeu, modifier uniquement `minimumRemoteChanges` de un à deux dans le graphe après le premier clic empêche la deuxième décision SRC et laisse TICT au même niveau. Empreinte `fdd12e1cb499184936f154ba6885433e3b1255752669a2bbe35c2898196236c3`.

Le fournisseur TypeScript reconnaît encore les rangées et protège l’exécution. La décision passe par le SRC, et l’atelier Stratégies ne propose pas encore l’édition de ces workflows.

Avec l’exploration publique active, TICT gagne en cinq commandes. L’exploration fournit les trois premières, dont le clic qui change une case locale et une case distante. La carte SRC utilise ce retour pour choisir les deux dernières. Le retrait vérifie l’autonomie de la carte sur ce parcours. En configuration normale, l’agenda garde l’exploration active et consulte la carte dès que les faits justifient son intervention.

Les 100 niveaux 1 repassent en configuration normale. TICT reste à cinq commandes et les 99 autres conservent leurs commandes et retours. DICO, DNOI, HANO et SYME terminent avec et sans retrait en conservant leurs traces. Sur les 330 commandes des 23 victoires après retrait, le SRC en choisit quatre, une sur LOGI et trois sur TICT.

### Éditer une carte exécutable depuis Stratégies

Le panneau Stratégies expose le seuil de déclenchement, l’ordre de choix des cibles et le seuil de vérification de la carte de comparaison. L’aperçu exécute la carte active et le brouillon sur les faits du dernier choix SRC enregistré. Il indique le clic et le critère de vérification, ou l’abstention. L’application met à jour le programme du graphe de la session entre deux commandes. Si le graphe change après l’aperçu, il faut relancer la comparaison.

Sur TICT dans le navigateur, avec SIC seul et l’exploration publique active, relever le seuil de un à deux changements distants fait passer l’aperçu du clic à l’abstention. L’interface enregistre ensuite la révision du graphe. Un rejeu par le même service applique les paramètres de l’éditeur après les trois premières commandes. Au quatrième choix, la carte d’origine exécute le clic à droite. Avec le nouveau seuil, l’exploration publique reprend la main. Le réglage s’applique à la session courante.

Avec les réglages d’origine, les commandes et retours des 100 niveaux 1 et des quatre jeux terminés restent identiques. Les 23 victoires après retrait repassent, ainsi que les quatre jeux terminés après retrait.

Le diagnostic suivant porte sur HOLE. Après retrait, l’exploration fait défiler la couleur active, puis recolore les trois régions d’une même couleur alors que la légende attend deux couleurs. Hors agent, le retour de la deuxième pression de Space confirme la couleur de deux régions. Les peindre, sélectionner l’autre couleur et peindre la dernière région donne le progrès officiel. Le prochain transfert doit retenir la correspondance entre chaque région et son exemple pendant que le plateau est encore lisible, puis réévaluer la commande à chaque retour.

### Appliquer les correspondances d’une légende en SRC

Le fournisseur retient les régions et les correspondances mesurées sur le plateau lisible. Après chaque commande, il fournit les régions encore à corriger et celles qui correspondent à la couleur active. Le workflow `sic.match_visible_example.choose` choisit de réutiliser cette couleur ou de sélectionner celle indiquée par la légende. Le workflow de vérification exige l’effet attendu et la préservation du reste de la zone de travail.

Après retrait de `sic_legend_recolor`, **HOLE gagne en cinq commandes et 3,84 s**. La carte SRC sélectionne une couleur, remplit deux régions, sélectionne l’autre couleur puis remplit la dernière région. Le résultat tient avec une palette permutée et un nom neutre. Les commandes et retours sont identiques au rejeu normal. Dans un rejeu avec édition du graphe après le premier clic, désactiver la réutilisation de la couleur active fait sélectionner de nouveau la même couleur et le niveau reste en cours après cinq commandes. Le fournisseur conserve la mesure topologique partagée avec la famille retirée. Empreinte `012c8aaf2cae6c42b84cff41bc39f11d4d9a76d61fdd2817e600c406ea372ebb`.

La campagne conserve les commandes et les retours des 100 niveaux 1 en configuration normale et des quatre parcours complets DICO, DNOI, HANO et SYME, avec et sans retrait. Les 24 niveaux 1 requalifiés après retrait totalisent 335 commandes SIC seul, dont neuf choisies par le SRC. Le test de transfert n’a déclenché aucune commande de la carte de légende sur CLRS, GRIL et AR25. CLRS gagne toujours en 17 commandes après retrait. GRIL et AR25 restent ouverts au budget de 40 commandes.

### Donner la priorité à un essai justifié avec l’exploration active

Le premier essai de la carte de comparaison est évalué avant l’exploration publique générale. Il requiert des rangées de régions homogènes et alignées, avec plusieurs rangées susceptibles de recevoir l’effet. Sur TICT, la carte choisit le premier clic puis deux clics guidés par les retours. Le niveau est gagné en trois commandes SIC seul, contre cinq avec l’ordre précédent. Le nouveau rejeu conserve exactement les commandes et retours du test où l’exploration était retirée. L’exploration reste active tout au long du nouveau rejeu.

Relever le seuil de déclenchement après le premier clic fait choisir la suite par l’exploration publique. Si le seuil de vérification du retour est relevé à deux, le deuxième clic fait réagir un seul indicateur. Le reçu est marqué contredit, la carte s’abstient au choix suivant et l’exploration gagne en trois commandes supplémentaires. Le rejet est lié au reçu de ce clic. Un nouveau retour peut donc alimenter un autre choix.

Les 100 niveaux 1 repassent avec SIC seul. TICT est la seule trajectoire qui change. Les 24 victoires après retrait et les quatre parcours complets avec et sans retrait conservent leurs commandes et leurs retours.

Sur GRIL, avec `sic_catalogue_comparison` retirée, l’exploration publique commence déjà par un changement de vue. Le retour conserve le cadre et les références du catalogue, expose une valeur de fond et ramène les trois formes à une seule compatible. La deuxième commande publique restaure la vue initiale. Hors agent, quatre des 36 séquences comparées gagnent. Elles combinent les deux entrées qui révèlent le fond et sélectionnent à chaque fois la seule forme compatible. Les trois clics de soumission produisent chacun 63 changements visibles au premier sujet, indépendamment de la compatibilité de la forme. Pour intervenir après la première commande publique, une carte doit donc retenir la preuve de compatibilité produite par le changement de vue et vérifier séparément le progrès officiel.

### Reprendre une comparaison après un changement de vue

Le runtime mesure à la demande ce que le dernier mouvement a révélé dans une zone dont le cadre et les références sont restés stables. Il fournit la commande, les références avant et après, et la valeur de fond révélée. La carte SRC `sic.resolve_observed_ambiguity.choose` peut alors choisir une forme unique, changer de sujet ou demander une vue supplémentaire. Le fournisseur TypeScript partage la mesure des formes avec la famille d’origine.

Après retrait de `sic_catalogue_comparison`, **GRIL gagne en cinq commandes SIC seul**. L’exploration publique fournit la première commande et la carte SRC en choisit quatre. Le retour du premier clic indique seulement une soumission. Le sélecteur confirme le changement de sujet, la nouvelle vue ramène trois formes possibles à une et le jeu confirme le gain au dernier clic. Les commandes et retours sont identiques à la trajectoire de référence, empreinte `49a513dfb37eaa93918ae558e9f58e8805c02ba465d111877b1c5b9d49e4290e`. Le parcours gagne aussi avec un nom neutre et une palette permutée.

Désactiver l’envoi d’une forme unique dans le programme de la carte, après la première commande publique, change la décision suivante et laisse le niveau en cours après cinq commandes. Sur 45 premières commandes directionnelles du catalogue, GRIL est le seul cas qui fournit aussi les références et le fond requis par cette carte.

Les 100 niveaux 1 et les quatre jeux complets conservent leurs commandes et retours, avec et sans retrait sur les quatre jeux. Les 24 victoires déjà obtenues après retrait repassent. Avec GRIL, ce total atteint **25/100**, soit 340 commandes SIC seul, dont 13 choisies par le SRC.

Sur AR25, après retrait de `sic_reflected_placement`, l’exploration publique mesure des déplacements sur deux axes dans ses deux premiers retours. Hors agent, ces deux commandes permettent un trajet partiel de quatre déplacements, qui laisse le niveau ouvert. Après le troisième retour, le comparateur dispose aussi du sens inverse sur l’axe vertical. Il compose 14 déplacements qui gagnent, pour un total de 17 commandes. L’exploration publique seule reste au niveau 1 après 40 commandes. Le transfert reste à intégrer dans l’agenda.

### Réutiliser un déplacement et son effet couplé

La carte SRC `sic.coordinate_observed_motion.choose` reprend le reçu directionnel de l’exploration. Le fournisseur associe les deux translations à la pièce sélectionnée et à sa copie, puis vérifie leur cohérence avec l’axe visible. À chaque retour, la carte choisit entre appliquer un déplacement, changer de sélection ou mesurer une commande. Le calcul de couverture et la comparaison géométrique restent partagés avec le planificateur d’origine. La sélection de stratégie est exprimée avec le même constructeur de règles SRC que pour la comparaison de formes.

Avec `sic_reflected_placement` retirée, **AR25 gagne en 17 commandes SIC seul et 5,56 s**. L’exploration lance la première, puis le SRC choisit les deux essais suivants et les 14 déplacements. Les 13 déplacements intermédiaires confirment la projection et le quatorzième donne le gain officiel. Le rejeu conserve les commandes et retours d’origine, empreinte `79a55cb7b2a69f8c21b10535cf8c671246e17841b1ff5f295bff30039653817b`, et gagne avec un nom neutre et une palette permutée. Désactiver en cours de partie la règle qui applique un déplacement fait reprendre l’exploration et laisse le niveau ouvert après 17 commandes. Au départ des 100 premiers niveaux, AR25 est le seul qui fournit à la fois la géométrie de réflexion et des déplacements corrélés.

Les commandes et les retours des 100 niveaux 1, des 25 victoires précédentes après retrait et des quatre jeux complets avec et sans retrait restent identiques. Avec AR25, **26/100** premiers niveaux gagnent après retrait, en 357 commandes SIC seul, dont 29 choisies par le SRC. CAVA, CGWL et CWSE restent ouverts après 40 commandes publiques. Sur CGWL, le premier reçu directionnel identifie déjà un corps unique. Un prototype réutilise ce reçu et retrouve la trajectoire gagnante en 15 commandes après retrait de la famille de transport.

### Reprendre un transport depuis un déplacement observé

Après retrait de `sic_carry_to_frame`, **CGWL gagne en 15 commandes SIC seul et 5,39 s**. L’exploration fournit un déplacement et le reçu identifie un seul corps mobile. La carte `sic.transport_to_visible_target.choose` reprend sa direction mesurée puis choisit les 14 commandes restantes en arbitrant entre approche, prise, transport, dépôt et essai d’une commande. Le fournisseur partagé mesure l’accrochage par le changement de position de l’objet au contact, puis la coïncidence des déplacements. Le jeu confirme la livraison. Le trajet est identique à celui de la famille habituelle, empreinte `5220df2eaf6f89a0e088ad929d4b80e941c428fae787b8d81da5447d3b8c00ab`.

La permutation de palette et le nom neutre conservent le gain. Désactiver la règle de dépôt pendant la partie remplace l’interaction finale par un déplacement supplémentaire. Le niveau reste ouvert après 15 commandes. Le changement porte sur la décision SRC. La mesure des retours de transport reste dans le fournisseur TypeScript.

### Orienter des pièces déjà en place

Avec `sic_directional_reception` retirée, **CWSE gagne en six commandes SIC seul**. L’exploration fournit le premier déplacement. Le fournisseur le rattache au corps observé, puis la carte `sic.align_with_observed_receiver.choose` choisit cinq commandes. Deux essais mesurent les directions utiles. Un déplacement amène les pièces aux récepteurs, puis deux clics orientent le mécanisme vers les pièces dont la couleur diffère encore. Le nom neutre et la palette permutée conservent le gain. Désactiver la règle d’orientation après les quatre premières commandes rend la main à l’exploration et laisse le niveau ouvert après six commandes. La mesure des récepteurs et du mécanisme reste partagée avec la famille habituelle. Empreinte `04ac98078024c8e331ffa240036253203a00dcc0c88893084ba6c928bf0d86fb`.

Les 100 niveaux 1, les 26 précédentes victoires après retrait et les quatre parcours complets avec et sans retrait conservent leurs commandes et leurs retours. Avec CGWL et CWSE, **28/100** premiers niveaux gagnent après retrait, en 378 commandes SIC seul, dont 48 choisies par le SRC.

Sur CAVA, le premier clic utile arrive à la commande 19 de l’exploration publique. Il produit le même plateau qu’un clic au centre de la case d’arrivée. Un prototype reprend ce retour avec la famille habituelle retirée et gagne après six clics supplémentaires. En rejouant uniquement les sept clics qui modifient le plateau, le niveau gagne aussi. Le prochain travail porte sur le choix de ce premier essai, sur la comparaison de cibles du même type et sur l’intégration de la carte de navigation.

### Passer de l’essai au trajet après un saut confirmé

Après retrait de `sic_highlighted_route`, **CAVA gagne en sept clics SIC seul et 4,02 s**. La carte SRC `sic.follow_observed_landings.choose` choisit un essai P05 parmi deux cases à distance égale de la cible. Le premier retour place le sprite sur la case visée et renouvelle les cases mises en évidence. La carte choisit ensuite six commandes P07, une à la fois. Le fournisseur TypeScript mesure toujours les cases et classe les trajets admissibles. Les sept commandes et leurs retours sont identiques à ceux de la famille habituelle, empreinte `0fbbe16a8f1b47ec732708f4ab9132037bcc972efb781160f952d2143f34a1ad`.

Désactiver la règle P07 après le premier clic laisse l’exploration publique choisir les six commandes suivantes. Le niveau reste ouvert. La carte accepte aussi un reçu d’arrivée produit par l’exploration si le clic se trouve sur le sprite arrivé et que sa région a changé.

Sur le lot CAVA, les 100 trajectoires de référence et les quatre parcours complets avec et sans retrait sont identiques. Le premier rejeu de KLOT après retrait, mené en parallèle, a continué l’exploration jusqu’au budget de 40. Le rejeu ciblé avec le même code retrouve la trajectoire de référence en 30 commandes. La sensibilité de KLOT à la charge reste à reproduire avec un compteur de recherche.

Sur **AMZE**, la même carte SRC choisit un essai P05 puis deux sauts P07 avec `sic_indicated_jump` retirée. Le fournisseur mesure des flèches et leur alignement avec la cible. Après chaque essai, il relit le sprite arrivé et ses indications. Les trois commandes et retours sont identiques à ceux de la famille habituelle, empreinte `db4094d0ff20d649c2877073e36ae0aa7be871f4a140e53509627af3801dfd69`. Les deux jeux gagnent aussi avec un nom neutre et une palette permutée. Sur AMZE, désactiver P07 après le premier clic rend la main à l’exploration et laisse le niveau ouvert à la troisième commande.

La campagne commune CAVA et AMZE confirme **30/100** niveaux 1 après retrait, en 388 commandes SIC seul, dont 58 choisies par le SRC. Elle retrouve aussi KLOT en 30 commandes. Les 100 premiers niveaux en usage normal, les 28 victoires précédentes après retrait et les quatre parcours complets avec et sans retrait conservent leurs commandes et leurs retours.

### Confirmer un trajet à travers une animation

Avec `sic_lit_route` retirée, **EVAS gagne en trois clics SIC seul**. Le même programme SRC choisit P05 pour tester un trajet sans exposition visible, puis P07 pour les deux déplacements suivants. Le fournisseur confirme l’arrivée à la case attendue et retrouve une position intermédiaire dans l’animation avant d’autoriser la réutilisation du déplacement. Le jeu confirme le niveau au troisième clic. La palette permutée et le nom neutre conservent le gain. Désactiver P07 après le premier arrêt laisse le niveau ouvert après trois commandes. Les commandes et retours reproduisent ceux de la famille habituelle, empreinte `af6c7c4e88a7628f637a7aa7e2159823b27d8659c74864042c2ad51c92cda947`.

### Suivre des liens indiqués après vérification d’un prérequis

Après retrait de `sic_chart_route`, **GMAP gagne en cinq commandes SIC seul** avec la même carte SRC. Elle choisit deux commandes P05 vers un prérequis indiqué. La deuxième ajoute une couleur à l’inventaire. Les trois commandes P07 suivent ensuite la direction commune aux positions encore possibles. La troisième commande consomme la couleur. Son animation permet au fournisseur de vérifier le passage à une frontière. Le jeu confirme le gain sur la cinquième commande. Les commandes et retours reproduisent ceux du planificateur habituel, empreinte `2965646b168ce1b7f5b9723472b246d71d61d09e1782ba63c58793fa3ca11ef3`. La carte reçoit ces observations du fournisseur TypeScript partagé. Le rejeu gagne avec un nom neutre et une palette permutée. Désactiver P07 après l’acquisition fait reprendre l’exploration et laisse le niveau ouvert à la cinquième commande.

Sur REGN, la famille de référence est l’exploration publique elle-même. Hors agent, chacune des deux commandes disponibles hors réinitialisation anime le déplacement d’un sprite distinct. Répéter la même commande restitue exactement le plateau initial. Exécuter les deux commandes différentes donne le gain dans les deux ordres. Un prochain transfert pourra partir de la différence observée entre les deux retours pour apprendre la complémentarité des commandes et la réversibilité de la répétition.

La campagne commune EVAS et GMAP confirme **32/100** premiers niveaux après retrait, en 396 commandes SIC seul, dont 66 choisies par le SRC. Les 100 niveaux 1 en usage normal, les 30 victoires précédentes après retrait et les quatre jeux complets avec et sans retrait gardent leurs commandes et retours de référence.

### Comparer deux commandes disponibles

Avec `sic_public_input_exploration` retirée pour le test, **REGN gagne en deux commandes SIC seul**. La carte `sic.compare_available_controls.choose` teste une des deux commandes directionnelles disponibles. L’animation déplace un seul composant apparié sur les deux axes. Ce retour fournit une raison de comparer l’autre commande pendant que le premier effet est visible. La carte laisse le statut ouvert jusqu’au retour officiel. Les deux commandes et leurs retours reproduisent le trajet de l’exploration publique, empreinte `b00a56adad8180b9427c0ca84381383b025d051ab96a5c8ec1e9f01a1090c26c`.

Désactiver la règle de comparaison après le premier retour laisse le niveau ouvert après une commande. Le gain avec la carte active tient aussi avec un nom neutre et une palette permutée. Sur les 100 premiers niveaux, REGN est le seul départ qui présente exactement deux commandes directionnelles hors réinitialisation.

### Répéter une interaction dont l’effet est observé

Avec `sic_gated_cascade` retirée, **CASC gagne en six commandes SIC seul**. La carte de navigation partagée choisit un essai P05 et deux déplacements P07 pour placer le curseur. Elle choisit ensuite une impulsion P05. Le retour montre une propagation qui continue alors que le curseur reste sur la case attendue. P02 choisit de répéter l’impulsion et vérifie chaque retour. La sixième commande donne le gain officiel. Le fournisseur TypeScript partagé mesure le point de blocage, la propagation et les positions du curseur. Les commandes et retours sont identiques à la référence, empreinte `63fea697ab7a9cf49ec307c8e414721b652088f33255fb132c6a7a600579e1e8`.

Le rejeu gagne avec un nom neutre et une palette permutée. Désactiver P02 après la première propagation rend la main à l’exploration au cinquième choix et laisse le niveau ouvert après six commandes.

La campagne commune REGN et CASC confirme **34/100** niveaux 1 après retrait en 404 commandes SIC seul, dont 74 choisies par le SRC. Les 100 niveaux 1, les 32 victoires précédentes après retrait et les quatre jeux complets avec et sans retrait gardent leurs commandes et retours de référence.

### Placer des groupes après mesure des contrôles

Avec `sic_queued_placement` retirée, **COLM gagne en 20 commandes SIC seul**. Les six premiers retours de l’exploration mesurent les deux translations, réduisent la permutation à une seule hypothèse et établissent le sens du dépôt à partir d’une image intermédiaire. Après chaque retour, le modèle est associé à l’observation qui vient de le produire. La carte SRC choisit ensuite neuf préparations P07 et cinq dépôts P02. Le calcul des placements et l’observation de leurs effets restent partagés avec le fournisseur TypeScript d’origine. Le trajet après retrait diffère du trajet habituel, qui gagne en 17 commandes. Empreinte après retrait `ecd46ae97f9d95dd39739e82e071b5bae820aa1f22db4c50d721996a10ff8fe7`.

Le nom neutre et la palette permutée conservent les 20 commandes et le gain. Désactiver P02 au passage entre l’exploration et la carte empêche le gain en 20 commandes.

### Préparer la prochaine rencontre après un effet confirmé

Avec `sic_ordered_replenishment` retirée, **RECR gagne en trois commandes SIC seul**. Le premier essai public et son animation font passer l’équipe de la rencontre au recrutement. La carte SRC reçoit le passage vérifié, choisit un renfort avec P07, puis réutilise la commande de rencontre avec P02. Le calcul du renfort et le contrôle de l’ordre de l’équipe restent dans les mesures et projections TypeScript partagées. Les trois commandes et retours reproduisent la référence, empreinte `0c70c2e4be3f093b06a78b8b6bc9aa1724f5a9faaf826143c6d620c3029325a8`. Désactiver P07 après le premier essai rend la main à l’exploration et laisse le niveau ouvert après trois commandes.

Le nom neutre et la palette permutée conservent le gain de RECR. Sur GIGO, le deuxième essai public déplace les éléments contenus dans la pièce dans le même sens et du même pas. Un prototype rattache ce déplacement à la pièce sélectionnée et choisit cinq commandes supplémentaires avec la carte SRC. Le niveau gagne en sept commandes avec la famille habituelle retirée. Le résultat tient avec un nom neutre et une palette permutée et reste à qualifier sur le catalogue.

La campagne commune COLM et RECR confirme **36/100** niveaux 1 après retrait, en 427 commandes SIC seul, dont 90 choisies par le SRC. Les 100 premiers niveaux en usage normal, les 34 victoires précédentes après retrait et les quatre jeux complets avec et sans retrait gardent leurs commandes et leurs retours de référence.

### Relier des ouvertures après un déplacement mesuré

Avec `sic_nested_passage` retirée, **GIGO gagne en sept commandes SIC seul**. Le premier essai public est bloqué. Le deuxième fait bouger la pièce sélectionnée et son contenu. Le fournisseur associe le reçu au contour de la pièce et vérifie que le déplacement mesuré correspond au pas de la grille. La carte SRC choisit ensuite cinq commandes P07 ou P05 pour rapprocher les ouvertures et tester le changement de sélection. Le fournisseur TypeScript partagé calcule les alignements et vérifie les murs après chaque mouvement.

Le niveau gagne aussi avec un nom neutre et une palette permutée. Désactiver P07 après les deux essais publics laisse l’exploration choisir les cinq commandes suivantes et maintient le niveau ouvert. La trajectoire après retrait ajoute un essai bloqué aux six commandes de référence. Empreinte `48b27b2033f9321ea8a90d6eacd08c7b4e530231021287357bc0195e3ca92240`.

### Tester les commandes des ouvertures avant de les traverser

Avec `sic_link_openings` retirée, **PRTL gagne en six commandes SIC seul**. La carte de navigation commune commence par des essais P05 liés aux repères des deux ouvertures. Elle conserve chaque effet confirmé, teste le franchissement puis choisit P07 vers la sortie après le passage observé. Les mesures des repères et les vérifications du franchissement restent dans le fournisseur TypeScript partagé. Les commandes et retours reproduisent la référence, empreinte `2d4f52bd81c100ce13b0cafc0e2ee2561d106f0a78bef9b84468d3d4b3ef5682`.

Le nom neutre et la palette permutée conservent le gain. Désactiver P05 après le premier clic rend la main à l’exploration et laisse le niveau ouvert à la sixième commande.

La campagne commune GIGO et PRTL confirme **38/100** niveaux 1 après retrait. Les 440 commandes de ces victoires relèvent de SIC seul, dont 101 choisies par le SRC. Les 100 niveaux 1 en usage normal, les 36 victoires précédentes après retrait et les quatre jeux complets DICO, DNOI, HANO et SYME avec et sans retrait reproduisent leurs commandes et retours de référence.

### Mesurer un quart de tour puis vérifier sa réutilisation

Avec `sic_radial_connection` retirée et l’exploration publique active, **PIPE gagne en quatre clics SIC seul**. La carte SRC `sic.verify_observed_interaction.choose` choisit P05 pour mesurer le sens du quart de tour sur une tuile qui distingue les deux sens. Elle choisit P02 pour les trois clics suivants. Le calcul des dispositions connectées reste dans l’assembleur de ports TypeScript partagé. Chaque retour confirme les ouvertures attendues sur la tuile et vérifie les ouvertures des voisines, ou établit le gain officiel. Les commandes et retours reproduisent la référence, empreinte `9537f4eff9c22c027b3376d3a93cf17b4eb40cbbcb908ddecf23691b0d277c0a`.

Le gain en quatre clics tient avec un nom neutre et une palette permutée. Désactiver P02 dans le graphe après le premier clic laisse une autre famille SIC choisir trois entrées directionnelles. Le niveau reste ouvert au même budget.

### Réutiliser une commande observée pour régler une capacité

Avec `sic_window_coverage` retirée, **HPDL gagne en sept commandes SIC seul**. Les trois premières viennent de l’exploration de la famille d’accès. Les deux premières n’affectent pas les réglages. Au troisième retour, une commande directionnelle fait passer la capacité du premier récepteur de 1 à 4. La séquence, les domaines et les autres réglages se conservent. La carte SRC `sic.verify_observed_interaction.choose`, déjà utilisée dans PIPE, choisit P02 pour deux nouveaux essais. Les capacités prévues de 3 puis 2 sont confirmées. P05 teste ensuite le filtre du second récepteur et lance le programme. Le fournisseur TypeScript partagé calcule les réglages compatibles avec la séquence et vérifie chaque modification.

Le nom neutre et la palette permutée conservent le gain. Désactiver P02 après l’acquisition rend les deux décisions suivantes à la famille d’accès. Le parcours change et gagne également en sept commandes. Le parcours de référence gagne en trois commandes. Empreinte après retrait `b53d1e97bb943284ec2969334245d6bba994f0647dc3aac4106ede8e423c4b0b`.

Les campagnes PIPE et HPDL portent le total qualifié à **40/100 niveaux 1** après retrait, en 451 commandes SIC seul, dont 109 choisies par le SRC. L’exploration publique reste active dans 38 de ces 40 essais. REGN et TICT conservent leur gain dans les essais où l’exploration est retirée. Les 100 niveaux 1 en usage normal et les quatre jeux complets avec et sans retrait reproduisent leurs commandes et retours de référence.

La version PIPE–HPDL a également rejoué les 60 retraits restants du catalogue. Aucun de ces essais ne gagne. Dans les 46 cas où l’exploration publique reste disponible, 44 produisent au moins un changement visible. Parmi ces 46 cas, 39 atteignent le plafond de 40 commandes. Ces rejeux permettent de choisir les prochaines acquisitions à partir de retours déjà observés.

### Apprendre séparément la sélection et le dépôt

Avec `sic_slot_transfer` retirée, **SB26 gagne en neuf commandes SIC seul**. La carte SRC utilisée dans PIPE et HPDL choisit P05 pour tester la sélection du premier jeton, puis P05 pour tester son dépôt. La sélection est confirmée par le changement de bordure. Le dépôt est confirmé quand le jeton disparaît de la réserve et que la case contient la valeur prévue. P02 réutilise séparément ces deux interactions pour les trois jetons restants. P05 lance la séquence remplie et le retour confirme le gain officiel. Le fournisseur TypeScript partagé mesure la correspondance entre la séquence visible, les jetons et les cases.

Les commandes et retours reproduisent la référence, empreinte `f8a01c6e6c57dab7a60bd01309dfbef6df4743c5de8c9869ed4ea2dfa4cdb326`. Le nom neutre et la palette permutée conservent le gain. Désactiver P02 après le premier dépôt rend les sept commandes suivantes à l’exploration publique. Le niveau reste ouvert au budget de neuf commandes.

### Rattacher un déplacement à la pièce qui porte les connecteurs

Avec `sic_port_pairing` retirée, **CN04 gagne en 18 commandes SIC seul**. La première commande vient de la famille d’accès et déplace une pièce d’une maille. Le fournisseur vérifie qu’une seule pièce correspond au déplacement et que la position précédente reconstruite reproduit la vue avant la commande. La même carte SRC choisit quatre essais P05 pour les trois directions restantes et la rotation, puis 13 réutilisations P02. L’assembleur de ports partagé calcule les raccordements compatibles et contrôle les poses. Les commandes et retours reproduisent la référence, empreinte `2ca5cca4d493d40e38003380887a1cb178c887d645fdde548434b2a37b708205`.

Le nom neutre et la palette permutée conservent le gain. Désactiver P02 après le premier quart de tour laisse le niveau ouvert au même budget. Les commandes suivantes proviennent de la famille d’accès et de nouveaux essais P05.

Les campagnes SB26 et CN04 atteignent **42/100** victoires après retrait en 478 commandes SIC seul, dont 135 choisies par le SRC. Les 100 niveaux 1 en usage normal et les quatre jeux complets avec et sans retrait reproduisent leurs commandes et retours de référence.

### Retrouver la cible après un changement de surface

Avec `sic_switched_surface` retirée, **ETAG gagne en sept commandes SIC seul**. Une commande de la famille d’accès déplace la pièce d’un pas dans une ouverture et la cible cesse d’être visible. SIC reconstitue l’entrée en comparant les deux observations et conserve la dernière position mesurée de la cible. La carte SRC `sic.follow_observed_landings.choose` choisit quatre déplacements P07 vers l’ouverture de sortie, puis deux essais P05 pour vérifier la sortie et le contact. La mesure des ouvertures et la recherche du trajet restent dans le fournisseur TypeScript partagé.

Les commandes et retours reproduisent la référence, empreinte `fa59891322e73aeb1069b27230f36be95d4245bd53e3f195965b5f93c5ec4eaf`. Le nom neutre et la palette permutée conservent le gain. Désactiver P07 après le changement de surface laisse le niveau ouvert à la septième commande.

La campagne ETAG porte le total à **43/100** victoires après retrait, en 485 commandes SIC seul, dont 141 choisies par le SRC. Les 100 niveaux 1 en usage normal, les 42 victoires précédentes après retrait et les quatre jeux complets avec et sans retrait reproduisent leurs commandes et retours.

### Écarter des hypothèses à partir d’un contrôle sans effet sur l’outil

Avec `sic_surface_copy` retirée, **CD82 gagne en neuf commandes SIC seul**. La première commande de l’exploration publique laisse l’outil et la surface de travail inchangés. SIC compare ces deux observations et élimine les modèles qui prévoyaient un changement. La carte SRC `sic.verify_observed_interaction.choose` choisit cinq essais P05 et trois réutilisations P02 au fil de la copie. Le modèle TypeScript partagé conserve les hypothèses compatibles avec chaque retour et calcule les étapes qui rapprochent la surface de la référence.

Les commandes et retours reproduisent la référence, empreinte `10cfd4ca1bd7a8fbd1ef29cd82b4c79f7724ef3a742cf0e0a40666657de739cd`. Le nom neutre et la palette permutée conservent le gain. Désactiver P02 avant sa première utilisation rend les quatre dernières commandes à l’exploration et laisse le niveau ouvert au budget de neuf commandes.

### Transférer un déplacement mesuré entre des contrôles apparentés

Avec `sic_framed_reception` retirée, **GARE gagne en 11 commandes SIC seul**. Le premier clic de l’exploration publique déplace une pièce et fournit une relation entre le point cliqué et le déplacement. La carte SRC `sic.verify_observed_interaction.choose` choisit quatre réutilisations P02 lorsqu’un nouveau contrôle admet un déplacement compatible et six essais P05 pour vérifier les autres réceptions. Le fournisseur partagé apparie les bandes et mesure les translations et les remplacements après chaque clic.

L’empreinte du parcours après retrait est `28d81d8f96440fafbc86e2b4a73fb46f276d39515d3ae78342aa10c0ec939f09`. Le parcours de référence gagne en sept commandes. Le nom neutre et la palette permutée conservent le gain en 11 commandes. Désactiver P02 après le premier clic laisse le niveau ouvert au même budget.

Les campagnes CD82 et GARE portent le total à **45/100** victoires après retrait, en 505 commandes SIC seul, dont 159 choisies par le SRC. L’exploration publique reste disponible dans 43 de ces essais. Les 100 niveaux 1 en usage normal, les 43 victoires précédentes après retrait et les quatre jeux complets avec et sans retrait reproduisent leurs commandes et retours de référence.

### Relier le déplacement d’un contour à un cadre et à un repère

Avec `sic_outline_service` retirée, **ESCT gagne en 16 commandes SIC seul**. Une commande de la famille d’accès déplace le contour d’une maille. Le fournisseur confirme sa position d’origine, son arrivée et la préservation du cadre. La carte SRC `sic.follow_observed_landings.choose` choisit 12 déplacements P07 et trois essais P05 pour vérifier successivement l’ouverture du cadre, le changement de direction du repère et le contact final.

Les commandes et retours reproduisent la référence, empreinte `9861fc98ec4274351a8b2e035076a5356bd18a012440ce37a5933a6800e8357e`. Le nom neutre et la palette permutée conservent le gain. Désactiver P07 après le premier déplacement laisse le niveau ouvert. La famille d’accès choisit les 16 commandes.

### Recalculer le trajet de livraison après un déplacement observé

Avec `sic_pivot_cargo` retirée, **GABA gagne en 49 commandes SIC seul**. La famille de déplacement couplé fournit le premier essai. La pièce porteuse avance d’une maille et les cargaisons restent à leur place. SIC valide la vue précédente et le déplacement, puis calcule le trajet depuis la position réellement atteinte. La carte SRC `sic.follow_observed_landings.choose` décide des 48 commandes restantes, dont 40 déplacements P07, trois essais P05 et cinq réutilisations P02. Les retours vérifient les pièces déplacées, l’attache, la rotation et le dépôt.

Le parcours de référence gagne en 47 commandes. Le nom neutre et la palette permutée conservent le gain en 49 commandes. Après désactivation de P07 au premier retour, le niveau reste ouvert et SIC épuise ses propositions à la 44ᵉ commande. Empreinte après retrait `4c0535fed4795be259cc0651ddc053e32eeabcd9d5fb0a69081d1d51e0170ee2`.

Les campagnes ESCT et GABA portent le total à **47/100** après retrait, en 570 commandes SIC seul, dont 222 choisies par le SRC. Les 100 niveaux 1 en usage normal et les quatre jeux complets avec et sans retrait reproduisent la référence. Sur COLM, un rejeu parallèle a choisi le dépôt dès la septième commande et gagné en 18 commandes. Le rejeu isolé du même code retrouve les 20 commandes et retours de référence. À la même observation, une recherche arrêtée après 3 999 ou 7 999 projections propose le dépôt. La recherche complète, en 15 684 projections, propose d’abord de déplacer le groupe. Les deux parties gagnent sous SIC seul.

### Confier les transferts de jetons à la carte commune en usage normal

Le runtime SIC retire le sélecteur historique `sic_slot_transfer` de son agenda. Le fournisseur de mesure `sic_verify_matching_slot_transfers` utilise la carte SRC pour chaque commande. SB26 conserve les neuf commandes du niveau 1 et les 15 du niveau 2 en partie continue. Les 24 commandes et retours reproduisent la référence, empreinte `6936f8d27b9ebbb066c67bb5c333ae4f66f7fca624596128466c68789916cbb6`. Le comparateur vérifie que l’identifiant retiré ne figure dans aucune famille ni dans aucun groupe du runtime.

Dans cette configuration normale, désactiver P02 après le premier dépôt rend la main à l’exploration publique et laisse le niveau 1 ouvert après neuf commandes. Les contours, la lecture de la séquence et la validation du dépôt restent mesurés par le fournisseur TypeScript.

### Suivre le rôle indiqué par un repère visible

Avec `sic_symbol_contribution` retirée, **CRAF gagne en neuf commandes SIC seul**. La carte SRC `sic.follow_visible_instruction.choose` compare quatre rôles à l’observation courante. Elle peut retenir une sélection, le dépôt d’un opérande, l’application d’une transformation ou la livraison du symbole demandé. La carte commune `sic.verify_observed_interaction.choose` choisit quatre essais P05 et cinq réutilisations P02 après confirmation sur des retours distincts. La mesure des diagrammes, des repères et des effets reste dans le fournisseur TypeScript.

Les commandes et retours reproduisent la référence, empreinte `7c16581499aadaa9539c60d2d6a687e5fd72adc937576a4011ef7380c991a331`. Le nom neutre et la palette permutée conservent le gain. Désactiver la règle de sélection à la troisième décision rend la main à l’exploration publique. Le niveau reste ouvert au budget de neuf commandes.

### Déduire l’effet d’une commande des images intermédiaires

Avec `sic_arrange_turn_posts` retirée, **MOTO gagne en dix commandes SIC seul**. Les quatre premières directions exploratoires laissent la vue finale inchangée. Le cinquième essai, Space, produit 12 images. La pièce quitte son point de départ pendant l’animation puis le retrouve. Le reçu lie ce changement transitoire à la commande et à l’observation courante.

La carte SRC `sic.follow_observed_landings.choose` choisit ensuite deux sélections P05, deux déplacements de plots P07 et une relance P02. Le fournisseur partagé projette le trajet et vérifie la position de chaque plot. Le parcours de référence gagne en six commandes. Le nom neutre et la palette permutée conservent le gain en dix commandes. Désactiver P07 après la première sélection laisse le niveau ouvert au même budget. Empreinte après retrait `98a56abea338db79bc4866a2dfc57e255cb74902ce4528bf1f85685e29926a9b`.

Les campagnes CRAF et MOTO portent le total à **49/100** victoires après retrait, en 589 commandes SIC seul, dont 236 choisies par le SRC. Les 100 niveaux 1 en usage normal, les 47 victoires précédentes après retrait et les quatre jeux complets avec et sans retrait reproduisent leurs commandes et retours de référence.

### Choisir entre une case à tester et une réécriture observée

Avec `sic_window_relation` retirée, **FT09 gagne en quatre clics SIC seul**. Le fournisseur dérive les contraintes des fenêtres visibles et transmet à la carte SRC les cases en désaccord. La carte `sic.verify_observed_interaction.choose` choisit P05 pour les deux premiers clics. Le retour de chacune de ces deux cases établit la même réécriture. P02 peut alors choisir une case où cette réécriture satisfait aussi les contraintes. Le moteur vérifie l’effet réel des deux derniers clics.

Chacune des animations des cinq premiers clics exploratoires modifie temporairement 80 pixels. Les centres des cases mesurées restent inchangés. La disponibilité d’une réécriture repose sur les changements des cases après les clics ciblés. Le gain reproduit la référence, empreinte `aad75de79d835cace7021e511a80b8cfed9f1b3b1f5d32013ae43d3898be8940`. Le nom neutre et la palette permutée conservent les quatre commandes. Désactiver P02 après les deux premiers clics laisse le niveau ouvert au même budget.

La campagne FT09 porte le total à **50/100** victoires après retrait, en 593 commandes SIC seul, dont 240 choisies par le SRC. Les 100 niveaux 1 en usage normal, les 49 victoires précédentes après retrait et les quatre jeux complets avec et sans retrait reproduisent leurs commandes et retours de référence.

### Aborder des passages appariés après un déplacement confirmé

Avec `sic_paired_passage` retirée, **PORT gagne en 17 commandes SIC seul**. Le premier essai de la famille d’accès est bloqué. Le deuxième déplace la pièce d’une maille. Le fournisseur vérifie le départ, la nouvelle position et la direction utilisée. La carte SRC choisit 13 déplacements P07, un premier franchissement P05 et un second sous P02. Les positions d’arrivée et les repères éloignés permettent de vérifier les passages.

Après l’essai bloqué, les 16 commandes et les résumés des retours correspondent au rejeu de référence. Le nom neutre et la palette permutée conservent le gain. Désactiver P07 après le premier déplacement confirmé laisse le niveau ouvert après 17 commandes. Empreinte après retrait `7f00821450d8c56c8a8a80fa6cccfada84814c3347fe8cb6e732a05b41427978`.

### Utiliser les cartes en configuration normale sur CRAF et FT09

Le runtime retire `sic_symbol_contribution` et `sic_window_relation` de ses groupes. Sur CRAF, les cartes SRC choisissent le rôle de la commande et la primitive à chaque retour. Sur FT09, la carte choisit la case à tester ou la réécriture à réutiliser. Les deux niveaux conservent leurs commandes et retours de référence, en neuf commandes pour CRAF et quatre pour FT09. Le comparateur vérifie l’absence des deux anciens sélecteurs et la présence des fournisseurs de mesure actifs.

En configuration normale, désactiver la règle de sélection à la troisième décision sur CRAF ou désactiver P02 après les deux premiers clics sur FT09 redonne la main à l’exploration. Les niveaux restent ouverts après neuf commandes chacun. Les diagrammes, les fenêtres et les effets des clics restent mesurés par les fournisseurs TypeScript.

### Réutiliser les exemples lorsqu’une nouvelle question apparaît

Avec `sic_labeled_sequence` retirée, **CATL gagne en huit commandes SIC seul**. SIC soumet une première réponse P05 lorsque les hypothèses compatibles avec les exemples désignent le même contrôle. Si la question visible change après la commande et que les exemples restent valides, la carte SRC `sic.verify_observed_interaction.choose` autorise P02. Le fournisseur recalcule la réponse pour chaque question. La victoire officielle est observée après sept nouvelles soumissions.

Les commandes et retours reproduisent la référence, empreinte `7d52d817584ee80c6a9228ec50c442c86f2a695bf11c020b56a9926b3df29996`. Le nom neutre et la palette permutée conservent le gain en huit commandes. Désactiver P02 après la première soumission rend certains choix à l’exploration. Le niveau reste ouvert au même budget.

### Reprendre un assemblage après le marquage d’un composant

Avec `sic_material_assembly` retirée, **LIFE gagne en 26 commandes SIC seul**. Les 13 premières viennent de l’exploration publique. La dernière marque un composant sans changer le contenu des pièces. SIC vérifie que le point cliqué désigne une seule pièce et que le marquage se trouve autour de cette pièce. Le fournisseur retrouve le partenaire compatible et vérifie les remplacements, les sélections et les dépôts à chaque retour. La carte SRC choisit cinq essais P05 et huit réutilisations P02.

Le parcours de référence gagne en 14 commandes. Le nom neutre et la palette permutée conservent le gain en 26 commandes. Désactiver P02 avant sa première utilisation laisse le niveau ouvert à 26 commandes. Empreinte après retrait `2b9779ce96977cfff637d7eec694c362f45017d98677b243a48d4b6754e675cb`.

### Préserver la recherche après acquisition du déplacement

Un rejeu parallèle de KLOT avec la famille habituelle retirée reproduit les 16 premiers retours. À la 17ᵉ décision, la recherche du trajet s’abstient et l’exploration publique poursuit jusqu’à 40 commandes sans victoire. Le rejeu isolé retrouve les 30 commandes et retours de référence.

Sur la même observation, une horloge simulée de 0,25 ou 0,5 ms par lecture interrompt l’ancienne recherche avant qu’elle propose la première commande. Avec la borne de 18 s du planificateur source, la recherche retrouve la commande attendue après 24 510 lectures dans les deux essais. Cette borne s’applique au fournisseur qui a déjà acquis un déplacement. La limite de temps du niveau et les limites de recherche continuent de s’appliquer. Le rejeu complet corrigé gagne en 30 commandes, empreinte `5a2f20e21f5f1254102872d5ca30d278252701bb4eb8aec5a442f82f22dcea8f`.

La campagne PORT, CATL et LIFE sur `3a76dd93` porte le total à **53/100** victoires après retrait, en 644 commandes SIC seul, dont 276 choisies par le SRC. Les 100 niveaux 1 en usage normal, les 50 victoires précédentes après retrait et les quatre jeux complets avec et sans retrait reproduisent leurs commandes et retours de référence.

### Vérifier à nouveau une commande après un changement d’interface

**POLA gagne en sept commandes et ELAS en seize** avec l’exploration publique retirée. Le fournisseur commence par mesurer les directions disponibles. Il n’établit la situation que si elles laissent toutes le plateau inchangé et si la commande alternative change ensuite l’interface. Les tentatives sont mémorisées par état du plateau et commandes disponibles. La carte SRC `sic.follow_observed_landings.choose` autorise P05 pour un essai inédit ou P07 vers un état atteint lors d’un retour précédent. Sur ces deux parcours, elle choisit uniquement P05.

En configuration normale, l’exploration publique mesure les trois ou cinq premières commandes. Dès le changement d’interface, la même carte autorise les quatre ou onze commandes suivantes. Les commandes et leurs retours gardent les mêmes empreintes avec ou sans retrait. Les deux jeux gagnent aussi après permutation de palette et neutralisation du nom dans l’essai avec retrait. Désactiver P05 après le changement d’interface fait cesser les deux parcours à la décision suivante, avec ou sans exploration publique.

POLA `af28e8ed77e7f8213749f03f8665c9e86a7742aa1111586dd84eac30f19dfcd1`. ELAS `2119845733a0ef81f69633356411c9bfd91b3e746540095b50cd993b1aa673e6`.

Sur `18d988ee`, les **55/100 retraits gagnants** totalisent 667 commandes SIC seul. Les 100 niveaux 1 en configuration normale et les quatre jeux complets avec et sans retrait reproduisent leurs commandes et retours de référence.

### Tester les éléments linéaires répétés

Avec l’exploration publique retirée, **CATR gagne en trois clics, CONN en 23 et UPST en 12**. Quand le clic est la seule commande de jeu disponible et que des éléments linéaires de même longueur se répètent, le fournisseur compare leurs centres. Il mémorise les clics sans effet dans chaque état. La carte SRC choisit P05 pour chaque clic de ces trois parcours. Le panneau reçoit les limites de l’élément visé pour afficher son sprite. Lorsqu’un clic fait réagir un élément, les autres restent à vérifier dans leur contexte.

La palette permutée et le nom neutralisé conservent ces trois gains. Désactiver P05 après le premier clic interrompt les essais dès la décision suivante. L’exploration publique garde sa priorité en configuration normale. L’essai hors agent montre que classer uniquement par taille fait échouer CONN et UPST à 40 clics, même quand les clics produisent des effets visibles.

CATR `cc5a59b1ed6864bd002cdd0c32c24e3fcf405e27cc02b79ab06baaf6d91c3fed`. CONN `3b762dc9ae12072003f117e92150edf379a983f187b94d41faab32fe6044eb33`. UPST `cc8c0a6a86de9cacfffbf225243b69a10b29fc842d8d917c5180d1a939bf7068`.

Sur `57678993`, les **58/100 retraits gagnants** totalisent 705 commandes SIC seul. Le rejeu vérifie les 55 trajectoires gagnantes précédentes après retrait. Les 100 premiers niveaux en configuration normale et les quatre jeux complets avec et sans retrait conservent leurs commandes et retours de référence.

### Comparer les directions à partir de leurs retours

Avec l’exploration publique retirée, la même carte remporte **SEQN en quatre commandes, GRAV et COMB en cinq chacun, ONDE en deux et FITE en dix-huit**. Elle réévalue les commandes disponibles pour chaque état, donne la priorité aux essais inédits et diffère la direction inverse après un changement de plateau. Si un retour déjà mesuré mène à un état où un essai reste ouvert, P07 peut y revenir. Dans ces cinq parcours, P05 choisit les essais directionnels. Sur FITE, la famille d’accès par glissement fournit aussi deux commandes.

Les mêmes cinq jeux gagnent avec palette permutée et nom neutralisé. Désactiver P05 après le premier essai laisse chaque niveau ouvert à la décision suivante. POLA et ELAS conservent leurs commandes et leurs retours de référence après retrait.

### Vérifier une vue qui change et un échantillon qui reste stable

Sur **REWI**, le registre et l’agenda remplacent l’ancien sélecteur `sic_framed_search` par `sic_follow_stable_reference`. Le fournisseur TypeScript mesure la grande vue, le petit échantillon et les correspondances exactes. Après un premier essai P05, le retour établit que la vue a changé et que l’échantillon est resté identique. La carte SRC autorise P02 pour répéter la direction et vérifie ces deux effets au retour. Une unique correspondance devient ensuite une cible P05.

Le jeu gagne en trois commandes et reproduit l’empreinte `9a758416241620fd41236df69fbde31454b3b418d370b8159e8f6a1ce34b2c52`. Le nom neutralisé et la palette permutée conservent le gain. Désactiver P02 après le premier retour transfère la deuxième commande à la famille d’accès par glissement. Cette famille choisit la même direction dans cet essai et le parcours reste gagnant.

Sur `32f914b4`, les **64/100 retraits gagnants** totalisent 742 commandes SIC seul. Le rejeu confirme les 58 trajectoires gagnantes précédentes après retrait, les 100 premiers niveaux en configuration normale et les quatre jeux complets avec et sans retrait.

### Appliquer une configuration vérifiée

Les anciens sélecteurs de **SMLP** et **RSWP** sont retirés du registre. Les deux jeux gagnent en trois commandes SIC seul avec la carte `sic.apply_verified_configuration.choose`. Les fournisseurs TypeScript continuent de mesurer les trajectoires et les sélections visibles.

Sur SMLP, deux retours P05 mesurent les approches puis vérifient la modification du trajet. Les longueurs projetées passent de 13 et 17 à 17 et 17. P02 réutilise alors la commande de lancement. Sur RSWP, un premier clic P05 confirme la sélection tout en préservant les autres panneaux. P02 autorise la même démarche sur le panneau suivant. Le lancement conjoint reste un premier essai P05.

Les deux trajectoires reproduisent leurs empreintes de référence. Le nom neutralisé et la palette permutée conservent les gains. Désactiver la réutilisation de la sélection sur RSWP après le premier clic rend les deux commandes suivantes à l’exploration et laisse le niveau ouvert. Désactiver la réutilisation du lancement sur SMLP rend la dernière commande à l’exploration, qui choisit le même lancement lors de cet essai.

SMLP `98b11e4a22d936380c77194c26216bd0de53cc574f53053b0cce682508625582`. RSWP `53e34526abf02d4311004a9ad726c131b277a7e995f552afc95913845d7fbecf`.

Sur `08e4596b`, les **66/100 retraits gagnants** totalisent 748 commandes SIC seul. Les 64 trajectoires gagnantes précédentes après retrait, les 100 premiers niveaux en configuration normale et les quatre jeux complets avec et sans retrait conservent leurs commandes et retours de référence.

### Choisir entre tester un déplacement et réutiliser le modèle mesuré

Les anciens sélecteurs de **R11L, SU15 et VC33** sont retirés du registre. La carte `sic.follow_observed_landings.choose` choisit P05 pour mesurer un effet, P07 lorsqu’un déplacement repose sur les retours, et P02 pour tester un contact avec un contrôle connu. Les mesures de géométrie et les projections restent dans les fournisseurs TypeScript.

R11L gagne en trois clics. Les deux premiers vérifient le lien entre les repères et la pièce, puis le changement de sélection. Le dernier place le milieu à la destination. SU15 gagne en sept clics en vérifiant la portée et le coût de réserve avant de tester le contact. VC33 gagne son niveau 1 en cinq clics et conserve deux niveaux en quatorze commandes. La carte choisit réellement entre le prochain transfert prévu et un contrôle encore ouvert aux essais. Sur les trois jeux, la permutation de palette et la neutralisation du nom conservent le gain du niveau 1. Désactiver P07 change la suite et laisse chaque premier niveau ouvert à douze commandes.

### Tester les formes intérieures quand les touches ne suffisent pas

**SPOR gagne en dix commandes et SELE en dix-huit** avec l’exploration publique retirée. La recherche considère les cibles à l’intérieur du plateau qui ne remplissent pas leur rectangle englobant. Sur SPOR, la seule touche disponible coexiste avec le clic. Sur SELE, la comparaison s’élargit aux clics après des retours établissant que les touches testées laissent le premier plateau inchangé. La carte réévalue les touches et les cibles après chaque retour. Elle garde l’empreinte de l’état où chaque entrée a été testée.

La palette permutée et le nom neutralisé conservent les gains. Désactiver P05 après la première touche sur SPOR et après les trois touches initiales sur SELE arrête la recherche à la décision suivante. POLA et ELAS conservent leurs trajectoires avec le même fournisseur élargi.

SPOR `079729fb629eb587dbef6b04df1e58c37a661169b8cfd10a34bf537a0faa2c12`. SELE `9a503869250e719e48223a979ec297615f68b4d3b80d167347cd69651581e30e`.

Sur `986cb006`, les **71/100 retraits gagnants** totalisent 791 commandes SIC seul. Les 66 trajectoires précédentes après retrait, le catalogue normal et les quatre jeux complets avec et sans retrait gardent les mêmes commandes et retours. Le rejeu des deux niveaux déjà acquis de VC33 reproduit aussi les 14 commandes et leurs retours.

### Choisir les cibles de clic à partir de la zone qui réagit

Avec l’exploration publique retirée, **THER gagne en 25 commandes**. Après quatre commandes de la famille d’accès, quatre essais mesurent les directions dans le plateau. Le changement intérieur sous la commande alternative permet d’essayer les formes intérieures. Les commandes et retours reproduisent la référence.

**LF52 gagne en 19 commandes**, dont 17 de la carte commune suivies de deux du fournisseur qui vérifie l’effet sur le groupe. Les quatre directions modifient chacune un pixel de bordure. Dès ces quatre retours, la carte commence par tester les petits éléments visibles. Le premier de ces clics ne change que la bordure, ce qui maintient la question ouverte.

Le nom neutralisé et la palette permutée conservent les deux victoires. Désactiver P05 avant le premier clic laisse les deux niveaux ouverts. Le même fournisseur reproduit les trajectoires après retrait de SPOR, SELE, POLA et ELAS.

THER `4a30b3d9ed344cc3e67c989728a733fd88729729c63f4ea7b9ee46587d14eb49`. LF52 `143c844406ae4210b054f2fd5f34493081cb822b0f1b7a222a8d232bf9d85852`.

Sur `5f1b16ee`, les **73/100 retraits gagnants** totalisent 835 commandes SIC seul. Le rejeu vérifie les 71 trajectoires précédentes après retrait, les 100 premiers niveaux en configuration normale et les quatre jeux complets avec et sans retrait.

### Choisir une réponse à partir des retours observés

**MEMO, MIND et SERI** gagnent en dix, huit et quatre commandes SIC seul avec les anciens sélecteurs retirés. La carte SRC `sic.choose_from_observed_feedback.choose` permet d’avancer entre essais P05 et réutilisations P02 selon les retours. MEMO teste six occurrences mises en évidence, puis réutilise les correspondances qui désignent une même cible. MIND vérifie l’entrée des couleurs, recueille les marques du premier essai et réutilise la commande de soumission déjà observée. SERI teste la seule carte compatible, vérifie son insertion et réutilise la démarche sur les questions suivantes.

Les commandes et retours reproduisent les références. Le nom neutralisé et la palette permutée conservent les gains. MIND gagne alors en quatre commandes, dès la première soumission. Désactiver la règle P02 utilisée dans chaque parcours rend la suite à l’exploration publique. MEMO et SERI restent ouverts au budget de référence. MIND gagne avec la même dernière commande, cette fois fournie par l’exploration.

MEMO `40ac77f931014315cdeb289b623e971f165ce7962801671d5b2bda66f288e482`. MIND `d2af6be8e55804dace772b7227f902dc86056bea5dedae2a4b1532f3c0c87a50`. SERI `e327a63ace9a61f555be390a32afada20bce326a81e975542d70fc383278e13a`.

Sur `eb82031a`, les **76/100 retraits gagnants** totalisent 857 commandes SIC seul. Les 100 niveaux 1 en configuration normale et les quatre jeux complets avec et sans retrait reproduisent leurs commandes et retours. FT09 s’est arrêté avant sa première commande sur une erreur mémoire lors du rejeu groupé. Rejoué seul sur la même révision, il reproduit les quatre commandes et l’empreinte de référence après retrait.

### Réutiliser un effet mesuré pour préparer l’étape suivante

**LP85** gagne en cinq clics. Un essai P05 mesure une permutation. La carte commune de déplacement choisit ensuite quatre actions P07 à partir des permutations compatibles avec les retours. Si la règle P07 est désactivée après le premier clic, la carte essaie un autre contrôle. Le niveau reste ouvert au budget de cinq commandes.

**TN36 et TEQU** gagnent en huit commandes chacun. La carte `sic.apply_verified_configuration.choose`, déjà utilisée par SMLP et RSWP, distingue une modification encore à tester, la réutilisation d’un contrôle confirmé et l’application de la configuration. TN36 lit les déplacements dans les images du programme initial, puis compare la modification de chaque bit au retour avant de lancer le programme. TEQU vérifie chaque dépôt et la présence des marques sur le support avant de réutiliser ce contrôle.

Les trois parcours reproduisent les commandes et retours de référence. La palette permutée et le nom neutralisé conservent les gains. Sur TN36 et TEQU, désactiver la règle de réutilisation de l’édition après les deux premières commandes change la suite. Les niveaux restent ouverts à huit commandes.

LP85 `5fd87809ca31d185f273cae83fa67b11a89ceaa30ada9d48143e1bc5374e9eb2`. TN36 `845a346dfa829f2a5b5692d46b19062379aec2e179bb14ea5e147f2b2a83d141`. TEQU `28eaa8b1bcea3ccb1d747b2b70fb48aa3ad6475f1af0934e7e0d8e112163612d`.

Sur `c1bf5d85`, les **79/100 retraits gagnants** totalisent 878 commandes SIC seul. Le rejeu confirme les 76 trajectoires précédentes après retrait, les 100 premiers niveaux en configuration normale et les quatre jeux complets avec et sans retrait. FT09 passe également après retrait dans ce lot limité à six processus simultanés.

### Placer une pièce en vérifiant la sélection et les déplacements

**KATA, VOIS et LKEY** gagnent en huit, quatorze et huit commandes SIC seul après retrait des anciens sélecteurs. Sur KATA et VOIS, la carte de déplacement choisit P05 pour tester une sélection ou une direction, puis P07 quand les effets mesurés permettent de rejoindre une place. KATA vérifie la pose prévue. VOIS attribue des places distinctes et vérifie la position après chaque déplacement. Sur LKEY, la carte de vérification d’interaction n’autorise P02 que si la même commande a confirmé le même effet de transfert dans un contexte compatible.

Les trois parcours reproduisent leurs commandes et retours de référence. La neutralisation du nom et la permutation de palette conservent les gains. Désactiver P07 sur KATA ou VOIS, ou P02 sur LKEY, à sa première utilisation change la suite et laisse le niveau ouvert au budget de référence.

KATA `cce7cd4d173da4bd2f683c32d9d6ea147073a58eb1b7b202e6b64a483a8e7109`. VOIS `cbba416cc9be373a894c1ee08324922d8c0eb71a7dcad2c551a2593bee83f186`. LKEY `45eacf89a9b32e59f2a3d45d51b33f1ff42d3128a6bff46fd7646f7304294c2b`.

Sur `48f7d1dd`, les **82/100 retraits gagnants** totalisent 908 commandes SIC seul. Le rejeu confirme les 79 trajectoires précédentes après retrait, les 100 premiers niveaux en configuration normale et les quatre jeux complets avec et sans retrait.

### Vérifier un déplacement avant de réutiliser le trajet ou le contact

**DAME, RE86 et SWCH** gagnent en sept, 26 et 25 commandes lorsque les anciens sélecteurs sont retirés. La même carte SRC choisit l’essai P05, le trajet P07 fondé sur les déplacements observés ou la réutilisation P02 d’un contrôle confirmé. DAME vérifie la case d’arrivée et la disparition de la pièce franchie. RE86 relève le déplacement des pièces et le changement de sélection. SWCH conserve les refus de mouvement et recalcule l’approche avant de retester le contact avec le cadre.

Les trois jeux conservent leurs gains avec palette permutée et nom neutralisé. Désactiver P07 au premier trajet laisse RE86 et SWCH ouverts au budget de référence. Sur DAME, les cases d’arrivée offertes suffisent aux essais P05 pour reproduire le même gain. RE86 reproduit aussi les deux niveaux déjà acquis en 73 commandes, avec les mêmes retours.

DAME `cc8a46aa966f6d1bcccf601d1d6eda435a22d2c802a9a6f8355a572e088dbb92`. RE86 `2e761f7e86ac527a3257dbdc72d5a86342d33c00ea1a92dce2bc7951bfbbfc61`. SWCH `c73007473fee951eb29663e83927e436f8c26b83c12e2fd88c90da2979355d07`.

Sur `0789241d`, les **85/100 retraits gagnants** totalisent 966 commandes SIC seul. Le rejeu confirme les 82 trajectoires précédentes après retrait, les 100 premiers niveaux en configuration normale et les quatre jeux complets avec et sans retrait.

### Réviser un trajet quand un contact déplace plusieurs pièces

**SK48** retrouve les 19 commandes de son niveau 1 après retrait de l’ancien sélecteur. La carte `sic.choose_contact_response.choose` choisit le fournisseur de mesure ou de trajet à partir des preuves disponibles. Après quatre essais P05, elle applique le trajet mesuré, puis demande sa révision quand le retour de la douzième commande montre que plusieurs pièces se déplacent ensemble. Les deux niveaux déjà acquis sont reproduits en 56 commandes, avec la même empreinte `421bc40521294b8860233d93ee249f7c1b5d87ffb623dfcf4326a455c5f65614`.

Désactiver le premier trajet après les quatre essais laisse le niveau ouvert. Désactiver la révision après le retour contradictoire fait choisir P02 pour retester la composition de contact acquise. Ce deuxième essai reproduit le gain et la trajectoire en 19 commandes.

**M0R0** retrouve ses 19 commandes. Après quatre essais, la même carte qui guide l’approche d’un cadre choisit le trajet qui tient compte des déplacements des deux pièces. **WA30** retrouve ses 26 commandes. La carte sépare les essais sur le porteur encore libre, le déplacement avec la pièce attachée et le test de dépôt. Désactiver P07 à sa première utilisation laisse les deux niveaux ouverts aux budgets de référence.

SK48 `99b977093936446832060fad6f5abf416beaa1a2f13630c98f9a6e21046daa5a`. M0R0 `7a4a5f9132ebaf038bf0ec96697749301b7c1e1b65ac0388de0925b0cfb94e98`. WA30 `b8590d9cd1f336a57ab225ee2221c5dad1bb5bc156b281cd9fce79e6b4889dd0`.

### Stabiliser les identifiants du modèle de contact

Sur SK48, la neutralisation du nom reproduit les 19 commandes et retours du niveau 1. Avec la palette permutée, les quatre premiers retours mesurent les mêmes déplacements. Le planificateur atteint ensuite sa borne de 1 000 nœuds. L’exploration reprend la main et le premier niveau reste ouvert à la limite de temps.

Les identifiants de pièces dérivés des couleurs modifiaient l’ordre de recherche. La projection SIC identifie désormais chaque pièce par sa position dans la référence visible. Sur les observations des quatre premiers essais, la recherche retrouve le même trajet de onze commandes dans les deux palettes, avec la même borne. Ce trajet reste une projection. Le retour observé après le premier contact continue de guider la révision.

Sur `d22e317f`, le rejeu des deux niveaux de SK48 reproduit exactement les 56 commandes et retours de référence. Avec palette permutée et nom neutralisé, il gagne aussi les deux niveaux en 56 commandes, avec les mêmes commandes et les mêmes résumés de changements visibles. Les 112 commandes des deux rejeux relèvent du SIC.

Sur `d1ccd630`, les **88/100 retraits gagnants** totalisent 1 030 commandes SIC seul. Les 100 premiers niveaux en configuration normale, les 85 retraits précédents et les quatre jeux complets avec et sans retrait reproduisent les commandes et retours de référence.

### Couvrir une zone à partir de déplacements confirmés

`sic.follow_observed_landings.choose` choisit P05 pour mesurer une commande encore inconnue, P07 pour poursuivre un trajet soutenu par un déplacement observé et P02 pour répéter une interaction déjà confirmée dans la situation. Les fournisseurs de mesure continuent à comparer l'arrivée visible, la couverture ou l'effet sur le repère après chaque commande. Ils conservent leur calcul de géométrie et de trajet.

Dans les essais ciblés après retrait, **ZIPP** retrouve ses huit commandes pour couvrir la trace, **WEAV** ses 27 commandes pour traverser les rangées, **SP80** ses huit commandes pour vérifier la sélection puis l'alignement et **SIGN** ses quinze commandes pour visiter et activer les repères. Les quatre jeux reproduisent les commandes et retours de référence. Avec palette permutée et nom neutralisé, ils conservent leurs commandes et leurs résumés de changements visibles.

Une modification de la carte désactive P07 au premier trajet confirmé. Dans les quatre cas, une autre famille reprend une partie des essais. ZIPP, WEAV et SIGN restent ouverts après 45 commandes. SP80 s'arrête au bout de 30 commandes avec le niveau ouvert. Ces essais portent sur le choix de la primitive. Ils gardent les planificateurs de géométrie et les projections TypeScript.

Sur `850b3b8c`, les **92/100 retraits gagnants** totalisent 1 088 commandes SIC seul. Les 100 premiers niveaux en configuration normale, les 88 retraits précédents et les quatre jeux complets avec et sans retrait reproduisent les commandes et retours de référence.

### Vérifier une modification avant de poursuivre ou de la répéter

Les essais ciblés retirent quatre anciens sélecteurs. **S5I5** retrouve ses 13 commandes. La carte d'interaction utilise P05 pour mesurer l'effet d'un bouton sur une jauge, puis P02 quand sa variation est confirmée sans modifier les autres jauges. **TRCP** retrouve ses 24 commandes. La carte de trajet utilise P05 pour essayer une première ouverture, puis P07 quand les cases visibles attestent le passage. **TR87** retrouve ses 26 commandes. Après quatre commandes d'un autre fournisseur, la carte alterne les essais P05 et les pas P07 vers la séquence déduite des exemples. **KEYD** retrouve ses 34 commandes. La carte distingue la mesure d'un contrôle, le déplacement confirmé et la réutilisation d'un transfert déjà observé.

Chaque essai reproduit les commandes et retours de référence sous SIC seul. Le nom neutralisé et la palette permutée conservent le gain, les commandes et les résumés des changements. Les détecteurs et les planificateurs restent disponibles.

La désactivation de P02 lors de sa première utilisation sur S5I5, et de P07 lors de sa première utilisation sur TRCP, TR87 et KEYD, change les commandes suivantes. Les niveaux restent ouverts après 50 commandes sur S5I5, TR87 et KEYD. TRCP s'arrête après 47 commandes.

### Vérifier un effet distant, un déplacement ou la disparition d'un support

La carte de trajet distingue trois situations. P05 mesure un effet encore incertain, P07 poursuit un accès soutenu par des observations et P02 répète une interaction déjà confirmée. **BP35** reproduit ses 16 commandes après retrait. La disparition d'un bloc et le déplacement latéral sont suivis avec deux preuves distinctes. La première autorise un nouveau retrait de support et la seconde permet de poursuivre un trajet latéral. **G50T** reproduit ses 27 commandes. Tant que la commande de répétition à distance reste incertaine, elle fait l'objet d'un essai. Les déplacements déjà mesurés servent à rejoindre la zone ouverte.

**TU93** reproduit ses 30 commandes. Les premiers essais vérifient la commande autour du mobile et les pas suivants suivent les connexions visibles ou reviennent par un déplacement déjà observé. **FUIT** reproduit ses 48 commandes. Chaque commande est un P05 dans ce parcours. La réponse du deuxième sprite, jusqu'au contact, demeure une prédiction à vérifier pour la paire de positions courante.

Les quatre essais gagnent le niveau 1 sous SIC seul avec les commandes et retours de référence. La permutation de palette et la neutralisation du nom conservent les mêmes commandes et les résumés des changements visibles. Ces essais isolés complètent les 85 retraits déjà qualifiés et les onze autres cas rejoués sur les versions intermédiaires. La campagne du catalogue entier doit confirmer les résultats sur la même version.

Sur BP35, G50T et TU93, désactiver P07 au premier trajet confirme que la carte change la suite du parcours. Les trois niveaux restent ouverts aux bornes de l'essai. BP35 et TU93 se terminent sur un échec du jeu après 54 et 50 commandes, et G50T atteint le plafond de 55 commandes.

Sur FUIT, désactiver P05 après la première commande rend la main à d'autres fournisseurs. Le niveau reste ouvert après 39 commandes.

Sur `341b6cb1`, **100/100 retraits sont gagnants**, en 1 306 commandes SIC seul. Les 100 parcours normaux reproduisent leurs 1 248 commandes et retours. Les quatre jeux complets reproduisent leurs 268 commandes et retours dans chacune des deux configurations. Le rejeu qualifie les huit derniers cas sur la même version que les 92 premiers.

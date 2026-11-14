# Généraliser SIC seul après les niveaux 1

Le commit `d322509d` couvre les 100 premiers niveaux, attestés par les qualifications successives. Le chantier prend ces 100 entrées et les parcours complets de DICO, DNOI, HANO et SYME comme référence. Le rejeu intégral lancé au départ vérifie que les résultats coexistent sur le même moteur.

## Mesurer les dépendances

- Pour chaque partie, relever les familles et les primitives qui ont effectivement choisi une commande, les conditions qui les ont départagées et le résultat de la vérification au retour. Consigner une seule durée de résolution par niveau.
- Retirer une famille du registre et de l’agenda avant une partie neuve. Rejouer sous SIC seul et relever le nombre de niveaux, le premier choix qui diverge et la première relation que SIC ne sait plus établir. Le premier lot couvre les huit derniers niveaux 1 ajoutés et le niveau d’entrée des quatre jeux terminés.
- Distinguer les victoires obtenues par une autre famille de la reconstruction effective. Pour compter une reconstruction, la trace doit montrer la relation formulée après une observation, confirmée par un retour distinct et réutilisée pour motiver une action. La victoire reste un résultat mesuré séparément.

## Décomposer et transférer

- Partir d’une dépendance observée et isoler le fait manquant. Une première piste est le déplacement d’un sprite vers une cible avec contrôle du retour. KLOT, KA59 et SNAR offrent trois situations distinctes pour tester la même primitive.
- Exposer cette capacité en terme de besoin, de faits observables et de conséquence vérifiable. Par exemple, P05 mesure un effet directionnel encore ambigu. P07 devient applicable lorsque le retour confirme un déplacement utilisable et qu’un trajet reste à parcourir. Après une contradiction, SIC met à jour les faits et l’agenda choisit de nouveau la primitive. Chaque primitive a ses propres conditions et priorités configurables.
- Décliner les cartes selon le mode global. En exploration, privilégier les essais qui départagent des hypothèses. En assimilation, rechercher une confirmation indépendante et réutiliser les acquis applicables. En résolution, préférer un plan qui exploite les effets confirmés et rouvrir une question si le plan est contredit. Le mode s’appuie sur les acquis et les contradictions observés à l’échelle du jeu et des niveaux.
- Tester le transfert sur des jeux tenus hors de la mise au point. Les noms de jeu servent au choix des parties d’évaluation. Les déclencheurs consomment des faits observés pendant la partie. Une permutation de la palette mesure la dépendance aux couleurs. Un essai sur un autre jeu mesure le transfert de la capacité.

## Vérifier chaque remplacement

Le passage au composant commun demande un rejeu avec retrait de la famille ciblée, les 100 niveaux 1 et les quatre parcours intégraux sous SIC seul. Comparer les gains, les commandes, les contradictions, l’autorité de décision et la durée par niveau. Une modification des commandes est acceptable lorsque les preuves et les résultats restent vérifiables. Garder la première divergence et le nombre de jeux où la primitive contribue réellement.

Le chantier se déroule avant la campagne systématique des niveaux 2. La campagne des niveaux 3 suit celle des niveaux 2.

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

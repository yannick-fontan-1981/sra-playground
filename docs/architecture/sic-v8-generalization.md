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

Le premier lot de retraits, sur les niveaux d’entrée, conserve deux gains sur douze. DNOI et SYME gagnent encore en 3 et 9 commandes après retrait de la réparation du champ. L’apprentissage de correspondances fournit toutes ces commandes. La reconstruction d’une relation reste à vérifier dans la trace. MOTO et DICO s’arrêtent en 35 commandes. SNAR, SC25, PRTL, KLOT, TEQU, KA59, GIGO et HANO restent à zéro à la borne de 40 commandes. Toutes les commandes restent sous SIC. Le rejeu intégral confirme les 100 niveaux 1 sur le même moteur, en 1 250 commandes. Sur ces parties, 82 familles choisissent au moins une commande et cinq sont utilisées dans plusieurs jeux. Ce comptage inclut le fournisseur d’exploration des commandes publiques, utilisé dans 17 jeux.

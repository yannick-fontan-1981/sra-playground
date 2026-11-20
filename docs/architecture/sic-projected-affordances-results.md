# SIC Fallback et les possibilités ouvertes par un déplacement

## Expérience sur les sept jeux sources

Deux configurations peuvent laisser un objet au même endroit et lui donner des possibilités différentes. Pour les distinguer, nous avons mesuré le déplacement de cet objet après un **même programme de commandes** exécuté dans deux parties. Les deux parties commencent au même préfixe public. L’une reçoit une préparation de plus. À chaque geste suivant, nous cherchons un composant reconnaissable qui part de la même position dans les deux parties, bouge dans la partie préparée et arrive à une position différente de celle du témoin. Une variation sur un autre composant ou une disparition ne suffisent pas à satisfaire ce critère.

Sur les 100 journaux initiaux, nous avons choisi dans chaque jeu la première commande modifiant l’image et suivie d’au moins cinq autres commandes. 80 jeux étaient éligibles. Le premier déplacement différentiel mesuré apparaît au premier geste dans SNAR, au troisième dans CWSE, CASC et ESCT, au quatrième dans PRTL. Pour les 75 autres jeux, la sonde sélectionnée n’a fourni aucun déplacement de ce type dans la fenêtre étudiée. Cette expérience fixe la préparation avant d’observer les deux futurs.

Dans les niveaux supérieurs, nous sommes repartis de 18 programmes gagnants déjà réduits. Chacune des 117 suppressions d’un geste préparatoire fait échouer le suffixe gagnant fixé. La réduction préalable sélectionne des gestes importants et empêche d’interpréter ce taux comme une fréquence dans des trajectoires ordinaires. Dans 25 cas, la commande retirée changeait l’image sans déplacer de composant identifiable. Dans 31 cas, les deux parties ont ultérieurement présenté un déplacement différentiel depuis une origine commune. La première manifestation répondant au critère est retardée de deux à cinq gestes dans 16 de ces cas.

| Jeu | Niveaux rejoués | Préparations retirées | Sans déplacement reconnu à la préparation | Premier déplacement différentiel au geste 2 à 5 |
| --- | --- | ---: | ---: | ---: |
| GRAV | 2, 3, 4, 5 | 30 | 3 | 9 |
| GARE | 2, 3 | 9 | 0 | 2 |
| POLA | 2, 3, 4, 5 | 19 | 10 | 2 |
| CWSE | 2 | 4 | 0 | 1 |
| CATR | 2, 3 | 7 | 0 | 0 |
| GIGO | 2, 3, 4, 5 | 42 | 10 | 2 |
| MOTO | 2 | 6 | 2 | 0 |

Sur GRAV L2, enlever le premier geste de la suite gagnante donne une première différence de ce type cinq commandes plus tard. Sur POLA, dix préparations changent l’image sans translation reconnue et comptent pour la réussite du suffixe. Sur CATR L2–3 et MOTO L2, les suppressions compromettent la suite, mais cette sonde n’isole aucun déplacement différentiel retardé. Les programmes de CATR et MOTO ont été rejoués en enchaînant les victoires depuis le L1 pour reproduire leur entrée. Les quinze autres programmes ont été confirmés en entrée directe.

Les interventions antérieures sur GARE L2 séparent l’accès à un lieu et l’usage qu’il permet. Sur 38 images inédites, la rangée d’un repère prédit 8 arrivées et 30 absences d’arrivée. Dans une série de 30 dispositions distinctes après deux préparations, 14 donnent l’arrivée attendue. Seules 3 de ces 14 gagnent avec la commande suivante fixée. L’hypothèse de victoire fondée sur une seule pose exacte produit aussi quatre faux positifs sur les 38 nouvelles images.

## Peut-on composer deux changements de disposition ?

L’expérience suivante utilise exactement les mêmes commandes et le même nombre de gestes. Pour chacun des 18 programmes vérifiés, nous avons d’abord échangé deux gestes voisins distincts à la fois. Sur 94 échanges, 19 conservent la victoire. Nous avons ensuite prédit la réussite d’une combinaison de deux échanges disjoints lorsque chacun réussissait isolément. Le résultat de la combinaison était encore inconnu au moment du pronostic.

Sur 195 combinaisons, les 21 pronostics positifs gagnent. Parmi les 174 pronostics négatifs, une combinaison gagne également. Les 21 programmes positifs exécutent effectivement les deux échanges avant de finir. Dans 13 de ces 21 cas, le premier échange modifiait encore l’observation publique au terme de ses deux gestes. Les positifs se répartissent entre GRAV L2 (16), CATR L2–3 (4) et GARE L2 (1). Sur GRAV L2, les 13 triples échanges disjoints prédits gagnants à partir des seuls essais simples ont ensuite été exécutés. Les 13 gagnent. Le cas manqué au test double sur GRAV L2 transforme le suffixe de quatre commandes `4,1,3,2` en `1,4,2,3`.

Dans ces exemples, SIC pourrait explorer une petite famille de modifications locales, puis en composer plusieurs pour proposer une disposition nouvelle. Ces mesures ont été faites par intervention sur des solutions sources connues après le gel du cinquième candidat. Le candidat testé sur SS01 ne reçoit aucune de ces solutions.

## Comparaison des candidats figés

Entrée directe SS01 L2, agent neuf, même moteur et budgets. Le temps actif a limité tous les essais avant 1 200 commandes, avec une charge machine variable. Le nombre d’images distinctes inclut l’image initiale. Le témoin et les candidats ont tous terminé dans l’état officiel `NOT_FINISHED`.

| Version | Actions | Images distinctes | Arrivées vérifiées par la famille de projection | Continuations vérifiées par la même famille | Victoire |
| --- | ---: | ---: | ---: | ---: | --- |
| Témoin 7f2cb3eb | 668 | 156 | 0 | 0 | Non |
| v1 71ae874f | 679 | 166 | 9 | 0 | Non |
| v2 737112a1 | 1 062 | 170 | 11 | 0 | Non |
| v3 4a262f9e | 1 123 | 149 | 0 | 0 | Non |
| v4 09db632a | 720 | 140 | 0 | 0 | Non |

Dans la v4, la famille d’exploration des expériences restantes a vérifié 51 retours sur des transitions antérieures, essayé 176 nouvelles paires image-commande, vérifié 16 arrivées prédites et 6 mouvements suivants. Un rejeu indépendant contrôle chaque empreinte d’image, la nouveauté de chaque essai déclaré, le rôle suivi et sa position. Le contrôle géométrique par deux segmentations n’a confirmé aucun franchissement de région sur ces trajectoires. SS01 avait déjà été étudié. Les variantes successives constituent des essais supplémentaires. SS09 L2 reste réservé.

Sur les 100 L1 à 60 gestes, le témoin gagne 65 fois. La v1 gagne 66 fois avec VOIS en plus. La v4 gagne aussi 66 fois. Elle ajoute VOIS, SWCH et CGWL et perd SMLP et TRIA. Sur les sept L2 sources en entrée directe à 120 gestes, la v2 gagne GARE en 13 gestes, GIGO en 9 et GRAV en 44. Les victoires reproduites par les interventions sur 18 niveaux concernent les programmes archivés.

Les mesures par variante, les empreintes des trajectoires et les résultats par niveau figurent dans [les données agrégées](sic-projected-affordances-results.json). Les commandes sources nécessaires pour reproduire les suppressions figurent dans [les 18 programmes et leurs entrées](sic-source-seven-programs.json). Les conditions de gel sont consignées dans [le protocole](sic-projected-affordances-protocol.md).

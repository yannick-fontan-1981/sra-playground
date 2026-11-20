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

Avant le dernier geste, les 34 doubles et triples programmes gagnants des niveaux supérieurs retrouvent tous un vecteur de positions mobiles déjà présent dans le programme initial ou une permutation simple gagnante avec le même geste final. Seuls les rôles visibles, reconnaissables et ayant bougé dans le programme initial sont comparés. Produire plusieurs chemins gagnants mesure autre chose que découvrir une nouvelle disposition utilisable.

Sur les 66 programmes gagnants des 100 traces initiales, nous avons choisi au plus quatre paires voisines distinctes à intervalles réguliers avant de connaître le résultat de leur permutation. Parmi les 238 échanges simples, 145 gagnent. Sur 287 doubles permutations, les 144 prédictions positives gagnent et quatre négatives gagnent aussi. Dans 105 des 144 positifs, les deux échanges sont entièrement exécutés avant la victoire. Parmi 71 triples prédits positifs, 71 gagnent et 38 exécutent les trois échanges au complet. Parmi 141 comparaisons de dispositions finales avec les mêmes rôles visibles et le même dernier geste, DICO fournit une disposition nouvelle pour ces témoins. L’échantillon est constitué de programmes déjà gagnants et inclut des gestes redondants.

## Lister les dispositions par leur usage

Dans chacun des sept jeux, nous avons gardé le préfixe d’un programme gagnant et sa pénultième commande B. Nous avons énuméré les préparations de zéro à deux commandes déjà connues dans les traces gagnantes de ce jeu, regroupé les images de départ de B identiques et testé les commandes finales disponibles après B. Le catalogue enregistre les dispositions pour lesquelles au moins une commande termine le niveau. Dans tous les jeux, le suffixe original B puis C échoue depuis le préfixe sans préparation.

| Jeu et niveau | Images de départ de B évaluées avec une suite | Images permettant une victoire | Avec arrivée différente depuis une même position puis victoire |
| --- | ---: | ---: | ---: |
| CATR L3 | 54 | 2 | 0 |
| CWSE L2 | 7 | 4 | 0 |
| GARE L2 | 23 | 6 | 5 |
| GIGO L3 | 7 | 2 | 0 |
| GRAV L3 | 13 | 4 | 0 |
| MOTO L2 | 28 | 4 | 1 |
| POLA L4 | 14 | 5 | 0 |

CATR L3 fournit une expérience croisée. Depuis le même préfixe, préparer par le point (46, 51), puis appliquer B au point (21, 55), donne la victoire seulement avec (17, 51) parmi les dix commandes du répertoire testé. Préparer par (17, 51), puis appliquer exactement le même B, donne la victoire seulement avec (46, 51). Six positions de composants diffèrent du départ après cette seconde préparation. Le changement d’usage final est démontré. Le suivi des rôles ne détecte pas dans ce cas de mouvement différentiel pendant B depuis la même origine.

GARE L2 et MOTO L2 fournissent respectivement cinq et une dispositions où B déplace un rôle reconnaissable depuis la même origine que dans la partie sans préparation et où une suite gagne. Sur MOTO L2, le rôle atteint (52, 8) depuis (52, 28) et la commande 5 gagne ensuite. Dans cette énumération, aucune disposition ne combine les trois mesures de placement mobile différent de la préparation gagnante de référence, de déplacement différentiel sous B et de victoire ensuite. Ce catalogue est une intervention de laboratoire sur les jeux sources. Il reste indépendant du solveur figé.

## Quand deux préparations ouvrent une capacité

Sur GARE L3, nous avons fixé les deux dernières commandes d’un programme gagnant, puis cherché d’autres façons de les rendre efficaces. Deux préparations consistaient à agir aux points A (11, 13) et D (44, 13). Depuis l’entrée officielle, nous avons rejoué les cinq variantes suivantes. La dernière commande et celle qui la précède sont communes aux cinq parties.

| Préparation | Position du rôle avant la suite | Victoire avec la suite |
| --- | --- | --- |
| Aucune | (38, 2) | Non |
| A | (38, 2) | Non |
| D | (38, 2) | Non |
| A puis D | (38, 32) | Oui |
| D puis A | (38, 2) | Non |

Le rôle part de la même position lorsque D agit seul ou après A. D n’avait jamais produit ce mouvement dans l’essai isolé. Sur les 18 niveaux, avec une préparation simple gagnante de référence, 326 couples de commandes individuellement insuffisantes produisent une image encore inédite pour les contrôles simples. Deux couples de GARE L3 donnent la victoire sur une même nouvelle image. Le vecteur des positions mobiles suivies correspond à une configuration gagnante déjà connue. La sélection fondée sur les coordonnées des succès simples s’est abstenue sur GARE L3.

Nous avons ensuite remonté d’un geste dans les 16 programmes assez longs. À cette origine, aucune des commandes isolées du répertoire ne rend les deux derniers gestes gagnants. Parmi les 619 couples menant à une image nouvelle pour les essais simples, 36 rendent la suite gagnante. Dans 29 cas répartis sur 13 niveaux, inverser les deux commandes donne une défaite sur une branche comparable. Le choix de ces préfixes assure l’existence d’au moins un programme gagnant dans le répertoire. Un classement qui favorisait deux préparations modifiant des mouvements différents dans la suite a émis dix premiers choix. Les dix ont échoué. Ces tests mesurent des interventions depuis des préfixes connus.

Sur GRAV L2, l’ordre 4 puis 1 place un rôle en (52, 24). L’ordre inverse le place en (52, 12). Depuis l’entrée du test, 4 seul le place en (52, 40) et 1 seul en (40, 12), depuis (40, 40). La suite 3 puis 2 gagne seulement après 4 puis 1 parmi ces cinq essais. Le calcul par addition prédirait (52, 12) dans les deux ordres.

## Prévoir où se termine le mouvement

Nous avons projeté le même mouvement rectiligne dans une autre rangée ou colonne. Un premier modèle copie le déplacement déjà observé. Un second identifie les motifs de pixels que le bord du mobile a traversés dans la première trajectoire. Dans la nouvelle configuration, il prédit un arrêt au premier motif différent et projette ce bord sur le pas spatial lorsque plusieurs longueurs de déplacement permettent d’estimer ce pas. Les prévisions des couples de commandes sont établies avant de jouer ces couples.

Sur les 16 niveaux supérieurs, 88 des 89 arrivées proposées sont mesurables. Le modèle du passage libre et du pas spatial en retrouve 63, contre 51 par addition. Parmi les 39 désaccords mesurables, leurs nombres d’arrivées exactes sont 16 et 4. Les 16 succès propres au premier modèle viennent de GRAV L2, L4 et L5. Dans l’exemple de GRAV L2, il situe effectivement le rôle en (52, 24). La même prédiction appliquée à un deuxième rôle de la scène échoue. Sur les traces chronologiques ordinaires des 100 jeux, l’addition retrouve 56 arrivées sur 75 mesurables, contre 23 pour le passage libre. Ces règles ont été étudiées après le gel de la v8.

Un sélecteur part de l’addition. Chaque autre position de départ déjà testée du même rôle dispose d’une voix si l’un des modèles a mieux prédit ses arrivées. Lorsque le passage libre recueille davantage de voix, le sélecteur l’utilise pour la nouvelle prévision. Il retrouve 59 des 75 arrivées mesurables des traces ordinaires, avec six choix du passage libre. Sur les niveaux supérieurs, il en retrouve 53 sur 88, avec huit choix du passage libre. Ce sont des mesures de prévision hors ligne. La règle a été élaborée à partir des sources et évaluée sur ce corpus de développement.

## Ce que SIC prévoit et vérifie par lui-même

Sur 14 préfixes sources où les classements des v6 et v7 diffèrent et où la v7 annonce un déplacement, le premier essai découvre une position nouvelle dans 6 jeux pour la v7 et dans 1 pour la v6. Deux continuations annoncées vers une position nouvelle se vérifient, sur SIGN et VOIS. Dans une sélection distincte, huit jeux donnent un premier programme à trois commandes. VOIS est le seul où la chaîne entière se vérifie. Depuis le préfixe de 14 gestes, SIC propose 2 pour déplacer le repère de (42, 22) à (42, 26), puis 5 pour transporter le voyageur de (14, 22) à (42, 26), puis 5 pour revenir à (14, 22). Sans la préparation, le premier 5 conduit à (42, 22). Cette intervention ne termine pas le niveau.

Sur les 100 journaux, une commande encore incapable de déplacer un rôle peut parfois reproduire un déplacement appris avec une autre commande. Quand l’origine a déjà été éprouvée sous une autre commande, 13 mouvements surviennent sur 428 résultats mesurables. La destination la plus fréquente de l’autre commande en prédit 12. Dans la v8, SIC propose ce transfert comme une expérience. Sur les premiers programmes sources éligibles, dix au L1 et six aux niveaux supérieurs, le mouvement emprunté n’a jamais été confirmé. Certaines préparations ont échoué avant que ce mouvement puisse être essayé.

## Comparaison des candidats figés

Entrée directe SS01 L2, agent neuf, même moteur et budgets. Le temps actif a limité les essais achevés avant 1 200 commandes, avec une charge machine variable. Le nombre d’images distinctes inclut l’image initiale. La v7 initiale s’est interrompue sur une erreur de sérialisation. Les essais complets du tableau ont terminé dans l’état officiel `NOT_FINISHED`.

| Version | Actions | Images distinctes | Arrivées vérifiées par la famille de projection | Continuations vérifiées par la même famille | Victoire |
| --- | ---: | ---: | ---: | ---: | --- |
| Témoin 7f2cb3eb | 668 | 156 | 0 | 0 | Non |
| v1 71ae874f | 679 | 166 | 9 | 0 | Non |
| v2 737112a1 | 1 062 | 170 | 11 | 0 | Non |
| v3 4a262f9e | 1 123 | 149 | 0 | 0 | Non |
| v4 09db632a | 720 | 140 | 0 | 0 | Non |
| v5 9edafd77 | 1 069 | 149 | 0 | 0 | Non |
| v6 913683dc | 1 012 | 162 | 0 | 0 | Non |
| v7.1 da4943d0 | 548 | 174 | 0 | 0 | Non |
| v8 5cf88d3a | 609 | 179 | 0 | 0 | Non |
| v9 f948eb0f | 523 | 150 | 3 | 1 | Non |
| v10 a291968a | 447 | 145 | 0 | 0 | Non |
| v11 104a9739 | 595 | 166 | 0 | 0 | Non |

Dans la v4, la famille d’exploration des expériences restantes a vérifié 51 retours sur des transitions antérieures, essayé 176 nouvelles paires image-commande, vérifié 16 arrivées prédites et 6 mouvements suivants. Un rejeu indépendant contrôle chaque empreinte d’image, la nouveauté de chaque essai déclaré, le rôle suivi et sa position. Le contrôle géométrique par deux segmentations n’a confirmé aucun franchissement de région sur ces trajectoires. SS01 avait déjà été étudié. Les variantes successives constituent des essais supplémentaires. SS09 L2 reste réservé.

Dans la v5, 308 actions relèvent des comparaisons de futurs. Un pronostic exact est reproduit et aucun accès supplémentaire après une préparation immédiatement exécutée n’est certifié. La v6 rétablit la priorité d’une réutilisation vérifiée. Son rejeu reproduit 225 nouvelles paires image-commande, 24 arrivées et 2 continuations de la famille d’exploration. Les 38 actions de comparaison de futurs ne certifient aucune nouvelle capacité spatiale. Aucun franchissement de région n’est confirmé dans ces deux essais. Le témoin et la v6 échouent aussi à 120 commandes sur chacun de GRAV L5, GARE L3, POLA L5, CWSE L2, CATR L3, GIGO L5 et MOTO L2. Les observations initiales ont les mêmes empreintes dans chaque paire. Les préfixes chronologiques de CATR et MOTO servent exclusivement à atteindre l’entrée, avant la création des deux agents neufs.

Sur les 100 L1 à 60 gestes, le témoin gagne 65 fois. La v1 gagne 66 fois avec VOIS en plus. La v4 gagne aussi 66 fois. Elle ajoute VOIS, SWCH et CGWL et perd SMLP et TRIA. Sur les sept L2 sources en entrée directe à 120 gestes, la v2 gagne GARE en 13 gestes, GIGO en 9 et GRAV en 44. Les victoires reproduites par les interventions sur 18 niveaux concernent les programmes archivés.

Sur SS01 L2, la famille qui choisit une commande encore inexplorée dans une configuration accessible obtient cinq arrivées et une continuation vérifiées pour la v7.1, puis trois arrivées et deux continuations pour la v8. Dans les programmes qui préparent le déplacement d’un autre rôle, la v7.1 vérifie trois placements sur dix propositions. La v8 en vérifie zéro sur 28 propositions. Les huit essais effectivement consacrés à une commande jusque-là inopérante ne déplacent pas le rôle choisi. Les deux rejeux géométriques confirment zéro franchissement de région. SS09 L2 demeure en réserve.

Sur les 100 L1 sources, la v7.1 et le témoin gagnent chacun 65 niveaux. La v7.1 ajoute CGWL et VOIS et perd SMLP et TRIA. Sur chacun des sept jeux sources au L2 à 120 gestes, la v8 et le témoin gagnent GRAV, GARE et GIGO. GRAV demande 49 gestes à la v8 et 105 au témoin. Les deux gagnent GARE en 13 gestes et GIGO en 9. Aucun gain de niveau n’est observé sur ces sept L2. Sur les sept entrées difficiles allant du L2 au L5 déjà utilisées par la v6, la v7.1 et la v8 échouent également à 120 gestes. Les premières observations concordent avec celles du témoin. La suite SIC compte 140 tests réussis sur 141 pour la v8. L’assertion déjà en échec sur le cycle orienté attend un objet sans le champ `walk` que le moteur renvoie vide.

## v9 · Quand déplacer un partenaire donne une capacité au voyageur

La v9 apprend, dans sa propre partie, quelles relations de position séparent les essais où une même commande déplace un rôle de ceux où elle le laisse immobile. Elle cherche jusqu’à quatre gestes pour obtenir la disposition voulue, prévoit le déplacement des deux objets pendant la préparation, puis annonce une arrivée et une utilisation. Elle énumère jusqu’à cinq dispositions et peut reprendre une recette déjà vérifiée pour essayer une suite encore inconnue.

Dans SS01 L2, un rejeu indépendant des 523 commandes confirme dix programmes sélectionnés. Sept ont atteint la commande testée. Trois ont donné la destination annoncée puis le déplacement suivant annoncé. Dans ces trois cas, le voyageur avait lui-même changé d’origine lors de la préparation. Le contrôle géométrique ne détecte aucun franchissement de région et le moteur ne valide pas le niveau. À 523 commandes identiques en nombre, le candidat visite 150 images distinctes et le témoin 129. Le témoin atteint 156 images au terme de ses 668 commandes. Les essais se terminent au plafond de temps actif. SS09 L2 reste réservé.

### Victoires autonomes dans les sources

Les 100 premières entrées sont identiques entre les deux bras. À 60 gestes, chacun en gagne 65. Le candidat ajoute CGWL et VOIS, et perd SMLP et TRIA. Le tableau couvre aussi les 18 niveaux supérieurs des sept jeux disposant de programmes archivés. Les six comparaisons supplémentaires sur GRAV, GIGO et POLA aux L3 et L4 complètent les cohortes préenregistrées. Chaque essai autonome démarre avec un agent neuf, à l’entrée vérifiée du niveau, pour 120 commandes maximum.

| Jeu | Niveaux comparés | Victoires du témoin | Victoires du candidat |
| --- | --- | --- | --- |
| GRAV | 2, 3, 4, 5 | 2, 3 | 2 |
| GARE | 2, 3 | 2 | 2 |
| POLA | 2, 3, 4, 5 | 3 | Aucune |
| CWSE | 2 | Aucune | Aucune |
| CATR | 2, 3 | Aucune | Aucune |
| GIGO | 2, 3, 4, 5 | 2, 3, 4 | 2, 3, 4 |
| MOTO | 2 | Aucune | Aucune |

La v9 gagne 5 niveaux sur 18 et le témoin 7. Les deux pertes sur GRAV L3 et POLA L3 se reproduisent déjà avec la v8. GRAV L2 demande 74 gestes à la v9, 49 à la v8 et 105 au témoin. Sur six des sept entrées difficiles, la nouvelle famille atteint au moins une fois l’arrivée et la suite prévues. POLA L5 est l’exception. Aucune des sept n’est gagnée à ce budget. Sur l’ensemble des 18 entrées, SIC reprend douze fois une recette de placement antérieurement vérifiée.

Un second moteur de rejeu vérifie les trajectoires sources, leurs images et leurs scores officiels. Pour le premier programme autonome complet par entrée, il exécute aussi toutes les sous-suites strictes depuis le préfixe d’origine. Dans SWCH L1, les commandes 2, 3, 2 mènent le rôle à (9, 27). Aucune des six sous-suites distinctes ne l’y mène. MIND L1 offre un second cas avec trois gestes et sept sous-suites. Ce critère est satisfait dans deux des neuf L1 où SIC achève un programme, et dans aucun des dix niveaux supérieurs où il en achève un. Pour neuf de ces dix niveaux supérieurs, une seule commande de la séquence suffit pour reproduire la position finale. Sur GRAV L4, le raccourci le plus court en demande trois. L’essai supplémentaire d’une commande à la même position finale ne révèle aucune capacité propre au programme complet dans les cas avec raccourci. Les tests SIC comptent 141 succès sur 142. Le test du cycle orienté échoue également sur le témoin.

### Ce qui change après un retour à la même position

Sur les trajectoires originales, nous retenons la première suite de deux à six gestes dans laquelle le voyageur bouge, revient à sa position initiale et laisse au moins un autre objet ailleurs. Depuis chaque extrémité de cette suite, le moteur exécute tous les programmes de zéro, un ou deux gestes du même vocabulaire. Il comprend les boutons disponibles et jusqu’aux quatre clics distincts les plus récents. Un lieu est déclaré nouvellement accessible si aucune branche mesurable avant préparation ne l’atteint et si la position du voyageur est identifiable dans chaque état non terminal du bras témoin.

Sur les 100 traces originales, 15 offrent cette expérience. DC22 et SKBN gagnent des positions accessibles à cet horizon. Dans DC22, le voyageur revient en (10, 40), puis deux commandes 1 l’amènent en (10, 36), une case encore jamais visitée. Cette case est absente des 43 essais témoins. Dans GIGO, CGWL et ETAG, la préparation ouvre une victoire en deux gestes ou moins. GABA donne trois destinations encore inédites, mais le voyageur devient non identifiable dans douze branches témoins. Ces destinations restent incertaines.

Sur les douze entrées supérieures des campagnes de contrôle, six fournissent un tel retour et aucune n’ouvre une victoire à deux gestes. Parmi les 18 programmes gagnants archivés, six contiennent un tel retour. Sur GRAV L3, après deux gestes préparatoires, le voyageur revient en (60, 30). Parmi les 31 suites courtes essayées avant et après, seule la disposition préparée offre une victoire, par 1 puis 3. Le témoin n’en offre aucune. L’inversion des deux gestes préparatoires change l’origine du voyageur et ne permet pas d’isoler l’effet d’un seul partenaire.

Une intervention à durée égale échange deux gestes de la préparation et garde les variantes où le voyageur revient à la même origine. Sur ETAG L1, la commande 2 gagne deux fois sur deux avec le partenaire en (22, 27) et zéro fois sur trois avec le partenaire en (12, 27). Dans GIGO, CGWL, SKBN et ETAG, nous figeons les conditions compatibles avec ces essais avant de tester d’autres ordres de gestes. Elles prédisent correctement les 103 cas mesurables, dont deux succès. Ces essais retombent tous sur des images déjà vues durant les échanges simples.

Nous remplaçons ensuite un geste par une autre commande du même jeu. À origine inchangée, 255 préparations distinctes sont mesurables, dont 21 images nouvelles par rapport aux échanges simples. Sur ces images, le modèle formule 19 pronostics, tous exacts, dont une victoire d’ETAG. La majorité des résultats antérieurs aurait donné 18 réponses justes sur ces mêmes 19 cas. Sur cinq dispositions de partenaires inédites, le modèle prédit trois échecs, tous vérifiés, et s’abstient deux fois. La victoire prédite dans une image inédite correspond donc à une disposition de partenaire déjà rencontrée.

### Transporter une capacité à une autre origine

Le même test autorise ensuite le voyageur à changer de position. La prévision est formulée avant d’exécuter la suite, avec les relations apprises à l’origine précédente. Une hypothèse de mouvement prédit la même translation du voyageur, tandis qu’une hypothèse de victoire exige toujours la validation officielle. Après substitution d’un geste de préparation, 60 dispositions conjointes à origine différente sont mesurables dans les quatre jeux. Le modèle relatif se prononce sur 37 et répond correctement 12 fois, contre 22 pour la majorité sur ces mêmes 37 cas. Sur 12 pronostics d’ouverture, un seul est confirmé. Les 60 dispositions représentent réellement 16 possibilités positives selon le test de chaque jeu.

Dans CGWL L1, le voyageur en (17, 41) et le partenaire en (15, 36) autorisent une victoire par 4 puis 5. Sur une nouvelle disposition, le modèle prédit la victoire après translation des deux rôles de quatre unités vers le haut. Le voyageur est en (17, 37), le partenaire en (15, 32), et le moteur valide la victoire. Le même écart entre rôles apparaît après une translation de quatre unités vers la gauche, en (13, 41) et (11, 36). Le modèle prédit à nouveau la victoire et le moteur la réfute. Les deux préparations ont la même longueur. La géométrie de cette paire laisse donc une inconnue dans la prévision, qui peut dépendre du reste du plateau ou de l’historique. Cette expérience hors ligne est postérieure au gel de la v9. Les résultats de Custom 4 ne servent pas à choisir les variables.

## v10 · Imaginer une préparation dans le repère du plateau

Dans CGWL L1, trois images positives et seize négatives suffisent à apprendre qu’une borne sur la colonne du partenaire sépare les deux issues de l’échantillon. Le modèle prévoit deux victoires et quatorze échecs sur seize dispositions conjointes inédites. Le modèle limité à la position relative prévoit cinq victoires, dont les deux réelles. L’ajout d’un troisième objet n’améliore pas ce résultat.

Sur les quatre sources L1 déjà sélectionnées par leurs contrastes observables, le modèle émet 30 pronostics exacts sur 30 dispositions conjointes inédites, dont cinq ouvertures. Il connaît alors les deux positions obtenues, avant le déclenchement. Lorsqu’il doit imaginer les positions avant de jouer toute la préparation, il émet 26 pronostics exacts sur ces 30 cas, dont quatre ouvertures. Pour sa première proposition par jeu, il s’abstient dans GIGO, trouve une victoire dans CGWL et ETAG et le déplacement visé dans SKBN. Dans CGWL, la configuration obtenue est nouvelle et diffère de sa prévision numérique. L’effet attendu est conservé. Une réduction indépendante trouve une préparation de trois commandes au lieu de cinq. Dans les trois succès, supprimer la préparation entière fait échouer la sonde.

Sur les 18 programmes gagnants sources des niveaux supérieurs, les interventions produisent 80 dispositions conjointes inédites et aucune victoire avec les deux dernières commandes imposées. Une seconde mesure recherche une capacité intermédiaire à l’intérieur de chaque trace gagnante. Dans 14 niveaux, modifier la préparation change l’effet de B sur un rôle qui bouge ou gagne de nouveau avec C. La première préparation choisie donne B dans CATR L3, GRAV L3 et POLA L4. Dans chaque cas, B sans préparation échoue et C après l’arrivée prévue échoue aussi.

Un essai distinct apprend séparément le résultat de B et la condition d’utilisation de C depuis l’arrivée. Les programmes de test retirent une commande et en insèrent deux. Ils sont exclus de l’apprentissage et des essais précédents. En visant B seul, le laboratoire choisit neuf programmes et confirme B puis C quatre fois. En exigeant une prévision favorable de C à l’arrivée imaginée, il choisit six programmes et confirme la chaîne cinq fois. Ces confirmations concernent GIGO L2 à L5 et MOTO L2. Seul MOTO valide officiellement le niveau avec C. Le choix sur GIGO L2 change et convertit un échec de C en réussite. Les cinq confirmations reproduisent une image déjà rencontrée pendant l’apprentissage avec une préparation différente. Sur 131 images initiales inédites, 11 chaînes B-C fonctionnent. Aucun des six pronostics positifs n’en retrouve une.

Sur les 100 sources, nous avons aussi isolé les commandes B qui avaient toujours laissé un rôle immobile, alors qu’il avait déjà bougé sous un autre geste. Une règle apprise sous ce deuxième geste peut inviter à essayer B quand une disposition satisfait cette règle pour la première fois. Parmi 873 cas mesurables, 75 déclenchent un premier mouvement. L’emprunt de règle propose dix essais, deux déclenchent le mouvement dans SKBN. Les deux arrivées diffèrent du déplacement emprunté. Dans KEYD, les deux essais proposés laissent le rôle immobile.

### Comportement du candidat figé

Le rejeu des commandes de chaque niveau supérieur retrouve les coordonnées réellement observées et vérifie que le témoin sans préparation avait laissé le rôle immobile. La v10 sélectionne 32 programmes fondés sur les coordonnées du plateau, confirme 15 arrivées et huit mouvements suivants. Pour ces 15 arrivées, la séparation relative employée par la v9 n’aurait pas qualifié le même essai à partir des éléments disponibles à cette décision. Deux préparations dont la prévision numérique est réfutée conduisent à une nouvelle décision sur les positions observées. Les deux essais révisés confirment B puis C.

GIGO L5 fournit quatre déclenchements confirmés où voyageur et partenaire ont conservé exactement leur écart après la préparation. Dans un cas, deux commandes 2 les déplacent respectivement de (32, 29) à (32, 31) et de (24, 15) à (24, 17). La commande 4 avait laissé le voyageur immobile depuis la disposition initiale. Depuis la disposition préparée, SIC annonce et atteint (33, 31), puis (33, 32) au geste suivant. Avant le premier geste, SIC avait déjà annoncé le programme entier 2, 2, 4, 2 et ces deux destinations. Au deuxième geste, il attend le partenaire en (24, 16) et l’observe en (24, 17). Les deux poses satisfont sa règle apprise, colonne au plus 24 et ligne au moins 16. SIC réfute la pose exacte, réévalue la règle sur l’observation réelle et conserve la suite annoncée. Le rejeu de chacune des neuf sous-suites strictes distinctes depuis le même préfixe n’atteint jamais (33, 32). Les neuf résultats sont mesurables. Un contrôle exhaustif des quatre flèches depuis ce même état donne zéro arrivée sur les 85 suites de longueur zéro à trois. Parmi les quatre permutations des gestes prévus, 2-2-4-2 et 2-2-2-4 atteignent la case. Les deux ordres qui essaient 4 plus tôt finissent en (32, 32). Le voyageur n’avait encore jamais occupé (33, 32) dans cet épisode. Les deux rôles se sont déplacés ensemble pendant la préparation, ce qui laisse ouverte la question de leur contribution individuelle. C’est le seul des huit programmes complets de cette famille à passer ce contrôle sur les niveaux supérieurs. Cet accès local ne valide pas GIGO L5.

Les deux versions gagnent 65 des 100 L1. La v10 gagne CGWL et VOIS en plus du témoin et perd SMLP et TRIA. Sur les 18 niveaux supérieurs, la v10 gagne GARE L2, GIGO L2 à L4 et GRAV L2. Le témoin gagne également GRAV L3 et POLA L3. Le résultat agrégé reste à 5 contre 7, comme pour la v9. Les essais et leur rejeu démarrent depuis les mêmes empreintes publiques. La suite SIC passe 142 tests sur 143, avec l’assertion déjà en échec sur le témoin.

Sur SS01 L2, le candidat figé exécute 447 commandes avant la limite de temps actif. Les rejeux confirment une arrivée et un mouvement suivant de la famille des placements conditionnels, aucun franchissement de région et aucune victoire. Aucune des trois propositions de cette famille n’utilise la nouvelle règle de coordonnées. À 447 commandes, le témoin avait visité 119 images et la v10 en visite 145. SS09 L2 reste en réserve.

Les mesures par variante, les empreintes des trajectoires et les résultats par niveau figurent dans [les données agrégées](sic-projected-affordances-results.json). Les commandes sources nécessaires pour reproduire les suppressions figurent dans [les 18 programmes et leurs entrées](sic-source-seven-programs.json). Les conditions de gel sont consignées dans [le protocole](sic-projected-affordances-protocol.md).

## v11 · Tester ce qu’une disposition permet de commander

Pour chaque entrée source, le laboratoire garde le dernier geste C d’un court suffixe à part. Il compare les programmes A-B depuis le même préfixe. Un programme gagne si C fait progresser le niveau. Il est compté comme indispensable dans cette expérience si C seul, A-C et B-C échouent aussi. Les préparations terminant le niveau avant C sont écartées. Pour une trajectoire source sans victoire, le geste de contrôle est pris après un préfixe d’au plus huit commandes. Une des 100 traces L1 contient moins de trois gestes.

Sur les 18 niveaux supérieurs, 20 des 1 299 programmes mesurés sont gagnants et indispensables. Après mesure de tous les gestes, le changement des déplacements disponibles pour un rôle retient 215 programmes dont 16 gagnants. En cachant une moitié des gestes après A, on peut choisir B à partir d’un autre geste D dont l’effet a changé pour le même rôle. Cette sélection retient 481 essais dont 13 gagnants, répartis sur six niveaux de GIGO et GRAV. Pour chacun des 13, une préparation de même longueur permet également un contrôle négatif avec B et C inchangés. Huit proviennent de GRAV L2 et offrent même un croisement. Depuis le même préfixe, 1-3-2 et 3-1-2 gagnent, tandis que 1-1-2 et 3-3-2 échouent. Ce sont des interventions sur des trajectoires sources gagnantes. Le résultat autonome est mesuré séparément depuis l’entrée du niveau.

Sur les L1, C donne 388 victoires sur 4 709 programmes, dont 54 exigent les deux gestes selon les suppressions. La même sélection partielle retient 31 des 54 dans 1 202 essais. Le modèle qui doit imaginer tous les effets après A, privé des observations issues de cette image, sélectionne 101 programmes sur les niveaux supérieurs. Un gagne et sa destination annoncée est incorrecte. Une équation ajustant une translation et une symétrie aux gestes connus donne 37 réponses exactes sur 57 désaccords en L1, contre 13 pour le déplacement ordinaire. Quand on exige une destination en mouvement encore absente des gestes de calibration, elle donne une réponse exacte sur dix, contre trois pour le déplacement ordinaire. Aucun des huit désaccords des niveaux supérieurs ne favorise cette équation.

### Résolution autonome et transfert

La v11 et le témoin remportent chacun 65 des 100 L1 sources. La v11 gagne cinq des 18 niveaux supérieurs contre sept pour le témoin. Les 118 entrées et leurs trajectoires sont contrôlées par rejeu. La nouvelle expérience teste six commandes après une variation mesurée de D sur les niveaux supérieurs. Deux ont un déplacement différent du bras de référence et une déplace effectivement le rôle dans la disposition préparée. Dans MOTO L2 au geste 61, la position d’arrivée (52, 4) est commune aux deux bras, mais les origines sont différentes. La prévision exacte est réfutée. SIC révise alors la suite depuis l’arrivée observée et atteint (52, 8) au geste 62. Le moteur ne valide pas le niveau.

Sur SS01 L2, le candidat figé exécute 595 gestes et le témoin rejoué dans cette campagne en exécute 635. Les deux atteignent leur limite de temps actif. À 595 gestes, la v11 compte 166 images distinctes et le témoin 147. La comparaison de répertoire a été essayée une fois sur le candidat. Le déplacement de B est identique à celui du bras de référence. Les deux rejeux géométriques donnent zéro franchissement de région et le moteur donne zéro victoire. SS09 L2 demeure réservé.

### Imaginer une arrivée distante

Dans une expérience distincte sur les sources, on apprend le déplacement ordinaire d’un rôle sous une commande, puis on cherche deux motifs visibles de même forme. Si le mouvement approche ou quitte un motif, la différence de position avec son partenaire fournit une destination distante possible. La prévision est enregistrée avant de jouer le geste. Dans PRTL L1 au geste 5, le voyageur est en (6, 51). Un déplacement ordinaire de cinq unités vers la gauche annoncerait (1, 51). La correspondance des motifs annonce une seule destination, (56, 51). Le voyageur y arrive et cette position était inédite dans l’épisode. Sur les 100 L1, c’est l’unique arrivée exacte parmi 187 hypothèses distantes mesurables. Les 18 programmes gagnants supérieurs fournissent un déplacement distant et aucune proposition de cette famille. Sur les 18 trajectoires autonomes supérieures, les 85 propositions mesurables ont toutes manqué leur destination.

Un second essai source fige jusqu’à douze préparations depuis l’entrée après avoir étalonné les flèches sur quatre essais simples au plus. Sur PRTL L2 et L3, il imagine respectivement deux et onze préparations. Aucune n’atteint toute la suite de positions annoncée. Sur PORT L2 et L3 il s’abstient. Sur FOGW L2 et L3, aucune des quatre préparations choisies par niveau n’atteint la disposition prévue. Cette règle géométrique reste expérimentale et ne faisait pas partie de la v11 évaluée sur Custom 4.

### Modifier la préparation en gardant le voyageur au même endroit

La trace gagnante de PRTL L1 commence par trois commandes adressées à des points du plateau, puis trois déplacements vers la gauche. Nous avons repris le seul cas de destination exacte trouvé dans les 100 traces et modifié les quatre premières commandes par suppressions, permutations et substitutions. Pour chaque préparation, le laboratoire fixe une prévision à partir des motifs alors visibles, enregistre aussi celle qu’auraient donnée les motifs de l’image initiale, puis joue les deux dernières commandes d’origine. C’est une expérience sur un cas sélectionné après observation du succès initial.

Les 135 préparations testées donnent 28 images distinctes où l’on retrouve le voyageur. La position après le premier des deux gestes est mesurable sur 23 de ces images. La règle propose une destination distante sur quatre images, en prédit exactement deux, et la commande suivante gagne dans ces deux cas. L’une des deux images est nouvelle par rapport au préfixe d’origine. Les deux prévisions exactes visent la même destination. Garder les motifs à leur position initiale ne donne aucune arrivée exacte. Aucune des 15 suppressions strictes de la préparation ne gagne.

Un contrôle conserve la longueur du programme, la position (6, 51) du voyageur et les deux commandes finales. En remplaçant seulement le troisième geste de préparation, la règle s’abstient, le voyageur arrive en (4, 51) et la commande suivante échoue. Avec la préparation d’origine, ou avec une permutation des trois gestes adressés, il arrive en (56, 51) et la suite gagne. Un second rejeu indépendant a vérifié les trois images de préparation, les arrivées et le verdict du moteur. Ce contrôle établit que la préparation peut ouvrir un trajet. Déduire un placement qui ouvre une deuxième destination reste à démontrer.

Pour tester la découverte depuis l’entrée, trois recherches bornées explorent les L1 à L3 de PRTL, PORT et FOGW. Avec les flèches, elles mesurent 222 prévisions de destination sur les neuf entrées. Avec toutes les commandes déclarées et un échantillon de points visibles, l’exploration en largeur en mesure 252. Une exploration qui répartit aussi les essais entre différentes profondeurs et alternances de commandes en mesure 268. Aucune arrivée prévue n’est exacte. Sur PRTL L2, chacune des deux recherches mixtes développe 96 images et essaie 2 112 commandes, sans produire de prévision distante mesurable. Sur FOGW L2, les trois recherches trouvent des commandes gagnantes sans avoir prédit un transfert. Les six essais autonomes complémentaires de la v11 sur les L2 et L3 de ces trois jeux se terminent également sans victoire.

La v11 passe la compilation TypeScript et 145 des 146 tests SIC. L’échec du cycle orienté se reproduit sur la version de référence. Sur toute la suite, 15 507 des 15 645 tests réussissent. Parmi les 138 échecs, 137 se reproduisent avec le code de référence. Le dernier test atteint une limite de temps sous charge et réussit isolément sur les deux versions.

## v12 · Choisir un site pour ouvrir un trajet

Sur PRTL L1, enlever le troisième geste de préparation fait disparaître le motif de sortie. Dans la préparation d’origine ce geste fait apparaître le motif à une unité du point visé sur chaque axe. À partir de cette seule liaison, le laboratoire inverse l’équation pour viser des destinations différentes de l’arrivée connue, à au moins trois pas du voyageur, et avec une continuation dans le plateau. Il fixe les préparations avant de mesurer leur résultat. Sur les 33 points de même couleur et sur l’ensemble des 3 161 points admissibles, aucune sortie n’apparaît à la nouvelle position calculée. Dans le second ensemble, 29 commandes réactivent le trajet connu vers (56, 51). Les 3 132 autres laissent le voyageur en (4, 51). Les 3 161 essais conservent la même pose de départ.

À partir de la démonstration gagnante, un autre laboratoire apprend quelles transformations locales rendent deux sites utilisables. Il réassocie les gestes aux composants de l’image disponible et peut rechercher une autre approche. Il reproduit PRTL L1 depuis l’entrée avec la destination annoncée. L’association par forme exacte, l’association par modification locale et la recomposition des interventions n’ont validé aucune autre destination. La dernière expérience couvre notamment PRTL L2 à L5. Les essais de démonstration n’entrent pas dans les scores autonomes.

Sur les 100 journaux d’origine, filtrer les destinations annoncées selon l’apparition indépendante des deux motifs réduit les essais mesurables de 187 à 25. Le résultat exact de PRTL est conservé. Sur les 18 journaux gagnants des niveaux supérieurs, ce critère ne propose aucun transfert. La politique générique de la v12 peut aussi proposer de configurer un site. En lui donnant progressivement les préfixes publics des traces d’origine, sa première proposition apparaît sur 16 L1. Six préparations correspondent à la géométrie annoncée. Dix tentatives atteignent la commande de passage, dont une prédit exactement l’arrivée. Dans PRTL L1 la commande suivante gagne. Deux premières propositions apparaissent sur les niveaux supérieurs. Dans POLA L3, la commande de préparation gagne immédiatement depuis le préfixe de trois gestes. Dans POLA L5, la préparation échoue. Aucun de ces deux cas ne valide le passage imaginé.

### Parties autonomes et transfert sur Custom 4

Les 100 entrées sources, les 18 niveaux supérieurs et les deux essais SS01 L2 ont été rejoués. La v12 gagne 59 des 100 L1 contre 65 pour le témoin. Dans PRTL L1, le solveur prédit et effectue le transfert au geste 5. Le geste 6 gagne. Sur les 32 commandes de passage choisies par la nouvelle famille en L1, c’est sa seule prévision de destination exacte. Dans FITE L1 le niveau se termine pendant l’approche. Sur les niveaux supérieurs, la v12 et le témoin gagnent chacun sept niveaux. La v12 gagne POLA L2 en 46 gestes et perd GRAV L3 au plafond de 120 gestes. Le témoin perd POLA L2 au plafond et gagne GRAV L3 en 39 gestes. Les deux préparations tentées par cette famille dans POLA L2 ont échoué à produire la géométrie annoncée.

La v12 figée en `6cc05bc6` exécute 909 commandes sur SS01 L2 et le témoin `7f2cb3eb` en exécute 956. Les deux atteignent la limite de temps actif. À 909 commandes le candidat a visité 187 images et le témoin 168. Aucun des deux ne franchit de région ni ne gagne. La v12 ne sélectionne aucun essai de sa nouvelle famille sur ce niveau. SS09 L2 reste réservé. La compilation TypeScript réussit et 147 des 148 tests SIC passent. La comparaison du cycle orienté échoue également sur la référence.

### Prévoir plusieurs destinations depuis la même pose

Dans un laboratoire indépendant du candidat v12, le voyageur garde sa position et la commande de déclenchement reste fixe. Les commandes de préparation font varier la position d’un autre composant. Une partie des images obtenues en deux gestes est réservée avant de mesurer le déclencheur. À partir des autres images, le laboratoire ajuste une relation entre la position du composant et la destination du voyageur. Les coordonnées du composant et les destinations retenues pour la validation sont toutes absentes des calibrations correspondantes. Les programmes, destinations et continuations sont fixés avant les essais de validation.

Sur les 100 L1, ce protocole prépare 1 131 images distinctes à l’échelle de leur niveau. Il produit 41 prévisions de rôle, dont 39 exactes, et cinq prévisions de continuation, toutes exactes. VOIS fournit 34 résultats exacts sur 17 couples image-commande distincts, KA59 quatre, RE86 un. Deux prévisions échouent dans CASC. Les 38 résultats de VOIS et KA59 sont également représentables par les lois de mouvement déjà présentes dans SIC quand on leur fournit les calibrations. Le cas RE86 déplace un rôle en (18, 24) lorsque son repère est en (7, 13), puis en (18, 21) au geste suivant. Sur les 18 niveaux supérieurs des sept jeux initiaux, les 269 images préparées ne fournissent aucune extrapolation répondant aux critères de cette expérience.

Dans VOIS L1, depuis (42, 22), la commande 5 seule donne (10, 22). Après les préparations 1-1 et 1-4, le même geste donne respectivement (10, 14) et (14, 18), exactement les positions demandées. L’autre composant revient en (42, 22) dans ces deux branches. Dans KA59 L1, depuis (46, 31), la même commande adressée peut produire quatre destinations distinctes encore absentes des calibrations. Ce sont des mesures sur des composants visibles. Les règles physiques et les objectifs propres aux jeux n’interviennent pas dans l’identification.

### Suivre une pièce parmi plusieurs pièces identiques

Lorsqu’une classe compte plusieurs occurrences du même aspect, le laboratoire repère un déplacement si toutes ses occurrences sauf une conservent leur place. Il abandonne l’attribution si le nombre change ou si deux occurrences quittent simultanément leurs positions de référence. Dans les 100 traces sources, on relève ainsi 129 paires d’échanges supplémentaires réparties sur 15 jeux, dont GRAV et CWSE. Plusieurs composants peuvent décrire une même commande. Le suivi natif des seules signatures uniques en détecte 15.

Depuis l’entrée, le laboratoire essaie des commandes publiques, cherche une disposition qui rend un échange mesurable et le calibre sur deux placements. Il explore ensuite les placements accessibles sans essayer le déclencheur, fige 32 programmes parmi eux et vérifie l’échange et son usage. Dans VOIS, une première commande de préparation suffit à faire apparaître la situation testable. Sur chacun des L2, L3, L4 et L5, avec le même budget, le suivi par signatures uniques n’avait proposé aucune disposition. Avec le suivi par élimination, les 32 destinations distinctes annoncées par niveau sont atteintes. Le rejeu indépendant vérifie les autres occurrences, les positions des deux composants, les empreintes et les commandes.

Sur ces quatre niveaux, 119 des 128 commandes suivantes atteignent la coordonnée prévue. Elles portent sur le composant qui a pris la place de départ du voyageur. Pour les prévisions exactes, il s’agit d’une même coordonnée de continuation par niveau. Dans 112 cas, omettre l’échange mène ce composant à une autre position au geste suivant. Aucune des 128 branches ne gagne. Dans KA59 L4, depuis un préfixe public de 22 gestes du solveur figé, l’expérience retrouve 32 échanges et 31 continuations exactes. À partir de l’entrée de chacun des 18 niveaux supérieurs des sept jeux initiaux, la recherche de compositions avec les seules signatures uniques ne propose aucun échange. Les huit parties autonomes complémentaires de la v12 sur VOIS et KA59 L2 à L5 échouent. Ces expériences par branches restent distinctes d’une partie autonome.

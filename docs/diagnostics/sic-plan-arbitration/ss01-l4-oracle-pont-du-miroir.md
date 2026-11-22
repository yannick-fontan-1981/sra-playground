# SS01 L4 · Un pont pour le miroir

**Le chemin proposé gagne en 77 commandes. SIC perd la possibilité d’atteindre les îlots du bas dès sa quatrième commande.** Mesures réalisées sur le code du site local du 22 novembre 2026, commit `1881fb08`, en mode SIC. L’oracle utilise les transitions du jeu hors ligne. Le pilote autonome reçoit les observations et les actions publiques.

## Ce que le L3 a apporté

SIC sait choisir une expérience spatiale avec un effet vérifiable. Il repère une frontière entre deux régions, choisit une pièce et une position de poussée, déplace la pièce, puis tente d’entrer sur la case modifiée. Entrer sur cette case prouve une capacité de déplacement que la seule disparition visuelle de la pièce ne suffit pas à établir. Le pilote peut citer cette observation pour construire un autre passage. Une arrivée dans une région inconnue peut aussi déclencher un simple essai de contact avant même que SIC ait identifié la sortie.

En campagne au L3, la première poussée a lieu au coup 6, la première immersion au 7 et la première entrée vérifiée au 8. Le projet sélectionné au 9 cite ce retour. Le deuxième passage est créé au 38, vérifié au 39 et le moteur crédite le niveau au 42. La règle générale qui propose d’essayer un objet à la frontière est fournie par le code. Le choix de l’objet, du site, des commandes et la confirmation viennent de la partie.

## Oracle jouable

Partir de l’état initial du L4. **H** = haut, **B** = bas, **G** = gauche, **D** = droite, **X** = activer le miroir. Un chiffre répète la commande précédente. Les coordonnées sont celles de la grille logique de 20 × 20, origine en haut à gauche. Chaque ligne continue la précédente.

| Coups | Commandes | Effet vérifié après la dernière commande |
|---|---|---|
| 1–11 | `G2 B H D2 B G B G2` | La caisse haute crée une plateforme en **(9,6)**. Les îlots du haut sont reliés. |
| 12–21 | `D X H G B D B G3` | Le marchand pousse le miroir sur le premier pont au coup 20, puis en **(8,6)** sur l’îlot supérieur gauche au 21. |
| 22–26 | `D4 X` | Le marchand se place cinq cases à l’est du miroir. Le reflet l’envoie de **(13,6)** à **(8,11)**, en bas à gauche. |
| 27–33 | `B2 D H4` | La caisse initialement en (9,12) crée la plateforme **(9,8)**. Il manque encore une case pour former le passage vertical. |
| 34–50 | `B2 G3 B2 D2 B D H6` | La caisse initialement en (7,13) crée la plateforme **(9,7)**. Les trois cases de la colonne 9 sont maintenant praticables. |
| 51–66 | `H G2 H2 D B G B D H D B4` | Au coup 62 le marchand est en **(9,6)**, juste au-dessus du miroir en **(9,7)**. Il peut le pousser jusqu’en **(9,11)**. |
| 67–75 | `D B X H B4 X` | Un reflet local au 69 permet de repousser le miroir en **(9,10)** au 70. Depuis **(9,15)**, le reflet du 75 envoie le marchand en **(14,10)** sur l’îlot inférieur droit. |
| 76–77 | `D B` | Le marchand atteint la sortie en **(15,11)**. Le moteur crédite le L4. |

La séquence a été rejouée dans une nouvelle session après les 110 commandes de la campagne SIC gagnante des L1 à L3. Résultat du moteur après le dernier geste : quatre niveaux crédités et L5 ouvert. Sur le site local port 64925, Chrome a également affiché les trois crédits de SIC, puis le L5 après les 77 actions jouées au moyen des boutons en mode manuel. Le vérificateur joint relit directement le tableau, crédite aussi le L4 en entrée isolée et contrôle les bifurcations du quatrième coup. Exécution depuis la racine du dépôt avec Node 24 : `node docs/diagnostics/sic-plan-arbitration/ss01-l4-verifier-oracle.mjs`.

## Vérification des cinq étapes proposées

1. **Les deux caisses du bas ne suffisent pas à relier à pied les deux îlots inférieurs.** Au plus près, trois cases d’eau les séparent. En haut, l’unique coupure d’une case entre les deux îlots est (9,6). Une plateforme en (10,5), que SIC choisira, ne joint aucune nouvelle région.
2. **Le miroir ouvre les traversées que le stock accessible ne permet pas de construire.** Avec toutes les commandes, l’énumération visite 2 187 configurations physiques avant le premier accès au bas. Toutes les premières arrivées ont trois propriétés : elles se font par reflet, sur l’îlot inférieur gauche, après immersion de la caisse haute en (9,6). Il reste alors deux caisses. Le moindre passage de sol jusqu’à l’îlot de sortie demanderait encore trois nouvelles cases. Les caisses de ce niveau sont poussées et coulent à la première case d’eau. Le dernier accès à l’îlot de sortie exige donc lui aussi un reflet. Après la construction du pont vertical, le haut et le bas gauches communiquent à pied.
3. **La caisse haute sert à transporter le miroir.** La plateforme (9,6) permet de pousser le miroir vers la gauche. Elle servira une seconde fois, comme position du pousseur pour le faire ensuite descendre.
4. **Les caisses du bas préparent la mobilité du miroir.** La première immersion, en (9,8), a de la valeur avant même que le pont soit complet. La seconde, en (9,7), rend possible une chaîne de poussées. Pour la trouver, il faut simuler où le marchand pourra se tenir à chaque poussée et où passera le miroir.
5. **La sortie est atteinte par le dernier reflet.** La disposition recherchée est mesurable. Le marchand est cinq cases au sud du miroir ; il atterrit cinq cases à son est, sur du sol libre.

## Première décision perdante de SIC

Le témoin autonome repart du L1, conserve son apprentissage et gagne les trois premiers niveaux en 36, 32 et 42 coups. Au L4, il épuise le budget diagnostique de 120 coups, avec 50 commandes sans déplacement du marchand. Il ne touche aucune caisse inférieure. Le plafond de 120 borne la mesure de la trajectoire. L’impossibilité rapportée après le coup 4 est établie séparément, sans horizon de recherche, pour une continuation sans annulation ni redémarrage.

| Moment | Observation |
|---|---|
| Coups 1–3 | SIC joue bas, droite, reflet. Il reste sur l’îlot supérieur droit. Il peut encore gagner depuis l’état obtenu : reflet puis haut ramènent au départ physique et les 77 commandes de l’oracle réussissent. |
| Coup 4 | Depuis (12,6), SIC choisit haut. Le marchand arrive comme prévu en (12,5), mais pousse aussi le miroir de (12,5) à **(12,4)**. Le reçu sélectionné est une prédiction d’arrivée du sujet héritée du niveau précédent. |
| Même état, cinq commandes comparées | Après haut, l’énumération exhaustive des **112** configurations physiques atteignables ne trouve aucun accès au bas. Après chacune des quatre autres commandes, au moins un accès au bas subsiste. Pour la commande reflet, une continuation gagnante complète a également été vérifiée. |
| Coup 15 | La caisse du haut disparaît dans l’eau en **(10,5)**. Cette dépense aggrave une impasse déjà constituée. |

La comparaison utilise le moteur inchangé. Elle conserve la position du marchand et du miroir, les caisses restantes et les cases devenues praticables. La direction du regard et l’animation d’échec n’influencent aucune action future de ce L4.

## Pourquoi le plan du L3 ne concurrence pas le quatrième geste

Au moment de choisir le coup 4, le détecteur visuel a bien trouvé trois occurrences de l’apparence des caisses. SIC a également hérité d’une preuve de déplacement par contact. Pourtant, le constructeur de la carte utilisée pour les expériences de poussée ne retient **aucun objet candidat**. La même apparence a déjà servi d’indicateur dans une prédiction de mouvement. Le code élimine de la liste des objets toute apparence figurant dans cet ensemble d’indicateurs. Le reçu choisi pour « haut » prédit donc l’arrivée du marchand à partir d’un témoin du niveau précédent, sans projet concurrent portant sur la mobilité future du miroir. [Construction de la carte et filtre des rôles](../../../src/sic/contact-frontier.ts)

Une comparaison hors pilote, sur cette même observation et cette même mémoire, a neutralisé uniquement l’exclusion des indicateurs. Les trois caisses redeviennent candidates et la carte est construite. Un autre élément visuel entre aussi dans la liste et le chercheur ne propose toujours aucun plan à cet instant. Ce contrôle situe une première perte d’information et montre la limite d’une simple suppression du filtre. Au passage de niveau, cette famille transmet un témoin de poussée. Les confirmations locales d’entrée sur une case transformée sont conservées pendant le niveau où elles ont été acquises.

## Ce que doit apporter le raisonnement générique

- **Permettre plusieurs rôles pour une même apparence.** Une pièce peut être un indice visuel de l’arrivée du marchand et un objet physique déplaçable. Suivre chaque occurrence et distinguer ces hypothèses par leurs prédictions sur la pièce elle-même. Une expérience de contact antérieure ou un déplacement solidaire a plus de valeur pour cette question qu’une simple corrélation visuelle.
- **Prévoir l’effet sur tous les objets concernés par un geste.** Une commande peut réussir sa prédiction sur le marchand tout en déplaçant l’unique mécanisme utile. Avant une poussée risquée, comparer les placements futurs encore accessibles et la face depuis laquelle on pourra repousser l’objet. Le contrôle directement testable est de distinguer les cinq gestes disponibles après le troisième coup.
- **Continuer après une hypothèse réfutée.** Si le mécanisme s’avère coincé et qu’aucune expérience restante ne lui rend sa mobilité, une reprise du niveau peut avoir un but précis. Conserver le constat « cette poussée me prive de la position de retour » et essayer une autre préparation. Le témoin a continué à jouer dans la branche perdue.
- **Affecter les ressources à partir de leur accessibilité.** Estimer le nombre minimal de transformations nécessaires entre deux régions, compter les objets qu’on peut effectivement y amener, puis considérer une autre capacité de traversée lorsque le compte est insuffisant. Réserver la caisse haute à un passage qui donne accès à la suite.
- **Donner de la valeur à une préparation incomplète.** Le chercheur de contacts actuel sélectionne les cases dont la transformation joindrait immédiatement deux composantes de sol. Lorsqu’il projette une immersion, cette branche de la recherche s’arrête à cette expérience. Pour dériver le pont du L4, il faut représenter l’objet consommé et le sol projeté dans un état hypothétique, puis évaluer une seconde transformation depuis cet état. Une conséquence simulée doit rester distincte d’un effet déjà vérifié.
- **Raisonner à rebours sur la mobilité du mécanisme.** Partir d’une arrivée sur l’îlot de sortie, dériver une position du miroir et une position du marchand, puis dériver comment déplacer le miroir jusque-là. Les positions successives du pousseur font partie du plan. Ce raisonnement explique pourquoi la toute première caisse fournit encore une capacité au coup 62.

Le premier chantier à évaluer associe la conservation des différents rôles à la comparaison des conséquences d’une même commande pour le sujet **et** pour l’objet poussé. Le second est la planification de plusieurs transformations de terrain avant qu’un passage existe. Les cas discriminants sont respectivement le coup 4 et la première caisse du pont vertical. Ces deux tests peuvent être construits sur des géométries nouvelles, avec des rôles appris depuis les observations publiques.

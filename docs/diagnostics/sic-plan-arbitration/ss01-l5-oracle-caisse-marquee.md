# SS01 L5 · À qui le miroir peut-il appliquer son effet ?

Le diagnostic ci-dessous concerne la révision 195. La révision 197 obtient depuis une victoire autonome en 62 coups depuis l’entrée de campagne. [Mesure du candidat et preuves du transfert](./ss01-l5-transfert-passif.md)

**L’oracle gagne en 38 coups, le minimum.** Sur le site local, SIC a gagné les quatre premiers niveaux en 36, 32, 42 et 79 coups. À l’entrée du L5, j’ai passé la main en mode manuel. Les 38 commandes ci-dessous ont ouvert le L6. Dans une campagne autonome distincte, SIC a atteint le L5 avec le même préfixe, puis a épuisé ses 120 coups de diagnostic. Version locale testée sur le port 64925, pilote SIC révision 195, commit de code `4a2b4bbc`, paquet `index-CzM2sZRq.js`. [Campagne depuis le L1](http://127.0.0.1:64925/?game=SS01&runThrough=4#playground) · [Entrée directe au L5](http://127.0.0.1:64925/?game=SS01&level=5#playground)

## Oracle jouable

H, B, G et D désignent les directions. X active le miroir. Un chiffre répète la commande. Les coordonnées sont en cellules, origine en haut à gauche, indexée à zéro. Le marchand commence en (6,12) sur l’île de gauche, la caisse en (10,9) et le miroir en (13,11) sur l’île de droite. La sortie est en (7,6) sur l’île du haut.

| Coups | Commandes | Effet à vérifier |
|---|---|---|
| 1–4 | `H D2 X` | Le marchand traverse de gauche à droite et arrive en (13,6). |
| 5–17 | `B4 X B D H2 D H G H` | Le marchand contourne le miroir et le pousse deux fois vers le haut. Au coup 13, un aperçu carré apparaît en (13,6). La poussée à gauche du coup 16 déplace cet aperçu en (12,7). Le marchand se place en (13,8). |
| 18–18 | `X` | Seule la caisse se déplace, de (10,9) à (12,7). En marchant sur l’île, le marchand peut désormais se placer sur chacun de ses quatre côtés et la pousser dans les quatre directions. |
| 19–25 | `G B2 H3 G` | Le marchand pousse le miroir en (12,11), la caisse en (12,6), puis se place en (11,7). |
| 26–26 | `X` | Seule la caisse traverse sur l’île de gauche, en (7,11). Le marchand reste sur l’île de droite. |
| 27–29 | `D X G` | Le marchand se téléporte juste à droite de la caisse, puis la pousse à gauche en (6,11). Cette poussée l’aligne avec le futur pont. |
| 30–34 | `B G H3` | Le marchand passe sous la caisse, la pousse vers le haut trois fois et la transforme en plateforme en (6,8). |
| 35–38 | `H3 D` | Il marche sur la plateforme, entre sur l’île du haut et rejoint la sortie. |

## Vérification des hypothèses

| Proposition | Vérification dans le moteur |
|---|---|
| Pousser la caisse là où on la trouve gaspille l’unique ressource. | En conservant la caisse sur sa case de départ et en autorisant tous les placements accessibles du marchand et du miroir, les deux seules premières poussées qui la déplacent sont gauche, dans l’eau en (9,9), et haut, dans l’eau en (10,8). Les deux rendent la sortie inaccessible. |
| Le miroir seul dessert les deux îles latérales. | Sur l’ensemble des configurations atteignables, aucune activation ne transporte le marchand d’une autre île sur la terre de l’île du haut. Toutes les victoires ont une plateforme en (6,8). |
| Le point sombre mérite une expérience. | Les caisses précédentes avaient un centre uni. Quand le miroir est aligné avec cette caisse, un aperçu carré distinct de l’aperçu en croix du marchand apparaît. Avant le coup 18, il n’y a qu’un aperçu. La caisse arrive sur cette marque tandis que le marchand et le miroir conservent leurs positions. Un second X immédiat ramènerait la caisse à son départ. |
| Le transport de la caisse apporte une capacité nécessaire. | En donnant à la caisse le comportement inerte des précédentes et en gardant toute la géographie, les poussées et la téléportation du marchand, on atteint 1 930 configurations et aucune victoire. Avec la caisse marquée, le graphe en contient 46 829 et la distance minimale à une victoire est 38. |
| La première téléportation sert à retrouver de la liberté de poussée sur la droite. | Toute solution requiert au moins un transfert de caisse de droite à droite. L’oracle le fait vers une case poussable des quatre côtés. Il existe aussi un chemin de 44 coups qui gagne sans réception à droite immédiatement poussable des quatre côtés. Les quatre côtés sont donc un bon critère de choix, pas une précondition à graver dans SIC. |
| La dernière traversée exige de préparer le sens de la poussée. | Le second transfert de caisse laisse le marchand sur l’autre rive. C’est son propre transfert au coup 28 qui lui donne accès au côté droit. La poussée à gauche aligne la caisse, puis la poussée finale vers le haut crée le pont. Aucune activation gagnante ne dépose directement la caisse dans l’eau en (6,8). |

## Où diverge réellement SIC ?

Premier passage sur l’île de droite au **coup 26**. Au 27, SIC repart aussitôt. Son reçu `use_prepared_access` prévoit trois cases de plus pour le marchand. L’essai est encore récupérable. Sur 120 commandes, SIC active le miroir 21 fois, déplace le marchand 16 fois par ce moyen et ne déplace jamais la caisse. À aucun des états visités avant ces commandes, une simple activation ne pouvait téléporter la caisse sur une autre case sèche. Il fallait **préparer** l’expérience. Dans le navigateur, une deuxième campagne entièrement autonome affichait toujours L5 et quatre niveaux crédités au coup total 309, soit 120 coups après l’entrée au L5.

La première perte irréversible arrive au **coup 53**. Le reçu détecte une boucle (`stagnation_repeated_cycle`) et prévoit de bouger le miroir (`move_to_change_access`). Il estime le gain à **une case** pour le marchand et porte déjà la valeur `recoverable: false`. Le mouvement choisi est bas. Le miroir passe de (13,11) à (13,12). Dans les 115 configurations encore atteignables, le miroir reste sur cette case et aucune ne conduit à la sortie. SIC joue jusqu’à la limite sans retour arrière ni reset.

Après le coup 52, les quatre autres commandes laissent une victoire possible. En commençant par X, la suite `X B D H2 D H G X` permet de déplacer la caisse sur une case à quatre poussées en neuf coups. Le trajet complet le plus court vers la sortie depuis l’état du coup 52 en demande 30.

**Deux préparations depuis la même scène expliquent ce que SIC devrait choisir.** Juste après le coup 13 de l’oracle, activer immédiatement envoie la caisse en (13,6). Le marchand y dispose de **zéro direction de poussée vers du sol**. Depuis cette même scène, jouer `D H G X` déplace le miroir puis envoie la caisse en (12,7). Le marchand dispose alors de **quatre directions de poussée vers du sol**. Dans les deux expériences il reste immobile pendant l’activation, et un second X inverse le transfert. Le contour carré permet de prévoir l’arrivée dans les deux cas. L’emplacement d’arrivée détermine ce que l’agent peut faire ensuite.

## Le raisonnement à ajouter

Le planificateur de contact sait déjà transporter le sujet qui marche, pousser une pièce depuis une position d’appui et réutiliser une case transformée en sol. Dans son modèle du transport, `fittedTransport` sélectionne les témoins du rôle de l’acteur. La recherche de marche applique ensuite la loi au marchand en laissant les positions des pièces fixes. Dans le plan de supports, une pièce change de position quand elle est poussée. Ces opérations suffisent au L4. Elles ne produisent pas la prédiction « j’active depuis ici, je reste immobile et cet autre objet rejoint sa marque ». Les reçus examinés montrent le projet exécuté. Ils ne permettent pas d’attribuer à un arbitre le rejet d’une hypothèse qui aurait déjà été correctement formulée. [Ajustement de la loi](../../../src/sic/contact-frontier.ts) · [Recherche de déplacement](../../../src/sic/contact-frontier-search.ts) · [Composition des supports](../../../src/sic/compose-support-plan.ts)

1. **Changer l’entité sur laquelle porte la prédiction.** L’agent connaît déjà une relation entre commande, position relative au mécanisme et arrivée. Devant une pièce distinctive dont toutes les poussées immédiates sont perdantes, il peut essayer cette même relation avec la pièce comme entité déplacée. La marque visuelle augmente l’intérêt du test. La géométrie héritée fournit une prédiction réfutable.
2. **Choisir une expérience qui sépare les hypothèses.** Projeter une arrivée libre et accessible pour la pièce, préparer l’alignement, puis écarter le marchand. Une activation où seul le marchand serait éligible ne ferait rien. Si la pièce est aussi éligible, elle devrait disparaître de sa case et réapparaître à la marque. Vérifier les deux positions, l’immobilité du marchand et la possibilité de revenir. Le coup 18 offre ce contraste.
3. **Mesurer ce que le résultat permet ensuite.** Noter les directions de poussée effectivement accessibles, les futurs alignements, puis la possibilité de rejoindre le côté utile après un second transport. Rechercher à rebours depuis le support manquant : plateforme → dernière poussée → bonne colonne → bon côté de la caisse → transport de la caisse et du pousseur. Conserver séparément leurs positions. Le nombre de cases accessibles au seul marchand ne mesure aucune de ces capacités.
4. **Protéger les moyens encore uniques d’expérimenter.** Avant une poussée au bord, comparer les expériences qui resteraient réalisables dans chaque disposition. Si un essai réversible peut trancher la question, le placer avant la poussée signalée non récupérable. Si une impasse s’est déjà produite, utiliser un retour arrière vérifié ou réinitialiser le niveau et éviter de recréer la même disposition.

Un test de généralisation pourrait reprendre une autre scène où une commande déjà acquise déplace aussi une pièce passive, par exemple un convoyeur. Changer la forme du repère et la direction, puis comparer deux dispositions dont une seule rend le prochain geste possible. Mesurer séparément le choix spontané du test, la bonne attribution du changement à la pièce, sa réutilisation dans un plan et la victoire. Ce transfert reste à mesurer.

## Reproduction

Depuis la racine du checkout sous Node 24, exécuter `node docs/diagnostics/sic-plan-arbitration/ss01-l5-verifier-oracle.mjs`. Le vérificateur extrait les commandes du tableau, vérifie le crédit du moteur officiel et parcourt les états du niveau. Il conserve les positions du marchand, du miroir et de la caisse ou de la plateforme. L’orientation du marchand et l’animation d’un geste refusé n’affectent aucune transition physique. Les cinq commandes sont autorisées. Le retour arrière et le reset sont exclus du calcul d’impasse. Les noms, coordonnées, accès au moteur et commandes de référence restent dans le diagnostic.

Pour régénérer la mesure autonome sous PowerShell, définir `$env:SIC_STUDY_SOLVER='sic'`, `$env:SIC_STUDY_WORKERS='1'` et `$env:SIC_STUDY_RECORD_COMMANDS='1'`, puis lancer `node scripts/compare-source100.mjs . . campagne-l5.jsonl SS01 1 5 120` avec un chemin de sortie neuf. Passer ce JSONL au vérificateur comme argument pour comparer la trace, la première perte et les résultats par niveau. [Vérificateur hors ligne](./ss01-l5-verifier-oracle.mjs)

# SIC Fallback · Déduire une capacité encore inconnue

## Question

SIC peut-il annoncer une action composée dont personne ne lui a montré l’effet entier, prédire simultanément ce qui bougera et ce qui restera fixe, puis employer cette capacité pour atteindre une autre disposition ?

Les opérateurs proviennent des observations publiques du niveau. Le gabarit algébrique, les critères d’admission et le budget sont des choix de conception. Les identités de jeu, les palettes, les commandes du mécanisme et les coordonnées des jeux sources ne figurent pas dans le solveur.

## Équation

Soit P une transformation spatiale apprise et U un contrôle élémentaire observé. L’inconnue X désigne **un effet sur les rôles et leurs positions**. En notation fonctionnelle, le solveur pose P ∘ X = U ∘ P et calcule X = P⁻¹ ∘ U ∘ P. Dans l’ordre des commandes, cela donne P, U, puis le programme qui devrait inverser P. Pour chaque rôle, le calcul prédit une origine, un déplacement et une position finale. Il permet notamment de proposer le déplacement indépendant d’une pièce jusqu’ici immobile sous U.

Un circuit observé entre plusieurs rôles donne un candidat inverse par répétition, lorsque leur permutation et ses décalages ont un ordre fini. Une translation peut être compensée par un retour déjà mesuré ou par un vecteur opposé observé ailleurs. Le moteur distingue les inverses constatés et les inverses inférés. Pour une tentative de contournement, U doit avoir effectivement laissé la pièce sur place dans la configuration de départ. Une action qui bloque ne suffit pas à identifier un obstacle physique.

SIC annonce le programme avant son premier pas. Il vérifie chaque position intermédiaire et interrompt l’expérience au premier écart. Une capacité vérifiée peut se composer avec un contrôle indépendant. L’agent enregistre les dispositions atteintes. Lorsqu’il prévoit en plus qu’un déclenchement donnera à un rôle accès à une position inédite, il annonce cette conséquence et l’essaie après le programme.

## Origine et gel

- Les 100 traces publiques `source-final-0..7` de L1 constituent le corpus de conception. Leur rejeu couvre 2 904 actions. Un inventaire du graphe public trouve 63 exemples dans 13 jeux où un même contrôle immobile puis productif admet une préparation observée de une à six commandes qui maintient la position du voyageur. Ce décompte porte sur des configurations observées.
- Les interventions sources sur VOIS ont fourni un cas plus fort. Le déplacement de la pièce tenue fixe par la commande élémentaire devient prédictible par changement de repère. L’audit source prospectif balaie les 100 traces, puis teste hors ligne jusqu’à trois hypothèses distinctes par type et par jeu à partir des préfixes choisis, avec un déclenchement témoin au même départ.
- Le candidat et son témoin sont publiés sous les balises `sic-capability-equations-source100-candidate-v1` et `sic-capability-equations-source100-control-v1`. Le témoin du solveur est `3253d5b1049cd334420ab2f945df3b49746ab18d`. Le moteur de jeu reste `f4d28aee9ebbb35533bb97a26968efd22887473d`.
- À code figé, le candidat joue les 100 L1 à 60 actions, et SS01 L2 en entrée directe jusqu’à la victoire, la fin de partie ou 1 200 actions. Le résultat à 600 est un point intermédiaire de la même session. Comparaison au témoin à budget et image initiale identiques. SS01 a déjà été étudié. SS09 L2 demeure réservé.
- L’évaluation distingue la capacité imaginée, le programme entièrement vérifié par l’agent, le contraste réussi depuis un préfixe identique, l’accès ultérieur vérifié et la victoire officielle. Une réussite sur un jeu source ne constitue pas une réussite sur SS01.


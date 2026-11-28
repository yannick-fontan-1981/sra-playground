# Comparaison native des hypothèses acquises en jeu

Référence moteur `fb8d6913addd23f5dd1cc375f96f9a69b2410b21`, arbre `src` `c6be00220e0691619413e9244101f9c6a302c144`. Le protocole utilise des retours de jeu réels. Les SS08 à SS25 restent exclus.

Chaque bras repart du niveau 1, en mode SIC strict, avec un worker, les mêmes budgets natifs et la même version du jeu. L’option active est la préférence existante `bind_earlier_motions_to_registered_subjects`. Elle enregistre les mouvements observés avant sélection, les réattribue après un retour de sélection identifiable, puis tente des suites contraintes à partir de ces acquis. Les positions, les appuis et les effets de la commande sont relus à chaque retour. Une liaison ou une position contraire doit faire réexaminer le plan.

Le témoin de départ est SS01. Au niveau 6, le moteur standard s’est arrêté au plafond de 80 gestes. Les 80 gestes appartiennent à `sic_test_prepared_effects`, avec de vrais retours de déplacement et de modification. Les cinq niveaux précédents ont été franchis. Ce témoin distingue l’absence de solution sous plafond d’une absence d’effet observable.

Les jeux SS01, SS03, SS05, SS06, SS07 sont des terrains de développement autorisés. G50T, DC22, COMB, PORT et CAVA sondent des familles de passage, appui, composition de commandes et cavité. Les seuils et l’ordre des commandes n’utilisent aucune donnée des jeux sous scellés.

Le comparateur relève les gains officiels, les commandes et la première divergence du parcours. Un gain de famille doit être rattaché à une hypothèse construite à partir d’un retour réel et à la décision qui la consomme. Les gains dans plusieurs variantes d’une même mécanique ne valent qu’une famille. Une différence de temps mural doit être confirmée avant attribution. Le banc conserve les traces détaillées sous forme de reçus et publie les agrégats.

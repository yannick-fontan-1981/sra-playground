# Comparaison native des hypothèses acquises en jeu

Référence moteur `fb8d6913addd23f5dd1cc375f96f9a69b2410b21`, arbre `src` `c6be00220e0691619413e9244101f9c6a302c144`. Le protocole utilise des retours de jeu réels. Les SS08 à SS25 restent exclus.

Chaque bras repart du niveau 1, en mode SIC strict, avec un worker, les mêmes budgets natifs et la même version du jeu. L’option active est la préférence existante `bind_earlier_motions_to_registered_subjects`. Elle enregistre les mouvements observés avant sélection, les réattribue après un retour de sélection identifiable, puis tente des suites contraintes à partir de ces acquis. Les positions, les appuis et les effets de la commande sont relus à chaque retour. Une liaison ou une position contraire doit faire réexaminer le plan.

Le témoin de départ est SS01. Au niveau 6, le moteur standard s’est arrêté au plafond de 80 gestes. Les 80 gestes appartiennent à `sic_test_prepared_effects`, avec de vrais retours de déplacement et de modification. Les cinq niveaux précédents ont été franchis. Ce témoin distingue l’absence de solution sous plafond d’une absence d’effet observable.

Les jeux SS01, SS03, SS05, SS06, SS07 sont des terrains de développement autorisés. G50T, DC22, COMB, PORT et CAVA sondent des familles de passage, appui, composition de commandes et cavité. Les seuils et l’ordre des commandes n’utilisent aucune donnée des jeux sous scellés.

Le comparateur relève les gains officiels, les commandes et la première divergence du parcours. Un gain de famille doit être rattaché à une hypothèse construite à partir d’un retour réel et à la décision qui la consomme. Les gains dans plusieurs variantes d’une même mécanique ne valent qu’une famille. Une différence de temps mural doit être confirmée avant attribution. Le banc conserve les traces détaillées sous forme de reçus et publie les agrégats.

## Deuxième cohorte source

La préférence active est identique. Les jeux disjoints GABA, TEQU, ESCT, SNAR, SKBN, KEYD, KLOT, WEAV, COLM, REWI, SS02 et SS04 jouent les niveaux 1 à 3 en campagne. Les mécaniques comprennent les changements d’état retardés, les accès sous condition, la réattribution du sujet et les liaisons entre actions. Le reçu retient les références des hypothèses et les cas où une même observation suivie d’une même commande a produit des retours publics différents. Le préfixe précédent sépare les hypothèses lorsqu’il est compatible avec un seul retour mesuré. Une collision conservée ne suffit pas à attribuer une cause.

Cette cohorte est préenregistrée après le premier gain COMB, avec les mêmes plafonds que sa propre référence. Elle sert à déterminer si ce gain se transfère dans des mécaniques distinctes. Aucun résultat de la première cohorte ne change le budget de la seconde.

## Résultats vérifiés des deux campagnes

La [première campagne](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46136112135) exécute le commit `d76e4d6686d5eba158c4548cd2fb997632386d5e`. Sur 71 niveaux, le témoin en gagne 54 et le bras actif 53. COMB gagne six niveaux en 85 commandes avec la préférence active contre 90 au témoin. Le premier écart physique est le deuxième geste, où la sélection du sujet par `sic_test_prepared_effects` prend la place d’une commande exploratoire. La suite utilise le contrôle du sujet sélectionné et marque le niveau au troisième geste.

La différence de score vient de DC22. Le témoin termine le N6 en 258 commandes. Le bras actif s’arrête à 271. Les bras suivent les mêmes commandes jusqu’au geste global 390. Au 391, le témoin clique sous `sic_test_observed_compositions` et le bras actif utilise `ACTION1` sous `testLandmarkPlacement`. SS03 s’arrête au plafond mural dans les deux bras au N8 et ne produit aucune différence physique avant la coupure. Sa différence de trois commandes ne reçoit aucun crédit.

Un rejeu ciblé depuis le niveau 1 sur `e2354987` confirme deux niveaux de COMB en 10 commandes contre 15. Au N1 les reçus natifs du bras actif portent `selectMarkedCursor` avec `selection_changed_pending_motor`, puis `verifyMarkedCursor` au vrai passage. Le bras figé ne produit aucun de ces reçus dans le même parcours. L'instrumentation supplémentaire garde uniquement phase, hypothèse, résultat et références compactes. Les 11 contrats de transport, d'appui et de sauvegarde testés localement passent.

La [deuxième campagne](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46136673177) exécute `d218f0956f2fc59c6da586c6a4bdb77ba12f8016`. Les deux bras gagnent les 36 niveaux, avec les mêmes commandes dans chacun des douze jeux. Le relevé n’a trouvé aucun couple observation et commande portant deux retours publics différents. Les deux campagnes conservent l’arbre moteur de `fb8d6913`. Le premier gain concerne le coût à victoires égales dans une seule famille. Les niveaux SS08 à SS25 restent sous scellés. Le [lot de reprise locale](./LOCAL-RECOVERY.md) réduit le périmètre de la préférence active et qualifie séparément l’hypothèse de réparation.

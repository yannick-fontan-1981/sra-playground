# SIC Fallback · aperçu morphologique d’une disposition future

Un élément visible peut indiquer ce qui arriverait à d’autres éléments si une commande était exécutée. SIC garde séparément l’indicateur vu avant le geste, la commande envisagée, les participants de la disposition future et leur observation après le geste. La relation est attachée à cette commande dans cet épisode. Une même pièce peut indiquer une destination dans une expérience et être manipulée dans une autre.

Le code de placement de pièces possède déjà un aperçu spécialisé pour la rotation et la mise en place d’une pièce sélectionnée. La primitive `action_conditioned_layout_preview` étend la morphologie utilisée par SIC Fallback aux relations apprises entre des rôles observés en cours de jeu.

## Ce que SIC peut proposer et vérifier

- Une covariation entre deux éléments peut motiver une première question. À ce stade, l’aperçu a le statut d’hypothèse.
- Après avoir vu une commande amener un sujet à la position qu’occupait un indicateur, SIC peut annoncer son arrivée au prochain emplacement affiché. Les formes colorées conservent une identité commune sous les rotations et les réflexions. Les rôles visuellement ambigus sont exclus de cette mesure.
- Si plusieurs essais montrent qu’un second participant se déplace aussi et conserve le même écart à l’indicateur initial, la prévision peut inclure les positions des deux participants. Une forme future peut être ajoutée si une forme de l’indicateur a prédit le même résultat à deux emplacements et qu’une autre forme de l’indicateur a prédit un résultat différent.
- Le statut `replicated_with_control` exige plusieurs emplacements de l’indicateur et au moins une commande rivale donnant une autre arrivée depuis une même image de départ. Une contradiction prospective sur la position du sujet est conservée. Cette connaissance influence le choix d’une disposition encore inexplorée.
- SIC scelle la prévision avant l’action. Une disposition est réalisée si chacun des sujets annoncés présente la position et, le cas échéant, la forme attendues. L’indicateur peut disparaître. Un sujet perdu par l’observateur donne un résultat indéterminé. Un changement d’épisode rend l’essai inapplicable. Une disposition incomplète ou contredite interrompt la suite qui en dépend.

La relation de position initiale testée par cette version est l’arrivée d’un sujet sur un site indiqué. Les positions relatives et les formes des autres participants sont apprises à partir de ses réalisations. Une correspondance prédictive peut exister pour un objet doté d’une fonction physique.

## Vérification

Les tests de `v6-morphology-preview.test.ts` couvrent le choix de commande, les marques persistantes ou disparues, le changement d’épisode, les dispositions à plusieurs sujets et les formes conditionnelles. Le test de `sic-occupancy-programs.test.ts` passe par le planificateur qui choisit une préparation, mesure son effet puis ouvre la question sur l’aperçu effectivement affiché.

Le replay indépendant `verify-native-occupancy.mjs` relit les positions et les formes, vérifie les témoins et les commandes rivales, recalcule les verdicts et contrôle la prévision scellée avec la commande. Le nombre de dispositions prévues et réalisées, y compris celles à plusieurs sujets, figure dans `occupancy.previews`.

## Premiers essais autonomes sur les sources

| Niveau | Commandes | Dispositions annoncées | Réalisées | Contredites | Sujet non observable | Annonces à plusieurs sujets |
|---|---:|---:|---:|---:|---:|---:|
| CATR L3 | 75 | 11 | 0 | 8 | 3 | 0 |
| GRAV L3 | 75 | 23 | 1 | 22 | 0 | 0 |
| SKBN L1 | 70 | 12 | 2 | 10 | 0 | 7 |
| VOIS L1 | 70 | 29 | 29 | 0 | 0 | 14 |
| ZIPP L1 | 70 | 10 | 3 | 7 | 0 | 0 |

Les 14 annonces à plusieurs sujets de VOIS se réalisent intégralement. Aucun de ces cinq essais n’a produit une prévision portant sur une orientation. Cette possibilité est vérifiée par un test déterministe. Ces essais mesurent des effets locaux. Le compteur officiel reste à zéro sur les cinq parties. Les empreintes des trajectoires figurent dans [les résultats](sic-morphological-preview-results.json).

## Comparaison du candidat figé

Le candidat v21 reprend les mêmes budgets, le même moteur et les mêmes entrées au L2 que le [protocole v20](sic-source-control-occupancy-freeze.md). Le témoin est le tag `sic-projected-affordances-source100-control-v1`. Le tag candidat est `sic-projected-affordances-source100-candidate-v21`. Les deux exports et leurs références distantes sont vérifiés avant l’essai. Le résultat principal est la victoire officielle autonome. Le rejeu compte séparément les prévisions morphologiques et leurs réalisations. SS09 L2 reste réservé.

# SIC Fallback · comparaison figée de l’aperçu morphologique sur Custom 4

Le candidat v21 `1b77e11a` et le témoin `7f2cb3eb` ont été exportés et vérifiés avant les essais. Le moteur `f4d28aee` charge directement le L2 avec un agent neuf. Les deux bras utilisent le même budget de temps actif et un plafond de 1 200 commandes. Le rejeu vérifie les images, les commandes, les prévisions scellées, les verdicts et le compteur officiel.

| L2 | Commandes témoin / v21 | Images distinctes au préfixe commun, témoin / v21 | Prévisions morphologiques v21 | Réalisées | Contredites | Sujet non observable | Victoires témoin / v21 |
|---|---:|---:|---:|---:|---:|---:|---:|
| SS01 | 695 / 575 | 141 / 122 | 9 | 0 | 7 | 2 | 0 / 0 |
| SS06 | 643 / 589 | 40 / 68 | 0 | 0 | 0 | 0 | 0 / 0 |
| SS07 | 5 / 6 | 5 / 5 | 1 | 0 | 1 | 0 | 0 / 0 |
| SS08 | 642 / 749 | 254 / 29 | 4 | 0 | 4 | 0 | 0 / 0 |

Sur SS01 L2, les neuf essais ont bien déclenché des prévisions conditionnelles. Aucune n’avait acquis le statut de relation reproduite avec commande rivale et aucune disposition annoncée ne se vérifie dans cette partie. Ces mesures concernent les sujets désignés avant l’action. Elles ne permettent pas d’attribuer à chacun de ces neuf essais le bon indicateur physique. SS09 L2 reste en réserve.

Le candidat v20 `16319899`, figé avant l’ajout morphologique, ainsi que son témoin ont également échoué sur les quatre niveaux. Les deux tableaux d’empreintes et les nombres de programmes, de placements, d’arrivées et d’usages sont disponibles dans [les mesures du rejeu](sic-morphological-preview-custom4.json). Les essais sur le corpus source qui valident spécifiquement la primitive figurent dans [le rapport morphologique](sic-morphological-preview.md).

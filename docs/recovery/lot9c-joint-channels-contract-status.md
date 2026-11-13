# Lot 9C `joint_channels` — statut du contrat après audit

Statut automatisé : **trace-only-contract-reconstruction-required**.

## Conclusion

Seules des traces de tests, documentation, scripts, métadonnées ou historique sont retrouvées. Elles ne prouvent pas une implémentation produit récupérable.

Aucune implémentation historique ni aucun contrat historique n’est admis à ce stade.

## Compteurs de preuves

- code produit : **0** ;
- tests : **14** ;
- documentation/scripts/métadonnées : **851** ;
- messages de commit : **8** ;
- patches historiques : **19**.

## Grille du contrat

Tous les champs restent **non prouvés** tant qu’une source précise ne démontre pas leur valeur.

| Champ | Question à résoudre | Statut |
|---|---|---|
| `channel_identity` | Identité stable d’un canal | non prouvé |
| `channel_payload` | Données portées par un canal | non prouvé |
| `join_predicate` | Condition prouvée permettant de joindre deux canaux | non prouvé |
| `joint_identity` | Identité de la liaison jointe | non prouvé |
| `cardinality` | Nombre de canaux autorisés par liaison | non prouvé |
| `temporal_scope` | Portée session/niveau/révision | non prouvé |
| `creation_rule` | Règle de création | non prouvé |
| `removal_rule` | Règle de retrait | non prouvé |
| `contradiction_rule` | Traitement des contradictions | non prouvé |
| `proposal_rule` | Condition de proposition | non prouvé |
| `selection_rule` | Interaction avec ambiguïté et caller commun | non prouvé |
| `return_acquisition` | Acquisition et déduplication du retour | non prouvé |
| `decision_consumer` | Consommateur décisionnel réel | non prouvé |
| `future_effect` | Effet sur une décision future | non prouvé |
| `bounds` | Bornes mémoire/recherche | non prouvé |
| `snapshot_restore` | Snapshot et restauration | non prouvé |
| `public_producer` | Producteur fondé sur données publiques | non prouvé |
| `performance_corpus` | Corpus qui exerce réellement le périmètre | non prouvé |

## Garde-fous

- ne rien déduire du seul nom `joint_channels` ;
- ne pas admettre une source produit sur simple correspondance textuelle ;
- ne pas inventer fusion, priorité ou classement caché ;
- laisser les champs inconnus explicitement non prouvés ;
- préserver les contrats et la qualification officielle 9B ;
- ne pas incrémenter le compteur des 76.

## Prochaine étape

Extraire uniquement les obligations comportementales explicitement démontrées par ces traces, puis laisser tous les champs non prouvés à l’état inconnu.

Les extraits complets utiles sont conservés dans `docs/recovery/lot9c-joint-channels-evidence-context.md`.

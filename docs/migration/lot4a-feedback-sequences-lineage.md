# Lot 4A : filiation de FeedbackSequences

## Source et portée

Référence immuable : `786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`, sous `reference/v6/<commit>/source/`.
Le transfert porte sur `morphology_policy/feedback_sequences/{family,visual,finite}.py` et la fermeture V5 effectivement consommée de `capabilities/feedback_code_identification.py`.
Le moteur conserve son nom **Logos Engine**.

Les attentes du [générateur original](../../scripts/export-v6-feedback-sequences-reference.py) proviennent des Python inchangés. Les [tests différentiels](../../tests/v6-feedback-sequences-reference.test.ts) comparent les propositions complètes, reçus SRC, liaisons, gardes, événements et états. Les [tests de l'appelant](../../tests/v6-feedback-sequences-integration.test.ts) couvrent séparément la sélection et l'acquisition communes. Leurs effectifs finaux et le résultat réel en jeu sont établis par les reçus de livraison, pas par cette carte de transfert.

## Correspondances

| Source et contrat | Workflow ou callback | Implémentation TypeScript | État conservé | Décision influencée | Preuve |
| --- | --- | --- | --- | --- | --- |
| `family.py`: ordre des quatre sous-questions | `v6.feedback_sequences.choose`, `sequences.begin/offer/advance/finish` | `v6-feedback-sequences.ts` | Essai lié dans `last` | Continuer, soumettre, discriminer, puis acquérir une saisie | Reçus SRC et offres complètes de l'oracle |
| `visual.py`: palette et deux lignes de cellules mesurées | Producteurs `initialFeedbackLayout`, `feedbackValues`, `feedbackPalette` | `v6-feedback-sequences-visual.ts` | `layout`, `active` | Reconnaître une interface unique; refuser une géométrie ambiguë | Interfaces translatées, palettes et gardes source |
| `family.py`: ajout observé, deux valeurs distinctes avant une continuation longue | `record`, `compile` | `v6-feedback-sequences.ts` | `entry_evidence`, `repeatable`, `palette_background` | Limiter l'essai inconnu à une action, puis prévoir une suite conditionnelle | Chaînes avec palette stable et palette compactée |
| `family.py`: soumission mesurée et retour interprétable | `test_complete_proposal`, `record` | `v6-feedback-sequences.ts` | `submit`, `history`, `last` | Fermer le préfixe à la soumission et recalculer l'essai suivant | Deux retours distincts après le même essai |
| `finite.py`: filtrage des couples secret/loi puis partitions | `discriminate_codes` | `v6-feedback-sequences-finite.ts` | Historique acquis consommé; diagnostic recalculable | Choix minimax parmi les essais réalisables préservant le préfixe | Cas V5 de domaines, lois, contradictions et bornes |
| `family.py`: effacement observé d'un suffixe | `record` | `v6-feedback-sequences.ts` | `clear_evidence`, invalidation de `last` | Repartir du préfixe réellement conservé | Retour de suppression et décision après restauration |
| `family.py`: frontière et rappel conditionnel | `resetScope`, `methodMatches` | `v6-feedback-sequences.ts` | `entry_method`, `transfer_refuted_epoch` | Réessayer le rôle d'entrée dans le nouveau contexte | Frontière avec `layout = null`, confirmation et réfutation locales |
| `strategy.py`: deux chemins, une instance | Groupe `goal_access`, entrée `observed_feedback_sequence`; groupe `information_goal` | `feedbackSequenceFamily`, `createNativeV6Runtime` | Un seul nœud `family_state:feedback_sequences` | Ordre source conservé, y compris `feedback_sequences_first` | Fabrique commune et configurations source explicitement délimitées |
| `common_frontier_runtime.py`: acquis sélectionné puis passif | `seal`, `retainSelectedAcquisition`, `acquirePassiveFamilies` | `v6-native-runtime.ts` | Événement sélectionné; miroir `feedback_sequence_state` | Un retour étranger peut permettre une proposition Feedback ultérieure | Retours réellement choisis dans l'appelant, comptage sans doublon |

## Propriété et persistance

Les douze champs de la source sont conservés : `layout`, `active`, `repeatable`, `entry_evidence`, `history`, `submit`, `clear_evidence`, `last`, `blocked`, `palette_background`, `entry_method`, `transfer_refuted_epoch`.

Feedback reste propriétaire de cet état. Il ne devient pas une couche de SharedSeries. Les deux chemins de sélection et l'acquisition passive emploient le même adaptateur et la même instance. L'appelant écrit le miroir source lorsque **`layout` ou `entry_method`** existe. À une frontière, une méthode conditionnelle reste ainsi conservée lorsque l'interface locale a été effacée.

Le retour d'une proposition Feedback sélectionnée produit `feedback_sequence_event:<revision>`. Le passage passif n'est alors pas appelé. Si une autre famille a choisi l'action, Feedback reçoit les cinq arguments publics de la source, sans la proposition étrangère; son résultat n'est pas réétiqueté comme un deuxième événement de sélection. La restauration ne réexécute aucune action ni aucune acquisition.

## Distinctions conservées

- Les styles visibles de retour n'ont pas de signification préassignée. Les permutations exact/ailleurs/absent et les ordres d'allocation restent des hypothèses.
- Une palette qui retire une valeur limite les essais réalisables. Elle ne prouve pas que le secret exclut les répétitions.
- Les occurrences exactes sont comptées avant les occurrences déplacées. Un résidu compte les secrets distincts; le nombre de couples secret/loi reste une autre quantité.
- Un retour ambigu ne devient pas un retour interprété. Une contradiction du protocole, une réfutation du rappel et une absence d'effet gardent des statuts distincts.
- La méthode rappelée est une hypothèse à revalider. Une ligne active différente réfute ce transfert local sans nier un ajout actuellement observé.
- Une recherche bornée ou interrompue conserve son incomplétude. Elle ne prouve pas une impossibilité et ne publie aucune recommandation issue d'une énumération inachevée.

## Adaptations natives explicites

Le calcul fini utilise un générateur commun aux voies déterministe et coopérative. La voie du runtime contrôle le signal et l'échéance aux frontières de travail et rend la main périodiquement. Une interruption publie `native_feedback_search_incomplete`, avec `domain_complete: false` et `recommendation: null`. Ce diagnostic n'est pas une réfutation acquise.

Une région dont les pixels ne sont plus présents produit un refus de mesure, là où un accès hors raster Python pourrait lever une exception. Cette adaptation permet aux gardes de refuser un lieu disparu sans inventer de nouvelles observations.

Les autres opérations du module V5 d'identification, notamment l'ajustement de protocoles, les politiques d'identification et les transactions, restent hors de ce transfert. Une preuve de composant, une boucle synthétique et une contribution en jeu demeurent trois portées distinctes. Aucune parité complète de l'appelant Python ou de V5/V6 n'est revendiquée.

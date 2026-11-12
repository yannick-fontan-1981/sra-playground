# Lot 10D — contrat de mémoire temporelle reconstruit

Date : 2026-11-12

Cette brique est dérivée de la sémantique durable de :

`reference/sra/212d8d426f07/agents/yf_arc3_v5/state/memory_reuse_contract.py`

Elle ne recrée pas l'ancien état métier TemporalSelection.

## Invariants repris

- une mémoire rappelée n'est pas automatiquement réutilisable ;
- lorsque Source exige la réutilisation, les preuves rappelées et courantes doivent être non vides et bornées à 32 références chacune ;
- toutes les preuves déclarées doivent exister au gel du contrat ;
- le contrat est lié à une observation précise ;
- le contrat et l'intention doivent appartenir à la même observation courante ;
- toutes les preuves doivent rester présentes dans les prémisses gelées de l'action ;
- les preuves doivent rester actives, positives, non contredites, non défaites et `supported` ou `established` ;
- leur empreinte doit rester identique ;
- les preuves courantes doivent porter explicitement la liaison à l'observation courante.

## Fichiers

- `src/logos-engine/v6-temporal-memory-contract.ts`
- `tests/v6-temporal-memory-contract.test.ts`

## Portée

Cette brique fournit la condition de validité d'une mémoire qui pourrait être lue par TemporalSelection.

Elle ne décide pas :

- quelle mémoire est utile ;
- quel candidat doit être choisi ;
- quelle priorité doit être attribuée ;
- quelle action doit être proposée ;
- si ACT peut être libéré.

## Tests

Commande :

`node --experimental-strip-types --test tests/v6-temporal-memory-contract.test.ts`

Résultat : **8/8 réussis**.

Exécution conjointe avec le contrat Source de TemporalSelection :

`node --experimental-strip-types --test tests/v6-temporal-selection-contract.test.ts tests/v6-temporal-memory-contract.test.ts`

Résultat : **15/15 réussis**.

## Limite importante

Le donneur durable ne justifie pas encore les anciens noms et structures `measurement`, `edit`, `pending` et `response`.

Ils restent donc absents du nouveau port.

La prochaine étape doit reconstruire un **état local d'observation** plus concret uniquement si l'on peut relier chaque champ à un producteur, une observation, une règle de restauration et un consommateur.

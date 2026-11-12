# Lot 10D — contrat d'identité de retour temporel reconstruit

Date : 2026-11-12

Source durable principale :

`reference/sra/212d8d426f07/agents/yf_arc3_v5/scheduler/contribution_contract.py`

Fonction donneuse :

`measure_return_identity`

## Invariants repris

Un retour est mesuré sans lui attribuer de signification métier supplémentaire.

La mesure conserve et compare :

- la requête d'origine ;
- le destinataire ;
- le producteur ;
- le terminal Source ;
- la timeline ;
- la portée courante ;
- la chronologie requête → retour → révision courante ;
- la présence des produits ;
- les révisions des produits ;
- les empreintes de produits lorsqu'elles existent ;
- les preuves du retour.

Une frontière mesurée est idempotente uniquement pour la même identité complète. Un changement de scope, de comparaison ou de version produit ne doit pas réutiliser silencieusement une disposition précédemment acceptée.

## Fichiers

- `src/logos-engine/v6-temporal-return-contract.ts`
- `tests/v6-temporal-return-contract.test.ts`

## Tests

Le contrat de retour ajoute 8 tests ciblés.

Exécution conjointe des trois contrats reconstruits :

`node --experimental-strip-types --test tests/v6-temporal-selection-contract.test.ts tests/v6-temporal-memory-contract.test.ts tests/v6-temporal-return-contract.test.ts`

Résultat : **23/23 tests réussis**.

## Portée

Cette brique permet de savoir si un retour est suffisamment lié au contexte courant pour devenir un candidat à la consommation.

Elle ne décide pas :

- que le retour est utile ;
- que son contenu prouve un effet temporel ;
- qu'une mémoire doit être créée ;
- qu'un candidat doit être préféré ;
- qu'une action peut être libérée.

La sémantique métier reste à la charge d'un producteur/consommateur explicitement reconstruit.

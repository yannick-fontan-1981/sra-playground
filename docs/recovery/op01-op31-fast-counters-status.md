# OP01–OP31 — optimisation du mode counters

## Problème

Le premier diagnostic ABBA synthétique avec le protocole restauré donnait :

- STCK-label : **+95,44 %** ;
- SMLP-label : **+54,48 %**.

Le mode `counters` ne conservait déjà aucun événement détaillé, mais les
appelants construisaient malgré tout les objets complets `need/operation/consumption`
avant que le sink ne les jette.

## Modification

`OperationTraceSink` expose maintenant des incréments primitifs :

- `countNeed()` ;
- `countOperation()` ;
- `countConsumption()`.

En mode `counters`, les appelants utilisent directement ces méthodes et ne
construisent plus les payloads détaillés.

En mode `full`, le contrat de trace précédent reste inchangé.

Fichiers concernés :
- `v6-operation-trace.ts` ;
- `v6-native-authority.ts` ;
- `v6-composition-engine.ts` ;
- `v6-target-binding.ts`.

Aucune sélection, garde, priorité, persistance ou opération n'est modifiée.

## Régression fonctionnelle

Un test compare les compteurs obtenus par :
- API primitive `counters` ;
- événements détaillés `full`.

Les clés et valeurs de compteurs doivent être identiques, tandis que
`counters` ne conserve aucun événement.

Suite ciblée locale après optimisation :
**61/61 tests passent**, typecheck strict OK.

## Rerun ABBA synthétique

Même protocole restauré :
- 40 invocations ;
- 32 sessions mesurées ;
- 400 actions mesurées ;
- A = trace OFF ;
- B = `counters`.

Résultat local :

| Label protocole | Baseline médiane | Candidate médiane | Delta |
| --- | ---: | ---: | ---: |
| STCK | ~0,224 ms | ~0,189 ms | **−15,66 %** |
| SMLP | ~0,275 ms | ~0,280 ms | **+1,68 %** |

Le delta négatif STCK est considéré comme bruit favorable, pas comme un gain
revendiqué.

Le point utile est que ce diagnostic ultra-court ne montre plus de surcharge
>10 % pour `counters`.

## Qualification

Ce benchmark reste `protocol_shaped_diagnostic_only` :
il utilise les labels/actions du protocole STCK/SMLP mais pas les vrais jeux.

Statut officiel :
**fonctionnellement qualifié, performance officielle à confirmer**.

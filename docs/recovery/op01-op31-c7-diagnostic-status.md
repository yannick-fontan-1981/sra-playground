# OP01–OP31 — diagnostic C7 non officiel

## Portée

Ce diagnostic mesure uniquement le noyau Logos reconstruit. Il ne remplace pas
les sessions officielles STCK/SMLP et ne qualifie pas la performance Site 109.

Branche : `recovery/op01-op31-c7-diagnostic-20261112`.

> Mise à jour du 13 novembre 2026 : ce document conserve le diagnostic synthétique historique. La qualification officielle ultérieure est acceptée et documentée dans `docs/recovery/op01-op31-c7-official-acceptance-20261113.md`.

## Harness

Nouveaux éléments :
- `tests/helpers/op01-op31-synthetic-session.ts` ;
- `tests/v6-c7-diagnostic.test.ts` ;
- `scripts/measure-op01-op31-core-costs.mjs`.

La session synthétique exécute, à chaque cycle :

**besoin OP18 → release → retour → OP29 → OP30 → OP31**

avec révision d'observation croissante, persistance OP30 et objectif restant
`unknown`.

Le harness est explicitement marqué `diagnostic_only` et
`official_performance_qualification=false`.

## Instrumentation légère vs audit

`OperationTraceSink` possède désormais deux modes :

- `counters` : compteurs uniquement, aucun événement détaillé conservé ;
- `full` : trace détaillée bornée, destinée à l'audit.

Aucune décision n'est modifiée.

## Tests

- `tsc --noEmit` : OK ;
- suite `tests/v6-*.test.ts` : **31/31 tests passent**.

Les nouveaux tests démontrent :
- trace OFF/ON : même résultat sémantique ;
- cache OFF/ON : même résultat sémantique ;
- compteurs-only : aucun événement détaillé retenu ;
- chaîne OP18 → OP29/30/31 exercée à chaque cycle.

## Mesure diagnostique

Configuration :
- 31 échantillons ;
- 200 cycles synthétiques par échantillon ;
- exécution locale isolée du noyau Logos.

Médianes :

| Mode | Médiane | Delta vs baseline |
| --- | ---: | ---: |
| baseline | 1,674 ms | — |
| compteurs | 1,793 ms | **+7,12 %** |
| trace détaillée | 9,589 ms | +472,86 % |
| cache | 2,834 ms | +69,29 % |
| compteurs + cache | 3,022 ms | +80,57 % |
| trace détaillée + cache | 10,794 ms | +544,84 % |

## Interprétation

### Instrumentation normale

Le mode `counters` passe sous +10 % dans ce diagnostic synthétique.
Cela **ne vaut pas qualification officielle**, mais justifie le choix
architectural : instrumentation légère en production, trace détaillée seulement
pour les scénarios d'audit.

### Trace détaillée

Le coût est très supérieur à +10 %. Ce mode ne doit pas être activé en continu.
Il reste utile pour C1/C2 ciblé et doit être mesuré séparément.

### Cache

Dans cette session, chaque cycle change l'identité d'observation et la révision :
il n'y a donc aucun hit utile. Le cache ajoute seulement son coût de clé/lookup.

Conclusion :
- ne pas activer le cache globalement ;
- l'utiliser uniquement sur les chemins où une identité de dépendances exacte
  est réellement répétée ;
- la garde reste revalidée même sur cache hit.

## Statut performance

**fonctionnellement qualifié, performance officielle à confirmer**.

Le critère historique reste :
- STCK session complète strictement < +10 % ;
- SMLP session complète strictement < +10 % ;
- chaque jeu séparément, aucune compensation.

## Prochaine étape

Dès restauration d'un worker/harness réel :
1. exécuter STCK et SMLP instrumentation OFF ;
2. exécuter avec compteurs-only ;
3. garder la trace détaillée hors mesure normale ;
4. n'activer le cache que si le chemin produit des hits mesurables ;
5. comparer au prédécesseur immédiat et à la baseline stable.


## Rerun après correction de parité Python → TypeScript

Après ajout de `pythonTruthy()` et des régressions C5/C6 :

- typecheck strict : OK ;
- suite OP/C7 : **53/53 tests passent** ;
- 31 échantillons × 200 cycles synthétiques :

| Mode | Médiane | Delta vs baseline |
| --- | ---: | ---: |
| baseline | 1,919 ms | — |
| compteurs | 1,840 ms | **−4,12 %** |
| trace détaillée | 10,155 ms | +429,10 % |
| cache | 2,810 ms | +46,40 % |
| compteurs + cache | 3,048 ms | +58,79 % |
| trace détaillée + cache | 11,201 ms | +483,55 % |

Le delta négatif des compteurs est interprété comme du bruit favorable, pas
comme un gain revendiqué. Le point pertinent est l'absence de signal >10 % sur
ce diagnostic synthétique pour le mode normal.

La qualification officielle ultérieure est maintenant **acceptée** sur STCK et SMLP. Le diagnostic synthétique ci-dessus reste une preuve historique distincte.

## Qualification officielle ultérieure

Le SHA d45f2ce6566d052bbd3477c5653e99ae24381a0a a passé le garde strict du run 43359480072 :

- STCK : −4,4650 %, accepté ;
- SMLP : +4,6643 %, accepté ;
- chaque jeu est sous le seuil strict de +10 % sans compensation.

La qualification complète du run 43359480115 passe 335/335 tests et répète une mesure acceptée sur les deux jeux.

**Statut C7 courant : accepté.**

## Requalification C7 de l’identité 5669bb2e

Le commit `5669bb2edf38b1fa431050a2ca996833aad86876` remplace l’identité courante de mesure après ajout du contrat de configuration et du rapport fail-fast du benchmark.

- garde strict : run `43361492824`, job `131675839595` ;
- STCK : +0,8464 %, accepté ;
- SMLP : −5,0546 %, accepté ;
- qualification complète : run `43361492842`, job `131675894613` ;
- 339/339 tests, build, parité Worker/Pyodide et 24/24 contrats réussis ;
- répétition : STCK +0,4643 %, SMLP +0,1379 %, acceptés.

L’ancienne mesure reste historique et n’est pas transférée à cette identité.

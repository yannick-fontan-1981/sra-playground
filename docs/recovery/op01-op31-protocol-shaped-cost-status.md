# OP01–OP31 — diagnostic ABBA sur noyau synthétique

## Portée

Le protocole de coût historique restauré dans
`scripts/measure-native-loop-costs.mjs` est exécuté ici avec un runner
**synthétique Logos**, pas avec les vrais jeux STCK/SMLP.

Le rapport reste donc :
- `protocol_shaped_diagnostic_only` ;
- `officialPerformanceQualification=false`.

## Protocole réellement exercé

- ordre : A1 / B1 / B2 / A2 ;
- A = instrumentation trace désactivée ;
- B = instrumentation `counters` ;
- 40 invocations ;
- 8 warmups ;
- 32 sessions mesurées ;
- 400 actions mesurées ;
- STCK : 10 cycles synthétiques par session mesurée ;
- SMLP : 15 cycles synthétiques par session mesurée.

## Mesure locale

| Label protocole | Baseline médiane | Candidate médiane | Delta |
| --- | ---: | ---: | ---: |
| STCK | ~0,133 ms | ~0,259 ms | **+95,44 %** |
| SMLP | ~0,202 ms | ~0,312 ms | **+54,48 %** |

Le rapport diagnostique retourne `accepted=false`.

## Interprétation

Ces valeurs **ne qualifient pas les vrais STCK/SMLP** :
les sessions synthétiques sont plusieurs ordres de grandeur plus courtes qu'une
session agent/game réelle et ne contiennent ni perception ni transport produit.

Elles apportent cependant un signal utile :
sur un chemin extrêmement court, le coût fixe des compteurs reste important.

Conséquence :
- ne pas assouplir le seuil ;
- optimiser le mode `counters` ;
- conserver `full` uniquement en audit ;
- rerun ce diagnostic après optimisation ;
- attendre les vrais runners STCK/SMLP avant tout verdict officiel.

## Statut

**fonctionnellement qualifié, performance officielle à confirmer**.

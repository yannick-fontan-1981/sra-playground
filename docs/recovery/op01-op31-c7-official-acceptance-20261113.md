# OP01–OP31 — acceptation officielle C7

Date : 13 novembre 2026

## Identité courante qualifiée

- branche : `recovery/op01-op31-browser-field-stock-context-20261112` ;
- commit mesuré : `5669bb2edf38b1fa431050a2ca996833aad86876` ;
- source A : `lot9b-region-v1:A:1312569ad68db2d0fb3837c357df27219ffce117f383937c37d3605de61078d2` ;
- source B : `lot9b-region-v1:B:75569fb1471c4731488ede1f2b4adffdcb47b977d22af05504fe905362104b3a` ;
- protocole : A1/B1/B2/A2 ;
- environnement déclaré : `non-isolated-shared-github-actions-runner-no-repository-concurrency`.

Cette qualification ferme le critère de coût pour cette identité exacte. Elle ne prétend ni reproduire le matériel historique du Site 109, ni établir une identité binaire avec le runtime 0.68.

## Critère

- médiane globale de chaque jeu strictement inférieure à +10 % ;
- STCK et SMLP évalués séparément ;
- aucune compensation entre jeux ;
- aucune suppression ou substitution d’échantillon mesuré ;
- une phase interne peut dépasser +10 % si le global du jeu reste sous le seuil.

## Exécution stricte principale

- run : `43361492824` ;
- job : `131675839595` ;
- SHA : `5669bb2edf38b1fa431050a2ca996833aad86876` ;
- artifact : `14008357592`, `op01-op31-strict-native-cost-report` ;
- 40 invocations ;
- 8 sessions de warmup et 24 actions de warmup ;
- 32 sessions mesurées et 400 actions mesurées.

| Jeu | Médiane A | Médiane B | Delta global | Verdict |
| --- | ---: | ---: | ---: | --- |
| STCK | 41,35 ms | 41,70 ms | +0,8464 % | accepté |
| SMLP | 87,05 ms | 82,65 ms | −5,0546 % | accepté |

Les deux jeux satisfont indépendamment le seuil strict inférieur à +10 %.

## Répétition dans la qualification complète

- run : `43361492842` ;
- job : `131675894613` ;
- SHA : `5669bb2edf38b1fa431050a2ca996833aad86876` ;
- STCK : 53,85 ms en A, 54,10 ms en B, +0,4643 %, accepté ;
- SMLP : 108,75 ms en A, 108,90 ms en B, +0,1379 %, accepté.

Cette seconde exécution confirme l’acceptation sans compenser ni remplacer le résultat principal.

## Qualification fonctionnelle du même SHA

- Node 22.18.0 ;
- `npm ci` réussi ;
- `tsc --noEmit` réussi ;
- **339/339 tests TypeScript réussis** ;
- build Vite réussi ;
- 100 jeux, 636 prévisualisations et 4 atlas natifs générés ;
- parité Worker/Pyodide qualifiée sur 4 échantillons et 31 étapes ;
- 24/24 contrats benchmark/sourceRef réussis.

Deux vulnérabilités de dépendances de sévérité haute, déjà présentes, restent signalées par `npm ci`. Elles ne sont pas introduites par cette tranche.

## Correctif de requalification

Le benchmark accepte maintenant exactement deux états valides du manifeste :

- `ready-for-official-abba-measurement` pour une première mesure ;
- `official-abba-measurement-accepted` pour une requalification du même chemin.

Le chargement de configuration est inclus dans le mécanisme de rapport d’erreur. Une erreur de configuration échoue donc rapidement au lieu de laisser l’orchestrateur attendre son délai maximal.

## Optimisations admises

- calcul du delta public 64×64 avec buffers typés bornés, à sortie équivalente ;
- identité `methodRef` minimale sans copie des frames lorsqu’elle ne dépend que de l’identité de l’action/session ;
- contrat explicite `borrowed-readonly` pour le hook Region officiel ;
- comportement `cloned` conservé par défaut pour les autres hooks.

Aucune optimisation ne modifie la décision Region, le corpus, le transport, les actions ou le protocole d’acceptation.

## Historique

L’exécution antérieure du SHA `d45f2ce6566d052bbd3477c5653e99ae24381a0a` reste conservée dans `officialMeasurementHistory`. Elle n’est pas attribuée à la nouvelle identité source.

## Verdict

**C7 est accepté pour l’identité courante sur STCK et SMLP.**

Les dettes restantes concernent le candidat produit Region complet, les acquisitions passives multi-propriétaires, la sauvegarde/restauration et OP31. Elles ne rouvrent pas automatiquement ce résultat tant que l’identité mesurée ne change pas.

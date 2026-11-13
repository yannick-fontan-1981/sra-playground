# OP01–OP31 — qualification officielle C7 après restauration du harness

Date de consolidation : 13 novembre 2026 (America/Recife)

Branche de qualification : `recovery/lot6c-c7-performance-qualification-20261113`

Branche canonique cible : `recovery/site109-reconstruction-20261112`

## Statut

**C7 est qualifié fonctionnellement et en performance pour le protocole natif STCK/SMLP restauré.**

Le garde `scripts/check-op01-op31-c7-readiness.mjs` retourne maintenant :

- `ready: true` ;
- `performanceQualified: true` ;
- `missing: []` ;
- manifeste valide au schéma `explicit-runner-array-v1` ;
- preuve officielle présente et acceptée ;
- statut `official-performance-qualified`.

Cette qualification porte sur le coût du hook Region natif dans le protocole ABBA restauré. Elle ne constitue pas une revendication de parité totale des 76 points d’entrée V6, ni une identité binaire avec une version Site historique.

## Harness et runners durables

Les éléments suivants sont présents et vérifiés :

- `scripts/measure-native-loop-costs.mjs` ;
- `scripts/native-loop-session-adapter.mjs` ;
- `scripts/verify-native-loop-runner-manifest.mjs` ;
- `scripts/run-native-region-official-benchmark.mjs` ;
- `tests/helpers/v6-live-game-campaign.ts` ;
- `src/runtime/v6-agent-worker.ts` ;
- `src/benchmarks/native-region-official-benchmark.ts` ;
- `benchmarks/native-region-official.html` ;
- `docs/migration/v6-delivery-roadmap.md` ;
- `docs/recovery/native-loop-source-refs.json` ;
- `docs/recovery/native-loop-runner-manifest.json`.

Le manifeste déclare explicitement les quatre runners :

- `A/STCK` ;
- `A/SMLP` ;
- `B/STCK` ;
- `B/SMLP`.

Les variantes A et B utilisent le même transport, le même corpus public ACTION6, la même graine, le même niveau de départ, les mêmes nombres d’actions et le même scope de chronométrage. La différence mesurée est bornée au hook `region_intervention`, désactivé pour A et activé pour B.

## Protocole officiel restauré

Ordre ABBA :

`A1 → B1 → B2 → A2`

Totaux vérifiés :

- invocations : **40** ;
- sessions de warm-up : **8** ;
- actions de warm-up : **24** ;
- sessions mesurées : **32** ;
- actions mesurées : **400** ;
- suppressions d’échantillons : **0** ;
- retries cachés : **0**.

La règle d’acceptation reste stricte et indépendante par jeu :

`augmentation relative médiane < 10 %`

Une phase interne peut dépasser 10 % si le résultat global du jeu reste inférieur à 10 %. Un jeu ne peut pas compenser l’échec de l’autre.

## Résultats officiels retenus

Mesure GitHub Actions :

- run : `43356109888` ;
- job : `131658448492` ;
- commit mesuré : `e2b93371bf1272dd0f68ab56daeeabaebd880f44` ;
- isolation : `github-hosted-ubuntu-26.04-single-job-sequential-abba`.

### STCK

- médiane A : **58,40 ms** ;
- médiane B : **53,55 ms** ;
- variation : **−8,304794520547954 %** ;
- verdict : **accepté**.

### SMLP

- médiane A : **242,10 ms** ;
- médiane B : **241,45 ms** ;
- variation : **−0,2684840974803817 %** ;
- verdict : **accepté**.

L’échantillon SMLP B à `591,1 ms` a été conservé. Aucun retrait d’outlier n’a été effectué.

La preuve complète est conservée dans :

- `docs/recovery/lot9b-official-abba-performance-qualified.json` ;
- `docs/recovery/lot9b-official-abba-performance-qualified.md`.

## Activité Region conservée

La qualification de coût n’a pas neutralisé le comportement mesuré :

- STCK : **86** actions ACTION6 utiles, **86** acquisitions, **86** méthodes ;
- SMLP : **126** actions ACTION6 utiles, **126** acquisitions, **126** méthodes.

Le compteur de régression n’a pas été incrémenté, car les deux jeux restent strictement sous le seuil global de +10 %.

## Correction du vérificateur

Le premier workflow de vérification post-mesure échouait sur une égalité flottante stricte entre `58.4` et `58.39999999999782`.

La correction :

- n’altère aucune durée mesurée ;
- ne retire aucun échantillon ;
- ne modifie pas le verdict ;
- utilise une tolérance numérique de `1e-9` pour recomputer les médianes et variations ;
- vérifie le manifeste avant et après mesure ;
- exige la preuve officielle lorsque le manifeste déclare la qualification acquise.

## Qualification du candidat réconcilié

Workflow de vérification :

- run : `43357493427` ;
- job : `131662901676` ;
- candidat : `ac5a03d39d2035bdd34dcf2ecb01291a5f8c8679`.

Résultats :

- build de production et typecheck : **réussis** ;
- suite TypeScript complète : **333/333** ;
- tests de recomputation de la preuve officielle : **2/2** ;
- contrats ciblés du benchmark natif : **40/40** ;
- vérification des source refs : **réussie** ;
- vérification du manifeste : **réussie** ;
- garde C7 : **vert**.

## Registre des points d’entrée V6

`docs/migration/v6-entry-point-progress.json` reste absent.

Cette absence est désormais suivie comme un garde séparé :

- elle bloque une revendication de compteur complet ou de parité des points d’entrée V6 ;
- elle ne bloque pas rétroactivement la qualification de performance STCK/SMLP, dont le corpus, les runners, les sources, le transport, les échantillons et le scope sont déjà durablement identifiés.

Aucun faux registre n’a été créé pour lever artificiellement ce point.

## Conséquence pour C0 à C7

| Lot | État après cette consolidation |
| --- | --- |
| C0 | terminé |
| C1 | contrôleur produit actif et qualifié |
| C2 | OP18 transportée et OP28 active dans le produit |
| C3 | calculs et recouvrements qualifiés |
| C4 | audit complet, usages génériques non démontrés |
| C5 | retours spécialisés préservés |
| C6 | audit complet |
| C7 | **performance officielle qualifiée pour STCK/SMLP** |

## Publication

Aucune publication Site n’est incluse dans cette étape.

La publication reste soumise au workflow :

`GitHub canonique → publication Site → vérification GitHub ↔ Site`.

## Prochaine étape

Le lot de performance Region est clos. La suite recommandée est le lot 9C `joint_channels`, en conservant une démarche fondée sur une preuve causale :

1. produire une vraie décision conjointe depuis plusieurs canaux ;
2. démontrer sa consommation et son effet sur l’action ;
3. garder l’ambiguïté lorsque plusieurs propriétaires incompatibles subsistent ;
4. mesurer le coût seulement après qualification fonctionnelle ;
5. traiter séparément la reconstruction du registre des points d’entrée V6 si une revendication de compteur/parité devient nécessaire.

## Requalification C7 du contrat de configuration canonique

Le contrat navigateur accepte maintenant les deux états du cycle canonique, `ready-for-official-abba-measurement` et `qualified-functionally-and-performance`. Le contrat est inclus dans les `sourceRef` A/B et a été requalifié sur le protocole strict A1/B1/B2/A2.

- commit mesuré : `ea6bc872b90261133dfc8780664b487f5917653f` ;
- run : `43364316353`, job : `131685000996` ;
- STCK : +2,2222 %, accepté ;
- SMLP : +1,8695 %, accepté ;
- 367/367 tests TypeScript ;
- 24/24 contrats natifs ;
- build et parité Worker/Pyodide réussis ;
- aucune publication Site.

Preuve : `docs/recovery/op01-op31-c7-config-reconciliation-20261113.md`.

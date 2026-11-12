# OP01–OP31 — reprise depuis la reconstruction Site 109

## Identités GitHub

- Lot : vérification Logos Engine OP01 à OP31, C0 à C7.
- Source de récupération : `op01-op31-c0-c7-audit`.
- Source SHA : `07a6ea06e12746deea3bc1a2de031f63a4f9c93a`.
- Baseline canonique : `recovery/site109-reconstruction-20261112`.
- Baseline SHA au redémarrage : `658b89cfe77887eb720c95f0e6e6f8595beffdbd`.
- Branche de travail : `recovery/op01-op31-c0-c7-site109-20261112`.

La comparaison GitHub établit que la source OP01–OP31 est l'ancêtre direct de la baseline canonique : `ahead_by=0`, `behind_by=4`. Les quatre commits supplémentaires de la baseline ajoutent uniquement les règles de reconstruction et de synchronisation GitHub/Site (`AGENTS.md`, politique Git/Site et documents recovery). Aucun fichier OP n'est perdu entre la branche source et la baseline.

## Travail récupérable avec preuve

Les éléments suivants sont déjà présents dans la baseline canonique avec identité GitHub durable :

- `docs/migration/op01-op31-verification-plan.md` ;
- `docs/migration/op01-op31-progress.md` ;
- les documents C1 à C7 du chantier OP ;
- `src/logos-engine/v6-operations.ts` ;
- `src/logos-engine/v6-operation-trace.ts` ;
- `src/logos-engine/v6-operation-cache.ts` ;
- `src/logos-engine/v6-composition-engine.ts` ;
- `src/logos-engine/v6-native-authority.ts` ;
- `src/logos-engine/v6-target-binding.ts` ;
- `src/logos-engine/v6-operation-cycle.ts` ;
- les sept tests `tests/v6-*.test.ts` associés.

Un checkout sparse local a été reconstruit depuis les contenus GitHub. Pour les 16 fichiers nécessaires au noyau/test (`package.json`, `tsconfig.json`, sept sources Logos et sept tests), `git hash-object` correspond exactement aux blob SHA de `recovery/site109-reconstruction-20261112`. Le checkout local n'est donc qu'un miroir vérifié ; GitHub reste la source canonique.

## Déjà présent dans la baseline

Il n'y a aucun changement runtime propre à `op01-op31-c0-c7-audit` à porter vers la baseline : tout le head `07a6ea06…` est déjà inclus dans `658b89cf…`.

Les dispositions fonctionnelles déjà récupérées restent :

- OP18 / OP28 : besoin → appel → admission → effet de garde démontré dans le noyau reconstruit ;
- OP29 : `information_only` ;
- OP30 : `persisted_only`, avec révision, restauration et déduplication ;
- OP31 : `information_only` ;
- trace bornée besoin/appel/consommation ;
- cache borné et invalidé par dépendances/révisions ;
- cycle intégré release → retour → postAnalysis.

## Manquant

Les éléments suivants sont explicitement absents de la baseline et n'ont été trouvés dans aucune branche de récupération connue aux chemins attendus :

- `scripts/measure-native-loop-costs.mjs` ;
- `tests/helpers/v6-live-game-campaign.ts` ;
- `src/runtime/v6-agent-worker.ts` ;
- `docs/migration/v6-delivery-roadmap.md` ;
- `docs/migration/v6-entry-point-progress.json`.

Le noyau Logos OP n'est donc pas encore relié au runtime navigateur/worker complet de la reconstruction Site 109.

## Seulement documenté, non reconstructible exactement aujourd'hui

Les preuves historiques mentionnent un checkout 0.67/0.68 et le Site 109, mais le SHA historique `d90ce5b64fffa53cca201e2a6a49450fd123f299` n'est pas résolu dans le dépôt accessible. Les composants de harness ci-dessus sont attestés par les documents de reconstruction, mais leur ancien contenu exact n'est pas disponible. Ils ne doivent pas être recréés en prétendant reproduire l'ancienne implémentation.

## Tests de reprise

Exécutés depuis le checkout sparse dont les blobs ont été vérifiés contre GitHub :

- `tsc --noEmit` : OK ;
- `node --experimental-strip-types --test tests/v6-*.test.ts` : 27/27 tests passent.

Ces tests couvrent notamment : tri-état OP03, complétude OP09, besoins OP18/OP28, admission physique, cache/invalidation, OP29/30/31, restauration et déduplication OP30, et cycle release → postAnalysis.

## Statut

- Fonctionnel : noyau OP01–OP31 récupéré et qualifié sur les tests disponibles.
- Performance : **fonctionnellement qualifié, performance officielle à confirmer**.
- Motif : le harness officiel STCK/SMLP n'est pas restauré ; les anciennes micro-mesures ne remplacent pas les sessions complètes.

## Prochaine étape

Le prochain travail OP utile dépend de la restauration d'un runtime navigateur/worker ou d'un harness officiel vérifiable. Tant qu'ils manquent, ne pas raccorder artificiellement des OP supplémentaires. Dès qu'un worker/harness qualifié est intégré à la reconstruction canonique, reprendre C1/C2 sur des sessions réelles puis C7 avec STCK et SMLP séparément, strictement sous +10 % chacun.

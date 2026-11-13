# OP01–OP31 — readiness performance officielle après restauration du harness

## État courant

La reconstruction canonique possède maintenant :

- `scripts/measure-native-loop-costs.mjs` ;
- `scripts/native-loop-session-adapter.mjs` ;
- `tests/helpers/v6-live-game-campaign.ts` ;
- `src/runtime/v6-agent-worker.ts` ;
- `docs/migration/v6-delivery-roadmap.md`.

Toujours absent :

- `docs/migration/v6-entry-point-progress.json`.

Toujours non reconstruit :

- les quatre runners natifs A/STCK, A/SMLP, B/STCK, B/SMLP avec corpus durable.

## Gate renforcé

`scripts/check-op01-op31-c7-readiness.mjs` exige désormais :

1. les six fichiers structurants ;
2. `docs/recovery/native-loop-runner-manifest.json` ;
3. quatre runners explicites :
   - A/STCK ;
   - A/SMLP ;
   - B/STCK ;
   - B/SMLP.

Chaque runner doit déclarer :

- `variant` ;
- `game` ;
- `runnerRef` ;
- `sourceRef` ;
- `seed` entier ;
- `corpusRef` ;
- `timingScope` ;
- au moins une `evidenceRef`.

Un fichier vide ou un simple nom de runner ne suffit donc pas à débloquer la
qualification.

## Pourquoi

Le protocole ABBA et l'adapter de session sont maintenant reconstruits, mais ils
n'inventent ni corpus ni timing.

La performance ne devient interprétable que si l'on sait exactement :

- quel code A et B sont comparés ;
- avec quelle graine ;
- sur quelles actions/observations ;
- dans quel scope de chronométrage ;
- avec quelles preuves durables.

## Tests

Gate readiness : **4/4 tests passent**.

## Statut

**fonctionnellement qualifié, performance officielle à confirmer**.

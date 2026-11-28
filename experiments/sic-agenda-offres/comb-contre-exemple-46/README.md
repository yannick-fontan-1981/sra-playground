# COMB/46, effets couplés et réexécution locale

Depuis ce checkout avec Node 24, Pyodide local du Banc et la base `d0e7527c` disponible dans Git :

```powershell
New-Item -ItemType Directory -Force artifacts/qualification-comb-contre-exemple-46 | Out-Null
node experiments/sic-agenda-offres/comb-contre-exemple-46/verifier.mjs --pyodide ../sic-comparison-bench/public/vendor/pyodide --recu artifacts/qualification-comb-contre-exemple-46/recu.json
node --test tests/v6-product-panel-parity.test.ts tests/v6-product-panel-integration.test.ts
npm run typecheck
```

Le vérificateur rejoue 16 gestes sous le pack natif. Il reconstruit les trois contre-exemples par le réducteur du service à partir de retours construits. Il reprend la vue nominale aux coupures des gestes 3 et 9 avec ces faits ajoutés seuls. Un témoin distinct apporte l'arête complète de [4,4,11] à [4,8,11], obtenue dans un autre rejeu par l'enregistreur. Il s'agit d'une mémoire de fixture pour tester son admission. Le reçu garde la branche nominale et les paquets physiques des variantes distincts.

Le candidat donne sa portée au contre-exemple sur l'hypothèse d'indépendance du panneau dans l'époque courante. Une arête locale demande le même tuple de départ et le même contrôle. Une mesure contradictoire à ce tuple la retire. Une ancienne entrée sans tuple ne permet pas de lever un conflit sur ce même contrôle. Un rejeu local compare un seul retour et le scelle. Il est compté comme essayé dans ce contexte. Les options de parité gardent le comportement et le format de la couche d'origine.

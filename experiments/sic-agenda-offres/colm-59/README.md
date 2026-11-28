# COLM, ligne 59

Node 24, Pyodide local du Banc, objets Git `8ce7ee35` et `d0e7527c`. L1, pack natif, 600 gestes par niveau et 16 au total.

```powershell
New-Item -ItemType Directory -Force artifacts/qualification-colm-59 | Out-Null
node experiments/sic-agenda-offres/colm-59/verifier.mjs --pyodide ../sic-comparison-bench/public/vendor/pyodide --recu artifacts/qualification-colm-59/recu.json
node --test tests/v6-queued-field-reference.test.ts tests/v6-queued-field-kernel.test.ts
```

`operateur.mjs` accepte `nominal`, `stationnaire --tour 1`, `trame-dupliquee --tour 1`, `sans-reception --tour 3` et `stationnaire --tour 6`. Les variantes gardent l'empreinte du paquet exécuté et présentent séparément le retour construit. L'ablation du T3 retire toute trame qui correspond au placement intermédiaire mesuré, en conservant la vue canonique.

Le reçu distingue champ posé, enveloppe active, preuve d'un pas de préparation, phase de réception et hypothèses de clôture. Le vrai service exécute et garde les commandes.

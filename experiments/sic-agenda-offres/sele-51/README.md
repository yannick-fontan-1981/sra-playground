# SELE, ligne 51

Node 24, Pyodide local du Banc et objets Git `8ce7ee35` et `d0e7527c`. Depuis ce checkout :

```powershell
New-Item -ItemType Directory -Force artifacts/qualification-sele-51 | Out-Null
node experiments/sic-agenda-offres/sele-51/verifier.mjs --pyodide ../sic-comparison-bench/public/vendor/pyodide --recu artifacts/qualification-sele-51/recu.json
node --test tests/v6-linked-packet-reference.test.ts tests/v6-linked-packet-kernel.test.ts
```

Le mode `nominal` part de L1, pack natif, 600 gestes par niveau et 16 au total. Le mode `long` porte la borne à 20 pour observer les deux fronts au geste 18. Les variantes `sans-trames --tour 4` et `sans-trames --tour 18` livrent seulement la dernière trame réelle au service et conservent le score et l'empreinte du vrai paquet. `decoration-contradictoire` ne modifie que le pixel central de l'ancien destinataire au geste 10. `stationnaire` construit un retour stationnaire après le vrai T1.

Le reçu conserve les identifiants de motifs, les intervalles d'ordinaux dans chaque paquet, les transitions réellement acquises et les hypothèses citées au choix suivant. Les opérations sont exécutées et libérées par le service natif.

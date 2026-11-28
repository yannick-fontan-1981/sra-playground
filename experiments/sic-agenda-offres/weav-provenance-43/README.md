# WEAV/43, contrôle de provenance

Node 24, Pyodide local du Banc et Git avec la base `d0e7527c`. Depuis ce checkout, rejouer la borne catalogue de 16 et un préfixe étiqueté de 32 pour vérifier la conservation de la paire au changement de niveau :

```powershell
New-Item -ItemType Directory -Force artifacts/qualification-weav-provenance-43 | Out-Null
node experiments/sic-agenda-offres/weav-provenance-43/verifier.mjs --pyodide ../sic-comparison-bench/public/vendor/pyodide --recu artifacts/qualification-weav-provenance-43/recu.json
node --test tests/v6-crossed-prefix-access.test.ts tests/v6-crossed-prefix-integration.test.ts
npm run typecheck
```

Le témoin supprime ou substitue une référence seulement au premier choix de reprise, au geste 7. La variante « journal altéré » recharge le journal de la couche dans un propriétaire neuf avant de demander le même choix. Elle garde le reçu d'acquisition du croisement et change le seul événement de paire. La variante « sans reçu » utilise l'ancien format. Les tickets sont autorisés et exécutés par le service.

Dans le service natif candidat, le résultat de comparaison à même scène porte une empreinte canonique du reçu de paire. Celui-ci lie les deux références, les deux entrées d'axe, la valeur et le propriétaire observés. `CrossedPrefixMemory.crossQuestion` exige cette preuve pour réutiliser la paire. Ce rapprochement contrôle la provenance dans le journal natif. Il suppose les acquisitions du moteur et ne donne aucune nouvelle autorité d'exécution ou loi de transmission.

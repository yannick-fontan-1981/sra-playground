# WEAV · ligne 43, provenance de la paire de croisement

**Correctif qualifié sur `b01ca9bfde92510eb622a105e1f1470c796dc8e0`.** Neuf préfixes du service natif et 137 tests passent. Les 16 tickets nominaux et leurs retours concordent avec le gel. Critères `fd53da26`, bilan auteur `c110009e`. Départ N1, graine implicite 0, pack natif, 16 gestes et une prolongation à 32. Premier essai à 00:37:34 le 28 novembre (UTC−3). [Contrôles](sic-weav-provenance-b01ca9bf/banc.json) · [Journaux](sic-weav-provenance-b01ca9bf/recus.zip)

- **Paire authentique.** Le T5 compare le croisement produit par ACTION1 et ACTION3. Son empreinte canonique lie les deux références de retour, les deux entrées, la valeur et le propriétaire. Au T7, le service réutilise cette paire pour libérer ACTION1, avec un vrai retour confirmé. Reconstituer le journal intact conserve exactement ce résultat.
- **Même vue au T7.** Le gel accepte le retour horizontal du T2 à la place du premier terme du croisement. Le candidat refuse la paire, y compris après reconstitution du journal altéré. Une paire absente et un ancien reçu sans attestation donnent le même repli, `information_goal ACTION6 (28,61)`, exécuté par le vrai jeu. La substitution de la référence de scène courante est refusée séparément par la garde du ticket nominal.
- **Niveau suivant.** Au T28 la paire et son acquisition restent présentes dans le journal. Aucun choix fondé sur cette paire antérieure n'apparaît dans la fenêtre restante de N2 jusqu'au T32.

Depuis le checkout candidat sous Node 24, `$b` désigne le Banc et `$out` un nouveau reçu. Le Banc garde la capture détaillée en local sous `artifacts/qualification-weav-provenance-43-b01ca9bf`.

```powershell
node experiments/sic-agenda-offres/weav-provenance-43/verifier.mjs --pyodide "$b/public/vendor/pyodide" --recu $out
node --test tests/v6-crossed-prefix-access.test.ts tests/v6-crossed-prefix-integration.test.ts
py -3.11 "$b/scripts/check-sic-series-corrections.py" WEAV $out
```

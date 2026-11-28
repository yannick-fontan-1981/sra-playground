# RSWP · ligne 55, reprise après remesure des zones

**Ligne 55 qualifiée sur le gel par le Banc.** Sept préfixes et 59 tests sur `f3051af812f4f7f74f0179a804a87753bffa5910`, arbre du gel et mêmes seize décisions et retours que `8ce7ee35`. Critères `47ef461c`, bilan auteur `4d5f0df0`. Premier essai à 00:51:44 le 28 novembre (UTC−3). [Contrôles](sic-rswp-f3051af8/banc.json) · [Journaux](sic-rswp-f3051af8/recus.zip)

- **Sélection.** T1 confirme la première configuration et ne change que le panneau. Avec le retour stationnaire construit, la sélection reste non confirmée et le moteur s'arrête dans ce contexte. Retirer seulement la sélection mémorisée au T4 conserve le premier clic (45,17) et ramène le plan de trois gestes à un.
- **N2, T7→T8.** ACTION5 modifie de 21 pixels chacune des trois zones sans faire progresser le score. Les matériaux affichés passent de [15,12,13] à [12,13,15]. Le T8 mesure les nouveaux receveurs et propose (45,12). Effacer seulement le journal `effects` conserve les contributions et ce ticket. Retirer la pièce de valeur 12 de l'entrée du producteur, à panneau et autres zones égaux, rend le premier receveur indéterminé et bloque la reprise.
- **N3, T15→T16.** Les matériaux affichés restent [13,15,12] et les trois zones changent encore de 21 pixels. Le moteur remesure une réception directe après la préparation à distance. Retirer cette fois la pièce de valeur 13 au producteur bloque le choix. Ces deux applications consomment un geste et gardent le niveau et le score.

Départ N1, pack natif, graine implicite 0, 600 gestes par niveau et 16 au total. Depuis le harnais sous Node 24, `$b` désigne le Banc avec Pyodide local et `$out` un nouveau reçu. La capture détaillée reste sous `artifacts/qualification-rswp-f3051af8`.

```powershell
node experiments/sic-agenda-offres/rswp-55/verifier.mjs --pyodide "$b/public/vendor/pyodide" --recu $out
node --test tests/v6-panel-service.test.ts
py -3.11 "$b/scripts/check-sic-packet-panel-returns.py" RSWP $out
```

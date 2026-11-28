# SK48 · ligne 64, calibrage et accès initial

**Ligne 64 qualifiée sur le gel dans le départ nominal.** Huit préfixes réels rejoués avec le harnais `1cf241c7625a1e76e4aa4828a50e0ec7ee2d099f`, arbre moteur du gel et critères `40774688`. 27 novembre, début à 22 h 56 min 59 s et verdict à 22 h 59 min 40 s (UTC−3). [Reçus](sic-sk48-1cf241c7/recus.zip) · [Contrôles](sic-sk48-1cf241c7/banc.json)

- **T1.** `ACTION1` calibre avant toute prédiction, puis acquiert une translation [−6,0] à étendue constante sur les deux vues liées au ticket. Inverser les deux premières priorités fait jouer `ACTION4`, qui allonge le support de six pixels sans déplacer sa racine. Présenter le plateau antérieur au vrai retour conserve le ticket et le paquet physique, mais inscrit seulement la tentative d’`ACTION1`.
- **T5.** Le premier plan lit les quatre effets mesurés, propose onze gestes et confirme physiquement son premier `ACTION1`. Retirer seulement l’effet d’`ACTION1` conserve les quatre essais et donne `rooted_control_effect_unresolved`, puis `frontier_unknown`.
- **Palette 9↔14.** Les quatre commandes et paquets physiques initiaux restent identiques. Le gel dispose de 12 gestes restants et s’arrête à 792 expansions sur sa borne de profondeur. Sur `4946cf02`, déjà repris pour la ligne 96, le T5 est autorisé après 282 expansions à station `compatible_unordered` et son vrai retour le confirme. L’ordre interne reste inconnu. Cette preuve étend la portée de la ligne 64 sur ce départ. La ligne 96 concerne la reprise après une contradiction plus tardive. [Qualification de 96](sic-qualification-sk48-4946cf02.md)

Départ N1, curiosité native, graine implicite 0, 16 gestes par session et 600 par niveau. Depuis le checkout épinglé à `1cf241c7`, avec Node 24 et Pyodide préparé :

```powershell
$b = '../sic-comparison-bench'
$d = 'experiments/sic-agenda-offres/sk48-64'
node "$d/verifier.mjs" --pyodide "$b/public/vendor/pyodide" --recu qualification.json
py -3.11 "$b/scripts/check-sic-sk48-initial-line.py" qualification.json
```

# SPOR · compartiment 9 et portée du témoin 56

**La ligne 9 est qualifiée sur le gel.** Sept préfixes natifs comparent l’historique `8ce7ee35`, le gel `d0e7527c` et la preuve `19ffd927b588257ce54cf1a35c166ce41ecebf5b`. Le nominal est identique sur les trois. Les 16 tickets du catalogue terminent N1 et contiennent 15 des 17 occurrences recensées de 9. [Reçus](sic-spor-19ffd927/recus.zip)

- **N1/T1–2.** Parmi onze compartiments, le bord de palette 0 distingue la boîte fermée [43,44,46,57] et ses 24 pixels. Le service lie `ACTION6(44,50)` à cette boîte. Le vrai retour change son voisinage, mémorise l’essai et scelle la question avec `matched:null`. T2 choisit la boîte ouverte [50,23,57,37] en (53,30) et cite le retour T1 comme observation et comme réponse mémorisée.
- **Variantes à état égal.** Présenter au service le plateau antérieur au même ticket T1 conserve l’empreinte du vrai paquet dans le reçu. La comparaison ne mesure aucun changement local. La même question devient une tentative close et la frontière émet `ACTION5`. Retirer seulement l’offre initiale donne aussi `ACTION5`, puis le compartiment retrouve (44,50) au T2.
- **N2/T9–10.** Le journal rattache au geste sur [16,48,23,57] un changement dans [25,20,28,37]. Le ticket T10 cite la relation et choisit le compartiment récepteur.

**La ligne 56 reste partielle sur SPOR.** Le T3 en (34,7) vise l’unique occurrence encadrée de la vue courante. Le journal de rappel, sa calibration et ses modèles sont encore vides. Retirer l’acquis de compartiment T1 conserve les trois commandes, les paquets et l’offre de rappel T3. Ouvrir l’enclos en modifiant le seul pixel (19,6) fait jouer (55,29) au compartiment. Le rappel revient au T4 en (32,7), avec un nouvel enclos visible. Le rôle causal d’un exemple retenu sera vérifié avec le témoin MEMO.

Critères `a472c396`. L’arbre moteur du candidat est celui du gel. Départ N1, curiosité native, budget de session 16, 600 gestes par niveau et graine implicite 0. Le reçu de preuve du candidat est à `2aad6e6c`. Le banc compare les tickets, la garde, les références, le paquet physique et l’observation présentée.

Depuis le checkout épinglé à `19ffd927`, avec Node 24 et Pyodide préparé :

```powershell
$d = 'experiments/sic-agenda-offres/spor-9-56'
$p = '../sic-comparison-bench/public/vendor/pyodide'
node "$d/verifier.mjs" --pyodide $p --recu qualification.json
py -3.11 ../sic-comparison-bench/scripts/check-sic-spor-compartments.py qualification.json
```

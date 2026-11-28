# MIND · ligne 12, une séquence ordonnée liée au retour

**Ligne 12 qualifiée sur le gel.** Les deux scénarios passés sur `d0e7527c` et `860835b1b77ae9cde489230be5c1f83c05237302` donnent les mêmes tickets, retours physiques et références d’acquisition. Le code moteur est identique. Critères `f86843ec`. Vérification indépendante de 22 h 55 min 13 s à 22 h 56 min 54 s le 27 novembre (UTC−3). [Reçus](sic-mind-860835b1/recus.zip) · [Contrôles](sic-mind-860835b1/banc.json)

- **N1/T4–6.** T4 soumet [8,14,9] et acquiert trois marques de retour. T5 commence par le même clic (4,54) dans les deux bras. Le nominal lit la preuve T4, retient [8,9,14] et deux candidats. Retirer l’historique seulement à l’entrée du fournisseur T5 répète [8,14,9] avec neuf candidats. L’écart d’action apparaît à T6, (10,54) pour 9, (4,54) pour 14.
- **N1/T8–13.** Le vrai retour de la soumission répétée est compatible avec deux lignes. Il est reçu comme `feedback_ambiguous` et ne remplace pas la preuve T4. T9 reprend cette preuve et N2 arrive après T12 dans ce bras. Le nominal atteint N2 après T8.
- **N2.** La règle d’entrée reprise de l’époque 1 fait l’objet d’une nouvelle validation au T9 nominal. La nouvelle soumission au T12 [8,14,6] nourrit le modèle de T13, qui choisit [14,6,8] avec quatre candidats. N3 arrive après T16, puis T17 rappelle la méthode de l’époque 2.

Départ N1, 600 gestes par niveau, graine implicite 0 et plafonds de session 19 en nominal, 14 pour le retrait. Rejeu du vrai jeu sous Node 24, avec Pyodide dans `../sic-main-delivery` :

```powershell
$out = 'artifacts/rejouer-mind'
py -3.11 scripts/test-sic-catalogue-lines.py d0e7527c --game MIND $out --game-root ../sic-main-delivery
py -3.11 scripts/test-sic-catalogue-lines.py 860835b1 --game MIND $out --game-root ../sic-main-delivery
py -3.11 scripts/check-sic-mind-feedback.py $out
```

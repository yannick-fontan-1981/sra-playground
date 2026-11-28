# COLM · ligne 59, préparation et réception mesurée

**Ligne 59 qualifiée sur le gel par le Banc.** Six préfixes et 74 tests sur `b8902646b6c968f78e5512f62d1d641b0bd20dd0`. Arbre du gel, seize décisions nominales et vrais retours concordants avec `8ce7ee35`. Critères `6c0c3e90`, bilan auteur `1ce9bd3f`. Premier essai à 00:54:16 le 28 novembre (UTC−3). [Contrôles](sic-colm-b8902646/banc.json) · [Journaux](sic-colm-b8902646/recus.zip)

- **Préparation.** T1 change l'ordre [8,11,8] en [8,8,11], à champ posé et colonne stables. Deux permutations restent admissibles. T2 avec la même commande en départage une. Un retour stationnaire ou la duplication de la trame finale ne suffit pas à acquérir une permutation.
- **Réception.** T3 ACTION2 donne neuf trames. L'ordinal 1 montre le placement à un pas, puis le service retient la réception et deux modèles de clôture compatibles. Retirer cette seule trame conserve la vue finale et l'empreinte du paquet officiel. Le statut d'acquisition devient `unexplained_or_boundary`. Il ne reste aucune mesure de réception pour ACTION2. Les deux retours gardent le score à zéro et `matched:null`. Au T4 le service répète ACTION2 dans le bras réduit, tandis que le nominal passe à ACTION3.
- **Translation et reprise.** T6 nomme une translation déjà mesurée puis prépare le T7. Le retour nominal laisse le préfixe ouvert. Le retour présenté sans translation le scelle et réfute seulement la prémisse du contexte. La loi acquise au T4 est conservée. Le N2/T16 remesure la réception dans sa propre époque.

Départ N1, pack natif, graine implicite 0, 600 gestes par niveau et 16 au total. Depuis le harnais, sous Node 24 avec Pyodide local, `$b` désigne le Banc et `$out` un nouveau reçu. La capture détaillée reste sous `artifacts/qualification-colm-b8902646`.

```powershell
node experiments/sic-agenda-offres/colm-59/verifier.mjs --pyodide "$b/public/vendor/pyodide" --recu $out
node --test tests/v6-queued-field-reference.test.ts tests/v6-queued-field-kernel.test.ts
py -3.11 "$b/scripts/check-sic-queued-reception.py" $out
```

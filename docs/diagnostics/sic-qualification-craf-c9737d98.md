# CRAF · ligne 73, conversion et méthode acquise

**Ligne 73 qualifiée sur le gel par le Banc.** Cinq préfixes et 77 tests, 16 gestes historiques concordants. Harnais `c9737d9831a703611422fcf03af83e39dbfdc6d6`, bilan auteur `523a872f`. [Contrôles](sic-craf-c9737d98/banc.json) · [Journaux](sic-craf-c9737d98/recus.zip)

- T1 acquiert une sélection guidée. T2 et T4 acquièrent les deux chargements. Au vrai T5 les entrées [11,9] sont retirées et le symbole 14 apparaît. Le compteur passe à un et le reçu acquiert la transformation avec ses deux références.
- Présenter le même retour T5 avec le produit 0 à la place de 14 conserve le paquet officiel et le retrait des deux entrées. Le compteur et la transformation restent absents. T6 joue le même clic (4,21) mais perd le soutien causal du diagramme.
- Le vrai T9 gagne N1 dans les deux bras. Le nominal assemble la méthode à partir des rôles qualifiés. Le bras au produit remplacé garde la méthode incomplète. En N2, le nominal réutilise la méthode sur les nouvelles demandes [7,14,10], tandis que le bras sans preuve reprend par la frontière.

Départ N1, pack natif, graine implicite 0, 600 gestes par niveau et 16 au total. Depuis le harnais sous Node 24, `$b` désigne le Banc avec Pyodide local et `$out` un nouveau reçu.

```powershell
node experiments/sic-agenda-offres/craf-73/verifier.mjs --pyodide "$b/public/vendor/pyodide" --recu $out
node --test tests/v6-symbol-transactions-reference.test.ts tests/v6-symbol-transactions-kernel.test.ts
```

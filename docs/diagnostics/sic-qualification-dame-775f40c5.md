# DAME · ligne 17, invitation, retrait et reprise de la prise

**Ligne 17 qualifiée sur le gel par le Banc.** Cinq préfixes et 158 tests, harnais `775f40c5505add040d3b1c1aac5aba8d0dd0a027`, critères `d6fd1887`. Seize tickets nominaux concordent avec le catalogue. [Contrôles](sic-dame-775f40c5/banc.json) · [Journaux](sic-dame-775f40c5/recus.zip)

- Le vrai T1 sélectionne le membre [2,0]. La population de cinq membres reste intacte et les cases [0,2] et [4,2] deviennent des invitations. Retirer seulement [0,2] rend (45,33). Enlever les deux invitations laisse le focus indéterminé et rend la nouvelle sélection (24,26).
- Le vrai T2 choisit [0,2]. Le mobile change de case et l'intermédiaire [1,1] disparaît. La population passe de cinq à quatre et acquiert la relation de prise. Présenter le même paquet avec le seul intermédiaire restauré garde cinq membres et ne produit aucun acquis de prise. Le service reprend par (24,26).
- T3 cite le retour T2 et vérifie une nouvelle prise. La relation de même rang reste présente en N2, enrichie de son symétrique. La nouvelle géométrie à sept membres donne un plan de huit gestes, calculé en 33 états. T9 confirme la réduction à six. Les passages officiels arrivent séparément aux T7 et T15.

Départ N1, pack natif, graine implicite 0, 600 gestes par niveau et 16 au total. Depuis le harnais, `$b` désigne le Banc et `$out` un nouveau reçu. Node 24. Les tests de liaison demandent le corpus V52.

```powershell
node experiments/sic-agenda-offres/dame-17/verifier.mjs --pyodide "$b/public/vendor/pyodide" --recu $out
node --test tests/v6-reduction-transport-parity.test.ts tests/v6-reduction-search-bound.test.ts tests/v6-support-caller-integration.test.ts
```

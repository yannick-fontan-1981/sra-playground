# TR87 · ligne 95, dérivation et édition mesurée du mot

**Ligne 95 qualifiée sur le gel par le Banc.** Six préfixes, 106 tests et 16 commandes et retours nominaux concordants. Harnais `c41c028c2ed06244715bad39024f542d44f8eda0`, critères `a6fd5ee1`. [Contrôles](sic-tr87-c41c028c/banc.json) · [Journaux](sic-tr87-c41c028c/recus.zip)

- **Dérivation.** Les six paires de cadres fournissent une seule traduction du mot de cinq glyphes. Enlever le type de bordure de la paire utilisée conserve l'encre et rend la dérivation indisponible. Une autre famille joue le même ACTION1 avec le même paquet réel. Enlever une paire étrangère garde la dérivation et l'essai. Inverser seulement les commandes proposées garde l'ordre des décisions.
- **Édition mesurée.** Après le vrai ACTION1, seul le glyphe focalisé change à indice fixe. Un retour stationnaire construit n'acquiert ni cette édition ni un mouvement de curseur et le service choisit ACTION2. Les retours suivants complètent le cycle, montrent l'opération inverse et mesurent le déplacement du focus de 0 à 4 au T9.
- **Projection.** T10 utilise les preuves d'édition et de curseur pour un plan de sept gestes. Les sept retours confirment les projections au sein du même plan. Le score reste à zéro au plafond de 16.

Départ N1, pack natif, graine implicite 0, 600 gestes par niveau et 16 au total. Depuis le harnais, `$b` désigne le Banc avec Pyodide local et `$out` un nouveau reçu. Node 24.

```powershell
node experiments/sic-agenda-offres/tr87-95/verifier.mjs --pyodide "$b/public/vendor/pyodide" --recu $out
py -3.11 "$b/scripts/check-sic-invitation-and-word.py" TR87 $out
node --test tests/v6-interface-families.test.ts tests/v6-native-interface-families.test.ts
```

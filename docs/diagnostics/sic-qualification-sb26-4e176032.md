# SB26 · ligne 85, ordre des places et couleur déposée

**Ligne de catalogue 85 qualifiée sur le gel par le Banc.** Cinq préfixes, 127 tests, 16 commandes historiques concordantes. Harnais `4e1760327c1aea9031654e7de7c26da3ae19cf7b`, bilan auteur `930f29c8`. [Contrôles](sic-sb26-4e176032/banc.json) · [Journaux](sic-sb26-4e176032/recus.zip)

- Le mot nominal [9,14,11,15] et l'inventaire [14,15,9,11] conduisent au clic de sélection (35,58) au T3. Le vrai T4 dépose 9 dans la première case et retire la pièce correspondante de l'inventaire.
- Permuter les deux premières bordures à inventaire fixe change le mot et la sélection. Le service choisit (19,58), puis prévoit 14 pour la même destination. Inverser seulement le tableau des commandes candidates laisse la sélection et le dépôt nominal intacts.
- Après le vrai T4, présenter 14 au lieu de 9 conserve le paquet officiel et la pièce retirée. Le retour présenté contredit le dépôt. Le préfixe se ferme et la famille suspend son intervention dans l'époque courante, en conservant la sélection acquise. Le nominal remesure une nouvelle disposition à deux rangées en N2.

Départ N1, pack natif, graine implicite 0, 600 gestes par niveau et 16 au total. Depuis le harnais, `$b` désigne le Banc avec Pyodide et `$out` un nouveau reçu. Node 24.

```powershell
node experiments/sic-agenda-offres/sb26-85/verifier.mjs --pyodide "$b/public/vendor/pyodide" --recu $out
node --test tests/v6-interface-families.test.ts tests/v6-native-interface-families.test.ts tests/v6-support-caller-integration.test.ts
```

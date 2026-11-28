# ISOS · ligne 10, méthode réemployée et provenance du passage

**Réemploi démontré, provenance du passage en échec.** Le numéro 10 reste hors du compteur strict. Le harnais `5161917eebb0e7f5d2ec6010f61bae1c2eff7b3f` utilise l’arbre moteur du gel. Critères `4ce13a6b` et contre-épreuve opérateur `949c08db`. Rejeu de 23:47:02 à 23:53:46 le 27 novembre (UTC−3), deuxième capture dédiée à la provenance. [Reçus](sic-isos-5161917e/recus.zip) · [Contrôles](sic-isos-5161917e/banc.json)

- **Deux décisions au même clic.** T1 (33,23) teste une face vide, T2 le sommet désormais visible. Le vrai T2 acquiert le déplacement [0,−6] et l’extension des deux côtés. T3 cite cette mesure et valide N1. Le départ de composition est remesuré en N2 et N3, aux T4 et T8, avec sa nouvelle portée et un vrai retour de rendu concordant. Un retour sans changement au T1 clôt l’essai initial.
- **Retrait du reçu au vrai passage T3.** Sans référence portable, la nouvelle scène officielle et son score restent identiques, mais le fournisseur de facettes s’abstient au T4. La dépendance à la présence de la référence est observable.
- **Substitution de la seule référence.** À la place de la référence **après** le vrai passage en époque 2, mettre celle du plateau **avant** le passage en époque 1. Le paquet T3, le gain officiel et la vue de T4 restent les mêmes. T4 conserve l’offre, le clic, la garde et le vrai retour de rendu. Le défaut se reproduit sur le gel, la preuve et l’assemblage `674b0dd1`. `facetCompoundPlan` exige une référence portable renseignée. Le champ n’est pas vérifié contre le passage qu’il est censé attester. [Planificateur](../../src/logos-engine/v6-facet-examples-compound.ts)

Départ N1, curiosité native, graine implicite 0, 16 gestes par session et 600 gestes par niveau. Depuis la branche du banc sous Node 24 et Pyodide préparé :

```powershell
$out = 'artifacts/rejouer-isos-10'
foreach ($sha in 'd0e7527c','5161917e','674b0dd1') {
  py -3.11 scripts/test-sic-catalogue-lines.py $sha --game ISOS $out --game-root ../sic-main-delivery
}
$env:SIC_ISOS_STALE_BOUNDARY = '1'
try {
  foreach ($sha in 'd0e7527c','5161917e','674b0dd1') {
    py -3.11 scripts/test-sic-catalogue-lines.py $sha --game ISOS "$out-provenance" --game-root ../sic-main-delivery
  }
} finally { Remove-Item Env:SIC_ISOS_STALE_BOUNDARY }
py -3.11 scripts/check-sic-isos-facet.py $out --stale "$out-provenance"
```

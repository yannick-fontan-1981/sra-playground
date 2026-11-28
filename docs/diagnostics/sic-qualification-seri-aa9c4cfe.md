# SERI · ligne 93, complétions acquises et analyse de la rangée courante

**Reprise de la ligne 93 établie sur le gel.** Le [contrôle de provenance sous duplication](sic-qualification-seri-provenance-aa9c4cfe.md) maintient la ligne hors strict. Quatre scénarios par SHA, reçus identiques sur `d0e7527c` et `aa9c4cfe2c4ac65d5f1164c7748a8a2c1f677aec`. Critères `243c93c0`. Premier essai à 01:04:03 le 28 novembre (UTC−3). [Contrôles](sic-seri-aa9c4cfe/banc.json) · [Reçus](sic-seri-aa9c4cfe/recus.zip)

- **N1 et N2.** Le vrai T1 remplit la case attendue et préserve les autres cartes. Son reçu atteste la complétion. Les vrais passages aux T4 et T8 ont chacun un reçu officiel distinct. Les huit retours gardent `matched:null`.
- **N2/T5 à vue identique.** La continuation cite les complétions récentes et le passage officiel, révisions 3, 4 et 5. Retirer une complétion laisse le minimum et substitue 2, 3 et 5. En retirer deux rend la continuation indisponible et le moteur réanalyse directement la rangée. Les trois bras choisissent le même clic (46,54) et le vrai paquet remplit la même case.
- **Retour stationnaire.** Le test présente au service le premier état sans remplissage après le ticket de soumission. `answer_acceptance_unconfirmed` ne crédite aucune complétion. Le service ne répète pas la soumission identique et libère ACTION1 de frontière, joué sur le départ officiel compatible. Le score reste à zéro.

Départ N1, graine implicite 0, 16 gestes au total, horloge déterministe. Depuis le Banc, `$g` désigne les actifs du gel avec Pyodide et `$out` un nouveau dossier de reçus. Utiliser Node 24.

```powershell
foreach ($sha in 'd0e7527c','aa9c4cfe') {
  py -3.11 scripts/test-sic-catalogue-lines.py $sha $out --game SERI --game-root $g
}
```

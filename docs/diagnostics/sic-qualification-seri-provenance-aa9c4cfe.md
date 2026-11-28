# SERI · ligne 93, justification de continuation dupliquée

**Qualification partielle au gel.** La reprise et sa contre-épreuve de retrait sont établies. Un journal construit révèle que les preuves exposées d'une reprise admise peuvent citer une même complétion deux fois. Le gel et `aa9c4cfe2c4ac65d5f1164c7748a8a2c1f677aec` donnent les mêmes reçus. Opérateur `4b183536`. [Contrôles](sic-seri-provenance-aa9c4cfe/banc.json) · [Reçus](sic-seri-provenance-aa9c4cfe/recus.zip)

| Mémoire présentée à N2/T5, même vue | Questions distinctes | Justification du ticket |
|---|---:|---|
| Nominale, complétions 2, 3, 4 | 3 | Continuation 3, 4, 5 |
| Dernière complétion remplacée par une copie authentique de 3 | 2 | Continuation 3, 3, 5 |
| Une seule question 3 inscrite deux fois | 1 | Analyse de la rangée, aucune preuve de continuation |

L'admission compte bien des questions distinctes. Le choix de la liste de témoins prend ensuite les deux dernières entrées du journal. La référence 3 figure deux fois dans `sequence_plan.continuation_witnesses` et dans le modèle du dossier de décision `bundle_template.evidence`. Le premier écart observé porte donc sur la justification. Le vrai clic (46,54) et le paquet de retour restent identiques dans les trois bras. La ligne reste hors strict jusqu'à correction de la liste exposée. [Parcours nominal](sic-qualification-seri-aa9c4cfe.md)

```powershell
foreach ($sha in 'd0e7527c','aa9c4cfe') {
  py -3.11 scripts/test-sic-catalogue-lines.py $sha $out --game SERI --duplicate-completion --game-root $g
}
```

`$g` désigne les actifs du gel avec Pyodide et `$out` un nouveau dossier de reçus. Utiliser Node 24.

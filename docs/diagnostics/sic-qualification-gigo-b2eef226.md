# GIGO · ligne 53, réponse locale et distante

**Ligne 53 qualifiée sur le gel.** Quatre tests par SHA, `d0e7527c` et `b2eef22648f3a511bed0783d938013bae8673a8a`, arbre moteur commun. Les cinq sessions observées concordent. Critères `a23a7b6e`. Premier essai à 23:32:11 et verdict à 23:36:12 le 27 novembre (UTC−3). Opérateur `a6cf22bc`. [Reçus](sic-gigo-b2eef226/recus.zip) · [Contrôles](sic-gigo-b2eef226/banc.json)

- **GIGO N1/T1.** Le seul cœur admissible, d’aire 16 et de palette 5, donne le clic (26,20). Le vrai retour change 420 pixels, dont 20 locaux et 400 distants, avec `matched:null` et aucune progression officielle. Le service s’arrête sur `nested_control_effect_requires_composition`.
- **Contrôles.** Un cadre ex æquo retire l’offre imbriquée. Le garde refuse aussi le point de la proposition antérieure lorsque le contexte change. Un retour stationnaire construit au même ticket donne zéro changement, aucune acquisition de sélection ou d’impossibilité, puis un repli de frontière.
- **VALV.** Le même type de question initiale et la même garde accompagnent un retour de 72 pixels, tous distants. La réception acquiert aussi le contexte de remplissage. T2, T5, T11 et le premier ticket suivant observent la suite des familles. Le jeu VALV est réellement joué jusqu’au retour T11. Les preuves propres de 44, 47 et 48 gardent leur qualification séparée.

Départ N1, ouverture native, graine implicite 0, plafond de 16 gestes par session, 600 par niveau. Le premier branchement du banc supposait un champ d’alternatives présent dans tous les plans VALV. La reprise l’a rendu facultatif et les quatre tests passent sur chaque SHA.

```powershell
$out = 'artifacts/rejouer-gigo-53'
py -3.11 scripts/test-sic-catalogue-lines.py d0e7527c --game GIGO $out --game-root ../sic-main-delivery
py -3.11 scripts/test-sic-catalogue-lines.py b2eef226 --game GIGO $out --game-root ../sic-main-delivery
py -3.11 scripts/check-sic-gigo-control.py $out
```

# ELAS · ligne 19, sélection et revalidation de la cible métrique

**Ligne 19 qualifiée sur le gel.** Deux scénarios concordent sur `d0e7527c` et `280a54b5dd589d192d369b690781de057efaec8c`, arbre moteur commun. Critères `c7939816`. Premier essai à 23:17:47 et verdict à 23:21:20 le 27 novembre UTC−3. Le rejeu à partir de 23:19:51 ajoute la capture du scellement effectif. [Reçus](sic-elas-280a54b5/recus.zip) · [Contrôles](sic-elas-280a54b5/banc.json)

- **N1 et N2.** Le premier clic en (28,25) sélectionne le receveur 24, cible [14,10], échelle 2:1. T2 valide N1. Le clic du T3 en (19,28) sélectionne le receveur 30, cible [8,6], échelle 3:1. Le plan T5 lit le déplacement mesuré au T4.
- **N2/T5.** Le transfert physique attendu est observé, et le receveur devient 16. La grille reste liée à la même référence. La cible remesurée change et perd la couleur 9. Le service scelle la projection au T5 avec `metric_effect_or_underlay_requires_reconciliation`. Le T6 utilise la nouvelle référence. Le T11 atteint N3.
- **Même commande, autre receveur.** Au vrai départ alternatif, le clic (17,13) sélectionne le receveur 8 au lieu de 24. La comparaison de la sélection nominale scelle le préfixe et le garde refuse le ticket d’`ACTION1` pour ce receveur avec `metric_premise_changed`. Exécuter cette même commande directement sur le jeu alternatif transfère la matière vers 1 et conserve le niveau en cours. Le nominal utilise le receveur 24 et marque le niveau à T2.

Départ N1, graine implicite 0, ouverture native, six niveaux visés, 16 gestes de session et 600 par niveau.

```powershell
$out = 'artifacts/rejouer-elas-19'
py -3.11 scripts/test-sic-catalogue-lines.py d0e7527c --game ELAS $out --game-root ../sic-main-delivery
py -3.11 scripts/test-sic-catalogue-lines.py 280a54b5 --game ELAS $out --game-root ../sic-main-delivery
py -3.11 scripts/check-sic-elas-metric.py $out
```

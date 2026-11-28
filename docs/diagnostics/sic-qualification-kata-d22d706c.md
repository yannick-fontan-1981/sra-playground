# KATA · ligne 32, membre et aperçu mesuré

**Ligne 32 qualifiée sur le gel.** Trois scénarios sur `d0e7527c` et `d22d706c8c148da1b6bde090d3c6c53d20c69d50`, même arbre moteur. Les reçus sont identiques. Critères `d48683d5`. Rejeu indépendant commencé à 22:59:56 le 27 novembre et complet à 23:03:38 (UTC−3). [Reçus](sic-kata-d22d706c/recus.zip) · [Contrôles](sic-kata-d22d706c/banc.json)

- **N1/T1.** La cible [0,1] et le clic (29,4) sont déjà choisis tandis que le membre de l’aperçu reste inconnu. Le vrai retour lie `piece:2` au masque de palette 0. Présenter le plateau antérieur au même ticket laisse l’aperçu inconnu et le T2 répète la sélection. T5 acquiert le contrôle `ACTION3` de translation [0,−1] avec ses deux références.
- **N3/T18.** Au même aperçu, la preuve de contrôle conservée déclenche `ACTION2` vers [1,6]. Retirer les contrôles seulement à l’entrée du fournisseur déclenche `ACTION1` avec prévision ouverte. Le vrai retour garde [0,6]. T19 reprend `ACTION2` et confirme [1,6]. Après la pose mesurée de `piece:2` en [2,0] au T25, le T26 sélectionne `piece:3` avec cible [2,1].
- **Périmètre.** Les 16 tickets de catalogue communiqués au service sont attribués à `preview_packing` et bouclent deux niveaux. Les 33 gestes prolongés vérifient séparément N3 jusqu’au passage officiel T33. Les variantes de sélection et de mesure aboutissent par des observations distinctes.

Le premier branchement d’observation du banc enveloppait une méthode synchrone dans une fonction asynchrone. Le harnais échouait à lire les événements. Une fois le contrat synchrone rétabli, les trois tests passent par SHA. Le retour stationnaire de T1 est construit. Les retours de T18–19 dans le bras de retrait viennent du vrai jeu.

Départ N1, ouverture native, graine implicite 0, 600 gestes par niveau. Depuis la branche du banc sous Node 24 avec le checkout du gel équipé de Pyodide :

```powershell
$out = 'artifacts/rejouer-kata'
py -3.11 scripts/test-sic-catalogue-lines.py d0e7527c --game KATA $out --game-root ../sic-main-delivery
py -3.11 scripts/test-sic-catalogue-lines.py d22d706c --game KATA $out --game-root ../sic-main-delivery
node scripts/sic-recapture-strategy-inventory.mjs ../sic-main-delivery "$out/catalogue.json" KATA
py -3.11 scripts/check-sic-kata-preview.py $out
```

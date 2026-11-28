# LS20 · ligne 20, accès par alignement mesuré

**Ligne 20 qualifiée sur le gel.** Les trois parcours produisent les mêmes décisions et retours sur `d0e7527c` et `a0af03d0f7c1ebe722b3b7b8bc4db4ba05364025`, arbres moteur identiques. Critères `64b099db`. Rejeu indépendant de 23:07:15 à 23:09:31 le 27 novembre UTC−3. [Reçus](sic-ls20-a0af03d0/recus.zip) · [Contrôles](sic-ls20-a0af03d0/banc.json)

- **N1/T7–T10.** `ACTION3` déplace le membre de [24,45] à [19,45]. Le vrai retour confirme la position. T10 mesure un changement sélectif et conserve le pair dans [33,9,39,15]. Le comparateur donne `matched:null` à ce contact terminal, tandis que le producteur acquiert et date la preuve sélective.
- **N1/T11 et T14.** La sonde d’accès au pair, puis la décision d’aller au pair, citent toutes les deux le retour T10. Elles lient le même pair désormais aligné. Le T14 prédit [34,25], effectivement observé. N2 n’arrive qu’après T17, puis T18 ouvre une acquisition dans la nouvelle époque.
- **Contre-épreuves à plateau égal.** L’orientation ambiguë produit `pose_not_discriminated` malgré une route liée. Rendre la référence de route périmée donne `modifier_access_unbound` et `stale_scope`. Les deux bras jouent réellement `ACTION2` via `view`. Le retour porte `screen_pose_diverged`. L’interrogation isolée de la politique au T14 vérifie aussi que la liaison du trajet seule, sans la preuve T10, retire le choix du pair.

Départ L1, curiosité native, graine implicite 0, 600 gestes par niveau et six niveaux visés. Le vrai budget de session 16 retrouve les dix décisions de morphologie, sans niveau terminé. Le test T17–18 utilise une session distincte de 19 gestes.

```powershell
$out = 'artifacts/rejouer-ls20-20'
py -3.11 scripts/test-sic-catalogue-lines.py d0e7527c --game LS20 $out --game-root ../sic-main-delivery
py -3.11 scripts/test-sic-catalogue-lines.py a0af03d0 --game LS20 $out --game-root ../sic-main-delivery
node scripts/sic-recapture-strategy-inventory.mjs ../sic-main-delivery "$out/catalogue.json" --target-levels 6 --offer morphology '*' morphology_probe LS20
py -3.11 scripts/check-sic-ls20-morphology.py $out
```

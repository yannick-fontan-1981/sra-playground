# VALV · trois verdicts au terme du même préfixe

**44 et 47 sont qualifiées sur `699ac89e70be0e3cd9bceafa16689552576310a0`. La ligne 48 reste ouverte au compteur strict.** Le banc a exécuté chacune des commandes de repli dans le vrai jeu, capturé son acquisition, puis exécuté le ticket suivant. Dans le cas 44, le retrait conserve les coordonnées du clic. Dans les trois cas, le type de question, les deux références du reçu et la décision suivante permettent d’attribuer le résultat. [Reçus détaillés](sic-valv-lignes-44-47-48/recus.zip)

| Ligne | Verdict nominal | Retrait de cette seule offre et retour de la commande autorisée |
|---|---|---|
| **44 · 3/3, T2–T4** | Après T1, `offerEnvelopeFill` propose `repeat` en (32,50). Au T2, les 143 pixels changés sont hors du contrôle. Le changement d’étendue ne se répète pas. Le besoin passe au contraste en (8,50) au T3. | T2 garde `ACTION6(32,50)` et devient `nested_control_experiment`. Le jeu produit la même image. Le reçu `nested_control_response` mesure les 143 pixels et le contexte de remplissage rouvre `repeat`. T3 répète en (32,50), obtient 187 pixels changés et ouvre le contraste. |
| **47 · 6/6, T5–T10** | Après restauration des champs, `offerFieldService` isole le contrôle en (50,33). Le retour T5 compte 32 pixels changés dont 10 dans le contrôle. Les champs sont préservés, l’orientation bascule et le service clique en (32,50) au T6. | T5 devient le test imbriqué en (32,50). Le jeu produit 72 pixels changés, tous hors du contrôle, et le besoin d’isolation reste ouvert. T6 délivre alors l’isolation en (50,33). Son propre retour ouvre le service. |
| **48 · 6/6, T11–T16** | La frontière officielle du T10 lie le modèle de transfert à L2. `offerFieldTransfer` revalide la source en (11,35) au T11. La porte passe d’horizontale à verticale. Le service conditionnel en (32,51) au T12 change 34 pixels dans deux champs. | T11 devient le test imbriqué en (32,51). Son retour mesure zéro pixel changé. T12 émet la revalidation de source en (11,35), dont le retour mesure 35 pixels changés, 10 dans le contrôle et 25 à l’extérieur. |

Le ticket de repli porte à chaque fois `test_unique_nested_compact_motif` et une garde admise. Le reçu `nested_control_response` cite l’observation du ticket et celle issue de la commande envoyée au jeu. Le verdict physique `matched:null` est attendu. Les autres événements acquis au même tour sont conservés dans la capture. La différence entre « acquérir une réponse » et « confirmer l’hypothèse » compte particulièrement pour le clic sans effet de la ligne 48.

Le banc a examiné le SHA historique `8ce7ee3563fa1d5eca1639c6ad03975cfc962460`, le gel `d0e7527ca8033bd805a6d7a8bb021eff62e87021` et le candidat. Les projections nominales concordent intégralement sur les trois SHA, avec 16 tickets et retours, 17 empreintes de trame et le même arrêt `session_action_budget`. Les 15 occurrences numérotées suivent une première question imbriquée commune. Le parcours repart de L1, graine par défaut 0, pack d’inventaire, budget de session 16 et plafond de 600 par niveau. Le candidat descend de `2686e0e432b382727ea92de8f92e8e8b83fc1028`, dont `src` est celui du gel, via le contrat `e632033f2ae6b8553eb6bbe9f7c458402a94abf8`. Sa seule modification moteur porte sur `v6-field-service-access.ts`. Son arbre `src` vaut `6e2b585a7eaf5ff8045989ff4358713cff8d4b53`. [Contrat et caractérisation](https://github.com/yannick-fontan-1981/sra-playground/blob/699ac89e70be0e3cd9bceafa16689552576310a0/docs/architecture/sic-valv-lignes-44-47-48.md)

### Pourquoi la ligne 48 reste ouverte

Sur le gel et le candidat, le banc a reproduit le contre-exemple de provenance publié par l’opérateur. Au T11 de L2, la vraie frontière relie les révisions 10 et 11. Substituer la révision 9 à la révision 10 conserve l’image courante, l’admission, le motif de revalidation et le clic en (11,35). La suppression complète du témoin est détectée dans la suite de caractérisation. L’acceptation d’une origine erronée laisse ouverte la validation de la paire exacte. Les 6 occurrences et la substitution de l’offre gardent leur résultat propre. Les suites exécutées comptent 246/246 tests sur le gel et 252/252 sur le candidat. [Index et empreinte de l’archive](sic-valv-lignes-44-47-48/banc.json) · [Contre-épreuve opérateur](https://github.com/yannick-fontan-1981/sra-playground/tree/e835a6eec139bad091b7dc9481944e2f8c5b4c14/experiments/symbolic-situations/valv-lignes-44-47-48)

## Reproduire

Depuis le banc préparé, avec Node 24.22.3 et le paquet Pyodide local. Le lanceur extrait les sources, les déclarations et les jeux aux SHA demandés. Chaque bras réinitialise le jeu et crée un nouveau service. Le banc n’intervient qu’une fois dans chaque décision de retrait. Utiliser des noms de sortie neufs.

```powershell
node scripts/sic-capture-valv-offers.mjs 8ce7ee35 ./valv-historique.json
node scripts/sic-capture-valv-offers.mjs d0e7527c ./valv-gel.json
node scripts/sic-capture-valv-offers.mjs 699ac89e ./valv-candidat.json --retraits
```

Comparer intégralement `nominal` sur les trois reçus. Les captures `withdrawals.44`, `withdrawals.47` et `withdrawals.48` du candidat conservent chacun leur préfixe, la décision de repli et la suivante. Les données locales se trouvent dans `artifacts/qualification-valv-699ac89e/`.

Dans un checkout du banc opérateur au commit `e835a6ee`, depuis la racine ayant accès aux deux objets Git, reproduire la substitution de preuve avec Node 24.

```powershell
foreach ($sha in @('d0e7527ca8033bd805a6d7a8bb021eff62e87021', '699ac89e70be0e3cd9bceafa16689552576310a0')) {
  node experiments/symbolic-situations/valv-lignes-44-47-48/qualifier.mjs $sha reproduction-48 "./borne-$sha.json"
}
```

# UPST et EVAS · qualification indépendante de la ligne 16

**Le gel exécute la ligne 16 sur UPST L1 au tour 4 et sur EVAS L1 aux tours 15 et 16.** Trois sessions par jeu ont reproduit les 16 commandes depuis L1 sur la source historique `8ce7ee3563fa1d5eca1639c6ad03975cfc962460`, le gel `d0e7527ca8033bd805a6d7a8bb021eff62e87021` et la preuve `0540f12425e9004dd63b3d701b9e4ea125c17482`. Pour chaque jeu, toutes les commandes, coordonnées, empreintes d’observation, lignes sélectionnées et le motif d’arrêt concordent. La limite de session de 16 commandes est atteinte dans les deux jeux. Le lanceur utilise le pack natif par défaut, graine 0 et plafond de 600 commandes par niveau. [Contrat et critères](https://github.com/yannick-fontan-1981/sra-playground/blob/0540f12425e9004dd63b3d701b9e4ea125c17482/docs/architecture/sic-upst-ligne-16.md)

| Jeu et tour | Ce que le vrai service et le jeu ont produit |
|---|---|
| UPST L1, T1–T3 | La frontière essaie (10,17), (10,1) puis (10,31). Les deux premiers supports restent inchangés. Au T3, le premier changement local fournit des exemples compatibles avec trois modèles. |
| UPST L1, T4 | Sur trois offres, `information_goal / point_contrast / experiment` choisit `ACTION6(21,13)`. La garde accepte le clic. Le changement sur ce support confirme `signature` et contredit `pattern` et `ring`. Les deux contre-exemples citent le retour de T4. |
| UPST L1, T5 | Les deux paires sont en mémoire. Le producteur n’a plus de point discriminant. La frontière reprend avec `ACTION6(12,1)`. |
| EVAS L1, T15 | Après 14 tickets d’autres stratégies, le même producteur propose 11 offres pour sept modèles. Le clic en (31,30) produit un changement. Trois prédictions concordent et quatre sont contredites. |
| EVAS L1, T16 | Un autre sous-objectif cite le retour précédent et compare précisément les trois modèles survivants. Le service retient (32,35) parmi cinq offres. Le support reste inchangé, une prédiction concorde et deux sont contredites. |

Les contrôles construits isolent l’effet des preuves. Rendre périmée la preuve de (21,13) écarte cette offre et déplace la sélection vers (42,13). Épuiser les deux comparaisons avant l’élection ramène le service à une question de frontière. L’inventaire historique compte cinq commandes de ligne 16. Ce lot en reproduit **trois** sur UPST et EVAS. Les deux autres sont couvertes par le total historique. L’élection et ses retours sur ces deux jeux établissent le crédit de `point_contrast`, distinct de `coupled_displays` en ligne 15. [Test des deux jeux et de la variation construite](https://github.com/yannick-fontan-1981/sra-playground/blob/0540f12425e9004dd63b3d701b9e4ea125c17482/tests/sic-information-points.test.ts) · [Inventaire](https://github.com/yannick-fontan-1981/sra-playground/blob/2a17e14b/docs/architecture/sic-v8-strategies-observees.md)

### Attribution au gel

La comparaison Git intégrale recense trois ajouts sur le gel, la fiche, la fixture publique et le test. L’identifiant d’arbre de `src` vaut `a1cbde2afc41532c7c047eb05c8637ef02b584d0` sur les deux SHA. Les suites sur la preuve passent **117/117** avec le backend des jeux activé. Le banc a aussi exécuté les trois cas ciblés en chargeant directement le service et les jeux du checkout gelé, avec le seul test et la fixture provenant de la preuve. La fixture est vérifiée jusqu’au tour 5 sur UPST et au tour 16 sur EVAS, y compris les observations du jeu et les hypothèses résolues. [Index du banc](sic-upst-ligne-16/banc.json)

Les reçus SIC historiques validés au gel couvrent UPST (6/6, 72 commandes) et EVAS (6/6, 86 commandes). L’identité complète des sources permet leur réutilisation au niveau du reçu. Les sessions natives nouvelles concernent les préfixes d’inventaire. Le gel reste la référence des 107 jeux. [Campagne historique](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46051058377)

### Reproduire

Depuis le checkout du banc, indiquer un checkout moteur dédié, avec les trois SHA accessibles. Utiliser Node 24.22.3. Les rapports d’inventaire doivent être créés dans un répertoire neuf.

```powershell
$moteur = (Resolve-Path ../sic-banc-ls19).Path
$sortie = (New-Item -ItemType Directory ./rejeu-upst-16).FullName
foreach ($rev in '8ce7ee35','d0e7527c','0540f124') {
  git -C $moteur switch --detach $rev
  if ($LASTEXITCODE) { throw $rev }
  Push-Location $moteur
  node scripts/prepare-python.mjs
  if ($LASTEXITCODE) { throw 'Préparation des jeux' }
  Pop-Location
  node scripts/sic-recapture-strategy-inventory.mjs $moteur "$sortie/inventaire-$rev.json" --offer information_goal point_contrast experiment UPST EVAS
  if ($LASTEXITCODE) { throw 'Inventaire' }
}
$mesures = Get-ChildItem "$sortie/inventaire-*.json" | ForEach-Object {
  ConvertTo-Json (Get-Content $_ -Raw | ConvertFrom-Json).games -Depth 32 -Compress
}
if (@($mesures).Count -ne 3 -or @($mesures | Select-Object -Unique).Count -ne 1) { throw 'Inventaire divergent' }
git -C $moteur diff --exit-code d0e7527c 0540f124 -- src scripts public reference
Push-Location $moteur
$env:SIC_POINT_GAME_ROOT = $moteur
node --test tests/sic-information-points.test.ts tests/v6-point-display.test.ts tests/v6-goal-attention.test.ts tests/v6-control-attention-reference.test.ts
Remove-Item Env:SIC_POINT_GAME_ROOT
Pop-Location
```

Pour l’essai direct sur le gel, extraire avec `git archive 0540f124` le `package.json`, `tests/sic-information-points.test.ts` et `tests/fixtures/sic-point-contrasts-public.json.gz` dans un répertoire temporaire. Y relier les répertoires `src`, `scripts`, `reference` et `public` d’un checkout de `d0e7527c` aux jeux préparés. Définir `SIC_POINT_GAME_ROOT` sur ce checkout et lancer `node --test` sur le test extrait. Les rapports natifs locaux sont sous `artifacts/qualification-upst-0540f124/`. [Trois captures et deux rapports de test](sic-upst-ligne-16/captures.zip)

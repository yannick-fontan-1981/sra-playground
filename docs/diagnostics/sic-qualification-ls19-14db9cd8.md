# LS19 · qualification de la ligne 91 sur branche

**La ligne 91 reproduit le tour 13, sa clôture et le ticket 14 du vrai LS19.** La file a reçu le candidat le 27 novembre 2026 à 18 h 50 min 46 s (UTC−3). Le banc a lancé le préfixe à 18 h 54 min 32 s. Le parcours complet a terminé à 18 h 57 min 59 s. Le candidat `14db9cd82a345752030531e9db37fb7c0ea6df45` descend du contrat `68efddd2d009ace4f4b898cc82c4bb7941e815ae`. Git confirme l’identité de `src`, des lanceurs, des jeux et des références entre ce contrat et son parent ligne 90 `975d9d809ba1cb41dd8c63414586cb95498018b1`. [Qualification du parent](sic-qualification-ls19-975d9d80.md)

### Préfixe de l’inventaire, pack natif par défaut

| Moment | Résultat commun au contrat et au candidat |
|---|---|
| L1 tour 13, après le premier arrêt au tour 12 | Le garde d’indice 0 admet `bound_view_step`. Le service libère un seul `ACTION2` pour la même obstruction. L’empreinte des preuves du tour est `ad344913ece4e2fe1dbc2db47afeb777c933abe2103f17acb115f7eafa39187d`. |
| Retour de la commande 13 | `probe_outcome_observed` avec `matched=null`. La mesure `no_new_area` vaut zéro pixel et cite le besoin, le sous-objectif et la preuve du retour. L’acquisition rattache les arrêts 12 et 13 à la même obstruction et enregistre la répétition. La cause exclusive reste indéterminée. |
| Ticket 14 | Le service passe à `view_continuity / test_local_input` sur un autre besoin et cite le retour du tour 13. Il libère `ACTION3`, également exécutée dans la recapture de 16 commandes. |

La fixture historique a été confrontée aux 14 observations réelles sur les deux SHA. Les quatre recaptures de 16 commandes sur la source d’inventaire, le contrat 90 et les deux candidats concordent sur tous les champs enregistrés. L’inventaire global publie trois commandes de ligne 91. **Une occurrence est reproduite**, LS19 L1 tour 13. Les deux autres restent documentées par le total historique. Les suites locales du candidat passent 37/37. L’opérateur a vérifié six départs construits, 66 contrôles et 12 rejets de reçus altérés. **Ligne 91 qualifiée sur branche** dans ces situations et sur le témoin historique. [Test du moteur](https://github.com/yannick-fontan-1981/sra-playground/blob/14db9cd82a345752030531e9db37fb7c0ea6df45/tests/sic-view-edge-ls19.test.ts) · [Preuve opérateur](https://github.com/yannick-fontan-1981/sra-playground/blob/20cd12136a5d0ae16f271a94e88d49f45709f467/experiments/symbolic-situations/ls19-ligne-91/BILAN.md)

### Parcours qualifié en mode SIC

Le contrôle local de L1 conserve les cinq commandes et les 48 événements. Sur Ubuntu 24.04, la nouvelle capture complète de `14db9cd8` donne **8/8 niveaux, 332 décisions et 2 593 événements**. Son SHA-256 `7ec30f06246a364b6eb92ff978837053652bbe95868478fcaebdacac0d8c3c48` égale celui de la capture complète de `975d9d80` et de son contrat. Les trois reçus concordent avec le reçu du gel. Le jeu complet exerce les deux familles SIC recensées dans la fiche du parent. Les mesures du pack par défaut établissent le passage par les lignes 90 et 91. [Exécution ligne 91](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46073418260) · [Exécution ligne 90](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46072741568)

### Reproduire

Depuis le checkout du banc, fournir dans `$moteur` le chemin d’un checkout dédié propre épinglé au SHA à tester. Utiliser Node 24.22.3. Le fichier de sortie de l’inventaire doit être neuf. Pour comparer les quatre révisions, répéter le bloc de capture pour chaque SHA indiqué dans l’index, puis comparer la propriété `games` des quatre JSON.

```powershell
$banc = (Get-Location).Path
$moteur = (Resolve-Path ../sic-banc-ls19).Path
Push-Location $moteur
git rev-parse HEAD
node scripts/prepare-python.mjs
$env:SIC_LS19_GAME_ROOT = $moteur
node --test --test-name-pattern='LS19 historical edge approach' tests/sic-view-edge-ls19.test.ts
Remove-Item Env:SIC_LS19_GAME_ROOT
Pop-Location
$sha = git -C $moteur rev-parse --short HEAD
node scripts/sic-recapture-strategy-inventory.mjs $moteur "./LS19-$sha.json" LS19
```

Le test nommé existe sur le contrat et les deux candidats. La dernière commande permet également de recapturer la source d’inventaire `8ce7ee35`. Pour le parcours complet, la fonction `capture` du workflow documente la commande exacte, la table de budgets et le contrôle du SHA. Les artefacts locaux sont sous `artifacts/qualification-ls19-975d9d80/` et `artifacts/qualification-ls19-14db9cd8/`. L’archive publiée contient les reçus par révision, les rapports d’inventaire compacts et les comparaisons. Son SHA-256 est `0bdde850bd115f4f0b7d638f2c650baec6a34fa2acc49ceec9f227e61e841868`. [Workflow](../../.github/workflows/sic-ls19-qualified-course.yml) · [Index](sic-ls19-qualifications/banc.json) · [Archive](sic-ls19-qualifications/recus.zip)

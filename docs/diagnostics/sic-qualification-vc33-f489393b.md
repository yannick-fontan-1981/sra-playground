# VC33 · distinguer le premier essai de sa prédiction

**Sur `f489393bb15a1ce775a3904ee97a216d40db026f`, la ligne 3 conserve les 16 décisions nominales du gel et permet de choisir une autre sonde au même état initial.** Les 16 tickets, retours, références et acquisitions de la projection concordent entre le catalogue historique `8ce7ee35`, le gel `d0e7527c` et le candidat. Le contrat `f3361eeb` est le parent Git direct et garde les sources du gel. Le candidat modifie uniquement `v6-band-transfer.ts`. [Index](sic-vc33-f489393b/banc.json) · [Captures et journaux](sic-vc33-f489393b/recus.zip)

| Départ N1 | Premier ticket et retour | Ticket suivant et retour |
|---|---|---|
| Nominal | Avec des bandes [32,12] et deux actionneurs, `band_transfer` clique en (61,25), sans prédiction signée. La mesure [36,8] établit `into_clicked`. | T2 utilise cette preuve, clique en (61,33) pour atteindre [32,12]. La projection est confirmée. |
| Autre sonde admissible, même observation | Sur le candidat, choisir l’indice 1 parmi [0,1] libère (61,33) au T1, sans prédiction. Le jeu donne [28,16]. | T2 garde (61,33) et prédit [24,20] à partir du retour précédent. Le jeu confirme. Le service délivre T3 au même point, indice 1 du préfixe. |

Retirer l’offre ou retourner l’indice 2, hors du domaine, libère une expérience de frontière en (21,36). Après un retour stationnaire construit, le clic en (61,33) reste une sonde sans sens acquis. Effacer le repère fixe après un déplacement conserve le sens appris mais retire l’offre d’alignement. La frontière reprend en (61,25). Les trois contrôles communs passent sur les trois révisions. Les trois contrôles de substitution supplémentaires passent sur le candidat.

Le parcours part de L1, budget de session 16, plafond 600 par niveau, pack par défaut. Le T6 réévalue trois bandes. Au T13, après la seconde frontière, l’axe est vertical et l’unité vaut 2. **Adaptation historique.** Le protocole `8ce7ee35` ne connaît pas le champ optionnel `palette` ajouté au gel. Pour ce seul moteur, le banc a retiré cette clé de la copie des observations et des deux retours alternatifs fournis au test. Les commandes et les pixels proviennent du vrai jeu. Les projections du service concordent avec le gel, y compris pour les deux retours construits. Le chargement initial de la fixture moderne brute est refusé sur cet ancien protocole. L’oracle et le protocole du gel sont conservés. [Fiche du candidat](https://github.com/yannick-fontan-1981/sra-playground/blob/f489393bb15a1ce775a3904ee97a216d40db026f/docs/architecture/sic-vc33-ligne-3.md) · [Verdict opérateur](https://github.com/yannick-fontan-1981/sra-playground/tree/0cca7701/experiments/symbolic-situations)

## Rejouer

Depuis un checkout au SHA de preuve, avec Node 24 et le Pyodide préparé, enregistrer les six sessions du candidat. Pour le gel, utiliser une racine de moteur à `d0e7527c` et sélectionner les trois tests communs avec `--test-name-pattern="VC33 releases the 16|the same second actuator|the measured direction"`.

```powershell
$banc = (Resolve-Path ../sic-comparison-bench).Path
$env:SIC_VC33_GAME_ROOT = $banc
$env:SIC_VC33_ENGINE_ROOT = (Get-Location).Path
$env:SIC_VC33_RECEIPT = Join-Path $env:TEMP ("vc33-" + [guid]::NewGuid() + ".json")
$sonde = ([uri](Join-Path $banc scripts/sic-observe-vc33-bands.mjs)).AbsoluteUri
node --import $sonde --test tests/sic-vc33-line3.test.ts
```

Les traces originales sont dans `artifacts/qualification-vc33-f489393b/`.

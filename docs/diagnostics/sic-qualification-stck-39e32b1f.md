# STCK · trois décisions au cours des treize premiers tours

**52, 57 et 58 sont qualifiées séparément sur `39e32b1f0218d53f41c27b7140c925e8e929e705`.** Le vrai jeu STCK est reparti de L1 sur le gel et le candidat. Les treize commandes et leurs paquets publics concordent avec l’archive v39, jusque dans les images d’animation. Les cinq sessions communes donnent des projections identiques entre moteurs. Le service libère trois tickets alternatifs lorsque l’on retire chacune des trois offres du candidat. [Index](sic-stck-lignes-52-57-58/banc.json) · [Reçus et sorties des suites](sic-stck-lignes-52-57-58/recus.zip)

| Ligne | Occurrences, sélection et retour historiques | Contrôle discriminant |
|---|---|---|
| **52** | **3/3, N1 T1–T3.** `editCollection` retire en (4,50). La collection passe de [14,11,9,10] à [14,11,9]. Le service insère en (46,56) au T2 puis exécute au T3 et atteint L2. | Une image de retour inchangée réfute l’édition et rend la main à `observed_frontier`. Retirer l’offre avant le choix au T1 libère aussi un vrai ticket `observed_frontier / ACTION5`. |
| **57** | **8/8, T4–T11.** Au premier tour de L2, `composeProgram` lie [9] en (16,56). Du T5 au T9, le programme [8,8,14,9,9] est construit et exécuté. Son retour confirme la projection et établit la base (44,21). Le T10 franchit la frontière et le T11 lie à nouveau [9] en L3. | À l’image inchangée du T4, supprimer l’apprentissage du modèle fait choisir `animated_contact` en (33,24). Retirer uniquement l’offre de composition libère le même ticket. |
| **58** | **2/2, N3 T12–T13.** `probeRespondents` insère en (36,56) puis envoie `ACTION5`. Dans le retour de 26 images, [11,9] bouge dès l’indice 2 et [11,8] dès 12. Le reçu d’ordre relie [11,8] à 12 puis le répondant [10,8,8] à 23. Le moteur conserve l’édition, laisse la règle universelle ouverte et propose `containment / ACTION5` au T14. | Avec la seule image finale, [11,8] subsiste à l’indice 0, [11,9] n’a aucun indice concordant et aucun ordre n’est émis. Le service s’arrête avant T14. Retirer l’offre initiale au T12 libère `containment / ACTION5`. |

Le contrôle de renommage 9↔11 réutilise les paquets publics recolorés. Les replis sont vérifiés jusqu’à l’autorisation du ticket. Leurs conséquences physiques ne sont pas mesurées dans ces trois interventions. Les événements acquis sont identifiés par leur type et la référence exacte de l’observation de retour. La remise en mémoire d’un événement déjà acquis peut le faire réapparaître dans le journal brut.

Le candidat descend directement de `7933c34a09d7c60f4a6d429105c236bc802773f1`. Ce parent de caractérisation et le gel `d0e7527ca8033bd805a6d7a8bb021eff62e87021` ont le même arbre `src`. Le candidat change `v6-program-composition-access.ts` et `v6-shared-series.ts`. Le banc a exécuté les cinq tests de caractérisation sur les sources du gel, les huit tests ciblés du candidat et les 228 tests d’intégration et de parité sur chacun. Total **233/233 sur le gel et 236/236 sur le candidat**. [Contrat et périmètre](https://github.com/yannick-fontan-1981/sra-playground/blob/39e32b1f0218d53f41c27b7140c925e8e929e705/docs/architecture/sic-stck-lignes-52-57-58.md)

## Rejouer

Utiliser Node 24.22.3 et le Pyodide local préparé du banc. Exécuter le bloc depuis un checkout propre de `7933c34a`, puis de `39e32b1f`, en adaptant le chemin du banc. Le premier checkout fournit les tests de caractérisation et les mêmes sources moteur que le gel. Le budget de session vaut 16, l’objectif 6 niveaux et le plafond 600 gestes par niveau. Le backend utilise le départ catalogue standard sans graine explicite.

```powershell
$banc = (Resolve-Path ../sic-comparison-bench).Path
$env:SIC_STCK_GAME_ROOT = $banc
$env:SIC_STCK_SOURCE = (Get-Location).Path
$env:SIC_STCK_RECEIPT = Join-Path $env:TEMP ("stck-" + (git rev-parse --short HEAD) + "-" + [guid]::NewGuid() + ".json")
$sonde = ([uri](Join-Path $banc scripts/sic-observe-stck-offers.mjs)).AbsoluteUri
node --import $sonde tests/sic-stck-program-lines.test.ts
node --test --test-concurrency=1 tests/v6-program-composition-integration.test.ts tests/v6-program-composition-parity.test.ts
```

Les sorties locales du banc sont conservées dans `artifacts/qualification-stck-39e32b1f/`. Le parcours mesuré atteint le ticket T14 de L3.

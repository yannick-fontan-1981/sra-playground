# Banc DC22 · enfant de fermeture d'appui sur fb8d6913

`fb8d6913addd23f5dd1cc375f96f9a69b2410b21` a pour parent direct `89c10c79`, qui fige les critères sur l'arbre moteur de `b0574d0d`. L'arbre candidat `c6be00220e0691619413e9244101f9c6a302c144` change six chemins moteur, dont l'ajout de `phase-cycle-child.ts`. Les deux blobs du départage AS66, les actifs de jeu et le lanceur chronologique sont repris à l'identique. [Fiche du candidat](https://github.com/yannick-fontan-1981/sra-playground/blob/fb8d6913addd23f5dd1cc375f96f9a69b2410b21/docs/diagnostics/sic-dc22-phase-child.md)

Le contrôle porte sur DC22 de N1 à la fin de N4, mode SIC, un travailleur et plafonds historiques. L'observateur active `phaseCycleNeeds` dans ce seul processus. Les deux bras du Banc sont le nominal et le remplacement ciblé de la paire de fermeture par celle du vrai retour T13. La campagne des 107 reste rattachée à `703cd1c3`. [Reçu historique](sic-coexistence-703cd1c3.md#campagne-historique)

## Verdict indépendant

Les **187 commandes et effets ordonnés**, les quatre empreintes de trajectoire et les budgets concordent avec le préfixe DC22 de `703cd1c3`. Les quatre empreintes concordent aussi avec le reçu publié de `fb8d6913`. Les 25 tests ciblés du Banc passent. [Reçu publié](https://github.com/yannick-fontan-1981/sra-playground/blob/fb8d6913addd23f5dd1cc375f96f9a69b2410b21/docs/diagnostics/sic-dc22-phase-child-receipt.json)

| Point observé | Reçu natif |
|---|---|
| **N4/T1**, commande globale 112 | L'enfant de mesure est ouvert à l'autorisation d'ACTION6 (46,28), avec un budget de 12. Le premier retour le laisse assigné. Le premier écart nominal porte sur le besoin et son état de preuve, avec le même geste historique. |
| **N4/T14** | Le retour `support_phase_measured` satisfait l'enfant du deuxième contrôle avec la paire native r125 → r126. |
| **N4/T15** | Le parent exige les deux fermetures acquises. La dernière porte exactement la référence de vue r126. Le service autorise ACTION2 et le retour confirme l'atterrissage. |
| **N4/T15**, preuve périmée | Les 125 premières commandes et leurs effets concordent. Sur la même vue r126, la paire r124 → r125 du vrai T13, pour le même contrôle encore assigné, remplace uniquement les références de fermeture. Le fournisseur propose le même ACTION2. La garde `phase_cycle_prerequisite_unattested` interdit son ticket. Le bras s'arrête à 125 commandes autorisées avec `no_admissible_prefix`. |

Le contrôle démontre la nécessité de la provenance exacte de la fermeture pour le ticket de reprise testé. Il complète la contre-épreuve sur l'ancienne représentation, où rouvrir le fait `closed` suffisait à déclencher une autre mesure. La cible du rejeu est la fin de N4. [Contre-épreuve antérieure et portée historique](sic-coexistence-703cd1c3.md)

## Rejouer les deux bras

Utiliser Node 24.22.3 et Python 3.11. `$banc` et `$moteur` désignent les chemins absolus des checkouts du Banc et de `fb8d6913`. `$out` est le chemin absolu d'un dossier neuf, par exemple sous `artifacts/`. Les reçus détaillés restent locaux.

```powershell
New-Item -ItemType Directory -Path $out | Out-Null
Push-Location $moteur
node scripts/prepare-python.mjs
$env:SIC_REPLAY_REFERENCES = 'docs/architecture/sic-replay-reference-levels-20261126.json'
foreach ($bras in 'active','stale') {
  $env:SIC_DC22_PHASE_ARM = $bras
  $env:SIC_DC22_PHASE_TRACE = Join-Path $out "$bras-phase.jsonl"
  node --import ./scripts/observe-sic-dc22-phase-child.mjs scripts/check-sic-chronological.mjs DC22 4 (Join-Path $out "$bras.jsonl") 1 sic
  if ($LASTEXITCODE) { throw "Échec du rejeu $bras" }
}
node --test tests/sic-phase-cycle-child.test.ts tests/sic-p05-typed-child.test.ts tests/sic-p05-agenda-shadow.test.ts tests/sic-p05-cavity-tiebreak.test.ts tests/sic-paired-passage-continuity.test.ts
Pop-Location
py -3.11 (Join-Path $banc 'scripts/check-sic-dc22-phase-pair.py') $out
```

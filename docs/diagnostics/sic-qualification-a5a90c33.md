# Qualification du déplacement axial · a5a90c33

Le candidat `a5a90c3349ea49bba8e40055444cea2026bee962` est l’enfant direct de `3c2d6bcfd4a7d7abf28650e2f8ffed3d3510c3b4`. La [qualification du parent](sic-qualification-3c2d6bcf.md) relie ses 107 reçus au gel `d0e7527ca8033bd805a6d7a8bb021eff62e87021`. Le diff de production de l’enfant touche trois fichiers. Il extrait `singleStepDisplacement` dans `observed-translation.ts` et l’appelle dans les deux méthodes `record` étudiées. [Contrat de l’extraction](https://github.com/yannick-fontan-1981/sra-playground/blob/a5a90c3349ea49bba8e40055444cea2026bee962/docs/architecture/sic-candidat-deplacement-axial.md)

## Deux consommateurs observés

Chaque paire repart du niveau 1 sur le même runner Ubuntu 24.04, avec deux processus indépendants, Node 24.22.3, mode `sic`, cible `auto`, graine 0, un worker et les plafonds du gel. Le comparateur a lu les deux traces entières dans l’ordre. Les reçus du parent et de l’enfant reproduisent aussi chacun le reçu archivé du parent. G50T et FOGW figurent tous deux dans le catalogue des 107. [Run des témoins](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46069878515)

| Jeu | Niveaux | Commandes par niveau sur les deux SHA | Événements | Premier écart |
|---|---:|---|---:|---|
| G50T | 7/7 | 27, 32, 65, 32, 51, 50, 44 | 3 004 | Aucun |
| FOGW | 6/6 | 18, 7, 18, 29, 38, 63 | 1 623 | Aucun |

Un second rejeu de L1, pour chaque jeu et chaque SHA, mesure le résultat réellement accepté dans la branche du parent puis le résultat rendu par le nouvel appel chez l’enfant. Les préfixes d’actions et de retours publics jusqu’à la victoire L1 ont la même empreinte que les parcours complets correspondants. Le SHA-256 de toute la suite ordonnée des mesures L1 coïncide entre parent et enfant. Les compteurs incluent les mesures refusées. [Sonde des deux sites](../../scripts/sic-displacement-call-witness.mjs)

| Jeu et site `record` | Passage P05 → P07 en L1 | Mesure sur le retour de P05 | Nombre de passages au site en L1, parent / enfant |
|---|---|---|---:|
| G50T · `replay-access.ts` | Tours 5 → 6, événements 46 → 56, `ACTION4` | (14, 8) → (20, 8), pas 6, résultat [6, 0], observation r6 `bd5da91d68f0d73d` | 25 / 25 |
| FOGW · `reception-access.ts` | Tours 3 → 4, événements 26 → 36, `ACTION4` | (30, 42) → (34, 42), pas 4, résultat [4, 0], observation r4 `2ef366caf5b05817` | 15 / 15 |

Dans chacun des deux jeux, le compteur de l’autre site vaut zéro en L1. G50T reproduit également l’empreinte de décision publiée lors du lot P05 pour le parent. Pour FOGW, le lot P05 avait livré le reçu historique. Les deux traces détaillées FOGW ont été capturées dans ce lot. Les 48 tests de géométrie, de caractérisation des familles et de continuité indiqués dans le contrat ont été rejoués sur l’enfant et passent.

## Reproduire une paire native

Depuis le banc, fournir deux checkouts propres aux SHA parent et enfant et Node 24.22.3. Pour chaque jeu, utiliser un dossier neuf. La commande `record` capture le parcours entier ordinaire puis le L1 avec la sonde pour G50T et FOGW. Le sous-ordre `compare` contrôle aussi le reçu archivé du parent.

```powershell
$jeu = 'FOGW'
$sortie = "artifacts/reprise-$jeu-$([guid]::NewGuid())"
py scripts/sic-compare-displacement-revisions.py record $jeu $sortie --checkout ../sic-cartographie-p05 --label A
py scripts/sic-compare-displacement-revisions.py record $jeu $sortie --checkout ../sic-banc-deplacement --label B
py scripts/sic-compare-displacement-revisions.py compare $jeu $sortie
```

Le [workflow des paires](../../.github/workflows/sic-axial-decision-pairs.yml) effectue le même travail. Les grands journaux restent dans le système de fichiers du runner. Les artefacts transmis contiennent les reçus compacts, les points de mesure et le verdict du comparateur.
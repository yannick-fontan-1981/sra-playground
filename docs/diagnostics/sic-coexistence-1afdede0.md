# Six lignes SIC dans un même moteur

**Les lignes 15, 16, 23, 87, 90 et 91 coexistent sur `1afdede0dcdd4a5bb2c7b284b1ead20e1782fe0d`.** Leurs témoins ciblés passent sur cet assemblage. Une nouvelle campagne depuis L1 a terminé les 107 jeux et les 692 niveaux du gel. Les 18 560 décisions autorisées ont produit les mêmes effets enregistrés par les reçus historiques. [Index par jeu](sic-coexistence-1afdede0/qualification.json) · [Exécution GitHub](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46078331187)

## Filiation vérifiée

La branche `experiment/sic-coexistence-premier-lot` part directement de `d0e7527ca8033bd805a6d7a8bb021eff62e87021`. Son arbre `src` vaut `f9a8f1a1609e508024dcd7850d702bafd7f6c457`. Le diff complet contient onze fichiers. L’audit vérifie que chacun a exactement le blob de sa source et que la réunion couvre tout le diff.

| Source | Composants retenus | Portée |
|---|---|---|
| `3c2d6bcf`, puis son enfant direct `a5a90c33` | `control-effect-next`, `missing-control-strategy`, `paired-passage`, puis `observed-translation`, `reception-access`, `replay-access` | Les six fichiers viennent de la pointe vectorielle. La qualification P05 y est déjà incluse. |
| `975d9d80`, puis `14db9cd8` via son contrat `68efddd2` | `v6-view-frontier`, `view-edge-access`, `view-obstruction-trial` | Les lignes LS19 90 et 91 modifient successivement le même appelant. Sa version finale est intégrée une fois. |
| `c0b9f402` après le contrat `5446e42e` | `v6-subset-diagnosis`, `subset-query` | Ligne 87 et son fournisseur d’offres. |
| Gel, preuves `7bf3c85a`, `0540f124`, `ba04161f` | Afficheurs couplés (15), point discriminant (16), essai local (23) | Les comportements sont déjà dans le moteur gelé. Les preuves et les harnais sont chargés pour les tests. |

Les trois groupes de fichiers importés sont disjoints. Les bancs de branche, les fixtures et les contrats TypeScript à émission identique sont restés dans leurs branches. Les preuves particulières à ZIPP/1, G50T/18, AS66/83, SK48/96 et DICO/98 gardent leur attribution propre.

## Témoins et campagne

Sur le moteur assemblé, TypeScript passe avec `--noEmit`. Les 14 suites ciblées passent **183/183**. Elles incluent les retours LS19, les deux jeux LOGI/REWI et UPST/EVAS, la qualification P05 et le déplacement mesuré. Le harnais G50T/23 reproduit l’empreinte du témoin de développement. DICO/87 reproduit le parcours catalogue, le contrôle curiosité et le ticket de l’autre optimum. Sept parcours SIC séparés ont gagné L1 avec les mêmes budgets, empreintes de préfixe et effets que le gel. LS19 a délivré 5 commandes, LOGI 2, REWI 3, UPST 19, EVAS 3, DICO 5 et G50T 27. [Reçus et rapports ciblés](sic-coexistence-1afdede0/temoins.zip)

La CI a chargé le moteur par son SHA d’assemblage. Son propre commit `6809696babea4369574761ff449758f43bf4e79d` ajoute uniquement le lanceur. Le 27 novembre 2026, elle s’est déroulée de 22:43:16 à 22:54:42 UTC, avec 24 groupes et au plus 20 actifs. Chaque groupe exécute ses jeux en série. Les 107 codes sont uniques. Les 692 niveaux ont respecté les budgets historiques, avec deux resets et zéro undo. Le réimport local a successivement traité 3 nouveaux jeux, 104 nouveaux et 3 déjà vérifiés, puis 107 déjà vérifiés. Chaque reprise a contrôlé l’identité du SHA, du protocole et des reçus. [Horaires des groupes](sic-coexistence-1afdede0/horaires.json) · [50 pièces originales de CI](sic-coexistence-1afdede0/recus.zip)

L’audit compare par tour les effets enregistrés, dont action, coordonnées, changement visible, stratégie, famille et nombre de preuves. Par niveau il vérifie la victoire, le budget, le nombre de commandes et l’empreinte. Il compare aussi séries de plans, types de trajets, transitions, reprises et arrêts. Les médianes en millisecondes entre émissions dépendent de l’hôte. Les durées et les plafonds demeurent disponibles dans les reçus et le contrôle des budgets. Une justification détaillée ou un identifiant individuel de preuve exige une paire de traces de décision. La campagne de 107 établit la concordance à la granularité de ses reçus.

## Reproduire

Depuis le banc, récupérer les branches d’assemblage, du workflow et des candidats d’origine. Utiliser Node 24.22.3 et les jeux préparés pour les tests natifs. Le premier appel vérifie l’archive hors ligne. Le deuxième demande le checkout d’assemblage et un dossier de sortie neuf.

```powershell
git fetch origin
py scripts/check-sic-coexistence.py docs/diagnostics/sic-coexistence-1afdede0/recus.zip --workflow 6809696babea4369574761ff449758f43bf4e79d --run 46078331187
py scripts/test-sic-coexistence.py ../sic-banc-deplacement ./rejeu-six-lignes --node node
```

Pour exercer la reprise à partir de l’archive publiée, employer le même répertoire d’état aux trois appels. Les traces locales des sept L1 sont dans `artifacts/qualification-coexistence-1afdede0/L1/`.

```powershell
py -m zipfile -e docs/diagnostics/sic-coexistence-1afdede0/recus.zip ./rejeu-107-recettes
foreach ($g in 'initial','all','all') {
  py scripts/sic-qualification-progressive.py import-ci --candidate 1afdede0dcdd4a5bb2c7b284b1ead20e1782fe0d --workflow 6809696babea4369574761ff449758f43bf4e79d --run-id 46078331187 --download ./rejeu-107-recettes --state ./rejeu-107-etat --games $g
  if ($LASTEXITCODE) { throw $g }
}
```

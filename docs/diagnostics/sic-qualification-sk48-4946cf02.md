# SK48 · accès à la ligne 96 après calibrage

**Sur `4946cf0297734b9464fc52256af6fb27846f3bad`, les dix départs d’origine atteignent le retour discriminant du T12.** Six autorisent une reprise confirmée par le jeu et quatre refusent correctement de reprendre après le retour contraire. Au parent `08fa10a6b9986e7028551fbfc9d9e16eb83726b7`, six atteignaient ce point et quatre s’arrêtaient en amont. Le banc a reproduit les trois empreintes des groupes d’origine, puis joué deux départs supplémentaires en 8↔13. [Verdict antérieur](sic-qualification-sk48-08fa10a6.md) · [Index des départs](sic-sk48-amont-4946cf02/banc.json) · [Fiches, tickets, retours et preuves géométriques](sic-sk48-amont-4946cf02/recus.zip)

| Départ depuis L1 | Parent | Correctif |
|---|---|---|
| 2 historiques, plafond 24 | Deux reprises, L1 terminé aux T19 et T21 selon la priorité. | Mêmes résultats et même empreinte des reçus du groupe. |
| 4 de développement, 9↔14, plafond 13 | Quatre arrêts avant le ticket T5. | T5 `ACTION1` admise après quatre retours identiques. Deux reprises au T13 avec prédiction physique exacte. Deux refus après le retour contraire du T12. Dans le prolongement distinct, les deux parcours positifs terminent L1 aux T19 et T21. |
| 4 de réserve opérateur, 8↔14, plafond 13 | Deux reprises au T13 et deux refus avant ce ticket. | Mêmes retours et même empreinte de groupe `f10926709aa9b59fd421b5b741e9402d7b85b5d69b5f0a4543b8694ab0bfa875`. Les quatre fiches ont été confrontées aux fichiers Git publics. |
| 2 supplémentaires du banc, 8↔13, plafond 24 | L1 terminé en 19 et 21 gestes. | Mêmes tickets et retours dans la projection scellée, y compris la concordance géométrique du T13. Empreinte de groupe `5667aecba3050407242d2d9b228100afd2ed0630cf36bb57a411d99b4ddf3b23`. |

**Premier écart en 9↔14.** Le premier ticket du parcours reste `ACTION1` sur les deux moteurs. Les quatre commandes de calibrage et leurs retours sont identiques. Au choix T5, le parent atteint 1 000 états explorés et rend `frontier_unknown`. Le candidat examine 282 états et autorise `ACTION1` pour éprouver un ordre compatible. Le reçu garde `compatible_unordered`. Dans la géométrie nominale, la station 20 contient 8 et la station 26 contient 9 et 14 à égalité. Le moteur conserve les deux ordres internes possibles, rejette une inversion entre stations et maintient `rooted_match=false` et `predicted_rooted_match=false` pour l’égalité. Le renommage opaque et le support insuffisant ont aussi été éprouvés. Sur les parcours historiquement accessibles, la sonde du planificateur distingue l’ancienne justification du T5 de cette nouvelle hypothèse, même quand les tickets et leurs retours coïncident.

**Retour et reprise.** Le vrai déplacement T12 réfute la géométrie distale prévue. Au T13, `revise_rooted_contact` choisit `ACTION3` et déplace la pointe de 46 à 40. `reposition_root_before_contact` choisit `ACTION1`. Pour chacune des reprises, la géométrie retournée égale la prévision. Si le retour T12 est remplacé dans la seule zone prescrite, le service suspend avant T13. Les plafonds 13 et 24 figurent dans chaque fiche. La progression mesurée avec un plafond de 13 s’arrête à la reprise. Le bilan de fin de L1 provient des départs effectivement prolongés.

## Rejouer

Depuis le banc, avec Node 24.22.3 et un checkout propre de `4946cf02` préparé avec Pyodide, choisir un dossier de sortie neuf. Le lanceur extrait le moteur du parent depuis Git et utilise la même version du service opérateur sur les deux SHA. Il contrôle l’empreinte complète de chaque groupe parent d’origine. Ajouter `--verify` en fin de commande pour contrôler à nouveau les fiches, les empreintes et les retours déjà produits. Les dix départs d’origine proviennent du protocole `5804fc7d`. Les cartes publiques de réserve sont celles du commit `366f84d027f9d91d06b322aa94260ba7324283c5` dans le dépôt de l’opérateur.

```powershell
$moteur = (Resolve-Path ../sic-sk48-projection-initiale).Path  # checkout préparé au SHA ci-dessus
foreach ($groupe in 'historique','developpement','reserve','independant') {
  foreach ($version in 'parent','enfant') {
    node scripts/sic-compare-sk48-cohort.mjs $moteur ./rejeu-sk48 $groupe $version
    if ($LASTEXITCODE) { throw "Échec $groupe $version" }
  }
}
Push-Location $moteur
node --test tests/sic-rooted-station-order.test.ts
node experiments/sic-agenda-offres/projection-initiale/verifier.mjs --pyodide ./public/vendor/pyodide --recu ./qualification-sk48.json
Pop-Location
```

Les trois tests d’ordre passent. Les sorties originales du banc se trouvent dans `artifacts/qualification-sk48-4946cf02/`. Le périmètre comprend les dix départs de L1, deux départs supplémentaires et les prolongements indiqués. La ligne 96 reste qualifiée sur son SHA propre, hors de l’assemblage commun.

# SK48/96 · résultat du correctif amont

**Les dix départs initiaux atteignent la contradiction T12 sur `4946cf02`.** Sur le gel `d0e7527c` et le parent `08fa10a6`, 6/10 l’atteignaient. Les quatre autres s’arrêtaient après le quatrième geste de calibrage. [Protocole opérateur](CONTRAT.md) · [Verdict initial](../sk48-ligne-96/BILAN.md) · [Reçu](recu.json)

| Groupe | T12 sur le candidat | Reprises physiques confirmées / attendues | Abstentions justifiées / attendues |
|---|---:|---:|---:|
| Historiques | 2/2 | 2/2 | — |
| Développement initial 9↔14 | 4/4 | 2/2 | 2/2 |
| Réserve initiale 8↔14 | 4/4 | 2/2 | 2/2 |
| **Dix départs initiaux** | **10/10** | **6/6** | **4/4** |
| Nouvelle permutation opérateur 9↔13, enregistrée à `1b95f5c2` | 4/4 | 2/2 | 2/2 |
| Contrôle distinct du Banc 8↔13 | 2/2 | 2/2 | — |

**Premier écart.** Sous 9↔14, les quatre tickets et retours du calibrage sont identiques avant et après correction. Au T5 le candidat émet ACTION1 sous `conditional_composition`. La première pièce précède deux pièces à la même station. Leur ordre reste inconnu et les indicateurs d’ordre projeté confirmé et d’ordre observé sont tous deux faux. Sur la permutation opérateur, l’énumération des six ordres pour les stations 20, 26, 26 admet les deux ordres des ex æquo. Le mesureur natif écarte les quatre inversions de stations distinctes.

**Retour et choix.** T12 contredit la projection de deux pièces sur trois. Le support, la pointe et une pièce occupent les positions prévues. Avec un mouvement conjoint attesté, les deux priorités donnent ACTION3 (rétraction de six pixels) ou ACTION1 (remontée du support de six pixels). Les positions effectivement renvoyées au T13 concordent avec les deux projections et avec les mesures indépendantes du jeu. L’échange des identités distales au seul retour T12 enlève le témoin. Chaque priorité s’abstient alors au T13.

**Comparaison aux anciens témoins.** Les deux parcours historiques et les quatre départs réservés conservent les 90 tickets qu’ils libéraient déjà, y compris identités, besoins, gardes, projections et retours. Les 16 tickets de calibrage des quatre anciens échecs concordent également. Le gel donnait 4 reprises confirmées et 2 abstentions sur les 6 départs accessibles. Les parcours historiques terminent L1 en 19 et 21 gestes. Les fiches plafonnées à 13 gestes mesurent la reprise locale.

**Recoupement du Banc.** Les deux fiches publiques 8↔13 du Banc ont été rejouées séparément sur le parent et le correctif. Leur empreinte de groupe sur le parent est `5667aecba3050407242d2d9b228100afd2ed0630cf36bb57a411d99b4ddf3b23`. Les 40 tickets et leurs retours concordent sur les deux moteurs, L1 se termine en 19 et 21 gestes. [Reçu du Banc](https://github.com/yannick-fontan-1981/sra-playground/blob/b776fe1b/docs/diagnostics/sic-qualification-sk48-4946cf02.md)

### Fiches publiques et rejeu

Les quatre fiches de la réserve d’origine sont [directe](rejeux-publics/direct.json), [repositionnement](rejeux-publics/reposition.json), [retour contraire](rejeux-publics/contraire.json) et [retour contraire avec repositionnement](rejeux-publics/contraire-reposition.json). Elles reproduisent sur le parent l’empreinte publiée à `5804fc7d`, `f10926709aa9b59fd421b5b741e9402d7b85b5d69b5f0a4543b8694ab0bfa875`.

Depuis ce dossier, avec Node 24, les commits du parent et du candidat disponibles dans Git, un répertoire de sortie neuf `$reçus` et le chemin absolu de Pyodide dans `$pyodide` :

```powershell
node ../sk48-ligne-96/jeu.mjs $pyodide "$reçus/pixels.json"
foreach ($groupe in @('historique','développement','réserve','nouvelle','banc','banc-parent','stations')) {
  node qualifier.mjs $groupe "$reçus/$groupe.json" $pyodide
}
node verifier.mjs $reçus "$reçus/pixels.json"
```

Le vérificateur accepte en troisième argument l’archive opérateur initiale pour recalculer les empreintes du gel et du parent. `temoins.json` contient les empreintes compactes des cartes et des préfixes calculées à partir de ces deux archives.

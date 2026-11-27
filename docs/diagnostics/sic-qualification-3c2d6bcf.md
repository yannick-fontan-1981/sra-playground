# Qualification de P05 au commit 3c2d6bcf

**107/107 jeux concordants au niveau des reçus historiques**, avec 692 niveaux gagnés et réconciliés et 18 560 commandes autorisées. **5 jeux** disposent aussi de traces A/B détaillées, qui coïncident sur 1 286 décisions et 11 907 événements. Les 102 autres jeux sont qualifiés à la précision du reçu. [Verdicts et empreintes par jeu](sic-qualification-3c2d6bcf/qualification.json)

Le banc `a5e02030515890360aeb57bc0ef841236ca1cb51` compare le candidat `3c2d6bcfd4a7d7abf28650e2f8ffed3d3510c3b4` au gel `d0e7527ca8033bd805a6d7a8bb021eff62e87021`. Les captures locales partent du niveau 1, en mode `sic`, cible `auto`, graine 0, un worker, Node v24.22.3. Le [catalogue des 107 jeux](sic-qualification-progressive-107.json) donne les plafonds par niveau. Les références du gel ont pour SHA-256 `67ae5216b80e87bbb2243138fde7970ea5c725a5f832f1b72aa8b0780e270854`.

## Ce que montrent les décisions

| Jeu | Niveaux | Décisions | Événements A/B | Premier écart |
|---|---:|---:|---:|---|
| AS66 | 9/9 | 161 | 1 613 | Aucun |
| G50T | 7/7 | 301 | 3 004 | Aucun |
| HOLE | 6/6 | 78 | 784 | Aucun |
| PORT | 6/6 | 116 | 844 | Aucun |
| DC22 | 6/6 | 630 | 5 662 | Aucun |

Les trois premières paires réutilisent les captures de la [cohorte initiale](sic-comparaison-decisions.md) et celles du candidat. Les empreintes SHA-256 des fichiers A et B coïncident pour chaque jeu. Pour PORT et DC22, le banc capture d’abord le gel, puis le candidat, sur le même hôte et en série. Il confronte aussi chaque reçu local à celui du gel.

### PORT

| Niveau, tour | Événement | Stratégie | Commande | Premier point de route | Interrupteur visé |
|---|---:|---|---|---|---|
| L4, tour 6 | 448 | P07 | ACTION4 | (11, 11) | (43, 23) |
| L4, tour 7 | 458 | P05 | ACTION4 | (43, 23) | (43, 23) |
| L6, tour 6 | 732 | P05 | ACTION4 | (35, 15) | (35, 15) |

Les coordonnées du tableau viennent de la route préparée. Les trois commandes ont `data: {}`. L’offre `sic_paired_passage` expose `proposal.sicLocalDecision.strategy`. Au premier tour de l’extrait, l’agent cherche l’accès à l’interrupteur. Au tour suivant, il essaie la même commande au contact. Les deux dernières lignes satisfont exactement la garde `route.steps[0].point == route.switchTest`. Sur le candidat, cette garde appelle `qualifyControlTrial` avant la sélection de l’offre. Le parcours contient sept décisions étiquetées P05, dont deux à ce contact. A et B ont gagné en 16, 18, 26, 19, 19 et 18 commandes. [Site d’appel du candidat](https://github.com/yannick-fontan-1981/sra-playground/blob/3c2d6bcfd4a7d7abf28650e2f8ffed3d3510c3b4/src/sic/paired-passage.ts#L419-L439)

### DC22

Les deux exécutions gagnent en 22, 44, 45, 76, 185 et 258 commandes. Sur les 630 décisions, 168 portent l’étiquette P05. Aucun événement ne porte le témoin natif `missingControl` et aucune décision ne satisfait le contact de la famille appariée. Les 5 662 événements ont la même empreinte dans A et B. Les deux reçus reproduisent aussi les effets et les préfixes archivés du gel.

En L1, tour 1, l’événement 6 sélectionne `sic_remote_support_route`, stratégie `test_supported_translation`, commande `ACTION1`. La caractérisation historique d’un essai de commande dans DC22 porte sur une autre preuve. Les champs natifs permettent de reconnaître un essai retenu et, lorsqu’il est publié, le témoin `sic_native_plan.missingControl`. Une simple étiquette P05 ne permet pas d’attribuer cet essai à `evaluateMissingControl`.

Dans les deux versions, le registre du solveur `sic` retourne avant l’enregistrement de `SlidingCavity` et de `LinkedTemporalPreparation`. Il omet aussi `callerStrategy`, qui conditionne la création de `NativeCallerCoordinator`. Ces trois chemins sont les seuls producteurs qui appellent `bindMissingControlTrial` dans `src`. Cette fonction est l’unique appelant de production d’`evaluateMissingControl`. L’absence de ce chemin dans le registre éclaire aussi le cas des offres refusées, dont la trace native peut omettre le détail. [Registre SIC](https://github.com/yannick-fontan-1981/sra-playground/blob/3c2d6bcfd4a7d7abf28650e2f8ffed3d3510c3b4/src/logos-engine/v6-native-runtime.ts#L2907-L2943) · [Construction du coordinateur](https://github.com/yannick-fontan-1981/sra-playground/blob/3c2d6bcfd4a7d7abf28650e2f8ffed3d3510c3b4/src/logos-engine/v6-native-runtime.ts#L613-L620) · [Appel de qualification](https://github.com/yannick-fontan-1981/sra-playground/blob/3c2d6bcfd4a7d7abf28650e2f8ffed3d3510c3b4/src/sic/missing-control-strategy.ts#L38-L50)

## Relecture des captures locales

Le lecteur de témoins a été corrigé en `39f26749` pour lire la géométrie de l’interrupteur après identification de la famille appariée. Dans 85 décisions de DC22, `sic_remote_support_route` fournit une route sous forme de liste. La capture A était complète au moment de l’erreur de lecture. Le contrôle a repris sur les mêmes octets. La capture, le moteur et le comparateur de décisions sont ceux de l’essai initial.

Depuis le checkout du banc, les traces initiales A se trouvent dans `artifacts/sic-comparison/run-VVq4CG` et les B dans `artifacts/sic-comparison/candidat-3c2d6bcf-c2687ba5-b120-4bf1-98ac-fe8ff5c611bb`. Pour PORT et DC22, `artifacts/qualification-3c2d6bcf-appelants-live/<jeu>/` contient `A.jsonl`, `B.jsonl`, les reçus `A.receipt` et `B.receipt`, les commandes exactes `{A,B}.source.json` et le verdict et les empreintes des fichiers dans `result.json`. Les positions d’événements commencent à 1. La [fiche de préparation](sic-qualification-progressive-107.md) donne les commandes pour refaire les captures depuis deux checkouts propres.

```powershell
$local = 'artifacts/qualification-3c2d6bcf-appelants-live'
foreach ($jeu in 'PORT','DC22') {
  node scripts/compare-sic-decisions.mjs "$local/$jeu/A.jsonl" "$local/$jeu/B.jsonl"
}
```

### Compter les appels dans un rejeu complémentaire

Le [compteur](../../scripts/sic-p05-call-counts.mjs) charge trois points de mesure en mémoire sur le candidat. Il compte les entrées dans le qualificateur et le passage à chacun des deux sites, avant que la famille puisse refuser l’offre. Son fichier de sortie énumère aussi les trois modules effectivement chargés. Les deux traces de qualification A et B ci-dessus sont les captures ordinaires sans compteur.

| Rejeu candidat | Niveaux gagnés et réconciliés | Site `switchContact` | Site `evaluateMissingControl` | Entrées dans `qualifyControlTrial` |
|---|---:|---:|---:|---:|
| PORT | 6/6 | 2 | 0 | 2 |
| DC22 | 6/6 | 0 | 0 | 0 |

Les deux reçus avec compteurs reproduisent les effets et les empreintes de trajectoire des reçus historiques. Les trois modules sont chargés dans chaque jeu. Le zéro de DC22 porte donc aussi sur les offres que le moteur aurait pu refuser. Une tentative préalable de couverture V8 globale sur PORT s’était arrêtée au plafond mural de L6 après 111 commandes et cinq niveaux gagnés. Son reçu local `PORT/coverage.receipt` est conservé séparément. Les chiffres du tableau proviennent des deux rejeux complets avec les compteurs ciblés.

Pour reproduire la mesure depuis le banc, utiliser Node v24.22.3 et un checkout propre du SHA candidat. Chaque invocation réserve un dossier neuf. Le lanceur conserve les plafonds du gel.

```powershell
$banc = (Get-Location).Path
$candidat = (Resolve-Path ../sic-cartographie-p05).Path
if ((git -C $candidat rev-parse HEAD) -ne '3c2d6bcfd4a7d7abf28650e2f8ffed3d3510c3b4') { throw 'SHA candidat inattendu' }
$sortie = New-Item -ItemType Directory (Join-Path $banc "artifacts/compteurs-$([guid]::NewGuid())")
$avant = $env:SIC_P05_COUNTS,$env:NODE_OPTIONS,$env:SIC_REPLAY_REFERENCES
Push-Location $candidat
try {
  node scripts/prepare-python.mjs
  if ($LASTEXITCODE) { throw 'Préparation Python interrompue' }
  $env:SIC_REPLAY_REFERENCES = "$banc/docs/architecture/sic-replay-reference-levels-20261126.json"
  $env:NODE_OPTIONS = '--import=' + ([uri](Join-Path $banc 'scripts/sic-p05-call-counts.mjs')).AbsoluteUri
  foreach ($jeu in 'PORT','DC22') {
    $env:SIC_P05_COUNTS = "$sortie/$jeu.json"
    node scripts/check-sic-chronological.mjs $jeu auto "$sortie/$jeu.receipt" 1 sic
    if ($LASTEXITCODE) { throw "Rejeu interrompu pour $jeu" }
    $recu = Get-Content "$sortie/$jeu.receipt" -Raw | ConvertFrom-Json
    if ($recu.reason -ne 'target_levels_completed' -or $recu.levels -ne 6) { throw "Reçu incomplet pour $jeu" }
    Get-Content "$sortie/$jeu.json"
  }
} finally {
  $env:SIC_P05_COUNTS,$env:NODE_OPTIONS,$env:SIC_REPLAY_REFERENCES = $avant
  Pop-Location
}
```

## Reproduire la qualification des reçus

Les 24 lots ont couvert les 107 jeux distincts de la liste du gel. Les 107 parcours du candidat ont atteint leur cible, dans les plafonds historiques, sans dépassement au score. L’audit retrouve deux resets et zéro undo. Les témoins SNAR (6/6, 163 commandes), SS01 (8/8, 444) et SS04 (8/8, 443) conservent leurs effets et leurs préfixes. SS01 et SS04 utilisent chacun un reset, comme au gel. Aucun premier écart observable à signaler.

| Mesure GitHub | Résultat |
|---|---:|
| Lancement → fin du dernier contrôle | 11 min 07 s |
| Fenêtre du premier au dernier rejeu | 8 min 57 s |
| Pic de lots / étapes de rejeu simultanés | 20 / 20 |
| Durée cumulée des 24 étapes de rejeu | 1 h 45 min 07 s |
| Durée cumulée des 24 jobs de lot | 2 h 12 min 09 s |

Le [reçu horaire](sic-qualification-3c2d6bcf/horaires.json) conserve les intervalles de chaque lot. L’[archive des reçus](sic-qualification-3c2d6bcf/recus.zip) contient le plan, le résumé, les 24 manifestes et les 24 flux de résultats. Son SHA-256 est `ecb9e05dec04f48c500a122cb5a824acf2d0538f446c1a663f671c903e5bfde2`. Les traces détaillées restent dans les dossiers locaux indiqués plus haut.

Le workflow `a9771bcdc6237b578bd394226aab768c37d49431` est un enfant direct du candidat. Chacun de ses 24 runners extrait le SHA du moteur `3c2d6bcf` et exécute les jeux de son lot en série avec les conditions historiques. La première tentative porte le numéro `46067464905`. [Campagne du candidat](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46067464905) · [Campagne de référence](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46051058377)

Depuis le checkout du banc, les commandes suivantes réimportent les reçus avec Python 3.11 ou ultérieur. L’import vérifie le SHA du moteur, l’arbre, les commandes, les plafonds, les empreintes des 24 lots et l’unicité des 107 jeux. Il rapproche ensuite les effets ordonnés par tour, les préfixes par niveau, la victoire, l’autorité, l’arrêt et les récupérations. Les références individuelles des preuves et le détail des offres relèvent des cinq comparaisons natives ci-dessus.

```powershell
git fetch origin audit/sic-107-3c2d6bcf-20261127 audit/sic-107-4be368a3-20261127 audit/sic-107-workflow-tooling-20261127
$dossier = 'artifacts/import-public-46067464905'
Expand-Archive docs/diagnostics/sic-qualification-3c2d6bcf/recus.zip -DestinationPath "$dossier/download"
$parametres = @('scripts/sic-qualification-progressive.py','import-ci',
  '--candidate','3c2d6bcfd4a7d7abf28650e2f8ffed3d3510c3b4',
  '--workflow','a9771bcdc6237b578bd394226aab768c37d49431',
  '--run-id','46067464905','--download',"$dossier/download",'--state',"$dossier/etat")
py @parametres --games temoins
py @parametres --games all
```

Pour reprendre, répéter la dernière commande. Les reçus déjà clos sont revérifiés et réutilisés. Pour repartir du téléchargement GitHub, `gh run download 46067464905 --dir "$dossier/download"` fournit les mêmes fichiers pendant leur durée de rétention.

L’exercice depuis l’archive livrée a produit 3 nouveaux verdicts, puis 104 nouveaux et 3 réutilisés, puis 107 réutilisés lors d’un dernier appel. L’import initial, ses reçus et l’état de reprise se trouvent dans `artifacts/qualification-3c2d6bcf-46067464905/`. Le nouvel import indépendant se trouve dans `artifacts/import-public-46067464905/`.

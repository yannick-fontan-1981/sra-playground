# Qualification de P05 au commit 3c2d6bcf

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

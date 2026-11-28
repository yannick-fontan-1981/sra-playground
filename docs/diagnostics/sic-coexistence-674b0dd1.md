# Coexistence de 55 lignes SIC

L’assemblage d’essai est `674b0dd19d693a66687990ab2a4368d981aa8fb9` (`experiment/sic-coexistence-cinquante-cinq-lignes`), parent `ba2e7c6b`. Le seuil est atteint avec le second verdict SK48/64 `ef0a4669`. L’arbre `src` `7ea60eaa1d45349b1a5692fb3adb01a286943eaa` contient 34 fichiers différents du gel. TypeScript passe. Le seul apport depuis le parent est `src/logos-engine/v6-containment.ts`, blob `da4cec896f42f3cef17e3768ec9bc0dbf25b21fd` identique à AR25 `f6ff40f5`. [Assemblage parent](sic-coexistence-ba2e7c6b.md) · [Diff du moteur](https://github.com/yannick-fontan-1981/sra-playground/compare/ba2e7c6b8d10e04edc149ff836c065178757c62d...674b0dd19d693a66687990ab2a4368d981aa8fb9)

Les 55 numéros sont **1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 18, 22, 23, 25, 26, 27, 28, 29, 31, 35, 36, 40, 41, 44, 47, 48, 52, 54, 56, 57, 58, 61, 63, 64, 66, 68, 69, 77, 80, 81, 83, 84, 86, 87, 90, 91, 92, 96, 97, 98**.

| Numéro | Attribution et témoin |
|---|---|
| 6 · SMLP | Moteur du gel, ordre des arrivées, réutilisation de la mesure et contre-épreuve à finale seule. Opérateur `2710d297`. [Banc](sic-qualification-smlp-1e11472a.md) |
| 7 · RE86 | Moteur du gel, quatre vecteurs, deux supports, variante de pose et nouvelle époque. Opérateur `cab27cf8`. [Banc](sic-qualification-re86-8e820aa6.md) |
| 8 et 77 · AR25 | 8 ajoute le calibrage alternatif de `f6ff40f5`. 77 attribue au gel les rôles distincts du corps et du reflet. Opérateur `24b103a1`. [Banc](sic-qualification-ar25-f6ff40f5.md) |
| 9 · SPOR | Moteur du gel, compartiment, retour et retrait. Opérateur `0b10cbc4`. [Banc](sic-qualification-spor-19ffd927.md) |
| 12 · MIND | Moteur du gel, même premier clic et décision ordonnée différente, puis refus de consommer un retour ambigu. Opérateur `df8e312b`. [Banc](sic-qualification-mind-860835b1.md) |
| 25 · HANO | Moteur du gel, sélection d’un membre, transfert et repli après retrait de la preuve. Opérateur `060cb271`. [Banc](sic-qualification-hano-f768bac6.md) |
| 56 · MEMO et SPOR | Moteur du gel. MEMO éprouve le retrait causal de l’exemple retenu. SPOR fournit le témoin de l’enclos courant. Opérateur `0c08111e`. [Banc](sic-qualification-memo-4d9f1a39.md) |
| 64 · SK48 | Calibrage et premier plan au gel. Le premier geste est confirmé sur deux des trois palettes complètes au gel et trois sur `4946cf02`, dont la projection est déjà intégrée avec 96. Le départ 9↔14 donne l’arrêt à 792 expansions sur le gel et le T5 confirmé à 282 sur la projection. Le compte porte sur le premier geste mesuré. Opérateur `ef0a4669`. [Banc](sic-qualification-sk48-1cf241c7.md) |

## Verdict

**Les 55 lignes coexistent sur `674b0dd1`.** Les 98 tests Containment et Addressed Material passent. Les dix variantes AR25 et les onze scénarios SMLP, HANO, RE86 et MIND reproduisent leurs reçus individuels. SPOR et MEMO conservent chacun leur preuve propre. Le moteur commun confirme le T5 de SK48/64 sur les trois palettes éprouvées, dont 8↔13 rejouée expressément. [Témoins locaux](sic-coexistence-674b0dd1/temoins.zip)

Les **107 jeux distincts, 692 niveaux et 18 560 gestes** concordent avec les reçus historiques du gel et de l’assemblage à 46. Deux resets (SS01 et SS04), zéro undo. Ce verdict porte sur les reçus pour le catalogue complet et sur les décisions et retours capturés pour les témoins ciblés. [Index par jeu](sic-coexistence-674b0dd1/qualification.json) · [Reçus historiques comparés](sic-coexistence-674b0dd1/recus.zip)

Le run unique a duré 14 min 05 s avec un pic de 20 runners. Le réimport traite trois jeux, puis 104 nouveaux et trois réutilisés, puis réutilise les 107. Verdict publié le 27/11 à 23:26:27 UTC−3. [Horaires](sic-coexistence-674b0dd1/horaires.json)

## Reproduire

Le workflow `d4c1203cffef75ab9fed4e0a6de7964c4f02dedb` lie les 24 lots au moteur exact. [Campagne 46096543568](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46096543568)

```powershell
py -3.11 scripts/check-sic-coexistence.py docs/diagnostics/sic-coexistence-674b0dd1/recus.zip --candidate 674b0dd19d693a66687990ab2a4368d981aa8fb9 --workflow d4c1203cffef75ab9fed4e0a6de7964c4f02dedb --run 46096543568
```

Depuis cette branche, avec Node 24, `$m` désigne un checkout propre du moteur `674b0dd1` équipé de Pyodide et `$out` un répertoire local neuf. Exécuter les témoins séquentiellement.

```powershell
py -3.11 scripts/test-sic-coexistence-cavites.py AR25 $m "$out/AR25"
foreach ($jeu in 'SMLP','HANO','RE86','MIND') {
  py -3.11 scripts/test-sic-coexistence-catalogue.py $jeu $m "$out/$jeu"
}
foreach ($jeu in 'SPOR','MEMO','SK48') {
  py -3.11 scripts/test-sic-coexistence-recall.py $jeu $m "$out/$jeu"
}
```

Les sorties locales d’origine sont dans `artifacts/qualification-coexistence-55/`. Le registre des 55 conserve les 46 témoins parents, contrôlés sur `ba2e7c6b`. La campagne sur le nouveau SHA compare l’ensemble des reçus historiques. Les témoins nouveaux et les tests des dépendances de Containment s’exécutent sur le nouveau SHA.

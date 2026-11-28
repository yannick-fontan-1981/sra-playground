# Coexistence de dix-huit lignes SIC

Le moteur d’essai `f27eb1c055d44e852fb90a25c542d0a466eb6c16` part directement du [moteur à dix lignes](sic-coexistence-8a424aab.md). Le périmètre a été arrêté au lancement du 27 novembre 2026, 23:50 UTC. Le SHA et son arbre `src`, `f510d30b9c982a632d878f7ed82e81ba4bb39646`, identifient aussi bien les captures locales que les 24 lots de la campagne distante. La branche est `experiment/sic-coexistence-dix-huit-lignes`. [Diff du moteur par rapport au parent](https://github.com/yannick-fontan-1981/sra-playground/compare/8a424aab6ca2e2f6b902cc4b9c89313ed6947b74...f27eb1c055d44e852fb90a25c542d0a466eb6c16)

| Lignes en portée | Provenance moteur et preuve attendue |
|---|---|
| 1, 15, 16, 18, 23, 83, 87, 90, 91, 98 | Reprise du parent `8a424aab`, dont découle tout l’arbre. Rejouer ses 20 suites, les deux époques ZIPP, les témoins G50T et les départages DICO sur le moteur combiné. |
| 61 | `21fd159e`, fichier `v6-reception-service-access.ts` extraction et correction réunies. Distinguer la confirmation physique du T17 et le changement de demande avant le ticket T18 de FOGW. |
| 92 | `b56ea752` apporte la preuve LS19 sur les sources du gel. Rejouer les sept conditions sur le moteur combiné avec les lignes 90 et 91 actives. |
| 44, 47, 48 | `495ea148`, fichier `v6-field-service-access.ts` réunissant l’extraction et le correctif de portée. Rejouer les trois retraits, le témoin authentique, la mauvaise paire et le contexte de récepteur altéré. Les deux verdicts relatifs à 48 précèdent le gel de cet assemblage. [Banc](sic-qualification-valv-495ea148.md) · [Opérateur](https://github.com/yannick-fontan-1981/sra-playground/tree/7448e989373ef7e02808c5142451b21f61f18570/experiments/symbolic-situations/valv-ligne-48-provenance) |
| 52, 57, 58 | `39e32b1f`, fichiers `v6-program-composition-access.ts` et `v6-shared-series.ts`. Rejouer les trois replis, le retrait des apprentissages et l’ordre des répondants dans des animations ayant la même image finale. [Banc](sic-qualification-stck-39e32b1f.md) · [Opérateur](https://github.com/yannick-fontan-1981/sra-playground/tree/fc6373a5298f603692c77c8aade2cecf6f807e2e/experiments/symbolic-situations/stck-lignes-52-57-58) |

Ces huit numéros ajoutent quatre fichiers moteur au parent. Aucun de ces chemins n’y avait changé depuis le gel. Les blobs sont identiques à leurs sources qualifiées. Le diff cumulé avec `d0e7527c` compte 21 fichiers, tous sous `src`. La qualification de SK48/96 reste sur son propre moteur `4946cf02`. [Verdict SK48 et réserve du banc](sic-qualification-sk48-4946cf02.md)

## Verdict sur le moteur commun

**Les 18 lignes coexistent sur `f27eb1c0`. Les 107 jeux rejoués satisfont les reçus du gel et ceux du parent à dix lignes.** Les 23 suites locales passent leurs **280 tests** (256 hérités, 4 FOGW, 8 STCK et 12 VALV). TypeScript passe avec `--noEmit`. Les captures suivantes ont été comparées aux reçus des branches qualifiées. [Témoins et journaux des suites](sic-coexistence-f27eb1c0/temoins.zip)

- **FOGW/61 et LS19/92.** Les quatre sessions FOGW reproduisent la correction du sujet au retour T17, l’indice du ticket T18 et les témoins stables. Les sept conditions LS19 retrouvent chacune l’empreinte du gel. La justification de `ACTION3` change du T14 au T15 comme prévu.
- **VALV/44,47,48.** Les retraits des trois offres, le retour propre de chaque commande et le ticket suivant concordent. Les quatre conditions publiques de l’opérateur produisent les mêmes reçus sur l’assemblage et le correctif. La fausse paire 9→11 fait choisir le test imbriqué en (32,51) au T11. Modifier l’aire du récepteur déjà lié conserve le clic en (32,51) au T12 et change sa justification. La réserve privée du verdict opérateur reste rattachée à sa révision.
- **STCK/52,57,58.** Les huit sessions de caractérisation concordent. Le banc a aussi rejoué les trois commandes de repli de l’opérateur dans le vrai jeu et comparé leurs acquisitions et leurs suites. Deux animations finissant sur la même image donnent des ordres opposés, d’indices 12 puis 49 et 23 puis 38. La seule image finale suspend la décision. Les reçus de l’assemblage concordent avec ceux de `39e32b1f`.
- **Dix lignes parentes.** Les captures ZIPP des deux époques, celles des trois ordres DICO/98, les conditions DICO/87 et le contrôle G50T/23 gardent leurs résultats détaillés. Les tests des autres décisions du parent passent sur ce même arbre.

**Non-régression historique.** Les 107 codes sont uniques. Résultat **692 niveaux sur 692, 18 560 commandes, deux resets et zéro undo**. Aucun écart de reçu, dépassement de plafond qualifiant ou parcours incomplet. SNAR termine 6/6 en 163 commandes, SS01 8/8 en 444 et SS04 8/8 en 443. Les deux derniers ont chacun effectué un reset. Les 24 lots ont utilisé au plus 20 runners à la fois et cumulé 6 101 secondes de rejeu. Du lancement au dernier contrôle, la campagne a duré 14 min 24 s. L’équivalence détaillée des décisions porte sur les témoins capturés. Les 107 sont comparés selon les champs enregistrés par la campagne historique. [Index des 107](sic-coexistence-f27eb1c0/qualification.json) · [Reçus sources](sic-coexistence-f27eb1c0/recus.zip) · [Horaires par lot](sic-coexistence-f27eb1c0/horaires.json)

L’import interrompu après AS66, G50T et HOLE reçoit 3 nouveaux jeux. Sa reprise importe les 104 autres et réutilise les trois premiers. Un troisième appel réutilise les 107. Chaque reçu est lié au SHA, au workflow et à ses paramètres. Vérification hors ligne avec Python 3.11, les révisions moteur et CI accessibles par Git, depuis le banc préparé.

```powershell
py -3.11 scripts/check-sic-coexistence.py docs/diagnostics/sic-coexistence-f27eb1c0/recus.zip --candidate f27eb1c055d44e852fb90a25c542d0a466eb6c16 --workflow 6e47d3bc869b52724b3c53b10c00e33ff8750bd4 --run 46084691760
```

Les sorties locales sont dans `artifacts/qualification-coexistence-suivante/`. Le répertoire `ci-46084691760/download` contient les lots originaux et `reimport` l’état de reprise.

## Rejouer les contrôles

Préparer un checkout propre au SHA d’assemblage, un Node 24.22.3, les dépendances verrouillées et les jeux avec Pyodide. Depuis le banc, adapter `$moteur`, utiliser des dossiers de sortie neufs, et récupérer les commits des opérateurs avant le dernier appel. Les scripts montent la production de l’assemblage et les tests de chaque révision de preuve dans des dossiers distincts.

```powershell
$moteur = (Resolve-Path ../sic-banc-ls19).Path
py scripts/test-sic-coexistence.py $moteur ./temoins-herites --node node
py scripts/test-sic-coexistence-offres.py $moteur ./offres-heritees --node node
py scripts/test-sic-coexistence-reprises.py $moteur ./temoins-nouveaux --node node
git fetch origin 7448e989373ef7e02808c5142451b21f61f18570 fc6373a5298f603692c77c8aade2cecf6f807e2e
py scripts/test-sic-coexistence-operateur.py ./defis-publics --pyodide "$moteur/public/vendor/pyodide" --node node
```

Le commit CI `6e47d3bc869b52724b3c53b10c00e33ff8750bd4` ajoute uniquement le workflow de la campagne. Il rattache les reçus à l’arbre moteur et aux 107 codes du gel. [Campagne distante unique](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46084691760)

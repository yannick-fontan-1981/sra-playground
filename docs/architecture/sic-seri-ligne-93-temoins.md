# SERI, ligne 93 — citer les complétions distinctes de la reprise

## Première divergence préenregistrée

Le [lot nominal](sic-seri-ligne-93.md) à `aa9c4cfe` utilise le
moteur du gel `d0e7527c`. En N2/T5, deux rangées complétées
et le passage officiel servent à rappeler la méthode visuelle.

Dans un journal construit, remplacer la dernière complétion par
une copie de la précédente laisse deux questions distinctes en
révisions 2 et 3. La fin du journal présente [2,3,3] et
l'événement officiel cite 5. Le gel admet la continuation et
publie [3,3,5] dans `sequence_plan.continuation_witnesses` et
parmi les preuves de `bundle_template`. La même commande
ACTION6(46,54) est réellement jouée et la même case se remplit.

Le premier écart attendu est la liste des deux complétions
publiée dans ces deux champs, [2,3,5] sur le correctif. Le
seuil reste deux questions distinctes. Deux entrées copiées
d'une seule question ne permettent pas de rappeler cette méthode.
L'analyse directe de la vue, le clic, son admission et son
retour physique restent ceux du gel dans les deux situations.
Le contrôle nominal conserve les références 3, 4 et 5.

[Banc](https://github.com/yannick-fontan-1981/sra-playground/blob/9bf19fed807d0d4aca1261dfdbb478053c6b269b/docs/diagnostics/sic-qualification-seri-provenance-aa9c4cfe.md) ·
[Opérateur](https://github.com/yannick-fontan-1981/sra-playground/blob/4b183536519749bb3c6214641cb0dc065706de3a/experiments/symbolic-situations/seri-ligne-93/BILAN.md)

## Raccord et vérification

`VisualSequences.proposeContinuation` retient la complétion
qualifiée la plus récente de chaque question. Ce même ensemble
alimente le seuil d'admission et les références exposées.
Le passage officiel conserve sa preuve propre. L'analyse de
la rangée et l'exécuteur du ticket suivent la même voie.

La reproduction sur le gel, `67e19d58`, garde la référence 3
deux fois même si l'admission s'appuie sur deux questions.
Avec le correctif, les deux sorties citent 2 et 3 chacune
une fois, et la limite officielle 5. Avec une seule question,
les deux moteurs libèrent le clic à partir de l'analyse
directe et citent seulement la vue courante. Les variantes
remplissent la même case sur le vrai jeu.

La comparaison nominale à horloge déterministe retrouve
les neuf tickets et retours et les dix observations à
l'identique. Elle inclut les huit occurrences de la ligne 93,
les deux passages de niveau et l'arrêt après le T9. Les
19 tests du lot et le contrôle de types passent.

## Reproduction

Node 24. `SIC_SERI_GAME_ROOT` désigne les actifs et Pyodide.

```powershell
node --experimental-strip-types --disable-warning=ExperimentalWarning --test tests/sic-seri-line-93.test.ts tests/v6-visual-sequences.test.ts
npm run typecheck
```

[Test et preuves exposées](../../tests/sic-seri-line-93.test.ts) ·
[Choix des complétions](../../src/logos-engine/v6-visual-sequences.ts)

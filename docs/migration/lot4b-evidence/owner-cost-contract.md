# Lot 4B — contrat prospectif de coût pour RelativeArrangements

Ce document prépare une comparaison future. Il ne déclare aucune fenêtre, aucun
résultat de coût et aucune identité de publication future. Le baseline sera le
prédécesseur effectivement publié après la coordination des lots 7A et 5A ; sa
version Site, son commit, sa version native et son inventaire viendront de la
déclaration effectivement finalisée. Le candidat sera le gel 4B intégré à ce
prédécesseur. Un changement de l’un de ces gels impose de nouvelles captures et
un nouveau répertoire de protocole avant mesure.

## Règle numérique conservée

La fenêtre officielle conserve l’ordre A1/B1/B2/A2. Chaque série comporte quatre
sessions mesurées par jeu : dix actions par session STCK, quinze par session
SMLP. Cela donne **32 sessions et 400 actions mesurées**, avec **8 chauffes et
24 actions de chauffe exclues** des distributions mesurées. Aucun échantillon,
ordre, dépassement ou cohorte défavorable ne peut être supprimé.

Pour chacun des deux jeux, les huit durées de session A sont réunies et les huit
durées B sont réunies. Le critère global est strict : la médiane B doit être
inférieure à 1,1 fois la médiane A. Une égalité à +10 % échoue ; aucun jeu ne
compense l’autre. Le calcul JavaScript utilise l’arithmétique entière des valeurs
décimales, et la revue Python recalcule indépendamment avec Decimal.

Les huit phases par jeu restent visibles : `session_elapsed`, `new_decision`,
`known_prefix_service`, `known_prefix_request`, `known_prefix_guard`,
`acquisition_and_persistence`, `persistence`, `restoration`. Les seize diagnostics
agrégés et les trente-deux diagnostics des deux cohortes sont conservés, avec
effectifs, médianes et p95 seulement lorsque n ≥ 20. Pause et mémoire gardent le
périmètre réellement observé par le harnais ; le rendu ne les transforme pas en
validation du navigateur ou en mesure du moteur du jeu.

## Comparabilité structurelle établie avant mesure

L’owner attendu est `relative_arrangements`, et le programme attendu est
`v6.relative_arrangements.choose`. Les trois identités d’installation sont
`family_state:relative_arrangements`, `family_activation:relative_arrangements`
et `program:v6.relative_arrangements.choose`. Ces identités ne constituent pas
une formule de croissance : aucun delta `+3`, `3+cycles` ou autre total de nœuds
ou de révisions n’est présumé.

Le registre de fabrique observe les owners et programmes effectivement
installés dans A et B, sans lancer de workflow. Les captures fonctionnelles
utilisent ensuite les fabriques et le service réels, à froid, sur les mêmes cas
publics STCK/SMLP que le coût. Elles comprennent les quatre formes ordonnées
STCK/chauffe, STCK/mesurée, SMLP/chauffe, SMLP/mesurée : quatre sessions et
31 actions par côté, huit sessions et 62 actions au total. Elles ne produisent
aucune métrique de performance et précèdent la fenêtre officielle.

Le capteur conserve les graphes, chaînes, deltas, causes, métadonnées, commandes
réellement recalculées, retours publics et points d’inspection. Le qualificateur
reconstruit les graphes et exige la conservation des identités communes, des
causes et de l’ordre des deltas communs. Chaque nouveau nœud doit provenir de
l’installation déclarée, d’un état source réellement observé, d’un événement
sélectionné, de son fait de raisonnement ou d’un fragment effectivement référencé.
Un nouveau nœud non attribué bloque la qualification.

Les cinq champs durables sont `models`, `events`, `failed`, `selection_ref` et
`epoch`. Seul `failed`, provenant d’un ensemble Python, peut être trié pour le
transport. L’acquisition `record` est sélectionnée uniquement ; elle n’est pas
passive. Cela ne signifie pas que l’état est immuable quand une autre famille
agit : `propose` peut fixer `epoch` à l’époque courante et réinitialiser les
modèles, les essais échoués et la sélection, tout en conservant les événements. Les appels réellement
observés, restaurations et intervalles de `persistFamilies` établissent les
causes. Une persistance peut réviser le nœud sans changer la valeur source.
L’événement retourné et le modèle mémorisé restent distincts, conformément au
contrat source qui ajoute `expected` et `risks` après la copie du modèle.

La fixture numérique de formes est figée par empreinte avant mesure. Pendant
l’analyse, chaque session mesurée et chaque chauffe doit correspondre à la
forme de sa propre version. Les seuls chemins de signature pouvant différer
entre versions sont `observations[*].nodeCount`, `inspection[*].graphNodes`,
`final.nodeCount` et `final.graphRevision`, avec les valeurs exactes issues des
captures, sans correction des rapports. Tous les autres champs de travail sont
comparés strictement. Les signatures complètes doivent rester identiques dans
chaque version, entre répétitions et entre cohortes.

Les captures attestent leurs graphes effectivement capturés. La concordance des
signatures des sessions chronométrées n’atteste pas rétroactivement toutes leurs
feuilles privées non capturées. Cette limite doit rester visible dans le rendu.

## Provenance, chemins et outils historiques

Les outils de mesure et de comparaison historiques restent inchangés. Les
adaptations 4B dérivent des outils 7A v2 ; leurs en-têtes consignent les octets
sources lus. La correction de lecture des entrées absolues de baseline est
intégrée ici **avant déclaration et avant mesure**, sans reprendre une exception
post-mesure de 7A comme un fait 4B.

Une entrée absolue n’est admise que dans la capture baseline, sous le checkout
baseline exact de `preparation.json`, sans alias symbolique. L’attribution doit
conserver exactement la liste ordonnée de ces empreintes. Le checkout de la
fenêtre doit être identique ; taille et SHA-256 sont vérifiés avant et après
analyse. Les entrées du candidat et les reçus restent dans ce dépôt.

Les deux comparateurs de cohorte officiels doivent être exécutés normalement.
L’agrégateur historique strict doit également être exécuté. Son éventuel refus
`Within-cohort work metadata changed` est conservé avec commande exacte,
horodatages, code de sortie, journal, entrées avant/après et absence de sortie
agrégée. Ce refus n’est jamais remplacé par un statut strict passé. Si le contrôle
strict donne un autre résultat, la branche complémentaire s’arrête pour revue ;
elle ne fabrique pas l’échec attendu.

Le consolidateur 4B copie sans modification les fonctions métriques et la
signature de travail du comparateur historique ; la revue Python utilise ses
propres calculs et vérifie les empreintes des sources historiques sans les importer. La revue
recalcule les deux cohortes et le pool à partir des rapports bruts, vérifie les
journaux, le registre de toutes les sessions, les sources, outils et chronologies,
et produit un statut complémentaire explicitement qualifié. La réussite de cette
revue arithmétique ne préjuge pas de l’acceptation du budget global.

## Ordre d’exécution futur

Les commandes ci-dessous constituent un mode opératoire, pas un reçu
d’exécution. Toutes les variables `LOT4B_*` doivent être renseignées avec des
chemins et identités effectivement vérifiés ; aucun Site ou numéro de version
futur n’est fixé par ce document. Les commandes se lancent depuis la racine du
dépôt, avec Python `-B`. Le répertoire de performance est neuf et toutes les
sorties sont exclusives.

```bash
python -B docs/migration/lot4b-evidence/prepare-cost-protocol.py \
  --finalize --owner-cost-qualification \
  --baseline-checkout "$LOT4B_BASELINE" \
  --baseline-site-version "$LOT4B_SITE" \
  --candidate-version "$LOT4B_VERSION" \
  --output-directory "$LOT4B_PERF" \
  --candidate-source-directory "$LOT4B_FREEZE" \
  --baseline-manifest "$LOT4B_BASELINE_MANIFEST"

node docs/migration/lot4b-evidence/record-cost-owner-source-inventory.mjs \
  "$LOT4B_BASELINE" "$LOT4B_PERF/owner-source-inventory.json"

node docs/migration/lot4b-evidence/capture-cost-owner-graphs.mjs \
  baseline "$LOT4B_BASELINE" "$LOT4B_PERF/cases.json" \
  "$LOT4B_BASELINE_MANIFEST" "$LOT4B_PERF/owner-graphs-baseline.json.gz"
node docs/migration/lot4b-evidence/capture-cost-owner-graphs.mjs \
  candidate "$PWD" "$LOT4B_PERF/cases.json" \
  "$LOT4B_FREEZE/source-manifest.json" "$LOT4B_PERF/owner-graphs-candidate.json.gz"

node docs/migration/lot4b-evidence/qualify-cost-owner-graphs.mjs \
  "$LOT4B_PERF/owner-graphs-baseline.json.gz" \
  "$LOT4B_PERF/owner-graphs-baseline.receipt.json" \
  "$LOT4B_PERF/owner-graphs-candidate.json.gz" \
  "$LOT4B_PERF/owner-graphs-candidate.receipt.json" \
  "$LOT4B_PERF/owner-structural-attribution.json" \
  "$LOT4B_PERF/owner-structural-fixture.json"

python -B docs/migration/lot4b-evidence/prepare-owner-cost-contract.py \
  --finalize --performance-directory "$LOT4B_PERF" \
  --owner-inventory "$LOT4B_PERF/owner-source-inventory.json" \
  --structural-fixture "$LOT4B_PERF/owner-structural-fixture.json"
python -B docs/migration/lot4b-evidence/check-cost-static-inputs.py \
  --performance-directory "$LOT4B_PERF"
```

Le gel intégré, ses archives et transports, les tests, les cinq gates, les
régressions strictes, le rejeu public TRIA final et sa parité Python doivent
ensuite être liés par `finalize-cost-readiness.py`. La résolution de cas conserve
son horloge cumulée initiale ; le rejeu du gel final n’est pas une nouvelle
réussite live. Une preuve navigateur bloquée par l’infrastructure reste
explicitement nonpassante, avec zéro action et aucun contrôle fonctionnel
revendiqué. L’option `--partial-regression-receipt` peut lier la préservation
partielle déclarée de LKEY ; son raw failed, ses limites et son objectif non
atteint restent distincts des totaux stricts.

```bash
python -B docs/migration/lot4b-evidence/finalize-cost-readiness.py \
  --performance-directory "$LOT4B_PERF" \
  --candidate-source-directory "$LOT4B_FREEZE" \
  --parity-receipt "$LOT4B_PARITY" --browser-receipt "$LOT4B_BROWSER" \
  --game TRIA --case-resolution docs/migration/lot4b-evidence/tria-case-resolution.json \
  --partial-regression-receipt "$LOT4B_PARTIAL"

python -B scripts/run-native-cost-window.py \
  "$LOT4B_BASELINE" "$LOT4B_PERF" \
  "$LOT4B_BASELINE_MANIFEST" "$LOT4B_FREEZE/source-manifest.json"
```

La readiness exige l’accord coopératif réel, l’arrêt des calculs suivis et de la
preview. Elle ne prétend pas déduire une exclusivité interfil de la seule liste
des processus. Les captures, tout jeu et toute autre charge ont pris fin avant
la fenêtre officielle. Si LKEY n’est pas requis dans le périmètre final, omettre
son option plutôt que fournir un chemin fictif.

Après les comparateurs officiels et la conservation de leur résultat strict
réel, les outils complémentaires s’exécutent sans relancer de mesure :

```bash
node docs/migration/lot4b-evidence/consolidate-owner-costs.mjs \
  "$LOT4B_PERF/owner-growth-contract.json" "$LOT4B_PERF/owner-growth-comparison.json"
python -B docs/migration/lot4b-evidence/review-owner-costs.py \
  "$LOT4B_PERF/owner-growth-contract.json" "$LOT4B_PERF/owner-growth-comparison.json" \
  "$LOT4B_PERF/owner-growth-review.json"
python -B docs/migration/lot4b-evidence/record-cost-log-transport.py "$LOT4B_PERF"
python -B docs/migration/lot4b-evidence/write-cost-results.py --performance-directory "$LOT4B_PERF"
```

Le rendu exige tous les reçus terminés et échoue s’ils manquent. Il affiche les
identités de la déclaration, chaque médiane globale et son écart relatif, les
phases et cohortes défavorables, les limites de Pause/mémoire et le nombre réel
de contrôles de revue. Aucun résultat de coût ne découle de la seule présence de
ce document ou des scripts. Le registre détaillé des écarts structurels reste
dans les JSON d’agrégation et de revue liés par le rendu.

# Lot 9A : fenêtre officielle prospective de coût 0.68

Ces outils préparent et lisent une seule fenêtre pour **ChartNavigation 0.68.0**,
334 fichiers natifs, digest
`e7a94fbc7cdcb19d8704b5d4120f27a858cbcd07e455084711510ee147f4e653`.
La référence est la source réellement publiée dans **Site 108 / native 0.67.0**,
commit `8462204043aa368faa7df280d796bb706eb53b38`, 331 fichiers et digest
`c234bb404de43b380e5595cee8ad4ddfcae6e02d0fcc40286546fcf6838dd44a`.
Le responsable doit vérifier que cette publication reste la référence avant la
fenêtre. La préparation n'affirme ni une mesure, ni une isolation, ni une
publication.

## Héritage exact et règle globale

`prepare.py` dérive du `prepare-v2.py` conservé de Lot 8B, y compris sa résolution
correcte des empreintes `sourceInventory` depuis le checkout propre à chaque
rôle. Tous les autres chemins conservent leur sens original. Le fichier
`provenance.json` lie chaque source, chaque dérivé et son diff complet. Aucun
outil ou reçu historique n'est modifié.

Les sept outils officiels du runner, de mesure, de comparaison et de décision
restent octet pour octet ceux de la déclaration Lot 3H. Les suppléments
`analyze.mjs`, `review.py` et `postprocess.py` ne changent que leurs noms de schéma,
leur répertoire de sortie autorisé et leur désignation Lot 9A. Le calculateur
JavaScript importe les fonctions arithmétiques et `workSignature` historiques.
Le reviewer Python recalcule séparément les valeurs depuis les rapports bruts.

L'ordre déclaré est **A1, B1, B2, A2**. Chaque série mesure STCK puis SMLP, après
une chauffe distincte de trois actions pour chaque jeu. Quatre sessions froides
par jeu/série donnent huit sessions mesurées par jeu/version. Les mêmes worker
et JIT restent ceux du cas dans la série. Le runtime et sa mémoire sont neufs
pour chaque session.

Les **32 sessions mesurées et leurs 400 actions** ainsi que les **huit chauffes
et leurs 24 actions** sont toutes conservées. Seules les chauffes sont exclues
des médianes. Aucune session mesurée, valeur extrême ou cohorte n'est retirée.
Il n'y a ni compensation entre jeux, ni marge de bruit, ni relance automatique.
Pour **chacun de STCK et SMLP**, le verdict global exige strictement :

```text
médiane du candidat < 1,1 × médiane de la référence
```

Une phase au-dessus de +10 % peut être acceptée lorsque les deux globaux
respectent cette condition. Tous les diagnostics de phases restent présents,
y compris ceux des comparaisons de paires. Les phases sont imbriquées et ne
s'additionnent pas. Aucun p95 n'est annoncé pour huit durées de session ; les
phases conservent leur p95 historique lorsque leur effectif atteint vingt.

`session_elapsed` mesure le parcours complet du contrôleur jusqu'au dernier
retour acquis, pauses et reprises incluses. Le démarrage du worker, `begin`, les
inspections terminales et `close` restent hors de cette durée. Le moteur de jeu,
le réseau et le rendu navigateur ne sont pas mesurés. STCK comporte dix actions
et deux niveaux effectivement acquis ; sa cible de trois niveaux n'est pas une
réussite à trois niveaux. SMLP comporte quinze actions et trois niveaux acquis.

## Liaison aux preuves fonctionnelles finales

La préparation exige les manifestes finaux, les quatre formes enregistrées,
le rapport work corrigé `work-qualify-02`, l'inventaire des owners, la vraie revue
indépendante et le rapprochement final de `delivery-final-068-01`.

Elle lit la revue indépendante dans son schéma réel
`logos-engine.lot9a.independent-final-delivery-review.v1`. Elle vérifie ses
94 empreintes, sa liaison aux captures et aux lecteurs, les identités natives,
les 64 contrôles, 58 points appariés et 28 279 différences attribuées sans
résidu. Elle conserve la portée de l'indépendance déclarée par le reviewer :
indépendance des outils de livraison, avec participation antérieure au port
géométrique. Elle ne fabrique pas un reçu au schéma du Lot 8B.

Le premier lecteur work reste en échec avec ses 58 durées `total_ms` non
attribuées. Le deuxième lecteur attribue ce seul chemin à partir du producteur,
du report persisté, des intervalles réellement observés et de la rétention
exacte du report complet. La durée est bornée, pas reconstituée. La préparation
ne réexécute aucun lecteur : les deux tentatives autorisées sont consommées.
Les captures restent inchangées et aucun temps n'est normalisé ou remplacé.

Les quatre formes fonctionnelles sont copiées exactement. Les cas officiels et
les cas fonctionnels sont liés par les six champs d'exécution, dans le même
ordre : `id`, `trace`, `traceSha256`, `actions`, `targetLevels`, `warmupActions`.
Leur identité textuelle n'est pas revendiquée ; les descriptions `purpose`
conservent leur réserve documentaire.

L'inventaire prouve l'ajout du seul owner **`public_chart_navigation`** et du seul
programme **`v6.chart_navigation.choose`**, soit respectivement 62→63 et 28→29.
Les owners et programmes précédents restent dans le même ordre. Cette attribution
sur STCK/SMLP ne constitue pas une acquisition Chart positive.

La capture common indépendante de ces quatre formes reste liée et vérifiée :
**cinq sessions, neuf retours, 52 points et 21 graphes complets**, avec six
acquisitions actives, deux passives et une acquisition supprimée par l'ablation
déclarée. Sa frontière est `NativeV6Runtime`. La preuve positive Chart par le
service public, le worker et les tickets n'est toujours pas qualifiée par ce
jalon et ne le devient pas par la mesure.

Chaque chauffe et session officielle doit égaler la forme capturée de son rôle,
numéro natif compris. La signature historique complète vérifie aussi les
appels de phases, leur placement, les pauses et les échantillons mémoire hors
valeurs d'allocation. Entre versions, seuls les quatre chemins ci-dessous
acceptent les valeurs exactes établies avant la mesure :

- `observations[*].nodeCount` ;
- `inspection[*].graphNodes` ;
- `final.nodeCount` ;
- `final.graphRevision`.

Les signatures restent exactes dans chaque version, entre répétitions et
cohortes. Aucun autre champ n'est omis. Les anciens flags
`preparedOnly: true`, `officialPerformanceEligible: false` et
`strictCommonGraphParity: false` restent inchangés.

## Préparation uniquement, sans exécution native

Le répertoire de sortie doit être absent dans les deux checkouts.

```text
python -B docs/migration/lot9a-evidence/tools/final-cost/prepare.py
  --baseline-checkout /workspace/sites/sra-lot9a-baseline067-20261112
  --baseline-manifest docs/migration/lot9a-evidence/delivery-final-068-01/baseline-native.json
  --candidate-manifest docs/migration/lot9a-evidence/delivery-final-068-01/candidate-native.json
  --reconciliation docs/migration/lot9a-evidence/delivery-final-068-01/final-reconciliation.json
  --work-forms docs/migration/lot9a-evidence/delivery-final-068-01/work-qualify-02/work-forms.json
  --graph-review docs/migration/lot9a-evidence/delivery-final-068-01/work-qualify-02/graph-review.json
  --owner-inventory docs/migration/lot9a-evidence/delivery-final-068-01/work-inventory-01/owner-source-inventory.json
  --functional-review docs/migration/lot9a-evidence/delivery-final-068-01/independent-delivery-review.json
  --output-directory docs/migration/lot9a-evidence/final-performance-068-01
```

Le résultat fige `contract.json`, `expected-forms.json`, `protocol.md` et les deux
fichiers d'entrées historiques. Le contrat contient la commande exacte du runner
et toutes les empreintes nécessaires. Une revue de préparation et un commit de
sauvegarde précèdent la fenêtre officielle.

## Exclusivité et analyse

Le runner historique n'acquiert aucun verrou et n'a pas de délai global. Le
contrôleur séparé déclare les conditions exactes d'isolation, la readiness, une
acquisition exclusive non bloquante et la supervision du groupe de processus.
Le plafond proposé est de 1 800 secondes actives ; les réserves de clôture et de
conservation sont fixées par son plan. Il ferme uniquement ses propres
descripteurs et ne supprime jamais un fichier de verrou.

Aucune attente de disponibilité des autres lots ni verrou global ne s'applique
au développement, aux tests fonctionnels, aux commits ou aux push de sauvegarde.
Les analyses ci-dessous suivent la libération du verrou de performance.

```text
python -B docs/migration/lot9a-evidence/tools/final-cost/postprocess.py DOSSIER/contract.json
node docs/migration/lot9a-evidence/tools/final-cost/analyze.mjs DOSSIER/contract.json DOSSIER/strict.execution.json DOSSIER/analysis.json
python -B docs/migration/lot9a-evidence/tools/final-cost/review.py DOSSIER/contract.json DOSSIER/analysis.json DOSSIER/independent-review.json
```

Le postprocesseur exécute réellement les deux comparaisons de paires puis le
comparateur strict de cohortes, chacun avec un plafond de 120 secondes. Les
sorties, les heures, les journaux intégraux compressés et les codes de sortie
sont conservés. Le supplément n'est applicable qu'après le refus strict
prévu `Within-cohort work metadata changed`, avec code 1 et sortie absente.
Un succès, un autre refus ou une sortie partielle exige une lecture de son
résultat effectif. Aucun échec n'est transformé en succès.

L'analyse vérifie 40 formes finales et 40 signatures complètes, les fenêtres et
leur ordre, toutes les métriques de paires et les 16 métriques groupées.
Le reviewer Python refait les calculs, notamment le seuil strict avec `Decimal`.
`analysis_passed` et `review_passed` portent sur la cohérence des données et des
calculs. `globalBudgetAccepted` est le verdict distinct du budget. Une revue
des artefacts calculée par cet outil ne remplace pas la revue indépendante du
protocole et des résultats par un autre contributeur.

Le budget accepté ne suffit pas à affirmer une isolation ou une publication.
Les preuves du contrôleur, la readiness et la source réellement publiée restent
nécessaires. Aucun nouveau jeu, oracle source ou cas LKEY n'est exécuté.

# Lot 8B : préparation et lecture de la fenêtre officielle 0.67

Ces outils sont une adaptation prospective limitée au candidat BranchRouting
**0.67.0**, digest natif
`c234bb404de43b380e5595cee8ad4ddfcae6e02d0fcc40286546fcf6838dd44a`,
et à la source réellement publiée dans **Site 107 / native 0.66**, commit
`4ff7bf45286a8a19d34401988adca587253ae41e`. Leur rédaction ou leur contrôle de
syntaxe ne constitue aucune mesure ni autorisation de publication.

## Ce qui est conservé

Les sept outils historiques de fenêtre, mesure, comparaison, consolidation et
décision globale restent inchangés. `prepare.py` compare leurs octets avec la
déclaration conservée de `lot3h-evidence/performance`. Les `cases.json` et
`comparison-policy.json` sont copiés octet pour octet depuis ce dossier. Leur
ancien texte de provenance 0.38/0.40 reste historique ; le nouveau contrat
désigne explicitement les deux versions de cette fenêtre.

L'ordre est **A1, B1, B2, A2**. Chaque série exécute STCK puis SMLP, avec une
chauffe de trois actions par jeu, puis quatre sessions avec un runtime neuf et
une mémoire froide. Le worker et le JIT restent ceux du cas dans la série.
STCK comporte dix actions mesurées et deux niveaux effectivement acquis ; sa
cible déclarée de trois niveaux ne constitue pas une réussite à trois niveaux.
SMLP comporte quinze actions et trois niveaux acquis.

La fenêtre conserve **32 sessions mesurées, 400 actions**, ainsi que **huit
chauffes et leurs 24 actions**. Les huit durées de session par jeu/version
sont groupées avant de calculer leur médiane. La condition est strictement
`médiane B < 1,1 × médiane A` pour chaque jeu, sans compensation entre jeux,
exclusion d'une session, exclusion d'une valeur extrême, marge de bruit,
sélection d'une cohorte ou relance automatique. Une phase dépassant +10 %
peut être acceptée lorsque les deux globaux passent ; elle reste visible.

La durée globale du harness est le parcours complet du contrôleur jusqu'au
dernier retour acquis, pauses et reprises incluses. Le démarrage du worker,
`begin`, les inspections terminales et `close` sont hors de cette durée. Le
moteur de jeu, le réseau et le rendu navigateur ne sont pas mesurés. Les phases
sont imbriquées et ne s'additionnent pas. Aucun p95 n'est annoncé pour huit
durées globales ; les phases gardent le p95 historique quand leur effectif
atteint vingt observations.

## Contrat fonctionnel exact avant mesure

Le contrat requiert les **nouvelles formes capturées sur la source finale
0.67**, le nouveau rapport de graphes, l'inventaire de propriétaires et une
revue finale distincte. Les anciens reçus restent `preparedOnly: true`,
`officialPerformanceEligible: false` et `strictCommonGraphParity: false`.
Le contrat ne réécrit ni ces champs ni leurs données. Il copie les quatre
formes finales sans transformer le numéro de version ou les compteurs.

Les cas fonctionnels ont un schéma distinct des cas officiels. Leur liaison
porte explicitement sur les six champs `id`, `trace`, `traceSha256`, `actions`,
`targetLevels` et `warmupActions`, dans le même ordre. Aucune identité des
deux fichiers de cas n'est prétendue.

Chaque future session et chauffe doit correspondre exactement à la forme
capturée de son rôle : actions, cycles, niveaux, requêtes, observations,
inspections et état final, numéro natif compris. Le `workSignature` historique
complet vérifie également les appels de phases, leur placement, les pauses et
les échantillons mémoire hors valeurs d'allocation. Les signatures sont exactes
dans chaque version, entre les répétitions et les cohortes. Entre versions,
seuls les quatre chemins suivants admettent les valeurs exactes observées avant
la mesure :

- `observations[*].nodeCount` ;
- `inspection[*].graphNodes` ;
- `final.nodeCount` ;
- `final.graphRevision`.

La preuve correspondante attribue seulement l'ajout de `branch_routing`, sans
programme installé supplémentaire, et exige zéro différence non attribuée.
Cette attribution ne prouve aucune acquisition BranchRouting positive sur
STCK/SMLP. La contribution native synthétique conserve sa preuve séparée.

La revue finale fournie à `--functional-review` doit porter ce contrat minimal
(les empreintes sont calculées sur les fichiers réels, jamais préremplies) :

```json
{
  "schema": "logos-engine.lot8b-final-functional-review.v1",
  "status": "passed",
  "nativeDigests": { "baseline": "…", "candidate": "…" },
  "workForms": { "path": "…", "bytes": 0, "sha256": "…" },
  "graphReview": { "path": "…", "bytes": 0, "sha256": "…" },
  "blockingObjections": []
}
```

## Préparation, sans exécution native

Les chemins ci-dessous sont choisis par le responsable après création des
fichiers réels. `--output-directory` doit désigner un **nouveau** sous-dossier
de `lot8b-evidence`, absent dans les deux checkouts.

```text
python -B docs/migration/lot8b-evidence/tools/final-cost/prepare.py
  --baseline-checkout /workspace/sites/sra-lot8b-baseline066-20261112
  --baseline-manifest CHEMIN_MANIFESTE_A
  --candidate-manifest CHEMIN_MANIFESTE_B_FINAL
  --reconciliation CHEMIN_RECONCILIATION_FINALE
  --work-forms CHEMIN_FORMES_FINALES
  --graph-review CHEMIN_REVUE_GRAPHES_FINAUX
  --owner-inventory CHEMIN_INVENTAIRE_FINAL
  --functional-review CHEMIN_REVUE_FONCTIONNELLE_FINALE
  --output-directory NOUVEAU_DOSSIER_PERFORMANCE
```

Cette commande vérifie les sources réellement présentes et commitées, les
captures, les manifestes, les outils, les entrées et les liens entre preuves.
Elle crée `contract.json`, `expected-forms.json`, `protocol.md` et les deux
entrées historiques. Le contrat contient l'intégralité des empreintes
prospectives et la commande exacte du runner. Il **n'établit ni readiness ni
isolation**. Une revue de préparation et un commit de sauvegarde précèdent
la mesure.

## Fenêtre bornée, sous le contrôleur séparé

Le runner historique n'acquiert aucun verrou et n'a pas de délai global.
Le responsable utilise le contrôleur distinct `tools/final-coordination` avec
ses entrées effectivement figées, sa readiness, son acquisition exclusive
non bloquante et sa supervision de tout le groupe de processus. Le plafond
proposé est 1800 secondes actives ; le plan du contrôleur fixe séparément ses
réserves de fermeture et de conservation. Les fenêtres historiques 7B, 6A et
10B ont pris environ neuf minutes ; cette observation ne prédit pas la durée
du candidat.

Aucune attente de disponibilité des autres lots ni verrou global ne s'applique
aux préparations, tests, compilations, commits ou sauvegardes de branche.
L'exclusivité porte uniquement sur la mesure elle-même. Le contrôleur doit
décrire la portée réelle de l'isolation ; le verrou seul ne prouve pas
l'absence d'autres travaux. Il ferme uniquement ses propres descripteurs et
ne supprime jamais le fichier verrou. LKEY reste fermé.

## Analyses après la libération du verrou

`postprocess.py` exécute uniquement les deux comparateurs de paires historiques
et le comparateur strict de cohortes, chacun avec un plafond de 120 secondes.
Les journaux stdout/stderr complets sont compressés sans modification des
octets. Les reçus conservent les vraies commandes, empreintes, heures, sorties
et codes de sortie. Une erreur laisse les résultats présents ; aucune relance
automatique ni réécriture n'est prévue.

```text
python -B docs/migration/lot8b-evidence/tools/final-cost/postprocess.py DOSSIER/contract.json
node docs/migration/lot8b-evidence/tools/final-cost/analyze.mjs DOSSIER/contract.json DOSSIER/strict.execution.json DOSSIER/analysis.json
python -B docs/migration/lot8b-evidence/tools/final-cost/review.py DOSSIER/contract.json DOSSIER/analysis.json DOSSIER/independent-review.json
```

Le chemin complémentaire n'est applicable qu'après un **refus effectivement
observé** du comparateur strict portant le message `Within-cohort work metadata
changed`, avec sortie absente. Un succès strict, un autre refus ou une sortie
partielle exigent l'examen du résultat réel ; ils ne sont pas reclassés. Les
nouveaux outils ne modifient aucun outil historique et n'inventent pas son
résultat.

Le calculateur JavaScript importe les fonctions arithmétiques et de signature
historiques inchangées. Il vérifie chaque forme et la signature complète des
40 essais, les fenêtres et leur ordre, les 32 métriques des deux comparaisons
de paires et les 16 métriques groupées. Le reviewer Python refait les calculs
avec la bibliothèque standard, notamment le seuil strict avec `Decimal`.
Les deux sorties conservent tous les temps de session, les diagnostics de
phases et le refus historique. `analysis_passed` ou `review_passed` signifie
que les données et les calculs vérifiés concordent ; le verdict de budget
distinct est `globalBudgetAccepted`.

Un budget global accepté ne suffit pas à établir l'isolation, la qualification
fonctionnelle complète ou la publication. Le responsable rapproche ces reçus
du contrôleur, de la readiness et du gel final. Aucune mesure du moteur réel,
réussite de jeu, parité complète du caller ou propriété de longue durée n'est
déduite de cette fenêtre finie.

# Préparation fonctionnelle des formes communes 8B

Ces trois outils adaptent explicitement les outils conservés de 8A. Ils préparent une comparaison fonctionnelle entre **la source réellement publiée dans Site 107 / native 0.66** et le candidat BranchRouting. Leur auteur a effectué une lecture statique et un examen des différences, sans lancer ces scripts, leurs imports natifs, un test ou un contrôle de syntaxe. Le propriétaire de la qualification décide et supervise les exécutions après gel.

## Identités attendues

| Rôle | Checkout | Source et identité native canonique |
| --- | --- | --- |
| Publié | `/workspace/sites/sra-lot8b-baseline066-20261112` | HEAD exact `4ff7bf45286a8a19d34401988adca587253ae41e` ; 329 fichiers ; `ab674682f3345b09bec94959174fbb5bf0f1bd06154693697e5814987b572316` |
| Candidat | `/workspace/sites/sra-lot8b-branch-routing-20261112/.sites-checkout` | HEAD enregistré par chaque commande ; 331 fichiers ; `3ff1d9ad56e22aedc0fee3a0da6a3af50a1da0bc14a0ba01cb38272ba85234be` |

Les deux sources conservent le littéral `0.66.0`. Seuls le rôle publié, le commit, les familles et les octets permettent de les distinguer. Le candidat ne devient pas publié par cette qualification.

Le digest canonique trie les chemins relatifs complets avant de sérialiser la table chemin → SHA-256. Le digest historique 8B `76a403016d2b28287194b7498f10e14727b7e3fb3f214d2f79cb0292390d54bf` utilisait l'ordre des composants de chemins Python. La réconciliation du propriétaire établit l'identité de la table des 331 fichiers ; les nouveaux outils emploient uniquement l'ordre canonique déclaré et ne réécrivent pas les anciens reçus.

Les manifests fournis à la capture contiennent exactement `fileCount`, `digest` et `files`. Les fichiers préparés sont `docs/migration/lot8b-evidence/delivery-qualification-01/baseline-native.json` et `candidate-native.json`. Les HEAD doivent rester stables entre inventaire et captures ; la comparaison exige leur identité entre les reçus.

## Adaptations délimitées

- **Inventaire :** les vraies factories et leurs programmes sont lus sans initialiser de session. `branch_routing` doit être l'unique propriétaire ajouté, juste après `motif_access`. Aucun propriétaire ou programme existant ne peut disparaître ; l'ordre des autres propriétaires et les registrations des programmes restent exacts.
- **Capture :** Binding, SelectedRigid, Motif et OrderedRecruitment sont présents dans les deux rôles. BranchRouting est présent uniquement dans le candidat. Motif et BranchRouting sont observés sur leurs wrappers enregistrés réels. OrderedRecruitment est observé sur l'instance d'acquisition enregistrée réelle, y compris `recordSource` passif, `nativeState`, restauration et refus courants. Les méthodes originales reçoivent les mêmes arguments ; aucun état de remplacement n'est injecté.
- **Qualification :** chaque graphe est reconstruit depuis ses deltas complets, vérifié avec le Kernel et le store propres à son rôle, puis ses racines modifiées sont hydratées. Les checkpoints sont rattachés aux vrais appels observés. Les faits `motif:<revision>` et `branches:<revision>` sont rapprochés des acquisitions sélectionnées réussies. Les compteurs de retours ne sont pas assimilés à des acquisitions réussies.

L'inventaire et la capture épinglent aussi leurs outils 8A d'origine. Le lecteur vérifie ses propres dépendances, celles des captures, les codecs communs, les validateurs par rôle, les déclarations source, les manifests et les entrées avant/après. Le harness `scripts/measure-native-loop-costs.mjs` est uniquement fingerprinté pour lier la forme historique ; il n'est pas exécuté par ces outils.

## Formes annoncées

Le nouveau `cases.json` est une déclaration **fonctionnelle**. Il reprend uniquement l'ordre des deux cas, leurs traces et hashes, les actions, les trois actions de préparation et les niveaux cibles du manifest 6B `functional-805b`. L'ancien budget 0.38/0.40 et son nombre de répétitions ne sont pas repris.

Par rôle, quatre sessions partent de froid : STCK à 3 et 10 actions, puis SMLP à 3 et 15 actions, soit **31 retours enregistrés**. Les formes complètes ont trois inspections terminales réelles ; les formes de préparation n'en ont pas. Les libellés historiques `warmup` et `measured` identifient ces deux formes : aucun coût n'est mesuré ici. Chaque commande doit être exactement celle de la trace avant que son retour public soit fourni. Le moteur de jeu, un payload de jeu et une solution ne sont pas utilisés.

Les observations de l'horloge réelle encadrent chaque appel au service. L'attribution d'horloge est strictement limitée au scalaire `/value/root/members/created`, ou à son encodage float64 exact, d'un nœud `reasoning:trace:<id>` dont l'identité, le code horloge, la construction et les bornes réelles d'appel ont été vérifiés. Tous les hashes bruts et les fragments restent vérifiés. Aucune suppression générique de timestamp, omission de `node.value` ou normalisation des graphes n'est ajoutée.

Toutes les différences de valeurs communes, de population et d'ordre/identité/cause des deltas sont conservées dans le fichier `.differences.jsonl.gz`. Les seuls nouveaux nœuds attribuables d'emblée à BranchRouting sont ses deux racines déclarées et leurs fragments atteignables vérifiés. Une différence privée restante demeure explicitement non qualifiée. Les états et graphes des quatre propriétaires préexistants sont comparés entre rôles.

## CLI proposée au propriétaire

Les commandes suivantes sont prospectives et n'ont pas été lancées par l'auteur. Le propriétaire doit geler les entrées et utiliser son superviseur borné. Proposition de limites : **120 secondes pour l'inventaire, 600 secondes pour chaque capture et 900 secondes pour le lecteur**, avec `NODE_OPTIONS=--max-old-space-size=1536` pour la préparation fonctionnelle. Les scripts ne remplacent pas la supervision du groupe de processus. Ces bornes ne constituent ni une limite de production ni un protocole de coût officiel.

Depuis le checkout candidat, préparer un nouveau répertoire d'essai et y copier le `cases.json` de ce répertoire, sans reprendre l'ancien budget :

```bash
mkdir docs/migration/lot8b-evidence/delivery-qualification-01/work-forms-01
cp docs/migration/lot8b-evidence/tools/delivery/work-forms/cases.json docs/migration/lot8b-evidence/delivery-qualification-01/work-forms-01/cases.json
```

Exécuter ensuite les quatre commandes séparément, sous le superviseur du propriétaire :

```bash
node docs/migration/lot8b-evidence/tools/delivery/work-forms/record-owner-source-inventory.mjs \
  /workspace/sites/sra-lot8b-baseline066-20261112 \
  /workspace/sites/sra-lot8b-branch-routing-20261112/.sites-checkout \
  docs/migration/lot8b-evidence/delivery-qualification-01/work-forms-01/owner-source-inventory.json

node docs/migration/lot8b-evidence/tools/delivery/work-forms/capture-cost-owner-graphs.mjs baseline \
  /workspace/sites/sra-lot8b-baseline066-20261112 \
  docs/migration/lot8b-evidence/delivery-qualification-01/work-forms-01/cases.json \
  docs/migration/lot8b-evidence/delivery-qualification-01/baseline-native.json \
  docs/migration/lot8b-evidence/delivery-qualification-01/work-forms-01/baseline.json.gz

node docs/migration/lot8b-evidence/tools/delivery/work-forms/capture-cost-owner-graphs.mjs candidate \
  /workspace/sites/sra-lot8b-branch-routing-20261112/.sites-checkout \
  docs/migration/lot8b-evidence/delivery-qualification-01/work-forms-01/cases.json \
  docs/migration/lot8b-evidence/delivery-qualification-01/candidate-native.json \
  docs/migration/lot8b-evidence/delivery-qualification-01/work-forms-01/candidate.json.gz

node docs/migration/lot8b-evidence/tools/delivery/work-forms/qualify-cost-owner-graphs.mjs \
  docs/migration/lot8b-evidence/delivery-qualification-01/work-forms-01/owner-source-inventory.json \
  docs/migration/lot8b-evidence/delivery-qualification-01/work-forms-01/baseline.json.gz \
  docs/migration/lot8b-evidence/delivery-qualification-01/work-forms-01/baseline.receipt.json \
  docs/migration/lot8b-evidence/delivery-qualification-01/work-forms-01/candidate.json.gz \
  docs/migration/lot8b-evidence/delivery-qualification-01/work-forms-01/candidate.receipt.json \
  docs/migration/lot8b-evidence/delivery-qualification-01/work-forms-01/graph-review.json \
  docs/migration/lot8b-evidence/delivery-qualification-01/work-forms-01/work-forms.json
```

Les sorties sont créées exclusivement, sans écrasement. Toute tentative échouée doit rester dans son répertoire avec les sorties brutes du superviseur. Un succès de processus peut établir `qualified_functional_work_forms_and_individual_graphs` tout en conservant `privateComparison: unattributed_differences_retained_strict_qualification_pending`. Les deux champs doivent être lus ; le seul code de sortie ne suffit pas à une acceptation stricte.

## Portée de la contribution

La présence du propriétaire, un modèle détecté, un changement d'époque ou une proposition négative n'établissent pas une acquisition positive BranchRouting. Les présentes formes sont des régressions de travail commun ; la preuve positive repose séparément sur les chaînes synthétiques froides sélectionnées, leurs retours, les faits acquis, la restauration, l'effet contraire et l'ablation. Même une acquisition synthétique exacte, `finished: true` ou un score de fixture ne constitue pas une réussite officielle de jeu.

Les sorties restent `officialPerformanceEligible: false`, `preparedOnly: true` et `strictCommonGraphParity: false`. Elles n'autorisent aucune mesure officielle, attribution de performance, parité complète du caller ou publication. La règle future de coût porte sur la médiane des sessions complètes strictement sous +10 % pour chaque jeu séparément ; les temps de ces scripts n'en sont pas des échantillons. Aucun verrou n'est ouvert par ces outils.

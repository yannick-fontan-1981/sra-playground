# C2 — clôture des dettes donneuses OP29 / OP30 / OP31

Référence stable : `docs/migration/op01-op31-verification-plan.md`

Source examinée : runtime Python V6 publié au commit
`786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`.

Cette note complète `op01-op31-c2-donor-consumption.md`.

## Recherche effectuée

Une recherche ciblée a été menée dans les fichiers V6 susceptibles de consommer :
- résultats d'opération ;
- mémoire persistée ;
- objectifs/assessments ;
- retours/reconcile ;
- décisions/compositions.

Ont notamment été inspectés :
- `composition.py`
- `composition_benchmark.py`
- `composition_cases.py`
- `attention_memory.py`
- `catalogue_view_memory.py`
- `common_observed_compositions.py`
- `common_metric_composition.py`
- `common_program_composition.py`
- `observed_program_effects.py`
- `effect_access.py`
- `program_composition_access.py`
- `target_method.py`
- `target_tree.py`
- `terminal_composition.py`
- `factored_return.py`
- `return_fork.py`
- autres fichiers V6 portant memory/result/outcome/goal/target/effect dans leur rôle.

La recherche a porté sur :
- `OP29`, `OP30`, `OP31` ;
- `operation_result` ;
- `objective_assessments` ;
- `knowledge:` ;
- `memory.get(...)` / `memory.put(...)`.

## OP29 — disposition donneuse

Constat :
- calcul tri-état présent ;
- résultat placé dans `decision.operation_result` ;
- résultat retourné par le rapport du bridge ;
- aucune branche spécialisée de consommation trouvée dans les fichiers inspectés.

Disposition donneuse :
**information_only**.

Cela ne signifie pas que l'opération est inutile en architecture générale.
Cela signifie que, dans le runtime V6 publié examiné, aucune contribution
décisionnelle interne n'est démontrée après le calcul.

## OP30 — disposition donneuse

Constat :
- calcul filtre les updates par focus, preuve et révision courante ;
- `CompositionEngine.persist()` écrit chaque update retenue sous :
  `knowledge:<composition_ref>:<property>` ;
- valeur, preuve et révision sont persistées ;
- le benchmark ne relit pas cette clé malgré son commentaire ;
- aucune lecture ultérieure de `knowledge:` n'a été trouvée dans les fichiers V6 inspectés.

Disposition donneuse :
**persisted_only**.

Contribution démontrée :
- écriture durable de connaissance.

Contribution non démontrée :
- lecture ultérieure ;
- effet sur sélection, garde, stratégie, objectif ou plan ;
- restauration/reopen de la clé de connaissance elle-même.

Dette minimale restante :
1. dans le port TypeScript, vérifier si un lecteur existe ;
2. sinon conserver explicitement `persisted_only` ;
3. si une lecture est ajoutée, prouver son effet décisionnel et son coût.

## OP31 — disposition donneuse

Constat :
- calcul des assessments présent ;
- résultat placé dans `decision.operation_result` ;
- aucun propriétaire d'objectif consommant ces assessments n'a été identifié
  dans les fichiers V6 inspectés.

Disposition donneuse :
**information_only**.

Aucun effet maintien / fin / suspension / réorientation n'est démontré dans le donneur publié.

## Impact sur C2

Dispositions donneuses finales provisoires :

| OP | Disposition |
| --- | --- |
| OP18 | contribution à la garde de release démontrée |
| OP28 | contribution à la garde de release démontrée |
| OP29 | information_only |
| OP30 | persisted_only |
| OP31 | information_only |

Le port TypeScript devra être audité sans présumer qu'il reproduit exactement
ces dispositions. Mais il devra au minimum éviter d'attribuer à OP29/31 une
autorité décisionnelle non démontrée et à OP30 un apprentissage consommé sans lecteur réel.

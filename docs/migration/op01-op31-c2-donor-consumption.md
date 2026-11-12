# C2 — consommation réelle des OP18, OP28, OP29, OP30 et OP31 dans le donneur V6

Référence stable : `docs/migration/op01-op31-verification-plan.md`

Source examinée : runtime Python V6 publié au commit
`786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`.

Ce document qualifie seulement ce que le donneur V6 démontre réellement.
Le port TypeScript du chantier reste à instrumenter séparément.

## OP18 — Explorer

### Chaîne démontrée dans le donneur

Besoin :
- une question ouverte motive une expérience ou un accès encore non observé.

Producteurs réels observés :
- `AlternatingGraphAccess.propose()` ;
- `PassageOptions.propose()` ;
- `CellPlacementAccess.propose()` ;
- `GoalAccessAdapter.propose()`.

Données produites :
- composition ;
- `open_question` / question ;
- actions ;
- préconditions/faits ;
- preuves ;
- liaison époque/observation ;
- `bundle_template.operation_key = OP18`.

Appel :
- `CompositionEngine.src_apply()` construit le focus puis exécute
  `execute(bundle.operation_key, facts)`.

Consommation :
- `operation_admission()` exige que le résultat OP18 contienne la référence
  de composition attendue ;
- `guard_satisfied` combine l'admission du bundle et cette admission par résultat ;
- `src_release()` refuse sans `release_allowed`.

Effet :
- le résultat OP18 contribue réellement à la garde de release physique.

Limite :
- cela démontre une contribution de garde, pas que chaque expérience OP18 est
  stratégiquement utile ;
- la pertinence de la question et le choix entre expériences restent des
  responsabilités de producteurs/décideurs en amont.

Disposition donneuse :
**usage consommé et contribution à la garde de release démontrés**.

## OP28 — Réaliser

### Chaîne démontrée

Besoin :
- réaliser une composition via un bundle courant déjà admis et non vide.

Calcul :
- OP28 retourne uniquement les bundles du focus ayant `admitted is True`
  et des actions non vides.

Consommation :
- `operation_admission()` attend pour OP28 l'identifiant exact du bundle ;
- l'outcome guard doit être exactement `value contains bundle.id` ;
- `guard_satisfied` exige aussi `validate_bundle()` vrai.

Effet :
- sans sélection OP28 effective du bundle, la release n'est pas autorisée.

Disposition donneuse :
**usage consommé et contribution à la garde de release démontrés**.

Risque de redondance à tester dans le port :
- OP28 répète une partie de l'admission déjà portée par le bundle ;
- sa contribution propre est néanmoins réelle dans le donneur parce que
  `operation_admission()` exige explicitement le résultat OP28.

## OP29 — Comparer

### Calcul démontré

Entrées :
- `expected_properties` ;
- `observed_properties`.

Sortie :
- `confirmed` si présent et égal ;
- `refuted` si présent et différent ;
- `unknown` si la propriété attendue n'est pas observée.

### Consommation examinée

Dans `CompositionEngine.src_apply()`, un bundle `kind == analysis` :
- exécute OP29 ;
- place le résultat dans `decision.operation_result` ;
- termine avec `status = composition_analysis`.

Dans `CompositionEngine.persist()` :
- aucune branche spécialisée OP29.

Dans `SrcBridge.run()` :
- le résultat final est exposé dans `report.decision` ;
- aucun traitement OP29 supplémentaire n'est effectué avant retour.

Disposition donneuse actuelle :
**calcul et résultat exposé, mais aucun consommateur décisionnel interne démontré**.

Le résultat peut donc être classé `information_only` dans le cœur examiné,
sauf preuve d'un lecteur externe du rapport.

## OP30 — Réviser

### Calcul démontré

OP30 filtre les `knowledge_updates` :
- même composition que le focus ;
- preuve présente ;
- révision égale à la révision d'observation courante.

### Consommateur réel

`CompositionEngine.persist()` possède une branche spécifique :
- décision `composition_analysis` ;
- bundle OP30 sélectionné ;
- pour chaque update retenu, écriture
  `knowledge:<composition_ref>:<property>` dans la mémoire ;
- valeur, preuve et révision sont conservées.

Disposition donneuse :
**résultat consommé et écriture de connaissance démontrée**.

### Limite importante de preuve

Le benchmark `composition_benchmark.py` contient le commentaire :
« Reopen the DB and retrieve a composition contract and an OP30 update. »

Mais le code qui suit :
1. relit seulement `composition_contract` ;
2. ferme/réouvre la base ;
3. relit encore seulement `composition_contract`.

Il ne relit pas la clé `knowledge:B:color` attendue du cas OP30.

Donc :
- le code de persistance OP30 existe ;
- la survie de la mise à jour OP30 après reopen **n'est pas réellement vérifiée**
  par ce contrôle malgré son commentaire ;
- aucune lecture ultérieure de cette connaissance pour une décision n'est
  démontrée dans les fichiers examinés.

Disposition complète :
**consommation/persistance démontrée ; contribution décisionnelle future et test de restauration encore ouverts**.

## OP31 — Réexaminer

### Calcul démontré

OP31 restitue des `objective_assessments` avec :
- `composition_ref` ;
- `satisfied` ;
- `feasible` ;
- `new_evidence`.

Les champs inconnus restent `unknown`.

### Consommation examinée

Comme OP29 :
- le résultat est placé dans `decision.operation_result` ;
- le bundle d'analyse termine avec `composition_analysis` ;
- aucune branche OP31 n'existe dans `persist()` ;
- `SrcBridge.run()` retourne le rapport sans réexamen spécialisé supplémentaire.

Disposition donneuse actuelle :
**calcul et résultat exposé, mais aucun consommateur de maintien/fin/suspension/réorientation démontré**.

## Tests et scénarios existants

`composition_cases.py` contient des cas synthétiques OP29, OP30 et OP31 :
- OP29 vérifie confirmed/refuted/unknown ;
- OP30 conserve une update de révision courante et rejette une ancienne ;
- OP31 conserve une assessment avec faisabilité unknown.

Ces cas établissent la sémantique du calcul et le routage de choix, pas une
contribution en partie.

`composition_benchmark.py::official_probe()` démontre pour OP18 :
- choix d'un probe borné ;
- release via SRC ;
- exécution réelle de commandes officielles LS20 ;
- retour conservé explicitement avec interprétation `unknown`.

Il précise lui-même qu'il s'agit d'une calibration bornée, pas d'un solveur L1.

## Dispositions C2 donneuses

| OP | Calcul | Appel | Consommation | Contribution démontrée |
| --- | --- | --- | --- | --- |
| OP18 | oui | oui | oui, admission/release | oui, garde physique |
| OP28 | oui | oui | oui, admission/release | oui, garde physique |
| OP29 | oui | oui | résultat exposé seulement | non démontrée |
| OP30 | oui | oui | oui, persist mémoire | écriture démontrée ; décision future non |
| OP31 | oui | oui | résultat exposé seulement | non démontrée |

## Prochaines preuves nécessaires

1. Port TypeScript : reproduire ces distinctions avec instrumentation C1.
2. OP29 : identifier un lecteur qui modifie garde/modèle/plan, sinon conserver `information_only`.
3. OP30 :
   - tester `knowledge:B:color` après reopen/restauration ;
   - montrer une lecture ultérieure qui influence ou maintient une décision.
4. OP31 : identifier le propriétaire d'objectif qui consomme l'assessment,
   sinon conserver `information_only`.
5. Mesurer le coût uniquement après raccordement du port réel.

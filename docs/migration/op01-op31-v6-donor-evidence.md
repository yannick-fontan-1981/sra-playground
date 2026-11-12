# Preuves donneuses V6 pour l'audit OP01 à OP31

Référence de travail : `docs/migration/op01-op31-verification-plan.md`

Ce document conserve des preuves du runtime Python V6 publié au commit
`786dcf51ca57773d8e3a8948ce9ea3655e7baf8e` du dépôt privé
`yannick-fontan-1981/ARC-AGI-3-Yannick-Fontan`.

Ces preuves servent à comprendre les producteurs et consommateurs historiques.
Elles ne remplacent pas la qualification du runtime TypeScript `src/logos-engine/v6-*`
du chantier sra-playground et ne sont pas comptées comme exécution observée de ce port.

## 1. Implémentation des 31 OP

Fichier donneur : `agents/yf_arc3_v6/laya_proto/operations.py`.

La fonction `execute(key, state)` possède une branche explicite OP01 à OP31.
Le résultat est étiqueté `complete_on_supplied_state` et `synthetic_scope=True`.

Points de contrat directement visibles :
- OP03 calcule les préconditions du focus via les faits fournis et conserve `unknown`.
- OP12 parcourt les dépendances et conserve les conditions inconnues.
- OP13 marque l'étendue non observée `unknown`.
- OP20/OP21 filtrent les utilités `unknown`.
- OP24 exige `constraints_verified is True`.
- OP25 conserve les candidats dont la faisabilité n'est pas `refuted`.
- OP28 ne sélectionne que des bundles du focus avec `admitted is True` et actions non vides.
- OP29 produit confirmed/refuted/unknown selon la présence et la valeur observée.
- OP30 filtre les `knowledge_updates` du focus.
- OP31 restitue satisfaction/faisabilité et nouvelles preuves, avec `unknown` par défaut.

## 2. Admission et release

Fichier donneur : `agents/yf_arc3_v6/laya_proto/composition.py`.

### Validation du bundle

`validate_bundle()` exige notamment :
- identité du bundle ;
- `operation_key`, `composition_ref`, `objective_ref`, `preserve_refs` ;
- révision d'observation exacte ;
- kind analysis/realize/probe ;
- actions bornées pour les opérations physiques ;
- préconditions satisfaites par les faits ;
- preuves de préservation pour tous les `preserve_refs` ;
- preuve non vide.

### Admission par résultat réel

`operation_admission()` lie la release physique au **résultat de l'opération** et non à la seule invocation.
Le contrat physique explicite du donneur accepte OP14, OP18 et OP28.
L'opération doit sélectionner la référence attendue et satisfaire son `outcome_guard`.

### Exécution

`src_apply()` :
1. vérifie que le choix appartient aux candidats et à la même Source ;
2. récupère le bundle sélectionné ;
3. exécute `execute(bundle.operation_key, facts)` ;
4. pour un bundle d'analyse : termine avec `composition_analysis` ;
5. sinon appelle `operation_admission()` ;
6. `guard_satisfied` n'est vrai que si l'admission du bundle **et** l'admission par résultat sont vraies ;
7. passe ensuite en phase release.

`src_release()` refuse la release sans `release_allowed`, puis publie seulement le bundle sélectionné comme action set.

Cette chaîne donneuse démontre donc une consommation effective du résultat pour la garde de release pour les OP physiques explicitement admises.

## 3. Producteur réel OP18

Fichier donneur :
`agents/yf_arc3_v6/laya_proto/alternating_graph_access.py`.

`AlternatingGraphAccess.propose()` construit un besoin spécialisé de type accès graphe mesuré :
- observation et `level_epoch` ;
- question instrumentale / `open_question` ;
- plan et actions ;
- faits de précondition ;
- preuves ;
- composition candidate ;
- `bundle_template.operation_key = OP18` ;
- objectif `G_official_completion` ;
- outcome guard.

La méthode `admit()` revalide ensuite le contexte courant, l'acteur et la commande.
La méthode `evaluate()` compare le déplacement observé et borne les effets supplémentaires.
La méthode `record()` conserve notamment les contacts dont l'occlusion ou la suppression reste inconnue.

Disposition donneuse :
**OP18 possède au moins un producteur spécialisé réel avec question, données, actions, preuve et revalidation.**
Cela ne prouve pas que tous les appels OP18 sont utiles ni que le port TypeScript consomme exactement les mêmes champs.

## 4. Consommateur réel OP30

Fichier donneur : `agents/yf_arc3_v6/laya_proto/composition.py`.

`persist()` traite explicitement une décision :
- `status == composition_analysis` ;
- bundle sélectionné avec `operation_key == OP30`.

Pour chaque élément de `decision.operation_result.value`, il écrit ensuite dans la mémoire :
- clé `knowledge:<composition_ref>:<property>` ;
- valeur ;
- preuve ;
- révision.

Disposition donneuse :
**OP30 a un consommateur de persistance réel dans le moteur Python V6.**
La preuve de contribution à une décision ultérieure reste distincte : il faudra montrer qu'une lecture de cette connaissance modifie ou garde une décision pertinente.

## 5. OP29 et OP31

Dans le cœur `composition.py` examiné, aucune lecture spécialisée d'OP29 ou OP31 analogue à la branche OP30 de `persist()` n'a été trouvée.

Disposition provisoire donneuse :
- OP29 : calcul et retour présents ; consommateur décisionnel non établi par ce fichier.
- OP31 : calcul et retour présents ; consommateur décisionnel non établi par ce fichier.

Cette absence locale n'est pas une preuve d'absence globale. C1/C2 doit rechercher leurs lecteurs dans le port TypeScript et dans les autres consommateurs V6 pertinents.

## 6. OP03, OP08, OP12, OP26 et fonctions spécialisées

Le donneur V6 expose de nombreuses fonctions spécialisées de stratégie et d'accès.
Exemples déjà observés :
- `strategy.py` orchestre des sous-questions de goal access, material access, information goals et plusieurs fournisseurs spécialisés ;
- `alternating_graph_questions.py` construit un préfixe borné jusqu'au premier contact à partir d'un graphe observé et conserve l'incomplétude ;
- `alternating_graph_access.py` produit et revalide un accès mesuré.

Ces fonctions sont des candidats à l'équivalence spécialisée pour certains besoins OP08/OP12/OP26.
Aucune équivalence exacte n'est encore déclarée : chaque cas devra établir même besoin, mêmes données essentielles, mêmes inconnues et même consommateur avant de conclure qu'une OP serait redondante.

## 7. Conséquences pour C1/C2

La chaîne témoin peut maintenant être instrumentée avec des points précis :
- avant `propose()` : signal de besoin ;
- après construction du `bundle_template` : données produites ;
- dans `src_apply()` : exécution de l'OP et résultat ;
- dans `operation_admission()` : consommation pour garde de release ;
- dans `src_release()` : effet physique autorisé ;
- dans `persist()` : consommation OP30 et écriture de connaissance.

Pour OP29 et OP31, le test C2 doit explicitement accepter le résultat
« appel/calcul observé mais aucun consommateur décisionnel trouvé » si la recherche du port réel confirme ce constat.

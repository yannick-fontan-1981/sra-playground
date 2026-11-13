# Lot 5 — rebase sur la reconstruction Site 109

Date : 2026-11-12

## Base canonique

Branche source canonique :
- `recovery/site109-reconstruction-20261112`
- SHA de départ : `658b89cfe77887eb720c95f0e6e6f8595beffdbd`

Branche de travail Lot 5 :
- `recovery/lot5-site109-rebase-20261112`

Ancienne branche de récupération comparée :
- `recovery/lot5-canonical-buffer`

Comparaison GitHub :
- statut : diverged ;
- ancienne branche : 11 commits en avance, 49 en retard ;
- merge-base : `8f8b179718d06a51dc8818deb68c977cd5e1e820`.

## Déjà présent dans la baseline

Le nouveau socle canonique contient déjà :
- `src/logos-engine/v6-operations.ts`
- `src/logos-engine/v6-composition-engine.ts`
- `src/logos-engine/v6-native-authority.ts`
- `src/logos-engine/v6-target-binding.ts`
- `src/logos-engine/v6-operation-cache.ts`
- `src/logos-engine/v6-operation-cycle.ts`
- `src/logos-engine/v6-operation-trace.ts`
- les tests associés OP/composition/authority/cache/cycle/trace/target-binding.

Ces fichiers restent autoritaires pour le moteur OP reconstruit et ne sont pas remplacés par le Lot 5.

## Récupéré avec preuve et porté

Les six fichiers Lot 5 ci-dessous étaient absents de la nouvelle baseline, présents dans l'ancienne branche de récupération, et leur provenance donneur V6 est documentée.

### 5A — linked temporal preparation

Port :
- `src/logos-engine/linked-preparation.ts`
- `tests/linked-preparation.test.ts`

Donneur Git autoritatif :
- repo `yannick-fontan-1981/ARC-AGI-3-Yannick-Fontan`
- branche `codex/v6-combined-publication`
- commit inspecté `a911106d318e79f498cccf302c54149d12cfbfeb`
- source `agents/yf_arc3_v6/laya_proto/common_linked_preparation.py`

### 5B — addressed material wrapper

Port :
- `src/logos-engine/addressed-material.ts`
- `tests/addressed-material.test.ts`

Donneurs :
- `agents/yf_arc3_v6/laya_proto/common_addressed_material.py`
- `agents/yf_arc3_v6/laya_proto/common_addressed_field.py`

Port actuel : wrapper de complétion d'observation seulement. Le cœur `AddressedField` n'est pas encore porté.

### 5C — observed object binding continuity

Port :
- `src/logos-engine/observed-object-binding.ts`
- `tests/observed-object-binding.test.ts`

Donneurs :
- `agents/yf_arc3_v6/morphology_policy/guarded_binding/family.py`
- `binding.src`
- `binding.drm`

Port actuel : continuité/persistance du parent seulement. Géométrie, génération d'offres et planification restent à reconstruire.

Commit GitHub ayant porté les six fichiers depuis l'ancienne branche :
- `63970b5e65dc0cbc34f99a352bcaeb815454d127`

## Éléments de l'ancienne branche non portés

Non Lot 5 :
- `src/agent-product-dispatch.ts`
- `tests/agent-product-dispatch.test.ts`
- `docs/migration/lot6c-recovery.md`

Ils appartiennent au Lot 6C et restent sur sa branche.

Documentation historique :
- `docs/migration/lot5-recovery.md`

Elle n'est pas reprise telle quelle car la nouvelle gouvernance GitHub et le présent document la remplacent pour cette reconstruction.

## Manquant

Encore absent ou incomplet sur la branche Lot 5 :
- cœur `AddressedField` ;
- géométrie/planning complet `ObservedBinding` ;
- intégration effective de 5A/5B/5C dans un runtime/worker commun ;
- `canonical.ts` / `immutableJson` historique ;
- `scripts/measure-native-loop-costs.mjs` ;
- campagnes officielles STCK/SMLP.

## Seulement documenté, non reconstructible exactement à ce stade

Le candidat historique canonical-buffer est documenté mais son diff exact n'est pas récupéré :
- checkpoint intermédiaire historique : `0654dcd7109e9b67b41f3d00dbc060ee6cdde79f` ;
- checkpoint final historique : `d1199006fb990d049611136ea1af9a64f388d8de` ;
- Site 109 historique : native 0.68, 70/76 ;
- SHA Site historique : `d90ce5b64fffa53cca201e2a6a49450fd123f299`, non résolu dans le GitHub accessible.

Aucune équivalence exacte avec Site 109 n'est revendiquée.

## 5B — garde d'adresse et de contexte récupérée

Donneur :
- `agents/yf_arc3_v6/laya_proto/common_addressed_field.py`
- méthodes récupérées : `footprint_matches`, `before`, `after`.

Port :
- `src/logos-engine/addressed-field-guard.ts`
- `tests/addressed-field-guard.test.ts`

Comportement couvert :
- empreinte complète de l'objet dans la grille courante ;
- niveau et compteur de progression liés ;
- première étape liée à l'observation d'origine ;
- action encore disponible ;
- exemplaire et ombre de référence inchangés ;
- frontière officielle scelle immédiatement le préfixe ;
- prédiction non finale conforme maintient le préfixe ouvert ;
- mismatch ou étape finale scelle le préfixe.

Chemin stock, fit/calibration, proposition et restauration d'un champ retenu restent explicitement hors de ce sous-port.

Commits GitHub :
- code : `e145c517bded20537cfe11e9922252a4b2f2852b`
- tests : `2ca7606e16e4292e29ed3ac3d8869920dfd6a5aa`

## 5B — acquisition et réconciliation de réponse récupérées

### Acquisition du modèle

Donneurs :
- `common_addressed_field.py::fit`
- `common_addressed_field.py::target_candidates`
- `common_addressed_field.py::transient_contour`
- `common_containment.py::filled`
- `common_visible_identity.py::contains`

Port :
- `src/logos-engine/addressed-field-fit.ts`
- `tests/addressed-field-fit.test.ts`

Comportement récupéré :
- unique correspondance mobile avant/après ;
- exigence d'un exemplaire stationnaire de même signature ;
- cible homologue centrée dans une enceinte ;
- adresse x/y située dans l'empreinte de l'objet après réponse ;
- acquisition refusée si plusieurs modèles restent possibles ;
- contour graphique transitoire conservé comme indice, sans le promouvoir en loi physique.

Commits GitHub :
- code : `44c0987c52d2bb3ff1f9ead5e9ddc0cd2c95dedc`
- tests : `31c1a0bd322f8499abc95514137320828645acd8`

### Réponse et réfutation

Donneur :
- `common_addressed_field.py::record`, tranche après acquisition/stock et avant frontière.

Port :
- `src/logos-engine/addressed-field-response.ts`
- `tests/addressed-field-response.test.ts`

Comportement récupéré :
- occurrence courante unique ou correspondance résiduelle unique ;
- réponse alignée -> augmentation de la borne acceptée ;
- absence de mouvement au-delà de la borne -> borne rejetée ;
- déplacement incompatible -> contre-exemple et invalidation du modèle ;
- rivalités comparées à l'ancre réellement observée ;
- progression de calibration identique au donneur.

Commit GitHub :
- `7765f55fedea7a6b8e5658dc55d20e0ab5e17d3b`

La reconstruction de 5B ne revendique toujours pas le chemin `FieldStock`, la rétention inter-niveaux complète ni le raccord runtime.

## Qualification sur la nouvelle baseline

Checkout local :
- `/mnt/data/sra-playground-lot5-site109-rebase`
- branche `recovery/lot5-site109-rebase-20261112`

Tests ciblés exécutés :
- linked-preparation : 7 cas ;
- addressed-material : 2 cas ;
- observed-object-binding : 5 cas ;
- total après acquisition + garde + réponse AddressedField : **29/29 réussis**.

Typecheck :
- `tsc --noEmit` : **réussi**.

Runtime local :
- Node 22.16.0 ;
- les tests TypeScript utilisent `--experimental-strip-types` car le dépôt demande >=22.18.0.

## Performance

Statut : **fonctionnellement qualifié, performance officielle à confirmer**.

Le harness officiel historique n'est pas encore restauré.

Critère conservé :
- STCK global strictement < +10 % ;
- SMLP global strictement < +10 % ;
- chaque jeu séparément ;
- aucune compensation ;
- une phase interne peut dépasser +10 % si le global du jeu reste strictement sous +10 %.

## Prochaine étape

Porter le cœur de 5B `AddressedField` à partir du donneur Git V6 en isolant d'abord les invariants réellement consommés :
1. identité d'occurrence courante ;
2. liaison adresse -> objet/context courant ;
3. invalidation sur ambiguïté, déplacement pertinent ou changement de portée ;
4. réponse observée et réfutation ;
5. sauvegarde/restauration nécessaires au consommateur.


## 5B — FieldStock et rétention à la frontière

Donneurs V6 inspectés :
- `agents/yf_arc3_v6/laya_proto/common_field_stock.py`
- `agents/yf_arc3_v6/laya_proto/common_addressed_field.py::ensure_stock`
- `common_addressed_field.py::record` pour la transition de niveau et la fabrication du `prior`.

Port :
- `src/logos-engine/field-stock.ts`
- `src/logos-engine/addressed-field-retention.ts`
- `src/runtime/observed-addressed-material-runtime.ts`
- `tests/field-stock-retention.test.ts`

Responsabilité reconstruite :
- `AddressedField` est le propriétaire de la connaissance retenue via `prior` ;
- `FieldStock` est une reconstruction de portée courante, créée seulement si la nouvelle observation revalide le stock rappelé ;
- à la frontière, le `model` et le `stock` actifs sont supprimés ;
- le `prior` survit avec une qualification explicite imposant de nouvelles liaisons / nouveaux témoins dans l'epoch suivant ;
- aucune restauration artificielle `state/restore` n'est ajoutée à `AddressedField`, le donneur n'en possède pas.

Raccord runtime initial :
- `ObservedAddressedMaterialRuntime` conserve l'état de rétention entre observations ;
- `mayUseRetainedKnowledge()` n'est vrai qu'après `FieldStock.create()` réussi sur la scène courante ;
- une scène incompatible conserve le `prior` mais retourne `retained_not_applicable` ;
- une réfutation du stock revalidé est distincte d'une simple connaissance en attente de revalidation.

Qualification locale de ce slice :
- 7/7 nouveaux tests réussis ;
- `tsc --noEmit` réussi sur les nouveaux modules ;
- les 29 tests historiques de 5A/5B/5C restent la dernière régression qualifiée avant ce slice et n'ont pas été rejoués intégralement dans le checkout minimal de reconstruction de cette étape.

Commits GitHub :
- `48c3563e3e919c47a90cb712e22dcf30e859563c` — FieldStock create/retained ;
- `308c1dd0c2e5ee59d496b39844aec78ace9de0b0` — rétention AddressedField à la frontière ;
- `8a8b1decd8f52244d17dbe5bb18ca949498f139a` — propriétaire runtime ;
- `34484fa3a73770909e40d4d346f59cebb82bcfff` — tests de rétention/revalidation.

Limites explicites :
- `FieldStock.propose()`, `before()`, `after()` et la totalité de `record()` ne sont pas encore portés ;
- le worker SRA V6 commun est toujours absent de la reconstruction, donc le raccord est exécutable au niveau runtime TypeScript mais pas encore branché au worker de décision complet ;
- aucune persistance disque/processus n'est revendiquée : seule la rétention inter-observations/inter-niveaux démontrée par le donneur courant est reconstruite.

## Prochaine étape 5B

Porter les tranches réellement consommées de `FieldStock.record/before/after/propose`, puis raccorder l'acquisition et la réponse existantes au même propriétaire `ObservedAddressedMaterialRuntime` pour obtenir un scénario intégré :
`apprentissage -> frontière -> revalidation -> proposition bornée -> réponse -> décision`.


## 5B — guards et réconciliation FieldStock raccordés

Donneur V6 :
- `common_field_stock.py::bodies`
- `common_field_stock.py::before`
- `common_field_stock.py::after`
- `common_field_stock.py::record`
- `geometric_observer.py::components`
- `typed_material_observations.py::child_present`

Port supplémentaire :
- `FieldStock.bodies()` mesure les composants monochromes 4-connexes et ne retient que les corps carrés d'un type connu hors interface ;
- `FieldStock.before()` revalide niveau, progression, observation liée, inventaire typé et présence exacte des enfants attendus ;
- `FieldStock.after()` ferme immédiatement le préfixe à une frontière officielle, compare le stock attendu quand il est connu et vérifie la préservation des corps non sélectionnés quand l'effet reste inconnu ;
- `FieldStock.record()` apprend une relocalisation adressée, apprend une réécriture observée deux-parents -> un-produit, conserve les lignées sans revendiquer l'identité des pixels, et réfute les changements de contexte incompatibles ;
- `ObservedAddressedMaterialRuntime` délègue maintenant `beforeStock/afterStock/recordStock` uniquement après revalidation courante réussie.

Scénario intégré qualifié :
`apprentissage local -> frontière officielle -> prior retenu -> revalidation nouvelle scène -> garde before -> réponse observée -> garde after -> décision d'applicabilité`.

La décision reste une autorisation de consommation de connaissance revalidée, pas une sélection artificielle d'action.

Tests ciblés de ce slice :
- **16/16 réussis** ;
- `tsc --noEmit` réussi dans le checkout local minimal ;
- Node local 22.16.0 avec `--experimental-strip-types`.

Nouveaux commits GitHub :
- `04c6300058e89a7437d1c32ba7653fc344f617fd` — corps, guards et record FieldStock ;
- `cfae80db4bc75ef225edab777539b03c8e5c0124` — préparation du raccord runtime ;
- `a3ff37199a2efe7f41f2d53fce490d5d9be9a7c1` — correction vérifiée du raccord `beforeStock/afterStock/recordStock` ;
- `cd784241b1703b624c0191ce518b31aec17ca0f9` — tests guards/record/scénario intégré.

Limites restantes de 5B :
- `FieldStock.preservation_obligations()` et `propose()` ne sont pas encore portés ;
- allocations, loci, movement, offer et simulate du donneur restent à reconstruire avant de pouvoir générer une proposition stock réelle ;
- le worker SRA V6 complet reste absent, donc le runtime raccordé est consommable par la future boucle de décision mais n'est pas encore le worker navigateur final ;
- le harness officiel STCK/SMLP reste absent.

La prochaine tranche prouvable est `preservation_obligations -> allocations/loci/movement/offer/simulate -> propose`, puis raccord OP18 du bundle produit sans appel artificiel.


## 5B — proposition FieldStock et raccord contractuel OP18

Donneur V6 :
- `common_field_stock.py::allocations`
- `common_field_stock.py::loci`
- `common_field_stock.py::movement`
- `common_field_stock.py::offer`
- `common_field_stock.py::simulate`
- `common_field_stock.py::preservation_obligations`
- `common_field_stock.py::propose`

Port supplémentaire :
- allocation des occurrences déjà livrées et des occurrences prêtes ;
- calcul des loci compatibles avec les bornes `lower/upper` acquises ;
- mouvement vers une zone demandée avec séparation prudente si nécessaire ;
- proposition de fusion de deux intrants du même type seulement lorsqu'un type supérieur manque ;
- simulation seulement pour les mouvements connus ou règles suffisamment confirmées ;
- une réécriture inconnue ferme la proposition après une seule action expérimentale ;
- obligations de conservation calculées sur les comptes réellement observés ;
- production du plan `typed_field_stock`, de la composition-question, du binding et du `bundle_template` OP18 du donneur.

Dépendances non inventées :
- `digest` est injecté ;
- `ObservedInputDomain.make_locus_witness` est injecté via `makeLocusWitness`;
- aucune fonction de hash ou de témoin alternative n'est promue comme contrat V6.

Raccord runtime :
- `ObservedAddressedMaterialRuntime.proposeStock()` n'appelle `FieldStock.propose()` que lorsqu'un stock courant revalidé existe et n'est pas réfuté.

Raccord OP18 :
- le `bundle_template` produit conserve `operation_key: OP18`, la composition-question, les faits/préconditions, l'évidence, les actions et l'`outcome_guard` du donneur ;
- un test de branche complète vérifie sa compatibilité avec `validateBundle()` puis `releaseBundle()` de l'autorité native existante ;
- aucune nouvelle opération ni appel OP18 artificiel n'est ajouté au moteur.

Qualification locale disponible :
- **20/20 tests ciblés réussis** sur `FieldStock` rétention/guards/record/proposition et runtime ;
- `tsc --noEmit` réussi ;
- le mini-checkout local ne contient pas les anciens modules `v6-operations/composition/native-authority`, donc le test d'admission OP18 ajouté à la branche GitHub n'a pas pu être exécuté localement dans cet environnement ;
- sa structure a été vérifiée contre les contrats existants : OP18 retourne les compositions non observées avec `open_question`, et l'autorité native exige précisément cette composition avant release.

Nouveaux commits GitHub :
- `2613654f4ec0826224583bb6cbea954d7be429d9` — proposition FieldStock ;
- `5c47279b9cc8cabbfa1f68fd6242e07e73fda45b` — correction des sémantiques Python `min(..., default=0)` ;
- `ee709b4cf1600f5810be21aa366861fe6f71a501` — exposition runtime de `proposeStock` ;
- `dbaaf990df2a8dbeb71db55748024ff1d9ba03b1` — tests proposition et admission OP18 ;
- `02cff731cd85ddb18231c00d411ead5eaf7a48a3` — assertion OP18 resserrée.

### État fonctionnel 5B après cette tranche

La chaîne prouvable est maintenant :
`acquisition -> réponse -> conservation -> frontière -> revalidation -> obligations de préservation -> proposition bornée -> guards -> observation/réfutation -> bundle OP18`.

Restent avant clôture complète de 5B :
- faire exécuter le test OP18 dans un checkout complet contenant le moteur V6 reconstruit ;
- rebaser proprement sur la branche canonique qui continue d'avancer ;
- rejouer la régression complète disponible après rebase ;
- restaurer le harness officiel avant toute qualification performance STCK/SMLP.

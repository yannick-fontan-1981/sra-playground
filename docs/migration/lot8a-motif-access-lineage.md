# Lot 8A — Filiation de `motif_conditioned_access`

<!-- LOT8A_INTEGRATION_START -->

## Composition préparatoire 5C, 6B et 8A

La composition réunit `public_observed_binding`, `selected_rigid` et `motif_access`, à partir du jalon 8A antérieur et du checkpoint 6B `a01e6faf330d82fa220feac0c9ad4632bb75a9de` incluant la préparation 5C. **145 fichiers de tests et 67/76 entrées sont des périmètres attendus, non des résultats exécutés sur cette composition.** Les validations propres aux parents, notamment le jalon 8A de 5 422 tests sur Site 103, restent conservées ci-dessous avec leur portée historique.

**0.63 et 0.64 ne sont pas publiées ; 0.65 reste réservée.** La tentative de coût 5C a été bloquée avant toute mesure, avec zéro échantillon, puis la fenêtre a été libérée explicitement le 11 novembre à 19:08:34 UTC. **Aucun coût 8A n’est mesuré ou accepté.** Le gel et les validations de cette composition restent à renseigner après exécution.

Le [plan prospectif de coût](lot8a-evidence/integration-provisional-063-064-01/contract/cost-qualification-plan.json) exige la publication réelle 0.64 comme baseline, des captures hors chronométrage des formes de travail et de la provenance des graphes, puis une fenêtre ABBA isolée. Pour chacun de STCK et SMLP, la hausse du coût global doit être strictement inférieure à +10 % ; des phases au-delà de +10 % sont admises si cette condition globale est satisfaite, et restent consignées. Ce plan ne contient aucune fixture, empreinte ni acceptation inventée.

<!-- LOT8A_INTEGRATION_END -->

## Jalon de développement antérieur conservé sur Site 103

Point documentaire actualisé le 11 novembre 2026 à 14:37:12 UTC−03. La suite déclarée de **138 fichiers** a terminé avec **5 422/5 422 tests passés**, sans échec, annulation ou test ignoré ; les cinq contrôles séparés passent également. Le [bilan de développement](lot8a-evidence/development/validation-summary.json) lie ces résultats aux octets intégrés après Site 103. Cette validation ne constitue pas la qualification finale ni la publication de 0.65.

Le candidat porte la version **0.65.0 réservée**. Son état intégré examiné est `df30bfd35396737f483b61ddff628f8396a9f54a`, après adoption de la publication réelle **Site 103 / native 0.62**, commit `4afcbfe6a25bd3a88223be543e443bc53b9c8814`. Le [reçu d’observation de Site 103](lot8a-evidence/coordination/published10b-site103.json) atteste ce prédécesseur. Aucun coût 8A, jeu réel gagné ni publication de 0.65 n’est établi ici.

## 1. Source, propriétaire et place dans la stratégie

La filiation part du module Python immuable [common_motif_access.py](../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/laya_proto/common_motif_access.py), dans la référence `786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`. Ses 290 lignes ont l’empreinte SHA-256 `6f9662132299c51137531e9ae2df7df89bd079428ef465eaf3610d1dad22f346`. Le [contrat source](lot8a-evidence/contract/source-contract.md) distingue ce comportement de ses adaptations natives.

`MotifAccess` est le propriétaire unique de la relation observée entre motif, commande et effet. L’entrée `motif_conditioned_access` appartient à **`factored_material_return`**, avant `parallel_branch_routing`. Elle est raccordée par la sous-question `motif_access`, dans l’ordre du caller. Le port ne crée pas une seconde entrée directe concurrente : la position correspondante de `materialEntryPoints` reste `null`.

Le propriétaire et sa géométrie sont séparés dans [v6-motif-access.ts](../../src/logos-engine/v6-motif-access.ts) et [v6-motif-access-geometry.ts](../../src/logos-engine/v6-motif-access-geometry.ts). Le [runtime commun](../../src/logos-engine/v6-native-runtime.ts) conserve une seule instance et l’acquisition sélectionnée. Aucun observateur passif n’apprend les retours attribués à une autre famille.

Une autre règle source accompagne ce raccordement : lorsque `exclude_observed_control_interface` est actif et qu’une grille unique de motifs possède un corps mesurable, le dernier repli `regular_field_correspondence` est exclu. Cette exclusion concerne cette correction de champ ; les sous-questions précédentes et les groupes suivants conservent leur place. Le champ optionnel est déclaré dans [v6-field-constraints.ts](../../src/logos-engine/v6-field-constraints.ts).

## 2. De la proposition à l’acquisition utilisée

Les couleurs, positions, dimensions et commandes sont mesurées sur l’observation publique courante. Aucune clé de jeu, couleur, coordonnée ou solution de niveau préparée n’est introduite.

La proposition conserve l’ordre source : chercher une route à partir des déplacements acquis ; viser un rayon observé lorsque les conditions le permettent ; calibrer une commande encore inconnue à la pose actuelle ; sinon sélectionner puis activer une carte. Les cartes inconnues précèdent celles déjà apprises, avec départage par taille puis masque selon l’ordre Python. Les préfixes de déplacement et de bascule respectent le restant et au plus 16 primitives ; la première transition non vérifiée est incluse puis ferme le préfixe, comme une activation à effet encore inconnu. Une calibration directe peut encore proposer une action pour `remaining=0`, comme le Python ; le runtime conserve son contrôle préalable du budget.

Le raccordement suit la chaîne commune suivante :

1. **Sélection.** La sous-question fournit les faits source `observed_regular_input_field`, `measured_card_instances` et `composite_body_observed`. Sa composition reste `information_question`, avec `observed=false`, et passe par OP18.
2. **Garde et autorisation.** L’époque, la progression officielle, la commande disponible, la référence initiale, le corps et les bits sont revalidés. La liaison actuelle et WHY/ACT restent nécessaires ; la calibration froide n’obtient aucun témoin fictif de réussite.
3. **Action et comparaison.** Le retour est confronté au déplacement ou à la bascule attendus. Une frontière officielle ou un effet inconnu/non conforme ferme la continuation.
4. **Acquisition choisie.** Seul `record` du propriétaire retenu apprend le retour. Le magasin commun reçoit l’événement sous `common-observation-frontier`, à la clé source `motif:{revision}`.
5. **Restauration puis décision suivante.** Les acquis restaurés alimentent une nouvelle proposition, soumise aux mêmes gardes et à une nouvelle autorisation.

`learned.body_change` signifie seulement que le nouveau corps diffère de l’ancien. Cette valeur peut être vraie si le corps devient non mesurable ; elle ne prouve ni accès ni réussite. De même, `learned` influence notamment le classement des cartes, tandis que la route dépend des déplacements mesurés et de la géométrie courante. La preuve de contribution doit donc examiner la décision suivante, sans attribuer à un seul champ toute l’autorité d’accès.

## 3. Persistance et restauration du magasin commun

`learned`, `motion`, `passed` et `events` persistent entre époques. Le changement d’époque réinitialise les mesures et essais locaux selon la source : grille, poses essayées, transitions vérifiées, sélection, références, encre, rayon, direction, obstructions et corps suivi. Les acquis historiques ne sont pas artificiellement contraints à la nouvelle grille.

La restauration native valide une copie détachée avant de modifier le propriétaire. Les refus ciblés portent notamment sur une sélection qui ne correspond à aucune carte courante, un rayon sans bloqueur lié ou une trajectoire sans deux positions distinctes. Les événements historiques conservent leurs propres références. Le diagnostic de recherche interrompue est transitoire et n’est pas restauré comme un acquis.

Le test intégré efface effectivement l’état du propriétaire, puis appelle la reprise du runtime : le magasin commun restitue les acquisitions avant le déplacement suivant. Cette restauration ne crée pas un nouvel événement d’apprentissage. La source Python n’expose pas d’API `state`/`restore` : l’adaptateur utilisé dans les comparaisons est explicitement un dispositif de laboratoire, distinct de cette preuve par le runtime natif.

## 4. Recherche bornée : adaptation et limite connue

Le profil source utilisé pour la comparaison reste distinct du profil de production. Ce dernier borne la recherche à **8 192 états retenus** et **16 384 entrées de frontière**, avec contrôles coopératifs d’interruption et d’échéance. Après l’intégration de 0.62, `currentExecution`, la conversion entre horloges et l’argument d’exécution de la garde restent ceux du prédécesseur publié.

Une recherche incomplète produit un refus courant `unknown`, sans chemin partiel, sans autorité d’action et sans repli supposant que la recherche a été menée à terme. Elle ne démontre pas l’absence de solution.

Cette borne ne constitue pas un plafond mémoire en octets. Chaque état conserve son chemin complet ; pour un nombre d’états retenus noté `S`, le stockage peut atteindre **O(S²)** au pire. Les contrôles coopératifs ne garantissent pas non plus une latence maximale de toutes les mesures géométriques. Ces limites sont conservées dans le contrat et les revues ; le port borné n’est pas présenté comme l’algorithme Python inchangé.

## 5. Preuves obtenues et portée exacte

| Preuve | Observation retenue | Portée et limite |
| --- | --- | --- |
| [Export de l’oracle source](lot8a-evidence/contract/reference-oracle.json) | Sources originales inchangées ; 33 cas géométriques, 17 scénarios et 100 opérations sur des scènes synthétiques indépendantes. | Export du composant ; aucune donnée de jeu ni exécution du caller Python complet. |
| [Première comparaison native](lot8a-evidence/contract/reference-parity.json) et [reçu d’exécution](lot8a-evidence/contract/native-reference-attempt-01.json) | **182/182 comparaisons réussies** sur la première version du composant. | Exécution antérieure au durcissement final de restauration et à l’intégration de Site 103. Ce résultat historique n’est pas transféré aux octets ultérieurs. |
| [Kernel après Site 103](lot8a-evidence/development/kernel-post-site103.json) | **4/4 tests réussis**, exit 0, du 11 novembre 2026 à 17:09:44 UTC à 17:09:55 UTC, avec empreintes inchangées. | Caller natif réel, autorisation, acquisition, restauration et contre-épreuves synthétiques sur le commit intégré. |
| [Typecheck après Site 103](lot8a-evidence/development/typecheck-post-site103.json) | Exit 0, empreintes inchangées. | Préflight de développement ; ne remplace pas la qualification finale après les prédécesseurs suivants. |
| [Revue initiale](lot8a-evidence/contract/source-review.json) et [revue d’intégration de Site 103](lot8a-evidence/contract/site103-integration-review.json) | Lecture indépendante du port et de son raccordement, puis préservation du caller 0.62. | Revues de source ; elles ne sont pas des exécutions de tests. |
| [Plan de développement](lot8a-evidence/contract/development-validation-plan.json) et [gel de l’exécution courante](lot8a-evidence/development-site103-01/development-freeze.json) | 138 fichiers déclarés : 133 hérités, trois Motif et deux Window ; quatre modules fermés exclus. | **5 422/5 422 tests frais et 5/5 contrôles passés**, entrées inchangées. Les attentes originales Motif sont réexercées sur le natif final de ce jalon de développement. Qualification finale et coût après les prédécesseurs effectifs 0.63/0.64. |

Les quatre cas du [test Kernel](../../tests/v6-motif-access-kernel.test.ts) distinguent la contribution d’une simple non-régression :

- Le parcours froid produit calibration, bascule, activation puis déplacement, avec acquisition unique et restauration du magasin commun avant le dernier choix.
- À commandes identiques, un effet d’activation favorable et un effet contraire conduisent à des décisions suivantes différentes.
- L’ablation diagnostique de l’acquisition empêche de conserver le déplacement mesuré : le propriétaire calibre de nouveau. Cette manipulation appartient au test et ne modifie pas la production.
- L’exclusion du repli de champ est confrontée à sa désactivation, à un corps ambigu et à une grille incomplète.

Le [premier probe](lot8a-evidence/development/caller-probe-01.json) reste en erreur : après quatre retours de production, son extracteur demandait la mauvaise clé `episode/motif:0`. Le [second probe](lot8a-evidence/development/caller-probe-02.json) conserve le parcours et interroge les clés correctes. Ces observations antérieures à Site 103 restent identifiées comme telles ; le reçu Kernel postérieur établit la nouvelle exécution après fusion.

Le [reçu de fusion](lot8a-evidence/coordination/site103-merge-review.json) conserve également l’échec du contrôle global d’index, exit 2, dû aux lignes héritées byte-identiques du prédécesseur. Le contrôle distinct du nouveau delta 8A est exit 0. Aucun échec ancien n’est reclassé en succès.

## 6. Qualification suivante après 0.63 et 0.64

Les publications effectives **0.63 et 0.64** doivent être observées et intégrées avant de qualifier définitivement 8A. Leurs numéros seuls ne suffisent pas : les reçus de publication, commits et empreintes devront identifier le prédécesseur réellement repris. Les changements du caller seront relus à cette occasion ; les preuves sur Site 103 resteront conservées avec leur portée initiale.

Sur la source finale ainsi intégrée, il restera à fixer le gel et la population de validation, obtenir les comparaisons et tests pertinents sur ces octets, terminer les gates et les régressions déclarées, puis conduire la qualification de coût contre le prédécesseur effectif. Une campagne de trois niveaux n’est pas une obligation automatique attachée à chaque entrée ; toute preuve de jeu éventuelle doit être déclarée et rapportée séparément.

Le critère de coût reste la **médiane des sessions complètes strictement inférieure à +10 % pour STCK et, séparément, pour SMLP**. Un dépassement de phase peut être accepté lorsque les deux critères globaux passent. Les diagnostics de phases, de cohortes et les observations déclarées doivent rester visibles ; les deux cas globaux ne sont pas moyennés ensemble.

Les **65/76 entrées raccordées**, dont **23/33** pour `factored_material_return`, décrivent le raccordement examiné après Site 103. Ils n’établissent ni une parité complète du caller, ni les six portes de migration complète, ni une publication 0.65. LKEY demeure fermé : aucune analyse de payload, oracle, rejeu ou action de jeu ne fait partie de cette filiation.

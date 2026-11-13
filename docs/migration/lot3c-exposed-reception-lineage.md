# Lot 3C : filiation de la réception exposée

## Périmètre et statut

Le sous-lot raccorde `exposed_reception_plan`, troisième branche d'`observed_composition_services`, au propriétaire commun `SharedSeriesConstraint`. Il transfère la couche propre V6 de réception exposée, ses deux projections de grille et le seul calculateur nominal V5 `_expand_push_chain` effectivement consommé. Les originaux proviennent du commit **`786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`** et restent inchangés.

Les positions, couleurs, récepteurs, acteur et cadran sont mesurés dans les images publiques. Les régions et dimensions du détecteur restent les grammaires structurelles explicites de la source. Aucune spécification de jeu, solution, trajectoire préparée ou sélection par identifiant de jeu n'entre dans la décision de production. Les effets optiques, d'attachement, de mouvement couplé et de couleur restent des hypothèses conditionnelles acquises, pas des lois complètes supposées.

Le présent document décrit la filiation et les contrats de composant. Il n'anticipe aucun résultat de campagne, de contribution live, de build formel ou de coût. Ces résultats relèvent de reçus distincts. La façade reste **partielle à 3/6**, le registre **50/76**, et les conditions de migration complète ne sont pas avancées par ce raccord.

## Sources, producteurs et consommateurs

| Source inchangée | Partie consommée | Cible native | Portée |
| --- | --- | --- | --- |
| V6 `laya_proto/reception_lattice_projection.py` | `small_scene` complet | [v6-exposed-reception-observation.ts](../../src/logos-engine/v6-exposed-reception-observation.ts) | Projection de composant vérifiée |
| V6 `laya_proto/exposed_reception_access.py` | `large_scene`, préférence grande/petite grille, candidats, recherche, proposition, gardes, acquisition et digest propres | [observation](../../src/logos-engine/v6-exposed-reception-observation.ts) et [accès](../../src/logos-engine/v6-exposed-reception-access.ts) | Couche propre ; fermeture EphemeralMap complète non transférée |
| V5 `capabilities/seeded_partial_push_d.py` | `_expand_push_chain` uniquement | `nominalReceptionStep` dans [l'accès natif](../../src/logos-engine/v6-exposed-reception-access.ts) | Calcul nominal consommé, pas la transaction complète V5 |
| V6 `laya_proto/common_observed_compositions.py` | Façade, enveloppe, support de point, gardes, acquisition et restauration transférées | [v6-shared-series.ts](../../src/logos-engine/v6-shared-series.ts) | Trois branches sur six |
| V6 `morphology_policy/strategy.drm` | `exposed_reception_question`, raisons, ordre de sondage et borne de recherche | Politique source chargée par le caller commun | Configuration source, aucune politique propre à un jeu |

La fonction `measureExposedReception` essaie la grande grille avant la petite, en partageant un calcul des composantes de l'image. Les sorties restent celles de `large_scene(rows) or small_scene(rows)`. Les fonctions séparées existent pour les comparaisons de source. Les composantes géométriques communes ne reçoivent aucune interprétation de couleur prédéfinie.

## Mesure et identité courantes

La projection grande grille mesure les barres, le pas et les motifs de corps et d'acteur ; la petite grille mesure son pas par les bandes répétées. Les motifs présents aux frontières identifient les murs. Un acteur ambigu, un nombre différent de corps et de récepteurs, un cadran incomplet ou plusieurs accents d'orientation entraînent les refus structurels source.

La petite grille conserve explicitement `receiver_overlap_candidate` lorsqu'un corps compatible semble superposé à un récepteur. Ce marqueur est une hypothèse de projection. La couleur d'un récepteur ne permet pas à elle seule de certifier un effet ou une arrivée.

Le layout lie l'origine, le pas, les dimensions, les murs et les récepteurs. Il ne change pas uniquement parce qu'un corps ou l'acteur se déplace, ou que l'orientation change. Les projections de continuation contiennent l'acteur et les corps triés dans l'ordre numérique lexicographique de la source. Les résultats sont détachés ; l'orientation et le vecteur actif sont copiés séparément comme par `plain`.

Les centres du cadran sont calculés par division, puis sa moyenne par huit. Python conserve donc des flottants, même lorsqu'ils valent un entier. `exposedReceptionPlanIdentity` préserve cette écriture pour `scene.orientation` et `scene.dial[].vector`, sans convertir les points de clic ou les autres entiers en flottants. Le digest JSON commun et celui des états acquis ne sont pas modifiés.

## Recherche nominale et extension native de bornage

Les domaines de récepteurs découlent des couleurs courantes et de la fermeture des arêtes de couleur acquises. Les affectations injectives sont énumérées dans l'ordre source. Le rang combine le nombre de corps hors récepteur compatible et la distance minimale de l'affectation. Le tas conserve l'ordre Python : priorité, profondeur, position de l'acteur puis positions ordonnées des corps. Les directions restent `(1,0)`, `(0,-1)`, `(0,1)`, `(-1,0)`.

Le noyau V5 construit l'occupation courante, étend la chaîne de poussée dans l'ordre source et renvoie les témoins de refus. Les corps attachés sont considérés comme un support composé seulement sous leur modèle acquis ; un mouvement couplé est une diffusion nominale conditionnelle. Le consommateur ne transfère **ni `measure_seeded_partial_push_d`, ni la validation globale Pydantic, ni les phases de commit partiel, ni le ledger transactionnel complet**.

La configuration source borne la recherche à **8 000 nœuds** et le préfixe à **16 actions**, limité aussi par le budget courant. La préparation des permutations et les visites de chaîne n'étaient pas bornées au même niveau. L'extension native `native_reception_work_budget` ajoute des limites vérifiables :

| Travail | Borne native par défaut |
| --- | ---: |
| Vérifications de préparation des affectations | 100 000 |
| Affectations retenues | 10 000 |
| Visites du noyau de chaîne | 2 000 000 |
| Évaluations d'affectation dans l'heuristique | 4 000 000 |
| Corps ou récepteurs | 128 |
| Cellules admises | 4 096 |
| Temps physique | Échéance courante en millisecondes et horloge `execution.now` transmise par le caller |

Une interruption conserve un résultat incomplet. Une énumération partielle d'affectations n'est jamais utilisée comme domaine complet. Un préfixe partiel ne peut venir que d'un état déjà extrait d'une recherche dont le domaine d'affectations est complet, avec un rang strictement meilleur que le départ. Sans préfixe valable, les nouvelles bornes produisent `unknown`, `block_unrelated_probe` et `reception_computation_incomplete`, pas une impossibilité prouvée. Le comportement source à sa propre borne de nœuds reste distinct. Les coûts de cette extension doivent être vérifiés dans leur mesure séparée.

## Proposition, gardes et acquisition

L'ordre propre des questions est conservé : orientation d'un corps exposé sur un récepteur incompatible, maintien d'un effet de champ observé, expérience de transport par contact, accès nominal, sondage d'une commande inconnue puis question d'orientation de repli. Les commandes déjà contredites ou sondées restent mémorisées dans leur portée source.

Avant la première action, la garde lie le digest du plan, ses commandes, l'époque, le score, l'action disponible, le layout, les pixels et la référence d'observation. La continuation exige la projection précédente prédite et l'orientation initiale. Après une action, une frontière, un changement de layout, une projection inconnue ou divergente ferme le préfixe. Une liaison périmée ne reçoit pas une autorisation nouvelle parce qu'une connaissance historique existe.

L'acquisition compare les corps par distance minimale. **Seul un minimum unique** autorise l'acquisition de changements de couleur, de contact, de mouvement couplé ou de mouvement associé à l'orientation. L'ambiguïté reste explicitement mémorisée, sans attribution arbitraire de correspondance. Un changement de commande contradictoire conserve son ancien modèle et le détail du conflit. La source limite cette correspondance à sept corps ; la recherche native préserve les égalités de scores et ne supprime que les branches dont la distance déjà accumulée dépasse strictement le meilleur score.

## Propriétaire, ordre et journal

| Opération | Ordre des couches transférées |
| --- | --- |
| Proposition et gardes | Panel, puis Chamber, puis Exposed, puis les ancêtres transférés |
| Candidats de point propres | Exposed, puis Chamber, puis Panel, avec déduplication par identité et maintien de la première position de clé |
| Acquisition | Ancêtres et Auxiliary/Coupled, puis Exposed, Chamber, Panel, puis le paquet public commun |
| Digest natif détenu | Ancêtres transférés, Exposed, Chamber, Panel, avec participation conditionnelle des nouvelles couches |
| Restauration | Routage du journal commun vers chaque réducteur, vérification complète, puis publication atomique |

`ExposedReceptionMemory` possède `reception_state`, `reception_controls`, `reception_models` et son journal `reception_events`. Il acquiert uniquement les événements **`observed_exposed_reception`**. `SharedSeriesConstraint` reste le propriétaire commun de la famille `public_occurrence_recall` et du journal ordonné ; aucune seconde acquisition de la même transition n'est ajoutée.

La source future **ReceptionService utilise aussi le nom `reception_events`**. Cette collision n'est pas déclarée résolue par un renommage silencieux. Le raccord actuel isole explicitement le propriétaire Exposed et son type d'événement dans l'enveloppe native. Le port futur de ReceptionService devra établir le contrat de partage, de vérité du journal, d'ordre d'acquisition et de migration des checkpoints correspondant à la chaîne source réelle. Sa sémantique héritée et son digest complet restent hors du présent transfert.

## Certification et restauration des checkpoints 0.42

La couche Exposed participe au certificat de travail par identité d'objet, révision et témoin structurel. Acquisition, remplacement du propriétaire ou mutation directe invalidante empêchent la réutilisation injustifiée d'un checkpoint. Les exports publics restent détachés et les valeurs conservées sont immuables.

Un checkpoint 0.42 sans événement Exposed conserve son ancien digest : la nouvelle couche n'entre dans le digest natif qu'après son premier événement. Une restauration ancienne reconstruit également une couche Exposed vide et élimine ses acquisitions ultérieures. Cette règle est une **enveloppe native de migration**, pas le digest intégral de l'héritage Python.

La restauration reconstruit d'abord tous les propriétaires temporaires et vérifie le digest du journal complet. Aucun propriétaire courant n'est remplacé avant cette réussite. Une erreur préserve donc la mémoire précédemment acquise. Les [checkpoints hérités](../../tests/fixtures/v6-exposed-reception-legacy-checkpoints.json.gz) et les [tests d'intégration](../../tests/v6-exposed-reception-integration.test.ts) couvrent ce contrat avec les couches Panel/Chamber existantes.

## Preuves disponibles et portée

L'[exporteur](../../scripts/export-v6-exposed-reception-reference.py) appelle les originaux inchangés et vérifie **1 786 fichiers avant et après**. Sa [fixture](../../tests/fixtures/v6-exposed-reception-parity.json.gz) conserve les 100 images publiques initiales, les cas de composant, gardes et enveloppes communes. Les observations synthétiques restent identifiées et ne sont pas des résultats de campagne.

La [revue de projection](lot3c-evidence/diagnostic/projection-parity.json), reproduite par son [script de lecture seule](lot3c-evidence/diagnostic/check-projection-parity.mjs), passe **347 comparaisons** : 300 projections initiales, 24 scènes synthétiques, huit listes de candidats et quinze identités de plan. Les [tests de projection](../../tests/v6-exposed-reception-observation.test.ts) et [tests d'accès](../../tests/v6-exposed-reception.test.ts) complètent cette comparaison avec les refus, alias, bornes et modèles conditionnels. La validation formelle de livraison doit être lue dans son reçu propre, sans la déduire de ce résultat de composant.

Les statuts de la [carte de transfert](../../migration/v6-transfer-map.json) restent conservateurs : **projection `component_verified`**, **accès `partial_transfer`**, **noyau V5 consommé `partial_transfer`**, **façade commune `partial_transfer`, 3/6 branches**. RootedLine, ReceptionService, ReferencePopulation et la fermeture héritée complète restent à transférer. Le nombre de workflows compilés, les 76 entrées du registre et la parité globale mesurent des choses distinctes.

# Lot 6B : filiation et limites de SelectedRigid

## Provenance et portée

Le transfert utilise la source immuable V6/V5
`786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`. Les preuves de composant
mentionnées ici sont les nouvelles exécutions de 6B, conservées sous
[lot6b-evidence](lot6b-evidence). Une campagne froide de développement atteint
trois niveaux KLOT et sa relecture Python est passée sans différence. Ces
preuves ne constituent pas une publication de native 0.64, une victoire complète
du jeu ou la parité de tout l’appelant V6.
L'état de livraison est décrit dans le [rapport 6B](lot6b-selected-rigid.md).

L'[export original, tentative 04](lot6b-evidence/oracle/attempt-04/export-execution.json)
vérifie les **1 786 fichiers** du pin avant et après son exécution. Les
**725 fichiers importés ou explicitement consommés** sont également enregistrés.
Ces nombres décrivent la provenance ; ils ne signifient pas que chaque branche
de ces fichiers a été exercée. L'export déclare l'absence d'exécution de jeu,
de lecture de niveau privé et d'import du module natif.

Le [comparateur indépendant](lot6b-evidence/oracle/attempt-04/native-comparison.json)
retient **3 593 contrôles réussis**, répartis entre **1 082 contrôles de
comportement** et **2 511 contrôles de provenance de fichiers**. Les états et
plans TypeScript ne servent pas à produire les attentes de l'oracle.

## Source → TypeScript → consommateur → preuve

Les chemins Python ci-dessous sont relatifs à
`reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/`.

| Source originale et contrat consommé | Transfert TypeScript | Consommateur réel | Preuve disponible ou qualification restante |
| --- | --- | --- | --- |
| `agents/yf_arc3_v6/morphology_policy/selected_rigid/base.py` : base neutre, abstention et retour vide | `v6-selected-rigid.ts` ; absence d'héritage d'un autre fournisseur | `NativeSelectedRigid.propose`, gardes et acquisition | Oracle de composant, cas d'abstention et retours étrangers. |
| `selected_rigid/mechanism.py` : `scene`, `point`, `input_candidates`, `poses` | [v6-selected-rigid-geometry.ts](../../src/logos-engine/v6-selected-rigid-geometry.ts) | Mesure avant proposition et nouvelle mesure dans les gardes/retours | Oracle 04 : huit scènes, douze points, quatre domaines d'entrée et quatre populations de poses. |
| `selected_rigid/mechanism.py` : `moved`, masques complets et réceptacle conditionnel | `selectedRigidMoved` dans le module géométrique | Recherche, comparaison des issues d'une sonde, élimination des modèles sur retour | Oracle 04 : 51 déplacements ; les cas synthétiques sont déclarés dans l'exporteur. |
| `selected_rigid/mechanism.py` : `route`, coûts et ordre A* | [v6-selected-rigid-search.ts](../../src/logos-engine/v6-selected-rigid-search.ts) | `NativeSelectedRigid.proposeCurrent` | Oracle 04 : quatorze routes ; tests natifs de bornes et interruption. Les horloges synthétiques ne mesurent pas la performance. |
| `selected_rigid/mechanism.py` : 24 modèles, proposition, préfixe mixte, gardes et apprentissage | [v6-selected-rigid.ts](../../src/logos-engine/v6-selected-rigid.ts) et [types](../../src/logos-engine/v6-selected-rigid-types.ts) | Propriétaire unique `NativeSelectedRigid` | Oracle 04 : propositions complètes, événements, quinze gardes avant, vingt gardes après et deux liaisons. Campagne KLOT de développement : 35 événements acquis, quatre changements de contrôle et 63 ablations modifiant une action ou un refus. |
| `agents/yf_arc3_v6/morphology_policy/selected_rigid/family.py` : signatures courantes, plafond 16, disponibilité, point public, état et restauration | `NativeSelectedRigid` puis `selectedRigidFamily` | [v6-native-runtime.ts](../../src/logos-engine/v6-native-runtime.ts), fabrique et autorisation | Dix tests d’intégration réussis en tentative 02, puis 30 propositions et 38 retours relus indépendamment dans KLOT de développement ; les échecs précédents restent conservés. |
| `agents/yf_arc3_v6/morphology_policy/strategy.py`, `strategy.drm` et `laya_proto/common_frontier.py` : sous-question, refus bloquant, acquisition et ordre des checkpoints | `selectedRigidFamily`, `createNativeV6Runtime`, autorisation et acquisition communes | Sous-question exacte `goal_access/selected_rigid` ; même instance dans l'adaptateur et le stock d'acquisition | Test de fabrique, cinq motifs bloquants, cycle WHY/ACT et retour étranger avec restauration SelectedRigid avant PreviewPacking. La parité de tout l'appelant original n'est pas revendiquée. |
| `agents/yf_arc3_v6/laya_proto/geometric_observer.py`, `neutral_observer.py` et `observed_input_domain.py` | Mesure et domaine communs de [v6-native-observer.ts](../../src/logos-engine/v6-native-observer.ts) | Entités, masques et gardes publiques des points | Observations synthétiques et 39 observations uniques de KLOT reconstruites indépendamment par le lecteur froid. |
| `agents/yf_arc3_v6/laya_proto/src_bridge.py` : `plain` ; `terminal_composition.py` : identité | Reconstruction locale sans conservation d'alias ; [v6-hash.ts](../../src/logos-engine/v6-hash.ts) | Identités des plans/poses/rasters et projection d'état | Oracle 04 compare les résultats complets, pas seulement leurs identités. |
| `agents/yf_arc3_v5/capabilities/identity_scoped_support_d.py` : seul `_rotated(offset, 0)` | Conservation inchangée des offsets dans `selectedRigidMoved` | Masques de collision de la recherche | Les déplacements comparés consomment cette branche V5. Aucune autre rotation, loi de chargement ou capacité complète de ce fichier n'est revendiquée. |

Les trois modules SelectedRigid directs peuvent être qualifiés
`component_verified` dans la carte de transfert avec leurs preuves.
Cette catégorie ne vaut pas `verified` pour toute la migration. Les
bibliothèques déjà partagées gardent leurs mappings propres, sans deuxième
attribution du même fichier Python.

## Géométrie et hypothèses

Les cellules sont exprimées en `[x, y]`. Le masque conserve les concavités ;
il n'est pas remplacé par le rectangle englobant. Les corps suivent l'ordre
numérique de leur couleur observée, utilisée comme clé locale et non comme
rôle fixé à une palette particulière. Le départage de la couleur majoritaire
suit la première occurrence en cas d'égalité finale, comme `Counter`.

Une seule géométrie et un seul réceptacle homologue doivent être mesurés.
Plusieurs candidats restent ambigus, même s'ils semblent identiques après une
éventuelle normalisation. Le point de sélection est le centre d'une cellule
réellement occupée et doit appartenir à une seule entité publique actuelle.
Cette condition et le refus d'une action indisponible sont déjà présents dans
`family.py` ; ce ne sont pas des ajouts d'autorité du port.

La scène acquise est produite par un parcours des cellules intérieures du
plateau. Les poses de recherche peuvent prévoir la sortie du corps cible vers
les cellules du réceptacle ; elles restent distinctes de cette scène mesurée.
La validation d'un checkpoint impose que ses corps mesurés restent à l'intérieur.
Cette restriction ne contredit donc pas, à elle seule, l'extension conditionnelle
utilisée pendant la recherche.

## Contrôles, propriétaire et état

Les quatre commandes cardinales commencent avec les 24 permutations possibles.
La proposition d'un clic conserve une hypothèse de récepteur. Un déplacement
observé discriminant peut établir le rôle ; une immobilité peut conserver
plusieurs modèles. Le filtre compare les populations de poses effectivement
observées aux déplacements de chacun des modèles encore compatibles. Un
ensemble vide ne réinitialise pas les hypothèses.

L'état source contient exclusivement `format` et `events`. Chaque événement
`observed_selected_rigid` contient l'état, les modèles et le détail du retour.
La restauration native valide toute l'enveloppe avant d'installer le dernier
état et les derniers modèles. Elle ajoute une enveloppe `schema` pour le
checkpoint natif, sans ajouter les budgets transitoires à l'état source.

Un retour étranger n'appelle pas l'acquisition de ce propriétaire. En revanche,
un journal déjà acquis provoque l'écriture du checkpoint source et sa
restauration après chaque transition, avant PreviewPacking. Un retour
sélectionné sans événement doit conserver le fait présent de valeur `null`.
Le contrôle de présence synthétique vérifie explicitement cette distinction.

PreviewPacking peut compléter son cache de mesure pendant une proposition.
Pour démontrer la conservation après un retour étranger, le test doit comparer
l'état réellement présent juste avant ce retour, puis vérifier son checkpoint
et l'ordre des restaurations. Le correctif de cette attente est couvert par
la [tentative d'intégration 02](lot6b-evidence/integration/attempt-02/execution.json),
**10/10 réussis**, avec les entrées de cette exécution inchangées. Les passages
précédents à **21/22** et **53/54** restent des échecs conservés.

## Recherche et limites natives

L'ordre des directions est haut, bas, gauche, droite. Le tas ordonne
l'estimation, le coût réel puis le numéro d'insertion. Une entrée périmée est
ignorée avant l'incrément du compteur de nœuds. Le coût d'un déplacement vaut
un, augmenté d'un si la sélection change. Ces choix peuvent changer la
première action et sont comparés aux sorties de la source.

Les limites source sont **150 000 nœuds** et **18 secondes**, avec un délai
plafonné par le temps actif restant du niveau. Les limites natives ajoutées
sont **250 000 états retenus** et **250 000 entrées dans la file**. Leur atteinte
produit un motif explicite et un inconnu bloquant, sans préfixe partiel.
Les contrôles coopératifs ont un intervalle de **256 opérations de travail**,
distinct du compteur source des nœuds développés.

Le délai de recherche est contrôlé à la frontière de la boucle source. Le
signal d'arrêt et le délai du niveau sont vérifiés dans le travail coopératif.
Une expansion ou une reconstruction déjà commencée peut se prolonger jusqu'au
prochain contrôle applicable. Ni une latence maximale de Pause ni un retour
garanti à exactement 18 secondes ne sont déduits de ces seules bornes.
Le caller contrôle l’exécution à l’entrée de `authorize` puis après les
gardes `before` et `pointGuard`, avant son appel asynchrone à `release`.
Le test synthétique de pause/reprise vérifie la séparation du temps inactif et
du temps actif, sans constituer une mesure navigateur. **Pause dans le
navigateur empêche les prochains envois physiques, mais ne transmet pas de
signal d’annulation à la recherche déjà lancée dans le worker.** Aucune
préemption de cette recherche par le bouton Pause n’est donc revendiquée.

Le journal source reste non borné : chaque événement conserve une nouvelle
version des listes cumulées de preuves et d'essais. Leur volume total peut
croître quadratiquement avec les acquisitions et persiste entre époques.
Les bornes de recherche ne constituent donc pas une borne de mémoire totale de
session. Aucune compaction générale n'est revendiquée dans ce transfert.

La validation des checkpoints est plus stricte que celle du restaurateur
Python. Pour les entrées malformées, la comparaison porte sur le rejet et
l'atomicité, avec les classes et messages de chaque langage conservés séparément.
Cette qualification ne présente pas les deux validateurs comme identiques.

## Preuves indépendantes et suites ouvertes

L'exporteur [export-v6-selected-rigid-reference.py](../../scripts/export-v6-selected-rigid-reference.py)
exécute le Python original sur des rasters, retours et interventions d'état
déclarés. Le [comparateur TypeScript](../../scripts/compare-v6-selected-rigid-reference.ts)
compare les sorties complètes. La tentative 04 contient 18 cas initiaux,
sept sessions synthétiques, 25 étapes source, 22 acquisitions, neuf
interventions d'état et cinq cas de restauration. Les contrôles de temps
utilisent des horloges déterministes et ne constituent pas un benchmark.

La [capture passive](../../tests/helpers/capture-selected-rigid.ts) et les
[dix tests associés](../../tests/v6-selected-rigid-capture.test.ts) conservent
les appels, budgets, résultats, erreurs, états et restaurations effectivement
observés, sans lecture d'horloge ajoutée par l'instrumentation. Le
[vérificateur de présence](../../scripts/verify-selected-rigid-presence.py)
a été qualifié sur un rapport synthétique avec **30 mutations négatives sur 30
rejetées**. Ce rapport conserve trois préfixes, trois retours, deux acquisitions
sélectionnées, zéro acquisition passive et six restaurations réelles observées
par la capture synthétique. Il ne prouve pas une partie réelle.

Le [lecteur froid Python](../../scripts/compare-selected-rigid-public-parity.py)
a été exécuté sur la capture KLOT du gel de développement `development-freeze-01`.
Son [reçu terminal](lot6b-evidence/development-freeze-01/source-parity-attempt-01/reader-execution.json)
confirme **408 événements comparés, dont 340 appels racine, zéro différence**,
sans état ou plan natif utilisé comme amorce. Il reconstruit ses propres
propositions et checkpoints depuis les observations publiques et vérifie les
1 786 originaux avant et après. La
[campagne bornée](lot6b-evidence/development-freeze-01/bounded-execution.json)
atteint **trois niveaux KLOT, 38 actions et 30 préfixes**. Les entrées
pertinentes de cette exécution restent inchangées.

Les [résultats détaillés](lot6b-evidence/development-freeze-01/source-parity-attempt-01/result.json.gz)
retiennent 30 propositions, 38 gardes avant et après, 38 retours sélectionnés,
35 événements acquis, trois retours nuls de frontière et 98 restaurations
réelles, dont 60 natives et 38 source. Quatre retours modifient les hypothèses
de contrôle. Les **204 ablations** comprennent **63 changements d’action ou
de refus**, 198 résultats non vides et zéro erreur. Ces résultats établissent
une contribution sur cette campagne ; le retour étranger reste un cas
synthétique, puisque les 30 préfixes de KLOT sont sélectionnés SelectedRigid.

Le gel reste provisoire, issu de Site 97 / native 0.60, avec 0.64 réservé.
La réconciliation et la qualification après le prédécesseur effectivement
publié 0.63 restent à faire. La [qualification négative du lecteur](lot6b-evidence/development-freeze-01/reader-negative-attempt-01/results/qualification.json)
a ensuite réussi **deux mutations sémantiques sur deux**. Le
[reçu borné](lot6b-evidence/development-freeze-01/reader-negative-attempt-01/bounded-execution.json)
conserve l’exécution et son débit. L’horloge du cas est fermée à
**350,862153633 secondes**, avec **2 049,137846367 secondes restantes**.

La contribution de développement, les cas contraires, le navigateur, les
régressions finales, le coût officiel et la publication restent distincts. La règle de coût autorise un dépassement de
phase seulement si la médiane complète reste **strictement sous +10 % pour
chaque jeu** dans la fenêtre isolée retenue.

## État des portes de livraison après le développement

Les cinq premiers processus de contrôle ont rendu zéro, mais l’audit de
migration conserve trois références manquantes correspondant à deux fixtures
héritées. Ce passage reste sémantiquement incomplet. Le garde-fou de l’audit
rend désormais un échec pour des références absentes. Les fixtures ont ensuite
été restaurées exactement et le nouvel audit sémantique a réussi avec zéro
erreur ; la clôture ci-dessous conserve les reçus distincts. Aucun bilan
« cinq contrôles réussis » n’est attribué au premier passage.

La publication réellement courante est Site 101 / native 0.61, source
`d75a36f0a99bf6c301034523a3138a64d2f6e744`. Le gel 6B présenté conserve
sa base Site 97. Le checkpoint 5C `d54a58f2` ne vaut pas une publication
0.63 ; l’intégration finale, le navigateur, les régressions, le coût officiel
et la publication 6B restent ouverts.

Cette intégration devra transmettre `currentExecution` comme cinquième
argument des appels communs et conserver le délai hôte plus strict grâce au
helper d’horloge 10B revu. Ce raccordement n’est pas encore implémenté dans le
gel de développement, et les preuves actuelles ne lui sont pas attribuées.

## Clôture de la restauration des preuves héritées

Les deux fixtures historiques ont été reconstruites exactement depuis leurs parties, avec les empreintes de la validation publiée 6A. Le [reçu de restauration](lot6b-evidence/fixture-restoration/attempt-01/recovery.json) lie ces identités. Après le refus réel des références absentes par le garde corrigé, le [nouvel audit sémantique](lot6b-evidence/audit-guard/restored-inventory.json) réussit : zéro erreur, 198 composants vérifiés, 148 transferts partiels et 1 023 modules en attente. Le premier passage et ses trois erreurs restent conservés. Les sources natives, les résultats fonctionnels et les entrées du build sont inchangés.

# Lot 5B : contrats consommés de l'adressage matériel

## Périmètre et méthode

Cette section décrit la lecture statique initiale. Les vérifications exécutées ensuite sont consignées dans le complément en fin de document.

Lecture statique des agents V5/V6 immuables du commit
`786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`. Aucun moteur, spécification,
solution, `project_sources`, test, oracle ou jeu n'a été exécuté ou inspecté.
Les seuls fichiers hors de cette source consultés sont des documents de
migration et des métadonnées de captures publiques déjà conservées.

La chaîne effectivement consommée est :

`StrategyRouter.material_access` → `AddressedMaterial.propose` hérité
→ `AddressedField` →, après réemploi d'une frontière scorée, `FieldStock`.

Le wrapper `common_addressed_material.py` a 16 lignes ; le contrat ne se réduit
pas à ce wrapper. `common_addressed_field.py` a 386 lignes et
`common_field_stock.py` en a 378. Le stock est atteint par `ensure_stock`
depuis `propose`, `record` et `preservation_obligations`.

## Appelant et ordre

- Une instance `self.fields = AddressedMaterial()` appartient au routeur.
- `factored_material_return.ordered_subquestions` place
  `observed_addressed_material` après `reactive_contact_continuation`, avant
  `observed_rigid_cargo`, `observed_ranked_workshop`,
  `observed_symbol_transaction`, `observed_object_binding`, puis Inventory.
  L'ordre du DRM, et non l'ordre textuel des branches Python, est autoritaire.
- Une proposition truthy, y compris une proposition reconnue avec `actions: []`,
  reçoit `material_access_subquestion` et clôt cette chaîne. `None` décline la
  famille ; le refus stock ne doit pas être transformé en `None`.
- Le plan possède `field_plan`, ce qui sélectionne `strategy_router.fields`
  pour `bind`, `before`, `after` et l'acquisition sélectionnée.
- L'acquisition sélectionnée appelle `record(..., proposal, index,
  frames=public.frame_packet)` exactement une fois et conserve son retour sous
  `addressed_material_event:<revision>`.
- L'acquisition passive appelle `fields.record` pour chaque retour étranger,
  avec les rasters avant/après et les frames publiques. Elle omet proposal/index.
  Le retour est un dictionnaire truthy même pour `field_unresolved/events: []` :
  **cet événement vide est conservé par l'appelant**. Un filtre limité aux
  tableaux d'événements non vides serait une divergence.
- `choose_common` collecte `router.preservation_obligations(observation, rows)`
  **avant** `router.choose`. Après le choix, `bind_preservation` lie ces
  obligations. En cas de rejet, il réessaie le routeur en excluant des inputs
  les `revision_inputs` des obligations, puis peut produire
  `preservation_conflict/actions: []`.

## Observation, identité et adresses

`AddressedMaterial.before` et `.after` utilisent exactement
`LinkedPreparation.full_observation`. Une observation possédant déjà `entities`
est réutilisée ; sinon, la mesure neutre est reconstruite depuis les pixels,
l'époque, le score, l'état officiel, le hash, les actions disponibles et la
révision. Le préfixe du scope est celui avant `:epoch:` dans `observation_ref`.
`record` n'est pas surchargée : l'appelant commun lui fournit déjà les mesures
complètes des retours acquis.

La correspondance visible conserve d'abord les occurrences stationnaires
(signature et bbox identiques). Un groupe résiduel ne devient candidat qu'avec
exactement un ancien et un nouveau corps et une comparaison visible compatible.
Cette comparaison exige au moins deux abscisses et deux ordonnées de support
visible ; un mouvement de pixel ou de ligne seul ne suffit pas. Une identité
physique cachée n'est jamais déduite de cette seule correspondance.

La première hypothèse de champ exige :

1. Un ancien corps rectangulaire et un exemplaire de même signature stationnaire.
2. Un homologue de même masque, de palette différente, centré dans une enceinte
   distincte qui ne touche pas le bord du raster ; son support doit être dans
   l'intérieur rempli de cette enceinte.
3. Un seul couple candidat/but admissible.
4. Un input possédant exactement les clés `x` et `y`, situé à un offset intérieur
   du nouveau corps. L'action est celle observée ; aucune action ou palette
   propre à un jeu n'est fournie.

Chaque locus proposé lie un pixel public actuel unique, sa palette, son
propriétaire, son scope, sa projection unitaire et ses preuves symboliques.
`bind` copie ce témoin en `point_binding` ; le domaine commun garde ensuite le
point. Un témoin de centroid ne remplace pas ce témoin dérivé.

## Champ local : acquisition et continuation

État source : `policy`, `epoch`, `model`, `samples`, `indicator`, `lower_squared`,
`upper_squared`, `calibration`, `events`, `passed`, `prior`, `stock`.
`current_observation` est ajouté par le wrapper de garde après sa première
utilisation ; ce n'est pas une connaissance source initiale.

Le modèle conserve signature/palette/masque/taille/offset/position, exemplaire,
ombre/enceinte du but, action et observation source. Le contour transitoire est
une indication expérimentale, jamais une preuve de portée physique.

Pour une réponse liée :

- Corps déplacé exactement sur l'ancre pointée : augmente la borne inférieure
  de distance carrée acceptée.
- Corps stationnaire à une distance strictement supérieure à cette borne :
  réduit la borne supérieure rejetée.
- Toute autre réponse : événement de contre-exemple et abandon du modèle local.
- Une occurrence ambiguë reste `occurrence_unresolved` sans inventer de réponse.
- Les rivaux incluent alignement au clic, ancien déplacement fixe, approche
  limitée par les anciens axes, absence d'effet et, si mesuré, portée du contour.

Calibration : `different_offset` → éventuellement `outside_indicator` →
éventuellement `indicator_edge` → `navigation`, selon les retours observés.
La première expérience cherche une autre direction à distance carrée égale et
strictement plus éloignée sur au moins un axe que l'ancien déplacement, tout en
réduisant la distance au but. Les égalités et tris lexicographiques sont source.

La navigation énumère les ancres où le corps tient dans le raster, à distance
strictement positive et inférieure ou égale à la borne acquise. Elle choisit la
distance au but minimale, puis le point lexicographique. Au plus
`min(16, remaining)` actions sont composées. Une expérience inconnue possède
une destination nulle et clôt le préfixe après son retour.

La garde avant vérifie scope/score, référence initiale, action disponible,
empreinte du corps attendu, exemplaire et ombre. La garde après clôt sur frontière
officielle ou changement d'état ; sinon elle compare l'empreinte de destination.
Une comparaison inconnue n'est pas une confirmation.

## Frontières et réemploi

Toute différence d'époque ou de score ferme l'épisode du champ. Une hausse
officielle du score ajoute un témoin à `passed`. Si un stock existe, `retained`
en conserve les hypothèses. Sinon, le modèle retenu contient l'action, les
bornes, la ligne de l'exemplaire, la taille et l'enveloppe remplie du but, et les
templates de classe. `alignment_supported` exige au moins deux échantillons
alignés. Ce résultat reste une hypothèse locale à revalider.

Modèle, stock, échantillons, indicateur, bornes et calibration active sont remis
à zéro à cette frontière. `prior` et `passed` sont conservés. Attention à la
branche source distincte de simple changement d'`epoch` avant acquisition :
elle remet les champs locaux à zéro mais ne supprime pas à elle seule prior/stock.
Ne pas normaliser silencieusement cette différence dans un port déclaré exact.

## Stock typé : contrat intégral consommé

`FieldStock.create` exige une région de but retenue et une borne supérieure
connue. Il relie dans l'observation courante :

- Une échelle de carrés de palettes distinctes, même ligne et même côté,
  espacements constants, choisie d'abord par longueur décroissante puis proximité
  de la ligne de requête retenue.
- Des carrés de requête croisant cette ligne, hors de l'échelle, avec palette
  présente dans l'ordre courant.
- Des zones possédant la taille et l'enveloppe remplies du but retenu.

L'interface inclut échelle/requêtes et les séparateurs horizontaux traversant
toute la largeur. Les corps matériels sont les composants carrés rectangulaires
de l'ordre courant, hors de ces boîtes d'interface. Un template d'offset n'est
réutilisé que pour la taille correspondante ; un pixel isolé a l'offset nul.

Les règles retenues sont admises uniquement lorsque l'ordre de types correspond
exactement, avec intrant et produit présents dans cet ordre. Leur compteur est
remis à **zéro confirmation courante**, leur ancienne preuve devient
`prior_evidence` et leur liste de nouvelles preuves est vide.

La sélection réserve d'abord les types demandés déjà disponibles, livre les
corps prêts aux zones libres, puis examine les paires d'intrants non réservés
de même type, jusqu'au rang demandé. Une fusion vise la règle observée ou, à
défaut, le type adjacent comme hypothèse. Un locus doit influencer tous les
intrants choisis selon la borne acquise et exclure tous les autres selon la
borne rejetée. À défaut, déplacer/séparer un intrant prépare un accès ultérieur.

Une proposition stock compose au plus 16 actions, bornées aussi par remaining.
Elle s'arrête au premier effet inconnu ou si le prochain pixel à cliquer a été
modifié par les étapes précédentes. Une règle de fusion n'est simulable qu'à
partir de deux confirmations ; la mobilité d'un type dépend des mouvements
effectivement observés et de ses templates. La simulation ne confond pas
parenté jointe et identité de pixels conservée.

Les refus `typed_field_applicability_refuted` et
`typed_material_access_or_rewrite_unresolved` possèdent `actions: []` et restent
des réponses reconnues. Le champ ne doit pas les transformer en abstention.

### Obligations

Pour chaque type demandé, `minimums` retient monotonement le maximum de
`min(demande, quantité actuellement observée)`. L'obligation contient ce minimum,
la palette, les boîtes d'interface exclues, le scope, les preuves et l'action de
révision. Le plan stock fournit des `preservation_changes` qui lient la séquence
exacte et sa condition de rétablissement. Ces obligations s'appliquent aussi aux
autres fournisseurs par `choose_common`.

### Retours du stock

- Les changements sont comparés par feature `(palette, bbox)`.
- Un mouvement d'un seul corps de même palette acquiert offset/template et
  mobilité ; une fusion de deux intrants égaux vers un produit différent acquiert
  une règle et ses preuves.
- L'offset du produit doit être intérieur à sa boîte ; sinon le retour reste
  `material_anchor_unresolved`.
- La disparition/changement d'un intrant non sélectionné invalide l'applicabilité.
- Une règle rappelée différente peut être réfutée et remplacée sans invalidation
  globale tant qu'elle n'a aucune confirmation courante. Une règle déjà confirmée
  qui change invalide le contexte.
- Une fusion sélectionnée sans changement enregistre précisément la paire et
  son point dans `failures`, afin d'éviter cette répétition.
- Les origines sont réunies et triées ; elles sont créées depuis l'observation
  et la feature si aucun héritage n'existe. Aucune identité de pixels n'est affirmée.

## Restauration native et domaines sémantiques

Ni AddressedField ni FieldStock ne fournit de `state`/`restore` Python. Leur
snapshot/restauration TypeScript est une extension native à nommer et valider.
Il doit préserver tout l'état acquis et invalider les caches recalculables.

État FieldStock : `prior`, `epoch`, `order`, `requests`, `demands`, `zones`,
`interface_boxes`, `lower`, `upper`, `action_ref`, `templates`, `rules`,
`lineages`, `motion_types`, `minimums`, `failures`, `events`, `invalid`, `scene_ref`.
Les Counter/maps gardent l'ordre d'insertion ; les clés composites doivent
conserver une égalité structurelle. Les ensembles s'exportent en ordre
déterministe. Les compteurs, templates, masques, offsets, règles et leur preuve
doivent rester cohérents lors d'une restauration étrangère.

Les domaines natifs exigent les entiers exacts et les rasters publics bornés.
Les divisions de centres peuvent produire des demi-entiers. Python compare ses
listes/tuples lexicographiquement ; les tris stables départagent aussi certains
choix selon l'ordre d'observation. Les dictionnaires `data` doivent avoir
exactement deux clés, sans confondre absence, données invalides et réponse négative.

Les limites natives de temps, d'annulation et de travail doivent rester une
extension coopérative. Une interruption conserve l'incomplétude et ne crée ni
réfutation ni acquisition partielle. Les boucles raster × corps × pixels et
paires de stock sont les postes à borner ; le plafond de 16 étapes seul ne borne
pas leur coût. Une cache de corps doit être invalidée par le raster **et** les
templates/lignées/interface concernés, jamais par le seul hash d'image.

## Frontière avec 5C

5C consomme `morphology_policy/guarded_binding/ObservedBinding`, son
`BindingTracker`, son workflow SRC, ses gardes de réception/séparation et son
contrat d'AttentionMemory. Le stock 5B n'implique pas ce propriétaire. Il ne faut
ni marquer 5C raccordé ni importer son maintien de parent pour simuler un stock.
Les obligations de quantité du stock sont toutefois déjà une dépendance réelle
du caller commun et appartiennent au périmètre fidèle de 5B.

## Preuves publiques disponibles et à construire

La lecture bornée des métadonnées confirme des retours
`field_unresolved` dans `tests/fixtures/v6-native-caller/memo-first-prefix.json`
et `viewport-three-prefixes.json`. Ces captures conviennent au contrat passif,
à l'ordre d'acquisition et à la conservation des retours sans événement actif.
Elles ne constituent pas une preuve de proposition sélectionnée du champ.

Aucune campagne sélectionnant positivement AddressedMaterial n'a été identifiée
dans cette recherche bornée de métadonnées. Ne pas attribuer une preuve de
TypedMaterialFlow ou de FieldService à ce propriétaire différent.

Le témoin froid à construire doit passer par acquisition publique d'un mouvement
avec exemplaire stationnaire et homologue enfermé, contraste d'offset, retours
de portée, navigation gardée, frontière scorée, puis nouvelle échelle/requêtes/
zones et stock. Il doit comporter une branche contraire (absence d'effet,
intrant non sélectionné altéré, règle rappelée réfutée) qui change la proposition
suivante. L'oracle source indépendant doit conserver les refus et erreurs de
domaine, et le test commun doit garder l'ordre normal des autres propriétaires.


## Complément de mise en œuvre et de validation

Le port consommé de `FieldStock` se trouve dans `src/logos-engine/v6-field-stock.ts`.
Il garde les Maps dans leur ordre d’insertion, les minimums acquis, les lignées,
les règles encore à revalider et les échecs de questions. Le transport public
reste un objet JSON ordinaire ; `sourceState()` expose séparément les mappings
source comme des listes ordonnées de paires. Les clés de `prior.observed_rules`
conservent leur type source. `nativeState()` fournit un checkpoint immuable
mis en cache ; `fromState()` valide l’ensemble avant installation.

Les bornes coopératives interrompent la recherche sans créer une réfutation.
Une interruption après la mise à jour des minimums doit faire restaurer le
checkpoint précédent par l’adaptateur parent. La proposition source avec
`actions: []` reste un refus consommé, et ne devient pas une absence d’offre.

Les 13 tests ciblés de `tests/v6-field-stock.test.ts` ont passé après la libération
du créneau fonctionnel, sous verrou partagé. Le journal initial est conservé
dans `development/field-stock-contract-review/field-stock-tests-initial.log`.
Ce résultat couvre le composant ; il ne prouve pas une traversée complète du
parcours commun ou un budget de temps réel.

### Arrêt de préservation du parcours stock

Le parcours historique `development/common-stock-03` reste en échec après
16 retours, dont deux retours sélectionnés du stock : une fusion puis un
déplacement. À la révision 17, le journal du propriétaire se termine par
`preservation_obligations`, sans nouvel appel de `FieldStock.propose`.

Les deux appels de protection suivants concernent
`window_constraints / field_service_composition`, de type
`nested_control_experiment`. Le fournisseur propose `ACTION6(30,24)` sans
`preservation_changes`. L’obligation conserve au moins une occurrence de
matériau 4 et réserve la révision par `ACTION6`. Le premier réceptacle, dont
le bord reçoit le matériau déplacé, contient désormais trois valeurs ; seul
le second réceptacle satisfait encore la mesure source à deux valeurs.

Le diagnostic `development/common-stock-03/original-preservation-diagnostic.json`
rejoue les retours publics dans la mémoire de service originale et reproduit
exactement le candidat, y compris avec une liste d’inputs vide. Il compare
aussi les deux entrées de protection exactes : `common_preservation.bind`
original retourne les mêmes rejets. `choose_common` filtre les candidats
d’input mais conserve les actions publiquement disponibles ; le fournisseur
peut donc reposer la même question avant le stock.

Il s’agit d’une limite de coordination présente dans le contrat source, pas
d’une omission du port `FieldStock` ou de `bindPreservation`. Aucun retour
public, ordre de fournisseur, minimum acquis ou source de production n’a été
modifié pour contourner cet arrêt. Le diagnostic ne constitue pas un rejeu
complet de `StrategyRouter` et ne transforme pas l’essai historique en succès.

Le nouveau contrat `stock-preservation-refusal`, déclaré séparément avant les
exécutions finales, porte seulement sur le préfixe stock réellement consommé
et sur son arrêt conforme. Une preuve originale fournisseur/préservation
distincte est exigée. Le relecteur préparé est
`scripts/review-addressed-preservation-original.py` ; au moment de cette
actualisation il n’a pas été exécuté sur le code final intégré.

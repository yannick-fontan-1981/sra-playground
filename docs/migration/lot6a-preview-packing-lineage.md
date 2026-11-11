# Lot 6A : contrats consommés de PreviewPacking

## Statut et provenance

Ce document décrit le candidat reconstruit depuis la source immuable V6/V5 du
commit `786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`, ainsi que les nouvelles
vérifications synthétiques exécutées le 11 novembre 2026. Les observations de
l'ancien candidat local perdu ne sont pas réattribuées à cette reconstruction.
Les reçus cités ici appartiennent à
[`lot6a-evidence/recovery/oracle`](lot6a-evidence/recovery/oracle).

L'oracle exécute les classes et fonctions Python originales sur des rasters
publics construits, des réponses déclarées et des interventions explicitement
nommées. Il ne charge ni module natif TypeScript, ni moteur de jeu, ni niveau
privé. Le lecteur des captures repart aussi d'une instance Python vide ; les
états et plans natifs servent à la comparaison, jamais à amorcer cette instance.

Le [manifeste original](../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/manifest.json)
contient **1 786 fichiers**. L'export et les relectures vérifient leurs tailles
et SHA-256 avant les imports puis après l'exécution. Son empreinte est
`491eb3b737bbb490a1b7c212f5b1e75f5a8f84b2124b95d9dd54a0d09eca85d6`
pour 424 024 octets. Les **724 fichiers importés ou explicitement consommés**
enregistrés dans la fixture constituent une provenance supplémentaire. Ce
nombre ne remplace pas la vérification des 1 786 fichiers et ne signifie pas
que toutes les fonctions de ces 724 fichiers ont été exercées.

## Sources exactes et partage des responsabilités

Tous les chemins source de cette section sont sous
`reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/`.

| Source | Contrat effectivement consommé |
| --- | --- |
| [`agents/yf_arc3_v6/morphology_policy/preview_packing/family.py`](../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/morphology_policy/preview_packing/family.py) | Adaptation aux signatures courantes, état JSON, restauration, plafond du préfixe, disponibilité, propriétaire unique du point, hash de politique, liaison exacte et acquisition sélectionnée. |
| [`agents/yf_arc3_v6/morphology_policy/preview_packing/donor.py`](../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/morphology_policy/preview_packing/donor.py) | Mesure du pavage, occurrences, hypothèse de partition, choix d'une cible, recherche par contrôles acquis, gardes de pose, apprentissage depuis les retours. |
| [`agents/yf_arc3_v6/morphology_policy/preview_packing/base.py`](../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/morphology_policy/preview_packing/base.py) | Frontière neutre : abstention, retour vide et gardes « wrong provider ». Aucune loi d'une autre famille B n'est héritée de cette base. |
| [`agents/yf_arc3_v6/morphology_policy/preview_packing/preview.drm`](../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/morphology_policy/preview_packing/preview.drm) | Rôles mesurés, motifs des questions de sélection, de contrôle et de transport ; sélection et partition restent des hypothèses. |
| [`agents/yf_arc3_v5/capabilities/preview_piece_packing.py`](../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v5/capabilities/preview_piece_packing.py) | Modèles `PackingPiece`, `PackingPose`, `PackingModel`, `PackingState`, `PackingPoseDomain` ; transformation normalisée, domaines, validation des poses, orbite des formes et `_residual`. |
| [`agents/yf_arc3_v5/capabilities/mechanical_family_contracts_d.py`](../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v5/capabilities/mechanical_family_contracts_d.py) | `DWorkBudget`, interruptions et prérequis du calcul fini consommé. |
| [`agents/yf_arc3_v6/laya_proto/geometric_observer.py`](../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/laya_proto/geometric_observer.py) et [`neutral_observer.py`](../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/laya_proto/neutral_observer.py) | Composants visibles, entités, masques, boîtes, signatures et références de l'observation publique. |
| [`agents/yf_arc3_v6/laya_proto/observed_input_domain.py`](../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/laya_proto/observed_input_domain.py) et [`common_frontier_policy.drm.json`](../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/laya_proto/common_frontier_policy.drm.json) | Domaine d'inputs observés, dont la limite commune de 250 candidats pointés, reconstruit indépendamment dans le lecteur. |
| [`agents/yf_arc3_v6/laya_proto/src_bridge.py`](../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/laya_proto/src_bridge.py) et [`terminal_composition.py`](../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/laya_proto/terminal_composition.py) | Transport JSON `plain` et identité déterministe des plans, rasters et états retenus. |
| [`agents/yf_arc3_v6/morphology_policy/strategy.py`](../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/morphology_policy/strategy.py), [`strategy.drm`](../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/morphology_policy/strategy.drm) et [`laya_proto/common_frontier.py`](../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/laya_proto/common_frontier.py) | Propriétaire unique, ordre des sous-questions, acquisition sélectionnée et maintien des checkpoints chez l'appelant. |

Le port se répartit entre
[`v6-preview-packing.ts`](../../src/logos-engine/v6-preview-packing.ts),
[`v6-preview-packing-types.ts`](../../src/logos-engine/v6-preview-packing-types.ts),
[`v6-preview-packing-geometry.ts`](../../src/logos-engine/v6-preview-packing-geometry.ts)
et [`v6-preview-packing-calculus.ts`](../../src/logos-engine/v6-preview-packing-calculus.ts).
L'adaptateur de famille et l'acquisition vivent dans
[`v6-native-runtime.ts`](../../src/logos-engine/v6-native-runtime.ts).

Consommer `_residual` et `_transform` ne transfère pas l'ensemble de la
capacité V5. Les transactions physiques V5, lois de libération, programmes de
prise/dépose, calculs de transport et autres entrées de ce fichier ne sont pas
revendiqués comme implémentés par ce lot.

## État source et restaurations

L'état source comprend exactement quatre champs.

| Champ | Contenu et durée de vie |
| --- | --- |
| `packing_events` | Historique des événements `observed_preview_packing`, avec modèle, contrôles et détail du retour acquis. |
| `packing_model` | Inventaire complet, grille, monde, sélection, couleur de prévisualisation, époque, essais à une pose et références d'observation. Il est réutilisé pour son époque. |
| `packing_controls` | Effets de translation ou de transformation associés aux actions effectivement observées, avec preuves avant/après. Ils persistent à travers les époques. |
| `_packing_scene_cache` | Mesures initiales indexées par époque, y compris une mesure `null`. La restauration Python reconvertit les clés JSON en entiers. |

Le `retained_digest` source omet le cache. Comparer uniquement ce digest ne
suffit donc pas à démontrer une restauration exacte. La projection native
`sourceState()` expose les quatre champs ; `restoreSourceState()` reçoit cette
projection. L'enveloppe `native.preview_packing.v1`, utilisée par
`nativeState()` et `restoreNative()`, ajoute uniquement son champ `schema`.
Les enveloppes sont validées intégralement avant installation ; les snapshots
retenus sont détachés et immuables. Les restaurations d'une même référence ou
d'un état égal ont un chemin court sans changer l'état logique.

`propose` peut compléter le cache de mesure mais n'acquiert ni contrôle, ni
événement, ni nouveau modèle appris. `record` acquiert le modèle et les
contrôles à partir du retour sélectionné. Une mesure initiale `null` reste
retenue pendant toute l'époque, même si un raster ultérieur aurait permis une
mesure ; une nouvelle époque permet une nouvelle tentative.

## Mesure publique et ordre des occurrences

Le donneur mesure les composants du raster, puis choisit la couleur majoritaire
par `Counter.most_common`. Les égalités suivent la première occurrence. Il
cherche au moins trois carrés de même palette et largeur, entre 2 et 12 pixels,
dans une enceinte dont l'anneau est complet. Le pas de grille vaut la largeur
du carré plus un ; les dimensions intérieures doivent être divisibles par ce
pas. Il échantillonne les cellules et conserve une palette dominante lorsqu'elle
occupe au moins `q² − 1` pixels, hors fond, vide et cadre.

Les cellules voisines de même palette sont regroupées. Les groupes d'au moins
deux cellules entièrement intérieurs deviennent des occurrences fixes ; les
groupes entièrement extérieurs admissibles deviennent mobiles. Leur aire
totale doit remplir exactement le résidu intérieur. Les masques sont normalisés
sur leur ancre supérieure gauche et triés en coordonnées `[ligne, colonne]`.
L'ordre final est celui des occurrences intérieures puis extérieures, donnant
les identifiants `piece:0`, `piece:1`, etc.

Cet ordre dépend aussi de `remaining = set(values)`, où `values` est un
dictionnaire Python. La préallocation de `set(dict)` dans CPython 3.12 ne
produit pas toujours le même parcours que des insertions successives dans un
ensemble. Le port utilise une adaptation locale de sa table de points et
conserve le helper partagé. Les scènes originales à 20 et 24 cellules, ainsi
que les scènes plus petites, vérifient ce comportement sans trier les pièces
après coup. La fixture teste séparément une égalité de majorité de palette.

Le point proposé est le centre de la première cellule du masque choisi. La
famille vérifie qu'il appartient à **une seule entité actuellement mesurée**.
Le `point_binding` conserve son propriétaire, signature, boîte, référence
d'observation, époque, hash du raster, coordonnées et palette observée. Deux
propriétaires ou aucun entraînent une abstention. La présence préalable du
point dans la liste des candidats ne remplace pas ce témoin courant.

## Partition finie conditionnelle

Le donneur prépare les modèles V5 avec toutes les occurrences, y compris les
occurrences fixes déjà à l'intérieur. Pour une occurrence mobile, il énumère
les rotations normalisées, puis les ancres du plateau ; pour une occurrence
fixe, seule sa pose courante est admissible. Les masques et ancres gardent leurs
ordres source. Le modèle déclare une partition stricte de toute la population,
une ancre supérieure gauche normalisée et les rotations permises. Ces valeurs
définissent la question géométrique ; elles ne constituent pas des lois du jeu
acquises par observation.

`_residual` valide les domaines, l'identité des pièces, les masques complets,
l'état courant et la couverture du monde. Il parcourt les références dans
l'ordre lexicographique Python : **`piece:10` précède `piece:2`**. Il énumère les
partitions sans recouvrement dans l'ordre des domaines, sous les bornes de la
requête. Une différence d'aire donne une liste de solutions vide et un résultat
exhaustif dans les domaines fournis ; une interruption ne donne pas un tel
certificat.

Le donneur choisit, parmi les solutions effectivement énumérées, la somme
minimale des distances de Manhattan des ancres, augmentée de 3 pour chaque
masque modifié. La première solution à égalité est conservée. La fixture
compare les listes complètes, les choix et les égalités, sans normalisation de
l'ordre. Le champ V5 `minimum_cost_claimed: false` demeure présent : la requête
résiduelle elle-même n'est pas un solveur d'optimisation du transport physique.

## Proposition, contrôles et gardes

Une occurrence mobile qui diffère de sa cible reste en attente. La sélection
retenue est préférée lorsqu'elle fait encore partie de cette liste ; sinon le
donneur choisit sa première occurrence et propose `ACTION6` sur son point lié.
Le nom de cette action de sélection appartient au contrat source. Les noms des
actions de déplacement et de rotation n'ont aucune signification directionnelle
préchargée.

Pour une occurrence sélectionnée, une recherche en largeur applique les
contrôles acquis et actuellement disponibles, dans l'ordre des références
d'action. Les poses doivent rester dans le monde mesuré. Le préfixe est limité
à `min(16, remaining)`. Si aucun chemin connu n'est trouvé dans les conditions
qualifiées, le donneur peut proposer la première action inconnue, sans données
pointées, non encore essayée à cette pose. Sa réponse attendue est inconnue et
ferme le préfixe. Les commandes source sans `data` conservent cette absence
dans la proposition et les retours du composant ; la normalisation éventuelle
du protocole hôte est traitée séparément dans la capture.

`bind` exige une liste non vide de 16 actions au plus et l'égalité exacte entre
`actions`, les actions de `steps`, les `commands` du plan et celles du
`bundle_template`. Le hash de `preview.drm` doit être celui de la politique
chargée. Une modification d'une de ces représentations est refusée. La garde
`before` vérifie ensuite l'identité du plan, l'époque, le score et la
disponibilité de l'action.

- Au premier pas, elle exige le digest du raster initial et la même référence
  d'observation.
- Aux pas suivants, elle mesure la pose de prévisualisation et la compare à
  `before_poses[index]`. Elle n'exige pas une nouvelle égalité de tout le raster.
- Après le retour, un changement d'époque **ou** de score donne `matched: null`
  et ferme le préfixe. Une réponse inconnue le ferme également. Une réponse
  connue ne permet la continuation que si sa pose correspond exactement.

Trois refus source demeurent bloquants : partition absente sous l'hypothèse de
préservation courante, partition géométrique déjà présente sans but officiel
acquis, ou contrôle/préparation manquant. Leur `block_unrelated_probe: true`
est conservé dans l'adaptateur. Ils ne deviennent pas une abstention autorisant
une exploration étrangère.

## Acquisition, frontières et appelant

Le wrapper source n'appelle le donneur `record` qu'avec une proposition
sélectionnée portant `preview_packing_plan`. Un retour étranger sans ce plan
donne `None`. Il n'existe pas d'apprentissage passif PreviewPacking.

Une sélection n'est acquise que si les cellules de l'occurrence ont une seule
nouvelle couleur commune. Sans recoloration reconnue, la sélection peut être
proposée de nouveau. Pour une édition, la pose observée est retenue lorsqu'elle
est mesurable, mais un contrôle n'est appris que dans deux cas :

- même masque et translation de distance de Manhattan exactement égale à un ;
- même ancre et **une seule** transformation compatible parmi `rotate_cw`,
  `rotate_ccw`, `reflect_rows` et `reflect_columns`, avec masque modifié.

Une forme symétrique ou un coude dont la rotation coïncide avec une réflexion
ne suffit pas à identifier un contrôle. La fixture comporte ces ambiguïtés et
un tétrimino chiral dont le quart de tour est acquis sans ambiguïté. Un
déplacement de plusieurs cellules peut modifier la pose retenue sans devenir
un contrôle unitaire. Une divergence ultérieure ne rétracte pas
systématiquement les contrôles déjà appris ; ce comportement source est
conservé et explicitement testé.

La frontière de `record` est plus étroite que celle de `after` : **seul un
changement d'époque** produit ici un retour `preview_packing_return` avec
`events: []`, `boundary: true`, sans modifier l'état retenu. Un changement de
score dans la même époque ferme la garde après mais acquiert encore le retour.
Cette distinction n'est pas normalisée en une remise à zéro générale.

L'appelant natif possède un seul propriétaire brut `NativePreviewPacking`,
relié à son wrapper. La sous-question `goal_access.preview_packing` conserve
son rang après `subset` et avant `selected_rigid`. Aucun programme SRC n'est
ajouté. L'acquisition conserve le retour sélectionné sous
`preview_packing_event:<revision>`. Lorsqu'un modèle est retenu, le checkpoint
des quatre champs est conservé puis réellement restauré, y compris après un
retour sélectionné par une autre famille ; cette étape reste après Workshop
et avant Axial. L'absence de `record` passif ne signifie donc pas absence de
persistance sur un retour étranger.

La [revue statique du composant et de son intégration](lot6a-evidence/recovery/native-source-review.json)
étaye ces contrats sur ses entrées identifiées par empreinte. Sa conclusion
est limitée à cette lecture ; elle ne vaut pas revue du lecteur Python ni
preuve d'équivalence générale de l'appelant.

## Bornes natives et refus explicites

| Domaine | Borne consommée ou adaptation |
| --- | --- |
| Population et masques | De 1 à 32 pièces ; de 1 à 128 cellules par masque, conformément aux modèles Pydantic consommés. |
| Monde et plateau | De 1 à 4 096 cellules chacun. |
| Domaines de poses et solutions | 4 096 au plus ; profondeur de partition au plus 32. |
| Calcul résiduel | 100 000 visites au plus et budget source de 2 000 ms. |
| Recherche de contrôle | Seuil de 20 000 états découverts, avec refus natif explicite si cette frontière interrompt la recherche. |
| Exécution native | Vérifications de l'annulation et de l'échéance courante ; points de coopération tous les 256 travaux lorsque l'exécution fournit `yieldControl`. |
| Préfixe physique proposé | 16 commandes au plus, limité aussi par le budget d'actions restant. |

Les limites par instance sont figées et ne peuvent qu'être resserrées. Une
interruption connue devient `status: unknown`,
`reason: preview_packing_search_incomplete`, `block_unrelated_probe: true`,
avec cause, visites, travail et frontière dans `native_incomplete`. Aucune
solution partielle n'autorise une action.

Deux différences de domaine sont explicites. Les rejets des modèles Pydantic
et les interruptions Python sont traduits en refus bornés du composant natif.
De plus, à épuisement du seuil de recherche de contrôle, le natif bloque ; la
source peut atteindre ensuite son repli vers un contrôle inconnu. Cette
adaptation ne doit pas être présentée comme une parité de résultats sur ce
domaine interrompu.

Le budget de 2 000 ms porte sur le calcul résiduel, après la préparation des
domaines ; il ne borne pas toute la proposition. La mesure de scène est finie
et synchrone. Les preuves présentes n'établissent ni une latence maximale
globale ni une pause immédiate à tout instant de cette mesure. L'historique et
le cache ne sont pas compactés, et aucune stabilité sur des heures de session
n'est déduite de ces cas courts.

## Oracle synthétique final : résultats réellement exécutés

L'[exporteur Python](../../scripts/export-v6-preview-packing-reference.py)
fonctionne avec Python 3.12.14, `PYTHONHASHSEED=0` et `-B`. Le transport
tuple/liste JSON est sa seule normalisation de sortie ; les masques, pièces,
solutions, commandes, événements et contrôles ne sont pas retriés pour
faciliter la comparaison. Les observations ordinaires proviennent de
l'observateur original. Les interventions de propriété ambiguë ou d'état sont
identifiées comme telles, sans être présentées comme des observations
naturelles du moteur.

Le [reçu d'export final 05](lot6a-evidence/recovery/oracle/export-attempt-05.json)
et le [reçu de comparaison final 05](lot6a-evidence/recovery/oracle/source-reference-comparison-05.json)
établissent :

| Famille de cas | Quantité et contenu |
| --- | --- |
| Entrées initiales | 15 : ordre des pièces, pièces fixes, budgets, absence d'actions, unicité du point, défaut d'aire/cadre, translation de grille et permutation des palettes. |
| Sessions originales | 10 sessions, 32 pas : sélection, translations unitaires et non unitaires, réponse absente, ambiguïtés de transformation, quart de tour chiral, score seul, époque et divergence d'un contrôle connu. |
| Helpers | 50 cas : 5 normalisations, 20 transformations, 6 scènes, 8 points, 1 majorité, 4 poses et 6 énumérations de partition. |
| Gardes | 17 : 11 gardes initiales/liaisons, 2 continuations, 4 gardes après. Le compteur `guards: 11` du reçu d'export désigne seulement son premier groupe. |
| Acquisition étrangère | 2 cas sans proposition sélectionnée valide. |
| Interventions d'état | 9 : contrôles, événements, cache, null persistant, nouvelle époque et refus géométriques/de contrôle. |
| Comparaison native/source | **1 288 vérifications réussies**, comprenant 724 vérifications d'empreinte et 564 autres comparaisons. Ce total n'est pas un nombre de scénarios indépendants. |

La fixture finale
[`tests/fixtures/v6-preview-packing/reference.json.gz`](../../tests/fixtures/v6-preview-packing/reference.json.gz)
fait 127 971 octets compressés, 2 505 615 octets JSON ; SHA-256
`28753606394946cf26d9f6a44c5ce13aa9978f26e198fb52c80f716e71846795`.
Les sorties attendues sont les sorties exécutées de la source originale, sans
construction depuis une implémentation TypeScript miroir.

## Relecture à froid de la capture du vrai appelant synthétique

Le [lecteur Python indépendant](../../scripts/compare-preview-packing-public-parity.py)
reconstruit les observations et le domaine d'inputs depuis les rasters et
métadonnées publiques. Il vérifie chaque entrée/sortie de la chronologie
`propose`, `before`, `after`, `record` et des restaurations effectives. Une
proposition Python précédemment produite sert ensuite aux gardes et à
l'acquisition ; la proposition native est d'abord comparée et ne remplace pas
cette proposition indépendante.

Une restauration reçue est comparée à l'état indépendamment acquis, puis
l'original restaure une copie de **son propre état**. Le lecteur refuse les
événements absents, curseurs non entiers, appels inachevés, erreurs
d'observation, résultats omis et imbrications non qualifiées. Il exige une
garde avant et après pour chaque acquisition, une correspondance exacte des
actions physiques et paquets de frames, ainsi qu'une couverture de tous les
retours sélectionnés par les préfixes. La révision d'observation et le numéro
d'action physique sont deux compteurs distincts ; leur association est
chronologique, avec la révision de décision contrôlée explicitement.

Les seules annotations de proposition communes traitées séparément sont
`strategy_receipt`, `morphology` et `composition_target_tree`, à la racine.
Leur structure est vérifiée et leur valeur retenue dans le rapport. Aucun
champ du plan PreviewPacking n'est effacé pour obtenir une égalité.

La capture du vrai appelant
[`runtime-synthetic-capture-04.json.gz`](lot6a-evidence/recovery/oracle/runtime-synthetic-capture-04.json.gz)
utilise une interface construite, nommée `SYN1`, complétée en raster 64 × 64.
Le [reçu de relecture 03](lot6a-evidence/recovery/oracle/runtime-synthetic-source-parity-execution-03.json)
et son [rapport complet](lot6a-evidence/recovery/oracle/runtime-synthetic-source-parity-03.json.gz)
constatent **25 événements sur 25 comparés, zéro différence** :

- 3 propositions, 4 gardes avant, 4 gardes après et 4 acquisitions sélectionnées ;
- 10 restaurations effectives, 3 préfixes sélectionnés et 5 observations uniques ;
- 3 acquisitions modifiant le modèle, 2 modifiant les contrôles, 1 retour de
  frontière d'époque ;
- 12 ablations depuis l'état source indépendant, dont 7 non vides, 3 modifiant
  l'action ou le refus et aucune en erreur.

Les quatre ablations retirent séparément événements, modèle, contrôles et
cache. Leurs nombres sont des observations de cette capture ; aucune valeur
n'est imposée aux captures ultérieures. La capture compte zéro préfixe
étranger : cette exécution ne prouve donc pas à elle seule le trajet complet
d'une acquisition étrangère chez l'appelant.

La capture 04 contient aussi les champs passifs `acquired` et
`retainedSourceFact`. Le lecteur Python actuel ne les utilise pas comme
comparands supplémentaires. Sa preuve porte sur les retours bruts, états de
checkpoint, états d'instance, gardes, actions, paquets publics et restaurations
énumérés ci-dessus. Les assertions propres à ces deux faits d'appelant restent
distinctes.

La [qualification négative finale 02](lot6a-evidence/recovery/oracle/reader-runtime-negative-qualification-02.json),
produite par le [générateur durable](../../scripts/qualify-preview-packing-reader.py),
détecte **23 mutations sur 23** de la capture runtime 03. Elle couvre notamment
état avant/après, résultat et plan modifiés, entrée de restauration, schéma,
ordre, garde manquante, inputs remesurés, commande physique, révision de
décision, paquet d'animation, checkpoint et couverture des préfixes. Pour les
cinq premières mutations de comparands, l'état final de l'original reste celui
de l'exécution non modifiée : elles n'ont pas servi de graines à l'oracle.
La qualification conserve tous les verdicts individuels ; elle ne constitue
pas une preuve de bon fonctionnement dans tous les environnements possibles.

## Tentatives conservées et limites de portée

Les tentatives restent disponibles au lieu d'être remplacées par les succès :

- `export-attempt-01.json` conserve un échec du constructeur de fixture sur
  une comparaison tuple/liste pour un propriétaire de point. La correction a
  porté sur ce constructeur, pas sur la source originale.
- Les exports 02 à 04 et leurs anciennes fixtures conservées documentent
  l'ajout des scènes `set(dict)` puis du cas chiral. Le coude triangulaire est
  correctement qualifié d'ambigu ; seul le nouveau tétrimino établit le cas
  positif de transformation unique.
- Les captures runtime 01 et 02 conservent les préparations échouées du
  scénario synthétique, respectivement sur la taille du raster et la
  représentation de `data` dans la commande hôte.
- `runtime-synthetic-source-parity-execution-01.json` et son rapport conservent
  l'échec du lecteur qui confondait révision d'observation et rang d'action
  physique. La correction du lecteur a précédé la relecture réussie 02 puis
  03, sans modifier le composant natif pour résoudre cet écart.

La portée acquise est une parité exacte sur les entrées finies qualifiées,
complétée d'une capture synthétique du vrai appelant et de contrôles négatifs
du lecteur. La mesure géométrique et sa partition ne démontrent ni une identité
physique cachée, ni une loi universelle de transport, ni la condition officielle
de succès. Les interruptions, longues sessions et parcours non rencontrés
restent soumis aux limites explicites précédentes. La preuve d'un port complet
de l'appelant ne découle pas du seul nombre de vérifications de cette fixture.

## Outils figés et commande de relecture

| Fichier | Octets | SHA-256 |
| --- | ---: | --- |
| `scripts/export-v6-preview-packing-reference.py` | 31 295 | `dced3e4702fef4b319a409f25ec8a1e0a15798d38fb169e5bc8329e203c47de4` |
| `scripts/compare-v6-preview-packing-reference.ts` | 11 455 | `413df36916c95308b1c1bc62e43a5bc4e968f4b84b43a5216b94f0a84ef20fff` |
| `scripts/compare-preview-packing-public-parity.py` | 30 645 | `06c684ddf63a1a99f7b905266d8205421101530beab10783bb691a6c373018fd` |
| `scripts/qualify-preview-packing-reader.py` | 8 065 | `00161d49c826a0d2e5f259dfa5d6b6e2f49b3c10711d3d2774e9a00ca3ec0096` |
| `scripts/qualify-preview-packing-capture.ts` | 2 765 | `913a1b393fcede5ade3f6e114b04338cc47c5a456f734bd82929b1defae47906` |

Pour une nouvelle capture, le lecteur se lance depuis la racine du dépôt avec
des chemins de sortie et de reçu encore inutilisés :

```sh
PYTHONHASHSEED=0 python3 -B scripts/compare-preview-packing-public-parity.py \
  --report CHEMIN_CAPTURE.json.gz \
  --output NOUVEAU_RAPPORT_PARITE.json.gz \
  --receipt NOUVEAU_RECU_EXECUTION.json \
  --require-prefixes
```

Les ablations restent activées. Les compteurs
`selectedRecords`, `modelChangingRecords`, `controlChangingRecords`,
`epochBoundaryReturns`, `actualRestores` et `actionChangingAblations` doivent
être repris avec leurs valeurs réellement observées, sans leur substituer
celles du scénario synthétique. Un résultat favorable exige le statut réussi,
l'absence de différences et d'arrêt, la comparaison de toute la chronologie,
les gardes et actions physiques correspondantes, la couverture des préfixes
et l'intégrité finale des 1 786 sources.

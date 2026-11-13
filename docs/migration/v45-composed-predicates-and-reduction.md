# CATL terminé et trois niveaux de LF52 : prédicats composés et réduction, v45

## Résultats constatés

Le **Logos Engine natif termine les six niveaux de CATL avec l'état officiel
`WIN`, en 48 actions : huit par niveau**. La campagne part du premier niveau,
avec une mémoire froide, et conserve une seule session. Les trois premiers
niveaux sont donc terminés en 24 actions.

| Niveau terminé | Actions du niveau | Actions cumulées | Préfixes acquis cumulés |
|---|---:|---:|---:|
| 1 | 8 | 8 | 8 |
| 2 | 8 | 16 | 16 |
| 3 | 8 | 24 | 24 |
| 4 | 8 | 32 | 32 |
| 5 | 8 | 40 | 40 |
| 6 | 8 | 48 | 48 |

La [campagne CATL finale](native-campaigns-v45/catl-six-levels.json) conserve les
48 commandes, les six frontières officielles et les 48 préfixes acquis.
Le caller commun, le programme SRC, WHY/ACT et les gardes de la primitive
participent à chaque action. Les 48 retours physiques sont acquis dans le
Kernel. Aucun module d'agent Python n'est chargé. La
[trace publique complète](native-campaigns-v45/catl-public-trace.json.gz)
conserve les 49 paquets réellement reçus et leurs 127 images, initiale comprise.

Le second travail est le transfert de **ReductionTransport**, raccordé par
l'entrée source `supported_ternary_reduction`. Ses **106 contrôles de parité
passent**. Après une correction explicite de la coordination native,
**LF52 termine ses trois premiers niveaux en 104 actions**, dans une session
commune froide et continue. La cible de trois niveaux est atteinte à l'entrée
du niveau 4, avec l'état officiel `NOT_FINISHED`.

| Niveau LF52 terminé | Actions du niveau | Actions cumulées |
|---|---:|---:|
| 1 | 8 | 8 |
| 2 | 40 | 48 |
| 3 | 56 | 104 |

La [campagne LF52 finale](native-campaigns-v45/lf52-three-levels.json)
conserve **71 préfixes acquis : 69 de réduction et deux d'accès à un effet
observé**. Sa [trace publique](native-campaigns-v45/lf52-public-trace.json.gz)
comprend **105 paquets et 502 images**, initiale comprise. Les 104 retours
sont acquis dans le Kernel. Le composant Python original isolé termine
les trois mêmes niveaux en 102 actions et 69 préfixes ; cette trajectoire
différente est une preuve de composant, détaillée séparément ci-dessous.

## Identité du code et portée de cette étape

Le [manifeste final de coordination](native-campaigns-v45/source-manifest.json)
contient **149 fichiers natifs**, avec l'empreinte :

`1278235f269085c057e4dfea619c5a65587bfd90998505858caeef067319640c`

Cette révision ajoute le helper de témoins de continuation et modifie le
runtime, les types d'interface et l'adaptateur de la famille partagée.
Le composant ReductionTransport et le calcul de composition de prédicats
restent inchangés. Les campagnes finales CATL et LF52 ainsi que les
227 contrôles ciblés passent sur cette révision. Les fichiers du manifeste
restent identiques pendant ces exécutions.

La [première campagne CATL conservée](native-campaigns-v45/before-continuation-coordination/catl-six-levels.json)
et la suite globale utilisent aussi l'identifiant
`logos-engine.typescript.v6.native-migration/0.15.0`. Les **148 fichiers
natifs de ce premier état** restent inchangés pendant ces exécutions. Le
[manifeste source initial conservé](native-campaigns-v45/before-continuation-coordination/source-manifest.json) porte l'empreinte :

`2819ec88e8c6b9c00c2ff04b9086dd7958d7cfdffef93c5a7edad1f2e16c789f`

La référence Python reste le commit
`786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`. Ses fichiers sont conservés
inchangés. Cette étape distingue le transfert d'un composant source existant
pour ReductionTransport et une extension native de la grammaire produite
pour les séquences étiquetées. Une autre extension native traite ensuite
le conflit de sélection observé sur LF52. Ces deux extensions ne comptent
pas comme de nouvelles entrées DRM transférées.

Les octets des premières campagnes et de leurs journaux sont conservés
dans `before-continuation-coordination`, avec une
[table de correspondance des chemins et empreintes](native-campaigns-v45/before-continuation-coordination/retention-map.json).
Les chemins mentionnés dans les reçus initiaux restent leurs lieux de capture
d'origine. La suite de 5 255 tests appartient au manifeste initial de
148 sources. Les preuves de la correction de coordination sont enregistrées
séparément sur le manifeste final de 149 sources, sans lui attribuer cette
suite antérieure.

## Une grammaire composée générique

Le [diagnostic v44](native-campaigns-v44/catl-next-level-diagnosis.json)
avait établi une contradiction complète au sixième niveau de CATL :
les 80 prédicats atomiques et leurs compléments étaient tous réfutés par
au moins un des 20 exemples visibles. Les panneaux et leurs caractéristiques
étaient correctement mesurés. La difficulté venait de la grammaire finie
produite par le helper source.

L'[extension native](../../src/logos-engine/v6-labeled-sequence-composition.ts)
conserve ce helper et son résultat. Elle ne s'active qu'après
`COMPLETE / MODEL_CONTRADICTION`, avec un domaine atomique complet et aucune
hypothèse compatible. Une réponse atomique existante, une ambiguïté atomique
ou une interruption ne déclenchent pas cette extension.

La nouvelle langue contient tous les littéraux source `ATOM` et `NOT(ATOM)`,
puis une expression `AND` et une expression `OR` pour chaque paire distincte
non ordonnée de littéraux. Elle comporte **une seule couche binaire**.
Les valeurs candidates des atomes restent celles mesurées dans les exemples.
Avec les deux opérateurs activés et `n` littéraux, le domaine possède
`n + 2 × n × (n − 1) / 2 = n²` racines. Pour le panneau de CATL6, cela donne
**80 littéraux et 6 320 compositions, soit 6 400 racines**.

Un atome réfuté seul reste une brique possible d'une composition. Par exemple,
deux propriétés insuffisantes séparément peuvent devenir adéquates sous
`AND` ou `OR`. Le calcul ne retient pas seulement la première formule qui
convient. Il conserve toutes les expressions compatibles avec les exemples,
puis compare leurs réponses à la requête actuelle. Une divergence impose
l'abstention. Deux expressions équivalentes sur les exemples restent
distinctes si elles peuvent répondre différemment à une nouvelle requête.

Les limites par défaut sont explicites : 128 littéraux, 16 384 racines,
256 expressions compatibles conservées, 128 exemples et 100 000 visites
comptées. La limite temporelle propre est au plus de 300 000 ms et reste
soumise à l'échéance disponible du caller. Dépasser une borne ou interrompre
le calcul efface le résultat partiel, les prédictions et le cache natif
produit par cet appel. Un sous-ensemble favorable n'est pas présenté comme
un domaine complet.

Le reçu natif identifie la langue, les bornes, les comptes d'examen et la
complétude. Le graphe d'expressions conservé contient les littéraux et les
compositions compatibles ; le reçu précise qu'il s'agit d'une projection
du domaine candidat. Le résultat atomique original reste conservé séparément.
L'accord fini n'affirme ni loi universelle unique ni autorisation mécanique
d'exécuter une primitive.

## Mémoire réutilisée et requête courante

Dans la campagne CATL, les caractéristiques des exemples sont réutilisées
**42 fois sur 48 inférences**. Le niveau 6 évalue une fois ses 6 400 racines :
6 398 sont éliminées et deux compositions restent compatibles. Le fit complet
est réutilisé **sept fois** pour les sept requêtes suivantes de ce niveau.
Le premier calcul compte 7 205 visites ; chaque réutilisation en compte cinq
pour réévaluer les alternatives sur la requête courante. Ces comptes décrivent
le travail de ce calcul, sans constituer un benchmark de vitesse.

L'identité du cache comprend le schéma, la politique et ses bornes,
la grammaire, l'époque, le contexte et l'intégralité des caractéristiques
et étiquettes d'entraînement. Changer ces données invalide le fit. La
requête et les prérequis de soumission sont évalués à nouveau à chaque appel.
Les reçus du fit restent ceux des observations qui l'ont réellement établi ;
leurs empreintes sont distinguées des reçus du panneau courant.

Les soumissions acquises restent dans le journal réel de séquences
étiquetées. Les contrôles visibles, leur support, l'époque et l'observation
sont revalidés avant l'action. Une nouvelle requête nécessite un nouveau
retour acquis. Les événements et les références de preuve appartiennent au
graphe commun, tandis que les algorithmes de perception, d'ajustement,
de recherche et de garde restent des callbacks TypeScript. Leur traduction
intégrale en règles individuellement éditables dans le graphe reste à faire.

La [comparaison avec le préfixe public v44](native-campaigns-v45/catl-v44-prefix-comparison.json)
confirme que les **40 premières commandes, 41 paquets publics complets,
106 images initiale comprise et 40 préfixes** restent identiques.
L'extension composée n'est pas utilisée pendant ces cinq niveaux.
Les huit nouvelles commandes du niveau 6 constituent le suffixe natif
qui atteint `WIN`. Les chaînes du graphe et les digests de mémoire ne sont
pas comparés par cette preuve ; les cibles distinctes de cinq et six niveaux
entraînent aussi des clôtures et des nombres de requêtes différents.

## Vérification différentielle de la composition

La [référence indépendante](../../scripts/export-v6-labeled-composition-reference.py)
énumère la langue binaire, puis soumet chaque lot d'au plus 128 racines à
l'évaluateur Python original inchangé. Elle conserve les requêtes et résultats
complets de tous les lots. Les empreintes de **684 fichiers source chargés**
sont vérifiées contre le manifeste épinglé. Aucun jeu ni agent natif n'est
exécuté par cet export.

| Cas indépendant | Racines examinées | Expressions compatibles | Réponses sur la requête |
|---|---:|---:|---|
| Tous les atomes réfutés ; conjonction nécessaire | 400 | 9 | Accord sur une étiquette |
| Tous les atomes réfutés ; disjonction nécessaire | 400 | 9 | Accord sur une étiquette |
| Même résultat sur les exemples, réponses opposées sur la requête | 784 | 18 | Deux étiquettes : abstention |
| Paquet public sauvegardé au début de CATL6 | 6 400 | 2 | Accord sur l'étiquette visible `12` |

Les **65 lots**, soit **7 984 racines**, sont tous terminés. Les
[93 tests indépendants](../../tests/v6-labeled-composition-soundness.test.ts)
comparent intégralement les résultats de ces lots à l'évaluateur TypeScript
fidèle. Pour les quatre inférences composées, toutes les versions compatibles
et toutes les prédictions natives correspondent exactement à l'union des
résultats source. L'accord d'un lot isolé n'est jamais promu en accord global.

Ces tests couvrent aussi les invalidations du cache, les options, la distinction
des reçus, l'absence de suppression des hypothèses ambiguës et l'interruption
pendant l'évaluation d'une requête, même après un fit complet ou réutilisé.

La portée est précise : **l'évaluateur Python sait évaluer les expressions
composées qui lui sont fournies ; son caller ne produit pas cette langue**.
La génération complète de la grammaire binaire et le calcul vectorisé sont
natifs. Leur reçu utilise un schéma distinct. Le chemin fidèle conserve aussi
l'accord descriptif source sur des prérequis unanimement faux ; le résultat
natif exige ici des prérequis vrais pour annoncer son accord exploitable.
L'autorisation finale reste celle de WHY/ACT et des gardes physiques.

## ReductionTransport : composant transféré

Le [module source](../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/laya_proto/common_reduction_transport.py)
et son [port TypeScript](../../src/logos-engine/v6-reduction-transport.ts)
mesurent une population répétée, des cellules fixes, des supports mobiles
et leurs chemins visibles. Le mécanisme recherche une continuation sous
l'hypothèse révisable d'une réduction départ–intermédiaire–arrivée et d'un
objectif à un membre restant. Les contrôles de déplacement sont appris
à partir de retours publics compatibles uniques.

L'état inclut le modèle mesuré, les déplacements appris, les essais, les
références et l'alignement entre les vues. Un recalage ambigu retire
l'hypothèse. La recherche conserve l'horizon de primitives et les départages
du tas source ; elle n'ajoute pas une borne indépendante d'états ou de temps
absente de ce composant original. Les régions non observées et la suffisance
causale de l'hypothèse restent inconnues.

L'entrée `supported_ternary_reduction` est raccordée à sa position déclarée
dans `factored_material_return`, sous la famille native `reduction_transport`.
Les noms des jeux et les numéros de niveau ne choisissent pas le mécanisme.
Les palettes, positions, pas et contrôles sont mesurés, puis revalidés dans
le contexte courant. Les observations initiales publiques de 90 jeux ont
servi à repérer une morphologie pertinente, sans commande de jeu ni lecture
de définition privée. LF52 est le candidat observé pour cette famille.

Le [reçu de transfert](native-campaigns-v45/reduction-transfer-validation.json)
enregistre **106 contrôles réussis**, notamment 69 propositions complètes,
102 retours publics avec états, dix cas géométriques, dix cas mécaniques,
six cas de garde et cinq cas de résultat. Les six fichiers source utilisés
sont vérifiés. Les refus initiaux de HPDL et DAME sont également conservés.

Le composant original isolé termine les niveaux 1 à 3 de LF52 en
**8, 40 et 54 actions**, soit **102 actions, 69 préfixes et 103 paquets publics**,
dans une seule session sans amorçage manuel. Cette trace sert à vérifier le
port du composant. Elle n'est pas une preuve de sélection par le caller
Python complet ou de réussite du caller natif commun.

## LF52 : conflit initial et correction native

La [première campagne native](native-campaigns-v45/before-continuation-coordination/lf52-three-levels.json)
vise trois niveaux, mais ne valide que le premier, en huit actions.
Elle s'arrête après 102 actions totales au budget actif du niveau 2,
avec l'état `NOT_FINISHED` et un niveau accompli. Ce total de 102 actions
coïncide avec celui de la trace du composant isolé, mais les trajectoires
et les résultats diffèrent.

Le [diagnostic de sélection](native-campaigns-v45/lf52-level2-selection-diagnostic.json)
rejoue uniquement les huit retours publics déjà enregistrés. Au niveau 2,
le caller choisit une proposition `cell_patch_placement` avant la proposition
ReductionTransport disponible. Une vérification du
[composant Cell Python inchangé](native-campaigns-v45/lf52-level2-source-cell-diagnostic.json)
reproduit cette proposition sur le même écran public. Ce contrôle porte sur
ce composant et ne constitue pas une preuve de sélection du caller original
complet. Le diagnostic n'envoie aucune action supplémentaire.

La baseline v44 avait atteint `GAME_OVER` au premier niveau après
[78 actions sans niveau accompli](native-campaigns-v45/lf52-v44-baseline.json).
Le raccordement v45 démontre donc un premier niveau natif réussi et une
limite d'intégration concrète. La nouvelle campagne native réussit ensuite
ses trois niveaux sur le manifeste final de 149 fichiers, après la correction
de coordination décrite ci-dessous. La première tentative et son échec restent
conservés comme tels.

Les actions 72 et 78 de la campagne finale appartiennent à
`pre_score_contact`, sous la proposition `observed_effect_access`.
Le caller envoie alors respectivement `ACTION1` et `ACTION2` et acquiert
leurs vrais retours. Ces deux préfixes font partie de la campagne commune ;
les soustraire pour présenter une trajectoire identique au composant isolé
serait incorrect. La réussite des trois niveaux n'établit donc pas une
comparaison exacte de la trajectoire entière avec ses 102 actions.

La [comparaison des traces complètes conservées](native-campaigns-v45/lf52-original-component-comparison.json)
précise ce qui correspond : les **71 premières commandes et 72 paquets
publics complets** coïncident. Pour les commandes sans coordonnées, la seule
normalisation consiste à représenter des données absentes par un objet vide.
Les **102 commandes appartenant à ReductionTransport** s'alignent encore
avec le flux du composant source sous cette convention : 42 sont identiques
brutes et 60 utilisent cette normalisation de données vides.

Cependant, **31 paquets alignés du suffixe diffèrent**, notamment dans leurs
images, indices de pas et empreintes. Les deux commandes supplémentaires
changent les pixels du retour. Aucune image ni aucun champ du suffixe n'est
normalisé ou supprimé pour déclarer une égalité. Le constat porte uniquement
sur ces observations publiques, sans interprétation d'un état caché.
Le reçu conclut `shared_prefix_with_explicit_caller_divergence`, avec
`completeTrajectoryEquivalent: false`. Les budgets diffèrent également :
120 actions et 180 secondes par niveau côté composant source, contre
600 actions et 360 secondes actives côté campagne native. Cette comparaison
ne constitue pas un benchmark de vitesse.

## Coordination native d'une continuation acquise

Le [caller natif](../../src/logos-engine/v6-native-runtime.ts) introduit
`current_acquired_continuation_before_unacquired_exploration` pour traiter
ce conflit. La proposition exploratoire doit être attestée sans acquisition
propre ; pour Cell, cela implique notamment un état propre sans événement,
modèle, recherche ou motif appris. Une famille ultérieure peut alors présenter
un succès officiel acquis, correspondant au score courant, puis une continuation
remesurée sur l'observation actuelle.

Le candidat préféré doit porter sa propre preuve, se référer au même succès
conservé et passer sa garde actuelle. Le caller sélectionne ce candidat exact.
Il ne se contente pas de sauter Cell pour laisser un autre candidat emprunter
la preuve d'une troisième famille. La famille reste activée, les budgets
continuent de s'appliquer, et le binder, la préservation et WHY/ACT doivent
encore autoriser la primitive.

Le reçu distingue le groupe source ayant déclenché l'examen du groupe
effectivement sélectionné. Il conserve les références des deux propositions,
leurs états de famille révisionnés et les témoins employés. Le succès passé
soutient une continuation conditionnelle ; il ne transforme pas un contrôle
de déplacement non calibré en effet connu.

Cette règle est une **extension explicite de la coordination native**.
Les listes DRM gardent leurs positions, mais les choix entre familles peuvent
différer de ceux du caller Python original. La parité des composants Reduction
et Cell demeure une preuve distincte. Les
[contrôles ciblés sur le manifeste final](native-campaigns-v45/validation/coordination-recheck.json)
passent. Dans la campagne LF52 finale, 18 préfixes portent le reçu de cette
coordination. La campagne CATL conserve son succès complet sur le même
manifeste final.

## Vérifications enregistrées

L'[unique suite globale](native-campaigns-v45/validation/suite-run.json)
termine avec **5 255 tests réussis sur 5 255, dans 89 fichiers**, code de sortie 0,
sans annulation ni test ignoré. La commande contient les chemins explicites
des 89 fichiers avec une concurrence de deux. Le
[journal TAP complet](native-campaigns-v45/validation/suite-output.log.gz)
et les empreintes avant/après sont conservés.

Les 89 fichiers de tests, les 148 sources du manifeste natif et l'ensemble
des 164 fichiers de `src` sont identiques avant et après cette suite.
Ces résultats appartiennent au manifeste `2819ec88…` indiqué plus haut.
Le [contrôle ciblé de coordination](native-campaigns-v45/validation/coordination-recheck.json)
exécute ensuite **227 tests, tous réussis, dans 16 fichiers explicites**, sur
les **149 sources du manifeste final `1278235f…`**. Son
[journal complet](native-campaigns-v45/validation/coordination-recheck-output.log.gz)
est conservé séparément. Le reçu vérifie les sources et les tests avant/après,
ainsi que l'intégrité du reçu de la suite initiale.

Le delta de production comporte exactement trois fichiers modifiés
(`v6-native-runtime.ts`, `v6-native-types.ts`, `v6-shared-series.ts`) et
le nouveau helper `v6-acquired-continuation.ts`. Parmi les 89 tests initiaux,
seul `v6-v45-kernel-integration.test.ts` change, de deux à trois contrôles ;
deux fichiers de tests de témoins et de priorité sont ajoutés. Le contrôle
ciblé inclut ces ajouts et les parcours connexes du runtime, du caller,
de l'autorité, de la persistance, des priorités, de Cell et de la mémoire
partagée.

Les **5 255 tests initiaux** et les **227 contrôles ciblés** sont des
ensembles qui se chevauchent, exécutés sur deux manifestes explicitement
identifiés. Ils ne sont pas additionnés en une nouvelle suite complète.
Les campagnes finales CATL et LF52 sont enregistrées séparément sur le même
manifeste final. Leurs comparaisons préservent les trajectoires et les
divergences explicites décrites plus haut.

Les [neuf campagnes de régression](native-campaigns-v45/regression-summary.json)
passent également, avec **117 contrôles de comparaison réussis sur 117**.
Elles conservent **433 commandes, 442 paquets publics complets et 237 préfixes**
par rapport à la v44, sous les mêmes budgets et avec les mêmes actifs de jeu.

| Jeu | Niveaux accomplis | Actions | État officiel final |
|---|---:|---:|---|
| MEMO | 3 | 30 | `NOT_FINISHED` |
| TICT | 6 | 55 | `WIN` |
| HANO | 4 | 60 | `WIN` |
| ELAS | 3 | 33 | `NOT_FINISHED` |
| TU93 | 3 | 67 | `NOT_FINISHED` |
| STCK | 3 | 35 | `NOT_FINISHED` |
| PIPE | 3 | 23 | `NOT_FINISHED` |
| COMB | 6 | 104 | `WIN` |
| THER | 6 | 26 | `WIN` |

Le [reçu d'exécution des régressions](native-campaigns-v45/regression-verification.json)
confirme le gel des 149 sources et du harness avant et après ces campagnes.
Les comparaisons portent sur les commandes, les empreintes des paquets complets,
les catégories de préfixes, les acquisitions et les projections de série
rapportées. Elles normalisent la portée des références de session ; elles
n'affirment pas une identité des chaînes du graphe ou des digests hérités.
Les temps sont exclus de cette comparaison.

La [vérification navigateur LF52](native-campaigns-v45/lf52-browser-verification.json)
repart du niveau 1, à zéro action et zéro plan, inspection fermée. Trois clics
sur **Run to next level**, dans une seule session conservée, produisent
les frontières à **8, 48 et 104 actions**, avec **8, 26 et 71 plans accomplis**.
La [capture finale](native-campaigns-v45/lf52-browser-three-levels.png) montre
trois niveaux résolus et l'entrée au niveau 4, sans écran `VICTORY`.
Le reçu enregistre zéro action manuelle de jeu, zéro saut de niveau,
zéro remise à zéro et aucune ouverture de l'inspection pendant la campagne.

La [vérification navigateur CATL](native-campaigns-v45/catl-browser-verification.json)
part elle aussi du niveau 1 avec une mémoire froide. Six lancements successifs
par **Run to next level** atteignent les frontières à **8, 16, 24, 32, 40
et 48 actions**, pour autant de plans accomplis. La
[capture finale](native-campaigns-v45/catl-browser-victory.png) et son
[état accessible enregistré](native-campaigns-v45/catl-browser-victory-ax.txt)
montrent **`VICTORY`, l'état officiel `WIN`, six niveaux résolus et 48 plans**.
L'inspection reste fermée ; le reçu confirme une seule session conservée,
sans action manuelle de jeu, remise à zéro ni saut de niveau.

Un [premier passage navigateur également réussi](native-campaigns-v45/catl-browser-first-pass.json)
avait rencontré un dépassement de délai lors de la capture. Le second passage
froid a été exécuté uniquement pour obtenir la capture proprement. Les chiffres
et l'image du reçu final appartiennent à ce second passage complet ; les deux
parcours ne sont pas assemblés en une seule preuve.

Le [dossier de validation finale](native-campaigns-v45/validation.json)
est marqué `passed`. Il rattache les preuves de composants, les deux campagnes
principales, les neuf régressions et les vérifications navigateur à leurs
manifestes respectifs. Le typecheck, les audits d'entrées et de migration,
le contrôle de diff et le build passent. Les 149 sources restent conformes
au manifeste final après le build. Ces reçus documentent la version du dépôt
prête à publier ; la publication du site conserve sa propre preuve de déploiement.

## Avancement et prochaine étape

L'[audit des entrées déclarées](v6-entry-point-progress.json) compte
**36 / 76 = 47,4 %**, contre 35 / 76 = 46,1 % en v44.
`supported_ternary_reduction` ajoute une entrée raccordée. La composition
binaire native n'ajoute aucune entrée source. Le gain exact est 100 / 76,
soit environ **1,32 point** ; les pourcentages affichés sont arrondis
indépendamment.

Chaque entrée a le même poids. Cette métrique ne mesure ni le volume de code,
ni un taux de victoire, ni la parité complète. Les six conditions de migration
complète restent fausses.

L'[inventaire de modules](v6-coverage.json) conserve **96 modules
`component_verified`, 72 `partial_transfer` et 1 201 en attente**,
avec zéro module pleinement `verified`. Le module ReductionTransport ajoute
une vérification de composant ; les extensions natives ne gonflent pas le
nombre de modules Python transférés.

**Prochain candidat de transfert : ZIPP / `trace_field_composition`.**
Son écran public initial correspond à la morphologie de la famille source.
La prochaine étape consiste à transférer ce composant, comparer ses mesures,
ses propositions et ses acquisitions, puis viser au moins trois niveaux dans
une session native commune. Aucune réussite de ZIPP n'est annoncée à partir
de cette seule correspondance initiale. **Avancement actuel : 47,4 %.**

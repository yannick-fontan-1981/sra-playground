# v46 · Champs de trace dans Logos Engine

## Résultat livré

Logos Engine réussit les **quatre premiers niveaux de ZIPP en 53 actions**,
dans une campagne native froide et continue. Les trois premiers niveaux
emploient 38 actions. Le programme s'arrête à sa cible déclarée de quatre
niveaux, à l'entrée du niveau 5, avec le statut public `NOT_FINISHED`.
Il ne s'agit pas d'une victoire complète du jeu.

| Niveau terminé | Actions du niveau | Actions cumulées | Préfixes acquis cumulés |
| --- | ---: | ---: | ---: |
| 1 | 8 | 8 | 3 |
| 2 | 15 | 23 | 6 |
| 3 | 15 | 38 | 9 |
| 4 | 15 | 53 | 12 |

La [campagne réelle](native-campaigns-v46/zipp-four-levels.json) et sa
[trace publique complète](native-campaigns-v46/zipp-public-trace.json.gz)
conservent les commandes, toutes les images de retour et les frontières.
Les 53 transitions ont effectivement été acquises par le Kernel, dans une
seule session et avec trois reprises de frontière. Aucun reset, saut de
niveau, clic de résolution manuel ou module agent Python n'a participé à la
campagne. L'hôte Python exécute uniquement le jeu opaque.

## Une capacité générique, avec un domaine explicite

Le transfert concerne `window_constraints.trace_field_composition` du dépôt
V6 épinglé au commit `786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`.
Le nom ZIPP choisit seulement le jeu dans le banc de vérification et dans
l'interface. Le raisonnement ne reçoit pas ce nom et ne contient aucune
branche par jeu ou niveau, palette de rôles fixée, coordonnée imposée ou
séquence de résolution enregistrée.

L'observateur TypeScript mesure les cadres, cellules, anneaux et segments
de trace dans les pixels publics courants. Il construit un graphe de
cellules et reconstruit le préfixe ordonné déjà visible. Des séparations
plus minces comme passages, une couverture simple de toutes les cellules
et l'autre marque comme récepteur final restent des **hypothèses de la
bibliothèque source**, et non des lois universelles acquises.

Le calcul `SingleVisitResidual` applique des contraintes de degrés, coupes,
parité et propagation. Une recherche finie complète ensuite la couverture
conditionnelle, dans les bornes source de 64 cellules et 100 000 nœuds,
sous le budget d'actions et l'échéance active courants. Son reçu conserve
`primitive_release_authorized: false` : un parcours calculé ne libère pas
lui-même une action et ne témoigne pas d'une victoire officielle.

Au début de chaque époque, l'accès propose une seule extension. Deux
extensions locales distinctes réellement observées, sans échec, permettent
ensuite un préfixe de 16 actions au maximum. Le garde vérifie le contexte,
la tête courante et le point lié avant chaque action. Le retour contrôle
la relocation de l'anneau et la localité ; l'acquisition remesure séparément
le préfixe ordonné. Une contradiction est conservée et n'est pas convertie
en permission de continuer.

Les changements extérieurs au support mesuré restent inconnus. Les vrais
premiers retours en contiennent neuf pixels : ils sont comptés dans les
preuves avec `outside_support_effect_role: unknown`, sans attribution
arbitraire de leur signification.

## Code, graphe et autorité

Les algorithmes de perception et de calcul restent du code TypeScript
natif. Les observations, hypothèses, propositions, acquisitions, refus et
programmes de sélection utilisent le graphe commun de Logos Engine.
La migration ne prétend pas que tout l'algorithme est déjà réécrit en
nœuds déclaratifs librement éditables.

Cette capacité rejoint le propriétaire existant `public_occurrence_recall`
dans `SharedSeriesConstraint`. Elle ne crée pas une mémoire indépendante
associée à ZIPP. Son entrée demeure à la position source, après
`linked_packet_composition` encore non transféré et avant
`cell_patch_composition`. Le journal et le digest de Trace sont insérés
après Labeled et avant Cell dans l'héritage natif pris en charge.

Les événements `observed_trace_extension` proviennent uniquement des
retours physiques. La sélection SRC, les préconditions, le garde courant,
les obligations de préservation et WHY/ACT restent nécessaires. La mémoire
de travail est hydratée depuis le Kernel réel. La restauration reconstitue
les couches dans des objets temporaires et ne les publie qu'après le
contrôle complet du journal et du digest. Un état corrompu ne remplace pas
la mémoire acquise. Un checkpoint inchangé déjà validé ne rejoue pas
inutilement le journal accumulé.

## Parité et preuves séparées

La référence indépendante exécute le composant Python **inchangé** via un
hôte public opaque. Les 1 786 fichiers du manifeste épinglé sont vérifiés
avant import. Le probe et l'export possèdent chacun leur liste de fichiers
référencés, leurs empreintes et leur provenance propres.

Le probe source avait une cible de six niveaux. Il franchit quatre niveaux
en 53 actions et 12 préfixes, puis s'abstient à l'entrée du niveau 5.
Sa cible de six n'est donc pas atteinte. La campagne native a une cible
distincte, annoncée de quatre niveaux, qu'elle atteint réellement.
Les limites du probe source sont de 120 actions et 180 secondes par
niveau ; celles de l'application sont de 600 actions et 360 secondes
d'activité. Aucune égalité de budgets ou de vitesse n'est revendiquée.

Les tests différentiels de Trace couvrent 422 vérifications : mesures,
transformations géométriques et de palette, calcul D, reprises et budgets,
propositions, bindings, gardes, effets, 53 acquisitions, projections mémoire
et digests de la couche, ainsi que le refus de la nouvelle morphologie.
La référence de la famille source complète sert également à vérifier les
enveloppes héritées ; cela ne constitue pas une validation exhaustive de
la sélection de l'appelant Python original complet.

La [comparaison publique](native-campaigns-v46/zipp-original-component-comparison.json)
établit l'égalité exacte des **53 commandes, 54 paquets publics et 66 images**,
sans normaliser de pixel, d'index chronologique ou de commande. Les 12 scènes
et chemins sont également identiques. Le rapprochement explicite de
54 références d'observation et de 12 références mécaniques recalculées
permet de comparer les 12 plans complets, les 12 derniers événements
de préfixe réellement retenus dans le Kernel et 53 preuves de transition.
Les graphes complets, leurs chaînes et révisions, ainsi que les identifiants
de proposition hachés ne sont pas déclarés identiques.

L'interface du D natif exige des entrées JSON typées et des entiers
représentables exactement. Elle ne reproduit pas toutes les coercitions
générales de Pydantic. Le port de ce composant reste qualifié de partiel
sur ce contrat général, même lorsque le calcul et les reçus comparés sont
identiques sur le domaine nominal examiné.

## Validation ciblée de cette version

Le [manifeste natif](native-campaigns-v46/source-manifest.json) fige
152 fichiers à l'empreinte
`793a6b2e57ffbab74e148b1170879cd720387cbe93a2af9977c6303e05c2e731`.
Les campagnes et les reçus attestent que ces sources restent inchangées
pendant leur exécution.

La [suite delta](native-campaigns-v46/validation/delta-tests-run.json)
réussit **531 tests sur 531 dans 13 fichiers**, sans échec ni test ignoré.
Elle porte sur Trace et les chemins affectés du propriétaire partagé, du
Kernel, des gardes, de la coordination et de l'intégration précédente.
Elle n'est pas présentée comme une nouvelle exécution de tous les tests
historiques. Trois attentes de listes, dans deux tests de priorité, ont été
actualisées pour inclure la nouvelle entrée, à sa position déclarée.

Les [régressions](native-campaigns-v46/regression-summary.json) distinguent
les trajectoires publiques archivées dont chaque commande est recalculée
par une session native froide, et la campagne TICT exécutée de nouveau
dans le véritable hôte. Les commandes attendues restent dans le banc de
test, hors du transport de l'agent. Un rejeu d'observations enregistrées
n'est pas compté comme une nouvelle résolution réelle ni comme un test
de vitesse.

Les sept relectures natives recalculent **370 commandes, 377 paquets
publics et 237 préfixes** pour MEMO, STCK, PIPE, COMB, THER, CATL et LF52.
La nouvelle campagne réelle de régression TICT termine ses six niveaux
avec `WIN`, 55 actions et 55 préfixes. Les huit cas passent leurs
112 contrôles de comparaison. Une empreinte du témoin d'élimination CATL
dépendait des références de session : seule cette projection du comparateur
a été corrigée. La trajectoire n'a pas été rejouée ; la première comparaison
et son code sont conservés dans la
[carte de rétention](native-campaigns-v46/diagnostics/retention-map.json).

La [preuve navigateur](native-campaigns-v46/zipp-browser-verification.json)
consigne une autre session froide pilotée par quatre demandes successives
« Run to next level », avec l'inspection fermée. Le
[contrôle de publication](native-campaigns-v46/validation.json) relie les
sources, vérifications, preuves et artefacts de build.

## Limite observée et prochaine étape

L'image publique à l'entrée du niveau 5 contient une grille de 5 × 5
cellules. Avec un pas de 10 pixels et des cellules de 9 pixels, le
pourtour du matériau de sol forme lui-même un anneau fin autour de chacun
des deux marqueurs. L'observateur source conserve alors deux couples
tête/récepteur concentriques compatibles, de largeurs 9 et 7, et exige
un couple unique. Il renvoie `null` **avant** la recherche de parcours.
Ce diagnostic ne démontre donc pas un épuisement du budget de recherche.

La campagne native livrée s'arrête à sa cible avant d'exécuter une action
au niveau 5. Aucun succès de ce niveau ou victoire complète n'est annoncé.

La prochaine étape consiste à distinguer les anneaux structurels du
support et les marqueurs au moyen des relations géométriques et des
matériaux effectivement observés, tout en conservant les alternatives
non réfutées. Une éventuelle extension devra être générique, testée sur
des variations de couleurs, position et échelle, puis validée dans une
nouvelle campagne continue visant les niveaux suivants de ZIPP.

## Avancement mesuré

L'[audit des points d'entrée](v6-entry-point-progress.json) compte
**37 / 76 = 48,7 %**, contre 36 / 76 = 47,4 % en v45.
Le nouveau point est `trace_field_composition`. Chaque entrée déclarée
dans les quatre listes DRM a le même poids. Ce chiffre mesure une
connexion effective de capacités, pas le volume de code, la fraction
des jeux réussis, une généralisation universelle ou la parité complète
avec V6. Les six portes de validation de migration complète restent
fermées.

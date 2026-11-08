# v49 · Catalogues partiellement visibles et acquisition de nouvelles vues

## Nouveau résultat : les trois premiers niveaux de GRIL

**Logos Engine termine les niveaux 1, 2 et 3 de GRIL en 19 actions**, dans une
session native froide et continue. Le raisonnement s'exécute en TypeScript
dans le caller commun. Python reste limité à l'hôte opaque des jeux originaux.
Aucune action manuelle, mémoire préremplie, remise à zéro ou sélection d'un
niveau ultérieur n'amorce cette campagne.

| Niveau terminé | Actions du niveau | Actions cumulées |
| --- | ---: | ---: |
| 1 | 5 | 5 |
| 2 | 5 | 10 |
| 3 | 9 | 19 |

La [campagne réelle](native-campaigns-v49/gril-three-levels.json) conserve
19 préfixes et 19 acquisitions effectives par le Kernel, avec deux reprises
naturelles de frontière. Les [20 paquets publics complets](native-campaigns-v49/gril-public-trace.json.gz)
contiennent 23 images. Le [reçu d'exécution](native-campaigns-v49/logs/execution-gril.json)
lie les commandes, paquets, journaux et sources gelées.

La cible déclarée est atteinte à l'entrée du quatrième niveau, avec l'état
`NOT_FINISHED`. Aucun `WIN` complet de GRIL n'est revendiqué et le quatrième
niveau n'est pas évalué dans cette campagne.

## La capacité ajoutée

L'entrée `occluded_catalogue_composition` est maintenant reliée au propriétaire
de mémoire déjà utilisé par les compositions observées. Elle compare des
alternatives de forme à un sujet dont seule une partie est visible, puis peut
demander une autre vue si la comparaison reste ambiguë.

### Les rôles viennent de structures mesurées

L'observateur original recherche un grand champ encadré, des cartes alignées
au-dessous de ce champ et plusieurs supports alignés au-dessus. Il compare
leurs géométries et les apparences présentes dans le champ courant. Les cartes
doivent présenter les mêmes dimensions natives mesurées.

Cette disposition suggère des rôles de sujet, d'alternatives et de sélecteurs.
Elle ne fournit encore ni la signification d'une palette, ni la fonction d'une
commande, ni la règle de victoire. Les points proposés viennent des formes
actuellement observées et reçoivent une liaison vérifiable au paquet courant.

La sélection v48 avait trouvé GRIL comme seule vue initiale admise par cet
observateur parmi les 100 vues publiques conservées. Le jeu sert donc de cas
d'évaluation. Son identifiant n'intervient dans aucune règle de raisonnement.

### Une zone cachée conserve son statut inconnu

La comparaison distingue trois catégories de pixels : présence visible du
sujet, absence conditionnellement étayée et valeur encore inconnue. Une valeur
différente de celle du sujet n'est pas automatiquement interprétée comme son
absence : elle peut appartenir à ce qui le masque.

L'hypothèse d'un fond découvert demande un retour précis. Une valeur unique
doit remplacer le sujet à certains endroits et être remplacée par ce même
sujet à d'autres endroits. Ce remplacement réciproque observé soutient alors
une lecture conditionnelle du fond. Les autres valeurs restent inconnues.

À partir de ces éléments, une recherche finie énumère les translations et
échelles entières compatibles avec chaque carte. Les candidats retenus sont
intersectés avec ceux déjà compatibles pour ce même catalogue et cette même
époque. Une intersection vide reste une contradiction ; elle ne permet pas
de choisir arbitrairement une carte.

La certification mécanique conserve les affectations de couches et leurs
provenances. Un pixel hors du champ enregistré, un pixel explicitement inconnu
ou la couverture d'un objet masquant ne devient pas une absence du sujet
interrogé. Les vues demandées et enregistrées sont conservées par la requête.
Une vue non scellée, une époque différente ou un travail interrompu produisent
une demande de preuve supplémentaire.

### Une réponse reste une expérience jusqu'au progrès officiel

Lorsque toutes les poses encore compatibles désignent un seul membre du
catalogue, le programme propose son point courant après certification. Il
enregistre ensuite la soumission, sans lui attribuer une correction locale
que le jeu n'a pas fournie.

Le programme peut tester un autre sélecteur mesuré et comparer son catalogue.
La mémoire de réponses indique quels sujets ont reçu une soumission. Elle
ne transforme pas ces soumissions en réussites individuelles. Si toutes ont
été effectuées sans confirmation globale, la cause d'arrêt reste
`catalogue_combination_has_no_official_confirmation`.

## Comment une nouvelle vue est acquise depuis une session froide

Le composant catalogue isolé ne sait pas d'emblée quelle commande peut modifier
la vue. Le [probe froid isolé](../../tests/fixtures/v6-occluded-catalogue-original-public.json.gz)
conserve cette limite. La version native ne lui ajoute aucun déplacement
préétabli pour commencer.

Le caller commun dispose déjà d'autres questions sur les commandes disponibles.
Une action réellement choisie par un de ces composants peut produire un retour
utile au catalogue. L'acquisition commune transmet ce retour à la même mémoire,
même lorsque le catalogue n'a pas choisi l'action.

Pour retenir un effet de vue, la mémoire exige une commande scalaire, le même
champ encadré et la même époque. Elle enregistre séparément le changement
effectif du champ et la conservation de sa structure. Une commande observée
comme modifiant le champ sous cette structure peut ensuite être proposée
comme nouvelle expérience informative. Son prochain effet n'est pas prédit
comme une loi de déplacement universelle.

La proposition de nouvelle vue réévalue les candidats et se rattache à ses
témoins acquis. Elle refuse de rejouer la même commande dans un contexte déjà
essayé à l'identique. Elle n'est pas proposée pour contourner une contradiction
vide ni une réponse déjà unique. Le groupe commun des questions de vue
interroge d'abord son fournisseur existant, puis ce fournisseur catalogue,
dans l'ordre source retenu.

Chaque expérience scalaire est scellée après son retour. Elle produit des
événements de vue et, si les observations le permettent, une nouvelle
comparaison. **Elle ne produit pas de réponse de catalogue fictive.** Les
points de sélection et de réponse restent soumis à leurs propres gardes.

## Trajectoire source et trajectoire native : deux preuves distinctes

Le [probe de référence continu](../../tests/fixtures/v6-occluded-catalogue-frontier-original-public.json.gz)
utilise les composants Python originaux inchangés et un coordinateur de
sous-ensemble explicite : catalogue, nouvelle vue de catalogue et
`ObservedFrontier`. Il termine les trois niveaux en **18 actions**, soit
5, 5 et 8. Il ne représente pas l'ordre de sélection de tout le caller Python
original, ni une exécution de son autorisation Kernel complète.

Le caller natif commun, qui dispose d'autres capacités déjà connectées,
termine les mêmes niveaux en **19 actions**. Sa trajectoire réelle est
conservée telle qu'exécutée :

- À l'action 9, `containment` choisit `ACTION4`, alors que le coordinateur
  source de sous-ensemble aurait choisi `ACTION3` pour une nouvelle vue.
  Le retour natif est acquis et la comparaison continue. Le deuxième niveau
  utilise toujours cinq actions.
- Au troisième niveau, une question de rappel d'occurrence est exécutée à
  l'action 14, avant la nouvelle vue du catalogue à l'action 15. Cette étape
  supplémentaire explique les neuf actions de ce niveau, contre huit dans
  le sous-ensemble source.

La campagne native contient **14 propositions de catalogue** : sept réponses,
quatre sélections et trois expériences de vue. Les cinq autres actions
viennent d'`ObservedFrontier`, de `containment` et du rappel d'occurrences.
Tous leurs retours réels passent par l'acquisition commune. La mémoire
catalogue conserve **34 événements propres** : seize observations,
onze réponses et sept observations d'entrée scalaire.

La [comparaison indépendante](native-campaigns-v49/gril-original-component-comparison.json)
rejoue le composant original sur les **19 transitions publiques réellement
exécutées par le natif**. Elle vérifie exactement les 14 propositions propres,
les 34 événements acquis et les 19 états propres Python recalculés depuis ces
transitions, comparés aux états reconstruits depuis les événements natifs
conservés, avec une tolérance numérique nulle. Les retours des cinq actions choisies par les autres
fournisseurs sont également acquis, sans revendiquer la parité de leurs plans.

Les huit premières commandes et les neuf premiers paquets complets des deux
campagnes concordent, puis la sélection diverge. Les sept commandes scalaires
du transport public contiennent `data: {}`, tandis que les commandes brutes
acquises ne contiennent que leur référence ; cette différence est conservée
explicitement dans le rapport. Les annotations ajoutées par le caller natif
sont séparées des champs originaux du fournisseur, tous comparés exactement.
L'état propre du catalogue et des vues est vérifié ; le digest complet du
parent, la sélection de tout le caller source, les budgets écoulés et une
victoire au-delà des trois niveaux restent hors de cette comparaison.

## Code générique et graphe de connaissance commun

Trois modules TypeScript portent cette capacité : observation, mécanique et
accès. Les algorithmes y définissent des opérations générales sur les images,
les masques, les poses et les preuves. Le graphe V7 commun conserve les
observations, propositions, états acquis, contradictions et justifications
effectivement utilisés.

La capacité rejoint le propriétaire `family_state:public_occurrence_recall`.
Les sélections, réponses et demandes de nouvelles vues partagent une instance
de mémoire. Une action extérieure au catalogue peut donc lui apporter une
preuve sans créer un deuxième propriétaire ni préremplir un état caché.

Le journal et le digest natif partagé ajoutent explicitement les deux couches
catalogue avant Queued Field. Les événements reconstruisent l'état après un
checkpoint ; la restauration reste atomique et vérifie le journal avant de
publier cet état. Le digest du parent Python complet n'est pas substitué au
périmètre natif réellement transféré.

Les gardes vérifient notamment l'époque, le score, l'observation, l'image et
la commande exacte. Les actions ponctuelles doivent aussi garder leur support
mesuré courant. La certification de projection décrit une compatibilité
conditionnelle ; l'autorisation physique passe toujours par WHY/ACT.

Les algorithmes de perception et de recherche sont encore des fonctions
TypeScript. Le graphe rend leurs objets, preuves et enchaînements explicites ;
cette étape ne prétend pas que chaque algorithme est déjà une règle
déclarative indépendamment éditable, ni que la généralisation à tout jeu est
démontrée.

## Limites numériques et fidélité revendiquée

Les composants viennent du commit épinglé
`786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`, notamment
`occluded_catalogue_observation.py`, `occluded_catalogue_methods.py`,
`occluded_catalogue_access.py`, `catalogue_view_memory.py`,
`common_occluded_catalogue.py` et `occluded_catalogue_projection_d.py`.

Le noyau mécanique conserve les limites de travail de la requête et le compte
des projections réellement examinées, y compris avant le rejet des pixels
hors de la fenêtre. Une interruption de temps ou de nœuds conserve son statut
incomplet. Les requêtes construites par le composant utilisent au plus
128 affectations, 4 096 éléments de domaine et 100 000 visites.

Les coordonnées et résultats sont des entiers exacts dans le domaine sûr
natif. Si un produit intermédiaire dépasse ce domaine mais qu'une translation
ramène le résultat dans celui-ci, un calcul BigInt de secours préserve le
résultat exact. Un résultat qui demeure hors du domaine sûr est refusé.
Ce garde ne change pas les calculs des rasters publics de 64 × 64 pixels.

Le port traite des requêtes typées et bornées. Il ne revendique pas toutes les
coercitions Pydantic ou la prise en charge des entiers Python arbitrairement
grands. Les comportements hérités non transférés, dont Framed Window, restent
distincts du périmètre propre vérifié du catalogue.

## Interface et validation de livraison

Le panneau « Solve with SRA. » compact, l'inspection fermée par défaut et la
hauteur indépendante du plateau sont conservés. Aucun changement de mise en
page n'est nécessaire pour cette capacité. La
[vérification navigateur](native-campaigns-v49/gril-browser-verification.json)
confirme les trois niveaux en 19 actions et 19 plans, par trois clics sur
« Run to next level » dans une seule session. Les sept mesures prises avant,
pendant et après les niveaux conservent les compteurs affichés. La colonne du
plateau garde une hauteur de 442 pixels, le canvas 384 × 384 pixels et le
statut une hauteur de 98 pixels. Les cinq éléments mesurés ne changent ni de
dimension ni de position dans le document : écart maximal de zéro pixel.
Il s'agit d'échantillons sur un viewport de 1 363 × 936 pixels, pas d'une mesure
à chaque image. Le mobile et le plein écran ne sont pas réévalués. Les trois
fichiers d'interface restent identiques au commit publié de la v48.

Les [références indépendantes](../../tests/v6-occluded-catalogue-reference.test.ts)
comparent les mesures initiales, les poses compatibles, la distinction entre
absence et inconnu, la conservation des vues, les bornes, les propositions,
les gardes et les acquisitions propres. Les
[tests du Kernel commun](../../tests/v6-occluded-catalogue-kernel.test.ts)
examinent l'acquisition depuis une mémoire neuve, la transmission des retours
d'autres familles, les liaisons de points, les contradictions et la restauration.

Les résultats exécutés de la [suite ciblée](native-campaigns-v49/validation/delta-tests-run.json),
des [régressions](native-campaigns-v49/regression-summary.json), des
[contrôles de construction](native-campaigns-v49/validation/checks-run.json)
et de la [validation finale](native-campaigns-v49/validation.json) constituent
les preuves de livraison. Ils distinguent les relectures de paquets publics
des nouvelles campagnes contre l'hôte opaque.

| Contrôle exécuté | Résultat |
| --- | --- |
| Suite ciblée sur 18 fichiers | 255 tests réussis, aucun échec, annulation ou test ignoré |
| Comparaison du catalogue sur les retours natifs réels | 14 propositions, 34 événements et 19 reconstructions propres exacts |
| Relectures de STCK, CATL, SELE, COLM et ZIPP | 273 commandes, 278 paquets complets, 168 préfixes et 85 contrôles réussis |
| TypeScript, audit des entrées, audit de migration, diff et build | Cinq contrôles réussis |
| GRIL dans le navigateur | 19 actions, trois niveaux terminés, sept mesures de disposition stables |

Les cinq régressions recalculent les commandes avec le caller natif avant de
consommer chaque paquet public enregistré. Elles ne constituent pas cinq
nouvelles campagnes de jeu. Elles vérifient aussi que le nouveau catalogue
reste vide sur ces trajectoires. La suite ciblée ne réexécute pas tout
l'historique des tests.

L'implémentation est `logos-engine.typescript.v6.native-migration/0.19.0`.
Les [166 fichiers natifs gelés](native-campaigns-v49/source-manifest.json)
restent identiques pendant la campagne ; leur empreinte est
`e5a7fc15461fd1ddbc9019b3749dad98a2235fc38df40898778d6c089cc13a5a`.

## Avancement et prochaine étape

**Avancement mesuré : 40 entrées DRM connectées sur 76, soit 52,6 %, contre
51,3 % en v48.** La nouvelle entrée comptée est
`occluded_catalogue_composition`. Le raccordement de la demande de nouvelle
vue au groupe commun `view` est décrit séparément : ce groupe direct ne fait
pas partie du dénominateur des quatre listes source suivies.

Cet indicateur compte les entrées connectées avec le même poids. Il ne mesure
ni le volume de code transféré, ni le taux de jeux gagnés, ni la parité complète
avec l'agent Python source. Les critères de migration complète restent ouverts.

**Prochaine étape : transférer `typed_material_flow`, avec l'acquisition des
sélections, remplacements et occurrences typées, puis viser les trois premiers
niveaux de LIFE dans une campagne froide.** Une nouvelle sélection en lecture
seule sur les 100 vues publiques trouve LIFE comme seule vue initiale admise
par l'observateur de supports denses à marques internes typées. Il y mesure
quatre supports. La [note de sélection](native-campaigns-v49/candidate-selection.md)
conserve ce constat et ses limites. Aucune commande réussie, aucun niveau
terminé et aucune victoire de LIFE ne sont encore annoncés.

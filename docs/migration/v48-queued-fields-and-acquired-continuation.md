# v48 · Files ordonnées et continuation appuyée par le Kernel

## Résultats livrés

**Un nouveau jeu franchit les trois niveaux demandés : COLM, en 45 actions.**
**ZIPP est également terminé en entier : six niveaux sur six, avec l'état
officiel `WIN`, en 101 actions.** Ces deux campagnes utilisent chacune une
session froide et continue du caller commun de Logos Engine. Les décisions
sont calculées en TypeScript ; Python exécute seulement le moteur de jeu opaque.
Aucun amorçage manuel, reset ou saut de niveau ne participe aux résultats.

### COLM : trois premiers niveaux

| Niveau terminé | Actions du niveau | Actions cumulées |
| --- | ---: | ---: |
| 1 | 17 | 17 |
| 2 | 17 | 34 |
| 3 | 11 | 45 |

La [campagne réelle](native-campaigns-v48/colm-three-levels.json) conserve
21 préfixes, 45 acquisitions effectives par le Kernel et deux reprises
naturelles de frontière. Les [46 paquets publics complets](native-campaigns-v48/colm-public-trace.json.gz)
contiennent 125 images, y compris celles des animations. Le
[reçu d'exécution](native-campaigns-v48/logs/execution-colm.json) relie la
campagne, les paquets, le journal et les sources gelées.

L'arrêt correspond à la cible déclarée de trois niveaux. Le jeu entre au
niveau 4 avec `NOT_FINISHED`. Ce résultat ne revendique pas une victoire
complète de COLM et ne mesure pas encore la réussite de son quatrième niveau.

### ZIPP : victoire complète

| Niveau terminé | Actions du niveau | Actions cumulées |
| --- | ---: | ---: |
| 1 | 8 | 8 |
| 2 | 15 | 23 |
| 3 | 15 | 38 |
| 4 | 15 | 53 |
| 5 | 24 | 77 |
| 6 | 24 | 101 |

La [nouvelle campagne](native-campaigns-v48/zipp-six-levels.json) acquiert
101 transitions dans 40 préfixes, avec cinq reprises naturelles de frontière.
Ses [102 paquets publics](native-campaigns-v48/zipp-public-trace.json.gz)
contiennent 119 images. Le dernier retour du jeu porte effectivement `WIN`.
Le [reçu d'exécution](native-campaigns-v48/logs/execution-zipp.json) conserve
les mêmes preuves de session et de gel que pour COLM.

La tentative v47 reste intacte : elle terminait cinq niveaux, puis s'arrêtait
à 78 actions avec `frontier_unknown`. La comparaison v48 conserve exactement
ses 77 premières commandes et ses 78 premiers paquets complets. Le changement
de décision intervient à l'entrée du sixième niveau, après cette partie
déjà réussie.

## La capacité transférée : préparer une file à partir d'effets observés

L'entrée source `queued_field_composition` est maintenant connectée. Elle
mesure dans les pixels courants un champ de cellules répétées, un groupe
actif de membres ordonnés et des prévisions compatibles. Elle commence par
des expériences sur les commandes disponibles. Le rôle d'une commande est
acquis à partir du retour : déplacement du groupe, permutation de ses membres
ou réception dans le champ.

Les images intermédiaires ont un rôle précis. Une phase de réception peut
être reconnue avant les changements automatiques qui suivent. Ces observations
permettent de distinguer une direction de réception, une apparence de vide,
des effets de préparation et plusieurs modèles compatibles de transformation
du champ. Un retour au champ antérieur reste un retour observé ; il n'est pas
transformé en une réussite supposée. Les relations contredites et les modèles
éliminés restent inscrits dans la mémoire.

Quand les prémisses mesurées sont suffisantes, une recherche bornée compare
les préparations accessibles avec les relations acquises. La politique source
limite cette recherche à 24 000 projections, une profondeur de trois réceptions
anticipées et un préfixe physique d'au plus 16 commandes, sous les limites
d'actions et de temps de la session. Son rang compare des contributions
conditionnelles sur les modèles encore compatibles. Une borne atteinte ne
devient pas une preuve d'optimalité, et un nombre estimé de membres retirés
ne devient jamais un quota officiel de victoire.

Une relation provenant d'une époque antérieure peut être proposée comme
hypothèse portable si les dimensions des cellules, leur pas, la cardinalité
du groupe actif et les commandes actuellement disponibles conviennent.
Le champ et les prévisions sont mesurés à nouveau. Les commandes et les
transformations supposées doivent encore être confrontées aux retours
courants. Aucun plateau, aucune coordonnée de solution ni condition terminale
n'est importé depuis le niveau précédent.

La [sélection du composant](native-campaigns-v48/candidate-selection.md)
réutilise les 100 vues initiales publiques déjà conservées. Neuf vues
présentent un quadrillage mesurable ; COLM est la seule qui réunit aussi
le groupe actif et les prévisions nécessaires. Cette mesure choisit un cas
d'évaluation. Le nom COLM ne choisit aucune règle dans le programme.

## Transfert source et preuve indépendante

Les composants viennent du V6 épinglé au commit
`786dcf51ca57773d8e3a8948ce9ea3655e7baf8e` :
`queued_field_observation.py`, `queued_field_methods.py`,
`queued_field_models.py`, `queued_field_search.py`, `queued_field_access.py`
et `common_queued_field.py`. Les projections mécaniques nécessaires de
`queued_alignment_cascade.py` et `mechanical_contracts_b.py` sont transférées
dans ce périmètre ; ces deux fichiers complets restent partiellement transférés.

La [comparaison indépendante de COLM](native-campaigns-v48/colm-original-component-comparison.json)
relie une campagne froide du composant Python original inchangé à celle du
caller commun natif. Les 45 références d'action et leurs paramètres effectifs
concordent. Les commandes scalaires originales omettent le champ de transport
vide `data:{}` ajouté par le transport natif : cette différence est recensée
pour chaque commande. Aucun paramètre d'effet n'est ajouté ou changé.

Les 46 paquets publics et leurs 125 images sont strictement identiques,
sans normalisation. Les 21 plans conditionnels complets et les 39 événements
propres à Queued Field sont comparés sur tous leurs champs. Six transitions
ne produisent aucun événement propre de modèle de file ; elles sont conservées
comme telles, tout en étant réellement acquises par le Kernel commun.

Les valeurs des cellules, commandes, modèles alternatifs, rangs de recherche,
comptes de nœuds, prévisions, réfutations et traces de transformations restent
dans la comparaison. Les 12 372 valeurs numériques concordent exactement,
dont 12 370 entiers et deux valeurs fractionnaires. Les espaces de noms des
observations sont rapprochés sans changer époque, révision ou empreinte de
trame ; les références dérivées sont recalculées sur leur contenu avant
rapprochement.

Cette preuve établit la concordance du composant dans le périmètre retenu.
Elle ne constitue pas une comparaison complète de la sélection du caller
Python original. Le diagnostic initial de projection du parent hérité est
conservé avec son exporteur archivé ; le digest du propriétaire natif n'est
pas présenté comme celui de toute la hiérarchie Python.

## La continuation générique qui débloque ZIPP

Le blocage précédent provenait d'un conflit entre deux propositions actuelles.
Une composition Trace pouvait être construite sur l'écran d'entrée du niveau 6,
mais une invitation visuelle du composant Animated Contact était sélectionnée
en premier. La correction étend le contrat de l'arbitre natif existant,
`current_acquired_continuation_before_unacquired_exploration`.

L'invitation doit d'abord attester qu'elle ne dispose d'aucun événement acquis,
y compris dans une époque antérieure, ni d'un retour en attente. Une ancienne
expérience infructueuse suffit à empêcher cette qualification d'exploration
entièrement nouvelle. Le candidat concurrent doit ensuite fournir sa propre
preuve acquise et une proposition courante admissible.

Le mot `official_boundary` d'un événement Trace ne suffit pas : le composant
source l'emploie aussi lors d'un simple changement d'époque. L'arbitre
corrobore donc le préfiltre avec les nœuds réels `prefix_evidence` et
`reasoning:transition` du Kernel. Il exige une hausse effective du score
officiel et vérifie la commande, les observations, la composition relâchée,
la décision, la famille, la sous-question et le type de proposition concernés.
Deux capacités placées dans le même propriétaire de mémoire ne peuvent pas
s'emprunter une réussite.

Une seule décision est réordonnée dans cette campagne : **l'action 78**.
Le reçu se rattache à la hausse officielle **4 → 5** acquise à l'action 77,
par le même programme Trace. La géométrie et le parcours sont calculés sur
l'écran courant. Les gardes de points et l'autorisation WHY/ACT restent
obligatoires ; le reçu de priorité n'autorise lui-même aucune action physique.

La première commande du niveau 6 reste une question à effet inconnu. Le
programme exécute deux préfixes d'une seule action et en acquiert les deux
retours locaux avant de proposer les préfixes conditionnels de 16 puis
6 actions. La réussite antérieure guide le choix du programme, sans lui
donner d'emblée une loi de commande valable dans la nouvelle époque.

La [comparaison indépendante de ZIPP](native-campaigns-v48/zipp-trace-continuation-comparison.json)
vérifie les 36 plans et 77 transitions conservés depuis v47, puis recalcule
les 24 nouveaux contenus d'acquisition à partir des trames et scores réellement
renvoyés. Elle vérifie aussi les liens du reçu de coordination et les marques,
le préfixe et le graphe courants. Le total est de 94 extensions locales
observées, six frontières officielles et une ancienne projection réfutée,
toujours retenue. La victoire officielle ne transforme pas ces observations
en loi universelle de terminaison.

Le journal Trace source, sa mesure visuelle et son calcul de parcours ne sont
pas modifiés par cette coordination. La nouvelle règle s'applique à des
contrats de preuve et de garde, sans branche sur le jeu ou son numéro de niveau.

## Code générique, graphe commun et identités numériques

Les algorithmes de perception, de composition et de recherche sont du code
TypeScript générique. Le graphe V7 commun conserve les observations, programmes,
propositions, acquisitions, contradictions et états des familles. Cette
architecture ne prétend pas que chaque algorithme est déjà une règle
déclarative indépendamment éditable.

Queued Field rejoint le propriétaire existant
`family_state:public_occurrence_recall`, à sa place déclarée avant Product Panel.
Il n'existe pas un propriétaire caché pour COLM. Les mêmes acquisitions
alimentent le journal, les propositions et la restitution après checkpoint.
La restauration vérifie le journal entier avant de publier les couches
reconstruites, de façon atomique. L'ajout de Queued Field étend explicitement
le périmètre du digest natif partagé ; il ne conserve pas artificiellement
l'ancien SHA global tout en changeant son contenu.

Les estimations de contribution peuvent être fractionnaires. Leurs identifiants
utilisent le calcul natif de JSON numérique fini déjà introduit en v47.
L'égalité des empreintes Python et JavaScript n'est pas revendiquée lorsque
leurs écritures numériques diffèrent, par exemple `1.0` et `1`. Les contenus
numériques comparés restent exacts.

La provenance des candidats de continuation utilise en outre le codec existant
du graphe natif, qui conserve les bits Float64, y compris le zéro négatif.
Les entiers du contrat canonique V7 restent inchangés. Le rapport ZIPP conserve
le reçu et le plan complet, mais pas toute la proposition avant autorisation :
son empreinte typée n'est donc pas recalculée indépendamment par ce comparateur.
Le contrat de cette empreinte, y compris les valeurs fractionnaires et le zéro
négatif, est vérifié par les tests du runtime.

## Interface et périmètre de validation

Le panneau « Solve with SRA. » allégé en v47 est conservé. Les détails techniques
restent dans l'inspection fermée par défaut. Les fichiers de l'interface et
de sa mise en page ne changent pas dans cette étape : la colonne du plateau
garde sa hauteur propre, indépendante des changements du texte de statut.
La [vérification navigateur de COLM](native-campaigns-v48/colm-browser-verification.json)
conserve les relevés de la fenêtre testée et la capture après les trois niveaux.
Le canvas y mesure 384 × 384 pixels, sa colonne 442 pixels et le statut
98 pixels. Les sept relevés effectués dans une fenêtre de 1 363 × 936 pixels
montrent **0 pixel de variation** des positions et dimensions des cinq
rectangles suivis. Cette mesure porte sur ces échantillons ; ce n'est pas
un relevé de chaque image, du plein écran ou d'un écran mobile.

Trois clics sur « Run to next level » suffisent à la vérification navigateur.
La capture finale et l'arbre d'accessibilité montrent 45 actions, trois niveaux
terminés, 21 plans et l'entrée au niveau 4, sans action de jeu manuelle,
reset ou saut de niveau.

Les [références Queued Field](../../tests/v6-queued-field-reference.test.ts)
couvrent 100 vues initiales, 62 cas contrôlés et 21 enveloppes du composant
commun source. Les [contrats de coordination](../../tests/v6-acquired-continuation-priority.test.ts)
et de [continuation Trace](../../tests/v6-trace-continuation.test.ts) séparent
score et époque, refusent le prêt de preuve entre propriétaires ou sous-questions,
conservent les refus actuels et vérifient les gardes et l'autorisation réelle.
Les [tests Kernel Queued Field](../../tests/v6-queued-field-kernel.test.ts)
traversent le propriétaire commun, l'acquisition effective et la restauration.

La [suite ciblée](native-campaigns-v48/validation/delta-tests-run.json)
réussit **417 tests sur 417 dans 18 fichiers**, sans échec, annulation ou test
ignoré. Les sources et les entrées de test restent inchangées pendant ce passage.
Il s'agit de la suite correspondant aux couches touchées par v48, sans
relancer toute la suite historique.

Les [cinq régressions](native-campaigns-v48/regression-summary.json) réussissent
sur STCK, CATL, LF52, TICT et SELE : **286 commandes, 291 paquets publics
complets, 233 préfixes et 80 comparaisons**. Elles recalculent les commandes
avant de recevoir les paquets publics conservés. Ce sont des relectures de
trajectoires, distinctes des deux nouvelles campagnes en jeu réel.

Les
[contrôles de construction](native-campaigns-v48/validation/checks-run.json)
et la [validation finale](native-campaigns-v48/validation.json) conservent
leurs résultats exécutés et leurs empreintes. Les preuves historiques restent
intactes.

L'implémentation est `logos-engine.typescript.v6.native-migration/0.18.0`.
Les [163 fichiers natifs gelés](native-campaigns-v48/source-manifest.json)
ont pour empreinte
`30f078d458bf7771e203f3af194ff0bd89fb8fa233d3d0c14cee32282551ea24`.
Ils restent identiques avant et après les deux campagnes.

## Avancement et prochaine étape

**Avancement mesuré : 39 entrées DRM connectées sur 76, soit 51,3 %, contre
50,0 % en v47.** La nouvelle entrée est `queued_field_composition`. Le
renforcement de l'arbitrage est une extension native et n'ajoute pas d'entrée
source. Cet indicateur compte, avec le même poids, les sous-questions des
quatre listes source suivies ; il ne mesure ni la proportion de jeux gagnés,
ni le volume de code, ni une parité V6 complète. Les six critères de migration
complète restent ouverts.

**Prochaine étape : transférer `occluded_catalogue_composition` avec
l'acquisition de vues utiles, puis tester une campagne froide de GRIL visant
ses trois premiers niveaux.** L'observateur source ne reconnaît que GRIL sur
le corpus initial retenu. Il faut encore acquérir l'effet d'une commande qui
apporte une nouvelle vue sans perdre la structure du champ. Les valeurs de
fond ne pourront servir d'indices d'absence qu'avec une preuve de remplacement
réciproque. La [note de sélection](native-campaigns-v48/candidate-selection.md)
documente ce point de départ ; elle n'annonce aucune réussite de GRIL.

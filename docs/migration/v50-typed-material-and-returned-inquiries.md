# v50 · Matière typée, poses acquises et questions après un retour transitoire

## Nouveau résultat : les trois premiers niveaux de LIFE

**Logos Engine termine les niveaux 1, 2 et 3 de LIFE en 49 actions**, dans une
session native froide et continue. Le caller commun raisonne en TypeScript ;
Python reste limité à l'hôte opaque des jeux originaux. La campagne ne reçoit
aucune mémoire préremplie, action manuelle, solution, remise à zéro ou sélection
d'un niveau ultérieur.

| Niveau terminé | Actions du niveau | Actions cumulées |
| --- | ---: | ---: |
| 1 | 15 | 15 |
| 2 | 15 | 30 |
| 3 | 19 | 49 |

La [campagne native finale](native-campaigns-v50/life-three-levels-final.json)
conserve **47 préfixes, 49 acquisitions effectives du Kernel et deux reprises
naturelles de frontière**. Les [50 paquets publics complets](native-campaigns-v50/life-public-trace-final.json.gz)
contiennent **238 images**. Le [reçu d'exécution](native-campaigns-v50/logs/execution-life-final.json)
lie cette trajectoire aux 170 fichiers natifs gelés et vérifiés inchangés
pendant l'exécution.

La cible déclarée est atteinte à l'entrée du niveau 4, avec l'état
`NOT_FINISHED` et la raison `target_levels_completed`. Cette preuve porte
sur trois niveaux terminés ; elle ne revendique pas un `WIN` complet de LIFE.

## Ce qui est transféré

L'entrée `typed_material_flow` rejoint la mémoire commune existante. Elle
relie des supports marqués, leurs remplacements observés, les occurrences
qui en proviennent, les requêtes courantes et les changements de pose.

### Supports et marques mesurés

L'observateur recherche des supports denses contenant plusieurs marques
internes clairsemées. La répétition de supports partageant une partie du
vocabulaire de marques permet de poser une première question. Les valeurs de
palette et les positions viennent des pixels actuels : aucune couleur ne
porte un rôle prescrit par le nom d'un jeu.

Une première interaction peut produire un marquage local tout en conservant
le corps du support. Le programme retient ce retour et compare alors les
profils extérieurs des autres supports. Cette comparaison soutient une
expérience de compatibilité ; elle n'établit pas encore une loi de production.

Lorsqu'un remplacement apparaît, ses sous-structures doivent correspondre
aux marques des supports effectivement retirés, sous les translations
mesurées. L'activation du remplacement demeure une nouvelle question. Les
occurrences qui apparaissent ensuite conservent leurs références d'origine
et leurs preuves d'observation.

### Relations entre matière et requêtes

Le programme compare les occurrences disponibles aux requêtes actuellement
visibles. Une correspondance d'apparence peut proposer le premier essai ;
une association antérieure n'est réutilisée que sous les gardes de l'époque
et du support actuels.

Une association est acquise après une consommation effectivement observée
avec changement de la requête, ou après une frontière officielle. Une
sélection proposée ou un plan de livraison ne suffit jamais à produire cette
connaissance. Les ambiguïtés, l'absence de cible unique et les effets qui ne
se laissent pas réconcilier gardent leurs causes de refus.

### Poses et contrôles conditionnels

Quand la comparaison directe ne suffit plus, les marques peuvent être
comparées sous plusieurs rotations discrètes. Une forme nouvelle à la
frontière d'une époque est d'abord une nouveauté visuelle ; son rôle de
commande et son effet restent inconnus.

Le programme sélectionne l'occurrence concernée, teste le contrôle courant
et mesure son retour. Une règle de pose n'est retenue qu'après ce retour.
Elle peut alors soutenir un préfixe conditionnel de plusieurs actions. Chaque
étape doit préserver les marques prévues, la portée du contrôle et les pixels
extérieurs aux supports concernés. Un désaccord interrompt le préfixe.

La trajectoire de trois niveaux contient quatre propositions de pose, dont
un préfixe conditionnel de trois actions. Les **44 préfixes matériels** se
répartissent en **18 expériences de supports, 22 propositions de circulation
et quatre propositions de pose**. Les trois autres préfixes proviennent
d'`animated_contact`.

## Une limite découverte dans le caller commun

La première campagne native n'a pas été effacée. Son
[rapport d'échec](native-campaigns-v50/life-three-levels.json), ses
[paquets publics](native-campaigns-v50/life-public-trace.json.gz) et la
[note de conservation](native-campaigns-v50/evidence-retention.json)
documentent un arrêt après **une action et zéro niveau terminé**.

À froid, le caller choisissait d'abord une invitation d'`animated_contact`.
Son retour contenait **quatre images**, avec **12 pixels modifiés pendant
l'animation**, puis une dernière image identique à l'image de départ. Le
fournisseur de contact ne possédait aucun modèle appris pour continuer. Son
refus global empêchait le caller d'examiner la question matérielle pourtant
encore mesurable sur l'écran courant.

Le [diagnostic conservé](native-campaigns-v50/diagnostics/material-cold-path.json)
distingue ce problème d'un défaut de perception ou d'un apprentissage
matériel manquant. Le composant source et le composant natif proposaient
tous deux la première expérience de support avant et après ce retour ;
aucun événement matériel n'avait encore été acquis.

### Extension native : circonscrire le refus à son contexte

La correction est une **extension explicite de coordination native**.
L'ordre initial des fournisseurs reste inchangé : la campagne finale conserve
les invitations réellement choisies par `animated_contact`, aux actions
1, 16 et 31. Le retour transitoire ne devient ni une preuve d'absence d'effet,
ni une identité supposée de l'état caché du jeu.

Le Kernel conserve les deux paquets publics, toutes les images intermédiaires,
la commande, les références de transition et les pixels temporairement
modifiés. La coordination exige un retour à la même image finale, au même
score, à la même époque, au même état public et aux mêmes actions disponibles.
Elle vérifie également que le contact ne dispose que d'invitations sans
modèle acquis et qu'aucune frontière officielle ne justifie un autre sens.

Une autre question n'est alors recevable qu'avec l'un de ces deux témoins :

| Témoin | Preuve exigée |
| --- | --- |
| Relation courante mesurée, effet encore inconnu | Mémoire matérielle froide, au moins deux supports marqués, relation répétée reconstituée depuis les pixels actuels, plan et points exacts ; les supports évitent le point de l'invitation et tous les pixels de son effet transitoire |
| Contexte acquis, effet encore inconnu | Contexte de sélection ou de remplacement, occurrences, association ou pose rattachés à de vrais événements conservés ; supports et références courants revérifiés |

Le helper ne transforme pas un plan en connaissance. Un témoin froid contient
zéro référence d'acquisition ; un témoin acquis doit nommer les événements et
les modèles effectivement nécessaires à sa question. Le calcul du témoin ne
modifie pas la mémoire.

La coordination respecte la première question non nulle dans l'ordre source
du groupe. Elle ne saute pas une question antérieure dépourvue de preuve pour
atteindre un fournisseur préféré. Le témoin ouvre seulement la possibilité
d'examiner la question : les gardes courantes, la liaison du point, les
préservations et l'autorisation WHY/ACT restent obligatoires avant l'action.

## Code générique et graphe de connaissance partagé

Les modules `v6-typed-material-observation.ts` et
`v6-typed-material-access.ts` portent les mesures et les trois couches de
mémoire transférées. `v6-typed-material-evidence.ts` fournit les témoins
de coordination ; `v6-returned-probe-scope.ts` qualifie les retours publics
transitoires. Aucun de ces mécanismes ne choisit une règle par le nom LIFE,
par un numéro de niveau ou par une séquence de coordonnées préparée.

L'état rejoint **`family_state:public_occurrence_recall`**, sans deuxième
propriétaire concurrent. L'acquisition suit les couches OccurrenceRecall,
TypedCarrier, MaterialFlow, TypedPose, puis Radial et Rooted. Une proposition
Rooted conserve son arrêt de propagation source et ne fabrique pas
d'événements matériels.

La campagne conserve **68 événements propres** :

| Événement | Nombre | Ce qu'il conserve |
| --- | ---: | --- |
| `typed_carrier_response` | 18 | Réponse réelle sur un support, contexte et calibration mesurée |
| `typed_material_flow` | 28 | Remplacement, filiation, sélection, consommation ou frontière |
| `typed_pose_scope` | 4 | Portée d'époque et contrôles visuellement mesurés |
| `typed_pose_model` | 12 | Marques associées à une requête effectivement étayée |
| `typed_pose_response` | 6 | Retour de sélection ou de contrôle, règle conditionnelle ou refus |

Les trois couches ont leurs propres digests emboîtés. Le journal reconstruit
l'état, et la restauration commune reste atomique. Les objets conservés ne
sont pas modifiables par les plans ou les copies retournées. La configuration
temporaire de proposition et la limite de préfixe ne sont pas présentées
comme des acquisitions.

Les mesures et les algorithmes restent du code TypeScript. Le graphe V7
conserve les objets mesurés, les hypothèses, les événements acquis, les
relations, les gardes et les justifications. Cette étape apporte une capacité
réutilisable sous ces conditions ; elle ne prétend ni que tous les algorithmes
sont déjà des règles déclaratives éditables, ni qu'une généralisation à tous
les jeux a été démontrée.

## Référence source et trajectoire native

Le [probe source indépendant](../../tests/fixtures/v6-typed-material-original-public.json.gz)
utilise le composant `TypedMaterialConstraint` original inchangé, sans
`ObservedFrontier`. Son coordinateur de sous-ensemble termine les mêmes
trois niveaux en **46 actions : 14, 14 et 18**, avec **44 préfixes**.
Il ne représente pas la sélection de tout le caller source ni son
autorisation Kernel complète.

La campagne native emploie **49 actions : 15, 15 et 19**. Elle ajoute une
invitation de contact réellement choisie au début de chaque niveau. Ses
commandes divergent donc de celles du coordinateur source dès la première
action. Les retours supplémentaires sont conservés et passent par
l'acquisition commune ; ils ne sont pas retirés pour fabriquer une égalité
de trajectoire.

La [comparaison indépendante](native-campaigns-v50/life-original-component-comparison.json)
rejoue les **49 transitions publiques natives** dans les couches source
inchangées. Elle vérifie **44 enveloppes matérielles complètes, 68 événements
propres et 49 états reconstruits**, avec une tolérance numérique nulle et
la projection d'identités qualifiée ci-dessous. Les retours des trois
invitations étrangères sont également acquis, sans revendiquer la parité
des plans de leur fournisseur.

Les champs de comportement propres sont comparés intégralement. Les quatre
annotations du caller natif sont conservées séparément. L'ordre de sélection
du caller Python complet, ses digests d'ancêtres et la victoire au-delà des
trois niveaux restent hors de cette comparaison.

## Fidélité numérique : une limite explicite

Les sept modules Python de référence viennent du commit épinglé
`786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`. Les
[contrats indépendants](../../tests/fixtures/v6-typed-material-reference.json.gz)
conservent les mesures originales, les propositions communes, les gardes et
les acquisitions, avec une qualification séparée des identités numériques.

Les coordonnées de raster et leurs fractions dyadiques restent exactes dans
le domaine natif déclaré. Python distingue néanmoins l'écriture JSON de
`0` et `0.0`, alors que JavaScript dispose ici d'un seul type Number. Une
rotation peut aussi produire `-0` par négation en JavaScript quand l'opération
Python sur un entier conserve `0`. Les preuves conservent ces différences :
les entrées canoniques source et natives sont calculées séparément, et les
chemins de zéros négatifs sont retenus avant la sérialisation JSON publique.

Il n'est donc pas revendiqué que tous les hashes Python et natifs soient
identiques. Chaque identité dérivée est vérifiée à partir de ses propres
entrées. L'ordre des ensembles de références explicitement triés est recalculé
sous les identités natives, sans supprimer de membre.

Deux départages nécessitent une limite supplémentaire : des supports à
centres égaux sont départagés par leur signature, et des modèles de pose
nécessitant le même nombre de tours sont départagés par leur référence.
L'ordre lexical de hashes différents peut changer le choix. Les contrats
contrôlés montrent effectivement ces deux différences ; une bijection
d'identités n'est pas présentée comme une preuve de décision équivalente.

La comparaison de la campagne réelle vérifie **328 recettes d'identité**
et restaure explicitement **14 chemins de zéros négatifs**. Aucun départage
par hash entre supports concentriques ou modèles à nombre de tours égal
n'est rencontré sur cette trajectoire de LIFE. Ce constat local ne retire
pas la limite générale démontrée par les contrats contrôlés.

## Validation et interface

Les [tests de référence](../../tests/v6-typed-material-reference.test.ts)
portent sur les mesures, les remplacements, les associations, les poses,
les gardes, les digests et les limites numériques. Les
[tests du Kernel](../../tests/v6-typed-material-kernel.test.ts) vérifient
l'acquisition froide, la mémoire commune, la restauration, les préfixes de
pose et les contre-exemples de coordination. Les contrôles de fidélité source
et ceux de l'extension native restent identifiés séparément.

Le replay du composant sur les 44 préfixes publics source recalcule chaque
proposition avant son retour enregistré. Il produit un témoin matériel froid
et 43 témoins fondés sur des acquisitions réelles, sans refus du helper ni
mutation de mémoire par la certification du témoin.

Les [contrôles de livraison exécutés](native-campaigns-v50/validation/checks-run.json)
confirment TypeScript, l'audit des entrées, l'audit de migration, le contrôle
du diff et le build. La comparaison indépendante des 49 transitions est
également réussie. La [suite ciblée](native-campaigns-v50/validation/delta-tests-run.json)
réussit **371 tests dans 21 fichiers**, sans échec, annulation, test ignoré
ou test restant à faire. Les sources, tests et fixtures restent inchangés
pendant cette exécution unique conservée. Les
[six régressions](native-campaigns-v50/regression-summary.json)
recalculent les décisions natives depuis un état froid avant de consommer
les retours publics enregistrés de STCK, CATL, SELE, COLM, ZIPP et GRIL.
Elles conservent **292 commandes, 298 paquets complets et 187 préfixes**, avec
**108 contrôles comparatifs réussis**. Il s'agit de six replays de preuves
existantes, pas de six nouvelles campagnes contre les jeux. Les mémoires
matérielles restent vides sur ces trajectoires étrangères.

| Contrôle exécuté | Résultat |
| --- | --- |
| Suite ciblée sur 21 fichiers | 371 tests réussis, aucun échec, annulation, test ignoré ou restant à faire |
| Comparaison source sur les retours LIFE natifs | 44 enveloppes, 68 événements et 49 reconstructions propres concordants sous les qualifications numériques déclarées |
| Six relectures de retours publics | 292 commandes, 298 paquets complets, 187 préfixes et 108 contrôles réussis |
| TypeScript, audit des entrées, audit de migration, diff et build | Cinq contrôles réussis |
| LIFE dans le navigateur | Trois niveaux en 49 actions et 47 plans, sept mesures de disposition stables |

Le panneau compact « Solve with SRA. » et la hauteur indépendante du plateau
sont conservés. Le transfert matériel ne modifie pas les fichiers d'interface.
La [vérification navigateur v50](native-campaigns-v50/life-browser-verification.json)
confirme **49 actions, trois niveaux terminés et 47 plans**, par trois clics
sur « Run to next level » dans une session continue. L'inspection reste
fermée dans les sept échantillons pris avant, pendant et après les niveaux.

La colonne du plateau garde une hauteur de **442 pixels**, le canvas
**384 × 384 pixels** et le statut **98 pixels**. Les cinq éléments mesurés
conservent leurs dimensions et leurs positions dans le document : variation
maximale de **zéro pixel** sur les sept échantillons. Le viewport mesure
1 363 × 936 pixels. Ce contrôle est échantillonné ; il ne mesure pas chaque
image et ne réévalue pas le mobile ou le plein écran. La
[capture finale](native-campaigns-v50/life-browser-three-levels.jpg) et
l'[arbre d'accessibilité](native-campaigns-v50/life-browser-three-levels-ax.txt)
conservent les compteurs et l'entrée au niveau 4. Les trois fichiers
d'interface restent identiques à ceux de la v49 publiée.

## Avancement et prochaine étape

L'[audit courant](v6-entry-point-progress.json) relie **41 des 76 sous-questions
DRM explicites, soit 53,9 %**, dans
`logos-engine.typescript.v6.native-migration/0.20.0`. La v49 en reliait 40,
soit 52,6 %. `typed_material_flow` ajoute une entrée ; la coordination des
retours transitoires est une extension native et n'en ajoute aucune.

Ce pourcentage mesure les entrées connectées dans les quatre listes source.
Il ne mesure ni le volume de code traduit, ni les jeux terminés, ni une
équivalence comportementale complète. La migration V6 reste en cours et
son indicateur de complétion reste faux.

**Prochaine étape : transférer `field_service_composition`, puis évaluer
une session froide de VALV visant au moins ses trois premiers niveaux.**
La [sélection reproductible](native-campaigns-v50/candidate-selection.md)
relit uniquement les 100 vues initiales publiques conservées : onze
admettent le motif compact source, 22 contiennent des paires réfléchies,
deux réunissent ces deux mesures, et VALV est seule à présenter aussi une
enceinte de contraste unique de même dimension.

Le transfert suivant devra acquérir les champs persistants, leurs changements
et leur restauration, puis les relations de contrôle et de service, avant
une réutilisation sous géométrie actuelle. Cette sélection ne démontre
encore aucune action réussie, aucun niveau terminé et aucune victoire de VALV.

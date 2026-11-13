# COMB et THER : deux victoires complètes, v43

## Résultats vérifiés

Le **Logos Engine natif termine COMB et THER avec le verdict officiel `WIN`**.
COMB est le nouveau jeu validé ; THER franchit les deux niveaux qui restaient
ouverts en v42. Chaque campagne part d'une mémoire froide et garde une seule
session jusqu'au verdict final.

| Jeu | N1 | N2 | N3 | N4 | N5 | N6 | Total | Préfixes acquis |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| **COMB · Combina** | 3 | 7 | 14 | 19 | 30 | 31 | **104** | **45** |
| **THER · Thermometers** | 4 | 3 | 4 | 4 | 5 | 6 | **26** | **8** |

Les [104 actions de COMB](native-campaigns-v43/comb-six-levels.json) et
les [26 actions de THER](native-campaigns-v43/ther-six-levels.json) sont des
exécutions réelles du caller commun, avec sélection SRC, autorisation WHY/ACT,
gardes par primitive et acquisitions dans les nœuds du véritable Kernel.
Il n'y a ni action manuelle de jeu, ni saut de niveau, ni réinitialisation
de la mémoire au cours d'une campagne. Python sert uniquement de moteur
de jeu opaque ; aucun module d'agent Python n'est chargé.

L'implémentation est `logos-engine.typescript.v6.native-migration/0.13.0`.
Ses **143 fichiers natifs** restent figés pendant toutes les campagnes.
Le manifeste des fichiers porte l'empreinte :

`702fd71e5c234d1942dab9685306aa252b68eaa1280def89d9665a3fcbe2a3fb`

La campagne COMB limitée à trois niveaux a également été exécutée :
**24 actions, 16 préfixes, niveau 4 atteint avec `NOT_FINISHED`**.
La [comparaison sauvegardée](native-campaigns-v43/comb-full-prefix-comparison.json)
vérifie que ses 24 commandes et 25 paquets publics complets sont exactement
le début de la victoire sur six niveaux. Les deux campagnes ont chacune leur
session froide ; leurs références d'observation et leurs empreintes de graphe
ne sont pas artificiellement assimilées.

## Une capacité générique de composition de facteurs

L'entrée source **`product_panel_composition`** est raccordée à sa position
déclarée dans `window_constraints`, avant les entrées déjà transférées.
Elle utilise le même propriétaire d'acquisition
`family_state:public_occurrence_recall`.

La [mesure des panneaux](../../src/logos-engine/v6-product-panel-observation.ts)
recherche des contrôles répétés, les vocabulaires visibles qui leur sont
associés et des miniatures décrivant leurs états conjoints. Elle n'accepte
qu'une correspondance unique et un catalogue égal au produit cartésien
complet de ces vocabulaires.

Le moteur ne connaît initialement aucun effet de contrôle. Il teste un
contrôle actuellement mesuré, observe les valeurs avant et après, et ne
retient une transition locale que si la commande cible ce contrôle et
qu'un seul facteur change. Les retours couplés sont conservés comme
contre-exemples. Les actions étrangères ne sont pas transformées en
liaisons de contrôle.

Le [compilateur de produits](../../src/logos-engine/v6-product-panel-mechanics.ts)
prépare ensuite un parcours fini sous hypothèses explicites : ordre des
cycles, indépendance locale et objectif de couverture du catalogue. Les
transitions réellement acquises contraignent les deux sens possibles du
cycle visible. Chaque étape possède une prédiction de ses valeurs avant
et après ; un effet encore inconnu termine le préfixe pour acquisition et
réconciliation avant la suite.

Ce calcul ne connaît pas les règles internes de COMB. Sa réserve représente
un nombre de commandes émises, et son acceptation décrit la couverture
expérimentale du catalogue. Seul le protocole public décide du `WIN`.

### Parité et limites du transfert

Les [366 tests produit](../../tests/v6-product-panel-parity.test.ts) couvrent
**359 cas source et 34 scènes** : variantes de palette et de position,
mesures ambiguës, transitions directes et inverses, gardes, événements,
propositions complètes, bornes et reçus mécaniques, reprise d'un préfixe
de calcul, refus et restauration.

Le générateur vérifie **825 fichiers source épinglés** au commit
`786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`. Les 16 vrais envelopes de la
famille source `ObservedCompositionConstraint` couvrent les **24 retours**
du composant original isolé, avec comparaison du journal partagé entier
dans la fermeture native transférée. L'ordre d'acquisition retenu est
Rooted, Product, Cell, Graph, Pair, Auxiliary, puis les observations de
paquet. Product appelle d'abord sa chaîne héritée et acquiert aussi les
retours mesurables de plans étrangers.

La [comparaison de trajectoire](native-campaigns-v43/comb-original-component-comparison.json)
établit l'égalité exacte des **24 commandes, 25 paquets publics complets,
46 images en comptant l'image initiale, frontières et 16 longueurs de
préfixes** entre le composant Python original isolé et le caller natif.
Aucun champ, pixel ou domaine d'action n'est retiré. Cette preuve ne
compare pas les choix du caller Python complet ni tout son état hérité.

La traduction de `cyclic_configuration_coverage.py` couvre la branche
appelée `product_sweep / COMPILE` et ses dépendances nécessaires.
Les dix autres familles d'opérations du module restent hors transfert.
Les coercitions générales Pydantic, les entiers Python arbitraires et
les cardinalités non représentables exactement en JavaScript restent
hors du contrat natif. Les ancêtres QueuedField, CatalogueView et les
autres producteurs non connectés ne sont pas déclarés transférés.

Une limite source est conservée explicitement : le compilateur ne consulte
pas la liste des contre-exemples couplés avant de préparer une nouvelle
composition conditionnelle. L'indépendance ne devient donc pas une loi
universelle acquise. Aucun contre-exemple couplé n'est observé dans la
campagne COMB réussie ; cette limite demeure une question pour d'autres
contextes.

### La victoire ne fabrique pas le dernier effet

Les changements d'époque ajoutent un témoin
`compatible_not_universal`, sans attribuer un nouvel effet au contrôle.
L'action 104 de COMB reste dans l'époque 6 : le score passe de cinq à six
niveaux et l'état devient `WIN`. Le panneau final ne peut plus être mesuré
par cette capacité. L'événement conserve les deux références du retour
réel, sans ajouter d'arête, de tuple visité ou de témoin de changement
d'époque. Le dernier effet local acquis appartient à l'action 103.

La victoire officielle est certaine ; sa cause terminale n'est pas
promue en règle universelle. Les 30 arêtes et 26 tuples retenus dans le
contexte final restent des observations locales.

La [baseline v42](native-campaigns-v43/comb-v42-baseline.json), exécutée
depuis le commit publié précédent avec les mêmes actifs de jeu, finit en
`GAME_OVER` après 23 actions, sans terminer le premier niveau. Les
victoires v43 constituent un résultat nouveau. Les temps de machines
partagées ne sont pas présentés comme une mesure contrôlée de vitesse.

## THER : lire le support complet des marques visibles

L'étape annoncée en v42 est réalisée par une **extension native de
perception**, séparée du port source fidèle. Le lecteur
`v6-rooted-quota-observation.ts` reste inchangé.

Le [nouveau lecteur](../../src/logos-engine/v6-rooted-quota-mark-support.ts)
part de la grille, des chaînes et des formes d'unités déjà mesurées.
Il suit chaque série alignée sur tout son support visible à partir
d'ancrages et d'espacements observés. Il exige une même forme et une
couleur homogène dans la série courante, une phase unique et une case
extérieure visible qui atteste sa fin. Il refuse notamment un trou,
une phase concurrente, une palette mêlée dans une série ou un bord coupé.
Il ne choisit jamais les comptes à partir de la satisfiabilité du problème.

Les séries complètes peuvent changer de couleur après une action.
L'extension distingue donc l'empreinte descriptive exacte, couleurs
comprises, de l'empreinte de structure. Chaque continuation remesure les
formes, positions, alignements, espacements et comptes. Elle accepte
uniquement la même structure avec une éventuelle recoloration homogène
entièrement observée. La première image reste gardée exactement.

| Niveau | Unités omises par la bande source | Lecture complète | Résultat réel |
|---|---:|---|---|
| 5 | 2 | Une ligne et une colonne passent de 3 à 4 unités | 5 actions, niveau terminé |
| 6 | 3 | Deux lignes et une colonne passent de 3 à 4 unités | 6 actions, `WIN` |

Le propagateur de quotas n'est pas modifié. Les anciennes lectures des
deux scènes donnent toujours `EMPTY_DOMAIN_CONTRADICTION` ; les comptes
mesurés sur les supports complets donnent des domaines uniques. Les
deux nouvelles compositions sont ensuite réellement exécutées.

L'[audit des marques](native-campaigns-v43/ther-mark-support-audit.json)
vérifie les fichiers figés, les 26 commandes et les 27 paquets publics.
Les **15 premières commandes et 16 premiers paquets** restent exactement
ceux de la v42. Il vérifie également les onze nouvelles gardes sur les
paquets réels et 616 occurrences de pixels d'unités à travers les onze
observations avant action, avec un extracteur indépendant. Huit retours
présentent une recoloration uniforme avec structure conservée.

Le rapport de campagne conserve le dernier état quota de chaque préfixe.
L'audit relit donc directement **deux reçus acquis exportés**, aux actions
20 et 26. Ils contiennent les couleurs réelles avant ces actions, et
excluent l'attribution de la frontière officielle. Les neuf retours
intermédiaires sont vérifiés analytiquement sur les paquets réels ; leurs
événements Kernel complets ne sont pas exportés séparément. Cette
distinction reste indiquée dans la preuve.

La perception demeure bornée : elle exige encore une amorce de grille,
chaînes et forme d'unité que le lecteur source reconnaît. Elle ne certifie
pas la lecture de tous les formats d'indices.

## Généralité, graphe commun et validation

Les nouveaux modules de production ne contiennent ni choix par nom de
jeu, ni branche par niveau, ni palette à signification fixe, ni séquence
de coordonnées préparée. Les coordonnées et valeurs présentes dans la
mémoire proviennent des observations. COMB et THER sont les terrains de
validation de méthodes fondées sur des structures observables.

Le journal, les hypothèses, les préfixes et les preuves d'action utilisent
le véritable Kernel commun. Les routines de perception, recherche et
garde restent des callbacks TypeScript ; leur conversion intégrale en
règles individuellement éditables dans le graphe reste incomplète.

Les [preuves de validation](native-campaigns-v43/validation.json)
rassemblent les tests, le typecheck, le build, les campagnes, les
comparaisons et les vérifications du navigateur. La première passe de
83 fichiers a détecté six anciennes attentes de nombre ou d'ordre des
entrées dans cinq fichiers : sept tests étaient en échec en comptant
un parent. Seules ces attentes ont été corrigées ; les cinq fichiers
ont été revérifiés sans changement des sources de production. Les logs
et reçus des deux passes sont conservés, avec une couverture finale de
**4 526 tests réussis, aucun test ignoré**.

Les vérifications ciblées comprennent **366 tests produit**, **quatre
tests d'intégration dans le Kernel** et **46 tests de lecture étendue**.
Les **181 tests de parité des quotas source** restent inchangés. La
suite couvre aussi le rejeu froid des 45 actions de STCK sur quatre
niveaux ; ce rejeu de paquets sauvegardés est distinct d'une campagne
réelle supplémentaire.

Sept campagnes antérieures sont comparées à la v42 : MEMO, TICT, HANO,
ELAS, TU93, STCK sur trois niveaux et PIPE. Les 91 vérifications
contrôlent 303 commandes, 310 paquets publics complets et 184 préfixes.
Le nouveau producteur n'acquiert aucun faux panneau sur ces trajectoires.

Le navigateur vérifie également les deux victoires via le mode
**SRA Agent Native TS**, avec six clics successifs sur **Run to next level**,
inspection fermée, mémoire conservée et aucune action manuelle sur le jeu.
Les captures et reçus sont conservés pour
[COMB](native-campaigns-v43/comb-browser-verification.json) et
[THER](native-campaigns-v43/ther-browser-verification.json).

## Avancement et prochaine étape

**34 / 76 = 44,7 %** des entrées DRM explicites sont raccordées,
contre **33 / 76 = 43,4 %** en v42, soit **+1,3 point**.
L'entrée `product_panel_composition` apporte cette progression.
La lecture complète des marques est une extension native et ne compte
pas comme une entrée source supplémentaire.

Ce pourcentage pondère chaque entrée également. Il ne mesure ni une
fraction de code traduite, ni le taux de victoire sur les 100 jeux,
ni une parité complète avec V6. L'inventaire conserve 93 modules
`component_verified`, 68 `partial_transfer`, 1 208 en attente et
zéro module pleinement `verified`. Les six conditions de migration
complète restent fausses.

**Prochaine étape : transférer `labeled_sequence_composition`.** Cette
capacité induit des prédicats à partir de séquences et d'exemples
étiquetés, conserve les alternatives compatibles et ne répond que
lorsqu'elles s'accordent sur le contrôle visible courant. Elle réutilise
l'ancêtre Product désormais raccordé. CATL constitue un candidat de
validation à vérifier, sans réussite annoncée à ce stade.

Une connexion effectivement validée porterait la même métrique à
35 / 76 = 46,1 %. **Ce dernier nombre est un objectif futur ;
l'avancement livré reste 44,7 %.**

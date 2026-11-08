# Quotas, relations conditionnelles et deux quatrièmes niveaux, v42

## Résultats vérifiés

Le **Logos Engine natif réussit les quatre premiers niveaux de THER en
15 actions**. Il réussit aussi **le quatrième niveau de STCK**, avec
45 actions cumulées depuis le début. Chaque campagne part d'une mémoire
froide et conserve une seule session entre les niveaux.

| Jeu | Niveau 1 | Niveau 2 | Niveau 3 | Niveau 4 | Total | Préfixes acquis |
|---|---:|---:|---:|---:|---:|---:|
| THER · Thermometers | 4 | 3 | 4 | 4 | **15** | 6 |
| STCK · Card Stack | 3 | 7 | 25 | 10 | **45** | 25 |

Les [15 transitions de THER](native-campaigns-v42/ther-four-levels.json) et
les [45 transitions de STCK](native-campaigns-v42/stck-four-levels.json)
passent par le caller commun, les programmes SRC, WHY/ACT et les véritables
nœuds du Kernel. Aucun niveau n'est sauté, aucune mémoire n'est réinitialisée
pendant une partie et aucune action de jeu n'est fournie manuellement.

Ces deux campagnes s'arrêtent à leur objectif déclaré, à l'entrée du niveau
5, avec `NOT_FINISHED`. **Quatre niveaux réussis ne constituent pas un `WIN`
complet.** Les tentatives visant les six niveaux sont conservées séparément,
y compris leurs limites et leurs arrêts.

L'implémentation est `logos-engine.typescript.v6.native-migration/0.12.0`.
Ses **139 fichiers natifs restent inchangés** pendant les campagnes
canoniques. Leur manifeste porte le digest :

`6567be12230880198a7b4b085999ecda9354487599e728ee1ae27455f7056d04`

Aucun module d'agent Python n'est chargé en production. Python reste le
moteur de jeu opaque, qui expose uniquement les commandes et observations
publiques. Les sources Python de l'agent servent aux comparaisons de
développement, hors du chemin de résolution natif.

## THER : transfert d'une capacité générique de quotas

L'entrée déclarée `rooted_quota_composition` est raccordée à sa place dans
la liste DRM `window_constraints`. Elle partage le propriétaire d'acquisition
`family_state:public_occurrence_recall`, au lieu de créer un solveur parallèle.

Le mécanisme comporte trois étapes :

1. **Mesurer la structure actuelle.** Le moteur repère un réseau de cellules,
   des chaînes dessinées, leurs extrémités et des marques alignées. L'extrémité
   plus large comme racine et les marques comme quotas sont des hypothèses.
2. **Apprendre les éditions par des retours réels.** Une première expérience
   distingue un effet local d'un remplissage en préfixe. Une seconde distingue
   une coupe d'un simple basculement indépendant. Les autres chaînes doivent
   rester préservées pour acquérir la relation d'édition.
3. **Composer sous contraintes.** La propagation bornée des domaines entiers
   calcule les longueurs compatibles avec les hypothèses courantes. Un plan
   n'est émis que si les domaines retenus sont des singletons. Chaque primitive
   conserve sa garde, son budget et sa comparaison au retour public.

Les [mesures](../../src/logos-engine/v6-rooted-quota-observation.ts), les
[méthodes mécaniques](../../src/logos-engine/v6-rooted-quota-mechanics.ts) et
[l'accès avec acquisition](../../src/logos-engine/v6-rooted-quota-access.ts)
utilisent les pixels et relations effectivement observés. Ils ne contiennent
ni identifiant de jeu, ni numéro de niveau, ni palette attribuée à l'avance,
ni solution de grille préenregistrée.

### Parité avec le composant original

Les [181 tests de parité](../../tests/v6-rooted-quota-parity.test.ts)
s'appuient sur **176 cas et 18 scènes**, exportés depuis la source épinglée
`786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`. L'export vérifie les empreintes de
**825 fichiers source**. Il couvre les mesures, variantes de palette et de
position, éditions, bornes de calcul, reçus mécaniques, gardes, réfutations,
propositions complètes, événements et reconstruction.

Les cinq vrais envelopes `ObservedCompositionConstraint` /
`CombinedObservedCompositionMemory` sont également comparés sur les onze
retours de la trajectoire originale et ses trois frontières. La coupe réelle
de la chaîne d'acquisition est conservée : `RootedQuotaAccess.record` émet
son propre événement sans appeler les anciens ancêtres Program/Occurrence/
Radial. Les couches supérieures Cell/Graph/Pair/Auxiliary et `record_packet`
restent exécutées. Les événements passifs natifs correspondent exactement :
un événement quota par retour et une ancre d'époque aux actions 1, 5 et 8.

La [comparaison des trajectoires enregistrées](native-campaigns-v42/ther-original-component-comparison.json)
établit une identité exacte entre les trois premiers niveaux du caller
natif et le composant Python original isolé : **11 commandes, 12 paquets
publics complets, 21 images d'animation, frontières aux actions 4, 7 et 11,
et cinq préfixes**. Le domaine d'actions et son ordre concordent également.
Aucun champ, pixel ou domaine d'action n'est supprimé de cette comparaison.

Cette preuve concerne le composant isolé et cette trajectoire. Elle ne
constitue pas une parité du caller Python complet. L'héritage ServiceTransfer
et les autres producteurs non portés restent hors de la fermeture native.
Les contrats mécaniques portent sur des requêtes JSON canoniques à entiers
JavaScript exacts ; toutes les coercitions Pydantic et tous les entiers Python
arbitraires ne sont pas couverts. La carte conserve donc les statuts
`component_verified` ou `partial_transfer`, sans déclaration de migration complète.

### Comparaison avec la v41

La [baseline froide v41](native-campaigns-v42/ther-v41-baseline.json)
termine deux niveaux de THER, en 21 puis 87 actions, puis atteint la limite
de temps actif au niveau 3, après **170 actions cumulées**. La v42 termine
les trois premiers en 11 actions, puis le quatrième en quatre actions
supplémentaires. Les budgets et actifs de jeu sont conservés.

Cette comparaison établit de nouvelles réussites bornées. Les temps muraux
proviennent de machines partagées et de campagnes uniques ; ils ne sont pas
présentés comme un benchmark de vitesse.

## STCK : une relation acquise, puis une expérience composée

Le problème de la v41 n'était plus seulement l'absence d'un ancien contrôle.
Le moteur avait appris une liaison vers un nouveau membre et mesuré une
phase où une autre collection se déplaçait. Il n'avait pas encore de relation
réutilisable, et la commande quittait l'accès visuel aux contrôles.

La v42 ajoute une **extension native explicitement identifiée**, séparée des
modèles Python transférés. Le modèle original de réduction reste inchangé.
Les nouveaux événements sont conservés dans le journal partagé réel et
participent à son empreinte et à sa restauration atomique.

### Préparer un retour sans présumer l'effet inconnu

Avant d'exécuter le membre inconnu, le moteur insère un mouvement inverse
qui a déjà été observé. La question est conditionnelle : si la phase inconnue
préserve le porteur, ce mouvement pourrait le ramener au support d'édition.
La simple préparation du plan ne crée aucune connaissance.

Le retour réel doit ensuite montrer à la fois le porteur au site attendu et
l'accès actuel aux contrôles. Si ce retour ne se produit pas, le moteur ne
peut pas continuer à éditer à partir d'un ancien point. Un clic stationnaire,
une mauvaise commande ou une insertion différente ne certifient pas le retour.

### Chronologie des nouvelles acquisitions

Les 38 premières commandes et leurs paquets publics complets restent
identiques à la v41. La nouvelle trajectoire poursuit ainsi :

| Action cumulée | Question réellement exécutée | Ce qui est acquis |
|---|---|---|
| 38 | Essai du contrôle non attribué | Liaison entre son apparence et le membre effectivement inséré |
| 39 | Insertion d'un inverse déjà observé | Édition connue mesurée ; retour encore conditionnel |
| 40 | Exécution du mot préparé | Phase inconnue isolée, déplacement d'un autre porteur, retour et accès d'édition réellement observés |
| 41–42 | Deux retraits | Nouveau mot mesuré après chaque édition ; porteur et autres objets contrôlés |
| 43–44 | Deux insertions | Préparation du transport à partir de mouvements observés et du contrôle acquis |
| 45 | Exécution de la nouvelle question | Frontière officielle : passage de trois à quatre niveaux terminés |

L'[audit indépendant](native-campaigns-v42/diagnostics/stck-program-relations-audit.json)
relie cette chronologie aux commandes, empreintes des paquets, pixels et
événements réellement conservés. Le
[module relationnel](../../src/logos-engine/v6-program-relations.ts) ne
choisit jamais d'action selon le nom STCK ou un numéro de niveau.

### Ce que la réussite prouve, et ce qu'elle laisse ouvert

Après l'action 40, le journal retient **une seule observation de référence**
pour une relation conditionnelle entre deux porteurs de mots visibles.
Elle n'est applicable qu'avec des rôles uniques, le mot répondant observé,
l'écart relatif mesuré et les conditions courantes vérifiées.

Deux descriptions du déplacement restent compatibles : un déplacement fixe
et un déplacement radial. Une réaction différée au mouvement précédent reste
également possible. Une répétition au même écart dans une autre position ne
suffirait pas à départager ces explications.

La question finale teste aussi une destination dont le support n'est pas
caractérisé. Elle n'annonce ni réduction, ni disparition, ni réussite. Le
retour de l'action 45 est une frontière officielle : **l'attribution de sa
phase est exclue**, avec un résultat relationnel `unresolved` et aucun nouvel
échantillon. Le compteur de support du modèle reste **1**. Il n'y a ni
renforcement artificiel, ni nouvelle loi terminale, ni réfutation du modèle
source.

Ainsi, **la réussite du niveau 4 est certaine au protocole public**, tandis
que l'explication complète de l'opération demeure ouverte. Le graphe garde
ces deux statuts séparément.

## Cadre générique et limites

La généralité vient des règles de mesure, d'acquisition, de composition et
de réfutation. Une coordonnée, une palette ou un mot peut apparaître dans
les données acquises parce qu'il a été observé. Il n'est pas inscrit comme
solution dans le code de production.

Les hypothèses conservent une portée restreinte. Un nouveau contexte, une
ambiguïté d'identité, une preuve absente, un inventaire incompatible ou une
modification de la commande peuvent empêcher leur réemploi. Cette prudence
est distincte d'une branche de résolution dédiée à un jeu.

Les méthodes de mesure et recherche continuent à s'exécuter en callbacks
TypeScript natifs. Leur état, leurs preuves et l'autorité d'action utilisent
le graphe Kernel réel. La transformation de toutes les procédures en nœuds
éditables et la parité de toutes les capacités V6 restent incomplètes.

La [tentative complète STCK](native-campaigns-v42/diagnostics/stck-relation-six-level-attempt.json)
s'arrête au niveau 5 avec `frontier_unknown`, après les mêmes 45 actions.
La [tentative THER visant six niveaux](native-campaigns-v42/diagnostics/ther-six-level-attempt.json)
termine également quatre niveaux, puis atteint la limite de temps actif au
cinquième après 107 actions. Aucun cinquième niveau ni victoire complète
n'est déclaré.

Le [diagnostic du niveau 5 de THER](native-campaigns-v42/diagnostics/ther-level-five-quota-diagnosis.json)
isole la cause sur les seuls pixels publics : la grille et les six chaînes
sont mesurées, les préfixes sont valides, mais deux unités de marque restent
hors de la bande de lecture limitée à un pas de grille. Une ligne et une
colonne sont donc comptées à trois unités au lieu de quatre. La propagation
produit `EMPTY_DOMAIN_CONTRADICTION`, pas une simple ambiguïté ni un manque
de temps de recherche. La même scène, les mêmes longueurs, le même certificat
et le même refus sont reproduits par le Python original inchangé, avec
715 fichiers source vérifiés. C'est une limite héritée de la mesure.

Un recomptage analytique des unités homologues sur toute la marge visible
rend les domaines singletons avec le propagateur inchangé. Ce diagnostic
n'est ni une correction appliquée à la production, ni une action de jeu,
ni une réussite du niveau 5. Il fournit une prochaine étape précise.

## Validation et progression

Les [preuves de validation](native-campaigns-v42/validation.json) rassemblent
**4 110 tests réussis sur 80 fichiers, zéro échec et zéro test ignoré**, le
typecheck, le build, les empreintes exactes, les campagnes froides, les
comparaisons et les vérifications du navigateur. Les 79 fichiers de la
suite commune et le fichier relationnel de 32 tests ont été exécutés en
deux lots disjoints sur le même code de production figé, afin de ne pas
répéter son rejeu froid de 45 actions. Les deux reçus sont conservés.

Le navigateur confirme **THER : 15 actions, quatre niveaux et six plans**,
et **STCK : 45 actions, quatre niveaux et 25 plans**. L'inspection reste
fermée durant ces parties ; seuls les boutons de lancement de l'agent
sont utilisés. Les captures et états visibles sont conservés dans
[la vérification THER](native-campaigns-v42/browser-verification.json) et
[la vérification STCK](native-campaigns-v42/stck-browser-verification.json).

Sept campagnes antérieures sont rejouées : **MEMO, TICT, HANO, ELAS, TU93,
STCK sur trois niveaux et PIPE**. Les **91 vérifications** comparent
303 commandes et 310 paquets publics complets, avec 184 préfixes. Elles
conservent les choix, frontières, acquisitions et projections précédentes.
Les nouvelles projections quota/relation restent vides sur ces anciennes
trajectoires. Les temps et les identités de session ne sont pas confondus
avec une différence de comportement.

La [couverture des entrées déclarées](v6-entry-point-progress.json) est de
**33 / 76 = 43,4 %**, contre **32 / 76 = 42,1 %** en v41. Le gain de
**1,3 point** correspond à l'entrée `rooted_quota_composition`.

Ce pourcentage compte des sous-questions DRM raccordées, à poids égal.
Il ne mesure ni la proportion de code traduite, ni le taux de réussite des
jeux, ni une intelligence générale. Les extensions relationnelles natives
n'ajoutent aucune entrée à ce dénominateur. Les six conditions de migration
complète restent fausses.

## Prochaine étape

Étendre **la lecture des marques alignées à leur support visible complet**,
avec des contrôles d'homologie, d'unicité et de contradiction. La lecture ne
doit plus dépendre d'une bande d'un seul pas de grille. Il s'agit d'une
extension générique de perception, distincte de la traduction fidèle de la
source ; aucune correction par numéro de niveau ou coordonnée fixe ne convient.
Le niveau 5 de THER sera le premier test réel de cette extension.

En parallèle, la relation de STCK demande un contraste sans frontière
terminale ou une revalidation indépendante des rôles, du décalage et du
préfixe, pour départager les explications conservées. La prochaine livraison
devra de nouveau apporter une preuve sur un nouveau jeu, et garder la même
mesure d'avancement : **43,4 % actuellement**, selon les entrées DRM raccordées.

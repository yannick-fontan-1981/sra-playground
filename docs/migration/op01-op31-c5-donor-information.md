# C5 — information et exploration dans le donneur V6

Référence stable : `docs/migration/op01-op31-verification-plan.md`

Source examinée : runtime Python V6 publié au commit
`786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`.

Objectif : qualifier OP06, OP07, OP13, OP20, OP21, OP22 et OP23 en
distinguant observation, hypothèse, prédiction et consommation décisionnelle.

## OP06 — Exceptions

### Calcul générique

OP06 recherche les observations attribuées au focus dont un effet attendu
diffère de l'observation.

Limite du calcul générique :
une propriété absente de l'observation peut apparaître différente si
l'observabilité n'est pas explicitement contrôlée.

### Mécanisme spécialisé réel

`common_mechanisms.py` possède une chaîne de réfutation plus forte :

1. une règle empirique doit avoir une prédiction gelée avant dispatch ;
2. la prédiction est comparée à une observation indépendante ;
3. si elle échoue, un contre-exemple est ajouté ;
4. la règle passe à `status='refuted'` ;
5. `predictive_use_allowed=False` ;
6. les prédictions futures refusent une règle réfutée.

La même source conserve aussi `unknown` lorsque :
- la correspondance est insuffisante ;
- le contact exact n'est pas établi ;
- la base de coordonnées n'est pas liée ;
- une stationnarité ne suffit pas à prouver un blocage.

### Qualification

**Fonction spécialisée équivalente pour la réfutation de règles empiriques dans ce domaine.**

Elle couvre mieux que l'OP générique :
- provenance avant/après ;
- prédiction gelée ;
- contre-exemple ;
- invalidation de l'autorité prédictive.

OP06 ne doit pas être ajoutée en parallèle sur ce chemin si elle ne fait que
redétecter la même contradiction.

Disposition :
- besoin de contre-exemple : démontré ;
- producteur/consommateur spécialisés : démontrés ;
- appel OP06 : non nécessaire démontré sur ce chemin.

## OP07 — Frontières

### Calcul générique

OP07 retourne les frontières :
- accessibles ;
- non visitées ;
- liées à un objectif ouvert.

### Mécanisme spécialisé réel

`ObservedFrontier` :
- indexe les observations publiques avec provenance ;
- conserve les transitions et essais ;
- construit des questions pour les actions non essayées ;
- donne priorité aux candidats admis, aux hypothèses d'une époque antérieure,
  puis aux effets non observés ;
- évite les essais déjà consommés ;
- recherche un accès vers une question ouverte ;
- retourne `frontier_exhausted` si aucune action non essayée ni accès observé
  n'est disponible sous les bornes courantes.

`propose()` construit ensuite :
- un préfixe d'accès observé ;
- éventuellement un dernier pas non résolu ;
- OP18 si un effet reste inconnu ;
- OP28 si tout le préfixe est déjà observé ;
- une question, des preuves et une portée courante.

### Qualification

**Fonction spécialisée équivalente substantielle au besoin OP07.**

La frontière n'est pas seulement listée : elle est consommée pour choisir la
prochaine expérience ou un accès vers celle-ci.

Disposition :
- besoin démontré ;
- producteur démontré ;
- consommation décisionnelle démontrée ;
- raccord OP07 générique probablement redondant dans ce chemin.

## OP13 — Portée des effets

### Calcul générique

OP13 retourne :
- effets observés du focus ;
- `unobserved_extent='unknown'`.

### Mécanismes spécialisés

`common_mechanisms.py` porte une `scope` explicite dans chaque règle :
- contexte observable ;
- positions validées ;
- correspondances non résolues ;
- support exact mesuré ou non ;
- généralisation interdite ou confirmée.

Une règle de translation ne devient `mechanism_acquired` et
`predictive_use_allowed=True` qu'après confirmation indépendante dans un
contexte de position différent.

`composition_effects.py` conserve également les effets mesurés avec une
portée explicite, par exemple :
- effet couleur : entrée et valeur observées ;
- transport : niveau courant et contexte d'entrée observé.

### Qualification

**Recouvrement spécialisé fort de la portée d'effet.**

La portée est déjà portée par les modèles et consommée pour autoriser ou
interdire la prédiction.

OP13 peut rester utile comme vue analytique transversale, mais aucun besoin
n'est démontré pour la recalculer sur ce chemin.

## OP20 — Utilité des objets

### Calcul générique

OP20 transforme les entités `utility == unknown` en hypothèses/questions.

### Mécanismes observés

Le donneur possède beaucoup de questions spécialisées liées à des entités :
- contrastes de points ;
- rôles/mouvements ;
- contrôle ;
- motifs ;
- contacts ;
- relations.

Mais ces questions sont déclenchées par un désaccord, une cible, une relation
mesurable ou un besoin de contrôle précis, pas par le simple fait qu'un objet
a une utilité inconnue.

### Qualification

**Besoin générique OP20 non démontré.**

C'est un résultat important : le runtime évite justement de tester tous les
objets inconnus.

Disposition :
- ne pas brancher OP20 sur « utility unknown » seul ;
- exiger une question liée à une décision avant expérimentation.

## OP21 — Utilité des espaces

### Calcul générique

OP21 transforme les espaces `utility == unknown` en hypothèses/questions.

### Mécanismes observés

`ObservedFrontier` explore uniquement :
- un effet d'entrée encore non observé ;
- une hypothèse à discriminer ;
- un accès vers une question ouverte ;
- sous bornes d'époque, ressources et répétitions.

Il ne visite pas toutes les zones inconnues.

### Qualification

**Besoin générique OP21 non démontré ; recouvrement spécialisé par exploration orientée question.**

L'inconnu spatial seul ne justifie aucune exploration.

## OP22 — Effets distants

### Calcul générique

OP22 filtre les `remote_effects` possédant une observation.

### Mécanismes spécialisés

Le donneur possède des expériences de contrôle après changement local :
- `ObservedFrontier.propose()` accepte un `control_probe` avec
  `expected_receivers` ;
- il vérifie que l'intervention et les récepteurs attendus sont liés à
  l'observation courante ;
- les expériences d'information peuvent mesurer des changements sur des
  relations/entités distinctes du point d'action.

`composition_curiosity.reconcile()` compare ensuite la mesure obtenue aux
prédictions gelées et renvoie pour chaque hypothèse :
- `matched` ;
- `contradicted` ;
- `unknown`.

### Qualification

**Recouvrement spécialisé partiel d'OP22.**

Un effet distant peut alimenter une expérience discriminante et modifier le
statut d'hypothèses. Mais aucun registre générique `remote_effects → modèle`
équivalent à OP22 n'est démontré.

Disposition :
- effets distants liés à une expérience : consommation spécialisée réelle ;
- OP22 générique : usage non démontré.

## OP23 — Autonomes

### Calcul générique

OP23 prévoit l'état suivant d'une entité si :
- un cycle est fourni ;
- une preuve de cycle existe.

Sinon, une entité simplement `autonomous` produit `next='unknown'`.

### Mécanisme temporel observé

`TemporalQuestions` :
- accumule des mouvements d'une forme unique ;
- exige un successeur non ambigu sous plusieurs entrées sources ;
- construit une expérience discriminante sous une entrée non testée ;
- gèle la prédiction avant l'expérience ;
- observe le résultat indépendant ;
- classe matched/rival/other/unknown.

Mais :
- `predictive_use_allowed=False` dans les propositions ;
- le scope dit explicitement que phase cachée, mouvement conjoint et influence
  des entrées restent des hypothèses ;
- une disparition ou ambiguïté bloque la prévision.

`return_fork.py` peut reconnaître un retour observé dans un cycle de
projection publique, mais ne le transforme pas en loi autonome générale.

### Qualification

**Pas d'équivalence OP23 démontrée.**

Le donneur possède des questions temporelles, pas encore un modèle autonome
ayant acquis le droit de prédire un cycle futur.

Disposition :
- besoin de discrimination temporelle : démontré ;
- prévision autonome décisionnelle : non démontrée ;
- ne pas convertir ces observations en OP23 sans preuve de cycle suffisante.

## Information réellement consommée

La chaîne la plus forte de C5 est :

**question mesurable → élection d'un information goal → OP18 → observation indépendante → reconcile → hypothèses matched/contradicted/unknown → modèle/règle conservé ou réfuté → choix ultérieurs bornés**

Éléments démontrés :
- `composition_curiosity.elect()` refuse les offres périmées, sans contraste,
  sans relation mesurable, risquées ou hors budget ;
- il classe les offres selon séparation, relations, récupération et stabilité ;
- le target tree lie cette information goal à l'expérience avant release ;
- `reconcile()` confronte la mesure aux prédictions gelées ;
- les règles empiriques peuvent perdre leur autorité prédictive après
  contre-exemple ;
- le frontier utilise ensuite les statuts et essais pour choisir d'autres
  questions.

Cela constitue une vraie boucle d'information décisionnelle, sans nécessiter
d'activer artificiellement OP20/21/22/23.

## Synthèse C5 donneuse

| OP | Besoin réel | Équivalent spécialisé | Contribution démontrée | Disposition |
| --- | --- | --- | --- | --- |
| OP06 | oui | règles empiriques + contre-exemples | oui, invalidation prédictive | spécialisé couvre le besoin |
| OP07 | oui | ObservedFrontier | oui, choix expérience/accès | spécialisé couvre le besoin |
| OP13 | oui | scope des règles/effets | oui, borne la prédiction | recouvrement fort |
| OP20 | non générique | questions entité ciblées | oui seulement si question liée | ne pas activer sur unknown seul |
| OP21 | non générique | frontier orienté question | oui seulement si question liée | ne pas explorer unknown seul |
| OP22 | oui dans certains probes | control/contrast experiments | partielle | recouvrement spécialisé |
| OP23 | question temporelle oui | TemporalQuestions | expérimentation oui, prédiction autonome non | besoin générique non raccordé |

## Performance

Aucun changement runtime dans sra-playground.
Aucun benchmark requis pour cette étape documentaire.

Si ces mécanismes sont raccordés au port TypeScript :
- calculs à la demande uniquement ;
- pas de balayage de tous les objets/espaces inconnus ;
- caches invalidés par observation/époque/révision ;
- recherches frontier et temporelles bornées ;
- session complète STCK et SMLP à mesurer séparément sous +10 %.

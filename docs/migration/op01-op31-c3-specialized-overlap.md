# C3 — recouvrement des besoins OP03 / OP08 / OP12 / OP26 dans le donneur V6

Référence stable : `docs/migration/op01-op31-verification-plan.md`

Source examinée : runtime Python V6 publié au commit
`786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`.

Ce document cherche les fonctions spécialisées qui répondent déjà à tout ou partie
des besoins C3. Il ne déclare une équivalence que si le besoin, les données,
l'inconnu et le consommateur coïncident.

## OP03 — Préconditions

### OP générique

`operations.py::execute("OP03", state)` produit pour le focus un verdict par
précondition :
- vrai si le fait est présent et égal ;
- faux si le fait est présent et différent ;
- `unknown` si le fait est absent.

### Fonction spécialisée trouvée

`composition.py::validate_bundle(bundle, state, revision)` vérifie :
- révision exacte ;
- références connues ;
- kind autorisé ;
- nombre d'actions borné ;
- toutes les `bundle.preconditions` présentes et égales dans `state.facts` ;
- preuves de préservation ;
- preuve non vide.

### Qualification

**Recouvrement partiel, pas équivalence.**

Le besoin physique « ne pas libérer un bundle si ses préconditions courantes
ne sont pas satisfaites » est déjà traité par `validate_bundle()`.

Mais cette garde booléenne ne conserve pas la différence entre :
- précondition réfutée ;
- information absente.

Une absence devient simplement `conditions=False`. Elle ne peut donc pas
remplacer OP03 pour un consommateur de planification qui doit ouvrir une
question ou suspendre un segment sur `unknown`.

Disposition C3 :
- garde physique spécialisée : **existante** ;
- producteur tri-état pour planification : **toujours à raccorder si ce besoin existe dans le port**.

## OP08 — Prédécesseurs

### OP générique

OP08 cherche des compositions dont les effets peuvent satisfaire une exigence
manquante de la cible.

### Fonctions spécialisées observées

`target_tree.py::extend_target()` :
- part de faits mesurés et de facettes résiduelles ;
- construit des dérivations observées bornées ;
- filtre des routes possédant des actions ;
- conserve alternatives, limites, preuves et absence d'autorité de release ;
- sélectionne une contribution liée à une cible déjà retenue.

`target_tree.py::bind()` :
- exige une cible retenue et revalidée ;
- vérifie les `child.requires` contre les faits courants et mesurés ;
- exige une route courante ;
- retourne un chemin admis seulement si les conditions de l'enfant sont présentes.

### Qualification

**Fonctions spécialisées voisines, pas équivalence OP08 démontrée.**

Elles savent prolonger une cible dans des familles déclarées et vérifier les
conditions d'un enfant, mais aucune preuve examinée ne montre un calcul
générique « effets de toutes compositions → exigences manquantes de la cible ».

Disposition C3 :
- certains prédécesseurs sont encodés dans la structure spécialisée du target tree ;
- un producteur générique effect/requires reste **non démontré** ;
- ne pas ajouter OP08 si le target tree couvre déjà le besoin exact d'une famille ;
- ne pas déclarer le target tree équivalent pour les familles hors de son contrat.

## OP12 — Inconnues

### OP générique

OP12 parcourt une chaîne de dépendances bornée et retourne les préconditions
inconnues, sans transformer l'inconnu en impossibilité.

### Fonctions spécialisées observées

`goal_access_adapter.py::propose()` accepte explicitement l'effet
`unknown_then_observe`.

Le préfixe préparé :
- est borné ;
- exige des commandes disponibles ;
- interdit qu'un effet non mesuré soit suivi silencieusement par d'autres pas ;
- marque `unresolved` lorsque le dernier effet est `unknown_then_observe` ou lorsqu'un contrôle reste tentatif ;
- produit une question d'accès conditionnel avec hypothèses et falsificateurs.

`target_tree.bind()` possède également une branche
`acquire_missing_control` qui rattache une expérience de contrôle à une
cible retenue et revalidée.

### Qualification

**Recouvrement spécialisé substantiel, pas équivalence générique.**

Le besoin « une incertitude locale d'accès doit sceller le préfixe et provoquer
une observation/expérience avant continuation » est déjà traité.

Mais ces fonctions ne démontrent pas le parcours générique `depends_on /
requires` d'OP12 sur une chaîne arbitraire de compositions.

Disposition C3 :
- pour les accès couverts, l'inconnu est déjà préservé et consommé ;
- OP12 ne doit pas dupliquer ce mécanisme ;
- OP12 reste candidate seulement pour des chaînes de dépendances non couvertes
  par ces producteurs spécialisés.

## OP26 — Accès admissible

### OP générique

OP26 reçoit des accès déjà produits et sélectionne ceux qui atteignent la cible
avec contraintes vérifiées.

### Fonctions spécialisées observées

Plusieurs familles produisent et revalident directement leur accès :

`goal_access_adapter.py`
- produit une route à partir de mémoire mesurée ;
- vérifie disponibilité des commandes ;
- borne le préfixe ;
- fournit `before()` et `after()` pour revalidation autour de chaque pas.

`passage_options.py`
- ne considère que les actions actuellement disponibles ;
- construit des choix sur des surfaces calibrées ;
- produit une composition OP18 avec faits et preuves ;
- `admit()` exige même époque, score, observation, action disponible, origine
  encore localisée et surface cible inchangée.

`cell_placement_access.py`
- lie l'accès à époque, score, observation et digest complet du frame ;
- vérifie action disponible et coordonnées calculées ;
- `admit()` refuse si le contexte ou le point ont changé.

`alternating_graph_access.py`
- construit un accès mesuré sur graphe ;
- `admit()` revalide acteur, contexte et commande ;
- borne les effets non observés.

### Qualification

**Équivalent spécialisé pour l'admission d'accès dans ces familles, mais pas pour la sélection générique OP26.**

Ces familles n'ont pas besoin qu'OP26 « rende » leur accès sûr après coup :
elles génèrent un accès avec ses preuves puis le revalident juste avant usage.

En revanche, si plusieurs accès hétérogènes sont rassemblés dans un domaine
commun et doivent être filtrés par cible/contraintes, le besoin générique OP26
peut encore exister.

Disposition C3 :
- ne pas interposer OP26 entre un producteur spécialisé et sa propre garde si
  cela ne fait que répéter la même admission ;
- rechercher un vrai consommateur multi-accès avant tout raccordement OP26.

## Conséquence architecturale C3

Le donneur V6 montre trois couches distinctes qu'il faut préserver dans le port :

1. **raisonnement tri-état** : vrai / faux / unknown, utile au plan ;
2. **producteur spécialisé** : construit un accès, une question ou une dérivation
   avec preuves et portée ;
3. **garde physique** : vérifie l'état courant juste avant release.

Les OP génériques ne doivent pas remplacer les gardes spécialisées, et les
gardes booléennes ne doivent pas remplacer les OP qui préservent l'inconnu.

## Statut C3 après cette lecture

- OP03 : garde spécialisée trouvée ; besoin tri-état générique encore ouvert.
- OP08 : target tree spécialisé trouvé ; producteur générique effect/requires non démontré.
- OP12 : incertitude d'accès spécialisée déjà traitée ; parcours générique des dépendances encore ouvert.
- OP26 : admission spécialisée forte dans plusieurs familles ; besoin de filtre multi-accès générique non démontré.

Aucun appel OP n'est ajouté à ce stade.

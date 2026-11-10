# Lot 4B : arrangements relatifs et effets mesurés

## État de la livraison

Le développement de **`relative_arrangement`** part de **Site 81 / Logos Engine 0.51.0**, commit `4dafc40c53ed4406ee7cd148e3e6995a2eb4185e`. Le sous-lot 4A est conservé. Le sous-lot 4C, `facet_example`, reste le prochain travail de ce fil.

**État intermédiaire : transfert et première contribution en jeu vérifiés ; intégration des publications concurrentes, validation finale, coût officiel et publication 4B en attente.** Le premier gel de développement est `852d5ff7cdaa15534d22fcd610043cd348bb8aa241e290ae67d75adcaeaf8f9f` : 276 fichiers natifs et 287 fichiers d'archive. Son identifiant de runtime hérité `0.51.0` n'en fait pas la version 0.51 publiée. Les preuves ci-dessous nomment donc leur gel et leur portée.

## Source, comportement et propriété

La référence demeure `786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`. Les trois modules propres de `morphology_policy/relative_arrangements` — `family.py`, `geometry.py`, `planner.py` — sont transférés dans trois modules TypeScript. La [filiation](lot4b-relative-arrangements-lineage.md) décrit aussi la stratégie et l'appelant commun originaux. Les infrastructures V5 consommées sont déjà prises en charge par les composants compatibles ; aucune nouvelle règle spécialisée V5 de jeu n'est introduite.

Le workflow compilé existant **`v6.relative_arrangements.choose`** exécute ses callbacks `arrangement.measure`, `arrangement.compose`, `arrangement.bind`. Le moteur mesure le plateau, ses participants, le modèle relatif visible et les actionneurs. Il choisit une expérience locale sous hypothèses explicites. Un effet attribuable exige le déplacement d'un seul participant sélectionné et celui d'un seul marqueur d'actionneur, avec préservation des autres participants. Une ressemblance avec la cible reste une hypothèse jusqu'à la frontière officielle.

| Contrat | Raccordement et effet |
| --- | --- |
| Domaine non reconnu | Les sous-questions suivantes et le repli de symétrie restent disponibles. |
| Arrangement courant reconnu, aucune expérience admissible | Arrêt du reste de `window_constraints`, symétrie comprise. Les autres groupes de stratégie continuent. |
| Proposition sélectionnée | Commande, point, observation initiale, époque, image et palette sont liés ; les gardes et WHY/ACT précèdent l'action. |
| Retour mesuré | Acquisition par le seul propriétaire `relative_arrangements`, conservation de l'événement et du miroir source `relative_arrangement_state`, puis restauration commune. |
| Retour d'une autre famille | Aucun appel passif à `RelativeArrangements`. Le contrat passif de Feedback reste propre à Feedback. |
| Changement d'époque | La mesure remet `models`, `failed` et `selection_ref` à zéro ; le journal `events` reste conservé. |
| Modèle acquis | Usage conditionnel pour le même actionneur, la même sélection et la même valeur de participant ; un gain contradictoire ferme les offres de cet actionneur. |

L'état durable possède les cinq champs source : **`models`, `events`, `failed`, `selection_ref`, `epoch`**. La projection et les diagnostics courants sont transitoires. Seul l'ordre de transport de `failed`, ensemble non ordonné en Python, est rendu déterministe ; les ordres de parcours, permutations, cibles, options et rangs restent stricts.

L'arrêt local est attesté par l'observation, l'époque et le hash d'image courants. Les deux préférences natives capables de rechercher un fournisseur plus tardif vérifient cette barrière avant sa proposition et son admission. La continuation acquise consulte d’abord son témoin conservé et sa corroboration Kernel ; cette lecture ne donne aucune autorité à une proposition bloquée. Ces raccordements préservent la portée source de l'arrêt au sein d'un runtime qui possède déjà des extensions de coordination ; ils ne constituent pas une revendication de parité complète du routeur Python.

## Trace publique lisible

Dans le deuxième niveau de la [campagne TRIA](lot4b-evidence/development/tria-live-01/tria-campaign.json.gz.parts.json), les deux participants aux positions de grille `(12,9)` et `(12,11)` sont déjà à préserver. Le participant sélectionné est en `(13,6)` et la cible relative courante demande `(13,10)`.

| Étape réellement observée | Hypothèse ou expérience | Retour et conséquence |
| --- | --- | --- |
| Proposition, appel 40 | Déplacer d'un cran vertical le marqueur d'un actionneur encore non mesuré pour cette sélection. L'hypothèse initiale prédit `(13,7)`. | La proposition conserve les alternatives : absence d'effet, sens opposé, autre gain, effet couplé ou transition de bord. |
| Acquisition, appel 43 | Le marqueur passe de `(1,1)` à `(1,2)`. | Le participant passe de `(13,6)` à `(13,1)`, soit **−5 cases**. Les deux autres restent inchangés. Le modèle conditionnel conserve le sens et le gain observés, avec les références du retour. |
| Décision suivante, appel 44 | Avec ce modèle restauré, déplacer le marqueur de `(1,2)` à `(1,0)`. | La prédiction devient `(13,11)` : deux crans en sens inverse du gain observé. L'offre cite le retour précédent et n'utilise plus l'hypothèse de gain unitaire pour cet axe. |
| Acquisition, appel 47 | Le mouvement choisi est exécuté après liaison et garde. | Le participant arrive bien en `(13,11)`, soit **+10 cases**, et les deux autres sont encore préservés. |
| Proposition puis frontière | Un autre actionneur déjà mesuré propose le dernier déplacement de `(13,11)` à `(13,10)`. | Le retour suivant augmente officiellement le nombre de niveaux terminés. La conformité visuelle seule n'avait pas été comptée comme un succès. |

Ces coordonnées décrivent la preuve publique, pas des constantes utilisées par le moteur. Les nouveaux modules de production ne sélectionnent aucune règle par identifiant de jeu, numéro de niveau, palette fixe ou solution enregistrée.

## Preuves de composant et d'appelant

Le [générateur](../../scripts/export-v6-relative-arrangements-reference.py) exécute les originaux inchangés et leur observateur sur des interfaces publiques synthétiques. La fixture comprend 16 interfaces initiales, 28 cas de planification, cinq sessions et neuf variantes d'acquisition. Les **81 tests différentiels** passent : propositions complètes, reçu SRC à quatre champs source, mesures, options ordonnées, gardes, événements, état et décisions après restauration.

Les cas couvrent les palettes et translations, les gains fractionnaires, négatifs, nuls ou contradictoires, les collisions, les supports non uniques, l'absence d'action accessible, les retours multi-participants ou multi-actionneurs, les époques, les limites d'assignation et les essais refusés. Les assertions du générateur empêchent qu'un scénario annoncé positif ou refusé soit en réalité vide. Le premier lancement a échoué sur une faute de syntaxe du générateur avant import ; son journal et ses octets sont conservés dans `development/relative-oracle-01*`. Le second produit la fixture vérifiée. Les **1 786 fichiers originaux du manifeste** sont identiques avant et après ; les caches Python préexistants restent identifiés séparément et n'ont pas été modifiés.

Le [test d'intégration](../../tests/v6-relative-arrangements-integration.test.ts) possède **12 cas vérifiés**. Les sessions de lifecycle emploient une variante déclarée de configuration qui isole l'entrée, avec les vrais fournisseurs, mémoire, propositions, gardes et WHY/ACT. La factory complète et son ordre sont contrôlés séparément. Les retours `unit` et `opposite` acquièrent des modèles différents et produisent des commandes suivantes différentes après restauration depuis le graphe.

Les barrières ordinaires couvrent l'arrangement déjà conforme, `ACTION6` absente et l'interface non reconnue. Les deux parcours de préférence natifs sont également exercés. Pour la continuation acquise, une famille de contrat synthétique reçoit réellement un retour public de frontière dans le caller : le test vérifie ses `prefix_evidence` et `transition_evidence`, puis observe la vraie corroboration Kernel. Il ne fabrique pas un succès en écrivant directement dans la mémoire. La reconnaissance relative sans offre interdit encore le fournisseur tardif ; le cas non reconnu le laisse passer. Cette preuve synthétique de routage ne se substitue pas à la campagne en jeu.

Après intégration de 7A effectivement publié, les quatre fichiers hérités ciblant les deux aides de préférence, la préparation acquise et la portée des refus passent **120/120 tests** sur le gel intermédiaire `31850e3a…`. La seule liste exhaustive d’enregistrement devenue périmée a été actualisée ; les commandes, appels réellement visités, gardes et assertions de comportement restent conservés. Le [reçu](lot4b-evidence/development/priority-regression-01/validation/delta-tests-run.json) atteste l’intégrité des sources et des tests pendant cette vérification. Il ne remplace pas le périmètre final après 5A.

## Contribution en jeu et limites du cas

La première campagne froide **TRIA réussit trois niveaux en 17 actions et 17 préfixes**. Une seule session atteint naturellement le niveau 4, sans saut de niveau ni commande manuelle. Les 17 actions sont sélectionnées par `relative_arrangements`. Le journal conserve **68 appels** : 17 propositions, 17 gardes avant, 17 gardes après et 17 acquisitions. Les retours comprennent **5 sélections observées, 9 déplacements attribuables et 3 frontières officielles**.

La référence effectivement publiée **Site 81 / native 0.51** atteint la borne externe préannoncée de **8 actions sans niveau terminé**. Les sept préfixes déjà scellés appartiennent à ObservedFrontier, RegularFieldCorrespondence et InformationGoal ; le huitième retour acquis est dans le journal, conformément au contrat du harnais borné. Ce résultat est conservé comme référence finie, sans verdict d'impossibilité générale.

Les deux essais et leur analyse partagent l'[horloge TRIA](lot4b-evidence/tria-case-selection.json) de 2 400 secondes. Aucun budget n'est réinitialisé. Les futurs rejeux enregistrés de livraison seront distingués d'une nouvelle tentative live.

Le [rejeu froid de la famille Python originale](lot4b-evidence/development/tria-live-01/tria-relative-arrangement-source-parity-02.json.gz) passe **68/68 appels, 34 gardes, 17 états de préfixe et 17 restaurations**, avec zéro différence. Il reconstruit 18 observations publiques et conserve 16 choix suivants ; le dernier retour est terminal. Les états et plans natifs sont des comparands, jamais une amorce de l'oracle. Les 1 786 originaux restent inchangés avant et après.

Les **51 ablations** restent toutes dans le rapport : **deux interventions changent l'action au même appel 44**, quatre ne changent que les autres données de la proposition et 45 la laissent entièrement inchangée. Retirer `models` ou effacer `selection_ref` remplace la commande observée `(35,49)` par `(17,57)`. Il s'agit d'une seule décision distincte sensible à deux aspects de la mémoire ; aucune ablation de campagne entière n'est revendiquée. **`failed` est vide aux 17 choix** : l'influence des essais refusés est prouvée par les cas synthétiques, pas par ce trajet live.

Le [premier rapport de comparaison](lot4b-evidence/development/tria-live-01/tria-relative-arrangement-source-parity-01.json.gz) reste en échec : ses 68 différences portent exclusivement sur `composition_target_tree`, annotation ajoutée par l'appelant après la proposition de famille. Le second comparateur en délimite explicitement la portée, vérifie sa liaison au contexte et conserve son contenu intégral. Les annotations de premier niveau `field_subquestion`, `strategy_receipt` et `morphology` sont également identifiées. Aucun champ du plan d'arrangement ni reçu SRC n'est retiré, aucune normalisation récursive n'est appliquée. Les nombres JSON sont comparés par leur valeur, sans assimiler booléens et entiers. Ce contrôle de famille ne prouve pas la parité de l'appelant Python entier.

La [résolution du cas](lot4b-evidence/tria-case-resolution.json) clôt cette première période à **374,140910 secondes cumulées**, sans remise à zéro, avec les deux tentatives et les deux comparaisons conservées.

## Validation finale, coût et publication

En attente du candidat intégrant les précédents effectivement publiés. Le protocole prévu conserve les mêmes travaux publics STCK/SMLP, une référence fraîche, l'ordre A1/B1/B2/A2 et une fenêtre exclusive. La règle autorisée est : **pour chaque jeu, l'augmentation de la médiane groupée de session complète doit rester strictement inférieure à 10 %**. Les dépassements de phases et de percentiles restent visibles ; ils ne deviennent pas un veto séparé lorsque ce critère global est satisfait.

L'ajout d'un propriétaire change les métadonnées structurelles du graphe. Toute qualification de comparabilité sera déclarée et établie sur les graphes fonctionnels gelés avant mesure, avec les données brutes, les refus stricts et le coût du propriétaire conservés. Aucun résultat de performance ni de déploiement 4B n'est encore annoncé dans cette version intermédiaire du rapport.

## Limites et suite

Les gains restent locaux : une nouvelle sélection, un autre axe, un bord ou une saturation peuvent les invalider. Un effet mesuré n'établit pas une loi universelle ni une garantie de retour. Plus de six participants d'une même valeur, ou un produit d'assignations dépassant 1 024 pour une cible, produit le refus global prévu par la source ; aucune solution d'une recherche partielle n'est publiée. Les autres éléments sont préservés selon les observations effectivement comparées.

Le premier gel de développement atteint **56/76 entrées**, dont **21/21 dans la liste fenêtre**. Après intégration effective de 7A / Site 83, le compteur intermédiaire est **57/76** ; 28 tests de coexistence et le typage passent sur le gel `31850e3a…`. Le compteur de livraison sera recalculé après intégration de la publication 5A. Les trois modules propres ajoutent trois `component_verified`, sans aucun module déclaré entièrement vérifié et sans fermer les portes de migration complète.

La suite concrète de ce fil reste **4C, `facet_example`** : correspondance visible, expérience sélectionnée, acquisition d'une méthode conditionnelle, réfutation après retour et revalidation des branches portables/composées. Le refus officiel d'une composition visuellement conforme devra rester acquis. Ce travail n'est pas implémenté dans 4B.

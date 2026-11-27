# Chantier SIC sur les stratégies composables

Le but est de traiter le raisonnement symbolique comme un ensemble d’articulations que l’on peut entraîner. Devant une situation inconnue, SIC doit pouvoir reconnaître un besoin, lier les rôles aux objets observés, composer des effets appris et réviser cette composition quand un retour la contredit. La première démonstration visée est le transfert d’une même composition de raisonnement entre plusieurs mécaniques. [Vision du projet](../../AGENTS.md#vision-du-projet)

## Comment l’agenda déclenche une stratégie aujourd’hui

La référence de départ est `4313d7ce`. Le déclenchement comporte trois décisions distinctes.

1. **Choisir où chercher une offre.** Quand le moteur lance une planification, il restaure les acquis et consulte des groupes ordonnés de familles. En mode SIC, il consulte ces groupes à la demande et s’arrête sur la première offre qui tranche. Un refus bloquant peut aussi arrêter cette recherche. Si le programme SRC de sélection a été édité, le moteur exécute ce programme. [Agenda des familles](../../src/sic/family-agenda.ts#L21) · [Sélection native](../../src/logos-engine/v6-native-runtime.ts#L978)
2. **Établir qu’une offre est applicable.** La famille interprète la situation et peut utiliser un graphe local. Celui-ci évalue chaque condition sur des faits reliés à des preuves. Un fait absent reste indéterminé. Le premier candidat applicable qui produit un plan est retenu. Quand un candidat applicable ne peut produire aucun plan, le graphe poursuit. L’évaluation locale en mode `shadow` examine les conditions sans lancer les planificateurs. [Graphe de stratégies](../../src/sic/strategy-agenda.ts#L66)
3. **Autoriser et contrôler la commande.** Le moteur vérifie le budget, la disponibilité publique de la commande et la garde de la famille. Il confronte ensuite le retour à ce que le plan exige. Un pas déjà justifié peut se poursuivre dans la série. Une contradiction, une limite ou un changement de niveau clôt la série et rend la main au raisonnement. [Autorisation native](../../src/logos-engine/v6-native-runtime.ts#L1523) · [Contrat de continuité](../../AGENTS.md#actions-continues-de-sic)

P05 illustre la répartition actuelle. Une famille a déjà construit une offre d’essai portant sur une commande unique. Le graphe vérifie que le sujet est lié à l’observation courante, que l’objectif dépend de l’effet, que la commande est disponible et que son effet reste inconnu et non testé dans ce contexte. Le témoin P05 se rattache à cette commande et à cette observation. Le graphe définit également la réidentification du sujet, la revalidation d’un effet et la recherche d’accès. À ce point d’appel, la famille fournit uniquement l’offre d’essai P05. L’agenda peut donc déjà expliquer une décision locale. La composition doit élargir l’ensemble des offres réellement disponibles. [Témoin P05](../../src/sic/missing-control-strategy.ts#L44) · [Graphe du besoin de contrôle](../../src/sic/control-effect-next.ts#L15)

## Construction et ordre exact du registre SIC

L’ordre actuel résulte de choix successifs dans le code. Le premier registre SIC autonome, au commit `d8e78990`, contenait trois familles pour réparer un état, gérer un contact ordonné et transférer des objets entre appuis. Le commit `6c33e3f5` les a regroupées avec d’autres familles en six catégories ordonnées, autour de la réparation, des relations, du mouvement, des exemples, des acquis et de l’exploration. C’est le début de la liste actuelle. [Premier registre autonome](https://github.com/yannick-fontan-1981/sra-playground/blob/d8e7899044689b5b57479d6a4e2ca9a8985ace74/src/sic/standalone-families.ts) · [Première liste de groupes](https://github.com/yannick-fontan-1981/sra-playground/blob/6c33e3f55412fc88d4686b97571ecca2e95cda99/src/sic/standalone-families.ts#L19)

Plusieurs priorités répondent à des cas observés. La récupération liée à la pression a été ajoutée en travaillant sur un franchissement qui dépend d’un appui. Des changements ultérieurs ont placé la poursuite d’une réception et la reprise d’un transport entre panneaux avant des essais indépendants. Ces commits expliquent des choix locaux. L’ordre relatif de deux groupes reste à justifier quand ils peuvent répondre au même besoin avec des offres concurrentes. [Franchissement sur appui](https://github.com/yannick-fontan-1981/sra-playground/commit/6d549f695a7cce576a1611ba12b77c91b7869dd4) · [Poursuite de la réception](https://github.com/yannick-fontan-1981/sra-playground/commit/9aa3f68d2fef5313830ee54a1cef517261d78896) · [Reprise du transport entre panneaux](https://github.com/yannick-fontan-1981/sra-playground/commit/dcbf1bfab24bc9efac6c8dac13004659dcf43732)

Ordre calculé pour le mode **SIC** à la révision `4313d7ce` avec les réglages de référence.

| Rang | Groupe | Rôle dans la recherche d’une offre |
| ---: | --- | --- |
| 1 | `continue_observed_pressure_recovery` | Poursuivre des démarches appuyées par un retour, notamment les récupérations liées à la pression. |
| 2 | `reuse_observed_mechanics` | Réutiliser une mécanique reconnue. |
| 3 | `repair_visible_field` | Corriger ou rétablir une configuration visible. |
| 4 | `inspect_candidate_relations` | Examiner des relations possibles entre objets ou effets. |
| 5 | `coordinate_visible_motion` | Coordonner des déplacements et leurs effets. |
| 6 | `interpret_examples_and_collections` | Interpréter des exemples, des séries ou des collections. |
| 7 | `apply_learned_relations` | Appliquer les relations apprises au contexte courant. |
| 8 | `construct_executable_program` | Construire une séquence de commandes exécutable. |
| 9 | `fit_profiles_into_receivers` | Faire correspondre des profils et leurs récepteurs. |
| 10 | `preserve_ordered_team` | Préserver l’ordre d’un ensemble d’acteurs. |
| 11 | `fill_visible_partition` | Compléter une partition visible. |
| 12 | `follow_symbol_diagram` | Exploiter les relations indiquées par des symboles. |
| 13 | `visit_marked_surface` | Parcourir une surface marquée. |
| 14 | `place_incoming_groups` | Placer des groupes qui arrivent successivement. |
| 15 | `test_projected_public_effect` | Tester un effet projeté à partir des observations publiques. |
| 16 | `explore_available_inputs` | Explorer les commandes disponibles. |

Plusieurs groupes peuvent appeler la même famille par des points d’entrée différents. Le groupe 1 consulte notamment `sic_public_input_exploration` en deuxième position, après `sic_observed_actor_composition`. Le rang 16 est celui du groupe d’exploration générale. [Registre des groupes et familles](../../src/sic/standalone-families.ts#L120) · [Construction de la liste exécutée](../../src/sic/experiment-selection-groups.ts#L15)

### Ce qui peut changer l’ordre ou l’offre retenue

- **Le registre et son constructeur.** Ajouter, déplacer ou spécialiser une entrée modifie l’ordre de consultation. Le constructeur insère le groupe 15 juste avant l’exploration générale. En **SIC Fallback**, il le place en tête et le moteur le saute jusqu’au retrait de la famille principale. Certaines préférences d’information actives ajoutent aussi un fournisseur en tête de ce groupe. [Insertion et ordre interne](../../src/sic/experiment-selection-groups.ts#L15) · [Configuration SIC et fallback](../../src/logos-engine/v6-native-runtime.ts#L2907) · [Garde du groupe](../../src/logos-engine/v6-native-runtime.ts#L861)
- **Le retour courant et les gardes.** Un même rang peut produire une offre, une abstention ou un refus bloquant. Un arrêt local ferme le groupe et laisse les suivants être consultés. Des règles natives ciblées peuvent aussi faire passer une offre avant une autre à l’intérieur de la sélection. [Refus et coordination](../../src/logos-engine/v6-native-runtime.ts#L905)
- **Le programme SRC de sélection.** Sa version éditée prend la main sur l’agenda actif et détermine la consultation des offres disponibles. La priorité configurable de récupération de contact règle, quant à elle, un graphe local. [Sélection SRC](../../src/logos-engine/v6-native-runtime.ts#L978) · [Priorité locale de récupération](../../src/logos-engine/v6-rooted-line-access.ts#L115)

## Ce que signifie rendre une stratégie composable

Une articulation est le raccord entre un résultat prouvé et la prochaine décision qu’il rend possible. Par exemple, un essai établit qu’une commande déplace le sujet lié à l’objectif. Le planificateur peut alors chercher un accès avec cet effet. Si le retour déplace un autre objet, le besoin devient de départager les rôles. Une même articulation doit pouvoir changer de sujet, de commande, de repère et de contexte à chaque réutilisation.

| Partie du raisonnement | Ce que le contrat doit exposer |
| --- | --- |
| Besoin | Un objectif parent, une condition à établir et les acquis qui doivent tenir. |
| Situation | Des rôles liés aux observations, des commandes disponibles, des effets attestés et des incertitudes explicites. |
| Effet | Des préconditions, une transition, des propriétés à préserver pendant l’action, des conséquences à vérifier et la portée des preuves. |
| Offre | Un essai, un plan, un sous-objectif ou une abstention motivée, avec un coût et une condition de reprise. |
| Retour | Une confirmation, une contradiction ou une observation insuffisante, avec les faits à retenir, à réviser ou à remettre en question. |

Une famille de mécanique peut encore fournir un détecteur de contact, une projection de glissement ou une mesure de phase. Le reste devient réutilisable dès lors que ces fournisseurs s’expriment par les mêmes rôles et les mêmes obligations. Ainsi, « amener une charge sur un appui » et « maintenir une porte pendant le passage d’un acteur » peuvent se composer dès que la première opération établit la condition requise par la seconde. Une ouverture au relâchement, une fenêtre qui expire ou un échange de places change les effets disponibles et leur enchaînement. L’agenda reçoit alors une autre composition à partir de la situation observée.

Dans AS66, le fournisseur mesure le déplacement d’un corps qui glisse vers une cavité. Dans G50T, il mesure le déplacement du sujet après une commande. La composition visée est la même. Si l’effet manque, SIC propose un essai. Si l’effet est déjà attesté dans un contexte compatible, SIC peut chercher directement l’accès. Si un autre objet réagit, la question du rôle du sujet redevient prioritaire. Cette variation du prochain choix est ce que la stratégie doit apprendre à gérer. [Cas de contrôle manquant dans AS66 et G50T](sic-v8-sous-strategies.md#ordre-de-migration)

Un cas où deux mécanismes ont le même retour public oblige à garder plusieurs hypothèses jusqu’à un essai discriminant. La stratégie d’exploration doit savoir choisir cet essai ou expliquer pourquoi les commandes actuelles ne permettent pas de trancher. Ce comportement fait partie de l’adaptation, au même titre que trouver un plan.

## Une boucle réutilisable à chaque sous-objectif

L’objectif « traverser le passage » peut demander « maintenir une ouverture », qui peut à son tour demander « établir quelle charge commande l’ouverture ». Chaque niveau de cette recherche réutilise la même boucle et rend un résultat interprétable au parent.

~~~mermaid
flowchart TD
    A["Assimiler les faits et les preuves"] --> B{"Les effets sont-ils établis pour ce besoin ?"}
    B -->|Preuve manquante| C["Explorer par un essai discriminant"]
    B -->|Effets applicables| D["Planifier en composant les effets"]
    D -->|Condition préalable ouverte| E["Ouvrir un sous-objectif avec un budget"]
    E --> A
    D -->|Préfixe justifié| F["Exécuter et vérifier le retour"]
    C --> A
    F --> G{"Retour interprété"}
    G -->|Besoin satisfait| H["Rendre le résultat à l’objectif parent"]
    G -->|Besoin encore ouvert ou contradiction| A
~~~

## L’arbre fixe le besoin et borne la concurrence

L’arbre représente les **obligations du raisonnement**. La racine porte l’objectif. Un nœud ouvre un enfant lorsqu’il lui manque une condition, une preuve ou une information précise. Le choix se fait sur le besoin ouvert le plus pertinent pour la branche engagée. Chaque enfant reçoit la portée des preuves, les acquis à préserver et une part du budget. Il rend un résultat, une contradiction ou un motif d’abstention au parent. Cette organisation reprend l’idée de l’arbre de référence qui rattache une continuation à un objectif parent ou à une question d’information nommée. [Arbre de raisonnement de référence](../../reference/sra/212d8d426f07/docs/reasoning-tree/reasoning-tree_v-1.5.txt#L74)

- **Obligations conjointes.** Traverser exige un accès et une ouverture valable pendant le passage. Si l’ouverture dépend d’une charge, placer cette charge devient un sous-objectif avec une preuve attendue.
- **Voies alternatives.** Une charge, un relais entre acteurs et un autre accès peuvent parfois établir le même besoin. Ils sont candidats **dans ce nœud**, à condition que les faits justifient au moins leur examen.
- **Branche engagée.** Une suite déjà justifiée conserve la main tant que ses conditions tiennent. Un retour contraire rouvre le premier besoin affecté. Les autres branches restent disponibles avec leurs conditions de reprise.

L’agenda sélectionne les fournisseurs par l’effet qu’ils peuvent établir ou par la question qu’ils peuvent départager. Il filtre leurs offres sur les faits disponibles, leur portée, le budget et les obligations de préservation. Puis il compare un ensemble borné d’offres admissibles avant d’appeler les planificateurs coûteux. Les retours produisent des preuves réutilisables par le parent et par d’autres branches quand leur portée le permet. Les réentrées tiennent compte des preuves, des ressources et des phases qui changent les possibilités.

## Les modes orientent le choix au nœud actif

À la révision de référence, le moteur SIC calcule déjà un mode. Il choisit l’assimilation à l’entrée du niveau, l’exploration après une contradiction, la résolution après un retour confirmé, puis l’assimilation si une information peut être revalidée, et l’exploration sinon. Les cartes de réordonnancement nomment cinq groupes présents dans le chemin V6, dont `information_goal` et `view`. Leur intersection avec les 16 groupes SIC est vide. Le calcul des quatre cartes, y compris l’exploration avec peu de budget, reproduit donc l’ordre SIC de la table. Le mode est aussi transmis aux familles, qui peuvent l’utiliser dans leurs choix locaux. [Choix du mode et cartes](../../src/sic/reasoning-mode.ts#L14) · [Transmission au moteur SIC](../../src/logos-engine/v6-native-runtime.ts#L808) · [Exemple de choix local](../../src/sic/learn-grid-access.ts#L180)

Dans le chantier cible, le mode qualifie **le travail à faire sur le besoin actif**. Le parent peut rester en résolution pendant qu’un enfant explore la condition qui lui manque.

| Mode | Situation du nœud | Offre à privilégier |
| --- | --- | --- |
| Assimilation | Le rôle doit être lié à l’observation ou un effet acquis doit être revalidé. | Mesure, réidentification ou revalidation à coût réduit. |
| Exploration | Une incertitude empêche de départager des voies ou un retour contredit la projection. | Essai discriminant, borné par les acquis à protéger. |
| Résolution | Des effets attestés permettent d’avancer vers le résultat attendu. | Composition d’effets, exécution du préfixe justifié et vérification du retour. |

Les modes changent la préférence **entre offres admissibles**. Les gardes de preuve, les obligations de préservation et l’autorisation du moteur restent des conditions d’exécution.

## Remplacer progressivement la priorité fixe

1. **Documenter un seul besoin et les offres existantes.** Commencer par établir l’effet d’une commande nécessaire à l’accès. Déclarer ce que chaque fournisseur peut établir, les faits qu’il exige, son coût et les raisons d’abstention.
2. **Comparer les deux sélections sur ce besoin.** Conserver la décision native comme référence. Calculer en parallèle les gardes et le classement du nouvel agenda à partir des mêmes observations, sans exécuter les offres candidates. Relever ce qui a été considéré, ce qui a été écarté et la première raison d’un écart.
3. **Activer le classement local uniquement pour le besoin qualifié.** Garder la priorité historique comme départage en cas d’égalité. Vérifier l’ordre d’exécution, les refus, les preuves conservées et les retours sur les parcours protégés. Une nouvelle préférence doit avoir une divergence attendue et un témoin de transfert.
4. **Ouvrir la composition récursive après cette parité.** Autoriser un fournisseur à demander un sous-objectif typé. Étendre la sélection à un second besoin quand on peut montrer qu’un retour de l’enfant débloque correctement le parent et que les autres offres restent hors du périmètre de concurrence. Répéter ce portage par besoin.

## Chantiers d’implémentation

1. **Porter le banc de transfert sur une branche issue de `main`.** Exécuter une référence et un candidat sur les mêmes cas. Enregistrer le premier écart de décision avec son observation, son besoin, les offres réelles, la preuve et le retour. Rendre la campagne reproductible et reprenable. Le premier jalon est une comparaison de la référence contre elle-même, sans écart sur les résultats et les décisions protégées.
2. **Extraire une première articulation de raisonnement.** Partir de « mesurer un contrôle → chercher un accès » en reprenant le contrat P05. Vérifier sur AS66 et G50T que les candidats, refus, preuves, commandes et retours restent équivalents. Éprouver la réutilisation sur une troisième mécanique tenue hors de la mise au point. Une contradiction doit rouvrir la question précise de l’effet ou du rôle.
3. **Composer un premier parcours d’effets.** Porter le contrat du pilote pour *préparer un passage → préserver l’ouverture → transférer un acteur ou une charge*. Figer les cas où la charge reste requise, où la fenêtre expire et où le déplacement réalisé diffère de celui prédit. Utiliser le contrôle natif des retours pour autoriser chaque pas.
4. **Entraîner les variantes par contre-exemples.** Lors d’un échec, réduire le scénario au plus petit témoin causal et localiser ce qui manque. Compléter d’abord un fait, une garde, un mode d’essai ou une composition. Ajouter une stratégie si la décision requise ne s’exprime pas avec les briques disponibles. Figer la proposition avant de l’évaluer sur les mécaniques réservées.
5. **Étendre la couverture par composition.** Générer des mécanismes, les imbriquer jusqu’à une profondeur annoncée et varier la géométrie, les commandes, les délais, la visibilité et les rôles. Mesurer la couverture des combinaisons de mécanismes, des ambiguïtés et des motifs d’abstention. Chaque combinaison qui révèle un nouveau mode d’échec devient une famille de cas à explorer et à minimiser. Les rejeux dans les moteurs réels servent de contrôle indépendant des scénarios simulés.

## Critères de passage

- **Extraction à comportement équivalent.** Comparer les décisions une à une, les commandes et leurs paramètres, les retours publics, les acquis transmis et les motifs de reprise ou d’arrêt. La moindre divergence inexpliquée bloque l’activation. Le candidat commence par une comparaison sans exécution ni écriture dans la mémoire de la référence.
- **Amélioration ciblée.** Déclarer au préalable le premier écart attendu et le résultat qu’il doit améliorer. Pour les parcours protégés, contrôler aussi les séries effectivement exécutées, leur clôture native et les acquis physiques. Exécuter la qualification de continuité SIC avant intégration. [Contrat de qualification continue](../../AGENTS.md#actions-continues-de-sic)
- **Transfert.** Exiger un cas issu d’un moteur réel et au moins deux scénarios de transfert distincts. Inclure un cas ambigu et un cas contradictoire. Identifier les preuves qui légitiment la réutilisation dans chaque scénario. [Contrat de transfert des rôles](../../AGENTS.md#généricité-et-transfert-des-rôles-sic)

## Place du pilote et premier jalon

`codex/sic-transfer-pilot` à `145b8c76` sert de référence expérimentale. Il fournit un contrat d’effets, des campagnes appariées persistantes et des partitions réservées pour les rejeux. Son résultat synthétique porte sur la comparaison avec sa référence gloutonne. L’évaluation de production doit être refaite contre le `main` retenu, qui a poursuivi l’intégration de règles et la qualification des séries natives. Le portage se fait par lots pour attribuer chaque écart au bon changement. [Protocole du pilote à sa révision de référence](https://github.com/yannick-fontan-1981/sra-playground/blob/145b8c764477fe913709e999747a0f8db125d060/docs/architecture/sic-strategy-transfer-pilot.md)

Le **premier livrable** est le banc de comparaison sur une branche issue de `main`, avec la référence figée, un lot réservé et une fiche de première divergence exploitable. Le premier lot moteur aura alors un contrat de décision à comparer, un parcours réel à protéger et une mécanique tenue en réserve pour mesurer le transfert.

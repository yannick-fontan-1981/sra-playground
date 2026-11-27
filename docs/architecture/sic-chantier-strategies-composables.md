# Chantier SIC sur les stratégies composables

Le but est de traiter le raisonnement symbolique comme un ensemble d’articulations que l’on peut entraîner. Devant une situation inconnue, SIC doit pouvoir reconnaître un besoin, lier les rôles aux objets observés, composer des effets appris et réviser cette composition quand un retour la contredit. La première démonstration visée est le transfert d’une même composition de raisonnement entre plusieurs mécaniques. [Vision du projet](../../AGENTS.md#vision-du-projet)

## Comment l’agenda déclenche une stratégie aujourd’hui

La référence de départ est `4313d7ce`. Le déclenchement comporte trois décisions distinctes.

1. **Choisir où chercher une offre.** Quand le moteur lance une planification, il restaure les acquis et consulte des groupes ordonnés de familles. Dans le navigateur, l’agenda actif est le chemin par défaut. Il consulte les groupes à la demande et s’arrête sur la première offre qui tranche. Un refus bloquant peut aussi arrêter cette recherche. Si le programme SRC de sélection a été édité, le moteur exécute ce programme. Lorsqu’un mode de raisonnement est établi, il peut faire varier l’ordre de consultation. [Agenda des familles](../../src/sic/family-agenda.ts#L21) · [Sélection native](../../src/logos-engine/v6-native-runtime.ts#L978)
2. **Établir qu’une offre est applicable.** La famille interprète la situation et peut utiliser un graphe local. Celui-ci évalue chaque condition sur des faits reliés à des preuves. Un fait absent reste indéterminé. Le premier candidat applicable qui produit un plan est retenu. Quand un candidat applicable ne peut produire aucun plan, le graphe poursuit. L’évaluation locale en mode `shadow` examine les conditions sans lancer les planificateurs. [Graphe de stratégies](../../src/sic/strategy-agenda.ts#L66)
3. **Autoriser et contrôler la commande.** Le moteur vérifie le budget, la disponibilité publique de la commande et la garde de la famille. Il confronte ensuite le retour à ce que le plan exige. Un pas déjà justifié peut se poursuivre dans la série. Une contradiction, une limite ou un changement de niveau clôt la série et rend la main au raisonnement. [Autorisation native](../../src/logos-engine/v6-native-runtime.ts#L1523) · [Contrat de continuité](../../AGENTS.md#actions-continues-de-sic)

P05 illustre la répartition actuelle. Une famille a déjà construit une offre d’essai portant sur une commande unique. Le graphe vérifie que le sujet est lié à l’observation courante, que l’objectif dépend de l’effet, que la commande est disponible et que son effet reste inconnu et non testé dans ce contexte. Le témoin P05 se rattache à cette commande et à cette observation. Le graphe définit également la réidentification du sujet, la revalidation d’un effet et la recherche d’accès. À ce point d’appel, la famille fournit uniquement l’offre d’essai P05. L’agenda peut donc déjà expliquer une décision locale. La composition doit élargir l’ensemble des offres réellement disponibles. [Témoin P05](../../src/sic/missing-control-strategy.ts#L44) · [Graphe du besoin de contrôle](../../src/sic/control-effect-next.ts#L15)

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

L’agenda cible doit pouvoir choisir entre les offres produites pour un même besoin. Les premiers critères à rendre explicites sont l’admissibilité, la protection des acquis, la contribution à l’objectif, la valeur de l’information et le coût. La récursion s’arrête au résultat, à une abstention motivée ou à une borne de recherche. Les réentrées dans une même situation doivent tenir compte des preuves acquises, des ressources et des phases qui changent les possibilités. [Modes de raisonnement actuels](../../src/sic/reasoning-mode.ts#L1)

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

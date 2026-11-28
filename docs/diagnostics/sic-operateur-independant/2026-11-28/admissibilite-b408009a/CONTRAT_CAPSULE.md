# Contrat public de remise de capsule SIC

Ce document explicite les conditions déjà scellées de **SIC-OP-20261128-01** et l’interface de son superviseur. Il ne délivre aucune autorisation d’exécution et ne modifie aucun critère. Le code, les scènes, les graines, les solutions et les vérificateurs privés restent côté opérateur.

Sources d’autorité : [protocole public initial](../PROTOCOLE.md) et empreintes des composants de l’opérateur dans [SCELLEMENT.json](../SCELLEMENT.json). Le [verdict b408009a](VERDICT.md) distingue la présence d’un contrat, son implémentation et sa qualification effective.

## 1. Identité et contenu admis

Une remise doit lier le SHA Git complet, l’arbre, la configuration stricte `solver: sic`, le point d’entrée réel, les dépendances, l’adaptateur et l’instrumentation. La référence moteur reste `20433007224accc36e3d7976696d9ee7a783a227` ; l’instrumentation approuvée n’est pas un changement silencieux de politique de cette référence.

La capsule est produite à partir des **blobs Git exacts** du SHA déclaré. Son `capsule-manifest.json` utilise le schéma `sic.operator.runtime-capsule.v1`, indique `sourceSha`, les indicateurs `gameAssetsIncluded: false`, `reservedCorpusIncluded: false`, `oracleIncluded: false` et une table exhaustive `files` des chemins et SHA-256. Le superviseur vérifie la liste exacte et ses empreintes avant et après l’exécution.

Le sous-ensemble autorisé comprend les sources de production nécessaires de `src/logos-engine` et `src/sic`, les interfaces runtime approuvées, les déclarations approuvées du pack, le fichier de paquet et le pont public. L’adaptateur du superviseur est fourni et empreinté séparément. Les fichiers supplémentaires, liens symboliques, fichiers spéciaux, métadonnées `.git`, corpus, moteurs des jeux, oracles et solutions sont exclus. L’image du runtime est fixée par `@sha256`, avec ses dépendances vérifiées.

Le test utilisant une politique injectée dans une famille V6 dédiée n’est pas le point d’entrée du pack strict. La remise doit établir le branchement réel de la capacité candidate au moteur qui sera comparé.

## 2. Frontière des observations et des commandes

Le processus SIC ne reçoit que l’objectif, l’histoire des observations publiques et les commandes accessibles, avec leurs limites. L’état vrai, les mondes possibles de l’évaluateur, les structures, l’oracle, les solutions et les identités de réserve ne traversent pas cette frontière.

La projection publique du superviseur contient :

| Champ | Type et sens |
| --- | --- |
| `objective` | Objectif public JSON |
| `observation` | Observation publique JSON, sans enrichissement par une loi cachée |
| `commands` | Tableau d’identifiants de commandes, tous des chaînes |
| `controls` | Facultatif : descripteurs publics dont chaque `id` appartient à `commands` |
| `budgets` | Entiers positifs `{ gestures, states, wallMs }` |
| `gameTime` | Temps de jeu cumulé, entier non négatif |
| `terminal`, `success` | Booléens établis par l’hôte |
| `remainingGestures`, `remainingStates` | Quotas restants fournis par l’hôte |

L’adaptateur commun doit relier cette interface à l’observation réelle du pack SIC et à ses tickets. Le pont de référence préparé charge bien le runtime strict, mais son interface ARC à grille 64 × 64 et messages de service n’est pas, à elle seule, cette adaptation. La qualification doit démontrer que le rendu ou la projection conserve l’information publique nécessaire et n’apporte aucune information privée, et que les commandes réellement jouées sont celles autorisées dans le retour courant. Aucun témoin scripté ne remplace le décideur SIC.

Le même adaptateur, les mêmes objectifs et états initiaux et les mêmes enveloppes sont utilisés par la référence, le candidat actif et, sur les gains, l’ablation approuvée. Les deux mondes d’une situation et les bras reçoivent les sources d’aléa fixées par le plan scellé ; aucun apprentissage transversal entre situations n’est ajouté.

## 3. ABI JSONL `sic-public-ticket-v1`

Le transport est un flux UTF-8 de messages JSON, un objet par ligne terminée par un saut de ligne. Les champs inconnus dans les messages de la capsule sont refusés. `stdout` transporte le protocole ; les diagnostics appartiennent à `stderr`.

| Sens | Message | Champs |
| --- | --- | --- |
| Capsule → hôte | `ready` | `type`, `protocol: "sic-public-ticket-v1"` |
| Hôte → capsule | `start` | `type`, `protocol`, puis projection publique initiale |
| Capsule → hôte | `expand` | `type`, `request`, `site` |
| Hôte → capsule | `expansion-permit` | `type`, `request`, `site`, `total` |
| Capsule → hôte | `action` | `type`, `request`, `command`, `evidence` facultative |
| Hôte → capsule | `feedback` | `type`, `request`, projection publique après le vrai geste ; champs terminaux ci-dessous si nécessaires |
| Capsule → hôte | `terminal_ack` | `type`, `request`, `returnSha256` |
| Capsule → hôte | `stop` | `type`, `reason` parmi `uncertain`, `no-action`, `completed` |

`request` est un entier non négatif. Les séquences d’expansions et d’actions sont distinctes, commencent à zéro et suivent l’ordre attendu par l’hôte. Un `site` doit appartenir au manifeste approuvé. Une action attend le vrai retour de la précédente ; aucune action après le terminal n’est acceptée. Une commande illégale est consignée et refusée, sans commande de remplacement. `stop: completed` ne crée pas un succès : seul l’état établi par l’hôte permet de constater l’objectif.

Les preuves de `evidence` sont copiées avant le geste et reliées aux retours effectivement disponibles. L’optionalité syntaxique de ce champ ne supprime pas les obligations de preuve P05 et P14. L’audit de ces preuves est indépendant de leur producteur.

Limites de transport déjà scellées : **65 536 octets par ligne de sortie**, **1 048 576 octets cumulés sur stdout**, **131 072 sur stderr**, **262 144 octets pour une projection d’entrée**. Un fragment JSONL final incomplet, un encodage invalide ou un dépassement ne devient pas un résultat vérifié.

### Permis d’exploration

Le compteur vit chez l’opérateur. La capsule demande un permis **avant** d’examiner un état hypothétique pour sa terminalité, sa validité ou ses successeurs ; l’hôte débite puis renvoie le permis. L’instrumentation qualifiée doit attendre ce retour. Le même quota s’applique à toutes les recherches de l’épisode, y compris recherches imbriquées, revisites réellement réexaminées et reprises. Aucun remboursement n’est effectué après rejet d’un plan, reset ou undo.

Le compteur ne déduit pas sa couverture de la seule présence de messages `expand`. Le manifeste des sites et les sources instrumentées doivent établir qu’aucun chemin concerné ne passe hors de cette autorité. L’épuisement interrompt avant l’examen non autorisé et avant toute commande qui en serait issue ; le statut est `state_stop`.

### Retour terminal et acquittement

Le `feedback` terminal ajoute `terminalAckRequired: true` et `terminalReturnSha256`. L’empreinte est le SHA-256 du JSON canonique de `{ returned, gameTime }` ; le retour normalisé lie observation, commandes autorisées, indicateurs terminal/succès et ticks du geste. L’hôte fournit ce digest.

L’adaptateur doit remettre le dernier retour au **vrai** SIC, attendre sa réconciliation puis émettre `terminal_ack` avec le numéro de la commande et le digest reçus. La qualification doit prouver cet ordre. Répéter le digest sans réconciliation ne suffit pas.

L’ACK consomme le temps d’épisode restant. Il n’accorde aucun geste ni délai supplémentaires. Un objectif constaté physiquement par l’hôte sans acquisition terminale par SIC reste enregistré séparément et ne qualifie pas à lui seul la preuve d’apprentissage ou la continuité.

### Plans continus et gestes

Le transport fait vérifier chaque geste avec son retour. L’adaptateur peut conserver un paquet natif déjà justifié de **16 commandes au plus**, dans le budget restant ; il doit vérifier les prémisses entre gestes, interrompre sur contradiction, changement de niveau, fin ou limite, puis réconcilier les gestes réellement exécutés dans l’ordre. Il doit établir qu’il ne force pas une nouvelle recherche entre les commandes d’un préfixe déjà justifié.

Une commande dont le jeu avance de plusieurs ticks reste un geste ; cela ne démontre pas une série de plusieurs commandes. Attentes, observations payantes, sélections, préparations et essais comptent dans le même budget. Les acquérir avant le début du chronométrage ne permet pas d’exclure leur coût de l’épisode.

## 4. Enveloppe et statuts

| Limite simulée, par monde et bras | Valeur scellée |
| --- | ---: |
| Gestes | 64 |
| États explorés, quota commun | 12 000 |
| Épisode mural | 10 000 ms |
| Chargement froid du raisonnement, séparé | 30 000 ms |
| Workers de raisonnement | 1 |
| Cœurs logiques | 1 |
| Mémoire | 1 Gio |

Le temps de jeu et le temps mural sont deux mesures. L’horloge monotone d’épisode commence au premier paquet public et continue jusqu’au dernier contrôle en ligne et à l’ACK terminal. Le rejeu indépendant après arrêt, la vérification des artefacts, le démarrage froid et la durée totale jusqu’au dernier contrôle ont leurs mesures distinctes. Le calcul de l’oracle n’est pas imputé au candidat.

Le futur exécuteur utilise une image au digest exact, aucun réseau, racine et montages publics en lecture seule, UID/GID 65534, retrait des capacités, `no-new-privileges`, mémoire et swap limités à 1 Gio, plafond de processus 128 et espace temporaire propre borné. Une limite CPU ne prouve pas à elle seule l’existence d’un seul worker ; ce point est qualifié séparément.

Le superviseur extérieur doit tuer le conteneur et vérifier l’arrêt/nettoyage, y compris si le candidat boucle de façon synchrone ou sature les sorties. Un timeout de job GitHub Actions ne remplace pas ce watchdog par épisode. Aucun accès au socket Docker, aux chemins privés, aux clés de l’opérateur ou aux données du jeu n’est donné à la capsule.

Les bilans distinguent succès/échec vérifiés, plafonds de gestes ou d’états, arrêt mural (phase froide ou épisode), commande illégale et résultat non vérifiable. Un blocage avant exécution a son propre statut. Un arrêt mural reste au dénominateur complet ; il n’est ni corrigé par l’oracle ni employé comme échec vérifié d’ablation. Une reprise technique autorisée ne remplace pas le premier reçu.

Les natifs conservent leurs budgets déjà engagés par niveau et le parcours L1→L6. Les plafonds natifs ne sont pas remplacés par les valeurs simulées de ce tableau.

## 5. Dossier minimal de qualification

| Pièce à remettre ou à faire produire sous contrôle opérateur | Vérification attendue |
| --- | --- |
| SHA, configuration, point d’entrée et manifeste de capsule | Correspondance exacte aux blobs autorisés et au vrai pack strict |
| Adaptateur et qualification publique | Fidélité des observations, commandes légales, tickets, continuité, réconciliation terminale |
| Instrumentation et manifeste de couverture | Tous les sites atteignables des trois bras, définition des unités, exclusions justifiées, débit avant examen |
| Rapport du compteur | Frontière du quota, successeurs terminaux, recherches imbriquées, revisites et reprises, interruption et reçus |
| Image au digest et dépendances | Identité reproductible des octets exécutés |
| Rapport de confinement de l’hôte effectif | Treize probes ci-dessous, horloges et terminaison réelles, nettoyage |
| Registres complets de développement | Structures, combinaisons et familles natives utilisées, liés au candidat ; extraction auditée et comparaison privée |
| Intervention d’ablation proposée | Retrait unique, diff ou masque empreinté ; mêmes départ, objectif, mémoire et enveloppe |

Les treize contrôles de confinement exigés sont : `networkDenied`, `rootReadOnly`, `nonRootUid`, `capabilitiesDropped`, `noNewPrivileges`, `memoryLimit`, `cpuLimit`, `pidsLimit`, `onlyApprovedMounts`, `privatePathDenied`, `stdoutFloodKilled`, `synchronousLoopKilled`, `singleWorkerVerified`.

L’approbation Ed25519 de l’opérateur lie notamment moteur, capsule, adaptateur, image et budgets, manifeste de couverture et instrumentation, rapport de qualification, identité/version du daemon, rapport de probes de moins de 24 heures et qualification du retour terminal. Elle reste séparée de la capsule. Elle ne peut être produite sur une simple autodéclaration du candidat.

Cette qualification peut être menée sur des données publiques sans ouvrir une seule scène réservée. Les exécutions réservées ne commencent qu’après satisfaction de toutes les gates. **SS08–SS25 restent fermés jusqu’au seuil natif déjà scellé.**

# Lot 9A : exclusivités prospectives bornées

Ces outils ne remplacent aucun helper historique et ne modifient aucun reçu
antérieur. Leur import ne prend aucun verrou. Le développement, les tests,
les builds, les captures fonctionnelles, les commits et les push de branche
restent sans verrou global. Aucun acquittement de disponibilité des autres
lots n'est demandé par ces outils.

## Portée et limites de la preuve

`performance.py` exécute seulement le runner historique
`scripts/run-native-cost-window.py`, inchangé et identique dans les deux
checkouts. Il ne lance aucun jeu hors des deux formes STCK/SMLP déjà déclarées,
aucun comparateur après mesure et aucune publication. Le verdict du contrôleur
est `completed_pending_independent_analysis`, jamais une acceptation de coût.

`publication.py` détient seulement un bail court. Le responsable de livraison
reconsulte le Site, la source publiée, l'absence de collision de version et
l'audience pendant ce bail, puis utilise les appels natifs Sites. Le helper
n'atteste ni ces réponses distantes ni la réussite du déploiement. L'identité
complète à publier est le commit réellement emballé et poussé, qui doit être
réconcilié avec `executionHead` par le responsable.

Le mutex série les détenteurs du même inode. Il ne garantit pas que des
travaux ordinaires concurrents, désormais sans mutex global, soient arrêtés.
La readiness doit donc décrire une base réelle d'isolation, sa portée, ses
preuves et ses limites. Une readiness absente ou déclarant l'isolation non
établie est refusée avant toute tentative de verrou. Le contrôleur ne transforme
pas une simple mention de `flock` en preuve de calme. L'examen de la suffisance
des preuves d'isolation reste une responsabilité de la revue de livraison.

Les observations automatiques sont limitées au namespace visible : noms de
commandes, relations PID/groupe, compteurs CPU/RSS, affinité CPU, limites cgroup
visibles et charge. Aucun argv ni environnement de processus n'est collecté.
Le contrôleur vérifie l'absence de processus visibles étrangers à son ascendance
dans ses deux checkouts avant mesure, et détecte les nouveaux processus visibles
de ces checkouts hors du groupe mesuré. Cela ne prouve pas l'inactivité dans un
autre namespace ou sur un autre hôte. Les observations périodiques et leurs
écritures sont une instrumentation du contrôleur, conservée explicitement.

La fermeture du travail propre combine le statut propre
`/workspace/shared/sra-coordination/lot9a-status.json`, propre à cette filière, et l'observation de processus. Les sessions/commandes actives doivent
être nulles, la liste de workers vide, les quatre indicateurs de mesure et de
publication faux. Le responsable doit avoir réellement clos ses commandes et
workers ; une liste vide mensongère n'est pas corrigée par un contrôle local.

## Fichiers et limites

| Entrée | Rôle |
| --- | --- |
| `common.py` | Chemins canoniques, JSON strict, empreintes, état propre et mutex. |
| `performance.py` | Préflight ordinaire, acquisition unique non bloquante, ABBA borné, nettoyage et conservation. |
| `publication.py` | Bail de publication non bloquant, borné à 300 secondes, libération explicite. |

Les sorties doivent être de nouveaux répertoires sous
`docs/migration/lot9a-evidence/`. Aucun répertoire existant n'est réutilisé.
Les plans sont des chemins relatifs sous cette même racine. Les seules racines
d'entrées permises sont le checkout candidat et un checkout baseline propre,
canonique, situé sous `/workspace/sites/sra-lot9a-baseline*`. Les liens symboliques
et traversées `..` sont refusés. Aucune commande arbitraire n'est fournie par le
plan. Les seuls fichiers partagés écrits sont les deux fichiers de mutex et le
statut propre à la filière 9A. Aucun statut d'un autre lot n'est modifié.

Les plans nomment `candidateCommit`, le commit des sources natives gelées.
Des commits ultérieurs de documentation peuvent contenir le plan : le commit
source doit être ancêtre du HEAD, ses fichiers natifs doivent correspondre
exactement à Git, à l'inventaire déclaré et aux octets courants. Le HEAD complet
est enregistré séparément comme `executionHead` et doit rester stable pendant
la commande. Le baseline reste exactement au commit publié déclaré. Cette
séparation évite un plan qui devrait contenir son propre SHA Git.

## Forme commune d'une empreinte

Chaque empreinte est un objet possédant exactement quatre clés :

```json
{
  "role": "candidate",
  "path": "docs/migration/lot9a-evidence/EXEMPLE.json",
  "bytes": 123,
  "sha256": "REMPLACER_PAR_64_CARACTERES_HEXADECIMAUX"
}
```

`role` est `candidate` ou `baseline`. Les exemples sont des schémas de
préparation, jamais des déclarations utilisables telles quelles. Les empreintes
réelles doivent être calculées après la dernière modification. La liste
`immutableInputs` doit inclure tous les fichiers natifs des deux manifestes,
les outils et dépendances de mesure, les deux traces, les politiques, le
protocole, le contrat, les preuves liées et la readiness. Elle contient
explicitement `common.py`, le contrôleur utilisé, et les deux copies du runner
historique Python et du mesureur JavaScript. Les chemins dupliqués sont refusés.
Le plan lui-même est empreinté à l'entrée et revérifié, sans empreinte circulaire.

## Plan et readiness de performance

Le plan possède les champs suivants :

```text
schema: logos-engine.lot9a.official-performance-plan.v1
owner: lot9a
baselineCheckout: chemin absolu canonique du checkout publié
baselineCommit: SHA complet de la publication observée
baselineSiteVersion: numéro de Site réellement observé
baselineNativeVersion: version publiée
candidateCommit: SHA complet du gel natif final
candidateNativeVersion: version native finale distincte
performanceDirectory: chemin relatif du répertoire préparé
baselineManifest: empreinte du manifeste A conservé dans les preuves 9A
candidateManifest: empreinte du manifeste B conservé dans les preuves 9A
contract: empreinte du contrat de coût
readiness: empreinte de la readiness
immutableInputs: liste complète des empreintes
limits: objet exact ci-dessous
```

```json
{
  "preflightSeconds": 180,
  "measurementSeconds": 1800,
  "terminationGraceSeconds": 10,
  "killGraceSeconds": 10,
  "retentionSeconds": 60,
  "observationIntervalSeconds": 30
}
```

Le préflight de 180 secondes est hors verrou. Les 1800 secondes commencent à
l'acquisition et comprennent la dernière vérification des entrées et ABBA.
Une clôture d'intégrité peut consommer au plus 60 secondes supplémentaires ;
le nettoyage TERM puis KILL dispose de 10 secondes chacun. La limite déclarée
de possession, nettoyage et intégrité compris, est donc de 1880 secondes.
L'empreinte finale des journaux est calculée après libération, dans une borne
distincte de 60 secondes. Aucune prolongation ou relance automatique n'existe.

Le chemin baseline/candidat des manifestes appartient au dossier de preuve
candidat ; leur contenu conserve la forme exacte historique
`{fileCount, digest, files}`. Le répertoire de sorties du contrôleur est distinct
du répertoire de mesure et ne peut en être un sous-répertoire.

La readiness possède au minimum :

```text
schema: logos-engine.lot9a.official-performance-readiness.v1
measurementAuthorized: true
pendingRequirements: []
baselineCommit: même SHA source que le plan
candidateCommit: même SHA source que le plan
contract: même objet empreinte que le plan
ownWorkClosed:
  allPreparationCommandsTerminal: true
  activeExecutionSessions: []
  activeCommands: []
  activeWorkers: []
isolation:
  established: true
  basis: description factuelle de l'isolation établie
  scope: portée exacte, sans universaliser une vue locale
  evidence: liste non vide d'empreintes déjà présentes dans immutableInputs
  limitations: liste explicite des limites restantes
  flockAloneIsEvidence: false
```

Une liste vide de prérequis doit être justifiée par les preuves fonctionnelles,
la réconciliation de version et le contrat de coût. Le contrôleur vérifie leurs
empreintes et les conditions exécutables décrites ici ; il ne remplace pas la
revue sémantique de ces preuves.

Le contrat `logos-engine.lot9a-final-cost-contract.v1` est également relu
sémantiquement : checkouts, versions, commits sources, manifestes, digests,
effectifs ABBA, commande fixe, règles globales et écarts structurels doivent
correspondre au plan et aux fichiers vérifiés. Chaque empreinte du contrat doit
appartenir au gel du contrôleur. Les sept outils historiques restent identiques
à ceux du commit publié du baseline. Les indicateurs `readinessEstablished`
et `isolationEstablished` faux du contrat décrivent seulement la préparation ;
la readiness distincte doit établir ces conditions au moment du lancement.

```bash
python -B docs/migration/lot9a-evidence/tools/final-coordination/performance.py \
  --plan docs/migration/lot9a-evidence/FINAL/official-window-plan.json \
  --output docs/migration/lot9a-evidence/FINAL/official-window-controller-01
```

Le contrôleur garde les traces stdout/stderr brutes du runner, les observations,
le reçu courant et le reçu initial. Le runner conserve les quatre rapports et
leurs journaux dans le répertoire de performance. La réussite des quatre séries
et l'intégrité finale sont nécessaires, mais les comparateurs et la revue
indépendante du coût doivent encore être exécutés après libération. Le seuil
reste strictement inférieur à +10 % sur la médiane des huit sessions complètes
par version et par jeu, sans exclusion ni compensation entre jeux ; les phases
restent diagnostiques et visibles.

## Plan et commande de publication

```text
schema: logos-engine.lot9a.publication-lease-plan.v1
owner: lot9a
publicationAuthorized: true
maximumSeconds: 300
candidateCommit: SHA complet du gel natif final
candidateNativeVersion: version native finale
expectedPublishedSiteVersion: numéro de Site fraîchement observé
expectedPublishedSourceCommit: SHA complet fraîchement observé
audience: owner_private
immutableInputs: empreintes du helper, common.py, de tous les fichiers natifs
                 et des preuves/entrées finales réellement prêtes à publier
```

Les vérifications locales ne remplacent jamais la relecture distante sous bail.
L'archive réellement publiée, son empreinte et son commit source doivent figurer
dans la qualification finale du responsable et rester identiques jusqu'à la
sauvegarde réussie du Site. Aucun appel Sites n'est intégré dans ce helper.

```bash
python -B docs/migration/lot9a-evidence/tools/final-coordination/publication.py \
  --plan docs/migration/lot9a-evidence/FINAL/publication-plan.json \
  --output docs/migration/lot9a-evidence/FINAL/publication-lease-01
```

Après `status: held`, conserver l'identité `lease` retournée. Envoyer sur stdin
une ligne complète `release:<lease>` après clôture de la publication, ou
`abort:<lease>` en cas d'abandon. Une entrée partielle ne bloque jamais le délai.
La fermeture de stdin, un signal ou l'expiration provoquent également la
libération, sans prétendre que la publication distante est terminée. Si un
déploiement dépasse ce bail, conserver son identité et son état réel ; ne pas
inventer sa clôture ni démarrer automatiquement une seconde publication.

## Nettoyage et refus

Les mutex sont ouverts avec `O_NOFOLLOW`, identifiés par périphérique/inode,
acquis une seule fois avec `LOCK_EX | LOCK_NB` et refermés dans `finally`.
Une contention retourne 75 immédiatement. Une identité modifiée invalide la
commande et provoque la fermeture du descripteur détenu, jamais la suppression
ou la reconstruction du fichier. Les seuls fichiers supprimés par le code sont
ses propres temporaires JSON uniques après un échec d'écriture.

Le runner démarre dans un nouveau groupe de processus. Le contrôleur est un
subreaper Linux : il récolte les descendants devenus orphelins, termine son
groupe par TERM puis KILL si nécessaire et attend sa disparition. La fermeture
par PPID identifie également ses descendants sortis de ce groupe ; leur heure
de création noyau est revérifiée avant un signal individuel, sans sélectionner
un processus tiers par son nom de commande. Les erreurs,
signaux capturables et dépassements de temps suivent ce même nettoyage borné.
Un descendant restant, une erreur de conservation ou une identité de verrou
modifiée interdit tout succès. Le mutex est libéré même si le nettoyage échoue,
et ce cas porte explicitement `failed_cleanup_incomplete` : il nécessite un
diagnostic réel avant toute autre mesure, sans relance automatique.

Les signaux non capturables, la panne de l'hôte et les processus bloqués dans
le noyau ne permettent pas de garantir une exécution du `finally` Python ou
la rédaction d'un reçu terminal. Le noyau ferme les descripteurs du processus
terminé ; `PDEATHSIG` protège en supplément l'enfant direct, sans prétendre
remplacer le nettoyage complet du groupe. Un reçu non terminal ne doit jamais
être interprété comme une fermeture démontrée. Une panne de stockage peut
empêcher un reçu final ; le nettoyage des processus et du mutex est tenté avant
cette écriture et un constat minimal est alors émis sur stdout.

## Adaptation prospective 0.68

Cette dérivation vise la source finale ChartNavigation **0.68.0**, 334 fichiers
natifs, digest `e7a94fbc7cdcb19d8704b5d4120f27a858cbcd07e455084711510ee147f4e653`,
face à la publication **Site 108 / native 0.67.0**, commit
`8462204043aa368faa7df280d796bb706eb53b38`, 331 fichiers, digest
`c234bb404de43b380e5595cee8ad4ddfcae6e02d0fcc40286546fcf6838dd44a`.
Le checkout baseline est `/workspace/sites/sra-lot9a-baseline067-20261112`.
Ces identités restent des déclarations à revalider au lancement, puis sous
le bail de publication ; leur présence ici ne certifie aucune observation future.

La seule modification sémantique du validateur de contrat, après les noms et
chemins propres à la filière, est l'écart structurel établi par la qualification
fonctionnelle : `public_chart_navigation` est le propriétaire ajouté (62 à 63),
et `v6.chart_navigation.choose` est le programme ajouté (28 à 29). Les quatre
chemins structurels autorisés et l'exigence de zéro différence non attribuée
restent identiques. Les algorithmes de mesure et de calcul ne sont pas changés.
La qualification positive Chart porte sur `NativeV6Runtime` commun. Elle ne
prouve pas le parcours positif service public, worker et tickets, qui reste
un périmètre séparé. Aucune réussite de jeu ni performance n'en est déduite.

Le précédent refus du lecteur fonctionnel portant sur 58 feuilles `total_ms`
et sa correction prospective v2 restent dans les preuves de livraison. Ces
contrôleurs ne relancent aucun lecteur fonctionnel, aucun oracle ni LKEY.
Les deux tentatives autorisées du lecteur fonctionnel sont déjà consommées.

La préparation a observé le 12 novembre 2026 que la demande de contexte du
lot 5 était close sans confirmations et sans instruction de silence restante,
et qu'un statut du lot 6 décrivait encore du travail ordinaire. Ces observations
ne constituent pas des ACK, une disponibilité acquise ni une isolation globale.
La readiness officielle doit porter une observation fraîche avec sa portée
réelle ; ni un ancien statut `idle`, ni `/proc/locks` vide, ni le mutex seul
ne peuvent établir l'absence de travail dans d'autres namespaces ou hôtes.
Aucun outil de cette dérivation ne met en attente le travail courant.

`provenance.json` lie les trois sources historiques, les trois dérivés et
leurs diffs complets. `syntax-checks.json` atteste seulement l'analyse
syntaxique Python des fichiers, sans import, verrou ou exécution native.

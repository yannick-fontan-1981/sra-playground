# SIC SYNC — admissibilité de b408009a

**Verdict : candidat reçu et identifié ; admission à l’exécution bloquée avant toute remise d’une entrée réservée.**

Audit enregistré le **28 novembre 2026 à 11:47:46 UTC−3** (`2026-11-28T14:47:46Z`), sous le protocole immuable **SIC-OP-20261128-01**. Le présent dossier ajoute un constat d’admissibilité et explicite le contrat de remise déjà scellé. Il ne modifie ni les scènes, ni les critères, ni les plafonds, ni la référence.

**Aucun code candidat, test candidat, campagne, jeu natif ou probe dynamique de confinement n’a été exécuté pendant cet audit.** Les contrôles ont porté sur les sources Git, les métadonnées GitHub, les octets de l’archive P14, les agrégats de ses reçus et les engagements existants. Aucun résultat de la réserve n’est disponible. **SS08–SS25 restent fermés.**

## 1. Identités et intégrité

| Élément | Identité vérifiée |
| --- | --- |
| Candidat remis | `b408009aadc4663056208970e2ee999186226fcc` |
| Arbre Git du candidat | `28662ec402054550a2ae01acf27d671a34feff40` |
| Arbre `src` du candidat | `7c15842953fc52da3aae5ca3661727b64d92209d` |
| Référence scellée | `20433007224accc36e3d7976696d9ee7a783a227` |
| Arbre `src` de référence | `401f4046ff47087b627ec5022d291db343cfc26d` |
| Publication initiale du scellement | `d0f7c0b963974ab133e93f98342a9312949547ad` |
| SHA effectif du run P14 cité | `b225b1df7364138f98d0b31c8d73c357da69165b` |
| P09 `effect-composer.ts`, référence et candidat | blob `f54a624abaaa89e4d5363f41869017f4e7f99b35` |

La référence est ancêtre du candidat. Le run P14 est attaché au parent immédiat `b225b1df…`. Entre ce parent et `b408009a…`, quatre fichiers changent : le dossier de portée, `access-policy.ts`, le nouveau composeur et son test. **Les dix fichiers empreintés par la configuration de campagne P14 sont identiques octet pour octet dans les deux SHA.** Ce lien de sources permet de conserver le résultat du composant P14 comme pièce de développement ; il ne transforme pas le run en évaluation du pack strict complet au SHA remis.

Les trois corpus privés, le manifeste natif et le manifeste privé de scellement ont été relus uniquement pour calculer leurs empreintes ; ils correspondent aux engagements publiés. Les quatre fichiers publics du scellement initial restent inchangés.

Sources : [commit candidat](https://github.com/yannick-fontan-1981/sra-playground/commit/b408009aadc4663056208970e2ee999186226fcc), [run P14](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46155382495), [protocole scellé](../PROTOCOLE.md), [engagements initiaux](../SCELLEMENT.json).

## 2. Portée exacte des éléments reçus

### Campagne P14

Le run `46155382495`, tentative 1, comporte huit jobs de famille et un job d’agrégation, tous terminés avec succès. L’archive agrégée `15267374051` a été téléchargée et son SHA-256 comparé au digest publié par GitHub. Le flux JSONL décompressé correspond aussi à son empreinte de rapport.

Sans réexécuter une seule politique, l’opérateur a recompté les 8 000 reçus, leurs huit quotas de 1 000, leurs 8 000 signatures déclarées distinctes et leurs deux mondes par situation. Les indicateurs de succès d’une situation correspondent tous au succès des deux mondes consignés. Les agrégats recalculés sont :

| Mesure du banc de développement | Nombre |
| --- | ---: |
| Situations | 8 000 |
| Succès du bras figé de ce banc | 767 |
| Succès du candidat de ce banc | 7 962 |
| Gains par rapport à ce bras figé | 7 195 |
| Pertes par rapport à ce bras figé | 0 |
| Situations non gagnées par le candidat | 38 |

| Famille publique de développement P14 | Situations | Figé | Candidat | Gains | Pertes |
| --- | ---: | ---: | ---: | ---: | ---: |
| `transient_then_period` | 1 000 | 64 | 994 | 930 | 0 |
| `ambiguous_periods` | 1 000 | 94 | 996 | 902 | 0 |
| `delayed_command` | 1 000 | 0 | 1 000 | 1 000 | 0 |
| `expiring_window` | 1 000 | 491 | 1 000 | 509 | 0 |
| `cycle_intervention` | 1 000 | 7 | 999 | 992 | 0 |
| `independent_clocks` | 1 000 | 109 | 987 | 878 | 0 |
| `ordered_intermediates` | 1 000 | 0 | 1 000 | 1 000 | 0 |
| `partial_observation` | 1 000 | 2 | 986 | 984 | 0 |

Ces nombres sont des **recomptages de résultats archivés**, pas des transitions rejouées par l’opérateur. Les signatures sont distinctes dans le normaliseur de développement ; leur nombre ne démontre pas leur disjonction avec les structures réservées.

La configuration de cette campagne fixe **180 gestes, 360 ticks et 20 000 états**. Le bras figé appelle une fonction temporelle conservée de la référence dans un adaptateur de laboratoire ; il n’est pas le pack SIC complet de référence. Le workflow lance `node` sur un checkout et n’établit pas le confinement ni le watchdog de chaque monde. Ce résultat reste donc extérieur aux 2 000 positifs P14 de SIC-OP.

Sources : [artefact agrégé](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46155382495/artifacts/15267374051), [journal d’agrégation](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46155382495/job/141011321481), [portée du banc P14](https://github.com/yannick-fontan-1981/sra-playground/blob/b408009aadc4663056208970e2ee999186226fcc/docs/diagnostics/sic-p14-temporal/README.md), [agrégateur](https://github.com/yannick-fontan-1981/sra-playground/blob/b408009aadc4663056208970e2ee999186226fcc/scripts/sic-p14-aggregate.mjs).

### Les six cas connus et le test composé

Le dossier annonce **12/12 mondes connus réussis dans chaque bras**, avec 64 gestes, 306 gestes cumulés pour le figé et 387 pour l’actif, maxima respectifs 47 et 60. Ce rejeu n’a pas été relancé par l’opérateur. Ces six cas sont déjà du développement et n’entrent pas dans la réserve.

La source du test composé met effectivement en place une acquisition P05, des observations P14, un passage P07 via P09 et une remise du retour terminal à `V6AgentService`. Le pont construit une unique famille V6 dont le décideur est fourni par le test. Son indicateur `nativeSealed` suit la comparaison et l’enregistrement du retour par cette famille. C’est un contrôle utile du mécanisme V6 sur le terrain construit.

Trois limites sont décisives pour l’admission :

1. **Le composeur n’est pas raccordé à l’agenda strict.** La recherche de `composeObservedTimedAccess` dans les sources, scripts et tests au SHA remis trouve sa définition et ses appels de test, sans appel dans le reste de `src`. Le pont emploie `new NativeV6Runtime({families: [family]})`, et non le pack strict via `createNativeV6Runtime` avec `solver: sic`.
2. **Une commande durant deux ticks ne démontre pas une série continue de plusieurs commandes.** Le composeur ne rend que le premier pas et le pont rappelle le décideur après la clôture. La conservation d’un préfixe déjà justifié, ses gardes et sa réconciliation restent à qualifier pour le pack strict, conformément à AGENTS.md et au protocole.
3. **Le retour terminal local ne suffit pas à qualifier l’ACK du superviseur.** Il manque le raccord JSONL, le lien au vrai ticket et au digest du retour, et la preuve que l’ACK suit la réconciliation réelle dans le temps restant. Les six gestes d’acquisition et les 22 lectures sont comptés dans l’assertion des 64 gestes, mais réalisés avant `runtime.start()` dans le test V6 ; leur calcul et leur acquisition doivent aussi être dans l’enveloppe d’épisode qualifiée. `executionMs: 1` est une valeur de fixture, pas une mesure murale.

Les retraits de preuve qui suppriment l’offre de passage sont des contrôles de dépendance. Ils ne remplacent pas l’exécution du troisième bras, sur chaque gain réservé, jusqu’au résultat vérifié de l’objectif.

Sources : [dossier de portée](https://github.com/yannick-fontan-1981/sra-playground/blob/b408009aadc4663056208970e2ee999186226fcc/docs/diagnostics/sic-p05-p14-p07-p09-integration.md), [test composé](https://github.com/yannick-fontan-1981/sra-playground/blob/b408009aadc4663056208970e2ee999186226fcc/tests/sic-observed-timed-access.test.ts), [pont V6 expérimental](https://github.com/yannick-fontan-1981/sra-playground/blob/b408009aadc4663056208970e2ee999186226fcc/experiments/sic-blind-composition/native.mjs).

## 3. Blocage précis du compteur

Le raccord partage un compteur local entre sa recherche P07 et son invocation de P09. Les tests fournissent une closure qui cumule les débits entre décisions. Cette portée est confirmée ; le callback reste facultatif et ne constitue pas une autorité extérieure qualifiée pour tout le pack.

**P07 examine certains états avant le débit.** Dans `access-policy.ts`, `obtain()` appelle `problem.goal(state)` à la ligne 40, pour la racine puis pour ses successeurs. `chargeState()` n’intervient qu’à la ligne 60, lors du traitement de la frontière. La propagation peut rendre la racine gagnante puis arrêter la boucle avant le traitement des successeurs. Il est donc possible, d’après l’ordre du code, d’examiner la terminalité d’une racine et de son successeur gagnant pour un seul débit. Ce constat est statique ; aucun cas réservé n’a servi à le produire.

L’unité scellée exige le débit avant l’examen d’un état hypothétique pour sa terminalité, sa validité ou ses successeurs. Compter seulement les éléments ensuite dépilés ne remplit pas cette condition. L’instrumentation doit aussi distinguer une simple lecture de résultat mémorisé d’un nouvel examen d’hypothèse et facturer les revisites réellement réexaminées.

**Le plafond P14 annoncé pour les 12 mondes ne prouve pas 12 000 états cumulés sur l’épisode.** `subject.mjs` passe `states: limits.states` intégral à chaque appel de `composePlan`, réinitialise `explored` dans chaque décision et peut relancer `route()`. `compare.mjs` limite gestes et ticks, mais n’impose pas de débit extérieur cumulé des expansions. Le résultat fonctionnel annoncé peut être conservé ; sa borne locale par recherche ne vaut pas la borne globale SIC-OP.

| Zone | Couverture constatée | Ce qui manque |
| --- | --- | --- |
| P07 du raccord | Hook au traitement de la frontière | Débit avant `goal` et examen des successeurs ; sémantique des revisites et propagations |
| P09 du raccord | Débit dans le `goal.holds` de cette invocation | Tous les autres appelants et recherches imbriquées ; autorité hôte |
| P14 de laboratoire | Plafond interne de `composePlan` par appel | Quota d’épisode commun ; couverture des hypothèses temporelles |
| Pack strict et référence | Compteurs et limites locaux préexistants | Inventaire exhaustif, instrumentation approuvée et reçus extérieurs dans les deux bras |

Exemples de recherches préexistantes encore hors d’un compteur commun : `observed-pressure-reserve.ts` appelle `composePlan` avec 7 500 états locaux ; `contact-frontier-search.ts` effectue un BFS de marche imbriqué avant son compteur local ; `periodic-relay-planner.ts` conserve un plafond local de 250 000 itérations. Ce sont des contre-exemples à une couverture complète, pas un inventaire exhaustif.

Le manifeste à remettre doit couvrir référence, actif et ablation, avec un quota unique, débit avant examen et attente du permis, absence de remboursement, interruption avant dépassement et reçu `state_stop`. Les tests publics de qualification doivent notamment éprouver la frontière du quota, le successeur terminal avant dépilement, les recherches imbriquées, reprises, revisites et changements de niveau. L’accord comportemental avec le moteur non instrumenté sous plafond non contraignant doit être établi sans modifier sa politique.

Sources : [P07](https://github.com/yannick-fontan-1981/sra-playground/blob/b408009aadc4663056208970e2ee999186226fcc/src/sic/access-policy.ts), [raccord P07/P09](https://github.com/yannick-fontan-1981/sra-playground/blob/b408009aadc4663056208970e2ee999186226fcc/src/sic/observed-timed-access.ts), [sujet P14](https://github.com/yannick-fontan-1981/sra-playground/blob/b408009aadc4663056208970e2ee999186226fcc/scripts/sic-p14/subject.mjs), [comparateur P14](https://github.com/yannick-fontan-1981/sra-playground/blob/b408009aadc4663056208970e2ee999186226fcc/scripts/sic-p14/compare.mjs), [recherche de contact](https://github.com/yannick-fontan-1981/sra-playground/blob/b408009aadc4663056208970e2ee999186226fcc/src/sic/contact-frontier-search.ts), [réserve observée](https://github.com/yannick-fontan-1981/sra-playground/blob/b408009aadc4663056208970e2ee999186226fcc/src/sic/observed-pressure-reserve.ts), [planification périodique](https://github.com/yannick-fontan-1981/sra-playground/blob/b408009aadc4663056208970e2ee999186226fcc/src/sic/periodic-relay-planner.ts).

## 4. Gates avant remise des scènes réservées

| Gate scellée | État | Pièce concrète encore nécessaire |
| --- | --- | --- |
| Disjonction avec le développement | Non vérifiée | Registre complet lié au SHA : structures, combinaisons, générateurs, cas connus et familles natives utilisées ; extraction et normaliseur compatibles audités, comparaison privée par l’opérateur |
| Capsule publique du vrai SIC | Non qualifiée | Manifeste extrait des blobs exacts, vrai point d’entrée strict, adaptateur commun des observations/commandes, qualification des tickets, de la continuité et du retour terminal |
| Compteur extérieur | Couverture partielle ; débit P07 tardif | Instrumentation complète et rapports de couverture pour référence/actif/ablation, permis imposés avant examen, quota commun et arrêt vérifié |
| Confinement effectif | Non qualifié | Hôte désigné, image au digest, probes effectifs, watchdog et nettoyage démontrés, approbation liée à ces artefacts exacts |

L’archive P14 reçue apporte un inventaire de 8 000 signatures de développement. Elle ne constitue pas le registre complet des trois primitives, des compositions et des usages natifs du candidat ; son normaliseur n’a pas encore été confronté à celui de l’opérateur. Aucun constat de disjonction n’est déduit d’une différence de graine ou du seul nombre de signatures.

Le [contrat public de capsule](CONTRAT_CAPSULE.md) précise le contenu de la remise et l’ABI du superviseur. Les limites simulées demeurent **64 gestes, 12 000 états et 10 000 ms par monde et par bras**, avec **30 000 ms de démarrage froid** séparées ; un worker, un cœur logique, 1 Gio, aucun réseau.

Sur l’hôte de préparation courant, `docker`, `podman` et le socket Docker sont absents. Aucun nouvel essai dynamique d’isolation n’a été effectué. Le workflow P14 demande Ubuntu 24.04 et un timeout de job de 20 minutes ; cela ne démontre ni la capsule isolée ni la limite murale de 10 secondes par monde. Un futur hôte peut être qualifié sans scène réservée, sur des données publiques de qualification. Les clés, l’oracle et les vérificateurs restent chez l’opérateur.

La qualification de confinement doit notamment démontrer : réseau refusé, racine en lecture seule, utilisateur non privilégié, capacités retirées, interdiction d’acquérir des privilèges, limites mémoire/CPU/processus, seuls montages approuvés, accès aux chemins privés refusé, arrêt d’une saturation de sortie et d’une boucle synchrone, un seul worker. Le rapport est lié à l’image et à l’identité du daemon, daté de moins de 24 heures lors de l’admission, puis revérifié. Une signature d’approbation suit ces preuves ; elle ne les remplace pas.

Sources : [protocole scellé](../PROTOCOLE.md), [workflow remis](https://github.com/yannick-fontan-1981/sra-playground/blob/b408009aadc4663056208970e2ee999186226fcc/.github/workflows/sic-p14-temporal.yml), [contrat dérivé des composants scellés](CONTRAT_CAPSULE.md).

## 5. Bilan réservé et règle de suite

| Primitive | Positifs actifs scellés | Familles | Positifs par famille | Situations évaluées avec ce candidat | Résultat |
| --- | ---: | ---: | ---: | ---: | --- |
| P05 | 2 000 | 8 | 250 | 0 | Non mesuré |
| P07 | 2 000 | 8 | 250 | 0 | Non mesuré |
| P14 | 2 000 | 8 | 250 | 0 | Non mesuré |

Pour chaque primitive et chacune de F01–F08, les 50 remplaçants, 25 négatifs et 25 paires restent également non exécutés. Les six familles natives réservées et leurs 36 niveaux sont non joués. Les gains, pertes, ablations, arrêts muraux et commandes illégales du candidat sur la réserve sont **non mesurés** ; le blocage d’admission n’est ni une défaite ni un arrêt mural.

**SS08–SS25 restent scellés.** L’ouverture nécessite un même SHA gagnant des niveaux natifs supplémentaires dans au moins deux mécaniques réservées distinctes, à budget égal, sans victoire de référence perdue ni commande illégale et avec toutes les comparaisons nécessaires vérifiables. Aucun résultat de développement, aucune fixture V6 et aucune variante visuelle ne remplit ce seuil.

Aucun cas de réserve n’a été dévoilé ou transféré au développement ; aucun remplacement n’a été effectué. Si une correction du moteur produit un nouveau SHA, celui-ci sera reçu séparément. Les scènes, critères et budgets restent ceux déjà scellés. Un cas ultérieurement dévoilé sort irréversiblement de la réserve et exige un remplacement frais, structurellement contrôlé et scellé avant le candidat suivant.

## 6. Empreintes de contrôle

| Engagement | SHA-256 |
| --- | --- |
| Archive publique P14 téléchargée | `b1034f74c6fc9278f2ebf975d4358ae2a495fa6d06355590bdc29d9ca630d8b8` |
| Rapport P14 dans l’archive | `eae6df0d3f090fa0d1cc07f1c41ccfd6841b081542d4a242366d33e9bdc886e9` |
| Configuration P14 dans l’archive | `1032ef6d821150b5686ad2b888e7f0f99f657b79df16f3f5195244ea538178ba` |
| Flux JSONL P14 décompressé | `8c15bae0fb37496270c846182b35f180a1c0fce831625b705c77415a2072bba7` |
| Corpus privé P05, engagement inchangé | `f95191b4a1ebf85483d1ef6db22e4778354fdfa93f6bd702a72de1748a6e966b` |
| Corpus privé P07, engagement inchangé | `875ec56b1ec078a30d1cb5a06501fa09c004e8720771ed41255f6f96b439c290` |
| Corpus privé P14, engagement inchangé | `75c22e7b70c7f65cbad777016e6e32377b7d9cebb652738bef8fc8d2f171ba0e` |
| Manifeste privé, engagement inchangé | `e023449ac79bf82db4b5f45061bd92eac4d6677e577cef7c98b66d83c59248fa` |
| Manifeste natif, engagement inchangé | `655c74ba4b1d5ceafe02fefe2122ee7df39ff7a96b31382df705470a44edeb30` |

Les empreintes de ce nouveau dossier sont dans [SHA256SUMS](SHA256SUMS), son état exploitable dans [RECEIPT.json](RECEIPT.json). Le relais public adressable est [SIC SYNC, issue #146](https://github.com/yannick-fontan-1981/sra-playground/issues/146). Ce canal ne vaut pas livraison dans une autre conversation ChatGPT inaccessible.

# Lot 2C : clôture du budget de coût, natif 0.36.0

**Budget observé conforme : 16 médianes sur 16, seuil de +10 % inchangé, aucun dépassement non résolu.** Le comparateur officiel retourne `status: "passed"` et `unresolved: []` à `2026-11-09T21:47:11.939Z`. Ce résultat clôt le volet budget de coût de 2C sur les contrôles déclarés STCK et SMLP. Il ne clôt pas la parité complète V5/V6, toutes les familles natives ni une garantie de performance pour tous les jeux. Sources : [comparaison exacte](comparison.json), [politique](comparison-policy.json), [protocole déclaré](README.md).

Les hausses restent visibles : la restauration SMLP augmente de **+1,649 %**, dans la limite autorisée ; la session LIFE augmente de **+3,387 %**. LIFE était déclaré comme diagnostic de trajectoire plus longue avant la mesure et ne fait pas partie des seize critères de contrôle. Ses autres hausses, celles des p95 et les latences Pause sont conservées ci-dessous. Aucune baisse globale ne compense une hausse locale pour la décision de conformité.

## Protocole exécuté et effectifs

Un seul passage complet par version a été exécuté, dans l’ordre **référence fraîche V62 / natif 0.34.0**, puis **candidat gelé / natif 0.36.0**. Chaque passage emploie le même runner, le même comparateur, le même manifeste et les mêmes traces publiques. Un worker Node distinct par cas effectue un échauffement de trois actions puis trois sessions avec connaissance neuve. Le worker reste démarré entre ces sessions : « froid » concerne la connaissance de l’agent, pas un processus neuf ni un moteur JavaScript sans échauffement. Sources : [reçu baseline](baseline.json.gz), [reçu candidat](after.json.gz), [runner](../../../../scripts/measure-native-loop-costs.mjs).

| Cas | Sessions mesurées par version | Actions par session | Actions mesurées par version | Niveaux terminés par session | Cycles par session | Rôle déclaré |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| STCK | 3 | 10 | 30 | 2 | 6 | Contrôle du budget |
| SMLP | 3 | 15 | 45 | 3 | 9 | Contrôle du budget |
| LIFE | 3 | 49 | 147 | 3 | 47 | Diagnostic de session plus longue |

Chaque version totalise **9 sessions mesurées et 222 actions**, plus **3 sessions d’échauffement et 9 actions d’échauffement**. Les deux versions totalisent donc **18 sessions mesurées, 444 actions mesurées et 18 actions d’échauffement** ; ces dernières sont exclues des distributions et du budget. Il ne s’agit pas de dix-huit sessions d’échauffement.

Le contrôleur `BrowserV6Agent` envoie sa propre commande ; le replay ne fournit le paquet public suivant qu’après vérification exacte de cette commande. Le comparateur vérifie l’identité du générateur, des entrées, du manifeste et de l’environnement déclaré, ainsi que les mêmes nombres de sessions, actions, cycles, niveaux et échantillons de chaque phase. Il vérifie une initialisation et un retour `advance` par action, ainsi que les limites Pause à zéro et une action. Les révisions et nombres de nœuds finaux sont identiques dans les six sessions de chaque cas : STCK **842 / 344**, SMLP **1 179 / 412**, LIFE **5 320 / 1 318**. Ces compteurs égaux ne constituent pas une preuve d’identité intégrale des valeurs du graphe. Sources : reçus et [comparateur inchangé](../../../../scripts/compare-native-loop-costs.mjs).

## Fenêtres exactes et isolation observée

Toutes les dates de cette section sont en UTC. Le [reçu de fenêtre](window.json) enregistre l’ordre, les commandes, les empreintes, les codes de sortie et les chevauchements constatés.

| Passage | Début UTC | Fin UTC | Durée du processus (s) | Sortie |
| --- | --- | --- | ---: | ---: |
| baseline | `2026-11-09T21:29:27.800754+00:00` | `2026-11-09T21:38:21.253261+00:00` | 533.452331879 | 0 |
| after | `2026-11-09T21:38:21.253704+00:00` | `2026-11-09T21:47:07.199160+00:00` | 525.945091484 | 0 |

La fenêtre réservée complète va de `2026-11-09T21:29:27.799220+00:00` à `2026-11-09T21:47:07.199514+00:00`. Les durées de processus incluent démarrage, échauffements, inspections et écriture du reçu ; elles ne sont pas les médianes `session_elapsed` du tableau de coût.

L’aperçu géré était arrêté. La restriction déclarée interdisait tests, build, campagne, export et jeu navigateur concurrents ; `observedProjectOverlaps` est vide. La lecture et la rédaction légère restaient permises. Les deux reçus décrivent Node **v24.22.1**, Linux **6.18.57**, CPU **AMD EPYC 9V74 80-Core Processor**, **9 processeurs logiques** visibles. L’activité extérieure de l’hôte partagé n’est pas isolée. L’ordre fixe avant/après n’est ni randomisé ni alterné ; une dérive de la machine entre les deux fenêtres n’est pas exclue par cette expérience.

## Versions et empreintes mesurées

| Entrée native | Base Git enregistrée | Fichiers natifs | SHA-256 du manifeste natif |
| --- | --- | ---: | --- |
| Baseline V62 : 0.34.0 | `e56118da8b5f596b9727ca78a037e930bc333860` | 240 | `17252e294212a1563b75037a0b0dd782c2ecbc8cc4e1997a4f2bb2103bdf4e8b` |
| Candidat gelé : 0.36.0 | `1193377f1d574451740a7409a4102833ef868310` | 242 | `ac7225dd2e5f51551881f0c1d5eba284c64c2f019b08f00e572900319e89255b` |

Les deux reçus indiquent `nativeSourceUnchanged: true`. Le commit du candidat est sa base Git au moment de la mesure ; les modifications natives gelées sont identifiées par le digest `ac7225dd…`, pas par l’hypothèse que cette base contenait déjà ces modifications. La référence officielle reste V62/0.34.0 ; V63/0.35.0 sert aux diagnostics séparés et n’a pas été substituée à la référence budgétaire.

| Pièce | SHA-256 |
| --- | --- |
| Protocole préexistant | `3a5fd6ffc6b935618ab958c39fc1f70b926370f91242ca82df5da7220b98c80b` |
| Politique +10 % | `55e9530209b1b785c27474aa6085b2364995a99e894414078647007d0c0bfefb` |
| Runner officiel inchangé | `47686d5c3294cf9fde70b9699a0ea184b8b978257d8c45a0f36945f8beb37c59` |
| Comparateur officiel inchangé | `3be24f09690a00411d6c89a3f1557e3061a2cd472897db4f7a8e03e55dbff3fb` |
| Manifeste de cas inchangé | `7ca2508da22332eafaea53c1508d7363cec63cb0832cc6ea21713dbe331bace6` |
| Reçu baseline compressé | `9d07a9819748a58d4534b29ab39f3941834224a4717430ba99807fc1b900c9d5` |
| Reçu candidat compressé | `11a7629e79add8e6bc4778e8a16c38764daec02524225f00dcd41d55dfb0a77b` |

Les empreintes des deux déclarations et des trois traces publiques sont présentes dans les tableaux `inputs` des deux reçus ; leur égalité est vérifiée par le comparateur. Les reçus gzip sont les entrées exactes du résultat présenté, sans régénération de la campagne ni sélection d’une répétition favorable.

## Huit médianes sur chacun des trois cas

Toutes les durées des tableaux suivants sont en **millisecondes**. `n` est le nombre d’échantillons **par version**, identique avant et après, réunis sur les trois sessions. La variation est `100 × (médiane 0.36 / médiane V62 − 1)`. Le comparateur applique le seuil aux nombres complets ; les valeurs affichées sont arrondies à trois décimales. Les huit coûts sont imbriqués et **ne s’additionnent pas**.

| Mesure | Périmètre chronométré |
| --- | --- |
| Session complète | Replay complet dans le contrôleur, inspections finales exclues. |
| Nouvelle décision | Appel natif `plan`, incluant notamment le travail de restauration du caller et de l’autorité. |
| Continuation : service | Requête `advance` retournant une autre action du préfixe engagé : observation, garde et snapshot compris. |
| Continuation : requête | Même continuation, avec transport du worker et ordonnancement avant acceptation par le contrôleur. |
| Garde du préfixe | Appel natif `authorize` lorsque l’index du préfixe est supérieur à zéro. |
| Acquisition et persistance | Appel natif `seal`, comprenant les sous-travaux de persistance concernés. |
| Persistance | Appel natif `persistFamilies`. |
| Restauration des familles | Appel natif `restoreFamilies` uniquement ; ne contient pas toute la restauration caller/autorité. |

### STCK : 8/8 conformes au budget +10 %

| Mesure | n par version | Médiane V62 | Médiane 0.36 | Variation |
| --- | ---: | ---: | ---: | ---: |
| Session complète | 3 | 12999.340 | 11483.395 | -11.662 % |
| Nouvelle décision | 18 | 328.136 | 289.484 | -11.779 % |
| Continuation : service | 12 | 21.730 | 13.000 | -40.175 % |
| Continuation : requête | 12 | 23.842 | 15.177 | -36.344 % |
| Garde du préfixe | 12 | 0.272 | 0.188 | -30.974 % |
| Acquisition et persistance | 18 | 1130.428 | 947.964 | -16.141 % |
| Persistance | 39 | 197.502 | 182.124 | -7.786 % |
| Restauration des familles | 36 | 14.550 | 10.509 | -27.774 % |

### SMLP : 8/8 conformes au budget +10 %

| Mesure | n par version | Médiane V62 | Médiane 0.36 | Variation |
| --- | ---: | ---: | ---: | ---: |
| Session complète | 3 | 26070.602 | 25813.489 | -0.986 % |
| Nouvelle décision | 27 | 521.854 | 508.526 | -2.554 % |
| Continuation : service | 18 | 25.892 | 11.183 | -56.810 % |
| Continuation : requête | 18 | 28.645 | 13.401 | -53.218 % |
| Garde du préfixe | 18 | 0.440 | 0.358 | -18.742 % |
| Acquisition et persistance | 27 | 1980.001 | 1878.149 | -5.144 % |
| Persistance | 57 | 172.378 | 167.141 | -3.038 % |
| Restauration des familles | 54 | 5.268 | 5.355 | +1.649 % |

### LIFE : diagnostic prédéclaré, hors critères du budget

| Mesure | n par version | Médiane V62 | Médiane 0.36 | Variation |
| --- | ---: | ---: | ---: | ---: |
| Session complète | 3 | 119159.573 | 123195.011 | +3.387 % |
| Nouvelle décision | 141 | 510.096 | 523.394 | +2.607 % |
| Continuation : service | 6 | 70.666 | 54.771 | -22.494 % |
| Continuation : requête | 6 | 76.674 | 60.748 | -20.771 % |
| Garde du préfixe | 6 | 31.335 | 30.798 | -1.716 % |
| Acquisition et persistance | 141 | 1813.310 | 1831.979 | +1.030 % |
| Persistance | 285 | 326.317 | 329.620 | +1.012 % |
| Restauration des familles | 282 | 7.608 | 7.502 | -1.389 % |

La seule hausse médiane des seize contrôles est la restauration SMLP : **5,268 → 5,355 ms (+1,649 %)**. La session complète STCK baisse de **11,662 %**, celle de SMLP de **0,986 %** ; ces baisses ne servent pas à relâcher le critère local. Sur LIFE, les hausses médianes sont conservées : session **+3,387 %**, nouvelle décision **+2,607 %**, acquisition avec persistance **+1,030 %**, persistance **+1,012 %**. Elles ne sont pas requalifiées comme du bruit, et l’expérience ne démontre pas qu’elles auraient une cause unique.

## Extrêmes, p95 et dispersion entre sessions

Le p95 empirique utilise le rang `ceil(0,95 × n)` des échantillons triés. Il est volontairement absent lorsque `n < 20` (`—`) : ni les trois durées de session, ni les continuations de ces trajectoires, ni les gardes ne permettent ici de publier un p95. Même avec `n ≥ 20`, les observations d’une session sont corrélées ; ce p95 ne fournit pas un intervalle de confiance ni une borne garantie de latence.

La « dispersion des médianes » est `(maximum − minimum) / médiane` des **trois médianes de session**, exprimée en pourcentage. Le nom du champ brut est `roundMedianNoise`, mais cette dispersion observée n’identifie pas à elle seule une cause aléatoire. Elle n’est ajoutée ni aux dix pour cent autorisés, ni retranchée aux hausses mesurées. Sources de toutes les valeurs : [comparaison exacte](comparison.json).

### STCK : distributions conservées

| Mesure | Min–max V62 (ms) | Min–max 0.36 (ms) | p95 V62 → 0.36 (ms) | Dispersion médianes V62 → 0.36 |
| --- | ---: | ---: | ---: | ---: |
| Session complète | 12446.955–13204.972 | 11277.098–12076.028 | : → : | 5.831 % → 6.957 % |
| Nouvelle décision | 234.123–576.824 | 213.310–483.432 | : → : | 24.687 % → 24.894 % |
| Continuation : service | 19.981–29.145 | 8.068–24.266 | : → : | 30.944 % → 56.738 % |
| Continuation : requête | 22.025–31.739 | 9.847–27.128 | : → : | 29.905 % → 51.957 % |
| Garde du préfixe | 0.136–0.453 | 0.094–0.417 | : → : | 42.864 % → 86.082 % |
| Acquisition et persistance | 480.921–4806.288 | 439.201–4339.688 | : → : | 8.462 % → 8.058 % |
| Persistance | 15.793–469.582 | 14.777–499.625 | 404.749 → 426.361 | 23.141 % → 18.088 % |
| Restauration des familles | 2.028–89.101 | 1.643–93.831 | 82.228 → 84.970 | 34.469 % → 27.616 % |

### SMLP : distributions conservées

| Mesure | Min–max V62 (ms) | Min–max 0.36 (ms) | p95 V62 → 0.36 (ms) | Dispersion médianes V62 → 0.36 |
| --- | ---: | ---: | ---: | ---: |
| Session complète | 26016.836–28335.295 | 25569.604–25993.863 | : → : | 8.893 % → 1.644 % |
| Nouvelle décision | 221.343–3328.635 | 216.087–3701.475 | 3282.313 → 3331.330 | 19.918 % → 17.718 % |
| Continuation : service | 17.183–35.811 | 9.062–17.873 | : → : | 14.476 % → 10.248 % |
| Continuation : requête | 19.199–38.618 | 10.932–20.986 | : → : | 15.454 % → 7.767 % |
| Garde du préfixe | 0.201–4.608 | 0.202–0.662 | : → : | 8.403 % → 27.007 % |
| Acquisition et persistance | 331.218–3294.784 | 368.565–3451.738 | 3170.417 → 3140.269 | 20.775 % → 15.088 % |
| Persistance | 20.319–343.833 | 23.507–292.537 | 330.825 → 290.643 | 8.428 % → 13.342 % |
| Restauration des familles | 1.825–56.496 | 2.093–37.793 | 29.895 → 24.713 | 16.982 % → 8.919 % |

### LIFE : distributions conservées

| Mesure | Min–max V62 (ms) | Min–max 0.36 (ms) | p95 V62 → 0.36 (ms) | Dispersion médianes V62 → 0.36 |
| --- | ---: | ---: | ---: | ---: |
| Session complète | 118592.033–126130.139 | 118940.993–125012.322 | : → : | 6.326 % → 4.928 % |
| Nouvelle décision | 230.390–1981.886 | 239.591–2396.414 | 1003.947 → 947.281 | 18.360 % → 7.817 % |
| Continuation : service | 57.795–77.689 | 43.285–62.443 | : → : | 13.705 % → 13.748 % |
| Continuation : requête | 63.742–84.141 | 48.851–68.817 | : → : | 10.990 % → 13.842 % |
| Garde du préfixe | 24.174–35.126 | 23.835–34.725 | : → : | 26.113 % → 6.688 % |
| Acquisition et persistance | 602.977–5823.152 | 655.286–5649.244 | 3100.891 → 3147.589 | 6.297 % → 2.823 % |
| Persistance | 14.399–1554.886 | 13.246–1443.826 | 644.437 → 654.219 | 6.142 % → 10.949 % |
| Restauration des familles | 1.631–172.132 | 1.801–127.957 | 95.614 → 99.156 | 77.487 % → 16.431 % |

Les queues ne s’améliorent pas toutes avec les médianes. Le p95 de persistance STCK passe de **404,749 à 426,361 ms**, celui de restauration de **82,228 à 84,970 ms** ; leurs maxima augmentent également. Le p95 de nouvelle décision SMLP passe de **3 282,313 à 3 331,330 ms**. Sur LIFE, les p95 d’acquisition/persistance/restauration augmentent respectivement de **3 100,891 à 3 147,589 ms**, **644,437 à 654,219 ms** et **95,614 à 99,156 ms**. Le budget déclaré porte sur les médianes ; il ne constitue pas un engagement sur ces queues.

La dispersion relative après correction reste notamment de **56,738 %** pour le service de continuation STCK, **51,957 %** pour sa requête et **86,082 %** pour sa garde sous la milliseconde. Ces observations limitent la précision d’une généralisation des gains. Elles n’annulent ni le résultat conforme des médianes dans cette fenêtre, ni les hausses réellement observées ailleurs.

## Inspection après replay

Trois inspections sont réalisées après chacune des trois sessions : **9 échantillons par cas et version**, **54 inspections** au total. Elles sont exclues de `session_elapsed` et des temps de phase du replay. La mesure native couvre le service d’inspection ; la mesure de bout en bout inclut le transport worker. Aucun rendu de l’inspecteur dans le navigateur n’est mesuré. Tous les p95 sont absents car `n = 9`.

| Cas et mesure | n par version | Médiane V62 → 0.36 (ms) | Variation | Min–max V62 (ms) | Min–max 0.36 (ms) |
| --- | ---: | ---: | ---: | ---: | ---: |
| STCK : service natif | 9 | 201.881 → 193.219 | -4.290 % | 165.374–271.444 | 179.539–255.504 |
| STCK : bout en bout | 9 | 384.719 → 365.526 | -4.989 % | 308.962–473.071 | 313.096–408.247 |
| SMLP : service natif | 9 | 248.792 → 205.953 | -17.219 % | 192.599–290.756 | 184.756–280.729 |
| SMLP : bout en bout | 9 | 433.740 → 378.275 | -12.788 % | 345.502–474.160 | 328.296–450.921 |
| LIFE : service natif | 9 | 1232.353 → 1199.839 | -2.638 % | 1106.107–1526.952 | 1120.943–1468.228 |
| LIFE : bout en bout | 9 | 2240.402 → 2148.364 | -4.108 % | 2009.185–2645.259 | 1996.747–2458.464 |

Ces mesures sont descriptives et ne font pas partie des seize critères. Elles ne permettent pas d’annoncer le temps d’affichage d’un graphe dans l’interface.

## Pause : accusé du contrôleur et frontière sûre

Deux demandes Pause sont placées dans chaque session mesurée : pendant la planification initiale et pendant la première action engagée. Cela donne **3 échantillons par point, cas et version**, soit **36 demandes** au total. Toutes sont reconnues comme pausées ; les frontières sûres vérifiées restent à **0 action exécutée** pendant la planification initiale et **1 action acquise** pour l’action déjà engagée. Les durées ci-dessous sont distinctes : la reconnaissance par le contrôleur n’est pas la fin du travail en vol. Tous les p95 sont absents (`n = 3`).

| Cas et point | Mesure | Médiane V62 → 0.36 (ms) | Variation | Min–max V62 (ms) | Min–max 0.36 (ms) |
| --- | --- | ---: | ---: | ---: | ---: |
| STCK : planification | Accusé du contrôleur | 0.009764 → 0.007861 | -19.490 % | 0.005849–0.047811 | 0.005728–0.034541 |
| STCK : planification | Frontière sûre | 1186.820 → 1092.217 | -7.971 % | 1078.085–1270.319 | 1007.246–1092.329 |
| STCK : action engagée | Accusé du contrôleur | 0.013000 → 0.012308 | -5.323 % | 0.008062–0.013510 | 0.011778–0.012599 |
| STCK : action engagée | Frontière sûre | 1006.322 → 901.845 | -10.382 % | 859.688–1111.219 | 805.402–903.372 |
| SMLP : planification | Accusé du contrôleur | 0.014822 → 0.011307 | -23.715 % | 0.011948–0.034631 | 0.007471–0.012749 |
| SMLP : planification | Frontière sûre | 4005.886 → 4163.748 | +3.941 % | 3976.652–4159.079 | 3859.475–4517.631 |
| SMLP : action engagée | Accusé du contrôleur | 0.016185 → 0.016554 | +2.280 % | 0.005688–0.039338 | 0.005598–0.071817 |
| SMLP : action engagée | Frontière sûre | 2328.133 → 2114.507 | -9.176 % | 2202.649–2390.354 | 1802.608–2250.301 |
| LIFE : planification | Accusé du contrôleur | 0.005048 → 0.003885 | -23.039 % | 0.003315–0.005638 | 0.002915–0.004867 |
| LIFE : planification | Frontière sûre | 1032.278 → 1089.384 | +5.532 % | 978.970–1108.914 | 990.583–1384.324 |
| LIFE : action engagée | Accusé du contrôleur | 0.004346 → 0.004227 | -2.738 % | 0.004327–0.005659 | 0.004126–0.005448 |
| LIFE : action engagée | Frontière sûre | 835.741 → 1009.530 | +20.795 % | 834.207–1041.700 | 902.224–1043.976 |

Les hausses de frontière sûre sont explicites : **SMLP planification +3,941 %**, **LIFE planification +5,532 %**, **LIFE première action engagée +20,795 %**. Ce dernier point passe de **835,741 à 1 009,530 ms**, hors des seize métriques du budget déclaré. Il demeure un résultat observé, sans exemption fondée sur la dispersion et sans affirmation de non-régression universelle de Pause. Ces deux points ne testent pas une interruption au milieu de n’importe quelle recherche longue ni un temps de réaction de l’interface graphique.

## Sous-ensemble LIFE sélectionné par le type de proposition

Le comparateur conserve les échantillons dont `proposalKind` vaut `typed_pose_dependency`. Il s’agit d’un diagnostic préexistant de ce chemin de décision, pas d’une nouvelle sélection destinée à améliorer le score. STCK et SMLP n’ont pas de tels échantillons. Tous les p95 du sous-ensemble LIFE sont absents car les effectifs restent inférieurs à vingt.

| Mesure | n par version | Médiane V62 → 0.36 (ms) | Variation | Maximum V62 → 0.36 (ms) |
| --- | ---: | ---: | ---: | ---: |
| Nouvelle décision | 12 | 750.644 → 689.918 | -8.090 % | 1265.152 → 989.323 |
| Garde du préfixe | 6 | 31.335 → 30.798 | -1.716 % | 35.126 → 34.725 |
| Acquisition et persistance | 12 | 2794.088 → 2834.935 | +1.462 % | 5823.152 → 5649.244 |
| Persistance | 12 | 507.297 → 541.635 | +6.769 % | 863.260 → 731.027 |
| Restauration des familles | 12 | 84.344 → 84.292 | -0.062 % | 128.309 → 107.984 |

Les hausses médianes de ce sous-ensemble sont **+1,462 %** pour acquisition/persistance et **+6,769 %** pour persistance. Les coûts restent imbriqués. Ce sous-ensemble ne suffit pas à attribuer l’évolution de toute la session LIFE à ce seul mécanisme.

## Historique préservé et portée causale

La livraison 63 / natif 0.35.0 avait obtenu **14/16** médianes conformes lors de la première comparaison, puis le suivi STCK avait conservé **cinq dépassements sur huit**. Les reçus et le [rapport historique](../../lot2c-evidence/performance/results.md) restent inchangés. La réussite présente est une nouvelle validation du candidat 0.36.0 contre une référence V62 fraîche, avec le même seuil et les mêmes critères ; elle ne transforme pas les essais précédents en réussites.

Les [diagnostics séparés](../diagnostic/results.md) ont localisé du travail redondant et vérifié des propriétés sémantiques sur STCK. Ils comparent notamment V63 et le candidat par appels directs du service, sur une session instrumentée, avec des coûts imbriqués. Ils ne sont pas les reçus officiels de budget et ne prouvent pas une cause unique des variations V62/V63, ni une décomposition additive du gain 0.36. Plusieurs corrections génériques composent le candidat ; le présent passage ne les isole pas individuellement.

La validation officielle porte sur des retours publics enregistrés et des commandes vérifiées. L’exécution du jeu est remplacée par ces retours (`executionMs = 0`) ; `recorded_host_lookup_and_copy` mesure la vérification et la copie locales, pas le moteur du jeu. Le rendu navigateur, le réseau et l’hébergement externe sont exclus. Une session LIFE finie de 49 actions, ses nœuds retenus et les observations de heap/RSS ne démontrent ni stabilité mémoire sur plusieurs heures ni absence de fuite. Aucun intervalle de confiance, avantage matériel indépendant ou garantie générale de latence n’est revendiqué.

**Décision : volet budget de coût 2C conforme dans le périmètre prédéclaré.** Le seuil reste +10 % sur chacune des seize médianes STCK/SMLP, sans retrait de métrique, sans marge ajoutée pour la dispersion et sans relance choisie pour un meilleur ratio. Les hausses et les limites ci-dessus restent attachées à cette clôture ; la parité complète du moteur et les autres validations conservent leur propre périmètre.

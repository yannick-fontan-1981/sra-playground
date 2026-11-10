# Lot 3E : filiation du service de réception

## Périmètre

Le lot transfère la couche propre `reception_service_plan` dans `SharedSeriesConstraint`, à la cinquième des six branches raccordées d'`observed_composition_services`. Les originaux restent ceux du commit **`786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`**. L'exporteur vérifie les **1 786 fichiers originaux avant et après** l'exécution, sans les modifier.

Le transfert comprend la projection du réseau de cases, des supports concaves, des silhouettes homologues et du porteur ; les sondages de commande ; l'accès conditionnel ; l'attente bornée ; les gardes ; l'acquisition propre et sa restauration. Il reprend le contrat V5 `ReceptionWaitBudgetD` dans son domaine JSON portable et le sous-graphe de `ResidualAccess` effectivement consommé pour conserver les observations de constellations répétées. Il ne transfère pas la navigation ni les prévisions temporelles de ce dernier module.

La classe source hérite de RootedLine, Panel, Chamber, Exposed et d'autres couches encore incomplètement transférées. Les tests de composant comparent la couche propre avec une frontière de digest parent opaque. **Ils ne certifient ni le digest hérité complet ni la sélection complète de l'agent Python.** Les adaptations natives de propriété, d'époque et de budget ci-dessous sont explicites et vérifiées séparément. Une projection admise et des retours synthétiques ne prouvent pas la résolution d'un jeu.

## Sources et cibles

| Source originale | Contrat consommé | Cible native | Portée |
| --- | --- | --- | --- |
| V6 `laya_proto/reception_service_projection.py` | `sides`, `scene`, `carriers`, `path` | [v6-reception-service-observation.ts](../../src/logos-engine/v6-reception-service-observation.ts) | Projection propre et chemin fini |
| V6 `laya_proto/reception_service_access.py` | Mémoire, proposition, gardes, acquisition et suffixe de digest propres | [v6-reception-service-access.ts](../../src/logos-engine/v6-reception-service-access.ts) | Couche propre vérifiée ; héritage complet partiel |
| V6 `laya_proto/residual_access.py` | `record`, `apply_event`, état et digest du réducteur consommé ; groupes, ancrages et surface d'entrée | [v6-reception-residual-evidence.ts](../../src/logos-engine/v6-reception-residual-evidence.ts) | Sous-graphe de preuve ; proposition, navigation et horloge temporelle exclues |
| V5 `capabilities/reception_wait_contracts_d.py` | Références, portée, horloge observée et deux compteurs indépendants dans `[0,128]` | [v5-reception-wait-contracts.ts](../../src/logos-engine/v5-reception-wait-contracts.ts) | Valeurs JSON normalisées et entiers sûrs, sans toutes les coercitions Python |
| V6 `laya_proto/common_observed_compositions.py` | Sélection, enveloppe, propriété, journal et restauration de la branche | [v6-shared-series.ts](../../src/logos-engine/v6-shared-series.ts) | Façade native partielle, cinq branches sur six |
| V6 `morphology_policy/strategy.drm` | `reception_service_question`, raisons, ordre des sondages et taille du lot d'attente | Politique source consommée par le propriétaire commun | Aucun nom de jeu, rôle de couleur ni trajectoire enregistrée |

Les modules V5 `relational_reception.py` et `hidden_motion_reception.py` ne sont pas des dépendances exécutées par cette couche V6. Le texte de politique les cite comme filiation conceptuelle ; cela ne permet pas de les compter comme transférés. Seul le contrat `ReceptionWaitBudgetD` est importé et consommé ici.

## Projection et hypothèses

La projection mesure des carrés séparés formant une bordure, leur pas et les cellules internes. Elle recherche les supports concaves présentant trois côtés complets et distingue un support par sa multiplicité de couleur dans l'ensemble observé. Les couleurs restent des descripteurs locaux. Une silhouette affichée sous la bordure doit avoir un homologue mesuré dans le monde ; la correspondance établit une question de réception, pas une loi terminale.

Le porteur est une constellation de quatre coins de même valeur, différente du fond, avec des intérieurs de bords qui ne portent pas cette valeur. Aucun acteur n'est choisi si plusieurs constellations sont admissibles. Le support retenu peut survivre au recouvrement de ses seuls coins ; une altération de ses autres pixels invalide cette réutilisation. Les homologues peuvent être conservés lorsque leur observation courante manque, selon le contrat source. Ce maintien est une hypothèse conditionnelle portée par le plan et son layout, pas une nouvelle mesure de silhouette.

La sélection d'une bordure conserve l'ordre lexicographique des tuples Python, y compris en cas d'égalité du nombre de carrés. Le chemin en largeur trie les commandes et visite les cellules dont au moins la moitié est du fond. Il évite les autres supports mesurés par précaution de préservation, sans les déclarer murs. Il rend le chemin complet vers le support ou, à défaut, le meilleur rapprochement strict. Si aucun rapprochement n'existe, ou si le chemin dépasse les actions restantes, il rend une absence de chemin et laisse la question ouverte.

## Proposition et acquisition propres

La proposition délègue si la question ou la scène manque. Une scène reconnue avec échéance atteinte, un contrôle réfuté ou une question d'accès non résolue produit un refus `unknown` bloquant les sondages sans rapport. Les noms de commandes ne fournissent aucune direction. Un contrôle devient provisoire seulement après un retour effectif donnant une translation sur un seul axe et d'un pas mesuré exactement.

Une fois des contrôles acquis, l'accès reste conditionnel à la géométrie courante. Au support, une commande acquise orientée hors du réseau motive un premier essai stationnaire d'une seule action. Seul son retour observé sans déplacement autorise ensuite un lot d'attente, limité par la taille source de huit, le préfixe, les actions restantes et le cumul du registre d'attente. L'arrivée, la trajectoire cachée et la phase temporelle restent inconnues.

La garde initiale lie l'identité du plan, les commandes du plan et du bundle, l'époque, le score, le layout, la frame, la référence d'observation et la disponibilité de la commande. Une continuation exige un porteur unique à l'ancrage précédent attendu. Après action, une frontière d'époque ou de score, une absence de porteur unique ou une divergence ferme le préfixe. Le sondage sans projection prévue ferme aussi le préfixe.

**Limite conservée de la continuation :** le `layout` source ne contient pas l'identité des silhouettes homologues de la demande. Après la première action, la garde ne compare pas séparément ces homologues à ceux du plan. Une demande qui change avec le même layout et le même ancrage de porteur peut donc laisser le reste du lot admis. La frame entière lie bien la première action ; elle n'est pas revalidée intégralement à chaque continuation. Les adaptations natives d'époque et de budget ne corrigent pas cette limite. Le lot ne revendique pas une interruption garantie à tout changement de demande.

L'acquisition distingue l'absence de scène, l'absence de déplacement, l'ambiguïté et la réfutation. Une attente effective consomme une unité même si la projection suivante manque ; une frontière d'époque ne la consomme pas. Une variation de score seule ferme le préfixe dans la garde mais ne devient pas une frontière d'époque pour le réducteur. Les références avant/après restent acquises et dédupliquées.

Le réducteur de constellations garde le produit cartésien des positions retirées et apparues avant toute attribution. Une translation commune ne devient un rôle que si les ensembles correspondants concordent exactement. Les occurrences stationnaires sont annulées explicitement. Les arrivées multiples ou absentes restent ambiguës ; une transition, une surface d'entrée, une visite et une réfutation ne sont jamais assimilées à une loi causale générale. Son journal est conservé dans `reception_memory.residual_events` et reconstruit avant chaque retour propre.

## Écarts de source conservés et adaptations natives

Les contre-exemples proviennent des originaux exécutés, sans patch ni remplacement de résultat attendu. Ils figurent dans `sourceAliasCases`, `sourceExceptions` et les cas de proposition/acquisition de la [fixture](../../tests/fixtures/v6-reception-service-reference.json.gz).

| Comportement original constaté | Conséquence observée | Contrat natif commun explicite |
| --- | --- | --- |
| Exposed et Reception utilisent le même attribut `self.reception_events` | Un événement Exposed seul rend ce journal non vide. La première acquisition Reception prend alors sa mémoire initiale acquise au lieu de la mémoire de proposition réinitialisée ; son époque peut rester `None`. Les deux couches de digest incluent ensuite le même journal. | Deux propriétaires de journal distincts, routés par type d'événement. Exposed ne peut initialiser ni modifier le journal propre Reception. Les checkpoints 0.45 gardent leur digest tant que Reception n'a aucun événement propre. |
| La proposition réinitialise l'époque dans une copie, mais `record` reprend la mémoire acquise dès qu'un événement existe | Après changement d'époque, le cumul d'attente, les contrôles et les réfutations de l'ancienne mémoire peuvent réapparaître ; le nouvel état d'époque ne devient pas acquis. | Option native `currentEpochAcquisition` : le premier retour d'une proposition courante acquiert sa réinitialisation liée à l'époque ; les retours suivants utilisent la nouvelle mémoire acquise et ne répètent pas la remise à zéro. |
| La remise à zéro source ne supprime pas `stationary` | Une ancienne confirmation stationnaire peut être retrouvée aux mêmes coordonnées après changement d'époque et réacquisition de la commande. | La confirmation stationnaire est retirée lors de la proposition puis de l'acquisition du nouvel état d'époque. Un nouveau retour réel sans déplacement est nécessaire avant un lot d'attente. |
| Le registre V5 impose un maximum de 128, tandis que le budget restant du niveau peut être supérieur | La construction originale lève `ValidationError`, notamment pour une valeur de 600. | Option native `native_reception_wait_budget` : le maximum d'attente est le minimum de 128 et du maximum déclaré. Le budget général de niveau reste indépendant. |
| Après épuisement du registre, la source peut retomber sur une commande de sondage tout en gardant `kind = reception_observation` | Une nouvelle commande sans projection peut être proposée et comptée comme attente après le plafond. | L'épuisement produit `reception_wait_budget_exhausted` avec `block_unrelated_probe`, sans acquisition ni sondage de repli. |

Ces options sont activées par le propriétaire commun. L'API propre par défaut conserve les résultats source afin de vérifier leur transfert exact sur le domaine consommé. La normalisation native exige des entiers sûrs et des références non vides ; elle n'imite pas les conversions implicites Python. Le contrat V5 vérifie séparément les deux compteurs dans `[0,128]` et permet `spent > maximum` : le refus d'épuisement appartient à l'appelant.

Le filtre commun `remaining < 1` reste responsable de l'absence de proposition physique lorsque le budget général est nul. Un cas original montrant un premier essai stationnaire malgré `remaining_level_actions = 0` reste conservé dans la fixture ; il ne fournit pas une permission au runtime commun.

## Propriétaire commun et restauration

| Opération | Ordre et propriété du périmètre transféré |
| --- | --- |
| Proposition et gardes | Reception, RootedLine, Panel, Chamber, Exposed, puis ancêtres transférés |
| Candidats de point | Aucun nouveau générateur propre Reception ; générateurs existants conservés |
| Acquisition | Ancêtres, Exposed, Chamber, Panel, RootedLine, Reception, puis paquet public commun |
| Journal | Un seul événement `observed_reception_service` par retour sélectionné ; les événements Exposed restent dans leur propre propriétaire |
| Digest | Suffixe propre conditionnel après RootedLine, absent avant la première acquisition Reception |
| Restauration | Réducteurs temporaires, vérification complète et publication atomique ; identité, révision et témoin structurel de Reception participent au certificat commun |

L'option native d'acquisition d'époque ne change pas le replay d'événements déjà acquis : restaurer rejoue les événements conservés, sans les réinterpréter. Le cumul d'attente survit à la restauration et à un nouveau préfixe. Seul un changement d'époque effectivement acquis peut commencer un nouveau cumul, avec confirmation stationnaire renouvelée. Un restore erroné ne doit modifier aucun autre propriétaire.

`ReferencePopulation` reste à transférer. L'héritage EphemeralMap, les autres fermetures de l'appelant Python et son digest complet gardent leurs limites antérieures. Les noms de branches, les entrées du registre et les workflows compilés conservent des dénominateurs distincts.

## Oracles et revue indépendante

Le [reçu de l'exporteur](lot3e-evidence/diagnostic/source-oracle-export.json) lie le [générateur](../../scripts/export-v6-reception-service-reference.py), la [fixture](../../tests/fixtures/v6-reception-service-reference.json.gz), les empreintes des sources et les vérifications des 1 786 originaux.

| Preuve indépendante | Contenu conservé |
| --- | --- |
| Cas de composant propres | **82** : 22 scènes, 12 détections de porteurs, 7 chemins, 3 mesures de côtés, 23 propositions, 14 acquisitions et 1 restauration |
| Gardes source | **26** : liaison initiale, continuation, mutations, disponibilité, époque, score, observation, absence et divergence |
| Réducteur de constellations | **12** cas exacts, sur de petites images complètes distinctes du renderer Reception ; rôle nouveau, transition, ambiguïté, absence, frontière et résultat sélectionné |
| Registre V5 | **10** cas, y compris les bornes, les dépassements, les compteurs négatifs et `spent > maximum` admis par le modèle source |
| Contre-exemples hérités | **1** cas de journal partagé et **2** exceptions source conservées, en plus des cas d'époque, de confirmation stationnaire et d'épuisement |
| Projection publique initiale | **98** images déjà archivées, zéro nouvelle action et zéro saut de niveau ; CWSE et SK48 exclus avant chaque appel |

Le [scan public](lot3e-evidence/diagnostic/reception-public-admission.json) ne trouve qu'un cas admis par la projection source : **FOGW**. Cette observation structurelle permet de choisir un cas pertinent ; elle ne fournit ni solution, ni résultat de l'appelant commun, ni preuve de niveau réussi. Aucun moteur, spécification ou trajet de jeu n'entre dans ces oracles.

La [revue indépendante des adaptations natives](lot3e-evidence/diagnostic/native-contract-review.json) passe **14/14 tests**. Elle consomme exactement **128 attentes synthétiques**, vérifie **quatre restaurations intermédiaires**, puis retrouve un refus bloquant répété alors que le budget général de 600 garde **472 actions**. Les deux plafonds restent distincts. Ces retours synthétiques vérifient le registre et les gardes ; ils ne sont pas des actions de campagne FOGW.

Les résultats de la campagne réelle, de la contribution, de la validation formelle, du navigateur et des mesures de coût figurent dans les reçus de livraison séparés. Aucun succès de jeu ni verdict de coût n'est déduit de cette filiation de composant.

## Rejeu froid du trajet public FOGW

Le [rejeu source public](lot3e-evidence/diagnostic/fogw-public-source-replay.json.gz) repart d'une mémoire Reception vide et n'acquiert que les commandes et retours déjà exécutés dans la campagne native. Les observations complètes proviennent des appels d'inventaire capturés et sont liées aux paquets publics correspondants. La mémoire d'une proposition native ne sert jamais à initialiser ce rejeu. Le [script](lot3e-evidence/diagnostic/replay-reception-public.py) ne charge aucun jeu et ne modifie aucun original.

Deux chemins de comparaison restent distincts. **L'original intact concorde sur les sept premiers préfixes et quinze retours**, puis lève sa propre `ValidationError` à la première attente, révision 16 : son maximum de **585 actions restantes** dépasse le plafond V5 de 128. L'exception et l'absence de modification de mémoire lors de cet échec sont conservées. Il n'existe donc pas de parité exacte de l'original intact sur toute la campagne.

Un second chemin appelle les **mêmes méthodes originales inchangées** au travers de l'enveloppe native explicitement déclarée dans ce document : plafond d'attente séparé, refus d'épuisement, acquisition de la nouvelle époque au retour, renouvellement stationnaire et journal propre séparé. Il reconstruit ses états uniquement depuis ses propres événements produits sur les retours publics antérieurs. Ce chemin concorde sur les **27 préfixes et 50 retours**, sans différence. Il est qualifié de comparaison avec adaptations natives déclarées, et non de parité complète de l'appelant Python.

Les **1 786 originaux** sont à nouveau vérifiés avant et après. Les délais physiques sont omis dans ce rejeu déterministe d'un travail déjà exécuté ; le budget d'actions par niveau, les cellules observées, les commandes disponibles et le registre d'attente sont conservés. La vérification native indépendante, ses restaurations, ses compteurs et ses empreintes sont détaillés dans le [reçu de comparaison](lot3e-evidence/diagnostic/fogw-public-parity.json).

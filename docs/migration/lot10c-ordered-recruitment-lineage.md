# Lot 10C : OrderedRecruitment

## État du travail

Le composant `ordered_recruitment` est porté dans le moteur TypeScript et raccordé au propriétaire commun `public_ordered_recruitment`. Le développement part du moteur publié 0.62 / Site 103 et de son checkpoint documentaire `2981a62d456802d39dcde316734793e905fb0ebf`.

La [suite affectée du jalon historique `315 / bb7…`](lot10c-evidence/development/recr01-source/validation/delta-tests-run.json) passe **1 382/1 382 tests dans 46 fichiers**, dont **173 tests de référence originale et quatre tests du noyau commun**. Les **cinq contrôles du projet passent, compilation Sites effectivement exécutée comprise**. Les populations incluses ne sont pas additionnées. Le checkpoint source `17fdae6ec7d3544db1c69bef41d58a2deaa81a96` a été vérifié sur sa branche distante de sources le **11 novembre 2026 à 14:45:34 (UTC−03)**.

Sur ce même gel historique, la campagne réelle RECR01 atteint naturellement **trois niveaux en 17 actions** et la comparaison répétée avec l'original passe sur le composant. Le contrôle navigateur passe. Les dix régressions passent leurs 170 contrôles ; la qualification finale après intégration des prédécesseurs publiés, le coût officiel et la publication 10C restent à établir. Le Site effectivement publié reste **103 / native 0.62** ; **0.66 est seulement proposée pour 10C**. La [feuille de route actualisée](v6-delivery-roadmap.md) conserve la file 5C / 0.63, 6B / 0.64 puis 8A / 0.65 avant cette finalisation.

## Composition 329 : qualification fonctionnelle et intégrité passées

La [qualification de reprise](lot10c-evidence/recovery-20261111/functional-qualification.md) établit **1 767/1 767 tests formels dans 56 modules**, cinq contrôles de projet avec compilation fraîche, **dix rejeux / 170 contrôles plus KATA distinct / 17 contrôles** et une [intégrité complète passée](lot10c-evidence/recovery-20261111/composed-functional02/delivery-integrity.json). Le [bilan structuré](lot10c-evidence/recovery-20261111/functional-summary.json) lie les reçus. Les anciens quatre groupes de développement restent historiques ; la tentative formelle de 600 secondes incomplète est conservée sans acceptation.

Le gel conserve **329 fichiers natifs**, digest `ab674682f3345b09bec94959174fbb5bf0f1bd06154693697e5814987b572316`, **816 fichiers archivés** et **68/76 entrées raccordées**. Il réunit la composition native `dd864cc645b1e9789e51d1a6c1498f4d0b18aa6f`, puis le gel des helpers `783dc3c2d7f8b2d8902f4448ef065264b9a79db7`, avec les sources préparées 5C `722c949e…`, 6B `a01e6faf…` et 8A `7c10456a…`. Les sources natives et les tests sont identiques au checkpoint `3df0fc780f479e51f51aaceb2a32ec287b67671d` pendant cette reprise. La [sauvegarde de ce précédent jalon](lot10c-evidence/coordination/checkpoint04.json) et ses 18 envois restent conservés.

Les nouveaux rejeux portent bien sur **329 / `ab674682…`**. Les campagnes RECR, comparaison originale et navigateur détaillées ci-dessous restent exclusivement attachées à **315 / `bb7…`**. Le budget RECR est inchangé : **642,824027506 secondes consommées / 1 757,175972494 restantes**. HPDL reste partiel, LKEY fermé et la parité complète de l'appelant reste non établie.

La [politique ordinaire](lot10-ordinary-work-policy.md), complétée pour [campagnes et revues](lot10-ordinary-case-work-policy.md), retire le verrou global et les attentes de calme/publication du développement, des tests fonctionnels, builds, commits et pushs. Les **19 contrôles courts simulés** passent ; les anciens helpers exécutés restent inchangés. Les mesures officielles et la publication gardent uniquement leurs exclusivités courtes ; les registres gardent leur verrou propre au cas. Aucun verrou détenu n'a été supprimé.

Les [six commits de preuves](lot10c-evidence/recovery-20261111/transport/review.json) sont poussés et vérifiés jusqu'à `4622babc20ae32d9421d3cdeeaebaa84a48befac` : **239 fichiers / 113 240 191 octets bruts**. La [conservation](lot10c-evidence/recovery-20261111/storage-review.json) reconstruit les dix rapports et KATA à l'identique depuis leurs fragments. La [publication reconsultée](lot10c-evidence/recovery-20261111/publication-observation-final.json) reste **Site 103 / native 0.62**, accès et révision 3 conservés ; les pushs de branche ne publient pas 0.66.

## Sources et cible

Le V6 original est conservé à la révision `786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`. Aucun fichier original n'est modifié.

| Source originale | Cible native | Contrat conservé |
|---|---|---|
| `ordered_recruitment/geometry.py` | `v6-ordered-recruitment-geometry.ts` | Composants publics, légende, connecteurs, ordre des salles, spirale des files, boutons et quotas ; refus hors domaine mesuré. |
| `ordered_recruitment/projection.py` | `v6-ordered-recruitment-projection.ts` | Recherche conditionnelle dans l'ordre source, réduction locale, continuations et tous les plans/traces ; une recherche incomplète n'établit pas l'impossibilité. |
| V5 `ordered_front_reduction_d.py` et modèles consommés | `v5-ordered-front-reduction.ts` | Réduction effectivement appelée, requêtes, règles de duel/rang/égalité, bornes, frontière et reprise. |
| `ordered_recruitment/policy.py`, `recruitment.drm`, `recruitment.src` | `v6-ordered-recruitment-policy.ts` | Exécution réelle de `v6.ordered_recruitment.choose` et de son callback `recruitment.select` ; priorité, coût, survivants puis ordre source. |
| `ordered_recruitment/family.py` | `v6-ordered-recruitment.ts` | État source, calibration par retour, propositions, garde courante, acquisition et revalidation. |
| Appelant commun et ordre DRM | `v6-native-runtime.ts` | Un propriétaire, entrée déclarée à sa position source, WHY/ACT, acquisition unique, persistance et restauration communes. |

Les sept champs source sont `epoch`, `order`, `methods`, `portable`, `attempts`, `continuation` et `last`. Le checkpoint natif complet conserve ces champs séparément de la publication conditionnelle de `recruitment_state`.

## Acquisition et autorisation

Une méthode de légende provient du contraste réellement retourné : passage COMBAT vers RECRUIT, même salle, file alliée conservée, ennemi unique disparu et correspondance de légende unique. La projection ne transforme pas cette observation locale en loi complète des affrontements futurs.

Le propriétaire sélectionné reçoit son retour une seule fois. Le passage passif exclut ce propriétaire, puis traite les retours étrangers à la position originale, après Workshop et avant les propriétaires suivants. Les paquets d'animation publics complets sont transmis.

Le Python original n'a pas de branche `recruitment_plan` dans son choix de clé pour le retour sélectionné. **La clé active reste donc `window_constraint:<revision>` ; la clé passive est `recruitment_event:<revision>`.** Ce détail est conservé et vérifié dans le noyau commun.

`recruitment_state` est publié/restauré lorsque `methods`, `portable` ou `attempts` est non vide. L'ordre et le dernier constat seuls restent conservés dans le checkpoint complet sans inventer de méthode source publiée.

Chaque action proposée garde `expected_after:null`. La garde recontrôle l'observation, l'époque, la trame, la légende, la file, les boutons et la charge exacte. Un plan retenu n'autorise pas directement une action. Une continuation exige le contexte courant attendu et les mêmes légende et ordre ; le retour effectif la confirme ou la réfute. Aux frontières, les méthodes portables gardent l'autorité `revisable_method_not_current_permit`.

## Preuve indépendante

L'exportateur exécute les fonctions Python originales. Les sorties attendues ne proviennent pas du port natif.

- **1 786 fichiers originaux** vérifiés avant et après chaque génération.
- **726 fichiers consommés** identifiés par empreinte ; **4 389 entrées de profil d'appels** conservées.
- Fixture finale : **1 008 627 octets**, SHA-256 `bfcc4444286bd5a55252eacd11f6cdc06cbf0163924796a9debef302586f2460`.
- **166 cas, trois résumés et quatre contrôles de provenance/cache/état : 173/173 tests passés**.
- Le cache original est réellement exercé : **31 accès, 28 appels au V5, trois réutilisations**.

Les comparaisons gardent les mesures, les plans complets, les actions, les traces de consommation, les propositions, les liaisons de point, les reçus DRM/SRC, les gardes et les sept champs d'état. Les anciennes fixtures et les échecs initiaux restent dans [oracle](lot10c-evidence/oracle/). Le reçu final est [reference-tests-03.execution.json](lot10c-evidence/oracle/reference-tests-03.execution.json).

Le [contrat source détaillé](lot10c-evidence/source-contract.md) précise les fonctions consommées, les cas et les limites de domaine.

## Boucle froide du noyau commun

Le scénario synthétique démarre sans méthode acquise et emploie la vraie fabrique commune. Une primitive étrangère est réellement libérée, puis son retour public calibre la méthode. La décision suivante exécute le programme SRC, passe par OP18/WHY-ACT et libère un append courant. Le retour passe par OP29/OP30/OP31, conserve l'événement et le checkpoint, puis une restauration depuis le graphe commun permet la continuation suivante.

Les quatre tests vérifient également l'identité unique du propriétaire, le contexte d'exécution courant après annulation d'un ancien appel, le refus d'une garde périmée, la non-répétition d'une tentative sans effet et la conservation d'un état sans méthode publiable. Aucune connaissance apprise n'est injectée pour établir la première acquisition. Les restaurations délibérées vers un propriétaire froid vérifient que seul le checkpoint commun restitue la connaissance réellement acquise.

Le reçu [kernel-attempt03/run.json](lot10c-evidence/development/kernel-attempt03/run.json) établit **4/4 tests passés** sur une fixture et un test inchangés. Les deux tentatives antérieures restent conservées : la première avait une hypothèse erronée du test sur la forme de la commande ; la seconde omettait une image du paquet de retour fourni par l'oracle. Les entrées du test ont été raccordées à la commande réellement observée et au paquet original complet, sans retoucher les sorties attendues.

## Adaptations natives déclarées

Le chemin source conserve l'ordre et les sorties originales, y compris les plans déjà obtenus lorsque la borne source est atteinte. Le chemin natif coopératif applique des bornes d'exécution et refuse explicitement les recherches interrompues ou incomplètes. Il conserve la raison et la frontière ; cette adaptation ne constitue pas une preuve de parité exacte pour un appel interrompu.

La recherche native vérifie le signal et l'échéance du contexte d'exécution courant. Ses bornes par défaut sont 50 000 visites et 1 000 ms, avec restitution coopérative toutes les 32 étapes. Chaque réduction V5 conserve ses propres bornes source de 4 096 et 1 000 ms.

Le domaine portable impose des entiers exactement représentables. Deux frontières sont explicitement testées : un entier dépassant la précision sûre JavaScript et le digest générique contenant `2.5`. Les sorties Python correspondantes sont conservées ; le refus natif reste une limite déclarée, sans égalité hors domaine inventée.

## Campagne RECR01 et comparaison originale réelle

RECR, « Recruit Army », a été choisi à partir du titre et de la description du catalogue public. Le [gel de développement](lot10c-evidence/development/recr01-source/source-manifest.json) lie **315 fichiers natifs** au digest `bb7d62b5823d76ae7a5ecd452cb622ebb04f2b85b20fb0d2f9a5c35a1535b361`. La [campagne réelle démarrée à froid](lot10c-evidence/development/recr01/execution-recruitment.json) est **PASS sur sa cible de trois niveaux, avec 17 actions**, pour **103,622933254 secondes débitées**. Le dernier état public est `levelsCompleted: 3`, `level: 4`, `reason: target_levels_completed`, `state: NOT_FINISHED`. La cible déclarée est atteinte ; la fin du jeu entier n'est pas revendiquée.

La [première comparaison originale](lot10c-evidence/development/recr01-parity/execution.json) a terminé par `SIGSEGV` vers 90,25 secondes, pendant le troisième relevé périodique facultatif de traceback. Les 45 appels et 96 ablations en progression n'avaient rapporté aucune divergence, mais aucun rapport complet n'avait été produit. L'échec, ses sorties brutes et son débit de **118,063969094 secondes** sont conservés. Cette concomitance n'établit pas la cause du signal.

Le relevé périodique facultatif et son nettoyage ont été retirés. La [revue statique indépendante](lot10c-evidence/development/recr01-parity-diagnosis/static-change-check.json) établit que **26 fonctions de comparaison sont inchangées par AST**. Les diagnostics fatals, la progression immédiatement écrite, le profilage original, les comparaisons source et la borne externe de 240 secondes sont maintenus. Cette modification contient le diagnostic facultatif ; son examen statique ne prouve pas la cause du crash.

La [seconde comparaison](lot10c-evidence/development/recr01-parity02/original-parity.json.gz) est **PASS, code de sortie 0**, avec des entrées, originaux et liaison native inchangés. Son [reçu d'exécution](lot10c-evidence/development/recr01-parity02/execution.json) conserve **120,627604822 secondes de lecteur et 120,732553873 secondes débitées**.

| Contrôle réel | Résultat |
| --- | --- |
| Appels source comparés | 50/50 |
| Retours publics, actions et préfixes | 17/17 pour chaque compteur |
| Acquisitions | 16 actives et une passive |
| Restaurations natives | 34/34 |
| Résultats après sélection | 16 |
| Divergences et adaptations natives | Zéro pour chaque compteur |
| Ablations exécutées/attendues | 102/102 |
| Ablations appliquées | 72 |
| Changements d'action ou de refus | 41 |
| Erreurs d'ablation | Zéro |

Les verdicts `exactOriginalReturnParityPassed` et `componentComparisonPassed` sont `true` ; **`fullCallerParity` reste `false`**. Les ablations établissent la contribution de l'état acquis aux décisions de ce composant. Elles ne démontrent pas une amélioration causale du résultat du jeu entier.

Le [contrôle navigateur](lot10c-evidence/development/recr01-browser01/qa.json), sur le serveur Vite de développement, constate `Paused.`, puis exactement **3 → 4 actions** avec « One action », et une reprise jusqu’à **9 actions et deux niveaux résolus**. La [capture](lot10c-evidence/development/recr01-browser01/one-action.png) et les états accessibles sont conservés. Le premier clic Pause, arrivé après la fin du niveau, est conservé comme interaction infructueuse ; le second arrêt a bien été observé. Les dix erreurs de console conservées sont attribuées au script d’extension du navigateur. L’aperçu est arrêté et les 315 empreintes natives restent identiques.

Le [registre unique du cas](lot10c-evidence/case-clock.json) conserve désormais **642,824027506 secondes cumulées et 1 757,175972494 secondes restantes sur 2 400**, après les **226,409458557 secondes** du navigateur et la conservation finale des preuves. Admission, campagnes, diagnostics, échecs et rétention restent débités ; aucun redémarrage ne remet le compteur à zéro.

Les [dix régressions enregistrées](lot10c-evidence/development/regressions01/regression-launch.json) sont **PASS avec 170/170 contrôles**, sur le nouveau gel complet `bb7…` / 315 fichiers natifs. Elles réutilisent les dix rapports et dix traces historiques dont les empreintes ont été [vérifiées](lot10c-evidence/development/regression-preparation01/receipt.json), sans nouvelle partie. Le [rapport complet](lot10c-evidence/development/regressions01/regressions/regression-summary.json) retient 357 commandes, 367 paquets publics complets, 1 676 images d’animation, 275 préfixes et 30 frontières naturelles de niveau, avec les entrées et le natif inchangés. Le [bilan du jalon de développement](lot10c-evidence/development/milestone-summary.json) lie les reçus terminaux.

## Qualification de publication et suite ordinaire

La qualification fonctionnelle de la composition 329 et son intégrité sont acquises. La qualification officielle finale devra encore réconcilier **5C / 0.63, 6B / 0.64 puis 8A / 0.65 effectivement publiés**, compléter les portes de réception du gel final et établir le contrat de coût **0.65 → 0.66**, dont le seul propriétaire ajouté est `public_ordered_recruitment` avec `v6.ordered_recruitment.choose`. Les preuves historiques 315 ne sont pas relabellisées comme de nouvelles preuves RECR ou navigateur sur 329.

Le critère de coût reste la **médiane de session complète strictement sous +10 % pour chacun de STCK et SMLP**. Une phase peut dépasser +10 % si le global du même jeu passe, sans compensation entre jeux. Toutes les mesures, phases et refus réels restent conservés. **Aucun coût officiel final ni publication 10C ne sont établis dans cette reprise.** La dernière publication observée reste Site 103 / native 0.62.

La parité complète de l'appelant et les six portes de migration complète demeurent ouvertes. Les réserves HPDL et LKEY restent explicites.

Le travail ordinaire continue sans attente de cette file de publication. La [préparation 10D / TemporalSelection](lot10d-temporal-selection-next-step.md) est terminée : contrats source, douze champs d'état, dépendances et intégration identifiés. **Prochain changement : générateur de référence indépendante et corpus de mesures/politique**, puis port et raccordement natifs. Les descriptions de cellules périodiques consommées et la représentation/ordre des pixels des composantes doivent être couverts avant de substituer les interfaces existantes. Aucune exécution ou entrée supplémentaire 10D n'est encore revendiquée.

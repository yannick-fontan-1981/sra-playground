# Lot 5C — filiation de `observed_object_binding`

## Statut de cette reconstruction

Cette reprise part du **Site 95, commit `3a70463039768f7114edae7d94d7dd33b7f36aa8`**. L’ancien espace de travail 5C et ses preuves non publiées sont absents. Les outils, fixtures et résultats ci-dessous sont reconstruits et exécutés à nouveau ; aucun ancien nombre de succès ne sert de critère d’acceptation.

Le nouvel export original courant a terminé avec succès : **82 helpers, 14 chaînes froides et un contrat isolé de restauration Python, 845 opérations, deux exceptions source explicites et 14 écritures d’attention**. Les **1 786 fichiers originaux** ont été vérifiés avant et après ; les inventaires sont identiques. Le reçu liste les **726 modules originaux effectivement importés**. La **parité native passe à 98/98** sur la fixture ainsi régénérée, avec les entrées inchangées pendant le test. Voir [le reçu de l’export 02](lot5c-evidence/recovery/source-oracle/export-02.json), [son exécution complète](lot5c-evidence/recovery/source-oracle/export-02-execution.json) et [le reçu de parité 02](lot5c-evidence/recovery/source-oracle/parity-02-execution.json). Les preuves communes, les validations intégrées, les coûts et la publication restent des étapes séparées ; leur réussite n’est pas anticipée ici.

Le [premier passage de parité](lot5c-evidence/recovery/source-oracle/parity-01-execution.json) reste en échec à **93/98**. Il a révélé un défaut natif de conservation des clés supplémentaires lors de `reset`, corrigé conformément à Python, ainsi qu’un défaut de projection des arguments de quatre helpers `locate` dans l’exporteur. Le [diagnostic conservé](lot5c-evidence/recovery/source-oracle/export-01-projection-incident.json) décrit les deux causes. La [promotion de la nouvelle fixture](lot5c-evidence/recovery/source-oracle/export-02-canonical-promotion.json) établit que seuls ces quatre résultats de helper changent après un nouvel appel à l’original avec ses entrées consommées en listes de listes. Les autres helpers et toutes les chaînes sont inchangés ; aucun attendu natif n’a été injecté.

## Propriétaire et dépendances consommées

Le propriétaire original est `ObservedBinding`, dans `agents/yf_arc3_v6/morphology_policy/guarded_binding/family.py`, au commit immuable `786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`.

| Module original | Contrat consommé | Destination native de la reconstruction |
|---|---|---|
| `family.py` | SRC de choix, priorité des offres, continuité du cadre choisi, proposition, liaison, gardes, acquisition et état source | `v6-observed-binding.ts` |
| `tracker.py` | Identité du corps, calibration, liaison locale, transport, réception, séparation, contradictions et frontière | `v6-object-binding-tracker.ts`, checkpoint natif séparé |
| `geometry.py` | Descripteurs visibles, cadres vides, correspondances, corps mobile compact, revalidation et digests | `v6-object-binding-geometry.ts`, helpers communs |
| `identity.py` | Compatibilité des parties visibles sous translations bornées ; ambiguïtés et occlusions | `v6-object-binding-identity.ts` |
| `reception.py` | Contrastes d’arrivée et de séparation au site sélectionné | `v6-object-binding-reception.ts` |
| `planning.py` | Offres, plans conditionnels de déplacement, priorité et questions de séparation | `v6-object-binding-planning.ts` |

La famille importe `AttentionMemory`, le chargeur DRM V5 et le runtime SRC V6. `binding.src` appelle `binding.measure`, puis `binding.bind`, et restitue la sélection. Ce workflow existe dans les sources déclaratives ; son installation effective dans le magasin natif est une obligation d’intégration distincte d’un nouveau transfert de source SRC. Le tracker consomme les modules d’identité, de réception et de géométrie. L’oracle utilise l’observateur neutre original pour mesurer les seuls rasters publics synthétiques. Il n’importe aucun module natif.

Sources : [famille](../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/morphology_policy/guarded_binding/family.py), [tracker](../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/morphology_policy/guarded_binding/tracker.py), [géométrie](../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/morphology_policy/guarded_binding/geometry.py), [identité](../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/morphology_policy/guarded_binding/identity.py), [réception](../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/morphology_policy/guarded_binding/reception.py), [planification](../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/morphology_policy/guarded_binding/planning.py).

## Contrat de proposition et ordre

`propose(obs, rows, inputs, remaining, attention)` utilise les commandes disponibles dans `obs` ; son paramètre `inputs` n’est pas consommé. Une proposition nulle peut tout de même admettre ou revalider le contexte, retenir une contradiction et modifier l’attention. Elle ne doit donc pas être traitée comme une lecture pure.

Le DRM ordonne les offres ainsi : séparation de réception, réception, liaison par interaction connue, essai d’un contrôle de contact inconnu, approche de réception, approche d’une correspondance, puis contrôle inconnu pour cette correspondance. Le choix départage ensuite la distance résiduelle ou courante, le nombre de commandes, la référence de cible et la première action. Les égalités conservent l’ordre original. Les mappings de mouvements et de cadres gardent leur ordre d’insertion, utilisé par les boucles source.

Les préfixes sont bornés par les actions restantes et le maximum configuré de 16. Une commande n’est pas autorisée par sa seule présence dans une offre. Le binder vérifie que les actions correspondent exactement aux étapes et que chaque étape porte `expected_after`, y compris lorsque sa valeur est nulle. Le garde revalide le corps, sa pose, le niveau, le score et la disponibilité de l’action ; la première étape vérifie aussi le hash de l’image et la référence d’observation. Un effet inconnu impose un scellement avant continuation. Une prédiction de déplacement teste aussi les régions à préserver.

L’interaction actuellement mémorisée peut être proposée même si elle n’est plus disponible : c’est le garde courant qui doit la refuser. `near` signifie un chevauchement des intervalles des boîtes, et non une distance de voisinage de un pixel. Ces particularités source sont conservées, sans correction opportuniste des attendus.

Source déclarative : [binding.drm](../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/morphology_policy/guarded_binding/binding.drm), [binding.src](../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/morphology_policy/guarded_binding/binding.src).

## Connaissances, contexte et frontière

Les 16 champs source sont `epoch`, `core`, `moves`, `tried`, `blocked`, `held`, `interaction`, `methods`, `events`, `failed`, `goal_evidence`, `correspondence_context`, `context_refutations`, `pending_reception`, `reception_receipts` et `observed_frames`.

Les observations de déplacement acquièrent une identité de corps compact et une loi locale conditionnelle. Une palette commune ne prouve pas l’identité d’un objet déplacé : la source compare les parties visibles sous plusieurs translations compatibles et conserve les ambiguïtés. La proximité d’un objet et d’un cadre fournit une hypothèse de réception, pas une loi terminale.

L’arrivée apparente dans le cadre laisse la réception en attente. Une séparation ultérieure distingue un objet resté au site d’un objet qui suit le corps. La réfutation `reception_refuted_object_moves_with_body` est ajoutée aux événements, mais la méthode continue ensuite son analyse de mouvement ; son retour direct peut être `object_remains_locally_bound_after_motion`. L’oracle compare le retour et l’état complet, sans remplacer cette particularité par un statut plus commode.

La contradiction d’un cadre demande des bords encore observables et au moins deux coins concordants. Un cadre absent, hors champ ou masqué n’est pas automatiquement réfuté. Les contours englobants et les zones occultées restent explicitement exclus des pixels comparés.

Une frontière réinitialise les champs locaux et conserve les méthodes conditionnelles ainsi que les preuves de but. Le flux d’événements est limité à 32 ; les autres collections ne disposent pas toutes d’une telle limite. Ce transfert ne constitue donc ni une éviction générale des faits anciens ni une garantie de mémoire constante pour les sessions longues.

## Acquisition dans le caller et attention commune

Le caller original distingue deux chemins. Lorsque la famille est sélectionnée, il persiste `object_binding_event:<revision>` **même si le résultat est `None`**. Pour une acquisition passive, il ne persiste ce fait que si l’événement est truthy. L’état source `observed_object_binding_state` est retenu puis restauré si le corps ou une méthode existe. La famille sélectionnée ne doit pas être appelée une deuxième fois par le passage passif.

Ce dernier aller-retour passe réellement par `Memory.put` et `Memory.get` : le `pack` original trie les clés JSON, puis la relecture et `restore` installent cet état. L’ordre des dictionnaires consommés (`moves`, `observed_frames` et `correspondence_context.frames`) doit donc être évalué après cette frontière mémoire dans la preuve du caller, en conservant séparément l’état au retour direct de `record`. La parité composant autonome et le rejeu de ces appels dans le caller ne suivent pas la même chronologie de persistance.

Le propriétaire de continuité est `object_frame_binding`. La famille utilise l’instance d’`AttentionMemory` injectée par le caller, dont les `memory.put` sont de véritables faits. Un parent d’une autre famille ne peut pas être remplacé silencieusement. Le parent de liaison reste en attente jusqu’à une séparation concluante, une réfutation ancrée ou une frontière. Cette attention est distincte du tracker et ne doit pas être dupliquée dans le checkpoint du composant.

Le staging natif prépare une transaction de tracker et d’attention ; son journal d’écritures doit rejouer les `memory.put` effectifs au commit. Restaurer seulement `item` et `composition` ferait disparaître ces faits du graphe. Le getter de contexte retrouve l’attention réelle après une restauration du caller. Une acquisition interrompue doit produire un reçu natif `unknown` lié au retour réel, sans action autorisée, sans réfutation inventée et sans convertir l’interruption en résultat source nul. Sa prise en charge par le caller demeure une preuve native distincte.

Sources : [caller original](../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/laya_proto/common_frontier_runtime.py), [attention originale](../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/laya_proto/attention_memory.py).

## État source et extensions natives

Python retourne une copie de `tracker.__dict__` et restaure par `__dict__.update`. La restauration source est donc partielle, conserve les champs omis et admet des clés supplémentaires. Ces clés survivent aussi à `reset` : l’appel à `__init__` réassigne les champs connus sans vider `__dict__`. Le cas isolé de la nouvelle fixture expose ce comportement ; il n’est pas présenté comme un état acquis froid ni comme un checkpoint natif admissible.

Le checkpoint natif fermé et validé, l’immuabilité des branches retenues, les bornes coopératives de travail et les reçus d’interruption sont des extensions explicites. Ils ne modifient pas les attentes Python. L’attention, les propositions du caller et les garanties d’annulation globale restent des responsabilités séparées. La parité utilise les entiers et rasters publics du domaine natif ; elle ne revendique pas toutes les coercitions ou tous les nombres arbitraires de Python.

Le digest de géométrie utilise le JSON Python compact, avec clés triées et échappement ASCII, puis les 24 premiers caractères du SHA-256. Les centres résultent d’une division : un centre entier peut être un flottant `4.0`. Les points de hash doivent conserver cette information de type. La fixture déclare des chemins de flottants uniquement pour l’adaptation de ces appels de helper ; les attentes proviennent toujours de la fonction Python originale. Le digest de mémoire d’attention suit séparément le `pack` original sans échappement ASCII.

## Preuves nouvelles et critères de fin

L’[exporteur indépendant](../../scripts/export-observed-binding-reference.py) génère les attentes à partir des originaux immuables. Les chaînes commencent sans corps ni connaissance apprise ; les cas positifs et négatifs ont le même préfixe public et divergent à la séparation. Translation, changement de palette, corps de taille impaire, ambiguïté, frontière, corps absent, déplacement bloqué ou changé, cadre contredit ou non observable, parent étranger et garde périmé sont des contrats distincts. Les helpers utilisant un tracker donnent la référence de l’opération froide qui a acquis cet état.

Le [test de parité](../../tests/v6-observed-binding-reference.test.ts) compare les retours, exceptions, 16 champs, ordres consommés, attention et écritures réelles. Il compare le flux continu, les restaurations source, et les restaurations natives sur le domaine déclaré. Dans ce dernier flux, l’attention est rechargée depuis les écritures réellement produites par le natif, sans état attendu injecté.

Le [reviewer commun](../../scripts/review-observed-binding-common-replay.py) compare les journaux effectivement capturés avec un rejeu Python froid. Les propositions sélectionnées sont recalculées localement par Python ; les annotations natives n’alimentent jamais l’oracle. Le reviewer exige les empreintes des entrées avant et après, conserve les échecs et sauvegarde sa source exacte avec chaque résultat. Les extensions de parent matériel et de borne d’acquisition sont qualifiées séparément.

Le premier [reviewer commun de reprise](lot5c-evidence/recovery/common/common-01/positive/original-comparison.json) reste en échec : **1 852 contrôles, dont 121 écarts d’ordre**. Son export original contient 124 appels sans exception ; l’oracle omettait la branche conditionnelle de persistance et restauration du caller décrite ci-dessus. Le nouveau contrat `sourceStateRetention=core_or_methods_memory_roundtrip` exécute cette branche avec la mémoire SQLite originale, uniquement depuis l’état calculé par Python, et conserve ses états avant stockage, relus et restaurés. La capture native consigne les projections avant/après restauration ; les comparaisons d’ordre après restauration et à chaque appel source restent strictes. Les outils corrigés sont préparés et syntaxés ; leur prochain résultat n’est pas anticipé.

La parité composant est acquise sur le candidat du reçu 02. Pour clôturer 5C, il reste à établir sur le candidat réellement intégré : contribution dans la boucle commune, validations fonctionnelles, qualification des différences structurelles, mesures de coût selon la règle globale autorisée, intégrité des livrables et publication réelle. Les phases au-delà de +10 % restent visibles ; l’acceptation dépend du critère global pré-déclaré. Aucun nouveau jeu n’est lancé dans cette reconstruction. WEAV conserve son budget épuisé ; les anciennes observations CGWL dont les fichiers sont absents ne sont pas recréées comme preuves.

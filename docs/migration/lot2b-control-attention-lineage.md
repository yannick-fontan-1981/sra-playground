# Lot 2B : décision morphologique, acquisition du contrôle et retour d’attention

## Périmètre et filiation

Le point de départ est la publication **61**, commit `b288fef0f6ec7898e6e6ea6de56c3e2af2d5cf19`, moteur natif `0.33.0`. Le lot 2A avait raccordé le fournisseur `morphology` et ses mesures courantes. Le résultat complet de la politique n’était cependant transmis que lorsqu’une route était proposée : une décision `retained / control_not_currently_attested`, sans route, disparaissait avant ses consommateurs. Les groupes `attention_parent_return` et `acquire_control_for_target` restaient sans fournisseur.

La source de ce transfert est le commit Python inchangé **`786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`**. Les contrats principaux résident dans `morphology_policy/strategy.py`, `strategy.drm`, `strategy.src`, `adapter.py`, `contextual_translation.py`, ainsi que `laya_proto/attention_memory.py`, `terminal_composition.py`, `target_method.py`, `common_frontier.py`, `composition_curiosity.py` et `target_tree.py`. La filiation V5 des mesures d’enceintes reste celle documentée dans le [lot 2A](lot2a-morphology-lineage.md) : ces producteurs sont réutilisés, sans seconde interprétation des contours.

Le lot 2B couvre le transport de la décision courante, les trois expériences d’acquisition du contrôle, le maintien d’un témoin d’attention et son retour, ainsi que l’admission des questions d’information face à ce parent. Il n’ajoute aucune règle liée à un nom de jeu, un numéro de niveau, une couleur de rôle ou une direction présumée d’une commande.

## La durée de vie exacte de `morph.last`

`StrategyRouter.choose` remet `morph.last` à `None` au début de **chaque** choix. Ce champ est un résultat éphémère de l’évaluation courante ; il n’est pas une méthode historique et ne peut pas être restauré comme l’autorité d’une prochaine décision.

`MorphologyAdapter.propose` mesure les faits, demande l’extension de cible, évalue la politique, puis place dans `last` la décision accompagnée de `target_extension` et `measured_facts`. Cette affectation précède le refus `if not decision["route_key"]: return None`. Une absence de proposition n’efface donc pas une décision conservée. Si une route existe, le même résultat reçoit aussi les champs d’accès du plan.

Les familles suivantes lisent le résultat dans le même choix. La proposition finalement sélectionnée reçoit ce résultat dans son champ `morphology`, même si une autre famille l’a produite. Une famille antérieure sélectionnée conserve le reçu source `not_evaluated / prior_family_selected`. Les états durables de contacts, essais, prévisions, histoire et attention restent chez leurs propriétaires existants.

## Ordre des consommateurs

La fin de l’ordre DRM reste :

1. `morphology` ;
2. `attention_parent_return` ;
3. `returned_branch_contrast` ;
4. `information_goal` ;
5. `acquire_control_for_target` ;
6. `view` ;
7. `view_continuity` ;
8. `observed_frontier`.

Les huit groupes antérieurs à `morphology` gardent leur priorité. Le résultat `None` laisse poursuivre cet ordre ; la présence d’une offre sélectionne la famille selon le protocole SRC existant. Aucune expérience d’acquisition ne devient une voie de libération directe d’action.

## Acquisition du contrôle

L’admission exige simultanément le statut `retained` et la raison `control_not_currently_attested`, exactement tels que déclarés dans le DRM. Le calcul lit le snapshot courant et l’épisode déjà acquis par GoalAccess. Seuls les essais dont les deux extrémités appartiennent à l’époque courante sont considérés. Les commandes proposées sont les entrées publiques sans données ponctuelles, initialement triées par référence.

| Expérience, dans l’ordre source | Témoignage requis | Résultat conservé |
| --- | --- | --- |
| `replicate_translation` | Un seul essai de cette commande dans l’époque ; enregistrement géométrique avant/après et après/courant ; au moins un rôle partagé déplacé, dont la position courante diffère de l’origine de l’essai | Références courant/avant/après et déplacements attendus des rôles concernés |
| `sample_unused_control` | Aucun essai de cette commande dans l’époque courante | Référence courante ; aucune direction présupposée et aucun `expected_motion` inventé |
| `replicate_after_contextual_block` | Une translation unique et au moins un blocage, une seule origine de succès antérieure, une nouvelle origine courante et une surface projetée correspondant au succès sans correspondre aux blocages | Contraste complet de surface, références du succès, destination prédite, autres issues possibles et déplacement attendu |

La réplication après blocage réutilise les mesures exactes de composantes, `registered`, `footprint` et `identity`. Les signatures mobiles doivent former un seul groupe cohérent et remplir entièrement son empreinte rectangulaire. Deux groupes indépendants, une empreinte trouée, une destination hors raster, une commande déjà essayée depuis l’origine courante ou plusieurs vecteurs non nuls concurrents refusent ce contraste. Une surface actuellement compatible ne devient pas une garantie de mouvement : le reçu garde les alternatives `blocked_again`, `different_translation` et `nonlocal_effect`.

`recalledDirections`, déjà transféré, peut fournir des directions d’une séquence précédemment scorée. Cette méthode n’est admissible que dans une autre époque, pour la même composition, avec une paire courante encadrée, homologue, asymétrique, non réfutée, et tous ses rôles encore présents. Les essais actuels peuvent attester certains axes ; le tri stable préfère alors les directions rappelées indépendantes de ces axes, puis les directions parallèles, puis les commandes sans direction rappelée. Le rappel suggère un essai ; il ne démontre pas le contrôle courant.

Un témoin d’attention `pending`, ouvert sur cette observation et cette paire, donne priorité à sa commande et à son expérience. Les critères ne sont pas élargis à une simple proximité de position. En inspection, `frontier.canProbeHere` doit autoriser l’essai ici ; aucune proposition ni nouvelle attention n’est créée par cette inspection seule. En mode normal, le même calcul produit un `control_acquisition` à destination de `ObservedFrontier.propose`.

## Admission des questions d’information

L’ordre interne existant conserve d’abord les séquences visuelles et les séquences de retour. Les offres de points, d’affichages couplés et de contraste de mouvement sont ensuite réunies. L’acquisition du contrôle est inspectée **seulement si cette liste d’offres n’est pas vide**, avant leur élection par le programme existant.

Les deux refus source ont des fonctions distinctes :

| Situation | Reçu conservé et suite |
| --- | --- |
| Parent morphologique conservé, question sans retour lié, action différente de l’acquisition courante et absence d’exposition actuelle à préserver | `unbound_return_from_the_current_role_acquisition_goal` ; la question est différée avec sa commande et sa composition parent |
| Réplication courante (`replicate_translation` ou `replicate_after_contextual_block`), question différente sans retour lié, ouverture et correspondance d’attention réussies | `would_abandon_current_control_witness_without_bound_return` ; la question est différée avec la référence d’attention et l’acquisition préservée |
| Question portant exactement la même commande primitive que l’acquisition | Le reçu reçoit `also_tests_current_control`, et la référence d’attention si elle correspond déjà |
| Question avec retour lié actuellement admis par l’élection | Le parent n’impose pas ces refus de retour non lié |

L’égalité d’action est structurelle : `{"action_ref": "ACTION1"}` et une commande contenant un champ `data` supplémentaire ne sont pas arbitrairement confondues. Une marge d’actions, un retour connu ou un témoin de déplacement restent des propriétés séparées.

## Attention, acquisition et retour

`AttentionMemory` est le propriétaire déjà présent. Son canal `item` de réplication de mouvement est distinct du canal `composition` utilisé par les compositions retenues. Le lot 2B utilise ce propriétaire ; il ne le remplace pas et ne mélange pas ces deux cycles.

L’ouverture exige la référence d’observation actuelle et des mouvements attendus. Un autre témoin en attente ne peut pas être écrasé. L’identité dépend de l’époque, de l’observation, de la paire, de la commande et de l’expérience. Le retour exécuté passe par `attention.observe` au début de l’acquisition commune, avant les mises à jour de vue et du fournisseur sélectionné. Il vérifie la commande et la référence d’attention, l’absence de frontière, puis les signatures attendues dans un repère enregistré par trois ancrages distincts non colinéaires.

Le retour est `matched`, `contradicted` ou `unobserved` selon le témoignage reçu. Une frontière, une substitution de commande ou une observation périmée produit les statuts distincts existants. `takeParentReturn` ne livre qu’une fois un retour `matched`, `contradicted` ou `unobserved`, de la même époque et rendu à l’observation actuelle. Il marque ensuite l’item `returned` ; le consommateur reçoit le statut du résultat antérieur, pas ce nouveau statut interne.

`attention_parent_return` vérifie que la paire du résultat morphologique courant est exactement celle du retour, puis appelle la même acquisition de contrôle. Un retour contradictoire peut donc reprendre la question avec l’histoire révisée. La source ne limite pas cette reprise aux seuls retours confirmés. Une paire différente laisse poursuivre la stratégie, et le reçu de retour reste observable.

### Qualification de l’ordre des rôles attendus

`AttentionMemory.observe` parcourt les rôles d’`expected_motion` et s’arrête au premier rôle manquant ou au premier déplacement contradictoire. Avec plusieurs rôles, dont l’un disparaît et l’autre se déplace contrairement à la prédiction, l’ordre fourni peut donc produire `unobserved` ou `contradicted`. Les deux cas de référence mixtes fournissent explicitement chacun de ces ordres, vérifient le statut obtenu par la source inchangée, puis la consommation unique du retour par le parent.

Dans `StrategyRouter.choose`, la liste `changed` de la réplication provient d’une intersection de sets Python ; son ordre dépend notamment du hachage du processus Python. Le producteur natif utilise l’ordre de `Object.keys(current.roles)`. Il ne prétend pas reproduire cet ordre de set. La parité d’`AttentionMemory` est vérifiée pour un ordre d’entrée donné, mais le libellé diagnostique exact d’un retour multi-rôles mêlant disparition et contradiction n’est pas garanti entre les deux producteurs. Les trois résultats `matched`, `contradicted` et `unobserved` suivent le même contrat de reprise du parent, et aucun ne libère une action à lui seul. Cette qualification ne modifie ni le consommateur d’attention ni l’ordre natif pour imiter un hachage Python.

Les propositions d’acquisition utilisent les gardes et acquisitions déjà raccordés de `ObservedFrontier`. Le contrôle des actions disponibles, du candidat, du préfixe et de la portée demeure commun. WHY/ACT garde l’autorité de libération. L’arbre de cible existant lie `control_acquisition`, les expériences d’information partagées et la composition ; les témoins réels alimentent GoalAccess et la mémoire de frontière par leur chemin habituel.

## Propriétaires et réutilisation

| Élément | Propriétaire ou producteur réutilisé | Cycle |
| --- | --- | --- |
| Décision morphologique complète | `NativeMorphologyFamily`, résultat courant | Réinitialisée au début du choix et recalculée depuis les propriétaires acquis |
| Transitions et snapshots | `caller:goal` / GoalAccess | Acquisition commune des retours réels |
| Méthode issue d’un score | `caller:counters.targetMethod`, `targetMethodAtBoundary`, `recalledDirections` | Acquise à la frontière attestée, testée dans une nouvelle portée |
| Témoin de contrôle | `caller:attention.item` / `AttentionMemory` | Ouverture, observation, retour unique ou expiration |
| Retour consommé courant | `caller:counters.returnedAttention` | Consommation par `prepare`, puis admission par paire dans le choix courant |
| Essais locaux et accès à un autre site | `caller:frontier` / `ObservedFrontier` | Propositions, gardes, acquisitions et deltas existants |
| Valeur et retours des questions | `electInformationGoals`, producteurs existants de points/affichages/mouvements | Élection puis admission face au parent courant |
| Libération physique | Programme commun WHY/ACT | Autorisation séparée pour les commandes du préfixe engagé |

## Limite conservée pour le lot 2C

Le lot 2B ne transfère pas les propriétaires `station_method`, `entry_method` et `entry_access_return`, ni leurs branches d’accès conditionnel, de réassociation et de continuation. Les projections et capacités gérées nécessitant une méthode de station non nulle restent hors du domaine 2A/2B annoncé. Leur éventuelle provenance de l’époque courante ne rend pas ces branches déjà acquises.

Les stations et effets sélectifs actuellement acquis couverts par 2A restent disponibles. Ce maintien ne clôt pas l’extension de cible, le réarmement et les continuations plus larges requis pour terminer le lot 2. La question `replicate_after_contextual_block` est une expérience générique de contrôle issue de l’histoire publique ; elle ne constitue pas une méthode de station.

## Méthode de vérification

L’exporteur [export-v6-control-attention-reference.py](../../scripts/export-v6-control-attention-reference.py) exerce `StrategyRouter.choose` et les closures originales sans extraction AST ni réécriture de branche. Les dépendances non ciblées sont des doubles explicites de frontière, la décision morphologique est une entrée de contrat injectée par le fournisseur, et les propositions de frontière sont enregistrées comme sorties d’interface. L’ordre DRM/SRC, les expériences, l’élection, le rappel de méthode et le cycle d’attention s’exécutent dans les originaux. Le routeur et son programme immuable sont réutilisés entre cas ; les dépendances et l’attention sont réinitialisées. Cette preuve vérifie les consommateurs de stratégie ; elle ne prétend pas remplacer les mesures 2A ou une campagne réelle.

Les **38 cas** produisent **44 décisions** originales sur **17 scènes** synthétiques. La [fixture](../../tests/fixtures/v6-control-attention-reference.json.gz) conserve les observations, entrées de frontière, états d’attention, appels du frontier et sorties. Ses **41 tests** de parité passent, y compris la restauration complète du caller pour les cas de focus et de rappel. Ils couvrent les admissions, refus, priorités, retours uniques, paire différente, effets des époques, partage d’une commande avec une question d’information et les deux ordres d’un retour multi-rôles mixte. L’ordre de ces deux entrées est transporté par une liste explicite, indépendamment du tri des clés JSON de la fixture. Les **1 786 fichiers** originaux sont vérifiés avant et après génération.

Le [test du kernel](../../tests/v6-control-attention-kernel.test.ts) ferme séparément la chaîne d’intégration. Il utilise la factory réelle, le service, les mesures de `NativeMorphologyFamily`, les fournisseurs de stratégie, le vrai frontier et WHY/ACT. Son entrée initiale est seulement un raster synthétique de 2A complété à 64 × 64 et les commandes publiques ; aucune décision, histoire, méthode, route ou état de solveur n’est injecté. Le premier choix conserve une paire sans route et libère `sample_unused_control`. La réponse publique déplace le carré, le caller acquiert cette transition, puis la décision fraîche libère `replicate_translation` avec le déplacement réellement observé. Les deux retours sont acquis et les analyses OP29/OP30/OP31 sont vérifiées. Ce test passe ; il n’annonce aucun niveau ARC réussi.

Le contraste après blocage possède en complément ses propres références de composantes publiques et ses cas négatifs dans [v6-contextual-translation.test.ts](../../tests/v6-contextual-translation.test.ts). Les campagnes et effectifs de la vérification globale restent consignés dans le rapport de livraison ; ces preuves locales ne clôturent pas les branches du lot 2C.

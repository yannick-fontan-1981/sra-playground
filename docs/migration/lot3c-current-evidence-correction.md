# Lot 3C : correction de l’évidence courante d’Exposed Reception

## Résultat établi et portée

La version **native 0.44.0** corrige le rattachement de l’observation courante dans l’enveloppe de `exposed_reception_plan`. Sur le dernier paquet public de la campagne 0.43, TargetTree passe du refus `unbound_action_set` à l’admission `independent_current_contribution`, tout en conservant intégralement le plan, son identité, ses commandes et l’état appris. La [preuve indépendante](lot3c-current-evidence/diagnostic/README.md) borne cette conclusion au composant : elle n’exécute aucune action et ne prouve pas l’effet futur du plan.

La nouvelle campagne réelle poursuit au-delà de l’ancien refus, mais **n’achève pas le troisième niveau** : elle conserve **107 actions, deux niveaux et 93 préfixes**, avec arrêt `level_active_time_budget`. **3C reste ouvert avec qualification.** La réussite des contrats et la preuve de contribution ne remplacent pas cette cible fonctionnelle.

Il s’agit d’une **extension native explicitement qualifiée**. Le [diagnostic antérieur](lot3c-evidence/final/cwse-terminal-diagnostic/README.md) a établi que la source Python originale et son port 0.43 produisent exactement le même plan et le même refus sur ce contexte. Corriger ce rattachement ne peut donc pas être présenté comme un rapprochement supplémentaire avec cette sortie source. Les originaux V5/V6, les fixtures et leurs exporteurs restent inchangés.

Le gel natif de cette livraison est **`e914399487992c3f53b3058ee734c470d738594e7344285799203462fac6a255`** : [251 fichiers natifs](lot3c-current-evidence/final/source-manifest.json), [262 fichiers archivés](lot3c-current-evidence/final/source-archive.json). La référence est la publication 71 / native 0.43.0, commit `e9fd144112b05a65af5c88e9f05c541f43ed8ed7`, digest `3e88aa12214fd3d4a4feb8d63b946123b8394cb4a0cbd0a156cc059c37f7b46c`.

## Cause observée

La campagne publiée s’est arrêtée après deux niveaux, 21 actions et 13 préfixes. La séquence terminale conservée explique le refus sans faire appel à une solution ou à un code de jeu :

| Observation publique | Mesure et mémoire propre | Conséquence |
| --- | --- | --- |
| Après l’action 19 | Scène Exposed admise ; dernier des 19 événements propres acquis | L’évidence de la mémoire se termine à la révision 20 |
| Après l’action 20 | Scène absente ; aucune acquisition propre | La mémoire Exposed reste inchangée |
| Après l’action étrangère 21 | Scène Exposed de nouveau admise, même époque et même disposition | Le nouveau plan utilise la géométrie courante, mais réutilisait l’évidence historique de l’état propre |

La référence de l’observation terminale, révision 22, était absente de `bundle_template.evidence`. TargetTree exige cette référence avant tout examen particulier de morphologie. Son refus est donc cohérent avec le contrat existant. La correction intervient dans la construction de la proposition ; elle ne modifie pas cette garde.

Ce diagnostic ne démontre pas que le caller original complet aurait suivi la même trajectoire, ni qu’EphemeralMap soit nécessaire pour ce refus précis. Les composants source ont seulement été comparés sur les événements propres et les observations publiques effectivement conservés.

## Modification commune au moteur

La modification de production se limite à [ExposedReceptionMemory.propose](../../src/logos-engine/v6-exposed-reception-access.ts). La scène courante doit déjà avoir été admise ; la sélection des commandes et la construction du plan sont déjà terminées.

1. La proposition conserve la fenêtre historique des 16 dernières références.
2. Si la référence courante y figure, la fenêtre reste identique, dans le même ordre et avec les mêmes éventuels doublons historiques.
3. Si elle manque, la référence courante est ajoutée. Lorsque la fenêtre est pleine, seule sa plus ancienne référence est retirée pour maintenir la borne de 16.
4. Cette fenêtre alimente `bundle_template.evidence`, `question.hypothesis_refs` et `route_refs`.

`plan.state`, l’historique propre, les modèles, les commandes apprises, les événements et la révision de mémoire ne changent pas. La référence ajoutée témoigne de l’observation courante qui justifie la proposition ; elle n’est pas une preuve d’effet, une acquisition simulée ou une récompense supposée. Aucun appel à `record` ou `applyEvent` n’est effectué par cette correction.

La construction existante d’un état local neuf reste applicable lorsque l’époque ou la disposition change. Les retours `null`/`unknown` et les conditions existantes de préfixe borné restent inchangés ; aucun résultat incomplet ne devient une preuve de résolution. Aucun jeu, identifiant de niveau, trajet particulier ou configuration de solution n’est introduit dans le moteur.

## Autorités et contrats conservés

| Autorité | Contrôles conservés |
| --- | --- |
| Projecteur Exposed | Admission du raster et mesure de la scène courante |
| TargetTree | Objectif principal, époque et référence courantes, relation entre composition et objectif, égalité des commandes et présence de l’observation courante dans l’évidence |
| Garde Exposed avant action | Identité du plan, égalité des commandes, époque, score, index, disponibilité de l’action et disposition ; raster et observation exacts au début du préfixe ; prédiction et orientation aux étapes suivantes |
| Acquisition Exposed | Création d’un événement propre seulement lorsqu’un retour sélectionné et mesurable l’autorise |
| Restauration | Reconstruction de la mémoire depuis les événements acquis, sans utiliser une proposition future comme amorce |

Le [résultat de preuve](lot3c-current-evidence/diagnostic/current-evidence-result.json) compare directement les empreintes du projecteur et de TargetTree entre les deux versions et vérifie qu’ils sont inchangés. Il restaure les mêmes 19 événements réels dans chaque version. Le [plan corrigé complet](lot3c-current-evidence/diagnostic/candidate-terminal-proposal.json) reste disponible ; les différences complètes se limitent aux trois champs d’évidence déclarés.

## Validation ciblée et source originale

Les **129 tests ciblés passent** :

| Suite | Résultat | Portée |
| --- | ---: | --- |
| `tests/v6-exposed-reception.test.ts` | 99/99 | Contrats source, gardes et bornes ; un cas d’extension intentionnelle nommé explicitement |
| `tests/v6-exposed-reception-integration.test.ts` | 19/19 | Enveloppe commune, acquisition, restauration et intégration ; attentes existantes inchangées |
| `tests/v6-exposed-current-evidence.test.ts` | 11/11 | Trajectoire publiée, garde terminale, restauration, non-acquisition, borne 16, cas absents et références périmées |

L’unique cas oracle qualifié est **`propose:after_observed_control`**. L’oracle conservé possède trois références historiques sans la référence courante. Le test exige exactement les trois champs d’enveloppe étendus, puis compare tous les autres champs à l’attente originale. Il n’applique aucune normalisation générale, aucun changement de fixture et aucune tolérance d’égalité.

Les 11 nouveaux tests distinguent les faits de la campagne des sondes synthétiques. Les faits réels utilisent les deux fichiers publiés avec vérification de leurs SHA-256. Les changements de référence, d’époque, de disposition, de disponibilité ou de commandes sont des contrôles contraires de contrat. Leur réussite n’est pas présentée comme une nouvelle réussite dans le jeu. Le script de revue indépendante conserve également **14 contrôles** propres, documentés dans sa notice.

## Validation de livraison et campagne

Le [périmètre formel](lot3c-current-evidence/final/release-scope.json) déclare **46 fichiers**, soit les 45 du delta précédent et les nouveaux contrats d’évidence courante. Les [tests formels](lot3c-current-evidence/final/validation/delta-tests-run.json) passent **1 536/1 536**, avec zéro échec, annulation, ignoré ou TODO, et vérification des sources et entrées de test inchangées. Ce périmètre ne représente pas toute la suite historique du dépôt.

Les [cinq contrôles du projet](lot3c-current-evidence/final/validation/checks-run.json) sont réussis : typage, audit d’entrée, audit de migration, contrôle du diff et compilation. Les [rejeux CATR et RSWP](lot3c-current-evidence/final/regressions/regression-summary.json) réussissent **34/34 contrôles** du comparateur historique, avec conservation des commandes et retours publics examinés. Ces rejeux utilisent des retours enregistrés et ne mesurent pas une nouvelle réussite live ni une accélération.

L’[intégrité finale](lot3c-current-evidence/final/delivery-integrity.json) est vérifiée : **251 fichiers natifs**, **262 fichiers d’archive**, **562 fichiers de sources et tests**, **316 fichiers du build** et **1 786 fichiers originaux**. Trois rapports volumineux sont reconstruits depuis 30 partitions ; les **25 631 639 octets** reconstruits sont identiques aux originaux conservés. Ce contrôle lie la livraison à ses preuves sans modifier le statut de la cible fonctionnelle.

La [campagne CWSE réelle](lot3c-current-evidence/final/cwse-current-session/execution-cwse.json) s’exécute dans une session froide, avec l’hôte public opaque, sans trajet, mémoire apprise, solution ni saut de niveau injecté. Elle termine avec le statut `failed` pour la cible demandée : **107 actions, deux niveaux résolus, 93 préfixes**, arrêt `level_active_time_budget`, **376,429937424 secondes actives** au total. Les deux frontières naturelles surviennent aux actions 4 et 12. La campagne et son journal public restent intégralement conservés.

Le [reçu de contribution](lot3c-current-evidence/final/cwse-current-session/exposed-contribution.json) est `passed` pour son propre contrat, tout en indiquant explicitement `actual.targetMet: false`. Il reconstruit les décisions et acquisitions depuis les retours réels et les seuls événements antérieurs, sans exécuter une seconde campagne.

| Contribution examinée | Résultat conservé |
| --- | ---: |
| Préfixes sélectionnés Exposed | 19 |
| Actions sélectionnées Exposed | 29 |
| Événements propres acquis | 21 |
| Retours sélectionnés sans événement propre | 8 |
| Restaurations propres examinées | 19 |
| Actions des autres couches | 78 |
| Ablations contrôlées | 57 |
| Ablations modifiant une action ou un refus | 33 |
| Ablations modifiant la projection de décision | 42 |
| Cas dont la décision ne change pas | 15 |

Les différences limitées à l’identité ou aux compteurs de recherche ne sont pas assimilées à une contribution d’action. Les huit retours sans scène propre mesurable conservent leur absence d’acquisition. Les résultats négatifs restent visibles. Ce reçu démontre une contribution des contrôles et modèles conditionnels acquis ; il ne démontre ni la nécessité de chaque action, ni la parité du caller original complet, ni une réussite du troisième niveau.

La [vérification dans le navigateur](lot3c-current-evidence/final/browser/browser-qa.json) a suivi une session froide continue de l’aperçu source, sans saut de niveau ni mémoire injectée. Les pauses à zéro, cinq et 46 actions, l’action unitaire et les reprises ont été vérifiées. La progression dépasse l’ancien refus à 21 actions ; elle est arrêtée volontairement à **46 actions, deux niveaux et 32 préfixes**. Cette vérification confirme les commandes et une progression bornée ; elle ne constitue ni un troisième niveau réussi ni une reproduction du résultat final de la campagne instrumentée.

L’[horloge du candidat](lot3c-current-evidence/continued-clock.json) reprend les **1 527,448427 secondes** déjà comptées. La reprise est horodatée au **10 novembre 2026, 07:13:29 UTC**, avec limite cumulée de **2 400 secondes**, soit arrêt au plus tard à **07:28:01,551573 UTC**. La [résolution finale](lot3c-current-evidence/final/cwse-resolution.json) arrête le travail de jeu à **07:28:01,235438 UTC**, pour **2 399,683865 secondes cumulées** comptées conservativement. Ce suivi concerne le même candidat ; aucun nouveau départ à zéro n’est créé. Aucun nouveau diagnostic, test ou essai CWSE ne poursuit ce budget. Les opérations ultérieures de documentation, conservation et mesure STCK/SMLP sont distinctes du travail de jeu.

## Coût global autorisé

Le [protocole](lot3c-current-evidence/performance/protocol.md) applique l’autorisation de l’utilisateur : une phase au-delà de +10 % peut être acceptée si le global reste sous +10 %. Le global est défini avant la fenêtre comme la médiane de la durée complète `session_elapsed`, séparément pour STCK et SMLP.

La [fenêtre officielle](lot3c-current-evidence/performance/window.json) est terminée dans l’ordre **A1/B1/B2/A2**, avec référence publiée 0.43 remesurée et candidat gelé 0.44 : **32 sessions mesurées, 400 actions**, huit sessions par jeu et version, huit chauffes exclues selon le protocole. Aucune session mesurée n’est supprimée. Une baisse d’un jeu ne compense pas le dépassement de l’autre. Le seuil est strict : une hausse égale à +10 % ne passe pas.

La [décision globale](lot3c-current-evidence/performance/global-budget-decision.json) accepte **2/2 jeux**, avec le statut **`accepted_under_user_global_rule`**. Les médianes et pourcentages suivants sont arrondis ; leurs valeurs complètes figurent dans le reçu :

| Jeu | Médiane de session 0.43, ms | Médiane de session 0.44, ms | Variation globale |
| --- | ---: | ---: | ---: |
| STCK | 9 839,262 | 9 990,867 | **+1,540821 %** |
| SMLP | 16 722,476 | 16 659,132 | **−0,378796 %** |

L’[agrégat du comparateur historique](lot3c-current-evidence/performance/combined-comparison.json) conserve **14/16 diagnostics dans le seuil**. Les deux dépassements sont sur STCK :

| Phase | Variation de médiane | Traitement |
| --- | ---: | --- |
| `new_decision` | **+15,102315 %** | Dépassement conservé, accepté au titre du global STCK |
| `known_prefix_guard` | **+15,178145 %** | Dépassement conservé, accepté au titre du global STCK |

La [revue de consolidation](lot3c-current-evidence/performance/consolidation-review.json) passe **231/231 contrôles**. Les seize diagnostics de phase, les deux cohortes, les valeurs défavorables, les effectifs, les dispersions et les p95 disponibles sont conservés dans le [rapport complet](lot3c-current-evidence/performance/results.md). Les huit durées globales par jeu/version ne permettent pas de publier un p95 de session. Les mesures de phase d’une même session sont corrélées ; ces statistiques descriptives ne constituent pas une garantie de stabilité à long terme.

La décision globale est un reçu distinct et ne réécrit aucun ancien résultat. Elle accepte le coût de cette correction selon la règle de l’utilisateur ; elle ne transforme pas la cible CWSE non atteinte en réussite. Les temps mesurés concernent le rejeu du moteur natif et excluent le moteur de jeu, le réseau de production et le rendu navigateur.

Les tests, builds, campagnes, rejeux et contrôles navigateur ont été terminés avant les mesures. Seules les lectures légères et la rédaction ont continué pendant la fenêtre. Les résultats formels, de campagne et de coût sont reliés dans l’[index de lecture des preuves](lot3c-current-evidence/README.md).

Le contrat d’évidence courante est corrigé et vérifié, tandis que la capacité CWSE restante garde **3C ouvert avec qualification**. Aucun nouvel essai CWSE n’est prévu sur ce gel. Après ce suivi borné, la prochaine priorité de transfert source autonome est **3D**, conformément à la [feuille de route](v6-delivery-roadmap.md). La correction ne clôture pas l’héritage EphemeralMap, la transaction V5 complète, l’entrée observée entière ou la migration V5/V6 globale.

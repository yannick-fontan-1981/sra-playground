# Lot 2C : méthodes de station et continuation conditionnelle

## Objet et base de livraison

Ce lot reprend la publication **62**, commit `e56118da8b5f596b9727ca78a037e930bc333860`, moteur `0.34.0`. Il raccorde les méthodes de station et d'entrée au chemin commun de **Logos Engine**, avec leur acquisition à une frontière réelle, leur revalidation locale, le retour d'accès, les capacités gérées et les extensions de cible prévues par V6. Les primitives et mesures V5 déjà transférées sont réutilisées par leurs consommateurs V6.

L'implémentation `logos-engine.typescript.v6.native-migration/0.35.0` est gelée sur **242 fichiers natifs**, inventaire SHA-256 **`3cd17565b114a40ed71870bf8d7875a1b91102440b92d14a9258bfa98d4f7779`**. L'[archive de source](lot2c-evidence/final/source-archive.json) et ses [parties vérifiées](lot2c-evidence/final/source-archive-parts.json) permettent de retrouver les octets exécutés. Les sources originales V5/V6 ne sont pas modifiées.

**Statut : livraison fonctionnelle validée, avec réserve de coût ; le sous-lot 2C reste ouvert.** Le suivi STCK conserve cinq médianes sur huit au-dessus du budget de +10 %. La clôture de ce contrôle est la prochaine priorité, avant l'extension du lot 3.

Le périmètre est celui des contrats transférés et de leurs consommateurs communs. La parité de l'appelant original complet et la migration globale restent ouvertes. Ce fournisseur commun est hors des quatre listes DRM : **50/76 entrées raccordées et 37 workflows compilés restent deux compteurs distincts**, sans augmentation artificielle attribuée à ce lot.

## Ce qui change dans la décision

Une méthode conservée ne libère pas directement une action. Elle apporte une hypothèse à revalider dans l'observation courante. Le raccordement suit l'ordre de l'adaptateur source : mesure de la paire et des routes, reprise d'un retour d'entrée éventuel, réassociation conditionnelle lorsque le contrôle actuel manque, filtrage des commandes disponibles, extension de cible, puis décision DRM. Le frontier, les gardes et WHY/ACT communs restent sur le chemin de toute action physique.

### Acquisition et propriétaires

| Élément | Acquisition et propriétaire | Consommateur |
| --- | --- | --- |
| Méthode de cible | Le caller constate un effet sélectif vérifié, l'accès précédent à la même paire et une augmentation officielle d'un niveau. Il conserve la méthode dans son propriétaire existant `caller:counters.targetMethod`. | Rappel de direction, vue de méthode pour la morphologie et extension de cible |
| Hypothèse de station | Enrichissement au même retour de frontière, uniquement si un contact acquis de l'époque source contient exactement une entrée correspondant à l'effet sélectif et préservant le pair | Projection de station, capacité gérée et préparation d'entrée |
| Contacts, essais et départs | Journal de `family_state:morphology`, alimenté par les retours réellement sélectionnés et les départs publics observés | Géométrie, contre-exemples, réarmement et dérivations |
| Retour d'accès d'entrée | Dernier pas réussi d'un préfixe `entry_rebind`, avec sonde différée, même époque, score inchangé et empreinte arrivée vérifiée | `entry_probe`, seulement dans l'observation exacte du retour |
| Historique public | `caller:goal`, propriétaire existant | Revalidation des déplacements et des surfaces |
| Ressource et collectes | Propriétaire Inventory existant | Réserve courante, dette de trajet et possibilités de recharge |

Le champ de station est une vue de la méthode du caller. La famille morphologique ne duplique pas l'historique des méthodes. Une frontière sans nouvelle méthode conserve l'ancienne selon la source ; une nouvelle méthode sans station qualifiée ne récupère pas une ancienne hypothèse de station.

### Réassociation et sonde d'entrée

La préparation d'entrée revalide une direction sur deux origines observées dans la même époque, avec conservation de l'empreinte, des surfaces et des conditions d'alignement. Elle ne prétend pas avoir acquis toutes les directions possibles. Le préfixe reste borné par les commandes disponibles, l'historique, la ressource et le budget source.

Lorsqu'un contour encore inconnu interrompt ce préfixe, le dernier retour mesuré peut conserver la sonde différée. Sa reprise vérifie à nouveau l'identité de la paire, l'époque, le score, la position, les empreintes de départ et d'arrivée, le contour et le candidat de retour. La réserve permet au moins la sonde et une possibilité de retour. La disponibilité d'une commande inverse ne devient pas une preuve inventée de réversibilité dans l'époque courante.

Une disparition, une contradiction, un contour modifié ou une mauvaise portée empêche la reprise prévue. Le retour historique peut rester en mémoire sans constituer une autorisation actuelle. Le checkpoint morphologique passe au format `native.current_morphology.v2` ; les anciens checkpoints v1 se restaurent avec un retour d'entrée nul. Le journal est rejoué et comparé à sa projection avant installation, afin de refuser une restauration incohérente ou un événement dupliqué.

### Capacités gérées et extension de cible

La projection gérée compose les routes observées, la station revalidée, les marques de ressource et les preuves de collecte du propriétaire existant. La recherche conserve les états, obligations et priorités source : orientation, accès au pair, capacité et effets de palette lorsqu'ils sont qualifiés. Une recherche bornée ou incomplète garde son statut ; elle ne prouve pas l'impossibilité d'une solution.

Le plan sélectionné est traduit en un préfixe géométriquement gardé et en un effet terminal explicite. Les dérivations et l'arbre de cible existants reçoivent maintenant la méthode de station réellement acquise. Les prédictions de station courante, cycles de départ/réentrée et contre-exemples du lot 2A restent disponibles.

Le code de production n'utilise aucun identifiant de jeu, trajet préparé, rôle fixe de couleur ou solution stockée. Les moteurs de jeu restent dans l'hôte opaque, et les campagnes ne transmettent au raisonnement que les observations et commandes publiques.

## Contrats source et portée des preuves

La [filiation détaillée](lot2c-method-continuation-lineage.md) relie chaque producteur, garde, acquisition et consommateur à sa source. Les exporteurs exécutent les modules originaux et vérifient l'inventaire de **1 786 fichiers** avant et après génération.

| Ensemble | Couverture |
| --- | --- |
| Entrée et reprise | 48 cas d'approche, 37 cas de reprise et 8 cas de contour, sur 106 scènes publiques synthétiques ; transformations de géométrie/palette/échelle, commandes opaques, contrôles de portée et vraies prévisions de jauge |
| Méthode et adaptateur | 15 frontières, 7 rappels, acquisition réelle de station par `record`, méthode restaurée chez le caller, chaîne approche → retour → sonde, 7 gardes et 6 retours/refus ; migration v1 et rejets de checkpoints incohérents |
| Capacité gérée | 45 recherches, 35 projections et 18 intégrations de géométrie ; orientation, palette, recharge, collecte en attente/confirmée, contradiction actuelle et époque étrangère |

Les scènes synthétiques et états explicitement fournis aux composants sont des contrats de composant. Leurs nombres ne sont pas des niveaux de jeu réussis. L'enrichissement inline du caller original est exécuté à partir de ses nœuds AST inchangés avec des doubles explicites aux frontières mémoire/router ; cela ne constitue pas une exécution de tout l'appelant historique.

La projection gérée conserve l'ordre des plans et des options de recherche. Seule la liste diagnostique `uncertain_edges`, issue d'un ensemble Python de vecteurs, est comparée comme un multiensemble. Cette qualification n'autorise aucune permutation des décisions ou actions.

## Résultats de campagne et vérifications

### Nouveau résultat : trois niveaux de LS20

La campagne froide réussit les **trois premiers niveaux de LS20 en 142 actions et 58 préfixes**. Une seule session conserve ses acquis aux frontières. Elle s'arrête naturellement à l'entrée du niveau 4 avec `NOT_FINISHED` et `target_levels_completed` ; ce résultat ne signifie pas que tous les niveaux du jeu sont terminés.

| Niveau réussi | Actions du niveau | Préfixes du niveau | Actions cumulées |
| --- | ---: | ---: | ---: |
| 1 | 17 | 11 | 17 |
| 2 | 67 | 28 | 84 |
| 3 | 58 | 19 | 142 |

Le [reçu d'exécution](lot2c-evidence/final/ls20-method-continuation/execution-ls20.json), la [trace publique](lot2c-evidence/final/ls20-method-continuation/ls20-public-trace.json.gz) et l'[index d'attribution](lot2c-evidence/final/ls20-method-continuation/ls20-method-continuation-attribution-v2.json) lient les actions, observations, acquisitions et frontières. Le temps actif observé est de 180,682 s ; l'exécution externe avec instrumentation et clôture prend 228,469 s. Ces durées décrivent cette campagne et ne sont pas un benchmark de vitesse.

La version 62 avait réussi le premier niveau en 17 actions puis atteint `GAME_OVER` au niveau 2. Le nouveau résultat conserve ce premier niveau et progresse désormais jusqu'à la troisième réussite. Le [rejeu froid de V62](lot2c-evidence/final/ls20-method-continuation/v62-first-command-divergence.json) reproduit les 25 premières commandes, puis diverge à la 26e action cumulée, pendant le niveau 2. Il s'arrête avant de fournir la réponse enregistrée pour une commande différente. Ce contrôle établit un changement de décision observé ; il n'établit pas à lui seul une causalité unique ou l'échec de toutes les trajectoires possibles de V62.

### Contribution réellement observée

Une méthode est acquise à la première frontière officielle, après la 17e action. Son hypothèse de station correspond à une unique entrée acquise préservant le pair. Les 47 appels morphologiques suivants consomment la vue de ce même propriétaire. La campagne sélectionne **deux préfixes `entry_rebind`**, **un `entry_probe` lié à un retour réellement acquis**, et **quatorze `managed_access`**. Ces chemins fournissent respectivement 10, 1 et 71 actions. Ils passent tous par le caller et les contrôles communs.

Au troisième niveau, le retour d'approche est acquis après l'action 91. La sonde suivante référence ce retour, la même observation courante et la même époque. Les références de parent, les faits et le journal concordent dans l'index d'attribution. Aucun checkpoint préparé n'est fourni à cette campagne.

Les extensions de cible restent des propositions conditionnelles. Sur les 58 décisions courantes, 42 portent une extension : 16 actuellement liées et 26 non liées. Six des extensions liées accompagnent néanmoins une abstention, avec `route_key=null` et aucune proposition. Les 20 extensions attachées à des propositions morphologiques sélectionnées comprennent 10 liées et 10 non liées. Toutes conservent `release_authority=false`. L'extension `remaining_alignment` associée à la sonde d'entrée est non liée. L'autorisation de l'action provient toujours du chemin de décision et des gardes communs, pas de la seule présence de cette extension.

La [résolution de sélection](lot2c-evidence/final/ls20-resolution.json) conserve les 967,662 s déjà consacrées à ce jeu et 283,532 s pour cette sélection et sa clôture : **1 251,193 s cumulées, soit environ 20 min 51 s**, sous la limite de 40 minutes. L'objectif étant atteint, le cas suivant prévu n'a pas été lancé. Les échecs des lots précédents restent dans leurs reçus.

### Comparaison originale et validation

La [comparaison source](lot2c-evidence/final/ls20-method-continuation/ls20-morphology-original-comparison.json.gz) réussit sur **143 paquets publics**, **312 appels morphologiques**, **600 appels de contexte partagé**, **58 décisions et checkpoints**, **112 retours sélectionnés** et **1 128 transitions historiques comparées**. Contacts, essais, départs et retour d'entrée sont reconstruits depuis une mémoire initialement vide par les appels originaux. La jauge et les collectes sont également rejouées par leurs propriétaires originaux. Les méthodes fournies au consommateur source sont les vues capturées du caller natif et sont vérifiées contre le checkpoint scellé précédent ; cette partie ne revendique pas une acquisition indépendante par l'appelant historique complet.

Le [delta formel](lot2c-evidence/final/validation/delta-tests-run.json) passe **859 tests sur 859 dans 17 fichiers**, avec zéro échec, annulation ou test ignoré. Le reçu vérifie que les sources et entrées de test sont restées identiques pendant l'exécution. Il couvre les chemins affectés, pas toute la suite historique.

Le [contrôle navigateur](lot2c-evidence/final/browser/ls20-verification.json) reproduit indépendamment les mêmes résultats dans l'aperçu géré, par les commandes ordinaires de l'interface : **17 actions / 1 niveau / 11 plans**, puis **84 / 2 / 39**, enfin **142 / 3 / 58** à l'entrée du niveau 4. La même session est conservée, sans action de jeu manuelle, saut de niveau, checkpoint préparé ou remise à zéro de l'agent. L'inspecteur reste fermé. La [capture finale](lot2c-evidence/final/browser/lot2c-ls20-three-levels.jpg) conserve les octets originaux du navigateur. Ce contrôle de l'interface n'est pas une comparaison octet par octet de toutes ses réponses ni un benchmark navigateur.

Le [reçu des contrôles](lot2c-evidence/final/validation/checks-run.json) confirme le typage, les deux audits, la vérification du diff et la construction de production. L'audit courant recense **151 composants vérifiés, 130 partiels et 1 088 en attente**, avec zéro transfert complet et les six conditions de migration complète encore fausses.

Le [contrôle final d'intégrité](lot2c-evidence/final/delivery-integrity.json) est **réussi** : 242 fichiers natifs, 253 membres d'archive, 530 entrées de source/test, 307 entrées de construction et les originaux V5/V6 conservent leurs empreintes. Les 26 parties de campagne reconstruisent exactement les **23 163 581 octets** du rapport. Les [index de campagne](lot2c-evidence/final/campaign-evidence-index.json) et de [performance](lot2c-evidence/final/performance-evidence-index.json) scellent les reçus avec leurs statuts propres. Cette intégrité confirme les octets et les validations enregistrées ; elle ne transforme pas le contrôle de coût non résolu en réussite.

## Coûts et reproductibilité

Le [protocole de coût](lot2c-evidence/performance/README.md) reprend les contrôles STCK, SMLP et LIFE avec les mêmes traces, déclarations, conditions, effectifs et huit métriques. La référence est la mesure après changement du lot 2B, conservée octet pour octet et explicitement réutilisée ; elle n'est pas présentée comme une nouvelle mesure. Le comparateur inchangé vérifie ces égalités et maintient le seuil de +10 % sur les seize médianes STCK/SMLP. Un excès bruité reste non résolu.

La [comparaison initiale](lot2c-evidence/performance/comparison.json) valide **14 des 16 médianes** soumises au budget. Les deux excès STCK sont **+12,43 %** pour la continuation du service et **+12,17 %** pour sa requête. Un suivi préalablement déclaré refait une référence V62 fraîche puis la version 0.35, avec cinq sessions par version et les huit métriques STCK inchangées. Sa [comparaison](lot2c-evidence/performance/stck-followup/comparison.json) conserve **cinq dépassements sur huit** : service **+25,74 %**, requête **+25,27 %**, garde **+13,61 %**, persistance **+20,67 %** et restauration **+16,45 %**. La session complète reste à **+8,24 %**. Le statut reste `budget_review_required` ; le bruit ne relève pas la limite et la cause de ces hausses n'est pas encore isolée.

Les nouvelles branches gérées passent un diagnostic de coût absolu distinct : **douze cas, 36 appels d'échauffement et 240 appels mesurés**, avec attentes source exactes. Les médianes observées vont de **0,441 à 0,699 ms** pour la projection, **0,869 à 2,270 ms** pour la recherche, **10,211 à 26,836 ms** pour la géométrie, **6,558 à 6,621 ms** pour l'approche et **0,237 ms** pour la reprise. Les entrées de composant et exclusions sont déclarées. Aucune référence artificielle de coût nul n'est utilisée pour une branche qui n'était pas raccordée dans V62. Ces mesures restent séparées des durées de jeu, du rendu navigateur et de la publication.

Les [résultats détaillés](lot2c-evidence/performance/results.md) conservent tous les essais, les hausses de p95 SMLP et de restauration LIFE, les dispersions et les limites d'inspection/Pause. La validation fonctionnelle et les trois niveaux LS20 sont acquis ; **la clôture du sous-lot 2C attend la résolution du budget de coût**. La prochaine étape consiste à localiser une cause reproductible puis à vérifier une correction sur le même protocole, sans affaiblir les preuves, les gardes ou le seuil.

La [feuille de route complète](v6-delivery-roadmap.md) conserve les onze lots, leurs dépendances et les branches encore ouvertes.

# Plan de vérification des opérations de composition

*OP01 à OP31 du Logos Engine*

SRA Playground • ARC‑3‑AGENT • 12 novembre 2026 • Version 1

**Objectif : établir, pour chaque opération, quel besoin la justifie, qui produit ses données et quelle décision utilise son résultat.** Le travail doit révéler les raccordements manquants, les appels inutiles et les fonctions déjà assurées par un mécanisme spécialisé, tout en conservant les temps de réponse de l’agent.

La démarche recommandée commence par un audit borné, puis raccorde les seuls besoins établis. La cible est un bilan explicite des 31 opérations. Le nombre d’appels ne constitue pas à lui seul un indicateur de progrès. Ce document planifie le travail ; il ne déclare aucune nouvelle intégration réalisée.

## 1 Base factuelle du plan

La préparation s’appuie sur une lecture du checkout de référence 0.67 au commit **8462204043aa368faa7df280d796bb706eb53b38**, effectuée le 12 novembre 2026. Cette référence sert à rendre l’audit reproductible ; elle n’est pas une affirmation sur la dernière version publiée. Les fichiers de source cités étaient suivis et non modifiés lors du contrôle. Les sources détaillées figurent en section 11.

| **Constat vérifié** | **Portée de la preuve** |
| --- | --- |
| 31 branches de calcul dans execute | Les 31 opérations possèdent une implémentation. Les résultats portent sur l’état fourni et gardent synthetic_scope: true. [S1] |
| 126 cas de référence des opérations | Les fixtures couvrent les 31 OP et les tests les comparent aux résultats Python. Leur présence a été relue ; les tests n’ont pas été relancés pour rédiger ce document. [S2] |
| 31 cas d’analyse dans le pont SRC | Le jeu de 66 cas du pont contient analysis-OP01 à analysis-OP31. Cela établit un dispositif de vérification du routage, sans prouver une utilisation pertinente en partie. [S3] |
| Cinq OP explicites dans le cycle natif examiné | La libération accepte OP18 et OP28 ; postAnalysis appelle OP29, OP30 et OP31 après le retour. Aucun recensement exhaustif des appels en jeu n’a été réalisé ici. [S4] |

Le dispatcher accepte une clé dynamique. Une recherche textuelle sans résultat ne suffit donc pas à déclarer une OP morte. OP14 possède aussi un contrat d’admission dans le pont générique, mais n’appartient pas à la liste admise par release dans l’autorité native examinée. Une référence au catalogue, telle la référence documentaire à OP01, ne compte pas comme une exécution. [S4]

Le compteur des 76 entrées mesure un autre périmètre. Les 31 OP, les entrées, les workflows et les nœuds de l’arbre doivent conserver des bilans séparés. Le présent plan peut alimenter le volet opérations du lot 11, tout en commençant avant la fin des 76 entrées. [S5]

## 2 Définir une utilisation réellement démontrée

Une opération est qualifiée pour un besoin précis lorsque l’on peut suivre six liens : **besoin → données produites → déclenchement → résultat → consommateur → décision ou preuve décisionnelle**. Le besoin doit être décrit à partir de la situation de l’agent, indépendamment du nom de l’OP et du routeur qui la choisit.

Une même OP peut servir plusieurs besoins et plusieurs appelants. Le registre garde 31 lignes de synthèse, reliées aux contrats de chaque usage. Un exemple qualifié ne suffit pas à qualifier tous les chemins qui appellent cette opération.

Exemple de besoin : « L’agent veut poursuivre ce plan, mais une condition de passage reste inconnue. » Cette formulation permet de vérifier ensuite si une opération adaptée intervient, ou si le besoin demeure ignoré. « Le routeur demande OP12 » ne constitue pas cette preuve.

| **Niveau** | **Ce qui doit être établi** |
| --- | --- |
| Calcul | Le résultat est correct pour des entrées valides ; les bornes et les états inconnus sont conservés. |
| Production | Les entrées viennent du chemin réellement utilisé par l’agent, avec identité, portée et révision. Un état entièrement fabriqué par le test ne prouve pas ce niveau. |
| Déclenchement | Le besoin conduit à l’OP ou à une réutilisation valide de son résultat. Le cas voisin sans besoin évite le calcul et sa préparation coûteuse. |
| Consommation | Un composant identifié lit le résultat pour admettre, éliminer, prioriser, maintenir, réviser ou arrêter une décision. |
| Contribution | Une preuve contrôlée montre le rôle de ce résultat. Une différence de journal ou une lecture sans effet sémantique ne suffit pas. |
| Coût | La préparation, le calcul, la conservation et l’inspection respectent les budgets définis en section 8. |

Un appel peut légitimement confirmer un choix déjà pressenti. Il n’a pas besoin de changer l’action à chaque occurrence. Il faut alors montrer la garde, le candidat rejeté ou la condition de validité qu’il établit. Le simple fait d’être sur le chemin du code ne démontre pas cette contribution.

**Deux objectifs de fin restent distincts.** L’audit est terminé quand les 31 situations sont qualifiées et les écarts explicités. L’intégration d’un besoin est terminée seulement quand son producteur, son déclenchement et son consommateur sont vérifiés ensemble. Un besoin manquant reste ouvert même si son audit est terminé.

## 3 Protocole de preuve par besoin

Chaque contrat reçoit un petit ensemble de cas ciblés. Les observations et sauvegardes de parties déjà disponibles sont à privilégier. Un même scénario peut démontrer plusieurs OP, avec une preuve distincte par opération. Un jeu de trois niveaux résolus est utile lorsqu’il vérifie une capacité complète nouvelle ; il n’est pas imposé pour chaque requête symbolique.

| **Cas** | **Contrôle attendu** |
| --- | --- |
| Besoin présent | Le producteur réel fournit l’état ; l’OP est exécutée, ou un résultat valide est réutilisé ; un consommateur et un effet sont identifiés. |
| Besoin absent | Aucun appel indu, aucune construction lourde des entrées et aucun balayage des 31 OP ne sont déclenchés. |
| Information insuffisante | Le résultat reste inconnu ou incomplet, ou l’appel est suspendu avec une raison. Un ensemble vide ne devient pas automatiquement une impossibilité ou une preuve de sûreté. |
| Dépendance modifiée | Une nouvelle observation, une autre époque de niveau ou une modification de modèle invalide précisément les résultats concernés. |
| Reprise et stabilité | Une restauration conserve les bonnes identités et révisions. Des événements dupliqués ne produisent pas plusieurs mises à jour du même fait. |

### Éprouver le lien avec la décision

Pour les usages revendiqués, rejouer un état enregistré dans le runtime commun avec les mêmes données, versions et graines. Comparer le traitement normal à une réponse de l’OP rendue indisponible ou incomplète. Une variante contrôlée du résultat peut compléter cette comparaison lorsque le contrat l’autorise. Le rejeu s’arrête avant toute émission d’actions au jeu et utilise un état séparé.

Comparer les candidats, les rejets, l’admission du plan, les questions ouvertes, les changements de modèle et la proposition suivante. Une action inchangée n’invalide pas à elle seule l’utilité de l’OP ; plusieurs preuves peuvent conduire au même choix. À l’inverse, une variation d’identifiant ou de texte dans la trace ne démontre pas une contribution.

Pour les OP de filtre, construire le cas avant le filtrage réel du consommateur : il doit contenir au moins un candidat pertinent et un candidat à écarter. Si un autre composant a déjà effectué exactement le même travail, documenter cette redondance. Injecter artificiellement une mauvaise donnée en aval de ce composant ne prouve pas un besoin réel de l’agent.

Les besoins attendus des scénarios doivent être annotés indépendamment des appels observés, à partir des observations et des contrats du domaine. Une collecte produite uniquement par le routeur manquerait précisément les besoins pour lesquels il n’a rien sélectionné.

### Situations qui demandent une vigilance particulière

- **Focus.** Le calcul courant choisit la première composition si le focus demandé manque. Le producteur ou l’adaptateur doit établir la cible exacte avant l’appel, et les tests doivent détecter un focus absent ou périmé. [S1]

- **Observation partielle.** OP06 peut traiter une propriété absente du retour comme différente. Le contrat doit contrôler ce qui a effectivement été observé avant d’interpréter une exception. [S1]

- **Préservation et faisabilité.** OP14 reprend les faits pour les propriétés absentes de l’effet déclaré ; OP25 conserve les candidats non réfutés. Ces calculs ne prouvent pas à eux seuls l’absence d’effet secondaire ni la faisabilité d’un objectif. [S1]

- **Autorité.** Une sortie symbolique ne remplace pas les gardes physiques. OP28 sélectionne des bundles déjà admis ; OP30 filtre des mises à jour ; OP31 restitue des évaluations fournies. Leurs consommateurs portent les décisions et les écritures effectives. [S1, S4]

Conserver la parité Python existante. Si le raccordement révèle une erreur du contrat historique, ouvrir une modification sémantique explicite avec ses preuves, au lieu de changer discrètement la définition de l’OP.

## 4 Traces minimales et registre de suivi

Le plan propose une instrumentation légère dans les points d’appel existants, complétée par un signal de besoin chez les producteurs ou décideurs concernés. Il ne nécessite pas un nouveau moteur qui parcourrait toutes les opérations à chaque action. Le suivi des besoins sert à repérer les omissions ; la trace d’appel sert à expliquer ce qui a été exécuté.

| **Information** | **Contenu minimum proposé** |
| --- | --- |
| Identité | Épisode, époque de niveau, observation et révision ; identifiant du besoin et cible précise. |
| Origine du besoin | Motif lisible, producteur et référence de la stratégie ou de l’objectif lorsqu’ils existent. Un rattachement absent est signalé, sans inventer une stratégie. |
| Appel | OP, appelant, mode exécuté / cache réutilisé / non requis / bloqué, et raison correspondante. |
| Entrées et résultat | Références des données et dépendances, statut de complétude, taille utile, résumé du résultat. Les états complets sont réservés à l’audit ciblé. |
| Consommation | Consommateur réel, décision concernée et type d’effet : filtre, garde, révision, maintien, abandon, ou information uniquement. |
| Coût | Temps de préparation, temps de calcul et taille de trace. Les temps imbriqués ne sont pas additionnés comme s’ils étaient indépendants. |

Un résultat en cache satisfait un besoin si ses dépendances sont toujours valides. Le compteur distingue réutilisation et nouvelle exécution. Une autorisation d’action ou une écriture de connaissance doit toujours revalider son époque, ses gardes et sa révision ; la mise en cache d’un calcul pur ne dispense pas de ces contrôles.

En fonctionnement normal, conserver des compteurs et des résumés bornés. En audit, activer les références détaillées nécessaires aux scénarios, avec export progressif et signalement des traces perdues. Ne pas recopier le catalogue de raisonnement, le graphe complet ou chaque état intermédiaire à chaque décision. Ce point répond aussi aux limites d’export déjà documentées dans le lot 11. [S5]

**Livrables techniques proposés**, à créer lors de l’exécution du plan : un registre de 31 contrats, un index de scénarios, les traces ciblées et un rapport de qualification. Les noms peuvent suivre les conventions du dépôt ; garder une seule source structurée pour le suivi et en dériver le tableau humain. Aucun de ces futurs fichiers n’est annoncé comme déjà créé par ce document.

## 5 Lots de travail et dépendances

Les identifiants C0 à C7 ci-dessous désignent ce chantier. Ils ne renumérotent pas les lots 1 à 11 de migration. Les lots C2 à C6 attribuent chacune des 31 opérations à un seul responsable principal ; une chaîne commune peut traverser plusieurs lots.

| **Lot** | **Périmètre** | **Dépendance** | **Critère de fin** |
| --- | --- | --- | --- |
| C0 | Inventaire et contrats des 31 OP | Aucune | 31 lignes sourcées, besoins formulés, producteurs et consommateurs identifiés ou explicitement manquants ; premier scénario choisi ; baseline et protocole de performance identifiés sans imposer de benchmark si aucun code d’exécution n’est modifié. |
| C1 | Traces et rejeu des besoins | C0 | Besoin, appel, non-appel, cache et consommation sont distinguables ; instrumentation bornée, comportement inchangé sur les témoins ; surcoût de l’instrumentation mesuré et qualifié. |
| C2 | Cycle existant : 18, 28, 29, 30, 31 | C1 | Cinq chaînes caractérisées ; contributions ou limites démontrées jusque dans la décision suivante ; tout changement affectant l’exécution est qualifié sur les coûts concernés avant clôture complète. |
| C3 | Conditions et accès : 03, 04, 08, 09, 11, 12, 14, 26 | C1 | Besoins prouvés raccordés ; domaines complets, contraintes et inconnues traités sans faux verdict ; coût des raccordements exécutés qualifié sur les chemins concernés. |
| C4 | Objectifs et regroupements : 01, 02, 05, 10, 15, 25 | C1 ; contrats de dépendance si utilisés | Regroupements et sélection consommés réellement ; identités, ambiguïtés et objectifs préservés ; coût ajouté mesuré lorsque le runtime est modifié. |
| C5 | Informations et exploration : 06, 07, 13, 20, 21, 22, 23 | C1 ; contrats des questions si utilisés | Observations, hypothèses et prévisions distinguées ; une information obtenue peut modifier la suite ; coût des nouveaux déclenchements et recherches qualifié. |
| C6 | Blocages et variantes : 16, 17, 19, 24, 27 | C1 ; preuves de contrainte si utilisées | Aucun raccourci sans preuve ; reprise, préservation et arrêt vérifiés sur les besoins rencontrés ; coût des variantes et recherches bornées qualifié. |
| C7 | Bilan intégré et coûts | Résultats qualifiés C2 à C6 | 31 dispositions explicites ; écarts requis résolus ou laissés ouverts sans fausse clôture ; coût de la version intégrée comparé à la baseline du chantier et coûts cumulés publiés. |

### C0 Établir les contrats et choisir le premier témoin

Lire les implémentations, le catalogue, les appels dynamiques et les producteurs spécialisés sur un commit précis. Pour chaque OP, noter le besoin, les données attendues, le consommateur possible, les limites de l’état fourni et la preuve disponible. Séparer appel statique, appel observé, lecture du résultat et contribution établie.

Examiner d’abord un préfixe réel utilisant OP18 ou OP28 et son retour OP29 à OP31. Choisir ensuite un manque concret de précondition ou d’accès pour OP03, OP08, OP12 ou OP26. S’il est déjà résolu par une fonction spécialisée, nommer cette fonction et conserver le cas comme preuve de recouvrement. Le périmètre reste fini : 31 lignes, une chaîne existante, un besoin candidat, puis les écarts classés.

**Performance — C0.** Identifier le commit de baseline, les jeux de référence, le protocole et les mesures disponibles. Si C0 reste purement documentaire et ne modifie aucun chemin d’exécution, aucun nouveau benchmark n’est requis ; toute mesure existante doit seulement être référencée avec son contexte.

### C1 Installer une preuve légère sur la chaîne réelle

Raccorder la collecte à execute, au pont SRC et aux consommateurs existants, sans changer les choix de l’agent. Enregistrer aussi le besoin avant la sélection. Vérifier que les appels directs et dynamiques sont couverts et que les tests artificiels sont distingués des sessions de l’agent. Ajouter le rejeu contrôlé et vérifier un cas positif, un cas sans besoin et une invalidation de cache.

Terminer ce lot lorsque la chaîne témoin est lisible, que l’instrumentation n’altère pas les décisions de référence et que son coût est mesuré. Les lots suivants réutilisent ce mécanisme ; chacun évite de recréer son propre système de traces.

**Performance — C1.** Mesurer explicitement le surcoût de l’instrumentation légère sur la baseline et sur les chemins témoins. C1 n’est pleinement qualifié que si l’instrumentation reste dans le budget retenu ou si son coût est clairement désactivable et documenté. Le mode de diagnostic détaillé est mesuré séparément.

### C2 Vérifier la boucle déjà appelée

Pour OP18 et OP28, suivre le besoin jusqu’à l’admission et au retour. Tester la non-sélection d’un candidat incompatible avant son rejet normal. Pour OP29, rechercher quel composant lit la comparaison. Pour OP30, distinguer la conservation du relevé et la révision du modèle par son propriétaire. Pour OP31, identifier la décision qui utilise satisfaction ou faisabilité.

Le résultat peut être « utilisé uniquement pour la trace » si c’est ce que montre le code. Un tel constat n’est pas un échec d’audit. Il permet de décider ensuite si un consommateur est nécessaire, si le rôle documentaire suffit ou si l’appel est redondant. N’attribuer aucun apprentissage ou replanification à la seule présence de trois reçus.

**Performance — C2.** Toute modification d’OP18, OP28 ou de la chaîne OP29→OP30→OP31 qui affecte l’exécution doit être mesurée sur les chemins concernés avant de déclarer C2 entièrement validé. Un statut « fonctionnellement terminé, coût à confirmer » reste autorisé si la preuve de performance est insuffisante.

### C3 Raccorder les besoins de dépendance établis

Commencer par OP03, OP08, OP12 et OP26, dont les limites de production sont déjà documentées sur le chemin matériel du lot 1. Les fonctions spécialisées existantes restent la première source à examiner. Construire des adaptateurs seulement quand le besoin, le schéma et le consommateur sont établis. [S6]

OP04 et OP11 fournissent des liens possibles ; ils ne garantissent pas toutes les préconditions. OP09 exige un domaine d’alternatives déclaré complet. OP14 doit respecter le contrat d’effets et de préservation. La fin du lot exige des essais où l’inconnu suspend le bon plan, puis où une observation pertinente autorise sa reprise.

**Performance — C3.** Mesurer le coût de préparation des données, du déclenchement des OP et de leur consommation, pas seulement le temps interne des opérations. Les calculs doivent rester à la demande et les résultats valides réutilisables. La clôture complète exige une qualification du coût global sur les chemins modifiés.

### C4 Faire consommer les regroupements et les objectifs

Vérifier que les groupes d’OP01 et OP02 réduisent réellement un travail répété ou servent une sélection, sans fusionner des identités ayant des preuves différentes. Les ambiguïtés d’OP05 doivent rester visibles jusqu’à leur résolution. OP10 et OP15 utilisent des objectifs déjà déclarés ; OP25 fournit un ensemble de candidats dont un décideur doit ensuite assumer le choix.

Relier chaque objectif à sa source actuelle et à sa stratégie si elle est représentée. Un objectif principal directement confié au système reste décrit comme tel dans l’audit. La généralisation du principe « tout objectif provient d’une stratégie » constitue une décision d’architecture distincte et ne doit pas être simulée par une étiquette.

**Performance — C4.** Si les regroupements ou sélections ajoutent du travail au runtime, mesurer leur coût sur les situations où ils s’activent et vérifier qu’ils ne déclenchent pas de parcours global inutile lorsque le besoin est absent. Le lot peut rester « coût à confirmer » tant qu’aucune conclusion fiable n’est disponible.

### C5 Relier les informations à une question utile

Partir d’une question qui change la décision : portée d’un effet, utilité d’un objet, accès à un espace, comportement autonome ou effet distant. Le lot doit prouver que la réponse alimente un modèle, une stratégie, un objectif ou un plan. Une hypothèse garde une identité unique ; l’objectif éventuel visant à la vérifier la référence.

Les cycles et effets distants viennent d’observations identifiées. Une prévision d’OP23 reste conditionnelle au modèle et ne devient pas une observation. Les besoins d’exploration utilisent la chaîne OP18 qualifiée dans C2 ; cette dépendance porte sur le contrat d’exécution, sans empêcher de préparer les cas et producteurs en parallèle.

**Performance — C5.** Les questions, hypothèses, prévisions et explorations doivent être déclenchées par besoin. Mesurer le coût des recherches et de la préparation d’information, conserver les bornes et distinguer explicitement une recherche interrompue d’une absence de solution. La clôture complète exige une qualification du coût global des chemins ajoutés.

### C6 Vérifier les solutions de repli

Distinguer blocage prouvé, manque d’information et recherche non terminée. OP16 reçoit des blocages déjà prouvés ; OP17 des reprises déjà autorisées ; OP19 une séquence déjà justifiée. OP24 et OP27 filtrent des variantes produites ailleurs. Chaque raccordement doit nommer ce producteur et son contrat de preuve.

Tester l’arrêt au premier pas non prouvé, la présence de contraintes à préserver et le retour d’une reprise qui échoue. Si aucun producteur réel ou besoin représentatif n’existe, conserver une tâche de capacité distincte plutôt que fabriquer les données qui feraient passer l’OP.

**Performance — C6.** Mesurer les coûts des générateurs de variantes, détours et reprises ainsi que ceux des filtres OP eux-mêmes. Les recherches restent bornées et interruptibles ; l’absence de résultat sous budget ne devient pas une impossibilité. La qualification complète du lot inclut le coût sur les chemins réellement modifiés.

### C7 Clore le bilan selon le périmètre prouvé

Réconcilier les résultats sur le commit intégré, exécuter les vérifications affectées et les scénarios partagés, puis comparer les coûts. Conserver les qualifications de chaque OP et les preuves collectives. Une partie gagnée atteste un résultat de l’agent ; elle n’atteste pas automatiquement l’apport de toutes les opérations croisées.

Publier séparément le nombre de contrats examinés, les OP exécutées, les résultats réutilisés, les usages consommés et les contributions établies. Mentionner les besoins encore non couverts, les équivalents spécialisés et les exclusions de périmètre. Ce bilan nourrit le lot 11 et les prochaines capacités à développer.

**Performance — C7.** Rejouer la version intégrée contre la **baseline stable du début de ce chantier**, en plus des comparaisons lot par lot, afin de détecter l’accumulation de petites régressions. Publier le coût cumulé, le coût par lot lorsque disponible, et les limites des mesures concurrentes ou non isolées. C7 n’est pleinement clos que lorsque la version intégrée respecte les critères retenus ou qu’un écart est explicitement accepté comme dette ouverte.

## 6 Organisation en parallèle

**Commencer par C0, puis stabiliser le contrat de trace dans C1.** Après ce point, C2 et C3 sont les premières voies recommandées. C4, C5 et C6 peuvent avancer sur leurs scénarios et producteurs dès que leurs interfaces nécessaires sont connues. Une dépendance précise reste attachée au cas concerné ; elle ne bloque pas tout un lot.

Une organisation pratique consiste à maintenir deux ou trois lots de famille en parallèle, selon les fichiers touchés, avec une responsabilité explicite pour l’assemblage commun. Ce nombre est une recommandation d’organisation, pas une mesure de la puissance disponible. Chaque lot utilise son checkout et sa branche, sauvegarde régulièrement des commits cohérents et résout les conflits en préservant le travail des autres.

Les changements du dispatcher, de l’autorité et du schéma commun sont regroupés en petits commits faciles à reprendre. Les tests et adaptateurs propres aux familles restent séparés. Les interfaces peuvent être stabilisées sans réserver un verrou ni demander l’accord simultané de toutes les conversations.

**Aucun verrou global, aucune exclusivité courte et aucune attente générale des autres lots ne sont introduits par ce plan.** Les mesures concurrentes sont autorisées, mais leur contexte non isolé et leurs limites doivent rester explicites. Les actions de publication dépendent des instructions actives de la conversation qui réalise le lot, et non de la simple existence de ce document.

## 7 Matrice des 31 opérations à qualifier

Cette matrice décrit les besoins et raccordements à vérifier. Elle ne prétend pas que les consommateurs proposés existent déjà. Les fonctions de calcul et leurs limites proviennent de S1 ; les déclencheurs et effets attendus sont des contrats de travail proposés. Les termes de code servent à retrouver les données exactes.

| **OP et lot** | **Besoin et données à produire** | **Consommateur et effet à prouver** | **Non appel et limite à conserver** |
| --- | --- | --- | --- |
| OP01 · Inventorier · Lot C4 | Plusieurs compositions doivent être regroupées. Fournir leur type, requires, effect, things, propriétés, relations et contexte. | Le sélecteur ou un index exploite les groupes, en conservant les identités et preuves de leurs membres. | Éviter le regroupement sans consommateur ou après une révision sans effet. Une même signature ne prouve pas une équivalence complète. |
| OP02 · Équivalence · Lot C4 | Comparer plusieurs chemins produisant un état final. Fournir paths, post_state et contraintes vérifiées. | La sélection réutilise ou élimine une alternative réellement équivalente, avec justification conservée. | Sans état final complet, garder les chemins distincts et le statut incomplet. Aucun raccourci fondé sur une équivalence supposée. |
| OP03 · Préconditions · Lot C3 | Un plan envisage une composition dont les conditions doivent être vérifiées. Fournir le focus exact, requires et les faits courants. | L’admission accepte, refuse ou ouvre une question selon vrai, faux et unknown. | Sans condition pertinente, éviter le calcul. Un requires vide ne prouve pas que les conditions métier ont été produites. |
| OP04 · Ouvertures · Lot C3 | Évaluer ce qu’une composition pourrait rendre possible. Fournir son effet et les exigences des autres compositions. | Le planificateur retient des suites candidates puis vérifie leurs autres conditions. | Un seul lien effet–exigence suffit au calcul. Ne pas le transformer en preuve que la suite est réalisable. |
| OP05 · Ambiguïtés · Lot C4 | Plusieurs compositions déclarent le même effet. Fournir les compositions et leurs effets. | Le décideur conserve les alternatives ou demande une observation discriminante. | Pas de question d’ambiguïté si aucun choix n’en dépend. Même effet déclaré ne signifie pas même cause ni même coût. |
| OP06 · Exceptions · Lot C5 | Un retour paraît contredire un effet attendu. Fournir le focus, les attentes et les observations attribuées. | Le propriétaire du modèle examine le contre-exemple et révise ou restreint la règle. | Vérifier l’observabilité des propriétés. Une donnée absente ne doit pas devenir une contradiction certaine par défaut. |
| OP07 · Frontières · Lot C5 | Un objectif ouvert justifie d’explorer une zone. Fournir frontiers, accessibilité, visite et preuve du lien à cet objectif. | Le choix d’exploration sélectionne une frontière utile et un producteur prépare l’action. | Écarter les frontières déjà visitées, inaccessibles ou sans lien établi à la question. Le calcul ne crée pas de chemin. |
| OP08 · Prédécesseurs · Lot C3 | Une exigence de la cible manque. Fournir les effets possibles et les exigences de la cible. | Une stratégie introduit un préalable candidat, puis contrôle ses conditions et sa pertinence. | Sans graphe effect/requires fiable, signaler le producteur manquant. Un lien compatible ne prouve pas sa réalisabilité. |
| OP09 · Obligatoires · Lot C3 | Chercher ce qui est commun à toutes les alternatives. Fournir leur domaine et la preuve de sa complétude. | La stratégie conserve un préalable réellement obligatoire ou réduit une recherche. | Sans alternatives non vides et alternatives_complete, rester incomplet. Quelques solutions connues ne représentent pas toutes les solutions. |
| OP10 · Finaux · Lot C4 | Il faut identifier les cibles terminales déclarées. Fournir goals et leurs références de composition. | Le choix de cible ou le contrôle de fin utilise les objectifs terminaux concernés. | Aucun objectif terminal ne peut être inféré du seul nom ou aspect d’un objet. Les objectifs proviennent d’un producteur identifié. |
| OP11 · Déblocages · Lot C3 | Plusieurs compositions peuvent satisfaire des conditions d’autres compositions. Fournir le réseau effect/requires. | La stratégie compare des préparations possibles et les rattache aux objectifs concernés. | Ne reconstruire que la portion affectée. Les liens produits restent des possibilités, pas une autorisation générale. |
| OP12 · Inconnues · Lot C3 | Une chaîne de dépendances reste bloquée par des informations absentes. Fournir depends_on, requires, faits et focus. | Le plan suspend le bon segment ; une stratégie choisit la question ou l’expérience à mener. | Conserver la borne de 64 compositions et incomplete si nécessaire. Une inconnue n’est ni une impossibilité ni une raison de tout explorer. |
| OP13 · Portée des effets · Lot C5 | Décider si la portée observée d’un effet suffit au plan. Fournir les retours attribués à la composition. | Le modèle ou la garde borne ses prédictions et identifie une observation manquante. | La portée non observée reste inconnue. Ne pas présenter les retours recensés comme une simulation exhaustive. |
| OP14 · Contraintes · Lot C3 | Une composition doit préserver des propriétés. Fournir requires, facts, effect et preserve. | Le filtre de candidats contribue à une garde qui contrôle aussi le contrat des effets déclarés. | Les propriétés absentes de effect sont reprises des faits. Cela exige une justification du modèle ; aucune préservation physique générale implicite. |
| OP15 · Intermédiaire · Lot C4 | Choisir parmi des objectifs intermédiaires déjà déclarés et non terminés. Fournir leurs conditions et les faits. | Le sélecteur retient une étape utile, liée à son objectif parent et à sa stratégie actuelle. | Éviter les objectifs terminés ou sans contribution établie. L’OP ne crée pas elle-même une hiérarchie complète de sous-objectifs. |
| OP16 · Blocages · Lot C6 | Un blocage global prouvé pourrait invalider une continuation. Fournir deadlocks, preuve et portée. | Le décideur écarte le plan concerné ou déclenche une recherche de reprise autorisée. | Une liste vide ne prouve pas la sûreté. L’OP filtre des preuves fournies ; elle ne découvre pas les blocages. |
| OP17 · Reprise · Lot C6 | Une reprise est nécessaire après un échec. Fournir recovery, autorisation et préservation vérifiée. | Le sélecteur choisit une reprise admissible et contrôle son exécution ainsi que son résultat. | Sans autorisation ou preuve de préservation, ne libérer aucune action sur la seule base d’une proposition de reprise. |
| OP18 · Explorer · Lot C2 | Une composition non observée répond à une question ouverte. Fournir son identité, open_question et état observé. | L’admission commune et les gardes libèrent une expérience liée à ce besoin, puis acquièrent son retour. | Éviter l’expérience déjà couverte ou sans question utile. La liste d’OP18 ne remplace ni la stratégie de choix ni les gardes. |
| OP19 · Pas forcés · Lot C6 | Une séquence contient des pas justifiés comme forcés. Fournir forced, preuves et contraintes vérifiées. | Le consommateur exécute uniquement le préfixe prouvé et revalide au retour. | Arrêt au premier pas non prouvé, avec statut incomplet. L’OP n’infère pas elle-même que les pas sont obligatoires. |
| OP20 · Utilité des objets · Lot C5 | L’utilité d’un objet inconnu peut affecter une décision. Fournir entities, utility et question. | Une stratégie retient une hypothèse utile et, si nécessaire, un objectif d’expérimentation qui la référence. | Ne pas tester tous les objets inconnus. Le filtrage ne produit pas de preuve d’utilité ni de priorité automatique. |
| OP21 · Utilité des espaces · Lot C5 | L’utilité d’un espace inconnu compte pour un objectif. Fournir spaces, utility et question. | La stratégie choisit une acquisition d’information ou une exploration pertinente. | Une zone inconnue n’exige pas toujours une visite. L’OP ne prouve ni l’accès ni l’utilité future. |
| OP22 · Effets distants · Lot C5 | Un effet observé à distance peut modifier un plan. Fournir remote_effects et références d’observation. | Le modèle relationnel ou les contraintes intègrent cet effet avec sa portée et sa provenance. | Une observation associée ne prouve pas seule la causalité. Sans nouvelle donnée pertinente, réutiliser la projection valide. |
| OP23 · Autonomes · Lot C5 | Le moment d’une action dépend d’une évolution autonome. Fournir le cycle, sa preuve et sa phase. | Le plan utilise une prévision conditionnelle et vérifie ensuite le retour réel. | Sans preuve de cycle, conserver unknown. Une projection de phase n’est pas un simulateur général ni une observation. |
| OP24 · Détours · Lot C6 | Le chemin courant ne convient pas ; des chemins alternatifs existent. Fournir paths, état final voulu et contraintes. | Le choix de plan retient une variante admissible et préserve les preuves du chemin choisi. | L’OP filtre les chemins fournis ; elle n’en génère pas. Aucun détour n’est réputé impossible parce que le générateur n’a rien fourni. |
| OP25 · Choisir une cible · Lot C4 | Plusieurs compositions sont candidates à un objectif. Fournir candidate_objective et l’évaluation de faisabilité. | Un décideur classe et sélectionne parmi les candidats, selon une stratégie explicitée. | Non réfuté ne signifie pas faisable prouvé. L’OP ne choisit pas seule le meilleur candidat et ne justifie pas sa priorité. |
| OP26 · Accès admissible · Lot C3 | L’agent doit atteindre une composition cible. Fournir accesses, target et contraintes vérifiées. | L’admission retient un accès disponible puis les gardes d’étape valident l’exécution. | L’OP ne construit pas d’accès. Ne pas transformer un plan plausible en accès vérifié pour alimenter le filtre. |
| OP27 · Permutations · Lot C6 | Une autre organisation peut atteindre la cible en préservant des éléments. Fournir permutations, cible, contraintes et références. | Le plan sélectionne une permutation dont les éléments requis restent conservés. | Les variantes viennent d’un générateur identifié. Un preserve_refs vide ne vaut pas preuve que toutes les contraintes ont été prises en compte. |
| OP28 · Réaliser · Lot C2 | Une composition doit être réalisée par un bundle courant. Fournir sa référence, admitted et les actions non vides. | L’autorité vérifie le bundle sélectionné puis libère les seules actions admises et observe leur retour. | Le filtre ne rend pas un bundle sûr par lui-même. Éviter de compter comme contribution autonome une simple répétition de l’admission en amont. |
| OP29 · Comparer · Lot C2 | Un retour doit être confronté à des attentes. Fournir expected_properties et observed_properties pour le même événement. | Le modèle, la garde de continuation ou le décideur utilise confirmed, refuted ou unknown. | Sans attente vérifiable, signaler une analyse vide. Une comparaison affichée uniquement dans la trace reste un usage documentaire. |
| OP30 · Réviser · Lot C2 | Des mises à jour étayées concernent une composition à la révision courante. Fournir knowledge_updates, preuve et observation_revision. | Le propriétaire autorisé persiste la mise à jour ; une lecture ultérieure montre son rôle dans le modèle ou la décision. | L’OP est un filtre pur. Une écriture de relevé n’est pas à elle seule un apprentissage ; refuser doublons, preuves absentes et révisions périmées. |
| OP31 · Réexaminer · Lot C2 | Une nouvelle preuve peut changer le statut d’un objectif. Fournir objective_assessments et leur provenance. | Le décideur maintient, termine, suspend ou réoriente un objectif, avec effet vérifié sur la suite. | L’OP restitue les évaluations fournies. Un progrès officiel ne prouve ni une cause visuelle terminale ni la faisabilité de toutes les sous-cibles. |

## 8 Préserver les temps de réponse

Fixer avant chaque comparaison le commit de référence, le candidat, la configuration, les graines, les conditions de chauffe et les budgets. Utiliser le protocole de mesure du projet et conserver tous les échantillons prévus. Les durées d’une commande de test ou de construction ne remplacent pas les durées de session de l’agent.

**Critère conservé : pour chaque jeu de référence, la médiane de la session complète doit augmenter de strictement moins de 10 %.** STCK et SMLP restent évalués séparément dans le périmètre actuel. Un dépassement d’une phase reste visible et peut être accepté si le critère global du jeu passe ; aucun jeu ne compense l’autre. [S5]

**Baseline cumulative du chantier.** En plus de la comparaison avec le lot précédent, conserver un commit de référence stable choisi au début de C0. À C7, comparer la version intégrée à cette baseline afin de détecter une dérive cumulative. Deux lots chacun proches de +8 % peuvent produire ensemble une hausse bien supérieure à 10 % ; une série de validations locales ne suffit donc pas à garantir le budget de l’ensemble.

- Déclencher les calculs à partir d’un besoin ou d’une dépendance modifiée. Éviter les parcours systématiques du graphe et les appels aux 31 OP à chaque décision.

- Mesurer aussi la construction des entrées, le coût du routeur, les copies et la sérialisation. Une requête courte peut être alimentée par une préparation coûteuse.

- Conserver les bornes de recherche, les statuts incomplets, les caches par dépendances et l’invalidation à chaque changement pertinent. Respecter les identités et la portée des preuves.

- Comparer le mode normal avec instrumentation légère, et mesurer séparément le mode de diagnostic détaillé. Celui-ci n’est pas présenté comme gratuit ni confondu avec le coût de production.

- Contrôler continuation connue, nouvelle décision, acquisition, restauration, Pause et export prolongé. Publier les distributions et un percentile élevé seulement si l’effectif permet de l’interpréter.

Les mesures réalisées en parallèle restent possibles sans verrou. Elles sont étiquetées **non isolées** et ne suffisent pas à affirmer que le seuil est garanti indépendamment de la contention. Si le contexte ne permet pas de conclure, conserver un verdict de coût à confirmer, sans maquiller le résultat ni bloquer l’ensemble du travail.

Les rejouements ciblés précèdent les campagnes longues. Si un jeu dépasse le budget actif déjà fixé, conserver les temps consommés et le motif d’arrêt ; ne pas remettre son horloge à zéro pour obtenir une preuve plus favorable. Réutiliser les scénarios qualifiés dès qu’ils répondent au risque examiné.

## 9 Tableau de décision et clôture

Chaque ligne du registre conserve une disposition, un périmètre, une preuve, une limite et une prochaine action éventuelle. Les catégories ci-dessous ne sont pas additionnées pour annoncer un faux pourcentage d’intelligence ou de parité.

| **Disposition** | **Signification et suite** |
| --- | --- |
| Usage démontré en situation | Producteur, besoin, appel, consommation et contribution vérifiés dans le périmètre annoncé. Conserver la régression et le coût. |
| Usage démontré en rejeu | La chaîne est établie sur des observations enregistrées dans le runtime réel. La qualification en partie reste séparée si elle est requise. |
| Appel sans contribution établie | L’appel existe, mais l’usage reste documentaire, redondant ou non démontré. Nommer la question à résoudre avant de le présenter comme décisionnel. |
| Besoin requis non raccordé | Créer une tâche précise : producteur absent, mauvais déclencheur, résultat ignoré ou contrat incomplet. Cette intégration reste ouverte. |
| Fonction spécialisée équivalente | Citer le chemin qui satisfait le besoin et sa preuve. Cela ne compte pas comme un appel réel à l’OP ; décider si la convergence apporte quelque chose. |
| Hors du périmètre actuel | Décrire le besoin qui justifierait une activation future. Une absence d’usage dans le corpus testé ne prouve pas une inutilité générale. |
| Retrait ou remplacement proposé | Vérifier appelants dynamiques, API, catalogue, sauvegardes et contrats de parité. Justifier la migration avant toute suppression ; le retrait n’est pas automatique. |

La clôture de l’audit exige 31 dispositions sourcées, sans ligne laissée « à voir » sans question précise. La clôture fonctionnelle de l’intégration exige que tous les besoins déclarés requis pour le périmètre soient couverts et que les contre-exemples passent. La qualification de performance exige le respect du critère de coût par jeu avec une preuve interprétable. Si elle manque, conserver « intégration fonctionnelle terminée, coût à confirmer », sans bloquer les autres lots. Un dépassement avéré garde son verdict non conforme. Les besoins exclus restent visibles et n’autorisent pas une affirmation de parité totale V5/V6/V7.

Pour une lecture humaine, chaque contribution doit pouvoir se résumer ainsi : « Le passage est encore indéterminé ; la stratégie cherche l’information manquante ; OP12 repère cette inconnue ; une expérience la mesure ; le retour révise la condition ; le plan reprend. » Cet exemple est illustratif. Les références techniques restent accessibles au détail, dans les perspectives Perception, Informations, Stratégies, Objectifs et Plan d’actions.

## 10 Mandat du premier lot

**Premier lot recommandé : C0.** Sa sortie rend les prochains raccordements concrets et évite de commencer 31 intégrations indépendantes. Le texte suivant peut être donné à la conversation qui exécutera le travail.

Travaille sur le lot C0 du plan de vérification OP01 à OP31 du Logos Engine. Prends un checkout indépendant sur un commit identifié et applique les instructions actives du projet. Produis un registre des 31 opérations avec leur besoin, leur définition réelle, leurs producteurs, leurs appelants directs ou dynamiques, leurs consommateurs, leurs limites et leurs preuves disponibles.

Vérifie en priorité la chaîne OP18 ou OP28 puis OP29, OP30 et OP31 sur une observation ou un préfixe enregistré. Cherche ensuite un besoin concret relevant d’OP03, OP08, OP12 ou OP26 ; identifie la fonction spécialisée qui le traite déjà, ou la partie réellement manquante. Ne présente pas une référence au catalogue, un compteur ou un état fabriqué comme une preuve d’usage dans l’agent.

Conserve les distinctions entre calcul correct, appel observé, résultat consommé et contribution à la décision. Sélectionne les scénarios nécessaires à C1 et classe les écarts par importance. Utilise d’abord les preuves existantes ; n’engage une nouvelle campagne longue que pour une question qui ne peut pas être résolue autrement.

Ne branche aucune opération pour faire monter un compteur et ne change pas les décisions du runtime dans ce lot. Le travail courant, les commits et les sauvegardes ne dépendent d’aucun verrou ou d’une attente collective. Termine avec le commit sauvegardé, les 31 dispositions, les incertitudes explicites et le périmètre exact d’C1. La publication du site ne fait pas partie de ce premier lot d’audit.

## 11 Sources et limites de la préparation

Les constats de code ont été vérifiés par lecture dans le dépôt ci-dessous. Les lots, déclencheurs, schémas de trace et critères complémentaires sont des propositions de planification. Aucun test, nouvelle partie, mesure de coût, changement du runtime ou déploiement n’a été effectué pour préparer ce document.

Racine consultée : /workspace/sites/sra-lot9a-baseline067-20261112

Commit : 8462204043aa368faa7df280d796bb706eb53b38

**S1 Calculs et définitions.** src/logos-engine/v6-operations.ts ; src/logos-engine/v6/catalog.json. Branches execute, statut complete_on_supplied_state, limites et identité des 31 opérations.

**S2 Parité des calculs.** tests/v6-operations.test.ts ; tests/fixtures/v6-operations-reference.json. 126 cas, non-mutation, sémantique Python et provenance du snapshot source 786dcf51ca57773d8e3a8948ce9ea3655e7baf8e.

**S3 Pont de composition.** tests/v6-composition-engine.test.ts ; tests/fixtures/v6-composition-engine-reference.json. 66 bridgeCases, dont 31 analyses OP, et tests de routage et de persistance.

**S4 Chemins du runtime.** src/logos-engine/v6-native-authority.ts, release et acquire ; src/logos-engine/v6-target-binding.ts, postAnalysis ; src/logos-engine/v6-composition-engine.ts, src_apply, operationAdmission et persist.

**S5 Feuille de route.** docs/migration/v6-delivery-roadmap.md, sections Lot 11 et Opérations, arbre et performances. Distinction registre/parité, preuves attendues et critère de coût par jeu. Les anciennes règles de verrou sont remplacées ici par la consigne explicite de cette conversation.

**S6 Limites du raccord historique.** docs/migration/lot1-composition-return-lineage.md, sections OP03, OP08, OP12 et OP26 et Autorisation et analyse réellement utilisées. Producteurs absents sur le chemin matériel étudié et portée des reçus OP29 à OP31.

Empreinte SHA‑256 de v6-operations.ts au contrôle : 4aad959893595a1844721b93ec8897479536f95ccfa890be045656fa1e96fa06.

Les identifiants de source permettent de réconcilier ce plan avec une version ultérieure. Au démarrage de chaque lot, vérifier les changements intervenus depuis cette référence et ne pas réutiliser silencieusement une qualification sur un code différent.
# Lot 5A — Filiation de `linked_temporal_preparation`

## Portée et statut

Ce document décrit la fermeture effectivement consommée par l'entrée source `LinkedPreparation`, sa représentation native et ses preuves indépendantes. La proposition de cette entrée passe directement par `PhaseRelations.linked_contact.propose`. L'acquisition de `PhaseRelations` et, sous conditions, de `PhaseTransfer` reste active même lorsque les actions proviennent d'une autre famille.

L'adaptateur et le contact sont transférés dans cette portée. Les modules de phase et de transfert sont **partiels au niveau du module source complet** : leur acquisition, leur état et leurs gardes déléguées sont présents, mais leurs politiques de proposition autonomes ne sont pas raccordées. Leur présence ne constitue donc pas une activation implicite des propositions de `PhaseRelations.propose` ou de `PhaseTransfer.propose`.

L'export indépendant est disponible et le propriétaire temporel passe désormais **51/51 tests ciblés**, avec typecheck transitif réussi. La [preuve commune finale][common-proof] de **native 0.53.0** passe **16/16 contrôles** sur deux branches publiques synthétiques. La [suite large reprise][corrected-wide-gate] passe **3 835/3 835 dans 102 fichiers**, les [cinq contrôles complémentaires][corrected-checks] passent et les [sept régressions enregistrées][regression-summary] passent **119/119 contrôles**. L'attribution préalable passe **64/64**, le préflight **65/65** et la readiness est réussie. Le budget global qualifié est **accepté 2/2**, avec revue **4 669/4 669** : **+9,62 % STCK** et **+4,66 % SMLP**. L'intégrité passe et la [première publication privée Site 84][site-publication] est acquise. Le complément documentaire conserve le même moteur ; aucun gain de vitesse global, résultat de jeu UI ou succès WEAV au niveau 6 n'est annoncé.

Le [manifeste final][native-manifest] lie 283 fichiers natifs au digest `d30dedc767c588b0fdf33ea398a4ad207b07b027e8b3642b3b262c625c52387f` ; l'[archive][native-archive] conserve 294 fichiers. Le [reçu d'application des mappings][map-application] conserve la première intégration sur la préparation 7A commit `5ff6d707ca3b924d554e4ed9de2b002326543f3c`. La [réconciliation publiée][predecessor-reconciliation] atteste désormais la fusion de **Site 82**, commit `0ca36b0a6a358e1e89420753bbcec4a33f028e0a`, et de sa clôture documentaire **Site 83**, commit `bed48116585da864dd5c412ed11dd6990a950e8e`. Les entrées d'exécution contrôlées sont identiques entre 82 et 83 ; **Site 82 / native 0.52.0** reste donc la référence de coût explicite. La source native 0.53 et ses preuves fonctionnelles ne changent pas lors de cette fusion documentaire.

La [publication Site 84][site-publication] a réussi le **10 novembre 2026 à 22:11:55 UTC**, sur le commit `51e2813dedb2d71001290f94f100605e0327ead3`, déploiement `appgdep_6af396981b2c8191872a706bffe760f3`. L'adresse est [sra-playground.yannick-fontan.chatgpt.site](https://sra-playground.yannick-fontan.chatgpt.site) et l'accès reste privé. Il s'agit de la première publication du moteur 0.53 ; le présent complément de documentation garde son digest et ses preuves.

## 1. Sources figées et empreintes

La référence est le commit `786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`. Les quatre sources directes sont conservées sous `reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/laya_proto/`.

| Source originale | SHA-256 vérifié avant et après l'export |
| --- | --- |
| [common_linked_preparation.py][source-adapter] | `90095faefe45772155a565b32fb12172f23569d317e890e814925b801c098012` |
| [common_linked_contact.py][source-contact] | `bb2f258632fc71f280afaf2c988907fe7ee916e51da926389df44bb70f63f8b9` |
| [common_phase_relations.py][source-phase] | `8b43e2cf31d784af6efe7b1535520fcb3385f8d58893b7617d4e0360e07fea0f` |
| [common_phase_transfer.py][source-transfer] | `34ea2a9d1827d5a9c61269b40f15fb7adedb618aedbd8f781832c68749dcbe88` |

Le [reçu de l'oracle][oracle-receipt] constate l'identité des inventaires de **1 786 fichiers** avant et après l'import et l'exécution. Leur empreinte commune est `2c06ba8133eddb500e1cfc9ef7620f978e13530dc690b7255f457a2b7cf441f2`. Le reçu donne aussi les empreintes du manifeste et des deux dépendances originales effectivement importées, `geometric_observer.py` et `neutral_observer.py`.

L'[exporteur Python indépendant][exporter] importe les originaux figés. Il ne lit pas les sorties TypeScript pour produire les valeurs attendues. Les rasters et les retours sont des observations publiques synthétiques déclarées ; aucun moteur de jeu, spécification privée, solution ou `project_sources` ne fournit les attentes. L'[appelant source][source-runtime] est cité ici pour l'ordre d'acquisition, sans élargir les modules importés par l'exporteur.

## 2. Fermeture réellement consommée

| Propriétaire | Responsabilité transférée | Limite de la portée |
| --- | --- | --- |
| [LinkedTemporalPreparation][native-adapter] | `propose`, `bind`, `before`, `after`, `recordSource`, `record`, obligations, projection source et restauration native | L'entrée conserve l'alias source vers le contact ; elle ne sélectionne pas une autre politique de phase. |
| [LinkedTemporalContact][native-contact] | Applicabilité visuelle, apprentissage des déplacements, chemins, contrastes entrée/départ/réentrée, préparation persistante ou réversible, question de phase, observations de rejeu, propositions et gardes | Les rôles terminaux, la causalité et la dynamique du rejeu restent des hypothèses locales. |
| [LinkedTemporalPhaseRelations][native-phase] | Historique contigu, géométrie, modèle conditionnel, contraste distant, prédiction future, contre-exemples, validation d'un nouvel endpoint, frontières et délégation des gardes | La politique autonome `PhaseRelations.propose` est hors du chemin consommé et n'est pas activée. |
| [LinkedTemporalPhaseTransfer][native-phase] | `fromBoundary`, remise à zéro d'époque, mesure des sites, acquisition des nouveaux effets et modes, état portable, gardes déléguées | La politique autonome `PhaseTransfer.propose` et sa recherche d'accès ne sont pas activées. |
| [Aides communes][native-common] | Comparaisons, digests Python, ensembles/maps, masques, patches, interruption bornée | Les bornes et la sérialisation du checkpoint sont des extensions natives déclarées. |

Le chemin de proposition est : `LinkedPreparation.propose` → `phase.linked_contact.propose(phase, observation, rows, inputs, remaining)` → ajout de `linked_preparation_plan: true`. L'absence d'état acquis donne `null`. Le candidat natif inscrit cette même instance dans la sous-question `program_subquestion / linked_temporal_preparation` et la partage avec l'acquisition passive ; le [runtime candidat][native-runtime] ne crée pas un deuxième propriétaire d'apprentissage.

`full_observation` conserve une observation qui possède déjà `entities`. Sinon, les gardes `before` et `after` la reconstruisent par l'observateur neutre à partir du raster public, de l'époque, du score, de l'état, des entrées disponibles, de la révision et du préfixe de portée de `observation_ref`. **`record` ne fait pas cette reconstruction.** Une observation BEFORE partielle est toutefois admise lorsque son état correspondant est déjà retenu : la source n'en reprend alors pas de snapshot. Cette nuance figure dans l'oracle.

## 3. Acquisition et ordre des événements

Pour une transition ordinaire, `PhaseRelations.record` exige une succession réelle des références d'observation. Il retient le premier état si nécessaire, vérifie que le dernier état correspond à BEFORE, puis ajoute la commande et AFTER. Une commande avec des données non vides devient `null` dans l'historique des commandes de phase : elle n'est pas transformée en déplacement clavier appris.

L'ordre interne conservé est le suivant :

1. `LinkedContact.observe` consomme les transitions encore inédites ; ses événements sont ajoutés, puis sa file d'événements est vidée.
2. En l'absence de modèle, `PhaseRelations` cherche une relation de répétition de chemin et son éventuel contraste distant.
3. Si un propriétaire portable existe, `PhaseTransfer.observe` acquiert les nouvelles mesures de l'époque courante.
4. Le modèle de phase peut ensuite figer une prédiction future, enregistrer un contre-exemple ou soutenir localement un nouvel endpoint.
5. L'adaptateur ajoute cette liste à son historique `events`, puis ajoute un témoin `passed` si le score officiel a augmenté.

La source retourne **la liste brute complète**, y compris une liste vide. L'API native expose cette liste via `recordSource`; `record` fournit l'enveloppe standard `NativeRecordResult` `{ events }` à la boucle commune. Cette adaptation ne change pas la liste qui représente le retour source.

L'appelant conserve deux cas distincts, dans l'ordre source :

| Contexte | Acquisition et écriture de preuve |
| --- | --- |
| Famille sélectionnée | Un seul `record`; écriture de la liste complète à `linked_preparation_event:<revision BEFORE>`, même si elle est vide. Le passage passif ne rappelle pas cette famille. |
| Action sélectionnée par une autre famille | Un seul `recordSource` passif sur les mêmes BEFORE, commande et AFTER ; écriture de `linked_preparation_event:<revision BEFORE>` seulement si la liste est non vide. Aucune proposition de contact étrangère n'est attribuée à ce retour. |

Dans le bloc d'acquisition passif de l'appelant source, les préparations suivent les propriétaires de support et de matériau adressé et précèdent l'acquisition des séries. Le candidat respecte la position disponible de cette entrée ; la famille distincte de matériau adressé n'est pas déclarée transférée par ce document. La [preuve commune][common-proof] vérifie un propriétaire unique dans l'ordre déclaré et douze retours acquis exactement une fois : dix propres au propriétaire et deux passifs. Ce résultat porte sur ses deux chaînes publiques synthétiques ; il n'établit pas la parité universelle de l'appelant original.

## 4. Contact appris et chemins continus

L'applicabilité s'appuie sur une translation publique mesurée : un receveur, un déplacement axial dont le pas dépasse la taille du receveur, un sol observé, une enceinte ouverte alignée de même matière et des occurrences denses reliées par une composante mince. La sélection requiert une liaison visuelle non ambiguë. Ni les couleurs, ni les coordonnées, ni les noms d'actions ne fournissent une direction préalable.

Les vecteurs sont acquis sur les réponses observées. La recherche de chemin progresse sur les patches de sol mesurés et traite les sites de contact comme des destinations conditionnelles. Un contact peut produire des pixels distants changés ; leur comparaison au départ distingue une persistance observée d'une restauration. Une réentrée n'étaye une occupation réversible que si le changement revient après une restauration au départ. Les événements conservent les alternatives, notamment la décoration et un changement autonome ; ils ne certifient pas une cause exclusive.

Ce propriétaire produit des **key-paths d'actions sans données**, avec un préfixe limité à `min(16, remaining)`. Chaque pas retient son action, sa pose de départ, sa pose attendue et le patch de destination avant exécution. Le préfixe s'arrête dès qu'un vecteur manque ou qu'il atteint un contact dont le patch n'est pas un sol connu. La mesure d'une entrée encore inconnue est une question unitaire. Les chemins de clics ou mixtes relèvent d'autres contrats de la boucle commune ; ils ne sont pas ajoutés artificiellement à ce transfert.

L'oracle comporte un apprentissage froid sans état injecté : quatre réponses synthétiques apprennent droite, bas, gauche et haut, puis le contact propose deux déplacements successifs. Deux branches publiques distinguent un changement distant effectif de son absence. La branche sans effet distant refuse la poursuite de cette question. La preuve séparée du [runtime commun gelé][common-proof] reprend ces deux chaînes avec les priorités de production et l'autorité WHY/ACT : chaque branche comporte trois calibrations sélectionnées par le propriétaire, une calibration acquise passivement, puis son préfixe de deux touches. Le changement distant détermine ensuite une proposition propre `ACTION2`, tandis que son absence laisse le caller choisir `observed_frontier` / `ACTION1`. Les deux décisions suivantes ne sont pas comptées comme des retours exécutés supplémentaires.

## 5. Gardes, rejeu et préservation

Avant chaque pas de contact, la garde vérifie l'époque, le score, la disponibilité de l'action et la pose du receveur. Le premier pas vérifie aussi la référence d'observation et le hash de frame liés à la proposition. Le patch de destination gelé doit encore correspondre lorsqu'il est présent. Les copies visibles doivent rester compatibles avec les positions attendues du rejeu ; une copie absente ne devient pas une preuve de présence.

Après chaque pas, un changement d'époque, de score ou d'état officiel scelle le préfixe avec un résultat inconnu de frontière. Hors frontière, la pose mesurée et les copies visibles doivent correspondre à la prédiction. Une divergence, un résultat inconnu ou le dernier pas scelle le préfixe. Un préfixe conditionnel n'autorise donc pas une émission aveugle de toutes les actions.

La question de phase nécessite un contexte local acquis : contact réversible, entrée encore non liée ou action de phase retenue, emplacements de phase observés et capacité disponible. Elle gèle le chemin source. Le retour à la pose initiale fournit une question de répétition temporelle. Les observations suivantes distinguent les mouvements acceptés des commandes bloquées, suivent les chemins retenus et peuvent réfuter leur prédiction. La durée, l'autonomie et l'identité d'une occurrence superposée ne sont pas déclarées certaines.

Les obligations protègent les pixels du contexte de phase et les effets préparés quand leur condition de disponibilité est satisfaite. Elles conservent leurs références d'évidence, les entrées susceptibles de les réviser et, pour les effets, le masque d'occlusion du receveur. Une proposition de changement de phase déclare les changements de préservation attendus avec ses histoires conditionnelles. La mesure d'un effet entièrement occulté reste `unknown`.

Les gardes de `PhaseRelations` et `PhaseTransfer` restent disponibles par la délégation source : `bootstrap` vers le contact, `portable` vers le propriétaire portable, puis garde de phase ordinaire. Les cas directs de l'oracle vérifient cette délégation sans prétendre que les politiques autonomes correspondantes sont sélectionnées en production.

## 6. Frontières : libération des rasters et conservation conditionnelle

À une frontière d'époque ou d'état, `PhaseRelations` remet à zéro son historique actif : `states`, `commands`, géométries, contact, essais et relations locales. Il commence par le seul snapshot AFTER de la nouvelle époque. Les rasters complets des anciens niveaux cessent ainsi d'appartenir à l'historique actif de ce propriétaire. Une hausse de score isolée, sans changement d'époque ou d'état, n'est pas cette branche de remise à zéro dans la source ; le témoin `passed` demeure enregistré.

Le transfert entre époques est conditionnel :

- Si cette frontière augmente le score et que le modèle, le soutien du nouvel endpoint et l'effet distant sont présents, `fromBoundary` tente de construire une hypothèse portable. Une entrée source distante exploitable est requise ; cette construction peut rendre `null`.
- Si la frontière augmente le score sans ces trois éléments, l'éventuelle hypothèse portable antérieure est conservée.
- Une frontière sans progression officielle ne conserve pas ce propriétaire portable.

Le `prior` portable contient la forme, le masque et la taille acquis, des vecteurs cohérents, des patches locaux en octets, des gabarits de site et de destination, ainsi que les références de frontière, d'entrée, de départ et de validation. Il ne contient pas la liste complète des anciens snapshots. `resetEpoch` libère les sites, essais, échantillons, visites, changements de mode et caches locaux de l'époque précédente. Les sites et effets de la nouvelle époque doivent être mesurés de nouveau. Un événement `recall_as_hypothesis` conserve explicitement le caractère hypothétique du rappel.

L'historique d'événements de l'adaptateur et ses témoins de score restent conservés. Cette remise à zéro du propriétaire actif ne supprime ni les traces déjà persistées dans le graphe ni les journaux de preuve. Elle ne constitue pas non plus une politique générale d'éviction des autres familles. Les deux frontières scorées de l'oracle démontrent la conservation conditionnelle du `prior` et la reprise d'acquisition, pas une nouvelle autorité de proposition portable.

## 7. État natif, restauration et bornes déclarées

### Représentation et propriété

`sourceState()` est une projection explicite de l'état Python : tableaux NumPy vers tableaux, octets vers tableaux d'octets, ensembles triés, maps à clés composées vers listes d'entrées. L'ordre d'insertion des vecteurs du contact est conservé. Les digests de contact emploient le JSON Python avec espaces par défaut ; ceux des géométries et de phase emploient les séparateurs compacts de leur source. Cette projection n'est pas présentée comme une API de checkpoint définie par Python.

Le checkpoint natif ajoute le schéma `logos-engine.linked-temporal-preparation.v1`. `nativeState()` retient une valeur JSON immuable et réutilise les snapshots historiques déjà possédés. `state()` et `sourceState()` fournissent des copies exportables. La restauration reconstruit un propriétaire séparé et ne le publie qu'après validation ; les snapshots immuables antérieurs restent utilisables par leur propriétaire.

La validation contrôle notamment le schéma, la politique de contact, les types et compteurs, la contiguïté états/commandes, l'unicité des références, les registres de géométrie concordants, le digest et les dimensions des masques, la concordance du masque du receveur avec le masque canonique acquis, les curseurs de contact, les étapes élémentaires de chronologie, les maps sans doublons et les dimensions des patches portables. Les validations mémorisées de snapshots et de géométries sont attachées à des objets fermés par `retainNativeJson`, avec vérification du lien digest/dimensions pour la géométrie. Ces vérifications protègent le contrat de restauration ; elles ne remplacent pas la preuve d'origine fournie par le magasin de connaissances ni une certification sémantique exhaustive d'un état arbitraire. Le [passage ciblé 51/51][targeted-receipt] comprend ces derniers contrôles et leurs cas de corruption.

Le constructeur Python brut de `PhaseTransfer` ne crée que `prior` avant `reset_epoch`. La classe native initialise ses champs locaux immédiatement. Le cas direct `from_boundary` compare donc `prior`; le chemin réel de frontière compare l'état après `resetEpoch`. Cette différence d'initialisation n'est pas dissimulée dans l'oracle.

### Recherche interrompue

L'API compatible source peut fonctionner sans bornes natives. Le candidat de production fournit explicitement `maximumNodes: 65_536` et `maximumWork: 2_000_000`, ainsi que le délai courant et le signal d'interruption transmis par l'exécution. Ces limites portent sur le travail de proposition du contact ; elles ne sont pas une limite globale de tous les coûts d'acquisition ou de sérialisation.

En cas d'épuisement, l'état de contact modifié pendant la tentative est restauré. Le propriétaire rend `null` et expose un refus lié à l'observation courante avec `status: unknown`, `reason: linked_temporal_search_work_bound`, `frontier.complete: false`, les compteurs et la borne épuisée. Il conserve `release_authority: false` et `block_unrelated_probe: true`. Dans la sélection ordonnée du candidat, ce témoin validé devient une offre inconnue sans action : le drapeau bloque effectivement le passage à une autre question sur ce chemin et ne passe pas par les aides de préférence. Une famille désactivée n'est pas interrogée. L'interruption ne devient ni une impossibilité apprise ni un contre-exemple du mécanisme. Le [passage de développement du routage et de l'enregistrement][routing-receipt] réussit neuf tests ; il couvre notamment les drapeaux vrai/faux/absent et le rejet des témoins périmés ou revendiquant une autorité. Les contrôles de borne du propriétaire et ce contrat d'adaptateur ne sont pas une mesure de latence de Pause ni une preuve de tous les chemins de coordination.

## 8. Oracle indépendant et qualifications

L'[oracle compressé][oracle-fixture] porte le schéma `logos-engine.v6.linked-preparation-reference.v1`. Son SHA-256 est `280397c931e2ba7bff5aa99931b64b938d18e5224e66e9da397407c0e3018299` ; le reçu indique 719 074 octets compressés et 11 809 591 octets décompressés.

| Ensemble exporté | Contenu et portée |
| --- | --- |
| 14 aides | Enceintes, occurrences liées, marqueurs de phase, reconstruction d'observation, compression de chemins, patches portables. |
| 9 chaînes froides, 165 opérations | Apprentissage de vecteurs, chemin positif à plusieurs actions et contraste sans effet, persistance/réversibilité, phase et rejeu, translation et permutation de palette, refus, remise à zéro, modèle et effet distant acquis puis deux frontières scorées. |
| 13 composants directs | Mesure visible/occultée, construction du `prior`, gardes portables positives et négatives. Ces entrées d'état sont explicitement séparées de l'apprentissage froid. |
| 2 exceptions source | Historique non contigu ; observation AFTER malformée dépourvue de `entities`. Elles restent exportées avec leur état exact. |

Le [test de conformité][oracle-tests] compare résultats et projections complètes des chaînes, à la fois sur un propriétaire continu et sur un propriétaire reconstruit depuis un checkpoint après chaque appel. Les [tests natifs ciblés][native-tests] couvrent les contrats de restauration, les gardes, la préservation et les bornes propres au natif. Leur [reçu postrevue][targeted-receipt] donne **51 réussites, aucun échec ni test ignoré et un typecheck transitif de sortie 0**. Les sept entrées directes — quatre modules, deux tests et fixture — ont les mêmes empreintes avant et après. Le résultat 49/49 antérieur aux derniers tests reste conservé dans le [journal de développement][development-receipt].

La qualification d'entrée malformée est explicite : Python peut ajouter une commande puis lever `KeyError('entities')` sur AFTER, laissant un historique partiellement modifié. L'oracle conserve cette exception et cet état. Le natif rejette ce retour hors contrat par `TypeError` avant de publier une mutation d'historique. Le test attend cette différence intentionnelle ; il ne normalise pas l'exception source en `null`. À l'inverse, l'erreur d'historique non contigu reste un refus avec le message source, et la possibilité d'un BEFORE partiel déjà retenu reste couverte.

## 9. Preuve commune et état de livraison

Le [rapport commun final][common-proof] et son [reçu d'exécution][common-execution] passent **16/16 contrôles** sur le digest native 0.53 déclaré. Ils vérifient l'identité de l'oracle et des originaux, l'enregistrement unique du propriétaire dans l'ordre `surface`, l'acquisition propre/passive exactement une fois, la libération de deux touches par WHY/ACT, la garde intermédiaire avec acquisition différée, la restauration depuis le Kernel et l'effet du retour distant sur la décision commune suivante. La source native, les déclarations originales, le script et ses entrées restent inchangés pendant cette exécution.

Chaque branche commence avec un propriétaire vide. La disponibilité publique fournit un contrôle de calibration à chaque état initial, puis les cinq entrées sans données ; la table de réponse dépend des pixels, des champs du protocole et de la commande, indépendamment du propriétaire choisi. Les deux branches totalisent **douze retours**, dont **dix propres et deux passifs**. Les **quatre touches dans deux préfixes de deux actions** font partie de ce total. Cette preuve ne conduit pas un navigateur, ne mesure pas Pause ou les délais muraux et n'utilise aucun moteur de jeu pour produire ses réponses synthétiques. Les deux premiers échecs de développement du harnais et leurs scripts restent dans la [revue préintégration][common-development].

| Validation | État attesté | Limite conservée |
| --- | --- | --- |
| Composants temporels | 51/51 et typecheck transitif réussi. | Domaine public admis ; qualification AFTER explicite. |
| Boucle commune finale | 16/16, deux branches, douze retours. | Contrat synthétique froid ; aucune victoire de jeu. |
| Première suite large | [3 834/3 835][initial-wide-gate], un échec dans 102 fichiers. | Attente ancienne de 56 raccordements / huit entrées `surface`, corrigée à 57 / neuf dans le seul test. |
| Reprise officielle | [3 835/3 835 dans 102 fichiers][corrected-wide-gate] et [cinq contrôles réussis][corrected-checks] : typage, deux audits, diff et build. | Périmètre affecté explicite ; l'échec initial reste conservé, aucune revendication d'exécution de toute la suite historique. |
| Régressions enregistrées | [Sept cas sur sept, 119/119 contrôles][regression-summary], 292 actions et 210 préfixes. | WEAV enregistré termine 81 actions / 81 préfixes ; aucune nouvelle campagne live ni comparaison de vitesse. |
| Navigateur | [Indisponible][browser-receipt] après deux timeouts CDP. | Aucune navigation ni session de jeu UI sur le candidat ; pas de succès rendu ou Pause/reprise annoncé. |
| Attribution préalable | [64/64 et revue indépendante passée][owner-review] : 14 créations appariées, 70 deltas de B, 58 points. | Portée fermée aux fragments et consommateurs explicitement recensés ; aucun gain de temps déduit. |
| Préflight et readiness | [65/65][static-preflight], puis [readiness réussie][readiness-execution]. | Réserves navigateur et WEAV séparées ; incidents de préparation conservés. |
| Coût global qualifié | [Accepté 2/2 ; revue 4 669/4 669][qualified-cost-review]. | Qualification structurelle prémesure et réparation de garde de dossier postmesure explicites ; diagnostic 10/16 et rejet strict conservés. |
| Intégrité fonctionnelle | [Passée][delivery-integrity] : 283 natifs, 294 archivés, 647 entrées source/tests, 348 build, 1 786 originaux inchangés. | Identité des fichiers et preuves ; aucune nouvelle campagne ni garantie de longue session. |
| Publication | [Site 84 publié avec succès][site-publication], commit `51e2813dedb2d71001290f94f100605e0327ead3`. | Première publication 0.53, accès privé inchangé ; complément documentaire sur le même moteur. |

Le [reçu de correction][validation-correction] conserve les empreintes avant/après du test de compteur, le premier audit signalant le fixture Feedback absent et sa reconstruction depuis deux parties sous son empreinte originale. Il constate que l'implémentation native n'a pas changé. La suite reprise s'achève avec 3 835 réussites, aucun échec ni test ignoré, et des entrées de source et de tests inchangées pendant l'exécution. Les cinq contrôles complémentaires donnent `failures: []` à l'audit. Les audits comptent **57/76 entrées raccordées, aucune entrée partielle et 19 en attente** ; les modules restent **174 `component_verified`, 145 `partial_transfer`, 1 050 en attente et zéro `verified`**. Les six critères de migration globale sont toujours faux. Les mappings de ce lot attribuent `component_verified` à l'adaptateur et au contact, et `partial_transfer` aux modules PhaseRelations et PhaseTransfer.

La [revue fonctionnelle finale][functional-review] rassemble la preuve commune et les sept comparaisons terminées. Les régressions couvrent **292 actions, 299 paquets publics complets, 1 405 frames d'animation, 210 préfixes, 502 requêtes et 21 frontières naturelles**, sans modification des entrées d'exécution. Les [sept rapports en 61 parties vérifiées][regression-parts] conservent leurs octets exacts. Le [rapport utilisateur][user-report] et l'[index des preuves][evidence-index] distinguent le rejeu WEAV enregistré achevé de son suivi live déjà épuisé.

La [réconciliation publiée][predecessor-reconciliation] fixe la référence de coût à Site 82 / native 0.52.0, digest `f5f4a67d68f867d3a37ef66fd7c07b9e75b9d201daceb732038f8fa71caa59eb`. Le [premier reçu d'attribution structurelle][owner-attribution] conserve l'écart d'origine d'un fragment immuable partagé à `STCK / measured / 7` : `transition.acquire` et `outcome.acquire` ne portent pas le même rôle de création. L'attribution v2, liée au [contrat final][final-cost-contract], passe **64/64 contrôles**. Sa [revue indépendante][owner-review] vérifie la qualification fermée de **14 créations appariées**, **70 deltas réellement attribués au candidat** et **58 points capturés**, sans calcul de temps ni exclusion d'échantillon.

Pour ces quatorze fragments exactement, B crée la valeur immuable plus tôt pour le propriétaire temporel ; A crée ensuite la même valeur lors de son utilisation par l'appelant commun. Les octets canoniques, les adresses, les créations effectives et les consommateurs admissibles sont liés aux captures. À chaque point, l'écart de révision est expliqué par les deltas attribués à B diminués des créations appariées déjà observées dans A ; les deltas de B ne sont pas effacés. Les autres identités, révisions, causes et ordres communs restent contrôlés dans leur périmètre déclaré. Les origines et les digests source sont conservés, sans normalisation générale ni revendication d'égalité complète de tous les états privés. Le supplément a été déclaré avant la qualification v2 et avant toute mesure.

Le [premier préflight][static-initial-failure] signalait une dépendance Pyodide absente côté référence. La [réparation de préparation][dependency-repair] a créé un lien vers les mêmes assets existants ; les sources natives sont restées inchangées. Le [premier échec de readiness][readiness-initial-failure] venait d'une comparaison erronée entre un résumé `{fileCount, digest}` et un manifeste complet contenant `files`. Le lecteur initial, le traceback et l'heure de constat restent conservés ; seule la lecture de cette projection a changé. Aucun de ces incidents ne modifie les résultats fonctionnels ou ne constitue un défaut observé du moteur. Le [préflight final][static-preflight] passe **65/65** et la [readiness][readiness-execution] est réussie, avec les réserves navigateur et WEAV distinctes.

La [fenêtre officielle][window-execution] est terminée : le 10 novembre 2026, de **21:29:50 à 21:38:25 UTC**, dans l'ordre **A1/B1/B2/A2**. A est la référence Site 82 / native 0.52.0 ; B est le candidat native 0.53.0. Les **32 sessions mesurées et 400 actions**, ainsi que les **huit chauffes et 24 actions séparées**, sont conservées. Les médianes globales regroupent huit sessions par version et jeu. La [consolidation qualifiée][qualified-costs], sa [revue numérique 4 669/4 669][qualified-cost-review] et la [revue indépendante finale][final-cost-review] donnent :

| Jeu | Médiane globale A | Médiane globale B | Augmentation | Règle globale qualifiée |
| --- | ---: | ---: | ---: | --- |
| STCK | 9 872,156 ms | 10 821,705 ms | **+9,6185 %** | Acceptée, strictement sous +10 %. |
| SMLP | 16 573,027 ms | 17 346,155 ms | **+4,6650 %** | Acceptée, strictement sous +10 %. |

Le [rejet du comparateur historique strict][cost-strict-failure] reste un échec. Le verdict accepté est celui de la qualification des quatre chemins de compteurs et des fragments, déclarée avant mesure. Le premier analyseur qualifié a ensuite [refusé le nom du dossier lié par son propre contrat][cost-analysis-initial-failure]. La [réparation postérieure à la mesure][cost-io-correction] produit des variantes séparées qui admettent ce dossier exact et déclarent leur provenance. Les outils gelés, les rejets, la déclaration, la readiness, la fenêtre et les rapports bruts restent conservés ; données, règles, calculs et contrôles structurels sont inchangés. La revue indépendante finale reconstruit le résultat depuis les quatre rapports bruts et conserve cette qualification explicite.

Le diagnostic reste **10/16** : dans les deux jeux, nouvelles décisions, persistance et restauration dépassent +10 %. Les hausses médianes de restauration sont **+99,40 % sur STCK** et **+69,50 % sur SMLP** ; leurs p95 augmentent respectivement de **192,94 %** et **134,56 %**. La seconde cohorte STCK à **+11,6734 %** reste incluse. La marge globale STCK est de **0,3815 point de pourcentage**, environ **37,666 ms** de médiane de session. Les [résultats détaillés][cost-results] conservent les distributions, toutes les cohortes et les dépassements. Les temps globaux augmentent dans les deux jeux : l'acceptation ne constitue pas une accélération ni une garantie de stabilité sur des sessions longues.

L'[intégrité fonctionnelle finale][delivery-integrity] confirme le digest natif inchangé et les inventaires. Le [premier transport des rapports][evidence-transport] conserve **neuf grands gzip en 75 parties**, incluant les sept régressions et les deux captures structurelles. Le [contrôle des entrées de publication][publication-inputs] est une vérification préalable, distincte du [reçu effectif de Site 84][site-publication]. Les réserves navigateur et WEAV restent attachées à cette livraison.

Le [transport des sources vers la publication][source-transport] a rencontré un refus Git : le JSON `shared-fragment-first-creator.json`, **39 817 093 octets**, excédait la limite de **32 Mio par objet**. Le [guide de reconstruction][transport-guide] décrit le second transport, distinct des neuf gzip : ce JSON est conservé en **45 parties**, et le commit complet original `33d91ef1b8a6343c554b5c18beacd051816e11b9` avec les commits de l'ancien plan est conservé dans un **bundle Git incrémental de 609 621 octets en une partie**. Le [reçu de reconstruction][transport-reconstruction] vérifie l'aller-retour exact des octets et la validité Git du bundle reconstruit. Les originaux, les index antérieurs, les rejets et les résultats restent disponibles sans modification de code, tests, build ou coûts.

Les **trois envois initiaux réussis, le refus conservé et les quatre envois correctifs réussis** n'ont produit aucun Site intermédiaire. La première publication native 0.53 est Site 84 ; la clôture documentaire suivante garde ce moteur. L'ensemble de ces contrats ne clôt ni 5B, ni 5C, ni la parité globale V5/V6, et n'empiète pas sur les travaux 4B et 7B des autres conversations.

[source-adapter]: ../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/laya_proto/common_linked_preparation.py
[source-contact]: ../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/laya_proto/common_linked_contact.py
[source-phase]: ../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/laya_proto/common_phase_relations.py
[source-transfer]: ../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/laya_proto/common_phase_transfer.py
[source-runtime]: ../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/laya_proto/common_frontier_runtime.py
[native-adapter]: ../../src/logos-engine/v6-linked-temporal-preparation.ts
[native-contact]: ../../src/logos-engine/v6-linked-temporal-contact.ts
[native-phase]: ../../src/logos-engine/v6-linked-temporal-phase.ts
[native-common]: ../../src/logos-engine/v6-linked-temporal-common.ts
[native-runtime]: ../../src/logos-engine/v6-native-runtime.ts
[exporter]: ../../scripts/export-v6-linked-preparation-reference.py
[oracle-fixture]: ../../tests/fixtures/v6-linked-preparation-reference.json.gz
[oracle-receipt]: lot5a-evidence/diagnostic/source-oracle-export.json
[oracle-tests]: ../../tests/v6-linked-temporal-reference.test.ts
[native-tests]: ../../tests/v6-linked-temporal-preparation.test.ts
[targeted-receipt]: lot5a-evidence/diagnostic/linked-temporal-20261110T203811Z-validation.json
[development-receipt]: lot5a-evidence/diagnostic/linked-temporal-development.json
[routing-receipt]: lot5a-evidence/diagnostic/blocking-and-registration-tests.json
[common-proof]: lot5a-evidence/final/linked-temporal-common-loop.json.gz
[common-execution]: lot5a-evidence/final/linked-temporal-common-loop-execution.json
[common-development]: lot5a-evidence/diagnostic/common-loop-before-integration/attempt-review.json
[native-manifest]: lot5a-evidence/final/source-manifest.json
[native-archive]: lot5a-evidence/final/source-archive.json
[map-application]: lot5a-evidence/diagnostic/transfer-map-application.json
[initial-wide-gate]: lot5a-evidence/final/validation/delta-tests-run.json
[corrected-wide-gate]: lot5a-evidence/final/test-expectation-correction/validation/delta-tests-run.json
[corrected-checks]: lot5a-evidence/final/test-expectation-correction/validation/checks-run.json
[validation-correction]: lot5a-evidence/diagnostic/validation-correction.json
[regression-summary]: lot5a-evidence/final/regressions/regression-summary.json
[functional-review]: lot5a-evidence/final/functional-block-review.json
[regression-parts]: lot5a-evidence/final/regression-evidence-parts.json
[predecessor-reconciliation]: lot5a-evidence/final/published-predecessor-reconciliation.json
[owner-attribution]: lot5a-evidence/performance/owner-structural-attribution.json
[owner-review]: lot5a-evidence/performance/diagnostic/shared-fragment-independent-review.json
[final-cost-contract]: lot5a-evidence/performance/owner-growth-contract.json
[static-preflight]: lot5a-evidence/performance/static-preflight.json
[static-initial-failure]: lot5a-evidence/performance/diagnostic/static-preflight-initial-failure.json
[dependency-repair]: lot5a-evidence/performance/dependency-preparation-repair.json
[readiness-initial-failure]: lot5a-evidence/diagnostic/readiness-initial-failure.json
[readiness-execution]: lot5a-evidence/performance/readiness-execution.json
[window-execution]: lot5a-evidence/performance/exclusive-window-execution.json
[qualified-costs]: lot5a-evidence/performance/owner-growth-comparison.json
[qualified-cost-review]: lot5a-evidence/performance/owner-growth-review.json
[final-cost-review]: lot5a-evidence/performance/diagnostic/final-cost-independent-review.json
[cost-strict-failure]: lot5a-evidence/performance/aggregation-failure.json
[cost-analysis-initial-failure]: lot5a-evidence/performance/owner-growth-analysis-initial-failure.json
[cost-io-correction]: lot5a-evidence/performance/diagnostic/owner-cost-directory-correction-v1.json
[cost-results]: lot5a-evidence/performance/results.md
[delivery-integrity]: lot5a-evidence/final/delivery-integrity.json
[evidence-transport]: lot5a-evidence/final/evidence-byte-transport.json
[publication-inputs]: lot5a-evidence/final/publication-inputs.json
[site-publication]: lot5a-evidence/final/publication-site84.json
[source-transport]: lot5a-evidence/final/publication-source-transport.json
[transport-guide]: lot5a-evidence/final/transport/README.md
[transport-reconstruction]: lot5a-evidence/final/transport/reconstruction.json
[browser-receipt]: lot5a-evidence/final/browser/browser-qa.json
[user-report]: lot5a-linked-temporal-preparation.md
[evidence-index]: lot5a-evidence/README.md
[cost-contract]: lot5a-evidence/owner-cost-contract.md

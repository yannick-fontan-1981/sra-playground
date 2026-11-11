# Lot 10A : revue source et préparation de l'intégration

## Périmètre et conclusion

Revue textuelle du candidat **b1bbd85**, contenant le transfert fonctionnel
**90a8541**, sur la base publiée **bed48116585da864dd5c412ed11dd6990a950e8e**
(Site 83 / native 0.52.0). La référence Python/SRC/DRM reste
**786dcf51ca57773d8e3a8948ce9ea3655e7baf8e**.

**Aucun nouveau défaut bloquant de sémantique source n'a été identifié dans le
domaine des observations publiques mesurées.** Les limites de contribution en
partie, de coût, de sessions longues et de validation après intégration restent
ouvertes. Cette conclusion ne vaut pas clôture de livraison.

Cette revue lit les sources, les tests et les reçus textuels déjà conservés. Elle
n'exécute aucun import, test, oracle, jeu, décompression, capture, build ou mesure
pendant le créneau de calme demandé par 5A. Le seul nouveau fichier est ce compte
rendu. La famille, la politique et le raccordement commun sont relus par un agent
distinct de leurs auteurs ; la géométrie est ici relue par son auteur. Il ne
s'agit donc pas d'une seconde preuve indépendante d'exécution de la géométrie.

Les critères examinés sont les règles communes et les critères du lot 10 dans
[la feuille de route](../v6-delivery-roadmap.md), avec la portée 10A explicitée
dans [le bilan](../lot10a-axial-question.md) et
[la filiation](../lot10a-axial-question-lineage.md).

## 1. Contrats locaux conservés

| Contrat source | Lecture du candidat | Limite conservée |
| --- | --- | --- |
| Composantes, barres, corps, ancres et cible | Réemploi du producteur de composantes Recolor ; barres originales puis segments dans l'ordre source ; corps avec pôles distincts, géométrie et signature communes ; cible unique | Contrat des rasters publics validés, pas émulation générale des entrées Python arbitraires |
| Coordonnées et orientation | Centres/supports en x,y ; axes en ligne,colonne ; modulo positif ; zéro entier rétabli pour l'axe opposé | Aucune force ni translation déduite de l'orientation |
| Relations | between, outside et transverse_dependency ; ordre des pairs conservé | Hypothèses qualitatives sans prédiction d'arrivée |
| Choix | Minimum du tuple priorité DRM, distance, contrôle rappelé, commande, indice source | Plusieurs offres sont licites ; aucune règle de sélection unique ajoutée |
| Garde | Même observation, époque et image ; action et étape identiques ; recalcul des offres ; une correspondance exacte clé + mesure | Des pairs partageant une clé peuvent produire un choix puis un refus, comme dans Python |
| Proposition | Une action, OP18, expected_after nul, objectif officiel, inconnues explicites | Le résultat du chooser et le rappel ont release_authority faux |
| Retour | Préfixe scellé ; résultat conditionnel ; acquisition à partir du retour public | Aucune prévision de rotation assimilée à un effet acquis |
| Tentatives | Clé source comprenant époque, cible, corps/axes/marqueurs, commande et type de relation ; tentative retenue même sans effet | La clé ne contient pas le pair : conserver cette propriété dans les comparaisons et la garde |
| Méthodes | Dernier reçu compatible, rotations courantes après méthodes portables, preuve d'au moins deux références | Ce seuil concerne les références d'un reçu, pas deux observations indépendantes de rotation |

La signature de méthode conserve size, opposed_distinct_bars et
core_side_distinct. Le noyau et le côté peuvent avoir la même valeur ; le booléen
est une donnée de signature et ne devient pas une nouvelle condition d'admission.

Le SRC réel déjà présent dans le catalogue compilé est installé par
AxialPolicy.attachPrograms. Le callback axial.select reçoit la projection source
des offres. Les quatre champs de reçu source restent comparés dans les tests ;
les métadonnées natives du programme ne sont pas injectées dans cette projection.

### Domaine V5 consommé

projectedTurns transfère seulement le pivot utilisé par geometry.py. Le modèle
construit possède les centres des 2 à 16 corps comme sol, aucun mur, une sélection
courante et les deux pôles visibles. Les vérifications d'identité, de position et
d'axe sont reprises. La projection ne consomme ni force, ni stabilisation, ni
sélection par point, ni cycle de sélection, ni recherche de route V5.

Le DWorkBudget source est partagé entre les deux signes du pivot : 1 000 visites,
1 000 ms, domaine 1 000. Sur le domaine admis par measure, le domaine ne dépasse
pas 16 cellules et les deux passages de validation visitent au plus 32 corps.
Le code source ne fait pas d'appel finish après ces pivots. Ce budget ne couvre
pas la construction préalable des composantes/barres, les relations ou les
parcours de méthodes historiques. Aucune borne temporelle globale de mesure ne
doit être déduite de ces 1 000 ms.

## 2. Acquisition active et passive dans le caller

La chaîne relue est initialize/plan → proposition → before → WHY/ACT → advance
→ seal → recordSelected → acquirePassiveFamilies → persistFamilies → restauration
du graphe avant la décision suivante. La position interne de l'acquisition reste
entre Attention/View et Goal/Point/Control/assessment/Frontier.

| Situation | Acquisition Axial | Publication de raisonnement |
| --- | --- | --- |
| Action d'une autre famille | recordObserved avec proposition nulle et paquet public complet | Événement seulement si le retour est non nul |
| Action Axial sélectionnée | record appelle recordObserved avec la proposition réelle ; la branche passive exclut le même propriétaire | Événement sélectionné acquis une seule fois |
| Après l'une de ces deux voies | État courant du même propriétaire | axial_question_state seulement si selection, rotations ou portable est non vide |
| Persistance commune | Enveloppe native complète du propriétaire | Distincte de la condition source ci-dessus ; attempts/last peuvent exister uniquement dans l'enveloppe |

Le constructeur vérifie la présence du propriétaire et, pour Axial, l'identité
exacte de l'instance enregistrée. Le factory crée une seule instance qui possède
à la fois les propositions et l'acquisition passive. Le groupe matériel et son
tableau entryPoints sont dérivés du même ordre DRM ; axial_question reste après
topological_recolor. L'ordre du tableau global d'installation des familles ne
sert pas de remplacement à cet ordre de sélection.

L'acquisition passive peut attester un changement unique du marqueur central
entre une scène non sélectionnée et une sélection non ambiguë, en conservant
centres, axes et signatures des corps. Elle n'apprend pas de rotation : la branche
de rotation et la création d'une tentative exigent une proposition axial_plan.
La branche active conserve le quart de tour réellement mesuré, la commande,
l'époque, les références du retour et le digest/ordinal de l'image physique.

## 3. Apprentissage consommé et autorité après restauration

Le texte des tests couvre désormais une boucle commune froide complète : une
action étrangère révèle la sélection ; Axial devient admissible, exécute son SRC
et OP18 ; un retour contraire à l'a priori enseigne la commande ; la décision
suivante consomme ce reçu. Une instance de diagnostic séparée reçoit le même état
acquis avec les seuls reçus de rotation retirés et produit une commande différente.
Cette ablation ne modifie pas le graphe du caller de production.

Le scénario de frontière supplémentaire ferme l'ancienne lacune de couverture :
une méthode transportée reste inutilisable sans sélection dans la nouvelle
époque ; la restauration conserve la méthode ; une nouvelle action étrangère
acquiert réellement la sélection ; une restauration supplémentaire est suivie
d'une proposition Axial utilisant la méthode avec les preuves courantes.

Le graphe persistant constitue la source de vérité de plan. Les tests remplacent
volontairement l'état de travail par un état froid avant resume ; la proposition
doit retrouver les connaissances du graphe, sans réenregistrer les retours.
restoreNative valide l'enveloppe et la forme des six champs avant publication ;
state/restore restent des copies détachées. Une enveloppe identique répare un état
mutable modifié. Cette validation structurelle n'est pas une démonstration de
provenance pour un journal arbitrairement fourni hors du caller.

L'autorité reste courante : la méthode portable n'est pas un permis, l'ancienne
sélection est supprimée au changement d'époque, before refuse l'ancienne portée,
et la nouvelle action passe de nouveau par la garde commune et WHY/ACT.

Le [reçu conservé de composant](diagnostic/axial-reference-validation.json)
annonce 130/130 tests, dont 68 cas de famille, 38 de géométrie, 16 de politique et
huit contrats natifs. Le [journal commun conservé](diagnostic/kernel-03.log)
annonce 6/6 scénarios. Ces résultats sont des preuves antérieures de la branche
isolée ; cette revue ne les réexécute pas et ne les étend pas au futur merge.

## 4. Frontière : parité et adaptation native séparées

recordSource conserve le comportement Python original : dernier échantillon
compatible par bornes de grille, cible et nombre de corps. L'oracle garde le cas
où la nouvelle scène partage ces ancres et peut être acceptée par l'original.

recordObserved ajoute la règle native current_epoch_axial_packet_attribution.
Lors d'un changement d'époque, la scène finale est exclue. Lorsque ses ancres
sont indistinguables de celles de l'ancienne scène, aucun échantillon n'est
utilisé pour attribuer un contraste physique. Sinon, les images compatibles
gardent leurs indices du paquet d'origine et la dernière est utilisée. Sans
image ancienne attribuable, aucune rotation nouvelle n'est acquise. Le score
officiel reste conservé indépendamment de cette attribution.

Les anciennes rotations sont transportées comme revisable_method_not_current_permit.
Les champs selection, rotations, attempts et last courants sont remis à zéro.
L'adaptation privilégie une abstention conservatrice : elle peut renoncer à un
effet réel lorsque les scènes sont indiscernables. Les ancres ne sont pas une
étiquette temporelle fournie par le moteur ; aucune attribution omnisciente des
images n'est revendiquée.

## 5. Coût de mémoire et réemploi possible

Axial.nativeState reconstruit la projection des six champs, appelle validateState
et retainNativeJson sur toute cette projection, puis compare l'état au checkpoint.
Le maintien de l'identité du checkpoint évite une nouvelle enveloppe lorsque les
valeurs sont égales ; il n'évite pas ce parcours préalable. nativeRevision appelle
lui-même nativeState et ne fournit donc pas un témoin de mutation à coût constant.
restoreNative vérifie aussi l'état mutable courant ou recopie les six champs.

Dans offers, toutes les méthodes portables et courantes sont d'abord concaténées.
Pour chaque relation et chaque a priori, une copie est inversée afin de trouver
le reçu compatible le plus récent. Avec H reçus et R relations, les recherches
peuvent parcourir et allouer de l'ordre de R × H éléments, en plus de la mesure.
Les tableaux de rotations et de méthodes portables grandissent selon le contrat
source ; cette revue n'autorise aucune suppression de leur histoire.

Le module commun v6-native-owned.ts partage seulement des sous-arbres déjà
validés et profondément immuables. Les champs de travail Axial sont des copies
mutables ; cette API ne permet pas de les considérer inchangés sur leur seule
identité. copyNativeValue est une copie détachée, pas un certificat de mutation.

Une possibilité locale précise existe dans v6-native-working-witness.ts :
captureWorkingWitness et matchesWorkingWitness peuvent contrôler les six champs,
leurs remplacements et les modifications imbriquées avant réemploi d'un
checkpoint validé. Ce n'est pas une invalidation automatique, ni un gain garanti :
le témoin parcourt encore les conteneurs mutables. Son éventuelle adoption
demanderait les contrats existants d'édition directe, copie détachée, restauration
identique, rejet atomique et repli des objets non certifiables. Le helper des
séries partagées ne doit pas être copié partiellement en supposant que sa
certification du propriétaire s'applique automatiquement à Axial.

**Décision de revue : conserver le comportement présent et une réserve explicite
de coût sur sessions longues.** Intégrer d'abord les changements effectivement
publiés de 5A, puis ne traiter une optimisation locale qu'en réponse à un coût
observé. Le batching du Kernel et la suppression des copies de diagnostic 5A
peuvent réduire des coûts communs ; ils ne suppriment pas à eux seuls les parcours
d'histoire ci-dessus. Aucun changement de code ou de cœur partagé n'est proposé
comme condition préalable spéculative.

## 6. Conflits d'intégration observables

Les autres checkouts ont été lus sans modification. Leur code en préparation
sert à repérer les intersections, pas à déclarer leur publication.

| Fil lu | État de lecture | Intersections à réconcilier |
| --- | --- | --- |
| 5A, sra-lot5-20261110 | HEAD bc19974c910711f20385d9a40168a0927ec22057, source intégrée à Site 83, fichiers de livraison encore modifiés | Types acquisitionFamilies, préparations passives avant SharedSeries, événement sélectionné en liste, factory, refus bloquant, compteurs diagnostics, Kernel/store/frontier communs |
| 4B, sra-lot4a-20261110 | HEAD dbb3349a012c38b71581851439922f1f292fe946, branche relative-arrangement | Factory et groupe window_constraints, sourceGroupStop, look-ahead de priorité, événement/état sélectionnés, type NativeFamily et alias du registre |
| 7B, sra-lot7b-20261110 | HEAD bed48116585da864dd5c412ed11dd6990a950e8e, source Symbols en travail | Types acquisitionFamilies, instance Symbols unique, événement sélectionné, état Symbols après Reactive avant Workshop, groupe matériel et alias du registre |

### Checklist exacte pour le propriétaire de livraison

1. Intégrer les **commits réellement publiés** dans l'ordre de coordination
   Site 83 → 5A → 4B → 7B, puis poser 10A sur ce successeur effectif. Les fichiers
   et valeurs de status lus ici ne remplacent pas les reçus de publication.
2. Conserver dans les deux déclarations acquisitionFamilies et dans le factory
   l'union des champs axial, preparations et symbols avec les anciens champs.
   Axial, Workshop et Symbols gardent leurs vérifications d'identité d'instance.
   Le wrapper LinkedPreparation conserve son propriétaire préparations existant.
3. Conserver les quatre ajouts de familles une seule fois. Les groupes gardent
   l'ordre DRM : relative_arrangement avant multiscale_constraints ;
   linked_temporal_preparation à sa place program_construction ;
   observed_symbol_transaction après observed_ranked_workshop ; axial_question
   après topological_recolor. Vérifier ensemble families et entryPoints.
4. Réconcilier le registre des événements sélectionnés avec Axial, Symbols et
   RelativeArrangements. LinkedPreparation garde sa **liste entière**, y compris
   vide, dans linked_preparation_event ; Axial garde son retour unique.
5. Préserver l'ordre des acquisitions : préparations passives avant SharedSeries,
   Workshop passif puis Axial passif/état conditionnel puis Recolor ; état Symbols
   après Reactive et avant l'état Workshop. Symbols et RelativeArrangements
   restent réservés à leur proposition sélectionnée. Axial exclut toujours sa
   seconde acquisition passive après un retour propre.
6. Réconcilier la branche de sélection nulle : le refus 5A
   block_unrelated_probe conserve une question inconnue bloquante ; le stop 4B
   ferme seulement le reste de son propre groupe. Garder l'exigence enabled,
   les caches sourceStops/entryOffers, la validation de portée et les deux appels
   sourceGroupAllowsEntry dans les chemins de look-ahead. Aucun de ces refus ne
   reçoit d'autorité d'action. Ils ne sont pas deux synonymes d'abstention.
7. Garder les changements communs 5A réellement publiés : transaction atomique
   Kernel/store, checkpoints incrémentaux du frontier, optimum exact CrossedPrefix,
   compteur acquiredRecordCount et ensemble compositionIds. Le raccordement Axial
   ne nécessite pas de réintroduire les anciens tableaux de copies diagnostics.
8. Conserver current_epoch_axial_packet_attribution avec les extensions 5A dans
   le manifeste commun. Attribuer la version native seulement après intégration ;
   la 0.52.0 encore inscrite dans le candidat isolé n'est pas sa future version.
9. Réconcilier les alias Axial, Symbols et RelativeArrangements dans l'audit,
   puis régénérer les registres à partir du factory réel après la levée du calme.
   Les totaux de branche 57/76 et les attentes de liste RadialPort ne doivent pas
   remplacer les ajouts des prédécesseurs. Si les quatre entrées restent celles
   annoncées, le total attendu par simple addition est 60/76 ; seul l'audit réel
   établit le chiffre de livraison.
10. Déclarer les tests intégrés supplémentaires dans le manifeste explicite du
    runner : contrats LinkedTemporal, Kernel batch et frontier de 5A ; contrats
    RelativeArrangements et learned-preparation-priority de 4B ; contrats Symbols
    de 7B. Relancer ensuite le périmètre 10A, notamment les six boucles communes,
    les gardes et les voisins Recolor/Workshop/Feedback. Les preuves ciblées de
    la branche isolée ne remplacent pas ces vérifications du merge.
11. Préserver les traces de non-régression Site 83 et leurs identités ; déclarer
    séparément tout successeur retenu comme référence supplémentaire. Distinguer
    replay public archivé, contribution synthétique et partie nouvelle.
12. Faire les gels natifs, captures structurelles, contrat/readiness et ABBA sur
    les deux sources intégrées définitives, après coordination. Le baseline de
    coût doit déjà contenir les prédécesseurs : l'inventaire 10A n'admet que l'ajout
    Axial. L'origine ou l'ordre d'un fragment commun modifié exige une attribution
    préalable conservée ; aucune formule de taille ni soustraction du coût du
    propriétaire ne remplace les captures.

## 7. Réserves de livraison maintenues

- Les quatre autres entrées du lot 10 restent ouvertes ; cette revue porte sur
  AxialQuestion seulement.
- Les rasters synthétiques prouvent une contribution et une différence de
  décision sous ablation ; ils ne prouvent aucun niveau gagné en partie.
- Le seul cas initial admis par le scan conservé, POLA, possède une tentative
  antérieure interrompue à 94 actions et zéro niveau. Son temps reste inconnu.
  Aucun nouveau jeu ni nouvelle horloge de 40 minutes n'est autorisé par ce compte
  rendu ; la réserve de contribution en partie demeure explicite.
- Le budget V5 de pivot ne borne pas le coût géométrique ni la mémoire historique.
  L'acceptation sur STCK/SMLP ne doit pas devenir une garantie de sessions longues.
- La parité exacte porte sur le composant source dans son domaine consommé.
  L'adaptation native de frontière, les coordinations natives des prédécesseurs et
  la parité du caller Python complet gardent leurs qualifications séparées.

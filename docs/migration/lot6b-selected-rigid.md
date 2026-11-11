# Lot 6B : SelectedRigid

## État de travail et provenance

**Transfert en cours, non publié.** Le checkout isolé a été ouvert sur le commit
publié `98336fba4e696a51c90ff7f7b37b8bdf95f34847` de Site 97 / native 0.60.0.
Le [reçu d'ouverture](lot6b-evidence/source-opening/sites-open-result.json)
conserve cette origine. La version 0.64.0 est réservée après les publications
effectives 7 follow-up / 0.61, 10B / 0.62 et 5C / 0.63. Elle ne constitue ni une
publication ni une validation anticipée du gel intégré.

Les preuves ci-dessous portent sur le composant, des scénarios synthétiques
déclarés et une première campagne froide de développement : **KLOT atteint
trois niveaux en 38 actions et 30 préfixes**, avec une relecture Python
indépendante sans différence. Le navigateur, les régressions finales, le coût
intégré et la publication restent à établir. Cette campagne ne constitue pas
la qualification du gel intégré après le prédécesseur publié 0.63. La
[filiation source → TypeScript → appelant → preuve](lot6b-selected-rigid-lineage.md)
détaille le périmètre. Les réserves historiques de V6 restent conservées.

## Contrat transféré

La référence est le pin original
`786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`. Le périmètre direct comprend
`selected_rigid/family.py`, `mechanism.py` et `base.py`, les mesures
publiques communes, l'identité canonique et le helper V5 `_rotated(offset, 0)`.
L'alias `ConstructionPreviewAccess` de cette base désigne une base neutre.

Le composant mesure la grille, les masques complets et un réceptacle homologue
à partir des observations publiques. Les rôles du réceptacle et du domaine de
collision restent des hypothèses de bibliothèque. Les 24 permutations initiales
des commandes cardinales sont éliminées uniquement par les retours observés.
Un clic ne démontre pas le rôle causal du corps sélectionné. Un retour
stationnaire peut laisser plusieurs modèles compatibles ; un ensemble réfuté
vide reste vide, y compris entre époques.

La recherche conserve l'ordre des directions, le coût du changement de
sélection, le départage du tas par estimation/coût/numéro d'insertion et le
compteur de nœuds de la source. Le préfixe reste limité à
`min(remaining, 16)`. Une sélection scelle le préfixe ; un préfixe mixte peut
conserver des déplacements connus avant sa sonde finale.

L'état source est exactement `{format: 'selected_rigid_events.v1', events}`.
Le même propriétaire propose, acquiert et restaure. Les retours étrangers ne
lui sont pas acquis passivement. Quand son journal n'est pas vide, l'appelant
écrit et restaure néanmoins son état après chaque transition, immédiatement
avant PreviewPacking. Un retour sélectionné sans événement conserve un fait
présent de valeur `null`.

Les budgets et le motif d'arrêt sont transitoires. L'autorisation d'un préfixe
repris actualise le délai à partir du temps actif du niveau. Les cinq motifs
bloquants de la source sont préservés avant toute action d'un fournisseur de
priorité inférieure. Le contrôle de disponibilité et l'unique propriétaire
public du point ACTION6 proviennent déjà du caller Python original.

## Preuves actuellement conservées

| Preuve | Résultat et limite |
| --- | --- |
| [Export original, tentative 04](lot6b-evidence/oracle/attempt-04/export-execution.json) | Réussi. **1 786 fichiers originaux vérifiés avant et après**, 725 fichiers importés ou explicitement consommés. Aucun moteur, niveau privé ou module natif exécuté par l'export. |
| [Comparaison indépendante, tentative 04](lot6b-evidence/oracle/attempt-04/native-comparison.json) | **3 593 contrôles réussis : 1 082 comportementaux et 2 511 de provenance de fichiers**. 18 cas initiaux, sept sessions synthétiques, 25 étapes source, 22 acquisitions, neuf interventions d'état déclarées et cinq cas de restauration. Les horloges contrôlées ne mesurent pas le coût. |
| [Composant, tentative 02](lot6b-evidence/component/attempt-02/execution.json) | Passage réussi du composant : **43/43 tests**. Cette preuve ne remplace pas la validation intégrée finale. |
| [Composant et intégration, tentative 03](lot6b-evidence/component/attempt-03/execution.json) | **Échec conservé, 53/54**. L'attente de l'état Preview après un retour étranger incluait à tort l'absence d'une nouvelle entrée de cache de mesure ; la correction est vérifiée dans la tentative d’intégration 02, sans effacer cet échec. |
| [Fabrique et familles adjacentes, tentative 01](lot6b-evidence/integration/attempt-01/factory-and-adjacent.json) | **Échec conservé, 21/22** ; le scénario de transition ne satisfaisait pas les prérequis du caller. Ne constitue pas une validation positive de l'intégration. |
| [Intégration ciblée, tentative 02](lot6b-evidence/integration/attempt-02/execution.json) | **10/10 tests réussis**, zéro échec, annulation, test ignoré ou TODO. Caller réel, cinq refus source, acquisition unique, ordre des checkpoints après retour étranger, pause inactive et arrêt au délai actif. Les 319 entrées enregistrées restent inchangées. |
| [TypeScript, tentative 01](lot6b-evidence/integration/attempt-01/typecheck.json) | Contrôle réussi sur les entrées enregistrées de cette tentative. |
| [Capture passive, tentative 01](lot6b-evidence/capture/attempt-01/execution.json) | **10/10 tests** : arguments et résultats réels, budget sans lecture d'horloge ajoutée, distinction entre retour nul et appel sans résultat, erreurs et restaurations observées. |
| [Vérification de présence synthétique](lot6b-evidence/capture/attempt-01/presence-qualification.json) | Un rapport synthétique, trois préfixes et trois retours ; deux retours sélectionnés, un étranger, zéro acquisition passive. **30/30 mutations négatives rejetées avec l'erreur attendue**. Ce rapport ne prouve ni une partie réelle ni la parité Python d'un jeu. |

Les [deux premiers exports](lot6b-evidence/oracle/attempt-01/export-execution.json)
et [leur reprise](lot6b-evidence/oracle/attempt-02/export-execution.json) restent
échoués : leurs scénarios annoncés comme mixtes n'atteignaient pas réellement
un préfixe mixte de la source. La
[tentative 03](lot6b-evidence/oracle/attempt-03/native-comparison.json) a ensuite
réussi 3 439 contrôles, dont 928 comportementaux. La tentative 04 étend ce
corpus ; elle ne réécrit pas les verdicts précédents. Le premier échec de
composant reste aussi dans
[component/attempt-01](lot6b-evidence/component/attempt-01/execution.json).

Le contrôle d'un retour étranger doit comparer les checkpoints au moment réel
de ce retour. PreviewPacking peut compléter son cache de mesure pendant une
proposition sans acquérir un nouvel événement. Une attente supposant tout
l'état Preview immuable pendant `propose` ne correspond pas à son contrat.
La tentative d’intégration 02 conserve la vérification de l’ordre SelectedRigid
puis PreviewPacking et de l’absence d’acquisition passive SelectedRigid.

## Bornes, interruption et mémoire

| Borne | Valeur par défaut | Sémantique |
| --- | ---: | --- |
| Nœuds source développés | 150 000 | Arrêt de recherche sans conclusion d'impossibilité. |
| Délai de recherche source | 18 000 ms | Plafonné par le délai actif du niveau ; contrôlé à la frontière de la boucle source. |
| États retenus natifs | 250 000 | `NATIVE_RETAINED_STATE_BOUND`, inconnu bloquant. |
| Entrées de file natives | 250 000 | `NATIVE_QUEUED_STATE_BOUND`, inconnu bloquant. |
| Intervalle de travail coopératif | 256 | Vérifications et points de coopération, séparés du compteur de nœuds source. |

Les paramètres de qualification peuvent réduire ces limites, sans les
augmenter. Un calcul interrompu n'est pas une impossibilité démontrée et ne
livre pas de préfixe partiel. Les bornes natives ajoutées sont nommées.

**Les 18 secondes ne sont pas une garantie absolue de latence de retour.**
Une expansion ou une reconstruction déjà commencée peut continuer jusqu'au
prochain contrôle applicable. Les contrôles coopératifs imposent le délai du
niveau et le signal d'arrêt ; le délai source est examiné dans la boucle
principale. Le caller contrôle également l'exécution avant et après les gardes
d'autorisation. **Dans le navigateur actuel, Pause empêche les prochaines actions physiques,
mais ne préempte pas la recherche en cours dans le worker** : le signal d’arrêt
n’y est pas raccordé à cette commande. Le calcul commencé peut donc se terminer
après Pause. Une latence maximale de Pause ou une interruption immédiate du
calcul n’est pas revendiquée. Le test de longue pause inactive concerne la
conservation du préfixe et son budget de reprise.

**La recherche bornée ne rend pas le journal source borné.** Chaque événement
conserve un état complet, dont les listes cumulées de preuves et d'essais. Leur
volume cumulé peut croître quadratiquement avec les acquisitions. Le journal
persiste entre époques. Ce comportement est hérité de la source ; aucune
compaction générale ni borne en octets de la session n'est revendiquée ici.
Les plafonds de recherche comptent des états et des entrées de file, dont le
poids dépend notamment du nombre de corps et de leurs clés de poses.

La validation native des checkpoints est plus stricte que la validation des
champs racine et du type d'événement effectuée par le restaurateur Python.
Les exceptions malformées de l'oracle comparent le refus et l'atomicité, avec
les classes et textes de chaque langage conservés séparément. Les scènes
mesurées regroupent seulement les cellules intérieures du plateau ; les poses
prévues de sortie vers le réceptacle sont des résultats de recherche distincts.

## Campagne froide de développement KLOT

Le gel `development-freeze-01` reste une qualification **provisoire sur la
base Site 97 / native 0.60**, avec la version 0.64 réservée. Son digest natif
est `7f30c635ebc13cebaa3016cf72a3d051b227033bb0f43b7e7201e68d0396dde2`.
Il ne remplace pas la future intégration des prédécesseurs effectivement publiés.

| Preuve exécutée | Résultat |
| --- | --- |
| [Campagne bornée](lot6b-evidence/development-freeze-01/bounded-execution.json) | **Trois niveaux KLOT, 38 actions, 30 préfixes**, sans expiration ni interruption. Commande terminée en **100,393944 s**, intervalle débité de **100,425972 s** comprenant son encadrement ; entrées enregistrées inchangées. |
| [Lecteur Python froid](lot6b-evidence/development-freeze-01/source-parity-attempt-01/reader-execution.json) | **408 événements comparés, dont 340 appels racine, zéro différence**. Exécution de lecture en **61,344030 s**, sans moteur de jeu ni exécution native. Les 1 786 originaux sont vérifiés avant et après. |
| [Résultat détaillé de la relecture](lot6b-evidence/development-freeze-01/source-parity-attempt-01/result.json.gz) | 30 propositions ; 38 gardes avant et 38 après ; 38 retours sélectionnés ; 35 événements source acquis et trois retours nuls aux frontières d’époque. **98 restaurations**, dont 60 natives et 38 source. Quatre retours changent les hypothèses de contrôle. |
| Contribution par ablation | **204 ablations**, dont **63 changent une action ou un refus**, 198 contiennent un résultat non vide, zéro erreur d’ablation. La contribution est observée dans cette campagne de développement ; elle n’établit pas une victoire complète du jeu. |

Le lecteur reconstruit ses propres propositions et checkpoints Python depuis
les observations publiques. Son reçu déclare `nativeStateSeed: false` et
`nativePlanSeed: false`. La capture KLOT contient uniquement des préfixes
sélectionnés SelectedRigid ; le retour étranger reste couvert séparément par
l’intégration synthétique, sans lui attribuer une occurrence dans cette partie.

La campagne et sa relecture consomment la même horloge cumulée du cas. Les
[reçus d’horloge](lot6b-evidence/klot-case-clock.json) conservent les débits ;
les durées ci-dessus ne sont pas des mesures du coût global STCK/SMLP. La
[qualification négative du lecteur](lot6b-evidence/development-freeze-01/reader-negative-attempt-01/results/qualification.json)
est désormais **réussie pour les deux mutations sémantiques sur deux**. Son
[exécution bornée](lot6b-evidence/development-freeze-01/reader-negative-attempt-01/bounded-execution.json)
termine sans interruption ; le calcul de qualification dure **162,490293 s**,
la commande encadrée **163,439944 s** et son intervalle débité **163,469855 s**.
L’horloge est fermée à **350,862153633 secondes cumulées**, avec
**2 049,137846367 secondes restantes** sur 2 400.

## Qualification finale restante

KLOT est le candidat tiré du catalogue public. Aucun moteur, niveau, route ou
solution de ce jeu n'a été inspecté pour préparer le port. Le débit initial conservé était de **24,942972561 secondes** avant la nouvelle
campagne. Le budget cumulatif reste de 2 400 secondes ; une reprise ne le
réinitialise pas. Tous les
essais effectifs et diagnostics du cas seront gelés, journalisés et débités ;
les cas historiques épuisés restent fermés.

La campagne froide ci-dessus a été exécutée sur le gel de développement
provisoire issu de Site 97. Sa contribution et sa relecture seront qualifiées
après réconciliation du prédécesseur effectivement publié 0.63 ; aucune
réutilisation de preuve ne sera présumée si ses entrées pertinentes changent.

La qualification finale doit consolider les contributions et acquisitions
observées, les cas contraires ou ambigus, le cycle complet du caller, les
contrôles de livraison, les rejeux déclarés et l’observation du navigateur.
La campagne froide et son lecteur sont désormais exécutés sur le gel de
développement ; les contrôles du gel intégré restent distincts. Le périmètre des
tests sera fixé avant exécution, et les essais échoués resteront conservés.

## Contrôles de développement et intégration encore ouverte

Les [premiers contrôles du gel de développement](lot6b-evidence/development-freeze-01/validation)
ont cinq commandes terminées avec un code processus zéro. **Cela ne constitue
pas cinq contrôles sémantiques réussis** : le rapport d’audit de migration
conserve trois références manquantes correspondant à deux fixtures héritées.
Le garde-fou générique de l’audit a été corrigé pour rendre un code d’échec
lorsque de telles références manquent. Les deux fixtures ont ensuite été
restaurées exactement et le nouvel audit sémantique a réussi avec zéro erreur,
comme le détaille la clôture ci-dessous. Le premier résultat incomplet reste
conservé sans remplacement rétrospectif.

Le site effectivement publié est maintenant **Site 101 / native 0.61**,
source `d75a36f0a99bf6c301034523a3138a64d2f6e744`. Ce constat ne change pas
l’origine Site 97 du gel de développement 6B. Le checkpoint source 5C
`d54a58f2` reste non publié ; il ne constitue pas le prédécesseur livré 0.63.
La qualification finale de 6B attend toujours les publications effectives 10B
puis 5C et leur réconciliation.

L’intégration devra notamment propager `currentExecution` par le cinquième
argument des appels communs et préserver le délai hôte lorsqu’il est plus
strict, au moyen du helper d’horloge 10B revu. **Cette adaptation n’est pas
implémentée dans le gel de développement présenté ici.** Elle devra être
vérifiée sur le futur gel intégré avant le navigateur, les régressions finales,
la mesure de coût et la publication.

## Règle de performance et publication

La référence finale sera le prédécesseur effectivement publié, réconcilié
avant le gel et la mesure. La décision porte sur la médiane de session
complète, **strictement sous +10 % pour chaque jeu** de la fenêtre commune.
Une phase au-dessus de 10 % peut être acceptée lorsque ce critère global passe ;
elle restera publiée avec les diagnostics. Un jeu ne compense pas un autre,
les phases imbriquées ne sont pas additionnées et les échantillons défavorables
restent conservés.

Les traces, le travail effectué et les différences structurelles dues au
propriétaire ajouté devront être qualifiés avant toute mesure officielle.
Une différence non attribuée ou une fenêtre non isolée ne sera pas masquée par
un résultat favorable. **Aucun coût 6B ni aucune publication 6B n'est accepté
sur la seule base des preuves synthétiques présentes.** La feuille de route et
les inventaires seront actualisés lors de la qualification réelle du gel
intégré, en conservant la distinction entre transfert de composant, raccordement,
contribution en jeu et migration complète de V6.

## Clôture de la restauration des preuves héritées

Les deux fixtures historiques ont été reconstruites exactement depuis leurs parties, avec les empreintes de la validation publiée 6A. Le [reçu de restauration](lot6b-evidence/fixture-restoration/attempt-01/recovery.json) lie ces identités. Après le refus réel des références absentes par le garde corrigé, le [nouvel audit sémantique](lot6b-evidence/audit-guard/restored-inventory.json) réussit : zéro erreur, 198 composants vérifiés, 148 transferts partiels et 1 023 modules en attente. Le premier passage et ses trois erreurs restent conservés. Les sources natives, les résultats fonctionnels et les entrées du build sont inchangés.

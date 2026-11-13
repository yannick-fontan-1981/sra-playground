# CATL : cinq niveaux réussis par composition de séquences étiquetées, v44

## Résultat livré

Le **Logos Engine natif termine les cinq premiers niveaux de CATL**, en
**40 actions : huit par niveau**. Les trois premiers sont donc terminés
en 24 actions. Le jeu est au niveau 6 avec cinq niveaux accomplis et
l'état officiel `NOT_FINISHED`. Aucune victoire complète n'est déclarée.

| Niveau terminé | Actions du niveau | Actions cumulées | Préfixes acquis |
|---|---:|---:|---:|
| 1 | 8 | 8 | 8 |
| 2 | 8 | 16 | 16 |
| 3 | 8 | 24 | 24 |
| 4 | 8 | 32 | 32 |
| 5 | 8 | 40 | 40 |

La [campagne native](native-campaigns-v44/catl-five-levels.json) part
d'une mémoire froide et conserve une seule session. Chaque commande
passe par le caller commun, SRC, WHY/ACT, les gardes de la primitive
et l'acquisition du retour réel dans le Kernel. Il y a 40 commandes,
40 préfixes scellés et 40 acquisitions, sans action manuelle de jeu,
sans saut de niveau et sans remise à zéro. Les quatre reprises
nécessaires pour continuer après les niveaux 1 à 4 sont enregistrées.
La cible déclarée est cinq niveaux, atteinte à la cinquième frontière.

Les **146 fichiers natifs** restent identiques pendant les campagnes.
Implémentation : `logos-engine.typescript.v6.native-migration/0.14.0`.
Empreinte du manifeste :

`1b30d1f0a80275a1204b44198b5fd62f43439d16b5eccdd768a4357b78986093`

La [baseline v43](native-campaigns-v44/catl-v43-baseline.json), exécutée
depuis le commit publié `c9d57a798045e7de59259a28af55b8222a4497d5`,
ne termine aucun niveau de CATL : 105 actions, puis arrêt sur le budget
de calcul actif du premier niveau. Les actifs de jeu sont les mêmes.
Cette comparaison établit un gain de résolution ; les temps observés
sur une machine partagée ne constituent pas un benchmark de vitesse.

## Capacité transférée et généralité

L'entrée **`labeled_sequence_composition`** est raccordée après
`product_panel_composition`, à sa position dans l'ordre DRM source.
Elle partage le propriétaire d'acquisition déjà présent,
`family_state:public_occurrence_recall`.

La [perception](../../src/logos-engine/v6-labeled-sequence-observation.ts)
mesure deux panneaux géométriques d'exemples, leurs étiquettes visibles,
les occurrences carrées ordonnées, une requête courante et les contrôles
de soumission associés. Les tailles, positions et palettes sont mesurées.
Une ancienne enveloppe de contrôle n'est utilisable qu'après revalidation
de tout son support actuellement visible, y compris son intérieur.

Les [calculs transférés](../../src/logos-engine/v6-labeled-sequence-mechanics.ts)
produisent les caractéristiques demandées, puis testent une grammaire
finie de prédicats sur les exemples étiquetés. Les alternatives réfutées
gardent leurs contre-exemples ; les alternatives compatibles restent
explicites. Le caller propose une soumission uniquement lorsque les
alternatives retenues s'accordent sur l'étiquette de la requête actuelle.
Chaque soumission est suivie d'un retour inconnu qui doit être acquis
avant de traiter la prochaine question.

La politique source connectée demande quatre caractéristiques générales :
longueur, égalité des extrémités, différence entre voisins, et unicité
du bloc contigu de chaque type. Elle ajoute les comptes de chaque type
de jeton effectivement observé. Les seuils candidats proviennent des
valeurs mesurées dans les exemples. Le mécanisme transféré sait calculer
huit types de caractéristiques, mais la politique n'en demande pas
automatiquement huit pour chaque observation.

Le code de ces capacités ne sélectionne rien par nom de jeu ou numéro
de niveau. Il ne contient ni palette à rôle fixé ni suite de coordonnées
préparée. CATL est un terrain de validation d'une structure observable.
Les jeux restent des moteurs opaques : aucun module d'agent Python,
oracle ou état interne de jeu n'entre dans l'agent natif.

## Travail en delta et mémoire réelle

Les caractéristiques des exemples sont réutilisées **35 fois sur les
40 inférences** : une lecture initiale par niveau, puis sept réutilisations.
La réutilisation exige la même époque, le même contexte géométrique et
les mêmes caractéristiques demandées. La requête courante est toujours
mesurée et évaluée à nouveau. Ce cache ne remplace pas la vérification
de la commande et ne prédit pas les questions futures.

Les événements acquis conservent la commande, l'étiquette proposée,
la séquence mesurée, le cache et les références avant/après du retour
physique. Ils indiquent séparément une frontière officielle, un contexte
public changé ou un contexte inchangé. Aucune loi unique n'est affirmée.

Les [tests d'intégration](../../tests/v6-labeled-sequence-integration.test.ts)
vérifient le vrai parcours froid SRC/WHY-ACT/Kernel, la séparation entre
résultat mécanique et autorisation physique, la reprise depuis un nœud
persisté, l'absence d'acquisition étiquetée pour un plan étranger, le
refus d'une ancienne requête et la restauration atomique d'un journal
falsifié. Un checkpoint acquis inchangé ne rejoue pas son historique.

Le journal et les preuves utilisent donc le graphe commun réel. Les
algorithmes de perception, recherche et garde restent des callbacks
TypeScript. Leur transformation intégrale en règles individuellement
éditables dans le graphe demeure incomplète.

## Parité source et composition des gardes

Les **517 tests de parité** comparent **511 cas source**, **56 scènes**
et **40 enveloppes réelles** de `CombinedObservedCompositionMemory`.
L'export vérifie 825 fichiers du commit source épinglé
`786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`.

La couverture comprend les huit caractéristiques, les modes FIT, PREDICT
et PARTITION, les comparateurs typés, les expressions AND/OR/NOT fournies,
les valeurs inconnues, les contradictions, les interruptions bornées,
les caches, les contrôles fusionnés ou ambigus et les journaux acquis.
Sept restaurations sont comparées, dont les cinq frontières officielles.

La relecture a également corrigé la priorité des couches supportées dans
les binders et les gardes d'une proposition portant plusieurs plans :
Auxiliary, Pair, Graph, Cell, Labeled, Product, Rooted, Radial, puis les
ancêtres Occurrence/Program. Dix-huit cas mixtes sont comparés à la vraie
famille source. L'ordre de sélection DRM et l'ordre d'acquisition restent
des mécanismes distincts ; aucun ordre n'est choisi à partir du jeu.

La [comparaison exacte de trajectoire](native-campaigns-v44/catl-original-component-comparison.json)
vérifie les **40 commandes, 41 paquets publics complets, 106 images en
comptant l'initiale, cinq frontières et 40 préfixes d'une action**.
Tous les pixels, champs, animations et domaines d'action correspondent.
Aucun suffixe public n'est écarté. Le composant original vise six niveaux
et s'abstient au sixième ; la campagne native vise cinq niveaux et atteint
cette cible. Cette preuve ne compare pas les choix du caller Python complet.

Les modules de calcul V5 restent `partial_transfer` à l'échelle du module :
le domaine natif couvre les contrats JSON canoniques à entiers exacts,
sans toutes les coercitions Pydantic ni les entiers Python arbitraires.
Les wrappers d'accès et communs conservent aussi leur qualification
partielle, car les ancêtres non connectés ne sont pas transférés.

Le mécanisme source d'induction peut signaler un accord descriptif même
si tous les prérequis fournis valent faux ; ce cas est conservé et testé.
Cet accord ne constitue jamais une autorisation physique. Le caller
connecté mesure séparément son contrôle courant et le runtime conserve
les gardes et l'autorisation WHY/ACT.

## Pourquoi le niveau 6 reste ouvert

Le [diagnostic sur le dernier paquet public](native-campaigns-v44/catl-next-level-diagnosis.json)
compare le composant original et le composant natif sans exécuter de
nouvelle action. Les panneaux et la requête sont correctement mesurés.
Les calculs des caractéristiques sont complets, puis l'induction retourne
**`COMPLETE / MODEL_CONTRADICTION`** : les **80 racines** de la grammaire
atomique et de ses compléments sont toutes réfutées par au moins un des
**20 exemples visibles**. Il reste zéro hypothèse et zéro prédiction.

Ce résultat n'est ni un dépassement de budget ni une absence de lecture.
La contradiction est relative à la mesure et à la grammaire déclarées.
Le cache de l'époque 5 n'est pas réutilisé à l'époque 6. Aucune étiquette
du niveau précédent n'est soumise comme si elle valait pour le suivant.

La campagne native publiée s'arrête à sa cible de cinq niveaux. Le
diagnostic du composant au niveau 6 ne doit pas être confondu avec une
campagne du caller complet sur ce sixième niveau.

## Vérification de livraison

Le [dossier de validation](native-campaigns-v44/validation.json) rassemble
la suite de tests, le typecheck, les audits, le build, la campagne CATL,
la comparaison originale et les campagnes de régression. Les neuf
régressions réelles portent sur MEMO, TICT, HANO, ELAS, TU93, STCK,
PIPE, COMB et THER. Leurs 433 commandes, 442 paquets publics et
237 préfixes sont confrontés à la v43 ; les nouveaux événements
étiquetés doivent rester absents de ces trajectoires.

La suite de 85 fichiers couvre **5 046 tests distincts**. Sa première
exécution a donné 5 045 réussites et une attente de topologie obsolète :
elle comptait encore 34 entrées, au lieu de 35. Seules les deux assertions
de compte et le titre de ce test ont été actualisés. Le fichier concerné
a ensuite passé ses 12 tests. Le reçu initial et le reçu de cette reprise
sont conservés séparément ; aucune seconde suite complète n'est revendiquée.
Les 146 fichiers natifs sont restés identiques pendant toutes ces vérifications.

La vérification navigateur part du niveau 1 en mode **SRA Agent Native TS**,
avec inspection fermée et cinq lancements successifs par **Run to next level**.
La [capture et son reçu](native-campaigns-v44/catl-browser-verification.json)
montrent cinq niveaux résolus en 40 actions, avec mémoire conservée.
L'état partiel ne déclenche pas d'écran `VICTORY`.

## Avancement et prochaine étape

**35 / 76 = 46,1 %** des points d'entrée DRM explicites sont raccordés,
contre 34 / 76 = 44,7 % en v43. Une entrée source supplémentaire est
connectée. Le gain exact est 100 / 76, soit environ **1,32 point** ; les
pourcentages affichés sont arrondis indépendamment.

Cette métrique pondère chaque entrée également. Elle ne mesure ni le
volume de code traduit, ni le taux de victoire, ni une parité complète.
L'inventaire conserve 95 modules `component_verified`, 72 `partial_transfer`,
1 202 en attente et zéro module pleinement `verified`. Les six conditions
de migration complète restent fausses.

**Prochaine étape : une composition bornée de prédicats avec AND/OR.**
Les opérateurs existent déjà dans l'évaluateur transféré ; le caller
source ne génère pour l'instant que des atomes et leurs compléments.
L'extension devra borner la profondeur et le calcul, conserver les
alternatives compatibles, invalider les caches lorsque la grammaire
change et maintenir l'abstention si aucune hypothèse n'est compatible ou
si les prédictions compatibles divergent. Le niveau 6
de CATL fournira un premier test, sans réussite annoncée à l'avance.
Il faudra également valider le transfert sur un autre jeu.

Cette future extension native n'ajouterait pas à elle seule une entrée
source raccordée. **L'avancement livré reste 46,1 %.**

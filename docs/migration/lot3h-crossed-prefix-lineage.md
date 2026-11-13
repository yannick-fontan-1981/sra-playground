# Filiation du lot 3H : référence et préfixes couplés

## Origine, périmètre et propriété de l’état

Le transfert de `coupled_prefix_reference` part des originaux V5/V6 conservés au commit **`786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`**. L’export indépendant vérifie les **1 786 fichiers originaux** avant et après les appels. Aucun moteur de jeu, manuel, spécification, solution ou résultat natif ne produit les attentes de l’oracle.

La couche propre est définie dans `laya_proto/common_crossed_prefix.py`. Elle mesure un champ, une référence miniature et deux familles de contrôleurs alignés ; elle propose une sélection, une modification d’apparence ou une avance expérimentale ; elle acquiert ensuite le retour réellement fourni. Les couleurs, coordonnées et entrées essayées proviennent de l’image courante ou des effets acquis. La correspondance de la miniature, la contribution d’un contrôleur et la compatibilité d’un croisement restent des hypothèses de bibliothèque.

| Contrat | Original conservé | Consommateur natif |
| --- | --- | --- |
| Géométrie, contrôleurs, référence, cellules et points | `common_crossed_prefix.py:geometry`, `measure_controls`, `reference_present`, `cell`, `slot`, `input_candidates` | [Projection CrossedPrefix](../../src/logos-engine/v6-crossed-prefix-observation.ts) |
| Proposition et état des préfixes | `CrossedPrefixAccess.cross_question`, `propose`, `apply_event` | [Mémoire et accès CrossedPrefix](../../src/logos-engine/v6-crossed-prefix-access.ts) |
| Gardes et acquisition du retour | `CrossedPrefixAccess.before`, `after`, `record` | Même mémoire, appelée par le propriétaire commun |
| Enveloppe pointée/non pointée et restauration | `CrossedPrefixConstraint.cross_propose`, `bind`, `restore` | Enveloppe native et [SharedSeries](../../src/logos-engine/v6-shared-series.ts) |
| Digests et couches héritées | `SupportedLineAccess`, `RepeatedLinePatterns`, puis descendants Marked/Program | Frontière héritée explicite dans [OccurrenceRecall](../../src/logos-engine/v6-occurrence-recall.ts) |

**CrossedPrefix n’hérite pas de FramedWindow.** La chaîne propre est `CrossedPrefixAccess → SupportedLineAccess → RepeatedLinePatterns`, avec l’enveloppe `CrossedPrefixConstraint → SupportedLineConstraint → PointedLineConstraint`. Le digest du parent SupportedLine contient l’état RepeatedLine, les insertions, leurs ordres et les réfutations. Les méthodes originales de ces parents ne sont pas toutes transférées par ce lot. Leur digest est fourni séparément dans l’oracle comme frontière opaque, sans annoncer la parité de tout l’appelant.

En sens descendant, `MarkedCollectionAccess` hérite de CrossedPrefix et appelle d’abord son acquisition par `super().record`. L’ordre propre est donc celui des couches source : RepeatedLine/SupportedLine, puis CrossedPrefix, puis Marked/Program et leurs descendants. Le registre DRM place la question `coupled_prefix_reference` après `framed_window_composition` ; cet ordre de sélection ne crée pas une relation d’héritage entre les deux mémoires.

Le natif publié avant ce transfert conserve déjà les trois familles d’événements CrossedPrefix et leur place dans le digest `SeriesEventMemory`. Le nouveau propriétaire doit réutiliser cette place et cette conservation, sans ajouter une deuxième réduction ou une deuxième copie de l’état métier. Les contrôles de compatibilité des checkpoints restent une preuve distincte de l’oracle de composant.

## Géométrie mesurée

L’observateur source extrait des composantes connexes monochromes. Un support candidat est un rectangle entièrement rempli, d’au moins deux pixels sur chaque axe. Les composantes sont groupées par largeur, hauteur et apparence. Un groupe doit comporter au moins quatre éléments et au moins deux coordonnées distinctes sur chaque axe. Le pas de grille est l’écart modal entre coordonnées triées ; en cas d’égalité, le premier écart rencontré par le `Counter` Python est conservé. Les pas doivent dépasser les dimensions des supports et toutes les coordonnées doivent appartenir à la grille ainsi obtenue.

La densité minimale est **la moitié des cellules** du rectangle de grille, pas sa complétude. Les trous restent possibles. Parmi plusieurs groupes admissibles, la source choisit celui dont `nombre de supports × aire d’un support` est maximal ; une égalité conserve le premier groupe. Elle ne refuse donc pas automatiquement toute image contenant deux champs candidats de même score.

Le fond est l’apparence la plus fréquente de l’image entière, avec la même règle de première rencontre en cas d’égalité. Hors du rectangle du champ, la recherche de référence parcourt des régions connexes de pixels qui ne sont ni le fond ni l’apparence vide mesurée. Les couleurs différentes restent connectées au sein de cette recherche. Une région doit former un rectangle plein, contenir au moins deux apparences, se diviser exactement suivant le nombre de colonnes/lignes du champ et conserver le rapport des dimensions d’une cellule. La miniature doit être strictement plus petite sur chacun des deux axes ; chaque cellule miniature est uniforme.

Plusieurs miniatures sont admises si leurs matrices de valeurs sont identiques ; la première est retenue comme lieu courant de référence. Deux matrices distinctes rendent la mesure ambiguë et refusée. L’identité de la matrice ne donne pas à la référence un rôle terminal acquis.

## Familles de contrôleurs et adresses courantes

Pour chaque ligne puis chaque colonne, la source suit l’axe médian entier de la cellule, depuis la limite du champ vers chacun des deux côtés. Elle conserve les suites de même apparence appartenant à la palette de la référence et contenant au moins deux pixels. Le premier segment est le contrôleur courant ; les suivants sont des alternatives. Le point est l’élément d’indice `len(run)//2` dans l’ordre de parcours : pour un segment de longueur paire, le résultat dépend donc du sens de parcours.

Chaque axe exige **exactement un côté dont toutes les lignes ou colonnes possèdent un contrôleur**. Un autre côté incomplet est ignoré ; deux côtés complets sont ambigus et refusés. La source n’exige pas que toutes les alternatives aient des couleurs distinctes. Si plusieurs adresses proposent la même couleur au moment d’une recoloration choisie, la proposition est refusée.

Les candidats de pointage réunissent les contrôleurs et leurs alternatives, dédupliquent les coordonnées, puis les trient lexicographiquement `(x,y)`. Ils sont absents si `ACTION6` n’est pas disponible. Les noms d’action ne donnent aucune direction physique avant observation d’un effet.

`cell` traduit l’indice de préfixe suivant le côté mesuré et retourne la coordonnée logique du champ. `slot` extrait les pixels de cette cellule. Les helpers Python isolés conservent leur arithmétique et leurs règles de tranche pour des coordonnées négatives ou hors champ ; cela ne constitue pas un domaine de pointage autorisé par l’appelant commun. Les images vides, irrégulières ou les références tronquées peuvent lever les exceptions source conservées dans la fixture. Le domaine d’image natif portable et ses refus sont qualifiés séparément.

## Construction et maintien de la question

Au début d’une époque, `cross_question` exige le pointage disponible, une géométrie mesurée et l’absence de toute apparence de la référence dans les cellules du champ. Cette dernière condition n’exige pas que chaque cellule contienne uniquement l’apparence vide choisie par `geometry` ; elle exclut précisément la palette de la référence. La mémoire provisoire contient l’époque, la géométrie, un progrès nul par contrôleur, aucune sélection, aucune action, aucun blocage, aucune question et `invalid: false`.

Pour une époque déjà retenue, la source utilise cette géométrie conservée. Elle vérifie la référence à son lieu initial et remesure les contrôleurs. Elle ne redétecte pas systématiquement toute la grille ni ne rétablit une preuve complète d’identité du champ. Un état invalidé reste refusé dans l’époque courante. Une nouvelle époque peut créer un nouvel état local, tandis que les entrées d’axe et les paires acquises restent globalement conservées.

Les couleurs possibles de chaque contrôleur sont triées puis combinées par produit cartésien exhaustif. Une affectation est compatible si chaque valeur cible apparaît dans au moins un de ses contrôleurs horizontal ou vertical. Le coût est le nombre de recolorations. La source garde la première affectation de coût minimal ; une égalité ultérieure ne la remplace pas. **Ce calcul source n’a aucune borne interne de nœuds ou de temps.**

L’adaptation nommée **`native_crossed_prefix_assignment_bounds`** borne cette étape dans l’enveloppe commune à **128 contrôleurs**, **65 536 affectations examinées** et à l’échéance courante du niveau. Le compteur est unique pour la question en cours. Une interruption retourne une frontière inconnue et bloquante, sans action et sans acquisition ; elle n’est pas une réfutation physique. La méthode propre utilisée pour comparer l’oracle conserve son mode sans bornes. Ces bornes portent sur le produit d’affectations, après la mesure géométrique ; elles ne promettent pas une interruption à chaque pixel de cette mesure.

Si une couleur doit changer, le premier contrôleur concerné est proposé avec son unique adresse d’alternative. Sinon, la sélection du prochain contributeur suit les questions de croisement non résolues. Avant d’avoir une paire avec un propriétaire identifié, la source prépare le premier croisement informatif entre couleurs différentes, selon l’ordre `(i+j,j,i)`. Ensuite, elle peut continuer le premier préfixe incomplet. Le choix d’un contrôleur différent de la sélection mémorisée produit une action pointée ; sa sélection demeure hypothétique jusqu’à une avance observée.

Pour avancer, la source retrouve l’action déjà utilisée par le préfixe opposé à cette cellule. Les entrées candidates sont ordonnées à partir des paires compatibles les plus récentes, des entrées déjà acquises sur l’axe courant, de l’exploration, des entrées contraires puis des entrées encore disponibles. Les blocages ne portent que sur le contexte exact `[clé du contrôleur, indice, action opposée]`. Une absence d’effet retire l’entrée de ce contexte, sans déclarer son impossibilité universelle. Une nouvelle référence d’observation seule ne supprime pas ce blocage.

La disponibilité des actions limite finalement le choix. Le corps propre ne consomme pas la liste de points d’exploration pour décider son adresse ; il la mesure lui-même. Son `propose` ne conditionne pas l’offre propre à `max_prefix` : les limites zéro et négative restent donc des cas source. L’enveloppe commune vérifie séparément que le nombre d’actions restantes est positif.

## Gardes, limites d’authentification et liaison

Avant l’action, la garde propre exige l’index zéro, la même époque, le même score, la même référence d’observation, la disponibilité de l’action stockée dans le plan, le digest exact de toute l’image et la présence de la référence. Une modification de pixel extérieure au champ suffit à refuser ce plan.

Cette garde **n’authentifie pas l’enveloppe complète** : elle ne recalcule pas l’identité de proposition, ne compare pas toutes les actions externes, celles du bundle ou du pas, et ne vérifie pas séparément les coordonnées de `plan.action`. Les cas de réécriture de ces champs restent conservés. Les vérifications d’enveloppe, d’autorité, de connaissance et de domaine du moteur commun sont des obligations distinctes.

L’enveloppe `cross_propose` ajoute la portée `expected_before`. Une proposition pointée reçoit un support contenant le point, sa palette courante, une boîte d’un pixel, l’identité du contrôleur, sa signature et le digest de toute l’image. Pour ce point, `bind` exige un domaine contenant le couple époque/image, **exactement une action**, et l’égalité entre l’adresse du support et celle de l’action. Il copie ensuite le support dans le premier pas. Il ne remesure pas à cet endroit la palette ou la signature.

Pour une action non pointée, `CrossedPrefixConstraint.bind` exige uniquement la présence d’un plan CrossedPrefix. Il ne vérifie pas lui-même la taille de toute la liste d’actions ou un domaine de pointage. Cette différence est propre à la source et ne doit pas être remplacée dans la documentation par le contrat `zip` d’une autre famille.

Après l’action, tout résultat scelle le préfixe. Une différence d’époque ou de score, ou un état `WIN`/`GAME_OVER`, retourne une frontière officielle ou terminale avec `matched: null`. Une référence modifiée produit un refus. Une recoloration compare l’apparence du contrôleur remesuré à la couleur demandée. Une sélection seule demeure hypothétique avec `matched: null`.

Pour une avance, la source constate si les pixels de la cellule cible ont changé. L’image entière inchangée signifie une absence d’effet dans ce croisement ; une image différente sans changement de la cellule cible produit un effet non local inexpliqué. Si une action opposée est déjà connue, la propriété de référence ne compare que **le pixel central de la cellule**. Une cellule entière uniforme, une loi d’intersection universelle et un succès officiel ne sont pas établis par ce contrôle.

## Acquisition, réfutation et reprise

L’acquisition appelle d’abord les couches héritées, copie l’état précédant l’action, puis applique les événements propres dans l’ordre retourné. Une sélection mémorise la clé du contrôleur. Une recoloration réfutée invalide l’état. Une avance observée, ou une frontière d’époque/score, augmente le progrès d’une cellule, conserve l’action réellement retournée et crée une question d’intersection. La frontière source porte sur une **inégalité** de score : une baisse de score est également traitée comme une frontière. Un état terminal sans changement d’époque ou de score ne remplit pas cette condition d’acquisition et peut invalider une avance restée indéterminée.

La commande réellement passée à `record` est conservée même si elle diffère de celle de la proposition. Le composant ne remplace pas les contrôles de livraison de commande du moteur commun. Les fixtures conservent explicitement ce cas contraire.

Lorsqu’un croisement a changé hors frontière, une paire peut être acquise avec les actions de ses deux axes et le propriétaire déduit de l’apparence centrale remesurée. Si aucune couleur ou plusieurs couleurs correspondent, le propriétaire reste `null` et la paire n’est pas consommée comme une paire connue. Une propriété de référence manquée invalide l’état local ; la paire observée et son contre-exemple ne sont pas effacés. Les paires d’époques précédentes peuvent être réutilisées expérimentalement, sans prouver une loi universelle valable à chaque niveau.

Une absence totale d’effet ajoute uniquement un blocage contextualisé. Un effet non local inexpliqué ou une référence réfutée invalide l’état. Chaque acquisition propre termine par un événement `crossed_prefix_state`. Les entrées d’axe sont un ensemble, mais les événements dupliqués restent présents dans le journal source ; une déduplication physique par transaction relève du propriétaire commun, pas d’une suppression inventée dans la mémoire propre.

La restauration originale rejoue les événements dans une nouvelle mémoire, compare le digest, puis remplace le propriétaire courant. Un digest corrompu ou un événement qui lève une exception avant ce remplacement laisse l’ancien propriétaire intact. L’oracle distingue le journal propre, sa projection, le digest du parent et le digest composé.

L’adaptation **`native_atomic_crossed_prefix_event_validation`** exige des valeurs JSON canoniques et valide avant mutation la présence de l’état ou, pour une entrée acquise, l’axe 0/1 et l’action sous forme de chaîne. Les anciennes paires opaques et les états minimaux déjà conservés par la publication 0.48 restent des données de mémoire, sans fabrication de champs manquants. Une paire ancienne `{kind, owner}` ou un état `{epoch}` ne devient pas une preuve de capacité de planification ; la source elle-même peut lever une exception lorsqu’un calcul consomme une dépendance absente. La conservation et la capacité à produire une nouvelle proposition restent deux contrats distincts. Les refus natifs et l’atomicité ne revendiquent pas l’équivalence des classes d’exception Python et TypeScript.

## Preuves source indépendantes

La [fixture originale](../../tests/fixtures/v6-crossed-prefix-reference.json.gz) et le [reçu d’export](lot3h-evidence/diagnostic/source-oracle-export.json) conservent :

| Collection | Cas |
| --- | ---: |
| Géométries | 28 |
| Mesures de contrôleurs | 7 |
| Helpers de référence, cellule, extraction et points | 35 |
| Propositions propres et communes | 38 |
| Gardes et liaisons | 34 |
| Acquisitions | 17 |
| Application d’événements | 7 |
| Restaurations | 6 |
| Chaînes froides | 3 |

Ces collections ont des portées différentes et ne constituent pas un total de tests natifs. Douze exceptions source sont conservées comme résultats de contrat, et non comme échecs du générateur. Les trois chaînes démarrent avec une mémoire vide, calculent la proposition source, acquièrent les retours synthétiques explicitement fournis, puis reconstruisent la mémoire après chaque pas. Elles couvrent une paire compatible, une absence d’effet suivie d’un autre essai et un croisement réfuté qui suspend la suite. Aucun état attendu natif ne prépare ces chaînes.

Le [plan préalable du scan public](lot3h-evidence/diagnostic/initial-public-scan-plan.json) limite l’analyse aux images initiales canoniques déjà archivées, avec exclusion de CWSE, SK48, FOGW et VOIS avant les appels. Le [résultat](lot3h-evidence/diagnostic/crossed-prefix-public-admission.json) conserve **96 vues, zéro exception et une admission géométrique : WEAV**. Cette vue publique comporte six contrôleurs et le pointage disponible. Le scan n’appelle que `geometry` ; il ne sélectionne aucun jeu cible, ne lance aucune action et ne modifie aucune horloge. Une admission ne prouve ni une proposition sélectionnée par l’appelant commun, ni une acquisition, ni un niveau résolu. Toute campagne ultérieure doit garder sa déclaration et ses preuves distinctes.

## Campagne publique WEAV et contribution acquise

La reprise de WEAV possède sa [déclaration séparée](lot3h-evidence/weav-resumption.json), qui conserve les **474,037204 secondes** déjà consommées par le cas et fixe une échéance cumulée au **10 novembre 2026 à 13:51:26,464496 UTC−03**. La [campagne commune capturée](lot3h-evidence/final/weav-crossed-prefix-session/weav-campaign.json.gz) atteint trois niveaux résolus, puis s’arrête au niveau 4 avec le motif `target_levels_completed` : **81 actions, 81 préfixes propres CrossedPrefix**. Il s’agit de l’objectif borné de cette campagne, pas d’une déclaration de victoire finale du jeu.

Le [recalcul Python indépendant](lot3h-evidence/diagnostic/weav-public-source-parity.json.gz), achevé à **13:28:21 UTC−03**, démarre avec une mémoire propre vide et reconstruit les propositions à partir des seules observations publiques et des retours réellement acquis. Les champs `plan.state` capturés sont des valeurs de comparaison ; ils n’initialisent jamais cette mémoire. Les **82 observations complètes** sont remesurées par l’observateur original et concordent avec les observations conservées par Inventory. Les 1 786 fichiers originaux restent inchangés avant et après le recalcul.

Les **81 propositions**, leurs liaisons pointées, les gardes des **81 retours** et les **159 événements propres** concordent sans différence. Les propositions comprennent 22 sélections, 56 avances et 3 recolorations. Les événements comprennent 81 états locaux, 54 entrées d’axe et 24 paires. Les deux avances sans effet restent dans les preuves, avec leur refus local et leur blocage acquis ; elles ne sont ni retirées ni transformées en contribution observée. Les frontières officielles sont conservées aux retours 27, 54 et 81.

Tous les champs de proposition source sont comparés. Le plan propre, les actions et le bundle sont comparés intégralement. Les quatre ajouts d’enveloppe du moteur commun — `composition_target_tree`, `field_subquestion`, `morphology` et `strategy_receipt` — sont enregistrés séparément dans chaque contexte. Aucun champ source n’est supprimé pour obtenir la parité. Cette comparaison ne prétend pas reproduire l’appelant hérité entier, son ordonnanceur ou son temps d’exécution.

Le [contrôle natif indépendant](lot3h-evidence/diagnostic/weav-public-parity.json), achevé à **13:30:01 UTC−03**, passe **3 596 contrôles**. Il démarre lui aussi à froid, recalcule la proposition commune propre complète et sa liaison, puis acquiert chaque retour public. Il vérifie 162 reconstructions de mémoire propre, avant chaque proposition et après chaque retour. Le recalcul Python vérifie en plus une reconstruction finale, soit 163. Chaque digest est contrôlé dans la portée propre sur un digest parent opaque ; cette preuve ne remplace pas la restauration de tout le moteur commun.

Les mêmes contextes publics servent à quatre interventions de composant. Chaque intervention reconstruit une mémoire uniquement à partir d’événements acquis **avant** le contexte courant et retire une famille d’événements, ou le dernier retour acquis. Aucun futur événement, état appris préchargé ou nouvel appel au jeu n’intervient.

| Événements antérieurs omis | Contextes | Action ou refus modifié | Action et refus inchangés |
| --- | ---: | ---: | ---: |
| Paires de croisement | 81 | 53 | 28 |
| Entrées d’axe | 81 | 4 | 77 |
| États locaux | 81 | 75 | 6 |
| Dernier retour acquis | 81 | 59 | 22 |
| **Total** | **324** | **191** | **133** |

Les 324 interventions sont exécutées dans la source inchangée et dans le composant natif, avec des décisions concordantes. Au quatrième contexte sélectionné, retirer les entrées d’axe acquises transforme par exemple l’avance `ACTION2` en `ACTION1` ; le choix réel dépend donc de cette acquisition antérieure. Le premier contexte, encore vide, reste identique sous chacune des quatre interventions. Le compte des connaissances modifiées exclut les changements de seule identité du journal.

Ces interventions établissent une contribution du composant dans les contextes effectivement rencontrés. Elles ne sont pas quatre campagnes alternatives ni une ablation de l’appelant commun entier ; elles ne prédisent pas combien de niveaux un tel appelant résoudrait. Les 133 résultats sans changement d’action ou de refus restent publiés. Les bornes natives d’affectation restent actives lors du contrôle, avec une horloge de rejeu déterministe non expirée ; tous les produits source examinés appartiennent au domaine achevé déclaré. Aucun temps de calcul en direct n’est inféré de ce rejeu.

## Revue statique de l’intégration partagée

La [revue indépendante](lot3h-evidence/diagnostic/shared-integration-review.json) conserve les empreintes de 22 entrées examinées et 20 vérifications statiques, sans problème bloquant relevé. Elle vérifie notamment le propriétaire CrossedPrefix unique, les hooks dans le digest historique avant Marked/Program, l’acquisition avant Program, la coupure héritée RootedQuota, la priorité des gardes mixtes, le dispatch de `after` et le remplacement atomique du propriétaire restauré. Cette revue est distincte des tests exécutés par le lot.

La compatibilité historique est limitée aux checkpoints vérifiés et aux commandes produites par le protocole. L’ancien tri JavaScript de chaînes arbitraires peut différer du tri par points de code Python pour certaines chaînes hors domaine des commandes réellement produites. Le nouveau composant conserve le tri source ; aucune compatibilité universelle de digest pour des journaux arbitraires n’est annoncée. La conservation d’anciens états minimaux ou de paires opaques n’implique toujours pas qu’ils suffisent à planifier.

## Reproduction

```bash
python -B scripts/export-v6-crossed-prefix-reference.py
python -B scripts/export-v6-crossed-prefix-reference.py --scan-public
```

Le générateur [export-v6-crossed-prefix-reference.py](../../scripts/export-v6-crossed-prefix-reference.py) importe les originaux inchangés, vérifie leurs empreintes et produit un gzip déterministe (`mtime=0`). Le scan écrit son plan avant les appels source et conserve son corpus, ses exclusions et ses résultats. Il n’exécute aucun module natif, moteur de jeu, build, test global ou mesure de performance. Les tests ciblés, l’intégration commune, les campagnes, la compatibilité publiée et le coût officiel gardent leurs propres reçus.

Les scripts [compare-crossed-prefix-public-parity.py](../../scripts/compare-crossed-prefix-public-parity.py) et [check-crossed-prefix-public-parity.mjs](../../scripts/check-crossed-prefix-public-parity.mjs) produisent les deux reçus WEAV à partir de la session publique archivée. Leurs entrées et leurs propres empreintes figurent dans les reçus. Ils refusent de commencer ou de poursuivre l’analyse au-delà de l’échéance cumulée déclarée ; cette échéance n’est pas réinitialisée par un nouveau processus. Les reçus conservés constituent les résultats de l’exécution achevée dans cette fenêtre.

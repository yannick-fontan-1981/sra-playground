# Lot 3H : référence et préfixes couplés, moteur natif 0.49

## État du transfert

L’entrée **`coupled_prefix_reference`** est raccordée au moteur commun. La branche mesure un champ, une miniature de référence et deux familles de contrôleurs alignés. Elle propose ensuite une sélection, une modification d’apparence ou une avance expérimentale, puis conserve les effets du retour réellement reçu. Les coordonnées, apparences et commandes candidates viennent des pixels courants ou des observations acquises ; aucun nom de jeu, rôle de couleur fixé ou trajet préparé ne détermine l’action.

**Le lot 3H est clôturé dans le périmètre déclaré : transfert, contribution WEAV et coût global acceptés.** Les preuves et leurs limites restent distinctes dans les sections ci-dessous. Les preuves de composant et de boucle synthétique ne sont pas présentées comme une résolution de jeu ou une parité complète de l’appelant original.

Le périmètre formel passe **2 782/2 782 tests dans 71 fichiers**, sans échec, annulation, test ignoré ou TODO, ainsi que **5/5 contrôles du projet, compilation comprise**. Les rejeux CATR, RSWP, FOGW et VOIS passent **4/4 cas et 68/68 contrôles**, avec **159 actions et 88 préfixes** conservés. La [validation formelle](lot3h-evidence/final/validation/delta-tests-run.json), les [contrôles du projet](lot3h-evidence/final/validation/checks-run.json) et la [synthèse des régressions](lot3h-evidence/final/regressions/regression-summary.json) portent les empreintes et leurs périmètres respectifs. Il s’agit du delta formel déclaré, pas de toute la suite historique.

## Référence publiée et gel exécuté

La référence est **Site 76 / native 0.48.0**, commit **`fbbc3fb6b796c0ba359654da7234008767090e1f`**, digest natif **`fce8dfc3e6861742649203161b3bf55b6480462e44c77d8015453ce55b724a26`**. Le checkout publié distinct conserve ses **266 fichiers natifs**. Le [reçu de provenance](lot3h-evidence/baseline/provenance.json) lie cette identité à l’inventaire réel ; les anciens résultats de coût ne sont pas réutilisés comme échantillons d’une nouvelle fenêtre.

Le candidat **0.49.0** est gelé sous **`d6cb9abdf48a9062936d4647dbd809dc4cee1d1528f85e973fda83c7af8e6054`** : **268 fichiers natifs**, archive de **279 fichiers**. Le [manifeste natif](lot3h-evidence/final/source-manifest.json), l’[inventaire d’archive](lot3h-evidence/final/source-archive.json) et ses [parties](lot3h-evidence/final/source-archive-parts.json) identifient les octets exécutés. Les originaux V5/V6 restent ceux du commit `786dcf51ca57773d8e3a8948ce9ea3655e7baf8e` ; le code de production est TypeScript.

| Compteur | État 0.49 | Portée |
| --- | ---: | --- |
| Entrées DRM raccordées | **53/76**, aucune partielle | `coupled_prefix_reference` ajoute une entrée ; 23 restent ouvertes |
| Branches observées raccordées | **6/6** | La nouvelle question de fenêtre n’ajoute pas une septième branche observée |
| Workflows compilés | **37** | Compilation, distincte de la consommation et de la parité |
| Modules de composant vérifiés | **161** | Contrats de composant vérifiés dans leur portée |
| Modules partiellement transférés | **143** | Sous-ensembles consommés et héritages incomplets |
| Modules en attente | **1 065** | Périmètre source restant |
| Modules entièrement vérifiés | **0** | Aucune clôture de migration complète |

Le [registre](v6-entry-point-progress.json) et l’[audit de couverture](v6-coverage.json) mesurent des périmètres différents. `fullV6Parity` et les six portes de complétude restent faux.

## Contrats consommés et propriétaire commun

La [filiation source](lot3h-crossed-prefix-lineage.md) relie la projection, les propositions, les gardes, les événements et la restauration à `common_crossed_prefix.py`. La couche propre ne consomme aucun nouveau noyau V5 direct. Elle réutilise les mesures et l’identité génériques ainsi que les contrats hérités effectivement présents.

L’ordre DRM sélectionne `coupled_prefix_reference` immédiatement après `framed_window_composition`. **Cet ordre de sélection n’est pas une relation d’héritage entre CrossedPrefix et FramedWindow.** La chaîne source propre passe par SupportedLine puis RepeatedLine. Marked/Program et les autres descendants appellent l’acquisition CrossedPrefix à leur place dans cette chaîne ; les replis et acquisitions des parents restent partiellement transférés.

La version 0.48 conservait déjà les événements `crossed_prefix_state`, `crossed_prefix_input` et `crossed_prefix_pair` dans `SeriesEventMemory`. Le nouveau raccordement réutilise **ce même emplacement dans le digest**, avec un seul propriétaire métier. Les hooks communs délèguent la réduction et le digest à cette mémoire, sans ajouter un second journal ni une seconde réduction. La restauration reconstruit des propriétaires temporaires et ne les remplace qu’après validation du digest. L’identité du propriétaire, sa révision et son témoin structurel participent aux contrôles de réutilisation.

**Onze checkpoints réellement produits par la version publiée 0.48** sont restaurés par 0.49, dont FramedWindow et un ancien journal CrossedPrefix minimal. Ce journal conserve notamment un état `{epoch: 1}` et une paire `{kind, owner}` sans inventer les champs absents. La conservation de ces fragments n’affirme pas leur aptitude à produire une proposition future. La [fixture de compatibilité](../../tests/fixtures/v6-crossed-prefix-legacy-checkpoints.json.gz), le [reçu ciblé](lot3h-evidence/diagnostic/projection-integration-targeted.json) et la [revue indépendante d’intégration](lot3h-evidence/diagnostic/shared-integration-review.json) séparent ces preuves. La revue statique passe **20/20 contrôles**, sans se substituer aux exécutions de tests.

## Proposition, acquisition et refus

La mesure choisit un champ de supports rectangulaires répétés, une miniature de même proportion et deux familles de contrôleurs alignés. Les égalités du `Counter` Python, le premier maximum de champ, la première miniature parmi des matrices identiques et l’ordre des points sont conservés. Deux miniatures de valeurs différentes ou deux côtés complets de contrôleurs pour le même axe rendent la mesure ambiguë et sont refusés.

La proposition examine les apparences disponibles pour chaque contrôleur. Elle conserve la première affectation de coût minimal qui explique chaque valeur de référence par l’un des deux contrôleurs de sa cellule. Une recoloration nécessite une unique adresse courante pour l’apparence désirée. Une sélection de contrôleur reste hypothétique jusqu’à une avance observée.

Une avance acquise conserve l’entrée réellement retournée, le progrès du préfixe et une question de croisement. Une paire observée peut ensuite préciser quel axe explique l’apparence centrale du croisement. Un propriétaire ambigu reste `null` ; la paire n’est alors pas consommée comme une paire connue. Les entrées acquises sur un axe et les paires restent expérimentales lorsqu’elles sont réutilisées dans une autre époque.

Un retour sans aucun changement bloque uniquement le contexte `[contrôleur, indice du préfixe, action opposée]`. Une nouvelle référence d’observation ne supprime pas ce blocage. Une référence modifiée, une recoloration réfutée, une propriété attendue manquée ou un effet non local inexpliqué peut invalider l’état courant. Les événements et contre-exemples acquis restent conservés.

## Bornes et limites explicites

L’adaptation **`native_crossed_prefix_assignment_bounds`** limite l’affectation commune à **128 contrôleurs**, **65 536 affectations examinées** et à l’échéance courante du niveau. Le compteur appartient à toute la question ; il n’est pas réinitialisé à chaque candidat. Une interruption produit une frontière inconnue et bloquante, sans action ni acquisition. Elle ne prouve pas une impossibilité physique. La méthode propre utilisée par l’oracle conserve son mode source sans bornes.

Ces limites commencent **après la mesure géométrique et la collecte des candidats pointés**. Elles ne garantissent pas une préemption à chaque pixel de cette mesure. La source réutilise également la géométrie retenue d’une époque en vérifiant la référence et les contrôleurs ; elle ne redétecte pas toute la grille à chaque continuation.

L’adaptation **`native_atomic_crossed_prefix_event_validation`** valide les données JSON et les champs réellement consommés avant de muter l’état propre. Un retour dont le dernier événement est malformé ne peut pas acquérir préalablement une entrée valide du même batch. Les paires opaques historiques restent conservées telles quelles. Cette atomicité propre et celle de la restauration complète ne constituent pas une garantie de retour arrière pour toute exception arbitraire dans une couche partagée exécutée ultérieurement.

La garde propre vérifie époque, score, observation, action planifiée disponible, image entière et référence courante. Elle ne recalcule pas toute l’enveloppe, l’identité de proposition ou tous les payloads. La liaison pointée exige une seule action, un domaine courant et une adresse égale au support. La liaison non pointée source exige seulement la présence du plan propre. **Les contrôles communs d’enveloppe, d’autorité, de connaissance et WHY/ACT restent distincts et obligatoires.**

Après l’action, tout résultat propre scelle le préfixe. L’observation d’une cellule changée ne prouve pas une loi complète : la propriété de référence et le propriétaire d’une intersection sont testés sur **le pixel central**, sans exiger l’uniformité de toute la cellule. Une différence de score quelconque est une frontière source, y compris une baisse ; un état terminal sans différence d’époque ou de score ne crée pas automatiquement la même acquisition d’avance. Les cas contraires sont conservés dans l’oracle.

La compatibilité de digest est vérifiée pour les chaînes d’action du protocole et les onze checkpoints publiés. L’ancien réducteur autonome triait les chaînes selon UTF-16 JavaScript ; la nouvelle mémoire suit l’ordre des points de code Unicode de Python. Un ancien journal artificiel mélangeant des chaînes BMP et hors BMP peut donc produire un digest différent. **Aucune compatibilité universelle pour des chaînes d’action arbitraires n’est revendiquée.** Les classes d’exception Python/TypeScript, le domaine des images natives et les héritages incomplets gardent leurs qualifications dans la filiation et la revue.

## Oracle et validation de composant

L’[export indépendant](lot3h-evidence/diagnostic/source-oracle-export.json) vérifie les **1 786 fichiers originaux** avant et après les appels. Il n’inspecte aucun moteur, manuel, spécification ou solution de jeu et ne prend aucune sortie native comme attente.

| Collection source | Cas conservés |
| --- | ---: |
| Géométries | 28 |
| Contrôleurs | 7 |
| Helpers | 35 |
| Propositions propres et communes | 38 |
| Gardes et liaisons | 34 |
| Acquisitions | 17 |
| Application d’événements | 7 |
| Restaurations | 6 |
| Chaînes froides | 3 |

Ces collections ont des périmètres différents ; leur somme n’est pas un nombre de tests natifs. Douze exceptions source sont des résultats de contrat conservés, sans équivalence de classes d’erreur revendiquée.

Les tests ciblés finaux passent **81/81 pour la projection**, **111/111 pour l’accès** et **24/24 pour l’intégration partagée**. Le premier passage de projection, **78/79**, reste conservé : le test assimilait à tort `geometry([[]]) == None` au domaine natif, qui refuse déjà une largeur nulle. L’attente a été qualifiée sans changement de la projection de production, puis deux véritables cas d’égalité du `Counter` ont porté le périmètre à 81 tests. Les journaux d’accès 109/109, 110/110 et 111/111 restent aussi conservés ; le [reçu final d’accès](lot3h-evidence/diagnostic/crossed-prefix-access-final-targeted.json) lie la fixture finale. Le gel formel ultérieur est celui des 2 782 tests dans 71 fichiers.

## Boucle commune et contribution synthétique

La [preuve intégrée](lot3h-evidence/final/crossed-prefix-common-loop.json.gz) passe **23 groupes de contrôles**, dans **trois sessions froides**. Elle conserve les déclarations et priorités source. La première proposition est CellPatch, à sa place antérieure dans l’ordre commun. Le harnais lui fournit un retour synthétique inchangé ; CrossedPrefix peut ensuite être sélectionné. Les offres CellPatch intermédiaires, après des changements de pixels, sont également exécutées et conservées.

Les trois sessions totalisent **17 commandes retournées et acquises : 10 CrossedPrefix et 7 CellPatch**. Chaque retour passe par l’autorisation courante, le contrôleur, l’acquisition, le Kernel et la restauration. Trois commandes suivantes sont libérées puis laissées sans retour, ce qui ne les transforme pas en observations acquises.

| Branche contrôlée | Connaissance consommée | Décision suivante du contrôleur |
| --- | --- | --- |
| Paire compatible | Entrées des deux axes et paire observée | CrossedPrefix, pointage du contrôleur courant |
| Absence d’effet | Blocage de la seule entrée dans son contexte | CrossedPrefix, essai d’une autre entrée disponible |
| Croisement réfuté | État invalidé et contre-exemple conservé | Exploration commune, sans nouvelle proposition CrossedPrefix |

Trois retours invalides sont refusés sans modifier le graphe, l’autorité ou les propriétaires. Deux ablations de composant retirent chacune **un seul événement réellement acquis** : la paire compatible, ou l’état négatif. Au même contexte, chacune change l’action ou le refus. Les propriétaires contrefactuels sont séparés des sessions ; aucun état appris n’est injecté dans le contrôleur. Ces interventions ne sont pas des ablations de l’appelant complet.

La comparaison des projections propres avec les chaînes source ignore uniquement les champs de référence d’observation `evidence` et `source`, car les commandes CellPatch ajoutent de vraies observations dans le harnais commun. Les journaux natifs complets conservent ces références. Le rapport contient **zéro session de jeu, zéro action de jeu, zéro niveau de jeu et zéro victoire** ; la preuve synthétique ne fournit donc pas l’attribution en jeu de la section suivante.

Le rapport de 1 610 258 octets est conservé en [deux parties exactes](lot3h-evidence/final/crossed-prefix-common-loop.json.gz.parts.json). Le [reçu de transport](lot3h-evidence/final/common-loop-transport.json) vérifie la reconstruction byte pour byte ; le journal complet est conservé en gzip.

## WEAV : reprise du cas et qualification en jeu

<!-- WEAV_RESULT_START -->
**WEAV réussit trois niveaux en une session froide : 81 actions et 81 préfixes, avec arrivée naturelle au niveau 4.** Les frontières surviennent aux actions **27, 54 et 81**. La [résolution du cas](lot3h-evidence/final/weav-resolution.json) conserve la campagne, l’attribution et l’horloge. Le temps actif est **243,552986 secondes** ; il ne remplace pas le temps cumulé de diagnostic.

Le scan initial porte sur **96 vues publiques**, avec une admission WEAV et zéro exception. La reprise conserve l’échec historique du lot 2B : **97 actions, aucun niveau, 474,037204 secondes déjà consommées**. Le cas se clôture le **10 novembre 2026 à 13:32:44 UTC−03**, après **803,745411 secondes supplémentaires**, soit **1 277,782615 secondes cumulées** et **1 122,217385 secondes restantes**. La [référence 0.48 fraîche](lot3h-evidence/baseline-case-phase.json) est plafonnée aux huit actions annoncées et reste à zéro niveau ; cette référence bornée ne constitue pas un verdict complet d’impossibilité.

La [vérification source/native](lot3h-evidence/diagnostic/weav-public-parity.json) passe **3 596/3 596 contrôles** : **82 observations publiques, 81 propositions et liaisons, 81 retours, 159 événements acquis** (81 états, 54 entrées d’axe et 24 paires), **163 restaurations source et 162 natives**. Le recalcul part à froid ; l’état capturé dans un plan ne sert jamais à amorcer la mémoire. Les deux retours réellement sans effet et leurs blocages sont conservés.

Les **324 ablations de composant** concordent entre source et natif : **191 changements d’action ou de refus**, **133 résultats négatifs ou inchangés**. Retirer les paires modifie 53 choix, les entrées d’axe 4, les états locaux 75 et le dernier retour acquis 59. Les 215 changements de projection de décision ne sont pas confondus avec les 191 changements d’action/refus. Cette preuve établit une contribution aux contextes rencontrés ; elle ne représente ni une ablation de l’appelant complet ni quatre campagnes alternatives.

Le [navigateur](lot3h-evidence/final/browser/browser-qa.json) confirme **81 actions, trois niveaux et 81 plans**, après Pause à une action, action isolée puis reprises aux trois frontières naturelles. Les [observations d’interface](lot3h-evidence/final/browser/weav-native049-browser-ax.json) conservent les compteurs successifs 1/0/1, 2/0/2, 27/1/27, 54/2/54 et 81/3/81. La [capture finale](lot3h-evidence/final/browser/weav-native049-browser.png) montre le plateau du niveau 4 après navigation vers l’ancre PLAYGROUND ; cette navigation a réaffiché le panneau manuel, et les compteurs sont prouvés par la dernière observation enregistrée auparavant. Aucun saut de niveau ni action manuelle de jeu ne fournit le résultat.

Les originaux restent inchangés. La parité de toute la trajectoire propre sélectionnée ne clôt ni l’héritage complet ni l’ensemble de la migration.
<!-- WEAV_RESULT_END -->

## Non-régressions conservées

Les quatre rejeux utilisent les rapports réellement produits par 0.48 et les retours publics archivés. La commande native est recalculée avant que le harnais fournisse chaque retour enregistré.

| Cas | Actions | Préfixes | Niveaux conservés | Contrôles |
| --- | ---: | ---: | ---: | ---: |
| CATR | 12 | 8 | 3 | 17/17 |
| RSWP | 19 | 11 | 3 | 17/17 |
| FOGW | 50 | 27 | 3 | 17/17 |
| VOIS | 78 | 42 | 3 | 17/17 |

La [synthèse](lot3h-evidence/final/regressions/regression-summary.json) conserve les champs comparés, les identités des références et leurs limites. Les contrôles ne constituent pas de nouveaux succès en direct, ne démarrent pas de nouvelle horloge pour FOGW ou VOIS et ne démontrent pas à eux seuls une contribution CrossedPrefix.

## Coût officiel : règle et verdict

<!-- COST_RESULT_START -->
**Le coût global 0.49 est accepté sur 2/2 jeux**, selon la [règle autorisée](lot3h-evidence/performance/global-budget-policy.json) et la [décision finale](lot3h-evidence/performance/global-budget-decision.json). **3H est clôturé dans son périmètre annoncé**, avec validation fonctionnelle, contribution propre WEAV, intégrité et coût acquis.

| Jeu | Médiane 0.48 fraîche | Médiane 0.49 | Variation globale |
| --- | ---: | ---: | ---: |
| STCK | 10646,177953 ms | 10468,810379 ms | **−1,666021 %** |
| SMLP | 17105,686086 ms | 17561,375825 ms | **+2,663966 %** |

La [fenêtre complète](lot3h-evidence/performance/window.json) conserve **A1/B1/B2/A2**, **32 sessions mesurées et 400 actions**, sans exclusion de session mesurée ni de valeur extrême. Seules les huit chauffes déclarées, soit 24 actions, sont exclues. La médiane des huit sessions par jeu/version reste **strictement sous +10 % pour chacun des deux jeux**. Il n’y a ni compensation entre jeux, ni somme de phases imbriquées, ni moyenne des ratios des cohortes.

Le diagnostic agrégé conserve **15/16 critères**, avec **acquisition/persistance SMLP +15,162882 %**. Les cohortes restent **14/16 puis 12/16**. Le dépassement agrégé est accepté sous votre règle globale, tout en restant un dépassement dans le comparateur de phases inchangé. Les p95 agrégés augmentent notamment de **11,586919 % pour la persistance STCK**, **13,128495 % pour une nouvelle décision SMLP** et **21,013350 % pour la restauration SMLP**. Tous les diagnostics, effectifs, dispersions et résultats défavorables sont conservés dans le [rapport complet](lot3h-evidence/performance/results.md).

La [revue arithmétique](lot3h-evidence/performance/consolidation-review.json) passe **231/231 contrôles**. Ces mesures portent sur la boucle commune rejouant les retours publics ; elles excluent le moteur du jeu, le rendu du navigateur et le réseau de production. Elles ne garantissent pas le coût de toute future session ni la fermeture des réserves fonctionnelles.
<!-- COST_RESULT_END -->

## Suite et réserves conservées

La prochaine entrée autonome identifiée est **`recurrent_series`**, dernière entrée encore prévue au lot 3 après ce transfert. Les lots 4 à 10 et la consolidation 11 restent planifiés. La [feuille de route](v6-delivery-roadmap.md) porte les dépendances effectives et les conclusions de livraison ; une qualification technique, un résultat de jeu et une acceptation de coût gardent des portées distinctes.

La contribution FramedWindow en jeu, son préfiltre sans échéance interne, les suivis Population/Reception et le modèle RootedLine conservent leurs réserves. Les horloges **CWSE 2 399,683865 s**, **SK48 667,35444 s**, **FOGW 951,320275 s** et **VOIS 1 017,469531 s** restent inchangées. La reprise WEAV conserve son propre cumul antérieur et son échéance déclarée. Aucun transfert de cette livraison ne clôt la parité héritée complète ni les six conditions de migration globale.

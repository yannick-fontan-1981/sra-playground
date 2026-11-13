# Lot 2A : des observations courantes à une proposition morphologique

## Point de départ et périmètre

La base publiée vérifiée est **SRA Playground 60**, commit `9be3d0434f6f8ff91236d61a51eafa4017c3a082`, Logos Engine `0.32.0`. Le lot 1 conserve ses acquis et ses preuves. La demande suivante autorise la prochaine étape de la [feuille de route](v6-delivery-roadmap.md), le sous-lot **2A**.

La lacune de départ est concrète : `NativeMorphologyPolicy` exécutait déjà les règles SRC/DRM sur des faits fournis par les tests, mais aucun fournisseur de production ne produisait ces faits au groupe `morphology`. La [comparaison des deux factories](lot2a-evidence/ablation/registration-gap.json) confirme le groupe vide dans V60 puis son raccord courant. Les autres groupes et fournisseurs restent identiques. Cette preuve d'enregistrement ne comporte aucune décision ni action ; les preuves comportementales sont distinctes.

L'implémentation **`0.33.0`** contient **239 fichiers natifs**, gelés sous l'inventaire SHA-256 `cc4bcea77e0099dc035afa5d6ae03e0d5a7a00082633b8e2332691f34b769ad3`. Elle raccorde le domaine de `geometry.measure_routes` où `station_method` est absent. Une méthode non nulle, courante ou historique, reste hors de ce domaine. Les contacts et cycles de station réellement acquis dans l'époque courante sont couverts séparément.

## Ce qui fonctionne maintenant

Le nouveau producteur mesure les enceintes centrées et les paires de motifs. Il compare séparément forme, orientation, échelle et palette. Une paire ambiguë ou un contrôle insuffisamment observé ne devient pas une proposition certaine. Le contrôle réutilise l'histoire publique déjà acquise par GoalAccess et les primitives de mouvement existantes.

Les accès sont construits sur des surfaces réellement traversées, avec conservation des exemples de blocage et des déplacements non locaux. Le producteur distingue l'accès à un modificateur, au pair, à une expérience de palette ou de capacité, ainsi que les deux questions d'accès par un axe inverse encore inconnu. Le préfixe engagé reste borné à 16 actions et conserve le coût du trajet complet pour la comparaison avec la réserve mesurée.

Le domaine courant comprend aussi une correspondance partielle strictement étayée par une bordure occultée, les sites de palette actuellement revalidés, les stations observées dans l'époque courante et les cycles de sortie puis de rentrée effectivement attestés. Une prévision de rotation exige des entrées indépendantes, un effet cohérent et la préservation du pair. Le retour suivant peut confirmer ou réfuter cette prévision.

Ces faits alimentent la politique SRC existante, enregistrée dans le même Kernel que les autres programmes. Le résultat devient une proposition au rang prévu par la stratégie V6. Les gardes de géométrie, l'arbre de contribution et WHY/ACT vérifient ensuite chaque action. L'appel à l'extension de cible déjà transférée conserve les priorités source entre les résidus encore ouverts.

Le code de production ne choisit aucun comportement par nom de jeu, numéro de niveau, couleur fixée, commande directionnelle préparée ou solution enregistrée. Les comparaisons source comprennent des rotations, une réflexion, une permutation de palette et une translation de la scène.

## Une mémoire par responsabilité

| État | Propriétaire effectif | Usage du lot 2A |
| --- | --- | --- |
| Transitions publiques et modèles de mouvement | `caller:goal` | Lecture des observations déjà acquises ; aucune seconde histoire |
| Prévision de jauge et indices de collecte | `ObservedInventory.callerContext` | Même instance, même checkpoint et observation courante idempotente |
| Essais, contacts sélectifs, entrées, sorties et effets de palette | `family_state:morphology` | Journal des retours sélectionnés et des départs passifs prévus par la source |
| Faits, routes et décision actuelle | Calcul courant puis proposition engagée | Recalcul et liaison à l'observation, au pair et à l'époque |
| Autorisation et résultat commun | Autorité et Kernel existants | Gardes, WHY/ACT, acquisition puis décision suivante |

La restauration du propriétaire morphologique reconstruit les projections depuis son journal et vérifie leur concordance. Une acquisition répétée est idempotente ; une projection modifiée, un événement dupliqué ou deux contenus sous une même identité sont rejetés sans altérer l'état précédent. Les retours sont acquis dans l'ordre commun de la source, après scellement du préfixe.

La [filiation détaillée](lot2a-morphology-lineage.md) relie chaque fonction aux originaux V5/V6 et précise quelles parties déjà transférées sont réutilisées.

## Preuves et validation

Les [cas de référence](../../tests/fixtures/v6-morphology-measurements-reference.json.gz) sont produits par l'[exporteur Python](../../scripts/export-v6-morphology-measurements-reference.py). Il vérifie les **1 786 fichiers originaux** avant et après leur exécution. Les attentes ne proviennent pas du nouveau TypeScript.

Le nouveau delta comporte **41 tests**, fondés sur **26 cas et 143 rasters publics**. Il compare les paires, faits, routes, décisions, propositions complètes, gardes et retours sélectionnés. Il vérifie notamment la décision vers le pair après un retour sélectif, une réponse contraire, la prévision d'un cycle observé, les refus de coins ou d'intérieurs masqués, les effets de palette revalidés, l'interruption, la restauration et l'acquisition unique.

La validation formelle du delta passe **532 tests sur 532 dans onze fichiers**, sans échec, annulation ni test ignoré. Ce total comprend les 41 nouveaux contrats, les politiques DRM, les mouvements, les cibles, l'inventaire partagé, l'appelant, l'autorité, l'intégration et le contrôleur. Les [tests](lot2a-evidence/final/validation/delta-tests-run.json) lient les résultats aux entrées natives et aux tests inchangés pendant leur exécution. Le [contrôle du projet](lot2a-evidence/final/validation/checks-run.json) confirme typecheck, audit des entrées, audit de migration, contrôle du diff et build de production.

Les attentes des nouveaux cas viennent des originaux Python inchangés ; les attentes d'une campagne ne sont jamais données au moteur avant sa décision. Les campagnes lisent les observations publiques du véritable moteur de jeu Python isolé, puis le moteur TypeScript commun choisit et autorise ses commandes.

### TR87 : trois premiers niveaux réussis

La nouvelle campagne TR87 part à froid du niveau 1 et conserve la même session jusqu'à l'entrée du niveau 4. Elle réussit les trois premiers niveaux en **105 actions et 30 préfixes acquis** :

| Niveau | Actions du niveau | Préfixes | Temps actif de campagne |
| --- | ---: | ---: | ---: |
| 1 | 22 | 10 | 21,606 s |
| 2 | 37 | 10 | 40,223 s |
| 3 | 46 | 10 | 66,760 s |
| Total | **105** | **30** | **128,588 s** |

Le motif d'arrêt est `target_levels_completed`, à l'entrée du niveau 4 en `NOT_FINISHED`. Il s'agit de trois niveaux réussis, pas d'une victoire complète sur le jeu. Une initialisation, 105 acquisitions et 29 reprises maintiennent la continuité de l'appelant et les deux frontières naturelles.

Les 105 commandes proviennent de la famille générique déjà présente `word_interface`. La priorité source de cette famille empêche de consulter le producteur morphologique sur cette trajectoire ; les 105 appels passifs d'observation des départs restent effectués à leur position commune, sans acquérir d'événement de départ sur ce jeu. **Le succès TR87 n'est donc pas attribué à un gain de résolution dû à la nouvelle morphologie.** Il fournit le nouveau jeu à trois niveaux demandé et une validation intégrée de cette version du moteur.

Preuves : [exécution](lot2a-evidence/tr87-cold/execution-tr87.json), [résumé](lot2a-evidence/tr87-cold/campaign-summary.json), [trace publique](lot2a-evidence/tr87-cold/tr87-public-trace.json.gz), [rapport complet en parties exactes](lot2a-evidence/tr87-cold/tr87-campaign.json.gz.parts.json).

### LS20 : contribution morphologique réelle, puis échec au niveau 2

LS20 réussit son premier niveau en **28 actions**. Les 17 premières utilisent les calibrations et explorations existantes. La nouvelle morphologie fournit ensuite les **11 dernières actions du niveau** :

1. Actions 18 à 21 : accès `modifier` en quatre pas, choisi depuis les mesures courantes.
2. Retour réel de l'action 21 : changement sélectif de l'orientation, résidu **3 → 0**, pair préservé, entrée de station acquise.
3. Actions 22 à 24 : questions `peer_access_probe` sur l'axe encore inconnu.
4. Actions 25 à 28 : accès `peer` ; le moteur de jeu annonce la frontière officielle du niveau.

Le [court extrait causal](lot2a-evidence/ls20-cold/morphology-causal-excerpt.json) lie mesures, proposition, autorisation, retour et décision suivante. La [comparaison avec V60 immuable](lot2a-evidence/ablation/v60-ls20-first-divergence.json) retrouve les 18 premières commandes identiques puis la première divergence à l'action 19 : l'ancien appelant libère `ACTION3` depuis `view`, le nouveau libère `ACTION1` depuis `morphology`. La comparaison s'arrête avant de fournir un retour ne correspondant plus à la commande. Elle établit une différence de décision dans ce préfixe, sans prétendre que toute la campagne V60 échoue.

La session LS20 complète termine en **`GAME_OVER` au niveau 2**, après **144 actions, 82 préfixes et un seul niveau réussi**. Le temps actif est de **318,749 s**. Sur l'ensemble de la session, la morphologie est consultée 82 fois, sélectionnée sur 13 préfixes et fournit 65 actions ; 144 appels passifs de départ complètent l'acquisition commune. Cet échec est conservé avec le [rapport d'exécution](lot2a-evidence/ls20-cold/execution-ls20.json), la [trace publique](lot2a-evidence/ls20-cold/ls20-public-trace.json.gz) et le [rapport complet fractionné](lot2a-evidence/ls20-cold/ls20-campaign.json.gz.parts.json).

La comparaison indépendante sur cette trajectoire réexécute les originaux inchangés : **291 appels de morphologie concordent**, soit 82 propositions (13 offres et 69 abstentions), 65 retours sélectionnés et 144 appels passifs. Elle vérifie aussi **678 appels du contexte partagé**, **82 checkpoints complets du propriétaire** et les 65 résultats sélectionnés. Les 1 786 fichiers de référence restent inchangés avant et après. La [preuve complète](lot2a-evidence/ls20-cold/ls20-morphology-original-comparison.json.gz) exclut seulement les métadonnées natives documentées et les branches explicitement absentes de ce sous-lot.

Dans les cinq derniers états du niveau 2, la source conserve un résidu d'orientation `[1]`, trouve un accès au pair mais aucun accès au modificateur, puis refuse avec `modifier_access_unbound` pendant que la réserve passe de 4 à 0. Ce résultat explique l'abstention du composant courant. Il n'établit ni la réussite ni l'échec du caller Python complet, ni ce que produiront les futurs sous-lots 2B/2C.

### Horloges et intégrité

Le premier démarrage de campagne a détecté les actifs Pyodide manquants dans le checkout neuf, avant toute action de jeu. Le reçu d'échec est conservé dans [final](lot2a-evidence/final/execution-ls20.json). Les douze actifs restaurés ont été vérifiés contre le manifeste existant ; le code natif et le harness gelés n'ont pas été modifiés. L'horloge de sélection LS20 n'a pas été réinitialisée.

Le passage de LS20 à TR87 intervient **475,601 s après la sélection de LS20**, soit moins de huit minutes. TR87 termine et est archivé **233,288 s après sa propre sélection**, soit moins de quatre minutes. Les deux [résolutions LS20](lot2a-evidence/ls20-cold/selection-resolution.json) et [TR87](lot2a-evidence/tr87-cold/selection-resolution.json) conservent les échéances originales de 40 minutes. Aucun niveau n'est sauté, aucune trajectoire réussie n'est injectée et aucun nouvel essai n'efface la tentative échouée.

Chaque campagne conserve son propre gel identique des 239 fichiers, ses entrées de harness et ses reçus à leur emplacement initial. Les parties de transport sont des fragments exacts des archives, accompagnés de leurs sommes SHA-256 ; leur restauration ne réexécute pas le jeu. L'[index final des campagnes](lot2a-evidence/final/campaign-evidence-index.json) vérifie ces fichiers frères sans déplacer leurs preuves.

### Vérification dans l'interface

Le navigateur de l'aperçu géré confirme une nouvelle session TR87 depuis le niveau 1, au moyen de trois clics successifs sur **Run to next level**. Les arrêts visibles donnent respectivement **22 / 59 / 105 actions cumulées**, **1 / 2 / 3 niveaux réussis** et **10 / 20 / 30 plans terminés**. Aucune navigation de niveau, réinitialisation ou nouvelle session de raisonnement n'intervient entre les niveaux. L'inspecteur reste fermé pendant le parcours.

L'interface s'arrête au niveau 4 avec le message `Level completed.`, le bouton Run disponible et Pause désactivé. Le [reçu navigateur](lot2a-evidence/final/tr87-browser-verification.json) et la [capture finale](lot2a-evidence/final/tr87-browser.png) conservent ces observations. Cette vérification porte sur le parcours et le rendu ; les temps de campagne ci-dessus ne sont pas présentés comme un benchmark du navigateur.

Après le parcours, une [lecture du graphe dans l'interface](lot2a-evidence/final/tr87-browser-graph-verification.json) confirme le programme commun `v6.morphology.evaluate` parmi les nœuds conservés. Le graphe contient 1 494 nœuds et 3 856 révisions enregistrées. Cette inspection ne joue aucune action et ne modifie aucun programme ; les compteurs restent 105/3/30. La présence du programme ne transforme pas les actions `word_interface` de TR87 en sélection morphologique.

## Coûts mesurés avant et après

La [comparaison stricte](lot2a-evidence/performance/comparison.json) est **réussie**, avec **16 métriques sur 16 dans le budget initial de +10 %** pour STCK et SMLP. Il n'existe aucun dépassement non résolu. La plus forte hausse de médiane est **+3,90 %**, pour le garde de continuation STCK : 0,259 → 0,270 ms. Le protocole, les cas, les limites d'actions et le seuil n'ont pas été modifiés après lecture des résultats.

La référence V60 a été remesurée dans cette session. Les deux versions exécutent les mêmes 222 actions mesurées et neuf actions de chauffe, avec trois sessions par cas, une mémoire initialement vide par session et un worker conservé chaud. Les entrées, le harness, les commandes et les comptes d'acquisition concordent. Le code natif reste inchangé pendant les mesures.

| Session du contrôleur | Actions / niveaux par répétition | Médiane avant | Médiane après | Variation observée |
| --- | ---: | ---: | ---: | ---: |
| STCK | 10 / 2 | 12,325 s | 12,314 s | −0,09 % |
| SMLP | 15 / 3 | 29,464 s | 27,837 s | −5,52 % |
| LIFE | 49 / 3 | 134,203 s | 131,589 s | −1,95 % |

Le budget annoncé concerne les médianes des huit postes STCK/SMLP : session, décision, service de continuation, requête de continuation, garde, acquisition avec persistance, persistance et restauration. Les queues de distribution ne sont pas toutes plus basses : le **p95 de restauration SMLP passe de 36,372 à 47,752 ms (+31,29 %)**. Le maximum du service de continuation STCK passe de 29,827 à 56,493 ms ; ses douze mesures ne permettent pas d'annoncer un p95 selon le protocole.

LIFE est le diagnostic de session plus longue, distinct du budget des deux témoins. Sa décision passe de **591,348 à 612,882 ms de médiane (+3,64 %)** et de **965,513 à 1 129,279 ms au p95 (+16,96 %)**, sur 141 mesures par version. Le garde augmente de 4,78 % sur six mesures ; acquisition et persistance augmentent respectivement de 0,71 % et 1,20 %. Ces hausses sont conservées, même si la médiane de session complète baisse.

Le [diagnostic du nouveau producteur](lot2a-evidence/performance/producer-costs.json) mesure cinq cas publics synthétiques vérifiés contre la source, après trois chauffes puis vingt appels par cas. La médiane du producteur seul va de **1,714 ms** pour une ambiguïté de paires à **9,205 ms** pour l'accès au modificateur ; la politique prend **0,940 à 1,209 ms**. Le coût combiné va de 2,661 à 10,474 ms. C'est une mesure absolue du nouveau travail ; V60 ne possédait pas ce producteur, donc aucun ratio depuis une référence artificiellement nulle n'est annoncé.

L'inspection reste mesurée séparément. Sur LIFE, service et transport passent de 2,401 à 2,532 s de médiane, sans inclure l'acceptation/clonage supplémentaire du contrôleur ni le rendu du panneau. Pause passe ses deux contrôles fixés : zéro action à la pause initiale, une acquisition pour l'action déjà engagée. L'accusé de réception synchrone est distinct de l'atteinte d'une frontière sûre, dont les médianes après modification vont de 0,911 à 4,379 s selon le cas et le point de pause. Ces résultats ne prouvent pas une préemption arbitraire de toute recherche.

Les mesures de session utilisent des retours publics archivés : le temps réel d'exécution du jeu, l'animation et le rendu navigateur sont exclus. Les postes imbriqués ne s'additionnent pas. Aucun p95 n'est publié sous vingt échantillons. La machine est partagée ; une génération de fixtures a pu chevaucher le début de la référence, tandis que le run après modification a utilisé une fenêtre sans autre travail lourd délibéré. Les dispersions entre répétitions limitent donc toute attribution causale d'un gain de vitesse. Les 49 actions LIFE ne constituent pas un essai de stabilité de plusieurs heures.

Le [bilan détaillé des coûts](lot2a-evidence/performance/results.md) conserve les échantillons, les effectifs, les extrêmes, les dispersions, les contrôles Pause et les limites de chaque mesure. Le [protocole de reproduction](lot2a-evidence/performance/README.md) et les reçus avant/après permettent de reprendre les mêmes conditions.

Le [contrôle final d'intégrité](lot2a-evidence/final/delivery-integrity.json) relie le gel natif aux tests, au build et aux reçus complémentaires. Les fichiers de campagne frères sont vérifiés par leur index dédié, et les fichiers de coût par l'[index des mesures](lot2a-evidence/final/performance-evidence-index.json). Ces contrôles portent sur les identités de fichiers, les statuts déjà obtenus et le transport sans perte ; ils ne constituent pas une campagne supplémentaire ni une preuve de parité globale.

## Limites et suite

Le registre conserve **50 entrées raccordées sur 76** et **26 restantes**. `morphology` est un groupe direct, hors de ce dénominateur. Le bundle reste à **37 workflows compilés** : le progrès porte sur les producteurs et leur consommation réelle, pas sur une nouvelle compilation annoncée comme une capacité.

Le fournisseur morphologique reste partiel au regard de l'ensemble V6. `morph.last` n'est pas encore transmis aux fournisseurs suivants ; `acquire_control_for_target` et `attention_parent_return` restent ouverts. Les méthodes de station et d'entrée transférées, la capacité gérée qu'elles peuvent activer et les chemins `entry_rebind` / `entry_probe` ne sont pas annoncés complets.

Le prochain sous-lot éligible est **2B** : relier la décision morphologique conservée au contrôle manquant puis au retour d'attention correspondant au bon parent, à la bonne paire et à la bonne portée. Le lot global 2 reste ouvert, de même que les autres lots de la feuille de route. Aucune porte de migration complète n'est avancée par le seul raccord des mesures.
